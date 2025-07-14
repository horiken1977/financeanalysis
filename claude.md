# Claude Code 設定ファイル

## プロジェクト概要
Finance Analysis Application の開発環境設定とドキュメント管理システム

## 自動保存設定

### チャット履歴自動保存
- **保存間隔**: 2時間毎
- **保存先**: `docs/chat-history/`
- **バックアップ先**: `docs/chat-history/backups/`
- **ログファイル**: `docs/chat-history/save.log`
- **実行スクリプト**: `test/scripts/chat-auto-save.sh`

### 実行コマンド
```bash
# 手動実行
npm run auto-save

# バックグラウンド実行開始
npm run auto-save:start

# バックグラウンド実行停止
npm run auto-save:stop
```

### 通知設定
- ターミナルに2時間毎に保存状況を表示
- 保存成功時: ✅ チャット履歴を保存しました
- エラー時: ⚠️ エラーメッセージを表示

## テスト実行コマンド

### 単体テスト
```bash
npm run test:unit
```

### 統合テスト
```bash
npm run test:integration
```

### E2Eテスト
```bash
npm run test:e2e
```

### 全テスト実行
```bash
npm test
```

### ウォッチモード
```bash
npm run test:watch
```

## ビルド・デプロイコマンド

### 開発サーバー起動
```bash
npm run dev
```

### 本番ビルド
```bash
npm run build
```

### 本番サーバー起動
```bash
npm start
```

### Vercelデプロイ
```bash
vercel --prod
```

## ドキュメント管理

### ドキュメント構成
- **開発ダッシュボード**: `docs/index.html`
- **機能設計書**: `docs/functional-spec.html`
- **環境設計書**: `docs/environment-spec.html`
- **テスト仕様書**: `docs/test-spec.html`

### ドキュメント確認
```bash
# ローカルサーバーでドキュメント確認
npm run docs:serve
# http://localhost:8080 でアクセス
```

### GitHub Pages URL
```
https://yourusername.github.io/financeanalysis/
```

## 自動更新システム

### チャット内容解析キーワード

#### 機能関連
- 機能, feature, API, エンドポイント, 要件, requirement
- ユーザー, user, interface, UI, UX, 画面

#### 環境関連
- 環境, environment, deploy, デプロイ, CI/CD, Docker
- サーバー, server, インフラ, infrastructure, クラウド, cloud

#### テスト関連
- テスト, test, spec, 仕様, カバレッジ, coverage
- unittest, 単体テスト, integration, 統合テスト, E2E

### 自動更新実行
```bash
node docs/auto-update.js
```

## プロジェクト構造

```
financeanalysis/
├── docs/                    # ドキュメント類
│   ├── index.html          # 開発ダッシュボード
│   ├── functional-spec.html # 機能設計書
│   ├── environment-spec.html # 環境設計書
│   ├── test-spec.html      # テスト仕様書
│   ├── auto-update.js      # 自動更新スクリプト
│   └── chat-history/       # チャット履歴保存先
├── test/                   # テスト関連
│   ├── scripts/           # テストスクリプト
│   │   └── chat-auto-save.sh # チャット自動保存
│   └── data/              # テストデータ
├── src/                   # ソースコード
├── public/               # 静的ファイル
├── .github/              # GitHub Actions設定
│   └── workflows/
│       └── deploy.yml    # デプロイワークフロー
├── package.json          # 依存関係定義
├── vercel.json          # Vercel設定
├── claude.md            # このファイル
└── README.md            # プロジェクト説明
```

## 環境変数

### 必要な環境変数（Vercel設定）
```bash
VERCEL_TOKEN=your_vercel_token
ORG_ID=your_vercel_org_id
PROJECT_ID=your_vercel_project_id
```

### GitHub Secrets設定
- `VERCEL_TOKEN`: Vercelアクセストークン
- `ORG_ID`: Vercel組織ID
- `PROJECT_ID`: VercelプロジェクトID

## 開発者向けメモ

### 初回セットアップ
1. 依存関係のインストール: `npm install`
2. 自動保存開始: `npm run auto-save:start`
3. 開発サーバー起動: `npm run dev`
4. ドキュメント確認: `npm run docs:serve`

### GitHub設定
1. リポジトリをGitHubに作成
2. GitHub Pages設定: Settings > Pages > Source: GitHub Actions
3. Vercel連携設定
4. 必要なSecretsを設定

### ブランチ戦略
- `main`: 本番環境用（自動デプロイ）
- `develop`: 開発環境用
- `feature/*`: 機能開発用

### コミット規約
- `feat:` 新機能
- `fix:` バグ修正
- `docs:` ドキュメント更新
- `test:` テスト追加・修正
- `refactor:` リファクタリング

## トラブルシューティング

### よくある問題

1. **チャット自動保存が動かない**
   - スクリプトに実行権限があるか確認: `chmod +x test/scripts/chat-auto-save.sh`
   - Claude履歴ファイルのパスを確認・調整

2. **ドキュメントが更新されない**
   - `docs/auto-update.js`の実行権限を確認
   - キーワードマッチングが適切に動作しているか確認

3. **GitHub Pagesでドキュメントが表示されない**
   - Pages設定でGitHub Actionsが選択されているか確認
   - デプロイワークフローが正常に実行されているか確認

4. **Vercelデプロイが失敗する**
   - 環境変数（Secrets）が正しく設定されているか確認
   - `vercel.json`の設定を確認

## 拡張機能

### 今後追加予定
- リアルタイムチャット監視
- 進捗データのAPI化
- Slack通知連携
- 高度な自然言語処理による内容解析

### カスタマイズ
- `docs/auto-update.js`でキーワードやロジックをカスタマイズ
- `test/scripts/chat-auto-save.sh`で保存間隔や保存先を調整
- CSSスタイルをカスタマイズしてドキュメントの見た目を変更