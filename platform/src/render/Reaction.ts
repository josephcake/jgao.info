import Phaser from 'phaser';
import { makeCanvas } from './ClayArt';
import { HERO_H, HERO_SCALE } from './PixelHero';

export type ReactionKind = 'alert' | 'huh' | 'heart' | 'dots' | 'zzz' | 'sweat' | 'note' | 'star';

const ICONS: Record<ReactionKind, { color: string; rows: string[] }> = {
  alert: { color: '#ff3f6a', rows: ['XX', 'XX', 'XX', '..', 'XX'] },
  huh: { color: '#2f6dff', rows: ['.XXX.', 'X...X', '...X.', '.....', '..X..'] },
  heart: { color: '#ff3f7a', rows: ['.X.X.', 'XXXXX', 'XXXXX', '.XXX.', '..X..'] },
  dots: { color: '#0a0d24', rows: ['.....', '.....', 'X.X.X', '.....', '.....'] },
  zzz: { color: '#5a6aa8', rows: ['XXXX.XXX', '...X..X.', '..X..XXX', '.X......', 'XXXX....'] },
  sweat: { color: '#3fa8ff', rows: ['..X..', '.XXX.', 'XXXXX', 'XXXXX', '.XXX.'] },
  note: { color: '#e88a1a', rows: ['..XXX', '..X.X', '..X..', 'XXX..', 'XX...'] },
  star: { color: '#e8b010', rows: ['..X..', '.XXX.', 'XXXXX', '.XXX.', '.X.X.'] },
};

/** How long a reaction stays up, in seconds. */
const HOLD = 1.3;

function bubbleTexture(scene: Phaser.Scene, kind: ReactionKind): string {
  const key = `react_${kind}`;
  if (scene.textures.exists(key)) return key;
  const icon = ICONS[kind];
  const iw = icon.rows[0].length;
  const w = Math.max(9, iw + 4);
  const h = 9;
  const [c, ctx] = makeCanvas(w, h + 2);
  const P = (x: number, y: number, col: string) => { ctx.fillStyle = col; ctx.fillRect(x, y, 1, 1); };
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const corner = (x === 0 || x === w - 1) && (y === 0 || y === h - 1);
      if (corner) continue;
      const edge = x === 0 || x === w - 1 || y === 0 || y === h - 1 || ((x === 1 || x === w - 2) && (y === 0 || y === h - 1));
      P(x, y, edge ? '#0a0d24' : '#eef6ff');
    }
  }
  // tail pointing down at PKT
  const tx = Math.floor(w / 2) - 1;
  P(tx, h - 1, '#eef6ff'); P(tx + 1, h - 1, '#eef6ff');
  P(tx - 1, h - 1, '#0a0d24'); P(tx + 2, h - 1, '#0a0d24');
  P(tx, h, '#0a0d24'); P(tx + 1, h, '#eef6ff'); P(tx + 2, h, '#0a0d24');
  P(tx + 1, h + 1, '#0a0d24');
  const ox = Math.floor((w - iw) / 2);
  icon.rows.forEach((row, y) => [...row].forEach((k, x) => { if (k === 'X') P(ox + x, 2 + y, icon.color); }));
  scene.textures.addCanvas(key, c)!.setFilter(Phaser.Textures.FilterMode.NEAREST);
  return key;
}

/** A pixel speech bubble that pops up over PKT with a one-icon reaction. */
export class Reaction {
  private img: Phaser.GameObjects.Image;
  private kind: ReactionKind | null = null;
  private t = 0;
  private cooldown: Partial<Record<ReactionKind, number>> = {};

  constructor(private scene: Phaser.Scene, depth = 62) {
    this.img = scene.add.image(0, 0, bubbleTexture(scene, 'dots')).setOrigin(0.5, 1).setDepth(depth).setVisible(false);
  }

  get object(): Phaser.GameObjects.Image { return this.img; }

  /** Show a reaction. Repeats of the same one within `gap` seconds are ignored. */
  show(kind: ReactionKind, gap = 1.5): void {
    if ((this.cooldown[kind] ?? 0) > 0) return;
    if (this.kind === 'alert' && kind !== 'alert' && this.t < 0.5) return;
    this.cooldown[kind] = gap;
    this.kind = kind;
    this.t = 0;
    this.img.setTexture(bubbleTexture(this.scene, kind)).setVisible(true);
  }

  hide(): void {
    this.kind = null;
    this.img.setVisible(false);
  }

  /** Follow PKT; (x, footY) is the bottom centre of its sprite, drawn at `heroScale`. */
  update(dt: number, x: number, footY: number, scale = HERO_SCALE, heroScale = scale): void {
    for (const k of Object.keys(this.cooldown) as ReactionKind[]) this.cooldown[k] = (this.cooldown[k] ?? 0) - dt;
    if (!this.kind) return;
    this.t += dt;
    if (this.t > HOLD) { this.hide(); return; }
    const pop = this.t < 0.08 ? this.t / 0.08 * 1.25 : this.t < 0.16 ? 1.25 - (this.t - 0.08) / 0.08 * 0.25 : 1;
    const bob = Math.floor(this.t * 3) % 2 ? scale : 0;
    const s = Math.max(1, Math.round(scale * pop));
    this.img
      .setScale(s)
      .setAlpha(this.t > HOLD - 0.2 ? (HOLD - this.t) / 0.2 : 1)
      .setPosition(Math.round(x / scale) * scale, Math.round((footY - (HERO_H - 6) * heroScale - 6 - bob) / scale) * scale);
  }
}
