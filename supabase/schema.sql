-- Gastos de Casa: esquema de base de datos para Supabase (plan gratuito)
-- Ejecutar una vez en Supabase > SQL Editor > New query > Run.
-- Seguridad: Row Level Security en todas las tablas; cada persona solo ve los datos de su hogar.

create extension if not exists pgcrypto;

-- Hogar (la familia) y sus miembros ------------------------------------------
create table if not exists hogares (
  id uuid primary key default gen_random_uuid(),
  nombre text not null default 'Casa',
  codigo_invitacion text not null unique default upper(substr(encode(gen_random_bytes(6), 'hex'), 1, 8)),
  grupos jsonb not null default '[
    {"g":"CASA","cats":["Supermercado","Luz y gas","Agua","Internet y móvil","Alquiler o hipoteca","Mantenimiento"]},
    {"g":"NIÑAS","cats":["Colegio","Extraescolares","Ropa","Médico"]},
    {"g":"TRANSPORTE","cats":["Gasolina","Transporte público","Coche"]},
    {"g":"OCIO","cats":["Comer fuera","Suscripciones","Vacaciones"]},
    {"g":"SALUD","cats":["Farmacia","Médico"]},
    {"g":"OTROS","cats":["Otros"]}]'::jsonb,
  cuentas jsonb not null default '["Cuenta común"]'::jsonb,
  presupuestos jsonb not null default '{}'::jsonb, -- {"CASA": 600, "NIÑAS": 250, ...} por mes
  creado timestamptz not null default now()
);

create table if not exists miembros (
  user_id uuid primary key references auth.users(id) on delete cascade,
  hogar_id uuid not null references hogares(id) on delete cascade,
  nombre text not null,
  cuenta_def text,
  pago_def text not null default 'Tarjeta',
  creado timestamptz not null default now()
);

-- Hogar de la persona que hace la consulta (security definer para no recursar en RLS)
create or replace function mi_hogar() returns uuid
language sql stable security definer set search_path = public as $$
  select hogar_id from miembros where user_id = auth.uid()
$$;

-- Gastos ----------------------------------------------------------------------
create table if not exists gastos (
  id uuid primary key default gen_random_uuid(),
  hogar_id uuid not null default mi_hogar() references hogares(id) on delete cascade,
  fecha date not null default current_date,
  importe numeric(12,2) not null check (importe > 0),
  grupo text not null,
  categoria text not null,
  nota text,
  quien text,
  forma_pago text,
  cuenta text,
  recurrente_id uuid,   -- si lo generó un gasto fijo
  periodo text,         -- 'AAAA-MM' del gasto fijo, para no duplicarlo
  creado_por uuid not null default auth.uid() references auth.users(id),
  creado timestamptz not null default now()
);
create unique index if not exists gastos_recurrente_periodo on gastos (recurrente_id, periodo);
create index if not exists gastos_hogar_fecha on gastos (hogar_id, fecha);

-- Gastos fijos (alquiler, luz, colegio...): se apuntan solos cada mes ----------
create table if not exists recurrentes (
  id uuid primary key default gen_random_uuid(),
  hogar_id uuid not null default mi_hogar() references hogares(id) on delete cascade,
  nombre text not null,
  importe numeric(12,2) not null check (importe > 0),
  grupo text not null,
  categoria text not null,
  dia smallint not null check (dia between 1 and 31),
  quien text,
  forma_pago text default 'Domiciliación',
  cuenta text,
  activo boolean not null default true,
  creado timestamptz not null default now()
);

-- Tickets con garantía (el archivo va en Storage, bucket privado "tickets") ----
create table if not exists tickets (
  id uuid primary key default gen_random_uuid(),
  hogar_id uuid not null default mi_hogar() references hogares(id) on delete cascade,
  producto text not null,
  tienda text,
  fecha_compra date not null,
  anos_garantia numeric(3,1) not null default 3,
  importe numeric(12,2),
  archivo text, -- ruta en Storage: <hogar_id>/<uuid>.<ext>
  creado_por uuid not null default auth.uid() references auth.users(id),
  creado timestamptz not null default now()
);

-- Row Level Security ------------------------------------------------------------
alter table hogares  enable row level security;
alter table miembros enable row level security;
alter table gastos   enable row level security;
alter table tickets  enable row level security;
alter table recurrentes enable row level security;

drop policy if exists hogar_ver on hogares;
create policy hogar_ver on hogares for select using (id = mi_hogar());
drop policy if exists hogar_editar on hogares;
create policy hogar_editar on hogares for update using (id = mi_hogar()) with check (id = mi_hogar());

drop policy if exists miembros_ver on miembros;
create policy miembros_ver on miembros for select using (hogar_id = mi_hogar());
drop policy if exists miembros_editar on miembros;
create policy miembros_editar on miembros for update using (hogar_id = mi_hogar()) with check (hogar_id = mi_hogar());

drop policy if exists gastos_todo on gastos;
create policy gastos_todo on gastos for all using (hogar_id = mi_hogar()) with check (hogar_id = mi_hogar());

drop policy if exists tickets_todo on tickets;
create policy tickets_todo on tickets for all using (hogar_id = mi_hogar()) with check (hogar_id = mi_hogar());

drop policy if exists recurrentes_todo on recurrentes;
create policy recurrentes_todo on recurrentes for all using (hogar_id = mi_hogar()) with check (hogar_id = mi_hogar());

-- Permisos de tabla para usuarios con sesión (los proyectos nuevos de Supabase no los dan por defecto).
-- Las reglas RLS de arriba siguen limitando cada fila a su hogar.
grant usage on schema public to authenticated;
grant select, update on hogares, miembros to authenticated;
grant select, insert, update, delete on gastos, tickets, recurrentes to authenticated;

-- Alta: crear hogar o unirse con el código de invitación -------------------------
create or replace function crear_hogar(p_nombre_persona text, p_nombre_hogar text default 'Casa')
returns uuid language plpgsql security definer set search_path = public as $$
declare h uuid;
begin
  if auth.uid() is null then raise exception 'Sin sesión'; end if;
  if exists (select 1 from miembros where user_id = auth.uid()) then raise exception 'Ya perteneces a un hogar'; end if;
  insert into hogares (nombre) values (coalesce(nullif(trim(p_nombre_hogar), ''), 'Casa')) returning id into h;
  insert into miembros (user_id, hogar_id, nombre, cuenta_def) values (auth.uid(), h, trim(p_nombre_persona), 'Cuenta común');
  return h;
end $$;

create or replace function unirse_hogar(p_codigo text, p_nombre_persona text)
returns uuid language plpgsql security definer set search_path = public as $$
declare h uuid; n int;
begin
  if auth.uid() is null then raise exception 'Sin sesión'; end if;
  if exists (select 1 from miembros where user_id = auth.uid()) then raise exception 'Ya perteneces a un hogar'; end if;
  select id into h from hogares where codigo_invitacion = upper(trim(p_codigo));
  if h is null then raise exception 'Código no válido'; end if;
  select count(*) into n from miembros where hogar_id = h;
  if n >= 6 then raise exception 'Este hogar ya está completo'; end if;
  insert into miembros (user_id, hogar_id, nombre, cuenta_def) values (auth.uid(), h, trim(p_nombre_persona), 'Cuenta común');
  return h;
end $$;

revoke all on function crear_hogar(text, text) from public, anon;
revoke all on function unirse_hogar(text, text) from public, anon;
grant execute on function crear_hogar(text, text) to authenticated;
grant execute on function unirse_hogar(text, text) to authenticated;
revoke all on function mi_hogar() from public, anon;
grant execute on function mi_hogar() to authenticated;

-- Storage: bucket privado para fotos y PDF de tickets ------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('tickets', 'tickets', false, 10485760, array['image/jpeg','image/png','image/webp','image/heic','application/pdf'])
on conflict (id) do nothing;

drop policy if exists tickets_storage on storage.objects;
create policy tickets_storage on storage.objects for all to authenticated
  using (bucket_id = 'tickets' and (storage.foldername(name))[1] = mi_hogar()::text)
  with check (bucket_id = 'tickets' and (storage.foldername(name))[1] = mi_hogar()::text);

-- Tiempo real: que los cambios de uno aparezcan al momento en el móvil del otro
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin alter publication supabase_realtime add table gastos, tickets, recurrentes; exception when duplicate_object then null; end;
  end if;
end $$;

-- Calendario compartido (también en calendario.sql) ------------------------------
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

-- Tablero Kanban (también en tablero.sql) ---------------------------------------
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

-- Tareas que se repiten y personas sin cuenta (también en tareas-repetir.sql) ------------------

-- Personas del hogar que aún no tienen cuenta (ej. la pareja antes de unirse): [{ "nombre": "Vane", "email": "..." }]
alter table hogares add column if not exists personas jsonb not null default '[]';

-- Repetición: al pasar una tarea a Hecho, la app crea la siguiente en Por hacer
alter table tareas add column if not exists repetir text not null default 'no' check (repetir in ('no', 'diario', 'semanal', 'mensual', 'anual'));
alter table tareas add column if not exists cada smallint not null default 1 check (cada between 1 and 52);
alter table tareas add column if not exists hasta date; -- último día en que se repite (vacío = sin fin)

-- Notificaciones push de tareas (también en avisos-push.sql) --------------------------------------
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

-- Claves VAPID de las notificaciones: la función avisos-tareas las crea la primera vez y las guarda en Vault.
-- La privada solo la lee el servidor (service_role); la pública la lee la app al activar los avisos.
create or replace function vapid_claves()
returns table (publica text, privada text) language sql stable security definer set search_path = public, vault as $$
  select (select decrypted_secret from vault.decrypted_secrets where name = 'vapid_public_key'),
         (select decrypted_secret from vault.decrypted_secrets where name = 'vapid_private_key')
$$;
revoke execute on function vapid_claves() from public, anon, authenticated;
grant execute on function vapid_claves() to service_role;

create or replace function guardar_vapid(p_publica text, p_privada text)
returns void language plpgsql security definer set search_path = public, vault as $$
begin
  if exists (select 1 from vault.secrets where name = 'vapid_private_key') then return; end if; -- nunca se sobrescriben
  perform vault.create_secret(p_privada, 'vapid_private_key');
  perform vault.create_secret(p_publica, 'vapid_public_key');
end $$;
revoke execute on function guardar_vapid(text, text) from public, anon, authenticated;
grant execute on function guardar_vapid(text, text) to service_role;

create or replace function vapid_publica()
returns text language sql stable security definer set search_path = public, vault as $$
  select decrypted_secret from vault.decrypted_secrets where name = 'vapid_public_key'
$$;
revoke execute on function vapid_publica() from public, anon;
grant execute on function vapid_publica() to authenticated;

-- Foto del ticket en cada gasto (también en fotos-gastos.sql) ----------------------------------
alter table gastos add column if not exists archivo text; -- ruta en Storage: <hogar_id>/<uuid>.jpg

-- Huchas de efectivo y cuentas comunes con saldo (también en huchas.sql) ----------------------
-- Cuentas de las que la app lleva el saldo: { "Cuenta VADA": { "desde": "2026-10-21" }, "Efectivo VADA": { ... } }
-- Desde ese día, los gastos pagados desde la cuenta restan de su saldo.
alter table hogares add column if not exists saldos jsonb not null default '{}';

-- Dinero que entra o sale de una hucha o cuenta común: aportaciones (de la cuenta de David a la cuenta VADA),
-- traspasos (de la cuenta VADA al efectivo VADA), saldo inicial y ajustes (sin origen o sin destino).
-- No son gastos: no cuentan en los totales ni en los gráficos.
create table if not exists movimientos (
  id uuid primary key default gen_random_uuid(),
  hogar_id uuid not null default mi_hogar() references hogares(id) on delete cascade,
  fecha date not null default current_date,
  importe numeric(12,2) not null check (importe > 0),
  origen text,   -- cuenta de la que sale (vacío = saldo inicial o ajuste a favor)
  destino text,  -- cuenta a la que llega (vacío = ajuste en contra)
  quien text,    -- quién lo aporta o lo mueve
  nota text,
  creado_por uuid not null default auth.uid() references auth.users(id),
  creado timestamptz not null default now(),
  check (origen is not null or destino is not null),
  check (origen is distinct from destino)
);
create index if not exists movimientos_hogar_fecha on movimientos (hogar_id, fecha);

alter table movimientos enable row level security;
drop policy if exists movimientos_todo on movimientos;
create policy movimientos_todo on movimientos for all to authenticated using (hogar_id = mi_hogar()) with check (hogar_id = mi_hogar());
grant select, insert, update, delete on movimientos to authenticated;

do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin alter publication supabase_realtime add table movimientos; exception when duplicate_object then null; end;
  end if;
end $$;
