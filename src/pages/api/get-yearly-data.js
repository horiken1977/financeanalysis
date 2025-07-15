/**
 * 単年度財務データ取得API
 * 指定された企業の特定年度の財務データを取得
 */

import EDINETClient from '../../lib/edinet-client';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { edinetCode, year, companyName } = req.body;

    if (!edinetCode) {
        return res.status(400).json({ error: 'EDINETコードが必要です' });
    }

    if (!year) {
        return res.status(400).json({ error: '年度を指定してください' });
    }

    const apiKey = process.env.EDINET_API_KEY;
    if (!apiKey) {
        return res.status(500).json({ error: 'EDINET API キーが設定されていません' });
    }

    try {
        const client = new EDINETClient(apiKey);
        
        console.log(`API: 単年度財務データ取得開始 - 企業: ${companyName || edinetCode}, 年度: ${year}`);
        
        // 単年度の財務データを取得（改善版）
        const financialData = await client.getYearlyFinancialDataImproved(edinetCode, year);
        
        console.log(`API: ${year}年度の財務データ取得完了`);

        return res.status(200).json({
            success: true,
            edinetCode: edinetCode,
            year: year,
            companyName: companyName,
            data: financialData
        });

    } catch (error) {
        console.error(`${year}年度財務データ取得エラー:`, error);
        return res.status(500).json({ 
            error: `${year}年度の財務データ取得に失敗しました`,
            details: error.message,
            edinetCode: edinetCode,
            year: year
        });
    }
}