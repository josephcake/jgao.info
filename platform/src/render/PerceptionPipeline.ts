import Phaser from 'phaser';

export const MAX_LIGHTS = 10;

/** Live values the scene writes each frame; the pipeline uploads them as uniforms. */
export const Perception = {
  heroX: 640,
  heroY: 360,
  /** Camera scroll, so the pixel grid is locked to the world instead of the screen. */
  scrollX: 0,
  scrollY: 0,
  /** 0 = Pix's neon view, 1 = seen through the lens. */
  recal: 0,
  /** What Pix can see with the colours he has (see Colours.sightFor). */
  sight: 1,
  sightMix: 1,
  sightTint: [1, 1, 1] as [number, number, number],
  /** Tint of the world under the current lens colour. */
  lens: [1.06, 1.0, 0.9] as [number, number, number],
  /** Damage glitch, decays to 0. */
  desync: 0,
  /** Scanline tearing from fast movement, 0..1. */
  tear: 0,
  /** Lightning flash, decays to 0. */
  flash: 0,
  /** Unlit surface brightness and tint. */
  ambient: [0.5, 0.56, 0.82] as [number, number, number],
  /** Colour of the haze hanging in the air. */
  haze: [0.1, 0.14, 0.3] as [number, number, number],
  /** Point lights in world px: x, y, radius, intensity (packed). */
  lights: new Float32Array(MAX_LIGHTS * 4),
  /** Light colours: r, g, b, unused (packed). */
  lightCols: new Float32Array(MAX_LIGHTS * 4),
  lightCount: 0,
  /** Unused; kept for scenes that still set it. */
  radius: 520,
};

/** Queue a point light for this frame. Returns false once the budget is full. */
export function pushLight(x: number, y: number, radius: number, color: number, intensity = 1): boolean {
  const i = Perception.lightCount;
  if (i >= MAX_LIGHTS) return false;
  Perception.lights.set([x, y, radius, intensity], i * 4);
  Perception.lightCols.set([((color >> 16) & 255) / 255, ((color >> 8) & 255) / 255, (color & 255) / 255, 0], i * 4);
  Perception.lightCount = i + 1;
  return true;
}

/** World pixel size in screen px; matches HERO_SCALE so PKT and the world share a grid. */
export const WORLD_PIXEL = 3;

const FRAG = `
precision mediump float;
uniform sampler2D uMainSampler;
uniform vec2 uResolution;
uniform float uTime;
uniform vec2 uScroll;
uniform float uRecal;
uniform vec3 uLens;
uniform float uSight;
uniform float uSightMix;
uniform vec3 uSightTint;
uniform float uDesync;
uniform float uTear;
uniform float uFlash;
uniform vec3 uAmbient;
uniform vec3 uHaze;
uniform vec4 uLights[${MAX_LIGHTS}];
uniform vec4 uLightCols[${MAX_LIGHTS}];
uniform float uLightCount;
varying vec2 outTexCoord;

const float CELL = ${WORLD_PIXEL.toFixed(1)};

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float luma(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }
float bayer2(vec2 a) { a = floor(a); return fract(a.x / 2.0 + a.y * a.y * 0.75); }
float bayer4(vec2 a) { return bayer2(0.5 * a) * 0.25 + bayer2(a); }
vec3 posterize(vec3 c, float levels, float d) { return clamp(floor(c * levels + d) / levels, 0.0, 1.0); }

vec4 tap(vec2 uv) {
  vec4 s = texture2D(uMainSampler, uv);
  return vec4(s.a > 0.001 ? s.rgb / s.a : vec3(0.0), s.a);
}

void main() {
  vec2 res = uResolution;
  vec2 sp = vec2(outTexCoord.x * res.x, (1.0 - outTexCoord.y) * res.y);
  vec2 wp = sp + uScroll;
  float frame = floor(uTime * 12.0);

  float band = floor(sp.y / 6.0);
  float tearOn = step(1.0 - uTear * 0.18 - uDesync * 0.25, hash(vec2(band, frame)));
  wp.x += tearOn * (hash(vec2(band * 1.7, frame + 3.0)) - 0.5) * 60.0 * max(uTear, uDesync);

  // world-locked pixel grid
  vec2 cell = floor(wp / CELL);
  vec2 cw = (cell + 0.5) * CELL;
  vec2 cs = cw - uScroll;
  vec2 uv = vec2(cs.x / res.x, 1.0 - cs.y / res.y);
  vec2 texel = 1.0 / res;

  float ca = (uDesync * 6.0 + uTear * 3.0) * CELL;
  vec4 s = tap(uv);
  vec3 c = vec3(tap(uv + vec2(ca, 0.0) * texel).r, s.g, tap(uv - vec2(ca, 0.0) * texel).b);
  float a = s.a;

  // bloom: soft glow from bright neighbours
  vec3 glow = vec3(0.0);
  for (int i = 0; i < 8; i++) {
    float ang = float(i) * 0.785398 + 0.39;
    vec2 o = vec2(cos(ang), -sin(ang)) * texel;
    vec4 s1 = tap(uv + o * 6.0);
    vec4 s2 = tap(uv + o * 15.0);
    glow += s1.rgb * s1.a * max(max(s1.r, max(s1.g, s1.b)) - 0.6, 0.0);
    glow += s2.rgb * s2.a * max(max(s2.r, max(s2.g, s2.b)) - 0.62, 0.0) * 0.6;
  }
  glow /= 8.0;

  // point lights, evaluated at the pixel-cell centre so light falls in pixel steps
  vec3 light = vec3(0.0);
  for (int i = 0; i < ${MAX_LIGHTS}; i++) {
    vec4 L = uLights[i];
    float k = clamp(1.0 - length(cw - L.xy) / max(L.z, 1.0), 0.0, 1.0);
    light += uLightCols[i].rgb * (L.w * k * sqrt(k) * 0.8);
  }

  float dith = bayer4(cell) - 0.5;
  vec3 ambient = uAmbient + vec3(0.5, 0.55, 0.8) * uFlash;
  vec3 lit = c * (ambient + light * 1.5);
  // emissive pixels (neon, ports, screens) ignore the lighting
  float mx = max(c.r, max(c.g, c.b));
  float mn = min(c.r, min(c.g, c.b));
  float emissive = step(0.55, mx > 0.001 ? (mx - mn) / mx : 0.0) * step(0.6, mx);
  lit = mix(lit, c * 1.1, emissive);
  // gentle grade: a touch of contrast and saturation
  float l = luma(lit);
  lit = mix(vec3(l), lit, 1.15);
  lit = posterize(lit, 40.0, dith * 0.6 + 0.5);

  // haze hangs in the air everywhere; lights illuminate it
  float lowFog = smoothstep(0.2, 1.0, sp.y / res.y);
  vec3 haze = uHaze * (0.5 + 0.6 * lowFog) + light * 0.08 + glow * 0.9;

  vec3 truth = posterize(c * uLens, 24.0, dith * 0.6 + 0.5);
  float glitch = step(0.55, uDesync) * step(0.5, hash(vec2(frame, 7.0)));
  vec3 col = mix(lit, truth, clamp(max(uRecal, glitch), 0.0, 1.0));

  // premultiplied output: surfaces over the soft background, haze and bloom over everything
  vec3 outc = col * a + haze * (1.0 - a * 0.6);
  float outa = clamp(a + luma(haze) * 1.2, 0.0, 1.0);
  outc = mix(vec3(luma(outc)) * uSightTint, outc, uSightMix) * uSight;
  gl_FragColor = vec4(outc, outa);
}
`;

/** Post-FX applied to the world camera only. PKT is drawn on a separate, unfiltered camera. */
export class PerceptionPipeline extends Phaser.Renderer.WebGL.Pipelines.PostFXPipeline {
  constructor(game: Phaser.Game) {
    super({ game, name: 'Perception', fragShader: FRAG });
  }

  onPreRender(): void {
    const w = this.renderer.width;
    const h = this.renderer.height;
    this.set2f('uResolution', w, h);
    this.set1f('uTime', this.game.loop.time / 1000);
    this.set2f('uScroll', Perception.scrollX, Perception.scrollY);
    this.set1f('uRecal', Perception.recal);
    this.set3f('uLens', ...Perception.lens);
    this.set1f('uSight', Perception.sight);
    this.set1f('uSightMix', Perception.sightMix);
    this.set3f('uSightTint', ...Perception.sightTint);
    this.set1f('uDesync', Perception.desync);
    this.set1f('uTear', Perception.tear);
    this.set1f('uFlash', Perception.flash);
    this.set3f('uAmbient', ...Perception.ambient);
    this.set3f('uHaze', ...Perception.haze);
    this.set4fv('uLights', Perception.lights);
    this.set4fv('uLightCols', Perception.lightCols);
    this.set1f('uLightCount', Perception.lightCount);
  }
}
