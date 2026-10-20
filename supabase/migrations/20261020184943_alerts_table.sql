CREATE TABLE public.alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mill_id TEXT NOT NULL REFERENCES public.mills(id) ON DELETE CASCADE,
    started_at TIMESTAMPTZ NOT NULL,
    ended_at TIMESTAMPTZ,
    severity TEXT NOT NULL,
    reason TEXT NOT NULL,
    signals TEXT[] NOT NULL,
    detector TEXT NOT NULL CHECK (detector IN ('rule', 'zscore')),
    score DOUBLE PRECISION NOT NULL,
    context JSONB
);