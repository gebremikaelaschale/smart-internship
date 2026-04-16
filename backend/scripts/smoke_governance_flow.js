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
    body: JSON.stringify(payload)
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

async function getJson(url, token) {
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    }
  });

  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }

  if (!response.ok) {
    throw new Error(`GET ${url} failed (${response.status}): ${JSON.stringify(data)}`);
  }

  return data;
}

async function postExpectStatus(url, payload, expectedStatus, token) {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: JSON.stringify(payload)
  });

  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }

  if (response.status !== expectedStatus) {
    throw new Error(`POST ${url} expected status ${expectedStatus}, got ${response.status}: ${JSON.stringify(data)}`);
  }

  return data;
}

async function run() {
  const uniq = Date.now();
  const collegeName = `College Smoke ${uniq}`;
  const departmentName = `Department Smoke ${uniq}`;
  const deanEmail = `dean.smoke.${uniq}@uog.edu.et`;
  const hodEmail = `hod.smoke.${uniq}@uog.edu.et`;

  const superadminLogin = await postJson(`${BASE_URL}/auth/login`, {
    email: SUPERADMIN_EMAIL,
    password: SUPERADMIN_PASSWORD
  });

  const adminToken = superadminLogin?.token;
  if (!adminToken) {
    throw new Error('SuperAdmin login did not return token.');
  }

  const collegeCreate = await postJson(`${BASE_URL}/api/admin/colleges`, {
    name: collegeName,
    dean: {
      name: `Dean Smoke ${uniq}`,
      email: deanEmail
    }
  }, adminToken);

  const collegeId = collegeCreate?.college?._id;
  const deanPassword = collegeCreate?.temporaryPassword;
  if (!collegeId || !deanPassword) {
    throw new Error('College creation did not return expected collegeId/temporaryPassword.');
  }

  const deniedDepartmentCreate = await postExpectStatus(`${BASE_URL}/api/admin/departments`, {
    name: departmentName,
    collegeId,
    head: {
      name: `HOD Smoke ${uniq}`,
      email: hodEmail
    }
  }, 403, adminToken);

  const deanLogin = await postJson(`${BASE_URL}/auth/login`, {
    email: deanEmail,
    password: deanPassword
  });
  if (deanLogin?.user?.role !== 'dean') {
    throw new Error(`Expected dean role, got ${deanLogin?.user?.role || 'unknown'}`);
  }

  const departmentCreate = await postJson(`${BASE_URL}/api/admin/departments`, {
    name: departmentName,
    collegeId,
    head: {
      name: `HOD Smoke ${uniq}`,
      email: hodEmail
    }
  }, deanLogin.token);

  const hodPassword = departmentCreate?.temporaryPassword;
  if (!hodPassword) {
    throw new Error('Department creation did not return HOD temporaryPassword.');
  }

  const hodLogin = await postJson(`${BASE_URL}/auth/login`, {
    email: hodEmail,
    password: hodPassword
  });
  if (hodLogin?.user?.role !== 'hod') {
    throw new Error(`Expected hod role, got ${hodLogin?.user?.role || 'unknown'}`);
  }

  const deanDashboard = await getJson(`${BASE_URL}/api/admin/college`, deanLogin.token);
  const hodDashboard = await getJson(`${BASE_URL}/api/admin/department`, hodLogin.token);

  console.log('Governance smoke test passed.');
  console.log(JSON.stringify({
    created: {
      collegeId,
      departmentId: departmentCreate?.department?._id,
      deanEmail,
      hodEmail
    },
    hierarchyRules: {
      superadminCreateDepartmentDenied: true,
      denialMessage: deniedDepartmentCreate?.message || 'Unauthorized.'
    },
    emailStatus: {
      deanCredentialsEmailSent: Boolean(collegeCreate?.credentialsEmailSent),
      hodCredentialsEmailSent: Boolean(departmentCreate?.credentialsEmailSent),
      deanEmailError: collegeCreate?.credentialsEmailError || null,
      hodEmailError: departmentCreate?.credentialsEmailError || null
    },
    dean: {
      role: deanLogin?.user?.role,
      adminType: deanLogin?.user?.adminType,
      collegeStats: deanDashboard?.stats || null
    },
    hod: {
      role: hodLogin?.user?.role,
      adminType: hodLogin?.user?.adminType,
      departmentStats: hodDashboard?.stats || null
    }
  }, null, 2));
}

run().catch((error) => {
  console.error('Governance smoke test failed.');
  console.error(error?.message || error);
  process.exit(1);
});
