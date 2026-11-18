import { modelPage, notFoundPage } from "../../src/render.js";
import { PAGE_HEADERS, loadModel, loadSite } from "../../src/lib/data.js";

// Ficha de una moto. Funciona con y sin barra final (/modelos/xr150l y /modelos/xr150l/).
export async function onRequestGet({ params, env }) {
  const [site, model] = await Promise.all([loadSite(env.DB, env), loadModel(env.DB, params.slug)]);
  const headers = { ...PAGE_HEADERS, "cache-control": "public, max-age=60" };
  if (!model) return new Response(notFoundPage(site), { status: 404, headers: { ...headers, "cache-control": "no-store" } });
  return new Response(modelPage(site, model), { headers });
}
