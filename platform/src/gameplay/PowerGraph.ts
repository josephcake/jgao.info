export type NodeKind = 'source' | 'consumer' | 'capacitor' | 'toggle' | 'signal';

interface PowerNode {
  kind: NodeKind;
  on: boolean;
  plugged: boolean;
  charge: number;
  hold: number;
  holdTime: number;
}

export interface CapacitorTuning {
  capacitorChargeTime: number;
  capacitorHold: number;
}

/**
 * Logical power network. Ports and controllers write node state; devices read it.
 *
 * - consumer: on while a live cable is plugged in.
 * - capacitor: charges while plugged; outputs only after unplugging, for
 *   `capacitorHold * charge` seconds. Charging alone does not output.
 * - toggle: flipped by data hacks.
 * - signal: set by scripted controllers (arena locks, boss).
 */
export class PowerGraph {
  private nodes = new Map<string, PowerNode>();

  constructor(private readonly tuning: CapacitorTuning) {}

  /** `holdTime` overrides the capacitor discharge duration for this node. */
  add(id: string, kind: NodeKind, initial = false, holdTime?: number): void {
    this.nodes.set(id, { kind, on: kind === 'source' || initial, plugged: false, charge: 0, hold: 0, holdTime: holdTime ?? this.tuning.capacitorHold });
  }

  has(id: string): boolean {
    return this.nodes.has(id);
  }

  kind(id: string): NodeKind | undefined {
    return this.nodes.get(id)?.kind;
  }

  /** Plug or unplug a live cable into a consumer or capacitor. */
  setPlugged(id: string, plugged: boolean): void {
    const n = this.nodes.get(id);
    if (!n) return;
    if (n.kind === 'capacitor' && n.plugged && !plugged) {
      n.hold = n.holdTime * n.charge;
      n.charge = 0;
    }
    n.plugged = plugged;
    if (n.kind === 'consumer') n.on = plugged;
  }

  isPlugged(id: string): boolean {
    return this.nodes.get(id)?.plugged ?? false;
  }

  toggle(id: string): boolean {
    const n = this.nodes.get(id);
    if (!n) return false;
    n.on = !n.on;
    return n.on;
  }

  set(id: string, on: boolean): void {
    const n = this.nodes.get(id);
    if (n) n.on = on;
  }

  isOn(id: string): boolean {
    return this.nodes.get(id)?.on ?? false;
  }

  /** 0..1 charge while plugged, or remaining hold fraction while discharging. */
  level(id: string): number {
    const n = this.nodes.get(id);
    if (!n) return 0;
    if (n.kind !== 'capacitor') return n.on ? 1 : 0;
    return n.plugged ? n.charge : n.hold / n.holdTime;
  }

  update(dt: number): void {
    for (const n of this.nodes.values()) {
      if (n.kind !== 'capacitor') continue;
      if (n.plugged) {
        n.charge = Math.min(1, n.charge + dt / this.tuning.capacitorChargeTime);
        n.on = false;
      } else {
        n.hold = Math.max(0, n.hold - dt);
        n.on = n.hold > 0;
      }
    }
  }

  /** Evaluate a device's input list. */
  evaluate(inputs: readonly string[], mode: 'any' | 'all' = 'any', invert = false): boolean {
    let v: boolean;
    if (inputs.length === 0) v = false;
    else if (mode === 'all') v = inputs.every((i) => this.isOn(i));
    else v = inputs.some((i) => this.isOn(i));
    return invert ? !v : v;
  }
}
