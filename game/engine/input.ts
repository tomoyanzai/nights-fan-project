import { clamp } from "./math";

export interface InputFrame {
  /** analog move vector, each axis in [-1, 1]; x = along track, y = vertical */
  move: { x: number; y: number };
  boost: boolean;
  /** true only on the step the boost control went down */
  boostPressed: boolean;
  pause: boolean;
  /** true only on the step the pause control went down */
  pausePressed: boolean;
}

const ATTACK_TIME = 0.12; // digital key 0 → 1, seconds
const RELEASE_TIME = 0.08;
const GAMEPAD_DEADZONE = 0.15;

const KEY_AXES: Record<string, { axis: "x" | "y"; sign: 1 | -1 }> = {
  KeyD: { axis: "x", sign: 1 },
  ArrowRight: { axis: "x", sign: 1 },
  KeyA: { axis: "x", sign: -1 },
  ArrowLeft: { axis: "x", sign: -1 },
  KeyW: { axis: "y", sign: 1 },
  ArrowUp: { axis: "y", sign: 1 },
  KeyS: { axis: "y", sign: -1 },
  ArrowDown: { axis: "y", sign: -1 },
};

const BOOST_KEYS = new Set(["Space", "ShiftLeft", "ShiftRight"]);
const PAUSE_KEYS = new Set(["Escape", "KeyP"]);

/**
 * Merges keyboard (smoothed through attack/release ramps so digital input
 * feels analog) and gamepad (polled each update). Per axis, the source with
 * the largest magnitude wins.
 */
export class InputManager {
  readonly frame: InputFrame = {
    move: { x: 0, y: 0 },
    boost: false,
    boostPressed: false,
    pause: false,
    pausePressed: false,
  };

  private readonly keysDown = new Set<string>();
  private readonly smoothed = { x: 0, y: 0 };
  private prevBoost = false;
  private prevPause = false;
  private attached = false;

  attach(): void {
    if (this.attached || typeof window === "undefined") return;
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    window.addEventListener("blur", this.onBlur);
    this.attached = true;
  }

  dispose(): void {
    if (!this.attached) return;
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    window.removeEventListener("blur", this.onBlur);
    this.attached = false;
    this.keysDown.clear();
  }

  update(dt: number): void {
    // --- keyboard: raw digital target per axis ---
    let rawX = 0;
    let rawY = 0;
    for (const code of this.keysDown) {
      const mapping = KEY_AXES[code];
      if (!mapping) continue;
      if (mapping.axis === "x") rawX = clamp(rawX + mapping.sign, -1, 1);
      else rawY = clamp(rawY + mapping.sign, -1, 1);
    }
    this.smoothed.x = ramp(this.smoothed.x, rawX, dt);
    this.smoothed.y = ramp(this.smoothed.y, rawY, dt);

    let boostDown = false;
    for (const code of BOOST_KEYS) if (this.keysDown.has(code)) boostDown = true;
    let pauseDown = false;
    for (const code of PAUSE_KEYS) if (this.keysDown.has(code)) pauseDown = true;

    let moveX = this.smoothed.x;
    let moveY = this.smoothed.y;

    // --- gamepad ---
    const pads = typeof navigator !== "undefined" && navigator.getGamepads ? navigator.getGamepads() : [];
    for (const pad of pads) {
      if (!pad || !pad.connected) continue;
      const gx = applyDeadzone(pad.axes[0] ?? 0, pad.axes[1] ?? 0);
      if (Math.abs(gx.x) > Math.abs(moveX)) moveX = gx.x;
      if (Math.abs(gx.y) > Math.abs(moveY)) moveY = gx.y;
      if (pad.buttons[0]?.pressed || pad.buttons[7]?.pressed) boostDown = true;
      if (pad.buttons[9]?.pressed) pauseDown = true;
      break; // first connected pad only
    }

    this.frame.move.x = moveX;
    this.frame.move.y = moveY;
    this.frame.boost = boostDown;
    this.frame.boostPressed = boostDown && !this.prevBoost;
    this.frame.pause = pauseDown;
    this.frame.pausePressed = pauseDown && !this.prevPause;
    this.prevBoost = boostDown;
    this.prevPause = pauseDown;
  }

  private readonly onKeyDown = (e: KeyboardEvent) => {
    if (KEY_AXES[e.code] || BOOST_KEYS.has(e.code) || PAUSE_KEYS.has(e.code)) {
      e.preventDefault();
    }
    this.keysDown.add(e.code);
  };

  private readonly onKeyUp = (e: KeyboardEvent) => {
    this.keysDown.delete(e.code);
  };

  private readonly onBlur = () => {
    this.keysDown.clear();
  };
}

function ramp(current: number, target: number, dt: number): number {
  const rate = Math.abs(target) > Math.abs(current) ? dt / ATTACK_TIME : dt / RELEASE_TIME;
  const delta = target - current;
  const step = clamp(delta, -rate, rate);
  return Math.abs(delta) <= rate ? target : current + step;
}

function applyDeadzone(x: number, y: number): { x: number; y: number } {
  // Gamepad y axis is inverted (up = negative); flip so up = +y.
  const fy = -y;
  const mag = Math.hypot(x, fy);
  if (mag < GAMEPAD_DEADZONE) return { x: 0, y: 0 };
  const scale = Math.min((mag - GAMEPAD_DEADZONE) / (1 - GAMEPAD_DEADZONE), 1) / mag;
  return { x: x * scale, y: fy * scale };
}
