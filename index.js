/**
 * Cloudflare Worker — ponte segura entre o site/ADM e o Supabase/R2.
 *
 * Rotas:
 *  POST /api/event                 -> regista view/download (público, com dedupe)
 *  POST /api/admin/upload          -> upload de ficheiro para R2 (autenticado)
 *  POST /api/admin/delete-file     -> apaga ficheiro do R2 (autenticado)
 *
 * Bindings necessários (configurar no wrangler.toml / dashboard):
 *  - R2 bucket:           BUCKET
 *  - Variáveis secretas:  SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
 *  - Variável:            ALLOWED_ORIGINS (lista separada por vírgula)
 */

function corsHeaders(origin, allowedOrigins) {
  const allowed = allowedOrigins.split(",").map((o) => o.trim());
  const isAllowed = allowed.includes(origin) || allowed.includes("*");
  return {
    "Access-Control-Allow-Origin": isAllowed ? origin : allowed[0] || "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
  };
}

async function verifyAdmin(request, env) {
  const auth = request.headers.get("Authorization") || "";
  const token = auth.replace(/^Bearer\s+/i, "");
  if (!token) return null;

  const res = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: env.SUPABASE_ANON_KEY,
    },
  });
  if (!res.ok) return null;
  return res.json(); // dados do utilizador autenticado
}

async function handleEvent(request, env, cors) {
  const body = await request.json().catch(() => null);
  if (!body || !body.song_id || !body.event_type || !body.session_hash) {
    return new Response(JSON.stringify({ error: "dados inválidos" }), {
      status: 400,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/rpc/register_song_event`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify({
      p_song_id: body.song_id,
      p_event_type: body.event_type,
      p_session_hash: body.session_hash,
    }),
  });

  const data = await res.json();
  return new Response(JSON.stringify(data), {
    status: res.ok ? 200 : 500,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

async function handleUpload(request, env, cors) {
  const user = await verifyAdmin(request, env);
  if (!user) {
    return new Response(JSON.stringify({ error: "não autorizado" }), {
      status: 401,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const key = request.headers.get("X-File-Key"); // ex: music/artista/musica.mp3
  const contentType = request.headers.get("Content-Type") || "application/octet-stream";

  if (!key || key.includes("..")) {
    return new Response(JSON.stringify({ error: "chave de ficheiro inválida" }), {
      status: 400,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  await env.BUCKET.put(key, request.body, {
    httpMetadata: { contentType },
  });

  return new Response(JSON.stringify({ ok: true, key }), {
    status: 200,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

async function handleDelete(request, env, cors) {
  const user = await verifyAdmin(request, env);
  if (!user) {
    return new Response(JSON.stringify({ error: "não autorizado" }), {
      status: 401,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const body = await request.json().catch(() => null);
  if (!body || !body.key) {
    return new Response(JSON.stringify({ error: "chave em falta" }), {
      status: 400,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  await env.BUCKET.delete(body.key);
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const cors = corsHeaders(origin, env.ALLOWED_ORIGINS || "*");
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: cors });
    }

    try {
      if (url.pathname === "/api/event" && request.method === "POST") {
        return await handleEvent(request, env, cors);
      }
      if (url.pathname === "/api/admin/upload" && request.method === "POST") {
        return await handleUpload(request, env, cors);
      }
      if (url.pathname === "/api/admin/delete-file" && request.method === "POST") {
        return await handleDelete(request, env, cors);
      }
      return new Response(JSON.stringify({ error: "rota não encontrada" }), {
        status: 404,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }
  },
};
