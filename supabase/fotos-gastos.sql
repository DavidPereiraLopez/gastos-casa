-- Foto del ticket en cada gasto. Se puede ejecutar sobre una base que ya tenga schema.sql (también está incluido al final de schema.sql).
-- La foto va al mismo almacén privado que los tickets con garantía (bucket "tickets", carpeta del hogar), con las mismas reglas.
alter table gastos add column if not exists archivo text; -- ruta en Storage: <hogar_id>/<uuid>.jpg
