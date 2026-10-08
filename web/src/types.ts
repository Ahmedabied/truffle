// Response shapes from the Worker (worker/src/types.ts StateSummary, worker/src/do.ts chat).
// Mirrored here because worker/src/types.ts pulls in Cloudflare runtime types.
// Engine types come straight from the engine so they cannot drift.

import type { Mood, TruffleState } from "../../worker/src/engine";
import type { Tier } from "../../worker/src/config";
import type { Lang } from "./copy";

export type { Mood, TruffleState, Tier, Lang };

export interface WeatherSummary {
  text: string;
  fetched_ms?: number;
  apparent_c: number | null;
  daytime_max_c: number | null;
  precipitation_mm: number;
  wind_kmh: number;
  is_day: boolean;
  weather_code: number;
}

export interface StateSummary {
  state: TruffleState;
  mood: Mood;
  tier: Tier;
  energy_max: number;
  energy_pct: number;
  tz: string;
  country: string;
  lang: Lang;
  city: string;
  demo: boolean;
  local_day: string;
  next_midnight_ms: number | null;
  weather: WeatherSummary | null;
  expires_ms?: number;
  /** Proud moments, the last 20, ascending id (decision 0017). Optional: an older Worker or the mock may omit it. */
  moments?: import("../../worker/src/moments").Moment[];
}

export interface Creds {
  phrase: string;
  secret: string;
}

export type PairResult = Creds & StateSummary;

export type ChatEvent =
  | { type: "brain"; brain: string; half_awake: boolean }
  | { type: "token"; text: string }
  | { type: "done"; tier: Tier; brain: string; half_awake: boolean; spent: number; partial: boolean; summary: StateSummary | null }
  | { type: "error"; error: string };

export interface Backend {
  readonly mock: boolean;
  pair(lang?: Lang): Promise<PairResult>;
  spawn(lang?: Lang): Promise<PairResult>;
  state(c: Creds): Promise<StateSummary>;
  chat(c: Creds, message: string, lang: Lang, requested?: Tier, signal?: AbortSignal): AsyncGenerator<ChatEvent>;
  spore(c: Creds): Promise<StateSummary>;
  slider(c: Creds, steps: number): Promise<StateSummary>;
  midnight(c: Creds): Promise<StateSummary>;
  heat(c: Creds, on: boolean): Promise<StateSummary>;
  reset(c: Creds): Promise<StateSummary>;
}
