// Fill the available width without stretching glyphs. Grow the scene vertically
// when its natural text aspect needs more room, instead of adding blank side gutters.

export const COLS = 100;
export const ROWS = 68;
export const LINE_HEIGHT = 1.0;

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
    const bounds = container.getBoundingClientRect();
    const available = bounds.width;
    if (!available) return;
    probe.style.fontSize = "100px";
    probe.style.letterSpacing = "0px";
    const base = measure("M".repeat(COLS));
    if (!base) return;
    const glyphs = [" ", "─", "█", "░", "^", "~"];
    const mono = glyphs.every((g) => Math.abs(measure(g.repeat(COLS)) - base) / COLS < 0.1);
    const widthFont = (available * 100) / base;
    const fontSize = widthFont;
    const minimumHeight = `${fontSize * ROWS * LINE_HEIGHT}px`;
    if (container.style.minHeight !== minimumHeight) container.style.minHeight = minimumHeight;
    const renderedWidth = base * fontSize / 100;
    probe.style.fontSize = fontSize + "px";
    // Tiny spacing correction absorbs fractional font-size rounding.
    const correction = (renderedWidth - measure("M".repeat(COLS))) / COLS;
    pre.style.fontSize = fontSize + "px";
    pre.style.letterSpacing = correction + "px";
    pre.style.lineHeight = String(LINE_HEIGHT);
    pre.style.setProperty("--world-cell-width", String(renderedWidth / COLS));
    onFit?.({ fontSize, cellWidth: renderedWidth / COLS, correction, mono });
  }

  let prev = "";
  if ("ResizeObserver" in window) {
    new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      const size = `${width.toFixed(2)}|${height.toFixed(2)}`;
      if (size !== prev) {
        prev = size;
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
