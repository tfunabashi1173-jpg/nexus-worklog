alter table guest_links
  add column if not exists expires_at date;
