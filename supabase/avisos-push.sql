-- Notificaciones push: suscripciones de cada móvil y avisos de tareas ya enviados.
-- Se puede ejecutar sobre una base que ya tenga schema.sql, tablero.sql y tareas-repetir.sql (también está al final de schema.sql).
create table if not exists push_suscripciones (
  endpoint text primary key,
  p256dh text not null,
  auth text not null,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  creado timestamptz not null default now()
);
alter table push_suscripciones enable row level security;
create policy push_propias on push_suscripciones for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, insert, update, delete on push_suscripciones to authenticated;

-- Avisos ya enviados, para no repetirlos. Sin políticas: solo la función del servidor la usa.
create table if not exists avisos_tareas (
  tarea_id uuid not null references tareas(id) on delete cascade,
  fecha_limite date not null,
  dias smallint not null,      -- 3 o 1 días antes
  user_id uuid not null references auth.users(id) on delete cascade,
  enviado timestamptz not null default now(),
  primary key (tarea_id, fecha_limite, dias, user_id)
);
alter table avisos_tareas enable row level security;

-- Avisos que tocan hoy (hora de Madrid): tareas sin terminar que vencen dentro de 3 días o de 1 día,
-- para el miembro asignado; las de "Los dos"/"Todos" o sin asignar, para todo el hogar.
create or replace function avisos_pendientes()
returns table (tarea_id uuid, fecha_limite date, dias int, titulo text, quien text, user_id uuid)
language sql stable security definer set search_path = public as $$
  with hoy as (select (now() at time zone 'Europe/Madrid')::date as d)
  select t.id, t.fecha_limite, t.fecha_limite - hoy.d, t.titulo, t.quien, m.user_id
  from tareas t cross join hoy join miembros m on m.hogar_id = t.hogar_id
  where t.columna <> 'hecho' and t.fecha_limite - hoy.d in (1, 3)
    and (t.quien is null or t.quien in ('Los dos', 'Todos') or t.quien = m.nombre)
    and not exists (select 1 from avisos_tareas a where a.tarea_id = t.id and a.fecha_limite = t.fecha_limite and a.dias = t.fecha_limite - hoy.d and a.user_id = m.user_id)
$$;
revoke execute on function avisos_pendientes() from public, anon, authenticated;
grant execute on function avisos_pendientes() to service_role;
