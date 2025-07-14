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
     * 企業を検索
     * @param {string} companyName - 企業名
     * @returns {Promise<Array>} 検索結果
     */
    async searchCompany(companyName) {
        try {
            // 最近3か月の書類から企業を検索
            const currentDate = new Date();
            const searchDates = [];
            
            // 過去3か月分の月末日を生成
            for (let i = 0; i < 3; i++) {
                const date = new Date(currentDate);
                date.setMonth(date.getMonth() - i);
                const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0);
                searchDates.push(lastDay.toISOString().split('T')[0]);
            }

            const companies = new Map();

            for (const date of searchDates) {
                try {
                    const documents = await this.getDocumentList(date);
                    const reports = this.filterFinancialReports(documents);
                    
                    // 企業名で検索
                    const matchedReports = reports.filter(report => 
                        report.filerName.includes(companyName) ||
                        report.submitterName?.includes(companyName)
                    );

                    matchedReports.forEach(report => {
                        companies.set(report.edinetCode, {
                            edinetCode: report.edinetCode,
                            filerName: report.filerName,
                            submitterName: report.submitterName,
                            securitiesCode: report.securitiesCode,
                            jcn: report.jcn
                        });
                    });

                    if (companies.size > 0) break; // 見つかったら早期終了
                } catch (error) {
                    console.warn(`日付 ${date} での検索エラー:`, error.message);
                }
            }

            return Array.from(companies.values());
        } catch (error) {
            throw new Error(`企業検索エラー: ${error.message}`);
        }
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
            type: 2, // 提出書類一覧及びメタデータ
            'Subscription-Key': this.apiKey
        };

        try {
            const response = await axios.get(url, { params });
            return response.data;
        } catch (error) {
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
            type: 2, // XBRL
            'Subscription-Key': this.apiKey
        };

        try {
            const response = await axios.get(url, {
                params,
                responseType: 'arraybuffer'
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
        
        for (const year of years) {
            try {
                console.log(`${year}年度データ取得中...`);
                
                // 各年度の有価証券報告書を取得
                const yearData = await this.getYearlyFinancialData(edinetCode, year);
                results.push({
                    year: year,
                    data: yearData
                });
                
                // レート制限対応
                await new Promise(resolve => setTimeout(resolve, 1000));
            } catch (error) {
                console.error(`${year}年度データ取得エラー:`, error.message);
                results.push({
                    year: year,
                    error: error.message
                });
            }
        }
        
        return results;
    }

    /**
     * 特定年度の財務データを取得
     * @param {string} edinetCode - EDINETコード
     * @param {string} year - 年度
     * @returns {Promise<Object>} 財務データ
     */
    async getYearlyFinancialData(edinetCode, year) {
        // 年度末日を計算（通常は3月末）
        const fiscalYearEnd = `${parseInt(year) + 1}-03-31`;
        
        // 書類一覧を取得（年度末前後の期間を検索）
        const startDate = `${year}-01-01`;
        const endDate = `${parseInt(year) + 1}-12-31`;
        
        // 複数日にわたって検索
        const searchDates = this.generateSearchDates(startDate, endDate);
        
        for (const date of searchDates) {
            try {
                const documents = await this.getDocumentList(date);
                const reports = this.filterFinancialReports(documents);
                
                // 指定したEDINETコードの報告書を探す
                const targetReport = reports.find(report => 
                    report.edinetCode === edinetCode &&
                    report.formCode === '030000' // 有価証券報告書
                );
                
                if (targetReport) {
                    const xbrlData = await this.getXBRLData(targetReport.docID);
                    const parsedData = await this.parseXBRL(xbrlData);
                    const financialData = this.extractFinancialData(parsedData);
                    
                    return {
                        ...financialData,
                        metadata: {
                            docID: targetReport.docID,
                            filerName: targetReport.filerName,
                            submitDate: targetReport.submitDate,
                            docDescription: targetReport.docDescription
                        }
                    };
                }
            } catch (error) {
                console.warn(`日付 ${date} での検索エラー:`, error.message);
            }
        }
        
        throw new Error(`${year}年度の財務データが見つかりませんでした`);
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