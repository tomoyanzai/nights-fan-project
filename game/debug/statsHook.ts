"use client";

import { useEffect } from "react";

/** Mounts a stats.js FPS meter (development only). */
export function useStats(enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return;
    let stats: { dom: HTMLElement; begin(): void; end(): void } | null = null;
    let rafId = 0;
    let cancelled = false;

    void import("stats.js").then(({ default: Stats }) => {
      if (cancelled) return;
      stats = new Stats();
      stats.dom.style.left = "auto";
      stats.dom.style.right = "0";
      document.body.appendChild(stats.dom);
      const loop = () => {
        stats?.end();
        stats?.begin();
        rafId = requestAnimationFrame(loop);
      };
      rafId = requestAnimationFrame(loop);
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(rafId);
      if (stats) stats.dom.remove();
    };
  }, [enabled]);
}
