# Dreamflight

A browser recreation of the *feel* of NiGHTS into Dreams: 2.5D spline-rail
flight through a dream world, link combos, paraloops, drill dashes and a
countdown to the goal gate. An educational fan project — every asset
(geometry, shaders, audio) is procedural and original; nothing is extracted
from or imitates the original game's assets.

Built with Next.js 15, React 19, TypeScript, Three.js / React Three Fiber,
Zustand, GLSL and the Web Audio API. Game logic runs in plain TypeScript on a
fixed-timestep loop; React only renders. See `docs/architecture.md`.

## Run it

```bash
pnpm install
pnpm dev        # http://localhost:3000
```

- ← → fly · ↑ ↓ climb/dive · Space/Shift drill dash · Esc pause
- Collect 20 blue chips, then fly through the glowing gate before 2:00 runs out.
- Fly a closed loop around collectibles to **paraloop** them all at once.
- Dev builds (or `?debug=1`) get Leva tuning panels, an FPS meter and a
  spline visualizer (backquote to toggle).

## Verify

```bash
pnpm build                          # type-safe production build
pnpm dev &                          # then:
node scripts/verify-screenshot.mjs  # headless smoke test + screenshots
```

`docs/mechanics.md` has the scoring rules and a manual feel checklist.

## Future platforms

The production charter for porting Dreamflight to Unity / iOS (goals,
requirements, migration criteria — written as a hand-off AI master prompt)
lives at `docs/master-prompt-production.md`.
