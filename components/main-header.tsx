"use client";

import { useState, useRef, useEffect } from "react";
import { auth } from "@/lib/firebase";
import { signOut, onAuthStateChanged, User } from "firebase/auth";

export default function MainHeader() {
  const [user, setUser] = useState<User | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!auth) return;
    return onAuthStateChanged(auth, (u) => setUser(u));
  }, []);

  useEffect(() => {
    const t = document.documentElement.getAttribute("data-theme") as "light" | "dark";
    if (t) setTheme(t);
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }
    if (menuOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuOpen]);

  async function handleSignOut() {
    setMenuOpen(false);
    if (auth) await signOut(auth);
  }

  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("theme", next);
  }

  return (
    <header className="app-header fixed inset-x-0 top-0 z-50">
      <div className="mx-auto flex h-14 w-full max-w-lg items-center justify-between px-4">
        <p className="text-[18px] font-extrabold tracking-wide uppercase greeting-accent">
          Jesus is my CEO
        </p>

        {user && (
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => setMenuOpen(!menuOpen)}
              className="flex h-9 w-9 items-center justify-center rounded-full transition-colors border"
              style={{
                borderColor: "var(--border)",
                background: "var(--bg-alpha-base)",
                color: "var(--text-primary)"
              }}
              aria-label="Menu"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="4" y1="12" x2="20" y2="12"></line>
                <line x1="4" y1="6" x2="20" y2="6"></line>
                <line x1="4" y1="18" x2="20" y2="18"></line>
              </svg>
            </button>

            {menuOpen && (
              <div className="absolute right-0 mt-2 w-56 rounded-xl border shadow-2xl overflow-hidden py-1.5 z-50 fade-up" style={{ background: "var(--surface-raised)", borderColor: "var(--border)" }}>
                <div className="px-4 py-3 border-b mb-1.5" style={{ borderColor: "var(--border)" }}>
                  <p className="text-[13px] font-semibold truncate" style={{ color: "var(--text-primary)" }}>{user.displayName || "User"}</p>
                  <p className="text-[11px] truncate mt-0.5" style={{ color: "var(--text-muted)" }}>{user.email}</p>
                </div>
                
                <button
                  type="button"
                  onClick={toggleTheme}
                  className="w-full flex items-center justify-between px-4 py-2.5 text-[13px] font-medium transition-colors"
                  style={{ color: "var(--text-primary)" }}
                >
                  <div className="flex items-center gap-2">
                    {theme === "dark" ? (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
                      </svg>
                    ) : (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="5"></circle>
                        <line x1="12" y1="1" x2="12" y2="3"></line>
                        <line x1="12" y1="21" x2="12" y2="23"></line>
                        <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
                        <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
                        <line x1="1" y1="12" x2="3" y2="12"></line>
                        <line x1="21" y1="12" x2="23" y2="12"></line>
                        <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
                        <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
                      </svg>
                    )}
                    {theme === "dark" ? "Light Mode" : "Dark Mode"}
                  </div>
                </button>

                <button
                  type="button"
                  onClick={handleSignOut}
                  className="w-full flex items-center gap-2 px-4 py-2.5 text-[13px] font-medium transition-colors"
                  style={{ color: "var(--red)" }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                    <polyline points="16 17 21 12 16 7"></polyline>
                    <line x1="21" y1="12" x2="9" y2="12"></line>
                  </svg>
                  Sign out
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
