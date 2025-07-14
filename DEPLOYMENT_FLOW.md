# 🚀 デプロイメントフロー

## 📋 デプロイ順序

GitHub Actionsでは以下の順序でデプロイが実行されます：

### 1️⃣ **GitHub Pages デプロイ** (最初)
- ドキュメント（docs/フォルダ）をGitHub Pagesにデプロイ
- タイムスタンプを自動更新
- **成功条件**: GitHub Pagesデプロイが正常完了

### 2️⃣ **Vercel デプロイ** (GitHub Pages成功後)
- アプリケーション本体をVercelにデプロイ
- **依存条件**: `needs: deploy-docs` でGitHub Pages成功後のみ実行
- **実行条件**: mainブランチかつGitHub Pages成功時のみ

### 3️⃣ **テスト実行** (並行)
- 単体テスト・カバレッジレポート生成
- **実行タイミング**: 他のジョブと並行実行

## 🔄 フロー図

```
Push to main
    ↓
┌─────────────────┐    ┌─────────────┐
│ GitHub Pages    │    │ Tests       │
│ (docs deploy)   │    │ (parallel)  │
└─────────┬───────┘    └─────────────┘
          ↓ ✅ Success
┌─────────────────┐
│ Vercel Deploy   │
│ (app deploy)    │
└─────────────────┘
```

## ✅ 期待される結果

1. **GitHub Pages成功** → ドキュメントが更新される
2. **Vercel成功** → アプリケーションが更新される
3. **GitHub Pages失敗** → Vercelデプロイはスキップされる

## 🌐 デプロイ完了後のURL

- **📚 ドキュメント**: https://horiken1977.github.io/financeanalysis/
- **🚀 アプリケーション**: https://financeanalysis-horiken1977-horikens-projects.vercel.app

---

この設定により、ドキュメントが正常にデプロイできない場合は、アプリケーションのデプロイも停止され、品質を保証します。