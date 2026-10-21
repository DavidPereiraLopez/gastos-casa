// Tema y color principal de este dispositivo (Más > Apariencia). Se carga en <head> para que la app no parpadee al abrir.
(function () {
  const KEY = "gastos-tema";
  // color principal: [modo claro, modo oscuro]; el verde es el de siempre y lo pone styles.css
  const COLORES = {
    verde: ["#1f7a55", "#5cc394"], azul: ["#2160c4", "#6aa3f0"], morado: ["#6a4bc9", "#a593f0"], rosa: ["#c2306f", "#ee82b0"],
    naranja: ["#b85410", "#f0965a"], rojo: ["#bf2f2e", "#f07a78"], turquesa: ["#0f7c86", "#4fc3cc"], grafito: ["#3f4a44", "#b8c4bd"]
  };
  const leer = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {} } catch (e) { return {} } };
  const oscuroSistema = matchMedia("(prefers-color-scheme: dark)");
  const hex = n => "#" + n.map(v => Math.round(v).toString(16).padStart(2, "0")).join("");
  const rgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  const mezcla = (a, b, p) => { const x = rgb(a), y = rgb(b); return hex(x.map((v, i) => v * p + y[i] * (1 - p))) };
  const luz = h => { const [r, g, b] = rgb(h).map(v => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4 }); return .2126 * r + .7152 * g + .0722 * b };
  function aplicar() {
    const t = leer(), raiz = document.documentElement, oscuro = t.modo === "oscuro" || (t.modo !== "claro" && oscuroSistema.matches);
    if (t.modo === "claro" || t.modo === "oscuro") raiz.dataset.theme = t.modo === "claro" ? "light" : "dark"; else delete raiz.dataset.theme;
    const par = COLORES[t.color] || (/^#[0-9a-f]{6}$/i.test(t.color || "") ? [t.color, mezcla(t.color, "#ffffff", .7)] : null);
    ["--accent", "--accent-ink", "--soft"].forEach(v => raiz.style.removeProperty(v));
    let acento = oscuro ? "#5cc394" : "#1f7a55";
    if (par && t.color !== "verde") {
      acento = par[oscuro ? 1 : 0];
      raiz.style.setProperty("--accent", acento);
      raiz.style.setProperty("--accent-ink", luz(acento) > .3 ? "#111111" : "#ffffff");
      raiz.style.setProperty("--soft", mezcla(acento, oscuro ? "#19201c" : "#ffffff", oscuro ? .18 : .12));
    }
    const meta = document.querySelector('meta[name="theme-color"]'); if (meta) meta.content = oscuro ? "#0f1411" : acento;
  }
  function guardar(cambio) { try { localStorage.setItem(KEY, JSON.stringify(Object.assign(leer(), cambio))) } catch (e) { } aplicar() }
  oscuroSistema.addEventListener("change", aplicar);
  window.tema = { COLORES, leer, guardar };
  aplicar();
})();
