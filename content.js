console.log('[LW] content script injected');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ================= MESSAGE ================= */

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === 'PING') {
    sendResponse({ ok: true });
    return;
  }

  if (msg.action === 'START_LINK_WHISPER') {
    startAutomation(msg);
    sendResponse({ ok: true });
  }
});

/* ================= START ================= */

async function startAutomation(msg) {
  // ✅ Đánh dấu tab này đã nhấn Start
  sessionStorage.setItem('lwManualStart', '1');

  await chrome.storage.local.set({
    lwRunning: true,
    lwIndex: 0,
    lwLimit: msg.limit || 20,
    lwListUrl: msg.listUrl,
  });

  console.log('[LW] ▶️ Automation started');
  run();
}

/* ================= ENTRY ================= */

async function run() {
  // ❌ Chưa nhấn Start trong tab này → KHÔNG chạy
  if (!sessionStorage.getItem('lwManualStart')) return;

  const state = await getState();
  if (!state.lwRunning) return;

  if (isProductList()) {
    await runOnListPage(state);
  } else if (isEditPage()) {
    await runOnEditPage(state);
  }
}

/* ================= LIST PAGE ================= */

async function runOnListPage({ lwIndex, lwLimit }) {
  console.log('[LW] 📋 On product list');

  const editLinks = Array.from(
    document.querySelectorAll('span.edit > a'),
  ).slice(0, lwLimit);

  if (lwIndex >= editLinks.length) {
    console.log('✅ Done all products');

    chrome.storage.local.set(
      {
        lwRunning: false,
        lwIndex: 0,
      },
      () => {
        // ✅ Clear flag để không auto chạy lại
        sessionStorage.removeItem('lwManualStart');
        alert('✅ Link Whisper automation DONE');
      },
    );
    return;
  }

  const link = editLinks[lwIndex];
  console.log(`[LW] 👉 Open product ${lwIndex + 1}/${editLinks.length}`);

  link.scrollIntoView({ behavior: 'smooth', block: 'center' });
  await sleep(300);

  link.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
  await sleep(200);

  link.click();
}

/* ================= EDIT PAGE ================= */

async function runOnEditPage({ lwIndex }) {
  console.log('[LW] 📝 On edit page');

  // 1️⃣ Scroll để Link Whisper init
  window.scrollTo({ top: document.body.scrollHeight });
  await sleep(1000);
  window.scrollTo({ top: document.body.scrollHeight });
  await sleep(1000);

  await waitAndClick('button.wpil-update-selected-keywords', 3000);

  await sleep(1000);
  window.scrollTo({ top: document.body.scrollHeight });
  await sleep(1000);
  window.scrollTo({ top: document.body.scrollHeight });
  await sleep(1000);

  // 2️⃣ Check All
  const hasCheckAll = await waitAndClick(
    'tr.wpil-suggestion-table-heading input#select_all',
    10000,
  );

  if (!hasCheckAll) {
    console.log('[LW] ❌ No Check All → skip');
    return backToList(lwIndex);
  }

  console.log('[LW] ✅ Check All clicked');

  // 3️⃣ Add links
  await waitAndClick('button.sync_linking_keywords_list', 5000);
  console.log('[LW] ➕ Add clicked');

  await sleep(5000);

  backToList(lwIndex);
}

/* ================= HELPERS ================= */

async function waitAndClick(selector, timeout) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const el = document.querySelector(selector);
    if (el) {
      el.click();
      return true;
    }
    await sleep(400);
  }
  return false;
}

function backToList(index) {
  console.log('[LW] ↩️ Back to list');

  chrome.storage.local.get(['lwListUrl'], (res) => {
    chrome.storage.local.set({ lwIndex: index + 1 }, () => {
      window.location.href = res.lwListUrl;
    });
  });
}

function isProductList() {
  return location.href.includes('edit.php?post_type=product');
}

function isEditPage() {
  return (
    location.href.includes('post.php') &&
    location.search.includes('action=edit')
  );
}

function getState() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['lwRunning', 'lwIndex', 'lwLimit'], resolve);
  });
}

/* ✅ RẤT QUAN TRỌNG
   - run() CẦN để resume sau reload
   - nhưng đã bị khóa bởi sessionStorage
*/
run();
