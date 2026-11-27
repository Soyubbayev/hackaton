const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');

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

let todos = [{ id: 1, text: 'Loyihani GitHubga yuklash', done: false }];
let nextId = 2;

function sendJson(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
}

function readBody(req) {
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
        reject(err);
      }
    });
    req.on('error', reject);
  });
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

const server = http.createServer(async (req, res) => {
  const { method } = req;
  const url = req.url.split('?')[0];

  try {
    if (url === '/api/todos' && method === 'GET') {
      return sendJson(res, 200, todos);
    }

    if (url === '/api/todos' && method === 'POST') {
      const body = await readBody(req);
      const text = String(body.text || '').trim();
      if (!text) return sendJson(res, 400, { error: 'text kerak' });
      const todo = { id: nextId++, text, done: false };
      todos.push(todo);
      return sendJson(res, 201, todo);
    }

    const match = url.match(/^\/api\/todos\/(\d+)$/);
    if (match) {
      const id = Number(match[1]);
      const index = todos.findIndex((t) => t.id === id);
      if (index === -1) return sendJson(res, 404, { error: 'topilmadi' });

      if (method === 'PATCH' || method === 'PUT') {
        const body = await readBody(req);
        if (typeof body.done === 'boolean') todos[index].done = body.done;
        if (typeof body.text === 'string' && body.text.trim()) {
          todos[index].text = body.text.trim();
        }
        return sendJson(res, 200, todos[index]);
      }

      if (method === 'DELETE') {
        todos.splice(index, 1);
        return sendJson(res, 200, { ok: true });
      }
    }

    if (url.startsWith('/api/')) {
      return sendJson(res, 404, { error: 'endpoint topilmadi' });
    }

    return serveStatic(req, res);
  } catch (err) {
    return sendJson(res, 500, { error: 'server xatosi' });
  }
});

server.listen(PORT, () => {
  console.log(`Server ishga tushdi: http://localhost:${PORT}`);
});
