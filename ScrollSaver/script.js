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


