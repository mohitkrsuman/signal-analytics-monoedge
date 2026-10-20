alter table public.mills enable row level security;
alter table public.signals enable row level security;
alter table public.readings enable row level security;
alter table public.rollups enable row level security;
alter table public.alerts enable row level security;

revoke all on table public.mills from anon, authenticated;
revoke all on table public.signals from anon, authenticated;
revoke all on table public.readings from anon, authenticated;
revoke all on table public.rollups from anon, authenticated;
revoke all on table public.alerts from anon, authenticated;

grant select on table public.mills to authenticated;
grant select on table public.signals to authenticated;
grant select on table public.readings to authenticated;
grant select on table public.rollups to authenticated;
grant select on table public.alerts to authenticated;

grant select, insert, update, delete on table public.mills to service_role;
grant select, insert, update, delete on table public.signals to service_role;
grant select, insert, update, delete on table public.readings to service_role;
grant select, insert, update, delete on table public.rollups to service_role;
grant select, insert, update, delete on table public.alerts to service_role;

create policy mills_select_authenticated
  on public.mills
  for select
  to authenticated
  using (true);

create policy signals_select_authenticated
  on public.signals
  for select
  to authenticated
  using (true);

create policy readings_select_authenticated
  on public.readings
  for select
  to authenticated
  using (true);

create policy rollups_select_authenticated
  on public.rollups
  for select
  to authenticated
  using (true);

create policy alerts_select_authenticated
  on public.alerts
  for select
  to authenticated
  using (true);
