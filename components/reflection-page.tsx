"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import {
  User,
  onAuthStateChanged,
} from "firebase/auth";
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import {
  HABITS,
  HabitStatusMap,
  ScriptureEntry,
  getEmptyHabitStatus,
  isHabitDone,
  getEffectiveDate,
} from "@/lib/habits";

/* ─── Types ─── */

type AIAnalysis = {
  epicTrailer?: string;
  summary: string;
  wins: string[];
  patterns: string[];
  actionItems: string[];
  scriptureReview: string;
};

type Flashcard = {
  front: string;
  back: string;
  hint: string;
};

type FlashcardResult = {
  readingSummary: string;
  flashcards: Flashcard[];
};

type DayData = {
  date: string;
  habits: HabitStatusMap;
  scriptures: ScriptureEntry[];
};

type SavedReflection = {
  weekId: string;
  aiAnalysis?: AIAnalysis;
  personalNote?: string;
  flashcards?: FlashcardResult;
  createdAt?: unknown;
};

/* ─── Helpers ─── */

function fmtKey(d: Date) {
  return `${d.getFullYear()}-${`${d.getMonth() + 1}`.padStart(2, "0")}-${`${d.getDate()}`.padStart(2, "0")}`;
}

function weekStart(d: Date) {
  const c = new Date(d);
  const day = c.getDay();
  c.setDate(c.getDate() + (day === 0 ? -6 : 1 - day));
  c.setHours(0, 0, 0, 0);
  return c;
}

function addD(d: Date, n: number) {
  const c = new Date(d); c.setDate(c.getDate() + n); return c;
}

function wkId() { return fmtKey(weekStart(getEffectiveDate())); }

function normalize(raw: unknown): HabitStatusMap {
  const e = getEmptyHabitStatus();
  if (!raw || typeof raw !== "object") return e;
  const o = { ...e };
  for (const h of HABITS) {
    const v = (raw as Record<string, unknown>)[h.key];
    if (typeof v === "string") o[h.key] = v;
    else if (v === true) o[h.key] = true;
    else o[h.key] = false;
  }
  return o;
}

function pct(s: HabitStatusMap) {
  return Math.round((Object.values(s).filter(isHabitDone).length / HABITS.length) * 100);
}

/* ─── Component ─── */

export default function ReflectionPage() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState<Record<string, { habits: HabitStatusMap; scriptures: ScriptureEntry[] }>>({});
  const [pastReflections, setPastReflections] = useState<SavedReflection[]>([]);
  const [goals, setGoals] = useState<{text: string; type: string}[]>([]);

  const [analysis, setAnalysis] = useState<AIAnalysis | null>(null);
  const [flashcardResult, setFlashcardResult] = useState<FlashcardResult | null>(null);
  const [personalNote, setPersonalNote] = useState("");
  const [generating, setGenerating] = useState(false);
  const [generatingCards, setGeneratingCards] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Flashcard state
  const [cardIndex, setCardIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);

  const ready = Boolean(auth && db);

  /* Auth */
  useEffect(() => {
    if (!auth) { setLoading(false); return; }
    return onAuthStateChanged(auth, (u) => { setUser(u); setLoading(false); });
  }, []);

  /* Firestore */
  useEffect(() => {
    if (!db || !user) { setLogs({}); setPastReflections([]); return; }

    const u1 = onSnapshot(
      query(collection(db, "users", user.uid, "habits"), orderBy("date", "asc")),
      (snap) => {
        const n: Record<string, { habits: HabitStatusMap; scriptures: ScriptureEntry[] }> = {};
        snap.forEach((d) => {
          const x = d.data();
          if (typeof x.date === "string") {
            n[x.date] = {
              habits: normalize(x.habits),
              scriptures: Array.isArray(x.scriptures) ? x.scriptures : [],
            };
          }
        });
        setLogs(n);
      }
    );

    const u2 = onSnapshot(
      query(collection(db, "users", user.uid, "reflections"), orderBy("createdAt", "desc")),
      (snap) => {
        const n: SavedReflection[] = [];
        snap.forEach((d) => {
          const x = d.data();
          n.push({
            weekId: String(x.weekId ?? d.id),
            aiAnalysis: x.aiAnalysis,
            personalNote: x.personalNote,
            flashcards: x.flashcards,
            createdAt: x.createdAt,
          });
        });
        setPastReflections(n);

        // Load current week's reflection if exists
        const cur = n.find((r) => r.weekId === wkId());
        if (cur) {
          if (cur.aiAnalysis) setAnalysis(cur.aiAnalysis);
          if (cur.flashcards) setFlashcardResult(cur.flashcards);
          if (cur.personalNote) setPersonalNote(cur.personalNote);
        }
      }
    );

    const u3 = onSnapshot(collection(db, "users", user.uid, "goals"), (snap) => {
      const g: {text: string; type: string}[] = [];
      snap.forEach((d) => g.push({ text: d.data().text, type: d.data().type }));
      setGoals(g);
    });

    return () => { u1(); u2(); u3(); };
  }, [user]);

  /* Get this week's data */
  const weekData: DayData[] = useMemo(() => {
    const start = weekStart(getEffectiveDate());
    return Array.from({ length: 7 }, (_, i) => {
      const d = addD(start, i);
      const k = fmtKey(d);
      const entry = logs[k];
      return {
        date: k,
        habits: entry?.habits ?? getEmptyHabitStatus(),
        scriptures: entry?.scriptures ?? [],
      };
    });
  }, [logs]);

  const allScriptures = useMemo(() => {
    return weekData.flatMap((d) => d.scriptures);
  }, [weekData]);

  const weekAvg = useMemo(() => {
    const sum = weekData.reduce((a, d) => a + pct(d.habits), 0);
    return Math.round(sum / 7);
  }, [weekData]);

  const biblePortions = useMemo(() => {
    return allScriptures.filter(s => s.type === "reading");
  }, [allScriptures]);

  /* Generate AI Analysis */
  const generateAnalysis = useCallback(async () => {
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weekData, scriptures: allScriptures, goals }),
      });
      if (!res.ok) throw new Error("Analysis request failed");
      const data = await res.json();
      setAnalysis(data);
    } catch {
      setError("Failed to generate analysis. Check your connection.");
    } finally {
      setGenerating(false);
    }
  }, [weekData, allScriptures]);

  /* Generate Flashcards */
  const generateFlashcards = useCallback(async () => {
    setGeneratingCards(true);
    setError(null);
    try {
      const res = await fetch("/api/flashcards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scriptures: allScriptures }),
      });
      if (!res.ok) throw new Error("Flashcard request failed");
      const data = await res.json();
      setFlashcardResult(data);
      setCardIndex(0);
      setFlipped(false);
    } catch {
      setError("Failed to generate flashcards.");
    } finally {
      setGeneratingCards(false);
    }
  }, [allScriptures]);

  /* Save Reflection */
  async function saveReflection() {
    if (!db || !user) return;
    setSaving(true);
    setError(null);
    try {
      const id = wkId();
      await setDoc(doc(db, "users", user.uid, "reflections", id), {
        weekId: id,
        aiAnalysis: analysis,
        flashcards: flashcardResult,
        personalNote,
        createdAt: serverTimestamp(),
      }, { merge: true });
    } catch {
      setError("Failed to save reflection.");
    } finally {
      setSaving(false);
    }
  }

  /* Flashcard nav */
  const cards = flashcardResult?.flashcards ?? [];
  const currentCard = cards[cardIndex] ?? null;

  function nextCard() {
    setFlipped(false);
    setCardIndex((i) => Math.min(i + 1, cards.length - 1));
  }
  function prevCard() {
    setFlipped(false);
    setCardIndex((i) => Math.max(i - 1, 0));
  }

  /* ─── Renders ─── */

  if (!ready || loading) return (
    <main className="page-container">
      <div className="panel">
        <div className="skeleton" style={{ height: 20, width: "50%" }} />
        <div className="skeleton mt-3" style={{ height: 100 }} />
      </div>
    </main>
  );

  if (!user) return (
    <main className="page-container">
      <div className="panel">
        <p className="text-[13px]" style={{ color: "var(--text-secondary)" }}>Sign in to access reflections.</p>
      </div>
    </main>
  );

  return (
    <main className="page-container">
      <div className="grid gap-3">

        {/* ── Header ── */}
        <div className="panel fade-up">
          <p className="text-[15px] font-bold greeting-accent">💡 Weekly Reflection</p>
          <p className="mt-1 text-[11px]" style={{ color: "var(--text-muted)" }}>
            Week of {wkId()} · {weekAvg}% avg
          </p>
        </div>

        {/* ── AI Analysis ── */}
        <div className="panel fade-up stagger-1">
          <div className="mb-3">
            <p className="text-[13px] font-semibold mb-2" style={{ color: "var(--text-primary)" }}>
              🤖 AI Analysis
            </p>
            <button
              type="button"
              onClick={generateAnalysis}
              disabled={generating}
              className="btn btn--accent"
              style={{ padding: "9px 16px", fontSize: 12 }}
            >
              {generating ? "Analyzing…" : analysis ? "Regenerate" : "Generate Analysis"}
            </button>
          </div>

          {analysis ? (
            <div className="grid gap-3 mt-2">
              {/* Epic Trailer */}
              {analysis.epicTrailer && (
                <div className="ai-card" style={{ background: "transparent", border: "1px solid var(--accent-medium)" }}>
                  <p className="ai-card__label" style={{ color: "var(--accent)" }}>🎬 The Week's Trailer</p>
                  <p className="ai-card__text italic font-medium" style={{ color: "var(--text-primary)", fontSize: "14px", lineHeight: "1.6" }}>
                    &quot;{analysis.epicTrailer}&quot;
                  </p>
                </div>
              )}

              {/* Summary */}
              <div className="ai-card">
                <p className="ai-card__label">📝 Summary</p>
                <p className="ai-card__text">{analysis.summary}</p>
              </div>

              {/* Wins */}
              {analysis.wins.length > 0 && (
                <div className="ai-card">
                  <p className="ai-card__label">🏆 Wins</p>
                  <ul className="ai-card__list">
                    {analysis.wins.map((w, i) => <li key={i}>{w}</li>)}
                  </ul>
                </div>
              )}

              {/* Patterns */}
              {analysis.patterns.length > 0 && (
                <div className="ai-card">
                  <p className="ai-card__label">🔍 Patterns Noticed</p>
                  <ul className="ai-card__list">
                    {analysis.patterns.map((p, i) => <li key={i}>{p}</li>)}
                  </ul>
                </div>
              )}

              {/* Action Items */}
              {analysis.actionItems.length > 0 && (
                <div className="ai-card">
                  <p className="ai-card__label">🎯 Action Items</p>
                  <ul className="ai-card__list">
                    {analysis.actionItems.map((a, i) => <li key={i}>{a}</li>)}
                  </ul>
                </div>
              )}

              {/* Scripture Review */}
              {analysis.scriptureReview && (
                <div className="ai-card">
                  <p className="ai-card__label">✝️ Scripture Review</p>
                  <p className="ai-card__text mb-3">{analysis.scriptureReview}</p>
                  
                  {/* Bible Portions Read This Week */}
                  {biblePortions.length > 0 && (
                    <div className="mt-3 pt-3" style={{ borderTop: "1px dashed var(--border)" }}>
                      <p className="text-[11px] font-bold mb-2 uppercase tracking-wide" style={{ color: "var(--accent)" }}>Chapters Read This Week</p>
                      <ul className="flex flex-col gap-1.5">
                        {biblePortions.map((p, i) => (
                          <li key={i} className="text-[12px] flex items-center gap-2" style={{ color: "var(--text-secondary)" }}>
                            <span className="text-[10px]">📖</span> {p.passage}
                            {p.notes && <span className="opacity-50 text-[10px] ml-1">({p.notes})</span>}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="empty-state">
              <p>Tap &quot;Generate Analysis&quot; to get AI-powered insights on your week.</p>
            </div>
          )}
        </div>

        {/* ── Scripture Flashcards ── */}
        <div className="panel fade-up stagger-2">
          <div className="mb-3">
            <p className="text-[13px] font-semibold mb-2" style={{ color: "var(--text-primary)" }}>
              📖 Scripture Flashcards
            </p>
            <button
              type="button"
              onClick={generateFlashcards}
              disabled={generatingCards}
              className="btn btn--accent"
              style={{ padding: "9px 16px", fontSize: 12 }}
            >
              {generatingCards ? "Generating…" : flashcardResult ? "Regenerate" : "Generate Cards"}
            </button>
          </div>

          {/* Reading Summary */}
          {flashcardResult?.readingSummary && (
            <div className="ai-card mb-3">
              <p className="ai-card__label">📚 Weekly Reading Summary</p>
              <p className="ai-card__text">{flashcardResult.readingSummary}</p>
            </div>
          )}

          {/* Flashcard viewer */}
          {cards.length > 0 ? (
            <div>
              <div
                className="flashcard"
                onClick={() => setFlipped(!flipped)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setFlipped(!flipped); }}
              >
                <div className={`flashcard__inner ${flipped ? "flashcard__inner--flipped" : ""}`}>
                  <div className="flashcard__face flashcard__front">
                    <p className="flashcard__ref">{currentCard?.front}</p>
                    <p className="flashcard__hint">Tap to reveal</p>
                  </div>
                  <div className="flashcard__face flashcard__back">
                    <p className="flashcard__verse">{currentCard?.back}</p>
                    {currentCard?.hint && (
                      <p className="flashcard__hint">{currentCard.hint}</p>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between mt-3">
                <button type="button" onClick={prevCard} disabled={cardIndex === 0}
                  className="btn btn--ghost" style={{ width: "auto", padding: "8px 16px", fontSize: 12 }}>
                  ← Prev
                </button>
                <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                  {cardIndex + 1} / {cards.length}
                </span>
                <button type="button" onClick={nextCard} disabled={cardIndex === cards.length - 1}
                  className="btn btn--ghost" style={{ width: "auto", padding: "8px 16px", fontSize: 12 }}>
                  Next →
                </button>
              </div>
            </div>
          ) : !flashcardResult ? (
            <div className="empty-state">
              <p>Generate flashcards from your memorized scriptures this week.</p>
            </div>
          ) : (
            <div className="empty-state">
              <p>No memorized verses this week. Log scriptures on the Today tab.</p>
            </div>
          )}
        </div>

        {/* ── Personal Note ── */}
        <div className="panel fade-up stagger-3">
          <p className="text-[13px] font-semibold mb-2" style={{ color: "var(--text-primary)" }}>
            ✏️ Personal Note
          </p>
          <textarea
            value={personalNote}
            onChange={(e) => setPersonalNote(e.target.value)}
            placeholder="Add your own thoughts about this week…"
            className="text-field"
          />
          <button
            type="button"
            onClick={saveReflection}
            disabled={saving}
            className="btn btn--accent mt-3"
          >
            {saving ? "Saving…" : "Save Reflection"}
          </button>
        </div>

        {/* ── Past Reflections ── */}
        {pastReflections.length > 0 && (
          <div className="panel fade-up stagger-4">
            <p className="text-[13px] font-semibold mb-3" style={{ color: "var(--text-primary)" }}>
              📁 Past Reflections
            </p>
            <div className="grid gap-2">
              {pastReflections.filter((r) => r.weekId !== wkId()).map((r) => (
                <PastReflectionCard key={r.weekId} reflection={r} />
              ))}
            </div>
          </div>
        )}

        {error && (
          <div className="panel text-[13px]" style={{ color: "var(--red)" }}>{error}</div>
        )}
      </div>
    </main>
  );
}

/* ─── Past Reflection Card ─── */

function PastReflectionCard({ reflection }: { reflection: SavedReflection }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="reflection-card">
      <button type="button" className="toggle-btn" onClick={() => setOpen(!open)}>
        <span className={`toggle-chevron ${open ? "toggle-chevron--open" : ""}`}>▶</span>
        <span>Week of {reflection.weekId}</span>
      </button>
      {open && (
        <div className="mt-3 grid gap-2">
          {reflection.aiAnalysis && (
            <>
              <p className="text-[12px]" style={{ color: "var(--text-secondary)" }}>
                <strong style={{ color: "var(--accent)" }}>Summary:</strong> {reflection.aiAnalysis.summary}
              </p>
              {reflection.aiAnalysis.actionItems.length > 0 && (
                <div>
                  <p className="text-[11px] font-semibold" style={{ color: "var(--text-muted)" }}>Action Items:</p>
                  <ul className="text-[12px] pl-4" style={{ color: "var(--text-secondary)", listStyleType: "disc" }}>
                    {reflection.aiAnalysis.actionItems.map((a, i) => <li key={i}>{a}</li>)}
                  </ul>
                </div>
              )}
            </>
          )}
          {reflection.personalNote && (
            <p className="text-[12px]" style={{ color: "var(--text-secondary)" }}>
              <strong style={{ color: "var(--green)" }}>Note:</strong> {reflection.personalNote}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
