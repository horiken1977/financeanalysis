/**
 * 企業検索API（高速版）
 * 企業名検索のみを行い、候補企業をすぐに返す
 */

import EDINETClient from '../../lib/edinet-client';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { companyName } = req.body;

    if (!companyName) {
        return res.status(400).json({ error: '企業名を入力してください' });
    }

    const apiKey = process.env.EDINET_API_KEY;
    if (!apiKey) {
        return res.status(500).json({ error: 'EDINET API キーが設定されていません' });
    }

    try {
        const client = new EDINETClient(apiKey);
        
        // 企業を検索（高速版）
        console.log(`API: 企業検索開始 - ${companyName}`);
        const companies = await client.searchCompany(companyName);
        
        if (companies.length === 0) {
            return res.status(404).json({ 
                error: '該当する企業が見つかりません',
                suggestion: 'EDINET APIキーが正しく設定されているか確認してください。企業名は正式名称または一般的な略称で検索してください。'
            });
        }

        console.log(`API: ${companies.length}社の企業が見つかりました`);
        
        // 企業候補をすぐに返す（財務データは別途取得）
        return res.status(200).json({
            companies: companies,
            message: `${companies.length}社の企業が見つかりました`
        });

    } catch (error) {
        console.error('企業検索エラー:', error);
        
        // 認証エラーの場合は特別なメッセージを返す
        if (error.message.includes('認証エラー')) {
            return res.status(401).json({ 
                error: 'EDINET API認証エラー',
                details: 'APIキーが無効か設定されていません。環境変数EDINET_API_KEYを確認してください。',
                instruction: 'Vercelの環境変数設定でEDINET_API_KEYを正しく設定してください。'
            });
        }
        
        return res.status(500).json({ 
            error: 'データ取得中にエラーが発生しました',
            details: error.message 
        });
    }
}