import Phaser from 'phaser';
import { Audio } from '../core/Audio';
import { ACTIONS, Controls, DEFAULT_KEYS, keyLabel, type Action } from '../core/Bindings';
import { backdropTextures } from '../render/CityDressing';

const FONT = '"Press Start 2P", monospace';
const CAPTURE_TIME = 6;

const C = {
  panel: 0x0a0d24, edge: 0x2a3a6a, row: 0x14204a, cyan: 0x4ff3ff, pink: 0xff3fa4,
  capFace: 0x2a3366, capSide: 0x1c2348, capLip: 0x05030f, capShine: 0x4a5aa0,
};

const TABLE = { x: 90, y: 168, w: 700, h: 470, keyX: 530, backupX: 690 };
const SIDE = { x: 820, y: 168, w: 370, h: 470 };
const ROW_H = 30;
const GROUP_H = 26;

type Cursor = { kind: 'action'; index: number } | { kind: 'reset' } | { kind: 'back' };

interface Row {
  action: Action;
  y: number;
  label: Phaser.GameObjects.Text;
  keys: [Phaser.GameObjects.Text, Phaser.GameObjects.Text];
}

/**
 * Keyboard remapping screen. Reached from the title menu, or from the pause
 * screen (K), in which case the game scene is paused underneath and resumed on exit.
 */
export class ControlsScene extends Phaser.Scene {
  private from: 'title' | 'game' = 'title';
  private rows: Row[] = [];
  private sel = 0;
  private slot = 0;
  private capturing = false;
  private captureT = 0;
  private resetArmed = 0;
  private msg = '';
  private msgColor = '#9ff6ff';
  private msgT = 0;
  private t = 0;
  private g!: Phaser.GameObjects.Graphics;
  private cursor!: Phaser.GameObjects.Image;
  private sideTitle!: Phaser.GameObjects.Text;
  private sideKeys!: Phaser.GameObjects.Text;
  private sideHint!: Phaser.GameObjects.Text;
  private sideMsg!: Phaser.GameObjects.Text;
  private resetText!: Phaser.GameObjects.Text;
  private backText!: Phaser.GameObjects.Text;
  private footer!: Phaser.GameObjects.Text;

  constructor() {
    super('controls');
  }

  create(data: { from?: 'title' | 'game' } = {}): void {
    this.from = data.from ?? 'title';
    this.sel = 0;
    this.slot = 0;
    this.capturing = false;
    this.resetArmed = 0;
    this.msg = '';
    this.t = 0;
    this.rows = [];
    this.groupLines = [];

    const bd = backdropTextures(this);
    this.add.image(0, 0, bd.sky).setOrigin(0);
    this.add.tileSprite(0, 200, 1280, 520, bd.far).setOrigin(0).setAlpha(0.4);
    this.add.rectangle(640, 360, 1280, 720, 0x05071a, 0.72);
    const scan = this.add.graphics();
    for (let y = 0; y < 720; y += 4) scan.fillStyle(0x000000, 0.14).fillRect(0, y, 1280, 1);

    const logo = { fontFamily: FONT, fontSize: '40px' };
    this.add.text(640, 62, 'CONTROLS', { ...logo, color: '#ff3fa4' }).setOrigin(0.5).setShadow(0, 0, '#ff3fa4', 22, false, true).setAlpha(0.9);
    this.add.text(640, 62, 'CONTROLS', { ...logo, color: '#f4f0ff' }).setOrigin(0.5).setShadow(0, 0, '#3ff0ff', 10, false, true);
    this.add.text(640, 106, '// REMAP YOUR KEYS. CHANGES SAVE INSTANTLY.', { fontFamily: FONT, fontSize: '11px', color: '#ff8acb' }).setOrigin(0.5);

    this.g = this.add.graphics();

    // tabs
    this.add.text(TABLE.x + 24, 140, 'KEYBOARD', { fontFamily: FONT, fontSize: '11px', color: '#05071a' }).setOrigin(0, 0.5).setDepth(2);
    this.add.text(TABLE.x + 186, 140, 'GAMEPAD', { fontFamily: FONT, fontSize: '11px', color: '#4a4870' }).setOrigin(0, 0.5).setDepth(2);
    this.add.text(TABLE.x + 284, 140, 'SOON', { fontFamily: FONT, fontSize: '8px', color: '#05071a', backgroundColor: '#6a6890', padding: { x: 4, y: 3 } }).setOrigin(0, 0.5).setDepth(2);

    // table
    const dim = { fontFamily: FONT, fontSize: '9px', color: '#6a6890' };
    this.add.text(TABLE.x + 52, TABLE.y + 20, 'ACTION', dim).setOrigin(0, 0.5).setDepth(2);
    this.add.text(TABLE.keyX, TABLE.y + 20, 'KEY', dim).setOrigin(0.5).setDepth(2);
    this.add.text(TABLE.backupX, TABLE.y + 20, 'BACKUP', dim).setOrigin(0.5).setDepth(2);
    let y = TABLE.y + 40;
    let group = '';
    for (const a of ACTIONS) {
      if (a.group !== group) {
        group = a.group;
        this.add.text(TABLE.x + 24, y + GROUP_H / 2 + 2, group, { fontFamily: FONT, fontSize: '8px', color: '#ff7ae6' }).setOrigin(0, 0.5).setDepth(2);
        this.groupLines.push(y + GROUP_H / 2 + 2);
        y += GROUP_H;
      }
      const cy = y + ROW_H / 2;
      const capStyle = { fontFamily: FONT, fontSize: '10px', color: '#e8ecff' };
      this.rows.push({
        action: a.id,
        y: cy,
        label: this.add.text(TABLE.x + 52, cy, a.label, { fontFamily: FONT, fontSize: '12px', color: '#c8c4ec' }).setOrigin(0, 0.5).setDepth(2),
        keys: [this.add.text(TABLE.keyX, cy, '', capStyle).setOrigin(0.5).setDepth(3), this.add.text(TABLE.backupX, cy, '', capStyle).setOrigin(0.5).setDepth(3)],
      });
      y += ROW_H;
    }
    this.cursor = this.add.image(TABLE.x + 28, 0, 'pkt', 0).setScale(1.5).setDepth(3);

    // side panel
    const sx = SIDE.x + 26;
    this.sideTitle = this.add.text(sx, SIDE.y + 32, '', { fontFamily: FONT, fontSize: '18px', color: '#ffffff' }).setOrigin(0, 0.5).setDepth(2);
    this.sideKeys = this.add.text(sx, SIDE.y + 70, '', { fontFamily: FONT, fontSize: '10px', color: '#4ff3ff' }).setOrigin(0, 0.5).setDepth(2);
    this.sideHint = this.add.text(sx, SIDE.y + 104, '', { fontFamily: FONT, fontSize: '10px', color: '#d8d0ff', lineSpacing: 12, wordWrap: { width: SIDE.w - 52 } }).setDepth(2);
    this.sideMsg = this.add.text(sx, SIDE.y + 262, '', { fontFamily: FONT, fontSize: '10px', color: '#9ff6ff', lineSpacing: 10, wordWrap: { width: SIDE.w - 52 } }).setDepth(2);
    this.resetText = this.add.text(SIDE.x + SIDE.w / 2, SIDE.y + 366, '', { fontFamily: FONT, fontSize: '11px', color: '#e8ecff' }).setOrigin(0.5).setDepth(3);
    this.backText = this.add.text(SIDE.x + SIDE.w / 2, SIDE.y + 422, '', { fontFamily: FONT, fontSize: '11px', color: '#e8ecff' }).setOrigin(0.5).setDepth(3);

    this.footer = this.add.text(640, 676, '', { fontFamily: FONT, fontSize: '10px', color: '#9ff6ff' }).setOrigin(0.5).setDepth(2);

    this.input.keyboard!.on('keydown', (e: KeyboardEvent) => this.onKey(e));
    if (import.meta.env.DEV) (window as unknown as { __controls: ControlsScene }).__controls = this;
  }

  private groupLines: number[] = [];

  private get cursorAt(): Cursor {
    if (this.sel < this.rows.length) return { kind: 'action', index: this.sel };
    return this.sel === this.rows.length ? { kind: 'reset' } : { kind: 'back' };
  }

  private say(msg: string, color = '#9ff6ff'): void {
    this.msg = msg;
    this.msgColor = color;
    this.msgT = 4;
  }

  // ------------------------------------------------------------ input

  private onKey(e: KeyboardEvent): void {
    if (e.repeat) return;
    const code = e.code;
    if (this.capturing) { this.capture(code); return; }

    const is = (a: Action, ...extra: string[]) => extra.includes(code) || Controls.has(a, code);
    const total = this.rows.length + 2;
    const cur = this.cursorAt;
    if (is('up', 'ArrowUp')) { this.sel = (this.sel - 1 + total) % total; this.resetArmed = 0; Audio.play('select'); }
    else if (is('down', 'ArrowDown')) { this.sel = (this.sel + 1) % total; this.resetArmed = 0; Audio.play('select'); }
    else if (cur.kind === 'action' && is('left', 'ArrowLeft')) { if (this.slot !== 0) { this.slot = 0; Audio.play('select'); } }
    else if (cur.kind === 'action' && is('right', 'ArrowRight')) { if (this.slot !== 1) { this.slot = 1; Audio.play('select'); } }
    else if (code === 'Backspace' || code === 'Delete') {
      if (cur.kind !== 'action') return;
      const a = this.rows[cur.index].action;
      if (Controls.clearKey(a, this.slot)) { Audio.play('unplug'); this.say('BACKUP KEY CLEARED.'); }
      else { Audio.play('nocarrier'); this.say('THE MAIN KEY CAN\'T BE EMPTY. REBIND IT INSTEAD.', '#ff6a8a'); }
    } else if (is('jump', 'Enter', 'NumpadEnter')) {
      if (cur.kind === 'action') this.startCapture();
      else if (cur.kind === 'reset') this.reset();
      else this.back();
    } else if (is('pause', 'Escape')) this.back();
  }

  private startCapture(): void {
    this.capturing = true;
    this.captureT = CAPTURE_TIME;
    this.msg = '';
    Audio.play('charge');
  }

  private capture(code: string): void {
    const a = this.rows[this.sel].action;
    this.capturing = false;
    if (code === 'Backspace') { Audio.play('unplug'); this.say('CANCELLED.'); return; }
    const before = Controls.keys[a][this.slot];
    const r = Controls.bindKey(a, this.slot, code);
    if (!r.ok) { Audio.play('nocarrier'); this.say(r.reason, '#ff6a8a'); return; }
    Audio.play('plug');
    this.flash = 0.35;
    const name = ACTIONS.find((x) => x.id === a)!.label;
    if (r.swapped) {
      const other = ACTIONS.find((x) => x.id === r.swapped!.action)!.label;
      this.say(`${keyLabel(code)} IS NOW ${name}.\n${other} TOOK ${keyLabel(before)} IN TRADE.`, '#40ffb0');
    } else this.say(`${keyLabel(code)} IS NOW ${name}.`, '#40ffb0');
  }

  private flash = 0;

  private reset(): void {
    if (this.resetArmed <= 0) {
      this.resetArmed = 2.5;
      Audio.play('charge');
      return;
    }
    this.resetArmed = 0;
    Controls.resetKeys();
    Audio.play('exit');
    this.say('ALL KEYS BACK TO FACTORY SETTINGS.', '#40ffb0');
  }

  private back(): void {
    Audio.play('select');
    if (this.from === 'game') {
      this.scene.stop();
      this.scene.resume('game');
    } else this.scene.start('title', { sel: 4 });
  }

  // ------------------------------------------------------------ drawing

  private keycap(cx: number, cy: number, text: Phaser.GameObjects.Text, label: string | null, state: 'idle' | 'selected' | 'capture', scale = 1): void {
    const g = this.g;
    const empty = label === null;
    const shown = state === 'capture' ? (Math.floor(this.t * 3) % 2 ? 'PRESS' : '...') : empty ? '--' : label;
    const w = Math.max(52, shown.length * 10 + 24) * scale;
    const h = 24 * scale;
    const x = Math.round(cx - w / 2), y = Math.round(cy - h / 2);
    const press = state === 'capture' ? 2 : 0;
    if (state !== 'idle') {
      const col = state === 'capture' ? C.pink : C.cyan;
      const pulse = 0.25 + 0.15 * Math.sin(this.t * 8);
      g.fillStyle(col, pulse).fillRect(x - 7, y - 7, w + 14, h + 18);
      g.lineStyle(2, col, 1).strokeRect(x - 4, y - 4, w + 8, h + 12);
    }
    if (empty && state === 'idle') {
      g.lineStyle(2, 0x2a3060, 1);
      for (let i = 0; i < w; i += 8) { g.lineBetween(x + i, y, x + Math.min(w, i + 4), y); g.lineBetween(x + i, y + h, x + Math.min(w, i + 4), y + h); }
      g.lineBetween(x, y, x, y + h).lineBetween(x + w, y, x + w, y + h);
      text.setText(shown).setColor('#4a4870').setPosition(cx, cy);
      return;
    }
    g.fillStyle(C.capLip, 1).fillRect(x, y + 6, w, h);
    g.fillStyle(C.capSide, 1).fillRect(x, y + 2 + press, w, h + 2);
    g.fillStyle(state === 'capture' ? 0x4a2050 : C.capFace, 1).fillRect(x + 3, y + press, w - 6, h - 2);
    g.fillStyle(C.capShine, 1).fillRect(x + 3, y + press, w - 6, 2);
    if (this.flash > 0 && state === 'selected') g.fillStyle(0xffffff, this.flash * 2).fillRect(x, y, w, h + 6);
    text.setText(shown).setColor(state === 'capture' ? '#ffd0f0' : '#e8ecff').setPosition(cx, cy + press - 1);
  }

  private button(cx: number, cy: number, text: Phaser.GameObjects.Text, label: string, on: boolean, danger = false): void {
    const g = this.g;
    const w = SIDE.w - 60, h = 34;
    const x = cx - w / 2, y = cy - h / 2;
    const col = danger ? 0xff6a8a : C.cyan;
    if (on) g.fillStyle(col, 0.2 + 0.1 * Math.sin(this.t * 8)).fillRect(x - 5, y - 5, w + 10, h + 10);
    g.fillStyle(C.capLip, 1).fillRect(x, y + 5, w, h);
    g.fillStyle(on ? (danger ? 0x5a2034 : 0x1a3a6a) : C.capSide, 1).fillRect(x, y, w, h);
    g.lineStyle(2, on ? col : C.edge, 1).strokeRect(x, y, w, h);
    text.setText(label).setColor(on ? '#ffffff' : '#8a88b0').setPosition(cx, cy);
  }

  update(_t: number, delta: number): void {
    const dt = delta / 1000;
    this.t += dt;
    this.msgT = Math.max(0, this.msgT - dt);
    this.flash = Math.max(0, this.flash - dt);
    this.resetArmed = Math.max(0, this.resetArmed - dt);
    if (this.capturing) {
      this.captureT -= dt;
      if (this.captureT <= 0) { this.capturing = false; Audio.play('nocarrier'); this.say('NO KEY PRESSED. NOTHING CHANGED.'); }
    }
    const g = this.g;
    g.clear();

    // tabs
    g.fillStyle(C.cyan, 1).fillRect(TABLE.x + 10, 128, 140, 24);
    g.lineStyle(2, 0x2a3060, 1).strokeRect(TABLE.x + 172, 128, 160, 24);

    // panels
    for (const p of [TABLE, SIDE]) {
      g.fillStyle(C.panel, 0.88).fillRect(p.x, p.y, p.w, p.h);
      g.lineStyle(3, C.edge, 1).strokeRect(p.x, p.y, p.w, p.h);
      g.fillStyle(C.cyan, 1).fillRect(p.x - 2, p.y - 2, 12, 3).fillRect(p.x - 2, p.y - 2, 3, 12);
      g.fillStyle(C.pink, 1).fillRect(p.x + p.w - 10, p.y + p.h - 1, 12, 3).fillRect(p.x + p.w - 1, p.y + p.h - 10, 3, 12);
    }
    g.lineStyle(1, 0x2a3060, 1).lineBetween(TABLE.x + 20, TABLE.y + 34, TABLE.x + TABLE.w - 20, TABLE.y + 34);
    for (const ly of this.groupLines) g.lineStyle(1, 0x3a2050, 1).lineBetween(TABLE.x + 150, ly, TABLE.x + TABLE.w - 20, ly);

    // rows
    const cur = this.cursorAt;
    this.rows.forEach((r, i) => {
      const on = cur.kind === 'action' && cur.index === i;
      if (on) {
        g.fillStyle(C.row, 1).fillRect(TABLE.x + 8, r.y - ROW_H / 2 + 1, TABLE.w - 16, ROW_H - 2);
        g.fillStyle(C.cyan, 1).fillRect(TABLE.x + 8, r.y - ROW_H / 2 + 1, 4, ROW_H - 2);
      }
      r.label.setColor(on ? '#ffffff' : '#9a96c4');
      const dim = this.capturing && !on;
      r.label.setAlpha(dim ? 0.35 : 1);
      const ks = Controls.keys[r.action];
      for (let s = 0; s < 2; s++) {
        const state = on && this.slot === s ? (this.capturing ? 'capture' : 'selected') : 'idle';
        this.keycap(s === 0 ? TABLE.keyX : TABLE.backupX, r.y - 2, r.keys[s], ks[s] === null ? null : keyLabel(ks[s]), state);
        r.keys[s].setAlpha(dim ? 0.35 : 1);
      }
      const changed = ks[0] !== DEFAULT_KEYS[r.action][0] || ks[1] !== DEFAULT_KEYS[r.action][1];
      if (changed) g.fillStyle(0xffb02a, 1).fillRect(TABLE.x + TABLE.w - 30, r.y - 3, 6, 6);
    });
    if (cur.kind === 'action') {
      const r = this.rows[cur.index];
      this.cursor.setVisible(true).setPosition(TABLE.x + 30, r.y + Math.sin(this.t * 6) * 2).setFrame([0, 1, 2, 3][Math.floor(this.t * 4) % 4]);
    } else this.cursor.setVisible(false);
    if (this.capturing && cur.kind === 'action') {
      const r = this.rows[cur.index];
      const k = this.captureT / CAPTURE_TIME;
      const cx = this.slot === 0 ? TABLE.keyX : TABLE.backupX;
      g.fillStyle(C.pink, 1).fillRect(cx - 40, r.y + 15, 80 * k, 2);
    }

    // side panel
    if (cur.kind === 'action') {
      const info = ACTIONS[cur.index];
      const ks = Controls.keys[info.id];
      this.sideTitle.setText(info.label);
      this.sideKeys.setText(ks[1] ? `${keyLabel(ks[0])}  OR  ${keyLabel(ks[1])}` : keyLabel(ks[0]));
      this.sideHint.setText(info.hint);
    } else if (cur.kind === 'reset') {
      this.sideTitle.setText('RESET');
      this.sideKeys.setText('');
      this.sideHint.setText('PUT EVERY KEY BACK TO THE DEFAULT LAYOUT.\nKEYS YOU CHANGED HAVE AN ORANGE DOT.');
    } else {
      this.sideTitle.setText('BACK');
      this.sideKeys.setText('');
      this.sideHint.setText(this.from === 'game' ? 'RETURN TO THE PAUSE MENU.' : 'RETURN TO THE TITLE SCREEN.');
    }
    g.fillStyle(C.pink, 1).fillRect(SIDE.x + 26, SIDE.y + 50, 40, 3);
    this.sideMsg.setText(this.msgT > 0 ? this.msg : '').setColor(this.msgColor).setAlpha(Math.min(1, this.msgT * 2));
    this.button(SIDE.x + SIDE.w / 2, SIDE.y + 366, this.resetText, this.resetArmed > 0 ? 'PRESS AGAIN TO CONFIRM' : 'RESET TO DEFAULTS', cur.kind === 'reset', this.resetArmed > 0);
    this.button(SIDE.x + SIDE.w / 2, SIDE.y + 422, this.backText, 'BACK', cur.kind === 'back');

    // footer
    const k = (a: Action) => keyLabel(Controls.keys[a][0]);
    this.footer.setText(
      this.capturing
        ? `PRESS ANY KEY FOR ${ACTIONS[this.sel].label}     BKSP  CANCEL`
        : `UP/DOWN  SELECT     LEFT/RIGHT  KEY OR BACKUP     ENTER/${k('jump')}  REBIND     BKSP  CLEAR BACKUP     ESC  BACK`,
    ).setColor(this.capturing ? '#ff8acb' : '#9ff6ff');
  }
}
