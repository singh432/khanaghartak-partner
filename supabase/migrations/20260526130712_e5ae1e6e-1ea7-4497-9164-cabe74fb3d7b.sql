
-- ROLES
create type public.app_role as enum ('customer', 'restaurant_admin');

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create policy "Users view own roles" on public.user_roles for select to authenticated
  using (auth.uid() = user_id or public.has_role(auth.uid(), 'restaurant_admin'));

-- PROFILES
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  phone text,
  address text,
  landmark text,
  latitude double precision,
  longitude double precision,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
create policy "Users select own profile" on public.profiles for select to authenticated using (auth.uid() = id);
create policy "Users insert own profile" on public.profiles for insert to authenticated with check (auth.uid() = id);
create policy "Users update own profile" on public.profiles for update to authenticated using (auth.uid() = id);
create policy "Admins read all profiles" on public.profiles for select to authenticated using (public.has_role(auth.uid(), 'restaurant_admin'));

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, phone)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.email), new.phone);
  insert into public.user_roles (user_id, role) values (new.id, 'customer') on conflict do nothing;
  return new;
end;
$$;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- RESTAURANT
create table public.restaurant (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  tagline text,
  image_url text,
  banner_url text,
  rating numeric(2,1) default 4.5,
  delivery_time text default '30-40 min',
  is_open boolean default true,
  address text,
  created_at timestamptz not null default now()
);
alter table public.restaurant enable row level security;
create policy "Public read restaurant" on public.restaurant for select using (true);
create policy "Admin write restaurant" on public.restaurant for all to authenticated
  using (public.has_role(auth.uid(), 'restaurant_admin'))
  with check (public.has_role(auth.uid(), 'restaurant_admin'));

-- CATEGORIES
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  priority int not null default 0,
  created_at timestamptz not null default now()
);
alter table public.categories enable row level security;
create policy "Public read categories" on public.categories for select using (true);
create policy "Admin write categories" on public.categories for all to authenticated
  using (public.has_role(auth.uid(), 'restaurant_admin'))
  with check (public.has_role(auth.uid(), 'restaurant_admin'));

-- MENU
create table public.menu_items (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.categories(id) on delete cascade,
  name text not null,
  description text,
  price numeric(10,2) not null,
  image_url text,
  veg_type text not null default 'veg' check (veg_type in ('veg','nonveg')),
  is_available boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.menu_items enable row level security;
create policy "Public read menu" on public.menu_items for select using (true);
create policy "Admin write menu" on public.menu_items for all to authenticated
  using (public.has_role(auth.uid(), 'restaurant_admin'))
  with check (public.has_role(auth.uid(), 'restaurant_admin'));

-- ORDERS
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  customer_name text not null,
  customer_phone text not null,
  address text not null,
  landmark text,
  notes text,
  latitude double precision,
  longitude double precision,
  items jsonb not null,
  subtotal numeric(10,2) not null,
  delivery_fee numeric(10,2) not null default 25,
  total numeric(10,2) not null,
  payment_method text not null default 'cod',
  status text not null default 'placed' check (status in ('placed','accepted','preparing','out_for_delivery','delivered','rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.orders enable row level security;
create policy "Users insert own orders" on public.orders for insert to authenticated with check (auth.uid() = user_id);
create policy "Users select own orders" on public.orders for select to authenticated using (auth.uid() = user_id);
create policy "Admins select all orders" on public.orders for select to authenticated using (public.has_role(auth.uid(), 'restaurant_admin'));
create policy "Admins update orders" on public.orders for update to authenticated using (public.has_role(auth.uid(), 'restaurant_admin'));

create or replace function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;
create trigger orders_touch before update on public.orders for each row execute function public.touch_updated_at();
create trigger profiles_touch before update on public.profiles for each row execute function public.touch_updated_at();

alter publication supabase_realtime add table public.orders;

-- SEED
insert into public.restaurant (name, tagline, rating, delivery_time, is_open, image_url, banner_url, address)
values ('KhanaGharTak Kitchen', 'Ghar Jaisa Khana, Seedha Aapke Ghar Tak', 4.6, '30-40 min', true,
  'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800',
  'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=1600',
  'Main Bazaar Road, Town Center');

insert into public.categories (name, priority) values
  ('Main Course', 1),
  ('Biryani', 2),
  ('Chinese', 3),
  ('Snacks', 4),
  ('Beverages', 5),
  ('Desserts', 6);

with c as (select id, name from public.categories)
insert into public.menu_items (category_id, name, description, price, image_url, veg_type) values
  ((select id from c where name='Main Course'), 'Paneer Butter Masala', 'Cottage cheese in rich tomato-butter gravy', 220, 'https://images.unsplash.com/photo-1631452180519-c014fe946bc7?w=600', 'veg'),
  ((select id from c where name='Main Course'), 'Dal Tadka', 'Yellow lentils tempered with ghee and spices', 160, 'https://images.unsplash.com/photo-1626777553635-2fdb3f6f2dca?w=600', 'veg'),
  ((select id from c where name='Main Course'), 'Butter Chicken', 'Tender chicken in creamy makhani gravy', 280, 'https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?w=600', 'nonveg'),
  ((select id from c where name='Biryani'), 'Veg Dum Biryani', 'Fragrant basmati rice with mixed vegetables', 200, 'https://images.unsplash.com/photo-1589302168068-964664d93dc0?w=600', 'veg'),
  ((select id from c where name='Biryani'), 'Chicken Biryani', 'Hyderabadi style chicken dum biryani', 260, 'https://images.unsplash.com/photo-1633945274405-b6c8069047b0?w=600', 'nonveg'),
  ((select id from c where name='Chinese'), 'Veg Hakka Noodles', 'Stir-fried noodles with veggies', 150, 'https://images.unsplash.com/photo-1612929633738-8fe44f7ec841?w=600', 'veg'),
  ((select id from c where name='Chinese'), 'Chilli Paneer', 'Paneer tossed in spicy Indo-Chinese sauce', 190, 'https://images.unsplash.com/photo-1606491956689-2ea866880c84?w=600', 'veg'),
  ((select id from c where name='Snacks'), 'Samosa (2 pcs)', 'Crispy pastry with spiced potato filling', 40, 'https://images.unsplash.com/photo-1601050690597-df0568f70950?w=600', 'veg'),
  ((select id from c where name='Snacks'), 'Paneer Tikka', 'Char-grilled marinated paneer', 220, 'https://images.unsplash.com/photo-1567188040759-fb8a883dc6d8?w=600', 'veg'),
  ((select id from c where name='Beverages'), 'Masala Chai', 'Hot Indian spiced tea', 30, 'https://images.unsplash.com/photo-1597318181409-cf64d0b5d8a2?w=600', 'veg'),
  ((select id from c where name='Beverages'), 'Sweet Lassi', 'Chilled yogurt drink', 60, 'https://images.unsplash.com/photo-1626078299034-94807c9d2f33?w=600', 'veg'),
  ((select id from c where name='Desserts'), 'Gulab Jamun (2 pcs)', 'Warm sugar-syrup dumplings', 60, 'https://images.unsplash.com/photo-1601303516534-bf94d27dbb39?w=600', 'veg'),
  ((select id from c where name='Desserts'), 'Rasmalai (2 pcs)', 'Soft cheese patties in saffron milk', 90, 'https://images.unsplash.com/photo-1605197788044-5e25f0b9b6c3?w=600', 'veg');
