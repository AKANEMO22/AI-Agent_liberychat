const express = require('express');
const { createSetBalanceConfig, forceRefreshCloudFrontAuthCookies } = require('@librechat/api');
const {
  resetPasswordRequestController,
  resetPasswordController,
  registrationController,
  graphTokenController,
  refreshController,
} = require('~/server/controllers/AuthController');
const {
  regenerateBackupCodes,
  disable2FA,
  confirm2FA,
  enable2FA,
  verify2FA,
} = require('~/server/controllers/TwoFactorController');
const { verify2FAWithTempToken } = require('~/server/controllers/auth/TwoFactorAuthController');
const { logoutController } = require('~/server/controllers/auth/LogoutController');
const { loginController } = require('~/server/controllers/auth/LoginController');
const { findBalanceByUser, upsertBalanceFields } = require('~/models');
const { getAppConfig } = require('~/server/services/Config');
const middleware = require('~/server/middleware');

const setBalanceConfig = createSetBalanceConfig({
  getAppConfig,
  findBalanceByUser,
  upsertBalanceFields,
});

const router = express.Router();
const getCloudFrontAuthCookieRefreshResult = (req, res) => {
  const warmedResult = req.cloudFrontAuthCookieRefreshResult;
  if (warmedResult && (warmedResult.attempted || !warmedResult.enabled)) {
    return warmedResult;
  }

  return forceRefreshCloudFrontAuthCookies(req, res, req.user);
};

const ldapAuth = !!process.env.LDAP_URL && !!process.env.LDAP_USER_SEARCH_BASE;
//Local
router.post('/logout', middleware.requireJwtAuth, logoutController);
router.post(
  '/login',
  middleware.logHeaders,
  middleware.loginLimiter,
  middleware.checkBan,
  middleware.validateEmailLogin,
  ldapAuth ? middleware.requireLdapAuth : middleware.requireLocalAuth,
  setBalanceConfig,
  loginController,
);
router.post('/refresh', refreshController);
router.post('/cloudfront/refresh', middleware.requireJwtAuth, (req, res) => {
  const result = getCloudFrontAuthCookieRefreshResult(req, res);
  if (!result.enabled) {
    return res.sendStatus(404);
  }

  const status = result.refreshed ? 200 : 500;
  return res.status(status).json({
    ok: result.refreshed,
    expiresInSec: result.expiresInSec,
    refreshAfterSec: result.refreshAfterSec,
  });
});
router.post(
  '/register',
  middleware.registerLimiter,
  middleware.checkBan,
  middleware.checkInviteUser,
  middleware.validateRegistration,
  registrationController,
);
router.post(
  '/requestPasswordReset',
  middleware.resetPasswordLimiter,
  middleware.checkBan,
  middleware.validatePasswordReset,
  resetPasswordRequestController,
);
router.post(
  '/resetPassword',
  middleware.resetPasswordSubmissionLimiter,
  middleware.checkBan,
  middleware.validatePasswordReset,
  resetPasswordController,
);

router.post('/2fa/enable', middleware.requireJwtAuth, enable2FA);
router.post('/2fa/verify', middleware.requireJwtAuth, verify2FA);
router.post(
  '/2fa/verify-temp',
  middleware.setTwoFactorTempUser,
  middleware.twoFactorTempLimiter,
  middleware.checkBan,
  verify2FAWithTempToken,
);
router.post('/2fa/confirm', middleware.requireJwtAuth, confirm2FA);
router.post('/2fa/disable', middleware.requireJwtAuth, disable2FA);
router.post('/2fa/backup/regenerate', middleware.requireJwtAuth, regenerateBackupCodes);

router.get('/graph-token', middleware.requireJwtAuth, graphTokenController);

// ======================== LOCAL SINGLE-USER BOOTSTRAP ENDPOINTS ========================

function isLocalRequest(req) {
  const host = req.headers.host || '';
  const clientIp = req.ip || req.connection?.remoteAddress || req.socket?.remoteAddress || '';
  return (
    host.startsWith('localhost') ||
    host.startsWith('127.0.0.1') ||
    clientIp === '127.0.0.1' ||
    clientIp === '::1' ||
    clientIp === '::ffff:127.0.0.1' ||
    clientIp === 'localhost' ||
    clientIp.endsWith('127.0.0.1') ||
    clientIp.includes('127.0.0.1')
  );
}

// In-memory cache for slow system inspections (GPU, MCP)
let cachedGpuResult = { ok: false, status: 'GPU status: Not measured', timestamp: 0 };
let cachedMcpResult = { ok: false, toolCount: 0, tools: [], timestamp: 0 };

// 1. GET /api/auth/local-status (Real Subsystem Health Inspection)
router.get('/local-status', async (req, res) => {
  if (!isLocalRequest(req)) {
    return res.status(403).json({ message: 'Forbidden: Local bootstrap restricted to 127.0.0.1' });
  }

  const results = {
    ollama: { ok: false, status: 'offline', model: null, error: null },
    adapter: { ok: false, status: 'offline', error: null },
    gpu: { ok: false, status: 'GPU status: Not measured' },
    mcp: { ok: false, toolCount: 0, tools: [], error: null },
    workspace: { ok: false, id: 'agent-test' },
    modes: { light: true, medium: false, high: false },
  };

  // 1a. Check Ollama (:11434) & exact model qwen2.5-coder-local / qwen2.5-coder:7b
  try {
    const oRes = await fetch('http://127.0.0.1:11434/api/tags', { signal: AbortSignal.timeout(1500) });
    if (oRes.ok) {
      const oData = await oRes.json();
      const models = (oData.models || []).map((m) => m.name);
      const hasExactModel = models.some((m) => 
        m === 'qwen2.5-coder-local:latest' || 
        m === 'qwen2.5-coder-local' || 
        m.includes('qwen2.5-coder-local') ||
        m === 'qwen2.5-coder:7b' ||
        m.includes('qwen2.5-coder')
      );
      if (hasExactModel) {
        results.ollama.ok = true;
        results.ollama.status = 'online';
        results.ollama.model = 'qwen2.5-coder-local';
      } else {
        results.ollama.ok = false;
        results.ollama.status = 'model_missing';
        results.ollama.error = 'Model qwen2.5-coder-local not found in Ollama';
      }
    } else {
      results.ollama.error = `Ollama HTTP ${oRes.status}`;
    }
  } catch (err) {
    results.ollama.error = err.message || 'Ollama connection failed';
  }

  // 1b. Check Tool Adapter (:8090/health)
  try {
    const aRes = await fetch('http://127.0.0.1:8090/health', { signal: AbortSignal.timeout(1500) });
    if (aRes.ok) {
      const aData = await aRes.json();
      if (aData.status === 'ok' && aData.adapter === 'ok') {
        results.adapter.ok = true;
        results.adapter.status = 'healthy';
        results.modes.medium = true;
        results.modes.high = true;
      }
    } else {
      results.adapter.error = `Adapter HTTP ${aRes.status}`;
    }
  } catch (err) {
    results.adapter.error = err.message || 'Adapter connection failed';
  }

  // 1c. Check GPU runtime (cached for 30s)
  const now = Date.now();
  if (now - cachedGpuResult.timestamp < 30000) {
    results.gpu.ok = cachedGpuResult.ok;
    results.gpu.status = cachedGpuResult.status;
  } else {
    try {
      const { spawnSync } = require('child_process');
      const smi = spawnSync('nvidia-smi', ['--query-gpu=name,memory.total,memory.free', '--format=csv,noheader'], {
        encoding: 'utf8',
        timeout: 1000,
      });
      if (smi.status === 0 && smi.stdout && smi.stdout.trim()) {
        cachedGpuResult = { ok: true, status: smi.stdout.trim().split(/\r?\n/)[0], timestamp: now };
        results.gpu.ok = true;
        results.gpu.status = cachedGpuResult.status;
      }
    } catch {
      results.gpu.status = 'GPU status: Not measured';
    }
  }

  // 1d. Check MCP Workspace Server & Structured Tools (cached for 30s)
  if (now - cachedMcpResult.timestamp < 30000 && cachedMcpResult.ok) {
    results.mcp.ok = cachedMcpResult.ok;
    results.mcp.toolCount = cachedMcpResult.toolCount;
    results.mcp.tools = cachedMcpResult.tools;
    results.workspace.ok = true;
  } else {
    try {
      const path = require('path');
      const { spawnSync } = require('child_process');
      const mcpScript = path.resolve(__dirname, '../../../../workspace-tools-server/index.js');
      const mcpProc = spawnSync('node', [mcpScript], {
        env: { ...process.env, AGENT_MODE: 'HIGH', WORKSPACE_ID: 'agent-test' },
        input: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }) + '\n',
        encoding: 'utf8',
        timeout: 2000,
      });
      const mcpOut = JSON.parse(mcpProc.stdout.trim().split('\n').pop() || '{}');
      if (mcpOut.result?.tools && Array.isArray(mcpOut.result.tools)) {
        cachedMcpResult = {
          ok: true,
          toolCount: mcpOut.result.tools.length,
          tools: mcpOut.result.tools.map((t) => t.name),
          timestamp: now,
        };
        results.mcp.ok = true;
        results.mcp.toolCount = cachedMcpResult.toolCount;
        results.mcp.tools = cachedMcpResult.tools;
        results.workspace.ok = true;
      }
    } catch (err) {
      results.mcp.error = err.message || 'MCP tool inspection failed';
    }
  }

  return res.status(200).json(results);
});

// 2. POST /api/auth/local-warmup (Minimal internal inference to load VRAM)
router.post('/local-warmup', async (req, res) => {
  if (!isLocalRequest(req)) {
    return res.status(403).json({ message: 'Forbidden: Local warmup restricted to 127.0.0.1' });
  }

  const startTime = Date.now();
  try {
    const targetUrl = 'http://127.0.0.1:8090/v1/chat/completions';
    const warmupRes = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer local-agent-secret-key-prod-8090',
      },
      body: JSON.stringify({
        model: 'qwen2.5-coder-local',
        messages: [{ role: 'user', content: 'READY' }],
        max_tokens: 2,
        temperature: 0,
        stream: false,
      }),
      signal: AbortSignal.timeout(35000),
    });

    if (!warmupRes.ok) {
      throw new Error(`Warmup failed with HTTP ${warmupRes.status}`);
    }

    const data = await warmupRes.json();
    const latency = Date.now() - startTime;
    return res.status(200).json({
      ok: true,
      latencyMs: latency,
      reply: data.choices?.[0]?.message?.content || 'OK',
    });
  } catch (err) {
    // If adapter is down, try direct Ollama warmup for Light mode
    try {
      const oWarmupRes = await fetch('http://127.0.0.1:11434/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'qwen2.5-coder-local',
          messages: [{ role: 'user', content: 'READY' }],
          max_tokens: 2,
          temperature: 0,
          stream: false,
        }),
        signal: AbortSignal.timeout(35000),
      });
      if (oWarmupRes.ok) {
        const latency = Date.now() - startTime;
        return res.status(200).json({
          ok: true,
          latencyMs: latency,
          directOllama: true,
        });
      }
    } catch {}

    return res.status(500).json({ ok: false, error: err.message });
  }
});

// 3. POST /api/auth/local-start (Provision / Login persistent Local User)
router.post('/local-start', async (req, res) => {
  if (!isLocalRequest(req)) {
    return res.status(403).json({ message: 'Forbidden: Local login restricted to 127.0.0.1' });
  }

  try {
    const { findUser, createUser } = require('~/models');
    const { setAuthTokens } = require('~/server/services/AuthService');

    let localUser = await findUser({ email: 'local@qwen.ai' });
    if (!localUser) {
      localUser = await createUser(
        {
          name: 'Local User',
          username: 'local_user',
          email: 'local@qwen.ai',
          password: 'local_secure_password_fixed_identity',
          emailVerified: true,
        },
        true,
      );
    }

    const token = await setAuthTokens(localUser._id, res, null, req);
    const userObj = {
      id: localUser._id.toString(),
      _id: localUser._id.toString(),
      name: localUser.name || 'Local User',
      username: localUser.username || 'local_user',
      email: localUser.email || 'local@qwen.ai',
      role: localUser.role || 'USER',
      emailVerified: true,
    };

    return res.status(200).json({ token, user: userObj });
  } catch (err) {
    const { logger } = require('@librechat/data-schemas');
    logger.error('[local-start]', err);
    return res.status(500).json({ message: 'Local bootstrap error: ' + err.message });
  }
});

module.exports = router;
