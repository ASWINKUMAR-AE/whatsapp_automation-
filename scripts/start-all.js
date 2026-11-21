import { spawn, execSync } from 'child_process';
import http from 'http';
import path from 'path';
import electron from 'electron';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

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
      try {
        const killCmd = process.platform === 'win32' ? `taskkill /F /PID ${pid} /T` : `kill -9 ${pid}`;
        execSync(killCmd);
      } catch (e) {}
    });
  } catch (err) {}
}

function waitForHttp(url, name, timeoutMs = 15000) {
  const startTime = Date.now();
  return new Promise((resolve) => {
    const check = () => {
      const req = http.get(url, () => {
        resolve();
      });
      req.on('error', () => {
        if (Date.now() - startTime > timeoutMs) {
          console.warn(`[Notice] Waited ${timeoutMs / 1000}s for ${name}, proceeding to next step...`);
          resolve();
        } else {
          setTimeout(check, 300);
        }
      });
      req.setTimeout(800, () => {
        req.destroy();
      });
    };
    check();
  });
}

const childProcesses = [];

function cleanup() {
  console.log('\nStopping all services...');
  childProcesses.forEach(child => {
    if (child && child.pid) {
      try {
        if (process.platform === 'win32') {
          execSync(`taskkill /F /PID ${child.pid} /T`);
        } else {
          child.kill('SIGTERM');
        }
      } catch (e) {}
    }
  });
}

process.on('SIGINT', () => { cleanup(); process.exit(0); });
process.on('SIGTERM', () => { cleanup(); process.exit(0); });
process.on('exit', () => cleanup());

async function main() {
  console.log('==========================================');
  console.log(' Starting WhatsApp Automation Desktop');
  console.log(' [1/3] Backend -> [2/3] Web -> [3/3] Electron');
  console.log('==========================================\n');

  // Step 1: Clean any stale processes
  killProcessOnPort(3001);
  killProcessOnPort(5173);

  // Step 2: Start Backend
  console.log('[1/3] Starting Backend Server (port 3001)...');
  const backend = spawn('node', ['src/main/server.js'], {
    cwd: rootDir,
    stdio: 'inherit',
    shell: true,
    env: { ...process.env, NODE_ENV: 'development' }
  });
  childProcesses.push(backend);

  await waitForHttp('http://127.0.0.1:3001', 'Backend Server');
  console.log('-> Backend Server is ready on http://localhost:3001\n');

  // Step 3: Start Web Frontend (Vite)
  console.log('[2/3] Starting Web Frontend (Vite, port 5173)...');
  const viteCmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';
  const frontend = spawn(viteCmd, ['vite', '--host', '127.0.0.1'], {
    cwd: rootDir,
    stdio: 'inherit',
    shell: true,
    env: { ...process.env }
  });
  childProcesses.push(frontend);

  await waitForHttp('http://127.0.0.1:5173', 'Web Frontend');
  console.log('-> Web Frontend is ready on http://localhost:5173\n');

  // Step 4: Start Electron
  console.log('[3/3] Starting Electron Desktop Window...');
  const electronEnv = { ...process.env };
  delete electronEnv.ELECTRON_RUN_AS_NODE;

  const electronProcess = spawn(electron, ['.'], {
    cwd: rootDir,
    stdio: 'inherit',
    env: electronEnv
  });
  childProcesses.push(electronProcess);

  electronProcess.on('exit', (code) => {
    console.log(`\nElectron closed with code ${code ?? 0}. Shutting down services...`);
    cleanup();
    process.exit(code ?? 0);
  });
}

main().catch(err => {
  console.error('Failed to start application:', err);
  cleanup();
  process.exit(1);
});
