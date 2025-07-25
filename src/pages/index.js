/**
 * メインページ - 企業検索と財務データ表示
 */

import { useState } from 'react';
import Head from 'next/head';
import CompanySearchForm from '../components/CompanySearchForm';
import FinancialDataTable from '../components/FinancialDataTable';
import FinancialChart from '../components/FinancialChart';
import LoadingSpinner from '../components/LoadingSpinner';

export default function Home() {
    const [companies, setCompanies] = useState(null);
    const [selectedCompany, setSelectedCompany] = useState(null);
    const [selectedYear, setSelectedYear] = useState(null);
    const [availableYears, setAvailableYears] = useState([]);
    const [financialData, setFinancialData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [loadingFinancial, setLoadingFinancial] = useState(false);
    const [loadingConnection, setLoadingConnection] = useState(false);
    const [loadingEnvCheck, setLoadingEnvCheck] = useState(false);
    const [loadingSearchDebug, setLoadingSearchDebug] = useState(false);
    const [error, setError] = useState(null);
    const [connectionStatus, setConnectionStatus] = useState(null);
    const [envStatus, setEnvStatus] = useState(null);
    const [searchDebugStatus, setSearchDebugStatus] = useState(null);

    const handleSearch = async (companyName) => {
        setLoading(true);
        setError(null);
        resetStates();

        try {
            const response = await fetch('/api/search-company', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ companyName }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'エラーが発生しました');
            }

            const data = await response.json();
            setCompanies(data.companies);
            
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const resetStates = () => {
        setCompanies(null);
        setSelectedCompany(null);
        setSelectedYear(null);
        setAvailableYears([]);
        setFinancialData(null);
    };

    const handleCompanySelect = (company) => {
        setSelectedCompany(company);
        setSelectedYear(null);
        setFinancialData(null);
        
        // 利用可能な年度を生成
        const currentYear = new Date().getFullYear();
        const years = Array.from({length: 10}, (_, i) => currentYear - 1 - i); // 過去10年
        setAvailableYears(years);
        
        console.log(`企業選択: ${company.filerName} (${company.edinetCode})`);
    };

    const handleYearSelect = async (year) => {
        if (!selectedCompany) return;
        
        setSelectedYear(year);
        setLoadingFinancial(true);
        setError(null);
        setFinancialData(null);

        try {
            console.log(`年度選択: ${year}年度の財務データを取得中...`);
            
            const response = await fetch('/api/get-yearly-data', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ 
                    edinetCode: selectedCompany.edinetCode,
                    year: year,
                    companyName: selectedCompany.filerName
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `${year}年度の財務データ取得に失敗しました`);
            }

            const data = await response.json();
            setFinancialData(data);
            console.log(`${year}年度の財務データ取得完了`);
        } catch (err) {
            setError(`${year}年度: ${err.message}`);
        } finally {
            setLoadingFinancial(false);
        }
    };

    const handleConnectionTest = async () => {
        setLoadingConnection(true);
        setConnectionStatus(null);
        setError(null);

        try {
            const response = await fetch('/api/test-edinet-connection', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
            });

            const data = await response.json();

            if (response.ok) {
                setConnectionStatus({
                    success: true,
                    message: data.message,
                    details: data.details,
                    statusCode: data.statusCode
                });
            } else {
                setConnectionStatus({
                    success: false,
                    error: data.error,
                    details: data.details,
                    statusCode: data.statusCode,
                    errorCode: data.errorCode,
                    suggestion: data.suggestion
                });
            }
        } catch (err) {
            setConnectionStatus({
                success: false,
                error: 'ネットワークエラー',
                details: err.message,
                statusCode: 0,
                suggestion: 'インターネット接続を確認してください。'
            });
        } finally {
            setLoadingConnection(false);
        }
    };

    const handleEnvCheck = async () => {
        setLoadingEnvCheck(true);
        setEnvStatus(null);
        setError(null);

        try {
            const response = await fetch('/api/debug-env', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
            });

            const data = await response.json();

            if (response.ok) {
                setEnvStatus({
                    success: true,
                    data: data
                });
            } else {
                setEnvStatus({
                    success: false,
                    error: data.error,
                    details: data.details
                });
            }
        } catch (err) {
            setEnvStatus({
                success: false,
                error: 'ネットワークエラー',
                details: err.message
            });
        } finally {
            setLoadingEnvCheck(false);
        }
    };

    const handleSearchDebug = async () => {
        setLoadingSearchDebug(true);
        setSearchDebugStatus(null);
        setError(null);

        try {
            const response = await fetch('/api/debug-company-search', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ 
                    companyName: 'トヨタ',  // デバッグ用固定値
                    testDate: '2025-07-08' // 接続テストで成功した日付を使用
                }),
            });

            const data = await response.json();

            if (response.ok) {
                setSearchDebugStatus({
                    success: true,
                    data: data
                });
            } else {
                setSearchDebugStatus({
                    success: false,
                    error: data.error,
                    details: data.details
                });
            }
        } catch (err) {
            setSearchDebugStatus({
                success: false,
                error: 'ネットワークエラー',
                details: err.message
            });
        } finally {
            setLoadingSearchDebug(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50">
            <Head>
                <title>財務分析アプリケーション</title>
                <meta name="description" content="企業の財務データを分析するアプリケーション" />
                <link rel="icon" href="/favicon.ico" />
            </Head>

            <header className="bg-white shadow-sm">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
                    <h1 className="text-3xl font-bold text-gray-900">
                        財務分析アプリケーション
                    </h1>
                    <p className="mt-2 text-gray-600">
                        企業名を入力して、直近5年分の貸借対照表（BS）と損益計算書（PL）を表示します
                    </p>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* 検索フォーム */}
                <div className="bg-white rounded-lg shadow p-6 mb-8">
                    <CompanySearchForm onSearch={handleSearch} loading={loading} />
                    
                    {/* EDINET API疎通確認ボタン */}
                    <div className="mt-4 pt-4 border-t border-gray-200">
                        <div className="space-y-3">
                            {/* 環境変数確認 */}
                            <div className="flex items-center justify-between">
                                <div>
                                    <h3 className="text-sm font-medium text-gray-900">環境変数確認</h3>
                                    <p className="text-xs text-gray-500 mt-1">EDINET_API_KEYの読み込み状況を確認</p>
                                </div>
                                <button
                                    onClick={handleEnvCheck}
                                    disabled={loadingEnvCheck}
                                    className="flex items-center px-4 py-2 text-sm font-medium text-white bg-purple-600 border border-transparent rounded-md hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {loadingEnvCheck ? (
                                        <>
                                            <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                            </svg>
                                            確認中...
                                        </>
                                    ) : (
                                        <>
                                            <svg className="mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                            </svg>
                                            環境変数確認
                                        </>
                                    )}
                                </button>
                            </div>
                            
                            {/* API接続テスト */}
                            <div className="flex items-center justify-between">
                                <div>
                                    <h3 className="text-sm font-medium text-gray-900">API接続テスト</h3>
                                    <p className="text-xs text-gray-500 mt-1">EDINET APIとの疎通確認を行います</p>
                                </div>
                                <button
                                    onClick={handleConnectionTest}
                                    disabled={loadingConnection}
                                    className="flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {loadingConnection ? (
                                        <>
                                            <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                            </svg>
                                            テスト中...
                                        </>
                                    ) : (
                                        <>
                                            <svg className="mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                            </svg>
                                            接続テスト
                                        </>
                                    )}
                                </button>
                            </div>
                            
                            {/* 企業検索デバッグ */}
                            <div className="flex items-center justify-between">
                                <div>
                                    <h3 className="text-sm font-medium text-gray-900">検索デバッグ</h3>
                                    <p className="text-xs text-gray-500 mt-1">「トヨタ」の検索プロセスを詳細分析</p>
                                </div>
                                <button
                                    onClick={handleSearchDebug}
                                    disabled={loadingSearchDebug}
                                    className="flex items-center px-4 py-2 text-sm font-medium text-white bg-green-600 border border-transparent rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {loadingSearchDebug ? (
                                        <>
                                            <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                            </svg>
                                            デバッグ中...
                                        </>
                                    ) : (
                                        <>
                                            <svg className="mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                                            </svg>
                                            検索デバッグ
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 環境変数確認結果 */}
                {envStatus && (
                    <div className={`rounded-lg p-4 mb-8 ${
                        envStatus.success 
                            ? 'bg-blue-50 border border-blue-200' 
                            : 'bg-red-50 border border-red-200'
                    }`}>
                        <div className="flex">
                            <div className="flex-shrink-0">
                                {envStatus.success ? (
                                    <svg className="h-5 w-5 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                                    </svg>
                                ) : (
                                    <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                                    </svg>
                                )}
                            </div>
                            <div className="ml-3 flex-1">
                                <h3 className={`text-sm font-medium ${
                                    envStatus.success ? 'text-blue-800' : 'text-red-800'
                                }`}>
                                    環境変数確認結果
                                </h3>
                                {envStatus.success && envStatus.data && (
                                    <div className="mt-2 text-xs text-blue-700">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                            <div>
                                                <p><span className="font-semibold">APIキー存在:</span> {envStatus.data.apiKey.exists ? '✅ はい' : '❌ いいえ'}</p>
                                                <p><span className="font-semibold">キー長:</span> {envStatus.data.apiKey.length}文字</p>
                                                <p><span className="font-semibold">プレビュー:</span> {envStatus.data.apiKey.preview || 'なし'}</p>
                                                <p><span className="font-semibold">空白文字:</span> {envStatus.data.apiKey.hasWhitespace ? '⚠️ あり' : '✅ なし'}</p>
                                            </div>
                                            <div>
                                                <p><span className="font-semibold">環境:</span> {envStatus.data.environment.nodeEnv}</p>
                                                <p><span className="font-semibold">Vercel:</span> {envStatus.data.environment.isVercel ? '✅ はい' : '❌ いいえ'}</p>
                                                <p><span className="font-semibold">本番:</span> {envStatus.data.environment.isProduction ? '✅ はい' : '❌ いいえ'}</p>
                                                <p><span className="font-semibold">タイムスタンプ:</span> {new Date(envStatus.data.timestamp).toLocaleString('ja-JP')}</p>
                                            </div>
                                        </div>
                                        {envStatus.data.apiKey.hasWhitespace && (
                                            <div className="mt-2 p-2 bg-yellow-100 border border-yellow-300 rounded text-yellow-800">
                                                ⚠️ APIキーに空白文字が含まれています。先頭や末尾のスペースを削除してください。
                                            </div>
                                        )}
                                        {!envStatus.data.apiKey.exists && (
                                            <div className="mt-2 p-2 bg-red-100 border border-red-300 rounded text-red-800">
                                                ❌ EDINET_API_KEYが設定されていません。Vercelの環境変数を確認してください。
                                            </div>
                                        )}
                                    </div>
                                )}
                                {!envStatus.success && (
                                    <div className="mt-1 text-sm text-red-700">
                                        <p>{envStatus.error}</p>
                                        {envStatus.details && (
                                            <p className="text-xs mt-1">詳細: {
                                                typeof envStatus.details === 'string' 
                                                    ? envStatus.details 
                                                    : JSON.stringify(envStatus.details)
                                            }</p>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* 検索デバッグ結果 */}
                {searchDebugStatus && (
                    <div className={`rounded-lg p-4 mb-8 ${
                        searchDebugStatus.success 
                            ? 'bg-green-50 border border-green-200' 
                            : 'bg-red-50 border border-red-200'
                    }`}>
                        <div className="flex">
                            <div className="flex-shrink-0">
                                {searchDebugStatus.success ? (
                                    <svg className="h-5 w-5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                                    </svg>
                                ) : (
                                    <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                                    </svg>
                                )}
                            </div>
                            <div className="ml-3 flex-1">
                                <h3 className={`text-sm font-medium ${
                                    searchDebugStatus.success ? 'text-green-800' : 'text-red-800'
                                }`}>
                                    検索デバッグ結果
                                </h3>
                                {searchDebugStatus.success && searchDebugStatus.data?.analysis && (
                                    <div className="mt-2 text-xs text-green-700">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                            <div>
                                                <p><span className="font-semibold">検索語:</span> {searchDebugStatus.data.analysis.searchTerm}</p>
                                                <p><span className="font-semibold">検索日:</span> {searchDebugStatus.data.analysis.searchDate}</p>
                                                <p><span className="font-semibold">総書類数:</span> {searchDebugStatus.data.analysis.totalDocuments}件</p>
                                                <p><span className="font-semibold">マッチ数:</span> {searchDebugStatus.data.analysis.totalMatches}件</p>
                                                <p><span className="font-semibold">ユニーク企業:</span> {searchDebugStatus.data.analysis.uniqueCompanies}社</p>
                                            </div>
                                            <div>
                                                <p className="font-semibold mb-1">発見企業:</p>
                                                {searchDebugStatus.data.analysis.matchedCompanies.length > 0 ? (
                                                    <ul className="list-disc list-inside space-y-1">
                                                        {searchDebugStatus.data.analysis.matchedCompanies.slice(0, 5).map((company, index) => (
                                                            <li key={index} className="text-xs">
                                                                {company.filerName} ({company.edinetCode})
                                                            </li>
                                                        ))}
                                                        {searchDebugStatus.data.analysis.matchedCompanies.length > 5 && (
                                                            <li className="text-xs text-gray-600">...他{searchDebugStatus.data.analysis.matchedCompanies.length - 5}社</li>
                                                        )}
                                                    </ul>
                                                ) : (
                                                    <p className="text-red-600">マッチした企業なし</p>
                                                )}
                                            </div>
                                        </div>
                                        {searchDebugStatus.data.analysis.matchedCompanies.length === 0 && (
                                            <div className="mt-3 p-2 bg-yellow-100 border border-yellow-300 rounded text-yellow-800">
                                                <p className="font-semibold">サンプル企業名（参考）:</p>
                                                <div className="mt-1 text-xs">
                                                    {searchDebugStatus.data.analysis.sampleCompanies.slice(0, 3).map((company, index) => (
                                                        <p key={index}>• {company.filerName}</p>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                                {!searchDebugStatus.success && (
                                    <div className="mt-1 text-sm text-red-700">
                                        <p>{searchDebugStatus.error}</p>
                                        {searchDebugStatus.details && (
                                            <p className="text-xs mt-1">詳細: {
                                                typeof searchDebugStatus.details === 'string' 
                                                    ? searchDebugStatus.details 
                                                    : JSON.stringify(searchDebugStatus.details)
                                            }</p>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* 読み込み中 */}
                {loading && (
                    <div className="flex justify-center items-center py-12">
                        <LoadingSpinner />
                    </div>
                )}

                {/* API接続テスト結果 */}
                {connectionStatus && (
                    <div className={`rounded-lg p-4 mb-8 ${
                        connectionStatus.success 
                            ? 'bg-green-50 border border-green-200' 
                            : 'bg-red-50 border border-red-200'
                    }`}>
                        <div className="flex">
                            <div className="flex-shrink-0">
                                {connectionStatus.success ? (
                                    <svg className="h-5 w-5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                    </svg>
                                ) : (
                                    <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                                    </svg>
                                )}
                            </div>
                            <div className="ml-3 flex-1">
                                <h3 className={`text-sm font-medium ${
                                    connectionStatus.success ? 'text-green-800' : 'text-red-800'
                                }`}>
                                    {connectionStatus.success ? 'API接続成功' : 'API接続失敗'}
                                </h3>
                                <div className={`mt-1 text-sm ${
                                    connectionStatus.success ? 'text-green-700' : 'text-red-700'
                                }`}>
                                    <p className="font-medium">
                                        {connectionStatus.success ? connectionStatus.message : connectionStatus.error}
                                    </p>
                                    <div className="mt-2 text-xs">
                                        <p><span className="font-semibold">ステータスコード:</span> {connectionStatus.statusCode}</p>
                                        {connectionStatus.errorCode && (
                                            <p><span className="font-semibold">エラーコード:</span> {connectionStatus.errorCode}</p>
                                        )}
                                        <p><span className="font-semibold">詳細:</span> {
                                            typeof connectionStatus.details === 'string' 
                                                ? connectionStatus.details 
                                                : JSON.stringify(connectionStatus.details)
                                        }</p>
                                        {connectionStatus.success && connectionStatus.details && typeof connectionStatus.details === 'object' && (
                                            <div className="mt-1">
                                                <p><span className="font-semibold">テスト日付:</span> {connectionStatus.details.testDate || 'N/A'}</p>
                                                <p><span className="font-semibold">取得書類数:</span> {connectionStatus.details.documentsFound || 0}件</p>
                                                {connectionStatus.details.apiEndpoint && (
                                                    <p><span className="font-semibold">エンドポイント:</span> {connectionStatus.details.apiEndpoint}</p>
                                                )}
                                            </div>
                                        )}
                                        {connectionStatus.suggestion && (
                                            <p className="mt-1"><span className="font-semibold">対処法:</span> {connectionStatus.suggestion}</p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* エラー表示 */}
                {error && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-8">
                        <div className="flex">
                            <div className="flex-shrink-0">
                                <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                                </svg>
                            </div>
                            <div className="ml-3 flex-1">
                                <h3 className="text-sm font-medium text-red-800">
                                    エラーが発生しました
                                </h3>
                                <p className="mt-1 text-sm text-red-700">{error}</p>
                                {error.includes('認証エラー') && (
                                    <div className="mt-2 text-xs text-red-600">
                                        <p className="font-semibold">解決方法:</p>
                                        <ol className="list-decimal list-inside mt-1 space-y-1">
                                            <li>Vercelダッシュボードにアクセス</li>
                                            <li>Settings → Environment Variables を開く</li>
                                            <li>EDINET_API_KEY に有効なAPIキーを設定</li>
                                            <li>設定後、アプリケーションを再デプロイ</li>
                                        </ol>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* 企業検索結果 */}
                {companies && companies.length > 0 && (
                    <div className="bg-white rounded-lg shadow p-6 mb-8">
                        <h2 className="text-xl font-semibold text-gray-900 mb-4">
                            検索結果: {companies.length}社
                        </h2>
                        <div className="space-y-2">
                            {companies.map((company) => (
                                <button
                                    key={company.edinetCode}
                                    onClick={() => handleCompanySelect(company)}
                                    className={`w-full text-left p-4 rounded-lg border transition-colors ${
                                        selectedCompany?.edinetCode === company.edinetCode
                                            ? 'border-blue-500 bg-blue-50'
                                            : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                                    }`}
                                >
                                    <div className="flex justify-between items-center">
                                        <div>
                                            <p className="font-medium text-gray-900">{company.filerName}</p>
                                            <p className="text-sm text-gray-500">
                                                EDINETコード: {company.edinetCode}
                                                {company.securitiesCode && ` | 証券コード: ${company.securitiesCode}`}
                                            </p>
                                        </div>
                                        <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                        </svg>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* 年度選択 */}
                {selectedCompany && availableYears.length > 0 && (
                    <div className="bg-white rounded-lg shadow p-6 mb-8">
                        <h2 className="text-xl font-semibold text-gray-900 mb-4">
                            {selectedCompany.filerName} - 年度選択
                        </h2>
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                            {availableYears.map((year) => (
                                <button
                                    key={year}
                                    onClick={() => handleYearSelect(year)}
                                    disabled={loadingFinancial && selectedYear === year}
                                    className={`p-3 rounded-lg border text-center transition-colors ${
                                        selectedYear === year
                                            ? 'border-blue-500 bg-blue-50 text-blue-700'
                                            : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                                    } ${
                                        loadingFinancial && selectedYear === year
                                            ? 'opacity-50 cursor-not-allowed'
                                            : ''
                                    }`}
                                >
                                    <div className="font-medium">{year}年度</div>
                                    <div className="text-xs text-gray-500 mt-1">
                                        {year}/{year + 1}
                                    </div>
                                    {loadingFinancial && selectedYear === year && (
                                        <div className="mt-2">
                                            <svg className="animate-spin h-4 w-4 mx-auto text-blue-500" fill="none" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                            </svg>
                                        </div>
                                    )}
                                </button>
                            ))}
                        </div>
                        <div className="mt-4 text-sm text-gray-600">
                            年度をクリックしてBS/PLデータを表示
                        </div>
                    </div>
                )}

                {/* 財務データ読み込み中 */}
                {loadingFinancial && (
                    <div className="bg-white rounded-lg shadow p-6 mb-8">
                        <div className="flex items-center justify-center py-8">
                            <LoadingSpinner />
                            <span className="ml-3 text-gray-600">財務データを取得中...</span>
                        </div>
                    </div>
                )}

                {/* 財務データ表示 */}
                {financialData && selectedCompany && (
                    <div className="space-y-8">
                        {/* 企業情報 */}
                        <div className="bg-white rounded-lg shadow p-6">
                            <h2 className="text-xl font-semibold text-gray-900 mb-4">
                                企業情報
                            </h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <span className="text-sm font-medium text-gray-500">企業名:</span>
                                    <p className="text-lg text-gray-900">{selectedCompany.filerName}</p>
                                </div>
                                <div>
                                    <span className="text-sm font-medium text-gray-500">EDINETコード:</span>
                                    <p className="text-lg text-gray-900">{selectedCompany.edinetCode}</p>
                                </div>
                                {selectedCompany.securitiesCode && (
                                    <div>
                                        <span className="text-sm font-medium text-gray-500">証券コード:</span>
                                        <p className="text-lg text-gray-900">{selectedCompany.securitiesCode}</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* 財務データテーブル */}
                        <div className="bg-white rounded-lg shadow p-6">
                            <h2 className="text-xl font-semibold text-gray-900 mb-4">
                                {selectedYear}年度 財務データ（明細含む）
                            </h2>
                            {financialData.data ? (
                                <FinancialDataTable 
                                    data={[{
                                        year: selectedYear,
                                        data: financialData.data
                                    }]} 
                                    years={[selectedYear]} 
                                    singleYear={true}
                                />
                            ) : (
                                <div className="text-center py-8 text-gray-500">
                                    財務データの取得に失敗しました
                                </div>
                            )}
                        </div>

                        {/* 財務グラフ */}
                        <div className="bg-white rounded-lg shadow p-6">
                            <h2 className="text-xl font-semibold text-gray-900 mb-4">
                                {selectedYear}年度 財務データ可視化
                            </h2>
                            {financialData.data ? (
                                <FinancialChart 
                                    data={[{
                                        year: selectedYear,
                                        data: financialData.data
                                    }]} 
                                    years={[selectedYear]}
                                    singleYear={true}
                                />
                            ) : (
                                <div className="text-center py-8 text-gray-500">
                                    グラフデータがありません
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </main>

            <footer className="bg-white border-t border-gray-200 mt-12">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
                    <p className="text-center text-gray-500 text-sm">
                        © 2024 財務分析アプリケーション - EDINET API を使用
                    </p>
                </div>
            </footer>
        </div>
    );
}