async function handleButtonClick(savedUrl, savedPosition) {
  const url = await getCurrentTabUrl();

  if(url!=savedUrl){
    chrome.tabs.create({ url: savedUrl }, newTab => {
      chrome.scripting.executeScript({
        target: { tabId: newTab.id },
        func: loadScrollPos,
        args: [savedPosition[0],savedPosition[1]]
      })
    })
  }
  else {
    executeScroll(savedPosition[0],savedPosition[1]); 
  }
};

function handleDeleteClick(savedUrl, savedPosition) {
        chrome.storage.local.get(['saves'], function(result) {
        const entries = result.saves || [];
        const urlEntryIndex = entries.findIndex(entry => entry.url === savedUrl);
        const index = entries[urlEntryIndex].positions.findIndex(pos => 
            pos[0] === savedPosition[0] && pos[1] === savedPosition[1]
        );

        entries[urlEntryIndex].positions.splice(index, 1);
        if (entries[urlEntryIndex].positions.length === 0) {
          entries.splice(urlEntryIndex, 1);
        }

        chrome.storage.local.set({ 'saves' : entries}, function() {
            console.log('URL and scroll position deleted');
            displayUrls(entries);
        });

        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            chrome.scripting.executeScript( {
            target: { tabId: tabs[0].id },
            func: (x, y) => {
              document.getElementById(`anchor-${x}-${y}`).remove();
            },
            args: [savedPosition[0],savedPosition[1]]
            });
        })
    });
}

function loadScrollPos(x, y) {
  window.scrollTo({
    left: x, 
    top: y,
    behavior: 'smooth'
  });
}

function executeScroll(x, y){
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs[0]) return;
    chrome.scripting.executeScript({
      target: { tabId: tabs[0].id },
      func: loadScrollPos,
      args: [x,y]
    })
  })
}


