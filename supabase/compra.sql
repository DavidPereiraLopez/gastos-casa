-- Lista de la compra del hogar (también en schema.sql).
-- Ejecutar una vez en Supabase > SQL Editor sobre una base que ya tenía schema.sql.

-- Lo que hay que comprar ahora. lista 'super' = supermercado (se agrupa por sección), 'otras' = farmacia, ferretería…
-- Al quitar lo comprado se borra de aquí, pero el producto queda en compra_productos para sugerirlo.
create table if not exists compra (
  id uuid primary key default gen_random_uuid(),
  hogar_id uuid not null default mi_hogar() references hogares(id) on delete cascade,
  lista text not null default 'super' check (lista in ('super', 'otras')),
  nombre text not null check (length(trim(nombre)) > 0),
  cantidad text,           -- ej. "2", "1 kg"
  seccion text,            -- pasillo del súper: fruteria, carniceria, higiene…
  hecho boolean not null default false,
  creado_por uuid not null default auth.uid() references auth.users(id),
  creado timestamptz not null default now()
);
create index if not exists compra_hogar on compra (hogar_id, lista);

-- Lo que el hogar suele comprar: para sugerir mientras se escribe y recordar en qué sección va cada cosa.
create table if not exists compra_productos (
  hogar_id uuid not null default mi_hogar() references hogares(id) on delete cascade,
  lista text not null default 'super' check (lista in ('super', 'otras')),
  clave text not null,     -- nombre en minúsculas y sin acentos
  nombre text not null,
  seccion text,
  veces integer not null default 1,
  ultima timestamptz not null default now(),
  primary key (hogar_id, lista, clave)
);

alter table compra enable row level security;
alter table compra_productos enable row level security;
create policy compra_todo on compra for all to authenticated using (hogar_id = mi_hogar()) with check (hogar_id = mi_hogar());
create policy compra_productos_todo on compra_productos for all to authenticated using (hogar_id = mi_hogar()) with check (hogar_id = mi_hogar());
grant select, insert, update, delete on compra, compra_productos to authenticated;

do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin alter publication supabase_realtime add table compra; exception when duplicate_object then null; end;
  end if;
end $$;
