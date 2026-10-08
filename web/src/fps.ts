// Phone prep: ?fps=1 shows frames per second and the average compose and
// paint time per frame over the last second, in the HUD line. Default off.
// "paint" is canvas submission time measured in World.draw. Browser
// rasterisation, compositing and display latency are not included.

export function fpsEnabled(params: URLSearchParams): boolean {
  return params.get("fps") === "1";
}

export interface FpsReading {
  fps: number;
  compose: number;
  paint: number;
}

export class FpsMeter {
  private start: number;
  private n = 0;
  private compose = 0;
  private paint = 0;

  constructor(private now: () => number = () => performance.now()) {
    this.start = now();
  }

  add(composeMs: number, paintMs: number): void {
    this.n++;
    this.compose += composeMs;
    this.paint += paintMs;
  }

  /** The reading for the window so far, once at least a second has passed. Starts a new window. */
  flush(): FpsReading | null {
    const t = this.now();
    const span = t - this.start;
    if (span < 1000) return null;
    const r: FpsReading = {
      fps: Math.round((this.n * 1000) / span),
      compose: this.n ? this.compose / this.n : 0,
      paint: this.n ? this.paint / this.n : 0
    };
    this.start = t;
    this.n = 0;
    this.compose = 0;
    this.paint = 0;
    return r;
  }
}

export function fpsText(r: FpsReading): string {
  return `${r.fps} fps · compose ${r.compose.toFixed(1)} ms · paint ${r.paint.toFixed(1)} ms`;
}
