import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { TitleScene } from './scenes/TitleScene';
import { GameScene } from './scenes/GameScene';
import { EndScene } from './scenes/EndScene';
import { ControlsScene } from './scenes/ControlsScene';
import { Audio } from './core/Audio';

new Phaser.Game({
  type: Phaser.WEBGL,
  parent: 'game',
  width: 1280,
  height: 720,
  backgroundColor: '#05030f',
  antialias: false,
  pixelArt: true,
  roundPixels: true,
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  scene: [BootScene, TitleScene, GameScene, EndScene, ControlsScene],
  fps: { target: 120, smoothStep: false },
});

window.addEventListener('keydown', () => Audio.unlock(), { once: false });

if (import.meta.env.DEV) {
  void import('./dev/Autopilot');
  type Step = [number, Record<string, unknown>];
  const w = window as unknown as Record<string, unknown>;
  /** Dev-only scripted play-test: a list of [ms, debugInput] steps. Returns a position log. */
  w.__play = async (seq: Step[]) => {
    const log: unknown[] = [];
    for (const [ms, d] of seq) {
      w.__dbg = { press: [], ...d };
      await new Promise((r) => setTimeout(r, ms));
      const g = w.__game as { player: { x: number; y: number }; cable: { state: string }; room: { id: string } };
      log.push([Math.round(g.player.x), Math.round(g.player.y), g.cable.state, g.room.id]);
    }
    w.__dbg = null;
    return JSON.stringify(log);
  };
}
