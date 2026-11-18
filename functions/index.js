import { indexPage } from "../src/render.js";
import { PAGE_HEADERS, loadModels, loadSite } from "../src/lib/data.js";

// Portada del catálogo, armada con los datos actuales. Se guarda 1 minuto en caché: los cambios del panel se ven enseguida.
export async function onRequestGet({ env }) {
  const [site, models] = await Promise.all([loadSite(env.DB, env), loadModels(env.DB)]);
  return new Response(indexPage(site, models), { headers: { ...PAGE_HEADERS, "cache-control": "public, max-age=60" } });
}
