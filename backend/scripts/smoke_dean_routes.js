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
  const contentType = String(response.headers.get('content-type') || '');
  const isJson = contentType.includes('application/json');
  let data = text;
  if (isJson) {
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = { raw: text };
    }
  }

  if (!expect.includes(response.status)) {
    throw new Error(`${method} ${url} failed (${response.status}): ${isJson ? JSON.stringify(data) : text.slice(0, 300)}`);
  }

  return { status: response.status, data, headers: response.headers, raw: text };
}

(async () => {
  const uniq = Date.now();
  const deanEmail = `dean.routes.${uniq}@uog.edu.et`;

  const login = await request('POST', `${BASE_URL}/auth/login`, {
    body: { email: SUPERADMIN_EMAIL, password: SUPERADMIN_PASSWORD }
  });
  const adminToken = login.data?.token;
  if (!adminToken) throw new Error('No superadmin token.');

  const college = await request('POST', `${BASE_URL}/api/admin/colleges`, {
    token: adminToken,
    body: {
      name: `Dean Routes College ${uniq}`,
      dean: { name: `Dean Routes ${uniq}`, email: deanEmail }
    }
  });

  const deanPassword = college.data?.temporaryPassword;
  const collegeId = college.data?.college?._id;
  if (!deanPassword || !collegeId) throw new Error('Dean password or collegeId missing after college creation.');

  const deanLogin = await request('POST', `${BASE_URL}/auth/login`, {
    body: { email: deanEmail, password: deanPassword }
  });
  const deanToken = deanLogin.data?.token;
  if (!deanToken) throw new Error('No dean token.');

  const createdDept = await request('POST', `${BASE_URL}/api/admin/departments`, {
    token: deanToken,
    body: { name: `Dean Route Dept ${uniq}`, collegeId }
  });
  const departmentId = createdDept.data?.department?._id;
  if (!departmentId) throw new Error('Department create failed to return id.');

  const updatedName = `Dean Route Dept Edited ${uniq}`;
  await request('PUT', `${BASE_URL}/api/admin/departments/${departmentId}`, {
    token: deanToken,
    body: { name: updatedName }
  });

  await request('PUT', `${BASE_URL}/api/admin/departments/${departmentId}/head`, {
    token: deanToken,
    body: { headId: '' }
  });

  const checks = {
    dashboard: await request('GET', `${BASE_URL}/api/admin/college`, { token: deanToken }),
    departments: await request('GET', `${BASE_URL}/api/admin/departments`, { token: deanToken }),
    hodCandidates: await request('GET', `${BASE_URL}/api/admin/department-heads`, { token: deanToken }),
    students: await request('GET', `${BASE_URL}/api/admin/students?page=1&limit=10`, { token: deanToken }),
    analytics: await request('GET', `${BASE_URL}/api/admin/analytics`, { token: deanToken }),
    requests: await request('GET', `${BASE_URL}/api/admin/applications?page=1&limit=10`, { token: deanToken }),
    settings: await request('GET', `${BASE_URL}/api/admin/settings`, { token: deanToken }),
    security: await request('GET', `${BASE_URL}/api/admin/security-overview`, { token: deanToken }),
    messagesContacts: await request('GET', `${BASE_URL}/api/messages/contacts`, { token: deanToken })
  };

  const exportApps = await request('GET', `${BASE_URL}/api/admin/applications/export?status=all&reason=Dean%20route%20verification%20export`, {
    token: deanToken,
    expect: [200]
  });

  console.log(JSON.stringify({
    dean: {
      email: deanEmail,
      role: deanLogin.data?.user?.role,
      adminType: deanLogin.data?.user?.adminType
    },
    actions: {
      createDepartment: Boolean(departmentId),
      editDepartment: true,
      assignHod: true
    },
    routeChecks: {
      dashboard: checks.dashboard.status,
      departments: checks.departments.status,
      hodManagement: checks.hodCandidates.status,
      students: checks.students.status,
      analytics: checks.analytics.status,
      requests: checks.requests.status,
      settings: checks.settings.status,
      messages: checks.messagesContacts.status
    },
    exportApplications: {
      status: exportApps.status,
      contentType: String(exportApps.headers.get('content-type') || ''),
      startsWithCsvHeader: String(exportApps.raw || '').toLowerCase().startsWith('student,email,internship,status')
    }
  }, null, 2));
})().catch((error) => {
  console.error(error?.message || error);
  process.exit(1);
});
