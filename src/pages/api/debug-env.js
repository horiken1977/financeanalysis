/**
 * 環境変数デバッグAPI
 * EDINET_API_KEYの存在確認と詳細情報を表示
 */

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        console.log('=== 環境変数デバッグ開始 ===');
        
        // 環境変数の詳細チェック
        const apiKey = process.env.EDINET_API_KEY;
        const nodeEnv = process.env.NODE_ENV;
        const vercelEnv = process.env.VERCEL_ENV;
        
        console.log('NODE_ENV:', nodeEnv);
        console.log('VERCEL_ENV:', vercelEnv);
        console.log('API Key exists:', !!apiKey);
        console.log('API Key type:', typeof apiKey);
        console.log('API Key length:', apiKey ? apiKey.length : 0);
        
        // 全ての環境変数をチェック（EDINET関連のみ）
        const allEnvVars = Object.keys(process.env).filter(key => 
            key.includes('EDINET') || key.includes('API')
        );
        console.log('EDINET/API関連環境変数:', allEnvVars);
        
        // APIキーの詳細分析
        let apiKeyInfo = {
            exists: !!apiKey,
            type: typeof apiKey,
            length: apiKey ? apiKey.length : 0,
            firstChar: apiKey ? apiKey.charAt(0) : null,
            lastChar: apiKey ? apiKey.charAt(apiKey.length - 1) : null,
            preview: apiKey ? `${apiKey.substring(0, 8)}***${apiKey.substring(apiKey.length - 4)}` : null,
            hasWhitespace: apiKey ? /\s/.test(apiKey) : false,
            isEmpty: apiKey === '',
            isUndefined: apiKey === undefined,
            isNull: apiKey === null
        };
        
        console.log('API Key 詳細:', apiKeyInfo);
        
        // Vercel固有の環境変数チェック
        const vercelInfo = {
            isVercel: !!process.env.VERCEL,
            vercelEnv: process.env.VERCEL_ENV,
            vercelUrl: process.env.VERCEL_URL,
            region: process.env.VERCEL_REGION
        };
        
        console.log('Vercel情報:', vercelInfo);
        
        return res.status(200).json({
            success: true,
            environment: {
                nodeEnv: nodeEnv,
                vercelEnv: vercelEnv,
                isProduction: nodeEnv === 'production',
                isVercel: !!process.env.VERCEL
            },
            apiKey: apiKeyInfo,
            vercel: vercelInfo,
            edinetRelatedEnvVars: allEnvVars,
            timestamp: new Date().toISOString(),
            message: apiKey ? 'APIキーが正常に読み込まれています' : 'APIキーが見つかりません'
        });
        
    } catch (error) {
        console.error('環境変数デバッグエラー:', error);
        return res.status(500).json({
            error: '環境変数デバッグ中にエラーが発生しました',
            details: error.message,
            stack: error.stack
        });
    }
}