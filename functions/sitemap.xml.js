import { sitemapXml } from "../src/render.js";
import { loadModels, loadSite } from "../src/lib/data.js";

export async function onRequestGet({ env }) {
  const [site, models] = await Promise.all([loadSite(env.DB, env), loadModels(env.DB)]);
  return new Response(sitemapXml(site, models), { headers: { "content-type": "application/xml; charset=utf-8", "cache-control": "public, max-age=3600" } });
}
