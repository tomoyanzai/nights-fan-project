export const skyVertex = /* glsl */ `
varying vec3 vDir;

void main() {
  vDir = normalize(position);
  // pin the dome to the camera so it reads as infinitely far away
  vec4 pos = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * pos;
  gl_Position.z = gl_Position.w * 0.99999; // always at the far plane
}
`;

export const skyFragment = /* glsl */ `
precision highp float;

uniform vec3 uZenith;
uniform vec3 uMid;
uniform vec3 uHorizon;
uniform vec3 uSunColor;
uniform vec3 uSunDir;
uniform float uTime;

varying vec3 vDir;

float hash21(vec2 p) {
  p = fract(p * vec2(234.34, 435.345));
  p += dot(p, p + 34.23);
  return fract(p.x * p.y);
}

float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = hash21(i);
  float b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0));
  float d = hash21(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

float fbm(vec2 p) {
  float v = 0.0;
  float amp = 0.5;
  for (int i = 0; i < 3; i++) {
    v += vnoise(p) * amp;
    p *= 2.1;
    amp *= 0.5;
  }
  return v;
}

void main() {
  vec3 dir = normalize(vDir);
  float h = clamp(dir.y, -0.1, 1.0);

  // dream gradient: horizon -> mid -> zenith
  vec3 col = mix(uHorizon, uMid, smoothstep(0.0, 0.35, h));
  col = mix(col, uZenith, smoothstep(0.3, 0.85, h));

  // soft scrolling clouds on a projected plane, denser near the horizon band
  vec2 cuv = dir.xz / max(dir.y + 0.28, 0.12);
  float clouds = fbm(cuv * 1.4 + vec2(uTime * 0.012, uTime * 0.004));
  float band = smoothstep(0.02, 0.25, h) * (1.0 - smoothstep(0.35, 0.8, h));
  col += vec3(1.0, 0.93, 0.9) * smoothstep(0.55, 0.85, clouds) * band * 0.35;

  // sun disc + halo
  float sun = dot(dir, normalize(uSunDir));
  col += uSunColor * (smoothstep(0.9985, 0.9995, sun) + pow(max(sun, 0.0), 24.0) * 0.18);

  // faint twinkling stars high in the dome
  float starField = hash21(floor(dir.xz / max(dir.y, 0.2) * 220.0));
  float star = step(0.9975, starField) * smoothstep(0.35, 0.7, h);
  col += vec3(star) * (0.55 + 0.45 * sin(uTime * 2.0 + starField * 40.0));

  gl_FragColor = vec4(col, 1.0);
}
`;
