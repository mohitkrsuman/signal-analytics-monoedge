CREATE TABLE public.rollups(
    mill_id TEXT NOT NULL,
    signal TEXT NOT NULL,
    bucket_start TIMESTAMPTZ NOT NULL,
    min DOUBLE PRECISION NOT NULL,
    max DOUBLE PRECISION NOT NULL,
    avg DOUBLE PRECISION NOT NULL,
    stddev DOUBLE PRECISION NOT NULL,
    count INTEGER NOT NULL,
    CONSTRAINT rollups_pkey PRIMARY KEY (mill_id, signal, bucket_start),
    FOREIGN KEY (mill_id, signal) REFERENCES public.signals(mill_id, signal) ON DELETE CASCADE
);
