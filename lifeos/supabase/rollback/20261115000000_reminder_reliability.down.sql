-- Rollback for 20261115000000_reminder_reliability.sql. Safe: the app works without these.
-- Pending server-side snoozes are lost (the in-app snooze still works while the app is open).
drop table if exists public.reminder_snoozes;
drop index if exists public.push_deliveries_user_sent;
alter table public.push_deliveries drop constraint if exists push_deliveries_status_check;
alter table public.push_deliveries
  drop column if exists status,
  drop column if exists error,
  drop column if exists devices,
  drop column if exists delivered,
  drop column if exists late;
