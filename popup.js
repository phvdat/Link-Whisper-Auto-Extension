document.getElementById('start').addEventListener('click', async () => {
  const limit = parseInt(document.getElementById('limit').value, 10) || 20;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  chrome.tabs.sendMessage(tab.id, { action: 'PING' }, () => {
    if (chrome.runtime.lastError) {
      alert('Trang này không hỗ trợ');
      return;
    }

    chrome.tabs.sendMessage(tab.id, {
      action: 'START_LINK_WHISPER',
      limit,
      listUrl: tab.url,
      tabId: tab.id,
    });
  });
});