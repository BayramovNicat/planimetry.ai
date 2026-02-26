import { NextRequest, NextResponse } from "next/server";

const PROMPT = `Analyze this floor plan image. Detect every room and return its data.

For each room:
1. Read the room name exactly as labeled in the image
2. Read the area in m² exactly as labeled in the image
3. Detect the bounding box of the room's interior walls

Bounding box rules:
- Use normalized coordinates from 0 to 1000 where (0,0) = top-left, (1000,1000) = bottom-right of the image
- Format: [ymin, xmin, ymax, xmax]
- Each box must tightly fit the INNER wall edges of that room
- Rooms sharing a wall MUST share the same coordinate on that edge
- Boxes must NOT overlap — adjacent rooms touch but never intersect
- Pay close attention to the actual proportions: rooms are rarely square. A long narrow hallway should have a wide bbox, a small bathroom a compact one
- Trace the walls visible in the image, do not guess

Also extract the total apartment area if shown on the image.

Return ONLY valid JSON, no markdown, no extra text:
{
  "total_area": <number or null>,
  "rooms": [
    {
      "name": "<room name>",
      "area": <number>,
      "bbox": [<ymin>, <xmin>, <ymax>, <xmax>]
    }
  ]
}`;

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
          parts: [
            { inlineData: { mimeType, data: base64Data } },
            { text: PROMPT },
          ],
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
    return NextResponse.json(
      { error: "GEMINI_API_KEY not configured" },
      { status: 500 },
    );
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
    const res = await callGemini(
      GEMINI_API_KEY,
      mimeType,
      base64Data,
      AbortSignal.timeout(30_000),
    );

    let parsed: {
      total_area: number | null;
      rooms: { name: string; area: number; bbox: number[] }[];
    };
    try {
      parsed = JSON.parse(res);
    } catch {
      console.error("Parse failed:", res);
      return NextResponse.json(
        { error: "Failed to parse AI response" },
        { status: 502 },
      );
    }

    const rooms = parsed.rooms.map((room) => {
      const [ymin, xmin, ymax, xmax] = room.bbox;
      const pixelW = xmax - xmin;
      const pixelH = ymax - ymin;
      const ratio = pixelW && pixelH ? pixelW / pixelH : 1;

      const width = Math.sqrt(room.area * ratio);
      const height = Math.sqrt(room.area / ratio);

      return {
        name: room.name,
        area: room.area,
        width: Math.round(width * 100) / 100,
        height: Math.round(height * 100) / 100,
        bbox: room.bbox,
      };
    });

    return NextResponse.json({ total_area: parsed.total_area, rooms });
  } catch (err) {
    if (
      err instanceof DOMException &&
      (err.name === "TimeoutError" || err.name === "AbortError")
    ) {
      return NextResponse.json(
        { error: "AI took too long to respond. Please try again." },
        { status: 504 },
      );
    }
    console.error("Extract error:", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Failed to reach AI service",
      },
      { status: 502 },
    );
  }
}
