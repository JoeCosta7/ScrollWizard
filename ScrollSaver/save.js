document.addEventListener('DOMContentLoaded', async function() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab.url && /\.pdf($|\?)/i.test(tab.url) && !tab.url.startsWith(chrome.runtime.getURL(''))) {
        document.getElementById('openInViewer').style.display = 'block';
    }
    document.getElementById('openInViewer').addEventListener('click', async () => {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        const viewerUrl = chrome.runtime.getURL('pdf-viewer.html') + '?url=' + encodeURIComponent(tab.url);
        chrome.tabs.update(tab.id, { url: viewerUrl });
        window.close();
    });
    chrome.storage.local.get(['saves'], function(result) {
        if (result.saves && result.saves.length > 0) {
            displayUrls(result.saves)
        } else {
            document.getElementById("link").innerHTML = '<li class="text-gray-400 text-xs italic">No bookmarks saved for this page</li>';
        }
    });
    const button = document.getElementById("savePage");
    button.addEventListener("click", async function () {
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
            const [x, y] = results[0].result;

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
                    el.style.cssText = `position:absolute; left:0; top:${py}px; z-index:10000; background:#ef4444; color:#fff; font-weight:600; padding:0.5rem 1rem; border-radius:9999px; box-shadow:0 4px 6px -1px rgba(0,0,0,.1),0 2px 4px -1px rgba(0,0,0,.06); letter-spacing:.025em; user-select:none; font-family:sans-serif;`;
                    document.body.appendChild(el);
                },
                args: [x, y, label]
            });

            displayUrls(saves);
        } catch (e) {
            console.error('Failed to create bookmark:', e);
        }
    });
    document.getElementById("bookmarks").addEventListener("click", () => {
        chrome.tabs.create({ url: chrome.runtime.getURL("bookmarks.html") });
    });
    document.getElementById('settingsBtn').addEventListener('click', () => {
        document.getElementById('main-view').style.display = 'none';
        document.getElementById('settings-view').style.display = 'block';
    });
    document.getElementById('backBtn').addEventListener('click', () => {
    document.getElementById('settings-view').style.display = 'none';
    document.getElementById('main-view').style.display = 'block';
    });
    chrome.storage.local.get(['settings'], (result) => {
    document.getElementById('anchorToggle').checked = result.settings?.anchorsVisible !== false;

    document.getElementById('anchorToggle').addEventListener('change', async (e) => {
       const visible = e.target.checked;
       chrome.storage.local.set({settings: {anchorsVisible: visible}}) 
       const [tab] = await chrome.tabs.query({active : true})
       if (tab.url.includes('pdf-viewer.html')) return;
       chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: (v) => {
            document.querySelectorAll('.saved-anchor-marker').forEach(el => {
                el.style.visibility = v ? 'visible' : 'hidden';
            });
        },
        args: [visible]
       })
    });


async function displayUrls(entries) {
    const linkElement = document.getElementById("link");
    linkElement.innerHTML = "";
    const url = await getCurrentTabUrl();
    const entry = entries.find(e => e.url === url)
    if(!entry){
        linkElement.innerHTML = '<li class="text-gray-400 text-xs italic">No bookmarks saved for this page</li>';
        return;
    }
    const urlContainer = document.createElement("li");
    urlContainer.className = "bg-gray-50 border border-gray-200 rounded-lg p-3";

    const urlTitle = document.createElement("p");
    urlTitle.className = "font-semibold text-xs text-gray-700 truncate mb-2";
    urlTitle.textContent = entry.url;
    urlContainer.appendChild(urlTitle);

    entry.positions.forEach((pos, index) => {
        const itemDiv = document.createElement("div");
        itemDiv.className = "flex items-center gap-2 mt-1 ml-1";

        const posText = document.createElement("span");
        posText.className = "text-xs text-gray-500 flex-1";
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

async function getCurrentTabUrl() {
    const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
    if(tab.url.includes("pdf-viewer.html")){
        const urlParams = new URLSearchParams(new URL(tab.url).search);
        return urlParams.get("url") || tab.url;
    }
    console.log("Current URL: ", tab.url);
    return tab.url;
}

async function requestScrollPosition() { //entries are saved here
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
        const data = response.scrollPos;
        if (existingEntry) { //if urls already saved to this page, add to list
            data.push(`Position ${existingEntry.positions.length + 1}: (X: ${response.scrollPos[0]}, Y: ${response.scrollPos[1]})`)
            existingEntry.positions.push(data);
        } else {
            data.push(`Position 1: (X: ${response.scrollPos[0]}, Y: ${response.scrollPos[1]})`)
            saves.push({ //else, initialize the list
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

    

function sendScrollPosition(){
    if (!window.__scrollSaverListenerAdded) {
        window.__scrollSaverListenerAdded = true;
        chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
            if (request.message == "scrollXY") {
                sendResponse({ scrollPos: [window.scrollX, window.scrollY] });
            }
        });
    }
    try{
        document.getElementById('newAnchor').style.top = window.scrollY + "px";
    } catch {
        const newElement = document.createElement("div");
        newElement.setAttribute("id", `anchor-${window.scrollX}-${window.scrollY}`);
        const index = document.querySelectorAll(".saved-anchor-marker").length;
        newElement.textContent = `Position ${index + 1}: (X: ${window.scrollX}, Y: ${window.scrollY})`;
        newElement.className = "saved-anchor-marker bg-red-500 text-white text-large font-semibold px-4 py-2 rounded-full shadow-md tracking-wide select-none";
        newElement.style.position = "absolute";
        newElement.style.left = "0px";
        newElement.style.top = window.scrollY + "px";
        newElement.style.zIndex = "10000";

        document.body.appendChild(newElement);
    }
}
    });
});
