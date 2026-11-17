// Genera el sitio estático a partir de data/site.json y data/models.json.
// Uso: node scripts/build.mjs   (deja index.html, modelos/<modelo>/index.html, 404.html, sitemap.xml, robots.txt y CNAME en la raíz)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const site = JSON.parse(fs.readFileSync(path.join(root, "data/site.json"), "utf8"));
const models = JSON.parse(fs.readFileSync(path.join(root, "data/models.json"), "utf8")).filter((m) => m.active !== 0);
const origin = `https://${site.domain}`;
const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Argentina/Buenos_Aires" });

const esc = (v) => String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const money = (n) => `$ ${new Intl.NumberFormat("es-AR").format(n)}`;
const dateAr = (iso) => (iso ? iso.split("-").reverse().join("/") : "");
const waLink = (text) => `https://wa.me/${site.whatsapp.replace(/\D/g, "")}?text=${encodeURIComponent(text)}`;
const write = (file, content) => { const full = path.join(root, file); fs.mkdirSync(path.dirname(full), { recursive: true }); fs.writeFileSync(full, content); };

// Precio sugerido de Honda: solo vale hasta su fecha de vigencia (el navegador lo vuelve a controlar al abrir la página).
function pricing(m) {
  const expired = Boolean(m.price_valid_to) && m.price_valid_to < today;
  const priced = expired ? [] : m.versions.filter((v) => v.price > 0);
  return { priced, from: priced.length ? Math.min(...priced.map((v) => v.price)) : 0 };
}
function priceBlock(m, large = false) {
  const p = pricing(m);
  const on = p.from
    ? `<div class="price-on"><span class="price-label">${p.priced.length > 1 ? "Desde" : "Precio sugerido"}</span><b class="price${large ? " price-lg" : ""}">${money(p.from)}</b></div>`
    : `<div class="price-on" hidden></div>`;
  return `<div class="price-box" data-price="${p.from}" data-valid-to="${esc(m.price_valid_to)}">${on}<p class="price-off"${p.from ? " hidden" : ""}>Consultá el precio vigente</p></div>`;
}

const logo = (light = false) => `<span class="logo${light ? " logo-light" : ""}"><b>g</b><span>GOI<small>HONDA · MISIONES</small></span></span>`;

function head({ title, description, url, image = "", extra = "" }) {
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
${image ? `<meta property="og:image" content="${esc(image)}">\n<meta name="twitter:card" content="summary_large_image">` : ""}
<meta name="theme-color" content="#cc0000">
<link rel="icon" href="/assets/favicon.svg" type="image/svg+xml">
<link rel="preload" href="/assets/fonts/Rubik-Regular.ttf" as="font" type="font/ttf" crossorigin>
<link rel="stylesheet" href="/assets/catalogo.css">
${extra}</head>
<body>
<a class="skip" href="#contenido">Saltar al contenido</a>
<header class="site-header">
  <div class="wrap bar">
    <a class="brand" href="/" aria-label="${esc(site.brand)}, catálogo de motos">${logo()}</a>
    <nav class="top-actions" aria-label="Principal">
      <a class="link-quiet" href="/#modelos">Motos</a>
      <a class="link-quiet" href="/#cotizar">Cotizar</a>
      <a class="btn btn-dark" href="${waLink("Hola GOI, vi el catálogo de motos y quiero hacer una consulta.")}" target="_blank" rel="noopener">WhatsApp</a>
    </nav>
  </div>
</header>
<main id="contenido">
`;
}

function foot() {
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
      <li><a href="${waLink("Hola GOI, quiero hacer una consulta.")}" target="_blank" rel="noopener">WhatsApp</a></li>
    </ul>
  </div>
  <div class="foot-note"><p class="wrap">© ${new Date().getFullYear()} ${esc(site.legalName)} · ${esc(site.footerNote)}</p></div>
</footer>
<a class="wa-float" href="${waLink("Hola GOI, vi el catálogo de motos y quiero hacer una consulta.")}" target="_blank" rel="noopener" aria-label="Consultar por WhatsApp">
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 00-8.6 15.1L2 22l5-1.3A10 10 0 1012 2zm0 18.2c-1.5 0-3-.4-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1112 20.2zm4.5-6.1c-.2-.1-1.5-.8-1.7-.8s-.4-.1-.6.1-.6.8-.8 1-.3.2-.6.1a6.700 6.700 0 01-3.300-2.900c-.2-.4.2-.4.7-1.300.1-.1 0-.3 0-.4l-.8-1.900c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 00-.7.3 3 3 0 00-.9 2.200 5.200 5.200 0 001.100 2.800 11.900 11.900 0 004.600 4c1.700.7 2.400.8 3.200.7a2.700 2.700 0 001.800-1.300 2.200 2.200 0 00.2-1.300c-.1-.1-.3-.2-.6-.3z"/></svg>
</a>
<script>window.GOI = ${JSON.stringify({ whatsapp: site.whatsapp })};</script>
<script src="/assets/catalogo.js" defer></script>
</body>
</html>
`;
}

const segments = [...new Set(models.map((m) => m.segment).filter(Boolean))];
const withPrice = models.filter((m) => pricing(m).from > 0).length;

function card(m, index) {
  const p = pricing(m);
  return `<li class="card-item" data-name="${esc(m.name.toLowerCase())}" data-segment="${esc(m.segment)}" data-price="${p.from}" data-valid-to="${esc(m.price_valid_to)}" data-order="${index}">
  <a class="card" href="/modelos/${esc(m.slug)}/">
    <div class="card-img"><span class="badge">${esc(m.segment || "Moto")}</span><img src="${esc(m.image_url)}" alt="${esc(m.name)}" width="480" height="320" referrerpolicy="no-referrer" loading="${index < 6 ? "eager" : "lazy"}"></div>
    <div class="card-body">
      <h3>${esc(m.name)}</h3>
      ${m.tagline ? `<p class="tagline">${esc(m.tagline)}</p>` : ""}
      <div class="card-price">${priceBlock(m)}</div>
      <p class="more">Ver ficha técnica →</p>
    </div>
  </a>
</li>`;
}

function indexPage() {
  const showcase = ["Adventure", "Sport", "Scooter"].map((s) => models.find((m) => m.segment === s && m.image_url)).filter(Boolean);
  const ld = { "@context": "https://schema.org", "@type": "AutoDealer", name: `${site.legalName} · Honda`, url: origin, telephone: site.phone, email: site.email, address: { "@type": "PostalAddress", streetAddress: "Av. Belgrano y Las Heras 25", addressLocality: "Leandro N. Alem", addressRegion: "Misiones", addressCountry: "AR" }, brand: "Honda" };
  return head({
    title: `Catálogo de motos Honda | ${site.brand}`,
    description: `Todas las motos Honda con fotos, precio sugerido y ficha técnica. ${site.legalName}, concesionario oficial en Leandro N. Alem, Misiones.`,
    url: "/",
    image: showcase[0]?.image_url ?? "",
    extra: `<script type="application/ld+json">${JSON.stringify(ld)}</script>\n`,
  }) + `
<section class="hero">
  <div class="wrap hero-grid">
    <div>
      <p class="eyebrow">${esc(site.heroEyebrow)}</p>
      <h1>${esc(site.heroTitle)}</h1>
      <p class="hero-copy">${esc(site.heroCopy)}</p>
      <div class="hero-actions"><a class="btn btn-red" href="#modelos">Ver las motos</a><a class="btn btn-ghost" href="#cotizar">Pedir cotización</a></div>
      <dl class="stats">
        <div><dt>Modelos</dt><dd>${models.length}</dd></div>
        <div><dt>Tipos</dt><dd>${segments.length}</dd></div>
        ${withPrice ? `<div><dt>Con precio</dt><dd>${withPrice}</dd></div>` : ""}
      </dl>
    </div>
    <ul class="showcase" aria-hidden="true">
      ${showcase.map((m) => `<li><img src="${esc(m.image_url)}" alt="" width="144" height="96" referrerpolicy="no-referrer"><span><b>${esc(m.name)}</b><small>${esc(m.segment)}</small></span></li>`).join("\n      ")}
    </ul>
  </div>
</section>

<section id="modelos" class="wrap models">
  <div class="filters" role="search">
    <div class="chips" role="group" aria-label="Tipo de moto">
      <button type="button" class="chip" data-segment="" aria-pressed="true">Todas</button>
      ${segments.map((s) => `<button type="button" class="chip" data-segment="${esc(s)}" aria-pressed="false">${esc(s)}</button>`).join("\n      ")}
    </div>
    <div class="tools">
      <input type="search" id="q" placeholder="Buscar modelo" aria-label="Buscar modelo" autocomplete="off">
      <select id="sort" aria-label="Ordenar"><option value="order">Destacados</option><option value="asc">Menor precio</option><option value="desc">Mayor precio</option></select>
    </div>
  </div>
  <p id="count" class="count" aria-live="polite">${models.length} modelos</p>
  <ul id="grid" class="grid">
${models.map(card).join("\n")}
  </ul>
  <div id="empty" class="empty" hidden><h3>No encontramos ese modelo</h3><button type="button" id="reset" class="link-btn">Ver todas las motos</button></div>
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
  <form id="quote" class="form" novalidate>
    <label>Tu nombre<input name="name" autocomplete="name" maxlength="80" required></label>
    <label>Modelo que te interesa
      <select name="model"><option value="">Elegí una moto</option>${models.map((m) => `<option>${esc(m.name)}</option>`).join("")}</select>
    </label>
    <label>¿Algo más que quieras contarnos? <span class="opt">(opcional)</span><textarea name="message" rows="3" maxlength="400"></textarea></label>
    <button class="btn btn-red btn-block" type="submit">Enviar consulta por WhatsApp</button>
    <p class="hint">Se abre WhatsApp con tu mensaje listo para enviar.</p>
  </form>
</section>
` + foot();
}

function modelPage(m) {
  const p = pricing(m);
  const url = `/modelos/${m.slug}/`;
  const images = [...new Set([m.image_url, ...m.gallery].filter(Boolean))];
  const consult = waLink(`Hola GOI, quiero consultar por la ${m.name}.`);
  const ld = { "@context": "https://schema.org", "@type": "Product", name: `Honda ${m.name}`, brand: { "@type": "Brand", name: "Honda" }, category: m.segment, image: images.slice(0, 3), description: m.tagline || `Honda ${m.name}` };
  return head({
    title: `Honda ${m.name}: precio, ficha técnica y fotos | ${site.brand}`,
    description: m.tagline ? `${m.tagline}. Ficha técnica, fotos y precio sugerido de la Honda ${m.name} en ${site.legalName}, Leandro N. Alem, Misiones.` : `Ficha técnica, fotos y precio sugerido de la Honda ${m.name} en ${site.legalName}, Leandro N. Alem, Misiones.`,
    url, image: m.image_url,
    extra: `<script type="application/ld+json">${JSON.stringify(ld)}</script>\n`,
  }) + `
<section class="page-hero">
  <div class="wrap">
    <nav class="crumbs" aria-label="Ruta"><a href="/#modelos">← Catálogo</a> <span aria-hidden="true">/</span> <b>${esc(m.segment || m.name)}</b></nav>
    <h1>${esc(m.name)}</h1>
    ${m.tagline ? `<p class="hero-copy">${esc(m.tagline)}</p>` : ""}
  </div>
</section>

<section class="wrap detail">
  <div class="gallery" id="gallery">
    <div class="gallery-main"><img id="gallery-main" src="${esc(images[0])}" alt="${esc(m.name)}" width="960" height="720" referrerpolicy="no-referrer"></div>
    ${images.length > 1 ? `<ul class="thumbs" aria-label="Fotos del modelo">${images.map((u, i) => `<li><button type="button" data-src="${esc(u)}" aria-label="Ver foto ${i + 1}"${i === 0 ? ' aria-current="true"' : ""}><img src="${esc(u)}" alt="" width="120" height="120" loading="lazy" referrerpolicy="no-referrer"></button></li>`).join("")}</ul>` : ""}
  </div>
  <aside class="buy">
    <div class="panel">
      ${priceBlock(m, true)}
      ${p.priced.length > 1 ? `<ul class="versions">${p.priced.map((v) => `<li><span>${esc(v.name)}</span><b>${money(v.price)}</b></li>`).join("")}</ul>` : ""}
      <p class="fine">${p.from ? `Valor sugerido al público por Honda${m.price_valid_to ? `, vigente hasta el ${dateAr(m.price_valid_to)}` : ""}. No incluye flete, seguro ni patentamiento. El precio final y la disponibilidad los confirma ${esc(site.legalName)}.` : `Escribinos y un asesor te pasa el precio vigente y la disponibilidad.`}</p>
      <a class="btn btn-red btn-block" href="/?modelo=${encodeURIComponent(m.name)}#cotizar">Pedir cotización</a>
      <a class="btn btn-dark btn-block" href="${consult}" target="_blank" rel="noopener">Consultar por WhatsApp ↗</a>
    </div>
    ${m.colors.length ? `<div><p class="mini">Colores</p><ul class="swatches">${m.colors.map((c) => `<li title="${esc(c)}" style="background:${esc(c)}"></li>`).join("")}</ul></div>` : ""}
    ${m.spec_pdf_url ? `<a class="btn btn-line btn-block" href="${esc(m.spec_pdf_url)}" target="_blank" rel="noopener">Descargar ficha técnica (PDF) ↗</a>` : ""}
  </aside>
</section>
${m.features.length ? `
<section class="features"><div class="wrap">
  <p class="eyebrow">Características</p>
  <h2 class="display">Lo que la hace distinta</h2>
  <div class="feature-grid">
${m.features.map((f) => `    <article>${f.image ? `<img src="${esc(f.image)}" alt="" width="640" height="480" loading="lazy" referrerpolicy="no-referrer">` : ""}<div><p class="mini red">${esc(f.section)}</p>${f.heading ? `<h3>${esc(f.heading)}</h3>` : ""}${f.text ? `<p>${esc(f.text)}</p>` : ""}</div></article>`).join("\n")}
  </div>
</div></section>` : ""}

<section class="wrap specs">
  <p class="eyebrow">Ficha técnica</p>
  <h2 class="display">Especificaciones</h2>
  ${m.specs.length ? `<dl class="spec-grid">${m.specs.map((r) => `<div><dt>${esc(r.label)}</dt><dd>${esc(r.value)}</dd></div>`).join("")}</dl>` : `<p class="lead">Estamos completando la ficha técnica de este modelo. <a class="textlink" href="${consult}" target="_blank" rel="noopener">Pedinos los datos por WhatsApp</a> y te los enviamos.</p>`}
  <p class="fine">Fuente: Honda Motor de Argentina. Las especificaciones, colores y equipamiento pueden cambiar sin previo aviso.${m.source_url ? ` <a class="textlink" href="${esc(m.source_url)}" target="_blank" rel="noopener">Ver en motos.honda.com.ar ↗</a>` : ""}</p>
  <p><a class="textlink strong" href="/#modelos">← Volver al catálogo</a></p>
</section>
` + foot();
}

function notFoundPage() {
  return head({ title: `Página no encontrada | ${site.brand}`, description: "La página que buscás no existe.", url: "/404.html" }) + `
<section class="wrap nf"><p class="eyebrow">Error 404</p><h1 class="display">No encontramos esa página</h1><p class="lead">Puede que el modelo ya no esté en el catálogo.</p><a class="btn btn-red" href="/#modelos">Ver todas las motos</a></section>
` + foot();
}

// Limpia las páginas de modelos anteriores y vuelve a generar todo.
fs.rmSync(path.join(root, "modelos"), { recursive: true, force: true });
write("index.html", indexPage());
for (const m of models) write(`modelos/${m.slug}/index.html`, modelPage(m));
write("404.html", notFoundPage());
write("CNAME", `${site.domain}\n`);
write(".nojekyll", "");
write("robots.txt", `User-agent: *\nAllow: /\nSitemap: ${origin}/sitemap.xml\n`);
write("sitemap.xml", `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${["/", ...models.map((m) => `/modelos/${m.slug}/`)].map((u) => `  <url><loc>${origin}${u}</loc><lastmod>${today}</lastmod></url>`).join("\n")}\n</urlset>\n`);
console.log(`Listo: ${models.length} modelos, ${segments.length} tipos, ${withPrice} con precio vigente hoy (${today}).`);
