#!/bin/bash

# チャット自動保存スクリプト
# Claude Codeとのチャット履歴を2時間毎に自動保存し、
# IDEクラッシュやPC再起動に対する耐性を提供します

# 設定
SAVE_INTERVAL=7200  # 2時間（秒）
SAVE_DIR="docs/chat-history"
BACKUP_DIR="docs/chat-history/backups"
LOG_FILE="docs/chat-history/save.log"
CLAUDE_HISTORY_SOURCE="$HOME/.claude-code/history"  # Claude Codeの履歴ファイルパス（実際のパスに要調整）

# ディレクトリの作成
create_directories() {
    mkdir -p "$SAVE_DIR"
    mkdir -p "$BACKUP_DIR"
    echo "$(date '+%Y-%m-%d %H:%M:%S') - ディレクトリを作成しました: $SAVE_DIR, $BACKUP_DIR" >> "$LOG_FILE"
}

# チャット履歴の保存
save_chat_history() {
    local timestamp=$(date '+%Y%m%d_%H%M%S')
    local save_file="$SAVE_DIR/chat_history_$timestamp.json"
    local backup_file="$BACKUP_DIR/chat_backup_$timestamp.json"
    
    echo "$(date '+%Y-%m-%d %H:%M:%S') - チャット履歴の保存を開始..." >> "$LOG_FILE"
    
    # Claude Codeの履歴ファイルが存在するかチェック
    if [ -f "$CLAUDE_HISTORY_SOURCE" ]; then
        # メインの保存
        cp "$CLAUDE_HISTORY_SOURCE" "$save_file"
        # バックアップの作成
        cp "$CLAUDE_HISTORY_SOURCE" "$backup_file"
        
        echo "$(date '+%Y-%m-%d %H:%M:%S') - チャット履歴を保存しました: $save_file" >> "$LOG_FILE"
        echo "$(date '+%Y-%m-%d %H:%M:%S') - バックアップを作成しました: $backup_file" >> "$LOG_FILE"
        
        # ターミナルに表示
        echo "✅ チャット履歴を保存しました ($(date '+%Y-%m-%d %H:%M:%S'))"
        
        # ファイルサイズの記録
        local file_size=$(du -h "$save_file" | cut -f1)
        echo "$(date '+%Y-%m-%d %H:%M:%S') - 保存されたファイルサイズ: $file_size" >> "$LOG_FILE"
        
    else
        echo "$(date '+%Y-%m-%d %H:%M:%S') - 警告: Claude履歴ファイルが見つかりません: $CLAUDE_HISTORY_SOURCE" >> "$LOG_FILE"
        echo "⚠️  Claude履歴ファイルが見つかりません"
        
        # 代替として、現在の作業ディレクトリ情報を保存
        save_fallback_info "$save_file"
    fi
}

# 代替情報の保存（Claude履歴が取得できない場合）
save_fallback_info() {
    local save_file="$1"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    
    cat > "$save_file" << EOF
{
  "timestamp": "$timestamp",
  "type": "fallback_save",
  "working_directory": "$(pwd)",
  "git_status": "$(git status --porcelain 2>/dev/null || echo 'Git not initialized')",
  "recent_files": [
$(find . -name "*.html" -o -name "*.js" -o -name "*.json" -o -name "*.md" | head -10 | sed 's/.*/"&"/' | sed '$!s/$/,/')
  ],
  "project_structure": "$(tree -L 2 2>/dev/null || ls -la)"
}
EOF
    
    echo "$(date '+%Y-%m-%d %H:%M:%S') - 代替情報を保存しました: $save_file" >> "$LOG_FILE"
}

# 古いバックアップファイルのクリーンアップ（7日以上古いファイルを削除）
cleanup_old_backups() {
    find "$BACKUP_DIR" -name "chat_backup_*.json" -mtime +7 -delete 2>/dev/null
    find "$SAVE_DIR" -name "chat_history_*.json" -mtime +7 -delete 2>/dev/null
    
    echo "$(date '+%Y-%m-%d %H:%M:%S') - 古いバックアップファイルをクリーンアップしました" >> "$LOG_FILE"
}

# システム情報の記録
record_system_info() {
    local info_file="$SAVE_DIR/system_info.json"
    
    cat > "$info_file" << EOF
{
  "last_save": "$(date '+%Y-%m-%d %H:%M:%S')",
  "hostname": "$(hostname)",
  "os": "$(uname -s)",
  "os_version": "$(uname -r)",
  "user": "$(whoami)",
  "uptime": "$(uptime)",
  "disk_usage": "$(df -h . | tail -1)",
  "memory_usage": "$(free -h 2>/dev/null || vm_stat | head -5)"
}
EOF
}

# プロセスの生存確認
check_process_health() {
    local pid_file="$SAVE_DIR/auto_save.pid"
    echo $$ > "$pid_file"
    
    echo "$(date '+%Y-%m-%d %H:%M:%S') - 自動保存プロセス開始 (PID: $$)" >> "$LOG_FILE"
}

# シグナルハンドラー（Ctrl+Cなどでの終了時）
cleanup_on_exit() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - 自動保存プロセスを終了します" >> "$LOG_FILE"
    echo "🔄 自動保存プロセスを終了しました"
    exit 0
}

# メイン実行関数
main() {
    echo "🚀 チャット自動保存スクリプトを開始します"
    echo "📂 保存先: $SAVE_DIR"
    echo "⏰ 保存間隔: $((SAVE_INTERVAL / 3600))時間"
    echo "📝 ログファイル: $LOG_FILE"
    echo ""
    
    # 初期化
    create_directories
    check_process_health
    record_system_info
    
    # シグナルハンドラーの設定
    trap cleanup_on_exit SIGINT SIGTERM
    
    # 最初の保存
    save_chat_history
    cleanup_old_backups
    
    # 定期実行ループ
    while true; do
        echo "💤 次回保存まで待機中... ($(date '+%H:%M:%S'))"
        sleep "$SAVE_INTERVAL"
        
        echo "🔄 定期保存を実行中..."
        save_chat_history
        cleanup_old_backups
        record_system_info
        
        # 2時間毎の表示メッセージ
        echo "📊 $(date '+%Y-%m-%d %H:%M:%S') - 定期保存完了"
        echo "📁 保存ファイル数: $(ls -1 "$SAVE_DIR"/chat_history_*.json 2>/dev/null | wc -l)"
        echo "💾 ディスク使用量: $(du -sh "$SAVE_DIR" 2>/dev/null | cut -f1)"
        echo ""
    done
}

# スクリプトの実行
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi