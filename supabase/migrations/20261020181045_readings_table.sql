create table public.readings(
    mill_id TEXT NOT NULL,
    signal TEXT NOT NULL,
    ts TIMESTAMPTZ NOT NULL,
    value DOUBLE PRECISION NOT NULL,
    CONSTRAINT reading_pkey PRIMARY KEY (mill_id, signal, ts),
    FOREIGN KEY (mill_id, signal) REFERENCES public.signals(mill_id, signal) ON DELETE CASCADE
);

CREATE INDEX idx_readings_query_range ON public.readings(mill_id, signal, ts DESC);
