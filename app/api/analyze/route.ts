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
    const { weekData, scriptures } = body as {
      weekData: Array<{
        date: string;
        habits: Record<string, string | false | true>;
        scriptures?: Array<{ passage: string; notes: string; type: string }>;
      }>;
      scriptures?: Array<{ passage: string; notes: string; type: string }>;
    };

    if (!weekData || !Array.isArray(weekData)) {
      return Response.json({ error: "Missing weekData" }, { status: 400 });
    }

    const prompt = buildAnalysisPrompt(weekData, scriptures);

    const geminiResponse = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 1500,
          responseMimeType: "application/json",
        },
      }),
    });

    if (!geminiResponse.ok) {
      const errText = await geminiResponse.text();
      console.error("Gemini API error:", errText);
      return Response.json({ error: "AI analysis failed" }, { status: 502 });
    }

    const geminiData = await geminiResponse.json();
    const rawText =
      geminiData?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

    let analysis;
    try {
      analysis = JSON.parse(rawText);
    } catch {
      analysis = {
        summary: rawText || "Could not generate analysis this week.",
        wins: [],
        patterns: [],
        actionItems: [],
        scriptureReview: "",
      };
    }

    return Response.json(analysis);
  } catch (err) {
    console.error("Analyze route error:", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

function buildAnalysisPrompt(
  weekData: Array<{
    date: string;
    habits: Record<string, string | false | true>;
    scriptures?: Array<{ passage: string; notes: string; type: string }>;
  }>,
  allScriptures?: Array<{ passage: string; notes: string; type: string }>
): string {
  const habitLines = weekData
    .map((day) => {
      const entries = Object.entries(day.habits)
        .map(([key, value]) => {
          if (value === false) return `  - ${key}: ❌ NOT DONE`;
          if (value === true) return `  - ${key}: ✅ DONE (time not recorded)`;
          return `  - ${key}: ✅ DONE at ${new Date(value).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`;
        })
        .join("\n");

      const scriptureLines =
        day.scriptures && day.scriptures.length > 0
          ? "\n  Scriptures:\n" +
            day.scriptures
              .map((s) => `    - [${s.type}] ${s.passage}: ${s.notes}`)
              .join("\n")
          : "";

      return `${day.date}:\n${entries}${scriptureLines}`;
    })
    .join("\n\n");

  const allScriptureContext =
    allScriptures && allScriptures.length > 0
      ? `\n\nAll scripture entries this week:\n${allScriptures.map((s) => `- [${s.type}] ${s.passage}: ${s.notes}`).join("\n")}`
      : "";

  return `You are a Christian accountability partner and performance coach. Analyze this person's weekly habit data and provide honest, motivating feedback.

HABIT DATA FOR THE WEEK:
${habitLines}
${allScriptureContext}

The habits tracked are:
- morningPrayer: Morning prayer routine
- scriptureMemorization: Memorizing Bible verses
- nightReflectionPrayer: Evening reflection prayer
- leetCodeTwoProblems: Solving 2 LeetCode coding problems
- mernPractice: MERN stack web development practice
- technicalReading: Reading technical documentation
- communicationPractice: Practicing communication skills
- physicalActivity: 20-30 min exercise
- hydrationGoal: Drinking enough water
- noFap: Maintaining sexual discipline
- noMindlessScrolling: Avoiding mindless social media
- planNextDay: Planning tomorrow's tasks

Respond in JSON format with exactly these fields:
{
  "summary": "2-3 sentence overall assessment of the week. Be honest but encouraging.",
  "wins": ["array of 2-3 specific things that went well, reference actual data"],
  "patterns": ["array of 2-3 patterns noticed, especially timing issues like morning habits done late at night, or habits consistently missed on certain days"],
  "actionItems": ["array of 3 specific, actionable things to improve next week"],
  "scriptureReview": "If there are scripture entries, provide a brief spiritual summary connecting the passages read/memorized this week. If no scripture data, say 'No scripture entries recorded this week.'"
}`;
}
