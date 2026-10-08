// Keepsakes are authored ASCII objects in the world atlas. Pocket supplies the
// corresponding accessible controls and story; the scene only owns geometry.
import { Layer } from './raster';

export interface WorldKeepsake { id: string; art: string }
export interface GiftArea { id: string; x: number; y: number; width: number; height: number }
const PLACES = [[24, 60], [73, 59], [86, 53]] as const;

export function drawKeepsakes(layer: Layer, items: readonly WorldKeepsake[]): GiftArea[] {
  layer.clear();
  return items.slice(-3).map((item, i) => {
    const rows = item.art.split('\n').slice(0, 7).map(row => row.slice(0, 12).replace(/[^\x20-\x7e]/g, ' '));
    const width = Math.max(1, ...rows.map(row => row.length));
    const [cx, bottom] = PLACES[i];
    const x = Math.floor(cx - width / 2), y = bottom - rows.length;
    rows.forEach((row, dy) => [...row].forEach((char, dx) => {
      if (char !== ' ') layer.symbol(x + dx, y + dy, char);
    }));
    // A quiet plinth distinguishes a placed keepsake from a random ground mark.
    for (let dx = 1; dx < width - 1; dx++) layer.symbol(x + dx, bottom, '_');
    return { id: item.id, x, y, width, height: rows.length + 1 };
  });
}

/** Hit areas have a 44 CSS-pixel minimum but stay tied to the rendered canvas. */
export function hitKeepsake(areas: readonly GiftArea[], rect: {left:number;top:number;width:number;height:number}, clientX: number, clientY: number): string | null {
  if (!rect.width || !rect.height) return null;
  for (const a of areas) {
    const cx = rect.left + (a.x + a.width / 2) * rect.width / 100;
    const cy = rect.top + (a.y + a.height / 2) * rect.height / 68;
    const w = Math.max(44, a.width * rect.width / 100);
    const h = Math.max(44, a.height * rect.height / 68);
    if (Math.abs(clientX - cx) <= w / 2 && Math.abs(clientY - cy) <= h / 2) return a.id;
  }
  return null;
}
