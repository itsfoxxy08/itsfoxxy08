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

async function fetchAvatar(avatarUrl) {
  const url = new URL(avatarUrl);
  if (url.protocol !== "https:" || url.hostname !== "avatars.githubusercontent.com") {
    throw new Error("GitHub returned an unexpected avatar URL");
  }
  url.searchParams.set("s", "512");

  const response = await fetch(url, {
    headers: {
      "User-Agent": requestHeaders["User-Agent"],
      Accept: "image/png, image/jpeg, image/webp",
    },
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) {
    throw new Error(`GitHub avatar request failed with ${response.status}`);
  }

  const contentType = response.headers.get("content-type")?.split(";")[0].trim().toLowerCase();
  if (!["image/png", "image/jpeg", "image/webp"].includes(contentType)) {
    throw new Error(`GitHub returned an unsupported avatar format: ${contentType ?? "unknown"}`);
  }

  const avatar = Buffer.from(await response.arrayBuffer());
  if (avatar.length === 0 || avatar.length > 2_000_000) {
    throw new Error(`GitHub avatar size is invalid: ${avatar.length} bytes`);
  }

  return `data:${contentType};base64,${avatar.toString("base64")}`;
}

async function fetchStats() {
  const user = await fetchJson(`https://api.github.com/users/${username}`);
  if (
    !Number.isInteger(user.public_repos)
    || !Number.isInteger(user.followers)
    || typeof user.avatar_url !== "string"
  ) {
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
    avatar: await fetchAvatar(user.avatar_url),
  };
}

function createHero({ repos, stars, contributions, followers, avatar }) {
  const stats = [
    ["REPOSITORIES", repos],
    ["STARS", stars],
    ["CONTRIBUTIONS", contributions],
    ["FOLLOWERS", followers],
  ];
  const columns = [72, 282, 492, 702];
  const statsMarkup = stats
    .map(
      ([label, value], index) => `
        <text x="${columns[index]}" y="456" class="label">${label}</text>
        <text x="${columns[index]}" y="504" class="value">${value.toLocaleString("en-US")}</text>
        <circle cx="${columns[index] + 168}" cy="459" r="3" class="signal-dot"/>`,
    )
    .join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1040" height="576" viewBox="0 0 1040 576" role="img" aria-labelledby="title description">
  <title id="title">Vikas Choudhary · GitHub profile</title>
  <desc id="description">Profile overview with public repository, star, last-year contribution, and follower counts.</desc>
  <defs>
    <linearGradient id="glow" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#0d172a"/>
      <stop offset="1" stop-color="#080d18"/>
    </linearGradient>
    <pattern id="grid" width="32" height="32" patternUnits="userSpaceOnUse">
      <path d="M32 0H0V32" fill="none" stroke="#8294b5" stroke-opacity=".055"/>
    </pattern>
    <pattern id="letter-dots" width="6" height="6" patternUnits="userSpaceOnUse">
      <circle cx="1.5" cy="1.5" r="1.45" fill="#e0e8f5"/>
      <circle cx="4.5" cy="4.5" r=".75" fill="#8c9bb3" opacity=".8"/>
    </pattern>
    <clipPath id="portrait-clip">
      <circle cx="790" cy="246" r="168"/>
    </clipPath>
    <filter id="soft-glow" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="18"/>
    </filter>
    <filter id="avatar-background" color-interpolation-filters="sRGB">
      <feColorMatrix values="1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 -1 -1 -1 3 0"/>
    </filter>
    <style>
      .mono { font-family: ui-monospace, SFMono-Regular, Consolas, monospace; }
      .muted { fill: #91a2bd; }
      .label { fill: #a3b2cb; font: 10px ui-monospace, SFMono-Regular, Consolas, monospace; letter-spacing: 2px; }
      .value { fill: #f1f5ff; font: 700 27px ui-monospace, SFMono-Regular, Consolas, monospace; }
      .signal-dot { fill: #3396f5; }
      .orbit { transform-box: fill-box; transform-origin: center; animation: orbit 36s linear infinite; }
      .orbit-inner { transform-box: fill-box; transform-origin: center; animation: orbit 48s linear infinite reverse; }
      .pulse { animation: pulse 3.8s ease-in-out infinite; }
      @keyframes orbit { to { transform: rotate(360deg); } }
      @keyframes pulse { 50% { opacity: .45; } }
      @media (prefers-reduced-motion: reduce) {
        .orbit, .orbit-inner, .pulse { animation: none; }
      }
    </style>
  </defs>
  <rect x="1" y="1" width="1038" height="574" rx="22" fill="#080d18" stroke="#26334a"/>
  <rect x="1" y="1" width="1038" height="574" rx="22" fill="url(#grid)"/>
  <text x="32" y="34" class="mono muted" font-size="10" letter-spacing="3">LIVING IDENTITY</text>
  <text x="1008" y="34" text-anchor="end" class="mono muted" font-size="11">@itsfoxxy08</text>
  <text x="34" y="128" class="mono" fill="#4da3ff" font-size="10" letter-spacing="4">HELLO, WORLD. I'M</text>
  <text x="32" y="198" font-family="ui-monospace, SFMono-Regular, Consolas, monospace" fill="url(#letter-dots)" font-size="64" font-weight="800" letter-spacing="-2">Vikas</text>
  <text x="32" y="278" font-family="ui-monospace, SFMono-Regular, Consolas, monospace" fill="url(#letter-dots)" font-size="58" font-weight="800" letter-spacing="-3">Choudhary</text>
  <text x="34" y="348" class="mono" fill="#dce5f5" font-size="16">TypeScript / JavaScript / HTML</text>
  <text x="34" y="377" class="mono muted" font-size="11">Delhi, India</text>
  <circle cx="790" cy="246" r="171" fill="#3076c8" opacity=".08" filter="url(#soft-glow)"/>
  <circle cx="790" cy="246" r="169" fill="url(#glow)" stroke="#263b60"/>
  <circle class="orbit" cx="790" cy="246" r="188" fill="none" stroke="#4578c8" stroke-opacity=".65" stroke-dasharray="155 18 42 20"/>
  <circle class="orbit-inner" cx="790" cy="246" r="151" fill="none" stroke="#7a69c9" stroke-opacity=".3" stroke-dasharray="2 10"/>
  <circle cx="790" cy="246" r="130" fill="none" stroke="#294268" stroke-opacity=".35" stroke-dasharray="1 8"/>
  <g clip-path="url(#portrait-clip)">
    <image href="${avatar}" x="650" y="106" width="280" height="280" preserveAspectRatio="xMidYMid meet" image-rendering="pixelated" filter="url(#avatar-background)"/>
    <circle cx="790" cy="246" r="126" fill="url(#grid)" opacity=".32"/>
  </g>
  <circle class="pulse" cx="790" cy="246" r="3" fill="#ffb454"/>
  <path d="M32 419h976" stroke="#344158"/>
  ${statsMarkup}
  <path d="M32 532h976" stroke="#26334a"/>
  <text x="1008" y="554" text-anchor="end" class="mono muted" font-size="9" letter-spacing="1.5">PROFILE STATS · AUTO-UPDATED</text>
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
