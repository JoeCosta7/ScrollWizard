document.getElementById('loadPage').addEventListener('click', function() {
  chrome.storage.local.get(['mySavedUrl', 'scrollPos'], async function(result) {
        if (result.mySavedUrl) {
            const url = await getCurrentTabUrl();

            if(url!=result.mySavedUrl){
              chrome.tabs.create({ url: result.mySavedUrl });
            }

            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
              chrome.scripting.executeScript({
                target: { tabId: tabs[0].id },
                func: loadScrollPos
              })
              .then(() => chrome.tabs.sendMessage(tabs[0].id,{scrollPos:[result.scrollPos[0],result.scrollPos[1]]}));
            })
            
        } else {
            console.log("no url");
        }
    });
});

function loadScrollPos() {
    chrome.runtime.onMessage.addListener(message=>{
      if (message.scrollPos) {
          window.scrollTo(message.scrollPos[0], message.scrollPos[1]);
      }
  });
}

