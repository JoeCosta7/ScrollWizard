document.addEventListener('DOMContentLoaded', function() {
    const button = document.getElementById("savePage");
    button.addEventListener("click", async function () {
    const url = await getCurrentTabUrl();
    chrome.storage.local.set({'mySavedUrl': url}, function() {
    console.log('URL saved!');
     chrome.storage.local.get(['mySavedUrl'], function(result) {
        document.getElementById("link").innerHTML = result.mySavedUrl;
})
})
})
});

async function getCurrentTabUrl() {
    const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
    console.log("Current URL: ", tab.url);
    return tab.url
}