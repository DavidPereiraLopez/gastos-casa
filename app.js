// Gastos de Casa: interfaz. Los datos van por window.store (Supabase o demo, ver store.js).
(function () {
const store = window.store;
const $ = id => document.getElementById(id);
const esc = s => String(s ?? "").replace(/[&<>"]/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[m]));
const fmt = n => Number(n).toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
const fmt0 = n => Number(n).toLocaleString("es-ES", { maximumFractionDigits: 0 }) + " €";
const iso = d => { const z = new Date(d.getTime() - d.getTimezoneOffset() * 6e4); return z.toISOString().slice(0, 10) };
const ym = d => iso(d).slice(0, 7);
const today = new Date();
const PAGOS = ["Tarjeta", "Efectivo", "Bizum", "Transferencia", "Domiciliación"];
const RULES = [[/mercadona|carrefour|lidl|dia |aldi|eroski|alcampo|consum|ahorramas/i, "CASA", "Supermercado"],
 [/endesa|iberdrola|naturgy|repsol luz|holaluz|gas natural/i, "CASA", "Luz y gas"],
 [/canal de isabel|aguas/i, "CASA", "Agua"],
 [/movistar|vodafone|orange|digi|jazztel|masmovil/i, "CASA", "Internet y móvil"],
 [/alquiler|hipoteca/i, "CASA", "Alquiler o hipoteca"],
 [/colegio|ampa|comedor escolar|uniforme/i, "NIÑAS", "Colegio"],
 [/academia|danza|natacion|ballet|extraescolar/i, "NIÑAS", "Extraescolares"],
 [/gasolin|repsol|cepsa|bp |galp|shell/i, "TRANSPORTE", "Gasolina"],
 [/renfe|metro|emt|cabify|uber|bus /i, "TRANSPORTE", "Transporte público"],
 [/parking|peaje|itv|taller/i, "TRANSPORTE", "Coche"],
 [/restaur|bar |cafeter|telepizza|glovo|just eat|burger|mcdonald/i, "OCIO", "Comer fuera"],
 [/netflix|spotify|hbo|disney|amazon prime/i, "OCIO", "Suscripciones"],
 [/farmacia/i, "SALUD", "Farmacia"],
 [/clinica|dentist|sanitas|adeslas|optica/i, "SALUD", "Médico"]];

let yo = null, hogar = null, miembros = [], data = [], tickets = [], fijos = [], eventos = [], tareas = [];
let mesVista = ym(today), vista = "mes";
const sel = { g: "", c: "", q: "", p: "Tarjeta", cu: "" };

function mostrar(v) { ["v-login", "v-hogar", "v-app"].forEach(x => $(x).hidden = x !== v); $("nav").hidden = v !== "v-app" }
function aviso(id, txt, error) { $(id).classList.toggle("e", !!error); $(id).textContent = txt }
const errTxt = e => {
  const m = (e && e.message) || String(e);
  if (/Invalid login/i.test(m)) return "Correo o contraseña incorrectos.";
  if (/Email not confirmed/i.test(m)) return "Confirma primero tu correo con el enlace que te hemos enviado.";
  if (/already registered/i.test(m)) return "Ese correo ya tiene cuenta. Entra con tu contraseña.";
  if (/Failed to fetch|NetworkError/i.test(m)) return "Sin conexión. Revisa internet y vuelve a intentarlo.";
  return m;
};
const corto = r => ({ id: r.id, f: r.fecha, i: Number(r.importe), g: r.grupo, c: r.categoria, n: r.nota, q: r.quien, p: r.forma_pago, cu: r.cuenta, rid: r.recurrente_id });
const colorG = g => { const i = hogar.grupos.findIndex(x => x.g === g); return `var(--c${(i < 0 ? 7 : i % 8) + 1})` };
const sigla = c => { const p = String(c).replace(/[^\p{L}\p{N} ]/gu, "").split(/\s+/).filter(w => w.length > 2 || /^\p{Lu}/u.test(w)); return ((p[0] || c)[0] + (p[1] ? p[1][0] : (p[0] || c)[1] || "")).toUpperCase() };
const ico = (g, c) => c ? `<span class="ico" style="background:${colorG(g)}" aria-hidden="true">${esc(sigla(c))}</span>` : '<span class="ico sin" aria-hidden="true">?</span>';
// gastos guardados sin categoría: grupo y categoría vacíos
const SIN = "Sin categoría", nomG = g => g || SIN;
// personas del hogar: los que tienen cuenta y los apuntados en Más > Familia que aún no se han unido
const personas = () => (hogar.personas || []).filter(p => p.nombre && !miembros.some(m => m.nombre === p.nombre));
const nombres = () => [...miembros.map(m => m.nombre), ...personas().map(p => p.nombre)];
const defDe = n => miembros.find(m => m.nombre === n) || {};
const nombreMes = k => { const [y, m] = k.split("-"); return new Date(+y, +m - 1, 1).toLocaleDateString("es-ES", { month: "long", year: "numeric" }) };
const addMes = (k, n) => { const [y, m] = k.split("-"); return ym(new Date(+y, +m - 1 + n, 1)) };
function parseImporte(s) { s = String(s).trim().replace(/[€\s]/g, ""); if (/,\d{1,2}$/.test(s)) s = s.replace(/\./g, "").replace(",", "."); else s = s.replace(/,/g, ""); return parseFloat(s) }
function categorizar(t) {
  for (const [r, g, c] of RULES) { const G = hogar.grupos.find(x => x.g === g); if (r.test(t) && G && G.cats.includes(c)) return { g, c } }
  const o = hogar.grupos.find(x => x.g === "OTROS") || hogar.grupos[hogar.grupos.length - 1]; return { g: o.g, c: o.cats[0] || "Otros" }
}
// Botón de borrar en dos toques (confirm() no funciona en todas las apps instaladas)
function dosToques(btn, accion) { if (btn.dataset.ok) return accion(); btn.dataset.ok = 1; const t = btn.textContent; btn.textContent = "¿Seguro? Toca otra vez"; setTimeout(() => { delete btn.dataset.ok; btn.textContent = t }, 4000) }

// ---------------- Acceso ----------------
let modoAlta = false;
$("l-modo").addEventListener("click", () => {
  modoAlta = !modoAlta;
  $("l-btn").textContent = modoAlta ? "Crear cuenta" : "Entrar";
  $("l-modo").textContent = modoAlta ? "Ya tengo cuenta" : "¿Primera vez? Crea tu cuenta";
  $("login-sub").textContent = modoAlta ? "Crea tu cuenta con tu correo y una contraseña." : "Entra con tu correo y contraseña.";
  $("l-pass").autocomplete = modoAlta ? "new-password" : "current-password";
});
$("f-login").addEventListener("submit", async e => {
  e.preventDefault(); aviso("l-err", "");
  const email = $("l-email").value.trim(), pass = $("l-pass").value;
  const r = modoAlta ? await store.signUp(email, pass) : await store.signIn(email, pass);
  if (r.error) return aviso("l-err", errTxt(r.error), true);
  if (modoAlta && !(r.data && r.data.session)) aviso("l-err", "Te hemos enviado un correo. Abre el enlace para confirmar tu cuenta y luego entra.");
});
$("f-hogar").addEventListener("submit", async e => {
  e.preventDefault(); aviso("h-err", "");
  const nombre = $("h-nombre").value.trim(), codigo = $("h-codigo").value.trim();
  try { codigo ? await store.unirse(codigo, nombre) : await store.crearHogar(nombre) } catch (err) { return aviso("h-err", errTxt(err), true) }
  arrancar();
});
$("salir").addEventListener("click", e => dosToques(e.target, () => store.signOut()));

let arrancando = false;
async function arrancar() {
  if (arrancando) return; arrancando = true;
  try {
    const s = await store.session();
    if (!s) { store.dejarDeEscuchar(); return mostrar("v-login") }
    yo = await store.miMiembro(s.user.id);
    if (!yo) return mostrar("v-hogar");
    await cargar();
    sel.q = yo.nombre; sel.p = yo.pago_def || "Tarjeta"; sel.cu = yo.cuenta_def || hogar.cuentas[0] || ""; sel.g = hogar.grupos[0].g;
    $("demo").hidden = !store.demo;
    mostrar("v-app"); pintar();
    await apuntarFijos();
    store.escuchar(hogar.id, async () => { await cargar(); pintar() });
  } catch (err) { mostrar("v-login"); aviso("l-err", errTxt(err), true) }
  finally { arrancando = false }
}
async function cargar() {
  const d = await store.cargar();
  hogar = d.hogar; hogar.presupuestos = hogar.presupuestos || {}; hogar.personas = hogar.personas || []; miembros = d.miembros; data = d.gastos.map(corto); tickets = d.tickets; fijos = d.recurrentes || []; eventos = d.eventos || []; tareas = d.tareas || [];
}
// Gastos fijos: al abrir la app se apuntan los que ya tocaban este mes y faltan
async function apuntarFijos() {
  const per = ym(today), filas = [];
  fijos.filter(r => r.activo !== false).forEach(r => {
    const dia = Math.min(r.dia, new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate());
    if (dia > today.getDate() || data.some(x => x.rid === r.id && x.f.startsWith(per))) return;
    filas.push({ fecha: `${per}-${String(dia).padStart(2, "0")}`, importe: r.importe, grupo: r.grupo, categoria: r.categoria, nota: r.nombre, quien: r.quien, forma_pago: r.forma_pago, cuenta: r.cuenta, recurrente_id: r.id, periodo: per });
  });
  if (!filas.length) return;
  try { const out = await store.addGastosFijos(filas); data.push(...out.map(corto)); pintar() } catch (e) { }
}

// ---------------- Navegación ----------------
let tab = "inicio";
document.querySelectorAll(".tab").forEach(b => b.addEventListener("click", () => irA(b.dataset.t)));
function irA(t) {
  tab = t; ["inicio", "movs", "cal", "tab", "pres", "mas"].forEach(x => $("t-" + x).hidden = x !== t);
  $("top-mes").hidden = t === "cal" || t === "tab"; // el calendario tiene su propio mes y deja ir al futuro; el tablero no va por meses
  $("fab").setAttribute("aria-label", t === "cal" ? "Añadir al calendario" : t === "tab" ? "Nueva tarea" : "Apuntar un gasto");
  document.querySelectorAll(".tab").forEach(b => b.dataset.t === t ? b.setAttribute("aria-current", "page") : b.removeAttribute("aria-current"));
  scrollTo(0, 0);
}
$("mes-ant").addEventListener("click", () => { mesVista = addMes(mesVista, -1); pintar() });
$("mes-sig").addEventListener("click", () => { if (mesVista < ym(today)) { mesVista = addMes(mesVista, 1); pintar() } });

function pintar() {
  $("hola").textContent = "Hola, " + yo.nombre;
  $("mes-t").textContent = nombreMes(mesVista);
  $("mes-sig").disabled = mesVista >= ym(today);
  pintarInicio(); pintarMovs(); pintarCal(); pintarTab(); pintarPres(); pintarMas();
}

// ---------------- Inicio ----------------
const delMes = k => data.filter(x => x.f.startsWith(k));
const sinCategoria = () => data.filter(x => !x.c).sort((a, b) => b.f.localeCompare(a.f));
function pintarInicio() {
  const mes = delMes(mesVista), total = mes.reduce((a, x) => a + x.i, 0);
  const pres = Object.values(hogar.presupuestos).reduce((a, v) => a + (Number(v) || 0), 0);
  const esActual = mesVista === ym(today);
  const [vy, vm] = mesVista.split("-").map(Number);
  $("s-lbl").textContent = esActual ? "Gastado este mes" : "Gastado en " + nombreMes(mesVista);
  $("s-total").textContent = fmt(total);
  $("s-prog").style.width = pres ? Math.min(100, total / pres * 100) + "%" : "0";
  const quedan = new Date(vy, vm, 0).getDate() - today.getDate();
  $("s-meta").textContent = !pres ? "Pon un presupuesto en la pestaña Presupuesto para ver cuánto te queda."
    : total <= pres ? `Te quedan ${fmt(pres - total)} de ${fmt0(pres)}${esActual ? ` para ${quedan} día${quedan === 1 ? "" : "s"}` : ""}.`
    : `Te has pasado ${fmt(total - pres)} del presupuesto de ${fmt0(pres)}.`;

  // Avisos
  const al = [];
  if (esActual) eventosDel(iso(today)).forEach(e => al.push(["info", "◷", `Hoy${e.hora_ini ? " a las " + hm(e.hora_ini) : ""}: <b>${esc(e.titulo)}</b>${e.quien ? " (" + esc(e.quien) + ")" : ""}.`]));
  // tareas tuyas vencidas, de hoy, o a las que quedan 1 o 3 días
  if (esActual) tareas.filter(t => t.columna !== "hecho" && t.fecha_limite && esMia(t) && (t.fecha_limite <= iso(today) || [1, 3].includes(diasEntre(iso(today), t.fecha_limite)))).forEach(t => {
    const n = diasEntre(iso(today), t.fecha_limite);
    al.push([n < 0 ? "warn" : "info", "▦", `Tablero: <b>${esc(t.titulo)}</b> ${n < 0 ? "era para el " + fechaCorta(t.fecha_limite) : n === 0 ? "es para hoy" : n === 1 ? "es para mañana" : "vence en 3 días"}${t.quien ? " (" + esc(t.quien) + ")" : ""}.`]);
  });
  const porG = {}; mes.forEach(x => porG[x.g] = (porG[x.g] || 0) + x.i);
  Object.entries(hogar.presupuestos).forEach(([g, p]) => {
    p = Number(p); if (!p) return; const v = porG[g] || 0;
    if (v > p) al.push(["bad", "!", `<b>${esc(g)}</b>: te has pasado ${fmt(v - p)} del presupuesto.`]);
    else if (v >= p * .9) al.push(["warn", "!", `<b>${esc(g)}</b>: llevas el ${Math.round(v / p * 100)} % del presupuesto.`]);
  });
  // gasto inusual: este mes ya supera en un 30 % la media de los 3 meses anteriores (comparando a la misma fecha)
  if (esActual) {
    const dia = today.getDate();
    Object.keys(porG).filter(g => g).forEach(g => {
      let suma = 0; for (let k = 1; k <= 3; k++) { const m = addMes(mesVista, -k); suma += data.filter(x => x.g === g && x.f.startsWith(m) && +x.f.slice(8) <= dia).reduce((a, x) => a + x.i, 0) }
      const media = suma / 3; if (media > 20 && porG[g] > media * 1.3) al.push(["warn", "↑", `<b>${esc(g)}</b> va un ${Math.round((porG[g] / media - 1) * 100)} % por encima de lo normal a estas alturas del mes.`]);
    });
    // próximos gastos fijos (7 días)
    fijos.filter(r => r.activo !== false && r.dia > dia && r.dia <= dia + 7).forEach(r => al.push(["info", "→", `El día ${r.dia} se apunta <b>${esc(r.nombre)}</b> (${fmt(r.importe)}).`]));
  }
  // posibles duplicados: mismo importe y nota el mismo día
  const vistos = {}; mes.forEach(x => { const k = x.f + "|" + x.i + "|" + (x.n || "").toLowerCase(); if (vistos[k] && x.n) al.push(["warn", "=", `Posible cargo repetido: <b>${esc(x.n)}</b> ${fmt(x.i)} el ${+x.f.slice(8)}.`]); vistos[k] = 1 });
  tickets.forEach(t => { const d = Math.ceil((finGarantia(t) - today) / 864e5); if (d >= 0 && d <= 90) al.push(["warn", "⌛", `La garantía de <b>${esc(t.producto)}</b> caduca en ${d} días.`]) });
  const nSin = sinCategoria().length;
  if (nSin) al.unshift(["info", "?", `${nSin === 1 ? "Hay <b>1 gasto sin categoría</b>" : `Hay <b>${nSin} gastos sin categoría</b>`}. <button class="link" type="button" data-accion="categorizar">Ponle categoría</button>`]);
  $("c-alertas").hidden = !al.length;
  $("alertas").innerHTML = al.map(([c, i, t]) => `<div class="al ${c}"><span class="ic" aria-hidden="true">${i}</span><span>${t}</span></div>`).join("");

  // Dona por grupo
  const orden = Object.entries(porG).sort((a, b) => b[1] - a[1]);
  const R = 52, C = 2 * Math.PI * R, gap = orden.length > 1 ? 2.5 : 0; let off = 0;
  const arcos = orden.map(([g, v]) => { const len = v / (total || 1) * C; const s = `<circle r="${R}" cx="70" cy="70" fill="none" stroke="${colorG(g)}" stroke-width="18" stroke-dasharray="${Math.max(0, len - gap)} ${C}" stroke-dashoffset="${-off}" transform="rotate(-90 70 70)"><title>${esc(nomG(g))}: ${fmt(v)}</title></circle>`; off += len; return s }).join("");
  $("dona").innerHTML = `<svg viewBox="0 0 140 140" role="img" aria-label="Gasto por grupo">${total ? arcos : `<circle r="${R}" cx="70" cy="70" fill="none" stroke="var(--line)" stroke-width="18"/>`}<text x="70" y="70" text-anchor="middle" class="ctr">${fmt0(total)}</text><text x="70" y="86" text-anchor="middle" class="ctr2">${orden.length} grupos</text></svg>`;
  $("leyenda").innerHTML = orden.map(([g, v]) => `<button class="lg" data-g="${esc(g)}"><span class="dot" style="background:${colorG(g)}"></span><span class="nm">${esc(nomG(g))} <small>${Math.round(v / total * 100)} %</small></span><span class="v">${fmt(v)}</span></button>`).join("") || '<p class="hint">Sin gastos este mes.</p>';

  // Comparativas a la misma fecha
  const corte = esActual ? today : new Date(vy, vm, 0);
  const menos1 = d => { const x = new Date(d); x.setFullYear(x.getFullYear() - 1); return x };
  const suma = (a, b) => { a = iso(a); b = iso(b); return data.filter(x => x.f >= a && x.f <= b).reduce((s, x) => s + x.i, 0) };
  const iniMes = new Date(vy, vm - 1, 1), iniAno = new Date(vy, 0, 1);
  const diaAnt = Math.min(corte.getDate(), new Date(vy, vm - 1, 0).getDate());
  const filas = [
    [`Mes anterior, hasta el día ${diaAnt}`, suma(iniMes, corte), suma(new Date(vy, vm - 2, 1), new Date(vy, vm - 2, diaAnt))],
    [esActual ? `Mismo mes de ${vy - 1}, hasta el día ${today.getDate()}` : `Mismo mes de ${vy - 1}`, suma(iniMes, corte), suma(menos1(iniMes), menos1(corte))],
    [`Año, hasta el ${corte.toLocaleDateString("es-ES", { day: "numeric", month: "short" })}`, suma(iniAno, corte), suma(menos1(iniAno), menos1(corte))]];
  $("comp").innerHTML = `<div class="cr hd"><span></span><span>Ahora</span><span>Antes</span><span>Diferencia</span></div>` + filas.map(([l, a, b]) => {
    const d = a - b, pc = b ? d / b * 100 : null, cls = d > 0 ? "sube" : d < 0 ? "baja" : "";
    return `<div class="cr"><span>${l}</span><span>${fmt(a)}</span><span>${fmt(b)}</span><span class="dif ${cls}">${d > 0 ? "+" : ""}${fmt(d)}${pc !== null ? ` <small>(${d > 0 ? "+" : ""}${pc.toLocaleString("es-ES", { maximumFractionDigits: 1 })} %)</small>` : ""}</span></div>`
  }).join("");
  dibujar(corte);

  // Histórico 12 meses
  const meses = []; for (let k = 11; k >= 0; k--) meses.push(addMes(ym(today), -k));
  const tots = meses.map(k => delMes(k).reduce((a, x) => a + x.i, 0)), maxM = Math.max(1, ...tots);
  $("hist").innerHTML = meses.map((k, j) => {
    const [y, m] = k.split("-"); const l = new Date(+y, +m - 1, 1).toLocaleDateString("es-ES", { month: "short" }).replace(".", "");
    return `<button class="hb${k === mesVista ? " on" : ""}" data-m="${k}" aria-label="${nombreMes(k)}: ${fmt(tots[j])}" title="${nombreMes(k)}: ${fmt(tots[j])}"><span class="hcol"><span class="hfill" style="height:${tots[j] / maxM * 100}%"></span></span><span>${l}</span></button>`
  }).join("");
  // Por persona
  const porQ = {}; mes.forEach(x => { const k = x.q || "Sin asignar"; porQ[k] = (porQ[k] || 0) + x.i });
  const maxQ = Math.max(1, ...Object.values(porQ));
  $("bars-q").innerHTML = Object.entries(porQ).sort((a, b) => b[1] - a[1]).map(([q, v]) => `<div class="bar"><span>${esc(q)}</span><div class="track"><div class="fill" style="width:${v / maxQ * 100}%"></div></div><span class="v">${fmt(v)}</span></div>`).join("") || '<p class="hint">Sin gastos este mes.</p>';
}
$("hist").addEventListener("click", e => { const b = e.target.closest(".hb"); if (b) { mesVista = b.dataset.m; pintar() } });
$("leyenda").addEventListener("click", e => { const b = e.target.closest(".lg"); if (b) { pintarMovs(); $("f-grupo").value = b.dataset.g || "__sin"; pintarMovs(); irA("movs") } });
$("alertas").addEventListener("click", e => { if (e.target.closest('[data-accion="categorizar"]')) categorizarPendientes() });
$("v-mes").addEventListener("click", () => { vista = "mes"; $("v-mes").setAttribute("aria-pressed", "true"); $("v-ano").setAttribute("aria-pressed", "false"); pintarInicio() });
$("v-ano").addEventListener("click", () => { vista = "ano"; $("v-ano").setAttribute("aria-pressed", "true"); $("v-mes").setAttribute("aria-pressed", "false"); pintarInicio() });

// Gráfico de gasto acumulado: mes visto vs mes anterior vs mismo mes del año pasado (o año vs año)
function acumulado(y, m, hasta) { const n = new Date(y, m + 1, 0).getDate(), pre = ym(new Date(y, m, 1)), pd = new Array(n).fill(0); data.forEach(x => { if (x.f.startsWith(pre)) pd[+x.f.slice(8, 10) - 1] += x.i }); let a = 0; return pd.slice(0, hasta ?? n).map(v => a += v) }
function acumAno(y, hasta) { const pm = new Array(12).fill(0); data.forEach(x => { if (x.f.startsWith(y + "-")) pm[+x.f.slice(5, 7) - 1] += x.i }); let a = 0; return pm.slice(0, hasta ?? 12).map(v => a += v) }
function dibujar(corte) {
  const y = corte.getFullYear(), m = corte.getMonth();
  const mt = (yy, mm) => new Date(yy, mm, 1).toLocaleDateString("es-ES", { month: "long", year: "numeric" });
  let series, n, xl;
  if (vista === "mes") {
    const pm = new Date(y, m - 1, 1);
    series = [{ k: "s1", l: mt(y, m), v: acumulado(y, m, corte.getDate()), w: 2.5 }, { k: "s2", l: mt(pm.getFullYear(), pm.getMonth()), v: acumulado(pm.getFullYear(), pm.getMonth()), w: 2 }, { k: "s3", l: mt(y - 1, m), v: acumulado(y - 1, m), w: 2, dash: "5 4" }];
    n = 31; xl = i => `Día ${i + 1}`;
  } else {
    series = [{ k: "s1", l: String(y), v: acumAno(y, m + 1), w: 2.5 }, { k: "s3", l: String(y - 1), v: acumAno(y - 1), w: 2, dash: "5 4" }];
    n = 12; xl = i => { const s = new Date(2000, i, 1).toLocaleDateString("es-ES", { month: "long" }); return s[0].toUpperCase() + s.slice(1) };
  }
  const W = 520, H = 200, L = 8, R = 8, T = 12, B = 22;
  const max = Math.max(1, ...series.flatMap(s => s.v));
  const step = Math.pow(10, Math.floor(Math.log10(max))), nice = [1, 2, 2.5, 5, 10].map(k => k * step).find(k => max / k <= 4) || step * 10, top = Math.ceil(max / nice) * nice;
  const X = i => L + i * (W - L - R) / (n - 1), Y = v => T + (H - T - B) * (1 - v / top);
  let g = "";
  for (let t = 0; t <= top + 1e-9; t += nice) g += `<line x1="${L}" x2="${W - R}" y1="${Y(t)}" y2="${Y(t)}" class="grid"/><text x="${W - R}" y="${Y(t) - 3}" class="ax" text-anchor="end">${t.toLocaleString("es-ES")} €</text>`;
  (vista === "mes" ? [0, 9, 19, 29] : [0, 3, 6, 9]).forEach(i => { g += `<text x="${X(i)}" y="${H - 6}" class="ax" text-anchor="${i === 0 ? "start" : "middle"}">${vista === "mes" ? i + 1 : new Date(2000, i, 1).toLocaleDateString("es-ES", { month: "short" }).replace(".", "")}</text>` });
  series.forEach(s => { if (!s.v.length) return; g += `<path d="${s.v.map((v, i) => (i ? "L" : "M") + X(i).toFixed(1) + " " + Y(v).toFixed(1)).join(" ")}" class="ln ${s.k}" stroke-width="${s.w}" ${s.dash ? `stroke-dasharray="${s.dash}"` : ""}/>`; const li = s.v.length - 1; g += `<circle cx="${X(li)}" cy="${Y(s.v[li])}" r="4" class="pt ${s.k}"/>` });
  g += `<line class="xh" y1="${T}" y2="${H - B}" x1="0" x2="0" visibility="hidden"/>`;
  $("chart").innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Gasto acumulado: ${series.map(s => `${s.l} ${fmt(s.v[s.v.length - 1] || 0)}`).join(", ")}">${g}</svg><div class="tip" hidden></div>`;
  const linea = s => `<svg width="22" height="8"><line x1="1" x2="21" y1="4" y2="4" class="ln ${s.k}" stroke-width="2.5" ${s.dash ? 'stroke-dasharray="5 3"' : ""}/></svg>`;
  $("leg").innerHTML = series.map(s => `<span class="li">${linea(s)}${esc(s.l)} <b>${fmt(s.v[s.v.length - 1] || 0)}</b></span>`).join("");
  const svg = $("chart").querySelector("svg"), tip = $("chart").querySelector(".tip"), xh = svg.querySelector(".xh");
  const move = e => {
    const r = svg.getBoundingClientRect(), px = (e.clientX - r.left) / r.width * W, i = Math.max(0, Math.min(n - 1, Math.round((px - L) / ((W - L - R) / (n - 1)))));
    xh.setAttribute("x1", X(i)); xh.setAttribute("x2", X(i)); xh.setAttribute("visibility", "visible");
    tip.innerHTML = `<b>${xl(i)}</b>` + series.map(s => `<div>${linea(s)} ${esc(s.l)}: ${i < s.v.length ? fmt(s.v[i]) : "—"}</div>`).join("");
    tip.hidden = false; tip.style.left = Math.min(Math.max(X(i) / W * r.width - 85, 0), r.width - 170) + "px"
  };
  svg.addEventListener("pointermove", move); svg.addEventListener("pointerdown", move);
  svg.addEventListener("pointerleave", () => { tip.hidden = true; xh.setAttribute("visibility", "hidden") });
}

// ---------------- Movimientos ----------------
function opciones(id, lista, todos, extra = "") { const v = $(id).value; $(id).innerHTML = `<option value="">${todos}</option>` + lista.map(x => `<option>${esc(x)}</option>`).join("") + extra; if (lista.includes(v) || (extra && v === "__sin")) $(id).value = v }
["f-q", "f-grupo", "f-quien", "f-cuenta", "f-pago"].forEach(id => $(id).addEventListener("input", pintarMovs));
function pintarMovs() {
  opciones("f-grupo", hogar.grupos.map(x => x.g), "Todos los grupos", `<option value="__sin">${SIN}</option>`); opciones("f-quien", nombres(), "Todos");
  opciones("f-cuenta", hogar.cuentas, "Todas las cuentas"); opciones("f-pago", PAGOS, "Cualquier forma de pago");
  const q = $("f-q").value.trim().toLowerCase(), fg = $("f-grupo").value, fq = $("f-quien").value, fc = $("f-cuenta").value, fp = $("f-pago").value;
  // «Sin categoría» enseña los de todos los meses, para no dejarse ninguno
  const sinC = fg === "__sin", lista = (sinC ? data : delMes(mesVista)).filter(x => (!fg || (sinC ? !x.c : x.g === fg)) && (!fq || x.q === fq) && (!fc || x.cu === fc) && (!fp || x.p === fp) &&
    (!q || [x.n, x.c, x.g, x.q, x.cu].some(v => String(v || "").toLowerCase().includes(q)))).sort((a, b) => b.f.localeCompare(a.f));
  const dias = {}; lista.forEach(x => (dias[x.f] ||= []).push(x));
  const tot = lista.reduce((a, x) => a + x.i, 0);
  $("movs").innerHTML = lista.length ? `<p class="hint">${lista.length} movimientos${sinC ? " sin categoría, de todos los meses" : ""} · ${fmt(tot)}</p>` +
    (sinC ? '<button class="btn primary sm" type="button" data-accion="categorizar">Ponerles categoría uno a uno</button>' : "") + Object.entries(dias).map(([f, xs]) => {
    const d = new Date(f + "T12:00").toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" });
    return `<div class="dia"><span>${d}</span><span>${fmt(xs.reduce((a, x) => a + x.i, 0))}</span></div><ul class="movs">` + xs.map(x =>
      `<li class="mv" data-id="${x.id}">${ico(x.g, x.c)}<span><span class="t">${esc(x.n || x.c || SIN)}</span><br><span class="s">${x.c ? `${esc(x.g)} › ${esc(x.c)}` : `<b class="sinc">${SIN}</b>`} · ${esc(x.q || "")}${x.cu ? " · " + esc(x.cu) : ""}${x.p ? " · " + esc(x.p) : ""}${x.rid ? " · fijo" : ""}</span></span><span class="a">−${fmt(x.i)}</span></li>`).join("") + "</ul>"
  }).join("") : `<div class="vacio">${sinC ? "Todos los gastos tienen categoría." : "No hay movimientos con estos filtros. Toca + para apuntar uno."}</div>`;
}
$("movs").addEventListener("click", async e => {
  if (e.target.closest('[data-accion="categorizar"]')) return categorizarPendientes();
  const ed = e.target.closest("[data-ed]"); if (ed) return abrirHoja(data.find(x => x.id === ed.dataset.ed));
  const del = e.target.closest("[data-del]");
  if (del) return dosToques(del, async () => { try { await store.delGasto(del.dataset.del); data = data.filter(x => x.id !== del.dataset.del); pintar() } catch (err) { del.textContent = errTxt(err) } });
  const li = e.target.closest(".mv"); if (!li) return;
  const abierto = li.querySelector(".acc"); document.querySelectorAll(".mv .acc").forEach(a => a.remove());
  const x = data.find(g => g.id === li.dataset.id);
  if (!abierto) li.insertAdjacentHTML("beforeend", `<span class="acc"><button class="btn sm${x.c ? "" : " primary"}" data-ed="${x.id}">${x.c ? "Cambiar" : "Ponle categoría"}</button><button class="btn sm danger" data-del="${x.id}">Borrar</button></span>`);
});

// ---------------- Presupuestos y gastos fijos ----------------
function estadoPres(v, p) { if (!p) return ["", "Sin presupuesto"]; const r = v / p; return r > 1 ? ["bad", `Te has pasado ${fmt(v - p)}`] : r >= .9 ? ["warn", `Queda ${fmt(p - v)}`] : ["ok", `Queda ${fmt(p - v)}`] }
function pintarPres() {
  const porG = {}; delMes(mesVista).forEach(x => porG[x.g] = (porG[x.g] || 0) + x.i);
  const totP = Object.values(hogar.presupuestos).reduce((a, v) => a + (Number(v) || 0), 0), totG = Object.values(porG).reduce((a, v) => a + v, 0);
  $("p-tot").textContent = `${fmt0(totG)} de ${fmt0(totP)}`;
  $("pres").innerHTML = hogar.grupos.map(G => {
    const v = porG[G.g] || 0, p = Number(hogar.presupuestos[G.g]) || 0, [cls, txt] = estadoPres(v, p);
    return `<div class="pr">${ico(G.g, G.g)}<span class="row1"><span>${esc(G.g)}</span><input inputmode="decimal" data-g="${esc(G.g)}" value="${p || ""}" placeholder="Sin límite" aria-label="Presupuesto de ${esc(G.g)} en euros"></span>
      <div class="track"><div class="fill ${cls}" style="width:${p ? Math.min(100, v / p * 100) : 0}%"></div></div>
      <span class="row3"><span>${fmt(v)} gastado</span><span class="st ${cls}">${txt}</span></span></div>`
  }).join("");
  $("fijos").innerHTML = fijos.map(r => `<li>${ico(r.grupo, r.categoria)}<span><b>${esc(r.nombre)}</b><br><span class="hint">Día ${r.dia} · ${esc(r.grupo)} › ${esc(r.categoria)} · ${esc(r.quien || "")}${r.cuenta ? " · " + esc(r.cuenta) : ""}</span></span><span class="r"><span class="v">${fmt(r.importe)}</span><button class="del" data-r="${r.id}">Quitar</button></span></li>`).join("") || '<li class="hint">Aún no hay gastos fijos.</li>';
  const opt = (l, v) => l.map(x => `<option${x === v ? " selected" : ""}>${esc(x)}</option>`).join("");
  const gSel = $("r-grupo").value || hogar.grupos[0].g;
  $("r-grupo").innerHTML = opt(hogar.grupos.map(x => x.g), gSel);
  $("r-cat").innerHTML = opt((hogar.grupos.find(x => x.g === gSel) || hogar.grupos[0]).cats);
  $("r-quien").innerHTML = opt(nombres(), $("r-quien").value || yo.nombre); $("r-cuenta").innerHTML = opt(hogar.cuentas, $("r-cuenta").value || yo.cuenta_def);
}
$("r-grupo").addEventListener("change", () => { const G = hogar.grupos.find(x => x.g === $("r-grupo").value); $("r-cat").innerHTML = G.cats.map(c => `<option>${esc(c)}</option>`).join("") });
$("p-ok").addEventListener("click", async () => {
  const p = {}; document.querySelectorAll("#pres input").forEach(i => { const v = parseImporte(i.value); if (v > 0) p[i.dataset.g] = Math.round(v * 100) / 100 });
  try { await store.updHogar(hogar.id, { presupuestos: p }); hogar.presupuestos = p; pintar(); aviso("p-msg", "Presupuestos guardados para los dos.") } catch (e) { aviso("p-msg", errTxt(e), true) }
});
$("fform").addEventListener("submit", async e => {
  e.preventDefault();
  const imp = parseImporte($("r-imp").value); if (!(imp > 0)) return aviso("r-msg", "Pon un importe mayor que 0.", true);
  const q = $("r-quien").value;
  try {
    const r = await store.addRecurrente({ nombre: $("r-nom").value.trim(), importe: imp, dia: +$("r-dia").value, grupo: $("r-grupo").value, categoria: $("r-cat").value, quien: q, cuenta: $("r-cuenta").value || null, forma_pago: "Domiciliación" });
    fijos.push(r); e.target.reset(); aviso("r-msg", `Guardado. Se apuntará solo el día ${r.dia} de cada mes.`); await apuntarFijos(); pintar();
  } catch (err) { aviso("r-msg", errTxt(err), true) }
});
$("fijos").addEventListener("click", e => { const b = e.target.closest("[data-r]"); if (b) dosToques(b, async () => { try { await store.delRecurrente(b.dataset.r); fijos = fijos.filter(r => r.id !== b.dataset.r); pintar() } catch (err) { aviso("r-msg", errTxt(err), true) } }) });

// ---------------- Más: tickets, importar, ajustes ----------------
function finGarantia(t) { const d = new Date(t.fecha_compra + "T12:00"); d.setMonth(d.getMonth() + Math.round(Number(t.anos_garantia) * 12)); return d }
function pintarMas() {
  const lista = tickets.slice().sort((a, b) => finGarantia(a) - finGarantia(b));
  $("tickets").innerHTML = lista.map(t => {
    const dias = Math.ceil((finGarantia(t) - today) / 864e5), [cls, txt] = dias < 0 ? ["fin", "Caducada"] : dias <= 90 ? ["warn", `Caduca en ${dias} días`] : ["ok", "En garantía"];
    return `<li class="tk"><button class="th" data-v="${t.id}" aria-label="Ver ticket de ${esc(t.producto)}" ${t.archivo ? "" : "disabled"}>${t.archivo ? (/\.pdf$/i.test(t.archivo) ? "PDF" : "Foto") : "Sin foto"}</button>
      <span><b>${esc(t.producto)}</b><br><span class="hint">${t.tienda ? esc(t.tienda) + " · " : ""}hasta ${finGarantia(t).toLocaleDateString("es-ES")}${t.importe ? " · " + fmt(t.importe) : ""}</span></span>
      <span class="r"><span class="pill ${cls}">${txt}</span><button class="del" data-d="${t.id}">Borrar</button></span></li>`
  }).join("") || '<li class="hint">Aún no hay tickets guardados.</li>';
  const opt = (l, v) => l.map(x => `<option${x === v ? " selected" : ""}>${esc(x)}</option>`).join("");
  $("csv-cu").innerHTML = opt(hogar.cuentas, $("csv-cu").value || yo.cuenta_def); $("csv-q").innerHTML = opt(nombres(), $("csv-q").value || yo.nombre);
  if (document.activeElement !== $("aj-cat")) $("aj-cat").value = hogar.grupos.map(x => `${x.g}: ${x.cats.join(", ")}`).join("\n");
  if (document.activeElement !== $("aj-cu")) $("aj-cu").value = hogar.cuentas.join(", ");
  $("aj-def").innerHTML = miembros.map(m => `<div class="def"><span>${esc(m.nombre)}</span><select class="field" data-u="${m.user_id}" data-f="cuenta_def" aria-label="Cuenta de ${esc(m.nombre)}">${opt(hogar.cuentas, m.cuenta_def)}</select><select class="field" data-u="${m.user_id}" data-f="pago_def" aria-label="Forma de pago de ${esc(m.nombre)}">${opt(PAGOS, m.pago_def)}</select></div>`).join("");
  $("codigo").textContent = hogar.codigo_invitacion;
  $("personas").innerHTML = [...miembros.map(m => `<li><span><b>${esc(m.nombre)}</b><br><span class="hint">Tiene cuenta${m.user_id === yo.user_id ? " (tú)" : ""}</span></span></li>`),
    ...personas().map(p => `<li><span><b>${esc(p.nombre)}</b><br><span class="hint">${p.email ? esc(p.email) : "Sin correo"} · aún no se ha unido</span></span><button class="del" type="button" data-pe="${esc(p.nombre)}">Quitar</button></li>`)].join("");
}
$("t-fecha").value = iso(today);
$("tform").addEventListener("submit", async e => {
  e.preventDefault();
  const f = $("t-file").files[0];
  if (f && f.size > 10 * 1024 * 1024) return aviso("tmsg", "El archivo pasa de 10 MB. Prueba con una foto más pequeña.", true);
  const fila = { producto: $("t-prod").value.trim(), tienda: $("t-tienda").value.trim() || null, fecha_compra: $("t-fecha").value, anos_garantia: parseFloat($("t-anos").value) || 0, importe: parseImporte($("t-imp").value) || null, archivo: null };
  aviso("tmsg", f ? "Subiendo el ticket…" : "Guardando…");
  try { const t = await store.addTicket(fila, f, hogar.id); tickets.push(t); pintarMas(); aviso("tmsg", `Guardado: ${fila.producto}, en garantía hasta ${finGarantia(t).toLocaleDateString("es-ES")}.`); e.target.reset(); $("t-fecha").value = iso(today); $("t-anos").value = 3 }
  catch (err) { aviso("tmsg", "No se ha guardado: " + errTxt(err), true) }
});
$("tickets").addEventListener("click", async e => {
  const v = e.target.closest("[data-v]"), d = e.target.closest("[data-d]");
  if (d) return dosToques(d, async () => { const t = tickets.find(x => x.id === d.dataset.d); try { await store.delTicket(t); tickets = tickets.filter(x => x.id !== t.id); $("visor").hidden = true; pintar() } catch (err) { aviso("tmsg", errTxt(err), true) } });
  if (v) {
    const t = tickets.find(x => x.id === v.dataset.v);
    try {
      const u = await store.urlTicket(t);
      $("visor-t").textContent = t.producto;
      $("visor-c").innerHTML = /\.pdf$/i.test(t.archivo) ? `<a class="btn" href="${u}" target="_blank" rel="noopener">Abrir PDF</a>` : `<img src="${u}" alt="Ticket de ${esc(t.producto)}">`;
      $("visor").hidden = false;
    } catch (err) { aviso("tmsg", errTxt(err), true) }
  }
});
$("visor-x").addEventListener("click", () => { $("visor").hidden = true });
$("csv").addEventListener("change", async e => {
  const f = e.target.files[0]; if (!f) return;
  const lines = (await f.text()).split(/\r?\n/).filter(l => l.trim());
  const sep = (lines[0].match(/;/g) || []).length >= (lines[0].match(/,/g) || []).length ? ";" : ",";
  const filas = [];
  for (const l of lines) {
    const cols = l.split(sep).map(s => s.replace(/^"|"$/g, "").trim());
    const fi = cols.findIndex(c => /^\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}$|^\d{4}-\d{2}-\d{2}$/.test(c)); if (fi < 0) continue;
    // si hay columna de saldo al final, el importe suele ser la penúltima numérica
    const nums = cols.map((c, k) => k !== fi && /^-?[\d.,]+\s*€?$/.test(c) && /\d/.test(c) ? k : -1).filter(k => k >= 0); if (!nums.length) continue;
    const imp = parseImporte(cols[nums.length >= 2 ? nums[nums.length - 2] : nums[0]]); if (!(imp < 0)) continue; // solo cargos
    let fe = cols[fi]; if (!/^\d{4}/.test(fe)) { const [d, m, y] = fe.split(/[\/-]/); fe = `${y.length === 2 ? "20" + y : y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}` }
    const concepto = cols.filter((c, k) => k !== fi && !nums.includes(k)).sort((a, b) => b.length - a.length)[0] || "", gc = categorizar(concepto);
    filas.push({ fecha: fe, importe: Math.abs(imp), grupo: gc.g, categoria: gc.c, nota: concepto.slice(0, 80), quien: $("csv-q").value, cuenta: $("csv-cu").value || null,
      forma_pago: /bizum/i.test(concepto) ? "Bizum" : /transf/i.test(concepto) ? "Transferencia" : /recibo|adeudo|domicil/i.test(concepto) ? "Domiciliación" : "Tarjeta" });
  }
  e.target.value = "";
  if (!filas.length) return aviso("csvmsg", "No he encontrado cargos en ese archivo. Revisa que tenga columnas de fecha e importe.", true);
  try { const out = await store.addGastos(filas); data.push(...out.map(corto)); pintar(); aviso("csvmsg", `Importados ${filas.length} cargos en ${$("csv-cu").value}.`) }
  catch (err) { aviso("csvmsg", "No se ha importado: " + errTxt(err), true) }
});
const listaComas = v => [...new Set(v.split(",").map(s => s.trim()).filter(Boolean))];
function leerGrupos(t) { const out = []; t.split(/\n/).forEach(l => { l = l.trim(); if (!l) return; const i = l.indexOf(":"), g = (i < 0 ? l : l.slice(0, i)).trim(), cats = i < 0 ? [] : listaComas(l.slice(i + 1)); if (g && !out.some(x => x.g === g)) out.push({ g, cats: cats.length ? cats : ["General"] }) }); return out }
$("aj-ok").addEventListener("click", async () => {
  const grupos = leerGrupos($("aj-cat").value), cuentas = listaComas($("aj-cu").value);
  if (!grupos.length) return aviso("aj-msg", "Deja al menos un grupo.", true);
  try {
    await store.updHogar(hogar.id, { grupos, cuentas });
    const cambios = {}; document.querySelectorAll("#aj-def select").forEach(s => { (cambios[s.dataset.u] ||= {})[s.dataset.f] = s.value });
    for (const [u, c] of Object.entries(cambios)) { if (!cuentas.includes(c.cuenta_def)) c.cuenta_def = cuentas[0] || null; await store.updMiembro(u, c) }
    await cargar(); yo = miembros.find(m => m.user_id === yo.user_id) || yo; pintar(); aviso("aj-msg", "Cambios guardados para los dos. Los gastos ya apuntados conservan su grupo y categoría.");
  } catch (err) { aviso("aj-msg", errTxt(err), true) }
});

async function guardarPersonas(lista, msg) {
  try { await store.updHogar(hogar.id, { personas: lista }); hogar.personas = lista; pintar(); aviso("pe-msg", msg) } catch (err) { aviso("pe-msg", errTxt(err), true) }
}
$("pe-form").addEventListener("submit", e => {
  e.preventDefault();
  const nombre = $("pe-nom").value.trim(), email = $("pe-email").value.trim();
  if (!nombre) return aviso("pe-msg", "Escribe el nombre.", true);
  if (nombres().includes(nombre)) return aviso("pe-msg", `${nombre} ya está en el hogar.`, true);
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return aviso("pe-msg", "Ese correo no parece válido.", true);
  e.target.reset(); guardarPersonas([...hogar.personas, { nombre, email: email || null }], `${nombre} ya aparece en «Quién».`);
});
$("personas").addEventListener("click", e => { const b = e.target.closest("[data-pe]"); if (b) dosToques(b, () => guardarPersonas(hogar.personas.filter(p => p.nombre !== b.dataset.pe), "Quitada.")) });

// ---------------- Hoja "Nuevo gasto" ----------------
// El importe se escribe con un teclado propio que siempre está a la vista. Con «+» se suman varios importes (ej. dos tickets).
// Sin categoría se guarda igual (grupo y categoría vacíos) y se le pone luego desde el aviso de Inicio o desde Gastos.
let monto = "", editId = null, cola = [], colaN = 0, selNuevo = null;
$("teclado").innerHTML = ["1", "2", "3", "C", "4", "5", "6", "+", "7", "8", "9", ",", "0", "⌫"].map(k =>
  `<button type="button" class="tecla${/[0-9]/.test(k) ? "" : " op"}" data-k="${k}" aria-label="${{ "⌫": "Borrar", "C": "Borrar todo", "+": "Sumar otro importe", ",": "Coma decimal" }[k] || k}">${k}</button>`).join("") +
  '<button type="button" class="tecla ok" id="h-ok">Guardar</button>';
const totalMonto = () => Math.round(monto.split("+").reduce((a, t) => a + (parseImporte(t) || 0), 0) * 100) / 100;
const pintaMonto = () => {
  const partes = monto.split("+");
  $("h-monto").textContent = partes.length > 1 ? totalMonto().toLocaleString("es-ES", { minimumFractionDigits: totalMonto() % 1 ? 2 : 0, maximumFractionDigits: 2 }) : monto || "0";
  $("h-expr").textContent = partes.length > 1 ? partes.map(t => t || "0").join(" + ") + " =" : "";
};
$("teclado").addEventListener("click", e => {
  const k = e.target.closest(".tecla")?.dataset.k; if (!k) return;
  const ult = monto.split("+").pop();
  if (k === "⌫") monto = monto.slice(0, -1);
  else if (k === "C") monto = "";
  else if (k === "+") { if (ult && !monto.endsWith(",")) monto += "+" }
  else if (k === ",") { if (!ult.includes(",")) monto += (ult ? "" : "0") + "," }
  else if (!(ult.includes(",") && ult.split(",")[1].length >= 2) && ult.replace(",", "").length < 7) monto = ult === "0" ? monto.slice(0, -1) + k : monto + k;
  if (navigator.vibrate) navigator.vibrate(8);
  pintaMonto();
});
document.addEventListener("keydown", e => {
  if ($("velo").hidden || e.target.tagName === "INPUT") return;
  const k = e.key === "." ? "," : e.key === "Backspace" ? "⌫" : e.key === "Delete" ? "C" : e.key;
  if (/^[0-9,+]$/.test(k) || k === "⌫" || k === "C") { $("teclado").querySelector(`[data-k="${k}"]`).click(); e.preventDefault() }
  else if (e.key === "Enter") { $("h-ok").click(); e.preventDefault() }
  else if (e.key === "Escape") cerrarHoja();
});
function chips(id, lista, key) { $(id).innerHTML = lista.map(v => `<button type="button" class="chip" data-k="${key}" data-v="${esc(v)}" aria-pressed="${v === sel[key]}">${esc(v)}</button>`).join("") }
function pintarHoja() {
  if (!hogar.grupos.some(x => x.g === sel.g)) sel.g = hogar.grupos[0].g;
  chips("h-grupos", hogar.grupos.map(x => x.g), "g");
  const G = hogar.grupos.find(x => x.g === sel.g);
  if (!G.cats.includes(sel.c)) sel.c = "";
  $("h-cats").innerHTML = G.cats.map(c => `<button type="button" class="cat" data-c="${esc(c)}" aria-pressed="${c === sel.c}">${ico(G.g, c)}<span>${esc(c)}</span></button>`).join("");
  chips("h-q", nombres(), "q"); chips("h-cu", hogar.cuentas, "cu"); chips("h-p", PAGOS, "p");
  $("h-sincat").hidden = !!sel.c || !!editId;
  $("h-ok").innerHTML = sel.c ? "Guardar" : cola.length ? "Saltar" : "Guardar<small>sin categoría</small>";
}
$("velo").addEventListener("click", e => {
  if (e.target === $("velo")) return cerrarHoja();
  const c = e.target.closest(".chip");
  if (c && c.closest(".hoja")) { sel[c.dataset.k] = c.dataset.v; if (c.dataset.k === "q" && !editId) { const d = defDe(c.dataset.v); if (d.cuenta_def) sel.cu = d.cuenta_def; if (d.pago_def) sel.p = d.pago_def } pintarHoja(); return }
  const cat = e.target.closest(".cat"); if (cat) { sel.c = sel.c === cat.dataset.c ? "" : cat.dataset.c; pintarHoja() } // otro toque la quita
});
function abrirHoja(x) {
  editId = x ? x.id : null;
  if (x) { selNuevo ||= { ...sel }; Object.assign(sel, { g: x.g || sel.g, c: x.c || "", q: x.q || "", p: x.p || "", cu: x.cu || "" }) }
  monto = !x ? "" : (x.i % 1 ? x.i.toFixed(2) : String(x.i)).replace(".", ","); pintaMonto(); if (!x) sel.c = "";
  $("h-nota").value = x ? x.n || "" : ""; $("h-fecha").value = x ? x.f : iso(new Date());
  $("h-tit").textContent = !x ? "Nuevo gasto" : x.c ? "Cambiar gasto" : "Ponle categoría";
  $("h-cola").textContent = colaN > 1 ? `${colaN - cola.length} de ${colaN}` : "";
  aviso("h-msg", ""); pintarHoja(); $("velo").hidden = false; document.body.style.overflow = "hidden";
  $("velo").querySelector(".h-cuerpo").scrollTop = 0;
}
function cerrarHoja() { $("velo").hidden = true; document.body.style.overflow = ""; editId = null; cola = []; colaN = 0; if (selNuevo) { Object.assign(sel, selNuevo); selNuevo = null } }
// Repasar uno tras otro los gastos sin categoría, del más reciente al más antiguo
function categorizarPendientes() { cola = sinCategoria().map(x => x.id); colaN = cola.length; const id = cola.shift(); if (id) abrirHoja(data.find(x => x.id === id)) }
$("fab").addEventListener("click", () => tab === "cal" ? abrirEvento(null, calDia) : tab === "tab" ? abrirTarea(null) : abrirHoja());
$("h-x").addEventListener("click", cerrarHoja);
$("h-ok").addEventListener("click", async () => {
  const v = totalMonto();
  if (!(v > 0)) return aviso("h-msg", "Escribe el importe con el teclado.", true);
  $("h-ok").disabled = true;
  const fila = { fecha: $("h-fecha").value || iso(new Date()), importe: v, grupo: sel.c ? sel.g : "", categoria: sel.c, nota: $("h-nota").value.trim() || null, quien: sel.q, forma_pago: sel.p, cuenta: sel.cu || null };
  try {
    if (editId) {
      const r = corto(await store.updGasto(editId, fila)); data = data.map(x => x.id === r.id ? r : x);
      let sig; while (cola.length && !(sig = data.find(x => x.id === cola[0] && !x.c))) cola.shift(); // por si el otro ya la ha categorizado
      if (sig) { cola.shift(); pintar(); return abrirHoja(sig) }
      cerrarHoja(); pintar();
    } else {
      const [r] = await store.addGastos([fila]);
      data.push(corto(r)); mesVista = ym(new Date(r.fecha + "T12:00")); cerrarHoja(); pintar();
    }
  } catch (err) { aviso("h-msg", "No se ha guardado: " + errTxt(err), true) }
  finally { $("h-ok").disabled = false }
});

// ---------------- Calendario compartido ----------------
// Cada evento se guarda una vez; sus repeticiones se calculan aquí. Un día cambiado aparte es una copia con serie_id
// y ese día queda en las excepciones de la serie.
const fechaD = s => new Date(s + "T12:00");
const sumaDias = (s, n) => { const d = fechaD(s); d.setDate(d.getDate() + n); return iso(d) };
const diasEntre = (a, b) => Math.round((fechaD(b) - fechaD(a)) / 864e5);
const dow = s => (fechaD(s).getDay() + 6) % 7 + 1; // 1 = lunes ... 7 = domingo
const DSEM = ["L", "M", "X", "J", "V", "S", "D"], DSEM_L = ["lun", "mar", "mié", "jue", "vie", "sáb", "dom"];
const REPS = [["no", "No se repite"], ["diario", "Cada día"], ["semanal", "Cada semana"], ["mensual", "Cada mes"]];
const UNI = { diario: ["día", "días"], semanal: ["semana", "semanas"], mensual: ["mes", "meses"] };
const hm = t => t ? String(t).slice(0, 5) : "";
const fechaCorta = s => fechaD(s).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: s.slice(0, 4) == today.getFullYear() ? undefined : "numeric" }).replace(".", "");
const diasDe = e => e.dias_semana && e.dias_semana.length ? e.dias_semana.map(Number) : [dow(e.fecha)];
function ocurre(e, d) {
  if (d < e.fecha || (e.hasta && d > e.hasta) || (e.excepciones || []).includes(d)) return false;
  const n = e.cada || 1;
  if (e.repetir === "diario") return diasEntre(e.fecha, d) % n === 0;
  if (e.repetir === "semanal") { if (!diasDe(e).includes(dow(d))) return false; const lun = s => sumaDias(s, 1 - dow(s)); return Math.round(diasEntre(lun(e.fecha), lun(d)) / 7) % n === 0 }
  if (e.repetir === "mensual") {
    const [y0, m0, d0] = e.fecha.split("-").map(Number), [y, m, dd] = d.split("-").map(Number);
    return ((y - y0) * 12 + m - m0) % n === 0 && dd === Math.min(d0, new Date(y, m, 0).getDate()); // día 31 → último día de los meses cortos
  }
  return d === e.fecha;
}
const eventosDel = d => eventos.filter(e => ocurre(e, d)).sort((a, b) => hm(a.hora_ini).localeCompare(hm(b.hora_ini)) || a.titulo.localeCompare(b.titulo));
const todos = () => nombres().length > 2 ? "Todos" : "Los dos";
const quienes = () => [...nombres(), todos()];
const colorQ = q => { const i = nombres().indexOf(q); return i < 0 ? "var(--accent)" : `var(--c${i % 8 + 1})` };
function textoRep(e) {
  if (e.repetir === "no" || !UNI[e.repetir]) return "";
  const n = e.cada || 1, u = UNI[e.repetir];
  let t = n === 1 ? `Cada ${u[0]}` : `Cada ${n} ${u[1]}`;
  if (e.repetir === "semanal") t += ` (${diasDe(e).sort().map(i => DSEM_L[i - 1]).join(", ")})`;
  if (e.repetir === "mensual") t += `, el día ${+e.fecha.slice(8)}`;
  return t + (e.hasta ? ` hasta el ${fechaCorta(e.hasta)}` : ", sin fin");
}
const horario = e => e.hora_ini ? hm(e.hora_ini) + (e.hora_fin ? "–" + hm(e.hora_fin) : "") : "Todo el día";

let calMes = ym(today), calDia = iso(today);
$("cal-ant").addEventListener("click", () => { calMes = addMes(calMes, -1); pintarCal() });
$("cal-sig").addEventListener("click", () => { calMes = addMes(calMes, 1); pintarCal() });
$("cal-hoy").addEventListener("click", () => { calMes = ym(today); calDia = iso(today); pintarCal() });
$("cal-grid").addEventListener("click", e => { const b = e.target.closest(".cd"); if (!b) return; calDia = b.dataset.d; if (!calDia.startsWith(calMes)) calMes = calDia.slice(0, 7); pintarCal() });
$("cal-add").addEventListener("click", () => abrirEvento(null, calDia));
function pintarCal() {
  $("cal-t").textContent = nombreMes(calMes);
  const ini = calMes + "-01", desde = sumaDias(ini, 1 - dow(ini));
  const [y, m] = calMes.split("-").map(Number), fin = iso(new Date(y, m, 0)), hasta = sumaDias(fin, 7 - dow(fin)), hoy = iso(today);
  let h = "";
  for (let d = desde; d <= hasta; d = sumaDias(d, 1)) {
    const evs = eventosDel(d), pts = [...new Set(evs.map(e => colorQ(e.quien)))].slice(0, 4).map(c => `<i style="background:${c}"></i>`).join("");
    const etq = fechaD(d).toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" }) + (evs.length ? `: ${evs.length} ${evs.length === 1 ? "cosa" : "cosas"}` : "");
    h += `<button class="cd${d.startsWith(calMes) ? "" : " fuera"}${d === hoy ? " hoy" : ""}" role="gridcell" data-d="${d}" aria-selected="${d === calDia}" aria-label="${etq}"><span class="n">${+d.slice(8)}</span><span class="pts">${pts}</span></button>`;
  }
  $("cal-grid").innerHTML = h;
  $("cal-leg").innerHTML = quienes().map(q => `<span><i class="dot" style="background:${colorQ(q)}"></i>${esc(q)}</span>`).join("");
  const t = fechaD(calDia).toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" });
  $("cal-dia-t").textContent = (calDia === hoy ? "Hoy, " : "") + t;
  const evs = eventosDel(calDia);
  $("cal-evs").innerHTML = evs.map(e => `<li><button class="ev" data-e="${e.id}" type="button"><span class="barra" style="background:${colorQ(e.quien)}"></span><span class="h">${horario(e)}</span><span><span class="t">${esc(e.titulo)}</span><span class="s">${[esc(e.quien || ""), esc(textoRep(e)), esc(e.nota || "")].filter(Boolean).join(" · ")}</span></span></button></li>`).join("")
    || `<li class="vacio">Nada apuntado este día. Toca Añadir para poner una cita, un turno o una tarea.</li>`;
}
$("cal-evs").addEventListener("click", e => { const b = e.target.closest("[data-e]"); if (b) abrirEvento(eventos.find(x => x.id === b.dataset.e), calDia) });

// Hoja del evento
const fe = { q: "", rep: "no", dias: [], alc: "solo" };
let editando = null; // { ev, dia } al cambiar algo que ya existe
function chipsEv(id, lista, key, multi) { $(id).innerHTML = lista.map(([v, l]) => `<button type="button" class="chip" data-k="${key}" data-v="${v}" aria-pressed="${multi ? fe[key].includes(v) : fe[key] === v}">${esc(l)}</button>`).join("") }
function pintarHojaEv() {
  const serie = editando && editando.ev.repetir !== "no";
  $("e-alc-w").hidden = !serie;
  if (serie) chipsEv("e-alc", [["solo", "Solo este día"], ["siguientes", "Este y los siguientes"], ["todo", "Toda la serie"]], "alc");
  chipsEv("e-q", quienes().map(q => [q, q]), "q");
  chipsEv("e-rep", REPS, "rep");
  chipsEv("e-dias", DSEM.map((l, i) => [String(i + 1), l]), "dias", true);
  // cambiar solo un día no toca la repetición
  document.querySelector(".e-rep-w").hidden = serie && fe.alc === "solo";
  document.querySelector(".e-rep-op").hidden = fe.rep === "no";
  $("e-dias-w").hidden = fe.rep !== "semanal";
  $("e-cada-u").textContent = UNI[fe.rep] ? UNI[fe.rep][+$("e-cada").value === 1 ? 0 : 1] : "";
  document.querySelectorAll(".e-hora").forEach(l => l.hidden = $("e-todo").checked);
  $("e-hasta").min = $("e-fecha").value;
}
function abrirEvento(ev, dia) {
  editando = ev ? { ev, dia } : null;
  const x = ev || { titulo: "", hora_ini: null, hora_fin: null, quien: yo.nombre, nota: "", repetir: "no", cada: 1, dias_semana: [], hasta: null };
  $("e-tit").textContent = ev ? "Cambiar" : "Nuevo en el calendario";
  $("e-titulo").value = x.titulo; $("e-fecha").value = dia; $("e-nota").value = x.nota || "";
  $("e-todo").checked = !x.hora_ini; $("e-ini").value = hm(x.hora_ini); $("e-fin").value = hm(x.hora_fin);
  $("e-cada").value = x.cada || 1; $("e-hasta").value = x.hasta || "";
  Object.assign(fe, { q: x.quien || yo.nombre, rep: x.repetir, dias: ev ? diasDe(x).map(String) : [String(dow(dia))], alc: "solo" });
  $("e-del").hidden = !ev; $("e-del").textContent = ev && ev.repetir !== "no" ? "Borrar solo este día" : "Borrar"; delete $("e-del").dataset.ok;
  aviso("e-msg", ""); pintarHojaEv();
  $("velo-ev").hidden = false; document.body.style.overflow = "hidden";
  if (!ev) $("e-titulo").focus();
}
function cerrarEv() { $("velo-ev").hidden = true; document.body.style.overflow = "" }
$("e-x").addEventListener("click", cerrarEv);
$("velo-ev").addEventListener("click", e => {
  if (e.target === $("velo-ev")) return cerrarEv();
  const c = e.target.closest(".chip"); if (!c) return;
  const k = c.dataset.k, v = c.dataset.v;
  if (k === "dias") fe.dias = fe.dias.includes(v) ? fe.dias.filter(x => x !== v) : [...fe.dias, v];
  else fe[k] = v;
  if (k === "alc" && editando) $("e-del").textContent = { solo: "Borrar solo este día", siguientes: "Borrar este y los siguientes", todo: "Borrar toda la serie" }[v];
  pintarHojaEv();
});
["e-todo", "e-cada", "e-fecha"].forEach(id => $(id).addEventListener("input", pintarHojaEv));
document.addEventListener("keydown", e => { if (e.key === "Escape" && !$("velo-ev").hidden) cerrarEv() });

function leerEv() {
  const f = { titulo: $("e-titulo").value.trim(), fecha: $("e-fecha").value, nota: $("e-nota").value.trim() || null, quien: fe.q || null,
    hora_ini: $("e-todo").checked ? null : $("e-ini").value || null, hora_fin: $("e-todo").checked ? null : $("e-fin").value || null,
    repetir: fe.rep, cada: Math.max(1, Math.min(52, parseInt($("e-cada").value) || 1)), dias_semana: [], hasta: $("e-hasta").value || null };
  if (!f.titulo) throw new Error("Escribe qué es.");
  if (!f.fecha) throw new Error("Elige el día.");
  if (!f.hora_ini) f.hora_fin = null;
  if (f.hora_fin && f.hora_fin < f.hora_ini) throw new Error("La hora de fin es anterior a la de inicio.");
  if (f.repetir === "semanal") f.dias_semana = (fe.dias.length ? fe.dias.map(Number) : [dow(f.fecha)]).sort();
  if (f.repetir === "no") { f.cada = 1; f.hasta = null }
  if (f.hasta && f.hasta < f.fecha) throw new Error("«Hasta el día» tiene que ser igual o posterior al primer día.");
  return f;
}
const ponEv = r => { eventos = eventos.filter(x => x.id !== r.id); eventos.push(r) };
async function cortarSerie(ev, dia) { // la serie termina el día anterior; las copias sueltas desde ese día sobran
  await store.delCopiasDesde(ev.id, dia); eventos = eventos.filter(x => !(x.serie_id === ev.id && x.fecha >= dia));
  ponEv(await store.updEvento(ev.id, { hasta: sumaDias(dia, -1) }));
}
$("e-form").addEventListener("submit", async e => {
  e.preventDefault();
  let f; try { f = leerEv() } catch (err) { return aviso("e-msg", err.message, true) }
  $("e-ok").disabled = true;
  try {
    const ev = editando && editando.ev, dia = editando && editando.dia;
    if (!ev) ponEv(await store.addEvento(f));
    else if (ev.repetir === "no") ponEv(await store.updEvento(ev.id, f));
    else if (fe.alc === "solo") {
      ponEv(await store.updEvento(ev.id, { excepciones: [...new Set([...(ev.excepciones || []), dia])] }));
      ponEv(await store.addEvento({ ...f, repetir: "no", cada: 1, dias_semana: [], hasta: null, serie_id: ev.id }));
    } else if (fe.alc === "siguientes" && dia > ev.fecha) { await cortarSerie(ev, dia); ponEv(await store.addEvento(f)) }
    else { // toda la serie: si se ha movido el día, se mueve toda la serie lo mismo
      const delta = diasEntre(dia, f.fecha), fecha = sumaDias(ev.fecha, delta);
      if (f.hasta && f.hasta < fecha) throw new Error("«Hasta el día» queda antes del inicio de la serie.");
      if (f.repetir === "semanal" && delta % 7) f.dias_semana = f.dias_semana.map(d => (d - 1 + delta % 7 + 7) % 7 + 1).sort();
      ponEv(await store.updEvento(ev.id, { ...f, fecha, excepciones: (ev.excepciones || []).map(x => sumaDias(x, delta)) }));
    }
    calDia = f.fecha; calMes = f.fecha.slice(0, 7); cerrarEv(); pintarCal(); pintarInicio();
  } catch (err) { aviso("e-msg", "No se ha guardado: " + errTxt(err), true) }
  finally { $("e-ok").disabled = false }
});
$("e-del").addEventListener("click", e => dosToques(e.target, async () => {
  const { ev, dia } = editando;
  try {
    if (ev.repetir === "no" || fe.alc === "todo" || (fe.alc === "siguientes" && dia <= ev.fecha)) { await store.delEvento(ev.id); eventos = eventos.filter(x => x.id !== ev.id && x.serie_id !== ev.id) }
    else if (fe.alc === "solo") ponEv(await store.updEvento(ev.id, { excepciones: [...new Set([...(ev.excepciones || []), dia])] }));
    else await cortarSerie(ev, dia);
    cerrarEv(); pintarCal(); pintarInicio();
  } catch (err) { aviso("e-msg", "No se ha borrado: " + errTxt(err), true) }
}));

// ---------------- Tablero Kanban ----------------
// Tres columnas fijas. Dentro de cada una, las tareas van por "orden"; al mover una se le da un orden entre sus vecinas.
const COLS = [["pendiente", "Por hacer"], ["haciendo", "Haciendo"], ["hecho", "Hecho"]];
const nombreCol = c => (COLS.find(x => x[0] === c) || COLS[0])[1];
const REPS_TA = [["no", "No"], ["diario", "Cada día"], ["semanal", "Cada semana"], ["mensual", "Cada mes"], ["anual", "Cada año"]];
const UNI_TA = { ...UNI, anual: ["año", "años"] };
function textoRepTa(t) {
  if (!t.repetir || t.repetir === "no") return "";
  const n = t.cada || 1, u = UNI_TA[t.repetir];
  return (n === 1 ? `Cada ${u[0]}` : `Cada ${n} ${u[1]}`) + (t.hasta ? ` hasta el ${fechaCorta(t.hasta)}` : "");
}
// siguiente fecha de una tarea que se repite, a partir de la que tenía (y nunca antes de hoy)
function siguienteFecha(t) {
  const n = t.cada || 1, d0 = fechaD(t.fecha_limite || iso(today)), dia = d0.getDate();
  const paso = k => {
    const d = new Date(d0);
    if (t.repetir === "diario") d.setDate(dia + n * k);
    else if (t.repetir === "semanal") d.setDate(dia + 7 * n * k);
    else { const meses = (t.repetir === "anual" ? 12 : 1) * n * k; d.setDate(1); d.setMonth(d.getMonth() + meses); d.setDate(Math.min(dia, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate())) }
    return iso(d);
  };
  let k = 1, f = paso(k);
  while (f < iso(today)) f = paso(++k);
  return t.hasta && f > t.hasta ? null : f;
}
const esMia = t => !t.quien || t.quien === yo.nombre || t.quien === todos();
let taFiltro = "todas";
const deCol = (c, filtrar) => tareas.filter(t => t.columna === c && (!filtrar || taFiltro === "todas" || esMia(t))).sort((a, b) => a.orden - b.orden || a.titulo.localeCompare(b.titulo));
function pintarTab() {
  $("ta-filtro").innerHTML = [["todas", "Todas"], ["mias", "Mías"]].map(([v, l]) => `<button type="button" data-f="${v}" aria-pressed="${taFiltro === v}">${l}</button>`).join("");
  const hoy = iso(today);
  $("tablero").innerHTML = COLS.map(([c, nom], k) => {
    const lista = deCol(c, true);
    const tarjeta = t => {
      const fl = t.fecha_limite, cls = c === "hecho" || !fl ? "" : fl < hoy ? " bad" : fl === hoy ? " warn" : "";
      const meta = [t.quien ? `<span class="q"><i class="dot" style="background:${colorQ(t.quien)}"></i>${esc(t.quien)}</span>` : "",
        fl ? `<span class="fl${cls}">${fl === hoy ? "Hoy" : fechaCorta(fl)}</span>` : "", t.repetir && t.repetir !== "no" ? `<span class="rp" title="${esc(textoRepTa(t))}">↻ ${esc(textoRepTa(t))}</span>` : "", t.nota ? `<span class="nt" title="${esc(t.nota)}">Nota</span>` : ""].filter(Boolean).join("");
      return `<li class="ta" draggable="true" data-ta="${t.id}"><button class="ta-b" type="button" data-abrir><span class="t">${esc(t.titulo)}</span>${meta ? `<span class="m">${meta}</span>` : ""}</button>
        <span class="ta-mv">${k > 0 ? `<button type="button" class="ib" data-mv="-1" aria-label="Pasar a ${COLS[k - 1][1]}">‹</button>` : ""}${k < COLS.length - 1 ? `<button type="button" class="ib" data-mv="1" aria-label="Pasar a ${COLS[k + 1][1]}">›</button>` : ""}</span></li>`;
    };
    return `<section class="col card" data-col="${c}" aria-label="${nom}"><div class="ch"><h2>${nom} <span class="n">${lista.length}</span></h2>${c === "hecho" && lista.length ? `<button class="del" type="button" id="ta-limpiar">Borrar las hechas</button>` : `<button class="ib" type="button" data-nueva="${c}" aria-label="Nueva tarea en ${nom}">+</button>`}</div>
      <ul class="tas">${lista.map(tarjeta).join("") || `<li class="vacio">${c === "pendiente" ? "Nada pendiente. Toca + para apuntar algo." : c === "haciendo" ? "Pasa aquí lo que estéis haciendo." : "Aquí irá lo terminado."}</li>`}</ul></section>`;
  }).join("");
}
// Mueve una tarea a una columna, delante de otra tarea (o al final; las que pasan a Hecho van arriba)
async function moverTarea(t, col, antesDe) {
  const resto = deCol(col).filter(x => x.id !== t.id);
  let orden;
  if (antesDe) { const i = resto.findIndex(x => x.id === antesDe); const ant = i > 0 ? resto[i - 1].orden : resto[i].orden - 2; orden = (ant + resto[i].orden) / 2 }
  else if (col === "hecho" && t.columna !== "hecho") orden = resto.length ? resto[0].orden - 1 : 0;
  else orden = resto.length ? resto[resto.length - 1].orden + 1 : 0;
  const c = { columna: col, orden, hecho: col === "hecho" ? (t.hecho || new Date().toISOString()) : null };
  if (t.columna === col && t.orden === orden) return;
  // al terminar una tarea que se repite, aparece la siguiente en Por hacer; la terminada queda como hecha sin repetirse
  const sig = col === "hecho" && t.columna !== "hecho" && t.repetir && t.repetir !== "no" ? siguienteFecha(t) : undefined;
  if (sig !== undefined) c.repetir = "no";
  const serie = { titulo: t.titulo, nota: t.nota, quien: t.quien, repetir: t.repetir, cada: t.cada, hasta: t.hasta };
  Object.assign(t, c); pintarTab(); pintarInicio(); // se ve al momento; si falla, se recarga lo guardado
  try {
    ponTa(await store.updTarea(t.id, c));
    if (sig) { const p = deCol("pendiente"); ponTa(await store.addTarea({ ...serie, fecha_limite: sig, columna: "pendiente", orden: p.length ? p[p.length - 1].orden + 1 : 0, hecho: null })); pintarTab(); pintarInicio() }
  } catch (err) { await cargar(); pintar() }
}
const ponTa = r => { tareas = tareas.filter(x => x.id !== r.id); tareas.push(r) };
$("ta-filtro").addEventListener("click", e => { const b = e.target.closest("[data-f]"); if (b) { taFiltro = b.dataset.f; pintarTab() } });
$("ta-add").addEventListener("click", () => abrirTarea(null));
$("tablero").addEventListener("click", e => {
  if (e.target.id === "ta-limpiar") return dosToques(e.target, async () => {
    const ids = deCol("hecho", true).map(t => t.id);
    try { await store.delTareas(ids); tareas = tareas.filter(t => !ids.includes(t.id)); pintarTab() } catch (err) { e.target.textContent = errTxt(err) }
  });
  const nueva = e.target.closest("[data-nueva]"); if (nueva) return abrirTarea(null, nueva.dataset.nueva);
  const li = e.target.closest(".ta"); if (!li) return;
  const t = tareas.find(x => x.id === li.dataset.ta);
  const mv = e.target.closest("[data-mv]");
  if (mv) { const k = COLS.findIndex(x => x[0] === t.columna) + +mv.dataset.mv; return moverTarea(t, COLS[k][0]) }
  if (e.target.closest("[data-abrir]")) abrirTarea(t);
});
// Arrastrar y soltar (ordenador). En el móvil se mueven con las flechas o desde la hoja de la tarea.
let arrastrada = null;
$("tablero").addEventListener("dragstart", e => { const li = e.target.closest(".ta"); if (!li) return; arrastrada = li.dataset.ta; e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", arrastrada); li.classList.add("arr") });
$("tablero").addEventListener("dragend", () => { arrastrada = null; document.querySelectorAll(".col.sobre, .ta.arr").forEach(x => x.classList.remove("sobre", "arr")) });
$("tablero").addEventListener("dragover", e => { const col = e.target.closest(".col"); if (!col || !arrastrada) return; e.preventDefault(); document.querySelectorAll(".col.sobre").forEach(x => x !== col && x.classList.remove("sobre")); col.classList.add("sobre") });
$("tablero").addEventListener("drop", e => {
  const col = e.target.closest(".col"); if (!col || !arrastrada) return; e.preventDefault();
  const t = tareas.find(x => x.id === arrastrada), sobre = e.target.closest(".ta");
  moverTarea(t, col.dataset.col, sobre && sobre.dataset.ta !== t.id ? sobre.dataset.ta : null);
});

// Hoja de la tarea
const ft = { col: "pendiente", q: "", rep: "no" };
let tareaEd = null;
function chipsTa() {
  $("ta-col").innerHTML = COLS.map(([v, l]) => `<button type="button" class="chip" data-k="col" data-v="${v}" aria-pressed="${ft.col === v}">${l}</button>`).join("");
  $("ta-rep").innerHTML = REPS_TA.map(([v, l]) => `<button type="button" class="chip" data-k="rep" data-v="${v}" aria-pressed="${ft.rep === v}">${l}</button>`).join("");
  $("ta-rep-op").hidden = ft.rep === "no";
  if (UNI_TA[ft.rep]) $("ta-cada-u").textContent = UNI_TA[ft.rep][+$("ta-cada").value === 1 ? 0 : 1];
  $("ta-hasta").min = $("ta-fecha").value;
  $("ta-q").innerHTML = ["", ...quienes()].map(q => `<button type="button" class="chip" data-k="q" data-v="${esc(q)}" aria-pressed="${ft.q === q}">${q ? esc(q) : "Sin asignar"}</button>`).join("");
}
function abrirTarea(t, col) {
  tareaEd = t;
  $("ta-tit").textContent = t ? "Cambiar tarea" : "Nueva tarea";
  $("ta-titulo").value = t ? t.titulo : ""; $("ta-nota").value = t && t.nota || ""; $("ta-fecha").value = t && t.fecha_limite || "";
  $("ta-cada").value = t && t.cada || 1; $("ta-hasta").value = t && t.hasta || "";
  Object.assign(ft, { col: t ? t.columna : col || "pendiente", q: t ? t.quien || "" : yo.nombre, rep: t && t.repetir || "no" });
  $("ta-del").hidden = !t; $("ta-del").textContent = "Borrar"; delete $("ta-del").dataset.ok;
  aviso("ta-msg", ""); chipsTa();
  $("velo-ta").hidden = false; document.body.style.overflow = "hidden";
  if (!t) $("ta-titulo").focus();
}
function cerrarTa() { $("velo-ta").hidden = true; document.body.style.overflow = "" }
$("ta-x").addEventListener("click", cerrarTa);
$("velo-ta").addEventListener("click", e => {
  if (e.target === $("velo-ta")) return cerrarTa();
  const c = e.target.closest(".chip"); if (c) { ft[c.dataset.k] = c.dataset.v; chipsTa() }
});
document.addEventListener("keydown", e => { if (e.key === "Escape" && !$("velo-ta").hidden) cerrarTa() });
["ta-cada", "ta-fecha"].forEach(id => $(id).addEventListener("input", chipsTa));
$("ta-form").addEventListener("submit", async e => {
  e.preventDefault();
  const f = { titulo: $("ta-titulo").value.trim(), nota: $("ta-nota").value.trim() || null, quien: ft.q || null, fecha_limite: $("ta-fecha").value || null,
    repetir: ft.rep, cada: ft.rep === "no" ? 1 : Math.max(1, Math.min(52, parseInt($("ta-cada").value) || 1)), hasta: ft.rep === "no" ? null : $("ta-hasta").value || null };
  if (!f.titulo) return aviso("ta-msg", "Escribe qué hay que hacer.", true);
  if (f.repetir !== "no" && !f.fecha_limite) f.fecha_limite = iso(today); // una tarea que se repite necesita su primer día
  if (f.hasta && f.hasta < f.fecha_limite) return aviso("ta-msg", "«Hasta el día» tiene que ser igual o posterior al día de la tarea.", true);
  $("ta-ok").disabled = true;
  try {
    if (tareaEd) {
      ponTa(await store.updTarea(tareaEd.id, f));
      const t = tareas.find(x => x.id === tareaEd.id); if (t.columna !== ft.col) await moverTarea(t, ft.col);
    } else {
      const resto = deCol(ft.col);
      ponTa(await store.addTarea({ ...f, columna: ft.col, orden: resto.length ? resto[resto.length - 1].orden + 1 : 0, hecho: ft.col === "hecho" ? new Date().toISOString() : null }));
    }
    cerrarTa(); pintarTab(); pintarInicio();
  } catch (err) { aviso("ta-msg", "No se ha guardado: " + errTxt(err), true) }
  finally { $("ta-ok").disabled = false }
});
$("ta-del").addEventListener("click", e => dosToques(e.target, async () => {
  try { await store.delTareas([tareaEd.id]); tareas = tareas.filter(x => x.id !== tareaEd.id); cerrarTa(); pintarTab(); pintarInicio() }
  catch (err) { aviso("ta-msg", "No se ha borrado: " + errTxt(err), true) }
}));

store.onAuth(arrancar);
if ("serviceWorker" in navigator && !store.demo) {
  // al llegar una versión nueva de la app, recarga una vez para usarla (solo si ya había una versión instalada)
  if (navigator.serviceWorker.controller) { let r = false; navigator.serviceWorker.addEventListener("controllerchange", () => { if (!r) { r = true; location.reload() } }) }
  navigator.serviceWorker.register("sw.js").catch(() => { });
}
})();
