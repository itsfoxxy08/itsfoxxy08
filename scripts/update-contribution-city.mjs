import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const username = "itsfoxxy08";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cityPath = path.join(root, "assets", "contribution-city.svg");
const readmePath = path.join(root, "README.md");

async function fetchContributions() {
  const response = await fetch(
    `https://github.com/users/${username}/contributions`,
    {
      headers: { "User-Agent": "itsfoxxy08-profile-readme" },
      signal: AbortSignal.timeout(20_000),
    },
  );
  if (!response.ok) {
    throw new Error(`GitHub contribution calendar returned ${response.status}`);
  }

  const html = await response.text();
  const days = [];
  const cellPattern = /<td\b([^>]*)><\/td>\s*<tool-tip\b[^>]*>([\s\S]*?)<\/tool-tip>/gi;

  for (const match of html.matchAll(cellPattern)) {
    const attributes = match[1];
    const date = attributes.match(/\bdata-date="(\d{4}-\d{2}-\d{2})"/)?.[1];
    const level = attributes.match(/\bdata-level="([0-4])"/)?.[1];
    if (!date || level === undefined) continue;

    const tooltip = match[2].replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
    const count = tooltip.match(/^([\d,]+)\s+contributions?\s+on\b/i)?.[1];
    const noContributions = /^No contributions on\b/i.test(tooltip);
    if (!count && !noContributions) {
      throw new Error(`Could not read the contribution count for ${date}`);
    }

    days.push({
      date,
      count: count ? Number(count.replaceAll(",", "")) : 0,
      level: Number(level),
    });
  }

  if (days.length < 360 || days.length > 380) {
    throw new Error(`Expected about a year of daily contributions, received ${days.length} days`);
  }

  days.sort((a, b) => a.date.localeCompare(b.date));
  for (let index = 1; index < days.length; index += 1) {
    const previous = Date.parse(`${days[index - 1].date}T00:00:00Z`);
    const current = Date.parse(`${days[index].date}T00:00:00Z`);
    if (current - previous !== 86_400_000) {
      throw new Error(`Contribution calendar has a gap or duplicate near ${days[index].date}`);
    }
  }

  return days;
}

function polygon(points, fill, stroke = "none") {
  return `<polygon points="${points.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ")}" fill="${fill}" stroke="${stroke}" stroke-width=".55"/>`;
}

function createCity(days) {
  const originX = 100;
  const originY = 14;
  const tileX = 8;
  const tileY = 4;
  const halfX = 7.3;
  const halfY = 3.7;
  const heightForLevel = [0, 9, 20, 34, 51];
  const tileColors = ["#030705", "#06110a", "#08180d", "#0a2111", "#0d2c16"];
  const topColors = ["#050907", "#0b2915", "#0e3c1c", "#155527", "#1e7233"];
  const leftColors = ["#020403", "#06190c", "#092511", "#0d3619", "#10451e"];
  const rightColors = ["#030504", "#08200e", "#0b2f15", "#12451f", "#185c29"];
  const cells = days.map((day) => {
    const date = new Date(`${day.date}T00:00:00Z`);
    const dayIndex = date.getUTCDay();
    const firstDate = new Date(`${days[0].date}T00:00:00Z`);
    const weekIndex = Math.floor((date.getTime() - firstDate.getTime()) / 604_800_000);
    return { ...day, dayIndex, weekIndex, order: weekIndex + dayIndex };
  }).sort((a, b) => a.order - b.order || a.weekIndex - b.weekIndex);

  const shapes = [];
  for (const cell of cells) {
    const centerX = originX + (cell.weekIndex - cell.dayIndex) * tileX;
    const baseY = originY + (cell.weekIndex + cell.dayIndex) * tileY;
    const level = cell.level;
    const height = cell.count === 0 ? 0 : heightForLevel[level];
    const north = [centerX, baseY - halfY];
    const east = [centerX + halfX, baseY];
    const south = [centerX, baseY + halfY];
    const west = [centerX - halfX, baseY];
    const topNorth = [north[0], north[1] - height];
    const topEast = [east[0], east[1] - height];
    const topSouth = [south[0], south[1] - height];
    const topWest = [west[0], west[1] - height];
    const cellTitle = `${cell.date}: ${cell.count} contribution${cell.count === 1 ? "" : "s"}`;

    shapes.push(`<g><title>${cellTitle}</title>`);
    if (height > 0) {
      shapes.push(polygon([east, south, topSouth, topEast], rightColors[level]));
      shapes.push(polygon([south, west, topWest, topSouth], leftColors[level]));
      shapes.push(polygon([topNorth, topEast, topSouth, topWest], topColors[level]));
    } else {
      shapes.push(polygon([north, east, south, west], tileColors[level], "#0b1a10"));
    }
    shapes.push("</g>");
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="560" height="286" viewBox="0 0 560 286" role="img" aria-labelledby="title description">
  <title id="title">GitHub contribution city</title>
  <desc id="description">A transparent isometric city where each green building represents a day of GitHub contributions over the last year.</desc>
  <g stroke-linejoin="round">
    ${shapes.join("\n    ")}
  </g>
</svg>
`;
}

const days = await fetchContributions();
const svg = createCity(days);
await mkdir(path.dirname(cityPath), { recursive: true });
const previousSvg = await readFile(cityPath, "utf8").catch((error) => {
  if (error.code === "ENOENT") return "";
  throw error;
});

if (svg !== previousSvg) {
  await writeFile(cityPath, svg, "utf8");
  const hash = createHash("sha256").update(svg).digest("hex").slice(0, 12);
  const readme = await readFile(readmePath, "utf8");
  const imageTag = /<img src="assets\/contribution-city\.svg(?:\?v=[a-f0-9]+)?" width="100%" alt="Isometric green GitHub contribution city" \/>/;
  if (!imageTag.test(readme)) {
    throw new Error("Could not find the contribution city image in README.md");
  }

  await writeFile(
    readmePath,
    readme.replace(
      imageTag,
      `<img src="assets/contribution-city.svg?v=${hash}" width="100%" alt="Isometric green GitHub contribution city" />`,
    ),
    "utf8",
  );
}

console.log(`Updated contribution city using ${days.length} daily contributions.`);
