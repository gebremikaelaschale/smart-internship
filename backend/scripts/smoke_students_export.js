/* eslint-disable no-console */
require('dotenv').config();

const BASE_URL = process.env.SMOKE_BASE_URL || 'http://localhost:5000';
const SUPERADMIN_EMAIL = process.env.SMOKE_SUPERADMIN_EMAIL || 'admin@uog.edu';
const SUPERADMIN_PASSWORD = process.env.SMOKE_SUPERADMIN_PASSWORD || 'AdminPassword123!';

async function request(method, url, { body, token, expect = [200, 201] } = {}) {
  const response = await fetch(url, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    ...(body ? { body: JSON.stringify(body) } : {})
  });

  const text = await response.text();
  if (!expect.includes(response.status)) {
    throw new Error(`${method} ${url} failed (${response.status}): ${text.slice(0, 250)}`);
  }
  return { text, headers: response.headers };
}

(async () => {
  const uniq = Date.now();
  const deanEmail = `dean.students.${uniq}@uog.edu.et`;

  const adminLogin = await request('POST', `${BASE_URL}/auth/login`, {
    body: { email: SUPERADMIN_EMAIL, password: SUPERADMIN_PASSWORD }
  });
  const adminData = JSON.parse(adminLogin.text);

  const college = await request('POST', `${BASE_URL}/api/admin/colleges`, {
    token: adminData.token,
    body: {
      name: `Students Export College ${uniq}`,
      dean: { name: `Dean Students ${uniq}`, email: deanEmail }
    }
  });
  const collegeData = JSON.parse(college.text);

  const deanLogin = await request('POST', `${BASE_URL}/auth/login`, {
    body: { email: deanEmail, password: collegeData.temporaryPassword }
  });
  const deanData = JSON.parse(deanLogin.text);

  const exportRes = await request('GET', `${BASE_URL}/api/admin/students/export?department=all&internshipStatus=all&reason=Students%20filtered%20export%20verification`, {
    token: deanData.token
  });

  const csvHead = String(exportRes.text || '').split('\n')[0] || '';
  console.log(JSON.stringify({
    exportHeader: csvHead,
    hasInternshipColumns: csvHead.includes('Internship Status') && csvHead.includes('Progress %')
  }, null, 2));
})().catch((error) => {
  console.error(error?.message || error);
  process.exit(1);
});
