// Fit a 40-column <pre> to its container width. DOM probe, no canvas (S08 approach).

export const COLS = 40;
export const ROWS = 28;
export const LINE_HEIGHT = 1.12;

export interface Layout {
  fontSize: number;
  cellWidth: number;
  correction: number;
  mono: boolean;
}

export function makeFitter(container: HTMLElement, pre: HTMLElement, probe: HTMLElement, onFit?: (l: Layout) => void) {
  const measure = (text: string) => {
    probe.textContent = text;
    return probe.getBoundingClientRect().width;
  };

  function fit(): void {
    const available = container.getBoundingClientRect().width;
    if (!available) return;
    probe.style.fontSize = "100px";
    probe.style.letterSpacing = "0px";
    const base = measure("M".repeat(COLS));
    if (!base) return;
    const glyphs = [" ", "─", "█", "░", "^", "~"];
    const mono = glyphs.every((g) => Math.abs(measure(g.repeat(COLS)) - base) / COLS < 0.1);
    const fontSize = (available * 100) / base;
    probe.style.fontSize = fontSize + "px";
    // Tiny spacing correction absorbs fractional font-size rounding.
    const correction = (available - measure("M".repeat(COLS))) / COLS;
    pre.style.fontSize = fontSize + "px";
    pre.style.letterSpacing = correction + "px";
    pre.style.lineHeight = String(LINE_HEIGHT);
    onFit?.({ fontSize, cellWidth: available / COLS, correction, mono });
  }

  let prev = 0;
  if ("ResizeObserver" in window) {
    new ResizeObserver((entries) => {
      const w = entries[0].contentRect.width;
      if (Math.abs(w - prev) > 0.01) {
        prev = w;
        fit();
      }
    }).observe(container);
  } else {
    addEventListener("resize", fit);
  }
  document.fonts?.ready.then(fit);
  fit();
  return fit;
}
