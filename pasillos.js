// Lista de la compra: secciones del súper y diccionario de productos habituales en España.
// Sirve para dos cosas: colocar cada cosa en su sección y sugerir nombres mientras se escribe.
(function () {
  // en el orden en que se suele recorrer el súper
  const SECCIONES = [
    ["fruteria", "Frutería", "🍎"], ["panaderia", "Panadería", "🥖"], ["carniceria", "Carnicería", "🥩"],
    ["charcuteria", "Charcutería y quesos", "🧀"], ["pescaderia", "Pescadería", "🐟"], ["lacteos", "Lácteos y huevos", "🥛"],
    ["despensa", "Despensa", "🥫"], ["desayuno", "Desayuno y dulces", "☕"], ["congelados", "Congelados", "🧊"],
    ["bebidas", "Bebidas", "🧃"], ["limpieza", "Limpieza y hogar", "🧽"], ["higiene", "Higiene y perfumería", "🧴"],
    ["bebe", "Bebé", "🍼"], ["mascotas", "Mascotas", "🐾"], ["otros", "Otros", "🛒"]];

  const DIC = {
    fruteria: "Manzanas, Peras, Plátanos, Naranjas, Mandarinas, Limones, Limas, Uvas, Fresas, Frambuesas, Arándanos, Moras, Cerezas, Melocotones, Nectarinas, Albaricoques, Ciruelas, Kiwis, Piña, Mango, Papaya, Melón, Sandía, Higos, Granada, Caquis, Chirimoya, Aguacates, Coco, Tomates, Tomates cherry, Lechuga, Lechuga iceberg, Rúcula, Canónigos, Espinacas, Brotes, Ensalada en bolsa, Cebollas, Cebolletas, Ajos, Puerros, Zanahorias, Patatas, Boniatos, Calabacines, Berenjenas, Pimientos, Pimientos rojos, Pimientos verdes, Pepinos, Calabaza, Brócoli, Coliflor, Repollo, Col lombarda, Coles de Bruselas, Acelgas, Judías verdes, Guisantes frescos, Alcachofas, Espárragos verdes, Champiñones, Setas, Apio, Rábanos, Remolacha, Maíz en mazorca, Jengibre, Perejil, Cilantro, Albahaca, Hierbabuena, Menestra fresca, Fruta",
    panaderia: "Pan, Barra de pan, Baguette, Pan de molde, Pan integral, Pan sin corteza, Pan rallado, Pan de hamburguesa, Pan de perritos, Picos, Regañás, Tostadas, Biscotes, Croissants, Napolitanas, Magdalenas, Bizcocho, Ensaimada, Tortillas de trigo, Pan de pita, Masa de pizza, Hojaldre, Masa quebrada, Empanadillas",
    carniceria: "Pollo, Pechugas de pollo, Muslos de pollo, Alitas de pollo, Contramuslos, Pollo entero, Filetes de pollo, Pavo, Pechuga de pavo, Ternera, Filetes de ternera, Carne picada, Hamburguesas, Albóndigas, Cerdo, Lomo, Lomo de cerdo, Chuletas, Costillas, Solomillo, Secreto ibérico, Presa ibérica, Panceta, Cordero, Conejo, Salchichas, Longaniza, Chistorra, Morcilla, Carne para guisar, Carrillada, Escalopes, Entrecot, Codillo, Butifarra",
    charcuteria: "Jamón serrano, Jamón ibérico, Jamón york, Jamón cocido, Pechuga de pavo en lonchas, Chorizo, Salchichón, Fuet, Lomo embuchado, Mortadela, Bacon, Beicon, Sobrasada, Paté, Queso, Queso curado, Queso semicurado, Queso fresco, Queso de Burgos, Queso en lonchas, Queso rallado, Queso de untar, Queso para pizza, Mozzarella, Parmesano, Queso de cabra, Queso azul, Queso manchego, Brie, Camembert, Requesón, Cecina",
    pescaderia: "Merluza, Salmón, Bacalao, Dorada, Lubina, Sardinas, Boquerones, Atún fresco, Bonito fresco, Rape, Lenguado, Gallo, Pescadilla, Caballa, Rodaballo, Emperador, Pez espada, Trucha, Gambas, Langostinos, Mejillones, Almejas, Berberechos, Navajas, Calamares, Sepia, Chipirones, Pulpo, Palitos de cangrejo, Surimi, Salmón ahumado, Anchoas, Pescado",
    lacteos: "Leche, Leche entera, Leche semidesnatada, Leche desnatada, Leche sin lactosa, Bebida de avena, Bebida de soja, Bebida de almendra, Yogures, Yogures naturales, Yogures griegos, Yogur bebible, Kéfir, Actimel, Natillas, Flan, Arroz con leche, Cuajada, Petit suisse, Danonino, Mantequilla, Margarina, Nata, Nata para cocinar, Nata para montar, Huevos, Docena de huevos, Batidos, Postres",
    despensa: "Arroz, Arroz integral, Arroz basmati, Pasta, Macarrones, Espaguetis, Tallarines, Fideos, Lasaña, Canelones, Ñoquis, Tortellini, Cuscús, Quinoa, Garbanzos, Lentejas, Alubias, Judías blancas, Harina, Levadura, Maicena, Aceite de oliva, Aceite de girasol, Vinagre, Sal, Pimienta, Pimentón, Orégano, Comino, Curry, Canela, Azafrán, Colorante, Especias, Caldo, Caldo de pollo, Pastillas de caldo, Tomate frito, Tomate triturado, Tomate natural, Atún, Atún en lata, Bonito en lata, Sardinas en lata, Berberechos en lata, Mejillones en escabeche, Aceitunas, Pepinillos, Maíz dulce, Guisantes en lata, Pimientos del piquillo, Espárragos, Garbanzos cocidos, Lentejas cocidas, Mayonesa, Ketchup, Mostaza, Salsa barbacoa, Salsa de soja, Alioli, Tomate de bote, Patatas fritas, Snacks, Frutos secos, Almendras, Nueces, Cacahuetes, Pipas, Pistachos, Avellanas, Pasas, Sopa, Puré de patatas, Pan tostado, Picatostes, Conservas, Legumbres",
    desayuno: "Café, Café molido, Café en grano, Cápsulas de café, Café soluble, Descafeinado, Té, Infusiones, Manzanilla, Poleo, Cacao en polvo, Cola Cao, Nesquik, Cereales, Copos de avena, Muesli, Galletas, Galletas María, Galletas de chocolate, Tortitas de arroz, Mermelada, Miel, Crema de cacao, Nocilla, Nutella, Crema de cacahuete, Azúcar, Azúcar moreno, Edulcorante, Sacarina, Chocolate, Chocolate negro, Bombones, Chucherías, Gominolas, Turrón, Polvorones, Barritas de cereales, Bollería, Donuts, Palmeras, Sobaos",
    congelados: "Helado, Helados, Pizza congelada, Pizzas, Croquetas, Empanadillas congeladas, Varitas de merluza, Palitos de pescado, Patatas congeladas, Verduras congeladas, Menestra, Guisantes congelados, Espinacas congeladas, Judías congeladas, Gambas congeladas, Langostinos congelados, Calamares a la romana, Rabas, Lasaña congelada, San Jacobos, Nuggets, Hielo, Cubitos de hielo, Fruta congelada",
    bebidas: "Agua, Agua mineral, Agua con gas, Garrafa de agua, Zumo, Zumo de naranja, Zumo de piña, Néctar, Refrescos, Coca-Cola, Coca Cola, Coca-Cola Zero, Fanta, Fanta de naranja, Fanta de limón, Sprite, Seven Up, Aquarius, Nestea, Tónica, Gaseosa, Casera, Bebida isotónica, Bebida energética, Cerveza, Cerveza sin alcohol, Tercios, Latas de cerveza, Vino, Vino tinto, Vino blanco, Vino rosado, Cava, Sidra, Vermut, Tinto de verano, Ginebra, Ron, Whisky, Licor, Mosto, Horchata, Kombucha",
    limpieza: "Detergente, Detergente líquido, Cápsulas de detergente, Suavizante, Lejía, Amoniaco, Friegasuelos, Limpiacristales, Multiusos, Desengrasante, Limpiador de baño, Antical, Quitagrasas, Lavavajillas, Pastillas lavavajillas, Sal lavavajillas, Abrillantador, Fairy, Mistol, Estropajos, Bayetas, Fregona, Recambio de fregona, Escoba, Recogedor, Guantes, Guantes de fregar, Bolsas de basura, Papel de cocina, Rollo de cocina, Servilletas, Papel de aluminio, Papel film, Papel de horno, Bolsas de congelación, Tuppers, Ambientador, Insecticida, Pilas, Bombillas, Velas, Cerillas, Mecheros, Quitamanchas, Oxi, Plancha vapor, Platos desechables, Vasos de plástico, Pajitas, Palillos",
    higiene: "Papel higiénico, Papel de váter, Papel WC, Gel, Gel de ducha, Champú, Acondicionador, Mascarilla de pelo, Jabón, Jabón de manos, Pasta de dientes, Dentífrico, Cepillo de dientes, Cepillos de dientes, Enjuague bucal, Colutorio, Hilo dental, Desodorante, Colonia, Perfume, Crema hidratante, Crema de manos, Crema corporal, Body milk, Protector solar, Crema solar, After sun, Maquinillas, Cuchillas, Cuchillas de afeitar, Espuma de afeitar, After shave, Compresas, Tampones, Salvaslips, Copa menstrual, Discos desmaquillantes, Desmaquillante, Bastoncillos, Algodón, Pañuelos, Pañuelos de papel, Kleenex, Toallitas, Laca, Gomina, Espuma de pelo, Tinte, Quitaesmalte, Esmalte de uñas, Lima de uñas, Tiritas, Vaselina, Cacao de labios, Toallitas desmaquillantes, Peine, Gomas de pelo, Horquillas",
    bebe: "Pañales, Toallitas de bebé, Leche de continuación, Leche infantil, Potitos, Papillas, Cereales de bebé, Crema del pañal, Colonia de bebé, Gel de bebé, Biberones, Chupetes",
    mascotas: "Pienso, Pienso de perro, Pienso de gato, Comida de perro, Comida de gato, Latas de gato, Latas de perro, Arena de gato, Arena para gatos, Premios para perro, Snacks de perro, Bolsas para cacas, Antiparasitario"
  };

  // "Plátanos" → "platano"; "Limones" → "limon"; "Nueces" → "nuez". Lo mismo para lo que escribe la familia, así casan.
  const sinAcentos = s => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ñ/g, "n");
  const raiz = w => w.length < 4 ? w : w.endsWith("ces") ? w.slice(0, -3) + "z" : /[lnrdjy]es$/.test(w) ? w.slice(0, -2) : w.endsWith("s") ? w.slice(0, -1) : w;
  const VACIAS = new Set(["de", "del", "la", "el", "las", "los", "en", "con", "para", "y", "a", "al", "sin"]);
  const fichas = s => sinAcentos(s).replace(/[^a-z0-9]+/g, " ").trim().split(" ").filter(w => w && !VACIAS.has(w)).map(raiz);
  const clave = s => sinAcentos(s).replace(/\s+/g, " ").trim();

  // índice: primera ficha → entradas [fichas, sección, nombre bonito]
  const PRODUCTOS = [], INDICE = {};
  Object.entries(DIC).forEach(([sec, txt]) => txt.split(",").map(x => x.trim()).filter(Boolean).forEach(n => {
    const f = fichas(n); if (!f.length) return;
    const p = { f, sec, n, k: f.join(" ") };
    PRODUCTOS.push(p); (INDICE[f[0]] ||= []).push(p);
  }));

  // Sección de un producto: la entrada más larga del diccionario que aparezca en lo escrito ("tomate frito" gana a "tomate")
  function seccionDe(nombre) {
    const f = fichas(nombre); let mejor = null;
    f.forEach((w, i) => (INDICE[w] || []).forEach(p => {
      if (p.f.every((x, j) => f[i + j] === x) && (!mejor || p.f.length > mejor.f.length || (p.f.length === mejor.f.length && p.k.length > mejor.k.length))) mejor = p;
    }));
    return mejor ? mejor.sec : "otros";
  }

  // Sugerencias del diccionario para lo que se está escribiendo: primero lo que empieza igual, luego lo que lo contiene
  function sugerir(txt, max) {
    const q = clave(txt).replace(/[^a-z0-9 ]/g, ""); if (q.length < 2) return [];
    const empieza = [], contiene = [];
    PRODUCTOS.forEach(p => { const k = clave(p.n); if (k.startsWith(q)) empieza.push(p); else if (k.includes(" " + q)) contiene.push(p) });
    const vistos = new Set(), out = [];
    [...empieza.sort((a, b) => a.n.length - b.n.length), ...contiene].forEach(p => { if (!vistos.has(p.k)) { vistos.add(p.k); out.push({ nombre: p.n, seccion: p.sec }) } });
    return out.slice(0, max || 8);
  }

  window.pasillos = { SECCIONES, seccionDe, sugerir, clave, fichas };
})();
