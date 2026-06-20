// ============================================
// 要事第一 - 四象限法则 核心逻辑
// ============================================

const { ipcRenderer } = require('electron');

// 状态
let tasks = {
  q1: { title: '🔴 重要且紧急', tasks: [] },
  q2: { title: '🟢 重要不紧急', tasks: [] },
  q3: { title: '🔵 不重要但紧急', tasks: [] },
  q4: { title: '⚪ 不重要不紧急', tasks: [] }
};

let draggedItem = null;

// ========== 初始化 ==========
document.addEventListener('DOMContentLoaded', async () => {
  await loadTasks();
  renderAll();
  setupDragAndDrop();
  setupTimePickerButtons();
  updateDateDisplay();
  // 启动后立即显示今日计划
  setTimeout(showDailyReminder, 500);
});

// ========== 日期显示 ==========
function updateDateDisplay() {
  const now = new Date();
  const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const w = weekdays[now.getDay()];
  document.getElementById('dateDisplay').textContent = `${y}年${m}月${d}日 星期${w}`;
}

// ========== 数据加载与保存 ==========
async function loadTasks() {
  tasks = await ipcRenderer.invoke('load-tasks');
  // 兼容旧数据：没有 plannedTime 字段的加上
  for (const qId of ['q1', 'q2', 'q3', 'q4']) {
    tasks[qId].tasks.forEach(t => {
      if (t.plannedTime === undefined) t.plannedTime = null;
    });
  }
}

async function saveTasks() {
  await ipcRenderer.invoke('save-tasks', tasks);
}

// ========== 渲染所有象限 ==========
function renderAll() {
  ['q1', 'q2', 'q3', 'q4'].forEach(renderQuadrant);
}

function formatTime(isoString) {
  if (!isoString) return null;
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return null;

  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
  const taskDay = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;

  const hour = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');

  if (taskDay === today) {
    return { label: `今天 ${hour}:${min}`, overdue: d < now, isToday: true };
  }

  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowDay = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth()+1).padStart(2,'0')}-${String(tomorrow.getDate()).padStart(2,'0')}`;

  if (taskDay === tomorrowDay) {
    return { label: `明天 ${hour}:${min}`, overdue: false, isToday: false };
  }

  const month = d.getMonth() + 1;
  const day = d.getDate();
  return { label: `${month}月${day}日 ${hour}:${min}`, overdue: d < now, isToday: false };
}

function renderQuadrant(qId) {
  const list = document.getElementById(`${qId}-list`);
  const items = tasks[qId].tasks;

  // 按计划时间排序（有时间的排在前面）
  const sorted = [...items].sort((a, b) => {
    if (a.plannedTime && b.plannedTime) return new Date(a.plannedTime) - new Date(b.plannedTime);
    if (a.plannedTime) return -1;
    if (b.plannedTime) return 1;
    return 0;
  });

  list.innerHTML = '';

  if (items.length === 0) {
    list.innerHTML = `
      <div class="empty-hint">
        <span>📝 暂无任务</span>
        <span style="font-size:11px;">在下方输入框添加新任务</span>
      </div>
    `;
    return;
  }

  // 找到原始索引（用于操作）
  const getOriginalIndex = (taskId) => items.findIndex(t => t.id === taskId);

  sorted.forEach((task) => {
    const origIndex = getOriginalIndex(task.id);
    if (origIndex === -1) return;

    const el = document.createElement('div');
    el.className = 'task-item' + (task.done ? ' done' : '');
    el.draggable = true;
    el.dataset.quadrant = qId;
    el.dataset.index = origIndex;

    const timeInfo = formatTime(task.plannedTime);
    let timeHtml = '';
    if (timeInfo) {
      const cls = timeInfo.overdue ? 'overdue' : (timeInfo.isToday ? 'today' : '');
      timeHtml = `<span class="task-time ${cls}">🕐 ${timeInfo.label}</span>`;
    }

    el.innerHTML = `
      <div class="task-checkbox ${task.done ? 'done' : ''}" onclick="event.stopPropagation(); toggleTask('${qId}', ${origIndex})">
        ${task.done ? '✓' : ''}
      </div>
      <span class="task-text ${task.done ? 'done' : ''}" onclick="event.stopPropagation(); editTaskText('${qId}', ${origIndex})">${escapeHtml(task.text)}</span>
      ${timeHtml}
      <span class="task-actions">
        <div class="task-remind-btn ${task.remind ? 'active' : 'inactive'}"
             onclick="event.stopPropagation(); toggleRemind('${qId}', ${origIndex})" title="${task.remind ? '已开启提醒' : '开启提醒'}">
          ${task.remind ? '🔔' : '🔕'}
        </div>
        <div class="task-btn delete-btn" onclick="event.stopPropagation(); deleteTask('${qId}', ${origIndex})" title="删除">✕</div>
      </span>
    `;

    // ★ 点击整个任务行切换完成状态（双击编辑文字）
    el.addEventListener('click', (e) => {
      // 不触发如果点的是内部按钮/链接
      if (e.target.closest('.task-checkbox') ||
          e.target.closest('.task-actions') ||
          e.target.closest('.task-time')) return;
      toggleTask(qId, origIndex);
    });

    el.addEventListener('dblclick', (e) => {
      if (e.target.closest('.task-checkbox') ||
          e.target.closest('.task-actions')) return;
      editTaskText(qId, origIndex);
    });

    el.addEventListener('dragstart', (e) => {
      draggedItem = { quadrant: qId, index: origIndex };
      el.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
    });

    el.addEventListener('dragend', (e) => {
      el.classList.remove('dragging');
    });

    list.appendChild(el);
  });

  updateCounts();
}

// ========== 任务操作 ==========
function addTask(qId, text) {
  text = text.trim();
  if (!text) return;

  // 获取设置的计划时间
  const dateVal = document.getElementById(`date-${qId}`).value;
  const timeVal = document.getElementById(`time-val-${qId}`).value;
  let plannedTime = null;
  if (dateVal && timeVal) {
    plannedTime = `${dateVal}T${timeVal}:00`;
  }

  // ★ 用户添加了真实任务 → 自动替换示例任务
  const exampleIdx = tasks[qId].tasks.findIndex(t =>
    (t.text.startsWith('例：') || t.text.startsWith('示例：')) && !t.done
  );
  if (exampleIdx !== -1) {
    // 替换示例任务，保留原有位置
    tasks[qId].tasks[exampleIdx] = {
      id: Date.now() + Math.random(),
      text,
      done: false,
      remind: qId === 'q1' || qId === 'q2',
      plannedTime
    };
  } else {
    // 没有示例任务 → 追加到列表最前面（最新添加置顶）
    tasks[qId].tasks.unshift({
      id: Date.now() + Math.random(),
      text,
      done: false,
      remind: qId === 'q1' || qId === 'q2',
      plannedTime
    });
  }

  saveTasks();
  renderQuadrant(qId);
}

function toggleTask(qId, index) {
  const task = tasks[qId].tasks[index];
  task.done = !task.done;

  // ★ 完成任务时，如果有示例任务，自动替换掉一个示例
  if (task.done) {
    const exampleIdx = tasks[qId].tasks.findIndex(t =>
      (t.text.startsWith('例：') || t.text.startsWith('示例：')) && !t.done && t.id !== task.id
    );
    if (exampleIdx !== -1) {
      // 用已完成任务替换示例，让用户可以继续填
      const completedText = task.text;
      tasks[qId].tasks[exampleIdx] = {
        id: Date.now() + Math.random(),
        text: completedText,
        done: false,
        remind: qId === 'q1' || qId === 'q2',
        plannedTime: task.plannedTime
      };
      // 删除原已完成的任务
      tasks[qId].tasks.splice(index, 1);
    }
  }

  saveTasks();
  renderAll();
}

function deleteTask(qId, index) {
  tasks[qId].tasks.splice(index, 1);
  saveTasks();
  renderQuadrant(qId);
}

function toggleRemind(qId, index) {
  tasks[qId].tasks[index].remind = !tasks[qId].tasks[index].remind;
  saveTasks();
  renderQuadrant(qId);
}

function clearDoneTasks() {
  if (!confirm('确定要清除所有已完成的任务吗？')) return;

  ['q1', 'q2', 'q3', 'q4'].forEach(qId => {
    tasks[qId].tasks = tasks[qId].tasks.filter(t => !t.done);
  });
  saveTasks();
  renderAll();
}

function resetAllTasks() {
  if (!confirm('将重置为默认示例任务，确定吗？')) return;

  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;

  const defaultTasks = {
    q1: { title: '🔴 重要且紧急', tasks: [
      { id: Date.now() + 1, text: '完成项目截止任务', done: false, remind: true, plannedTime: `${today}T15:00:00` },
      { id: Date.now() + 2, text: '处理紧急故障', done: false, remind: true, plannedTime: `${today}T10:00:00` }
    ] },
    q2: { title: '🟢 重要不紧急', tasks: [
      { id: Date.now() + 3, text: '每天学习 30 分钟', done: false, remind: true, plannedTime: `${today}T09:00:00` },
      { id: Date.now() + 4, text: '制定下周计划', done: false, remind: true, plannedTime: `${today}T14:00:00` },
      { id: Date.now() + 5, text: '锻炼身体', done: false, remind: true, plannedTime: null }
    ] },
    q3: { title: '🔵 不重要但紧急', tasks: [
      { id: Date.now() + 6, text: '回复非紧急邮件', done: false, remind: false, plannedTime: null }
    ] },
    q4: { title: '⚪ 不重要不紧急', tasks: [
      { id: Date.now() + 7, text: '刷社交媒体', done: false, remind: false, plannedTime: null }
    ] }
  };

  tasks = defaultTasks;
  saveTasks();
  renderAll();
}

// ========== 时间选择器控制 ==========
function setupTimePickerButtons() {
  document.querySelectorAll('.btn-time-picker').forEach(btn => {
    btn.addEventListener('click', () => {
      const qId = btn.dataset.quadrant;
      const picker = document.getElementById(`time-${qId}`);
      const isHidden = picker.style.display === 'none' || !picker.style.display;
      picker.style.display = isHidden ? 'flex' : 'none';
      btn.classList.toggle('active');

      // 默认填今天
      if (isHidden) {
        const now = new Date();
        document.getElementById(`date-${qId}`).value =
          `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
        const hours = String(now.getHours()).padStart(2, '0');
        const mins = String(now.getMinutes() + 15).padStart(2, '0');
        document.getElementById(`time-val-${qId}`).value = `${hours}:${mins > 59 ? '00' : mins}`;
      }
    });
  });
}

function clearTime(qId) {
  document.getElementById(`date-${qId}`).value = '';
  document.getElementById(`time-val-${qId}`).value = '12:00';
}

window.clearTime = clearTime;

// ========== 内联编辑任务文字（单击勾选，双击编辑） ==========
function editTaskText(qId, index) {
  const task = tasks[qId].tasks[index];
  const oldText = task.text;

  // 创建内联输入框
  const taskEl = document.querySelector(`[data-quadrant="${qId}"] .task-item[data-index="${index}"]`);
  if (!taskEl) return;
  const textSpan = taskEl.querySelector('.task-text');
  if (!textSpan) return;

  // 保存原文字，替换为输入框
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'inline-edit';
  input.value = oldText;
  input.style.width = '100%';
  input.style.border = 'none';
  input.style.outline = 'none';
  input.style.background = 'rgba(232,117,58,0.08)';
  input.style.padding = '4px 8px';
  input.style.borderRadius = '6px';
  input.style.fontSize = '13px';
  input.style.fontFamily = 'inherit';
  input.style.color = 'inherit';

  textSpan.replaceWith(input);
  input.focus();
  input.select();

  const finishEdit = (save) => {
    const newText = save ? input.value.trim() : oldText;
    if (newText && newText !== oldText) {
      task.text = newText;
      saveTasks();
    }
    // 恢复显示
    const newSpan = document.createElement('span');
    newSpan.className = 'task-text ' + (task.done ? 'done' : '');
    newSpan.textContent = newText || oldText;
    newSpan.onclick = function(e) { e.stopPropagation(); editTaskText(qId, index); };
    input.replaceWith(newSpan);
  };

  input.addEventListener('blur', () => finishEdit(true));
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { input.blur(); }
    if (e.key === 'Escape') { finishEdit(false); }
    e.stopPropagation();
  });
}

// ========== 输入框事件 ==========
document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && e.target.classList.contains('task-input')) {
    const qId = e.target.dataset.quadrant;
    addTask(qId, e.target.value);
    e.target.value = '';
    // 收起时间选择器
    const picker = document.getElementById(`time-${qId}`);
    if (picker) picker.style.display = 'none';
    const btn = document.querySelector(`.btn-time-picker[data-quadrant="${qId}"]`);
    if (btn) btn.classList.remove('active');
  }
});

// ★ 全局键盘快捷键：按 i 聚焦到当前第一个输入框
document.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
  if (e.key === 'i' && !e.ctrlKey && !e.metaKey) {
    e.preventDefault();
    const firstInput = document.querySelector('.task-input');
    if (firstInput) firstInput.focus();
  }
});

// ========== 每日计划弹窗 ==========
function showDailyReminder() {
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;

  // 收集所有象限中今天有计划的未完成任务
  const todayTasks = [];
  for (const qId of ['q1', 'q2', 'q3', 'q4']) {
    tasks[qId].tasks.forEach(t => {
      if (t.done) return;
      if (!t.plannedTime) return;
      const taskDate = t.plannedTime.substring(0, 10);
      if (taskDate === today) {
        todayTasks.push({ ...t, quadrant: qId });
      }
    });
  }

  // 如果今天没有计划任务，改为显示 Q2 重要不紧急的未完成任务
  let displayTasks = todayTasks;
  if (displayTasks.length === 0) {
    displayTasks = tasks.q2.tasks.filter(t => !t.done).map(t => ({ ...t, quadrant: 'q2' }));
  }

  if (displayTasks.length === 0) return; // 没有需要提醒的

  // 按时间排序
  displayTasks.sort((a, b) => {
    if (a.plannedTime && b.plannedTime) return new Date(a.plannedTime) - new Date(b.plannedTime);
    if (a.plannedTime) return -1;
    if (b.plannedTime) return 1;
    return 0;
  });

  const quadrantNames = {
    q1: '🔴 重要紧急',
    q2: '🟢 重要不紧急',
    q3: '🔵 不重要紧急',
    q4: '⚪ 不重要不紧急'
  };

  let taskHtml = '';
  displayTasks.forEach(t => {
    const timeStr = t.plannedTime ? formatTime(t.plannedTime) : null;
    const timeTag = timeStr ? `<span style="color:var(--orange);font-weight:500;">${timeStr.label}</span>` : '';
    const qName = quadrantNames[t.quadrant] || '';
    taskHtml += `<li style="margin-bottom:8px;padding:6px 10px;background:rgba(255,255,255,0.3);border-radius:6px;display:flex;justify-content:space-between;align-items:center;">
      <span>${escapeHtml(t.text)} <span style="font-size:11px;color:var(--text-light);margin-left:6px;">(${qName})</span></span>
      ${timeTag ? `<span>${timeTag}</span>` : ''}
    </li>`;
  });

  const modalBody = document.getElementById('modalBody');
  modalBody.innerHTML = `
    <p style="margin-bottom:16px;font-size:15px;">
      🌅 <strong>今天的任务计划</strong>
      <span style="font-size:13px;color:var(--text-secondary);font-weight:normal;margin-left:8px;">${today}</span>
    </p>
    <ul style="list-style:none;padding:0;">
      ${taskHtml}
    </ul>
    <div class="quote" style="margin-top:16px;">
      "关键不是把日程填满，而是把重要的事优先安排。"
      <br>— 史蒂芬·柯维
    </div>
  `;

  document.getElementById('modalOverlay').classList.add('active');
}

function closeModal() {
  document.getElementById('modalOverlay').classList.remove('active');
}

// ========== 键盘快捷键 ==========
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeModal();
});

// ========== 工具函数 ==========
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function updateCounts() {
  for (const qId of ['q1', 'q2', 'q3', 'q4']) {
    const count = tasks[qId].tasks.filter(t => !t.done).length;
    const el = document.getElementById(`count-${qId}`);
    if (el) el.textContent = count;
  }
}

// ========== 拖拽（跨象限移动任务） ==========
function setupDragAndDrop() {
  document.querySelectorAll('.quadrant').forEach(quad => {
    quad.addEventListener('dragover', (e) => {
      e.preventDefault();
      quad.classList.add('drag-over');
    });

    quad.addEventListener('dragleave', () => {
      quad.classList.remove('drag-over');
    });

    quad.addEventListener('drop', (e) => {
      e.preventDefault();
      quad.classList.remove('drag-over');
      if (!draggedItem) return;

      const targetQuadrant = quad.dataset.quadrant;
      if (draggedItem.quadrant === targetQuadrant) return;

      const task = tasks[draggedItem.quadrant].tasks.splice(draggedItem.index, 1)[0];
      tasks[targetQuadrant].tasks.push(task);

      if (targetQuadrant === 'q1' || targetQuadrant === 'q2') {
        task.remind = true;
      }

      saveTasks();
      renderAll();
      draggedItem = null;
    });
  });
}

// 暴露全局函数
window.toggleTask = toggleTask;
window.deleteTask = deleteTask;
window.toggleRemind = toggleRemind;
window.clearDoneTasks = clearDoneTasks;
window.resetAllTasks = resetAllTasks;
window.closeModal = closeModal;
window.editTaskText = editTaskText;
