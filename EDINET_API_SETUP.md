# EDINET API キー設定ガイド

## 🔑 EDINET APIキーの取得方法

### 1. EDINETアカウント作成
1. [EDINET](https://disclosure.edinet-fsa.go.jp/) にアクセス
2. 「利用者登録」から新規アカウントを作成
3. 利用規約に同意し、必要事項を入力

### 2. APIキーの取得
1. EDINETにログイン
2. 「API」メニューにアクセス
3. 「Subscription Key」を確認・取得

## 🔧 環境変数の設定

### Vercel環境での設定

1. **Vercelダッシュボードにアクセス**
   - https://vercel.com/dashboard にログイン
   - 対象プロジェクト（financeanalysis）を選択

2. **環境変数の設定**
   - 「Settings」タブをクリック
   - 左サイドバーから「Environment Variables」を選択
   - 「Add New」ボタンをクリック

3. **APIキーの追加**
   ```
   Name: EDINET_API_KEY
   Value: [取得したEDINET APIキー]
   Environment: Production (本番環境)
   ```

4. **設定の保存と再デプロイ**
   - 「Save」ボタンをクリック
   - 「Deployments」タブに移動
   - 最新のデプロイメントから「Redeploy」を実行

### ローカル開発環境での設定

1. **環境ファイルの作成**
   ```bash
   # プロジェクトルートに .env.local ファイルを作成
   touch .env.local
   ```

2. **APIキーの追加**
   ```env
   # .env.local ファイルの内容
   EDINET_API_KEY=your_actual_edinet_api_key_here
   ```

3. **開発サーバーの再起動**
   ```bash
   npm run dev
   ```

## ✅ 設定確認方法

### 1. アプリケーションでのテスト
1. アプリケーションにアクセス
2. 企業名（例：「トヨタ」）で検索
3. 企業が見つかれば設定成功

### 2. エラーメッセージの確認
- **認証エラー**: APIキーが無効または未設定
- **該当企業なし**: APIキーは有効だが、企業名が見つからない

## 🚫 トラブルシューティング

### 認証エラーが発生する場合

1. **APIキーの確認**
   - EDINETダッシュボードでAPIキーが有効か確認
   - コピー&ペースト時の余分なスペースがないか確認

2. **環境変数の確認**
   - Vercelで環境変数が正しく設定されているか確認
   - Production環境に設定されているか確認

3. **再デプロイの実行**
   - 環境変数変更後は必ず再デプロイが必要
   - Vercelダッシュボードから手動で再デプロイ

### 企業が見つからない場合

1. **企業名の確認**
   - 正式な企業名で検索
   - 略称（例：「トヨタ」「ソニー」など）で検索
   - ひらがな・カタカナ・漢字の表記を試す

2. **検索期間の確認**
   - 現在の実装では過去3年分を検索
   - 古い企業や統合された企業は見つからない可能性

## 📋 API利用制限

- **レート制限**: 1秒間に1リクエスト
- **データ範囲**: 過去の有価証券報告書・四半期報告書
- **対象企業**: EDINET提出義務のある企業のみ

## 🔗 関連リンク

- [EDINET公式サイト](https://disclosure.edinet-fsa.go.jp/)
- [EDINET API仕様書](https://disclosure.edinet-fsa.go.jp/EKW0EZ0015.html)
- [Vercel環境変数設定](https://vercel.com/docs/concepts/projects/environment-variables)

---

このガイドに従ってAPIキーを設定することで、企業の財務データ検索が可能になります。