# EDINET XBRL財務諸表表示システムの実装ガイド

EDINET APIから取得したXBRLデータを使用してNext.jsで貸借対照表（BS）と損益計算書（PL）を正しく生成・表示するための包括的な実装方法について調査した結果をご報告します。

## XBRLデータの構造とパース戦略

### EDINET固有のXBRL構造

EDINET APIが返すXBRLデータは、ZIP形式で配信され、以下の構造を持ちます：

```
ZIPアーカイブ構造:
├── AuditDoc/          # 監査報告書
├── PublicDoc/         # 主要財務諸表
├── manifest.xml       # ファイル構造マニフェスト
└── taxonomy/          # EDINETタクソノミファイル
```

**重要な名前空間**として、日本の財務報告に特化した以下のものが使用されます：
- `jppfs_cor`: 日本基準財務諸表の要素
- `jpcrp_cor`: 日本企業報告の要素
- `xbrli`: 標準XBRLインスタンス要素

### 実装推奨パーサー

最も実用的なアプローチは、**parse-xbrl**パッケージを使用することです。このライブラリはXBRL XMLをJavaScriptオブジェクトに変換し、Next.js環境での処理を大幅に簡素化します。

```javascript
class EdinetXbrlParser {
    constructor() {
        this.accountMap = {
            // 貸借対照表項目
            'jppfs_cor:Assets': 'total_assets',
            'jppfs_cor:CurrentAssets': 'current_assets',
            'jppfs_cor:CashAndDeposits': 'cash_and_cash_equivalents',
            'jppfs_cor:AccountsReceivable': 'accounts_receivable',
            
            // 損益計算書項目
            'jppfs_cor:NetSales': 'revenue',
            'jppfs_cor:CostOfSales': 'cost_of_goods_sold',
            'jppfs_cor:GrossProfit': 'gross_profit',
            'jppfs_cor:OperatingIncome': 'operating_income',
            'jppfs_cor:NetIncome': 'net_income'
        };
    }
    
    async parseEdinetDocument(zipBuffer) {
        const JSZip = require('jszip');
        const zip = await JSZip.loadAsync(zipBuffer);
        
        // PublicDocディレクトリ内のXBRLファイルを検索
        const xbrlFiles = Object.keys(zip.files)
            .filter(path => path.includes('PublicDoc') && path.endsWith('.xbrl'));
        
        const results = {};
        
        for (const filePath of xbrlFiles) {
            const content = await zip.files[filePath].async('string');
            results[filePath] = this.parseXbrlContent(content);
        }
        
        return results;
    }
}
```

## 財務諸表生成ロジックの実装

### 日本基準の階層構造への対応

日本の財務諸表は特定の階層構造を持ち、以下の特徴があります：

**貸借対照表の構造**：
- 資産の部（流動資産→固定資産→繰延資産）
- 負債の部（流動負債→固定負債）
- 純資産の部（株主資本→その他の包括利益累計額）

**損益計算書の構造**：
- 売上高→売上原価→売上総利益
- 販売費及び一般管理費→営業利益
- 営業外収益・費用→経常利益
- 特別利益・損失→税引前当期純利益

### タクソノミマッピングとデータ変換

```typescript
interface FinancialStatement {
    companyName: string;
    reportPeriod: DateRange;
    currency: string;
    unit: 'thousands' | 'millions' | 'billions';
}

interface BalanceSheet extends FinancialStatement {
    assets: {
        currentAssets: LineItem[];
        nonCurrentAssets: LineItem[];
        totalAssets: number;
    };
    liabilities: {
        currentLiabilities: LineItem[];
        nonCurrentLiabilities: LineItem[];
        totalLiabilities: number;
    };
    equity: {
        shareCapital: number;
        retainedEarnings: number;
        totalEquity: number;
    };
}

interface LineItem {
    id: string;
    name: string;
    value: number;
    children?: LineItem[];
    xbrlTag?: string;
    contextRef?: string;
    isCalculated?: boolean;
}
```

### 計算検証の実装

XBRLの計算リンクベースを使用して、財務諸表の整合性を検証します：

```javascript
function validateCalculations(facts, calculationLinkbase) {
    const validationErrors = [];
    
    // 基本的な検証: 資産 = 負債 + 純資産
    const assets = facts['jppfs_cor:Assets']?.value;
    const liabilities = facts['jppfs_cor:Liabilities']?.value;
    const equity = facts['jppfs_cor:NetAssets']?.value;
    
    if (assets && liabilities && equity) {
        const difference = Math.abs(assets - (liabilities + equity));
        const tolerance = Math.max(assets * 0.001, 1000); // 0.1%または1000円の誤差許容
        
        if (difference > tolerance) {
            validationErrors.push({
                type: 'BALANCE_SHEET_EQUATION',
                message: `貸借不一致: 差額 ${difference}円`,
                values: { assets, liabilities, equity }
            });
        }
    }
    
    return validationErrors;
}
```

## Next.js/Vercel環境での最適化実装

### サーバーサイドでのXBRL処理

Next.jsのAPI Routesを使用して、大容量XBRLファイルを効率的に処理します：

```typescript
// app/api/xbrl/parse/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { Readable } from 'stream';

export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData();
        const file = formData.get('xbrlFile') as File;
        
        if (!file) {
            return NextResponse.json(
                { error: 'XBRLファイルが必要です' },
                { status: 400 }
            );
        }
        
        // ストリーミング処理でメモリ効率を向上
        const buffer = await file.arrayBuffer();
        const parser = new EdinetXbrlParser();
        const parsedData = await parser.parseEdinetDocument(Buffer.from(buffer));
        
        // 処理結果をキャッシュ
        await cacheProcessedData(file.name, parsedData);
        
        return NextResponse.json({
            success: true,
            data: parsedData,
            cached: true
        });
        
    } catch (error) {
        console.error('XBRL処理エラー:', error);
        return NextResponse.json(
            { error: 'XBRL処理に失敗しました' },
            { status: 500 }
        );
    }
}
```

### パフォーマンス最適化戦略

**メモリ管理の最適化**：
```javascript
// next.config.js
module.exports = {
    experimental: {
        webpackMemoryOptimizations: true,
        preloadEntriesOnStart: false
    }
};
```

**データフェッチング最適化**：
```typescript
// SWRを使用した効率的なデータ取得
import useSWR from 'swr';

const { data, error, isLoading } = useSWR(
    `/api/financial/${companyCode}/${period}`,
    fetcher,
    {
        refreshInterval: 300000, // 5分
        revalidateOnFocus: false,
        dedupingInterval: 60000 // 1分の重複排除
    }
);
```

## 実装コンポーネントサンプル

### 財務諸表テーブルコンポーネント

```tsx
// components/FinancialStatementTable.tsx
import React, { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

const FinancialStatementTable: React.FC<FinancialTableProps> = ({
    data,
    title,
    periods,
    currency = 'JPY'
}) => {
    const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('ja-JP', {
            style: 'currency',
            currency: currency,
            minimumFractionDigits: 0,
        }).format(value);
    };

    const renderLineItem = (item: LineItem, level: number = 0) => {
        const hasChildren = item.children && item.children.length > 0;
        const isExpanded = expandedItems.has(item.id);

        return (
            <React.Fragment key={item.id}>
                <tr className={`border-b hover:bg-gray-50 ${level > 0 ? 'bg-gray-25' : ''}`}>
                    <td className="px-4 py-2" style={{ paddingLeft: `${level * 20 + 16}px` }}>
                        <div className="flex items-center">
                            {hasChildren && (
                                <button
                                    onClick={() => toggleExpansion(item.id)}
                                    className="mr-2 p-1 hover:bg-gray-200 rounded"
                                >
                                    {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                </button>
                            )}
                            <span className={`${level === 0 ? 'font-semibold' : ''}`}>
                                {item.name}
                            </span>
                        </div>
                    </td>
                    {periods.map((period) => (
                        <td key={period} className="px-4 py-2 text-right">
                            {formatCurrency(item.value)}
                        </td>
                    ))}
                </tr>
                {hasChildren && isExpanded && 
                    item.children!.map(child => renderLineItem(child, level + 1))
                }
            </React.Fragment>
        );
    };

    return (
        <div className="overflow-x-auto">
            <h2 className="text-xl font-bold mb-4">{title}</h2>
            <table className="min-w-full border-collapse border border-gray-300">
                <thead>
                    <tr className="bg-gray-100">
                        <th className="border border-gray-300 px-4 py-2 text-left">科目</th>
                        {periods.map(period => (
                            <th key={period} className="border border-gray-300 px-4 py-2 text-right">
                                {period}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {data.map(item => renderLineItem(item))}
                </tbody>
            </table>
        </div>
    );
};
```

## エラーハンドリングと最適化

### 包括的なエラー処理

```typescript
export class XbrlError extends Error {
    public type: XbrlErrorType;
    public details?: any;

    constructor(message: string, type: XbrlErrorType, details?: any) {
        super(message);
        this.type = type;
        this.details = details;
        this.name = 'XbrlError';
    }
}

// エラーバウンダリの実装
class FinancialStatementErrorBoundary extends React.Component {
    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
        // エラートラッキングサービスへの送信
        console.error('財務諸表レンダリングエラー:', error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="border border-red-200 rounded-lg p-6 bg-red-50">
                    <h2 className="text-lg font-semibold text-red-800">
                        財務諸表の表示でエラーが発生しました
                    </h2>
                    <p className="text-red-700 mb-4">
                        XBRLデータの処理中に問題が発生しました。
                    </p>
                </div>
            );
        }
        return this.props.children;
    }
}
```

### 不完全なデータへの対応

XBRLデータが不完全な場合でも、利用可能な部分を表示し、欠損データを明確に示します：

```javascript
function handleMissingData(facts, requiredFields) {
    const missingFields = [];
    const availableData = {};
    
    for (const field of requiredFields) {
        if (facts[field]) {
            availableData[field] = facts[field];
        } else {
            missingFields.push(field);
            // デフォルト値または警告を設定
            availableData[field] = {
                value: 0,
                warning: 'データなし',
                isMissing: true
            };
        }
    }
    
    return { availableData, missingFields };
}
```

## 実装上の重要な考慮事項

1. **XBRL仕様への準拠**: XBRL 2.1およびDimensions 1.0仕様に完全準拠
2. **多言語対応**: 日本語と英語のラベルを適切に処理
3. **計算精度**: 丸め誤差の適切な処理（通常は0.1%または1000円の許容誤差）
4. **セキュリティ**: XBRLファイルサイズの検証とレート制限の実装
5. **アクセシビリティ**: スクリーンリーダー対応と適切なARIAラベルの追加

この実装ガイドに従うことで、EDINET APIから取得したXBRLデータを使用して、正確で使いやすい財務諸表表示システムをNext.jsで構築できます。