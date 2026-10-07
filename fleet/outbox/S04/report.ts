import { readFileSync } from "node:fs";
import { parseForecast, shouldBurrow } from "./weather.ts";

const cities = [
  ["muscat", "Muscat"],
  ["riyadh", "Riyadh"],
  ["phoenix", "Phoenix"],
  ["berlin", "Berlin"],
  ["kuala_lumpur", "Kuala Lumpur"],
];
const metadata: { city: string; current_time: string }[] = JSON.parse(
  readFileSync(new URL("./fixtures/fetch-metadata.json", import.meta.url), "utf8"),
);

console.log("| City | Local today | Daytime max apparent C | Current apparent C | Burrow today | Local tomorrow | Tomorrow max apparent C | Burrow tomorrow |");
console.log("|---|---|---:|---:|---|---|---:|---|");
for (const [file, city] of cities) {
  const day = metadata.find((item) => item.city === file)!.current_time.slice(0, 10);
  // UTC is only a calendar arithmetic helper here, not a forecast conversion.
  const nextDay = new Date(`${day}T00:00:00Z`);
  nextDay.setUTCDate(nextDay.getUTCDate() + 1);
  const tomorrowDay = nextDay.toISOString().slice(0, 10);
  const input: unknown = JSON.parse(
    readFileSync(new URL(`./fixtures/${file}.json`, import.meta.url), "utf8"),
  );
  const today = parseForecast(input, { dayIso: day });
  const tomorrow = parseForecast(input, { dayIso: tomorrowDay });
  const format = (value: number | null) => value === null ? "missing" : value.toFixed(1);
  console.log(`| ${city} | ${day} | ${format(today.daytimeMaxApparentC)} | ${format(today.currentApparentC)} | ${shouldBurrow(today.daytimeMaxApparentC) ? "yes" : "no"} | ${tomorrowDay} | ${format(tomorrow.daytimeMaxApparentC)} | ${shouldBurrow(tomorrow.daytimeMaxApparentC) ? "yes" : "no"} |`);
}
