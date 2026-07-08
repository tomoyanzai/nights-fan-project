# Dreamflight — Mechanics & Feel Notes

## Controls

| Input | Action |
| --- | --- |
| ← / → (A/D) | fly along the course (backward is allowed) |
| ↑ / ↓ (W/S) | climb / dive within the course plane |
| Space / Shift | drill dash (drains the boost meter; pickups refill it) |
| Esc / P | pause |
| ` (backquote) | toggle the spline visualizer (debug builds) |
| gamepad | left stick = fly, A/RT = dash, Start = pause |

## The loop of a run (one "Mare")

1. Spawn just past the goal gate with 2:00 on the clock.
2. Collect **20 Blue Chips** scattered around the ~976 m lap.
3. The **goal gate ignites** — fly through it before time runs out.
4. Results: score + best link + rank (C/B/A/S; time left adds 10/s).

Timeout ⇒ "Night Over" results without a rank.

## Scoring

- Ring 10 × link, Blue Chip 20 × link.
- **Link**: pickups within 2 s of each other chain; the chain multiplies
  score and the ring SFX pitch climbs a pentatonic scale with it.
- **Paraloop**: fly a closed loop (≥ ~20 m² in the course plane) and
  everything inside is vacuumed to you — 100 pts + 20/item, and vacuumed
  items join the chain. The two chip circles on the course are paraloop
  bait: circling them is much faster than threading them.

## Free Run

A scoreless, timerless mode for flying the dream world purely for pleasure —
entered from the title with **F** (or the "Free Flight" button). No timer,
score, chips, link or boss: the HUD shows only the drill-dash meter and a
subtle "Free Flight" label.

- **Wider bounds.** The corridor is scaled ~3.5× around its midpoint with an
  added ceiling lift (`FREERUN.corridorScale` / `corridorLift`), opening up
  the flyable sky. The soft bounce/recovery is unchanged.
- **Musical flight.** Speed (or a held drill dash) opens a lowpass filter on
  the pad and thickens the melody; altitude lifts the melody register. Ring
  and chip pickup notes are pitched by the item's **altitude** instead of the
  link chain. A paraloop triggers a **swell** — the chord progression jumps
  forward with a louder pad stab as the payoff.
- **Respawning world.** Collectibles are notes, not points: picking one up
  scores nothing but plays its note and refills a little boost, then the item
  returns after `FREERUN.respawnDelay` seconds so the world never empties.
- **Passive nightmaren.** Enemies never leave patrol and pass harmlessly
  through the player — drifting dream scenery rather than threats.

## Feel checklist (manual QA)

- [ ] Vertical loop transit: camera rolls through with no flip or pop.
- [ ] Course seam (s = 0): no visual/physics pop at the start line.
- [ ] Paraloop fires on a deliberately flown circle; not on jitter.
- [ ] Ring chain pitch audibly ascends; link break plays a resolve.
- [ ] Corridor bounce never feels sticky (quick-recovery window).
- [ ] Drill dash: FOV widens, camera dollies out, spin animation, whoosh.
- [ ] Reverse flight: character yaws 180°, camera look-ahead flips smoothly.
- [ ] Hovering drains the ribbon and never triggers paraloops.

## Tuning

All feel constants live in `game/core/constants.ts` as mutable objects and
are bound to Leva panels (dev builds or `?debug=1`): flight accel/drag/boost,
camera spring frequencies/look-ahead/FOV kick, link window, paraloop
thresholds, plus cheats (time scale, instant goal unlock, restart).
