import { type NextRequest } from "next/server";

const GEMINI_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

export async function POST(request: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return Response.json({ error: "GEMINI_API_KEY not configured" }, { status: 500 });
  }

  try {
    const body = await request.json();
    const { scriptures } = body as {
      scriptures: Array<{ passage: string; notes: string; type: string }>;
    };

    if (!scriptures || !Array.isArray(scriptures) || scriptures.length === 0) {
      return Response.json({
        readingSummary: "No scripture entries this week. Start logging your readings!",
        flashcards: [],
      });
    }

    const memorized = scriptures.filter((s) => s.type === "memorization");
    const readings = scriptures.filter((s) => s.type === "reading");

    const prompt = buildFlashcardPrompt(memorized, readings);

    const geminiResponse = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.6,
          maxOutputTokens: 2000,
          responseMimeType: "application/json",
        },
      }),
    });

    if (!geminiResponse.ok) {
      const errText = await geminiResponse.text();
      console.error("Gemini flashcard error:", errText);
      return Response.json({ error: "Flashcard generation failed" }, { status: 502 });
    }

    const geminiData = await geminiResponse.json();
    const rawText =
      geminiData?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

    let result;
    try {
      result = JSON.parse(rawText);
    } catch {
      result = {
        readingSummary: "Could not generate summary.",
        flashcards: [],
      };
    }

    return Response.json(result);
  } catch (err) {
    console.error("Flashcard route error:", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

function buildFlashcardPrompt(
  memorized: Array<{ passage: string; notes: string }>,
  readings: Array<{ passage: string; notes: string }>
): string {
  const memLines =
    memorized.length > 0
      ? memorized.map((m) => `- ${m.passage}: ${m.notes}`).join("\n")
      : "None this week.";

  const readLines =
    readings.length > 0
      ? readings.map((r) => `- ${r.passage}: ${r.notes}`).join("\n")
      : "None this week.";

  return `You are a Bible study assistant. A Christian student has been tracking their scripture memorization and Bible reading this week.

MEMORIZED VERSES:
${memLines}

BIBLE READINGS:
${readLines}

Generate a response in JSON format with exactly these fields:
{
  "readingSummary": "A 2-3 sentence summary connecting the themes from all the readings and memorized passages this week. Encourage the student and draw connections between passages. If no readings, acknowledge that.",
  "flashcards": [
    {
      "front": "The verse reference only (e.g. 'Romans 8:28')",
      "back": "The full text of the verse or a close paraphrase. If you know the exact verse text, use it. If not, provide the key teaching/meaning of the passage.",
      "hint": "A one-sentence contextual hint to help recall"
    }
  ]
}

Generate flashcards ONLY for memorized verses (not general readings). If no memorized verses, return an empty flashcards array. Each flashcard front should show the verse reference, back should show the verse text.`;
}
