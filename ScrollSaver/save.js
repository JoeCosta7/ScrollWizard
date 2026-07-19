async function getCurrentTabUrl() {
    const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
    if(tab.url.includes("pdf-viewer.html")){
        const urlParams = new URLSearchParams(new URL(tab.url).search);
        return urlParams.get("url") || tab.url;
    }
    return tab.url;
}

async function displayUrls(entries) {
    const linkElement = document.getElementById("link");
    if (!linkElement) return;
    linkElement.innerHTML = "";
    const url = await getCurrentTabUrl();
    const entry = entries.find(e => e.url === url);
    if(!entry){
        linkElement.innerHTML = '<li class="text-gray-400 dark:text-gray-500 text-xs italic">No bookmarks saved for this page</li>';
        return;
    }
    const urlContainer = document.createElement("li");
    urlContainer.className = "bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3";

    const urlTitle = document.createElement("p");
    urlTitle.className = "font-semibold text-xs text-gray-700 dark:text-gray-200 truncate mb-2";
    urlTitle.textContent = entry.url;
    urlContainer.appendChild(urlTitle);

    entry.positions.forEach((pos, index) => {
        const itemDiv = document.createElement("div");
        itemDiv.className = "flex items-center gap-2 mt-1 ml-1";

        const posText = document.createElement("span");
        posText.className = "text-xs text-gray-500 dark:text-gray-400 flex-1";
        posText.textContent = pos[2] || `Position ${index + 1}: (X: ${pos[0]}, Y: ${pos[1]})`;
        posText.addEventListener("dblclick", function () {
            handleRenameDoubleClick(posText, entry.url, pos, index, displayUrls);
        });

        const goButton = document.createElement("button");
        goButton.textContent = "Go";
        goButton.className = "bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium px-2 py-1 rounded";
        goButton.addEventListener("click", function () {
            handleButtonClick(entry.url, pos);
        });

        const deleteButton = document.createElement("button");
        deleteButton.textContent = "Delete";
        deleteButton.className = "bg-red-500 hover:bg-red-600 text-white text-xs font-medium px-2 py-1 rounded";
        deleteButton.addEventListener("click", function () {
            handleDeleteClick(entry.url, pos);
        });

        itemDiv.appendChild(posText);
        itemDiv.appendChild(goButton);
        itemDiv.appendChild(deleteButton);
        urlContainer.appendChild(itemDiv);
    });

    linkElement.appendChild(urlContainer);
}

async function requestScrollPosition() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    let response;
    try {
        response = await chrome.tabs.sendMessage(tab.id, {message: "scrollXY"});
    } catch (e) {
        console.error('Failed to get scroll position:', e);
        return;
    }

    chrome.storage.local.get(['saves'], async function(result) {
        const saves = result.saves || [];
        const url = await getCurrentTabUrl();
        const existingEntry = saves.find(entry => entry.url === url);
        const data = [response.scrollPos[0], Math.round(response.scrollPos[1])];
        if (existingEntry) {
            data.push(`Position ${existingEntry.positions.length + 1}: (X: ${data[0]}, Y: ${data[1]})`);
            existingEntry.positions.push(data);
        } else {
            data.push(`Position 1: (X: ${data[0]}, Y: ${data[1]})`);
            saves.push({
                url: url,
                positions: [data]
            });
        }
        chrome.storage.local.set({'saves':saves}, function() {
            console.log('scroll saved');
            displayUrls(saves);
        });
    });
}

document.addEventListener('DOMContentLoaded', async function() {
    chrome.runtime.connect({ name: "popup-channel" }); //to help detect when popup closes

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    //anchors always made visible when popup is opened
    //tell pdf viewer to make the anchors visible across all pdfs
    if (tab.url && tab.url.includes('pdf-viewer.html')) {
        chrome.tabs.sendMessage(tab.id, { message: 'setAnchorsVisible', visible: true }).catch(() => {});
    } else {
        chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: () => {
                document.querySelectorAll('.saved-anchor-marker').forEach(el => {
                    el.style.visibility = 'visible';
                });
            },
        });
    }
    if (tab.url && /\.pdf($|\?)/i.test(tab.url) && !tab.url.startsWith(chrome.runtime.getURL(''))) {
        const openInViewer = document.getElementById('openInViewer');
        if (openInViewer) openInViewer.style.display = 'block';
    }
    const openInViewerBtn = document.getElementById('openInViewer');
    if (openInViewerBtn) {
        openInViewerBtn.addEventListener('click', async () => {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            const viewerUrl = chrome.runtime.getURL('pdf-viewer.html') + '?url=' + encodeURIComponent(tab.url);
            chrome.tabs.update(tab.id, { url: viewerUrl });
            window.close();
        });
    }
    chrome.storage.local.get(['saves'], function(result) {
        if (result.saves && result.saves.length > 0) {
            displayUrls(result.saves);
        } else {
            const linkEl = document.getElementById("link");
            if (linkEl) linkEl.innerHTML = '<li class="text-gray-400 text-xs italic">No bookmarks saved for this page</li>';
        }
    });
    const savePageBtn = document.getElementById("savePage");
    if (savePageBtn) {
        savePageBtn.addEventListener("click", async function () {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

            if (tab.url.includes('pdf-viewer.html')) {
                requestScrollPosition();
                return;
            }

            try {
                const results = await chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    func: () => [window.scrollX, window.scrollY]
                });
                const [x, rawY] = results[0].result;
                const y = Math.round(rawY);

                const storageResult = await chrome.storage.local.get(['saves']);
                const saves = storageResult.saves || [];
                const existingEntry = saves.find(entry => entry.url === tab.url);
                const label = existingEntry
                    ? `Position ${existingEntry.positions.length + 1}: (X: ${x}, Y: ${y})`
                    : `Position 1: (X: ${x}, Y: ${y})`;

                if (existingEntry) {
                    existingEntry.positions.push([x, y, label]);
                } else {
                    saves.push({ url: tab.url, positions: [[x, y, label]] });
                }
                await chrome.storage.local.set({ saves });

                await chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    func: (px, py, plabel) => {
                        const el = document.createElement('div');
                        el.setAttribute('id', `anchor-${px}-${py}`);
                        el.className = 'saved-anchor-marker';
                        el.textContent = plabel;
                        el.style.cssText = `position:absolute; left:0; top:${py}px; z-index:10000; background:#ef4444; color:#fff; font-weight:600; padding: 0.5rem 1.5rem 0.5rem 1rem; border-radius: 4px 0 0 4px; box-shadow:0 4px 6px -1px rgba(0,0,0,.1),0 2px 4px -1px rgba(0,0,0,.06); letter-spacing:.025em; user-select:none; font-family:sans-serif; user-select: none; clip-path: polygon(0% 0%, 100% 0%, 92% 50%, 100% 100%, 0% 100%);`;
                        document.body.appendChild(el);
                    },
                    args: [x, y, label]
                });

                displayUrls(saves);
            } catch (e) {
                console.error('Failed to create bookmark:', e);
            }
        });
    }
    const bookmarksBtn = document.getElementById("bookmarks");
    if (bookmarksBtn) {
        bookmarksBtn.addEventListener("click", () => {
            chrome.tabs.create({ url: chrome.runtime.getURL("bookmarks.html") });
        });
    }
    const settingsBtn = document.getElementById('settingsBtn');
    if (settingsBtn) {
        settingsBtn.addEventListener('click', () => {
            document.getElementById('main-view').style.display = 'none';
            document.getElementById('settings-view').style.display = 'block';
        });
    }
    const backBtn = document.getElementById('backBtn');
    if (backBtn) {
        backBtn.addEventListener('click', () => {
            document.getElementById('settings-view').style.display = 'none';
            document.getElementById('main-view').style.display = 'block';
        });
    }
    chrome.storage.local.get(['settings'], (result) => {
        const anchorToggle = document.getElementById('anchorToggle');
        if (anchorToggle) {
            anchorToggle.checked = result.settings?.anchorsVisible !== false;
            anchorToggle.addEventListener('change', (e) => {
                updateSetting('anchorsVisible', e.target.checked);
            });
        }

        const darkToggle = document.getElementById('darkToggle');
        if (darkToggle) {
            darkToggle.checked = result.settings?.darkMode === true;
            darkToggle.addEventListener('change', (e) => {
                applyTheme(e.target.checked);
                updateSetting('darkMode', e.target.checked);
            });
        }
    });
});
