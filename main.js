const { app, BrowserWindow, Tray, Menu, Notification, ipcMain, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow;
let tray;
let reminderInterval;

// 任务数据存储路径
const dataPath = path.join(app.getPath('userData'), 'tasks.json');

// 默认任务示例
const defaultTasks = {
  q1: { title: '🔴 重要且紧急', tasks: [
    { id: Date.now() + 1, text: '例：项目截止日期', done: false, remind: true }
  ] },
  q2: { title: '🟢 重要不紧急', tasks: [
    { id: Date.now() + 2, text: '例：学习新技能', done: false, remind: true }
  ] },
  q3: { title: '🔵 不重要但紧急', tasks: [
    { id: Date.now() + 3, text: '例：回复邮件', done: false, remind: false }
  ] },
  q4: { title: '⚪ 不重要不紧急', tasks: [
    { id: Date.now() + 4, text: '例：刷短视频', done: false, remind: false }
  ] }
};

// 加载或初始化任务数据
function loadTasks() {
  try {
    if (fs.existsSync(dataPath)) {
      const data = fs.readFileSync(dataPath, 'utf-8');
      return JSON.parse(data);
    }
  } catch (e) {
    console.error('加载数据失败:', e);
  }
  // 首次使用，写入默认数据
  saveTasks(defaultTasks);
  return JSON.parse(JSON.stringify(defaultTasks));
}

function saveTasks(tasks) {
  try {
    fs.writeFileSync(dataPath, JSON.stringify(tasks, null, 2), 'utf-8');
  } catch (e) {
    console.error('保存数据失败:', e);
  }
}

// 检查重要不紧急的任务并发送提醒
function checkReminders() {
  const tasks = loadTasks();
  const now = new Date();
  const hour = now.getHours();
  const minute = now.getMinutes();

  // Q2 = 重要不紧急，每整点提醒一次
  const q2Tasks = tasks.q2.tasks.filter(t => !t.done && t.remind);

  if (q2Tasks.length > 0 && (minute === 0 || minute === 30)) {
    const taskList = q2Tasks.map(t => `📌 ${t.text}`).join('\n');

    if (Notification.isSupported()) {
      const notification = new Notification({
        title: '⏰ 要事第一 · 别忘了重要的事！',
        body: `你的「重要不紧急」任务还有 ${q2Tasks.length} 项：\n${taskList}`
      });

      notification.on('click', () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        }
      });

      notification.show();
    }
  }
}

// 每小时检查一次，在整点和半点提醒
function startReminderService() {
  checkReminders(); // 启动时立即检查
  reminderInterval = setInterval(checkReminders, 60 * 1000); // 每分钟检查一次
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 960,
    minHeight: 600,
    title: '要事第一 - 四象限法则',
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  // 任务数据读写接口
  ipcMain.handle('load-tasks', () => loadTasks());
  ipcMain.handle('save-tasks', (event, tasks) => {
    saveTasks(tasks);
    return true;
  });

  mainWindow.on('close', (event) => {
    // 关闭窗口时隐藏到系统托盘，而不是退出
    if (!app.isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  // 创建系统托盘
  createTray();
}

function createTray() {
  // 使用一个简单的 16x16 图标
  const iconSize = 16;
  const canvas = nativeImage.createFromBuffer(
    Buffer.from(
      // 创建一个简单的绿色方块作为托盘图标
      'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAA' +
      'J0lEQVQ4y2NkYPj/n4EBBJgYKAQMowYMowYMowYMowYMowb8' +
      'BQwAORMFGy/FM1EAAAAASUVORK5CYII=',
      'base64'
    ),
    { width: iconSize, height: iconSize }
  );

  tray = new Tray(canvas);
  tray.setToolTip('要事第一 - 四象限法则');

  const contextMenu = Menu.buildFromTemplate([
    {
      label: '打开要事第一',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        }
      }
    },
    { type: 'separator' },
    {
      label: '检查提醒',
      click: () => checkReminders()
    },
    { type: 'separator' },
    {
      label: '退出',
      click: () => {
        app.isQuitting = true;
        app.quit();
      }
    }
  ]);

  tray.setContextMenu(contextMenu);
  tray.on('double-click', () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

app.whenReady().then(() => {
  createWindow();
  startReminderService();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
    else if (mainWindow) mainWindow.show();
  });
});

app.on('window-all-closed', (e) => {
  // 不退出，隐藏到托盘
  e.preventDefault();
});

app.on('before-quit', () => {
  app.isQuitting = true;
  if (reminderInterval) clearInterval(reminderInterval);
});
