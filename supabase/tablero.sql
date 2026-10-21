-- Tablero Kanban del hogar: tareas en tres columnas (por hacer, haciendo, hecho).
-- Se puede ejecutar sobre una base que ya tenga schema.sql aplicado (también está incluido al final de schema.sql).
create table if not exists tareas (
  id uuid primary key default gen_random_uuid(),
  hogar_id uuid not null default mi_hogar() references hogares(id) on delete cascade,
  titulo text not null check (length(trim(titulo)) > 0),
  nota text,
  columna text not null default 'pendiente' check (columna in ('pendiente', 'haciendo', 'hecho')),
  orden double precision not null default 0, -- posición dentro de la columna (de menor a mayor)
  quien text,                                -- nombre de un miembro, o 'Los dos'
  fecha_limite date,
  creado_por uuid not null default auth.uid() references auth.users(id),
  creado timestamptz not null default now(),
  hecho timestamptz                          -- cuándo pasó a "Hecho"
);
create index if not exists tareas_hogar on tareas (hogar_id, columna, orden);

alter table tareas enable row level security;
drop policy if exists tareas_todo on tareas;
create policy tareas_todo on tareas for all to authenticated using (hogar_id = mi_hogar()) with check (hogar_id = mi_hogar());
grant select, insert, update, delete on tareas to authenticated;

do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin alter publication supabase_realtime add table tareas; exception when duplicate_object then null; end;
  end if;
end $$;
