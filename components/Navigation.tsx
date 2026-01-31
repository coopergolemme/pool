"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { haptic } from "../lib/haptics";

export function Navigation() {
  const pathname = usePathname();

  const isActive = (path: string) => pathname === path;

  return (
    <nav className="relative z-[100] border-t border-white/10 bg-black/80 backdrop-blur-xl supports-[backdrop-filter]:bg-black/60 pb-[max(env(safe-area-inset-bottom),1rem)] sm:fixed sm:top-0 sm:bottom-auto sm:left-0 sm:right-0 sm:border-b sm:border-t-0 sm:pb-0">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="hidden font-[var(--font-display)] text-xl tracking-wider text-white sm:block">
          POOL
        </Link>
        
        <div className="flex w-full items-center justify-around sm:w-auto sm:gap-8">
          <Link
            href="/"
            onClick={() => haptic.light()}
            className={`flex flex-col items-center gap-1 p-2 text-xs font-medium uppercase tracking-wider transition-colors sm:flex-row sm:text-sm ${
              isActive("/") ? "text-white" : "text-white/50 hover:text-white/80"
            }`}
          >
            <span className="text-lg sm:hidden">🏠</span>
            <span>Home</span>
          </Link>

          <Link
            href="/leaderboard"
            onClick={() => haptic.light()}
            className={`flex flex-col items-center gap-1 p-2 text-xs font-medium uppercase tracking-wider transition-colors sm:flex-row sm:text-sm ${
              isActive("/leaderboard") ? "text-white" : "text-white/50 hover:text-white/80"
            }`}
          >
            <span className="text-lg sm:hidden">🏆</span>
            <span>Leaderboard</span>
          </Link>

          <Link
            href="/add"
            onClick={() => haptic.light()}
            className={`flex flex-col items-center gap-1 p-2 text-xs font-medium uppercase tracking-wider transition-colors sm:flex-row sm:text-sm ${
              isActive("/add") ? "text-white" : "text-white/50 hover:text-white/80"
            }`}
          >
            <span className="text-lg sm:hidden">🎱</span>
            <span>Add Game</span>
          </Link>
        </div>
      </div>
    </nav>
  );
}
