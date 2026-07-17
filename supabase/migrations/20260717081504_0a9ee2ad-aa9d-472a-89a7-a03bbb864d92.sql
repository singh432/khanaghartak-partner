CREATE TABLE IF NOT EXISTS public.qr_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_url text NOT NULL DEFAULT 'https://khanaghartak.lovable.app',
  label text NOT NULL DEFAULT 'Scan to order',
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.qr_settings TO anon, authenticated;
GRANT ALL ON public.qr_settings TO service_role;
GRANT UPDATE, INSERT ON public.qr_settings TO authenticated;

ALTER TABLE public.qr_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read QR settings"
  ON public.qr_settings FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Super admin write QR settings"
  ON public.qr_settings FOR ALL TO authenticated
  USING (app_private.has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (app_private.has_role(auth.uid(), 'super_admin'::app_role));

INSERT INTO public.qr_settings (target_url, label)
SELECT 'https://khanaghartak.lovable.app', 'Scan to order'
WHERE NOT EXISTS (SELECT 1 FROM public.qr_settings);