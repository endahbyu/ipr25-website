// Localize the real site's individual team-member pages into team/<slug>.html
//
// The real Webflow site (rre-staging.webflow.io) renders each team member at
// /team/<slug>. Our local replica has the team grid (team.html) but the cards
// used to link back to themselves, so clicking a person did nothing.
//
// This script downloads each member page from the real site and rewrites it to
// use only local assets (css/js/images/fonts/video/player) with relative links,
// mirroring how the rest of the rre-ipr25 replica was built.
//
// Usage: node tools/localize-team.mjs
import { mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";

const BASE = "https://rre-staging.webflow.io";
// Pages live in <root>/team/ (one level up from this script in tools/).
const TEAM_URL = () => new URL("../team/", import.meta.url);

// All slugs exactly as they appear on the live /team page.
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

// CDN asset -> local relative path (pages live in team/, so paths are ../*)
const ASSET_MAP = [
  // Page template CSS (the team-member template), downloaded to css/page-member.min.css
  [
    /https:\/\/cdn\.prod\.website-files\.com\/68dd8df8be996d3bc9c73d27\/css\/rre-staging\.webflow\.68ded31a6f8ef0e299e285d0\.[a-z0-9]+\.opt\.min\.css/g,
    "../css/rre-staging.webflow.page-member.min.css",
  ],
  // Shared CSS (use the local shared file)
  [
    /https:\/\/cdn\.prod\.website-files\.com\/68dd8df8be996d3bc9c73d27\/css\/rre-staging\.webflow\.shared\.[a-z0-9]+\.min\.css/g,
    "../css/rre-staging.webflow.shared.min.css",
  ],
  // Favicons
  [
    /https:\/\/cdn\.prod\.website-files\.com\/68dd8df8be996d3bc9c73d27\/68e13f879aef414dc623bd2f_Frame%20283\.png/g,
    "../images/68e13f879aef414dc623bd2f_Frame-283.png",
  ],
  [
    /https:\/\/cdn\.prod\.website-files\.com\/68dd8df8be996d3bc9c73d27\/68e13f32e3f6a51fc2e057d2_Frame%20282\.png/g,
    "../images/68e13f32e3f6a51fc2e057d2_Frame-282.png",
  ],
  // Finsweet attributes (local patched copy)
  [
    /https:\/\/cdn\.jsdelivr\.net\/npm\/@finsweet\/attributes@2\/attributes\.js/g,
    "../js/attributes.js",
  ],
  // jQuery
  [
    /https:\/\/d3e54v103j8qbb\.cloudfront\.net\/js\/jquery-3\.5\.1\.min\.[a-z0-9]+\.js\?site=[a-z0-9]+/g,
    "../js/jquery-3.5.1.min.js",
  ],
  // Webflow runtime
  [
    /https:\/\/cdn\.prod\.website-files\.com\/68dd8df8be996d3bc9c73d27\/js\/webflow\.[a-z0-9]+\.[a-z0-9]+\.js/g,
    "../js/webflow.js",
  ],
  // GSAP + plugins
  [
    /https:\/\/cdn\.prod\.website-files\.com\/gsap\/3\.15\.0\/gsap\.min\.js/g,
    "../js/gsap.min.js",
  ],
  [
    /https:\/\/cdn\.prod\.website-files\.com\/gsap\/3\.15\.0\/ScrollTrigger\.min\.js/g,
    "../js/ScrollTrigger.min.js",
  ],
  [
    /https:\/\/cdn\.prod\.website-files\.com\/gsap\/3\.15\.0\/SplitText\.min\.js/g,
    "../js/SplitText.min.js",
  ],
  // Nav logo
  [
    /https:\/\/cdn\.prod\.website-files\.com\/68dd8df8be996d3bc9c73d27\/68ded34ab25461868d25b067_nav-bar\.svg/g,
    "../images/nav-bar.svg",
  ],
];

// The real member pages use a distinct Webflow background-video atom playing the
// "weavy-Seedance" animation (poster + mp4 + webm). We mirror those files locally
// under video/team/ and keep the same markup (paths adjusted for the team/ subfolder).
const BG_VIDEO_LOCAL =
  '<div class="page_bg-wrapper"><div data-poster-url="../video/team/weavy-Seedance-V10-poster-00001.jpg" data-video-urls="../video/team/weavy-Seedance-V10-transcode.mp4,../video/team/weavy-Seedance-V10-transcode.webm" data-autoplay="true" data-loop="true" data-wf-ignore="true" class="page_bg-video w-background-video w-background-video-atom"><video id="2fcfe7cb-46bb-350f-0289-5eb3d0843387-video" autoplay="" loop="" style="background-image:url(&quot;../video/team/weavy-Seedance-V10-poster-00001.jpg&quot;)" muted="" playsinline="" data-wf-ignore="true" data-object-fit="cover"><source src="../video/team/weavy-Seedance-V10-transcode.mp4" data-wf-ignore="true"/><source src="../video/team/weavy-Seedance-V10-transcode.webm" data-wf-ignore="true"/></video></div></div>';

async function fetchPage(slug) {
  const url = `${BASE}/team/${slug}`;
  const res = await fetch(url, {
    headers: { "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
  });
  if (!res.ok) throw new Error(`GET ${url} -> ${res.status}`);
  return await res.text();
}

function stripSri(html) {
  return html
    .replace(/\s+integrity="[^"]*"/g, "")
    .replace(/\s+crossorigin="anonymous"/g, "")
    .replace(/\s+crossorigin=""/g, "");
}

function localizeLinks(html) {
  return html
    .replace(/href="\/team\/([a-z0-9-]+)"/g, 'href="$1.html"')
    .replace(/href="\/portfolio"/g, 'href="../portfolio.html"')
    .replace(/href="\/rrepov"/g, 'href="../rrepov.html"')
    .replace(/href="\/team"/g, 'href="../team.html"')
    .replace(/href="\/"/g, 'href="../index.html"');
}

function replaceBackgroundVideo(html) {
  const start = html.indexOf('<div class="page_bg-wrapper">');
  const end = html.indexOf('<div class="nav_sticky">');
  if (start === -1 || end === -1 || end < start) {
    console.warn("  ! page_bg-wrapper/nav_sticky not found, leaving as-is");
    return html;
  }
  return html.slice(0, start) + BG_VIDEO_LOCAL + html.slice(end);
}

function localizeMedia(html, slug) {
  // Any remaining cdn.prod.website-files.com/<media-bucket>/<file> or <site-bucket>/<file>
  // references inside the body (member photos) -> ../images/<file>. The file must
  // already exist locally (all member photos were mirrored); if not, we flag it.
  const seen = new Set();
  html = html.replace(
    /https:\/\/cdn\.prod\.website-files\.com\/(?:68ded319c10201f09110493e|68dd8df8be996d3bc9c73d27)\/([A-Za-z0-9_%.-]+)/g,
    (m, rawFile) => {
      // Webflow serves spaces as %20 and narrow no-break spaces as %E2%80%AF,
      // but the mirrored local files use plain hyphens.
      const file = decodeURIComponent(rawFile).replace(/\s+/g, "-");
      // Only rewrite image/asset files (not .js handled already, not video)
      if (/\.(avif|webp|png|jpe?g|svg|gif|ico)$/i.test(file)) {
        seen.add(file);
        return `../images/${file}`;
      }
      return m;
    }
  );
  for (const f of seen) {
    const local = new URL(`../images/${f}`, import.meta.url);
    if (!existsSync(local)) {
      console.warn(`  ! member asset not mirrored locally: images/${f}`);
    }
  }
  return html;
}

function localize(html, slug) {
  let out = html;
  for (const [re, to] of ASSET_MAP) out = out.replace(re, to);
  out = stripSri(out);
  out = localizeLinks(out);
  out = replaceBackgroundVideo(out);
  out = localizeMedia(out, slug);
  // Lazy images are unreliable in this environment — force eager everywhere.
  out = out.replace(/loading="lazy"/g, 'loading="eager"');
  return out;
}

async function main() {
  await mkdir(TEAM_URL(), { recursive: true });
  for (const slug of SLUGS) {
    const html = await fetchPage(slug);
    const out = localize(html, slug);
    const file = new URL(`../team/${slug}.html`, import.meta.url);
    await writeFile(file, out, "utf8");
    const kb = (Buffer.byteLength(out) / 1024).toFixed(1);
    console.log(`  ${slug}.html  ${kb} KB`);
  }
  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
