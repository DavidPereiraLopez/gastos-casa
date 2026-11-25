// Rutinas de Nora: pantalla para ella (reloj con el tiempo que queda, iconos grandes, estrellas y premios)
// y panel para papá y mamá (rutinas, qué tal ha ido cada día y premios). Los datos van por window.store.
(function () {
const $ = id => document.getElementById(id);
const esc = s => String(s ?? "").replace(/[&<>"]/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[m]));
const iso = d => { const z = new Date(d.getTime() - d.getTimezoneOffset() * 6e4); return z.toISOString().slice(0, 10) };
const mins = t => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
const hhmm = t => t.slice(0, 5).replace(/^0/, "");
const dow = d => (d.getDay() + 6) % 7 + 1; // 1 = lunes ... 7 = domingo
const ahoraMin = () => { const d = new Date(); return d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60 };
const diaDe = f => new Date(f + "T12:00");
const PEQUE = "Nora";
const DIAS = ["L", "M", "X", "J", "V", "S", "D"];
const ICONOS = ["🥣", "🍝", "🍽️", "🥛", "🍎", "🪥", "🛁", "🚿", "🧼", "🚽", "👗", "👟", "🧥", "🎒", "🏫", "🚗", "🧸", "🧩", "🎨", "✏️", "📖", "🎵", "💃", "⚽", "🌳", "🐶", "🌙", "😴", "🛏️", "💊", "💧", "🧹", "⏰", "⭐"];
// colores de las tareas (vivos y que se distingan bien entre sí)
const COLORES = ["#4cb8f5", "#ff7aa8", "#ffa41b", "#5cc977", "#a58bff", "#ff6b4a", "#22c3b5", "#f5cf2a", "#c0845e", "#6c7ff2"];
const colorDe = r => r.color || COLORES[Math.max(0, N.rutinas.indexOf(r)) % COLORES.length];
const ICONOS_P = ["🎁", "🍕", "🍦", "🍿", "🎠", "🛝", "🎬", "📚", "🧸", "🎨", "🏊", "🚲", "🦄", "🎈", "🍰", "🌟"];

let store = null, N = null, abierta = false, modo = "nina", pTab = "hoy", pDia = iso(new Date());
let actualKey = "", avisada = {}, audio = null, wake = null, reloj = null;

// ---------------- Datos ----------------
const rutinasActivas = () => N.rutinas.filter(r => r.activa !== false && r.peque === PEQUE).sort((a, b) => a.inicio.localeCompare(b.inicio));
const rutinasDe = f => rutinasActivas().filter(r => (r.dias || []).includes(dow(diaDe(f))));
const reg = (rid, f) => N.registro.find(g => g.rutina_id === rid && g.fecha === f);
// ¿contaba ya la rutina ese día? (no se pierden estrellas de rutinas creadas después de su hora)
const contaba = (r, f) => !r.creado || new Date(r.creado) <= new Date(f + "T" + r.inicio.slice(0, 5));
// estado de una rutina un día: bien / tarde / no (ya apuntado), ahora, luego, nueva
function estado(r, f) {
  const g = reg(r.id, f); if (g) return g.estado;
  if (!contaba(r, f)) return "nueva";
  const hoy = iso(new Date());
  if (f > hoy) return "luego";
  if (f < hoy) return "no";
  const t = ahoraMin();
  return t < mins(r.inicio) ? "luego" : t < mins(r.fin) ? "ahora" : "no";
}
// estrellas que tiene ahora: se suman y restan por orden, sin bajar nunca de cero
function saldo() {
  const mov = [...N.registro.filter(g => g.peque === PEQUE).map(g => { const r = N.rutinas.find(x => x.id === g.rutina_id); return [new Date(g.fecha + "T" + (r ? r.fin.slice(0, 5) : "23:59")), g.estrellas] }),
    ...N.canjes.filter(c => c.peque === PEQUE).map(c => [new Date(c.creado), -c.coste])].sort((a, b) => a[0] - b[0]);
  return mov.reduce((s, [, n]) => Math.max(0, s + n), 0);
}
const estrellasDia = f => N.registro.filter(g => g.fecha === f && g.peque === PEQUE).reduce((s, g) => s + g.estrellas, 0);
// las rutinas que ya acabaron sin hacerse se apuntan como "no" (restan estrellas); se puede cambiar luego en Papás > Hoy
let apuntando = false;
async function apuntarFallos() {
  if (!N || apuntando) return;
  const filas = [], hoy = new Date();
  for (let n = 7; n >= 0; n--) {
    const f = iso(new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - n));
    rutinasDe(f).forEach(r => { if (!reg(r.id, f) && contaba(r, f) && estado(r, f) === "no") filas.push({ peque: PEQUE, rutina_id: r.id, fecha: f, estado: "no", estrellas: -r.pierde }) });
  }
  if (!filas.length) return;
  apuntando = true;
  try { const out = await store.noraFallos(filas); N.registro.push(...out.filter(o => !reg(o.rutina_id, o.fecha))); pintar() } catch (e) { } finally { apuntando = false }
}

// ---------------- Abrir y cerrar ----------------
function abrir(m) {
  if (!N) return;
  abierta = true; modo = m || "nina"; $("nora").hidden = false; document.body.style.overflow = "hidden";
  try { localStorage.setItem("nora-abierta", "1") } catch (e) { }
  if (location.hash !== "#nora") history.replaceState(null, "", "#nora");
  pintar(); empezarReloj(); mantenerPantalla();
}
function cerrar() {
  abierta = false; $("nora").hidden = true; document.body.style.overflow = "";
  try { localStorage.removeItem("nora-abierta") } catch (e) { }
  if (location.hash === "#nora") history.replaceState(null, "", location.pathname + location.search);
  clearInterval(reloj); reloj = null; if (wake) { wake.release().catch(() => { }); wake = null }
}
// la pantalla no se apaga mientras Nora la mira (donde el navegador lo permite)
async function mantenerPantalla() { try { if (navigator.wakeLock && !wake && modo === "nina") wake = await navigator.wakeLock.request("screen") } catch (e) { } }
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible" && abierta) { wake = null; mantenerPantalla(); pintar() } });
// botones de mayores en la pantalla de Nora: hay que mantenerlos pulsados, para que ella no salga sin querer
function mantener(el, fn) {
  let t = null;
  const fin = () => { clearTimeout(t); el.classList.remove("cargando") };
  el.addEventListener("pointerdown", e => { if (modo !== "nina") return; e.preventDefault(); el.classList.add("cargando"); t = setTimeout(() => { fin(); fn() }, 600) });
  ["pointerup", "pointerleave", "pointercancel"].forEach(ev => el.addEventListener(ev, fin));
  el.addEventListener("click", () => { if (modo !== "nina") fn(); else pista("Mantén pulsado para entrar") });
  el.addEventListener("contextmenu", e => e.preventDefault());
}
function pista(txt) { const p = $("n-pista"); p.textContent = txt; p.classList.add("si"); clearTimeout(p._t); p._t = setTimeout(() => p.classList.remove("si"), 1800) }

// ---------------- Sonido ----------------
function sonar(notas, tipo) {
  try {
    audio = audio || new (window.AudioContext || window.webkitAudioContext)();
    if (audio.state === "suspended") audio.resume();
    const t0 = audio.currentTime;
    notas.forEach(([f, ini, dur]) => {
      const o = audio.createOscillator(), g = audio.createGain();
      o.type = tipo || "sine"; o.frequency.value = f; o.connect(g); g.connect(audio.destination);
      g.gain.setValueAtTime(0.0001, t0 + ini); g.gain.exponentialRampToValueAtTime(0.35, t0 + ini + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t0 + ini + dur);
      o.start(t0 + ini); o.stop(t0 + ini + dur + 0.05);
    });
  } catch (e) { }
}
const sonidoEstrella = () => sonar([[523, 0, .18], [659, .12, .18], [784, .24, .18], [1047, .36, .4]], "triangle");
const sonidoAviso = () => sonar([[880, 0, .25], [660, .3, .25], [880, .6, .25], [660, .9, .35]], "square");
document.addEventListener("pointerdown", () => { if (abierta && !audio) sonar([[1, 0, .01]]) }, { once: false, passive: true }); // iPhone: el sonido se activa con un toque

// ---------------- Reloj ----------------
const P = (ang, r) => [100 + r * Math.sin(ang), 100 - r * Math.cos(ang)];
const angMin = m => (m % 60) / 60 * 2 * Math.PI;
function sector(a0, a1, r) {
  let d = a1 - a0; while (d < 0) d += 2 * Math.PI; if (d >= 2 * Math.PI - 1e-3) d = 2 * Math.PI - 1e-3;
  const [x0, y0] = P(a0, r), [x1, y1] = P(a0 + d, r);
  return `M100 100 L${x0.toFixed(2)} ${y0.toFixed(2)} A${r} ${r} 0 ${d > Math.PI ? 1 : 0} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}Z`;
}
// Franjas de colores: la hora que viene (lo que recorrerá la aguja larga en una vuelta), cada rutina con su color y su icono.
// "Cuando la aguja llegue al final de su color, se acaba esa tarea."
function pintarReloj() {
  const d = new Date(), m = d.getMinutes() + d.getSeconds() / 60, h = (d.getHours() % 12) + m / 60, t = ahoraMin(), hoy = iso(d);
  let zona = "", iconos = "";
  rutinasDe(hoy).forEach(r => {
    const ini = mins(r.inicio), fin = mins(r.fin), e = estado(r, hoy), c = colorDe(r);
    const a = Math.max(ini, t), b = Math.min(fin, t + 59.5);
    // lo que ya ha pasado de la tarea de ahora, más clarito
    if (e === "ahora" && ini < t) zona += `<path d="${sector(angMin(Math.max(ini, t - 59.5)), angMin(t), 84)}" fill="${c}" class="n-pasado"/>`;
    if (b <= a) return;
    const urg = e === "ahora" && fin - t <= (r.aviso_min || 0);
    zona += `<path d="${sector(angMin(a), angMin(b), 84)}" fill="${c}" class="n-franja ${e}${urg ? " urge" : ""}"/>`;
    const [ix, iy] = P(angMin((a + b) / 2), 42); // por dentro de los números, para no taparlos
    iconos += `<g class="n-fi ${e}"><circle cx="${ix.toFixed(1)}" cy="${iy.toFixed(1)}" r="12" fill="#fff" stroke="${c}" stroke-width="2.5"/><text x="${ix.toFixed(1)}" y="${(iy + .8).toFixed(1)}">${esc(r.icono)}</text></g>`;
  });
  let marcas = "";
  for (let i = 0; i < 60; i++) { const [x0, y0] = P(i / 60 * 2 * Math.PI, 90), [x1, y1] = P(i / 60 * 2 * Math.PI, i % 5 ? 87 : 83); marcas += `<line x1="${x0.toFixed(2)}" y1="${y0.toFixed(2)}" x2="${x1.toFixed(2)}" y2="${y1.toFixed(2)}" class="${i % 5 ? "mm" : "mh"}"/>` }
  let nums = "";
  for (let i = 1; i <= 12; i++) { const [x, y] = P(i / 12 * 2 * Math.PI, 70); nums += `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" class="n-num c${i % 6}">${i}</text>` }
  const [hx, hy] = P(h / 12 * 2 * Math.PI, 44), [mx, my] = P(m / 60 * 2 * Math.PI, 74);
  $("n-reloj").innerHTML = `<circle cx="100" cy="100" r="95" class="n-borde"/><circle cx="100" cy="100" r="90" class="n-cara"/>${zona}${marcas}${nums}${iconos}
    <line x1="100" y1="100" x2="${hx.toFixed(2)}" y2="${hy.toFixed(2)}" class="n-hora"/><line x1="100" y1="100" x2="${mx.toFixed(2)}" y2="${my.toFixed(2)}" class="n-min"/>
    <circle cx="100" cy="100" r="6" class="n-eje"/>`;
}

// Reloj de una hora como lo verá Nora (la aguja larga recorre la hora), para que papá y mamá vean las franjas y los huecos
function relojHora(rs, hora) {
  const base = hora * 60;
  let zona = "", iconos = "", nums = "", marcas = "", horas = "";
  const hm = m => `${Math.floor(m / 60)}:${String(Math.round(m % 60)).padStart(2, "0")}`, puestas = [];
  // hora escrita por fuera del reloj en cada principio y final de franja (sin repetir ni amontonar)
  const etiqueta = m => { if (puestas.some(x => { const d = ((x - m) % 60 + 60) % 60; return d < 4 || d > 56 })) return; puestas.push(m); const [x, y] = P(angMin(m), 108); horas += `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" class="n-hm">${hm(m)}</text>` };
  rs.forEach(r => {
    const a = Math.max(mins(r.inicio), base), b = Math.min(mins(r.fin), base + 60), c = colorDe(r);
    if (b <= a) return;
    zona += `<path d="${sector(angMin(a), angMin(Math.min(b, base + 59.5)), 84)}" fill="${c}" class="n-franja"/>`;
    etiqueta(a); etiqueta(b);
    const [ix, iy] = P(angMin((a + b) / 2), 42);
    iconos += `<g class="n-fi"><circle cx="${ix.toFixed(1)}" cy="${iy.toFixed(1)}" r="12" fill="#fff" stroke="${c}" stroke-width="2.5"/><text x="${ix.toFixed(1)}" y="${(iy + .8).toFixed(1)}">${esc(r.icono)}</text></g>`;
  });
  for (let i = 0; i < 60; i += 5) { const [x0, y0] = P(i / 60 * 2 * Math.PI, 90), [x1, y1] = P(i / 60 * 2 * Math.PI, 83); marcas += `<line x1="${x0.toFixed(2)}" y1="${y0.toFixed(2)}" x2="${x1.toFixed(2)}" y2="${y1.toFixed(2)}" class="mh"/>` }
  for (let i = 1; i <= 12; i++) { const [x, y] = P(i / 12 * 2 * Math.PI, 70); nums += `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" class="n-num c${i % 6}">${i}</text>` }
  return `<circle cx="100" cy="100" r="95" class="n-borde"/><circle cx="100" cy="100" r="90" class="n-cara"/>${zona}${marcas}${nums}${iconos}${horas}`;
}

// ---------------- Pantalla de Nora ----------------
const quedanTxt = n => n <= 1 ? "¡Queda 1 minuto!" : `Quedan ${n} minutos`;
function actualYSiguiente() {
  const hoy = iso(new Date()), rs = rutinasDe(hoy);
  return { hoy, rs, ahora: rs.find(r => estado(r, hoy) === "ahora"), luego: rs.find(r => estado(r, hoy) === "luego") };
}
function pintarNina() {
  const { hoy, rs, ahora, luego } = actualYSiguiente(), r = ahora || luego, st = ahora ? "ahora" : "luego", t = ahoraMin();
  pintarReloj();
  const a = $("n-ahora"), b = $("n-hecho");
  if (ahora) {
    const q = Math.ceil(mins(ahora.fin) - t), urg = q <= (ahora.aviso_min || 0);
    a.className = "n-ahora" + (urg ? " urge" : "");
    a.innerHTML = `<span class="n-ico">${esc(ahora.icono)}</span><span class="n-nom">${esc(ahora.nombre)}</span><span class="n-q">${urg ? "¡Corre! " : ""}${quedanTxt(q)}</span><span class="n-h">Hasta las ${hhmm(ahora.fin)}</span>`;
    b.hidden = false; b.dataset.id = ahora.id;
    // aviso en esta pantalla cuando faltan pocos minutos (una vez por rutina y día)
    const k = ahora.id + hoy;
    if (urg && !avisada[k]) { avisada[k] = 1; sonidoAviso(); try { navigator.vibrate && navigator.vibrate([300, 150, 300]) } catch (e) { } }
  } else if (luego) {
    const q = Math.ceil(mins(luego.inicio) - t);
    a.className = "n-ahora luego";
    a.innerHTML = `<span class="n-ico">${esc(luego.icono)}</span><span class="n-pre">Lo siguiente</span><span class="n-nom">${esc(luego.nombre)}</span><span class="n-q">${q > 90 ? "A las " + hhmm(luego.inicio) : "Empieza en " + (q <= 1 ? "1 minuto" : q + " minutos")}</span>`;
    b.hidden = true;
  } else {
    const n = estrellasDia(hoy);
    a.className = "n-ahora fin";
    a.innerHTML = `<span class="n-ico">${rs.length ? "🌈" : "😊"}</span><span class="n-nom">${rs.length ? "¡Has terminado por hoy!" : "Hoy no hay tareas"}</span>${rs.length ? `<span class="n-q">Hoy: ${n >= 0 ? "+" : ""}${n} ⭐</span>` : ""}`;
    b.hidden = true;
  }
  $("n-dia").innerHTML = rs.length ? rs.map(x => {
    const e = estado(x, hoy);
    return `<li class="n-bola ${e}" title="${esc(x.nombre)}" style="--c:${colorDe(x)}"><span class="i">${esc(x.icono)}</span><span class="h">${hhmm(x.inicio)}</span>${e === "bien" ? '<span class="b">⭐</span>' : e === "no" ? '<span class="b">✖</span>' : e === "tarde" ? '<span class="b">🐢</span>' : ""}</li>`;
  }).join("") : "";
  // premio siguiente
  const s = saldo(), ps = N.premios.filter(p => p.peque === PEQUE).sort((x, y) => x.coste - y.coste), sig = ps.find(p => p.coste > s) || ps[ps.length - 1];
  $("n-est").innerHTML = `<span>⭐</span><b>${s}</b>`;
  $("n-premio").innerHTML = sig ? `<span class="pi">${esc(sig.icono)}</span><div class="pt"><b>${esc(sig.nombre)}</b><div class="n-barra"><i style="width:${Math.min(100, s / sig.coste * 100)}%"></i></div><span>${s >= sig.coste ? "¡Ya lo puedes pedir! 🎉" : `Te faltan ${sig.coste - s} ⭐`}</span></div>` : `<span class="pi">🎁</span><div class="pt"><b>Premios</b><span>Papá y mamá pueden poner premios aquí</span></div>`;
}
async function hecho() {
  const id = $("n-hecho").dataset.id, r = N.rutinas.find(x => x.id === id), hoy = iso(new Date());
  if (!r || reg(r.id, hoy)) return;
  const fila = { peque: PEQUE, rutina_id: r.id, fecha: hoy, estado: "bien", estrellas: r.gana };
  celebrar(r.gana, r.icono);
  try { const out = await store.noraFallos([fila]); N.registro.push(...out.filter(o => !reg(o.rutina_id, o.fecha))) } catch (e) { pista("No se ha podido guardar. ¿Hay conexión?") }
  pintar();
}
function celebrar(n, icono, txt) {
  const c = $("n-fiesta");
  c.innerHTML = `<div class="n-gran">${n > 0 ? "⭐" : esc(icono)}</div><p>${esc(txt || (n > 0 ? `¡Muy bien, ${PEQUE}!` : "¡Hecho!"))}</p>${n > 0 ? `<p class="n-mas">+${n} ⭐</p>` : ""}` +
    Array.from({ length: 28 }, (_, i) => `<i style="--x:${(Math.random() * 2 - 1).toFixed(2)};--d:${(i % 7) * 60}ms;--c:${["#ffcf3f", "#ff7aa8", "#6fd0ff", "#8fe388", "#b99bff"][i % 5]}"></i>`).join("");
  c.hidden = false; c.classList.remove("va"); void c.offsetWidth; c.classList.add("va");
  sonidoEstrella(); try { navigator.vibrate && navigator.vibrate(80) } catch (e) { }
  clearTimeout(c._t); c._t = setTimeout(() => { c.hidden = true }, 2600);
}

// ---------------- Panel de papá y mamá ----------------
const ESTADOS = [["bien", "⭐", "A tiempo"], ["tarde", "🐢", "Tarde"], ["no", "✖", "No"]];
function pintarPapas() {
  document.querySelectorAll("#n-ptabs button").forEach(b => b.setAttribute("aria-pressed", b.dataset.p === pTab));
  ["hoy", "rutinas", "premios"].forEach(x => $("np-" + x).hidden = x !== pTab);
  const s = saldo();
  $("np-saldo").textContent = s;
  if (pTab === "hoy") {
    const hoy = iso(new Date()), d = diaDe(pDia);
    $("np-dia-t").textContent = pDia === hoy ? "Hoy" : d.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "short" });
    const futuro = pDia > hoy, lim = new Date(); lim.setDate(lim.getDate() + 14);
    $("np-sig").disabled = pDia >= iso(lim);
    if (pDia === iso(new Date(Date.now() + 864e5))) $("np-dia-t").textContent = "Mañana";
    const rs = rutinasDe(pDia);
    // un reloj por cada hora con alguna tarea, tal como lo verá Nora
    const horas = [...new Set(rs.flatMap(r => { const hs = []; for (let h = Math.floor(mins(r.inicio) / 60); h * 60 < mins(r.fin); h++) hs.push(h); return hs }))].sort((x, y) => x - y);
    $("np-relojes").innerHTML = horas.map(h => `<figure><svg viewBox="-26 -26 252 252" role="img" aria-label="De ${h}:00 a ${h + 1}:00">${relojHora(rs, h)}</svg><figcaption>De <b>${h}:00</b> a <b>${h + 1}:00</b><br><span>una vuelta de la aguja larga</span></figcaption></figure>`).join("");
    $("np-lista").innerHTML = rs.length ? rs.map(r => {
      const e = estado(r, pDia), g = reg(r.id, pDia);
      return `<li><span class="ri" style="--c:${colorDe(r)}">${esc(r.icono)}</span><span class="rt"><b>${esc(r.nombre)}</b><span>${hhmm(r.inicio)} – ${hhmm(r.fin)}${e === "ahora" ? " · ahora" : e === "luego" ? " · luego" : e === "nueva" ? " · aún no contaba" : ""}</span></span>
        ${futuro ? "" : `<span class="rs" role="group" aria-label="Cómo ha ido">`}${futuro ? "" : ESTADOS.map(([k, i, l]) => `<button data-r="${r.id}" data-e="${k}" aria-pressed="${!!g && g.estado === k}" title="${l}" aria-label="${l}">${i}</button>`).join("") + "</span>"}</li>`;
    }).join("") : `<li class="vacio">Este día no hay rutinas.</li>`;
    const extras = N.registro.filter(g => g.fecha === pDia && g.estado === "extra");
    $("np-extras").innerHTML = extras.map(g => `<li><span>${g.estrellas > 0 ? "+" : ""}${g.estrellas} ⭐ ${esc(g.nota || "")}</span><button class="ib" data-x="${g.id}" aria-label="Quitar">✕</button></li>`).join("");
    // la semana
    const sem = Array.from({ length: 7 }, (_, i) => { const f = iso(new Date(d.getFullYear(), d.getMonth(), d.getDate() - 6 + i)); return [f, estrellasDia(f)] });
    const mx = Math.max(1, ...sem.map(([, n]) => Math.abs(n)));
    $("np-sem").innerHTML = sem.map(([f, n]) => `<button class="sd${f === pDia ? " on" : ""}" data-f="${f}"><span class="sv ${n < 0 ? "neg" : ""}">${n > 0 ? "+" : ""}${n}</span><span class="sb"><i style="height:${Math.abs(n) / mx * 100}%" class="${n < 0 ? "neg" : ""}"></i></span><span class="sl">${DIAS[dow(diaDe(f)) - 1]}</span></button>`).join("");
  }
  if (pTab === "rutinas") {
    const rs = rutinasActivas();
    $("np-rl").innerHTML = rs.length ? rs.map(r => `<li><button data-ed="${r.id}"><span class="ri" style="--c:${colorDe(r)}">${esc(r.icono)}</span><span class="rt"><b>${esc(r.nombre)}</b><span>${hhmm(r.inicio)} – ${hhmm(r.fin)} · ${diasTxt(r.dias)}</span></span><span class="rg">+${r.gana} / −${r.pierde} ⭐${r.aviso_min ? `<br>🔔 ${r.aviso_min} min` : ""}</span></button></li>`).join("")
      : `<li class="vacio">Aún no hay rutinas. Empieza por una, por ejemplo «Desayunar» de 9:00 a 9:15.</li>`;
  }
  if (pTab === "premios") {
    const ps = N.premios.filter(p => p.peque === PEQUE).sort((a, b) => a.coste - b.coste);
    $("np-pl").innerHTML = ps.length ? ps.map(p => `<li><span class="ri">${esc(p.icono)}</span><span class="rt"><b>${esc(p.nombre)}</b><span>${p.coste} ⭐${s < p.coste ? ` · faltan ${p.coste - s}` : ""}</span></span>
      <button class="btn sm${s >= p.coste ? " primary" : ""}" data-canje="${p.id}" ${s >= p.coste ? "" : "disabled"}>Conseguir</button><button class="ib" data-edp="${p.id}" aria-label="Cambiar">✎</button></li>`).join("")
      : `<li class="vacio">Pon premios con las estrellas que cuestan: elegir la cena, ir al parque, una peli…</li>`;
    const cs = N.canjes.filter(c => c.peque === PEQUE).slice().sort((a, b) => b.creado.localeCompare(a.creado)).slice(0, 15);
    $("np-canjes").innerHTML = cs.map(c => `<li><span>${esc(c.icono)} ${esc(c.nombre)} <span class="hint">· −${c.coste} ⭐ · ${new Date(c.creado).toLocaleDateString("es-ES", { day: "numeric", month: "short" })}</span></span><button class="ib" data-xc="${c.id}" aria-label="Deshacer">↺</button></li>`).join("");
    $("np-canjes-w").hidden = !cs.length;
  }
}
const diasTxt = ds => { const s = [...ds].sort().join(""); return s === "1234567" ? "todos los días" : s === "12345" ? "de lunes a viernes" : s === "67" ? "fin de semana" : [...ds].sort().map(d => DIAS[d - 1]).join(" ") };
async function marcar(rid, e) {
  const r = N.rutinas.find(x => x.id === rid), g = reg(rid, pDia), n = e === "bien" ? r.gana : e === "no" ? -r.pierde : 0;
  try {
    if (g && g.estado === e) { await store.noraDel("nora_registro", g.id); N.registro = N.registro.filter(x => x !== g) } // quitar (vuelve a "pendiente" si aún es su hora)
    else if (g) Object.assign(g, await store.noraUpd("nora_registro", g.id, { estado: e, estrellas: n }));
    else N.registro.push(await store.noraAdd("nora_registro", { peque: PEQUE, rutina_id: rid, fecha: pDia, estado: e, estrellas: n }));
  } catch (err) { pista("No se ha podido guardar") }
  pintar();
}

// formulario de rutina
let edR = null, fR = {};
function abrirRutina(id) {
  edR = id ? N.rutinas.find(r => r.id === id) : null;
  // color nuevo: el primero que no use otra rutina
  const libre = COLORES.find(c => !rutinasActivas().some(r => colorDe(r) === c)) || COLORES[0];
  fR = edR ? { ...edR, dias: [...edR.dias], color: colorDe(edR) } : { nombre: "", icono: "🥣", color: libre, inicio: "09:00", fin: "09:15", dias: [1, 2, 3, 4, 5, 6, 7], gana: 1, pierde: 1, aviso_min: 3 };
  $("nr-tit").textContent = edR ? "Cambiar rutina" : "Nueva rutina";
  $("nr-nom").value = fR.nombre; $("nr-ini").value = fR.inicio.slice(0, 5); $("nr-fin").value = fR.fin.slice(0, 5);
  $("nr-del").hidden = !edR; $("nr-msg").textContent = "";
  pintarFormR(); $("n-velo-r").hidden = false;
  if (!edR) setTimeout(() => $("nr-nom").focus(), 50);
}
function pintarFormR() {
  $("nr-ico").innerHTML = ICONOS.map(i => `<button type="button" data-i="${i}" aria-pressed="${fR.icono === i}">${i}</button>`).join("");
  $("nr-col").innerHTML = COLORES.map(c => `<button type="button" data-c="${c}" style="--c:${c}" aria-pressed="${fR.color === c}" aria-label="Color ${c}"></button>`).join("");
  $("nr-col").style.setProperty("--c", fR.color); $("nr-ico").style.setProperty("--c", fR.color);
  $("nr-dias").innerHTML = DIAS.map((l, i) => `<button type="button" class="chip" data-d="${i + 1}" aria-pressed="${fR.dias.includes(i + 1)}">${l}</button>`).join("");
  $("nr-gana").innerHTML = [0, 1, 2, 3].map(n => `<button type="button" class="chip" data-g="${n}" aria-pressed="${fR.gana === n}">${n ? "+" + n : "0"}</button>`).join("");
  $("nr-pierde").innerHTML = [0, 1, 2, 3].map(n => `<button type="button" class="chip" data-p="${n}" aria-pressed="${fR.pierde === n}">${n ? "−" + n : "0"}</button>`).join("");
  $("nr-aviso").innerHTML = [[null, "Sin aviso"], [1, "1 min"], [3, "3 min"], [5, "5 min"], [10, "10 min"]].map(([n, l]) => `<button type="button" class="chip" data-a="${n}" aria-pressed="${fR.aviso_min === n}">${l}</button>`).join("");
}
async function guardarRutina(e) {
  e.preventDefault();
  const f = { nombre: $("nr-nom").value.trim(), icono: fR.icono, color: fR.color, inicio: $("nr-ini").value, fin: $("nr-fin").value, dias: fR.dias.slice().sort(), gana: fR.gana, pierde: fR.pierde, aviso_min: fR.aviso_min };
  const msg = t => { $("nr-msg").textContent = t; $("nr-msg").className = "toast full e" };
  if (!f.nombre) return msg("Ponle un nombre, por ejemplo «Desayunar».");
  if (!f.inicio || !f.fin || f.fin <= f.inicio) return msg("La hora de acabar tiene que ser después de la de empezar.");
  if (!f.dias.length) return msg("Elige al menos un día.");
  try {
    if (edR) Object.assign(edR, await store.noraUpd("nora_rutinas", edR.id, f));
    else N.rutinas.push(await store.noraAdd("nora_rutinas", { peque: PEQUE, activa: true, ...f }));
    $("n-velo-r").hidden = true; pintar();
  } catch (err) { msg("No se ha podido guardar: " + (err.message || err)) }
}
// quitar una rutina la desactiva: así no se pierden las estrellas que ya ganó con ella
async function quitarRutina() {
  const b = $("nr-del");
  if (!b.dataset.ok) { b.dataset.ok = 1; b.textContent = "Toca otra vez para quitarla"; setTimeout(() => { delete b.dataset.ok; b.textContent = "Quitar esta rutina" }, 3000); return }
  delete b.dataset.ok; b.textContent = "Quitar esta rutina";
  try { Object.assign(edR, await store.noraUpd("nora_rutinas", edR.id, { activa: false })); $("n-velo-r").hidden = true; pintar() } catch (err) { $("nr-msg").textContent = "No se ha podido quitar" }
}

// formulario de premio
let edP = null, fP = {};
function abrirPremio(id) {
  edP = id ? N.premios.find(p => p.id === id) : null;
  fP = edP ? { ...edP } : { icono: "🎁" };
  $("npr-tit").textContent = edP ? "Cambiar premio" : "Nuevo premio";
  $("npr-nom").value = edP ? edP.nombre : ""; $("npr-cos").value = edP ? edP.coste : 10;
  $("npr-del").hidden = !edP; $("npr-msg").textContent = "";
  $("npr-ico").innerHTML = ICONOS_P.map(i => `<button type="button" data-i="${i}" aria-pressed="${fP.icono === i}">${i}</button>`).join("");
  $("n-velo-p").hidden = false;
}
async function guardarPremio(e) {
  e.preventDefault();
  const f = { nombre: $("npr-nom").value.trim(), icono: fP.icono, coste: Math.round(Number($("npr-cos").value)) };
  const msg = t => { $("npr-msg").textContent = t; $("npr-msg").className = "toast full e" };
  if (!f.nombre) return msg("Ponle un nombre, por ejemplo «Ir al parque».");
  if (!(f.coste > 0 && f.coste < 1000)) return msg("¿Cuántas estrellas cuesta? Pon un número, por ejemplo 20.");
  try {
    if (edP) Object.assign(edP, await store.noraUpd("nora_premios", edP.id, f));
    else N.premios.push(await store.noraAdd("nora_premios", { peque: PEQUE, ...f }));
    $("n-velo-p").hidden = true; pintar();
  } catch (err) { msg("No se ha podido guardar: " + (err.message || err)) }
}
async function canjear(id) {
  const p = N.premios.find(x => x.id === id);
  if (!p || saldo() < p.coste) return;
  try {
    N.canjes.push(await store.noraAdd("nora_canjes", { peque: PEQUE, premio_id: p.id, nombre: p.nombre, icono: p.icono, coste: p.coste }));
    celebrar(0, p.icono, `¡${p.nombre}!`); pintar();
  } catch (err) { pista("No se ha podido guardar") }
}

// ---------------- Pintar ----------------
function pintar() {
  const chip = $("n-abrir");
  if (chip) { chip.hidden = !N; if (N) { const { ahora } = actualYSiguiente(); chip.innerHTML = `<span>${ahora ? esc(ahora.icono) : "⭐"}</span>${PEQUE}<b>${saldo()}</b>` } }
  if (!N || !abierta) return;
  $("nora").dataset.modo = modo;
  $("n-nina").hidden = modo !== "nina"; $("n-papas-v").hidden = modo !== "papas";
  $("n-papas").setAttribute("aria-label", modo === "nina" ? "Para papá y mamá (mantén pulsado)" : `Volver a la pantalla de ${PEQUE}`);
  $("n-papas").innerHTML = modo === "nina" ? "⚙︎" : "‹";
  if (modo === "nina") pintarNina(); else pintarPapas();
}
function empezarReloj() {
  clearInterval(reloj);
  reloj = setInterval(() => {
    if (!abierta) return;
    const { ahora, luego } = actualYSiguiente(), k = (ahora ? "a" + ahora.id : "") + (luego ? "l" + luego.id : "");
    if (k !== actualKey) { actualKey = k; apuntarFallos() }
    if (modo === "nina") pintarNina();
  }, 1000);
}

// ---------------- Eventos ----------------
function enlazar() {
  $("n-abrir").addEventListener("click", () => abrir("nina"));
  mantener($("n-salir"), cerrar);
  // acceso directo a «Cómo va» de hoy desde la pantalla del reloj
  mantener($("n-comova"), () => { modo = "papas"; pTab = "hoy"; pDia = iso(new Date()); pintar(); $("nora").scrollTop = 0 });
  mantener($("n-papas"), () => { modo = modo === "nina" ? "papas" : "nina"; if (modo === "nina") mantenerPantalla(); pintar(); $("nora").scrollTop = 0 });
  $("n-hecho").addEventListener("click", hecho);
  $("n-fiesta").addEventListener("click", () => { $("n-fiesta").hidden = true });
  $("n-ptabs").addEventListener("click", e => { const b = e.target.closest("button"); if (b) { pTab = b.dataset.p; pintar() } });
  $("np-ant").addEventListener("click", () => { const d = diaDe(pDia); pDia = iso(new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1)); pintar() });
  $("np-sig").addEventListener("click", () => { const d = diaDe(pDia); pDia = iso(new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)); pintar() });
  $("np-sem").addEventListener("click", e => { const b = e.target.closest("[data-f]"); if (b) { pDia = b.dataset.f; pintar() } });
  $("np-lista").addEventListener("click", e => { const b = e.target.closest("[data-e]"); if (b) marcar(b.dataset.r, b.dataset.e) });
  $("np-extra").addEventListener("click", e => {
    const b = e.target.closest("[data-n]"); if (!b) return;
    const n = Number(b.dataset.n), nota = $("np-extra-n").value.trim() || null;
    store.noraAdd("nora_registro", { peque: PEQUE, rutina_id: null, fecha: pDia, estado: "extra", estrellas: n, nota }).then(g => { N.registro.push(g); $("np-extra-n").value = ""; if (n > 0) celebrar(n, "⭐", nota || "¡Estrella extra!"); pintar() }).catch(() => pista("No se ha podido guardar"));
  });
  $("np-extras").addEventListener("click", e => { const b = e.target.closest("[data-x]"); if (b) store.noraDel("nora_registro", b.dataset.x).then(() => { N.registro = N.registro.filter(g => g.id !== b.dataset.x); pintar() }) });
  $("np-nueva").addEventListener("click", () => abrirRutina(null));
  $("np-rl").addEventListener("click", e => { const b = e.target.closest("[data-ed]"); if (b) abrirRutina(b.dataset.ed) });
  $("np-nuevo-p").addEventListener("click", () => abrirPremio(null));
  $("np-pl").addEventListener("click", e => { const c = e.target.closest("[data-canje]"), p = e.target.closest("[data-edp]"); if (c) canjear(c.dataset.canje); if (p) abrirPremio(p.dataset.edp) });
  $("np-canjes").addEventListener("click", e => { const b = e.target.closest("[data-xc]"); if (b) store.noraDel("nora_canjes", b.dataset.xc).then(() => { N.canjes = N.canjes.filter(c => c.id !== b.dataset.xc); pintar() }) });
  // formulario de rutina
  $("nr-form").addEventListener("submit", guardarRutina);
  $("nr-x").addEventListener("click", () => { $("n-velo-r").hidden = true });
  $("n-velo-r").addEventListener("click", e => { if (e.target === $("n-velo-r")) $("n-velo-r").hidden = true });
  $("nr-del").addEventListener("click", quitarRutina);
  $("nr-ico").addEventListener("click", e => { const b = e.target.closest("[data-i]"); if (b) { fR.icono = b.dataset.i; pintarFormR() } });
  $("nr-col").addEventListener("click", e => { const b = e.target.closest("[data-c]"); if (b) { fR.color = b.dataset.c; pintarFormR() } });
  $("nr-dias").addEventListener("click", e => { const b = e.target.closest("[data-d]"); if (!b) return; const d = Number(b.dataset.d); fR.dias = fR.dias.includes(d) ? fR.dias.filter(x => x !== d) : [...fR.dias, d]; pintarFormR() });
  $("nr-atajos").addEventListener("click", e => { const b = e.target.closest("[data-s]"); if (b) { fR.dias = b.dataset.s.split("").map(Number); pintarFormR() } });
  $("nr-gana").addEventListener("click", e => { const b = e.target.closest("[data-g]"); if (b) { fR.gana = Number(b.dataset.g); pintarFormR() } });
  $("nr-pierde").addEventListener("click", e => { const b = e.target.closest("[data-p]"); if (b) { fR.pierde = Number(b.dataset.p); pintarFormR() } });
  $("nr-aviso").addEventListener("click", e => { const b = e.target.closest("[data-a]"); if (b) { fR.aviso_min = b.dataset.a === "null" ? null : Number(b.dataset.a); pintarFormR() } });
  // formulario de premio
  $("npr-form").addEventListener("submit", guardarPremio);
  $("npr-x").addEventListener("click", () => { $("n-velo-p").hidden = true });
  $("n-velo-p").addEventListener("click", e => { if (e.target === $("n-velo-p")) $("n-velo-p").hidden = true });
  $("npr-ico").addEventListener("click", e => { const b = e.target.closest("[data-i]"); if (!b) return; fP.icono = b.dataset.i; document.querySelectorAll("#npr-ico button").forEach(x => x.setAttribute("aria-pressed", x === b)) });
  $("npr-del").addEventListener("click", async () => {
    const b = $("npr-del");
    if (!b.dataset.ok) { b.dataset.ok = 1; b.textContent = "Toca otra vez para borrarlo"; setTimeout(() => { delete b.dataset.ok; b.textContent = "Borrar premio" }, 3000); return }
    try { await store.noraDel("nora_premios", edP.id); N.premios = N.premios.filter(p => p !== edP); $("n-velo-p").hidden = true; pintar() } catch (err) { $("npr-msg").textContent = "No se ha podido borrar" }
  });
}

let enlazado = false;
window.nora = {
  // datos = { rutinas, registro, premios, canjes }, o null si las tablas aún no existen en Supabase
  datos(d) { N = d ? { rutinas: d.rutinas || [], registro: d.registro || [], premios: d.premios || [], canjes: d.canjes || [] } : null; if (!N && abierta) cerrar() },
  arrancar(s) {
    store = s;
    if (!enlazado) { enlazado = true; enlazar() }
    apuntarFallos();
    let antes = false; try { antes = localStorage.getItem("nora-abierta") === "1" } catch (e) { }
    if (N && (location.hash === "#nora" || antes)) abrir("nina"); else pintar();
  },
  pintar
};
})();
