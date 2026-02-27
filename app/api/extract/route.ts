import { NextRequest, NextResponse } from "next/server";

import { calculateDimensions } from "../../utils/dimensions";

const PROMPT = `Extract all rooms from this floor plan. For each room return its name, area in m², and bounding box.

Bounding box: [ymin, xmin, ymax, xmax] in 0-1000 coordinates where (0,0)=top-left, (1000,1000)=bottom-right. Tightly fit each room's walls. Adjacent rooms must share the same edge coordinate. No overlaps. Match the visual proportions exactly.

Return total_area if labeled.

Return ONLY JSON: {"total_area": <number|null>, "rooms": [{"name": "<string>", "area": <number>, "bbox": [ymin, xmin, ymax, xmax]}]}`;

async function callGemini(
  apiKey: string,
  mimeType: string,
  base64Data: string,
  signal: AbortSignal,
) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal,
    body: JSON.stringify({
      contents: [
        {
          parts: [{ inlineData: { mimeType, data: base64Data } }, { text: PROMPT }],
        },
      ],
      generationConfig: {
        temperature: 0.0,
        thinkingConfig: { thinkingBudget: 0 },
      },
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini API error (${res.status}): ${errText}`);
  }

  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("No response from Gemini");

  return text
    .replace(/```json\s*/g, "")
    .replace(/```\s*/g, "")
    .trim();
}

export async function POST(request: NextRequest) {
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  if (!GEMINI_API_KEY) {
    return NextResponse.json({ error: "GEMINI_API_KEY not configured" }, { status: 500 });
  }

  let body: { image: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { image } = body;
  if (!image) {
    return NextResponse.json({ error: "No image provided" }, { status: 400 });
  }

  const match = image.match(/^data:(image\/\w+);base64,(.+)$/);
  if (!match) {
    return NextResponse.json(
      { error: "Invalid image format — expected a data URL" },
      { status: 400 },
    );
  }

  const mimeType = match[1];
  const base64Data = match[2];

  try {
    const res = await callGemini(GEMINI_API_KEY, mimeType, base64Data, AbortSignal.timeout(30_000));

    let parsed: {
      total_area: number | null;
      rooms: { name: string; area: number; bbox: number[] }[];
    };
    try {
      parsed = JSON.parse(res);
    } catch {
      console.error("Parse failed:", res);
      return NextResponse.json({ error: "Failed to parse AI response" }, { status: 502 });
    }

    const rooms = parsed.rooms.map((room) => {
      const [ymin, xmin, ymax, xmax] = room.bbox;
      const pixelW = xmax - xmin;
      const pixelH = ymax - ymin;

      const { width, height } = calculateDimensions(pixelW || 1, pixelH || 1, room.area);

      return {
        name: room.name,
        area: room.area,
        width,
        height,
        bbox: room.bbox,
      };
    });

    return NextResponse.json({ total_area: parsed.total_area, rooms });
  } catch (err) {
    if (err instanceof DOMException && (err.name === "TimeoutError" || err.name === "AbortError")) {
      return NextResponse.json(
        { error: "AI took too long to respond. Please try again." },
        { status: 504 },
      );
    }
    console.error("Extract error:", err);
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "Failed to reach AI service",
      },
      { status: 502 },
    );
  }
}
