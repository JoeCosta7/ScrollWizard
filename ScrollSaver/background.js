chrome.commands.onCommand.addListener(async (command) => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if(!tab) return;
    
    if (command === "create-bookmark") {
        await handleCreateBookmark(tab);
    } else if (command === "next-bookmark") {
        await handleNavigateBookmark(tab, "next");
    } else if (command === "previous-bookmark") {
        await handleNavigateBookmark(tab, "previous");
    }
});

async function getTabUrl(tab) {
    if (tab.url.includes('pdf-viewer.html')) {
        const urlParams = new URLSearchParams(new URL(tab.url).search);
        return urlParams.get('url') || tab.url;
    }
    return tab.url;
}

async function handleCreateBookmark(tab) {
    const isPdfViewer = tab.url.includes(chrome.runtime.getURL("pdf-viewer.html"));
    let scrollPos; 
    if (isPdfViewer) {
        const response = await chrome.tabs.sendMessage(tab.id, { message: "scrollXY" });
        scrollPos = response.scrollPos;
    } else {
        const results = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: () => [window.scrollX, window.scrollY]
        });
        scrollPos = results[0].result;
    }
    const url = await getTabUrl(tab);
    const result = await chrome.storage.local.get(['saves']);
    const saves = result.saves || [];
    const existingEntry = saves.find(entry => entry.url === url);

    const [x, y] = scrollPos;
    const label = existingEntry
        ? `Position ${existingEntry.positions.length + 1}: (X: ${x}, Y: ${y})`
        : `Position 1: (X: ${x}, Y: ${y})`;
    const data = [x, y, label];

    if (existingEntry) {
        existingEntry.positions.push(data);
    } else {
        saves.push({ url, positions: [data] });
    }
    await chrome.storage.local.set({ saves });

    if (!isPdfViewer) {
        await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: (px, py, plabel) => {
                const el = document.createElement('div');
                el.setAttribute('id', `anchor-${px}-${py}`);
                el.className = 'saved-anchor-marker';
                el.textContent = plabel;
                el.style.cssText = `position:absolute; left:0; top:${py}px; z-index:10000; background:#ef4444; color:#fff; font-weight:600; padding:0.5rem 1rem; border-radius:9999px; box-shadow:0 4px 6px -1px rgba(0,0,0,.1),0 2px 4px -1px rgba(0,0,0,.06); letter-spacing:.025em; user-select:none; font-family:sans-serif;`;
                document.body.appendChild(el);
            },
            args: [x, y, label]
        });
    }
}
async function handleNavigateBookmark(tab, direction) {
    const url = await getTabUrl(tab);
    const isPdfViewer = tab.url.includes(chrome.runtime.getURL('pdf-viewer.html'));
    const result = await chrome.storage.local.get(['saves']);
    const saves = result.saves || [];
    const entry = saves.find(e => e.url === url);
    if (!entry || entry.positions.length === 0) return;

    let currentY;
    if (isPdfViewer) {
        const response = await chrome.tabs.sendMessage(tab.id, { message: 'scrollXY' });
        currentY = response.scrollPos[1];
    } else {
        const results = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: () => window.scrollY
        });
        currentY = results[0].result;
    }

    const sorted = [...entry.positions].sort((a, b) => a[1] - b[1]);
    let target;

    if (direction === "next") {
        target = sorted.find(p => p[1] > currentY + 5) || sorted[0];
    } 
    if (direction === "previous") {
        const prev = sorted.filter(p => p[1] < currentY - 5);
        target = prev.length > 0 ? prev[prev.length - 1] : sorted[0];
    }
    if (isPdfViewer) {
        chrome.tabs.sendMessage(tab.id, { message: 'scrollTo', x: target[0], y: target[1] });
    } else {
        await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: (x, y) => window.scrollTo({ left: x, top: y, behavior: 'smooth' }),
            args: [target[0], target[1]]
        });
    }
}