import type { Lang } from "../copy";
import type { OutingKind } from "./intent";

export type CompanionNote =
  | { type: "plan"; kind: OutingKind }
  | { type: "return"; kind?: OutingKind }
  | { type: "heat" }
  | { type: "quiet" };

/** Authored local copy. A declared errand says nothing about its destination. */
export function companionText(note: CompanionNote, lang: Lang): string {
  const ar = lang === "ar";
  if (note.type === "quiet") return ar
    ? "أكيد. بخلي ملاحظاتي هنا هادية."
    : "Of course. I'll keep these in-app notes quiet.";
  if (note.type === "heat") return ar
    ? "الراحة جزء من الحكاية. ترافل يحتمي من الحر."
    : "Rest is part of the story. Truffle stays sheltered from the heat.";
  if (note.type === "plan") return note.kind === "walk"
    ? ar ? "مغامرة صغيرة في الجيب. أنا معك، خذ راحتك." : "A little pocket adventure. I'm with you. Take your time."
    : ar ? "حتى المشوار الصغير مغامرة عندي. أنا رفيقك الصغير." : "Even a little errand is an adventure in my book. I'll keep you company.";
  if (note.kind === "errand") return ar
    ? "هلا برجعتك. قلت لي عندك مشوار. أنا هنا إذا ودك تسولف عن يومك."
    : "Welcome back. You mentioned an errand. I'm here if you feel like telling me about your day.";
  if (note.kind === "walk") return ar
    ? "هلا برجعتك. حلو إنك هنا. خذ راحتك."
    : "Welcome back. It's good to have you here. Take your time.";
  return ar ? "هلا فيك من جديد. خليت لك شوية هدوء." : "Hello again. I saved a little quiet for you.";
}
