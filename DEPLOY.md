# Type Saga — GitHub Pages デプロイ手順

## 概要

Viteでビルドした静的ファイルを GitHub Pages に公開します。  
**リポジトリ名によってURLが変わる**ため、手順①の設定が必須です。

---

## 前提条件

- GitHub リポジトリが作成済みであること
- `git` がローカルにインストールされていること
- `gh-pages` npm パッケージを使う方法（＝シンプル手動デプロイ）を採用

---

## 手順

### ① vite.config.js に `base` を設定する

GitHub Pages のURLは `https://<ユーザー名>.github.io/<リポジトリ名>/` になります。  
Viteに正しいパスを教えるために `base` を設定してください。

```js
// vite.config.js
import { defineConfig } from 'vite';

export default defineConfig({
  base: '/<リポジトリ名>/',  // 例: '/typing-game/'
  define: {
    'process.env': {}
  }
});
```

> [!IMPORTANT]
> `base` を設定しないと、CSSやJSのパスが壊れて真っ白なページになります。

---

### ② `gh-pages` パッケージをインストール

```bash
npm install --save-dev gh-pages
```

---

### ③ `package.json` にデプロイスクリプトを追加

```json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "deploy": "npm run build && gh-pages -d dist"
  }
}
```

---

### ④ GitHub リポジトリを remote に追加（初回のみ）

```bash
git init
git remote add origin https://github.com/<ユーザー名>/<リポジトリ名>.git
git add .
git commit -m "initial commit"
git push -u origin main
```

---

### ⑤ デプロイ実行

```bash
npm run deploy
```

これにより：
1. `vite build` で `dist/` フォルダが生成される
2. `gh-pages` が `dist/` の内容を `gh-pages` ブランチに push する

---

### ⑥ GitHub のリポジトリ設定を確認

1. GitHub リポジトリ → **Settings** → **Pages**
2. **Source** を `gh-pages` ブランチ、ルート `/` に設定
3. 数分後に `https://<ユーザー名>.github.io/<リポジトリ名>/` で公開される

---

## 更新時の手順（2回目以降）

```bash
npm run deploy
```

これだけで最新の `dist/` が `gh-pages` ブランチに上書きされます。

---

## GitHub Actions を使った自動デプロイ（発展）

`main` ブランチにプッシュするたびに自動でデプロイしたい場合は、以下のワークフローを作成：

```yaml
# .github/workflows/deploy.yml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: npm run build
      - uses: peaceiris/actions-gh-pages@v4
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./dist
```

> [!NOTE]
> `peaceiris/actions-gh-pages` を使う場合、`vite.config.js` の `base` 設定は引き続き必要です。

---

## トラブルシューティング

| 症状 | 原因 | 対処 |
|------|------|------|
| ページが真っ白 | `base` 未設定 | `vite.config.js` に `base: '/<repo名>/'` を追加 |
| 404 エラー | gh-pages ブランチが存在しない | `npm run deploy` を実行 |
| APIが動かない | ブラウザのコンソールを確認 | Groq APIキーの入力ミスを確認 |
| ビルドが失敗 | `node_modules` が壊れている | `rm -rf node_modules && npm install` |

---

## スマートフォン対応について

現状はタブレット（〜900px）まで対応済みです。  
スマートフォン対応を追加する場合、主な課題は：

- **ソフトウェアキーボードがテキストエリアを隠す** → `visualViewport` APIで対処が必要
- **大量タイピングはスマホに不向き** → 文字数制限を短くするか、別のUI（1文ずつ表示等）が必要

ニーズがあれば専用モードとして実装することを推奨します。
