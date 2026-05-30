export const runtime = "nodejs";
export const maxDuration = 60;

async function fileToDataUrl(file) {
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const base64 = buffer.toString("base64");
  const mimeType = file.type || "image/jpeg";
  return `data:${mimeType};base64,${base64}`;
}

function trimError(text) {
  if (!text) return "";
  return text.length > 1200 ? text.slice(0, 1200) + "..." : text;
}

async function transcribeAudio(audioFile) {
  const fd = new FormData();
  fd.append("file", audioFile, audioFile.name || "audio.webm");
  fd.append("model", "gpt-4o-mini-transcribe");
  fd.append("response_format", "text");
  fd.append(
    "prompt",
    "This is a Cantonese / Traditional Chinese work task dump. Transcribe accurately. Keep names, dates, deadlines, owners, risks, and follow-up details."
  );

  const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: fd,
  });

  const text = await res.text();

  if (!res.ok) {
    throw new Error(
      `Transcription API failed. Status ${res.status}. ${trimError(text)}`
    );
  }

  return text;
}

export async function POST(req) {
  let stage = "start";

  try {
    if (!process.env.OPENAI_API_KEY) {
      return Response.json(
        {
          success: false,
          stage: "env",
          error: "Missing OPENAI_API_KEY in Vercel Environment Variables",
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

    let transcript = "";
    let audioInfo = null;

    if (audio && typeof audio.arrayBuffer === "function" && audio.size > 0) {
      audioInfo = {
        name: audio.name || "unknown",
        type: audio.type || "unknown",
        size: audio.size,
      };

      stage = "transcription";
      transcript = await transcribeAudio(audio);
    }

    stage = "image-conversion";
    const content = [
      {
        type: "text",
        text: `
你係一個 AI 秘書 / Chief of Staff。用戶會提交：
1. 語音轉錄文字
2. 圖片，例如手寫 notes、白板、表格、截圖
3. 額外文字補充

你要將所有資料整合，抽取工作任務。

請輸出 JSON，格式必須係：

{
  "summary": "一句總結",
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

語音轉錄：
${transcript || "(沒有錄音)"}

用戶補充文字：
${notes || "(沒有補充文字)"}
        `,
      },
    ];

    for (const image of images) {
      const dataUrl = await fileToDataUrl(image);

      content.push({
        type: "image_url",
        image_url: {
          url: dataUrl,
          detail: "high",
        },
      });
    }

    stage = "analysis";

    const analysisRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content:
              "You are an operational AI secretary. Extract tasks, risks, waiting items, and follow-ups from messy Cantonese work notes, audio transcripts, and images.",
          },
          {
            role: "user",
            content,
          },
        ],
        temperature: 0.2,
        response_format: {
          type: "json_object",
        },
      }),
    });

    const analysisTextRaw = await analysisRes.text();

    if (!analysisRes.ok) {
      throw new Error(
        `Analysis API failed. Status ${analysisRes.status}. ${trimError(
          analysisTextRaw
        )}`
      );
    }

    const analysisJson = JSON.parse(analysisTextRaw);
    const analysisText =
      analysisJson.choices?.[0]?.message?.content || "{}";

    let analysis;
    try {
      analysis = JSON.parse(analysisText);
    } catch (err) {
      analysis = {
        raw: analysisText,
      };
    }

    return Response.json({
      success: true,
      stage: "done",
      transcript,
      image_count: images.length,
      audio_info: audioInfo,
      notes,
      analysis,
    });
  } catch (err) {
    return Response.json(
      {
        success: false,
        stage,
        error: err.message || "Unknown error",
      },
      { status: 500 }
    );
  }
}
