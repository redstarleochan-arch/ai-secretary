export const runtime = "nodejs";
export const maxDuration = 60;

const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

function trimError(text) {
  if (!text) return "";
  return text.length > 1200 ? text.slice(0, 1200) + "..." : text;
}

async function fileToBase64(file) {
  const arrayBuffer = await file.arrayBuffer();
  return Buffer.from(arrayBuffer).toString("base64");
}

function normalizeMimeType(file) {
  const type = file.type || "";

  if (type === "audio/mpeg") return "audio/mp3";
  if (type === "audio/mp3") return "audio/mp3";
  if (type === "audio/wav" || type === "audio/x-wav") return "audio/wav";
  if (type === "audio/aac") return "audio/aac";
  if (type === "audio/mp4") return "audio/mp4";
  if (type === "audio/x-m4a") return "audio/mp4";
  if (type === "audio/ogg") return "audio/ogg";
  if (type === "audio/flac") return "audio/flac";
  if (type === "audio/aiff") return "audio/aiff";
  if (type === "audio/webm" || type.includes("webm")) return "audio/webm";

  return type || "application/octet-stream";
}

function extractGeminiText(data) {
  const parts = data?.candidates?.[0]?.content?.parts || [];
  return parts.map((part) => part.text || "").join("\n").trim();
}

export async function POST(req) {
  try {
    if (!process.env.GEMINI_API_KEY) {
      return Response.json(
        { success: false, error: "Missing GEMINI_API_KEY in Vercel Environment Variables" },
        { status: 500 }
      );
    }

    const formData = await req.formData();
    const audio = formData.get("audio");

    if (!audio || typeof audio.arrayBuffer !== "function" || audio.size === 0) {
      return Response.json({ success: false, error: "No audio file received" }, { status: 400 });
    }

    const audioBase64 = await fileToBase64(audio);
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

    const geminiRes = await fetch(url, {
      method: "POST",
      headers: {
        "x-goog-api-key": process.env.GEMINI_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              {
                text:
                  "請將以下音訊準確轉寫成繁體中文/港式廣東話工作筆記。只輸出轉錄文字，不要分類、不要總結、不要加 markdown。保留人名、日期、出貨、客戶、金額、待跟進事項。",
              },
              {
                inlineData: {
                  mimeType: normalizeMimeType(audio),
                  data: audioBase64,
                },
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0,
        },
      }),
    });

    const rawText = await geminiRes.text();

    if (!geminiRes.ok) {
      throw new Error(`Gemini transcription failed. Status ${geminiRes.status}. ${trimError(rawText)}`);
    }

    let geminiJson;
    try {
      geminiJson = JSON.parse(rawText);
    } catch (err) {
      throw new Error("Gemini returned non-JSON HTTP response: " + trimError(rawText));
    }

    return Response.json({
      success: true,
      provider: "gemini",
      model: GEMINI_MODEL,
      transcript: extractGeminiText(geminiJson),
    });
  } catch (err) {
    return Response.json(
      { success: false, provider: "gemini", model: GEMINI_MODEL, error: err.message || "Unknown error" },
      { status: 500 }
    );
  }
}
