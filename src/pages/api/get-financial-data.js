/**
 * 財務データ取得API
 * 指定された企業の複数年財務データを取得
 */

import EDINETClient from '../../lib/edinet-client';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { edinetCode, years } = req.body;

    if (!edinetCode) {
        return res.status(400).json({ error: 'EDINETコードが必要です' });
    }

    if (!years || !Array.isArray(years) || years.length === 0) {
        return res.status(400).json({ error: '取得年度を指定してください' });
    }

    const apiKey = process.env.EDINET_API_KEY;
    if (!apiKey) {
        return res.status(500).json({ error: 'EDINET API キーが設定されていません' });
    }

    try {
        const client = new EDINETClient(apiKey);
        
        console.log(`API: 財務データ取得開始 - ${edinetCode}, 年度: ${years.join(', ')}`);
        
        // 複数年の財務データを取得
        const financialData = await client.getMultiYearData(edinetCode, years);
        
        console.log(`API: 財務データ取得完了 - ${financialData.filter(d => d.data).length}/${years.length}年分`);

        return res.status(200).json({
            edinetCode: edinetCode,
            years: years,
            data: financialData
        });

    } catch (error) {
        console.error('財務データ取得エラー:', error);
        return res.status(500).json({ 
            error: '財務データ取得中にエラーが発生しました',
            details: error.message 
        });
    }
}