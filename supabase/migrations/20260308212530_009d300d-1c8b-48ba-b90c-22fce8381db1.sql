
CREATE TABLE public.experiments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domain TEXT NOT NULL CHECK (domain IN ('annotations', 'characters', 'themes', 'prompts', 'content', 'ux_copy', 'meta')),
  target_id TEXT,
  description TEXT NOT NULL,
  before_value TEXT,
  after_value TEXT,
  score_insight SMALLINT CHECK (score_insight BETWEEN 1 AND 10),
  score_merit SMALLINT CHECK (score_merit BETWEEN 1 AND 10),
  score_coherence SMALLINT CHECK (score_coherence BETWEEN 1 AND 10),
  score_originality SMALLINT CHECK (score_originality BETWEEN 1 AND 10),
  composite_score NUMERIC(4,2),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'keep', 'discard', 'crash')),
  applied BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Public read access (no auth required for this app)
ALTER TABLE public.experiments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read experiments" ON public.experiments FOR SELECT USING (true);
CREATE POLICY "Service role insert experiments" ON public.experiments FOR INSERT WITH CHECK (true);
CREATE POLICY "Service role update experiments" ON public.experiments FOR UPDATE USING (true);
