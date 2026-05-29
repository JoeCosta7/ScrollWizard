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

function handleRenameDoubleClick(posText, savedUrl, savedPosition, index, onCommit) {
    const defaultName = `Position ${index + 1}: (X: ${savedPosition[0]}, Y: ${savedPosition[1]})`;
    const input = Object.assign(document.createElement("input"), {
        type: "text",
        value: savedPosition[2] || defaultName,
        className: "text-xs text-gray-500 flex-1 outline-none border border-blue-400 rounded px-1 min-w-0"
    });

    let cancelled = false;

      //Cancel when you hit escape
    input.addEventListener("keydown", e => {
        if (e.key === "Enter") input.blur();
        else if (e.key === "Escape") { cancelled = true; input.replaceWith(posText); }
    });


    //Blur event saves when you hit enter or click away
    input.addEventListener("blur", () => {
        if (cancelled) return;
        const newName = input.value.trim() || defaultName;
        chrome.storage.local.get(['saves'], ({ saves: entries = [] }) => {
            entries.find(e => e.url === savedUrl)
                   .positions.find(p => p[0] === savedPosition[0] && p[1] === savedPosition[1])[2] = newName;
            chrome.storage.local.set({ saves: entries }, () => onCommit(entries));
        });

        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            chrome.scripting.executeScript({
                target: { tabId: tabs[0].id },
                func: (x, y, name) => {
                    const anchor = document.getElementById(`anchor-${x}-${y}`);
                    if (anchor) anchor.textContent = name;
                },
                args: [savedPosition[0], savedPosition[1], newName]
            });
        });
    });

    posText.replaceWith(input);
    input.focus();
    input.select();
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
