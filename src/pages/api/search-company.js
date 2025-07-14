/**
 * 企業検索API
 * 企業名から直近5年分のBS/PLデータを取得
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
        
        // 1. 企業を検索
        const companies = await client.searchCompany(companyName);
        
        if (companies.length === 0) {
            return res.status(404).json({ error: '該当する企業が見つかりません' });
        }

        // 2. 最初にヒットした企業の直近5年分のデータを取得
        const targetCompany = companies[0];
        const currentYear = new Date().getFullYear();
        const years = Array.from({length: 5}, (_, i) => currentYear - 1 - i); // 直近5年

        const financialData = await client.getMultiYearData(targetCompany.edinetCode, years);

        return res.status(200).json({
            company: targetCompany,
            years: years,
            data: financialData
        });

    } catch (error) {
        console.error('企業検索エラー:', error);
        return res.status(500).json({ 
            error: 'データ取得中にエラーが発生しました',
            details: error.message 
        });
    }
}