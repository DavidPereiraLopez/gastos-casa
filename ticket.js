// Leer un ticket con la cámara: la foto se lee en el propio móvil con Tesseract.js (gratis, la foto no se manda a nadie para leerla).
// La primera vez descarga el lector y el idioma español (unos 4 MB); después se queda guardado en el navegador.
(function () {
  const TIENDAS = ["Mercadona", "Carrefour", "Lidl", "Aldi", "Eroski", "Alcampo", "Consum", "Ahorramas", "Hipercor", "El Corte Inglés", "Supercor",
    "Bonpreu", "Caprabo", "Gadis", "Froiz", "Covirán", "BM Supermercados", "Spar", "Condis", "Primaprix", "Family Cash", "Mas y Mas", "Masymas",
    "Leroy Merlin", "Bricomart", "Ikea", "Decathlon", "MediaMarkt", "Media Markt", "Worten", "PcComponentes", "Fnac", "Primark", "Zara", "Kiabi",
    "Action", "Tiger", "Druni", "Primor", "Repsol", "Cepsa", "Galp", "Shell", "Ballenoil", "Plenoil", "Petroprix", "Telepizza", "McDonald's",
    "Burger King", "KFC", "Foster's Hollywood", "Rodilla", "Starbucks", "Glovo", "Amazon", "Farmacia", "Día"];
  const sinTilde = s => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const num = s => { s = s.replace(/\s/g, ""); const dec = s.slice(-3); return parseFloat(s.slice(0, -3).replace(/[.,]/g, "") + "." + dec.slice(1)) };
  // importes con dos decimales: 23,45 · 1.234,50 · 23.45 · 23, 45 (el lector a veces mete un espacio)
  const RE_IMP = /(?<![\d.,])(\d{1,3}(?:[.\s]\d{3})*|\d{1,5})\s?[,.]\s?(\d{2})(?![\d%])/g;
  const importes = l => [...l.matchAll(RE_IMP)].map(m => num(m[1] + "," + m[2])).filter(v => v > 0 && v < 100000);

  // Devuelve { importe, fecha ('AAAA-MM-DD'), tienda } con lo que se haya podido leer (lo que no, queda null)
  function analizarTicket(texto, hoy = new Date()) {
    const lineas = String(texto).split(/\r?\n/).map(l => l.replace(/[|_]+/g, " ").replace(/\s+/g, " ").trim()).filter(Boolean);
    const llano = lineas.map(sinTilde);

    // Importe: la línea del total manda; luego la del pago con tarjeta o efectivo; si no, el importe más alto del ticket
    const NO = /sub ?total|base|cuota|cambio|devol|descuento|dto|ahorr|entregado|puntos/;
    let mejor = null;
    llano.forEach((l, i) => {
      const peso = /total|a pagar|importe/.test(l) ? 3 : /tarjeta|visa|mastercard|efectivo|contactless|pago/.test(l) ? 2 : 0;
      if (!peso || NO.test(l)) return;
      // si el importe no está en la misma línea, el lector lo suele poner en la siguiente
      let vs = importes(lineas[i]); if (!vs.length && lineas[i + 1]) vs = importes(lineas[i + 1]);
      if (!vs.length) return;
      const v = vs[vs.length - 1];
      if (!mejor || peso > mejor.peso || (peso === mejor.peso && v > mejor.v)) mejor = { peso, v };
    });
    let importe = mejor ? mejor.v : null;
    if (importe == null) { const todos = llano.flatMap((l, i) => /tel|nif|cif|n\.?i\.?f|c\.?i\.?f|fecha|hora/.test(l) ? [] : importes(lineas[i])); if (todos.length) importe = Math.max(...todos) }

    // Fecha: la primera dd/mm/aa(aa) que tenga sentido (no en el futuro ni de hace más de un año)
    let fecha = null;
    const hoyIso = new Date(hoy.getTime() - hoy.getTimezoneOffset() * 6e4).toISOString().slice(0, 10);
    for (const m of lineas.join(" ").matchAll(/(?<!\d)(\d{1,2})\s?[\/\-.]\s?(\d{1,2})\s?[\/\-.]\s?(\d{4}|\d{2})(?!\d)/g)) {
      let [d, mes, a] = [+m[1], +m[2], +m[3]]; if (a < 100) a += 2000;
      const f = new Date(a, mes - 1, d);
      if (f.getMonth() !== mes - 1 || f.getDate() !== d) continue;
      const s = `${a}-${String(mes).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      if (s <= hoyIso && (hoy - f) / 864e5 < 400) { fecha = s; break }
    }

    // Tienda: una conocida si aparece; si no, la primera línea de arriba que parezca un nombre
    const todo = " " + llano.join(" ") + " ";
    let tienda = TIENDAS.find(t => new RegExp("[^a-z]" + sinTilde(t).replace(/[.'*+?^${}()|[\]\\]/g, "\\$&").replace(/ /g, "\\s?") + "[^a-z]").test(todo)) || null;
    if (tienda === "Media Markt") tienda = "MediaMarkt";
    if (tienda === "Masymas") tienda = "Mas y Mas";
    if (!tienda) {
      const l = lineas.slice(0, 6).find((l, i) => { const p = llano[i]; return (p.match(/[a-zñ]/g) || []).length >= 4 && !/nif|cif|tel|www|http|calle|c\/|avda|s\.?l\.?$|s\.?a\.?$|factura|ticket|fecha/.test(p) && !/\d{3}/.test(p) });
      if (l) tienda = l.replace(/[^\p{L}\p{N} &'.-]/gu, "").trim().toLowerCase().replace(/(^|\s)\p{L}/gu, c => c.toUpperCase()).slice(0, 30) || null;
    }
    return { importe, fecha, tienda };
  }

  // Reduce la foto para que pese poco al subirla (y se lea igual de bien)
  async function reducirFoto(file, lado = 2000) {
    const img = await new Promise((ok, mal) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => mal(new Error("No se ha podido abrir la foto.")); i.src = URL.createObjectURL(file) });
    const k = Math.min(1, lado / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement("canvas"); c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
    c.getContext("2d").drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(img.src);
    return new Promise(ok => c.toBlob(ok, "image/jpeg", .82));
  }

  let lector = null, avance = () => { }; // el lector se prepara la primera vez y se reutiliza
  const cargarScript = src => new Promise((ok, mal) => { const s = document.createElement("script"); s.src = src; s.onload = ok; s.onerror = () => mal(new Error("No se ha podido descargar el lector de tickets. Revisa la conexión.")); document.head.appendChild(s) });
  async function leerFoto(blob, progreso = () => { }) {
    if (!lector) lector = (async () => {
      if (!window.Tesseract) await cargarScript("https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js");
      return Tesseract.createWorker("spa", 1, { logger: m => { if (m.status === "recognizing text") avance(m.progress) } });
    })().catch(e => { lector = null; throw e });
    avance = progreso;
    const w = await lector;
    const { data } = await w.recognize(blob);
    return data.text;
  }

  const api = { analizarTicket, reducirFoto, leerFoto };
  if (typeof module !== "undefined") module.exports = api; else window.ticket = api;
})();
