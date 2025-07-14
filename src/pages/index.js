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
    const [searchResults, setSearchResults] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const handleSearch = async (companyName) => {
        setLoading(true);
        setError(null);
        setSearchResults(null);

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
            setSearchResults(data);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
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
                </div>

                {/* 読み込み中 */}
                {loading && (
                    <div className="flex justify-center items-center py-12">
                        <LoadingSpinner />
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
                            <div className="ml-3">
                                <h3 className="text-sm font-medium text-red-800">
                                    エラーが発生しました
                                </h3>
                                <p className="mt-1 text-sm text-red-700">{error}</p>
                            </div>
                        </div>
                    </div>
                )}

                {/* 検索結果 */}
                {searchResults && (
                    <div className="space-y-8">
                        {/* 企業情報 */}
                        <div className="bg-white rounded-lg shadow p-6">
                            <h2 className="text-xl font-semibold text-gray-900 mb-4">
                                企業情報
                            </h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <span className="text-sm font-medium text-gray-500">企業名:</span>
                                    <p className="text-lg text-gray-900">{searchResults.company.filerName}</p>
                                </div>
                                <div>
                                    <span className="text-sm font-medium text-gray-500">EDINETコード:</span>
                                    <p className="text-lg text-gray-900">{searchResults.company.edinetCode}</p>
                                </div>
                                {searchResults.company.securitiesCode && (
                                    <div>
                                        <span className="text-sm font-medium text-gray-500">証券コード:</span>
                                        <p className="text-lg text-gray-900">{searchResults.company.securitiesCode}</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* 財務データテーブル */}
                        <div className="bg-white rounded-lg shadow p-6">
                            <h2 className="text-xl font-semibold text-gray-900 mb-4">
                                財務データ（直近5年分）
                            </h2>
                            <FinancialDataTable data={searchResults.data} years={searchResults.years} />
                        </div>

                        {/* 財務グラフ */}
                        <div className="bg-white rounded-lg shadow p-6">
                            <h2 className="text-xl font-semibold text-gray-900 mb-4">
                                財務推移グラフ
                            </h2>
                            <FinancialChart data={searchResults.data} years={searchResults.years} />
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