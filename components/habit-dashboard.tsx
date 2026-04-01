"use client";

import { useEffect, useMemo, useState } from "react";
import {
  GoogleAuthProvider,
  User,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
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
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  CATEGORY_ORDER,
  CATEGORY_ICONS,
  HABITS,
  HabitCategory,
  HabitKey,
  HabitStatusMap,
  HabitValue,
  ScriptureEntry,
  getEmptyHabitStatus,
  isHabitDone,
  getHabitTime,
  getEffectiveDate,
} from "@/lib/habits";
import { auth, db, googleProvider } from "@/lib/firebase";
import {
  requestNotificationPermission,
  scheduleWeeklyReflectionReminder,
} from "@/lib/notifications";

/* ─── Types ─── */

type WeeklyPoint = { date: string; label: string; completion: number };
type MonthlyPoint = { label: string; average: number };

/* ─── Constants ─── */

const TOTAL = HABITS.length;
const RING_SIZE = 96;
const RING_STROKE = 6;
const RING_R = (RING_SIZE - RING_STROKE) / 2;
const RING_C = 2 * Math.PI * RING_R;

/* ─── Helpers ─── */

function fmtKey(d: Date) {
  return `${d.getFullYear()}-${`${d.getMonth() + 1}`.padStart(2, "0")}-${`${d.getDate()}`.padStart(2, "0")}`;
}

function greeting() {
  const h = new Date().getHours();
  if (h < 5) return "Burning midnight oil";
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  if (h < 21) return "Good evening";
  return "Night owl mode";
}

function fmtHuman(d: Date) {
  return d.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
}

function weekStart(d: Date) {
  const c = new Date(d);
  const day = c.getDay();
  c.setDate(c.getDate() + (day === 0 ? -6 : 1 - day));
  c.setHours(0, 0, 0, 0);
  return c;
}

function addD(d: Date, n: number) { const c = new Date(d); c.setDate(c.getDate() + n); return c; }

function pct(s: HabitStatusMap) {
  return Math.round((Object.values(s).filter(isHabitDone).length / TOTAL) * 100);
}

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

function motiv(p: number) {
  if (p === 100) return "🔥 Perfect day.";
  if (p >= 90) return "⚡ Almost perfect — close it out.";
  if (p >= 70) return "💪 Solid. Finish strong.";
  if (p >= 40) return "🚀 Momentum building.";
  if (p > 0) return "🌱 Small start beats no start.";
  return "⏳ Make the first move.";
}

function wkId() { return fmtKey(weekStart(getEffectiveDate())); }

function calcStreak(logs: Record<string, HabitStatusMap>) {
  let s = 0, cur = getEffectiveDate();
  while (logs[fmtKey(cur)] && pct(logs[fmtKey(cur)]) >= 70) { s++; cur = addD(cur, -1); }
  return s;
}

function weeklyPts(logs: Record<string, HabitStatusMap>): WeeklyPoint[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = addD(getEffectiveDate(), -(6 - i));
    const k = fmtKey(d);
    return { date: k, label: d.toLocaleDateString(undefined, { weekday: "short" }), completion: pct(logs[k] ?? getEmptyHabitStatus()) };
  });
}

function monthlyPts(logs: Record<string, HabitStatusMap>, months = 12): MonthlyPoint[] {
  const now = getEffectiveDate();
  return Array.from({ length: months }, (_, i) => {
    const ptr = new Date(now.getFullYear(), now.getMonth() - (months - 1 - i), 1);
    const y = ptr.getFullYear(), m = ptr.getMonth();
    let sum = 0, cnt = 0;
    Object.entries(logs).forEach(([k, v]) => {
      const [ky, km] = k.split("-").map(Number);
      if (ky === y && km === m + 1) { sum += pct(v); cnt++; }
    });
    return { label: ptr.toLocaleDateString(undefined, { month: "short" }), average: cnt ? Math.round(sum / cnt) : 0 };
  });
}

function heatData(logs: Record<string, HabitStatusMap>) {
  const now = getEffectiveDate();
  const y = now.getFullYear(), m = now.getMonth();
  const days = new Date(y, m + 1, 0).getDate();
  return Array.from({ length: days }, (_, i) => {
    const d = new Date(y, m, i + 1);
    const k = fmtKey(d);
    return { key: k, day: i + 1, pct: pct(logs[k] ?? getEmptyHabitStatus()) };
  });
}

function hLvl(p: number) {
  if (p >= 90) return "heat-4";
  if (p >= 70) return "heat-3";
  if (p >= 40) return "heat-2";
  if (p > 0) return "heat-1";
  return "heat-0";
}

/* ─── Sub-components ─── */

function Ring({ percent }: { percent: number }) {
  const offset = RING_C - (percent / 100) * RING_C;
  const color = percent >= 90 ? "var(--green)" : percent >= 40 ? "var(--accent)" : "var(--red)";
  return (
    <div className="relative" style={{ width: RING_SIZE, height: RING_SIZE }}>
      <svg width={RING_SIZE} height={RING_SIZE}>
        <circle cx={RING_SIZE / 2} cy={RING_SIZE / 2} r={RING_R}
          fill="none" stroke="var(--ring-track)" strokeWidth={RING_STROKE} />
        <circle cx={RING_SIZE / 2} cy={RING_SIZE / 2} r={RING_R}
          fill="none" stroke={color} strokeWidth={RING_STROKE}
          strokeLinecap="round" strokeDasharray={RING_C}
          strokeDashoffset={offset} className="progress-ring__circle" />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[24px] font-bold" style={{ color: "var(--text-primary)" }}>
          {percent}<span className="text-[13px] font-normal" style={{ color: "var(--text-muted)" }}>%</span>
        </span>
      </div>
    </div>
  );
}

function Toggle({ title, icon, defaultOpen = false, children }: {
  title: string; icon?: string; defaultOpen?: boolean; children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="panel fade-up">
      <button type="button" className="toggle-btn" onClick={() => setOpen(!open)}>
        <span className={`toggle-chevron ${open ? "toggle-chevron--open" : ""}`}>▶</span>
        {icon && <span>{icon}</span>}
        <span>{title}</span>
      </button>
      {open && <div className="mt-3">{children}</div>}
    </div>
  );
}

const tipStyle = {
  background: "var(--surface-raised)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  color: "var(--text-primary)",
  fontSize: 12,
  padding: "6px 10px",
};

/* ─── Main Component ─── */

export default function HabitDashboard() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState<Record<string, HabitStatusMap>>({});
  const [scriptures, setScriptures] = useState<Record<string, ScriptureEntry[]>>({});
  const [saving, setSaving] = useState<null | HabitKey>(null);
  const [error, setError] = useState<string | null>(null);

  // Scripture input state
  const [expandedHabit, setExpandedHabit] = useState<HabitKey | null>(null);
  const [scripturePassage, setScripturePassage] = useState("");
  const [scriptureNotes, setScriptureNotes] = useState("");
  const [graphType, setGraphType] = useState<"weekly" | "monthly">("weekly");
  const [filterMonth, setFilterMonth] = useState<string>("all");
  const [filterYear, setFilterYear] = useState<string>("all");

  const ready = Boolean(auth && db);

  /* Auth + Notifications */
  useEffect(() => {
    if (!auth) { setLoading(false); return; }
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
      if (u) {
        requestNotificationPermission().then((granted) => {
          if (granted) scheduleWeeklyReflectionReminder();
        });
      }
    });
  }, []);

  /* Firestore */
  useEffect(() => {
    if (!db || !user) { setLogs({}); setScriptures({}); return; }
    const u1 = onSnapshot(
      query(collection(db, "users", user.uid, "habits"), orderBy("date", "asc")),
      (snap) => {
        const habits: Record<string, HabitStatusMap> = {};
        const scrips: Record<string, ScriptureEntry[]> = {};
        snap.forEach((d) => {
          const x = d.data();
          if (typeof x.date === "string") {
            habits[x.date] = normalize(x.habits);
            scrips[x.date] = Array.isArray(x.scriptures) ? x.scriptures : [];
          }
        });
        setLogs(habits);
        setScriptures(scrips);
      }
    );
    return () => { u1(); };
  }, [user]);

  /* Computed */
  const byCategory = useMemo(() => {
    const g: Record<HabitCategory, typeof HABITS> = {
      "Spiritual Discipline": [], "Career & Learning": [], "Personal Growth": [],
      "Physical Health": [], "Discipline Rules": [], Planning: [],
    };
    for (const h of HABITS) g[h.category].push(h);
    return g;
  }, []);

  const todayKey = fmtKey(getEffectiveDate());
  const today = logs[todayKey] ?? getEmptyHabitStatus();
  const todayPct = pct(today);
  const doneCount = Object.values(today).filter(isHabitDone).length;
  const todayScriptures = scriptures[todayKey] ?? [];

  const effDate = getEffectiveDate();
  const weekly = useMemo(() => weeklyPts(logs), [logs]);
  const weeklyAvg = useMemo(() => Math.round(weekly.reduce((a, w) => a + w.completion, 0) / weekly.length), [weekly]);
  const streak = useMemo(() => calcStreak(logs), [logs]);
  const heat = useMemo(() => heatData(logs), [logs]);
  const monthly = useMemo(() => monthlyPts(logs), [logs]);
  const yearlyAvg = useMemo(() => {
    const cutoff = fmtKey(addD(getEffectiveDate(), -365));
    const e = Object.entries(logs).filter(([d]) => d >= cutoff);
    if (!e.length) return 0;
    return Math.round(e.reduce((a, [, s]) => a + pct(s), 0) / e.length);
  }, [logs]);
  const breakdown = useMemo(() => {
    const filteredVals = Object.entries(logs).filter(([k]) => {
      const [y, m] = k.split("-").map(Number);
      if (filterYear !== "all" && y !== Number(filterYear)) return false;
      if (filterMonth !== "all" && m !== Number(filterMonth) + 1) return false;
      return true;
    }).map(([_, v]) => v);
    const total = filteredVals.length || 1;
    return HABITS.map((h) => ({
      key: h.key, label: h.label, icon: h.icon,
      consistency: Math.round(filteredVals.reduce((a, d) => a + (isHabitDone(d[h.key]) ? 1 : 0), 0) / total * 100),
    })).sort((a, b) => b.consistency - a.consistency);
  }, [logs, filterMonth, filterYear]);

  const contributionGrid = useMemo(() => {
    const arr = [];
    const now = getEffectiveDate();
    for (let i = 364; i >= 0; i--) {
      const d = addD(now, -i);
      const k = fmtKey(d);
      arr.push({ date: d, key: k, pct: pct(logs[k] ?? getEmptyHabitStatus()) });
    }
    return arr;
  }, [logs]);

  /* Actions */
  async function persist(next: HabitStatusMap) {
    if (!db || !user) return;
    const nextMap = { ...logs, [todayKey]: next };
    const wk = weeklyPts(nextMap);
    const avg = Math.round(wk.reduce((a, w) => a + w.completion, 0) / wk.length);
    const id = wkId();
    await setDoc(doc(db, "users", user.uid, "weeklySummaries", id), {
      weekId: id, average: avg,
      bestDay: wk.reduce((b, c) => c.completion > b.completion ? c : b),
      worstDay: wk.reduce((w, c) => c.completion < w.completion ? c : w),
      streak: calcStreak(nextMap), updatedAt: serverTimestamp(),
    }, { merge: true });
    await setDoc(doc(db, "users", user.uid, "stats", "current"), {
      todayPercent: pct(next), weeklyAverage: avg, streak: calcStreak(nextMap),
      yearlyAverage: yearlyAvg, halfYearTrend: monthlyPts(nextMap, 6), updatedAt: serverTimestamp(),
    }, { merge: true });
  }

  async function toggleHabit(key: HabitKey) {
    if (!db || !user) return;
    try {
      setError(null); setSaving(key);
      const isDone = isHabitDone(today[key]);
      const nextValue: HabitValue = isDone ? false : new Date().toISOString();
      const next = { ...today, [key]: nextValue };

      const habitDef = HABITS.find((h) => h.key === key);

      if (!isDone && habitDef?.hasScriptureInput) {
        setExpandedHabit(key);
        setScripturePassage("");
        setScriptureNotes("");
      } else if (isDone) {
        if (expandedHabit === key) setExpandedHabit(null);
      }

      await setDoc(doc(db, "users", user.uid, "habits", todayKey),
        { date: todayKey, habits: next, scriptures: todayScriptures, updatedAt: serverTimestamp() }, { merge: true });
      await persist(next);
    } catch { setError("Couldn't save. Retry in a moment."); }
    finally { setSaving(null); }
  }

  function openScriptureInput(key: HabitKey) {
    setExpandedHabit(key);
    setScripturePassage("");
    setScriptureNotes("");
  }

  async function saveScripture(key: HabitKey) {
    if (!db || !user || !scripturePassage.trim()) return;
    try {
      const type: "reading" | "memorization" = key === "scriptureMemorization" ? "memorization" : "reading";
      const newEntry: ScriptureEntry = {
        passage: scripturePassage.trim(),
        notes: scriptureNotes.trim(),
        type,
      };
      const updated = [...todayScriptures, newEntry];

      await setDoc(doc(db, "users", user.uid, "habits", todayKey),
        { scriptures: updated, updatedAt: serverTimestamp() }, { merge: true });

      setExpandedHabit(null);
      setScripturePassage("");
      setScriptureNotes("");
    } catch {
      setError("Couldn't save scripture entry.");
    }
  }

  async function login() {
    if (!auth) return;
    try { setError(null); await signInWithPopup(auth, googleProvider as GoogleAuthProvider); }
    catch { setError("Sign-in failed."); }
  }

  /* ─── Renders ─── */

  if (!ready) return (
    <main className="page-container">
      <div className="panel" style={{ borderLeft: "3px solid var(--accent)" }}>
        <p className="text-sm font-semibold" style={{ color: "var(--accent)" }}>⚠️ Firebase setup required</p>
        <p className="mt-1 text-[13px]" style={{ color: "var(--text-secondary)" }}>
          Add NEXT_PUBLIC_FIREBASE_* values in .env.local and restart.
        </p>
      </div>
    </main>
  );

  if (loading) return (
    <main className="page-container">
      <div className="panel">
        <div className="skeleton" style={{ height: 20, width: "50%" }} />
        <div className="skeleton mt-3" style={{ height: 100 }} />
      </div>
    </main>
  );

  if (!user) return (
    <main className="flex min-h-dvh w-full flex-col items-center justify-center px-6">
      <div className="fade-up w-full max-w-sm text-center">
        <p className="text-2xl font-bold greeting-accent">Jesus is my CEO</p>
        <p className="mt-3 text-[14px]" style={{ color: "var(--text-secondary)" }}>
          Track execution daily.<br />Let consistency compound.
        </p>
        <button type="button" onClick={login} className="btn btn--accent mt-10">
          Continue with Google
        </button>
        {error && <p className="mt-3 text-xs" style={{ color: "var(--red)" }}>{error}</p>}
      </div>
    </main>
  );

  return (
    <main className="page-container">
      <div className="grid gap-3">

        {/* ── Hero: Greeting + Ring + Stats ── */}
        <div className="panel fade-up">
          <div className="flex items-center gap-4">
            <Ring percent={todayPct} />
            <div className="flex-1 min-w-0">
              <p className="text-[15px] font-bold greeting-accent">{greeting()}</p>
              <p className="text-[11px] mt-0.5" style={{ color: "var(--text-muted)" }}>
                {fmtHuman(getEffectiveDate())}
              </p>
              <p className="text-[11px] mt-1" style={{ color: "var(--text-muted)" }}>
                {doneCount}/{TOTAL} completed
              </p>
            </div>
          </div>
          <div className="motivation-banner mt-3">
            <p className="text-[12px] font-medium" style={{ color: "var(--accent)" }}>
              {motiv(todayPct)}
            </p>
          </div>
        </div>

        {/* ── Inline Stats ── */}
        <div className="fade-up stagger-1 grid grid-cols-3 gap-2">
          <div className="stat-card">
            <span className="stat-card__icon">🔥</span>
            <p className="stat-card__value">{streak}</p>
            <p className="stat-card__label">Streak</p>
          </div>
          <div className="stat-card">
            <span className="stat-card__icon">📊</span>
            <p className="stat-card__value">{weeklyAvg}%</p>
            <p className="stat-card__label">This week</p>
          </div>
          <div className="stat-card">
            <span className="stat-card__icon">🏆</span>
            <p className="stat-card__value">{yearlyAvg}%</p>
            <p className="stat-card__label">All time</p>
          </div>
        </div>

        {/* ── Habits ── */}
        <div className="panel-flush fade-up stagger-2">
          {CATEGORY_ORDER.map((cat) => (
            <div key={cat}>
              <div className="category-header">
                <span className="category-header__icon">{CATEGORY_ICONS[cat]}</span>
                <span>{cat}</span>
                <span style={{ marginLeft: "auto", color: "var(--text-muted)", fontSize: 10 }}>
                  {byCategory[cat].filter((h) => isHabitDone(today[h.key])).length}/{byCategory[cat].length}
                </span>
              </div>
              {byCategory[cat].map((h) => {
                const isDone = isHabitDone(today[h.key]);
                const isSaving = saving === h.key;
                const time = getHabitTime(today[h.key]);
                const isExpanded = expandedHabit === h.key;

                return (
                  <div key={h.key}>
                    <button type="button" onClick={() => toggleHabit(h.key)}
                      disabled={isSaving} className="habit-item"
                      style={{ opacity: isSaving ? 0.5 : 1 }}>
                      <span className={`habit-item__icon ${isDone ? "habit-item__icon--done" : "habit-item__icon--undone"}`}>
                        {h.icon}
                      </span>
                      <div style={{ flex: 1, textAlign: "left", minWidth: 0 }}>
                        <span className="text-[13px] font-medium" style={{
                          color: isDone ? "var(--text-muted)" : "var(--text-primary)",
                          textDecoration: isDone ? "line-through" : "none",
                        }}>
                          {h.label}
                        </span>
                        {isDone && time && (
                          <span className="block text-[10px]" style={{ color: "var(--text-muted)" }}>
                            ✓ {time}
                          </span>
                        )}
                      </div>
                      <span className={`habit-item__check ${isDone ? "habit-item__check--done" : "habit-item__check--undone"}`}>
                        {isDone ? "✓" : ""}
                      </span>
                    </button>

                    {/* Scripture input */}
                    {isExpanded && h.hasScriptureInput && (
                      <div className="scripture-input">
                        <p className="text-[11px] font-medium mb-2" style={{ color: "var(--text-secondary)" }}>
                          {h.scriptureInputLabel}
                        </p>
                        <input
                          type="text"
                          value={scripturePassage}
                          onChange={(e) => setScripturePassage(e.target.value)}
                          placeholder="e.g., Romans 8:28"
                          className="scripture-field"
                          autoFocus
                        />
                        <input
                          type="text"
                          value={scriptureNotes}
                          onChange={(e) => setScriptureNotes(e.target.value)}
                          placeholder="Quick note (optional)"
                          className="scripture-field mt-1.5"
                        />
                        <div className="flex gap-2 mt-2">
                          <button type="button" onClick={() => saveScripture(h.key)}
                            disabled={!scripturePassage.trim()}
                            className="btn btn--accent" style={{ padding: "8px 14px", fontSize: 12 }}>
                            Save
                          </button>
                          <button type="button" onClick={() => setExpandedHabit(null)}
                            className="btn btn--ghost" style={{ padding: "8px 14px", fontSize: 12 }}>
                            Skip
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Scripture entries */}
                    {isDone && (
                      <div>
                        {todayScriptures
                          .filter((s) => {
                            if (h.key === "scriptureMemorization") return s.type === "memorization";
                            if (h.key === "bibleReading") return s.type === "reading";
                            return false;
                          })
                          .map((s, i) => (
                            <div key={i} className="scripture-entry">
                              <span className="text-[11px]" style={{ color: "var(--accent)" }}>📜 {s.passage}</span>
                              {s.notes && <span className="text-[10px] ml-2" style={{ color: "var(--text-muted)" }}>{s.notes}</span>}
                            </div>
                          ))}
                          
                        {!isExpanded && h.hasScriptureInput && (
                          <button 
                            type="button" 
                            onClick={() => openScriptureInput(h.key)}
                            className="mt-2 ml-[54px] text-[10px] font-bold tracking-wide"
                            style={{ color: "var(--accent)", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit" }}
                          >
                            + ADD PORTION
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        {/* ── Analytics (all collapsed by default) ── */}
        <Toggle title="Progress" icon="📈">
          <div className="flex gap-2 mb-3">
            <button
              onClick={() => setGraphType("weekly")}
              className="text-[11px] font-bold tracking-wider px-3 py-1 rounded"
              style={{
                background: graphType === "weekly" ? "var(--accent-soft)" : "transparent",
                color: graphType === "weekly" ? "var(--accent)" : "var(--text-muted)",
                border: `1px solid ${graphType === "weekly" ? "var(--accent-medium)" : "var(--border)"}`
              }}
            >
              WEEK
            </button>
            <button
              onClick={() => setGraphType("monthly")}
              className="text-[11px] font-bold tracking-wider px-3 py-1 rounded"
              style={{
                background: graphType === "monthly" ? "var(--accent-soft)" : "transparent",
                color: graphType === "monthly" ? "var(--accent)" : "var(--text-muted)",
                border: `1px solid ${graphType === "monthly" ? "var(--accent-medium)" : "var(--border)"}`
              }}
            >
              MONTH
            </button>
          </div>
          <div style={{ width: "100%", height: 160 }}>
            <ResponsiveContainer width="100%" height={160} minWidth={0}>
              <AreaChart data={graphType === "weekly" ? (weekly as any[]) : (monthly as any[])} margin={{ left: -20, right: 4, top: 4, bottom: 0 }}>
                <defs>
                  <linearGradient id="pGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.2} />
                    <stop offset="100%" stopColor="var(--accent)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="label" tick={{ fill: "var(--text-muted)", fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis domain={[0, 100]} tick={{ fill: "var(--text-muted)", fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={tipStyle} />
                <Area type="monotone" dataKey={graphType === "weekly" ? "completion" : "average"} stroke="var(--accent)" strokeWidth={2}
                  fill="url(#pGrad)" dot={{ r: 2.5, fill: "var(--accent)", stroke: "var(--surface)", strokeWidth: 2 }} activeDot={{ r: 4 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Toggle>

        <Toggle title="This Month" icon="📅">
          <div className="grid grid-cols-7 gap-1">
            {heat.map((d) => (
              <div key={d.key} className={`heat-cell ${hLvl(d.pct)}`} title={`${d.key}: ${d.pct}%`}>
                {d.day}
              </div>
            ))}
          </div>
          <div className="mt-2 flex items-center gap-1 text-[10px]" style={{ color: "var(--text-muted)" }}>
            <span>0%</span>
            {["heat-0", "heat-1", "heat-2", "heat-3", "heat-4"].map((c) => (
              <span key={c} className={`heat-cell ${c}`} style={{ width: 10, height: 10, fontSize: 0 }} />
            ))}
            <span>100%</span>
          </div>
        </Toggle>

        <Toggle title="Activity Calendar" icon="🗓️">
          <div className="flex gap-1 overflow-x-auto pb-2" dir="ltr">
            <div className="flex gap-1" style={{ minWidth: "max-content" }}>
              {Array.from({ length: Math.ceil(contributionGrid.length / 7) }).map((_, colIndex) => (
                <div key={colIndex} className="flex flex-col gap-1">
                  {contributionGrid.slice(colIndex * 7, (colIndex + 1) * 7).map((d) => (
                    <div 
                      key={d.key} 
                      className={`heat-cell ${hLvl(d.pct)}`} 
                      style={{ width: 12, height: 12, fontSize: 0 }}
                      title={`${d.date.toLocaleDateString()}: ${d.pct}%`} 
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>
        </Toggle>

        <Toggle title="Habit Consistency" icon="🎯">
          <div className="flex gap-2 mb-3">
            <select
              value={filterMonth}
              onChange={(e) => setFilterMonth(e.target.value)}
              className="scripture-field text-[11px] py-1 px-2 flex-1"
            >
              <option value="all">All Months</option>
              {Array.from({ length: 12 }).map((_, i) => {
                const date = new Date(2000, i, 1);
                return <option key={i} value={i}>{date.toLocaleString('default', { month: 'long' })}</option>
              })}
            </select>
            <select
              value={filterYear}
              onChange={(e) => setFilterYear(e.target.value)}
              className="scripture-field text-[11px] py-1 px-2 flex-1"
            >
              <option value="all">All Years</option>
              <option value="2026">2026</option>
              <option value="2027">2027</option>
              <option value="2028">2028</option>
            </select>
          </div>
          <div className="grid gap-2.5">
            {breakdown.map((item) => (
              <div key={item.key}>
                <div className="mb-1 flex items-center gap-2 text-[12px]">
                  <span>{item.icon}</span>
                  <span style={{ color: "var(--text-secondary)", flex: 1 }}>{item.label}</span>
                  <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>{item.consistency}%</span>
                </div>
                <div className="bar-track">
                  <div className="bar-fill" style={{
                    width: `${item.consistency}%`,
                    background: item.consistency >= 80 ? "var(--green)" : item.consistency >= 50 ? "var(--accent)" : "var(--red)",
                  }} />
                </div>
              </div>
            ))}
          </div>
        </Toggle>

        {error && <div className="panel text-[13px]" style={{ color: "var(--red)" }}>{error}</div>}
      </div>
    </main>
  );
}
