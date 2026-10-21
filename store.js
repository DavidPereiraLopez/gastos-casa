// Almacén de datos. Dos versiones con la misma interfaz:
//  - Supabase: la de verdad, compartida entre los miembros del hogar (cuando config.js tiene los datos del proyecto).
//  - Demo: datos de ejemplo en este navegador, para probar la app sin configurar nada.
(function () {
  const iso = d => { const z = new Date(d.getTime() - d.getTimezoneOffset() * 6e4); return z.toISOString().slice(0, 10) };
  const GRUPOS0 = [
    { g: "CASA", cats: ["Supermercado", "Luz y gas", "Agua", "Internet y móvil", "Alquiler o hipoteca", "Mantenimiento"] },
    { g: "NIÑAS", cats: ["Colegio", "Extraescolares", "Ropa", "Médico"] },
    { g: "TRANSPORTE", cats: ["Gasolina", "Transporte público", "Coche"] },
    { g: "OCIO", cats: ["Comer fuera", "Suscripciones", "Vacaciones"] },
    { g: "SALUD", cats: ["Farmacia", "Médico"] },
    { g: "OTROS", cats: ["Otros"] }];

  // ---------------- Supabase ----------------
  function supabaseStore(cfg) {
    const sb = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey);
    let canal = null;
    const ok = r => { if (r.error) throw r.error; return r.data };
    return {
      demo: false,
      onAuth: fn => sb.auth.onAuthStateChange((ev) => { if (["SIGNED_IN", "SIGNED_OUT", "INITIAL_SESSION"].includes(ev)) fn() }),
      session: async () => (await sb.auth.getSession()).data.session,
      signIn: (email, password) => sb.auth.signInWithPassword({ email, password }),
      signUp: (email, password) => sb.auth.signUp({ email, password, options: { emailRedirectTo: location.href.split("#")[0] } }),
      signOut: () => sb.auth.signOut(),
      miMiembro: async uid => ok(await sb.from("miembros").select("*").eq("user_id", uid).maybeSingle()),
      crearHogar: async nombre => ok(await sb.rpc("crear_hogar", { p_nombre_persona: nombre })),
      unirse: async (codigo, nombre) => ok(await sb.rpc("unirse_hogar", { p_codigo: codigo, p_nombre_persona: nombre })),
      cargar: async () => {
        const desde = iso(new Date(new Date().getFullYear() - 2, 0, 1)); // este año y los dos anteriores
        const [h, ms, gs, ts, rs, es, tas] = await Promise.all([
          sb.from("hogares").select("*").single(),
          sb.from("miembros").select("*").order("creado"),
          sb.from("gastos").select("*").gte("fecha", desde).order("fecha", { ascending: false }).limit(20000),
          sb.from("tickets").select("*").order("fecha_compra", { ascending: false }),
          sb.from("recurrentes").select("*").order("dia"),
          sb.from("eventos").select("*").order("fecha"),
          sb.from("tareas").select("*").order("orden")]);
        // si las tablas del calendario o del tablero aún no existen, la app sigue funcionando sin ellos
        return { hogar: ok(h), miembros: ok(ms), gastos: ok(gs), tickets: ok(ts), recurrentes: ok(rs), eventos: es.error ? [] : es.data, tareas: tas.error ? [] : tas.data };
      },
      addGastos: async filas => ok(await sb.from("gastos").insert(filas).select()),
      // gastos fijos: el índice único (recurrente_id, periodo) evita duplicados si los dos móviles lo intentan a la vez
      addGastosFijos: async filas => ok(await sb.from("gastos").upsert(filas, { onConflict: "recurrente_id,periodo", ignoreDuplicates: true }).select()),
      updGasto: async (id, c) => ok(await sb.from("gastos").update(c).eq("id", id).select().single()),
      delGasto: async id => ok(await sb.from("gastos").delete().eq("id", id)),
      updHogar: async (id, c) => ok(await sb.from("hogares").update(c).eq("id", id)),
      updMiembro: async (uid, c) => ok(await sb.from("miembros").update(c).eq("user_id", uid)),
      addRecurrente: async f => ok(await sb.from("recurrentes").insert(f).select().single()),
      delRecurrente: async id => ok(await sb.from("recurrentes").delete().eq("id", id)),
      addTicket: async (fila, file, hogarId) => {
        if (file) {
          const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
          const ruta = `${hogarId}/${crypto.randomUUID()}.${ext}`;
          ok(await sb.storage.from("tickets").upload(ruta, file, { contentType: file.type || undefined }));
          fila.archivo = ruta;
        }
        return ok(await sb.from("tickets").insert(fila).select().single());
      },
      delTicket: async t => { if (t.archivo) await sb.storage.from("tickets").remove([t.archivo]); ok(await sb.from("tickets").delete().eq("id", t.id)) },
      urlTicket: async t => ok(await sb.storage.from("tickets").createSignedUrl(t.archivo, 300)).signedUrl, // enlace de 5 minutos
      addEvento: async f => ok(await sb.from("eventos").insert(f).select().single()),
      updEvento: async (id, c) => ok(await sb.from("eventos").update(c).eq("id", id).select().single()),
      delEvento: async id => ok(await sb.from("eventos").delete().eq("id", id)),
      // días cambiados aparte de una serie, desde una fecha (al cortar la serie en "este y los siguientes")
      delCopiasDesde: async (serieId, desde) => ok(await sb.from("eventos").delete().eq("serie_id", serieId).gte("fecha", desde)),
      addTarea: async f => ok(await sb.from("tareas").insert(f).select().single()),
      updTarea: async (id, c) => ok(await sb.from("tareas").update(c).eq("id", id).select().single()),
      delTareas: async ids => ok(await sb.from("tareas").delete().in("id", ids)),
      // notificaciones push: cada móvil guarda su suscripción, ligada al usuario
      guardarPush: async (sus, uid) => { const j = sus.toJSON(); ok(await sb.from("push_suscripciones").upsert({ endpoint: j.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth, user_id: uid }, { onConflict: "endpoint" })) },
      borrarPush: async endpoint => ok(await sb.from("push_suscripciones").delete().eq("endpoint", endpoint)),
      escuchar: (hogarId, fn) => {
        if (canal) return;
        let t = null; const avisar = () => { clearTimeout(t); t = setTimeout(fn, 400) };
        canal = sb.channel("hogar-" + hogarId);
        ["gastos", "tickets", "recurrentes", "eventos", "tareas"].forEach(table => canal.on("postgres_changes", { event: "*", schema: "public", table, filter: "hogar_id=eq." + hogarId }, avisar));
        canal.subscribe();
      },
      dejarDeEscuchar: () => { if (canal) { sb.removeChannel(canal); canal = null } }
    };
  }

  // ---------------- Demo (solo este navegador) ----------------
  function demoStore() {
    const KEY = "gastos-casa-demo-v3";
    const uid = () => (crypto.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2));
    const today = new Date();
    function semilla() {
      const H = "demo-hogar";
      const hogar = { id: H, nombre: "Casa", codigo_invitacion: "DEMO1234", grupos: GRUPOS0, cuentas: ["Cuenta común", "Cuenta de David", "Cuenta de Pareja"],
        presupuestos: { CASA: 650, NIÑAS: 300, TRANSPORTE: 150, OCIO: 120, SALUD: 60, OTROS: 50 } };
      const miembros = [{ user_id: "u-david", hogar_id: H, nombre: "David", cuenta_def: "Cuenta de David", pago_def: "Tarjeta" },
                        { user_id: "u-pareja", hogar_id: H, nombre: "Pareja", cuenta_def: "Cuenta de Pareja", pago_def: "Tarjeta" }];
      const recurrentes = [
        { id: uid(), nombre: "Alquiler", importe: 850, grupo: "CASA", categoria: "Alquiler o hipoteca", dia: 1, quien: "David", forma_pago: "Domiciliación", cuenta: "Cuenta común", activo: true },
        { id: uid(), nombre: "Comedor escolar", importe: 120, grupo: "NIÑAS", categoria: "Colegio", dia: 5, quien: "Pareja", forma_pago: "Domiciliación", cuenta: "Cuenta común", activo: true },
        { id: uid(), nombre: "Fibra y móviles", importe: 55, grupo: "CASA", categoria: "Internet y móvil", dia: 20, quien: "David", forma_pago: "Domiciliación", cuenta: "Cuenta común", activo: true },
        { id: uid(), nombre: "Netflix", importe: 13.99, grupo: "OCIO", categoria: "Suscripciones", dia: 25, quien: "David", forma_pago: "Tarjeta", cuenta: "Cuenta de David", activo: true }];
      const BASE = [[2, "CASA", "Supermercado", "Mercadona", "David", "Tarjeta", "Cuenta común", 54.3], [3, "OCIO", "Comer fuera", "Cafetería", "Pareja", "Bizum", "Cuenta de Pareja", 12.5],
        [4, "CASA", "Luz y gas", "Endesa", "David", "Domiciliación", "Cuenta común", 68.9], [6, "TRANSPORTE", "Gasolina", "Repsol", "David", "Tarjeta", "Cuenta de David", 40],
        [8, "NIÑAS", "Extraescolares", "Academia de danza", "David", "Transferencia", "Cuenta de David", 45], [9, "CASA", "Supermercado", "Lidl", "Pareja", "Tarjeta", "Cuenta de Pareja", 31.75],
        [11, "SALUD", "Farmacia", "Farmacia", "Pareja", "Efectivo", "", 8.4], [14, "CASA", "Supermercado", "Mercadona", "Pareja", "Tarjeta", "Cuenta común", 88.2],
        [17, "NIÑAS", "Ropa", "Zara Kids", "Pareja", "Tarjeta", "Cuenta de Pareja", 39.9], [21, "OCIO", "Comer fuera", "Restaurante", "David", "Tarjeta", "Cuenta común", 46],
        [23, "TRANSPORTE", "Gasolina", "Cepsa", "Pareja", "Tarjeta", "Cuenta de Pareja", 45], [27, "CASA", "Supermercado", "Carrefour", "David", "Tarjeta", "Cuenta común", 72.6]];
      const gastos = [];
      for (let m = 0; m < 22; m++) {
        const ipc = m >= 12 ? 0.92 : 1;
        BASE.forEach(([d, g, c, n, q, p, cu, i], k) => {
          const f = new Date(today.getFullYear(), today.getMonth() - m, d); if (f > today) return;
          gastos.push({ id: uid(), fecha: iso(f), importe: Math.round(i * ipc * (1 + ((k * 7 + m * 3) % 5 - 2) / 20) * 100) / 100, grupo: g, categoria: c, nota: n, quien: q, forma_pago: p, cuenta: cu || null });
        });
        recurrentes.forEach(r => {
          const f = new Date(today.getFullYear(), today.getMonth() - m, r.dia); if (f > today) return;
          const periodo = iso(f).slice(0, 7);
          gastos.push({ id: uid(), fecha: iso(f), importe: Math.round(r.importe * ipc * 100) / 100, grupo: r.grupo, categoria: r.categoria, nota: r.nombre, quien: r.quien, forma_pago: r.forma_pago, cuenta: r.cuenta, recurrente_id: r.id, periodo });
        });
      }
      const yAgo = (y, m) => iso(new Date(today.getFullYear() - y, today.getMonth() - m, 10));
      const tickets = [{ id: uid(), producto: "Lavadora Bosch Serie 4", tienda: "MediaMarkt", fecha_compra: yAgo(2, 10), anos_garantia: 3, importe: 449, archivo: null },
        { id: uid(), producto: "Portátil Lenovo IdeaPad", tienda: "El Corte Inglés", fecha_compra: yAgo(1, 2), anos_garantia: 3, importe: 699, archivo: null },
        { id: uid(), producto: "Cafetera Krups", tienda: "Amazon", fecha_compra: yAgo(3, 6), anos_garantia: 3, importe: 89.9, archivo: null }];
      return { hogar, miembros, gastos, tickets, recurrentes, eventos: eventosDemo(), tareas: tareasDemo() };
    }
    function tareasDemo() {
      const d = n => iso(new Date(today.getFullYear(), today.getMonth(), today.getDate() + n));
      const ta = (orden, f) => ({ id: uid(), nota: null, quien: null, fecha_limite: null, hecho: null, repetir: "no", cada: 1, hasta: null, orden, ...f });
      return [ta(1, { titulo: "Pedir cita ITV del coche", columna: "pendiente", quien: "David", fecha_limite: d(10) }),
        ta(2, { titulo: "Comprar disfraces de Halloween", columna: "pendiente", quien: "Pareja", fecha_limite: d(-1) }),
        ta(3, { titulo: "Mirar campamento de verano", columna: "pendiente", quien: "Los dos", nota: "Comparar precios con el del año pasado" }),
        ta(1, { titulo: "Cambiar tarifa de la luz", columna: "haciendo", quien: "David", nota: "Pedir oferta a 2 compañías" }),
        ta(2, { titulo: "Ordenar el trastero", columna: "haciendo", quien: "Los dos" }),
        ta(4, { titulo: "Revisar el saldo de la cuenta común", columna: "pendiente", quien: "David", fecha_limite: d(3), repetir: "mensual", cada: 1 }),
        ta(1, { titulo: "Renovar DNI de las niñas", columna: "hecho", quien: "Pareja", hecho: new Date().toISOString() })];
    }
    function eventosDemo() {
      const d = n => iso(new Date(today.getFullYear(), today.getMonth(), today.getDate() + n));
      const lunes = new Date(today); lunes.setDate(today.getDate() - (today.getDay() + 6) % 7);
      const ev = f => ({ id: uid(), hora_ini: null, hora_fin: null, nota: null, repetir: "no", cada: 1, dias_semana: [], hasta: null, excepciones: [], serie_id: null, ...f });
      return [ev({ titulo: "Llevar a las niñas al cole", fecha: iso(lunes), hora_ini: "08:45", quien: "David", repetir: "semanal", dias_semana: [1, 3, 5], hasta: d(60) }),
        ev({ titulo: "Recoger a las niñas", fecha: iso(lunes), hora_ini: "16:30", quien: "Pareja", repetir: "semanal", dias_semana: [1, 2, 3, 4, 5], hasta: d(60) }),
        ev({ titulo: "Danza", fecha: iso(lunes), hora_ini: "17:30", hora_fin: "18:30", quien: "Los dos", repetir: "semanal", dias_semana: [2, 4], hasta: d(90) }),
        ev({ titulo: "Sacar la basura", fecha: d(0), hora_ini: "21:00", quien: "David", repetir: "diario", hasta: d(30) }),
        ev({ titulo: "Pagar comunidad", fecha: d(-today.getDate() + 5), quien: "Pareja", repetir: "mensual", hasta: d(365) }),
        ev({ titulo: "Dentista", fecha: d(3), hora_ini: "10:00", hora_fin: "10:30", quien: "Pareja", nota: "Clínica Sonrisas" })];
    }
    let db;
    try { db = JSON.parse(localStorage.getItem(KEY)) } catch (e) { }
    if (!db || !db.hogar) db = semilla();
    if (!db.eventos) db.eventos = eventosDemo();
    if (!db.tareas) db.tareas = tareasDemo();
    const save = () => { try { localStorage.setItem(KEY, JSON.stringify(db)) } catch (e) { } };
    const archivos = {}; // fotos de tickets de la demo: solo mientras la página está abierta
    const clone = x => JSON.parse(JSON.stringify(x));
    return {
      demo: true,
      onAuth: fn => setTimeout(fn, 0),
      session: async () => ({ user: { id: "u-david" } }),
      signIn: async () => ({}), signUp: async () => ({}), signOut: async () => { localStorage.removeItem(KEY); location.reload() },
      miMiembro: async () => db.miembros[0],
      crearHogar: async () => { }, unirse: async () => { },
      cargar: async () => clone(db),
      addGastos: async filas => { const out = filas.map(f => ({ id: uid(), ...f })); db.gastos.push(...out); save(); return clone(out) },
      addGastosFijos: async filas => {
        const out = filas.filter(f => !db.gastos.some(g => g.recurrente_id === f.recurrente_id && g.periodo === f.periodo)).map(f => ({ id: uid(), ...f }));
        db.gastos.push(...out); save(); return clone(out)
      },
      updGasto: async (id, c) => { const g = db.gastos.find(x => x.id === id); Object.assign(g, c); save(); return clone(g) },
      delGasto: async id => { db.gastos = db.gastos.filter(g => g.id !== id); save() },
      updHogar: async (id, c) => { Object.assign(db.hogar, c); save() },
      updMiembro: async (u, c) => { Object.assign(db.miembros.find(m => m.user_id === u), c); save() },
      addRecurrente: async f => { const r = { id: uid(), activo: true, ...f }; db.recurrentes.push(r); save(); return clone(r) },
      delRecurrente: async id => { db.recurrentes = db.recurrentes.filter(r => r.id !== id); save() },
      addTicket: async (fila, file) => { const t = { id: uid(), ...fila }; if (file) { t.archivo = "demo/" + t.id + (file.type === "application/pdf" ? ".pdf" : ".jpg"); archivos[t.archivo] = URL.createObjectURL(file) } db.tickets.push(t); save(); return clone(t) },
      delTicket: async t => { db.tickets = db.tickets.filter(x => x.id !== t.id); save() },
      addEvento: async f => { const e = { id: uid(), repetir: "no", cada: 1, dias_semana: [], excepciones: [], serie_id: null, ...f }; db.eventos.push(e); save(); return clone(e) },
      updEvento: async (id, c) => { const e = db.eventos.find(x => x.id === id); Object.assign(e, c); save(); return clone(e) },
      delEvento: async id => { db.eventos = db.eventos.filter(x => x.id !== id && x.serie_id !== id); save() },
      delCopiasDesde: async (serieId, desde) => { db.eventos = db.eventos.filter(x => !(x.serie_id === serieId && x.fecha >= desde)); save() },
      addTarea: async f => { const t = { id: uid(), columna: "pendiente", orden: 0, hecho: null, ...f }; db.tareas.push(t); save(); return clone(t) },
      updTarea: async (id, c) => { const t = db.tareas.find(x => x.id === id); Object.assign(t, c); save(); return clone(t) },
      delTareas: async ids => { db.tareas = db.tareas.filter(x => !ids.includes(x.id)); save() },
      urlTicket: async t => { if (!archivos[t.archivo]) throw new Error("En la demo las fotos solo se ven mientras la página está abierta."); return archivos[t.archivo] },
      guardarPush: async () => { }, borrarPush: async () => { },
      escuchar: () => { }, dejarDeEscuchar: () => { }
    };
  }

  const cfg = window.GASTOS_CONFIG || {};
  const configurado = cfg.supabaseUrl && !/TU-PROYECTO/.test(cfg.supabaseUrl) && window.supabase;
  window.store = configurado ? supabaseStore(cfg) : demoStore();
})();
