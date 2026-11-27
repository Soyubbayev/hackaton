const form = document.getElementById('form');
const input = document.getElementById('input');
const list = document.getElementById('list');
const empty = document.getElementById('empty');

async function api(path, options = {}) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) throw new Error('API xatosi');
  return res.status === 204 ? null : res.json();
}

function render(todos) {
  list.innerHTML = '';
  empty.hidden = todos.length > 0;

  for (const todo of todos) {
    const li = document.createElement('li');
    li.className = 'item' + (todo.done ? ' done' : '');

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = todo.done;
    checkbox.addEventListener('change', () => toggle(todo.id, checkbox.checked));

    const span = document.createElement('span');
    span.textContent = todo.text;

    const del = document.createElement('button');
    del.className = 'del';
    del.type = 'button';
    del.textContent = '\u00d7';
    del.addEventListener('click', () => remove(todo.id));

    li.append(checkbox, span, del);
    list.append(li);
  }
}

async function load() {
  render(await api('/api/todos'));
}

async function toggle(id, done) {
  await api('/api/todos/' + id, {
    method: 'PATCH',
    body: JSON.stringify({ done }),
  });
  load();
}

async function remove(id) {
  await api('/api/todos/' + id, { method: 'DELETE' });
  load();
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const text = input.value.trim();
  if (!text) return;
  await api('/api/todos', {
    method: 'POST',
    body: JSON.stringify({ text }),
  });
  input.value = '';
  load();
});

load();
