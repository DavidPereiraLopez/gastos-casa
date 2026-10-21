# Gastos de Casa

App web instalable (PWA) para apuntar y analizar los gastos de casa entre los dos. Gratis: Supabase (plan gratuito) para datos e inicio de sesión, y GitHub Pages para publicarla.

## Archivos
- `index.html`, `styles.css`, `app.js`: la app.
- `store.js`: guarda los datos en Supabase; si `config.js` no está rellenado, funciona en modo demo (solo en ese navegador).
- `config.js`: dirección del proyecto de Supabase y su clave pública (anon key).
- `supabase/schema.sql`: tablas y reglas de seguridad. Cada hogar solo ve sus propios datos.
- `supabase/calendario.sql`: la tabla del calendario compartido, para añadirla a una base que ya tenía `schema.sql`.
- `supabase/tablero.sql`: la tabla del tablero Kanban (tareas por hacer, haciendo y hechas), para añadirla a una base que ya tenía `schema.sql`.
- `supabase/tareas-repetir.sql`: tareas que se repiten y personas del hogar que aún no tienen cuenta.
- `supabase/avisos-push.sql`, `supabase/functions/avisos-tareas` y `supabase/avisos-cron.sql`: notificaciones push cuando a una tarea le quedan 3 días o 1 día. La función necesita los secretos `VAPID_PUBLIC_KEY` y `VAPID_PRIVATE_KEY`.
- `sw.js`, `manifest.webmanifest`, iconos: para instalarla en el móvil.
- `build-demo.py`: genera la página de demostración.

## Puesta en marcha
1. Crea una cuenta en supabase.com y un proyecto nuevo (región: Europa, plan Free).
2. En el proyecto: SQL Editor > New query, pega `supabase/schema.sql` y pulsa Run.
3. Project Settings > API: copia la Project URL y la anon public key en `config.js`. No uses nunca la service_role key.
4. Authentication > URL Configuration: pon como Site URL la dirección de GitHub Pages.
5. Publica la carpeta en GitHub Pages.
6. Cada uno abre la dirección en su móvil, crea su cuenta y la instala (Compartir > Añadir a pantalla de inicio).
   El primero crea el hogar; el segundo escribe el código de invitación que aparece en Más > Familia.

## Seguridad
- Inicio de sesión con correo y contraseña (Supabase Auth).
- Row Level Security en todas las tablas y en las fotos de tickets: nadie fuera del hogar puede leer ni escribir.
- Las fotos de tickets están en un almacén privado y se abren con enlaces que caducan a los 5 minutos.
- La app no guarda datos de bancos ni contraseñas bancarias. Los movimientos del banco entran por CSV.

## Límites del plan gratuito
500 MB de base de datos y 1 GB de archivos. Un proyecto gratuito se pausa si pasa una semana sin uso; se reactiva desde el panel de Supabase.
