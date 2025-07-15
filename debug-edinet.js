/**
 * Debug script for EDINET API search issues
 */

import EDINETClient from './src/lib/edinet-client.js';
import axios from 'axios';

class DebugEDINETClient extends EDINETClient {
    async searchCompanyInPeriod(companyName, months, existingCompanies) {
        console.log(`\n=== Debug: Period search for "${companyName}" (${months} months) ===`);
        
        const currentDate = new Date();
        const searchDates = [];
        let foundCount = 0;
        
        // Generate search dates
        for (let i = 0; i < months; i++) {
            const date = new Date(currentDate);
            date.setMonth(date.getMonth() - i);
            
            const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0);
            searchDates.push(monthEnd.toISOString().split('T')[0]);
            
            if ([2, 5, 8, 11].includes(date.getMonth())) {
                const midMonth = new Date(date.getFullYear(), date.getMonth(), 15);
                searchDates.push(midMonth.toISOString().split('T')[0]);
            }
        }

        console.log(`Search dates: ${searchDates.slice(0, 5).join(', ')}...`);

        const maxSearchesPerPhase = 5;
        let searchCount = 0;

        for (const date of searchDates) {
            if (searchCount >= maxSearchesPerPhase) break;
            
            try {
                searchCount++;
                console.log(`\n--- Searching date: ${date} (${searchCount}/${maxSearchesPerPhase}) ---`);
                
                const documents = await this.getDocumentList(date);
                
                if (!documents || !documents.results) {
                    console.log(`No documents found for ${date}`);
                    continue;
                }
                
                console.log(`Total documents found: ${documents.results.length}`);
                
                // Log a few sample documents to understand structure
                if (documents.results.length > 0) {
                    console.log('Sample document structure:');
                    const sample = documents.results[0];
                    console.log({
                        docID: sample.docID,
                        edinetCode: sample.edinetCode,
                        filerName: sample.filerName,
                        submitterName: sample.submitterName,
                        formCode: sample.formCode,
                        docDescription: sample.docDescription
                    });
                }
                
                // Check for Toyota-related companies
                const allReports = documents.results || [];
                console.log('Checking all reports for Toyota matches...');
                
                let toyotaMatches = 0;
                allReports.forEach(report => {
                    const filerName = report.filerName || '';
                    const submitterName = report.submitterName || '';
                    
                    // Check various Toyota spellings and variations
                    const toyotaVariations = ['トヨタ', 'toyota', 'TOYOTA', 'Toyota', '豊田'];
                    
                    const hasMatch = toyotaVariations.some(variation => 
                        filerName.includes(variation) || submitterName.includes(variation)
                    );
                    
                    if (hasMatch) {
                        toyotaMatches++;
                        console.log(`TOYOTA MATCH FOUND: ${filerName} / ${submitterName}`);
                    }
                });
                
                console.log(`Toyota matches found: ${toyotaMatches}`);
                
                // Use original filtering logic
                const matchedReports = allReports.filter(report => {
                    const filerName = report.filerName || '';
                    const submitterName = report.submitterName || '';
                    const companyNameLower = companyName.toLowerCase();
                    
                    return filerName.toLowerCase().includes(companyNameLower) ||
                           submitterName.toLowerCase().includes(companyNameLower) ||
                           filerName.includes(companyName) ||
                           submitterName.includes(companyName);
                });

                console.log(`Matched reports using original logic: ${matchedReports.length}`);
                
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

                if (foundCount > 0) {
                    console.log(`Found ${foundCount} new companies, breaking early`);
                    break;
                }
                
            } catch (error) {
                console.warn(`Error searching date ${date}:`, error.message);
            }
        }

        console.log(`=== Period search complete: ${foundCount} companies found ===\n`);
        return foundCount;
    }
}

// Test with debug client
async function debugToyotaSearch() {
    console.log('Starting debug Toyota search...');
    
    const client = new DebugEDINETClient('dummy-key');
    
    try {
        const result = await client.searchCompany('トヨタ');
        console.log('\nFinal result:', result);
    } catch (error) {
        console.error('Search failed:', error.message);
    }
}

debugToyotaSearch();