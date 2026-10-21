// Envía por correo los avisos de las tareas del tablero que vencen dentro de 3 días o de 1 día.
// La llama cada mañana pg_cron (supabase/avisos-cron.sql). Los correos salen por Brevo (plan gratuito, 300 al día).
// Secretos: BREVO_API_KEY y AVISOS_REMITENTE (el correo confirmado como remitente en Brevo).
import { createClient } from "jsr:@supabase/supabase-js@2";

const APP = "https://davidpereiralopez.github.io/gastos-casa/";
const esc = (s: string) => String(s ?? "").replace(/[&<>"]/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[m]!));
const fecha = (d: string) => new Date(d + "T12:00:00Z").toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });

type Aviso = { tarea_id: string; fecha_limite: string; dias: number; titulo: string; nota: string | null; quien: string | null; nombre: string; email: string };

Deno.serve(async () => {
  const clave = Deno.env.get("BREVO_API_KEY"), remitente = Deno.env.get("AVISOS_REMITENTE");
  if (!clave || !remitente) return Response.json({ error: "Faltan los secretos BREVO_API_KEY o AVISOS_REMITENTE" }, { status: 500 });
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data, error } = await sb.rpc("avisos_pendientes");
  if (error) return Response.json({ error: error.message }, { status: 500 });

  const enviados: string[] = [], fallos: string[] = [];
  for (const a of (data ?? []) as Aviso[]) {
    const cuando = a.dias === 1 ? "mañana" : `en ${a.dias} días`;
    const asunto = a.dias === 1 ? `Mañana vence: ${a.titulo}` : `Quedan ${a.dias} días: ${a.titulo}`;
    const html = `<div style="font-family:system-ui,sans-serif;font-size:15px;color:#17201b">
      <p>Hola, ${esc(a.nombre)}:</p>
      <p>La tarea <b>${esc(a.titulo)}</b> vence ${cuando}, el ${esc(fecha(a.fecha_limite))}.</p>
      ${a.quien ? `<p>Es para: ${esc(a.quien)}</p>` : ""}${a.nota ? `<p>Nota: ${esc(a.nota)}</p>` : ""}
      <p><a href="${APP}" style="color:#1f7a55;font-weight:600">Abrir el tablero</a></p>
      <p style="color:#5d6a62;font-size:13px">Te llega este aviso desde Gastos de Casa.</p></div>`;
    const r = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "api-key": clave, "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({ sender: { email: remitente, name: "Gastos de Casa" }, to: [{ email: a.email, name: a.nombre }], subject: asunto, htmlContent: html }),
    });
    if (!r.ok) { fallos.push(`${a.email}: ${r.status} ${await r.text()}`); continue; }
    // apuntado como enviado: si mañana se vuelve a llamar, no se repite
    await sb.from("avisos_tareas").upsert({ tarea_id: a.tarea_id, fecha_limite: a.fecha_limite, dias: a.dias, email: a.email }, { ignoreDuplicates: true });
    enviados.push(`${a.email}: ${a.titulo}`);
  }
  return Response.json({ enviados, fallos }, { status: fallos.length ? 207 : 200 });
});
