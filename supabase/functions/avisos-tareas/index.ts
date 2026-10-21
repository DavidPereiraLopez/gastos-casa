// Envía notificaciones push de las tareas del tablero que vencen dentro de 3 días o de 1 día.
// La llama cada mañana pg_cron (supabase/avisos-cron.sql). No envía nada dos veces aunque se llame de más.
// Secretos: VAPID_PUBLIC_KEY y VAPID_PRIVATE_KEY (la pública es la misma que vapidPublicKey en config.js).
import { createClient } from "jsr:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

type Aviso = { tarea_id: string; fecha_limite: string; dias: number; titulo: string; quien: string | null; user_id: string };

Deno.serve(async () => {
  const pub = Deno.env.get("VAPID_PUBLIC_KEY"), priv = Deno.env.get("VAPID_PRIVATE_KEY");
  if (!pub || !priv) return Response.json({ error: "Faltan los secretos VAPID_PUBLIC_KEY o VAPID_PRIVATE_KEY" }, { status: 500 });
  webpush.setVapidDetails("https://davidpereiralopez.github.io/gastos-casa/", pub, priv);
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const { data, error } = await sb.rpc("avisos_pendientes");
  if (error) return Response.json({ error: error.message }, { status: 500 });
  const avisos = (data ?? []) as Aviso[];
  const usuarios = [...new Set(avisos.map((a) => a.user_id))];
  const { data: subs, error: e2 } = usuarios.length ? await sb.from("push_suscripciones").select("*").in("user_id", usuarios) : { data: [], error: null };
  if (e2) return Response.json({ error: e2.message }, { status: 500 });

  let enviados = 0, sinMovil = 0;
  for (const a of avisos) {
    const mios = (subs ?? []).filter((s) => s.user_id === a.user_id);
    if (!mios.length) { sinMovil++; continue; } // aún no ha activado los avisos: se intentará mañana si sigue tocando
    const carga = JSON.stringify({
      title: a.dias === 1 ? `Mañana: ${a.titulo}` : `Quedan 3 días: ${a.titulo}`,
      body: (a.quien ? `Para ${a.quien}. ` : "") + "Toca para abrir el tablero.",
      tag: `tarea-${a.tarea_id}-${a.dias}`, url: "./",
    });
    let alguno = false;
    for (const s of mios) {
      try { await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, carga, { TTL: 86400 }); alguno = true; }
      catch (err) { if ([404, 410].includes((err as { statusCode?: number }).statusCode ?? 0)) await sb.from("push_suscripciones").delete().eq("endpoint", s.endpoint); } // móvil dado de baja
    }
    if (alguno) { await sb.from("avisos_tareas").upsert({ tarea_id: a.tarea_id, fecha_limite: a.fecha_limite, dias: a.dias, user_id: a.user_id }, { ignoreDuplicates: true }); enviados++; }
  }
  return Response.json({ avisos: avisos.length, enviados, sinMovil });
});
