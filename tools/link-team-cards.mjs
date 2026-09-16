// One-off: point the team grid cards in team.html at the new local member pages.
// Each card anchor is exactly `<a href="team.html" class="team_card-wrap w-inline-block">`
// and the cards appear in the same order as SLUGS, so we rewrite them by position.
// (The nav/footer `href="team.html"` links are left untouched.)
import { readFile, writeFile } from "node:fs/promises";

const file = new URL("../team.html", import.meta.url);
const SLUGS = [
  "jim-robinson",
  "stuart-ellman",
  "raju-rishi-copy",
  "will-porteous",
  "vic-singh",
  "matt-gurin",
  "dennis-cherian",
  "matt-vine",
  "james-robinson",
  "jay-hass",
  "mckenna-paulson",
  "jenna-williams",
  "johanna-concepcion",
];

const html = await readFile(file, "utf8");
const CARD = '<a href="team.html" class="team_card-wrap w-inline-block">';
const before = (html.match(new RegExp(CARD.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g")) || []).length;
if (before !== SLUGS.length) {
  console.error(`Expected ${SLUGS.length} cards, found ${before}. Aborting.`);
  process.exit(1);
}
let i = 0;
const out = html.replaceAll(
  CARD,
  () => `<a href="team/${SLUGS[i++]}.html" class="team_card-wrap w-inline-block">`
);
await writeFile(file, out, "utf8");
console.log(`Rewrote ${i} team card links -> team/<slug>.html`);
