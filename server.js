const http = require('http');
const fs = require('fs');
const path = require('path');
const store = require('./store');

function loadEnv() {
  const envPath = path.join(__dirname, '.env');
  if (!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadEnv();

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');
const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'employees.json');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const STATUSES = ['active', 'inactive'];
const SORTABLE = ['id', 'firstName', 'lastName', 'email', 'position', 'department', 'salary', 'hireDate', 'status'];

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
};

let employees = [];
let nextId = 1;

async function loadData() {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, '[]');
  } catch (err) {
    // Read-only filesystem (e.g. Vercel serverless) - handled in memory
  }

  const result = await store.init({
    uri: process.env.MONGODB_URI,
    dbName: process.env.MONGODB_DB || 'haketon',
    collectionName: process.env.MONGODB_COLLECTION || 'employees',
    file: DATA_FILE,
  });

  employees = await store.loadAll();
  nextId = employees.reduce((max, e) => Math.max(max, Number(e.id) || 0), 0) + 1;

  if (result.mode === 'mongo') {
    console.log(`Ma'lumotlar bazasi: MongoDB (${result.count} ta xodim)`);
  } else {
    const suffix = result.error ? ` (MongoDB ulanmadi: ${result.error})` : '';
    console.log(`Ma'lumotlar bazasi: JSON fayl${suffix}`);
  }
}

function sendJson(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
}

function readBody(req) {
  if (process.env.VERCEL) {
    try {
      return Promise.resolve(req.body || {});
    } catch (err) {
      return Promise.reject(new Error('INVALID_JSON'));
    }
  }
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
      if (data.length > 1e6) req.destroy();
    });
    req.on('end', () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch (err) {
        reject(new Error('INVALID_JSON'));
      }
    });
    req.on('error', reject);
  });
}

function validateEmployee(body, ignoreId = null) {
  const errors = {};
  const firstName = String(body.firstName ?? '').trim();
  const lastName = String(body.lastName ?? '').trim();
  const email = String(body.email ?? '').trim().toLowerCase();
  const phone = String(body.phone ?? '').trim();
  const position = String(body.position ?? '').trim();
  const department = String(body.department ?? '').trim();
  const status = STATUSES.includes(body.status) ? body.status : 'active';

  if (!firstName) errors.firstName = 'Ism kiritilishi shart';
  else if (firstName.length > 60) errors.firstName = 'Ism juda uzun';

  if (!lastName) errors.lastName = 'Familiya kiritilishi shart';
  else if (lastName.length > 60) errors.lastName = 'Familiya juda uzun';

  if (!email) errors.email = 'Email kiritilishi shart';
  else if (!EMAIL_RE.test(email)) errors.email = 'Email formati noto`g`ri';
  else if (employees.some((e) => e.email.toLowerCase() === email && e.id !== ignoreId)) {
    errors.email = 'Bu email allaqachon mavjud';
  }

  if (!position) errors.position = 'Lavozim kiritilishi shart';
  if (!department) errors.department = 'Bo`lim kiritilishi shart';

  let salary = 0;
  if (body.salary !== undefined && body.salary !== null && body.salary !== '') {
    const num = Number(body.salary);
    if (!Number.isFinite(num) || num < 0) errors.salary = 'Maosh noto`g`ri';
    else salary = Math.round(num);
  }

  let hireDate = '';
  if (body.hireDate) {
    const value = String(body.hireDate).trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(value))) {
      errors.hireDate = 'Sana YYYY-MM-DD formatida bo`lishi kerak';
    } else {
      hireDate = value;
    }
  }

  if (Object.keys(errors).length) return { errors };

  return {
    data: { firstName, lastName, email, phone, position, department, salary, hireDate, status },
  };
}

function listEmployees(params) {
  let list = employees.slice();

  const search = (params.get('search') || '').trim().toLowerCase();
  if (search) {
    list = list.filter((e) => {
      const haystack = `${e.firstName} ${e.lastName} ${e.email} ${e.position} ${e.department}`.toLowerCase();
      return haystack.includes(search);
    });
  }

  const department = params.get('department');
  if (department) list = list.filter((e) => e.department === department);

  const status = params.get('status');
  if (status) list = list.filter((e) => e.status === status);

  const sort = SORTABLE.includes(params.get('sort')) ? params.get('sort') : 'id';
  const order = params.get('order') === 'desc' ? -1 : 1;

  list.sort((a, b) => {
    if (sort === 'id' || sort === 'salary') {
      return ((Number(a[sort]) || 0) - (Number(b[sort]) || 0)) * order;
    }
    return String(a[sort] ?? '').localeCompare(String(b[sort] ?? ''), 'uz') * order;
  });

  return list;
}

function csvCell(value) {
  const text = value === null || value === undefined ? '' : String(value);
  return '"' + text.replace(/"/g, '""') + '"';
}

function toCsv(list) {
  const header = ['ID', 'Ism', 'Familiya', 'Email', 'Telefon', 'Lavozim', "Bo'lim", 'Maosh', 'Ishga kirgan sana', 'Holat'];
  const rows = list.map((e) => [
    e.id,
    e.firstName,
    e.lastName,
    e.email,
    e.phone,
    e.position,
    e.department,
    e.salary,
    e.hireDate,
    e.status === 'active' ? 'Faol' : 'Nofaol',
  ]);
  return '\uFEFF' + [header, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n');
}

function serveStatic(req, res) {
  let urlPath = decodeURIComponent(req.url.split('?')[0]);
  if (urlPath === '/') urlPath = '/index.html';

  const filePath = path.normalize(path.join(PUBLIC_DIR, urlPath));
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('Forbidden');
    return;
  }

  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not Found');
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(content);
  });
}

async function handleRequest(req, res) {
  const { method } = req;
  const url = new URL(req.url, 'http://localhost');
  const pathname = url.pathname;

  try {
    if (pathname === '/api/employees' && method === 'GET') {
      return sendJson(res, 200, listEmployees(url.searchParams));
    }

    if (pathname === '/api/employees' && method === 'POST') {
      const body = await readBody(req);
      const { data, errors } = validateEmployee(body);
      if (errors) return sendJson(res, 400, { errors });
      const employee = { id: nextId++, ...data };
      employees.push(employee);
      await store.insert(employee);
      return sendJson(res, 201, employee);
    }

    if (pathname === '/api/employees' && method !== 'GET' && method !== 'POST') {
      return sendJson(res, 405, { error: 'Method not allowed' });
    }

    if (pathname === '/api/stats' && method === 'GET') {
      const departments = {};
      let totalSalary = 0;
      let newestHire = null;
      for (const e of employees) {
        departments[e.department] = (departments[e.department] || 0) + 1;
        totalSalary += Number(e.salary) || 0;
        if (e.hireDate && (!newestHire || e.hireDate > newestHire.hireDate)) {
          newestHire = { firstName: e.firstName, lastName: e.lastName, hireDate: e.hireDate };
        }
      }
      const total = employees.length;
      const active = employees.filter((e) => e.status === 'active').length;
      return sendJson(res, 200, {
        total,
        active,
        inactive: total - active,
        totalSalary,
        averageSalary: total ? Math.round(totalSalary / total) : 0,
        departments,
        newestHire,
      });
    }

    if (pathname === '/api/departments' && method === 'GET') {
      const list = [...new Set(employees.map((e) => e.department).filter(Boolean))].sort((a, b) =>
        a.localeCompare(b, 'uz')
      );
      return sendJson(res, 200, list);
    }

    if (pathname === '/api/employees/export' && method === 'GET') {
      const csv = toCsv(listEmployees(url.searchParams));
      res.writeHead(200, {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="xodimlar.csv"',
      });
      res.end(csv);
      return;
    }

    const match = pathname.match(/^\/api\/employees\/(\d+)$/);
    if (match) {
      const id = Number(match[1]);
      const index = employees.findIndex((e) => e.id === id);
      if (index === -1) return sendJson(res, 404, { error: 'Xodim topilmadi' });

      if (method === 'GET') return sendJson(res, 200, employees[index]);

      if (method === 'PUT' || method === 'PATCH') {
        const body = await readBody(req);
        const { data, errors } = validateEmployee(body, id);
        if (errors) return sendJson(res, 400, { errors });
        employees[index] = { ...employees[index], ...data, id };
        await store.update(id, employees[index]);
        return sendJson(res, 200, employees[index]);
      }

      if (method === 'DELETE') {
        const removed = employees.splice(index, 1)[0];
        await store.remove(id);
        return sendJson(res, 200, removed);
      }

      return sendJson(res, 405, { error: 'Method not allowed' });
    }

    if (pathname.startsWith('/api/')) {
      return sendJson(res, 404, { error: 'Endpoint topilmadi' });
    }

    return serveStatic(req, res);
  } catch (err) {
    if (err && err.message === 'INVALID_JSON') {
      return sendJson(res, 400, { error: 'JSON noto`g`ri' });
    }
    return sendJson(res, 500, { error: 'Server xatosi' });
  }
}

let initPromise = null;

function ensureInit() {
  if (!initPromise) initPromise = loadData();
  return initPromise;
}

const server = http.createServer((req, res) => {
  ensureInit()
    .then(() => handleRequest(req, res))
    .catch((err) => {
      console.error('Init xatosi:', err);
      if (!res.headersSent) sendJson(res, 500, { error: 'Server xatosi' });
    });
});

if (require.main === module) {
  ensureInit()
    .then(() => {
      server.listen(PORT, () => {
        console.log(`Server ishga tushdi: http://localhost:${PORT}`);
      });
    })
    .catch((err) => {
      console.error('Server ishga tushmadi:', err);
      process.exit(1);
    });
}

module.exports = async function handler(req, res) {
  await ensureInit();
  return handleRequest(req, res);
};
