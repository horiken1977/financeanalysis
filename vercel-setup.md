# Vercel自動デプロイ設定ガイド

## 1. Vercelプロジェクトの作成

### 1.1 Vercel CLIのインストール
```bash
npm i -g vercel
```

### 1.2 Vercelにログイン
```bash
vercel login
```

### 1.3 プロジェクトのリンク
```bash
vercel --confirm
```

## 2. 環境変数の設定

Vercelダッシュボードで以下の環境変数を設定してください：

### 2.1 アプリケーション用環境変数
- `EDINET_API_KEY`: EDINET APIキー
- `NODE_ENV`: `production`

### 2.2 GitHub Actions用環境変数 (GitHub Secrets)

GitHubリポジトリの Settings > Secrets and variables > Actions で以下を設定：

#### 必須のSecrets:
- `VERCEL_TOKEN`: Vercel Personal Access Token
- `VERCEL_ORG_ID`: Vercel Organization ID
- `VERCEL_PROJECT_ID`: Vercel Project ID
- `EDINET_API_KEY`: EDINET APIキー

#### 値の取得方法:

**VERCEL_TOKEN:**
1. https://vercel.com/account/tokens
2. "Create Token"をクリック
3. トークン名を入力して作成
4. 生成されたトークンをコピー

**VERCEL_ORG_ID & VERCEL_PROJECT_ID:**
```bash
# プロジェクトルートで実行
vercel link
```
`.vercel/project.json` ファイルが作成されます：
```json
{
  "orgId": "your-org-id",
  "projectId": "your-project-id"
}
```

## 3. 自動デプロイの仕組み

### 3.1 デプロイトリガー
- `main`ブランチへのプッシュで自動デプロイ
- プルリクエストで自動プレビューデプロイ

### 3.2 デプロイフロー
1. GitHubにコードプッシュ
2. GitHub Actionsが起動
3. テストの実行
4. ビルドの実行
5. Vercelへの自動デプロイ

### 3.3 設定ファイル
- `vercel.json`: Vercel設定
- `.github/workflows/deploy.yml`: GitHub Actions設定
- `.vercelignore`: デプロイ除外ファイル

## 4. デプロイの確認

### 4.1 ローカルでのプレビュー
```bash
# 開発サーバーの起動
npm run dev

# プロダクションビルドのテスト
npm run build
npm run start
```

### 4.2 デプロイ状況の確認
- Vercelダッシュボード: https://vercel.com/dashboard
- GitHub Actions: https://github.com/horiken1977/financeanalysis/actions

## 5. トラブルシューティング

### 5.1 よくあるエラー

**ビルドエラー:**
```bash
# ローカルでビルドをテスト
npm run build
```

**環境変数エラー:**
- Vercelダッシュボードで環境変数が正しく設定されているか確認
- GitHub Secretsが正しく設定されているか確認

**デプロイ権限エラー:**
- VERCEL_TOKENが有効か確認
- Organization IDとProject IDが正しいか確認

### 5.2 ログの確認
```bash
# Vercel CLIでログを確認
vercel logs
```

## 6. 手動デプロイ

緊急時や初回デプロイ時：
```bash
# プロダクションデプロイ
vercel --prod

# プレビューデプロイ
vercel
```

## 7. カスタムドメインの設定

Vercelダッシュボード > Settings > Domains で独自ドメインを設定可能です。

## 8. 監視とアラート

### 8.1 Vercel Analytics
- パフォーマンス監視
- エラー追跡
- 使用量監視

### 8.2 GitHub Actions通知
- Slackやメール通知の設定
- デプロイ状況の自動通知

---

このガイドに従って設定することで、コードをpushするだけで自動的にVercelにデプロイされるようになります。