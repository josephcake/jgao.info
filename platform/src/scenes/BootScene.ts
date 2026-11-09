import Phaser from 'phaser';
import { PerceptionPipeline } from '../render/PerceptionPipeline';
import { makeHeroTexture } from '../render/PixelHero';
import { makeStaticTextures } from '../render/Textures';

/** Registers the perception pipeline and bakes procedural textures. */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('boot');
  }

  preload(): void {
    this.add.text(640, 360, 'NEGOTIATING WITH ANALOG REALITY...', { fontFamily: 'monospace', fontSize: '16px', color: '#9ff6ff' }).setOrigin(0.5);
  }

  async create(): Promise<void> {
    const r = this.renderer as Phaser.Renderer.WebGL.WebGLRenderer;
    if (r.pipelines && !r.pipelines.getPostPipeline('Perception')) r.pipelines.addPostPipeline('Perception', PerceptionPipeline);

    try {
      await Promise.race([document.fonts.load('16px "Press Start 2P"'), new Promise((res) => setTimeout(res, 2500))]);
    } catch {
      /* fall back to monospace */
    }

    makeHeroTexture(this);
    makeStaticTextures(this);

    const q = new URLSearchParams(window.location.search);
    this.scene.start(q.get('room') || q.get('level') ? 'game' : 'title');
  }
}
