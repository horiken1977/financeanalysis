/**
 * 財務グラフコンポーネント
 */

import { useEffect, useRef } from 'react';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    BarElement,
    LineElement,
    PointElement,
    Title,
    Tooltip,
    Legend,
} from 'chart.js';
import { Bar, Line } from 'react-chartjs-2';

ChartJS.register(
    CategoryScale,
    LinearScale,
    BarElement,
    LineElement,
    PointElement,
    Title,
    Tooltip,
    Legend
);

export default function FinancialChart({ data, years, singleYear = false }) {
    if (!data || data.length === 0) {
        return (
            <div className="text-center py-8 text-gray-500">
                グラフデータがありません
            </div>
        );
    }

    // データの準備
    const validData = data.filter(d => d.data && !d.error);
    const chartYears = validData.map(d => `${d.year}年度`);

    // 貸借対照表データ
    const balanceSheetData = {
        labels: chartYears,
        datasets: [
            {
                label: '資産合計',
                data: validData.map(d => (d.data.balanceSheet?.totalAssets || 0) / 1000000),
                backgroundColor: 'rgba(59, 130, 246, 0.5)',
                borderColor: 'rgb(59, 130, 246)',
                borderWidth: 2,
            },
            {
                label: '負債合計',
                data: validData.map(d => (d.data.balanceSheet?.totalLiabilities || 0) / 1000000),
                backgroundColor: 'rgba(239, 68, 68, 0.5)',
                borderColor: 'rgb(239, 68, 68)',
                borderWidth: 2,
            },
            {
                label: '純資産合計',
                data: validData.map(d => (d.data.balanceSheet?.netAssets || 0) / 1000000),
                backgroundColor: 'rgba(34, 197, 94, 0.5)',
                borderColor: 'rgb(34, 197, 94)',
                borderWidth: 2,
            },
        ],
    };

    // 損益計算書データ
    const profitLossData = {
        labels: chartYears,
        datasets: [
            {
                label: '売上高',
                data: validData.map(d => (d.data.profitLoss?.netSales || 0) / 1000000),
                backgroundColor: 'rgba(59, 130, 246, 0.5)',
                borderColor: 'rgb(59, 130, 246)',
                borderWidth: 2,
            },
            {
                label: '営業利益',
                data: validData.map(d => (d.data.profitLoss?.operatingIncome || 0) / 1000000),
                backgroundColor: 'rgba(34, 197, 94, 0.5)',
                borderColor: 'rgb(34, 197, 94)',
                borderWidth: 2,
            },
            {
                label: '経常利益',
                data: validData.map(d => (d.data.profitLoss?.ordinaryIncome || 0) / 1000000),
                backgroundColor: 'rgba(168, 85, 247, 0.5)',
                borderColor: 'rgb(168, 85, 247)',
                borderWidth: 2,
            },
            {
                label: '当期純利益',
                data: validData.map(d => (d.data.profitLoss?.netIncome || 0) / 1000000),
                backgroundColor: 'rgba(245, 158, 11, 0.5)',
                borderColor: 'rgb(245, 158, 11)',
                borderWidth: 2,
            },
        ],
    };

    // 収益性指標データ（ROAなど）
    const ratioData = {
        labels: chartYears,
        datasets: [
            {
                label: 'ROA (%)',
                data: validData.map(d => {
                    const netIncome = d.data.profitLoss?.netIncome || 0;
                    const totalAssets = d.data.balanceSheet?.totalAssets || 0;
                    return totalAssets > 0 ? (netIncome / totalAssets) * 100 : 0;
                }),
                backgroundColor: 'rgba(59, 130, 246, 0.5)',
                borderColor: 'rgb(59, 130, 246)',
                borderWidth: 2,
                tension: 0.1,
            },
            {
                label: '自己資本比率 (%)',
                data: validData.map(d => {
                    const netAssets = d.data.balanceSheet?.netAssets || 0;
                    const totalAssets = d.data.balanceSheet?.totalAssets || 0;
                    return totalAssets > 0 ? (netAssets / totalAssets) * 100 : 0;
                }),
                backgroundColor: 'rgba(34, 197, 94, 0.5)',
                borderColor: 'rgb(34, 197, 94)',
                borderWidth: 2,
                tension: 0.1,
            },
        ],
    };

    const chartOptions = {
        responsive: true,
        plugins: {
            legend: {
                position: 'top',
            },
            tooltip: {
                callbacks: {
                    label: function(context) {
                        const label = context.dataset.label || '';
                        const value = context.raw;
                        
                        if (label.includes('%')) {
                            return `${label}: ${value.toFixed(2)}%`;
                        } else {
                            return `${label}: ${value.toLocaleString()}百万円`;
                        }
                    }
                }
            },
        },
        scales: {
            y: {
                beginAtZero: true,
                ticks: {
                    callback: function(value) {
                        return value.toLocaleString();
                    }
                }
            },
        },
    };

    const ratioChartOptions = {
        ...chartOptions,
        scales: {
            y: {
                beginAtZero: true,
                ticks: {
                    callback: function(value) {
                        return value.toFixed(1) + '%';
                    }
                }
            },
        },
    };

    if (singleYear) {
        // 単年度表示の場合は簡易グラフを表示
        const singleYearData = validData[0]?.data;
        if (!singleYearData) {
            return (
                <div className="text-center py-8 text-gray-500">
                    グラフ用データがありません
                </div>
            );
        }

        // 単年度用の数値表示
        const formatValue = (value) => {
            if (!value || value === 0) return 'データなし';
            return `${(value / 1000000).toLocaleString('ja-JP', { maximumFractionDigits: 0 })}百万円`;
        };

        const calculateRatio = (numerator, denominator) => {
            if (!numerator || !denominator || denominator === 0) return '算出不可';
            return `${((numerator / denominator) * 100).toFixed(2)}%`;
        };

        return (
            <div className="space-y-6">
                {/* 貸借対照表サマリー */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <h4 className="text-sm font-medium text-blue-800 mb-2">資産合計</h4>
                        <p className="text-2xl font-bold text-blue-900">
                            {formatValue(singleYearData.balanceSheet?.totalAssets)}
                        </p>
                        <p className="text-xs text-blue-600 mt-1">
                            流動: {formatValue(singleYearData.balanceSheet?.currentAssets)}<br/>
                            固定: {formatValue(singleYearData.balanceSheet?.nonCurrentAssets)}
                        </p>
                    </div>
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                        <h4 className="text-sm font-medium text-red-800 mb-2">負債合計</h4>
                        <p className="text-2xl font-bold text-red-900">
                            {formatValue(singleYearData.balanceSheet?.totalLiabilities)}
                        </p>
                        <p className="text-xs text-red-600 mt-1">
                            流動: {formatValue(singleYearData.balanceSheet?.currentLiabilities)}<br/>
                            固定: {formatValue(singleYearData.balanceSheet?.nonCurrentLiabilities)}
                        </p>
                    </div>
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                        <h4 className="text-sm font-medium text-green-800 mb-2">純資産合計</h4>
                        <p className="text-2xl font-bold text-green-900">
                            {formatValue(singleYearData.balanceSheet?.netAssets)}
                        </p>
                        <p className="text-xs text-green-600 mt-1">
                            自己資本比率: {calculateRatio(
                                singleYearData.balanceSheet?.netAssets,
                                singleYearData.balanceSheet?.totalAssets
                            )}
                        </p>
                    </div>
                </div>

                {/* 損益計算書サマリー */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <h4 className="text-sm font-medium text-blue-800 mb-2">売上高</h4>
                        <p className="text-xl font-bold text-blue-900">
                            {formatValue(singleYearData.profitLoss?.netSales)}
                        </p>
                    </div>
                    <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                        <h4 className="text-sm font-medium text-purple-800 mb-2">営業利益</h4>
                        <p className="text-xl font-bold text-purple-900">
                            {formatValue(singleYearData.profitLoss?.operatingIncome)}
                        </p>
                        <p className="text-xs text-purple-600 mt-1">
                            営業利益率: {calculateRatio(
                                singleYearData.profitLoss?.operatingIncome,
                                singleYearData.profitLoss?.netSales
                            )}
                        </p>
                    </div>
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                        <h4 className="text-sm font-medium text-green-800 mb-2">経常利益</h4>
                        <p className="text-xl font-bold text-green-900">
                            {formatValue(singleYearData.profitLoss?.ordinaryIncome)}
                        </p>
                    </div>
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                        <h4 className="text-sm font-medium text-yellow-800 mb-2">当期純利益</h4>
                        <p className="text-xl font-bold text-yellow-900">
                            {formatValue(singleYearData.profitLoss?.netIncome)}
                        </p>
                        <p className="text-xs text-yellow-600 mt-1">
                            ROA: {calculateRatio(
                                singleYearData.profitLoss?.netIncome,
                                singleYearData.balanceSheet?.totalAssets
                            )}
                        </p>
                    </div>
                </div>

                {/* 主要指標 */}
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                    <h4 className="text-lg font-semibold text-gray-900 mb-3">主要指標</h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                            <span className="text-gray-600">総資産利益率 (ROA):</span>
                            <p className="font-semibold">{calculateRatio(
                                singleYearData.profitLoss?.netIncome,
                                singleYearData.balanceSheet?.totalAssets
                            )}</p>
                        </div>
                        <div>
                            <span className="text-gray-600">自己資本比率:</span>
                            <p className="font-semibold">{calculateRatio(
                                singleYearData.balanceSheet?.netAssets,
                                singleYearData.balanceSheet?.totalAssets
                            )}</p>
                        </div>
                        <div>
                            <span className="text-gray-600">営業利益率:</span>
                            <p className="font-semibold">{calculateRatio(
                                singleYearData.profitLoss?.operatingIncome,
                                singleYearData.profitLoss?.netSales
                            )}</p>
                        </div>
                        <div>
                            <span className="text-gray-600">売上総利益率:</span>
                            <p className="font-semibold">{calculateRatio(
                                singleYearData.profitLoss?.grossProfit,
                                singleYearData.profitLoss?.netSales
                            )}</p>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-8">
            {/* 貸借対照表グラフ */}
            <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">貸借対照表（BS）推移</h3>
                <div className="bg-white p-4 rounded-lg">
                    <Bar data={balanceSheetData} options={chartOptions} />
                </div>
            </div>

            {/* 損益計算書グラフ */}
            <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">損益計算書（PL）推移</h3>
                <div className="bg-white p-4 rounded-lg">
                    <Bar data={profitLossData} options={chartOptions} />
                </div>
            </div>

            {/* 収益性指標グラフ */}
            <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">収益性指標推移</h3>
                <div className="bg-white p-4 rounded-lg">
                    <Line data={ratioData} options={ratioChartOptions} />
                </div>
            </div>

            {/* 注意事項 */}
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="flex">
                    <div className="flex-shrink-0">
                        <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                    </div>
                    <div className="ml-3">
                        <h3 className="text-sm font-medium text-yellow-800">
                            注意事項
                        </h3>
                        <div className="mt-2 text-sm text-yellow-700">
                            <ul className="list-disc list-inside space-y-1">
                                <li>金額は百万円単位で表示されています</li>
                                <li>ROA（総資産利益率）= 当期純利益 ÷ 総資産 × 100</li>
                                <li>自己資本比率 = 純資産 ÷ 総資産 × 100</li>
                                <li>データが取得できない年度は表示されません</li>
                            </ul>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}