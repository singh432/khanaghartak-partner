
-- 1) Fix storage policies for menu-images: check object path, not restaurant name
DROP POLICY IF EXISTS "Admin upload own menu images" ON storage.objects;
DROP POLICY IF EXISTS "Admin update own menu images" ON storage.objects;
DROP POLICY IF EXISTS "Admin delete own menu images" ON storage.objects;

CREATE POLICY "Admin upload own menu images"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'menu-images'
  AND app_private.has_role(auth.uid(), 'restaurant_admin'::app_role)
  AND EXISTS (
    SELECT 1 FROM public.restaurants r
    WHERE r.owner_id = auth.uid()
      AND r.id::text = (storage.foldername(storage.objects.name))[1]
  )
);

CREATE POLICY "Admin update own menu images"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'menu-images'
  AND app_private.has_role(auth.uid(), 'restaurant_admin'::app_role)
  AND EXISTS (
    SELECT 1 FROM public.restaurants r
    WHERE r.owner_id = auth.uid()
      AND r.id::text = (storage.foldername(storage.objects.name))[1]
  )
);

CREATE POLICY "Admin delete own menu images"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'menu-images'
  AND app_private.has_role(auth.uid(), 'restaurant_admin'::app_role)
  AND EXISTS (
    SELECT 1 FROM public.restaurants r
    WHERE r.owner_id = auth.uid()
      AND r.id::text = (storage.foldername(storage.objects.name))[1]
  )
);

-- 2) Hide owner_id from anonymous visitors (column-level revoke)
REVOKE SELECT (owner_id) ON public.restaurants FROM anon;

-- 3) Realtime channel authorization: only authenticated users, and only on
--    user-scoped topics (postgres_changes still works; broadcast/presence is restricted)
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can read own-topic realtime messages" ON realtime.messages;
DROP POLICY IF EXISTS "Authenticated can write own-topic realtime messages" ON realtime.messages;

CREATE POLICY "Authenticated can read own-topic realtime messages"
ON realtime.messages FOR SELECT TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND (
    realtime.topic() LIKE 'user:' || auth.uid()::text || ':%'
    OR realtime.topic() = 'user:' || auth.uid()::text
  )
);

CREATE POLICY "Authenticated can write own-topic realtime messages"
ON realtime.messages FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL
  AND (
    realtime.topic() LIKE 'user:' || auth.uid()::text || ':%'
    OR realtime.topic() = 'user:' || auth.uid()::text
  )
);
