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
    const { weekData, scriptures, goals } = body as {
      weekData: Array<{
        date: string;
        habits: Record<string, string | false | true>;
        scriptures?: Array<{ passage: string; notes: string; type: string }>;
      }>;
      scriptures?: Array<{ passage: string; notes: string; type: string }>;
      goals?: Array<{ text: string; type: string }>;
    };

    if (!weekData || !Array.isArray(weekData)) {
      return Response.json({ error: "Missing weekData" }, { status: 400 });
    }

    const prompt = buildAnalysisPrompt(weekData, scriptures, goals);

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
        epicTrailer: "In a world of distractions, one developer stood up to build. But the servers went down, and the AI could not generate the reflection this week. Stay tuned for the next episode.",
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
  allScriptures?: Array<{ passage: string; notes: string; type: string }>,
  goals?: Array<{ text: string; type: string }>
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
      ? `\n\nAll custom log entries this week (includes Bible readings, LeetCode problems solved, MERN stack features built):\n${allScriptures.map((s) => `- [${s.type}] ${s.passage} ${s.notes ? `(${s.notes})` : ""}`).join("\n")}`
      : "";

  const goalsContext = goals && goals.length > 0
    ? `\n\nUSER'S LIFE GOALS & MOTIVATIONS:\n${goals.map((g) => `- [${g.type.toUpperCase()}] ${g.text}`).join("\n")}\n\nUse these goals as aggressive leverage to intensely motivate the user. Remind them why they are bleeding for this. Cut the generic advice and be sharp.`
    : "";

  return `You are a Christian accountability partner and performance coach. Analyze this person's weekly habit data and provide honest, motivating feedback.
${goalsContext}

HABIT DATA FOR THE WEEK:
${habitLines}
${allScriptureContext}

The habits tracked are:
- morningPrayer: Morning prayer routine
- bibleReading: Reading Bible portions
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
  "epicTrailer": "Write a 3-4 sentence epic movie-trailer style voiceover script summarizing their week's conquests. Highlight specific LeetCode problems solved, MERN features built, or scriptures read from the log entries. Make it dramatic, high-energy, and intensely motivational ('In a world of distraction...').",
  "summary": "2-3 sentence overall assessment of the week. Be honest but encouraging.",
  "wins": ["array of 2-3 specific things that went well, reference actual data"],
  "patterns": ["array of 2-3 patterns noticed, especially timing issues like morning habits done late at night, or habits consistently missed on certain days"],
  "actionItems": ["array of 3 specific, actionable things to improve next week"],
  "scriptureReview": "If there are scripture entries, provide a brief spiritual summary. If no scripture data, say 'No scripture entries recorded this week.'"
}`;
}
