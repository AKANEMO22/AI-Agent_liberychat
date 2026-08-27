const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const EVIDENCE_DIR = path.resolve(__dirname, 'audit-logs/2026-08-27_001000/tree-chat-final');

async function captureTabSwitching() {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1440,900']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  await page.goto('http://localhost:3080/c/new', { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 2000));

  // 1. Click Project Explorer tab
  const buttons = await page.$$('aside button');
  let explorerBtn = null;
  let convBtn = null;
  for (const btn of buttons) {
    const text = await page.evaluate(el => el.getAttribute('aria-label') || el.getAttribute('title') || '', btn);
    const html = await page.evaluate(el => el.innerHTML, btn);
    if (text.includes('Project Explorer') || html.includes('FolderTree') || html.includes('lucide-folder-tree')) {
      explorerBtn = btn;
    }
    if (text.includes('chat_history') || html.includes('MessagesSquare') || html.includes('lucide-messages-square')) {
      convBtn = btn;
    }
  }

  if (explorerBtn) {
    await explorerBtn.click();
    await new Promise(r => setTimeout(r, 1200));
  }

  // 2. Click Conversations tab
  if (convBtn) {
    await convBtn.click();
    await new Promise(r => setTimeout(r, 1200));
    console.log('Capturing 05-conversations-tab.png with conversations panel open...');
    await page.screenshot({ path: path.join(EVIDENCE_DIR, '05-conversations-tab.png') });
  }

  // 3. Return to Project Explorer tab
  if (explorerBtn) {
    await explorerBtn.click();
    await new Promise(r => setTimeout(r, 1200));
    console.log('Capturing 06-return-to-explorer.png with tree open...');
    await page.screenshot({ path: path.join(EVIDENCE_DIR, '06-return-to-explorer.png') });
  }

  // 4. Capture 07-resized.png
  console.log('Capturing 07-resized.png...');
  await page.screenshot({ path: path.join(EVIDENCE_DIR, '07-resized.png') });

  await browser.close();
  console.log('Tab switching captures complete.');
}

captureTabSwitching().catch(console.error);
