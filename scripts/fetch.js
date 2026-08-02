// 楽天商品検索API(2026年新仕様)から「1000円ポッキリ・送料無料」を取得
import { writeFile, mkdir } from "node:fs/promises";
import { categories, site } from "../config.js";

const APP_ID = process.env.RAKUTEN_APP_ID;
const ACCESS_KEY = process.env.RAKUTEN_ACCESS_KEY;
const AFF_ID = process.env.RAKUTEN_AFFILIATE_ID;

if (!APP_ID || !ACCESS_KEY || !AFF_ID) {
  console.error("環境変数 RAKUTEN_APP_ID / RAKUTEN_ACCESS_KEY / RAKUTEN_AFFILIATE_ID を設定してください");
  process.exit(1);
}

// 新エンドポイント
const ENDPOINT =
  "https://openapi.rakuten.co.jp/ichibams/api/IchibaItem/Search/20220601";
// アプリ登録時のApplication URL(Referer制限対策)
const REFERER = "https://www.jaio-gadget.com/";

const PER_PAGE = 30;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchPage(genreId, page) {
  const params = new URLSearchParams({
    applicationId: APP_ID,
    accessKey: ACCESS_KEY,
    affiliateId: AFF_ID,
    format: "json",
    genreId: String(genreId),
    minPrice: "1000",
    maxPrice: "1000",
    postageFlag: "1",
    sort: "-reviewCount",
    hits: String(PER_PAGE),
    page: String(page),
    imageFlag: "1",
  });
  const res = await fetch(`${ENDPOINT}?${params}`, {
    headers: {
      Referer: REFERER,
      Origin: REFERER.replace(/\/$/, ""),
      accessKey: ACCESS_KEY,
      "User-Agent": "pokkiri-1000/1.0",
    },
  });
  if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`);
  return res.json();
}

function normalize(raw) {
  const it = raw.Item ?? raw;
  return {
    name: it.itemName,
    url: it.affiliateUrl || it.itemUrl,
    image: (it.mediumImageUrls?.[0]?.imageUrl || "").replace(
      "?_ex=128x128",
      "?_ex=300x300"
    ),
    shop: it.shopName,
    reviewCount: it.reviewCount ?? 0,
    reviewAverage: Number(it.reviewAverage ?? 0),
    pointRate: it.pointRate ?? 1,
    code: it.itemCode,
  };
}

const result = { fetchedAt: new Date().toISOString(), categories: {} };

for (const cat of categories) {
  const want = site.itemsPerCategory;
  const pages = Math.ceil(want / PER_PAGE);
  const items = [];
  for (let p = 1; p <= pages; p++) {
    try {
      const json = await fetchPage(cat.genreId, p);
      items.push(...(json.Items ?? []).map(normalize));
      if (p * PER_PAGE >= (json.count ?? 0)) break;
    } catch (e) {
      console.error(`[${cat.name}] page ${p} 失敗:`, e.message);
      break;
    }
    await sleep(1100);
  }
  const seen = new Set();
  result.categories[cat.slug] = items.filter((i) => {
    if (seen.has(i.code)) return false;
    seen.add(i.code);
    return true;
  });
  console.log(`[${cat.name}] ${result.categories[cat.slug].length}件`);
  await sleep(1100);
}

const total = Object.values(result.categories).reduce((n, a) => n + a.length, 0);
if (total === 0) {
  console.error("商品が1件も取得できませんでした。ビルドを中止します。");
  process.exit(1);
}

await mkdir("data", { recursive: true });
await writeFile("data/items.json", JSON.stringify(result, null, 2));
console.log(`合計 ${total}件 → data/items.json`);
