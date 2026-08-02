// data/items.json から dist/ に静的HTMLを生成
import { readFile, writeFile, mkdir, cp } from "node:fs/promises";
import { site, categories, marathonEnd } from "../config.js";

const data = JSON.parse(await readFile("data/items.json", "utf8"));
const updated = new Date(data.fetchedAt).toLocaleString("ja-JP", {
  timeZone: "Asia/Tokyo",
  month: "numeric",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

const esc = (s = "") =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const stars = (avg) => {
  const n = Math.round(avg);
  return "★".repeat(n) + "☆".repeat(5 - n);
};

const card = (it) => `
<article class="card">
  <a href="${esc(it.url)}" rel="sponsored noopener" target="_blank">
    <div class="thumb"><img src="${esc(it.image)}" alt="" loading="lazy" width="300" height="300"></div>
    <h3 class="name">${esc(it.name)}</h3>
    <p class="shop">${esc(it.shop)}</p>
    <p class="review"><span class="stars">${stars(it.reviewAverage)}</span> <span class="rc">${it.reviewCount.toLocaleString()}件</span>${
      it.pointRate > 1 ? ` <span class="pt">P${it.pointRate}倍</span>` : ""
    }</p>
    <span class="cta">楽天で見る</span>
  </a>
</article>`;

const marathonBanner = () => {
  if (!marathonEnd) return "";
  const end = new Date(marathonEnd);
  if (end < new Date()) return "";
  const d = end.toLocaleString("ja-JP", { timeZone: "Asia/Tokyo", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
  return `<div class="marathon">お買い物マラソン開催中！ ${d} まで — 1,000円ポッキリで買い回り店舗数を稼ごう</div>`;
};

const nav = (active) => `
<nav class="catnav" aria-label="カテゴリ">
  <a href="./index.html" class="${active === "index" ? "on" : ""}">すべて</a>
  ${categories
    .map((c) => `<a href="./${c.slug}.html" class="${active === c.slug ? "on" : ""}">${c.name}</a>`)
    .join("")}
</nav>`;

const page = ({ title, desc, active, body, path }) => `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="google-site-verification" content="B9t2SedN67G2VsEoHbd2cUHTi0MuzBYc0bKpJAIYaVk">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${site.url}/${path}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Zen+Maru+Gothic:wght@700;900&display=swap" rel="stylesheet">
<link rel="stylesheet" href="./style.css">
</head>
<body>
${marathonBanner()}
<header class="hero">
  <p class="brand">${esc(site.title)}</p>
  <div class="coin" aria-hidden="true"><span class="yen">¥</span>1,000</div>
  <h1>ぜんぶ<em>1,000円ポッキリ</em>、送料無料。</h1>
  <p class="sub">楽天市場から毎日自動更新 — 最終更新 ${updated}</p>
</header>
${nav(active)}
<main>
${body}
</main>
<footer>
  <p>当サイトはアフィリエイト広告(楽天アフィリエイト)を利用しています。</p>
  <p>価格・送料・ポイント倍率は取得時点の情報です。購入前に必ず商品ページでご確認ください。</p>
  <p>© ${new Date().getFullYear()} ${esc(site.title)}</p>
</footer>
</body>
</html>`;

await mkdir("dist", { recursive: true });
await cp("src/style.css", "dist/style.css");

// ---- トップページ:各カテゴリの上位N件 ----
const topBody = categories
  .map((c) => {
    const items = (data.categories[c.slug] ?? []).slice(0, site.topPageItemsPerCategory);
    if (!items.length) return "";
    return `
<section>
  <div class="sechead">
    <h2>${c.name}</h2>
    <a class="more" href="./${c.slug}.html">すべて見る →</a>
  </div>
  <div class="grid">${items.map(card).join("")}</div>
</section>`;
  })
  .join("");

await writeFile(
  "dist/index.html",
  page({
    title: `${site.title} | 楽天の1000円ポッキリ送料無料まとめ`,
    desc: site.description,
    active: "index",
    body: topBody,
    path: "index.html",
  })
);

// ---- カテゴリページ ----
for (const c of categories) {
  const items = data.categories[c.slug] ?? [];
  const body = `
<section>
  <div class="sechead"><h2>${c.name} <span class="count">${items.length}件</span></h2></div>
  <div class="grid">${items.map(card).join("")}</div>
</section>`;
  await writeFile(
    `dist/${c.slug}.html`,
    page({
      title: `${c.name}の1000円ポッキリ | ${site.title}`,
      desc: `楽天市場の${c.name}カテゴリから1000円ポッキリ・送料無料の売れ筋${items.length}件。毎日自動更新。`,
      active: c.slug,
      body,
      path: `${c.slug}.html`,
    })
  );
}

// ---- sitemap ----
const urls = ["index.html", ...categories.map((c) => `${c.slug}.html`)]
  .map((p) => `<url><loc>${site.url}/${p}</loc></url>`)
  .join("\n");
await writeFile(
  "dist/sitemap.xml",
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>`
);
await writeFile("dist/robots.txt", `User-agent: *\nAllow: /\nSitemap: ${site.url}/sitemap.xml\n`);

console.log(`dist/ にページ生成完了(${categories.length + 1}ページ + sitemap)`);
