/**
 * 企業検索デバッグAPI
 * 詳細な検索ログと企業名マッチング情報を提供
 */

import EDINETClient from '../../lib/edinet-client';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { companyName, testDate } = req.body;

    if (!companyName) {
        return res.status(400).json({ error: '企業名を入力してください' });
    }

    const apiKey = process.env.EDINET_API_KEY;
    if (!apiKey) {
        return res.status(500).json({ error: 'EDINET API キーが設定されていません' });
    }

    try {
        console.log(`=== 企業検索デバッグ開始: ${companyName} ===`);
        
        // 指定された日付、または最近の日付を使用
        const searchDate = testDate || (() => {
            const date = new Date();
            date.setDate(date.getDate() - 7);
            return date.toISOString().split('T')[0];
        })();

        console.log(`検索日付: ${searchDate}`);

        const client = new EDINETClient(apiKey);
        
        // 書類一覧を直接取得
        const documents = await client.getDocumentList(searchDate);
        
        if (!documents || !documents.results) {
            return res.status(404).json({
                error: '指定日に書類が見つかりません',
                searchDate: searchDate,
                documentsData: documents
            });
        }

        console.log(`総書類数: ${documents.results.length}`);

        // 企業名マッチング詳細分析
        const allCompanies = [];
        const matchedCompanies = [];
        const companyNameLower = companyName.toLowerCase();

        documents.results.forEach((report, index) => {
            const filerName = report.filerName || '';
            const submitterName = report.submitterName || '';
            
            // 全ての企業情報を記録
            allCompanies.push({
                index: index,
                edinetCode: report.edinetCode,
                filerName: filerName,
                submitterName: submitterName,
                formCode: report.formCode,
                docDescription: report.docDescription
            });

            // マッチング条件をチェック
            const matches = {
                filerNameLowerIncludes: filerName.toLowerCase().includes(companyNameLower),
                submitterNameLowerIncludes: submitterName.toLowerCase().includes(companyNameLower),
                filerNameIncludes: filerName.includes(companyName),
                submitterNameIncludes: submitterName.includes(companyName)
            };

            const isMatch = matches.filerNameLowerIncludes || 
                          matches.submitterNameLowerIncludes || 
                          matches.filerNameIncludes || 
                          matches.submitterNameIncludes;

            if (isMatch) {
                matchedCompanies.push({
                    ...allCompanies[allCompanies.length - 1],
                    matchDetails: matches
                });
            }
        });

        console.log(`一致企業数: ${matchedCompanies.length}`);

        // ユニークな企業を抽出
        const uniqueCompanies = new Map();
        matchedCompanies.forEach(company => {
            if (!uniqueCompanies.has(company.edinetCode)) {
                uniqueCompanies.set(company.edinetCode, company);
            }
        });

        // 検索結果の詳細分析
        const searchAnalysis = {
            searchTerm: companyName,
            searchDate: searchDate,
            totalDocuments: documents.results.length,
            totalMatches: matchedCompanies.length,
            uniqueCompanies: uniqueCompanies.size,
            sampleCompanies: Array.from(allCompanies.slice(0, 10)), // 最初の10社をサンプル表示
            matchedCompanies: Array.from(uniqueCompanies.values()),
            formCodeDistribution: {},
            searchPatterns: [
                `filerName.toLowerCase().includes("${companyNameLower}")`,
                `submitterName.toLowerCase().includes("${companyNameLower}")`,
                `filerName.includes("${companyName}")`,
                `submitterName.includes("${companyName}")`
            ]
        };

        // 書類種別の分布を計算
        documents.results.forEach(report => {
            const formCode = report.formCode || 'unknown';
            searchAnalysis.formCodeDistribution[formCode] = 
                (searchAnalysis.formCodeDistribution[formCode] || 0) + 1;
        });

        return res.status(200).json({
            success: true,
            analysis: searchAnalysis,
            debugInfo: {
                apiEndpoint: `https://disclosure.edinet-fsa.go.jp/api/v2/documents.json?date=${searchDate}`,
                timestamp: new Date().toISOString()
            }
        });

    } catch (error) {
        console.error('企業検索デバッグエラー:', error);
        return res.status(500).json({
            error: 'デバッグ中にエラーが発生しました',
            details: error.message,
            companyName: companyName
        });
    }
}