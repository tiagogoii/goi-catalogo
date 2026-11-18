import { requireAdmin } from "../../../src/lib/auth.js";
import { json, loadModels } from "../../../src/lib/data.js";

// Todas las motos (también las ocultas) para el panel.
export async function onRequestGet({ request, env }) {
  const denied = await requireAdmin(request, env);
  if (denied) return denied;
  return json({ models: await loadModels(env.DB, { onlyActive: false }) });
}
