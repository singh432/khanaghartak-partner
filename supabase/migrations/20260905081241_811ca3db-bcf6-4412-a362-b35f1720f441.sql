CREATE POLICY "Partners upload own docs" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'partner-docs' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Partners read own docs" ON storage.objects
FOR SELECT TO authenticated
USING (bucket_id = 'partner-docs' AND ((storage.foldername(name))[1] = auth.uid()::text OR app_private.has_role(auth.uid(), 'super_admin'::public.app_role)));

CREATE POLICY "Partners update own docs" ON storage.objects
FOR UPDATE TO authenticated
USING (bucket_id = 'partner-docs' AND (storage.foldername(name))[1] = auth.uid()::text)
WITH CHECK (bucket_id = 'partner-docs' AND (storage.foldername(name))[1] = auth.uid()::text);