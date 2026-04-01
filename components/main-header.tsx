"use client";

import { useState, useRef, useEffect } from "react";
import { auth } from "@/lib/firebase";
import { signOut, onAuthStateChanged, User } from "firebase/auth";

export default function MainHeader() {
  const [user, setUser] = useState<User | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!auth) return;
    return onAuthStateChanged(auth, (u) => setUser(u));
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

  return (
    <header className="app-header fixed inset-x-0 top-0 z-50">
      <div className="mx-auto flex h-12 w-full max-w-[480px] items-center justify-between px-4">
        <p className="text-[14px] font-extrabold tracking-wider uppercase" style={{ color: "var(--text-primary)" }}>
          Jesus is my CEO
        </p>

        {user && (
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => setMenuOpen(!menuOpen)}
              className="flex h-8 w-8 items-center justify-center rounded-full transition-colors"
              style={{
                border: "1px solid var(--border)",
                background: "var(--bg-alpha-base)",
                color: "var(--text-primary)"
              }}
              aria-label="Menu"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="4" y1="12" x2="20" y2="12"></line>
                <line x1="4" y1="6" x2="20" y2="6"></line>
                <line x1="4" y1="18" x2="20" y2="18"></line>
              </svg>
            </button>

            {menuOpen && (
              <div className="absolute right-0 mt-2 w-52 rounded-xl border overflow-hidden py-1 z-50 fade-up" style={{ background: "var(--surface-raised)", borderColor: "var(--border)", boxShadow: "0 8px 32px rgba(0,0,0,0.4)" }}>
                <div className="px-3 py-2.5 border-b mb-1" style={{ borderColor: "var(--border)" }}>
                  <p className="text-[12px] font-semibold truncate" style={{ color: "var(--text-primary)" }}>{user.displayName || "User"}</p>
                  <p className="text-[10px] truncate mt-0.5" style={{ color: "var(--text-muted)" }}>{user.email}</p>
                </div>

                <button
                  type="button"
                  onClick={handleSignOut}
                  className="w-full flex items-center gap-2 px-3 py-2.5 text-[12px] font-medium transition-colors"
                  style={{ color: "var(--red)", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit" }}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
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
