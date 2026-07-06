export const ribbonVertex = /* glsl */ `
attribute float aAge; // 0 = newest, 1 = oldest

varying float vAge;
varying float vAcross;

attribute float aAcross;

void main() {
  vAge = aAge;
  vAcross = aAcross;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export const ribbonFragment = /* glsl */ `
precision highp float;

uniform float uTime;

varying float vAge;
varying float vAcross;

vec3 hsv2rgb(vec3 c) {
  vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
  vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
  return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

void main() {
  // signature rainbow: hue cycles along the ribbon and drifts with time
  vec3 col = hsv2rgb(vec3(fract(vAge * 1.1 + uTime * 0.22), 0.8, 1.0));
  float edge = 1.0 - abs(vAcross);
  float alpha = 0.85 * pow(1.0 - vAge, 1.6) * smoothstep(0.0, 0.5, edge);
  gl_FragColor = vec4(col * alpha, alpha);
}
`;
