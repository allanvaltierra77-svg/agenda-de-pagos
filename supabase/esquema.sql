-- Mi Agenda de Pagos — esquema inicial para Supabase
-- Ejecutar en SQL Editor DESPUÉS de revisar el README.
-- Seguridad: los dos usuarios deben registrarse/invitarse por separado en Supabase Auth.
-- No habilitar acceso público de escritura.

create extension if not exists pgcrypto;

create table if not exists public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Agenda familiar',
  created_at timestamptz not null default now()
);

create table if not exists public.household_members (
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'editor' check (role in ('owner','editor')),
  created_at timestamptz not null default now(),
  primary key (household_id, user_id)
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  amount numeric(12,2) not null default 0 check (amount >= 0),
  due_date date not null,
  frequency text not null default 'once' check (frequency in ('once','biweekly','monthly','custom')),
  category text not null default 'Otro',
  provider text,
  notes text,
  status text not null default 'pending' check (status in ('pending','paid','cancelled')),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.payment_history (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.payments(id) on delete cascade,
  household_id uuid not null references public.households(id) on delete cascade,
  paid_at date not null default current_date,
  amount_paid numeric(12,2) not null check (amount_paid >= 0),
  note text,
  recorded_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create index if not exists payments_household_due_idx on public.payments(household_id, due_date);
create index if not exists history_household_paid_idx on public.payment_history(household_id, paid_at desc);

alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.payments enable row level security;
alter table public.payment_history enable row level security;

-- Un miembro solo puede ver su hogar y sus miembros.
create policy "members can view their households"
on public.households for select to authenticated
using (exists (
  select 1 from public.household_members hm
  where hm.household_id = households.id and hm.user_id = (select auth.uid())
));

create policy "members can view household membership"
on public.household_members for select to authenticated
using (exists (
  select 1 from public.household_members me
  where me.household_id = household_members.household_id and me.user_id = (select auth.uid())
));

create policy "members can view payments"
on public.payments for select to authenticated
using (exists (
  select 1 from public.household_members hm
  where hm.household_id = payments.household_id and hm.user_id = (select auth.uid())
));

create policy "members can add payments"
on public.payments for insert to authenticated
with check (exists (
  select 1 from public.household_members hm
  where hm.household_id = payments.household_id and hm.user_id = (select auth.uid())
));

create policy "members can edit payments"
on public.payments for update to authenticated
using (exists (
  select 1 from public.household_members hm
  where hm.household_id = payments.household_id and hm.user_id = (select auth.uid())
))
with check (exists (
  select 1 from public.household_members hm
  where hm.household_id = payments.household_id and hm.user_id = (select auth.uid())
));

create policy "members can delete payments"
on public.payments for delete to authenticated
using (exists (
  select 1 from public.household_members hm
  where hm.household_id = payments.household_id and hm.user_id = (select auth.uid())
));

create policy "members can view payment history"
on public.payment_history for select to authenticated
using (exists (
  select 1 from public.household_members hm
  where hm.household_id = payment_history.household_id and hm.user_id = (select auth.uid())
));

create policy "members can add payment history"
on public.payment_history for insert to authenticated
with check (exists (
  select 1 from public.household_members hm
  where hm.household_id = payment_history.household_id and hm.user_id = (select auth.uid())
));

-- Nota: este esquema es un punto de partida. Antes de producción, crear hogar y membresías
-- desde un flujo administrativo seguro; no desactivar RLS ni publicar service_role keys.
