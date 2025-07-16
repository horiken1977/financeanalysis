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
        this.baseURL = 'https://disclosure.edinet-fsa.go.jp/api/v2';
        this.rateLimiter = new RateLimiter(1); // 1リクエスト/秒
    }

    /**
     * 企業を検索（改善版）
     * @param {string} companyName - 企業名
     * @returns {Promise<Array>} 検索結果
     */
    async searchCompany(companyName) {
        try {
            console.log(`企業検索開始: ${companyName}`);
            const companies = new Map();
            
            // より包括的な検索戦略：複数期間を並行して検索
            const searchDates = this.generateComprehensiveSearchDates();
            
            console.log(`検索対象: ${searchDates.length}日分のデータ`);
            
            let totalSearched = 0;
            const maxSearches = 15; // 検索回数を増やす
            
            for (const date of searchDates) {
                if (totalSearched >= maxSearches) {
                    console.log(`検索上限に達しました: ${totalSearched}回`);
                    break;
                }
                
                try {
                    totalSearched++;
                    console.log(`検索中 (${totalSearched}/${maxSearches}): ${date}`);
                    
                    const documents = await this.getDocumentList(date);
                    
                    if (!documents || !documents.results) {
                        console.warn(`${date}: 書類データが取得できませんでした`);
                        continue;
                    }
                    
                    // 全ての書類から企業を検索（書類種別を限定しない）
                    const allReports = documents.results || [];
                    console.log(`${date}: ${allReports.length}件の書類をチェック`);
                    
                    // 企業名マッチング（より包括的な検索）
                    const matchedReports = this.findMatchingCompanies(allReports, companyName);
                    
                    if (matchedReports.length > 0) {
                        console.log(`${date}: ${matchedReports.length}件の一致企業を発見`);
                    }

                    matchedReports.forEach(report => {
                        if (!companies.has(report.edinetCode)) {
                            companies.set(report.edinetCode, {
                                edinetCode: report.edinetCode,
                                filerName: report.filerName,
                                submitterName: report.submitterName,
                                securitiesCode: report.securitiesCode,
                                jcn: report.jcn,
                                lastFoundDate: date,
                                formCode: report.formCode,
                                docDescription: report.docDescription
                            });
                        }
                    });

                    // 早期終了しない：より多くの企業を見つけるため継続
                    
                } catch (error) {
                    console.warn(`日付 ${date} での検索エラー:`, error.message);
                    // 認証エラーの場合は上位に伝播
                    if (error.message.includes('認証エラー')) {
                        throw error;
                    }
                }
            }

            const result = Array.from(companies.values());
            console.log(`企業検索完了: ${result.length}社見つかりました（${totalSearched}日分検索）`);
            
            if (result.length === 0) {
                console.warn(`「${companyName}」に一致する企業が見つかりませんでした。検索した期間: ${totalSearched}日分`);
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
            type: 2, // 提出書類一覧及びメタデータ
            'Subscription-Key': this.apiKey // EDINET API v2では認証キーはクエリパラメータ
        };

        try {
            const response = await axios.get(url, { 
                params,
                headers: {
                    'User-Agent': 'financeanalysis-app/1.0'
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
            type: 2, // XBRL
            'Subscription-Key': this.apiKey // EDINET API v2では認証キーはクエリパラメータ
        };

        try {
            const response = await axios.get(url, {
                params,
                responseType: 'arraybuffer',
                headers: {
                    'User-Agent': 'financeanalysis-app/1.0'
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
     * XBRLファイルを解析（改善版）
     * @param {Buffer} zipBuffer - ZIPファイルのバイナリデータ
     * @returns {Promise<Object>} 解析されたXBRLデータ
     */
    async parseXBRL(zipBuffer) {
        try {
            // ZIPファイルの基本検証
            if (!zipBuffer || zipBuffer.length === 0) {
                throw new Error('ZIPファイルが空です');
            }

            // ZIPファイルのマジックナンバーをチェック
            const zipMagic = zipBuffer.slice(0, 4);
            const expectedMagic = Buffer.from([0x50, 0x4b, 0x03, 0x04]); // "PK\x03\x04"
            const alternativeMagic = Buffer.from([0x50, 0x4b, 0x05, 0x06]); // "PK\x05\x06" (empty zip)
            
            if (!zipMagic.equals(expectedMagic) && !zipMagic.equals(alternativeMagic)) {
                console.warn('ZIPマジックナンバー不正:', zipMagic.toString('hex'));
                // マジックナンバーが不正でも続行してみる
            }

            let zip;
            try {
                zip = new AdmZip(zipBuffer);
            } catch (zipError) {
                console.error('ZIP解析エラー:', zipError.message);
                
                // ファイルの終端をチェックして切り抜きを試みる
                const endIndex = this.findZipEndRecord(zipBuffer);
                if (endIndex > 0) {
                    console.log(`ZIPファイルを修復して再試行: ${endIndex}バイトまで`);
                    const truncatedBuffer = zipBuffer.slice(0, endIndex + 22); // ENDレコード含む
                    zip = new AdmZip(truncatedBuffer);
                } else {
                    throw new Error(`ZIPファイルの解析に失敗: ${zipError.message}`);
                }
            }

            const entries = zip.getEntries();
            
            if (entries.length === 0) {
                throw new Error('ZIPファイルが空です');
            }

            console.log(`ZIPエントリ数: ${entries.length}`);

            // XBRLファイルを探す（強化版）
            const xbrlEntry = this.findXBRLEntry(entries);

            if (!xbrlEntry) {
                // デバッグ用に全エントリを表示
                console.log('ZIPエントリ一覧:');
                entries.forEach(entry => {
                    console.log(`- ${entry.entryName} (${entry.header.size} bytes)`);
                });
                throw new Error('XBRLファイルが見つかりません');
            }

            console.log(`XBRLファイル発見: ${xbrlEntry.entryName}`);

            const xbrlContent = zip.readAsText(xbrlEntry);
            
            if (!xbrlContent || xbrlContent.length === 0) {
                throw new Error('XBRLファイルの内容が空です');
            }

            const parser = new XMLParser({
                ignoreAttributes: false,
                attributeNamePrefix: '@_',
                allowBooleanAttributes: true,
                parseAttributeValue: false,
                parseTrueNumberOnly: false
            });

            return parser.parse(xbrlContent);
        } catch (error) {
            throw new Error(`XBRL解析エラー: ${error.message}`);
        }
    }

    /**
     * ZIPファイルのENDレコードを探す
     * @param {Buffer} buffer - ZIPファイルバッファ
     * @returns {number} ENDレコードの位置、見つからない場合は-1
     */
    findZipEndRecord(buffer) {
        const endSignature = Buffer.from([0x50, 0x4b, 0x05, 0x06]); // "PK\x05\x06"
        
        // ファイルの終端から逆方向に検索
        for (let i = buffer.length - 22; i >= 0; i--) {
            if (buffer.slice(i, i + 4).equals(endSignature)) {
                return i;
            }
        }
        
        return -1;
    }

    /**
     * XBRLファイルエントリを探す（強化版）
     * @param {Array} entries - ZIPエントリ一覧
     * @returns {Object|null} XBRLファイルエントリまたはnull
     */
    findXBRLEntry(entries) {
        // 優先度付きでXBRLファイルを探す
        const searchPatterns = [
            // 最優先: PublicDocフォルダ内のメインXBRLファイル
            entry => entry.entryName.includes('PublicDoc/') && 
                     entry.entryName.endsWith('.xbrl') && 
                     !entry.entryName.includes('_lab') && 
                     !entry.entryName.includes('_pre') &&
                     !entry.entryName.includes('_def') &&
                     !entry.entryName.includes('_cal'),
            
            // 第2優先: メインXBRLファイル（フォルダ無関係）
            entry => entry.entryName.endsWith('.xbrl') && 
                     !entry.entryName.includes('_lab') && 
                     !entry.entryName.includes('_pre') &&
                     !entry.entryName.includes('_def') &&
                     !entry.entryName.includes('_cal'),
            
            // 第3優先: 任意の.xbrlファイル
            entry => entry.entryName.endsWith('.xbrl')
        ];

        for (const pattern of searchPatterns) {
            const found = entries.find(pattern);
            if (found) {
                return found;
            }
        }

        return null;
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
                
                // 指定したEDINETコードの報告書を探す（XBRL対応書類を優先）
                const targetReport = this.findBestFinancialReport(reports, edinetCode);
                
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

    /**
     * 包括的な検索日付を生成
     * @returns {Array<string>} 検索日付配列
     */
    generateComprehensiveSearchDates() {
        const dates = [];
        const currentDate = new Date();
        
        // より広範囲の日付を生成：過去6ヶ月を重点的に
        for (let i = 0; i < 180; i += 7) { // 週ごとに過去6ヶ月
            const date = new Date(currentDate);
            date.setDate(date.getDate() - i);
            dates.push(date.toISOString().split('T')[0]);
        }
        
        // 重要な月末日を追加
        for (let month = 0; month < 12; month++) {
            const date = new Date(currentDate);
            date.setMonth(date.getMonth() - month);
            const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0);
            const monthEndStr = monthEnd.toISOString().split('T')[0];
            if (!dates.includes(monthEndStr)) {
                dates.push(monthEndStr);
            }
        }
        
        return dates.sort((a, b) => new Date(b) - new Date(a));
    }

    /**
     * 企業名マッチング（改善版）
     * @param {Array} reports - 書類配列
     * @param {string} companyName - 検索する企業名
     * @returns {Array} マッチした書類配列
     */
    findMatchingCompanies(reports, companyName) {
        const companyNameLower = companyName.toLowerCase();
        
        return reports.filter(report => {
            const filerName = (report.filerName || '').trim();
            const submitterName = (report.submitterName || '').trim();
            
            // より包括的なマッチング条件
            const matchConditions = [
                // 小文字変換での部分一致
                filerName.toLowerCase().includes(companyNameLower),
                submitterName.toLowerCase().includes(companyNameLower),
                
                // 元の文字での部分一致
                filerName.includes(companyName),
                submitterName.includes(companyName),
                
                // 株式会社などの修飾語を除いた検索
                filerName.replace(/株式会社|有限会社|合同会社|合資会社|合名会社/g, '').toLowerCase().includes(companyNameLower),
                submitterName.replace(/株式会社|有限会社|合同会社|合資会社|合名会社/g, '').toLowerCase().includes(companyNameLower),
                
                // カタカナ・ひらがな対応（基本的な変換）
                this.normalizeJapaneseText(filerName).includes(this.normalizeJapaneseText(companyName)),
                this.normalizeJapaneseText(submitterName).includes(this.normalizeJapaneseText(companyName))
            ];
            
            return matchConditions.some(condition => condition);
        });
    }

    /**
     * 日本語テキストの正規化（簡易版）
     * @param {string} text - 正規化するテキスト
     * @returns {string} 正規化されたテキスト
     */
    normalizeJapaneseText(text) {
        if (!text) return '';
        
        // 全角を半角に、カタカナをひらがなに変換（簡易版）
        return text
            .toLowerCase()
            .replace(/[Ａ-Ｚａ-ｚ０-９]/g, (s) => String.fromCharCode(s.charCodeAt(0) - 0xFEE0))
            .replace(/[ァ-ヶ]/g, (s) => String.fromCharCode(s.charCodeAt(0) - 0x60))
            .trim();
    }

    /**
     * 特定年度の財務データを取得（改善版）
     * @param {string} edinetCode - EDINETコード
     * @param {string} year - 年度
     * @returns {Promise<Object>} 財務データ
     */
    async getYearlyFinancialDataImproved(edinetCode, year) {
        console.log(`${year}年度の財務データ取得開始: ${edinetCode}`);
        
        const baseYear = parseInt(year);
        const currentYear = new Date().getFullYear();
        
        // 未来年度の検索を防ぐ
        if (baseYear > currentYear) {
            throw new Error(`未来年度 ${baseYear} のデータは取得できません`);
        }
        
        // より効率的な検索日程（実際のデータがある可能性が高い日付を優先）
        const searchDates = this.generateRealisticSearchDates(baseYear);
        
        console.log(`検索対象期間: ${searchDates.length}日分`);
        
        let searchCount = 0;
        const maxSearches = 10; // 検索回数を制限してタイムアウトを防ぐ
        
        for (const date of searchDates) {
            if (searchCount >= maxSearches) {
                console.log(`検索上限に達しました: ${searchCount}回`);
                break;
            }
            
            try {
                searchCount++;
                console.log(`検索中 (${searchCount}/${maxSearches}): ${date}`);
                
                await this.rateLimiter.throttle();
                
                const documents = await this.getDocumentList(date);
                
                if (!documents || !documents.results) {
                    continue;
                }
                
                const reports = this.filterFinancialReports(documents);
                
                // 指定したEDINETコードの報告書を探す（XBRL対応書類を優先）
                const targetReport = this.findBestFinancialReport(reports, edinetCode);
                
                if (targetReport) {
                    console.log(`${year}年度の書類発見: ${targetReport.docDescription} (${date})`);
                    
                    try {
                        // より安全なXBRLデータ取得
                        const xbrlData = await this.getXBRLDataSafely(targetReport.docID);
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
                                foundDate: date,
                                year: year,
                                searchCount: searchCount
                            }
                        };
                    } catch (parseError) {
                        console.warn(`${year}年度 書類解析エラー (${targetReport.docID}):`, parseError.message);
                        
                        // ZIPエラーの場合は特別なログを出力
                        if (parseError.message.includes('ADM-ZIP') || parseError.message.includes('Invalid or unsupported zip format')) {
                            console.error(`ZIPファイル破損の可能性: ${targetReport.docDescription}`);
                            console.error(`書類情報: docID=${targetReport.docID}, submitDate=${targetReport.submitDate}`);
                        }
                        
                        // 解析エラーの場合は次の書類を探す
                        continue;
                    }
                }
            } catch (error) {
                console.warn(`${year}年度 日付 ${date} での検索エラー:`, error.message);
                // 認証エラーの場合は上位に伝播
                if (error.message.includes('認証エラー')) {
                    throw error;
                }
                continue;
            }
        }
        
        // 最後の手段として、より幅広い検索を実行
        console.log(`${year}年度の標準検索でデータが見つからないため、拡張検索を実行します`);
        
        // 拡張検索日程を生成
        const extendedDates = this.generateExtendedSearchDates(baseYear);
        
        for (const date of extendedDates) {
            if (searchCount >= 20) { // 全体の上限を増やす
                break;
            }
            
            try {
                searchCount++;
                console.log(`拡張検索 (${searchCount}/20): ${date}`);
                
                await this.rateLimiter.throttle();
                const documents = await this.getDocumentList(date);
                
                if (!documents || !documents.results) {
                    continue;
                }
                
                const reports = this.filterFinancialReports(documents);
                const targetReport = reports.find(report => 
                    report.edinetCode === edinetCode &&
                    (report.formCode === '030000' || report.formCode === '043000')
                );
                
                if (targetReport) {
                    console.log(`拡張検索で${year}年度の書類発見: ${targetReport.docDescription}`);
                    
                    try {
                        const xbrlData = await this.getXBRLDataSafely(targetReport.docID);
                        const parsedData = await this.parseXBRL(xbrlData);
                        const financialData = this.extractFinancialData(parsedData);
                        
                        return {
                            ...financialData,
                            metadata: {
                                docID: targetReport.docID,
                                filerName: targetReport.filerName,
                                submitDate: targetReport.submitDate,
                                docDescription: targetReport.docDescription,
                                formCode: targetReport.formCode,
                                foundDate: date,
                                year: year,
                                searchCount: searchCount,
                                extendedSearch: true
                            }
                        };
                    } catch (parseError) {
                        console.warn(`拡張検索 - ${year}年度 解析エラー:`, parseError.message);
                        continue;
                    }
                }
            } catch (error) {
                console.warn(`拡張検索 - ${year}年度 日付 ${date} エラー:`, error.message);
                continue;
            }
        }
        
        throw new Error(`${year}年度の財務データが見つかりませんでした（検索期間: ${searchCount}日分）`);
    }

    /**
     * 現実的な検索日付を生成（年度指定）
     * @param {number} year - 対象年度
     * @returns {Array<string>} 検索日付配列
     */
    generateRealisticSearchDates(year) {
        const dates = [];
        
        // 有価証券報告書の一般的な提出時期
        const reportingDates = [
            `${year + 1}-06-30`,  // 6月末（最も一般的）
            `${year + 1}-06-29`,  // 6月末前
            `${year + 1}-05-31`,  // 5月末
            `${year + 1}-07-31`,  // 7月末
            `${year + 1}-04-30`,  // 4月末
            `${year + 1}-08-31`,  // 8月末
            `${year}-12-31`,      // 年度末
            `${year}-09-30`,      // 第2四半期
            `${year}-06-30`,      // 第1四半期
            `${year}-03-31`       // 年度始
        ];
        
        // 現在日付より前の日付のみを追加
        const currentDate = new Date();
        reportingDates.forEach(dateStr => {
            const date = new Date(dateStr);
            if (date <= currentDate) {
                dates.push(dateStr);
            }
        });
        
        return dates;
    }

    /**
     * 拡張検索日付を生成
     * @param {number} year - 対象年度
     * @returns {Array<string>} 拡張検索日付配列
     */
    generateExtendedSearchDates(year) {
        const dates = [];
        const currentDate = new Date();
        
        // より幅広い日付範囲で検索
        const months = [3, 4, 5, 6, 7, 8, 9, 10, 11, 12]; // 月末日
        const years = [year, year + 1, year + 2]; // 年度幅を広げる
        
        for (const searchYear of years) {
            if (searchYear > currentDate.getFullYear()) continue;
            
            for (const month of months) {
                const lastDay = new Date(searchYear, month, 0).getDate();
                const dateStr = `${searchYear}-${month.toString().padStart(2, '0')}-${lastDay.toString().padStart(2, '0')}`;
                
                const date = new Date(dateStr);
                if (date <= currentDate) {
                    dates.push(dateStr);
                }
            }
        }
        
        return dates;
    }

    /**
     * 安全なXBRLデータ取得（改善版）
     * @param {string} docID - 書類管理番号
     * @returns {Promise<Buffer>} XBRLファイルのZIPバイナリデータ
     */
    async getXBRLDataSafely(docID) {
        await this.rateLimiter.throttle();
        
        const url = `${this.baseURL}/documents/${docID}`;
        
        // 複数のtypeパラメータを試行
        const tryParams = [
            { type: 2, description: 'XBRL' },
            { type: 5, description: 'XBRL (alternative)' },
            { type: 1, description: 'ZIP (fallback)' }
        ];

        for (const paramSet of tryParams) {
            try {
                console.log(`書類取得試行: ${paramSet.description} (type=${paramSet.type})`);
                
                const params = {
                    type: paramSet.type,
                    'Subscription-Key': this.apiKey
                };

                const response = await axios.get(url, {
                    params,
                    responseType: 'arraybuffer',
                    headers: {
                        'User-Agent': 'financeanalysis-app/1.0',
                        'Accept': 'application/zip, application/octet-stream, */*'
                    },
                    timeout: 45000, // 45秒に延長
                    maxContentLength: 100 * 1024 * 1024, // 100MBに増大
                    validateStatus: (status) => status < 400
                });

                console.log(`レスポンス情報: Status=${response.status}, Content-Type=${response.headers['content-type']}, Size=${response.data.length} bytes`);

                // Content-Typeでエラーチェック
                if (response.headers['content-type']?.includes('application/json')) {
                    const errorData = JSON.parse(response.data);
                    console.warn(`API Error (type=${paramSet.type}): ${errorData.message || 'Unknown error'}`);
                    continue; // 次のtypeを試す
                }

                // PDFファイルが返された場合はスキップ
                if (response.headers['content-type']?.includes('application/pdf')) {
                    console.warn(`PDFファイルが返されました (type=${paramSet.type}): XBRLデータではありません`);
                    continue; // 次のtypeを試す
                }

                // ファイルサイズチェック
                if (response.data.length === 0) {
                    console.warn(`空のファイルが返されました (type=${paramSet.type})`);
                    continue; // 次のtypeを試す
                }

                // ファイルサイズが小さすぎる場合はエラーの可能性
                if (response.data.length < 1024) {
                    console.warn(`ファイルサイズが小さい (type=${paramSet.type}): ${response.data.length} bytes`);
                }

                // ZIPファイルの基本検証
                const zipMagic = response.data.slice(0, 4);
                const expectedMagic = Buffer.from([0x50, 0x4b, 0x03, 0x04]); // "PK\x03\x04"
                const alternativeMagic = Buffer.from([0x50, 0x4b, 0x05, 0x06]); // "PK\x05\x06"

                if (zipMagic.equals(expectedMagic) || zipMagic.equals(alternativeMagic)) {
                    console.log(`有効なZIPファイル取得成功 (type=${paramSet.type}): ${(response.data.length / 1024 / 1024).toFixed(2)}MB`);
                    return response.data;
                } else {
                    console.warn(`ZIPファイル形式ではありません (type=${paramSet.type}): Magic=${zipMagic.toString('hex')}`);
                    continue; // 次のtypeを試す
                }

            } catch (error) {
                console.warn(`書類取得エラー (type=${paramSet.type}):`, error.message);
                continue; // 次のtypeを試す
            }
        }

        // 全てのtypeで失敗した場合
        throw new Error(`XBRLデータの取得に失敗しました。全てのtype (${tryParams.map(p => p.type).join(', ')}) で有効なZIPファイルが取得できませんでした。`);
    }

    /**
     * 最適な財務報告書を検索（XBRL対応書類を優先）
     * @param {Array} reports - 財務報告書一覧
     * @param {string} edinetCode - EDINETコード
     * @returns {Object|null} 最適な報告書またはnull
     */
    findBestFinancialReport(reports, edinetCode) {
        // 指定したEDINETコードの報告書を全て取得
        const candidateReports = reports.filter(report => 
            report.edinetCode === edinetCode &&
            (report.formCode === '030000' || report.formCode === '043000') // 有価証券報告書または四半期報告書
        );

        if (candidateReports.length === 0) {
            return null;
        }

        // 優先度付きで最適な報告書を選択
        const priorities = [
            // 1. 有価証券報告書でXBRL対応が明示されている
            report => report.formCode === '030000' && report.xbrlFlag === '1',
            
            // 2. 有価証券報告書（XBRL対応不明）
            report => report.formCode === '030000',
            
            // 3. 四半期報告書でXBRL対応が明示されている
            report => report.formCode === '043000' && report.xbrlFlag === '1',
            
            // 4. 四半期報告書（XBRL対応不明）
            report => report.formCode === '043000'
        ];

        for (const priority of priorities) {
            const found = candidateReports.find(priority);
            if (found) {
                console.log(`選択された報告書: ${found.docDescription} (formCode=${found.formCode}, xbrlFlag=${found.xbrlFlag || 'unknown'})`);
                return found;
            }
        }

        // フォールバック: 最初に見つかった報告書
        return candidateReports[0];
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