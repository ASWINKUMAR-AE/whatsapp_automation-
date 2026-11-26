import { app, BrowserWindow, shell, ipcMain } from 'electron';
import { spawn, execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import net from 'net';
import { fileURLToPath } from 'url';
let autoUpdater = null;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isDev = !app.isPackaged;
let mainWindow;
let serverProcess;

function killProcessOnPort(port) {
  try {
    const cmd = process.platform === 'win32' 
      ? `netstat -ano | findstr :${port}` 
      : `lsof -i tcp:${port} -t`;
    
    const output = execSync(cmd).toString();
    const lines = output.split('\n');
    const pids = new Set();

    lines.forEach(line => {
      const parts = line.trim().split(/\s+/);
      const pid = process.platform === 'win32' ? parts[parts.length - 1] : parts[0];
      if (pid && !isNaN(pid) && pid !== '0') pids.add(pid);
    });

    pids.forEach(pid => {
      console.log(`Killing orphan process ${pid} on port ${port}...`);
      try {
        const killCmd = process.platform === 'win32' ? `taskkill /F /PID ${pid} /T` : `kill -9 ${pid}`;
        execSync(killCmd);
      } catch (e) {
        // PID might already be gone
      }
    });
  } catch (err) {
    // Port likely free
  }
}

function isPortResponding(port) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(800);
    socket.once('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.once('error', () => {
      socket.destroy();
      resolve(false);
    });
    socket.once('timeout', () => {
      socket.destroy();
      resolve(false);
    });
    socket.connect(port, '127.0.0.1');
  });
}

async function startServer() {
  const isRunning = await isPortResponding(3001);
  if (isRunning) {
    console.log('Backend server is already running on port 3001.');
    return;
  }

  killProcessOnPort(3001);
  const serverPath = path.join(__dirname, 'server.js');
  console.log('Starting internal server from:', serverPath);
  
  // In development, we use node --watch. In production, we run the bundled file.
  const nodePath = isDev ? 'node' : process.execPath;
  
  serverProcess = spawn(nodePath, [serverPath], {
    cwd: __dirname,
    stdio: 'inherit',
    shell: true,
    env: { ...process.env, NODE_ENV: isDev ? 'development' : 'production', ELECTRON_RUN_AS_NODE: '1' }
  });

  serverProcess.on('error', (err) => console.error('Server error:', err));
  serverProcess.on('exit', (code) => console.log('Server exited:', code));
}

function createWindow() {
  mainWindow = new BrowserWindow({
    title: 'WhatsApp Automation',
    width: 1400,
    height: 900,
    backgroundColor: '#f8fafc',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, '..', 'preload', 'preload.js')
    },
    show: false
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'dist', 'index.html'));
  }

  mainWindow.on('closed', () => (mainWindow = null));

  // IPC Window Controls
  ipcMain.on('window-minimize', () => {
    mainWindow?.minimize();
  });

  ipcMain.on('window-maximize', () => {
    if (mainWindow?.isMaximized()) {
      mainWindow?.unmaximize();
    } else {
      mainWindow?.maximize();
    }
  });

  ipcMain.on('window-close', () => {
    mainWindow?.close();
  });

  // Auto-Updater handlers
  if (!isDev) {
    try {
      const updaterPkg = require('electron-updater');
      autoUpdater = updaterPkg.autoUpdater;
    } catch (e) {
      console.warn('AutoUpdater not available:', e.message);
    }
  }

  if (autoUpdater) {
    ipcMain.on('check-for-updates', () => {
      console.log('Update check requested...');
      autoUpdater.checkForUpdatesAndNotify().catch(err => {
        console.error('Error checking for updates:', err);
        mainWindow?.webContents.send('update-error', err.message);
      });
    });

    ipcMain.on('install-update', () => {
      console.log('Installing update...');
      autoUpdater.quitAndInstall();
    });

    autoUpdater.on('checking-for-update', () => {
      console.log('Checking for updates in background...');
    });

    autoUpdater.on('update-available', (info) => {
      console.log('Update package available:', info);
      mainWindow?.webContents.send('update-available', info);
    });

    autoUpdater.on('update-not-available', (info) => {
      console.log('Update not available:', info);
      mainWindow?.webContents.send('update-not-available', info);
    });

    autoUpdater.on('error', (err) => {
      console.error('AutoUpdater Error:', err);
      mainWindow?.webContents.send('update-error', err?.message || 'Update check failed');
    });

    autoUpdater.on('update-downloaded', (info) => {
      console.log('Update downloaded successfully, ready to install:', info);
      mainWindow?.webContents.send('update-downloaded', info);
    });
  }
}

app.whenReady().then(async () => {
  await startServer();
  
  if (isDev) {
    console.log('Checking Vite server...');
    let viteReady = await isPortResponding(5173);
    for (let i = 0; !viteReady && i < 10; i++) {
      await new Promise(resolve => setTimeout(resolve, 500));
      viteReady = await isPortResponding(5173);
    }
  }
  
  createWindow();
});

function cleanup() {
  if (serverProcess && serverProcess.pid) {
    console.log('Cleaning up backend server...');
    try {
      // Use taskkill /T to kill the entire process tree on Windows
      if (process.platform === 'win32') {
        execSync(`taskkill /F /PID ${serverProcess.pid} /T`);
      } else {
        serverProcess.kill('SIGTERM');
      }
    } catch (err) {
      console.error('Error during cleanup:', err.message);
    }
    serverProcess = null;
  }
}

app.on('window-all-closed', () => {
  cleanup();
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  cleanup();
});

app.on('will-quit', () => {
  cleanup();
});
