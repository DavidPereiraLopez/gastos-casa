-- Calendario compartido del hogar: citas, turnos y tareas, con repeticiones hasta una fecha.
-- Se puede ejecutar sobre una base que ya tenga schema.sql aplicado (también está incluido al final de schema.sql).
create table if not exists eventos (
  id uuid primary key default gen_random_uuid(),
  hogar_id uuid not null default mi_hogar() references hogares(id) on delete cascade,
  titulo text not null check (length(trim(titulo)) > 0),
  fecha date not null,                 -- primer día (o el único, si no se repite)
  hora_ini time,                       -- sin hora = todo el día
  hora_fin time,
  quien text,                          -- nombre de un miembro, o 'Los dos'
  nota text,
  repetir text not null default 'no' check (repetir in ('no', 'diario', 'semanal', 'mensual')),
  cada smallint not null default 1 check (cada between 1 and 52), -- cada 1 semana, cada 2 semanas...
  dias_semana smallint[] not null default '{}', -- semanal: 1 = lunes ... 7 = domingo
  hasta date,                          -- último día en que se repite (vacío = sin fin)
  excepciones date[] not null default '{}', -- días de la serie que se han borrado o cambiado
  serie_id uuid references eventos(id) on delete cascade, -- copia de un día de una serie que se cambió aparte
  creado_por uuid not null default auth.uid() references auth.users(id),
  creado timestamptz not null default now(),
  check (hasta is null or hasta >= fecha)
);
create index if not exists eventos_hogar_fecha on eventos (hogar_id, fecha);
create index if not exists eventos_serie on eventos (serie_id);

alter table eventos enable row level security;
drop policy if exists eventos_todo on eventos;
create policy eventos_todo on eventos for all to authenticated using (hogar_id = mi_hogar()) with check (hogar_id = mi_hogar());
grant select, insert, update, delete on eventos to authenticated;

do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin alter publication supabase_realtime add table eventos; exception when duplicate_object then null; end;
  end if;
end $$;
