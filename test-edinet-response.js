/**
 * Test EDINET API response structure
 */

import axios from 'axios';

async function testEDINETResponse() {
    console.log('Testing EDINET API response structure...');
    
    const url = 'https://api.edinet-fsa.go.jp/api/v2/documents.json';
    const params = {
        date: '2024-06-28',
        type: 2
    };
    
    try {
        const response = await axios.get(url, { params });
        
        console.log('Full response:');
        console.log(JSON.stringify(response.data, null, 2));
        
    } catch (error) {
        console.error('Error:', error.message);
        if (error.response) {
            console.error('Response status:', error.response.status);
            console.error('Response headers:', error.response.headers);
            console.error('Response data:', JSON.stringify(error.response.data, null, 2));
        }
    }
}

testEDINETResponse();