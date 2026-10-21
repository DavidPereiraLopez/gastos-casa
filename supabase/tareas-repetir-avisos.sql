-- Tareas que se repiten, personas del hogar sin cuenta y avisos por correo de las tareas que vencen.
-- Se puede ejecutar sobre una base que ya tenga schema.sql y tablero.sql (también está incluido al final de schema.sql).

-- Personas del hogar que aún no tienen cuenta (ej. la pareja antes de unirse): [{ "nombre": "Vane", "email": "..." }]
alter table hogares add column if not exists personas jsonb not null default '[]';

-- Repetición: al pasar una tarea a Hecho, la app crea la siguiente en Por hacer
alter table tareas add column if not exists repetir text not null default 'no' check (repetir in ('no', 'diario', 'semanal', 'mensual', 'anual'));
alter table tareas add column if not exists cada smallint not null default 1 check (cada between 1 and 52);
alter table tareas add column if not exists hasta date; -- último día en que se repite (vacío = sin fin)

-- Correos ya enviados, para no repetirlos. Sin políticas: solo la función del servidor la usa.
create table if not exists avisos_tareas (
  tarea_id uuid not null references tareas(id) on delete cascade,
  fecha_limite date not null,
  dias smallint not null,      -- 3 o 1 días antes
  email text not null,
  enviado timestamptz not null default now(),
  primary key (tarea_id, fecha_limite, dias, email)
);
alter table avisos_tareas enable row level security;

-- Avisos que tocan hoy (hora de Madrid): tareas sin terminar que vencen dentro de 3 días o de 1 día,
-- para la persona asignada; las de "Los dos"/"Todos" o sin asignar, para todo el hogar.
create or replace function avisos_pendientes()
returns table (tarea_id uuid, fecha_limite date, dias int, titulo text, nota text, quien text, nombre text, email text)
language sql stable security definer set search_path = public, auth as $$
  with hoy as (select (now() at time zone 'Europe/Madrid')::date as d),
  t as (
    select ta.*, (ta.fecha_limite - hoy.d) as faltan
    from tareas ta, hoy
    where ta.columna <> 'hecho' and ta.fecha_limite - hoy.d in (1, 3)
  ),
  gente as (
    select m.hogar_id, m.nombre, u.email::text as email from miembros m join auth.users u on u.id = m.user_id
    union
    select h.id, p->>'nombre', nullif(trim(p->>'email'), '') from hogares h, jsonb_array_elements(h.personas) p
  )
  select distinct on (t.id, g.email) t.id, t.fecha_limite, t.faltan, t.titulo, t.nota, t.quien, g.nombre, g.email
  from t join gente g on g.hogar_id = t.hogar_id
  where g.email is not null
    and (t.quien is null or t.quien in ('Los dos', 'Todos') or t.quien = g.nombre)
    and not exists (select 1 from avisos_tareas a where a.tarea_id = t.id and a.fecha_limite = t.fecha_limite and a.dias = t.faltan and a.email = g.email)
$$;
revoke execute on function avisos_pendientes() from public, anon, authenticated;
grant execute on function avisos_pendientes() to service_role;
