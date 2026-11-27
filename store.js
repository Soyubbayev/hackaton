const fs = require('fs');
const path = require('path');

let mode = 'json';
let client = null;
let employeesCollection = null;
let attendanceCollection = null;
let employeesFile = '';
let attendanceFile = '';
let employeesMemory = [];
let attendanceMemory = [];

function ensureFile(file, seed) {
  try {
    const dir = path.dirname(file);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    if (!fs.existsSync(file)) fs.writeFileSync(file, JSON.stringify(seed || [], null, 2));
  } catch (err) {
    // Read-only filesystem (e.g. Vercel serverless) - keep data in memory
  }
}

function readFile(file) {
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    return [];
  }
}

function writeFile(file, list) {
  try {
    fs.writeFileSync(file, JSON.stringify(list, null, 2));
  } catch (err) {
    // Read-only filesystem - keep data in memory only
  }
}

async function init(options) {
  employeesFile = options.file;
  attendanceFile = options.attendanceFile || path.join(path.dirname(options.file), 'attendance.json');

  ensureFile(employeesFile, []);
  ensureFile(attendanceFile, []);

  if (options.uri) {
    try {
      const { MongoClient } = require('mongodb');
      client = new MongoClient(options.uri, { serverSelectionTimeoutMS: 5000 });
      await client.connect();
      const db = client.db(options.dbName || 'haketon');
      employeesCollection = db.collection(options.collectionName || 'employees');
      attendanceCollection = db.collection(options.attendanceCollection || 'attendance');

      try {
        await employeesCollection.createIndex({ id: 1 }, { unique: true });
      } catch (indexErr) {
        /* ignore */
      }
      try {
        await attendanceCollection.createIndex({ employeeId: 1, date: 1 }, { unique: true });
      } catch (indexErr) {
        /* ignore */
      }

      const count = await employeesCollection.countDocuments();
      if (count === 0) {
        const seed = readFile(employeesFile);
        if (seed.length) await employeesCollection.insertMany(seed.map((e) => ({ ...e })));
      }

      mode = 'mongo';
      return { mode, count: await employeesCollection.countDocuments() };
    } catch (err) {
      employeesCollection = null;
      attendanceCollection = null;
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
  employeesMemory = readFile(employeesFile);
  attendanceMemory = readFile(attendanceFile);
  return { mode, count: employeesMemory.length };
}

async function loadAll() {
  if (mode === 'mongo') {
    return employeesCollection.find({}, { projection: { _id: 0 } }).sort({ id: 1 }).toArray();
  }
  return employeesMemory.slice();
}

async function insert(employee) {
  if (mode === 'mongo') {
    await employeesCollection.insertOne({ ...employee });
    return;
  }
  employeesMemory.push(employee);
  writeFile(employeesFile, employeesMemory);
}

async function update(id, employee) {
  if (mode === 'mongo') {
    await employeesCollection.replaceOne({ id }, { ...employee });
    return;
  }
  const index = employeesMemory.findIndex((e) => e.id === id);
  if (index !== -1) {
    employeesMemory[index] = employee;
    writeFile(employeesFile, employeesMemory);
  }
}

async function remove(id) {
  if (mode === 'mongo') {
    await employeesCollection.deleteOne({ id });
    return;
  }
  employeesMemory = employeesMemory.filter((e) => e.id !== id);
  writeFile(employeesFile, employeesMemory);
}

async function loadAttendance(date) {
  if (mode === 'mongo') {
    return attendanceCollection.find({ date }, { projection: { _id: 0 } }).toArray();
  }
  return attendanceMemory.filter((record) => record.date === date);
}

async function saveAttendance(record) {
  if (mode === 'mongo') {
    await attendanceCollection.replaceOne(
      { employeeId: record.employeeId, date: record.date },
      { ...record },
      { upsert: true }
    );
    return;
  }
  const index = attendanceMemory.findIndex(
    (r) => r.employeeId === record.employeeId && r.date === record.date
  );
  if (index === -1) attendanceMemory.push(record);
  else attendanceMemory[index] = record;
  writeFile(attendanceFile, attendanceMemory);
}

function getMode() {
  return mode;
}

module.exports = { init, loadAll, insert, update, remove, loadAttendance, saveAttendance, getMode };
