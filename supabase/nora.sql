-- Rutinas de Nora: tareas con hora de inicio y fin, días que se repiten, estrellas y premios.
-- Se puede ejecutar sobre una base que ya tenga schema.sql y avisos-push.sql.

-- Cada rutina: "Desayunar" de 9:00 a 9:15, de lunes a domingo. dias: 1 = lunes ... 7 = domingo.
create table if not exists nora_rutinas (
  id uuid primary key default gen_random_uuid(),
  hogar_id uuid not null default mi_hogar() references hogares(id) on delete cascade,
  peque text not null default 'Nora',
  nombre text not null check (length(trim(nombre)) > 0),
  icono text not null default '⭐',
  inicio time not null,
  fin time not null check (fin > inicio),
  dias smallint[] not null default '{1,2,3,4,5,6,7}',
  gana smallint not null default 1 check (gana between 0 and 5),  -- estrellas si la hace a tiempo
  pierde smallint not null default 1 check (pierde between 0 and 5), -- estrellas que pierde si no la hace
  aviso_min smallint default 3 check (aviso_min between 1 and 60), -- aviso antes del final (null = sin aviso)
  activa boolean not null default true,
  creado timestamptz not null default now()
);

-- Lo que pasó cada día con cada rutina. rutina_id vacío = estrellas puestas a mano por papá o mamá.
create table if not exists nora_registro (
  id uuid primary key default gen_random_uuid(),
  hogar_id uuid not null default mi_hogar() references hogares(id) on delete cascade,
  peque text not null default 'Nora',
  rutina_id uuid references nora_rutinas(id) on delete cascade,
  fecha date not null,
  estado text not null check (estado in ('bien', 'tarde', 'no', 'extra')),
  estrellas smallint not null,
  nota text,
  creado timestamptz not null default now(),
  unique (rutina_id, fecha)
);
create index if not exists nora_registro_hogar on nora_registro (hogar_id, fecha);

create table if not exists nora_premios (
  id uuid primary key default gen_random_uuid(),
  hogar_id uuid not null default mi_hogar() references hogares(id) on delete cascade,
  peque text not null default 'Nora',
  nombre text not null check (length(trim(nombre)) > 0),
  icono text not null default '🎁',
  coste smallint not null check (coste > 0),
  creado timestamptz not null default now()
);

-- Premios ya conseguidos (restan las estrellas que costaron)
create table if not exists nora_canjes (
  id uuid primary key default gen_random_uuid(),
  hogar_id uuid not null default mi_hogar() references hogares(id) on delete cascade,
  peque text not null default 'Nora',
  premio_id uuid references nora_premios(id) on delete set null,
  nombre text not null,
  icono text not null default '🎁',
  coste smallint not null check (coste > 0),
  creado timestamptz not null default now()
);

do $$ declare t text; begin
  foreach t in array array['nora_rutinas', 'nora_registro', 'nora_premios', 'nora_canjes'] loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy %I on %I for all to authenticated using (hogar_id = mi_hogar()) with check (hogar_id = mi_hogar())', t || '_hogar', t);
    execute format('grant select, insert, update, delete on %I to authenticated', t);
    if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
      begin execute format('alter publication supabase_realtime add table %I', t); exception when duplicate_object then null; end;
    end if;
  end loop;
end $$;

-- Aviso al móvil cuando faltan aviso_min minutos para que acabe una rutina (hora de Madrid).
-- Avisos ya enviados, para no repetirlos. Sin políticas: solo la función del servidor la usa.
create table if not exists avisos_nora (
  rutina_id uuid not null references nora_rutinas(id) on delete cascade,
  fecha date not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  enviado timestamptz not null default now(),
  primary key (rutina_id, fecha, user_id)
);
alter table avisos_nora enable row level security;

-- Rutinas de hoy a las que les faltan aviso_min minutos o menos, aún sin hacer, para cada miembro del hogar
create or replace function avisos_nora_pendientes()
returns table (rutina_id uuid, fecha date, nombre text, icono text, peque text, fin time, user_id uuid)
language sql stable security definer set search_path = public as $$
  with ahora as (select (now() at time zone 'Europe/Madrid') as t)
  select r.id, a.t::date, r.nombre, r.icono, r.peque, r.fin, m.user_id
  from nora_rutinas r cross join ahora a join miembros m on m.hogar_id = r.hogar_id
  where r.activa and r.aviso_min is not null
    and extract(isodow from a.t)::smallint = any (r.dias)
    and a.t::time >= r.fin - make_interval(mins => r.aviso_min) and a.t::time < r.fin
    and r.creado < a.t::date + r.inicio  -- la rutina ya existía cuando empezó hoy
    and not exists (select 1 from nora_registro g where g.rutina_id = r.id and g.fecha = a.t::date)
    and not exists (select 1 from avisos_nora v where v.rutina_id = r.id and v.fecha = a.t::date and v.user_id = m.user_id)
$$;
revoke execute on function avisos_nora_pendientes() from public, anon, authenticated;
grant execute on function avisos_nora_pendientes() to service_role;

-- Cada minuto: si hay algún aviso de Nora pendiente, llama a la función que envía las notificaciones.
-- Cambia <ANON_KEY> por la clave pública de config.js (la misma que usa avisos-cron.sql).
-- select cron.schedule('avisos-nora', '* * * * *', $$
--   select net.http_post(
--     url := 'https://zlgfsjaxznrxwtfyoqrh.supabase.co/functions/v1/avisos-tareas',
--     headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer <ANON_KEY>'),
--     body := '{"tipo":"nora"}'::jsonb)
--   where exists (select 1 from avisos_nora_pendientes())
-- $$);
