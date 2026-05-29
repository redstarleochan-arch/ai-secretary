import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req) {
  try {
    const body = await req.json();

    const prompt = `
You are an AI operations assistant.

Analyze the following task dump.

Categorize into:
- Critical
- Waiting
- Follow-up
- Low Priority

Also identify:
- Risks
- Owners
- Next Actions

Return JSON only.

Task dump:
${body.text}
`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You are an operational executive assistant.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.2,
    });

    const output = completion.choices[0].message.content;

    return Response.json({
      success: true,
      result: output,
    });
  } catch (err) {
    return Response.json({
      success: false,
      error: err.message,
    });
  }
}
