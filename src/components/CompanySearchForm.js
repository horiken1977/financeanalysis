/**
 * 企業検索フォームコンポーネント
 */

import { useState } from 'react';

export default function CompanySearchForm({ onSearch, loading }) {
    const [companyName, setCompanyName] = useState('');

    const handleSubmit = (e) => {
        e.preventDefault();
        if (companyName.trim()) {
            onSearch(companyName.trim());
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div>
                <label htmlFor="company-name" className="block text-sm font-medium text-gray-700 mb-2">
                    企業名
                </label>
                <div className="flex space-x-4">
                    <input
                        type="text"
                        id="company-name"
                        value={companyName}
                        onChange={(e) => setCompanyName(e.target.value)}
                        placeholder="例: トヨタ自動車、ソフトバンク"
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        disabled={loading}
                    />
                    <button
                        type="submit"
                        disabled={loading || !companyName.trim()}
                        className="px-6 py-2 bg-blue-600 text-white font-medium rounded-md shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loading ? (
                            <div className="flex items-center">
                                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                検索中...
                            </div>
                        ) : (
                            '検索'
                        )}
                    </button>
                </div>
            </div>
            <div className="text-sm text-gray-500">
                <p>※ 企業名の一部を入力してください（例: 「トヨタ」、「ソフトバンク」）</p>
                <p>※ 検索には数分かかる場合があります</p>
            </div>
        </form>
    );
}