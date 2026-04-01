export type HabitCategory =
  | "Spiritual Discipline"
  | "Career & Learning"
  | "Personal Growth"
  | "Physical Health"
  | "Discipline Rules"
  | "Planning";

export type HabitKey =
  | "morningPrayer"
  | "bibleReading"
  | "scriptureMemorization"
  | "nightReflectionPrayer"
  | "leetCodeTwoProblems"
  | "mernPractice"
  | "technicalReading"
  | "communicationPractice"
  | "physicalActivity"
  | "hydrationGoal"
  | "noFap"
  | "noMindlessScrolling"
  | "planNextDay";

export type HabitDefinition = {
  key: HabitKey;
  label: string;
  category: HabitCategory;
  icon: string;
  /** If true, show scripture input when this habit is marked done */
  hasScriptureInput?: boolean;
  scriptureInputLabel?: string;
};

/** false = not done, ISO string = done at that time, true = legacy (done, time unknown) */
export type HabitValue = string | false | true;

export type HabitStatusMap = Record<HabitKey, HabitValue>;

export type ScriptureEntry = {
  passage: string;
  notes: string;
  type: "reading" | "memorization";
};

export const HABITS: HabitDefinition[] = [
  {
    key: "morningPrayer",
    label: "Morning Prayer",
    category: "Spiritual Discipline",
    icon: "🙏",
  },
  {
    key: "bibleReading",
    label: "Bible Reading",
    category: "Spiritual Discipline",
    icon: "📖",
    hasScriptureInput: true,
    scriptureInputLabel: "What portion did you read?",
  },
  {
    key: "scriptureMemorization",
    label: "Scripture Memorization",
    category: "Spiritual Discipline",
    icon: "🧠",
    hasScriptureInput: true,
    scriptureInputLabel: "Which verse did you memorize?",
  },
  {
    key: "nightReflectionPrayer",
    label: "Night Reflection",
    category: "Spiritual Discipline",
    icon: "🌙",
  },
  {
    key: "leetCodeTwoProblems",
    label: "2 LeetCode Problems",
    category: "Career & Learning",
    icon: "💻",
  },
  {
    key: "mernPractice",
    label: "MERN Stack Practice",
    category: "Career & Learning",
    icon: "⚛️",
  },
  {
    key: "technicalReading",
    label: "Technical Reading",
    category: "Career & Learning",
    icon: "📚",
  },
  {
    key: "communicationPractice",
    label: "Communication Practice",
    category: "Personal Growth",
    icon: "🗣️",
  },
  {
    key: "physicalActivity",
    label: "Physical Activity",
    category: "Physical Health",
    icon: "🏃",
  },
  {
    key: "hydrationGoal",
    label: "Hydration Goal",
    category: "Physical Health",
    icon: "💧",
  },
  {
    key: "noFap",
    label: "NoFap",
    category: "Discipline Rules",
    icon: "🛡️",
  },
  {
    key: "noMindlessScrolling",
    label: "No Mindless Scrolling",
    category: "Discipline Rules",
    icon: "📵",
  },
  {
    key: "planNextDay",
    label: "Plan Tomorrow",
    category: "Planning",
    icon: "📋",
  },
];

export const CATEGORY_ORDER: HabitCategory[] = [
  "Spiritual Discipline",
  "Career & Learning",
  "Personal Growth",
  "Physical Health",
  "Discipline Rules",
  "Planning",
];

export const CATEGORY_ICONS: Record<HabitCategory, string> = {
  "Spiritual Discipline": "✝️",
  "Career & Learning": "🚀",
  "Personal Growth": "🌱",
  "Physical Health": "💪",
  "Discipline Rules": "🔒",
  Planning: "🗓️",
};

export function isHabitDone(value: HabitValue): boolean {
  return value !== false;
}

export function getHabitTime(value: HabitValue): string | null {
  if (typeof value === "string") {
    try {
      const d = new Date(value);
      return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Returns the "effective" date for habit tracking.
 * The day resets at 3 AM instead of midnight, so between
 * 12:00 AM and 2:59 AM the app still shows the previous day's habits.
 */
export function getEffectiveDate(): Date {
  const now = new Date();
  return new Date(now.getTime() - 3 * 60 * 60 * 1000);
}

export function getEmptyHabitStatus(): HabitStatusMap {
  return HABITS.reduce((acc, habit) => {
    acc[habit.key] = false;
    return acc;
  }, {} as HabitStatusMap);
}
