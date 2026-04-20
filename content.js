console.log("[LW] content script injected");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ================= MESSAGE ================= */

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === "PING") {
    sendResponse({ ok: true });
    return;
  }

  if (msg.action === "START_LINK_WHISPER") {
    startAutomation(msg);
    sendResponse({ ok: true });
  }
});

/* ================= START ================= */

async function startAutomation(msg) {
  const tabId = msg.tabId;

  // Đánh dấu tab này đã start
  sessionStorage.setItem("lwManualStart", tabId);

  await chrome.storage.local.set({
    [`lwRunning_${tabId}`]: true,
    [`lwIndex_${tabId}`]: 0,
    [`lwLimit_${tabId}`]: msg.limit || 20,
    [`lwListUrl_${tabId}`]: msg.listUrl,
  });

  console.log("[LW] ▶️ Automation started on tab", tabId);

  run(tabId);
}

/* ================= ENTRY ================= */

async function run(passedTabId) {
  const tabId = passedTabId || sessionStorage.getItem("lwManualStart");

  if (!tabId) return;

  const state = await getState(tabId);
  if (!state.lwRunning) return;

  if (isProductList()) {
    await runOnListPage(state, tabId);
  } else if (isEditPage()) {
    await runOnEditPage(state, tabId);
  }
}

/* ================= LIST PAGE ================= */

async function runOnListPage({ lwIndex, lwLimit }, tabId) {
  console.log("[LW] 📋 On product list");

  const editLinks = Array.from(
    document.querySelectorAll("span.edit > a"),
  ).slice(0, lwLimit);

  if (lwIndex >= editLinks.length) {
    console.log("✅ Done all products");

    chrome.storage.local.set(
      {
        [`lwRunning_${tabId}`]: false,
        [`lwIndex_${tabId}`]: 0,
      },
      () => {
        sessionStorage.removeItem("lwManualStart");
        alert("✅ Link Whisper automation DONE");
      },
    );
    return;
  }

  const link = editLinks[lwIndex];
  console.log(`[LW] 👉 Open product ${lwIndex + 1}/${editLinks.length}`);

  link.scrollIntoView({ behavior: "smooth", block: "center" });
  await sleep(300);

  link.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
  await sleep(200);

  link.click();
}

/* ================= EDIT PAGE ================= */

async function runOnEditPage({ lwIndex }, tabId) {
  console.log("[LW] 📝 On edit page");

  // 1️⃣ Scroll để Link Whisper init
  window.scrollTo({ top: document.body.scrollHeight });
  await sleep(1000);
  window.scrollTo({ top: document.body.scrollHeight });
  await sleep(1000);

  await waitAndClick("button.wpil-update-selected-keywords", 3000);

  await sleep(1000);
  window.scrollTo({ top: document.body.scrollHeight });
  await sleep(1000);
  window.scrollTo({ top: document.body.scrollHeight });
  await sleep(1000);

  // 2️⃣ Check All
  const result = await waitAndClick(
    "tr.wpil-suggestion-table-heading input#select_all",
    30000,
    ["Post has reached the max link limit", "No suggestions found"],
  );
  if (result === "ABORT") {
    console.log("[LW] 🚫 Skip post (no suggestions or max limit)");
    return backToList(lwIndex, tabId);
  }
  
  console.log('[LW] ✅ Check All clicked');
  // 3️⃣ Add links
  await waitAndClick('button.sync_linking_keywords_list', 5000);
  console.log('[LW] ➕ Add clicked');

  await sleep(5000);

  backToList(lwIndex, tabId);
  if (result !== "OK") {
    console.log("[LW] ❌ No Check All → skip");
    return backToList(lwIndex, tabId);
  }
  console.log("[LW] ✅ Check All clicked");
}

/* ================= HELPERS ================= */

async function waitAndClick(selector, timeout, abortTexts = []) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    // ❌ Check tất cả abort text
    for (const text of abortTexts) {
      if (document.body.innerText.includes(text)) {
        console.log(`[LW] ⚠️ Found abort text: ${text}`);
        return "ABORT";
      }
    }
    const el = document.querySelector(selector);
    if (el) {
      el.click();
      return "OK";
    }
    window.scrollTo({ top: document.body.scrollHeight });
    await sleep(400);
  }
  return "TIMEOUT";
}

function backToList(index, tabId) {
  console.log("[LW] ↩️ Back to list");

  chrome.storage.local.get([`lwListUrl_${tabId}`], (res) => {
    chrome.storage.local.set({ [`lwIndex_${tabId}`]: index + 1 }, () => {
      window.location.href = res[`lwListUrl_${tabId}`];
    });
  });
}

function isProductList() {
  return location.href.includes("edit.php?post_type=product");
}

function isEditPage() {
  return (
    location.href.includes("post.php") &&
    location.search.includes("action=edit")
  );
}

function getState(tabId) {
  return new Promise((resolve) => {
    chrome.storage.local.get(
      [
        `lwRunning_${tabId}`,
        `lwIndex_${tabId}`,
        `lwLimit_${tabId}`,
        `lwListUrl_${tabId}`,
      ],
      (res) => {
        resolve({
          lwRunning: res[`lwRunning_${tabId}`],
          lwIndex: res[`lwIndex_${tabId}`] || 0,
          lwLimit: res[`lwLimit_${tabId}`] || 20,
          lwListUrl: res[`lwListUrl_${tabId}`],
        });
      },
    );
  });
}

run();
