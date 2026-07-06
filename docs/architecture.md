# Dreamflight — Architecture

A NiGHTS-into-Dreams-inspired 2.5D flight game for the browser. Educational fan
recreation; every asset (geometry, shaders, audio) is procedural and original.

## Stack

- Next.js 15 (App Router) + React 19 + strict TypeScript, pnpm
- Three.js + React Three Fiber + Drei for rendering
- Zustand for UI-facing state
- GLSL shaders authored as TypeScript template literals (`game/shaders/*.ts`,
  tagged `/* glsl */`) — deliberate choice to avoid bundler loader config
- Web Audio API for synthesized SFX and generative music
- Leva + stats.js for debug tooling

### Why no physics engine (yet)

The flight model is fully kinematic: the player's authoritative state is a 2D
coordinate `(s, y)` on a surface swept along the course spline. Pickups reduce
to 2D distance checks in track space; course bounds are a corridor clamp on
`y`. A physics engine would fight the constraint, not help it, and Rapier's
WASM bundle adds real cost.

The seam is kept open for enemies/bosses: `game/engine/collision.ts` defines a
`CollisionWorld` interface. The slice ships `TrackSpaceCollisionWorld`; a
Rapier-backed implementation can replace it behind the same interface when
free-flying entities arrive.

## The prime directive

**React renders; it never owns game logic.**

- Simulation runs in plain TypeScript classes driven by a fixed-timestep
  `GameLoop` (`game/core/gameLoop.ts`) that owns its own `requestAnimationFrame`.
- Two subscription tiers keep React out of the hot path:
  1. **60 fps visuals** — R3F components hold refs and copy transforms from
     game state inside `useFrame`. No React state is touched per frame.
  2. **Low-frequency UI** — systems write to the Zustand store
     (`game/core/gameStore.ts`) only when a value actually changes (score on
     pickup, timer at 10 Hz, phase on transition). HUD components subscribe
     with selectors. Anything that must animate smoothly (link-timer drain
     bar) uses a transient `store.subscribe` writing to a DOM ref.
- React/DOM components never mutate game state directly; they call actions on
  the `Game` composition root or store actions, which forward to systems.

## Layout (feature-based)

```
app/            Next.js entry; page.tsx is a server component
game/
  core/         GameLoop, Game (composition root), EventBus, Zustand store,
                tuning constants
  engine/       generic machinery: math (springs, 2D intersection), seeded
                RNG/noise, object pool, input manager, collision interface
  spline/       Catmull-Rom track: arc-length table, rotation-minimizing
                frames, curvature, corridor
  player/       flight controller, boost, paraloop detection
  camera/       track-space camera rig + thin R3F controller
  gameplay/     rings, bluechips, combo, scoring, mare director
  stages/       StageDefinition + one folder per stage (data + environment)
  renderer/     R3F views: canvas, player, trail, particles, instanced
                collectibles
  shaders/      GLSL template literals
  audio/        Web Audio engine, synth patches, SFX map, generative music
  ui/           DOM overlay: HUD, screens, transitions
  assets/       palette + character proportions as data (no binary assets)
  debug/        Leva panels, spline visualizer, stats
docs/           this file + mechanics notes
scripts/        Playwright verification
```

## Simulation model

- **Track space**: the course is a closed centripetal Catmull-Rom spline with
  an explicit arc-length sample table and rotation-minimizing frames (parallel
  transport with closure correction). A frame at arc length `s` gives
  `{position, tangent, up, side}`.
- **Player**: state `(s, y)` + velocity `(vs, vy)`; world position is
  `frame(s).position + frame(s).up * y`. Input x drives `vs`, input y drives
  `vy`; loops and hills come free from the moving frame.
- **Camera**: also lives in track space (`sCam, yCam` + lateral offset along
  `side`), so it inherits course roll through loops automatically. Smoothing
  uses critically damped springs, never lerp.
- **Update order** (per fixed 60 Hz step): input → player (incl. paraloop) →
  collectibles → combo → mare director → camera → audio tick.
- **Events**: systems communicate through a typed `EventBus`
  (discriminated-union `GameEvent`); audio/FX/UI subscribe rather than being
  called directly.

## Extension seams (post-slice)

- Enemies/bosses: implement as systems registered on the loop; FSM per enemy;
  `CollisionWorld` swaps to a Rapier implementation.
- New stages: a `StageDefinition` is pure data (course points, collectible
  layout patterns, music seed) plus one static environment component.
- Gamepad is already abstracted behind `InputManager`.
