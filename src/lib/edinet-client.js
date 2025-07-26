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
                
                // XBRLファイルが見つからない場合、CSVファイルを探す
                const csvEntry = this.findCSVEntry(entries);
                if (csvEntry) {
                    console.log(`CSVファイル発見: ${csvEntry.entryName}`);
                    console.log('CSVファイルから財務データを抽出します');
                    
                    // CSVファイルから財務データを抽出
                    return this.parseCSVData(zip, entries);
                }
                
                throw new Error('XBRLファイルもCSVファイルも見つかりません');
            }

            console.log(`XBRLファイル発見: ${xbrlEntry.entryName}`);

            const xbrlContent = zip.readAsText(xbrlEntry);
            
            if (!xbrlContent || xbrlContent.length === 0) {
                throw new Error('XBRLファイルの内容が空です');
            }

            // XBRLファイルサイズをチェック
            console.log(`XBRLファイルサイズ: ${xbrlContent.length}文字`);
            console.log(`XBRLファイル先頭200文字: ${xbrlContent.substring(0, 200)}`);
            
            // XML宣言の確認
            if (!xbrlContent.startsWith('<?xml')) {
                console.warn('⚠️ XML宣言が見つかりません');
            }
            
            // XBRL要素の存在確認
            if (!xbrlContent.includes('<xbrl') && !xbrlContent.includes('<jp')) {
                console.warn('⚠️ XBRL要素が見つかりません');
            }

            const parser = new XMLParser({
                ignoreAttributes: false,
                attributeNamePrefix: '@_',
                allowBooleanAttributes: true,
                parseAttributeValue: false,
                parseTrueNumberOnly: false,
                trimValues: true,
                parseTagValue: false,
                preserveOrder: false,
                alwaysCreateTextNode: false
            });

            const result = parser.parse(xbrlContent);
            console.log('XBRL解析完了');
            
            // 解析結果の検証
            const resultKeys = Object.keys(result);
            console.log(`解析結果のトップレベルキー: ${resultKeys.join(', ')}`);
            
            // XBRL要素の検索
            let xbrlElement = null;
            if (result.xbrl) {
                xbrlElement = result.xbrl;
                console.log('xbrl要素を発見');
            } else {
                // 他の可能性のあるルート要素を探す
                for (const key of resultKeys) {
                    if (key.includes('xbrl') || key.startsWith('jp')) {
                        xbrlElement = result[key];
                        console.log(`XBRL要素を発見: ${key}`);
                        break;
                    }
                }
            }
            
            if (xbrlElement) {
                const xbrlKeys = Object.keys(xbrlElement);
                console.log(`XBRL要素内のキー数: ${xbrlKeys.length}`);
                console.log(`XBRL要素内の主要キー (最初の10個): ${xbrlKeys.slice(0, 10).join(', ')}`);
                
                return { xbrl: xbrlElement };
            } else {
                console.warn('⚠️ XBRL要素が見つかりません。結果をそのまま返します。');
                return result;
            }
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
        // EDINET API v2の正しい構造に基づくXBRLファイル検索
        const searchPatterns = [
            // 最優先: XBRL/PublicDoc/内のメインインスタンス文書
            entry => entry.entryName.startsWith('XBRL/PublicDoc/') && 
                     entry.entryName.endsWith('.xbrl') && 
                     !entry.entryName.includes('_lab') && 
                     !entry.entryName.includes('_pre') &&
                     !entry.entryName.includes('_def') &&
                     !entry.entryName.includes('_cal') &&
                     entry.entryName.includes('asr-001'), // 有価証券報告書
            
            // 第2優先: XBRL/PublicDoc/内の任意のメインXBRL
            entry => entry.entryName.startsWith('XBRL/PublicDoc/') && 
                     entry.entryName.endsWith('.xbrl') && 
                     !entry.entryName.includes('_lab') && 
                     !entry.entryName.includes('_pre') &&
                     !entry.entryName.includes('_def') &&
                     !entry.entryName.includes('_cal'),
            
            // 第3優先: PublicDocフォルダ内のメインXBRL
            entry => entry.entryName.includes('PublicDoc/') && 
                     entry.entryName.endsWith('.xbrl') && 
                     !entry.entryName.includes('_lab') && 
                     !entry.entryName.includes('_pre') &&
                     !entry.entryName.includes('_def') &&
                     !entry.entryName.includes('_cal'),
            
            // 第4優先: 任意のメインXBRLファイル
            entry => entry.entryName.endsWith('.xbrl') && 
                     !entry.entryName.includes('_lab') && 
                     !entry.entryName.includes('_pre') &&
                     !entry.entryName.includes('_def') &&
                     !entry.entryName.includes('_cal'),
            
            // 最終: 任意の.xbrlファイル
            entry => entry.entryName.endsWith('.xbrl')
        ];

        for (const pattern of searchPatterns) {
            const found = entries.find(pattern);
            if (found) {
                console.log(`XBRLファイル発見: ${found.entryName} (${found.header.size} bytes)`);
                return found;
            }
        }

        return null;
    }

    /**
     * 財務データを抽出
     * @param {Object} xbrlData - 解析されたXBRLデータ（またはCSVデータ）
     * @param {string} contextRef - コンテキスト参照
     * @returns {Object} 抽出された財務データ
     */
    extractFinancialData(xbrlData, contextRef = 'CurrentYearInstant') {
        try {
            // CSVデータの場合
            if (xbrlData.csvData) {
                console.log('CSVデータを財務データ形式に変換中...');
                return xbrlData.financialData;
            }

            // XBRLデータ構造のデバッグ
            console.log('XBRLデータ構造の分析開始...');
            const xbrl = xbrlData.xbrl || xbrlData;
            
            // すべての要素名を取得してログ出力（デバッグ用）
            const allKeys = Object.keys(xbrl);
            console.log(`XBRLデータに含まれる要素数: ${allKeys.length}`);
            
            // 財務データ関連の要素を探す
            const financialKeys = allKeys.filter(key => 
                key.includes('Assets') || 
                key.includes('Liabilities') || 
                key.includes('NetAssets') || 
                key.includes('Sales') || 
                key.includes('Income') ||
                key.includes('資産') ||
                key.includes('負債') ||
                key.includes('純資産') ||
                key.includes('売上')
            );
            console.log(`財務関連要素数: ${financialKeys.length}`);
            if (financialKeys.length > 0) {
                console.log('財務関連要素サンプル:', financialKeys.slice(0, 10));
            }

            // コンテキスト情報を動的に取得
            const contexts = this.extractContexts(xbrlData);
            const instantContext = this.findInstantContext(contexts);
            const durationContext = this.findDurationContext(contexts);
            
            console.log(`使用コンテキスト: Instant=${instantContext}, Duration=${durationContext}`);

            // 複数の要素名パターンを試行する関数
            const findValueWithFallback = (elementPatterns, context) => {
                for (const pattern of elementPatterns) {
                    const value = this.findValue(xbrlData, pattern, context);
                    if (value !== null) {
                        console.log(`✅ 値を発見: ${pattern} = ${value}`);
                        return value;
                    }
                }
                return null;
            };

            // 貸借対照表項目（複数パターン対応）
            console.log('貸借対照表データの抽出開始...');
            const balanceSheet = {
                // 資産の部
                currentAssets: findValueWithFallback([
                    'jppfs_cor:CurrentAssets',
                    'jpcrp_cor:CurrentAssets',
                    'jpcrp030000-asr:CurrentAssets',
                    'jpcrp-cor:CurrentAssets',
                    'CurrentAssets'
                ], instantContext),
                
                nonCurrentAssets: findValueWithFallback([
                    'jppfs_cor:NoncurrentAssets',
                    'jpcrp_cor:NoncurrentAssets',
                    'jpcrp030000-asr:NoncurrentAssets',
                    'jpcrp-cor:NoncurrentAssets',
                    'NoncurrentAssets'
                ], instantContext),
                
                totalAssets: findValueWithFallback([
                    'jppfs_cor:Assets',
                    'jpcrp_cor:Assets',
                    'jpcrp030000-asr:Assets',
                    'jpcrp-cor:Assets',
                    'Assets'
                ], instantContext),
                
                // 負債の部
                currentLiabilities: findValueWithFallback([
                    'jppfs_cor:CurrentLiabilities',
                    'jpcrp_cor:CurrentLiabilities',
                    'jpcrp030000-asr:CurrentLiabilities',
                    'jpcrp-cor:CurrentLiabilities',
                    'CurrentLiabilities'
                ], instantContext),
                
                nonCurrentLiabilities: findValueWithFallback([
                    'jppfs_cor:NoncurrentLiabilities',
                    'jpcrp_cor:NoncurrentLiabilities',
                    'jpcrp030000-asr:NoncurrentLiabilities',
                    'jpcrp-cor:NoncurrentLiabilities',
                    'NoncurrentLiabilities'
                ], instantContext),
                
                totalLiabilities: findValueWithFallback([
                    'jppfs_cor:Liabilities',
                    'jpcrp_cor:Liabilities',
                    'jpcrp030000-asr:Liabilities',
                    'jpcrp-cor:Liabilities',
                    'Liabilities'
                ], instantContext),
                
                // 純資産の部
                netAssets: findValueWithFallback([
                    'jppfs_cor:NetAssets',
                    'jpcrp_cor:NetAssets',
                    'jpcrp030000-asr:NetAssets',
                    'jpcrp-cor:NetAssets',
                    'NetAssets'
                ], instantContext),
                
                // 主要な資産項目
                cashAndDeposits: findValueWithFallback([
                    'jppfs_cor:CashAndDeposits',
                    'jpcrp_cor:CashAndDeposits',
                    'jpcrp030000-asr:CashAndDeposits',
                    'jpcrp-cor:CashAndDeposits',
                    'CashAndDeposits'
                ], instantContext),
                
                tradeAccounts: findValueWithFallback([
                    'jppfs_cor:NotesAndAccountsReceivableTrade',
                    'jpcrp_cor:NotesAndAccountsReceivableTrade',
                    'jpcrp030000-asr:NotesAndAccountsReceivableTrade',
                    'jpcrp-cor:TradeAndOtherReceivables',
                    'NotesAndAccountsReceivableTrade'
                ], instantContext),
                
                inventory: findValueWithFallback([
                    'jppfs_cor:Inventories',
                    'jpcrp_cor:Inventories',
                    'jpcrp030000-asr:Inventories',
                    'jpcrp-cor:Inventories',
                    'Inventories'
                ], instantContext),
                
                propertyPlantEquipment: findValueWithFallback([
                    'jppfs_cor:PropertyPlantAndEquipment',
                    'jpcrp_cor:PropertyPlantAndEquipment',
                    'jpcrp030000-asr:PropertyPlantAndEquipment',
                    'jpcrp-cor:PropertyPlantAndEquipment',
                    'PropertyPlantAndEquipment'
                ], instantContext)
            };

            // 損益計算書項目
            console.log('損益計算書データの抽出開始...');
            const profitLoss = {
                netSales: findValueWithFallback([
                    'jppfs_cor:NetSales',
                    'jpcrp_cor:NetSales',
                    'jpcrp030000-asr:NetSales',
                    'jpcrp-cor:RevenueIFRS',
                    'NetSales'
                ], durationContext),
                costOfSales: findValueWithFallback([
                    'jppfs_cor:CostOfSales',
                    'jpcrp_cor:CostOfSales',
                    'jpcrp030000-asr:CostOfSales',
                    'CostOfSales'
                ], durationContext),
                
                grossProfit: findValueWithFallback([
                    'jppfs_cor:GrossProfit',
                    'jpcrp_cor:GrossProfit',
                    'jpcrp030000-asr:GrossProfit',
                    'GrossProfit'
                ], durationContext),
                
                operatingIncome: findValueWithFallback([
                    'jppfs_cor:OperatingIncome',
                    'jpcrp_cor:OperatingIncome',
                    'jpcrp030000-asr:OperatingIncome',
                    'jpcrp-cor:ProfitLossFromOperatingActivities',
                    'OperatingIncome'
                ], durationContext),
                
                ordinaryIncome: findValueWithFallback([
                    'jppfs_cor:OrdinaryIncome',
                    'jpcrp_cor:ProfitLossBeforeTax',
                    'jpcrp030000-asr:OrdinaryIncome',
                    'OrdinaryIncome'
                ], durationContext),
                
                netIncome: findValueWithFallback([
                    'jppfs_cor:ProfitLoss',
                    'jpcrp_cor:ProfitLoss',
                    'jpcrp030000-asr:ProfitLoss',
                    'jpcrp-cor:NetIncome',
                    'NetIncome'
                ], durationContext),
                
                // 費用項目
                sellingGeneralAdminExpenses: findValueWithFallback([
                    'jppfs_cor:SellingGeneralAndAdministrativeExpenses',
                    'jpcrp_cor:SellingGeneralAndAdministrativeExpenses',
                    'jpcrp030000-asr:SellingGeneralAndAdministrativeExpenses'
                ], durationContext),
                
                nonOperatingIncome: findValueWithFallback([
                    'jppfs_cor:NonOperatingIncome',
                    'jpcrp_cor:NonOperatingIncome',
                    'jpcrp030000-asr:NonOperatingIncome'
                ], durationContext),
                
                nonOperatingExpenses: findValueWithFallback([
                    'jppfs_cor:NonOperatingExpenses',
                    'jpcrp_cor:NonOperatingExpenses',
                    'jpcrp030000-asr:NonOperatingExpenses'
                ], durationContext)
            };

            // キャッシュフロー項目（可能な場合）
            console.log('キャッシュフローデータの抽出開始...');
            const cashFlow = {
                operatingCashFlow: findValueWithFallback([
                    'jppfs_cor:NetCashProvidedByUsedInOperatingActivities',
                    'jpcrp_cor:CashFlowsFromUsedInOperatingActivities',
                    'jpcrp030000-asr:NetCashProvidedByUsedInOperatingActivities'
                ], durationContext),
                
                investingCashFlow: findValueWithFallback([
                    'jppfs_cor:NetCashProvidedByUsedInInvestmentActivities',
                    'jpcrp_cor:CashFlowsFromUsedInInvestmentActivities',
                    'jpcrp030000-asr:NetCashProvidedByUsedInInvestmentActivities'
                ], durationContext),
                
                financingCashFlow: findValueWithFallback([
                    'jppfs_cor:NetCashProvidedByUsedInFinancingActivities',
                    'jpcrp_cor:CashFlowsFromUsedInFinancingActivities',
                    'jpcrp030000-asr:NetCashProvidedByUsedInFinancingActivities'
                ], durationContext)
            };

            // 取得できたデータの概要をログ出力
            const summary = this.summarizeExtractedData(balanceSheet, profitLoss, cashFlow);
            console.log('財務データ抽出概要:', summary);

            // データが全く取得できていない場合の詳細デバッグ
            if (summary.extractedFields === 0) {
                console.warn('⚠️ 財務データが1つも抽出できませんでした');
                this.debugXBRLStructure(xbrlData);
            }

            return {
                balanceSheet,
                profitLoss,
                cashFlow,
                metadata: {
                    instantContext,
                    durationContext,
                    extractedFields: summary.extractedFields,
                    totalFields: summary.totalFields
                }
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
            
            // 直接的な要素名検索
            let element = xbrl[elementName];
            
            // 名前空間なしでも検索を試みる
            if (!element) {
                const simpleElementName = elementName.split(':').pop();
                const possibleKeys = Object.keys(xbrl).filter(key => 
                    key.endsWith(':' + simpleElementName) || key === simpleElementName
                );
                if (possibleKeys.length > 0) {
                    element = xbrl[possibleKeys[0]];
                    if (element) {
                        console.log(`要素発見（代替キー）: ${possibleKeys[0]} for ${elementName}`);
                    }
                }
            }
            
            if (!element) {
                return null;
            }
            
            // 配列の場合
            if (Array.isArray(element)) {
                // 完全一致を優先
                let found = element.find(item => item['@_contextRef'] === contextRef);
                
                // 部分一致も試す
                if (!found && contextRef) {
                    found = element.find(item => {
                        const itemContext = item['@_contextRef'];
                        return itemContext && (
                            itemContext.includes('CurrentYear') ||
                            itemContext.includes('Current') ||
                            itemContext.includes(contextRef)
                        );
                    });
                }
                
                // それでも見つからない場合、最初の要素を返す
                if (!found && element.length > 0) {
                    found = element[0];
                    console.log(`フォールバック: ${elementName}の最初の要素を使用`);
                }
                
                if (found) {
                    const value = this.parseNumber(found['#text'] || found);
                    if (value !== null) {
                        console.log(`値取得成功: ${elementName} = ${value} (context: ${found['@_contextRef']})`);
                    }
                    return value;
                }
            } 
            // オブジェクトの場合
            else if (typeof element === 'object') {
                // コンテキスト一致確認
                if (element['@_contextRef']) {
                    const value = this.parseNumber(element['#text'] || element);
                    if (value !== null) {
                        console.log(`値取得成功: ${elementName} = ${value} (context: ${element['@_contextRef']})`);
                    }
                    return value;
                }
            }
            // 単純な値の場合
            else {
                const value = this.parseNumber(element);
                if (value !== null) {
                    console.log(`値取得成功: ${elementName} = ${value} (単純値)`);
                }
                return value;
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
        const maxSearches = 25; // 検索回数を増加（より幅広い検索）
        
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
                console.log(`${date}: ${reports.length}件の財務報告書をチェック`);
                
                // 指定したEDINETコードの報告書を探す（XBRL対応書類を優先）
                const edinetReports = reports.filter(r => r.edinetCode === edinetCode);
                if (edinetReports.length > 0) {
                    console.log(`${date}: ${edinetReports.length}件の対象企業報告書を発見`);
                    edinetReports.forEach(r => {
                        console.log(`  - ${r.docDescription} (form: ${r.formCode}, xbrl: ${r.xbrlFlag || 'unknown'})`);
                    });
                }
                
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
        
        // 詳細なエラー情報を提供
        const errorDetails = {
            year: year,
            edinetCode: edinetCode,
            searchCount: searchCount,
            maxSearches: 40, // 標準 + 拡張検索の合計
            searchedDates: searchDates.slice(0, Math.min(searchCount, searchDates.length)),
            suggestion: `${year}年度（${year}年4月〜${year + 1}年3月）の有価証券報告書は通常${year + 1}年6月頃に提出されます。`
        };
        
        console.error('財務データ検索詳細:', errorDetails);
        throw new Error(`${year}年度の財務データが見つかりませんでした（検索期間: ${searchCount}日分）。${errorDetails.suggestion}`);
    }

    /**
     * 現実的な検索日付を生成（年度指定）
     * @param {number} year - 対象年度
     * @returns {Array<string>} 検索日付配列
     */
    generateRealisticSearchDates(year) {
        const dates = [];
        const nextYear = year + 1;
        const currentDate = new Date();
        
        // 有価証券報告書の一般的な提出時期（拡張版）
        const reportingPeriods = [
            // 最優先：6月提出（年度終了3ヶ月後）
            { year: nextYear, months: [6], days: [30, 29, 28, 27, 26, 25] },
            
            // 高優先：5月、7月提出
            { year: nextYear, months: [5, 7], days: [31, 30, 29, 28] },
            
            // 中優先：4月、8月、9月提出
            { year: nextYear, months: [4, 8, 9], days: [30, 29, 28] },
            
            // 低優先：その他の時期
            { year: year, months: [12, 9, 6, 3], days: [31, 30, 29] },
            { year: nextYear, months: [3, 10, 11, 12], days: [31, 30, 29] }
        ];
        
        // 日付を生成
        for (const period of reportingPeriods) {
            for (const month of period.months) {
                for (const day of period.days) {
                    // 月の最大日数を考慮
                    const maxDay = new Date(period.year, month, 0).getDate();
                    if (day <= maxDay) {
                        const dateStr = `${period.year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
                        const date = new Date(dateStr);
                        
                        if (date <= currentDate && !dates.includes(dateStr)) {
                            dates.push(dateStr);
                        }
                    }
                }
            }
        }
        
        // 日付を新しい順にソート（最近の提出分を優先）
        return dates.sort((a, b) => new Date(b) - new Date(a));
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
        
        // 複数のtypeパラメータを試行（正しい優先順位）
        const tryParams = [
            { type: 1, description: 'XBRL ZIP (primary)' },
            { type: 5, description: 'XBRL to CSV (alternative)' },
            { type: 2, description: 'PDF (fallback)' }
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

    /**
     * CSVファイルエントリを探す
     * @param {Array} entries - ZIPエントリ一覧
     * @returns {Object|null} CSVファイルエントリまたはnull
     */
    findCSVEntry(entries) {
        // 財務データのCSVファイルを探す（優先度順）
        const searchPatterns = [
            // 最優先: 有価証券報告書のCSVファイル
            entry => entry.entryName.includes('jpcrp030000-asr-001') && entry.entryName.endsWith('.csv'),
            
            // 第2優先: 貸借対照表のCSVファイル
            entry => entry.entryName.includes('jpaud-aai-cc-001') && entry.entryName.endsWith('.csv'),
            
            // 第3優先: 損益計算書のCSVファイル
            entry => entry.entryName.includes('jpaud-aar-cn-001') && entry.entryName.endsWith('.csv'),
            
            // 第4優先: 任意のCSVファイル
            entry => entry.entryName.endsWith('.csv')
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
     * CSVデータから財務データを抽出
     * @param {AdmZip} zip - ZIPファイル
     * @param {Array} entries - ZIPエントリ一覧
     * @returns {Object} 財務データ（XBRL形式に変換）
     */
    parseCSVData(zip, entries) {
        try {
            console.log('CSVデータから財務データを抽出中...');

            // 財務データを格納するオブジェクト
            const financialData = {
                balanceSheet: {},
                profitLoss: {},
                cashFlow: {}
            };

            // 各CSVファイルを処理
            entries.forEach(entry => {
                if (entry.entryName.endsWith('.csv')) {
                    console.log(`CSV処理中: ${entry.entryName}`);
                    
                    const csvContent = zip.readAsText(entry);
                    const csvData = this.parseCSVContent(csvContent);
                    
                    // ファイル名から種別を判定して適切なデータを抽出
                    if (entry.entryName.includes('jpcrp030000-asr-001')) {
                        // 有価証券報告書 - 主要な財務データ
                        this.extractMainFinancialData(csvData, financialData);
                    } else if (entry.entryName.includes('jpaud-aai-cc-001')) {
                        // 貸借対照表データ
                        this.extractBalanceSheetData(csvData, financialData);
                    } else if (entry.entryName.includes('jpaud-aar-cn-001')) {
                        // 損益計算書データ  
                        this.extractProfitLossData(csvData, financialData);
                    }
                }
            });

            console.log('CSV財務データ抽出完了');
            
            // XBRL形式に変換して返す
            return {
                csvData: true, // CSVデータであることを示すフラグ
                financialData: financialData
            };

        } catch (error) {
            throw new Error(`CSV解析エラー: ${error.message}`);
        }
    }

    /**
     * CSV文字列を解析してオブジェクトに変換
     * @param {string} csvContent - CSV文字列
     * @returns {Array} 解析されたCSVデータ
     */
    parseCSVContent(csvContent) {
        const lines = csvContent.split('\n');
        const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
        
        const data = [];
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (line) {
                const values = line.split(',').map(v => v.trim().replace(/"/g, ''));
                const row = {};
                headers.forEach((header, index) => {
                    row[header] = values[index] || '';
                });
                data.push(row);
            }
        }
        
        return data;
    }

    /**
     * 主要財務データを抽出（有価証券報告書CSVから）
     * @param {Array} csvData - CSVデータ
     * @param {Object} financialData - 財務データオブジェクト
     */
    extractMainFinancialData(csvData, financialData) {
        // 重要な財務指標を抽出
        const keyItems = {
            // 貸借対照表
            '流動資産': 'currentAssets',
            '固定資産': 'nonCurrentAssets', 
            '資産合計': 'totalAssets',
            '流動負債': 'currentLiabilities',
            '固定負債': 'nonCurrentLiabilities',
            '負債合計': 'totalLiabilities',
            '純資産合計': 'netAssets',
            '現金及び預金': 'cashAndDeposits',
            
            // 損益計算書
            '売上高': 'netSales',
            '売上原価': 'costOfSales',
            '売上総利益': 'grossProfit',
            '営業利益': 'operatingIncome',
            '経常利益': 'ordinaryIncome',
            '当期純利益': 'netIncome'
        };

        csvData.forEach(row => {
            const itemName = row['項目名'] || row['element_name'] || row['name'];
            const value = row['金額'] || row['value'] || row['amount'];
            
            if (itemName && value) {
                const mappedKey = keyItems[itemName];
                if (mappedKey) {
                    const numValue = this.parseNumber(value);
                    if (numValue !== null) {
                        // 貸借対照表項目か損益計算書項目かを判定
                        if (['currentAssets', 'nonCurrentAssets', 'totalAssets', 'currentLiabilities', 
                             'nonCurrentLiabilities', 'totalLiabilities', 'netAssets', 'cashAndDeposits'].includes(mappedKey)) {
                            financialData.balanceSheet[mappedKey] = numValue;
                        } else {
                            financialData.profitLoss[mappedKey] = numValue;
                        }
                    }
                }
            }
        });
    }

    /**
     * 貸借対照表データを抽出
     * @param {Array} csvData - CSVデータ
     * @param {Object} financialData - 財務データオブジェクト
     */
    extractBalanceSheetData(csvData, financialData) {
        // 貸借対照表の詳細データを抽出
        csvData.forEach(row => {
            const itemName = row['項目名'] || row['element_name'] || row['name'];
            const value = row['金額'] || row['value'] || row['amount'];
            
            if (itemName && value) {
                const numValue = this.parseNumber(value);
                if (numValue !== null) {
                    // 項目名を英語キーにマッピング（簡略化）
                    const key = itemName.replace(/[^a-zA-Z0-9]/g, '');
                    financialData.balanceSheet[key] = numValue;
                }
            }
        });
    }

    /**
     * 損益計算書データを抽出
     * @param {Array} csvData - CSVデータ
     * @param {Object} financialData - 財務データオブジェクト
     */
    extractProfitLossData(csvData, financialData) {
        // 損益計算書の詳細データを抽出
        csvData.forEach(row => {
            const itemName = row['項目名'] || row['element_name'] || row['name'];
            const value = row['金額'] || row['value'] || row['amount'];
            
            if (itemName && value) {
                const numValue = this.parseNumber(value);
                if (numValue !== null) {
                    // 項目名を英語キーにマッピング（簡略化）
                    const key = itemName.replace(/[^a-zA-Z0-9]/g, '');
                    financialData.profitLoss[key] = numValue;
                }
            }
        });
    }

    /**
     * XBRLデータからコンテキスト情報を抽出
     * @param {Object} xbrlData - XBRLデータ
     * @returns {Array} コンテキスト配列
     */
    extractContexts(xbrlData) {
        try {
            const xbrl = xbrlData.xbrl || xbrlData;
            const contexts = xbrl['xbrli:context'] || xbrl.context;
            
            if (!contexts) return [];
            
            return Array.isArray(contexts) ? contexts : [contexts];
        } catch (error) {
            console.warn('コンテキスト抽出エラー:', error.message);
            return [];
        }
    }

    /**
     * 期間時点（Instant）コンテキストを見つける
     * @param {Array} contexts - コンテキスト配列
     * @returns {string|null} コンテキストID
     */
    findInstantContext(contexts) {
        for (const context of contexts) {
            const period = context['xbrli:period'] || context.period;
            if (period && (period['xbrli:instant'] || period.instant)) {
                return context['@_id'] || context.id;
            }
        }
        return 'CurrentYearInstant'; // デフォルト
    }

    /**
     * 期間（Duration）コンテキストを見つける
     * @param {Array} contexts - コンテキスト配列  
     * @returns {string|null} コンテキストID
     */
    findDurationContext(contexts) {
        for (const context of contexts) {
            const period = context['xbrli:period'] || context.period;
            if (period && ((period['xbrli:startDate'] && period['xbrli:endDate']) || 
                          (period.startDate && period.endDate))) {
                return context['@_id'] || context.id;
            }
        }
        return 'CurrentYearDuration'; // デフォルト
    }

    /**
     * 抽出された財務データの概要を作成
     * @param {Object} balanceSheet - 貸借対照表データ
     * @param {Object} profitLoss - 損益計算書データ
     * @param {Object} cashFlow - キャッシュフローデータ
     * @returns {Object} 概要情報
     */
    summarizeExtractedData(balanceSheet, profitLoss, cashFlow) {
        const countNonNull = (obj) => Object.values(obj).filter(v => v !== null).length;
        const countTotal = (obj) => Object.keys(obj).length;
        
        const bsExtracted = countNonNull(balanceSheet);
        const plExtracted = countNonNull(profitLoss);
        const cfExtracted = countNonNull(cashFlow);
        
        const bsTotal = countTotal(balanceSheet);
        const plTotal = countTotal(profitLoss);
        const cfTotal = countTotal(cashFlow);
        
        return {
            extractedFields: bsExtracted + plExtracted + cfExtracted,
            totalFields: bsTotal + plTotal + cfTotal,
            balanceSheetRatio: `${bsExtracted}/${bsTotal}`,
            profitLossRatio: `${plExtracted}/${plTotal}`,
            cashFlowRatio: `${cfExtracted}/${cfTotal}`
        };
    }

    /**
     * XBRLデータ構造をデバッグ出力
     * @param {Object} xbrlData - XBRLデータ
     */
    debugXBRLStructure(xbrlData) {
        console.log('=== XBRL構造デバッグ開始 ===');
        const xbrl = xbrlData.xbrl || xbrlData;
        
        // 名前空間の確認
        const namespaces = Object.keys(xbrl).filter(key => key.startsWith('@_xmlns'));
        console.log('名前空間:', namespaces);
        
        // 財務項目の要素名パターンを分析
        const patterns = {
            'Assets系': [],
            'Liabilities系': [],
            'Sales/Revenue系': [],
            'Income系': [],
            '日本語要素': []
        };
        
        Object.keys(xbrl).forEach(key => {
            if (key.toLowerCase().includes('asset')) patterns['Assets系'].push(key);
            if (key.toLowerCase().includes('liabilit')) patterns['Liabilities系'].push(key);
            if (key.toLowerCase().includes('sale') || key.toLowerCase().includes('revenue')) patterns['Sales/Revenue系'].push(key);
            if (key.toLowerCase().includes('income')) patterns['Income系'].push(key);
            if (/[\u3040-\u309f\u30a0-\u30ff\u4e00-\u9faf]/.test(key)) patterns['日本語要素'].push(key);
        });
        
        Object.entries(patterns).forEach(([category, items]) => {
            if (items.length > 0) {
                console.log(`\n${category}: ${items.length}件`);
                console.log(items.slice(0, 5).join(', ') + (items.length > 5 ? '...' : ''));
            }
        });
        
        // コンテキスト参照を持つ要素をサンプル表示
        const elementsWithContext = Object.entries(xbrl).filter(([key, value]) => {
            return value && typeof value === 'object' && 
                   (value['@_contextRef'] || (Array.isArray(value) && value[0] && value[0]['@_contextRef']));
        });
        
        console.log(`\nコンテキスト参照を持つ要素数: ${elementsWithContext.length}`);
        if (elementsWithContext.length > 0) {
            console.log('サンプル要素:');
            elementsWithContext.slice(0, 3).forEach(([key, value]) => {
                const sampleValue = Array.isArray(value) ? value[0] : value;
                console.log(`  ${key}: contextRef=${sampleValue['@_contextRef']}, value=${sampleValue['#text'] || sampleValue}`);
            });
        }
        
        console.log('=== XBRL構造デバッグ終了 ===');
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