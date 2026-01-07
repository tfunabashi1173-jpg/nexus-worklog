alter table attendance_entries
  add column if not exists nexus_user_id varchar references users(user_id) on delete set null;

create unique index if not exists attendance_entries_nexus_unique
  on attendance_entries(entry_date, project_id, nexus_user_id)
  where nexus_user_id is not null;

with normalized as (
  select
    id,
    btrim(replace(replace(work_type_text, '／', '/'), '　', ' ')) as normalized
  from attendance_entries
  where work_type_text is not null
    and work_type_text like 'ネクサス%'
),
parsed as (
  select
    id,
    nullif(btrim(split_part(normalized, '/', 2)), '') as raw_name,
    nullif(
      btrim(
        regexp_replace(
          normalized,
          '^ネクサス\s*/?\s*[^/]+\s*/?\s*',
          ''
        )
      ),
      ''
    ) as memo_only
  from normalized
)
update attendance_entries as a
set
  nexus_user_id = u.user_id,
  work_type_text = case
    when u.user_id is not null then parsed.memo_only
    else a.work_type_text
  end
from parsed
left join users as u
  on u.user_id = parsed.raw_name or u.username = parsed.raw_name
where a.id = parsed.id;
