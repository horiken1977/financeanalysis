/**
 * Test EDINET API directly to understand the issue
 */

import axios from 'axios';

async function testEDINETAPI() {
    console.log('Testing EDINET API directly...');
    
    // Test with a known date in the past that should have data
    const testDates = [
        '2024-06-28', // Should have quarterly reports
        '2024-03-29', // Should have annual reports
        '2024-05-31', // Should have various reports
        '2023-06-30'  // Known good date from past
    ];
    
    for (const date of testDates) {
        console.log(`\n=== Testing date: ${date} ===`);
        
        const url = 'https://api.edinet-fsa.go.jp/api/v2/documents.json';
        const params = {
            date: date,
            type: 2
            // Note: Not including Subscription-Key to see what error we get
        };
        
        try {
            console.log(`Request URL: ${url}`);
            console.log(`Parameters:`, params);
            
            const response = await axios.get(url, { params });
            
            console.log(`Status: ${response.status}`);
            console.log(`Headers:`, response.headers['content-type']);
            
            if (response.data) {
                if (response.data.metadata) {
                    console.log(`Metadata:`, response.data.metadata);
                }
                
                if (response.data.results) {
                    console.log(`Total documents: ${response.data.results.length}`);
                    
                    if (response.data.results.length > 0) {
                        const firstDoc = response.data.results[0];
                        console.log('First document sample:');
                        console.log({
                            docID: firstDoc.docID,
                            edinetCode: firstDoc.edinetCode,
                            filerName: firstDoc.filerName,
                            submitterName: firstDoc.submitterName,
                            formCode: firstDoc.formCode,
                            docDescription: firstDoc.docDescription
                        });
                        
                        // Look for Toyota specifically
                        const toyotaMatches = response.data.results.filter(doc => 
                            (doc.filerName && doc.filerName.includes('トヨタ')) ||
                            (doc.submitterName && doc.submitterName.includes('トヨタ')) ||
                            (doc.filerName && doc.filerName.toLowerCase().includes('toyota'))
                        );
                        
                        console.log(`Toyota matches found: ${toyotaMatches.length}`);
                        if (toyotaMatches.length > 0) {
                            console.log('Toyota companies found:');
                            toyotaMatches.forEach(doc => {
                                console.log(`- ${doc.filerName} (${doc.edinetCode})`);
                            });
                        }
                    }
                } else {
                    console.log('No results array in response');
                }
            }
            
        } catch (error) {
            console.error(`Error for date ${date}:`, error.message);
            if (error.response) {
                console.error(`Response status: ${error.response.status}`);
                console.error(`Response data:`, error.response.data);
            }
        }
    }
}

testEDINETAPI();