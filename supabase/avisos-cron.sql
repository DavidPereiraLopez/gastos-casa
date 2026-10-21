-- Lanza cada mañana (07:00 UTC = 8:00 o 9:00 en España) la función que envía los avisos de tareas.
-- Cambia <ANON_KEY> por la clave pública de config.js. La función no envía nada dos veces aunque se llame de más.
create extension if not exists pg_cron;
create extension if not exists pg_net;
select cron.schedule('avisos-tareas', '0 7 * * *', $$
  select net.http_post(
    url := 'https://zlgfsjaxznrxwtfyoqrh.supabase.co/functions/v1/avisos-tareas',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer <ANON_KEY>'),
    body := '{}'::jsonb)
$$);
