/**
 * Proportions and colors of the flyer as data. Original design: a slim,
 * legless acrobat with a two-horned jester silhouette. Colors are our own
 * dream palette, not any existing character's.
 */
export const CHARACTER = {
  colors: {
    body: "#8e2fbe",
    bodyAccent: "#d24bd2",
    chest: "#e05aa0",
    head: "#f2d3b8",
    hat: "#5a1f8e",
    hatTip: "#ffd76a",
    collar: "#ffffff",
    glove: "#f5f0ff",
    eye: "#2ee8e0",
  },
  /** lathe profile of the torso: [radius, y] pairs from tail to neck */
  torsoProfile: [
    [0.0, -1.05],
    [0.09, -0.72],
    [0.2, -0.34],
    [0.3, 0.02],
    [0.31, 0.28],
    [0.22, 0.5],
    [0.12, 0.62],
    [0.0, 0.66],
  ] as const,
  headRadius: 0.26,
  headZ: 0.88,
  hornLength: 0.62,
  armLength: 0.62,
  shoulderX: 0.3,
  shoulderZ: 0.42,
} as const;
