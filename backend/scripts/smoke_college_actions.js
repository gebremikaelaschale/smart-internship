/* eslint-disable no-console */
require('dotenv').config();

const BASE_URL = process.env.SMOKE_BASE_URL || 'http://localhost:5000';
const SUPERADMIN_EMAIL = process.env.SMOKE_SUPERADMIN_EMAIL || 'admin@uog.edu';
const SUPERADMIN_PASSWORD = process.env.SMOKE_SUPERADMIN_PASSWORD || 'AdminPassword123!';

async function postJson(url, payload, token) {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: JSON.stringify(payload || {})
  });

  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }

  if (!response.ok) {
    throw new Error(`POST ${url} failed (${response.status}): ${JSON.stringify(data)}`);
  }

  return data;
}

async function get(url, token) {
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    }
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`GET ${url} failed (${response.status}): ${text}`);
  }

  return { response, text };
}

async function run() {
  const uniq = Date.now();
  const login = await postJson(`${BASE_URL}/auth/login`, {
    email: SUPERADMIN_EMAIL,
    password: SUPERADMIN_PASSWORD
  });

  const token = login?.token;
  if (!token) {
    throw new Error('SuperAdmin login did not return token.');
  }

  const created = await postJson(`${BASE_URL}/api/admin/colleges`, {
    name: `College Actions Smoke ${uniq}`,
    dean: {
      name: `Dean Actions Smoke ${uniq}`,
      email: `dean.actions.${uniq}@uog.edu.et`
    }
  }, token);

  const createdCollegeId = created?.college?._id;
  if (!createdCollegeId) {
    throw new Error('Failed to create isolated smoke college.');
  }

  const exportResult = await get(`${BASE_URL}/api/admin/colleges/export`, token);
  const csvPreview = String(exportResult.text || '').split('\n').slice(0, 3).join('\n');

  const resetResponse = await postJson(
    `${BASE_URL}/api/admin/colleges/${createdCollegeId}/dean/reset-password`,
    {},
    token
  );
  const resetMessage = resetResponse?.message || 'Dean password reset endpoint succeeded.';

  console.log('College actions smoke passed.');
  console.log(JSON.stringify({
    createdCollegeId,
    export: {
      contentType: exportResult.response.headers.get('content-type'),
      hasCsvHeader: csvPreview.toLowerCase().includes('college,dean name,dean email,departments,status,created at'),
      preview: csvPreview
    },
    resetDeanPassword: {
      collegeId: createdCollegeId,
      message: resetMessage
    }
  }, null, 2));
}

run().catch((error) => {
  console.error('College actions smoke failed.');
  console.error(error?.message || error);
  process.exit(1);
});
