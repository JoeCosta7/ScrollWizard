document.addEventListener('DOMContentLoaded', function() {
    chrome.storage.local.get(['saves'], function(result) {
        if (result.saves && result.saves.length > 0) {
            displayUrls(result.saves)
        } else {
            document.getElementById("link").innerHTML = '<li class="text-gray-400 text-xs italic">No bookmarks saved for this page</li>';
        }
    });
    const button = document.getElementById("savePage");
    button.addEventListener("click", async function () {
        
        const url = await getCurrentTabUrl();

        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            chrome.scripting.executeScript( {
            target: { tabId: tabs[0].id },
            func: sendScrollPosition,
            })
            .then(requestScrollPosition);
        })
    });
    document.getElementById("bookmarks").addEventListener("click", () => {
        chrome.tabs.create({ url: chrome.runtime.getURL("bookmarks.html") });
    });
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
    console.log("Current URL: ", tab.url);
    return tab.url;
}

async function requestScrollPosition() { //entries are saved here
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const response = await chrome.tabs.sendMessage(tab.id, {message: "scrollXY"});
    
    chrome.storage.local.get(['saves'], async function(result) {
        const saves = result.saves || [];
        const url = await getCurrentTabUrl();
        const existingEntry = saves.find(entry => entry.url === url);
        if (existingEntry) { //if urls already saved to this page, add to list
            existingEntry.positions.push(response.scrollPos);
        } else {
            saves.push({ //else, initialize the list
                url: url,
                positions: [response.scrollPos]
            });
        }
        chrome.storage.local.set({'saves':saves}, function() {
            console.log('scroll saved');
            displayUrls(saves);
        });
    });
}   

    

function sendScrollPosition(){
    chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
        if (request.message == "scrollXY") {
            sendResponse({ scrollPos: [window.scrollX,window.scrollY] });
        }
    });
    try{
        document.getElementById('newAnchor').style.top = window.scrollY + "px";
    } catch {
        const newElement = document.createElement("div");
        newElement.setAttribute("id", `anchor-${window.scrollX}-${window.scrollY}`);
        newElement.textContent = `Anchor ${window.scrollX}, ${window.scrollY}`;
        newElement.style.position = "absolute";
        newElement.style.left = "0px";
        newElement.style.top = window.scrollY + "px";
        newElement.style.backgroundColor = "red";
        newElement.style.padding = "10px";
        newElement.style.zIndex = "10000";

        document.body.appendChild(newElement);
    }
}
