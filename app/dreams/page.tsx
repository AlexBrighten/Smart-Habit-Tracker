"use client";

import { useEffect, useState } from "react";
import { User, onAuthStateChanged } from "firebase/auth";
import { collection, doc, onSnapshot, setDoc, deleteDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

type Goal = {
  id: string;
  text: string;
  type: "short" | "long";
  createdAt: any;
};

export default function DreamsPage() {
  const [user, setUser] = useState<User | null>(null);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [newGoalText, setNewGoalText] = useState("");
  const [newGoalType, setNewGoalType] = useState<"short" | "long">("short");

  useEffect(() => {
    if (!auth) return;
    return onAuthStateChanged(auth, setUser);
  }, []);

  useEffect(() => {
    if (!db || !user) return;
    const unsub = onSnapshot(collection(db, "users", user.uid, "goals"), (snap) => {
      const parsed: Goal[] = [];
      snap.forEach((d) => parsed.push({ id: d.id, ...d.data() } as Goal));
      setGoals(parsed.sort((a,b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0)));
    });
    return () => unsub();
  }, [user]);

  async function addGoal() {
    if (!db || !user || !newGoalText.trim()) return;
    const id = Date.now().toString();
    await setDoc(doc(db, "users", user.uid, "goals", id), {
      text: newGoalText.trim(),
      type: newGoalType,
      createdAt: serverTimestamp()
    });
    setNewGoalText("");
  }

  async function removeGoal(id: string) {
    if (!db || !user) return;
    await deleteDoc(doc(db, "users", user.uid, "goals", id));
  }

  if (!user) return (
    <main className="page-container flex items-center justify-center min-h-[60dvh]">
      <p className="text-[13px]" style={{ color: "var(--text-muted)" }}>Sign in on the Today tab first.</p>
    </main>
  );

  return (
    <main className="page-container">
      <div className="fade-up">
        <h1 className="text-[16px] font-bold uppercase tracking-wider" style={{ color: "var(--text-primary)" }}>
          Motivations
        </h1>
        <p className="text-[11px] mb-4 mt-0.5" style={{ color: "var(--text-muted)" }}>
          AI uses these to push you
        </p>
      </div>

      <div className="panel fade-up stagger-1 mb-4">
        <div className="flex flex-col gap-2.5">
          <input
            type="text"
            className="scripture-field"
            placeholder="What are you building towards?"
            value={newGoalText}
            onChange={(e) => setNewGoalText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addGoal()}
          />
          <div className="flex gap-2">
            <select
              className="scripture-field text-[12px] flex-1"
              value={newGoalType}
              onChange={(e) => setNewGoalType(e.target.value as "short" | "long")}
            >
              <option value="short">Short Term</option>
              <option value="long">Long Term</option>
            </select>
            <button className="btn btn--accent flex-1 text-[12px]" onClick={addGoal}>
              + Add
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2.5 fade-up stagger-2">
        {goals.map((g) => (
          <div key={g.id} className="panel flex items-start gap-3 relative" style={{ padding: "12px 14px" }}>
            <div className="flex-1 min-w-0">
              <span
                className="text-[9px] uppercase font-bold tracking-wider inline-block px-2 py-0.5 rounded mb-1.5"
                style={{
                  background: g.type === "long" ? "var(--accent-soft)" : "var(--bg-alpha-medium)",
                  color: g.type === "long" ? "var(--accent)" : "var(--text-secondary)",
                }}
              >
                {g.type === "long" ? "DREAM" : "GOAL"}
              </span>
              <p className="text-[13px]" style={{ color: "var(--text-primary)" }}>{g.text}</p>
            </div>
            <button 
              onClick={() => removeGoal(g.id)}
              className="text-lg"
              style={{ color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer", lineHeight: 1 }}
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </main>
  );
}
