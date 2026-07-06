export const guideVertex = /* glsl */ `
attribute float aS; // arc length along the course, normalized 0..1

varying float vS;
varying float vAcross; // -1..1 across the ribbon

attribute float aAcross;

void main() {
  vS = aS;
  vAcross = aAcross;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export const guideFragment = /* glsl */ `
precision highp float;

uniform vec3 uColor;
uniform float uTime;

varying float vS;
varying float vAcross;

void main() {
  // soft edges across the ribbon
  float edge = 1.0 - abs(vAcross);
  edge = smoothstep(0.0, 0.6, edge);

  // pulses travelling along the course, like idea trails
  float pulse = 0.5 + 0.5 * sin((vS * 60.0 - uTime * 0.9) * 6.2831);
  pulse = pow(pulse, 3.0);

  float alpha = edge * (0.05 + 0.22 * pulse);
  gl_FragColor = vec4(uColor, alpha);
}
`;
