import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const username = "itsfoxxy08";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const heroPath = path.join(root, "assets", "profile-hero.svg");
const readmePath = path.join(root, "README.md");
const requestHeaders = {
  "User-Agent": "itsfoxxy08-profile-readme",
  Accept: "application/vnd.github+json",
};

async function fetchText(url) {
  const response = await fetch(url, {
    headers: requestHeaders,
    signal: AbortSignal.timeout(20_000),
  });

  if (!response.ok) {
    throw new Error(`GitHub returned ${response.status} for ${url}`);
  }

  return response.text();
}

async function fetchJson(url) {
  const body = await fetchText(url);
  return JSON.parse(body);
}

async function fetchStats() {
  const user = await fetchJson(`https://api.github.com/users/${username}`);
  if (!Number.isInteger(user.public_repos) || !Number.isInteger(user.followers)) {
    throw new Error("GitHub user response did not include valid repository and follower counts");
  }

  let stars = 0;
  for (let page = 1; ; page += 1) {
    const repos = await fetchJson(
      `https://api.github.com/users/${username}/repos?per_page=100&page=${page}&type=owner`,
    );
    if (!Array.isArray(repos)) {
      throw new Error("GitHub repository response was not a list");
    }

    for (const repo of repos) {
      if (!Number.isInteger(repo.stargazers_count) || typeof repo.fork !== "boolean") {
        throw new Error(`GitHub repository response was invalid for ${repo.full_name ?? "a repository"}`);
      }
      if (!repo.fork) {
        stars += repo.stargazers_count;
      }
    }

    if (repos.length < 100) {
      break;
    }
  }

  const contributionsPage = await fetchText(
    `https://github.com/users/${username}/contributions`,
  );
  const heading = contributionsPage.match(
    /<h2\b[^>]*\bid=["']js-contribution-activity-description["'][^>]*>([\s\S]*?)<\/h2>/i,
  )?.[1];
  const headingText = heading?.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  const contributionCount = headingText?.match(
    /([\d,]+)\s+contributions?\s+in\s+the\s+last\s+year/i,
  )?.[1];

  if (!contributionCount) {
    throw new Error("Could not read the last-year contribution total from GitHub");
  }

  return {
    repos: user.public_repos,
    stars,
    contributions: Number(contributionCount.replaceAll(",", "")),
    followers: user.followers,
  };
}

function createHero({ repos, stars, contributions, followers }) {
  const stats = [
    ["PUBLIC REPOS", repos],
    ["STARS", stars],
    ["CONTRIBUTIONS · 1Y", contributions],
    ["FOLLOWERS", followers],
  ];
  const columns = [72, 300, 528, 756];
  const statsMarkup = stats
    .map(
      ([label, value], index) => `
        <text x="${columns[index]}" y="364" class="label">${label}</text>
        <text x="${columns[index]}" y="408" class="value">${value.toLocaleString("en-US")}</text>`,
    )
    .join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="460" viewBox="0 0 1000 460" role="img" aria-labelledby="title description">
  <title id="title">Vikas Choudhary · GitHub profile</title>
  <desc id="description">Profile overview with public repository, star, last-year contribution, and follower counts.</desc>
  <defs>
    <linearGradient id="glow" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#142543"/>
      <stop offset="1" stop-color="#101522"/>
    </linearGradient>
    <pattern id="grid" width="32" height="32" patternUnits="userSpaceOnUse">
      <path d="M32 0H0V32" fill="none" stroke="#8294b5" stroke-opacity=".07"/>
    </pattern>
    <style>
      .mono { font-family: ui-monospace, SFMono-Regular, Consolas, monospace; }
      .sans { font-family: Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif; }
      .muted { fill: #91a2bd; }
      .label { fill: #91a2bd; font: 11px ui-monospace, SFMono-Regular, Consolas, monospace; letter-spacing: 2px; }
      .value { fill: #f1f5ff; font: 700 32px ui-monospace, SFMono-Regular, Consolas, monospace; }
    </style>
  </defs>
  <rect x="1" y="1" width="998" height="458" rx="22" fill="#080d18" stroke="#26334a"/>
  <rect x="1" y="1" width="998" height="458" rx="22" fill="url(#grid)"/>
  <text x="44" y="40" class="mono muted" font-size="11" letter-spacing="3">PROFILE / LIVE SIGNAL</text>
  <text x="956" y="40" text-anchor="end" class="mono muted" font-size="12">@itsfoxxy08</text>
  <text x="46" y="112" class="mono" fill="#4da3ff" font-size="11" letter-spacing="4">HELLO, WORLD. I'M</text>
  <text x="44" y="190" class="sans" fill="#f1f5ff" font-size="60" font-weight="750">Vikas</text>
  <text x="44" y="254" class="sans" fill="#f1f5ff" font-size="60" font-weight="750">Choudhary</text>
  <text x="48" y="303" class="mono" fill="#dce5f5" font-size="17">TypeScript / JavaScript / HTML</text>
  <text x="48" y="331" class="mono muted" font-size="12">Delhi, India</text>
  <circle cx="790" cy="190" r="138" fill="url(#glow)" stroke="#263b60"/>
  <circle cx="790" cy="190" r="151" fill="none" stroke="#4578c8" stroke-opacity=".6" stroke-dasharray="164 22 52 24"/>
  <circle cx="790" cy="190" r="119" fill="none" stroke="#7a69c9" stroke-opacity=".35" stroke-dasharray="2 9"/>
  <path d="M730 235V145h25v-24h27v24h22v-39h28v39h27v-25h27v115h-27v-15H757v15z" fill="#ff6b35" opacity=".9"/>
  <path d="M756 160h25v25h-25zm76-25h25v25h-25zm-25 50h25v25h-25zm-50 25h25v25h-25z" fill="#ffb454"/>
  <path d="M44 344h912" stroke="#344158"/>
  ${statsMarkup}
  <path d="M44 426h912" stroke="#26334a"/>
  <text x="956" y="445" text-anchor="end" class="mono muted" font-size="10">AUTO-UPDATED PROFILE STATS</text>
</svg>
`;
}

const stats = await fetchStats();
const svg = createHero(stats);
await mkdir(path.dirname(heroPath), { recursive: true });
const currentSvg = await readFile(heroPath, "utf8").catch((error) => {
  if (error.code === "ENOENT") return "";
  throw error;
});

if (svg !== currentSvg) {
  await writeFile(heroPath, svg, "utf8");
  const hash = createHash("sha256").update(svg).digest("hex").slice(0, 12);
  const readme = await readFile(readmePath, "utf8");
  const imageTag = /<img src="assets\/profile-hero\.svg(?:\?v=[a-f0-9]+)?" width="100%" alt="Vikas Choudhary profile and automatically updated GitHub statistics" \/>/;
  if (!imageTag.test(readme)) {
    throw new Error("Could not find the profile hero image in README.md");
  }

  const updatedReadme = readme.replace(
    imageTag,
    `<img src="assets/profile-hero.svg?v=${hash}" width="100%" alt="Vikas Choudhary profile and automatically updated GitHub statistics" />`,
  );
  await writeFile(readmePath, updatedReadme, "utf8");
}

console.log(
  `Updated profile stats: ${stats.repos} repositories, ${stats.stars} stars, ${stats.contributions} contributions in the last year, ${stats.followers} followers.`,
);
