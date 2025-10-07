import type { NextApiRequest, NextApiResponse } from "next";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const q = String(req.query.q || "").trim();
    if (q.length < 2) return res.status(200).json({ data: [] });

    const token = process.env.DUFFEL_KEY || process.env.DUFFEL_TOKEN;
    if (!token) {
      return res.status(500).json({ data: [], error: "Missing DUFFEL_KEY env var" });
    }

    const r = await fetch(
      `https://api.duffel.com/places/suggestions?name=${encodeURIComponent(q)}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Duffel-Version": process.env.DUFFEL_VERSION || "beta",
          Accept: "application/json",
        },
        cache: "no-store",
      }
    );

    const text = await r.text();
    res.status(r.status).setHeader("content-type", "application/json").send(text || `{"data":[]}`);
  } catch (e: any) {
    res.status(500).json({ data: [], error: String(e?.message || e) });
  }
}
