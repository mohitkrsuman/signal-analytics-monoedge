alter table public.mills
  add column ingest_head timestamp with time zone;

comment on column public.mills.ingest_head is
  'Replay timestamp of the batch just saved. Live follows this while updated_at is recent.';
