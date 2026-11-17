// Comportamiento del catálogo. Sin librerías: la página ya viene completa en el HTML y esto solo la mejora.
(function () {
  "use strict";
  var money = function (n) { return "$ " + new Intl.NumberFormat("es-AR").format(n); };
  var today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Argentina/Buenos_Aires" });

  // 1) Precio sugerido de Honda: pasada su vigencia, se reemplaza por "Consultá el precio vigente".
  document.querySelectorAll(".price-box[data-valid-to]").forEach(function (box) {
    var until = box.getAttribute("data-valid-to");
    if (until && until < today) {
      var on = box.querySelector(".price-on"), off = box.querySelector(".price-off");
      if (on) on.hidden = true;
      if (off) off.hidden = false;
      box.setAttribute("data-price", "0");
      var item = box.closest(".card-item");
      if (item) item.setAttribute("data-price", "0");
    }
  });
  document.querySelectorAll(".card-item[data-valid-to]").forEach(function (item) {
    var until = item.getAttribute("data-valid-to");
    if (until && until < today) item.setAttribute("data-price", "0");
  });
  document.querySelectorAll(".versions").forEach(function (list) {
    var box = document.querySelector(".price-box");
    if (box && box.getAttribute("data-valid-to") && box.getAttribute("data-valid-to") < today) list.hidden = true;
  });

  // 2) Buscador, filtro por tipo y orden.
  var grid = document.getElementById("grid");
  if (grid) {
    var items = Array.prototype.slice.call(grid.children);
    var chips = Array.prototype.slice.call(document.querySelectorAll(".chip"));
    var q = document.getElementById("q"), sort = document.getElementById("sort");
    var count = document.getElementById("count"), empty = document.getElementById("empty");
    var uso = "";
    var norm = function (s) { return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, ""); };

    var apply = function () {
      var text = norm(q.value.trim());
      var shown = items.filter(function (li) {
        var ok = (!uso || li.getAttribute("data-uso") === uso) && (!text || norm(li.getAttribute("data-name") + " " + li.getAttribute("data-segment") + " " + li.getAttribute("data-uso")).indexOf(text) !== -1);
        li.hidden = !ok;
        return ok;
      });
      var price = function (li) { return Number(li.getAttribute("data-price")) || 0; };
      var order = function (li) { return Number(li.getAttribute("data-order")); };
      var sorted = items.slice().sort(function (a, b) {
        if (sort.value === "order") return order(a) - order(b);
        // Las motos sin precio vigente van siempre al final.
        if (!price(a) || !price(b)) return (price(a) ? 0 : 1) - (price(b) ? 0 : 1);
        return sort.value === "asc" ? price(a) - price(b) : price(b) - price(a);
      });
      sorted.forEach(function (li) { grid.appendChild(li); });
      count.textContent = shown.length === 1 ? "1 moto" : shown.length + " motos";
      empty.hidden = shown.length > 0;
    };

    chips.forEach(function (chip) {
      chip.addEventListener("click", function () {
        uso = chip.getAttribute("data-uso");
        chips.forEach(function (c) { c.setAttribute("aria-pressed", String(c === chip)); });
        apply();
      });
    });
    q.addEventListener("input", apply);
    sort.addEventListener("change", apply);
    document.getElementById("reset").addEventListener("click", function () {
      q.value = ""; uso = ""; sort.value = "order";
      chips.forEach(function (c) { c.setAttribute("aria-pressed", String(c.getAttribute("data-uso") === "")); });
      apply();
    });
  }

  // 3) Galería de la ficha.
  var main = document.getElementById("gallery-main");
  if (main) {
    document.querySelectorAll(".thumbs button").forEach(function (btn) {
      btn.addEventListener("click", function () {
        main.src = btn.getAttribute("data-src");
        document.querySelectorAll(".thumbs button").forEach(function (b) { b.removeAttribute("aria-current"); });
        btn.setAttribute("aria-current", "true");
      });
    });
  }

  // 4) Formulario de cotización: arma el mensaje y abre WhatsApp (no hay servidor: nada se guarda en esta página).
  var form = document.getElementById("quote");
  if (form) {
    var f = form.elements;
    var wanted = new URLSearchParams(location.search).get("modelo");
    if (wanted) {
      Array.prototype.forEach.call(f.model.options, function (o) { if (o.value === wanted) f.model.value = wanted; });
    }
    form.addEventListener("submit", function (event) {
      event.preventDefault();
      var name = f.name.value.trim();
      f.name.classList.toggle("invalid", !name);
      if (!name) { f.name.focus(); return; }
      var parts = ["Hola GOI, soy " + name + "."];
      parts.push(f.model.value ? "Quiero consultar por la " + f.model.value + "." : "Quiero consultar por una moto.");
      if (f.message.value.trim()) parts.push(f.message.value.trim());
      window.open("https://wa.me/" + window.GOI.whatsapp + "?text=" + encodeURIComponent(parts.join(" ")), "_blank", "noopener");
    });
  }
})();
