// ======================================================
// サイト設定 — ここだけ触ればOK
// ======================================================

export const site = {
  title: "1000円ポッキリ市場",
  description:
    "楽天市場の「1000円ポッキリ・送料無料」だけを毎日自動で集めたカタログ。お買い物マラソンの買い回り店舗数稼ぎに。",
  // 公開URL(Cloudflare Pages / GitHub Pages のURLに変更)
  url: "https://example.pages.dev",
  // 1カテゴリあたり取得する商品数(30の倍数、最大90推奨)
  itemsPerCategory: 60,
  // トップページに載せる各カテゴリの件数
  topPageItemsPerCategory: 8,
};

// 楽天ジャンルID: https://webservice.rakuten.co.jp/documentation/genre-search
// slugがファイル名になる (例: food.html)
export const categories = [
  { slug: "food",    name: "食品",             genreId: 100227 },
  { slug: "sweets",  name: "スイーツ・お菓子", genreId: 551167 },
  { slug: "drink",   name: "水・ドリンク",     genreId: 100316 },
  { slug: "daily",   name: "日用品・雑貨",     genreId: 215783 },
  { slug: "cosme",   name: "コスメ・美容",     genreId: 100939 },
  { slug: "pet",     name: "ペット用品",       genreId: 101213 },
];

// お買い物マラソン開催中はここに終了日時を入れると
// サイト上部に開催中バナーが自動で出る(過ぎたら勝手に消える)
// 例: "2026-08-11T01:59:00+09:00"  / 使わないなら null
export const marathonEnd = null;
