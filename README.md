# 1000円ポッキリ市場

楽天市場の「1000円ポッキリ・送料無料」商品を毎日自動収集して静的サイトを生成する放置型アフィリエイトサイト。依存パッケージゼロ(Node 20+のみ)。

## 仕組み

楽天商品検索API → `data/items.json` → 静的HTML生成(`dist/`) → GitHub Actionsで毎日6:00(JST)に自動ビルド&デプロイ。

## セットアップ

### 1. ローカルで動作確認

```bash
export RAKUTEN_APP_ID="あなたのアプリID"
export RAKUTEN_AFFILIATE_ID="あなたのアフィリエイトID"
npm run all          # 取得 → ビルド
npx serve dist       # または dist/index.html をブラウザで開く
```

### 2. GitHubにpushして自動化

1. GitHubで新規リポジトリ作成(Private可)→ このフォルダをpush
2. リポジトリの **Settings → Secrets and variables → Actions** で以下を追加
   - `RAKUTEN_APP_ID`
   - `RAKUTEN_AFFILIATE_ID`
3. **Settings → Pages** → Source を **GitHub Actions** に変更
4. **Actions** タブ → `daily-build` → **Run workflow** で初回手動実行
5. 表示されたURLを `config.js` の `site.url` に反映して再push

以降は毎朝6時に勝手に更新されます。

### Cloudflare Pagesを使う場合(推奨・独自ドメイン無料)

Pagesの「Direct Upload」ではなくGitHub連携でもよいが、cronビルドが必要なのでGitHub Actionsでビルドし、`cloudflare/wrangler-action` でデプロイする方式に差し替え可能。まずはGitHub Pagesで動かしてからでOK。

## カスタマイズ

- **カテゴリ追加/変更**: `config.js` の `categories`。ジャンルIDは[楽天ジャンル検索API](https://webservice.rakuten.co.jp/documentation/genre-search)で調べる
- **マラソン開催中バナー**: `config.js` の `marathonEnd` に終了日時を入れる(過ぎると自動で消える)
- **デザイン**: `src/style.css`

## 運用メモ

- 取得0件のときはビルドを中止する安全弁入り(空サイトで上書きしない)
- APIレート制限(1req/秒)対策で1.1秒スリープ済み
- フッターにアフィリエイト広告利用の表記あり(ステマ規制対応)
- 月イチでActionsが緑か確認するだけでOK
