const fs = require('fs');
const path = require('path');

let mode = 'json';
let collection = null;
let client = null;
let filePath = '';
let dataDir = '';

function ensureFile(seed) {
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify(seed || [], null, 2));
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

function writeFile(list) {
  fs.writeFileSync(filePath, JSON.stringify(list, null, 2));
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
      mode = 'json';
      return { mode, count: readFile().length, error: err.message };
    }
  }

  mode = 'json';
  return { mode, count: readFile().length };
}

async function loadAll() {
  if (mode === 'mongo') {
    return collection.find({}, { projection: { _id: 0 } }).sort({ id: 1 }).toArray();
  }
  return readFile();
}

async function insert(employee) {
  if (mode === 'mongo') {
    await collection.insertOne({ ...employee });
    return;
  }
  const list = readFile();
  list.push(employee);
  writeFile(list);
}

async function update(id, employee) {
  if (mode === 'mongo') {
    await collection.replaceOne({ id }, { ...employee });
    return;
  }
  const list = readFile();
  const index = list.findIndex((e) => e.id === id);
  if (index !== -1) {
    list[index] = employee;
    writeFile(list);
  }
}

async function remove(id) {
  if (mode === 'mongo') {
    await collection.deleteOne({ id });
    return;
  }
  const list = readFile().filter((e) => e.id !== id);
  writeFile(list);
}

function getMode() {
  return mode;
}

module.exports = { init, loadAll, insert, update, remove, getMode };
