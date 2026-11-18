// Panel de administración del catálogo: motos, precios del mes y textos del sitio.
// El texto que viene del servidor se inserta con textContent, nunca como HTML.
(function () {
  "use strict";
  const money = (n) => "$ " + new Intl.NumberFormat("es-AR").format(n);
  const $ = (selector, root = document) => root.querySelector(selector);

  function h(tag, props, ...kids) {
    const el = document.createElement(tag);
    for (const [key, value] of Object.entries(props || {})) {
      if (value === undefined || value === null || value === false) continue;
      if (key === "class") el.className = value;
      else if (key === "text") el.textContent = value;
      else if (key === "value") el.value = value;
      else if (key.startsWith("on")) el.addEventListener(key.slice(2), value);
      else el.setAttribute(key, value === true ? "" : value);
    }
    for (const kid of kids.flat()) if (kid !== null && kid !== undefined && kid !== false) el.append(kid);
    return el;
  }
  const clear = (el) => { while (el.firstChild) el.firstChild.remove(); return el; };

  async function api(path, options = {}) {
    const response = await fetch(path, { ...options, headers: { "content-type": "application/json", ...(options.headers || {}) } });
    const data = await response.json().catch(() => ({}));
    if (response.status === 401 && !path.includes("/login")) { showLogin(); throw new Error("Tu sesión terminó. Volvé a ingresar."); }
    if (!response.ok) throw new Error(data.error || "No se pudo completar la operación.");
    return data;
  }

  let toastTimer;
  function toast(message) {
    $(".toast")?.remove();
    document.body.append(h("div", { class: "toast", role: "status", text: message }));
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => $(".toast")?.remove(), 3500);
  }

  // Achica la foto (máx. 1600 px, WebP) para que entre en la base y cargue rápido en el celular.
  async function shrinkImage(file) {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale); canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    let blob = null;
    for (const quality of [0.85, 0.7, 0.55, 0.4]) {
      blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/webp", quality));
      if (blob && blob.size < 900_000) break;
    }
    if (!blob || blob.size >= 900_000) throw new Error("La foto es demasiado pesada. Probá con una más chica.");
    const bytes = new Uint8Array(await blob.arrayBuffer());
    let binary = "";
    for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return btoa(binary);
  }
  async function uploadFiles(files) {
    const urls = [];
    for (const file of Array.from(files).slice(0, 8)) {
      if (!file.type.startsWith("image/")) throw new Error(`${file.name} no es una foto.`);
      const result = await api("/api/admin/media", { method: "POST", body: JSON.stringify({ name: file.name, data: await shrinkImage(file) }) });
      urls.push(result.url);
    }
    return urls;
  }

  const app = $("#app");
  const priceFrom = (m) => { const p = m.versions.map((v) => v.price).filter((n) => n > 0); return p.length ? Math.min(...p) : 0; };
  const today = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Argentina/Buenos_Aires" });
  const dateAr = (iso) => (iso ? iso.split("-").reverse().join("/") : "—");

  /* ---------- Ingreso ---------- */
  function showLogin() {
    clear(app);
    const err = h("p", { class: "error", role: "alert", hidden: true });
    const input = h("input", { class: "field-input", type: "password", name: "password", autocomplete: "current-password", required: true, "aria-label": "Clave" });
    const form = h("form", { class: "panel", onsubmit: async (event) => {
      event.preventDefault(); err.hidden = true;
      try { await api("/api/admin/login", { method: "POST", body: JSON.stringify({ password: input.value }) }); showApp(); }
      catch (error) { err.hidden = false; err.textContent = error.message; input.select(); }
    } }, h("h1", { class: "display", text: "Panel del catálogo" }), h("p", { class: "mute", text: "Ingresá con la clave de administración." }),
      h("label", { class: "f" }, "Clave", input), err, h("button", { class: "btn btn-red btn-block", type: "submit" }, "Ingresar"));
    app.append(h("div", { class: "login" }, form));
    input.focus();
  }

  /* ---------- Estructura ---------- */
  let section = "motos";
  function showApp() {
    clear(app);
    const tabs = h("div", { class: "tabs", role: "tablist" });
    const body = h("main", { class: "wrap a-main" });
    const draw = () => {
      clear(tabs);
      for (const [key, label] of [["motos", "Motos"], ["precios", "Precios del mes"], ["textos", "Textos del sitio"]]) {
        tabs.append(h("button", { type: "button", "aria-current": section === key ? "page" : null, onclick: () => { section = key; draw(); } }, label));
      }
      clear(body);
      ({ motos: viewModels, precios: viewPrices, textos: viewTexts })[section](body).catch((error) => body.append(h("p", { class: "error", text: error.message })));
    };
    app.append(
      h("header", { class: "a-head" }, h("div", { class: "wrap a-bar" }, h("strong", { class: "display", text: "Panel del catálogo" }), tabs,
        h("div", { class: "row-actions" }, h("a", { class: "btn btn-soft btn-small", href: "/", target: "_blank", rel: "noopener" }, "Ver el catálogo"),
          h("button", { class: "btn btn-soft btn-small", type: "button", onclick: async () => { await api("/api/admin/login", { method: "DELETE" }); showLogin(); } }, "Salir")))),
      body);
    draw();
  }
  const refresh = () => showApp();

  /* ---------- Motos ---------- */
  async function viewModels(root) {
    const { models } = await api("/api/admin/models");
    root.append(h("div", { class: "a-title" }, h("h1", { text: "Motos" }),
      h("button", { class: "btn btn-soft", type: "button", onclick: async () => {
        if (!confirm("Se cargan las motos oficiales de Honda (fotos, precio sugerido y ficha técnica). Lo que ya editaste no se pisa. ¿Continuar?")) return;
        try { const r = await api("/api/admin/import", { method: "POST", body: "{}" }); toast(`Fichas de Honda: ${r.created} motos nuevas y ${r.updated} completadas.`); refresh(); } catch (error) { toast(error.message); }
      } }, "Cargar fichas oficiales Honda")));
    if (!models.length) {
      root.append(h("div", { class: "empty" }, h("h2", { text: "El catálogo está vacío" }), h("p", { text: "Tocá «Cargar fichas oficiales Honda» para traer las 27 motos con fotos, precio sugerido y ficha técnica." })));
      return;
    }
    const usos = [...new Set(models.map((m) => m.uso).filter(Boolean))];
    const rows = models.map((m) => {
      const from = priceFrom(m);
      const expired = m.price_valid_to && m.price_valid_to < today();
      return h("tr", {},
        h("td", {}, h("div", { class: "t-img" }, photoOf(m) ? h("img", { src: photoOf(m), alt: "", loading: "lazy", referrerpolicy: "no-referrer" }) : h("span", { class: "mute", text: "—" }))),
        h("td", {}, h("strong", { text: m.name }), h("div", { class: "fine", text: m.segment || "" })),
        h("td", { text: m.uso || "—" }),
        h("td", { text: from ? money(from) : "Consultar" }),
        h("td", {}, h("span", { class: "pill " + (!m.price_valid_to ? "off" : expired ? "warn" : "ok"), text: m.price_valid_to ? (expired ? "Venció " : "Hasta ") + dateAr(m.price_valid_to) : "Sin vencimiento" })),
        h("td", {}, h("span", { class: "pill " + (m.active ? "ok" : "off"), text: m.active ? "Visible" : "Oculta" })),
        h("td", {}, h("button", { class: "btn btn-soft btn-small", type: "button", onclick: () => editModel(m, usos, refresh) }, "Editar")));
    });
    root.append(h("div", { class: "table-wrap" }, h("table", {}, h("thead", {}, h("tr", {}, ["", "Moto", "Grupo del filtro", "Precio desde", "Vigencia", "Estado", ""].map((t) => h("th", { text: t })))), h("tbody", {}, rows))));
  }
  const photoOf = (m) => m.photo_url || m.versions.find((v) => v.image)?.image || m.image_url;

  function editModel(m, usos, done) {
    const data = { ...m, versions: m.versions.map((v) => ({ ...v })), gallery: [...m.gallery] };
    const err = h("p", { class: "error", role: "alert", hidden: true });
    const f = (label, el) => h("label", { class: "f" }, label, el);
    const inp = (value, attrs = {}) => h("input", { class: "field-input", value, ...attrs });
    const inName = inp(data.name, { maxlength: "120", required: true });
    const inSeg = inp(data.segment, { maxlength: "60" });
    const inUso = h("input", { class: "field-input", value: data.uso, maxlength: "60", list: "usos" });
    const dl = h("datalist", { id: "usos" }, usos.map((u) => h("option", { value: u })));
    const inTag = inp(data.tagline, { maxlength: "160" });
    const inOrder = inp(String(data.sort_order), { type: "number", step: "1" });
    const inValid = inp(data.price_valid_to, { type: "date" });
    const inPdf = inp(data.spec_pdf_url, { type: "url", placeholder: "https://…" });
    const inSpecs = h("textarea", { class: "field-input", rows: "8", value: data.specs.map((r) => `${r.label}: ${r.value}`).join("\n") });
    const inActive = h("input", { type: "checkbox" }); inActive.checked = Boolean(data.active);
    const verBox = h("div", { class: "ver-list" });
    const drawVersions = () => {
      clear(verBox);
      data.versions.forEach((v, i) => verBox.append(h("div", { class: "ver-row" },
        h("input", { class: "field-input", "aria-label": "Nombre de la versión", placeholder: "Versión (opcional)", value: v.name, oninput: (e) => { v.name = e.target.value; } }),
        h("input", { class: "field-input", "aria-label": "Precio en pesos", type: "number", min: "0", step: "1", placeholder: "Precio en pesos", value: v.price || "", oninput: (e) => { v.price = Number(e.target.value); } }),
        data.versions.length > 1 ? h("button", { class: "btn btn-soft btn-small", type: "button", onclick: () => { data.versions.splice(i, 1); drawVersions(); } }, "Quitar") : null)));
      verBox.append(h("button", { class: "btn btn-soft btn-small", type: "button", onclick: () => { data.versions.push({ name: "", price: 0 }); drawVersions(); } }, "+ Agregar versión"));
    };
    if (!data.versions.length) data.versions.push({ name: "", price: 0 });
    const preview = h("div", { class: "t-img big" });
    const drawPreview = () => { clear(preview); const src = data.photo_url || photoOf(data); if (src) preview.append(h("img", { src, alt: "", referrerpolicy: "no-referrer" })); };
    const inPhoto = inp(data.photo_url, { placeholder: "Enlace https://… o subí una foto", "aria-label": "Foto principal", oninput: (e) => { data.photo_url = e.target.value.trim(); drawPreview(); } });
    const upMain = h("input", { type: "file", accept: "image/jpeg,image/png,image/webp", hidden: true, onchange: async (e) => {
      const files = Array.from(e.target.files || []); e.target.value = "";
      try { const [url] = await uploadFiles(files); if (url) { data.photo_url = url; inPhoto.value = url; drawPreview(); toast("Foto subida."); } } catch (error) { toast(error.message); }
    } });
    const inGallery = h("textarea", { class: "field-input", rows: "3", "aria-label": "Otras fotos", value: data.gallery.join("\n"), oninput: (e) => { data.gallery = e.target.value.split("\n").map((x) => x.trim()).filter(Boolean); } });
    const upMore = h("input", { type: "file", accept: "image/jpeg,image/png,image/webp", multiple: true, hidden: true, onchange: async (e) => {
      const files = Array.from(e.target.files || []); e.target.value = "";
      try { const urls = await uploadFiles(files); data.gallery.push(...urls); inGallery.value = data.gallery.join("\n"); toast(`${urls.length} foto(s) subida(s).`); } catch (error) { toast(error.message); }
    } });
    const save = h("button", { class: "btn btn-red", type: "submit" }, "Guardar");
    const close = () => $(".modal-shade")?.remove();
    const form = h("form", { class: "modal", novalidate: true, onsubmit: async (event) => {
      event.preventDefault(); err.hidden = true; save.disabled = true;
      const specs = inSpecs.value.split("\n").map((line) => { const at = line.indexOf(":"); return at > 0 ? { label: line.slice(0, at).trim(), value: line.slice(at + 1).trim() } : null; }).filter(Boolean);
      const body = { name: inName.value, segment: inSeg.value, uso: inUso.value, tagline: inTag.value, sort_order: Number(inOrder.value || 0), price_valid_to: inValid.value, photo_url: data.photo_url, spec_pdf_url: inPdf.value.trim(),
        versions: data.versions.filter((v) => v.name.trim() || v.price > 0 || v.image), specs, gallery: data.gallery, active: inActive.checked ? 1 : 0 };
      try { await api("/api/admin/models/" + encodeURIComponent(m.slug), { method: "PUT", body: JSON.stringify(body) }); close(); toast("Moto guardada."); done(); }
      catch (error) { err.hidden = false; err.textContent = error.message; save.disabled = false; }
    } },
      h("div", { class: "modal-head" }, h("h2", { text: "Editar " + m.name }), h("button", { class: "x", type: "button", "aria-label": "Cerrar", onclick: close }, "×")),
      h("div", { class: "modal-body" },
        h("div", { class: "two-col" }, f("Nombre", inName), f("Frase corta", inTag)),
        h("div", { class: "two-col" }, f("Tipo según Honda (etiqueta de la tarjeta)", inSeg), f("Grupo del filtro de la portada", inUso)), dl,
        h("div", {}, h("p", { class: "f", text: "Versiones y precios (en pesos)" }), verBox),
        h("div", { class: "two-col" }, f("Precio vigente hasta (vacío = no vence)", inValid), f("Orden en la lista (menor = primero)", inOrder)),
        h("div", {}, h("p", { class: "f", text: "Foto principal" }), h("div", { class: "photo-row" }, preview, h("div", { class: "photo-fields" }, inPhoto, h("button", { class: "btn btn-soft btn-small", type: "button", onclick: () => upMain.click() }, "Subir foto desde mi compu"), upMain))),
        h("div", {}, f("Otras fotos (un enlace por línea)", inGallery), h("button", { class: "btn btn-soft btn-small", type: "button", onclick: () => upMore.click() }, "+ Subir más fotos"), upMore),
        f("Ficha técnica (una línea por dato, con el formato Etiqueta: valor)", inSpecs),
        f("Ficha técnica en PDF (enlace)", inPdf),
        h("label", { class: "opt" }, inActive, h("span", {}, h("b", { text: "Visible en el catálogo" }), h("small", { text: "Si lo destildás, la moto queda oculta." }))),
        err),
      h("div", { class: "modal-foot" }, h("button", { class: "btn btn-soft", type: "button", onclick: close }, "Cancelar"), save));
    drawVersions(); drawPreview();
    document.body.append(h("div", { class: "modal-shade", onmousedown: (event) => { if (event.target.classList.contains("modal-shade")) close(); } }, form));
    inName.focus();
  }

  /* ---------- Precios del mes ---------- */
  async function viewPrices(root) {
    const { models } = await api("/api/admin/models");
    if (!models.length) { root.append(h("div", { class: "empty" }, h("h2", { text: "Todavía no hay motos" }), h("p", { text: "Primero cargá las motos desde la pestaña «Motos»." }))); return; }
    const inputs = [];
    const global = h("input", { class: "field-input", type: "date", "aria-label": "Fecha de vigencia para todas" });
    const err = h("p", { class: "error", role: "alert", hidden: true });
    const rows = models.map((m) => {
      const row = { slug: m.slug, prices: [], valid: h("input", { class: "field-input", type: "date", value: m.price_valid_to, "aria-label": "Vigencia de " + m.name }) };
      const cells = m.versions.map((v, i) => {
        const input = h("input", { class: "field-input", type: "number", min: "0", step: "1", inputmode: "numeric", value: v.price || "", "aria-label": `Precio de ${m.name}${v.name ? " " + v.name : ""}` });
        row.prices[i] = input;
        return h("div", { class: "price-cell" }, v.name ? h("span", { class: "fine", text: v.name }) : null, input);
      });
      inputs.push(row);
      return h("tr", {}, h("td", {}, h("strong", { text: m.name }), h("div", { class: "fine", text: m.active ? "" : "Oculta" })),
        h("td", {}, cells.length ? h("div", { class: "price-cells" }, cells) : h("span", { class: "fine", text: "Sin versiones: cargalas desde «Motos»" })), h("td", {}, row.valid));
    });
    const save = h("button", { class: "btn btn-red", type: "button", onclick: async () => {
      err.hidden = true; save.disabled = true;
      try {
        const items = inputs.map((r) => ({ slug: r.slug, prices: r.prices.map((i) => Number(i.value || 0)), price_valid_to: r.valid.value }));
        const result = await api("/api/admin/prices", { method: "POST", body: JSON.stringify({ items }) });
        toast(`Precios guardados en ${result.updated} motos.`);
      } catch (error) { err.hidden = false; err.textContent = error.message; } finally { save.disabled = false; }
    } }, "Guardar todos los precios");
    root.append(
      h("div", { class: "a-title" }, h("h1", { text: "Precios del mes" }), save),
      h("div", { class: "notice" }, "Honda publica un precio sugerido nuevo cada mes en ", h("a", { class: "textlink", href: "https://motos.honda.com.ar", target: "_blank", rel: "noopener", text: "motos.honda.com.ar" }), ". Cuando pasa la fecha de vigencia, el catálogo deja de mostrar el precio y dice «Consultá el precio vigente». Para poner un precio propio de GOI, dejá la vigencia vacía."),
      h("div", { class: "bulk" }, h("label", { class: "f" }, "Vigencia para todas las motos", global),
        h("button", { class: "btn btn-soft", type: "button", onclick: () => { if (!global.value) { toast("Elegí una fecha primero."); return; } inputs.forEach((r) => { r.valid.value = global.value; }); toast("Fecha aplicada a todas. Falta guardar."); } }, "Aplicar a todas")),
      err,
      h("div", { class: "table-wrap" }, h("table", {}, h("thead", {}, h("tr", {}, ["Moto", "Precio por versión (pesos)", "Vigente hasta"].map((t) => h("th", { text: t })))), h("tbody", {}, rows))));
  }

  /* ---------- Textos del sitio ---------- */
  async function viewTexts(root) {
    const [{ settings }, { models }] = await Promise.all([api("/api/admin/settings"), api("/api/admin/models")]);
    const groups = [
      ["Contacto", [["whatsapp", "WhatsApp (solo números, con código de país)", 1], ["phone", "Teléfono visible", 1], ["email", "Correo", 1], ["address", "Dirección", 1], ["instagram", "Enlace de Instagram", 1]]],
      ["Portada", [["heroEyebrow", "Frase chica sobre el título", 1], ["heroTitle", "Título principal", 1], ["heroCopy", "Texto de la portada", 3], ["heroModel", "Moto de la portada", "model"], ["usoOrder", "Orden de los filtros (separados por coma)", 2]]],
      ["Los tres bloques", [["trust1Title", "Bloque 1 · título", 1], ["trust1Text", "Bloque 1 · texto", 2], ["trust2Title", "Bloque 2 · título", 1], ["trust2Text", "Bloque 2 · texto", 2], ["trust3Title", "Bloque 3 · título", 1], ["trust3Text", "Bloque 3 · texto", 2]]],
      ["Cotización y pie", [["quoteTitle", "Título del formulario", 1], ["quoteCopy", "Texto del formulario", 3], ["footerNote", "Aviso legal al pie (precios y fotos)", 3]]],
    ];
    const inputs = {};
    const err = h("p", { class: "error", role: "alert", hidden: true });
    const form = h("form", { class: "settings", onsubmit: async (event) => {
      event.preventDefault(); err.hidden = true;
      try { await api("/api/admin/settings", { method: "PUT", body: JSON.stringify(Object.fromEntries(Object.entries(inputs).map(([k, el]) => [k, el.value]))) }); toast("Textos guardados."); }
      catch (error) { err.hidden = false; err.textContent = error.message; }
    } });
    for (const [title, fields] of groups) {
      const panel = h("div", { class: "panel", style: null }, h("h2", { text: title }));
      for (const [key, label, rows] of fields) {
        if (rows === "model") { inputs[key] = h("select", { class: "field-input" }, models.map((m) => h("option", { value: m.slug, text: m.name }))); inputs[key].value = settings[key]; }
        else inputs[key] = rows > 1 ? h("textarea", { class: "field-input", rows: String(rows), maxlength: "700", value: settings[key] }) : h("input", { class: "field-input", maxlength: "700", value: settings[key] });
        panel.append(h("label", { class: "f" }, label, inputs[key]));
      }
      form.append(panel);
    }
    form.append(err, h("button", { class: "btn btn-red", type: "submit" }, "Guardar textos"));
    root.append(h("div", { class: "a-title" }, h("h1", { text: "Textos del sitio" })), h("p", { class: "mute", text: "Si dejás un campo vacío, se usa el texto original." }), form);
  }

  fetch("/api/admin/login").then((r) => r.json()).then((d) => (d.ok ? showApp() : showLogin())).catch(showLogin);
})();
