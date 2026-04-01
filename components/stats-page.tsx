"use client";

import { useEffect, useMemo, useState } from "react";
import { User, onAuthStateChanged } from "firebase/auth";
import {
  collection,
  onSnapshot,
  orderBy,
  query,
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
  HABITS,
  HabitStatusMap,
  getEmptyHabitStatus,
  isHabitDone,
  getEffectiveDate,
} from "@/lib/habits";
import { auth, db } from "@/lib/firebase";

/* ─── Types ─── */
type WeeklyPoint = { date: string; label: string; completion: number };
type MonthlyPoint = { label: string; average: number };

/* ─── Helpers ─── */
const TOTAL = HABITS.length;

function fmtKey(d: Date) {
  return `${d.getFullYear()}-${`${d.getMonth() + 1}`.padStart(2, "0")}-${`${d.getDate()}`.padStart(2, "0")}`;
}

function addD(d: Date, n: number) {
  const c = new Date(d);
  c.setDate(c.getDate() + n);
  return c;
}

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

function hLvl(p: number) {
  if (p >= 90) return "heat-4";
  if (p >= 70) return "heat-3";
  if (p >= 40) return "heat-2";
  if (p > 0) return "heat-1";
  return "heat-0";
}

function weeklyPts(logs: Record<string, HabitStatusMap>): WeeklyPoint[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = addD(getEffectiveDate(), -(6 - i));
    const k = fmtKey(d);
    return {
      date: k,
      label: d.toLocaleDateString(undefined, { weekday: "short" }),
      completion: pct(logs[k] ?? getEmptyHabitStatus()),
    };
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

const tipStyle = {
  background: "var(--surface-raised)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  color: "var(--text-primary)",
  fontSize: 12,
  padding: "6px 10px",
};

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAY_LABELS = ["", "Mon", "", "Wed", "", "Fri", ""];

/* ─── Component ─── */

export default function StatsPage() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState<Record<string, HabitStatusMap>>({});
  const [graphType, setGraphType] = useState<"weekly" | "monthly">("weekly");
  const [filterMonth, setFilterMonth] = useState<string>("all");
  const [filterYear, setFilterYear] = useState<string>("all");

  useEffect(() => {
    if (!auth) { setLoading(false); return; }
    return onAuthStateChanged(auth, (u) => { setUser(u); setLoading(false); });
  }, []);

  useEffect(() => {
    if (!db || !user) { setLogs({}); return; }
    const u1 = onSnapshot(
      query(collection(db, "users", user.uid, "habits"), orderBy("date", "asc")),
      (snap) => {
        const habits: Record<string, HabitStatusMap> = {};
        snap.forEach((d) => {
          const x = d.data();
          if (typeof x.date === "string") {
            habits[x.date] = normalize(x.habits);
          }
        });
        setLogs(habits);
      }
    );
    return () => { u1(); };
  }, [user]);

  const weekly = useMemo(() => weeklyPts(logs), [logs]);
  const monthly = useMemo(() => monthlyPts(logs), [logs]);

  // Activity calendar: ~6-month grid (182 days = 26 complete weeks)
  // Spanning 3 months (13 weeks) into the past, current week, and 3 months (12 weeks) into the future
  const { grid, monthPositions } = useMemo(() => {
    const arr = [];
    const now = getEffectiveDate();
    
    // Align to the most recent Sunday
    const currentWeekStart = new Date(now);
    currentWeekStart.setDate(now.getDate() - now.getDay());
    currentWeekStart.setHours(0, 0, 0, 0);

    // Start 13 weeks (91 days) in the past
    const startDate = addD(currentWeekStart, -91);

    for (let i = 0; i < 182; i++) {
      const d = addD(startDate, i);
      const k = fmtKey(d);
      arr.push({ date: d, key: k, pct: pct(logs[k] ?? getEmptyHabitStatus()) });
    }

    // Compute month label positions (column index where a new month starts)
    const months: { label: string; col: number }[] = [];
    let lastMonth = -1;
    arr.forEach((d, idx) => {
      const col = Math.floor(idx / 7);
      const m = d.date.getMonth();
      if (m !== lastMonth) {
        months.push({ label: MONTH_LABELS[m], col });
        lastMonth = m;
      }
    });

    return { grid: arr, monthPositions: months };
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

  const totalWeeks = Math.ceil(grid.length / 7);
  const CELL = 11;
  const GAP = 2;
  const calWidth = totalWeeks * (CELL + GAP);
  const DAY_LABEL_W = 28;

  if (!user && !loading) return (
    <main className="page-container flex items-center justify-center min-h-[60dvh]">
      <p className="text-[13px]" style={{ color: "var(--text-muted)" }}>Sign in on the Today tab first.</p>
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

  return (
    <main className="page-container">
      <div className="grid gap-3">

        <div className="fade-up">
          <h1 className="text-[16px] font-bold" style={{ color: "var(--text-primary)" }}>
            📊 Analytics
          </h1>
          <p className="text-[11px] mt-0.5" style={{ color: "var(--text-muted)" }}>
            Progress charts & consistency data
          </p>
        </div>

        {/* ── Progress Graph ── */}
        <div className="panel fade-up stagger-1">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[13px] font-semibold" style={{ color: "var(--text-primary)" }}>
              Progress
            </p>
            <div className="flex gap-1.5">
              <button
                onClick={() => setGraphType("weekly")}
                className="text-[10px] font-bold tracking-wider px-2.5 py-1 rounded"
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
                className="text-[10px] font-bold tracking-wider px-2.5 py-1 rounded"
                style={{
                  background: graphType === "monthly" ? "var(--accent-soft)" : "transparent",
                  color: graphType === "monthly" ? "var(--accent)" : "var(--text-muted)",
                  border: `1px solid ${graphType === "monthly" ? "var(--accent-medium)" : "var(--border)"}`
                }}
              >
                MONTH
              </button>
            </div>
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
        </div>

        {/* ── Activity Calendar (GitHub-style) ── */}
        <div className="panel fade-up stagger-2">
          <p className="text-[13px] font-semibold mb-3" style={{ color: "var(--text-primary)" }}>
            Activity Calendar
          </p>
          <div className="overflow-x-auto pb-2" style={{ WebkitOverflowScrolling: "touch" }}>
            <div style={{ width: calWidth + DAY_LABEL_W + 8, minWidth: "max-content" }}>
              {/* Month labels row */}
              <div className="flex" style={{ paddingLeft: DAY_LABEL_W, marginBottom: 4 }}>
                {monthPositions.map((mp, i) => {
                  const nextCol = monthPositions[i + 1]?.col ?? totalWeeks;
                  const spanCols = nextCol - mp.col;
                  return (
                    <div
                      key={`${mp.label}-${mp.col}`}
                      style={{
                        width: spanCols * (CELL + GAP),
                        fontSize: 9,
                        color: "var(--text-muted)",
                        fontWeight: 500,
                        flexShrink: 0,
                      }}
                    >
                      {spanCols < 2 ? "" : mp.label}
                    </div>
                  );
                })}
              </div>
              {/* Grid with day labels */}
              <div className="flex">
                {/* Day labels */}
                <div className="flex flex-col" style={{ width: DAY_LABEL_W, flexShrink: 0 }}>
                  {DAY_LABELS.map((label, i) => (
                    <div
                      key={i}
                      style={{
                        height: CELL,
                        marginBottom: GAP,
                        fontSize: 9,
                        color: "var(--text-muted)",
                        display: "flex",
                        alignItems: "center",
                      }}
                    >
                      {label}
                    </div>
                  ))}
                </div>
                {/* Cells */}
                <div className="flex" style={{ gap: GAP }}>
                  {Array.from({ length: totalWeeks }).map((_, colIndex) => (
                    <div key={colIndex} className="flex flex-col" style={{ gap: GAP }}>
                      {grid.slice(colIndex * 7, (colIndex + 1) * 7).map((d) => (
                        <div
                          key={d.key}
                          className={`${hLvl(d.pct)}`}
                          style={{
                            width: CELL,
                            height: CELL,
                            borderRadius: 2,
                          }}
                          title={`${d.date.toLocaleDateString()}: ${d.pct}%`}
                        />
                      ))}
                    </div>
                  ))}
                </div>
              </div>
              {/* Legend */}
              <div className="mt-3 flex items-center justify-end gap-1 text-[9px]" style={{ color: "var(--text-muted)" }}>
                <span>Less</span>
                {["heat-0", "heat-1", "heat-2", "heat-3", "heat-4"].map((c) => (
                  <span key={c} className={c} style={{ width: CELL, height: CELL, borderRadius: 2, display: "inline-block" }} />
                ))}
                <span>More</span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Habit Consistency ── */}
        <div className="panel fade-up stagger-3">
          <p className="text-[13px] font-semibold mb-3" style={{ color: "var(--text-primary)" }}>
            Habit Consistency
          </p>
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
        </div>
      </div>
    </main>
  );
}
