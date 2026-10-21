-- Tareas que se repiten y personas del hogar que aún no tienen cuenta.
-- Se puede ejecutar sobre una base que ya tenga schema.sql y tablero.sql (también está incluido al final de schema.sql).

-- Personas del hogar que aún no tienen cuenta (ej. la pareja antes de unirse): [{ "nombre": "Vane", "email": "..." }]
alter table hogares add column if not exists personas jsonb not null default '[]';

-- Repetición: al pasar una tarea a Hecho, la app crea la siguiente en Por hacer
alter table tareas add column if not exists repetir text not null default 'no' check (repetir in ('no', 'diario', 'semanal', 'mensual', 'anual'));
alter table tareas add column if not exists cada smallint not null default 1 check (cada between 1 and 52);
alter table tareas add column if not exists hasta date; -- último día en que se repite (vacío = sin fin)
