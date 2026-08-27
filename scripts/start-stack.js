/**
 * @fileoverview Detached background process launcher for Local Qwen AI Stack.
 * Pipes stdio to log files to prevent stdio-closed crash on Windows.
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const ROOT_DIR = path.resolve(__dirname, '..');
const PID_FILE = path.join(ROOT_DIR, '.local-ai.pids');

function startDetached(name, command, args, cwd, envExtra = {}) {
  const logPath = path.join(ROOT_DIR, `.local-ai-${name}.log`);
  const logFd = fs.openSync(logPath, 'a');

  const child = spawn(command, args, {
    cwd,
    detached: true,
    stdio: ['ignore', logFd, logFd],
    windowsHide: true,
    env: {
      ...process.env,
      NODE_ENV: 'production',
      MONGO_URI: 'mongodb://127.0.0.1:27017/LibreChat',
      ...envExtra,
    },
  });

  child.unref();
  return {
    pid: child.pid,
    name: path.basename(command, '.exe'),
    startTime: new Date().toISOString(),
    owned: true,
  };
}

async function main() {
  const target = process.argv[2]; // 'mongodb' | 'adapter' | 'librechat' | 'ollama'
  if (!target) {
    console.error('Usage: node scripts/start-stack.js <target>');
    process.exit(1);
  }

  let tracked = {};
  if (fs.existsSync(PID_FILE)) {
    try {
      tracked = JSON.parse(fs.readFileSync(PID_FILE, 'utf8'));
    } catch {}
  }

  if (target === 'mongodb') {
    const info = startDetached(
      'mongodb',
      'node',
      [path.join(ROOT_DIR, 'LibreChat', 'scripts', 'start-mongo.js')],
      path.join(ROOT_DIR, 'LibreChat')
    );
    tracked['mongodb'] = info;
    fs.writeFileSync(PID_FILE, JSON.stringify(tracked, null, 2), 'utf8');
    console.log(JSON.stringify(info));
  } else if (target === 'adapter') {
    const info = startDetached(
      'adapter',
      'node',
      [path.join(ROOT_DIR, 'openai-tool-adapter', 'index.js')],
      path.join(ROOT_DIR, 'openai-tool-adapter')
    );
    tracked['adapter'] = info;
    fs.writeFileSync(PID_FILE, JSON.stringify(tracked, null, 2), 'utf8');
    console.log(JSON.stringify(info));
  } else if (target === 'librechat') {
    const info = startDetached(
      'librechat',
      'node',
      [path.join(ROOT_DIR, 'LibreChat', 'api', 'server', 'index.js')],
      path.join(ROOT_DIR, 'LibreChat')
    );
    tracked['librechat'] = info;
    fs.writeFileSync(PID_FILE, JSON.stringify(tracked, null, 2), 'utf8');
    console.log(JSON.stringify(info));
  } else if (target === 'ollama') {
    const info = startDetached('ollama', 'ollama', ['serve'], ROOT_DIR);
    tracked['ollama'] = info;
    fs.writeFileSync(PID_FILE, JSON.stringify(tracked, null, 2), 'utf8');
    console.log(JSON.stringify(info));
  }
}

main();
