"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function DemoLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const handler = (e: CustomEvent<{ progress: number }>) => {
      setProgress(e.detail.progress);
    };
    window.addEventListener("demo:progress" as keyof WindowEventMap, handler as EventListener);
    return () =>
      window.removeEventListener("demo:progress" as keyof WindowEventMap, handler as EventListener);
  }, []);

  return (
    <div className="relative min-h-screen bg-gray-950 text-gray-100 flex flex-col overflow-hidden">
      {/* Exit button */}
      <button
        onClick={() => router.push("/dashboard")}
        className="absolute top-4 right-4 z-50 px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white text-sm font-medium transition-colors border border-gray-700"
      >
        ✕ Exit Demo
      </button>

      {/* Main content */}
      <main className="flex-1">{children}</main>

      {/* Progress bar */}
      <div className="fixed bottom-0 left-0 right-0 h-1 bg-gray-800 z-50">
        <div
          className="h-full bg-green-500 transition-all duration-500 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}
