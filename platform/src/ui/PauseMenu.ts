import Phaser from 'phaser';
import type { GameScene } from '../scenes/GameScene';

export type PauseChoice = 'resume' | 'restart' | 'settings' | 'quit';

const ITEMS: { label: string; choice: PauseChoice }[] = [
  { label: 'RESUME', choice: 'resume' },
  { label: 'RESTART ROOM', choice: 'restart' },
  { label: 'SETTINGS', choice: 'settings' },
  { label: 'QUIT TO TITLE', choice: 'quit' },
];

const FONT = '"Press Start 2P", monospace';
const MENU_Y = 330, ROW = 40;

/** The in-game pause menu: a dark wash over the frozen room, a short list, a quiet controls reference. */
export class PauseMenu {
  private sel = 0;
  private t = 0;
  private readonly parts: Phaser.GameObjects.GameObject[] = [];
  private readonly items: Phaser.GameObjects.Text[];
  private readonly marker: Phaser.GameObjects.Text;
  private readonly room: Phaser.GameObjects.Text;
  private readonly help: Phaser.GameObjects.Text;
  private readonly footer: Phaser.GameObjects.Text;
  visible = false;

  constructor(w: GameScene) {
    const add = <O extends Phaser.GameObjects.GameObject>(o: O) => { this.parts.push(o); return w.addUi(o); };
    add(w.add.rectangle(640, 360, 1280, 720, 0x05071a, 0.82).setDepth(210));
    add(w.add.text(640, 210, 'PAUSED', { fontFamily: FONT, fontSize: '32px', color: '#ffffff' }).setOrigin(0.5).setDepth(211));
    this.room = add(w.add.text(640, 256, '', { fontFamily: FONT, fontSize: '11px', color: '#8a86b0' }).setOrigin(0.5).setDepth(211));
    this.items = ITEMS.map((it, i) => add(w.add.text(640, MENU_Y + i * ROW, it.label, { fontFamily: FONT, fontSize: '16px', color: '#6a6890' }).setOrigin(0.5).setDepth(211)));
    this.marker = add(w.add.text(0, 0, '>', { fontFamily: FONT, fontSize: '16px', color: '#4ff3ff' }).setOrigin(0.5).setDepth(211));
    this.help = add(w.add.text(640, 560, '', { fontFamily: FONT, fontSize: '9px', color: '#5a5880', align: 'center', lineSpacing: 10 }).setOrigin(0.5, 0).setDepth(211));
    this.footer = add(w.add.text(640, 680, '', { fontFamily: FONT, fontSize: '10px', color: '#4a4870' }).setOrigin(0.5).setDepth(211));
    this.hide();
  }

  show(roomName: string, help: string, footer: string): void {
    this.visible = true;
    this.room.setText(roomName);
    this.help.setText(help);
    this.footer.setText(footer);
    for (const p of this.parts) (p as unknown as Phaser.GameObjects.Components.Visible).setVisible(true);
    this.render();
  }

  hide(): void {
    this.visible = false;
    this.sel = 0;
    for (const p of this.parts) (p as unknown as Phaser.GameObjects.Components.Visible).setVisible(false);
  }

  move(d: number): void {
    this.sel = (this.sel + d + ITEMS.length) % ITEMS.length;
    this.render();
  }

  get choice(): PauseChoice {
    return ITEMS[this.sel].choice;
  }

  update(dt: number): void {
    if (!this.visible) return;
    this.t += dt;
    this.render();
  }

  private render(): void {
    this.items.forEach((it, i) => it.setColor(i === this.sel ? '#ffffff' : '#6a6890'));
    const cur = this.items[this.sel];
    this.marker.setPosition(cur.x - cur.width / 2 - 26 + Math.sin(this.t * 5) * 2, cur.y);
  }
}
