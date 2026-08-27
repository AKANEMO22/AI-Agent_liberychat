const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const EVIDENCE_DIR = path.resolve(__dirname, 'audit-logs/2026-08-27_001000/tree-chat-final');
if (!fs.existsSync(EVIDENCE_DIR)) {
  fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
}

async function runEvidencePipeline() {
  console.log('============================================================');
  console.log(' STARTING REAL BROWSER UI VERIFICATION & EVIDENCE CAPTURE');
  console.log('============================================================\n');

  // Select workspace-agent-test on backend
  await fetch('http://127.0.0.1:3080/api/workspaces/select', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ workspaceId: 'ws_agent_test' })
  });

  const browser = await puppeteer.launch({
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--window-size=1440,900',
    ]
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  console.log('Navigating directly to http://localhost:3080/c/new ...');
  await page.goto('http://localhost:3080/c/new', { waitUntil: 'networkidle2', timeout: 30000 });
  await new Promise(r => setTimeout(r, 2500));

  console.log('Current URL:', page.url());

  // 1. Screenshot 01-before.png
  console.log('Saving 01-before.png...');
  await page.screenshot({ path: path.join(EVIDENCE_DIR, '01-before.png') });

  // 2. Click Project Explorer button on Icon Rail
  console.log('Locating Project Explorer button on left rail...');
  const asideButtons = await page.$$('aside button');
  console.log(`Found ${asideButtons.length} sidebar buttons.`);

  let clicked = false;
  for (const btn of asideButtons) {
    const text = await page.evaluate(el => el.getAttribute('aria-label') || el.getAttribute('title') || '', btn);
    const html = await page.evaluate(el => el.innerHTML, btn);
    if (text.includes('Project Explorer') || html.includes('FolderTree') || html.includes('lucide-folder-tree')) {
      console.log('Clicking Project Explorer button...');
      await btn.click();
      clicked = true;
      break;
    }
  }

  if (!clicked && asideButtons.length >= 2) {
    console.log('Clicking second icon on left rail...');
    await asideButtons[1].click();
  }

  await new Promise(r => setTimeout(r, 2000));

  // 2. Screenshot 02-project-explorer-open.png (Tree left, Chat right)
  console.log('Saving 02-project-explorer-open.png...');
  await page.screenshot({ path: path.join(EVIDENCE_DIR, '02-project-explorer-open.png') });

  // 3. Click calculator.py to focus
  console.log('Selecting calculator.py in file tree...');
  const items = await page.$$('aside div');
  for (const item of items) {
    const text = await page.evaluate(el => el.innerText || '', item);
    if (text.includes('calculator.py')) {
      await item.click();
      console.log('Clicked calculator.py');
      break;
    }
  }
  await new Promise(r => setTimeout(r, 1200));

  // 3. Screenshot 03-file-focused.png
  console.log('Saving 03-file-focused.png...');
  await page.screenshot({ path: path.join(EVIDENCE_DIR, '03-file-focused.png') });

  // 4. Expand folder (e.g. tests or src)
  console.log('Expanding directory...');
  for (const item of items) {
    const text = await page.evaluate(el => el.innerText || '', item);
    if (text.includes('Thư mục') || text.includes('tests') || text.includes('src') || text.includes('fixtures')) {
      await item.click();
      console.log('Clicked folder:', text);
      break;
    }
  }
  await new Promise(r => setTimeout(r, 1200));

  // 4. Screenshot 04-folder-expanded.png
  console.log('Saving 04-folder-expanded.png...');
  await page.screenshot({ path: path.join(EVIDENCE_DIR, '04-folder-expanded.png') });

  // 5. Switch to Conversations Tab
  console.log('Switching to Conversations tab...');
  const railBtns = await page.$$('aside button');
  if (railBtns.length > 0) {
    await railBtns[0].click();
  }
  await new Promise(r => setTimeout(r, 1200));

  // 5. Screenshot 05-conversations-tab.png
  console.log('Saving 05-conversations-tab.png...');
  await page.screenshot({ path: path.join(EVIDENCE_DIR, '05-conversations-tab.png') });

  // 6. Return to Explorer tab
  console.log('Returning to Project Explorer tab...');
  if (railBtns.length > 1) {
    await railBtns[1].click();
  }
  await new Promise(r => setTimeout(r, 1200));

  // 6. Screenshot 06-return-to-explorer.png
  console.log('Saving 06-return-to-explorer.png...');
  await page.screenshot({ path: path.join(EVIDENCE_DIR, '06-return-to-explorer.png') });

  // 7. Drag / Resize sidebar
  console.log('Simulating sidebar resize...');
  const separator = await page.$('aside div[role="separator"]');
  if (separator) {
    const box = await separator.boundingBox();
    if (box) {
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      await page.mouse.move(box.x + 80, box.y + box.height / 2);
      await page.mouse.up();
    }
  }
  await new Promise(r => setTimeout(r, 1000));

  // 7. Screenshot 07-resized.png
  console.log('Saving 07-resized.png...');
  await page.screenshot({ path: path.join(EVIDENCE_DIR, '07-resized.png') });

  await browser.close();
  console.log('\nAll 7 Screenshots successfully captured and saved in:', EVIDENCE_DIR);
}

runEvidencePipeline().catch(err => {
  console.error('Evidence script failed:', err);
  process.exit(1);
});
