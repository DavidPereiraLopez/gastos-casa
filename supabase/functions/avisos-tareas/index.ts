// Envía notificaciones push de las tareas del tablero que vencen dentro de 3 días o de 1 día.
// La llama cada mañana pg_cron (supabase/avisos-cron.sql). No envía nada dos veces aunque se llame de más.
// Con {"tipo":"nora"} envía en su lugar los avisos de las rutinas de Nora a las que les quedan pocos minutos
// (la llama pg_cron cada minuto solo cuando hay alguno, ver supabase/nora.sql).
// Claves VAPID: la primera vez la función las genera y las guarda en Supabase Vault (guardar_vapid);
// la app lee la pública con vapid_publica(). La privada nunca sale del servidor.
import { createClient } from "jsr:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

type Aviso = { tarea_id: string; fecha_limite: string; dias: number; titulo: string; quien: string | null; user_id: string };

type AvisoNora = { rutina_id: string; fecha: string; nombre: string; icono: string; peque: string; fin: string; user_id: string };

Deno.serve(async (req) => {
  let tipo = "";
  try { tipo = (await req.json())?.tipo ?? "" } catch { /* sin cuerpo: avisos del tablero */ }
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  let { data: claves, error: e0 } = await sb.rpc("vapid_claves").single<{ publica: string | null; privada: string | null }>();
  if (e0) return Response.json({ error: e0.message }, { status: 500 });
  if (!claves?.privada) {
    const k = webpush.generateVAPIDKeys();
    const { error } = await sb.rpc("guardar_vapid", { p_publica: k.publicKey, p_privada: k.privateKey });
    if (error) return Response.json({ error: error.message }, { status: 500 });
    ({ data: claves } = await sb.rpc("vapid_claves").single());
  }
  webpush.setVapidDetails("https://davidpereiralopez.github.io/gastos-casa/", claves!.publica!, claves!.privada!);

  if (tipo === "nora") return avisosNora(sb);

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

// Rutinas de Nora: "Quedan 3 minutos: 🥣 Desayunar" a cada miembro del hogar con los avisos activados
// deno-lint-ignore no-explicit-any
async function avisosNora(sb: any) {
  const { data, error } = await sb.rpc("avisos_nora_pendientes");
  if (error) return Response.json({ error: error.message }, { status: 500 });
  const avisos = (data ?? []) as AvisoNora[];
  const usuarios = [...new Set(avisos.map((a) => a.user_id))];
  const { data: subs } = usuarios.length ? await sb.from("push_suscripciones").select("*").in("user_id", usuarios) : { data: [] };
  let enviados = 0;
  for (const a of avisos) {
    const [h, m] = a.fin.split(":").map(Number);
    const ahora = new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/Madrid" }));
    const quedan = Math.max(1, Math.ceil((h * 60 + m) - (ahora.getHours() * 60 + ahora.getMinutes() + ahora.getSeconds() / 60)));
    const carga = JSON.stringify({
      title: `${a.icono} ${a.peque}: quedan ${quedan} min`,
      body: `${a.nombre} acaba a las ${a.fin.slice(0, 5)}. Toca para abrir.`,
      tag: `nora-${a.rutina_id}-${a.fecha}`, url: "./#nora",
    });
    // se apunta como enviado aunque no tenga móvil: el aviso solo vale en ese momento
    for (const s of (subs ?? []).filter((x: { user_id: string }) => x.user_id === a.user_id)) {
      try { await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, carga, { TTL: 300, urgency: "high" }); enviados++; }
      catch (err) { if ([404, 410].includes((err as { statusCode?: number }).statusCode ?? 0)) await sb.from("push_suscripciones").delete().eq("endpoint", s.endpoint); }
    }
    await sb.from("avisos_nora").upsert({ rutina_id: a.rutina_id, fecha: a.fecha, user_id: a.user_id }, { ignoreDuplicates: true });
  }
  return Response.json({ avisos: avisos.length, enviados });
}
