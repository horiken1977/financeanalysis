/**
 * ローディングスピナーコンポーネント
 */

export default function LoadingSpinner() {
    return (
        <div className="flex flex-col items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            <div className="mt-4 text-center">
                <p className="text-lg font-medium text-gray-900">データを取得中...</p>
                <p className="text-sm text-gray-500 mt-1">
                    EDINET APIから財務データを取得しています
                </p>
                <p className="text-sm text-gray-500">
                    しばらくお待ちください（数分かかる場合があります）
                </p>
            </div>
        </div>
    );
}