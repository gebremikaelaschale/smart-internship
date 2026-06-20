const axios = require('axios');

async function test() {
    try {
        console.log("Attempting login...");
        const loginRes = await axios.post('http://localhost:5000/api/auth/login', {
            email: 'admin@uog.edu',
            password: 'AdminPassword123!'
        });
        const token = loginRes.data.token;
        console.log("Login successful! Token acquired.");

        const headers = { Authorization: `Bearer ${token}` };

        const testIds = ['69fdc76bf8c8078c9415cc12', '69ddf69096bd77dc6e8a2df1'];
        for (const id of testIds) {
            console.log(`\nFetching company profile for ID: ${id}...`);
            try {
                const res = await axios.get(`http://localhost:5000/api/admin/companies/${id}`, { headers });
                console.log(`STATUS: ${res.status}`);
                console.log(`Company Name:`, res.data.item?.companyName);
            } catch (err) {
                console.error(`FAILED to fetch ${id}:`, err.response?.status, err.response?.data);
            }
        }
    } catch (err) {
        console.error("Login failed:", err.response?.status, err.response?.data || err.message);
    }
}

test();
