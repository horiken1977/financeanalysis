#!/bin/bash
cd /Users/aa479881/Library/CloudStorage/OneDrive-IBM/Personal/development/financeanalysis

# Add all changes
git add -A

# Commit with message
git commit -m "CSVデータ解析機能の実装

- XBRLファイルが見つからない場合のCSVフォールバック機能
- CSVファイルからの財務データ抽出機能
- 有価証券報告書・貸借対照表・損益計算書CSV対応
- 日本語項目名の英語キーマッピング
- CSV形式の自動検出と解析
- 段階的データ抽出（優先度付き）

解決対象: CSVファイルのみ提供される場合の財務データ取得
機能: XBRL/CSV両形式対応のハイブリッド解析

🤖 Generated with [Claude Code](https://claude.ai/code)

Co-Authored-By: Claude <noreply@anthropic.com>"

# Push to remote
git push origin main

echo "コミット完了"