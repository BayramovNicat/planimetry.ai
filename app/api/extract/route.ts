import { NextRequest, NextResponse } from "next/server";

import { calculateDimensions } from "../../utils/dimensions";

const PROMPT = `Extract all rooms from this floor plan. For each room return its name, area in m², and bounding box.

Bounding box: [ymin, xmin, ymax, xmax] in 0-1000 coordinates where (0,0)=top-left, (1000,1000)=bottom-right. Tightly fit each room's walls. Adjacent rooms must share the same edge coordinate. No overlaps. Match the visual proportions exactly.

Return total_area if labeled.

Return ONLY JSON: {"total_area": <number|null>, "rooms": [{"name": "<string>", "area": <number>, "bbox": [ymin, xmin, ymax, xmax]}]}`;

type Provider = "gemini" | "openai";

function getProvider(): Provider {
  const p = process.env.AI_PROVIDER?.toLowerCase();
  if (p === "gemini") return "gemini";
  return "openai";
}

function buildGeminiRequest(mimeType: string, base64Data: string) {
  const baseUrl = process.env.AI_BASE_URL || "https://generativelanguage.googleapis.com/v1beta";
  const model = process.env.AI_MODEL || "gemini-2.5-flash";
  const apiKey = process.env.AI_KEY;

  return {
    url: `${baseUrl}/models/${model}:generateContent?key=${apiKey}`,
    headers: { "Content-Type": "application/json" },
    body: {
      contents: [
        {
          parts: [{ inlineData: { mimeType, data: base64Data } }, { text: PROMPT }],
        },
      ],
      generationConfig: {
        temperature: 0.0,
        thinkingConfig: { thinkingBudget: 0 },
      },
    },
  };
}

function buildOpenAIRequest(mimeType: string, base64Data: string) {
  const baseUrl = process.env.AI_BASE_URL || "https://openrouter.ai/api/v1";
  const model = process.env.AI_MODEL || "openrouter/auto";
  const apiKey = process.env.AI_KEY;

  return {
    url: `${baseUrl}/chat/completions`,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: {
      model,
      temperature: 0.0,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: { url: `data:${mimeType};base64,${base64Data}` },
            },
            { type: "text", text: PROMPT },
          ],
        },
      ],
    },
  };
}

function extractText(provider: Provider, data: Record<string, unknown>): string | undefined {
  if (provider === "openai") {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (data as any).choices?.[0]?.message?.content;
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data as any).candidates?.[0]?.content?.parts?.[0]?.text;
}

async function callAI(mimeType: string, base64Data: string, signal: AbortSignal) {
  const provider = getProvider();
  const { url, headers, body } =
    provider === "openai"
      ? buildOpenAIRequest(mimeType, base64Data)
      : buildGeminiRequest(mimeType, base64Data);

  const res = await fetch(url, {
    method: "POST",
    headers,
    signal,
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`AI API error (${res.status}): ${errText}`);
  }

  const data = await res.json();
  const text = extractText(provider, data);
  if (!text) throw new Error("No response from AI");

  return text
    .replace(/```json\s*/g, "")
    .replace(/```\s*/g, "")
    .trim();
}

export async function POST(request: NextRequest) {
  if (!process.env.AI_KEY) {
    return NextResponse.json({ error: "AI_KEY not configured" }, { status: 500 });
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
    const res = await callAI(mimeType, base64Data, AbortSignal.timeout(30_000));

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
      { error: "Failed to analyze the floor plan. Please try again later." },
      { status: 502 },
    );
  }
}
