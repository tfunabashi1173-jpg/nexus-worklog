create extension if not exists "pgcrypto";

create table if not exists work_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  id_deleted bool not null default false,
  deleted_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists work_types (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references work_categories(id) on delete set null,
  name text not null,
  id_deleted bool not null default false,
  deleted_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists partners (
  partner_id varchar primary key,
  name text not null,
  category text not null default '協力会社',
  safety_fee_rate numeric(6,3) not null default 0.000,
  payment_cycle int4 not null default 1,
  closing_day int4,
  payment_day int4,
  is_deleted bool,
  deleted_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists workers (
  id uuid primary key default gen_random_uuid(),
  contractor_id varchar not null references partners(partner_id) on delete restrict,
  name text not null,
  last_entry_date date,
  id_deleted bool not null default false,
  deleted_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists user_settings (
  user_id varchar primary key,
  default_project_id varchar,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists attendance_entries (
  id uuid primary key default gen_random_uuid(),
  entry_date date not null,
  project_id varchar not null,
  contractor_id varchar references partners(partner_id) on delete set null,
  worker_id uuid references workers(id) on delete restrict,
  nexus_user_id varchar references users(user_id) on delete set null,
  work_type_id uuid references work_types(id) on delete set null,
  work_type_text text,
  created_by varchar,
  created_at timestamptz not null default now(),
  unique(entry_date, project_id, worker_id)
);

create index if not exists attendance_entries_project_date_idx
  on attendance_entries(project_id, entry_date);

create unique index if not exists attendance_entries_nexus_unique
  on attendance_entries(entry_date, project_id, nexus_user_id);

create table if not exists guest_links (
  token text primary key,
  project_id varchar not null references projects(project_id) on delete cascade,
  expires_at date,
  can_edit_attendance bool not null default false,
  is_deleted bool not null default false,
  deleted_at timestamptz,
  created_at timestamptz not null default now()
);

create or replace function update_worker_last_entry()
returns trigger
language plpgsql
as $$
begin
  update workers
  set last_entry_date = greatest(coalesce(last_entry_date, new.entry_date), new.entry_date)
  where id = new.worker_id;
  return new;
end;
$$;

drop trigger if exists update_worker_last_entry_on_insert on attendance_entries;
create trigger update_worker_last_entry_on_insert
  after insert on attendance_entries
  for each row
  execute function update_worker_last_entry();
