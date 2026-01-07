alter table guest_links
  add column if not exists can_edit_attendance bool not null default false;
