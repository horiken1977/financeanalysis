# 財務分析アプリケーション

EDINET APIを活用して、企業の財務データ（貸借対照表・損益計算書）を取得・分析するWebアプリケーションです。

## 機能

- 企業名による検索
- 直近5年分の財務データ表示
- 貸借対照表（BS）と損益計算書（PL）の表示
- 財務推移グラフ
- 収益性指標の計算・表示
- レスポンシブデザイン対応

## 技術スタック

- **フロントエンド**: Next.js, React, TailwindCSS
- **バックエンド**: Next.js API Routes
- **データ取得**: EDINET API
- **グラフ**: Chart.js, react-chartjs-2
- **デプロイ**: Vercel

## セットアップ

### 1. 依存関係のインストール

```bash
npm install
```

### 2. 環境変数の設定

`.env.local`ファイルを作成し、EDINET API キーを設定してください：

```env
EDINET_API_KEY=your_edinet_api_key_here
```

### 3. 開発サーバーの起動

```bash
npm run dev
```

http://localhost:3000 でアプリケーションにアクセスできます。

## 🚀 デプロイ状況

### ✅ 自動デプロイ設定完了
- **GitHub Actions**: 有効
- **Vercel連携**: 設定済み  
- **環境変数**: 設定済み

### 🔗 アプリケーションURL
- **メインアプリ**: [Vercel（自動更新）](https://financeanalysis.vercel.app)
- **開発ドキュメント**: [GitHub Pages](https://horiken1977.github.io/financeanalysis/)

### 📋 デプロイ方法
1. **自動デプロイ**: コードをプッシュ → 自動でVercelにデプロイ
2. **デプロイ状況確認**: [GitHub Actions](https://github.com/horiken1977/financeanalysis/actions)

### 🔧 設定詳細
詳細な設定方法は [vercel-setup.md](vercel-setup.md) を参照してください。

### 手動デプロイ（必要時のみ）
```bash
vercel --prod
```

## 使い方

1. アプリケーションにアクセス
2. 企業名を入力して検索ボタンをクリック
3. 検索結果から企業を選択
4. 直近5年分の財務データとグラフが表示されます

## API仕様

### POST /api/search-company

企業検索API

**リクエスト:**
```json
{
  "companyName": "企業名"
}
```

**レスポンス:**
```json
{
  "company": {
    "edinetCode": "E12345",
    "filerName": "企業名",
    "securitiesCode": "1234"
  },
  "years": [2023, 2022, 2021, 2020, 2019],
  "data": [
    {
      "year": 2023,
      "data": {
        "balanceSheet": {
          "totalAssets": 1000000000,
          "totalLiabilities": 600000000,
          "netAssets": 400000000
        },
        "profitLoss": {
          "netSales": 500000000,
          "operatingIncome": 50000000,
          "netIncome": 30000000
        }
      }
    }
  ]
}
```

## 注意事項

- EDINET API には利用制限があります
- 大量のリクエストを送信しないよう注意してください
- データ取得には時間がかかる場合があります
- 一部の企業では財務データが取得できない場合があります

## ライセンス

MIT License

## 作者

[Your Name]

## 開発ドキュメント

詳細な開発ドキュメントは`docs/`フォルダを参照してください：

- [開発ダッシュボード](docs/index.html)
- [機能設計書](docs/functional-spec.html)
- [環境設計書](docs/environment-spec.html)
- [テスト仕様書](docs/test-spec.html)