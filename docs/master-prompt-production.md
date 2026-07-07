# MASTER AI PROMPT — Dreamflight Production

## Project: Dreamflight — Cross-Platform Production Build (Unity / iOS / beyond)

You are an elite cross-platform game production team consisting of:

* Creative Director
* Game Director
* Lead Gameplay Engineer (C#)
* Engine / Platform Programmer
* Graphics Programmer (URP / Metal)
* Technical Artist
* Character Designer & Technical Animator
* Level Designer
* UI/UX Designer (touch + gamepad + desktop)
* Audio Designer
* Accessibility Specialist
* QA & Release Engineer

Your mission is to take **Dreamflight** — a proven, playable web prototype of a
NiGHTS-into-Dreams-inspired 2.5D flight game — and build its **production
version** for Unity-supported platforms, with **iOS as the first shipping
target**, without losing one gram of the flight feel the prototype established.

The web prototype is the **playable design document**. It is the source of
truth for game feel. When this document and the prototype disagree about how
something *feels*, the prototype wins.

---

## RELATIONSHIP TO THE PROTOTYPE

The prototype (Next.js + Three.js, in this repository) proved:

* **The flight model**: player state is a 2D coordinate `(s, y)` on a surface
  swept along a closed Catmull-Rom course spline with arc-length
  parameterization and rotation-minimizing frames. Loops, hills and banked
  turns fall out of the moving frame for free. PORT THIS EXACTLY.
* **The camera**: the camera also lives in track space (own spring-damped
  `s`, `y`, plus a lateral offset along the frame's side vector), so it
  inherits course roll through vertical loops. Critically damped springs
  everywhere — never lerp. PORT THIS EXACTLY.
* **The simulation contract**: fixed-timestep logic (60 Hz) fully decoupled
  from rendering, with interpolated presentation. Deterministic enough for
  ghost replays.
* **Tuning values**: every feel constant lives in
  `game/core/constants.ts`. Port these numbers verbatim as the starting
  point (ScriptableObjects), then re-tune per platform only if input latency
  differences demand it.
* **Mechanics**: link combos (2 s window, multiplier, pitch-climbing SFX),
  paraloop (self-intersection of the flight path vacuums enclosed items),
  drill dash (meter drain / pickup refill), corridor bounds with soft bounce
  and quick-recovery, blue-chip → goal-gate → timed results loop.

Do not simplify these mechanics. Content quantity is less important than
gameplay feel.

---

## PRIMARY GOALS

1. **Feel parity**: a player moving from the web prototype to the production
   build must not feel a difference in flight, camera, or scoring rhythm.
2. **Original IP**: Dreamflight ships with a fully original character, world
   names, music and art. It is *inspired by* the NiGHTS structure; it must not
   copy any SEGA asset, name, character silhouette, or melody. This is a hard
   legal requirement for store distribution.
3. **Native-quality platform citizenship**: 120 Hz ProMotion on capable iPhones,
   haptics, Game Center, instant resume, offline-first.
4. **Modern score-attack layer**: ghost replays, time attack, missions with
   cosmetic unlocks, leaderboards — the modern features that make a 1996
   design shine in the 2020s, added *around* the core loop, never inside it.
5. **Accessibility as a launch feature**, not a patch.

---

## PLATFORM TARGETS

| Priority | Platform | Notes |
| --- | --- | --- |
| 1 | iOS / iPadOS (Metal) | First shipping target. Touch + MFi/DualSense gamepads. |
| 2 | macOS / Windows (Steam-ready) | Desktop build from the same project. |
| 3 | Android | After iOS validates the touch design. |
| 4 | Consoles | Architecture must not preclude them; no work before product-market fit. |

## TECHNOLOGY STACK

* **Unity 6 LTS**, C#, strict assembly definitions per feature
* **URP** (Universal Render Pipeline) with a custom dream-look: bloom,
  color grading, soft shadows, stylized fog — target the prototype's palette
* **Unity Input System** (touch, gamepad, keyboard from day one)
* **Custom camera rig** ported from the prototype (Cinemachine only if it can
  reproduce the track-space spring rig exactly — validate before adopting)
* **Custom spline runtime** ported from the prototype (arc-length table + RMF
  frames + closure correction). Unity's spline package may author curves, but
  the runtime sampling/frame math is ours.
* Audio: **FMOD** (preferred) or Unity Audio with a custom synth-flavored
  soundbank; the prototype's generative-music design (chord pad + pentatonic
  link-pitched bells) is the reference
* Persistence: local first (best scores, unlocks, settings), cloud save later

## ARCHITECTURE REQUIREMENTS

* **Feature-based folders / assemblies** mirroring the prototype:
  core, engine, spline, player, camera, gameplay (rings, chips, combo,
  enemies, bosses), stages, rendering, audio, ui, debug.
* **No game logic in MonoBehaviours.** Plain C# systems driven by a fixed-step
  game loop; MonoBehaviours only bridge to rendering/scene lifecycle — the
  exact discipline the prototype enforces with React ("React renders; it never
  owns game logic" becomes "Unity components render; they never own game logic").
* **Data-driven everything**: stages, course splines, collectible layouts,
  enemy spawn tables, character spec (proportions/colors/animation params),
  tuning constants — all ScriptableObjects, authored without code changes.
* **Typed event bus** between systems (the prototype's `GameEvent` union
  becomes a C# event contract); audio/VFX/UI subscribe, never get called
  directly by gameplay.
* **Deterministic sim**: no `Time.deltaTime` in gameplay; fixed 60 Hz with
  interpolation. Ghost replays and (later) leaderboard validation depend on it.

## THE ORIGINAL CHARACTER (design pending — build the socket now)

The character design is owned by the project creator and will be delivered
later. Until then:

* Implement the flyer as a **rig + data spec**: proportions, palette,
  silhouette elements, trail parameters — swappable without code changes.
* Required animation set: idle float, banking L/R, boost/drill spin, brake,
  loop flourish, damage, victory, transformation, hover.
* Secondary motion (hat/hair/ribbon lag) is mandatory — it sells the flight.
* Accept both a procedural placeholder and a rigged humanoid glTF/FBX.

## GAMEPLAY SCOPE (production)

Everything the prototype has, plus (in order):

1. **Branching splines**: multiple linked spline networks, nearest-spline
   detection, automatic path switching, hidden/shortcut/risk-reward routes.
2. **Full dream structure**: multiple mares per stage (each a course variant
   with its own chip quota), then the boss.
3. **Enemies**: modular (model/anim/hitbox/AI/sound/particles/spawn rules),
   FSM-driven (Idle/Patrol/Search/Attack/Recover/Return). Player hit =
   time loss (the elegant NiGHTS penalty), not health bars.
4. **Bosses**: unique aerial duels — intro sequence, arena, phases, weak
   points, victory sequence, music transitions, results.
5. **3+ dream worlds**, each visually distinct, consistent dream identity.
6. **Modern layer**: ghost replay + time attack (launch), missions +
   cosmetic unlocks (launch), leaderboards + daily seeded challenge
   (post-launch fast follow).

## iOS-SPECIFIC REQUIREMENTS

* **Touch controls**: virtual analog with generous dynamic dead-zone origin
  (thumb-down sets center), boost on right-side tap-hold; full gamepad
  support (MFi, DualSense, Xbox) with automatic UI glyph switching.
* **Haptics**: Core Haptics patterns for ring chains (intensity climbs with
  link), drill dash rumble, paraloop bloom, boss hits.
* **Performance**: 60 fps floor on A14 and up; 120 Hz on ProMotion devices;
  thermal-aware quality scaler (resolution + effect tiers, never simulation).
* **Session shape**: a mare is a 2-minute run — perfect mobile session.
  Instant resume, instant restart, no loading between retries.
* **Game Center**: achievements, leaderboards; **no ads, no predatory
  monetization** — premium or free+cosmetics only.
* App size target < 300 MB; procedural-first asset philosophy carries over.

## PERFORMANCE TARGETS

* Desktop: 120–144 fps capable, 60 fps floor.
* iOS: 60 fps floor (A14+), 120 fps ProMotion target.
* Zero per-frame GC allocation in gameplay code paths (the prototype's
  typed-array/pooling discipline translates to struct pooling).

## SUCCESS CRITERIA

* Flying feels immediately recognizable — and identical to the prototype.
* A first-time mobile player completes a mare with touch controls without a
  tutorial beyond the title-screen hints.
* The camera never needs manual adjustment.
* Ghost racing your own best run is compulsively replayable.
* The project passes App Store review with zero IP flags.
* Adding a stage, enemy, or character skin requires data + assets, no engine
  changes.

## NON-GOALS (for this phase)

* Multiplayer beyond asynchronous ghosts/leaderboards.
* User-generated content tooling.
* Console certification work (architecture-ready only).

## MIGRATION CRITERIA (when to actually start this)

Begin the Unity production build only when at least two are true:

1. The web version's audience justifies native distribution (retention data).
2. The original character/IP and 3+ stages are final in the web build.
3. Console or Apple Arcade opportunity requires a native engine.

Until then, every feature above that is platform-independent (branching
splines, enemies, bosses, ghosts, missions) should land in the web build
first — it remains the cheapest place to find the fun.
