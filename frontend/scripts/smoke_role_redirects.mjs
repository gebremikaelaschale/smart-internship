import { resolveDashboardRoute } from '../src/utils/roleRedirect.js';

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

  const raw = await response.text();
  let data = null;
  try {
    data = raw ? JSON.parse(raw) : null;
  } catch {
    data = { raw };
  }
  if (!response.ok) {
    throw new Error(`POST ${url} failed (${response.status}): ${raw}`);
  }
  return data;
}

function assertEqual(label, actual, expected) {
  if (actual !== expected) {
    throw new Error(`${label} mismatch: expected ${expected}, got ${actual}`);
  }
}

async function run() {
  const uniq = Date.now();

  const superLogin = await postJson(`${BASE_URL}/auth/login`, {
    email: SUPERADMIN_EMAIL,
    password: SUPERADMIN_PASSWORD
  });

  const adminToken = superLogin?.token;
  if (!adminToken) {
    throw new Error('SuperAdmin login returned no token.');
  }

  const deanEmail = `dean.redirect.${uniq}@uog.edu.et`;
  const hodEmail = `hod.redirect.${uniq}@uog.edu.et`;

  const college = await postJson(`${BASE_URL}/api/admin/colleges`, {
    name: `College Redirect ${uniq}`,
    dean: {
      name: `Dean Redirect ${uniq}`,
      email: deanEmail
    }
  }, adminToken);

  const collegeId = college?.college?._id;
  const deanPassword = college?.temporaryPassword;
  if (!collegeId || !deanPassword) {
    throw new Error('College creation did not return expected values for dean test.');
  }

  const deanLogin = await postJson(`${BASE_URL}/auth/login`, {
    email: deanEmail,
    password: deanPassword
  });

  const department = await postJson(`${BASE_URL}/api/admin/departments`, {
    name: `Department Redirect ${uniq}`,
    collegeId,
    head: {
      name: `HOD Redirect ${uniq}`,
      email: hodEmail
    }
  }, deanLogin.token);

  const hodPassword = department?.temporaryPassword;
  if (!hodPassword) {
    throw new Error('Department creation did not return expected values for HOD test.');
  }

  const hodLogin = await postJson(`${BASE_URL}/auth/login`, {
    email: hodEmail,
    password: hodPassword
  });

  const superRoute = resolveDashboardRoute(superLogin?.user?.role, superLogin?.user?.adminType);
  const deanRoute = resolveDashboardRoute(deanLogin?.user?.role, deanLogin?.user?.adminType);
  const hodRoute = resolveDashboardRoute(hodLogin?.user?.role, hodLogin?.user?.adminType);

  assertEqual('superadmin route', superRoute, '/admin/dashboard');
  assertEqual('dean route', deanRoute, '/dean/dashboard');
  assertEqual('hod route', hodRoute, '/hod/dashboard');

  console.log('Role redirect smoke test passed.');
  console.log(JSON.stringify({
    superadmin: {
      role: superLogin?.user?.role,
      adminType: superLogin?.user?.adminType,
      route: superRoute
    },
    dean: {
      role: deanLogin?.user?.role,
      adminType: deanLogin?.user?.adminType,
      route: deanRoute
    },
    hod: {
      role: hodLogin?.user?.role,
      adminType: hodLogin?.user?.adminType,
      route: hodRoute
    }
  }, null, 2));
}

run().catch((error) => {
  console.error('Role redirect smoke test failed.');
  console.error(error?.message || error);
  process.exit(1);
});
