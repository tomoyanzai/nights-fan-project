import type { CourseDefinition } from "@/game/spline/courseTypes";

/**
 * Verdant Hollow main course — one closed lap, flown counter-clockwise when
 * seen from above. Sections, in flight order:
 *
 *   south straight (open, generous corridor)
 *   east approach, then a full VERTICAL LOOP in the y/z plane (x drifts
 *     through the loop so the path never self-intersects)
 *   high north ridge
 *   west canyon descent (tight corridor — risk/reward)
 *   south-west banked turn home
 */
export const verdantHollowCourse: CourseDefinition = {
  name: "Verdant Hollow",
  samplesPerSegment: 32,
  points: [
    // --- south straight, heading +x ---
    { pos: [0, 15, -140], corridor: [-9, 18] },
    { pos: [60, 12, -135], corridor: [-7, 18] },
    { pos: [110, 12, -100], corridor: [-7, 16] },
    { pos: [125, 13, -70], corridor: [-7, 14] },
    // --- vertical loop (y/z plane at x≈130, x drifts +) ---
    { pos: [128, 14, -40], corridor: [-6, 10] },
    { pos: [130, 12, -10], corridor: [-5, 6] },
    { pos: [132, 27, 5], corridor: [-5, 5] },
    { pos: [134, 42, -10], corridor: [-5, 5] },
    { pos: [136, 27, -25], corridor: [-5, 5] },
    { pos: [138, 12, -10], corridor: [-5, 6] },
    { pos: [140, 14, 20], corridor: [-6, 10] },
    // --- north ridge, high and open ---
    { pos: [135, 20, 60], corridor: [-8, 16] },
    { pos: [110, 28, 95], corridor: [-8, 18] },
    { pos: [60, 34, 125], corridor: [-9, 18] },
    { pos: [0, 30, 135], corridor: [-9, 18] },
    // --- west canyon, tight ---
    { pos: [-70, 22, 125], corridor: [-6, 10] },
    { pos: [-115, 14, 85], corridor: [-4, 7] },
    { pos: [-132, 12, 30], corridor: [-4, 7] },
    { pos: [-130, 13, -35], corridor: [-5, 9] },
    // --- banked turn home ---
    { pos: [-95, 16, -95], corridor: [-7, 14] },
    { pos: [-45, 15, -128], corridor: [-8, 16] },
  ],
};
