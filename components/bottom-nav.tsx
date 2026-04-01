"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";

const tabs = [
  { href: "/", label: "Today", icon: "📋" },
  { href: "/stats", label: "Stats", icon: "📊" },
  { href: "/reflection", label: "Reflect", icon: "💡" },
  { href: "/dreams", label: "Dreams", icon: "🚀" },
] as const;

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="bottom-nav">
      {tabs.map((tab) => {
        const active = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`bottom-nav__tab ${active ? "bottom-nav__tab--active" : ""}`}
          >
            <span className="bottom-nav__icon">{tab.icon}</span>
            <span className="bottom-nav__label">{tab.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
