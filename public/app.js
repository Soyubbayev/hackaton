const els = {
  search: document.getElementById('search'),
  filterDepartment: document.getElementById('filterDepartment'),
  filterStatus: document.getElementById('filterStatus'),
  exportBtn: document.getElementById('exportBtn'),
  tableBody: document.getElementById('tableBody'),
  empty: document.getElementById('empty'),
  addBtn: document.getElementById('addBtn'),
  tabEmployees: document.getElementById('tabEmployees'),
  tabAttendance: document.getElementById('tabAttendance'),
  employeesView: document.getElementById('employeesView'),
  attendanceView: document.getElementById('attendanceView'),
  attendanceDate: document.getElementById('attendanceDate'),
  attPresent: document.getElementById('attPresent'),
  attAbsent: document.getElementById('attAbsent'),
  attUnmarked: document.getElementById('attUnmarked'),
  attSearch: document.getElementById('attSearch'),
  attList: document.getElementById('attList'),
  attEmpty: document.getElementById('attEmpty'),
  modal: document.getElementById('modal'),
  modalTitle: document.getElementById('modalTitle'),
  form: document.getElementById('employeeForm'),
  saveBtn: document.getElementById('saveBtn'),
  employeeId: document.getElementById('employeeId'),
  firstName: document.getElementById('firstName'),
  lastName: document.getElementById('lastName'),
  email: document.getElementById('email'),
  phone: document.getElementById('phone'),
  position: document.getElementById('position'),
  department: document.getElementById('department'),
  departmentList: document.getElementById('departmentList'),
  salary: document.getElementById('salary'),
  hireDate: document.getElementById('hireDate'),
  status: document.getElementById('status'),
  statTotal: document.getElementById('statTotal'),
  statActive: document.getElementById('statActive'),
  statInactive: document.getElementById('statInactive'),
  statSalary: document.getElementById('statSalary'),
  statAverage: document.getElementById('statAverage'),
  statDepts: document.getElementById('statDepts'),
  statNewest: document.getElementById('statNewest'),
  storageMode: document.getElementById('storageMode'),
  deptChart: document.getElementById('deptChart'),
  deleteModal: document.getElementById('deleteModal'),
  deleteText: document.getElementById('deleteText'),
  confirmDeleteBtn: document.getElementById('confirmDeleteBtn'),
  absenceModal: document.getElementById('absenceModal'),
  absenceForm: document.getElementById('absenceForm'),
  absenceEmp: document.getElementById('absenceEmp'),
  absenceReason: document.getElementById('absenceReason'),
  absenceSave: document.getElementById('absenceSave'),
  toast: document.getElementById('toast'),
};

const ERROR_FIELDS = [
  'firstName',
  'lastName',
  'email',
  'phone',
  'position',
  'department',
  'salary',
  'hireDate',
  'status',
];

const AVATAR_COLORS = [
  '#2563eb',
  '#7c3aed',
  '#db2777',
  '#ea580c',
  '#0891b2',
  '#16a34a',
  '#9333ea',
  '#dc2626',
  '#0d9488',
  '#b45309',
];

const state = {
  sort: 'id',
  order: 'asc',
  deleteTarget: null,
  absenceTarget: null,
  attendance: {},
  employees: [],
  view: 'employees',
};

async function api(path, options = {}) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });

  const text = await res.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch (err) {
      data = null;
    }
  }

  if (!res.ok) {
    const error = new Error((data && (data.error || 'Xatolik yuz berdi')) || 'Xatolik yuz berdi');
    error.status = res.status;
    error.data = data;
    throw error;
  }

  return data;
}

function todayStr() {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

function formatMoney(value) {
  return Number(value || 0).toLocaleString('uz-UZ').replace(/\u00a0/g, ' ') + " so'm";
}

function formatMoneyCompact(value) {
  const n = Number(value) || 0;
  const trim = (x) => x.toFixed(1).replace(/\.0$/, '');
  if (n >= 1e9) return trim(n / 1e9) + ' mlrd';
  if (n >= 1e6) return trim(n / 1e6) + ' mln';
  if (n >= 1e3) return Math.round(n / 1e3) + ' ming';
  return String(n);
}

function formatDate(value) {
  if (!value) return null;
  const parts = String(value).split('-');
  if (parts.length !== 3) return value;
  return parts[2] + '.' + parts[1] + '.' + parts[0];
}

function initials(first, last) {
  const a = (first || '').trim().charAt(0);
  const b = (last || '').trim().charAt(0);
  return (a + b).toUpperCase() || '?';
}

function colorFor(id) {
  return AVATAR_COLORS[Number(id) % AVATAR_COLORS.length];
}

function cell(text) {
  const td = document.createElement('td');
  td.textContent = text;
  return td;
}

function debounce(fn, delay) {
  let timer = null;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

function buildAttendanceControls(emp) {
  const wrap = document.createElement('div');
  wrap.className = 'attendance';
  const record = state.attendance[emp.id];

  const presentBtn = document.createElement('button');
  presentBtn.type = 'button';
  presentBtn.className = 'att-btn present' + (record && record.status === 'present' ? ' active' : '');
  presentBtn.title = 'Keldi';
  presentBtn.textContent = '\u2713';
  presentBtn.addEventListener('click', () => markPresent(emp));

  const absentBtn = document.createElement('button');
  absentBtn.type = 'button';
  absentBtn.className = 'att-btn absent' + (record && record.status === 'absent' ? ' active' : '');
  absentBtn.title = 'Kelmadi';
  absentBtn.textContent = '\u2715';
  absentBtn.addEventListener('click', () => openAbsenceModal(emp));

  wrap.append(presentBtn, absentBtn);

  if (record && record.status === 'absent' && record.reason) {
    const reason = document.createElement('span');
    reason.className = 'att-reason';
    reason.textContent = record.reason;
    reason.title = record.reason;
    wrap.append(reason);
  }

  return wrap;
}

function renderTable(list) {
  els.tableBody.innerHTML = '';
  els.empty.hidden = list.length > 0;

  for (const emp of list) {
    const tr = document.createElement('tr');

    const nameTd = document.createElement('td');
    const cellWrap = document.createElement('div');
    cellWrap.className = 'employee-cell';

    const avatar = document.createElement('span');
    avatar.className = 'avatar';
    avatar.textContent = initials(emp.firstName, emp.lastName);
    avatar.style.background = colorFor(emp.id);

    const info = document.createElement('div');
    info.className = 'employee-info';
    const name = document.createElement('span');
    name.className = 'employee-name';
    name.textContent = emp.firstName + ' ' + emp.lastName;
    const email = document.createElement('span');
    email.className = 'employee-email';
    email.textContent = emp.email;
    info.append(name, email);

    cellWrap.append(avatar, info);
    nameTd.append(cellWrap);
    tr.append(nameTd);

    tr.append(cell(emp.position || '—'));

    const deptTd = document.createElement('td');
    const chip = document.createElement('span');
    chip.className = 'chip';
    chip.textContent = emp.department || '—';
    deptTd.append(chip);
    tr.append(deptTd);

    const contactTd = document.createElement('td');
    const contact = document.createElement('div');
    contact.className = 'contact';
    const phone = document.createElement('span');
    phone.className = 'phone';
    phone.textContent = emp.phone || '—';
    contact.append(phone);
    contactTd.append(contact);
    tr.append(contactTd);

    const salaryTd = document.createElement('td');
    salaryTd.textContent = formatMoney(emp.salary);
    tr.append(salaryTd);

    tr.append(cell(formatDate(emp.hireDate) || '—'));

    const statusTd = document.createElement('td');
    const badge = document.createElement('span');
    badge.className = 'badge ' + (emp.status === 'active' ? 'active' : 'inactive');
    badge.textContent = emp.status === 'active' ? 'Faol' : 'Nofaol';
    statusTd.append(badge);
    tr.append(statusTd);

    const actionsTd = document.createElement('td');
    actionsTd.className = 'actions-col';
    const actions = document.createElement('div');
    actions.className = 'row-actions';

    const editBtn = document.createElement('button');
    editBtn.type = 'button';
    editBtn.className = 'mini-btn';
    editBtn.textContent = 'Tahrirlash';
    editBtn.addEventListener('click', () => openModal(emp));

    const delBtn = document.createElement('button');
    delBtn.type = 'button';
    delBtn.className = 'mini-btn danger';
    delBtn.textContent = "O'chirish";
    delBtn.addEventListener('click', () => openDeleteModal(emp));

    actions.append(editBtn, delBtn);
    actionsTd.append(actions);
    tr.append(actionsTd);

    els.tableBody.append(tr);
  }
}

function renderAttendanceView() {
  const query = (els.attSearch.value || '').trim().toLowerCase();
  const employees = state.employees.filter((emp) => {
    if (!query) return true;
    const haystack = emp.firstName + ' ' + emp.lastName + ' ' + (emp.position || '') + ' ' + (emp.department || '');
    return haystack.toLowerCase().includes(query);
  });

  let present = 0;
  let absent = 0;
  let unmarked = 0;
  for (const emp of state.employees) {
    const record = state.attendance[emp.id];
    if (record && record.status === 'present') present++;
    else if (record && record.status === 'absent') absent++;
    else unmarked++;
  }
  els.attPresent.textContent = present;
  els.attAbsent.textContent = absent;
  els.attUnmarked.textContent = unmarked;

  els.attList.innerHTML = '';
  els.attEmpty.hidden = employees.length > 0;

  for (const emp of employees) {
    const row = document.createElement('div');
    row.className = 'att-row';

    const person = document.createElement('div');
    person.className = 'att-person';

    const avatar = document.createElement('span');
    avatar.className = 'avatar';
    avatar.textContent = initials(emp.firstName, emp.lastName);
    avatar.style.background = colorFor(emp.id);

    const info = document.createElement('div');
    info.className = 'employee-info';
    const name = document.createElement('span');
    name.className = 'employee-name';
    name.textContent = emp.firstName + ' ' + emp.lastName;
    const meta = document.createElement('span');
    meta.className = 'employee-email';
    meta.textContent = (emp.position || '—') + ' \u00b7 ' + (emp.department || '—');
    info.append(name, meta);
    person.append(avatar, info);

    const record = state.attendance[emp.id];
    const badge = document.createElement('span');
    if (record && record.status === 'present') {
      badge.className = 'badge active';
      badge.textContent = 'Keldi';
    } else if (record && record.status === 'absent') {
      badge.className = 'badge inactive';
      badge.textContent = 'Kelmadi';
    } else {
      badge.className = 'badge pending';
      badge.textContent = 'Belgilanmagan';
    }

    row.append(person, badge, buildAttendanceControls(emp));
    els.attList.append(row);
  }
}

function buildQuery() {
  const params = new URLSearchParams();
  const search = els.search.value.trim();
  if (search) params.set('search', search);
  if (els.filterDepartment.value) params.set('department', els.filterDepartment.value);
  if (els.filterStatus.value) params.set('status', els.filterStatus.value);
  params.set('sort', state.sort);
  params.set('order', state.order);
  return params.toString();
}

async function loadEmployees() {
  const list = await api('/api/employees?' + buildQuery());
  state.employees = list;
  renderTable(list);
  renderAttendanceView();
}

async function loadAttendance() {
  const date = els.attendanceDate.value || todayStr();
  const data = await api('/api/attendance?date=' + encodeURIComponent(date));
  const map = {};
  for (const record of data.records) map[record.employeeId] = record;
  state.attendance = map;
}

async function reloadAttendanceView() {
  await loadAttendance();
  renderAttendanceView();
}

async function markPresent(emp) {
  try {
    await api('/api/attendance', {
      method: 'POST',
      body: JSON.stringify({
        employeeId: emp.id,
        date: els.attendanceDate.value || todayStr(),
        status: 'present',
        reason: '',
      }),
    });
    showToast(emp.firstName + ' ' + emp.lastName + ' - keldi');
    await reloadAttendanceView();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function renderChart(departments) {
  const entries = Object.entries(departments).sort((a, b) => b[1] - a[1]);
  const max = entries.reduce((m, entry) => Math.max(m, entry[1]), 0);
  els.deptChart.innerHTML = '';

  if (!entries.length) {
    const p = document.createElement('p');
    p.className = 'muted';
    p.textContent = "Ma'lumot yo'q";
    els.deptChart.append(p);
    return;
  }

  for (const [name, count] of entries) {
    const row = document.createElement('div');
    row.className = 'chart-row';

    const label = document.createElement('span');
    label.className = 'chart-label';
    label.textContent = name;
    label.title = name;

    const track = document.createElement('div');
    track.className = 'chart-track';
    const bar = document.createElement('div');
    bar.className = 'chart-bar';
    bar.style.width = (max ? Math.max(8, (count / max) * 100) : 8) + '%';
    track.append(bar);

    const value = document.createElement('span');
    value.className = 'chart-value';
    value.textContent = count;

    row.append(label, track, value);
    els.deptChart.append(row);
  }
}

async function loadStats() {
  const stats = await api('/api/stats');
  els.statTotal.textContent = stats.total;
  els.statActive.textContent = stats.active;
  els.statInactive.textContent = stats.inactive;
  els.statSalary.textContent = formatMoneyCompact(stats.totalSalary) + " so'm";
  els.statAverage.textContent = formatMoneyCompact(stats.averageSalary) + " so'm";
  els.statDepts.textContent = Object.keys(stats.departments).length;
  els.statNewest.textContent = stats.newestHire
    ? stats.newestHire.firstName + ' ' + stats.newestHire.lastName
    : '—';
  renderChart(stats.departments);
}

async function loadDepartments() {
  const departments = await api('/api/departments');
  const current = els.filterDepartment.value;

  els.filterDepartment.innerHTML = '<option value="">Barcha bo\'limlar</option>';
  for (const dept of departments) {
    const option = document.createElement('option');
    option.value = dept;
    option.textContent = dept;
    els.filterDepartment.append(option);
  }
  els.filterDepartment.value = departments.includes(current) ? current : '';

  els.departmentList.innerHTML = '';
  for (const dept of departments) {
    const option = document.createElement('option');
    option.value = dept;
    els.departmentList.append(option);
  }
}

async function loadStatus() {
  try {
    const status = await api('/api/status');
    els.storageMode.textContent = status.storage === 'mongo' ? 'MongoDB' : 'JSON';
  } catch (err) {
    els.storageMode.textContent = '—';
  }
}

async function refresh() {
  await loadDepartments();
  await loadAttendance();
  await Promise.all([loadStats(), loadEmployees(), loadStatus()]);
}

function showView(view) {
  state.view = view;
  const isAttendance = view === 'attendance';

  els.employeesView.hidden = isAttendance;
  els.attendanceView.hidden = !isAttendance;
  els.tabEmployees.classList.toggle('active', !isAttendance);
  els.tabAttendance.classList.toggle('active', isAttendance);
  els.addBtn.hidden = isAttendance;
}

function updateSortIndicators() {
  document.querySelectorAll('th.sortable').forEach((th) => {
    th.classList.remove('sorted-asc', 'sorted-desc');
    if (th.dataset.sort === state.sort) {
      th.classList.add(state.order === 'asc' ? 'sorted-asc' : 'sorted-desc');
    }
  });
}

function clearErrors() {
  for (const field of ERROR_FIELDS) {
    const input = els[field];
    if (input) input.classList.remove('invalid');
    const message = els.form.querySelector('[data-error="' + field + '"]');
    if (message) message.textContent = '';
  }
}

function showErrors(errors) {
  for (const field of Object.keys(errors)) {
    const input = els[field];
    if (input) input.classList.add('invalid');
    const message = els.form.querySelector('[data-error="' + field + '"]');
    if (message) message.textContent = errors[field];
  }
  const first = Object.keys(errors)[0];
  if (first && els[first]) els[first].focus();
}

function openModal(emp) {
  clearErrors();
  els.form.reset();
  els.employeeId.value = '';

  if (emp) {
    els.modalTitle.textContent = 'Xodimni tahrirlash';
    els.employeeId.value = emp.id;
    els.firstName.value = emp.firstName || '';
    els.lastName.value = emp.lastName || '';
    els.email.value = emp.email || '';
    els.phone.value = emp.phone || '';
    els.position.value = emp.position || '';
    els.department.value = emp.department || '';
    els.salary.value = emp.salary || '';
    els.hireDate.value = emp.hireDate || '';
    els.status.value = emp.status || 'active';
  } else {
    els.modalTitle.textContent = 'Yangi xodim';
    els.status.value = 'active';
  }

  els.modal.hidden = false;
  document.body.style.overflow = 'hidden';
  els.firstName.focus();
}

function closeModal() {
  els.modal.hidden = true;
  document.body.style.overflow = '';
}

function openDeleteModal(emp) {
  state.deleteTarget = emp;
  els.deleteText.textContent =
    '"' + emp.firstName + ' ' + emp.lastName + '" xodimini o\'chirishni tasdiqlaysizmi?';
  els.deleteModal.hidden = false;
  document.body.style.overflow = 'hidden';
  els.confirmDeleteBtn.focus();
}

function closeDeleteModal() {
  state.deleteTarget = null;
  els.deleteModal.hidden = true;
  if (els.modal.hidden && els.absenceModal.hidden) document.body.style.overflow = '';
}

async function confirmDelete() {
  const emp = state.deleteTarget;
  if (!emp) return;

  els.confirmDeleteBtn.disabled = true;
  try {
    await api('/api/employees/' + emp.id, { method: 'DELETE' });
    closeDeleteModal();
    showToast("Xodim o'chirildi");
    await refresh();
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    els.confirmDeleteBtn.disabled = false;
  }
}

function openAbsenceModal(emp) {
  state.absenceTarget = emp;
  els.absenceEmp.textContent = emp.firstName + ' ' + emp.lastName;
  els.absenceReason.value = '';
  els.absenceModal.hidden = false;
  document.body.style.overflow = 'hidden';
  els.absenceReason.focus();
}

function closeAbsenceModal() {
  state.absenceTarget = null;
  els.absenceModal.hidden = true;
  if (els.modal.hidden && els.deleteModal.hidden) document.body.style.overflow = '';
}

async function submitAbsence(event) {
  event.preventDefault();
  const emp = state.absenceTarget;
  if (!emp) return;

  els.absenceSave.disabled = true;
  try {
    await api('/api/attendance', {
      method: 'POST',
      body: JSON.stringify({
        employeeId: emp.id,
        date: els.attendanceDate.value || todayStr(),
        status: 'absent',
        reason: els.absenceReason.value.trim(),
      }),
    });
    closeAbsenceModal();
    showToast(emp.firstName + ' ' + emp.lastName + ' - kelmadi');
    await reloadAttendanceView();
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    els.absenceSave.disabled = false;
  }
}

function collectForm() {
  return {
    firstName: els.firstName.value,
    lastName: els.lastName.value,
    email: els.email.value,
    phone: els.phone.value,
    position: els.position.value,
    department: els.department.value,
    salary: els.salary.value,
    hireDate: els.hireDate.value,
    status: els.status.value,
  };
}

let toastTimer = null;

function showToast(message, type = 'success') {
  els.toast.textContent = message;
  els.toast.className = 'toast show ' + type;
  els.toast.hidden = false;

  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    els.toast.classList.remove('show');
    setTimeout(() => {
      els.toast.hidden = true;
    }, 200);
  }, 2800);
}

els.addBtn.addEventListener('click', () => openModal(null));

els.tabEmployees.addEventListener('click', () => showView('employees'));
els.tabAttendance.addEventListener('click', () => showView('attendance'));

els.modal.querySelectorAll('[data-close]').forEach((element) => {
  element.addEventListener('click', closeModal);
});

els.deleteModal.querySelectorAll('[data-close-delete]').forEach((element) => {
  element.addEventListener('click', closeDeleteModal);
});

els.absenceModal.querySelectorAll('[data-close-absence]').forEach((element) => {
  element.addEventListener('click', closeAbsenceModal);
});

els.confirmDeleteBtn.addEventListener('click', confirmDelete);
els.absenceForm.addEventListener('submit', submitAbsence);

els.search.addEventListener('input', debounce(loadEmployees, 250));
els.filterDepartment.addEventListener('change', loadEmployees);
els.filterStatus.addEventListener('change', loadEmployees);
els.attSearch.addEventListener('input', debounce(renderAttendanceView, 150));
els.attendanceDate.addEventListener('change', reloadAttendanceView);

els.exportBtn.addEventListener('click', () => {
  window.location.href = '/api/employees/export?' + buildQuery();
});

document.querySelectorAll('th.sortable').forEach((th) => {
  th.addEventListener('click', () => {
    const key = th.dataset.sort;
    if (state.sort === key) {
      state.order = state.order === 'asc' ? 'desc' : 'asc';
    } else {
      state.sort = key;
      state.order = key === 'salary' || key === 'hireDate' ? 'desc' : 'asc';
    }
    updateSortIndicators();
    loadEmployees();
  });
});

document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape') return;
  if (!els.absenceModal.hidden) closeAbsenceModal();
  else if (!els.deleteModal.hidden) closeDeleteModal();
  else if (!els.modal.hidden) closeModal();
});

els.form.addEventListener('submit', async (event) => {
  event.preventDefault();
  clearErrors();

  const id = els.employeeId.value;
  const payload = collectForm();
  els.saveBtn.disabled = true;

  try {
    if (id) {
      await api('/api/employees/' + id, { method: 'PUT', body: JSON.stringify(payload) });
      showToast('Xodim yangilandi');
    } else {
      await api('/api/employees', { method: 'POST', body: JSON.stringify(payload) });
      showToast("Xodim qo'shildi");
    }
    closeModal();
    await refresh();
  } catch (err) {
    if (err.data && err.data.errors) {
      showErrors(err.data.errors);
    } else {
      showToast(err.message, 'error');
    }
  } finally {
    els.saveBtn.disabled = false;
  }
});

els.attendanceDate.value = todayStr();
updateSortIndicators();
showView('employees');
refresh().catch((err) => showToast(err.message, 'error'));
