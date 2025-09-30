import type { NextApiRequest, NextApiResponse } from "next";

export default function handler(_req: NextApiRequest, res: NextApiResponse) {
  res.status(200).json({
    ok: true,
    router: "pages-api",
    hasDuffelKey: Boolean(process.env.DUFFEL_KEY || process.env.DUFFEL_TOKEN),
    duffelVersion: process.env.DUFFEL_VERSION || "beta",
    now: new Date().toISOString(),
  });
}
