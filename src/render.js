// Arma el HTML público del catálogo a partir de los datos (textos del sitio y motos). Se ejecuta en el servidor en cada visita.
const esc = (v) => String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const money = (n) => `$ ${new Intl.NumberFormat("es-AR").format(n)}`;
const dateAr = (iso) => (iso ? iso.split("-").reverse().join("/") : "");
const norm = (s) => String(s).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
export const todayAr = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Argentina/Buenos_Aires" });

const waLinkFor = (site) => (text) => `https://wa.me/${site.whatsapp.replace(/\D/g, "")}?text=${encodeURIComponent(text)}`;

// Foto principal: la elegida en el panel, si no la de la versión (1200 px, fondo blanco) y, por último, la miniatura de Honda.
const photo = (m) => m.photo_url || m.versions.find((v) => v.image)?.image || m.image_url;
const photos = (m) => {
  const all = [...new Set([m.photo_url, ...m.versions.map((v) => v.image), ...m.gallery].filter(Boolean))];
  return all.length ? all : [m.image_url].filter(Boolean);
};

// Precio sugerido de Honda: solo vale hasta su fecha de vigencia (el navegador también lo controla al abrir la página).
function pricing(m, today) {
  const expired = Boolean(m.price_valid_to) && m.price_valid_to < today;
  const priced = expired ? [] : m.versions.filter((v) => v.price > 0);
  return { priced, from: priced.length ? Math.min(...priced.map((v) => v.price)) : 0 };
}
function priceBlock(m, today, large = false) {
  const p = pricing(m, today);
  const on = p.from
    ? `<div class="price-on"><span class="price-label">${p.priced.length > 1 ? "Desde" : "Precio sugerido"}</span><b class="price${large ? " price-lg" : ""}">${money(p.from)}</b></div>`
    : `<div class="price-on" hidden></div>`;
  return `<div class="price-box" data-price="${p.from}" data-valid-to="${esc(m.price_valid_to)}">${on}<p class="price-off"${p.from ? " hidden" : ""}>Consultá el precio vigente</p></div>`;
}

// Datos clave para comparar de un vistazo (salen de la ficha técnica).
function keySpecs(m) {
  const find = (re) => m.specs.find((r) => re.test(norm(r.label)))?.value ?? "";
  const cc = find(/^cilindrada/).match(/[\d.,]+(?=\s*cc)/i)?.[0];
  const kgs = [...find(/^peso/).matchAll(/(\d{2,3})\s*kg/gi)].map((x) => Number(x[1]));
  const tank = find(/tanque/).match(/(\d+[.,]?\d*)\s*(?:litros|l\b)/i)?.[1];
  const out = [];
  if (cc) out.push(["Cilindrada", `${cc} cc`]);
  if (kgs.length) out.push(["Peso", kgs.length > 1 && Math.min(...kgs) !== Math.max(...kgs) ? `${Math.min(...kgs)}–${Math.max(...kgs)} kg` : `${kgs[0]} kg`]);
  if (tank) out.push(["Tanque", `${tank.replace(",", ".")} L`]);
  return out;
}

// La ficha técnica en bloques, para recorrerla sin leer 17 filas seguidas.
const specGroups = [
  ["Motor", /^(motor|cilindrada|relacion de compresion|compresion|alimentacion|arranque)/],
  ["Transmisión", /^(transmision|traccion)/],
  ["Medidas y peso", /^(dimensiones|distancia entre ejes|altura del asiento|peso|capacidad)/],
  ["Frenos y suspensión", /^(freno|suspension)/],
  ["Neumáticos", /^neumatico/],
];
function groupSpecs(specs) {
  const groups = specGroups.map(([title]) => ({ title, rows: [] }));
  const other = { title: "Otros datos", rows: [] };
  for (const row of specs) {
    const i = specGroups.findIndex(([, re]) => re.test(norm(row.label)));
    (i >= 0 ? groups[i] : other).rows.push(row);
  }
  return [...groups, other].filter((g) => g.rows.length);
}

const logo = (light = false) => `<span class="logo${light ? " logo-light" : ""}"><b>g</b><span>GOI<small>HONDA · MISIONES</small></span></span>`;
const WA_ICON = `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 00-8.6 15.1L2 22l5-1.3A10 10 0 1012 2zm0 18.2c-1.5 0-3-.4-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1112 20.2zm4.5-6.1c-.2-.1-1.5-.8-1.7-.8s-.4-.1-.6.1-.6.8-.8 1-.3.2-.6.1a6.700 6.700 0 01-3.300-2.900c-.2-.4.2-.4.7-1.300.1-.1 0-.3 0-.4l-.8-1.900c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 00-.7.3 3 3 0 00-.9 2.200 5.200 5.200 0 001.100 2.800 11.900 11.900 0 004.600 4c1.700.7 2.400.8 3.200.7a2.700 2.700 0 001.800-1.300 2.200 2.200 0 00.2-1.300c-.1-.1-.3-.2-.6-.3z"/></svg>`;

function head(ctx, { title, description, url, image = "", extra = "", bodyClass = "" }) {
  const { site, wa } = ctx;
  const origin = `https://${site.domain}`;
  return `<!doctype html>
<html lang="es-AR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${origin}${url}">
<meta property="og:type" content="website">
<meta property="og:locale" content="es_AR">
<meta property="og:site_name" content="${esc(site.brand)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${origin}${url}">
${image ? `<meta property="og:image" content="${esc(image.startsWith("/") ? origin + image : image)}">\n<meta name="twitter:card" content="summary_large_image">` : ""}
<meta name="theme-color" content="#cc0000">
<link rel="icon" href="/assets/favicon.svg" type="image/svg+xml">
<link rel="preload" href="/assets/fonts/Rubik-Regular.ttf" as="font" type="font/ttf" crossorigin>
<link rel="stylesheet" href="/assets/catalogo.css">
${extra}</head>
<body${bodyClass ? ` class="${bodyClass}"` : ""}>
<a class="skip" href="#contenido">Saltar al contenido</a>
<header class="site-header">
  <div class="wrap bar">
    <a class="brand" href="/" aria-label="${esc(site.brand)}, catálogo de motos">${logo()}</a>
    <nav class="top-actions" aria-label="Principal">
      <a class="link-quiet" href="/#modelos">Motos</a>
      <a class="link-quiet" href="/#cotizar">Cotizar</a>
      <a class="btn btn-dark" href="${wa("Hola GOI, vi el catálogo de motos y quiero hacer una consulta.")}" target="_blank" rel="noopener">WhatsApp</a>
    </nav>
  </div>
</header>
<main id="contenido">
`;
}

function foot(ctx) {
  const { site, wa } = ctx;
  const tel = site.phone.replace(/[^\d+]/g, "");
  return `</main>
<footer class="site-footer">
  <div class="wrap foot-grid">
    <div>${logo(true)}<p class="foot-lead">Concesionario oficial Honda en Leandro N. Alem, Misiones.</p></div>
    <ul>
      <li><a href="tel:${esc(tel)}">${esc(site.phone)}</a></li>
      <li><a href="mailto:${esc(site.email)}">${esc(site.email)}</a></li>
      <li><a href="https://maps.google.com/?q=${encodeURIComponent(site.address)}" target="_blank" rel="noopener">${esc(site.address)}</a></li>
    </ul>
    <ul>
      <li><a href="${esc(site.instagram)}" target="_blank" rel="noopener">Instagram @honda_goi_sa</a></li>
      <li><a href="${wa("Hola GOI, quiero hacer una consulta.")}" target="_blank" rel="noopener">WhatsApp</a></li>
    </ul>
  </div>
  <div class="foot-note"><p class="wrap">© ${new Date().getFullYear()} ${esc(site.legalName)} · ${esc(site.footerNote)}</p></div>
</footer>
<a class="wa-float" href="${wa("Hola GOI, vi el catálogo de motos y quiero hacer una consulta.")}" target="_blank" rel="noopener" aria-label="Escribinos por WhatsApp">${WA_ICON}</a>
<script src="/assets/catalogo.js" defer></script>
</body>
</html>
`;
}

const context = (site) => ({ site, wa: waLinkFor(site) });

function card(m, index, today, uso) {
  const p = pricing(m, today);
  const specs = keySpecs(m);
  return `<li class="card-item" data-name="${esc(norm(m.name))}" data-uso="${esc(uso)}" data-segment="${esc(m.segment)}" data-price="${p.from}" data-valid-to="${esc(m.price_valid_to)}" data-order="${index}">
  <a class="card" href="/modelos/${esc(m.slug)}/">
    <div class="card-img"><span class="badge">${esc(m.segment || "Moto")}</span><img src="${esc(photo(m))}" alt="${esc(m.name)}" width="600" height="400" referrerpolicy="no-referrer" loading="${index < 6 ? "eager" : "lazy"}"></div>
    <div class="card-body">
      <h3>${esc(m.name)}</h3>
      ${m.tagline ? `<p class="tagline">${esc(m.tagline)}</p>` : ""}
      ${specs.length ? `<dl class="keyspecs">${specs.map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join("")}</dl>` : ""}
      <div class="card-price">${priceBlock(m, today)}</div>
      <p class="more">Ver esta moto <span aria-hidden="true">→</span></p>
    </div>
  </a>
</li>`;
}

export function indexPage(site, models, today = todayAr()) {
  const ctx = context(site);
  const { wa } = ctx;
  const origin = `https://${site.domain}`;
  const usoOf = (m) => m.uso || "Otras";
  const order = site.usoOrder ?? [];
  const usos = [...new Set(models.map(usoOf))].sort((a, b) => {
    const ia = order.indexOf(a), ib = order.indexOf(b);
    return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib);
  });
  const withPrice = models.filter((m) => pricing(m, today).from > 0).length;
  const hero = models.find((m) => m.slug === site.heroModel) ?? models[0];
  const ld = { "@context": "https://schema.org", "@type": "AutoDealer", name: `${site.legalName} · Honda`, url: origin, telephone: site.phone, email: site.email, address: { "@type": "PostalAddress", streetAddress: "Av. Belgrano y Las Heras 25", addressLocality: "Leandro N. Alem", addressRegion: "Misiones", addressCountry: "AR" }, brand: "Honda" };
  const heroBlock = hero ? `
    <div class="hero-photo" aria-hidden="true">
      <img src="${esc(photo(hero))}" alt="" width="1200" height="800" referrerpolicy="no-referrer" fetchpriority="high">
      <span class="hero-tag"><b>${esc(hero.name)}</b><small>${esc(hero.segment)}</small></span>
    </div>` : "";
  return head(ctx, {
    title: `Catálogo de motos Honda | ${site.brand}`,
    description: `Todas las motos Honda con fotos, precio sugerido y ficha técnica. ${site.legalName}, concesionario oficial en Leandro N. Alem, Misiones.`,
    url: "/", image: hero ? photo(hero) : "",
    extra: `<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, "\\u003c")}</script>\n`,
  }) + `
<section class="hero">
  <div class="wrap hero-grid">
    <div class="hero-text">
      <p class="eyebrow">${esc(site.heroEyebrow)}</p>
      <h1>${esc(site.heroTitle)}</h1>
      <p class="hero-copy">${esc(site.heroCopy)}</p>
      <div class="hero-actions"><a class="btn btn-red" href="#modelos">Ver las motos</a><a class="btn btn-soft" href="#cotizar">Pedir cotización</a></div>
      <ul class="hero-facts"><li><b>${models.length}</b> modelos</li><li><b>${usos.length}</b> tipos de uso</li>${withPrice ? `<li><b>${withPrice}</b> con precio</li>` : ""}</ul>
    </div>${heroBlock}
  </div>
</section>

<section id="modelos" class="wrap models">
  <div class="section-head">
    <h2 class="display">Elegí tu moto</h2>
    <p>¿Para qué la querés? Tocá una opción y mirá solo esas motos.</p>
  </div>
  <div class="filters" role="search">
    <div class="chips" role="group" aria-label="Para qué la querés">
      <button type="button" class="chip" data-uso="" aria-pressed="true">Todas</button>
      ${usos.map((u) => `<button type="button" class="chip" data-uso="${esc(u)}" aria-pressed="false">${esc(u)}</button>`).join("\n      ")}
    </div>
    <div class="tools">
      <input type="search" id="q" placeholder="Buscar por nombre" aria-label="Buscar por nombre" autocomplete="off">
      <select id="sort" aria-label="Ordenar"><option value="order">Destacadas</option><option value="asc">Menor precio</option><option value="desc">Mayor precio</option></select>
    </div>
  </div>
  <p id="count" class="count" aria-live="polite">${models.length} motos</p>
  <ul id="grid" class="grid">
${models.map((m, i) => card(m, i, today, usoOf(m))).join("\n")}
  </ul>
  <div id="empty" class="empty" hidden><h3>No encontramos esa moto</h3><p>Probá con otro nombre o mirá todas las opciones.</p><button type="button" id="reset" class="btn btn-soft">Ver todas las motos</button></div>
</section>

<section class="trust"><div class="wrap trust-grid">
${site.trust.map((t) => `  <div><h2>${esc(t.title)}</h2><p>${esc(t.text)}</p></div>`).join("\n")}
</div></section>

<section id="cotizar" class="wrap quote">
  <div>
    <p class="eyebrow">Cotización</p>
    <h2 class="display">${esc(site.quoteTitle)}</h2>
    <p class="lead">${esc(site.quoteCopy)}</p>
    <p class="lead-small">También podés llamarnos al <a href="tel:${esc(site.phone.replace(/[^\d+]/g, ""))}">${esc(site.phone)}</a> o escribirnos a <a href="mailto:${esc(site.email)}">${esc(site.email)}</a>.</p>
  </div>
  <form id="quote" class="form" novalidate data-wa="${esc(site.whatsapp.replace(/\D/g, ""))}">
    <label>Tu nombre<input name="name" autocomplete="name" maxlength="80" required></label>
    <label>¿Qué moto te interesa?
      <select name="model"><option value="">Todavía no sé, quiero que me asesoren</option>${models.map((m) => `<option>${esc(m.name)}</option>`).join("")}</select>
    </label>
    <label>¿Querés contarnos algo más? <span class="opt">(opcional)</span><textarea name="message" rows="3" maxlength="400"></textarea></label>
    <button class="btn btn-red btn-block" type="submit">Escribinos por WhatsApp</button>
    <p class="hint">Se abre WhatsApp con tu mensaje listo para enviar.</p>
  </form>
</section>
` + foot(ctx);
}

export function modelPage(site, m, today = todayAr()) {
  const ctx = context(site);
  const { wa } = ctx;
  const p = pricing(m, today);
  const url = `/modelos/${m.slug}/`;
  const images = photos(m);
  const consult = wa(`Hola GOI, quiero consultar por la ${m.name}.`);
  const quote = `/?modelo=${encodeURIComponent(m.name)}#cotizar`;
  const groups = groupSpecs(m.specs);
  const keys = keySpecs(m);
  const ld = { "@context": "https://schema.org", "@type": "Product", name: `Honda ${m.name}`, brand: { "@type": "Brand", name: "Honda" }, category: m.segment, image: images.slice(0, 3), description: m.tagline || `Honda ${m.name}` };
  return head(ctx, {
    title: `Honda ${m.name}: precio, ficha técnica y fotos | ${site.brand}`,
    description: m.tagline ? `${m.tagline}. Ficha técnica, fotos y precio sugerido de la Honda ${m.name} en ${site.legalName}, Leandro N. Alem, Misiones.` : `Ficha técnica, fotos y precio sugerido de la Honda ${m.name} en ${site.legalName}, Leandro N. Alem, Misiones.`,
    url, image: images[0], bodyClass: "has-cta",
    extra: `<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, "\\u003c")}</script>\n`,
  }) + `
<section class="page-hero">
  <div class="wrap">
    <nav class="crumbs" aria-label="Ruta"><a href="/#modelos">← Todas las motos</a></nav>
    <p class="eyebrow">${esc(m.segment || "Honda")}</p>
    <h1>${esc(m.name)}</h1>
    ${m.tagline ? `<p class="hero-copy">${esc(m.tagline)}</p>` : ""}
  </div>
</section>

<nav class="subnav" aria-label="Secciones de la ficha"><div class="wrap"><a href="#fotos">Fotos</a>${m.features.length ? `<a href="#caracteristicas">Características</a>` : ""}<a href="#ficha">Ficha técnica</a></div></nav>

<section id="fotos" class="wrap detail">
  <div class="gallery" id="gallery">
    <div class="gallery-main"><img id="gallery-main" src="${esc(images[0])}" alt="${esc(m.name)}" width="1200" height="800" referrerpolicy="no-referrer"></div>
    ${images.length > 1 ? `<ul class="thumbs" aria-label="Fotos del modelo">${images.map((u, i) => `<li><button type="button" data-src="${esc(u)}" aria-label="Ver foto ${i + 1}"${i === 0 ? ' aria-current="true"' : ""}><img src="${esc(u)}" alt="" width="160" height="107" loading="lazy" referrerpolicy="no-referrer"></button></li>`).join("")}</ul>` : ""}
  </div>
  <aside class="buy">
    <div class="panel">
      ${priceBlock(m, today, true)}
      ${p.priced.length > 1 ? `<ul class="versions">${p.priced.map((v) => `<li><span>${esc(v.name)}</span><b>${money(v.price)}</b></li>`).join("")}</ul>` : ""}
      ${keys.length ? `<dl class="keyspecs keyspecs-lg">${keys.map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join("")}</dl>` : ""}
      <p class="fine">${p.from ? `Valor sugerido al público por Honda${m.price_valid_to ? `, vigente hasta el ${dateAr(m.price_valid_to)}` : ""}. No incluye flete, seguro ni patentamiento. El precio final y la disponibilidad los confirma ${esc(site.legalName)}.` : `Escribinos y un asesor te pasa el precio vigente y la disponibilidad.`}</p>
      <a class="btn btn-red btn-block" href="${quote}">Pedir cotización</a>
      <a class="btn btn-dark btn-block" href="${consult}" target="_blank" rel="noopener">Escribinos por WhatsApp</a>
    </div>
    ${m.colors.length ? `<div><p class="mini">Colores disponibles</p><ul class="swatches">${m.colors.map((c) => `<li title="${esc(c)}" data-color="${esc(c)}"></li>`).join("")}</ul></div>` : ""}
    ${m.spec_pdf_url ? `<a class="btn btn-soft btn-block" href="${esc(m.spec_pdf_url)}" target="_blank" rel="noopener">Descargar ficha técnica (PDF)</a>` : ""}
  </aside>
</section>
${m.features.length ? `
<section id="caracteristicas" class="features"><div class="wrap">
  <p class="eyebrow">Características</p>
  <h2 class="display">Lo que la hace distinta</h2>
  <div class="feature-grid">
${m.features.map((f) => `    <article>${f.image ? `<img src="${esc(f.image)}" alt="" width="640" height="480" loading="lazy" referrerpolicy="no-referrer">` : ""}<div><p class="mini red">${esc(f.section)}</p>${f.heading ? `<h3>${esc(f.heading)}</h3>` : ""}${f.text ? `<p>${esc(f.text)}</p>` : ""}</div></article>`).join("\n")}
  </div>
</div></section>` : ""}

<section id="ficha" class="wrap specs">
  <p class="eyebrow">Ficha técnica</p>
  <h2 class="display">Especificaciones</h2>
  ${groups.length ? `<div class="spec-groups">${groups.map((g) => `<section class="spec-card"><h3>${esc(g.title)}</h3><dl>${g.rows.map((r) => `<div><dt>${esc(r.label)}</dt><dd>${esc(r.value)}</dd></div>`).join("")}</dl></section>`).join("")}</div>` : `<p class="lead">Estamos completando la ficha técnica de este modelo. <a class="textlink" href="${consult}" target="_blank" rel="noopener">Pedinos los datos por WhatsApp</a> y te los enviamos.</p>`}
  <p class="fine">Fuente: Honda Motor de Argentina. Las especificaciones, colores y equipamiento pueden cambiar sin previo aviso.${m.source_url ? ` <a class="textlink" href="${esc(m.source_url)}" target="_blank" rel="noopener">Ver en motos.honda.com.ar ↗</a>` : ""}</p>
  <p><a class="textlink strong" href="/#modelos">← Volver a todas las motos</a></p>
</section>

<div class="sticky-cta" role="region" aria-label="Pedir cotización">
  <div class="sticky-info"><b>${esc(m.name)}</b>${p.from ? `<span>${money(p.from)}</span>` : `<span>Consultá el precio</span>`}</div>
  <a class="btn btn-red" href="${quote}">Cotizar</a>
  <a class="btn btn-wa" href="${consult}" target="_blank" rel="noopener" aria-label="Escribinos por WhatsApp">${WA_ICON}</a>
</div>
` + foot(ctx);
}

export function notFoundPage(site) {
  const ctx = context(site);
  return head(ctx, { title: `Página no encontrada | ${site.brand}`, description: "La página que buscás no existe.", url: "/404" }) + `
<section class="wrap nf"><p class="eyebrow">Error 404</p><h1 class="display">No encontramos esa página</h1><p class="lead">Puede que la moto ya no esté en el catálogo.</p><a class="btn btn-red" href="/#modelos">Ver todas las motos</a></section>
` + foot(ctx);
}

export function sitemapXml(site, models, today = todayAr()) {
  const origin = `https://${site.domain}`;
  const urls = ["/", ...models.map((m) => `/modelos/${m.slug}/`)];
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `  <url><loc>${origin}${u}</loc><lastmod>${today}</lastmod></url>`).join("\n")}\n</urlset>\n`;
}
