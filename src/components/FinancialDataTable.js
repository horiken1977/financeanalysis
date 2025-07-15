/**
 * 財務データテーブルコンポーネント
 */

import { useState } from 'react';

export default function FinancialDataTable({ data, years, singleYear = false }) {
    const [activeTab, setActiveTab] = useState('balanceSheet');

    if (!data || data.length === 0) {
        return (
            <div className="text-center py-8 text-gray-500">
                財務データがありません
            </div>
        );
    }

    // 数値をフォーマット（百万円単位）
    const formatNumber = (value) => {
        if (value === null || value === undefined) return '-';
        const num = Number(value);
        if (isNaN(num)) return '-';
        return (num / 1000000).toLocaleString('ja-JP', { maximumFractionDigits: 0 }) + '百万円';
    };

    // 貸借対照表データの準備（詳細版）
    const balanceSheetRows = singleYear ? [
        { label: '流動資産', key: 'currentAssets', bold: true },
        { label: '　現金及び預金', key: 'cashAndDeposits', indent: true },
        { label: '　売掛金', key: 'tradeAccounts', indent: true },
        { label: '　棚卸資産', key: 'inventory', indent: true },
        { label: '　その他流動資産', key: 'otherCurrentAssets', indent: true },
        { label: '固定資産', key: 'nonCurrentAssets', bold: true },
        { label: '　有形固定資産', key: 'propertyPlantEquipment', indent: true },
        { label: '　無形固定資産', key: 'intangibleAssets', indent: true },
        { label: '　投資その他の資産', key: 'investmentsAndOtherAssets', indent: true },
        { label: '資産合計', key: 'totalAssets', bold: true, highlight: true },
        { label: '', key: '', separator: true },
        { label: '流動負債', key: 'currentLiabilities', bold: true },
        { label: '　買掛金', key: 'tradePayables', indent: true },
        { label: '　短期借入金', key: 'shortTermBorrowings', indent: true },
        { label: '　その他流動負債', key: 'otherCurrentLiabilities', indent: true },
        { label: '固定負債', key: 'nonCurrentLiabilities', bold: true },
        { label: '　長期借入金', key: 'longTermBorrowings', indent: true },
        { label: '　その他固定負債', key: 'otherNonCurrentLiabilities', indent: true },
        { label: '負債合計', key: 'totalLiabilities', bold: true, highlight: true },
        { label: '', key: '', separator: true },
        { label: '純資産合計', key: 'netAssets', bold: true, highlight: true },
        { label: '　株主資本', key: 'shareholdersEquity', indent: true },
        { label: '　　資本金', key: 'capitalStock', indent: true, subIndent: true },
        { label: '　　利益剰余金', key: 'retainedEarnings', indent: true, subIndent: true },
        { label: '　その他の包括利益累計額', key: 'accumulatedOtherComprehensiveIncome', indent: true }
    ] : [
        { label: '流動資産', key: 'currentAssets' },
        { label: '固定資産', key: 'nonCurrentAssets' },
        { label: '資産合計', key: 'totalAssets', bold: true },
        { label: '流動負債', key: 'currentLiabilities' },
        { label: '固定負債', key: 'nonCurrentLiabilities' },
        { label: '負債合計', key: 'totalLiabilities', bold: true },
        { label: '純資産合計', key: 'netAssets', bold: true },
        { label: '現金及び預金', key: 'cashAndDeposits' },
        { label: '売掛金', key: 'tradeAccounts' },
        { label: '棚卸資産', key: 'inventory' },
        { label: '有形固定資産', key: 'propertyPlantEquipment' }
    ];

    // 損益計算書データの準備（詳細版）
    const profitLossRows = singleYear ? [
        { label: '売上高', key: 'netSales', bold: true, highlight: true },
        { label: '売上原価', key: 'costOfSales' },
        { label: '売上総利益', key: 'grossProfit', bold: true },
        { label: '販売費及び一般管理費', key: 'sellingGeneralAdminExpenses' },
        { label: '　役員報酬', key: 'executiveCompensation', indent: true },
        { label: '　給料手当', key: 'salariesAndWages', indent: true },
        { label: '　研究開発費', key: 'researchAndDevelopmentExpenses', indent: true },
        { label: '　その他販管費', key: 'otherSellingExpenses', indent: true },
        { label: '営業利益', key: 'operatingIncome', bold: true, highlight: true },
        { label: '', key: '', separator: true },
        { label: '営業外収益', key: 'nonOperatingIncome' },
        { label: '　受取利息', key: 'interestIncome', indent: true },
        { label: '　受取配当金', key: 'dividendIncome', indent: true },
        { label: '　その他営業外収益', key: 'otherNonOperatingIncome', indent: true },
        { label: '営業外費用', key: 'nonOperatingExpenses' },
        { label: '　支払利息', key: 'interestExpenses', indent: true },
        { label: '　その他営業外費用', key: 'otherNonOperatingExpenses', indent: true },
        { label: '経常利益', key: 'ordinaryIncome', bold: true, highlight: true },
        { label: '', key: '', separator: true },
        { label: '特別利益', key: 'extraordinaryIncome' },
        { label: '特別損失', key: 'extraordinaryLoss' },
        { label: '税引前当期純利益', key: 'incomeBeforeTaxes', bold: true },
        { label: '法人税等', key: 'incomeTaxes' },
        { label: '当期純利益', key: 'netIncome', bold: true, highlight: true }
    ] : [
        { label: '売上高', key: 'netSales', bold: true },
        { label: '売上原価', key: 'costOfSales' },
        { label: '売上総利益', key: 'grossProfit', bold: true },
        { label: '販管費', key: 'sellingGeneralAdminExpenses' },
        { label: '営業利益', key: 'operatingIncome', bold: true },
        { label: '営業外収益', key: 'nonOperatingIncome' },
        { label: '営業外費用', key: 'nonOperatingExpenses' },
        { label: '経常利益', key: 'ordinaryIncome', bold: true },
        { label: '当期純利益', key: 'netIncome', bold: true }
    ];

    // タブの定義
    const tabs = [
        { id: 'balanceSheet', label: '貸借対照表（BS）', rows: balanceSheetRows },
        { id: 'profitLoss', label: '損益計算書（PL）', rows: profitLossRows }
    ];

    const currentTab = tabs.find(tab => tab.id === activeTab);

    return (
        <div>
            {/* タブナビゲーション */}
            <div className="border-b border-gray-200 mb-6">
                <nav className="-mb-px flex space-x-8">
                    {tabs.map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`py-2 px-1 border-b-2 font-medium text-sm ${
                                activeTab === tab.id
                                    ? 'border-blue-500 text-blue-600'
                                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                            }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </nav>
            </div>

            {/* テーブル */}
            <div className="overflow-x-auto">
                {singleYear && (
                    <div className="mb-4 text-sm text-gray-600">
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            {years[0]}年度 詳細表示
                        </span>
                    </div>
                )}
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                項目
                            </th>
                            {years.map((year) => (
                                <th key={year} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    {year}年度
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {currentTab.rows.map((row, index) => {
                            if (row.separator) {
                                return (
                                    <tr key={`separator-${index}`}>
                                        <td colSpan={years.length + 1} className="px-6 py-2">
                                            <div className="border-t border-gray-300"></div>
                                        </td>
                                    </tr>
                                );
                            }
                            
                            return (
                                <tr key={row.key || index} className={`${
                                    row.bold ? 'bg-gray-50' : ''
                                } ${
                                    row.highlight ? 'bg-blue-50 border-l-4 border-blue-500' : ''
                                }`}>
                                    <td className={`px-6 py-4 whitespace-nowrap text-sm ${
                                        row.bold ? 'font-semibold text-gray-900' : 'text-gray-900'
                                    } ${
                                        row.indent ? 'pl-10' : ''
                                    } ${
                                        row.subIndent ? 'pl-16' : ''
                                    }`}>
                                        {row.label}
                                    </td>
                                    {years.map((year) => {
                                        const yearData = data.find(d => d.year === year);
                                        const value = yearData?.data?.[activeTab]?.[row.key];
                                        return (
                                            <td key={year} className={`px-6 py-4 whitespace-nowrap text-sm ${
                                                row.bold ? 'font-semibold text-gray-900' : 'text-gray-900'
                                            }`}>
                                                {formatNumber(value)}
                                            </td>
                                        );
                                    })}
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {/* データ取得状況の表示 */}
            {!singleYear && (
                <div className="mt-4 text-sm text-gray-500">
                    <h4 className="font-medium mb-2">データ取得状況:</h4>
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
                        {years.map((year) => {
                            const yearData = data.find(d => d.year === year);
                            const hasError = yearData?.error;
                            const hasData = yearData?.data && !hasError;
                            
                            return (
                                <div key={year} className="flex items-center">
                                    <div className={`w-3 h-3 rounded-full mr-2 ${
                                        hasData ? 'bg-green-500' : hasError ? 'bg-red-500' : 'bg-gray-300'
                                    }`}></div>
                                    <span className={hasError ? 'text-red-600' : ''}>
                                        {year}年度 {hasError && '(エラー)'}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
            
            {/* 単年度表示時の補足情報 */}
            {singleYear && data.length > 0 && (
                <div className="mt-4 text-sm text-gray-500">
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                        <h4 className="font-medium text-blue-800 mb-2">表示情報:</h4>
                        <ul className="list-disc list-inside space-y-1 text-blue-700">
                            <li>金額は百万円単位で表示</li>
                            <li>「-」は該当データなしまたは取得不可</li>
                            <li>ハイライト項目は主要指標</li>
                            <li>インデント項目は内訳明細</li>
                        </ul>
                    </div>
                </div>
            )}
        </div>
    );
}