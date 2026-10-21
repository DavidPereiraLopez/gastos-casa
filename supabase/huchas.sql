-- Huchas de efectivo y cuentas comunes con saldo (también en schema.sql).
-- Ejecutar una vez en Supabase > SQL Editor sobre una base que ya tenía schema.sql.

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
