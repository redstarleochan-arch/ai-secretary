import OpenAI from "openai";

export const runtime = "nodejs";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req) {
  try {
    const formData = await req.formData();
    const audio = formData.get("audio");

    if (!audio) {
      return Response.json({
        success: false,
        error: "No audio file received",
      });
    }

    const transcript = await openai.audio.transcriptions.create({
      file: audio,
      model: "gpt-4o-mini-transcribe",
      response_format: "text",
      prompt:
        "This is a Cantonese / Traditional Chinese task dump. Transcribe accurately. Keep names, deadlines, task details, risks, and follow-up items.",
    });

    return Response.json({
      success: true,
      transcript,
    });
  } catch (err) {
    return Response.json({
      success: false,
      error: err.message,
    });
  }
}
