// Sirve las fotos subidas desde el panel. Cada foto tiene su propio número y no se modifica.
export async function onRequestGet({ params, env }) {
  const id = Number(params.id);
  if (!Number.isSafeInteger(id) || id < 1) return new Response("No encontrada", { status: 404 });
  const row = await env.DB.prepare("SELECT mime, data FROM media WHERE id = ?").bind(id).first();
  if (!row) return new Response("No encontrada", { status: 404 });
  const bytes = Uint8Array.from(atob(row.data), (char) => char.charCodeAt(0));
  return new Response(bytes, { headers: { "content-type": row.mime, "cache-control": "public, max-age=31536000, immutable", "x-content-type-options": "nosniff" } });
}
