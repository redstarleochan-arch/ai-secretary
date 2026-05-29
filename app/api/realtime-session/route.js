export const runtime = "nodejs";

export async function POST(req) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return Response.json(
        {
          success: false,
          error: "Missing OPENAI_API_KEY in Vercel Environment Variables"
        },
        { status: 500 }
      );
    }

    const sdp = await req.text();

    if (!sdp || !sdp.includes("v=0")) {
      return Response.json(
        {
          success: false,
          error: "Invalid SDP received from browser"
        },
        { status: 400 }
      );
    }

    const sessionConfig = {
      type: "transcription",
      audio: {
        input: {
          transcription: {
            model: "gpt-realtime-whisper",
            language: "zh",
            delay: "low"
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

    const responseText = await openaiRes.text();

    if (!openaiRes.ok) {
      return Response.json(
        {
          success: false,
          status: openaiRes.status,
          error: responseText
        },
        { status: openaiRes.status }
      );
    }

    return new Response(responseText, {
      status: 200,
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
      { status: 500 }
    );
  }
}
