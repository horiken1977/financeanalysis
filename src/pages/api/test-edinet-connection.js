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
    
    // 環境変数の詳細ログ
    console.log('=== API キー確認 ===');
    console.log('NODE_ENV:', process.env.NODE_ENV);
    console.log('VERCEL_ENV:', process.env.VERCEL_ENV);
    console.log('API Key exists:', !!apiKey);
    console.log('API Key type:', typeof apiKey);
    console.log('API Key length:', apiKey ? apiKey.length : 0);
    console.log('API Key preview:', apiKey ? `${apiKey.substring(0, 8)}***${apiKey.substring(apiKey.length - 4)}` : 'null');
    
    if (!apiKey) {
        return res.status(500).json({ 
            error: 'EDINET API キーが設定されていません',
            statusCode: 500,
            details: '環境変数EDINET_API_KEYが見つかりません',
            debugInfo: {
                nodeEnv: process.env.NODE_ENV,
                vercelEnv: process.env.VERCEL_ENV,
                isVercel: !!process.env.VERCEL,
                apiKeyExists: !!apiKey,
                apiKeyType: typeof apiKey
            }
        });
    }

    try {
        console.log('EDINET API疎通確認開始...');
        
        // 最近の書類一覧を取得してAPIキーをテスト
        const testDate = new Date();
        testDate.setDate(testDate.getDate() - 7); // 1週間前の日付
        const dateStr = testDate.toISOString().split('T')[0];
        
        const url = 'https://disclosure.edinet-fsa.go.jp/api/v2/documents.json';
        const params = {
            date: dateStr,
            type: 2, // 提出書類一覧及びメタデータ
            'Subscription-Key': apiKey // EDINET API v2では認証キーはクエリパラメータとして送信
        };

        console.log(`API疎通テスト: ${url}?date=${dateStr}&type=2&Subscription-Key=${apiKey.substring(0, 8)}***`);
        console.log('修正済み: Subscription-Keyをクエリパラメータとして送信');

        const response = await axios.get(url, {
            params,
            headers: {
                'User-Agent': 'financeanalysis-app/1.0'
            },
            timeout: 10000, // 10秒でタイムアウト
            validateStatus: (status) => {
                // すべてのステータスコードを受け入れて詳細を確認
                return status < 600;
            }
        });

        console.log(`API応答ステータス: ${response.status}`);
        console.log(`レスポンスヘッダー:`, JSON.stringify(response.headers, null, 2));
        console.log(`取得データ: ${JSON.stringify(response.data).substring(0, 500)}...`);

        // 401エラーの詳細分析
        if (response.status === 401) {
            console.error('401エラー詳細分析:');
            console.error('- APIキー長:', apiKey.length);
            console.error('- APIキープレビュー:', `${apiKey.substring(0, 8)}***${apiKey.substring(apiKey.length - 4)}`);
            console.error('- リクエストURL:', `${url}?${new URLSearchParams(params).toString()}`);
            console.error('- レスポンスデータ:', JSON.stringify(response.data, null, 2));
            
            return res.status(401).json({
                error: 'EDINET API認証エラー',
                statusCode: 401,
                details: '401 Unauthorized - APIキーが拒否されました',
                debugInfo: {
                    requestUrl: `${url}?${new URLSearchParams(params).toString()}`,
                    apiKeyLength: apiKey.length,
                    apiKeyPreview: `${apiKey.substring(0, 8)}***${apiKey.substring(apiKey.length - 4)}`,
                    responseData: JSON.stringify(response.data),
                    responseHeaders: JSON.stringify(response.headers)
                },
                suggestion: 'EDINET APIキーが無効または期限切れの可能性があります。EDINETサイトで新しいAPIキーを取得してください。'
            });
        }

        // APIエラーチェック（レスポンス内のstatusCode）
        if (response.data && response.data.statusCode === 401) {
            return res.status(401).json({
                error: 'EDINET API認証エラー',
                statusCode: 401,
                details: 'レスポンス内でAPIキーが無効と判定されました',
                debugInfo: {
                    responseStatusCode: response.data.statusCode,
                    responseMessage: response.data.message || 'メッセージなし'
                },
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
                responseTime: '< 1秒'
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