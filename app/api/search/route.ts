// app/api/search/route.ts
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

/** CORS helper */
function withCORS(res: Response) {
  res.headers.set("Access-Control-Allow-Origin", "*");
  res.headers.set("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.headers.set("Access-Control-Max-Age", "86400");
  return res;
}

export async function OPTIONS() {
  return withCORS(new Response(null, { status: 204 }));
}

/**
 * Decide if we should proxy to an external backend.
 * IMPORTANT: use a **server-side** var (NOT NEXT_PUBLIC_*) so it never leaks to the browser.
 * Set on Vercel → Project → Settings → Environment Variables:
 *   SERVER_API_BASE = https://api.yourdomain.com
 */
function getProxyBase(): string | null {
  const base =
    process.env.SERVER_API_BASE ||
    process.env.API_BASE ||               // optional alt name
    process.env.BACKEND_BASE ||           // optional alt name
    null;
  if (!base) return null;
  if (!/^https?:\/\//i.test(base)) return null;
  return base.replace(/\/+$/, ""); // trim trailing slash
}

/** Forward a GET request with the same query string */
async function proxyGET(req: Request, base: string) {
  const incoming = new URL(req.url);
  const target = `${base}/search${incoming.search || ""}`;

  const r = await fetch(target, {
    method: "GET",
    headers: {
      // Forward only safe headers; add auth if your backend expects one (e.g., BEARER_TOKEN)
      "Content-Type": "application/json",
      ...(process.env.BEARER_TOKEN
        ? { Authorization: `Bearer ${process.env.BEARER_TOKEN}` }
        : {}),
    },
    // External call – don’t cache
    cache: "no-store",
    // No credentials; different origin
  });

  const txt = await r.text();
  let json: any;
  try {
    json = txt ? JSON.parse(txt) : null;
  } catch {
    json = { raw: txt };
  }

  return withCORS(
    NextResponse.json(json ?? {}, { status: r.status || 200 })
  );
}

/** Forward a POST request with JSON body */
async function proxyPOST(req: Request, base: string) {
  const incoming = new URL(req.url);
  const target = `${base}/search${incoming.search || ""}`;
  const body = await req.text();

  const r = await fetch(target, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(process.env.BEARER_TOKEN
        ? { Authorization: `Bearer ${process.env.BEARER_TOKEN}` }
        : {}),
    },
    body,
    cache: "no-store",
  });

  const txt = await r.text();
  let json: any;
  try {
    json = txt ? JSON.parse(txt) : null;
  } catch {
    json = { raw: txt };
  }

  return withCORS(
    NextResponse.json(json ?? {}, { status: r.status || 200 })
  );
}

/** Fallback response when no backend is configured */
function fallbackOK(q?: string) {
  return withCORS(
    NextResponse.json(
      {
        ok: true,
        // shape keeps your UI happy while you migrate
        query: q || "",
        data: [],
        note:
          "SERVER_API_BASE not set; returning empty results from Next API fallback.",
      },
      { status: 200 }
    )
  );
}

/* ---------------------- Handlers ---------------------- */

export async function GET(req: Request) {
  const proxyBase = getProxyBase();
  if (proxyBase) {
    try {
      return await proxyGET(req, proxyBase);
    } catch (e: any) {
      return withCORS(
        NextResponse.json(
          { ok: false, error: e?.message || String(e) },
          { status: 502 }
        )
      );
    }
  }

  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") || "").trim();
  return fallbackOK(q);
}

export async function POST(req: Request) {
  const proxyBase = getProxyBase();
  if (proxyBase) {
    try {
      return await proxyPOST(req, proxyBase);
    } catch (e: any) {
      return withCORS(
        NextResponse.json(
          { ok: false, error: e?.message || String(e) },
          { status: 502 }
        )
      );
    }
  }

  // If you want to accept POST body in fallback, parse here:
  // const body = await req.json().catch(() => ({}));
  return fallbackOK();
}
