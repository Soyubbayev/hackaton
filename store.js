const fs = require('fs');
const path = require('path');

let mode = 'json';
let collection = null;
let client = null;
let filePath = '';
let dataDir = '';
let memory = [];

function ensureFile(seed) {
  try {
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, JSON.stringify(seed || [], null, 2));
    }
  } catch (err) {
    // Read-only filesystem (e.g. Vercel serverless) - keep data in memory
  }
}

function readFile() {
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    return [];
  }
}

function persist() {
  try {
    fs.writeFileSync(filePath, JSON.stringify(memory, null, 2));
  } catch (err) {
    // Read-only filesystem - keep data in memory only
  }
}

async function init(options) {
  filePath = options.file;
  dataDir = path.dirname(filePath);
  ensureFile(options.seed || []);

  if (options.uri) {
    try {
      const { MongoClient } = require('mongodb');
      client = new MongoClient(options.uri, { serverSelectionTimeoutMS: 5000 });
      await client.connect();
      const db = client.db(options.dbName || 'haketon');
      collection = db.collection(options.collectionName || 'employees');
      await collection.createIndex({ id: 1 }, { unique: true });

      const count = await collection.countDocuments();
      if (count === 0) {
        const seedData = readFile();
        if (seedData.length) await collection.insertMany(seedData.map((e) => ({ ...e })));
      }

      mode = 'mongo';
      return { mode, count: await collection.countDocuments() };
    } catch (err) {
      collection = null;
      if (client) {
        try {
          await client.close();
        } catch (closeErr) {
          /* ignore */
        }
      }
      client = null;
    }
  }

  mode = 'json';
  memory = readFile();
  return { mode, count: memory.length };
}

async function loadAll() {
  if (mode === 'mongo') {
    return collection.find({}, { projection: { _id: 0 } }).sort({ id: 1 }).toArray();
  }
  return memory.slice();
}

async function insert(employee) {
  if (mode === 'mongo') {
    await collection.insertOne({ ...employee });
    return;
  }
  memory.push(employee);
  persist();
}

async function update(id, employee) {
  if (mode === 'mongo') {
    await collection.replaceOne({ id }, { ...employee });
    return;
  }
  const index = memory.findIndex((e) => e.id === id);
  if (index !== -1) {
    memory[index] = employee;
    persist();
  }
}

async function remove(id) {
  if (mode === 'mongo') {
    await collection.deleteOne({ id });
    return;
  }
  memory = memory.filter((e) => e.id !== id);
  persist();
}

function getMode() {
  return mode;
}

module.exports = { init, loadAll, insert, update, remove, getMode };
