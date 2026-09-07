import { NextResponse } from "next/server";
import { requireDriver } from "@/lib/driver-session";

const ANPR_URL = "https://api.anpr.software/v1/detect";

export async function POST(req: Request) {
  const auth = requireDriver(req);
  if (auth instanceof Response) return auth;

  let body: { image?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const { image } = body || {};
  if (!image) {
    return NextResponse.json({ error: "image (base64) is required" }, { status: 400 });
  }

  const apiKey = process.env.ANPR_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "ANPR service not configured" }, { status: 400 });
  }

  try {
    const base64Data = image.includes(",") ? image.split(",")[1] : image;
    const buffer = Buffer.from(base64Data, "base64");

    const formData = new FormData();
    formData.append("file", new Blob([buffer], { type: "image/jpeg" }), "plate.jpg");

    const anprRes = await fetch(ANPR_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: formData,
    });
    const data = (await anprRes.json().catch(() => ({}))) as {
      success?: boolean;
      plates?: Array<{ text?: { plate_number_en?: string | null }; attributes?: { color?: string | null } | null }>;
      body?: { brand?: { label?: string | null }; model?: { label?: string | null }; color?: { name?: string | null } | null };
    };

    if (!data.success || !data.plates?.length) {
      return NextResponse.json({ plate: null, make: null, model: null, color: null });
    }

    const plate = data.plates[0];
    const plateNumber = plate.text?.plate_number_en || null;
    const make = data.body?.brand?.label || null;
    const rawModel = data.body?.model?.label || null;
    const model = rawModel ? rawModel.split("|").pop()?.replace(/-/g, " ") || rawModel : null;
    const color = data.body?.color?.name || plate.attributes?.color || null;

    return NextResponse.json({ plate: plateNumber, make, model, color });
  } catch (err) {
    console.error("[driver-scan-plate]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}