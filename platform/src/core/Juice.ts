import { Perception } from '../render/PerceptionPipeline';

/** Hitstop, screen shake and perception glitches. */
export class Juice {
  stop = 0;
  private shakeAmp = 0;
  private shakeTime = 0;
  private shakeDur = 1;
  offsetX = 0;
  offsetY = 0;
  private tearAmt = 0;

  hitstop(s: number): void {
    this.stop = Math.max(this.stop, s);
  }

  shake(amp: number, dur: number): void {
    if (amp >= this.shakeAmp * (this.shakeTime / this.shakeDur)) {
      this.shakeAmp = amp;
      this.shakeTime = dur;
      this.shakeDur = dur;
    }
  }

  desync(v: number): void {
    Perception.desync = Math.max(Perception.desync, v);
  }

  tear(v: number): void {
    this.tearAmt = Math.max(this.tearAmt, v);
  }

  /** Real-time update (not affected by hitstop). */
  update(dt: number, _speed: number): void {
    this.stop = Math.max(0, this.stop - dt);
    this.shakeTime = Math.max(0, this.shakeTime - dt);
    const k = this.shakeTime / this.shakeDur;
    const a = this.shakeAmp * k * k;
    this.offsetX = (Math.random() - 0.5) * 2 * a;
    this.offsetY = (Math.random() - 0.5) * 2 * a;
    Perception.desync = Math.max(0, Perception.desync - dt * 1.6);
    this.tearAmt = Math.max(0, this.tearAmt - dt * 2.5);
    Perception.tear = this.tearAmt;
  }
}
