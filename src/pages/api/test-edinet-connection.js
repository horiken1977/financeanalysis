/**
 * EDINET API疎通確認API
 * APIキーが正常に動作するかテストする
 */

import axios from 'axios';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const apiKey = process.env.EDINET_API_KEY;
    if (!apiKey) {
        return res.status(500).json({ 
            error: 'EDINET API キーが設定されていません',
            statusCode: 500,
            details: '環境変数EDINET_API_KEYが見つかりません'
        });
    }

    try {
        console.log('EDINET API疎通確認開始...');
        
        // 最近の書類一覧を取得してAPIキーをテスト
        const testDate = new Date();
        testDate.setDate(testDate.getDate() - 7); // 1週間前の日付
        const dateStr = testDate.toISOString().split('T')[0];
        
        const url = 'https://api.edinet-fsa.go.jp/api/v2/documents.json';
        const params = {
            date: dateStr,
            type: 2 // 提出書類一覧及びメタデータ
        };

        console.log(`API疎通テスト: ${url}?date=${dateStr}&type=2`);

        const response = await axios.get(url, {
            params,
            headers: {
                'Subscription-Key': apiKey
            },
            timeout: 10000 // 10秒でタイムアウト
        });

        console.log(`API応答ステータス: ${response.status}`);
        console.log(`取得データ: ${JSON.stringify(response.data).substring(0, 200)}...`);

        // APIエラーチェック
        if (response.data && response.data.statusCode === 401) {
            return res.status(401).json({
                error: 'EDINET API認証エラー',
                statusCode: 401,
                details: 'APIキーが無効です',
                suggestion: 'Vercelの環境変数でEDINET_API_KEYを確認してください'
            });
        }

        // レスポンス形式チェック
        if (!response.data || typeof response.data !== 'object') {
            return res.status(500).json({
                error: 'EDINET API応答形式エラー',
                statusCode: response.status,
                details: '予期しない応答形式です',
                responseData: response.data
            });
        }

        // 成功レスポンス
        const resultsCount = response.data.results ? response.data.results.length : 0;
        
        return res.status(200).json({
            success: true,
            message: 'EDINET APIへの接続が成功しました',
            statusCode: response.status,
            details: {
                testDate: dateStr,
                documentsFound: resultsCount,
                apiEndpoint: url,
                responseTime: `${Date.now() - Date.now()}ms`
            },
            apiResponse: {
                metadata: response.data.metadata || null,
                resultsCount: resultsCount
            }
        });

    } catch (error) {
        console.error('EDINET API疎通確認エラー:', error);

        // HTTPエラーの詳細情報を取得
        let statusCode = 500;
        let errorDetails = error.message;
        
        if (error.response) {
            statusCode = error.response.status;
            errorDetails = `HTTP ${statusCode}: ${error.response.statusText}`;
            
            if (error.response.data) {
                try {
                    const errorData = typeof error.response.data === 'string' 
                        ? JSON.parse(error.response.data) 
                        : error.response.data;
                    errorDetails += ` - ${JSON.stringify(errorData)}`;
                } catch (parseError) {
                    errorDetails += ` - ${error.response.data}`;
                }
            }
        } else if (error.code === 'ECONNABORTED') {
            errorDetails = 'リクエストタイムアウト（10秒）';
        } else if (error.code === 'ENOTFOUND') {
            errorDetails = 'DNS解決エラー（ネットワーク接続を確認してください）';
        }

        return res.status(statusCode).json({
            error: 'EDINET API疎通確認失敗',
            statusCode: statusCode,
            details: errorDetails,
            errorCode: error.code || 'UNKNOWN',
            suggestion: statusCode === 401 
                ? 'APIキーが無効です。Vercel環境変数を確認してください。'
                : statusCode >= 500
                    ? 'EDINET API側の問題の可能性があります。しばらく待ってから再試行してください。'
                    : 'ネットワーク接続またはAPI設定を確認してください。'
        });
    }
}