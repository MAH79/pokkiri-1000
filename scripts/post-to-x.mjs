/**
 * 1000円ポッキリ市場 → X 自動投稿スクリプト
 *
 * 実行:   node scripts/post-to-x.mjs
 * 依存:   npm install twitter-api-v2
 * 環境変数: X_API_KEY / X_API_SECRET / X_ACCESS_TOKEN / X_ACCESS_SECRET
 *
 * 動作: 実行時のJST日時を見て「今日投稿すべきネタがあるか」を判定し、
 *       あれば1件だけポストする。なければ何もせず正常終了する。
 */

import { TwitterApi } from 'twitter-api-v2';
import fs from 'fs';
import path from 'path';

/* ============================================================
   1. 設定（ここだけ書き換えれば動きます）
   ============================================================ */

const CONFIG = {
  // サイトのURL（アフィリンクではなくサイトを貼る）
  siteUrl: 'https://mah79.github.io/pokkiri-1000/',

  // セール日程を書いたファイル
  saleFile: 'data/sales.json',

  // 商品データ（無ければ商品なしで投稿します）
  productFile: 'data/items.json',

  // 投稿履歴（同じネタの二重投稿を防ぐため）
  logFile: 'data/x-post-log.json',

  // true にすると実際には投稿せず、内容をログ出力するだけ
   dryRun: process.env.DRY_RUN === '1',
};

/* ============================================================
   2. 日時ユーティリティ（JST基準）
   ============================================================ */

const nowJst = () => new Date(Date.now() + 9 * 60 * 60 * 1000);
const ymd = (d) => d.toISOString().slice(0, 10);
const hour = (d) => d.getUTCHours(); // nowJst()に+9済みなのでこれがJSTの時
const parseJst = (s) => new Date(`${s}:00+09:00`);

/* ============================================================
   3. データ読み込み
   ============================================================ */

const readJson = (file, fallback) => {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf-8'));
  } catch {
    return fallback;
  }
};

/**
 * 商品を1件ランダムに選ぶ。
 * ★ products.json の構造に合わせて、ここだけ直してください。
 *   例: [{ "name": "...", "price": 1000 }, ...] を想定しています。
 */
function pickProduct() {
  const data = readJson(CONFIG.productFile, null);
  const groups = data?.categories;
  if (!groups) return null;

  // 全カテゴリを1つにまとめる
  const all = Object.values(groups).flat();
  if (all.length === 0) return null;

  // レビュー数の多い上位30件からランダムに選ぶ
  const pool = all
    .filter((i) => i.name)
    .sort((a, b) => (b.reviewCount || 0) - (a.reviewCount || 0))
    .slice(0, 30);
  if (pool.length === 0) return null;

  const raw = pool[Math.floor(Math.random() * pool.length)].name;

  // 【送料無料】などの装飾を削って読みやすくする
  const clean = raw
    .replace(/[【［〔《][^】］〕》]*[】］〕》]/g, '')
    .replace(/送料無料|ポイント\d+倍|メール便|あす楽|1000円ポッキリ|ポッキリ/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!clean) return null;
  return clean.length > 24 ? clean.slice(0, 24) + '…' : clean;
}

/* ============================================================
   4. 今日のネタを決める
   ============================================================ */

function decideTopic(now) {
  const today = ymd(now);
  const h = hour(now);
  const sales = readJson(CONFIG.saleFile, { sales: [] }).sales || [];

  for (const sale of sales) {
    const start = parseJst(sale.start);
    const end = parseJst(sale.end);

    // 開始当日の朝 → 予告
    if (ymd(start) === today && h < 12) {
      return { key: `${sale.name}-yokoku-${today}`, type: 'yokoku', sale };
    }
    // 開始直後（20時台の実行）→ 開始告知
    if (ymd(start) === today && h >= 19) {
      return { key: `${sale.name}-start-${today}`, type: 'start', sale };
    }
    // 最終日 → ラストコール
    if (ymd(end) === today) {
      return { key: `${sale.name}-last-${today}`, type: 'last', sale };
    }
    // 期間中 → 買い回りリマインド
    if (now >= start && now <= end) {
      const left = Math.ceil((end - now) / (24 * 60 * 60 * 1000));
      return { key: `${sale.name}-mid-${today}`, type: 'during', sale, left };
    }
  }

  // 5と0のつく日（朝のみ）
  const day = now.getUTCDate();
  if (day % 5 === 0 && h < 12) {
    return { key: `gotsuki-${today}`, type: 'gotsuki' };
  }

  return null;
}

/* ============================================================
   5. 投稿文を組み立てる
   ============================================================ */

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

function buildText(topic, product) {
  const name = topic.sale?.name || 'セール';
  const p = product ? `\n例：${product}` : '';

  const templates = {
    yokoku: [
      `【本日20時から】楽天${name}スタート。\n買い回り10店舗で最大ポイント10倍。1000円ポッキリの商品を先にカゴに入れておくと、20時に流し込むだけで済みます。${p}`,
      `今夜20時、楽天${name}が始まります。\n事前にカゴを作っておくのがいちばん楽。1000円前後の買い回り用商品をまとめています。${p}`,
    ],
    start: [
      `【開始】楽天${name}、始まりました。\n買い回りは早めに店舗数を稼いだほうが結局ラクです。1000円ポッキリの商品一覧はこちら。${p}`,
      `楽天${name}スタート。\n「あと1店舗足りない」を潰すための1000円商品まとめ、更新済みです。${p}`,
    ],
    during: [
      `楽天${name}、残り${topic.left ?? 1}日。\n買い回りの店舗数が中途半端なら、1000円ポッキリで埋めるのがいちばん安上がりです。${p}`,
      `${name}開催中。\nあと1〜2店舗で次の倍率に届く人向けに、1000円前後の商品を集めています。${p}`,
    ],
    last: [
      `【本日最終日】楽天${name}は今夜23:59まで。\n買い回りが途中で止まっている人は、1000円商品で店舗数だけ先に確定させておくのが安全です。${p}`,
      `${name}ラストです。\n駆け込みの1店舗に使える1000円ポッキリ商品まとめ。${p}`,
    ],
    gotsuki: [
      `今日は5と0のつく日。\n楽天カード決済でポイント+4倍です。買い回り用の1000円商品を買うなら今日にまとめると効率がいいです。${p}`,
      `5と0のつく日。エントリー忘れずに。\n1000円ポッキリの商品はこちらにまとめています。${p}`,
    ],
  };

  const body = pick(templates[topic.type]);
  return `${body}\n${CONFIG.siteUrl}`;
}

// Xの文字数はCJK=2でカウント（上限280 = 日本語140字相当）。URLは23固定。
function weightedLength(text) {
  const withoutUrl = text.replace(/https?:\/\/\S+/g, '');
  const urls = (text.match(/https?:\/\/\S+/g) || []).length;
  let len = 0;
  for (const ch of withoutUrl) len += /[\x00-\x7F]/.test(ch) ? 1 : 2;
  return len + urls * 23;
}

/* ============================================================
   6. メイン
   ============================================================ */

async function main() {
  const now = nowJst();
  const topic = decideTopic(now);

  if (!topic) {
    console.log('本日は投稿対象なし。終了します。');
    return;
  }

  const log = readJson(CONFIG.logFile, { posted: [] });
  if (log.posted.includes(topic.key)) {
    console.log(`投稿済みのためスキップ: ${topic.key}`);
    return;
  }

  const text = buildText(topic, pickProduct());

  if (weightedLength(text) > 280) {
    console.error('文字数オーバーのため中止:', weightedLength(text));
    return;
  }

  console.log('--- 投稿内容 ---\n' + text + '\n----------------');

  if (CONFIG.dryRun) {
    console.log('DRY_RUN のため投稿しませんでした。');
    return;
  }

  const client = new TwitterApi({
    appKey: process.env.X_API_KEY,
    appSecret: process.env.X_API_SECRET,
    accessToken: process.env.X_ACCESS_TOKEN,
    accessSecret: process.env.X_ACCESS_SECRET,
  });

  await client.v2.tweet(text);
  console.log('投稿しました:', topic.key);

  log.posted.push(topic.key);
  log.posted = log.posted.slice(-200); // 古い履歴は捨てる
  fs.mkdirSync(path.dirname(CONFIG.logFile), { recursive: true });
  fs.writeFileSync(CONFIG.logFile, JSON.stringify(log, null, 2));
}

main().catch((e) => {
  console.error('投稿に失敗しました:', e?.message || e);
  process.exit(1);
});
