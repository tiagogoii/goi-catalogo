import { checkPassword, clearCookie, isAdmin, sessionCookie } from "../../../src/lib/auth.js";
import { fail, json, readJson } from "../../../src/lib/data.js";

export async function onRequestGet({ request, env }) {
  return json({ ok: await isAdmin(request, env) });
}

export async function onRequestPost({ request, env }) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return fail("Origen no permitido.", 403);
  const body = await readJson(request, 2048);
  if (!(await checkPassword(env, body?.password))) {
    await new Promise((resolve) => setTimeout(resolve, 600)); // frena los intentos repetidos
    return fail("La clave no es correcta.", 401);
  }
  return json({ ok: true }, 200, { "set-cookie": await sessionCookie(env, request) });
}

export async function onRequestDelete() {
  return json({ ok: true }, 200, { "set-cookie": clearCookie() });
}
