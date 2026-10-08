import type { Lang } from "./copy";

// Little authored fictions, resolved on return. No background AI or location inference.
export const KEEPSAKES = [
  { id: "fern", art: "    ,/\n  ,'/\n / /,\n  /'\n /", en: ["A paper fern", "I folded a little green thought. This one can live in your pocket."], ar: ["ورقة سرخس", "طويت لك فكرة خضرا صغيرة. هذي مكانها في جيبك."] },
  { id: "star", art: "    .\n  . | .\n-- <+> --\n  ' | '\n    '", en: ["A spare star", "For a day that could use a little more sky. I made it small enough to keep."], ar: ["نجمة زيادة", "ليوم يحتاج سما أكثر شوي. سويتها صغيرة عشان تحتفظ فيها."] },
  { id: "cup", art: "   ~ ~\n  .---.\n  |   |)\n  '---'\n -------", en: ["A cup of quiet", "I saved the comfortable bit of the afternoon. There is no hurry to finish it."], ar: ["كوب هدوء", "حفظت لك أهدأ لحظة من العصر. خذ وقتك معها."] },
  { id: "kite", art: "   /\\\n  <  >\n   \\/\n   /\n  ><\n   \\", en: ["A tiny kite", "A scrap of paper, a bit of string, and a very ambitious idea."], ar: ["طيّارة ورق صغيرة", "قصاصة ورق وخيط وفكرة طموحة مرّة."] },
  { id: "shell", art: "   .---.\n  /|||||\\\n (|||||||)\n  \\|||/\n   'V'", en: ["A pocket shell", "I drew you a shell. You can imagine whatever sea you like inside it."], ar: ["صدفة للجيب", "رسمت لك صدفة. تخيّل بداخلها البحر اللي يعجبك."] },
  { id: "lantern", art: "   .-.\n  _| |_\n  | : |\n  | * |\n  '---'", en: ["A little lantern", "A small light for the way back. It does not mind how long you take."], ar: ["فانوس صغير", "نور صغير للرجعة. ما يستعجلك مهما تأخرت."] },
  { id: "boat", art: "    |\\\n    | \\\n    |__\\\n  \\_____/\n ~ ~ ~ ~", en: ["A paper boat", "Made for imaginary puddles and very unimportant adventures."], ar: ["قارب ورقي", "سويته لبرك خيالية ومغامرات بسيطة على راحتنا."] },
  { id: "flower", art: "   _ _\n  ( o )\n   '|'\n  \\ | /\n   \\|/\n    |", en: ["A patient flower", "This one blooms on rest days too. I thought you might like that."], ar: ["زهرة صبورة", "هذي تزهر حتى في أيام الراحة. حسّيت إنها بتعجبك."] },
  { id: "book", art: "  ___ ___\n /   V   \\\n| .  |  . |\n|___ | ___|\n    \\|/", en: ["An unwritten page", "I left the best bit blank. You can put an ordinary day in it."], ar: ["صفحة فاضية", "خلّيت أحلى جزء فاضي. تقدر تحط فيه يوم عادي."] },
  { id: "moon", art: "   .--.\n  /  .-'\n |  (\n  \\  '-.\n   '---'", en: ["A stitched moon", "A little crescent, sewn out of leftover quiet."], ar: ["قمر من خيط", "هلال صغير، خطّيته من بقايا الهدوء."] },
  { id: "house", art: "    /\\\n   /__\\\n   |[]|\n   | _|\n   ||_|", en: ["A place to land", "I made a tiny house with absolutely nothing on the to-do list."], ar: ["مكان ترتاح فيه", "سويت بيت صغير وقائمة مهامه فاضية تمامًا."] },
  { id: "acorn", art: "    /\n  .===.\n (=====)\n  \\   /\n   \\_/", en: ["A someday seed", "No deadline. No instructions. Just a small possibility."], ar: ["بذرة لبعدين", "بدون موعد وبدون تعليمات. مجرد احتمال صغير."] }
] as const;

export type GiftId = typeof KEEPSAKES[number]["id"];
export interface Keepsake { kind: GiftId; day: string; at: number }
export interface Shelf { version: 1; seen: number; gifts: Keepsake[] }
export const AWAY_MS = 10 * 60_000;
export const SHELF_LIMIT = 12;

export function shelfKey(origin: string, phrase: string, demo: boolean): string {
  return `truffle.keepsakes@${new URL(origin).origin}/${demo ? "demo" : "real"}/${phrase}`;
}

export function readShelf(raw: unknown): Shelf {
  const s = raw as Partial<Shelf> | null;
  const gifts = s?.version === 1 && Array.isArray(s.gifts) ? s.gifts.filter(g =>
    g && KEEPSAKES.some(k => k.id === g.kind) && /^\d{4}-\d{2}-\d{2}$/.test(g.day) && Number.isFinite(g.at) && g.at > 0
  ).slice(-SHELF_LIMIT) : [];
  return { version: 1, seen: s?.version === 1 && Number.isFinite(s.seen) && s.seen! > 0 ? s.seen! : 0, gifts };
}

export function returnToShelf(raw: unknown, now: number, day: string, seed: string, alive: boolean): { shelf: Shelf; gift?: Keepsake } {
  const shelf = readShelf(raw);
  const away = shelf.seen > 0 && now - shelf.seen >= AWAY_MS;
  let gift: Keepsake | undefined;
  if (away && alive && /^\d{4}-\d{2}-\d{2}$/.test(day) && !shelf.gifts.some(g => g.day >= day)) {
    let hash = 2166136261;
    for (const c of seed + day) hash = Math.imul(hash ^ c.charCodeAt(0), 16777619) >>> 0;
    let index = hash % KEEPSAKES.length;
    if (KEEPSAKES[index].id === shelf.gifts.at(-1)?.kind) index = (index + 1) % KEEPSAKES.length;
    gift = { kind: KEEPSAKES[index].id, day, at: now };
    shelf.gifts = [...shelf.gifts, gift].slice(-SHELF_LIMIT);
  }
  // Clock rollback never turns an existing absence into a second reward.
  shelf.seen = Math.max(shelf.seen, now);
  return { shelf, gift };
}

export function giftText(gift: Keepsake, lang: Lang): { name: string; note: string; art: string } {
  const def = KEEPSAKES.find(k => k.id === gift.kind)!;
  return { name: def[lang][0], note: def[lang][1], art: def.art };
}
