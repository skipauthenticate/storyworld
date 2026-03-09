DROP POLICY "Service role insert experiments" ON public.experiments;
DROP POLICY "Service role update experiments" ON public.experiments;
CREATE POLICY "Service role insert experiments" ON public.experiments
  FOR INSERT TO service_role WITH CHECK (true);
CREATE POLICY "Service role update experiments" ON public.experiments
  FOR UPDATE TO service_role USING (true);