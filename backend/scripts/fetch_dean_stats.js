const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const jwt = require('jsonwebtoken');

const DEAN_ID = process.argv[2] || '69df6af6ffbaa0349e9899a0';
const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_jwt_key_for_uog';
const API_URL = process.env.API_URL || 'http://localhost:5000';

async function run() {
  try {
    const token = jwt.sign({ userId: DEAN_ID, role: 'dean' }, JWT_SECRET, { expiresIn: '1h' });
    console.log('Using token for dean id:', DEAN_ID);

    const res = await fetch(`${API_URL}/api/dean/stats`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    const body = await res.text();
    console.log('Status:', res.status);
    try { console.log('Body JSON:', JSON.parse(body)); } catch (e) { console.log('Body:', body); }
  } catch (err) {
    console.error('Request failed:', err.message || err);
  }
}

run();
