# GitHub Pages 手動設定ガイド

## ❌ 現在の問題
GitHub Actionsで「Resource not accessible by integration」エラーが発生しています。

## 🔧 手動設定手順

### 1. GitHubリポジトリ設定
1. GitHubで [リポジトリ](https://github.com/horiken1977/financeanalysis) にアクセス
2. **Settings** タブをクリック
3. 左サイドバーの **Pages** をクリック

### 2. GitHub Pages 有効化
1. **Source** セクションで **GitHub Actions** を選択
2. 設定を保存

### 3. 権限設定確認
1. **Settings** > **Actions** > **General**
2. **Workflow permissions** セクションで以下を確認：
   - **Read and write permissions** が選択されている
   - **Allow GitHub Actions to create and approve pull requests** にチェック

### 4. ワークフロー再有効化
上記設定完了後、以下のファイルを編集してGitHub Pagesデプロイを再有効化：

`.github/workflows/deploy.yml` で以下の行のコメントアウトを削除：
```yaml
# deploy-docs: のコメントアウトを削除
```

## 🌐 期待されるURL
設定完了後のドキュメントURL：
https://horiken1977.github.io/financeanalysis/

## ⚡ 現在の状況
- ✅ Vercelアプリケーション: 正常デプロイ済み
- ⏳ GitHub Pagesドキュメント: 手動設定待ち

---

**注意**: GitHub Pagesの設定が完了するまで、ドキュメントはリポジトリ内の `docs/` フォルダから直接参照してください。