const { app, BrowserWindow, shell } = require('electron');
const { spawn } = require('child_process');
const fs = require('fs');
const net = require('net');
const path = require('path');

const childProcesses = [];

function getResourcePath(...parts) {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, ...parts);
  }
  return path.join(__dirname, '..', ...parts);
}

function getBackendBinaryPath() {
  const arch = process.arch === 'arm64' ? 'arm64' : 'amd64';
  return getResourcePath('bin', `kv-tube-darwin-${arch}`);
}

function getToolsPath() {
  return getResourcePath('bin');
}

function getFrontendPath() {
  return getResourcePath('frontend');
}

function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : 0;
      server.close(() => resolve(port));
    });
    server.on('error', reject);
  });
}

function waitForHttp(url, timeoutMs = 45000) {
  const startedAt = Date.now();
  return new Promise((resolve, reject) => {
    const check = () => {
      fetch(url)
        .then((response) => {
          if (response.ok) {
            resolve();
            return;
          }
          throw new Error(`HTTP ${response.status}`);
        })
        .catch((error) => {
          if (Date.now() - startedAt > timeoutMs) {
            reject(error);
            return;
          }
          setTimeout(check, 500);
        });
    };
    check();
  });
}

function spawnLoggedProcess(command, args, options) {
  const child = spawn(command, args, {
    stdio: 'pipe',
    windowsHide: true,
    ...options,
  });

  childProcesses.push(child);
  child.stdout?.on('data', (chunk) => console.log(chunk.toString().trimEnd()));
  child.stderr?.on('data', (chunk) => console.error(chunk.toString().trimEnd()));
  child.on('exit', (code, signal) => {
    console.log(`${path.basename(command)} exited with code=${code} signal=${signal}`);
  });
  return child;
}

async function startBundledServers() {
  const backendPort = 8080;
  const frontendPort = await getFreePort();
  const backendBinary = getBackendBinaryPath();
  const frontendDir = getFrontendPath();
  const frontendServer = path.join(frontendDir, 'server.js');
  const dataDir = path.join(app.getPath('userData'), 'data');
  const toolsPath = getToolsPath();
  const pathValue = [toolsPath, process.env.PATH || ''].filter(Boolean).join(path.delimiter);

  if (!fs.existsSync(backendBinary)) {
    throw new Error(`Missing backend binary: ${backendBinary}`);
  }
  if (!fs.existsSync(frontendServer)) {
    throw new Error(`Missing frontend server: ${frontendServer}`);
  }

  fs.mkdirSync(dataDir, { recursive: true });

  spawnLoggedProcess(backendBinary, [], {
    env: {
      ...process.env,
      PATH: pathValue,
      PORT: String(backendPort),
      GIN_MODE: 'release',
      KVTUBE_DATA_DIR: dataDir,
    },
  });

  spawnLoggedProcess(process.execPath, [frontendServer], {
    cwd: frontendDir,
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: '1',
      NODE_ENV: 'production',
      NEXT_TELEMETRY_DISABLED: '1',
      PORT: String(frontendPort),
      HOSTNAME: '127.0.0.1',
      KVTUBE_INTERNAL_API_BASE_URL: `http://127.0.0.1:${backendPort}`,
    },
  });

  const frontendUrl = `http://127.0.0.1:${frontendPort}`;
  await waitForHttp(frontendUrl);
  return frontendUrl;
}

function stopBundledServers() {
  for (const child of childProcesses.splice(0)) {
    if (!child.killed) {
      child.kill();
    }
  }
}

async function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 640,
    title: 'KV-Tube',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  try {
    const desktopUrl = process.env.KVTUBE_DESKTOP_SERVER_URL || await startBundledServers();
    await mainWindow.loadURL(desktopUrl);
  } catch (error) {
    console.error(error);
    await mainWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(`
      <body style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; padding: 32px;">
        <h2>KV-Tube failed to start</h2>
        <pre style="white-space: pre-wrap;">${String(error.stack || error.message || error)}</pre>
      </body>
    `)}`);
  }
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('before-quit', stopBundledServers);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
