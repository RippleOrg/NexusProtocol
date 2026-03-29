"use client";

import { MoonStar, SunMedium } from "lucide-react";
import { useTheme } from "@/components/app/theme-provider";

export default function ThemeToggle({
  className = "",
  showLabel = true,
}: {
  className?: string;
  showLabel?: boolean;
}) {
  const { mounted, resolvedTheme, toggleTheme } = useTheme();

  const isDark = resolvedTheme === "dark";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={`nexus-theme-toggle ${className}`.trim()}
      aria-label={mounted ? `Switch to ${isDark ? "light" : "dark"} mode` : "Toggle theme"}
    >
      <span className="nexus-theme-toggle__icon">
        {isDark ? <SunMedium size={16} /> : <MoonStar size={16} />}
      </span>
      {showLabel && (
        <span>{mounted ? (isDark ? "Light mode" : "Dark mode") : "Theme"}</span>
      )}
    </button>
  );
}
