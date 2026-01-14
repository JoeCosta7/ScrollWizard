document.addEventListener('DOMContentLoaded', function() {
    chrome.storage.local.get(['mySavedUrl'], function(result) {
        if (result.mySavedUrl) {
            document.getElementById("link").innerHTML = result.mySavedUrl;
        } else {
            document.getElementById("link").innerHTML = "No URL saved yet";
        }
    });
    const button = document.getElementById("savePage");
    button.addEventListener("click", async function () {
        console.log("hello");
        
        const url = await getCurrentTabUrl();

        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
              chrome.scripting.executeScript({
                target: { tabId: tabs[0].id },
                func: sendScrollPosition
              })
              .then(requestScrollPosition());
            })
        
        chrome.storage.local.set({'mySavedUrl': url}, function() {
            console.log('URL saved!');
            document.getElementById("link").innerHTML = url;
        });
    });
});

async function getCurrentTabUrl() {
    const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
    console.log("Current URL: ", tab.url);
    return tab.url;
}

async function requestScrollPosition() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const response = await chrome.tabs.sendMessage(tab.id, {message: "scrollXY"});
    chrome.storage.local.set({'scrollPos': response.scrollPos}, function() {
            console.log('scroll saved');
        });
}

function sendScrollPosition(){
    chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
        if (request.message == "scrollXY") {
            sendResponse({ scrollPos: [window.scrollX,window.scrollY] });
        }
    }
);
}
