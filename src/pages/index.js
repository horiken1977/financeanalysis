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
    const [financialData, setFinancialData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [loadingFinancial, setLoadingFinancial] = useState(false);
    const [loadingConnection, setLoadingConnection] = useState(false);
    const [error, setError] = useState(null);
    const [connectionStatus, setConnectionStatus] = useState(null);

    const handleSearch = async (companyName) => {
        setLoading(true);
        setError(null);
        setCompanies(null);
        setSelectedCompany(null);
        setFinancialData(null);

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
            
            // 企業が1社のみの場合は自動的に選択
            if (data.companies.length === 1) {
                await handleCompanySelect(data.companies[0]);
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleCompanySelect = async (company) => {
        setSelectedCompany(company);
        setLoadingFinancial(true);
        setError(null);

        try {
            const currentYear = new Date().getFullYear();
            const years = Array.from({length: 5}, (_, i) => currentYear - 1 - i);

            const response = await fetch('/api/get-financial-data', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ 
                    edinetCode: company.edinetCode,
                    years: years 
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || '財務データの取得に失敗しました');
            }

            const data = await response.json();
            setFinancialData(data);
        } catch (err) {
            setError(err.message);
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
                    </div>
                </div>

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
                                        <p><span className="font-semibold">詳細:</span> {connectionStatus.details}</p>
                                        {connectionStatus.success && connectionStatus.details && (
                                            <div className="mt-1">
                                                <p><span className="font-semibold">テスト日付:</span> {connectionStatus.details.testDate}</p>
                                                <p><span className="font-semibold">取得書類数:</span> {connectionStatus.details.documentsFound}件</p>
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
                                財務データ（直近5年分）
                            </h2>
                            <FinancialDataTable data={financialData.data} years={financialData.years} />
                        </div>

                        {/* 財務グラフ */}
                        <div className="bg-white rounded-lg shadow p-6">
                            <h2 className="text-xl font-semibold text-gray-900 mb-4">
                                財務推移グラフ
                            </h2>
                            <FinancialChart data={financialData.data} years={financialData.years} />
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