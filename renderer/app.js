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
  updateDateDisplay();
  showDailyReminder();
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
}

async function saveTasks() {
  await ipcRenderer.invoke('save-tasks', tasks);
}

// ========== 渲染所有象限 ==========
function renderAll() {
  ['q1', 'q2', 'q3', 'q4'].forEach(renderQuadrant);
}

function renderQuadrant(qId) {
  const list = document.getElementById(`${qId}-list`);
  const quadrant = tasks[qId];
  const items = quadrant.tasks;

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

  items.forEach((task, index) => {
    const el = document.createElement('div');
    el.className = 'task-item';
    el.draggable = true;
    el.dataset.quadrant = qId;
    el.dataset.index = index;

    el.innerHTML = `
      <div class="task-checkbox ${task.done ? 'done' : ''}" onclick="toggleTask('${qId}', ${index})">
        ${task.done ? '✓' : ''}
      </div>
      <span class="task-text ${task.done ? 'done' : ''}">${escapeHtml(task.text)}</span>
      <span class="task-actions">
        <div class="task-remind-btn ${task.remind ? 'active' : 'inactive'}"
             onclick="toggleRemind('${qId}', ${index})" title="${task.remind ? '已开启提醒' : '开启提醒'}">
          ${task.remind ? '🔔' : '🔕'}
        </div>
        <div class="task-btn delete-btn" onclick="deleteTask('${qId}', ${index})" title="删除">✕</div>
      </span>
    `;

    // 拖拽事件
    el.addEventListener('dragstart', (e) => {
      draggedItem = { quadrant: qId, index };
      el.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
    });

    el.addEventListener('dragend', (e) => {
      el.classList.remove('dragging');
    });

    list.appendChild(el);
  });

  // 更新计数
  updateCounts();
}

// ========== 任务操作 ==========
function addTask(qId, text) {
  text = text.trim();
  if (!text) return;

  tasks[qId].tasks.push({
    id: Date.now() + Math.random(),
    text,
    done: false,
    remind: qId === 'q1' || qId === 'q2' // 重要象限默认开启提醒
  });

  saveTasks();
  renderQuadrant(qId);
}

function toggleTask(qId, index) {
  tasks[qId].tasks[index].done = !tasks[qId].tasks[index].done;
  saveTasks();
  renderQuadrant(qId);
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

  const defaultTasks = {
    q1: { title: '🔴 重要且紧急', tasks: [
      { id: Date.now() + 1, text: '完成项目截止任务', done: false, remind: true },
      { id: Date.now() + 2, text: '处理紧急故障', done: false, remind: true }
    ] },
    q2: { title: '🟢 重要不紧急', tasks: [
      { id: Date.now() + 3, text: '每天学习 30 分钟', done: false, remind: true },
      { id: Date.now() + 4, text: '制定下周计划', done: false, remind: true },
      { id: Date.now() + 5, text: '锻炼身体', done: false, remind: true }
    ] },
    q3: { title: '🔵 不重要但紧急', tasks: [
      { id: Date.now() + 6, text: '回复非紧急邮件', done: false, remind: false }
    ] },
    q4: { title: '⚪ 不重要不紧急', tasks: [
      { id: Date.now() + 7, text: '刷社交媒体', done: false, remind: false }
    ] }
  };

  tasks = defaultTasks;
  saveTasks();
  renderAll();
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

      // 移动任务到新象限
      const task = tasks[draggedItem.quadrant].tasks.splice(draggedItem.index, 1)[0];
      tasks[targetQuadrant].tasks.push(task);

      // 更新提醒状态：重要象限默认开启提醒
      if (targetQuadrant === 'q1' || targetQuadrant === 'q2') {
        task.remind = true;
      }

      saveTasks();
      renderAll();
      draggedItem = null;
    });
  });
}

// ========== 输入框事件绑定 ==========
document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && e.target.classList.contains('task-input')) {
    const qId = e.target.dataset.quadrant;
    addTask(qId, e.target.value);
    e.target.value = '';
  }
});

// ========== 每日提醒弹窗 ==========
function showDailyReminder() {
  const now = new Date();
  const lastShow = localStorage.getItem('lastDailyReminder');
  const today = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`;

  if (lastShow === today) return; // 今天已经显示过

  const q2Tasks = tasks.q2.tasks.filter(t => !t.done);

  if (q2Tasks.length === 0) return; // 没有未完成的重要不紧急任务

  const modalBody = document.getElementById('modalBody');
  const q2List = q2Tasks.map(t => `<li>${escapeHtml(t.text)}</li>`).join('');

  modalBody.innerHTML = `
    <p style="margin-bottom:12px;font-size:15px;">
      🌱 <strong>今天别忘记关注这些重要但不紧急的事：</strong>
    </p>
    <ul style="margin:12px 0 12px 20px;color:var(--text-primary);line-height:2;">
      ${q2List}
    </ul>
    <div class="quote">
      "重要的事绝不因小事而让步"
      <br>— 史蒂芬·柯维
    </div>
    <p style="margin-top:12px;color:var(--text-secondary);font-size:13px;">
      ⏰ 程序会在每整点和半点弹窗提醒，直到你完成它们。
    </p>
  `;

  document.getElementById('modalOverlay').classList.add('active');
  localStorage.setItem('lastDailyReminder', today);
}

function closeModal() {
  document.getElementById('modalOverlay').classList.remove('active');
}

// ========== 键盘快捷键 ==========
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeModal();
  }
});

// ========== 工具函数 ==========
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function updateCounts() {
  for (const qId of ['q1', 'q2', 'q3', 'q4']) {
    // 可以在象限头部显示任务计数
  }
}

// 暴露全局函数供 HTML 调用
window.toggleTask = toggleTask;
window.deleteTask = deleteTask;
window.toggleRemind = toggleRemind;
window.clearDoneTasks = clearDoneTasks;
window.resetAllTasks = resetAllTasks;
window.closeModal = closeModal;
