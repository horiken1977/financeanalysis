/**
 * EDINET API クライアント
 * 財務諸表データの取得と解析を行うクライアントライブラリ
 */

import axios from 'axios';
import AdmZip from 'adm-zip';
import { XMLParser } from 'fast-xml-parser';

class EDINETClient {
    constructor(apiKey) {
        this.apiKey = apiKey;
        this.baseURL = 'https://api.edinet-fsa.go.jp/api/v2';
        this.rateLimiter = new RateLimiter(1); // 1リクエスト/秒
    }

    /**
     * 企業を検索（高速版）
     * @param {string} companyName - 企業名
     * @returns {Promise<Array>} 検索結果
     */
    async searchCompany(companyName) {
        try {
            console.log(`企業検索開始: ${companyName}`);
            const companies = new Map();
            
            // 段階的検索戦略：最新のデータから順に検索
            const searchPhases = [
                { months: 1, description: '直近1ヶ月' },
                { months: 3, description: '直近3ヶ月' },
                { months: 12, description: '直近1年' },
                { months: 36, description: '直近3年' }
            ];

            for (const phase of searchPhases) {
                console.log(`検索フェーズ: ${phase.description}`);
                
                const found = await this.searchCompanyInPeriod(companyName, phase.months, companies);
                
                if (found > 0) {
                    console.log(`${phase.description}で${found}社発見`);
                    // 十分な企業が見つかったら終了
                    if (companies.size >= 3) {
                        break;
                    }
                }
            }

            const result = Array.from(companies.values());
            console.log(`企業検索完了: ${result.length}社見つかりました`);
            
            if (result.length === 0) {
                console.warn(`「${companyName}」に一致する企業が見つかりませんでした`);
            }

            return result;
        } catch (error) {
            console.error(`企業検索エラー:`, error);
            throw new Error(`企業検索エラー: ${error.message}`);
        }
    }

    /**
     * 指定期間内で企業を検索
     * @param {string} companyName - 企業名
     * @param {number} months - 検索期間（月数）
     * @param {Map} existingCompanies - 既存の企業マップ
     * @returns {Promise<number>} 新規発見企業数
     */
    async searchCompanyInPeriod(companyName, months, existingCompanies) {
        const currentDate = new Date();
        const searchDates = [];
        let foundCount = 0;
        
        // 月末日を優先的に検索（有価証券報告書の提出が多いため）
        for (let i = 0; i < months; i++) {
            const date = new Date(currentDate);
            date.setMonth(date.getMonth() - i);
            
            // 月末日を追加（ただし未来の日付は除外）
            const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0);
            if (monthEnd <= currentDate) {
                searchDates.push(monthEnd.toISOString().split('T')[0]);
            }
            
            // 主要な報告時期（3月、6月、9月、12月）の場合は中旬も追加
            if ([2, 5, 8, 11].includes(date.getMonth())) {
                const midMonth = new Date(date.getFullYear(), date.getMonth(), 15);
                if (midMonth <= currentDate) {
                    searchDates.push(midMonth.toISOString().split('T')[0]);
                }
            }
        }

        // 最新の日付から検索
        const maxSearchesPerPhase = 5; // 各フェーズで最大5回の検索
        let searchCount = 0;

        for (const date of searchDates) {
            if (searchCount >= maxSearchesPerPhase) break;
            
            try {
                searchCount++;
                
                const documents = await this.getDocumentList(date);
                
                if (!documents || !documents.results) {
                    console.warn(`${date}: 書類データが取得できませんでした`);
                    continue;
                }
                
                // すべての書類タイプから検索（企業候補を広く取得）
                const allReports = documents.results || [];
                
                // 企業名で検索（部分一致、大文字小文字を区別しない）
                const matchedReports = allReports.filter(report => {
                    const filerName = report.filerName || '';
                    const submitterName = report.submitterName || '';
                    const companyNameLower = companyName.toLowerCase();
                    
                    return filerName.toLowerCase().includes(companyNameLower) ||
                           submitterName.toLowerCase().includes(companyNameLower) ||
                           filerName.includes(companyName) ||
                           submitterName.includes(companyName);
                });

                matchedReports.forEach(report => {
                    if (!existingCompanies.has(report.edinetCode)) {
                        existingCompanies.set(report.edinetCode, {
                            edinetCode: report.edinetCode,
                            filerName: report.filerName,
                            submitterName: report.submitterName,
                            securitiesCode: report.securitiesCode,
                            jcn: report.jcn,
                            lastFoundDate: date,
                            formCode: report.formCode,
                            docDescription: report.docDescription
                        });
                        foundCount++;
                    }
                });

                // 企業が見つかったら早期終了
                if (foundCount > 0) {
                    break;
                }
                
            } catch (error) {
                console.warn(`日付 ${date} での検索エラー:`, error.message);
                // 認証エラーの場合は上位に伝播
                if (error.message.includes('認証エラー')) {
                    throw error;
                }
            }
        }

        return foundCount;
    }

    /**
     * 書類一覧を取得
     * @param {string} date - 取得対象日（YYYY-MM-DD形式）
     * @returns {Promise<Object>} 書類一覧データ
     */
    async getDocumentList(date) {
        await this.rateLimiter.throttle();
        
        const url = `${this.baseURL}/documents.json`;
        const params = {
            date: date,
            type: 2 // 提出書類一覧及びメタデータ
        };

        try {
            const response = await axios.get(url, { 
                params,
                headers: {
                    'Subscription-Key': this.apiKey
                }
            });
            
            // APIエラーチェック
            if (response.data && response.data.statusCode === 401) {
                throw new Error('EDINET API認証エラー: 無効なAPIキーです。環境変数EDINET_API_KEYを確認してください。');
            }
            
            return response.data;
        } catch (error) {
            if (error.response && error.response.status === 401) {
                throw new Error('EDINET API認証エラー: 無効なAPIキーです。環境変数EDINET_API_KEYを確認してください。');
            }
            throw new Error(`書類一覧取得エラー: ${error.message}`);
        }
    }

    /**
     * 有価証券報告書と四半期報告書をフィルタリング
     * @param {Object} documents - 書類一覧データ
     * @returns {Array} フィルタリング後の書類配列
     */
    filterFinancialReports(documents) {
        if (!documents.results) return [];
        
        return documents.results.filter(doc => {
            // 有価証券報告書（030000）または四半期報告書（043000）
            return doc.formCode === '030000' || doc.formCode === '043000';
        });
    }

    /**
     * XBRLファイルを取得
     * @param {string} docID - 書類管理番号
     * @returns {Promise<Buffer>} XBRLファイルのZIPバイナリデータ
     */
    async getXBRLData(docID) {
        await this.rateLimiter.throttle();
        
        const url = `${this.baseURL}/documents/${docID}`;
        const params = {
            type: 2 // XBRL
        };

        try {
            const response = await axios.get(url, {
                params,
                responseType: 'arraybuffer',
                headers: {
                    'Subscription-Key': this.apiKey
                }
            });

            // Content-Typeでエラーチェック
            if (response.headers['content-type']?.includes('application/json')) {
                const errorData = JSON.parse(response.data);
                throw new Error(`API Error: ${errorData.message || 'Unknown error'}`);
            }

            return response.data;
        } catch (error) {
            throw new Error(`XBRLデータ取得エラー: ${error.message}`);
        }
    }

    /**
     * XBRLファイルを解析
     * @param {Buffer} zipBuffer - ZIPファイルのバイナリデータ
     * @returns {Promise<Object>} 解析されたXBRLデータ
     */
    async parseXBRL(zipBuffer) {
        try {
            const zip = new AdmZip(zipBuffer);
            const entries = zip.getEntries();

            // XBRLファイルを探す（通常は PublicDoc フォルダ内）
            const xbrlEntry = entries.find(entry => 
                entry.entryName.includes('.xbrl') && 
                !entry.entryName.includes('_lab') && 
                !entry.entryName.includes('_pre') &&
                !entry.entryName.includes('_def')
            );

            if (!xbrlEntry) {
                throw new Error('XBRLファイルが見つかりません');
            }

            const xbrlContent = zip.readAsText(xbrlEntry);
            const parser = new XMLParser({
                ignoreAttributes: false,
                attributeNamePrefix: '@_',
                allowBooleanAttributes: true
            });

            return parser.parse(xbrlContent);
        } catch (error) {
            throw new Error(`XBRL解析エラー: ${error.message}`);
        }
    }

    /**
     * 財務データを抽出
     * @param {Object} xbrlData - 解析されたXBRLデータ
     * @param {string} contextRef - コンテキスト参照
     * @returns {Object} 抽出された財務データ
     */
    extractFinancialData(xbrlData, contextRef = 'CurrentYearInstant') {
        const contextRefDuration = 'CurrentYearDuration';
        
        try {
            // 貸借対照表項目
            const balanceSheet = {
                // 資産の部
                currentAssets: this.findValue(xbrlData, 'jppfs_cor:CurrentAssets', contextRef),
                nonCurrentAssets: this.findValue(xbrlData, 'jppfs_cor:NoncurrentAssets', contextRef),
                totalAssets: this.findValue(xbrlData, 'jppfs_cor:Assets', contextRef),
                
                // 負債の部
                currentLiabilities: this.findValue(xbrlData, 'jppfs_cor:CurrentLiabilities', contextRef),
                nonCurrentLiabilities: this.findValue(xbrlData, 'jppfs_cor:NoncurrentLiabilities', contextRef),
                totalLiabilities: this.findValue(xbrlData, 'jppfs_cor:Liabilities', contextRef),
                
                // 純資産の部
                netAssets: this.findValue(xbrlData, 'jppfs_cor:NetAssets', contextRef),
                
                // 主要な資産項目
                cashAndDeposits: this.findValue(xbrlData, 'jppfs_cor:CashAndDeposits', contextRef),
                tradeAccounts: this.findValue(xbrlData, 'jppfs_cor:NotesAndAccountsReceivableTrade', contextRef),
                inventory: this.findValue(xbrlData, 'jppfs_cor:Inventories', contextRef),
                propertyPlantEquipment: this.findValue(xbrlData, 'jppfs_cor:PropertyPlantAndEquipment', contextRef)
            };

            // 損益計算書項目
            const profitLoss = {
                netSales: this.findValue(xbrlData, 'jppfs_cor:NetSales', contextRefDuration),
                costOfSales: this.findValue(xbrlData, 'jppfs_cor:CostOfSales', contextRefDuration),
                grossProfit: this.findValue(xbrlData, 'jppfs_cor:GrossProfit', contextRefDuration),
                operatingIncome: this.findValue(xbrlData, 'jppfs_cor:OperatingIncome', contextRefDuration),
                ordinaryIncome: this.findValue(xbrlData, 'jppfs_cor:OrdinaryIncome', contextRefDuration),
                netIncome: this.findValue(xbrlData, 'jppfs_cor:ProfitLoss', contextRefDuration),
                
                // 費用項目
                sellingGeneralAdminExpenses: this.findValue(xbrlData, 'jppfs_cor:SellingGeneralAndAdministrativeExpenses', contextRefDuration),
                nonOperatingIncome: this.findValue(xbrlData, 'jppfs_cor:NonOperatingIncome', contextRefDuration),
                nonOperatingExpenses: this.findValue(xbrlData, 'jppfs_cor:NonOperatingExpenses', contextRefDuration)
            };

            // キャッシュフロー項目（可能な場合）
            const cashFlow = {
                operatingCashFlow: this.findValue(xbrlData, 'jppfs_cor:NetCashProvidedByUsedInOperatingActivities', contextRefDuration),
                investingCashFlow: this.findValue(xbrlData, 'jppfs_cor:NetCashProvidedByUsedInInvestmentActivities', contextRefDuration),
                financingCashFlow: this.findValue(xbrlData, 'jppfs_cor:NetCashProvidedByUsedInFinancingActivities', contextRefDuration)
            };

            return {
                balanceSheet,
                profitLoss,
                cashFlow
            };
        } catch (error) {
            throw new Error(`財務データ抽出エラー: ${error.message}`);
        }
    }

    /**
     * XBRL要素から値を検索
     * @param {Object} xbrlData - XBRLデータ
     * @param {string} elementName - 要素名
     * @param {string} contextRef - コンテキスト参照
     * @returns {number|null} 値または null
     */
    findValue(xbrlData, elementName, contextRef) {
        try {
            const xbrl = xbrlData.xbrl || xbrlData;
            const element = xbrl[elementName];
            
            if (!element) return null;
            
            if (Array.isArray(element)) {
                const found = element.find(item => item['@_contextRef'] === contextRef);
                return found ? this.parseNumber(found['#text'] || found) : null;
            } else if (element['@_contextRef'] === contextRef) {
                return this.parseNumber(element['#text'] || element);
            }
            
            return null;
        } catch (error) {
            console.warn(`値検索エラー (${elementName}):`, error.message);
            return null;
        }
    }

    /**
     * 数値をパース
     * @param {string|number} value - パース対象の値
     * @returns {number|null} 数値または null
     */
    parseNumber(value) {
        if (value === null || value === undefined || value === '') return null;
        
        const num = parseFloat(value);
        return isNaN(num) ? null : num;
    }

    /**
     * 複数年データの取得
     * @param {string} edinetCode - EDINETコード
     * @param {Array<string>} years - 年度配列
     * @returns {Promise<Array>} 複数年の財務データ
     */
    async getMultiYearData(edinetCode, years) {
        const results = [];
        
        console.log(`複数年データ取得開始: ${edinetCode} - ${years.length}年分`);
        
        for (const year of years) {
            try {
                console.log(`${year}年度データ取得中...`);
                
                // 各年度の有価証券報告書を取得
                const yearData = await this.getYearlyFinancialData(edinetCode, year);
                results.push({
                    year: year,
                    data: yearData
                });
                
                console.log(`${year}年度データ取得完了`);
                
                // レート制限対応（1秒待機）
                await new Promise(resolve => setTimeout(resolve, 1000));
            } catch (error) {
                console.error(`${year}年度データ取得エラー:`, error.message);
                results.push({
                    year: year,
                    error: error.message
                });
            }
        }
        
        console.log(`複数年データ取得完了: ${results.filter(r => r.data).length}/${years.length}年分成功`);
        return results;
    }

    /**
     * 特定年度の財務データを取得
     * @param {string} edinetCode - EDINETコード
     * @param {string} year - 年度
     * @returns {Promise<Object>} 財務データ
     */
    async getYearlyFinancialData(edinetCode, year) {
        console.log(`${year}年度の財務データ取得開始: ${edinetCode}`);
        
        // 有価証券報告書の提出時期を考慮した検索日程
        const baseYear = parseInt(year);
        const searchDates = [
            // 翌年の有価証券報告書提出時期（3月決算企業）
            `${baseYear + 1}-06-30`,  // 6月末提出
            `${baseYear + 1}-06-29`,  // 6月末前日
            `${baseYear + 1}-05-31`,  // 5月末提出
            `${baseYear + 1}-07-31`,  // 7月末提出
            
            // 当年度の四半期報告書
            `${baseYear}-12-31`,      // 第3四半期
            `${baseYear}-09-30`,      // 第2四半期
            `${baseYear}-06-30`,      // 第1四半期
            `${baseYear}-03-31`,      // 年度末
            
            // 広範囲検索（月末日）
            ...this.generateMonthlySearchDates(baseYear, baseYear + 1)
        ];
        
        console.log(`検索対象期間: ${searchDates.length}日分`);
        
        for (const date of searchDates) {
            try {
                await this.rateLimiter.throttle();
                
                const documents = await this.getDocumentList(date);
                
                if (!documents || !documents.results) {
                    console.warn(`${date}: 書類データが取得できませんでした`);
                    continue;
                }
                
                const reports = this.filterFinancialReports(documents);
                
                // 指定したEDINETコードの報告書を探す
                const targetReport = reports.find(report => 
                    report.edinetCode === edinetCode &&
                    (report.formCode === '030000' || report.formCode === '043000') // 有価証券報告書または四半期報告書
                );
                
                if (targetReport) {
                    console.log(`${year}年度の書類発見: ${targetReport.docDescription} (${date})`);
                    
                    try {
                        const xbrlData = await this.getXBRLData(targetReport.docID);
                        const parsedData = await this.parseXBRL(xbrlData);
                        const financialData = this.extractFinancialData(parsedData);
                        
                        console.log(`${year}年度の財務データ解析完了`);
                        
                        return {
                            ...financialData,
                            metadata: {
                                docID: targetReport.docID,
                                filerName: targetReport.filerName,
                                submitDate: targetReport.submitDate,
                                docDescription: targetReport.docDescription,
                                formCode: targetReport.formCode,
                                foundDate: date
                            }
                        };
                    } catch (parseError) {
                        console.warn(`${year}年度 書類解析エラー:`, parseError.message);
                        // 解析エラーの場合は次の書類を探す
                        continue;
                    }
                }
            } catch (error) {
                console.warn(`${year}年度 日付 ${date} での検索エラー:`, error.message);
                // 検索エラーの場合は次の日付を試す
                continue;
            }
        }
        
        throw new Error(`${year}年度の財務データが見つかりませんでした（検索期間: ${searchDates.length}日分）`);
    }

    /**
     * 検索日付を生成
     * @param {string} startDate - 開始日
     * @param {string} endDate - 終了日
     * @returns {Array<string>} 検索日付配列
     */
    generateSearchDates(startDate, endDate) {
        const dates = [];
        const start = new Date(startDate);
        const end = new Date(endDate);
        
        // 月末日を中心に検索
        const current = new Date(start);
        while (current <= end) {
            // 月末日を取得
            const monthEnd = new Date(current.getFullYear(), current.getMonth() + 1, 0);
            if (monthEnd <= end) {
                dates.push(monthEnd.toISOString().split('T')[0]);
            }
            
            current.setMonth(current.getMonth() + 1);
        }
        
        return dates;
    }

    /**
     * 月末検索日付を生成（年度範囲指定）
     * @param {number} startYear - 開始年度
     * @param {number} endYear - 終了年度
     * @returns {Array<string>} 月末日付配列
     */
    generateMonthlySearchDates(startYear, endYear) {
        const dates = [];
        
        for (let year = startYear; year <= endYear; year++) {
            // 各月の月末日を生成
            for (let month = 1; month <= 12; month++) {
                const monthEnd = new Date(year, month, 0);
                dates.push(monthEnd.toISOString().split('T')[0]);
            }
        }
        
        return dates.sort((a, b) => new Date(b) - new Date(a)); // 新しい日付から古い日付へソート
    }
}

/**
 * レート制限クラス
 */
class RateLimiter {
    constructor(requestsPerSecond = 1) {
        this.interval = 1000 / requestsPerSecond;
        this.lastRequest = 0;
    }

    async throttle() {
        const now = Date.now();
        const timeSinceLastRequest = now - this.lastRequest;
        if (timeSinceLastRequest < this.interval) {
            await new Promise(resolve => 
                setTimeout(resolve, this.interval - timeSinceLastRequest)
            );
        }
        this.lastRequest = Date.now();
    }
}

export default EDINETClient;