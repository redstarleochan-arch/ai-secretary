export const runtime = "nodejs";
export const maxDuration = 60;

const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

function trimError(text) {
  if (!text) return "";
  return text.length > 1500 ? text.slice(0, 1500) + "..." : text;
}

async function fileToBase64(file) {
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  return buffer.toString("base64");
}

function normalizeMimeType(file) {
  const type = file.type || "";

  if (type.startsWith("image/")) return type;

  if (type === "audio/mpeg") return "audio/mp3";
  if (type === "audio/mp3") return "audio/mp3";
  if (type === "audio/wav" || type === "audio/x-wav") return "audio/wav";
  if (type === "audio/aac") return "audio/aac";
  if (type === "audio/mp4") return "audio/mp4";
  if (type === "audio/x-m4a") return "audio/mp4";
  if (type === "audio/ogg") return "audio/ogg";
  if (type === "audio/flac") return "audio/flac";
  if (type === "audio/aiff") return "audio/aiff";

  // Chrome browser recording often gives audio/webm.
  // Gemini may or may not accept it depending on current API support.
  // Keep it as-is so the API returns a clear error if unsupported.
  if (type === "audio/webm" || type.includes("webm")) return "audio/webm";

  return type || "application/octet-stream";
}

function extractGeminiText(data) {
  const parts = data?.candidates?.[0]?.content?.parts || [];
  return parts.map((part) => part.text || "").join("\n").trim();
}

function parseJsonLoose(text) {
  if (!text) return {};

  let cleaned = text.trim();

  if (cleaned.startsWith("```json")) {
    cleaned = cleaned.replace(/^```json/i, "").replace(/```$/i, "").trim();
  } else if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```/i, "").replace(/```$/i, "").trim();
  }

  try {
    return JSON.parse(cleaned);
  } catch (err) {
    return { raw: text };
  }
}

export async function POST(req) {
  let stage = "start";

  try {
    if (!process.env.GEMINI_API_KEY) {
      return Response.json(
        {
          success: false,
          provider: "gemini",
          stage: "env",
          error: "Missing GEMINI_API_KEY in Vercel Environment Variables",
        },
        { status: 500 }
      );
    }

    stage = "reading-form";
    const formData = await req.formData();

    const notes = formData.get("notes")?.toString() || "";

    const audio = formData.get("audio");

    const images = formData
      .getAll("images")
      .filter(
        (file) =>
          file &&
          typeof file.arrayBuffer === "function" &&
          file.size > 0
      );

    const audioInfo =
      audio && typeof audio.arrayBuffer === "function" && audio.size > 0
        ? {
            name: audio.name || "unknown",
            type: audio.type || "unknown",
            normalized_type: normalizeMimeType(audio),
            size: audio.size,
          }
        : null;

    stage = "building-gemini-parts";

    const instruction = `
你係一個 AI 秘書 / Chief of Staff。

用戶會提交：
1. 錄音檔，可能係廣東話工作 dump
2. 圖片，例如手寫 notes、白板、表格、截圖
3. 額外文字補充

你要直接從錄音、圖片、文字入面抽取工作任務。
如果有錄音，請先理解/轉錄內容，再整合入任務分析。
如果有圖片，請讀取圖片入面嘅文字、手寫內容、表格或白板資訊。

請只輸出 JSON，唔好加 markdown，唔好加解釋。

JSON 格式必須係：

{
  "summary": "一句總結",
  "audio_transcript": "如果有錄音，請在這裏放廣東話/繁中轉錄；沒有就寫空字串",
  "image_notes": "如果有圖片，請在這裏總結圖片內容；沒有就寫空字串",
  "top_3_risks": [
    {
      "title": "",
      "why_it_matters": "",
      "next_action": ""
    }
  ],
  "critical": [
    {
      "title": "",
      "owner_or_waiting_for": "",
      "deadline_or_follow_up": "",
      "risk": "",
      "next_action": ""
    }
  ],
  "waiting": [
    {
      "title": "",
      "waiting_for": "",
      "last_known_status": "",
      "risk": "",
      "next_follow_up": ""
    }
  ],
  "follow_up": [
    {
      "title": "",
      "who_to_follow_up": "",
      "when": "",
      "message_hint": ""
    }
  ],
  "low_priority": [
    {
      "title": "",
      "reason": ""
    }
  ],
  "boss_update": {
    "today_focus": [],
    "blocked_items": [],
    "decisions_needed": []
  },
  "raw_extracted_items": []
}

分類規則：
- Critical：唔處理會出事、老闆會問、客戶會爆、影響收入 / delivery / operation。
- Waiting：等緊其他人覆或處理。
- Follow-up：用戶需要主動追。
- Low Priority：有空先做。
- 如果資料唔清楚，要標記 "unclear"，唔好亂作。
- 用繁體中文 / 港式廣東話，簡潔直接。

用戶補充文字：
${notes || "(沒有補充文字)"}

檔案狀態：
- audio: ${audioInfo ? JSON.stringify(audioInfo) : "沒有錄音"}
- images: ${images.length} 張
`;

    const parts = [
      {
        text: instruction,
      },
    ];

    if (audio && typeof audio.arrayBuffer === "function" && audio.size > 0) {
      const audioBase64 = await fileToBase64(audio);

      parts.push({
        inlineData: {
          mimeType: normalizeMimeType(audio),
          data: audioBase64,
        },
      });
    }

    for (const image of images) {
      const imageBase64 = await fileToBase64(image);

      parts.push({
        inlineData: {
          mimeType: normalizeMimeType(image),
          data: imageBase64,
        },
      });
    }

    stage = "gemini-generate-content";

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
            parts,
          },
        ],
        generationConfig: {
          temperature: 0.2,
          responseMimeType: "application/json",
        },
      }),
    });

    const rawText = await geminiRes.text();

    if (!geminiRes.ok) {
      throw new Error(
        `Gemini API failed. Status ${geminiRes.status}. ${trimError(rawText)}`
      );
    }

    let geminiJson;

    try {
      geminiJson = JSON.parse(rawText);
    } catch (err) {
      throw new Error(
        "Gemini returned non-JSON HTTP response: " + trimError(rawText)
      );
    }

    const outputText = extractGeminiText(geminiJson);
    const analysis = parseJsonLoose(outputText);

    return Response.json({
      success: true,
      provider: "gemini",
      model: GEMINI_MODEL,
      stage: "done",
      transcript: analysis.audio_transcript || "",
      image_count: images.length,
      audio_info: audioInfo,
      notes,
      analysis,
    });
  } catch (err) {
    return Response.json(
      {
        success: false,
        provider: "gemini",
        model: GEMINI_MODEL,
        stage,
        error: err.message || "Unknown error",
      },
      { status: 500 }
    );
  }
}
