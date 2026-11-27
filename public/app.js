const els = {
  search: document.getElementById('search'),
  filterDepartment: document.getElementById('filterDepartment'),
  filterStatus: document.getElementById('filterStatus'),
  sortBy: document.getElementById('sortBy'),
  tableBody: document.getElementById('tableBody'),
  empty: document.getElementById('empty'),
  addBtn: document.getElementById('addBtn'),
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
  statDepts: document.getElementById('statDepts'),
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

function formatMoney(value) {
  return Number(value || 0).toLocaleString('uz-UZ').replace(/\u00a0/g, ' ') + " so'm";
}

function formatDate(value) {
  if (!value) return null;
  const parts = String(value).split('-');
  if (parts.length !== 3) return value;
  return parts[2] + '.' + parts[1] + '.' + parts[0];
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

function renderTable(list) {
  els.tableBody.innerHTML = '';
  els.empty.hidden = list.length > 0;

  for (const emp of list) {
    const tr = document.createElement('tr');

    const nameTd = document.createElement('td');
    const name = document.createElement('span');
    name.className = 'employee-name';
    name.textContent = emp.firstName + ' ' + emp.lastName;
    const email = document.createElement('span');
    email.className = 'employee-email';
    email.textContent = emp.email;
    nameTd.append(name, email);
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
    delBtn.addEventListener('click', () => removeEmployee(emp));

    actions.append(editBtn, delBtn);
    actionsTd.append(actions);
    tr.append(actionsTd);

    els.tableBody.append(tr);
  }
}

function buildQuery() {
  const params = new URLSearchParams();
  const search = els.search.value.trim();
  if (search) params.set('search', search);
  if (els.filterDepartment.value) params.set('department', els.filterDepartment.value);
  if (els.filterStatus.value) params.set('status', els.filterStatus.value);
  const parts = els.sortBy.value.split(':');
  params.set('sort', parts[0]);
  params.set('order', parts[1] || 'asc');
  return params.toString();
}

async function loadEmployees() {
  const query = buildQuery();
  const list = await api('/api/employees' + (query ? '?' + query : ''));
  renderTable(list);
}

async function loadStats() {
  const stats = await api('/api/stats');
  els.statTotal.textContent = stats.total;
  els.statActive.textContent = stats.active;
  els.statInactive.textContent = stats.inactive;
  els.statDepts.textContent = Object.keys(stats.departments).length;
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

async function refresh() {
  await loadDepartments();
  await Promise.all([loadStats(), loadEmployees()]);
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

async function removeEmployee(emp) {
  const name = emp.firstName + ' ' + emp.lastName;
  if (!window.confirm('"' + name + '" xodimini o\'chirishni tasdiqlaysizmi?')) return;

  try {
    await api('/api/employees/' + emp.id, { method: 'DELETE' });
    showToast("Xodim o'chirildi");
    await refresh();
  } catch (err) {
    showToast(err.message, 'error');
  }
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

els.modal.querySelectorAll('[data-close]').forEach((element) => {
  element.addEventListener('click', closeModal);
});

els.search.addEventListener('input', debounce(loadEmployees, 250));
els.filterDepartment.addEventListener('change', loadEmployees);
els.filterStatus.addEventListener('change', loadEmployees);
els.sortBy.addEventListener('change', loadEmployees);

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !els.modal.hidden) closeModal();
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

refresh().catch((err) => showToast(err.message, 'error'));
