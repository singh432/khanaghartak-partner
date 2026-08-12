create or replace function public.owns_restaurant_folder(_folder text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare _id uuid;
begin
  begin
    _id := _folder::uuid;
  exception when others then
    return false;
  end;
  return exists (
    select 1 from public.restaurants r
    where r.id = _id and r.owner_id = auth.uid()
  );
end;
$$;

grant execute on function public.owns_restaurant_folder(text) to authenticated;

drop policy if exists "Owner upload own menu images" on storage.objects;
drop policy if exists "Owner update own menu images" on storage.objects;
drop policy if exists "Owner delete own menu images" on storage.objects;

create policy "Owner upload own menu images"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'menu-images'
  and (
    public.owns_restaurant_folder((storage.foldername(name))[1])
    or app_private.has_role(auth.uid(), 'super_admin'::app_role)
  )
);

create policy "Owner update own menu images"
on storage.objects for update to authenticated
using (
  bucket_id = 'menu-images'
  and (
    public.owns_restaurant_folder((storage.foldername(name))[1])
    or app_private.has_role(auth.uid(), 'super_admin'::app_role)
  )
)
with check (
  bucket_id = 'menu-images'
  and (
    public.owns_restaurant_folder((storage.foldername(name))[1])
    or app_private.has_role(auth.uid(), 'super_admin'::app_role)
  )
);

create policy "Owner delete own menu images"
on storage.objects for delete to authenticated
using (
  bucket_id = 'menu-images'
  and (
    public.owns_restaurant_folder((storage.foldername(name))[1])
    or app_private.has_role(auth.uid(), 'super_admin'::app_role)
  )
);