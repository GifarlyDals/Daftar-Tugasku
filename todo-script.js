// ============================================================
//  STATE
// ============================================================
let tasks     = JSON.parse(localStorage.getItem('tugasku-v2') || '[]');
let filter    = 'semua';
let sortBy    = 'newest';
let searchQ   = '';
let undoStack = [];

// ============================================================
//  DOM REFS
// ============================================================
const taskInput   = document.getElementById('task-input');
const addBtn      = document.getElementById('add-btn');
const taskList    = document.getElementById('task-list');
const countTxt    = document.getElementById('count-text');
const clearBtn    = document.getElementById('clear-btn');
const undoBtn     = document.getElementById('undo-btn');
const searchInput = document.getElementById('search-input');
const sortSelect  = document.getElementById('sort-select');
const dateEl      = document.getElementById('app-date');
const progressPct = document.getElementById('progress-pct');
const ringFill    = document.getElementById('ring-fill');
const sTotal      = document.getElementById('s-total');
const sActive     = document.getElementById('s-active');
const sDone       = document.getElementById('s-done');
const sOverdue    = document.getElementById('s-overdue');

// ============================================================
//  INIT
// ============================================================
const now = new Date();
dateEl.innerHTML =
  now.toLocaleDateString('id-ID', { weekday: 'long' }) + '<br/>' +
  now.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });

// ============================================================
//  PERSISTENCE
// ============================================================
function save() {
  localStorage.setItem('tugasku-v2', JSON.stringify(tasks));
}

// ============================================================
//  UNDO SYSTEM
// ============================================================
function snapshot() {
  undoStack.push(JSON.stringify(tasks));
  if (undoStack.length > 20) undoStack.shift();
  undoBtn.disabled = false;
}

undoBtn.addEventListener('click', () => {
  if (!undoStack.length) return;
  tasks = JSON.parse(undoStack.pop());
  save();
  render();
  if (!undoStack.length) undoBtn.disabled = true;
});

// ============================================================
//  ADD TASK
// ============================================================
function getSelectedPriority() {
  const active = document.querySelector('#priority-ctrl .seg.active');
  return active ? active.dataset.val : 'rendah';
}

function addTask() {
  const text = taskInput.value.trim();
  if (!text) {
    taskInput.style.background = '#fff0ef';
    setTimeout(() => taskInput.style.background = '', 700);
    taskInput.focus();
    return;
  }
  snapshot();
  tasks.unshift({
    id       : Date.now(),
    text,
    done     : false,
    priority : getSelectedPriority(),
    category : document.getElementById('cat-select').value,
    due      : document.getElementById('due-input').value || null,
    createdAt: Date.now(),
    doneAt   : null,
  });
  taskInput.value = '';
  document.getElementById('due-input').value = '';
  save();
  render();
  taskInput.focus();
}

addBtn.addEventListener('click', addTask);
taskInput.addEventListener('keydown', e => { if (e.key === 'Enter') addTask(); });

// Priority segs in add form
document.querySelectorAll('#priority-ctrl .seg').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#priority-ctrl .seg').forEach(s => s.classList.remove('active'));
    btn.classList.add('active');
  });
});

// ============================================================
//  TOGGLE DONE
// ============================================================
function toggleDone(id) {
  snapshot();
  const t = tasks.find(t => t.id === id);
  if (!t) return;
  t.done   = !t.done;
  t.doneAt = t.done ? Date.now() : null;
  save();
  render();
}

// ============================================================
//  DELETE TASK
// ============================================================
function deleteTask(id) {
  snapshot();
  const el = taskList.querySelector(`[data-id="${id}"]`);
  if (el) {
    el.style.opacity   = '0';
    el.style.transform = 'translateX(20px)';
    setTimeout(() => {
      tasks = tasks.filter(t => t.id !== id);
      save();
      render();
    }, 220);
  }
}

// ============================================================
//  CLEAR DONE TASKS
// ============================================================
clearBtn.addEventListener('click', () => {
  if (!tasks.some(t => t.done)) return;
  snapshot();
  tasks = tasks.filter(t => !t.done);
  save();
  render();
});

// ============================================================
//  FILTER & SORT
// ============================================================
document.querySelectorAll('.ftab').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.ftab').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    filter = btn.dataset.f;
    render();
  });
});

sortSelect.addEventListener('change', () => { sortBy = sortSelect.value; render(); });
searchInput.addEventListener('input', () => { searchQ = searchInput.value.toLowerCase(); render(); });

// ============================================================
//  HELPERS
// ============================================================
const PRIORITY_ORDER = { tinggi: 0, sedang: 1, rendah: 2 };
const CAT_LABEL = { umum:'📋 Umum', kerja:'💼 Kerja', belajar:'📚 Belajar', pribadi:'🏠 Pribadi', belanja:'🛒 Belanja' };
const TODAY_STR = now.toISOString().slice(0, 10);

function isOverdue(task) {
  return !task.done && task.due && task.due < TODAY_STR;
}
function isDueToday(task) {
  return !task.done && task.due === TODAY_STR;
}
function formatDue(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}
function escHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function applyFilter(list) {
  switch (filter) {
    case 'aktif'    : return list.filter(t => !t.done);
    case 'selesai'  : return list.filter(t => t.done);
    case 'terlambat': return list.filter(t => isOverdue(t));
    default         : return list;
  }
}

function applySearch(list) {
  if (!searchQ) return list;
  return list.filter(t =>
    t.text.toLowerCase().includes(searchQ) ||
    (CAT_LABEL[t.category] || '').toLowerCase().includes(searchQ)
  );
}

function applySort(list) {
  const copy = [...list];
  switch (sortBy) {
    case 'oldest'  : return copy.sort((a, b) => a.createdAt - b.createdAt);
    case 'priority': return copy.sort((a, b) => (PRIORITY_ORDER[a.priority]||2) - (PRIORITY_ORDER[b.priority]||2));
    case 'due'     : return copy.sort((a, b) => {
      if (!a.due && !b.due) return 0;
      if (!a.due) return 1;
      if (!b.due) return -1;
      return a.due.localeCompare(b.due);
    });
    case 'alpha'   : return copy.sort((a, b) => a.text.localeCompare(b.text, 'id'));
    default        : return copy.sort((a, b) => b.createdAt - a.createdAt);
  }
}

// ============================================================
//  RENDER
// ============================================================
function render() {
  const total   = tasks.length;
  const done    = tasks.filter(t => t.done).length;
  const active  = total - done;
  const overdue = tasks.filter(t => isOverdue(t)).length;

  sTotal.textContent   = total;
  sActive.textContent  = active;
  sDone.textContent    = done;
  sOverdue.textContent = overdue;

  const pct = total === 0 ? 0 : Math.round((done / total) * 100);
  progressPct.textContent = pct + '%';
  const circumference = 2 * Math.PI * 20;
  ringFill.style.strokeDashoffset = circumference - (pct / 100) * circumference;

  if (total === 0) {
    countTxt.textContent = 'Belum ada tugas';
  } else if (active === 0) {
    countTxt.textContent = 'Semua tugas selesai ✓';
  } else {
    countTxt.textContent = `${active} tugas aktif · ${done} selesai`;
  }

  let displayed = applySort(applySearch(applyFilter(tasks)));

  if (displayed.length === 0) {
    const msg = searchQ
      ? `Tidak ada tugas yang cocok dengan "<strong>${escHtml(searchQ)}</strong>"`
      : filter === 'terlambat' ? 'Tidak ada tugas terlambat 🎉'
      : filter === 'selesai'   ? 'Belum ada tugas yang diselesaikan'
      : filter === 'aktif'     ? 'Semua tugas sudah selesai!'
      : 'Belum ada tugas. Yuk mulai!';
    taskList.innerHTML = `<li class="empty-msg">${msg}</li>`;
    return;
  }

  taskList.innerHTML = '';
  displayed.forEach(task => {
    const li = document.createElement('li');
    li.className = 'task-item' + (task.done ? ' done' : '');
    li.dataset.id = task.id;

    const prioClass = `tag-p-${task.priority || 'rendah'}`;
    const catLabel  = CAT_LABEL[task.category] || '📋 Umum';

    let dueHtml = '';
    if (task.due) {
      let cls = '';
      let prefix = '📅 ';
      if (isOverdue(task))       { cls = 'overdue'; prefix = '⚠️ '; }
      else if (isDueToday(task)) { cls = 'today';   prefix = '🔔 Hari ini'; }
      dueHtml = `<span class="task-due ${cls}">${prefix}${cls === 'today' ? '' : formatDue(task.due)}</span>`;
    }

    li.innerHTML = `
      <div class="cb" title="Tandai selesai">
        <svg class="cb-check" viewBox="0 0 9 9" fill="none">
          <polyline points="1,4.5 3.5,7 8,2" stroke="white" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </div>
      <div class="task-body">
        <div class="task-label">${escHtml(task.text)}</div>
        <div class="task-meta">
          <span class="tag tag-cat">${catLabel}</span>
          <span class="tag ${prioClass}">${task.priority || 'rendah'}</span>
          ${dueHtml}
        </div>
      </div>
      <div class="task-actions">
        <button class="act-btn del del-btn" title="Hapus">×</button>
      </div>
    `;

    li.querySelector('.cb').addEventListener('click',        () => toggleDone(task.id));
    li.querySelector('.task-label').addEventListener('click', () => toggleDone(task.id));
    li.querySelector('.del-btn').addEventListener('click',   () => deleteTask(task.id));

    taskList.appendChild(li);
  });
}

render();
