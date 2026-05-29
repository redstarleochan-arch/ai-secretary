export const runtime = "nodejs";

export async function POST(req) {
  try {
    const sdp = await req.text();

    const sessionConfig = {
      type: "realtime",
      model: "gpt-realtime-mini",
      output_modalities: ["text"],
      instructions:
        "You are an AI secretary for a Cantonese-speaking user. The user will dump tasks by voice. Do not generate long replies. Focus on accurate transcription and operational task capture.",
      audio: {
        input: {
          transcription: {
            model: "gpt-realtime-whisper",
            language: "zh",
            delay: "low"
          },
          turn_detection: {
            type: "server_vad",
            create_response: false,
            interrupt_response: false
          }
        }
      }
    };

    const fd = new FormData();
    fd.set("sdp", sdp);
    fd.set("session", JSON.stringify(sessionConfig));

    const openaiRes = await fetch("https://api.openai.com/v1/realtime/calls", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "OpenAI-Safety-Identifier": "leo-ai-secretary"
      },
      body: fd
    });

    if (!openaiRes.ok) {
      const errorText = await openaiRes.text();
      return new Response(errorText, {
        status: openaiRes.status
      });
    }

    const answerSdp = await openaiRes.text();

    return new Response(answerSdp, {
      headers: {
        "Content-Type": "application/sdp"
      }
    });
  } catch (err) {
    return Response.json(
      {
        success: false,
        error: err.message
      },
      {
        status: 500
      }
    );
  }
}
