/**
 * Phase 7: Real Browser Verification & Screenshot Capture
 * Target UI Layout:
 * ICON RAIL | PROJECT EXPLORER (Tree) | CHAT
 * Requirements:
 * - File tree visible
 * - One focused file highlighted (calculator.py)
 * - Focused-file header chip visible with FILE badge
 * - Chat input textarea visible
 */

const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

const EVIDENCE_DIR = path.resolve(__dirname, 'audit-logs/2026-08-27_005300/post-focus-fix');
const SCREENSHOT_PATH = path.join(EVIDENCE_DIR, '12-final-tree-chat.png');

async function main() {
  console.log('=== CAPTURING REAL TREE + CHAT SCREENSHOT ===\n');

  const browser = await puppeteer.launch({
    headless: 'new',
    defaultViewport: { width: 1440, height: 900 },
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();

  const delay = (ms) => new Promise(r => setTimeout(r, ms));

  // Navigate to LibreChat
  console.log('Navigating to http://localhost:3080/c/new ...');
  await page.goto('http://localhost:3080/c/new', { waitUntil: 'networkidle2', timeout: 30000 });
  await delay(3000);

  // 1. Click Project Explorer tab in UnifiedSidebar (icon rail)
  console.log('Selecting Project Explorer tab...');
  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const tab = buttons.find(b => 
      b.getAttribute('aria-label')?.includes('Project') || 
      b.getAttribute('title')?.includes('Project') ||
      b.innerText?.includes('Project') ||
      b.querySelector('svg.lucide-folder-tree') ||
      b.querySelector('svg.lucide-folder')
    );
    if (tab) tab.click();
  });

  await delay(2000);

  // 2. Select workspace-agent-test if not already selected
  await page.evaluate(async () => {
    await fetch('/api/workspaces/select', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workspaceId: 'ws_agent_test' }),
    });
  });

  // Refresh tree
  await page.evaluate(() => {
    const refreshBtn = document.querySelector('button[title*="Refresh"]');
    if (refreshBtn) refreshBtn.click();
  });
  await delay(2000);

  // 3. Click on calculator.py to focus
  console.log('Focusing calculator.py in tree...');
  await page.evaluate(() => {
    const items = Array.from(document.querySelectorAll('div, button, span'));
    const calc = items.find(el => el.textContent?.trim() === 'calculator.py' && el.offsetParent !== null);
    if (calc) {
      calc.click();
    }
  });
  await delay(2000);

  // 4. Verify UI state
  const uiState = await page.evaluate(() => {
    const treeVisible = !!document.querySelector('.lucide-folder, .lucide-folder-tree, [data-testid*="tree"], [class*="tree"]');
    const headerChip = Array.from(document.querySelectorAll('*')).some(el => el.textContent?.includes('calculator.py') && el.textContent?.includes('FILE'));
    const chatInput = !!document.querySelector('textarea, [contenteditable="true"]');
    return { treeVisible, headerChip, chatInput };
  });

  console.log('UI Verification State:', JSON.stringify(uiState, null, 2));

  // 5. Capture full window screenshot
  await page.screenshot({ path: SCREENSHOT_PATH, fullPage: false });
  console.log(`\nScreenshot saved to: ${SCREENSHOT_PATH}`);

  // Copy to brain artifacts
  const artifactDir = 'C:\\Users\\hachimi\\.gemini\\antigravity-ide\\brain\\648bdba5-4f1f-4f2f-be06-d6d215d009c2';
  try {
    fs.copyFileSync(SCREENSHOT_PATH, path.join(artifactDir, '12-final-tree-chat.png'));
    console.log(`Copied screenshot to brain artifact dir.`);
  } catch {}

  await browser.close();
}

main().catch(err => {
  console.error('Screenshot capture error:', err);
  process.exit(1);
});
