import * as pdfjsLib from './pdfjs/pdf.mjs';

pdfjsLib.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL('pdfjs/pdf.worker.mjs');

const params = new URLSearchParams(window.location.search);
const pdfUrl = params.get('url');

document.title = decodeURIComponent(pdfUrl.split('/').pop() || 'PDF Document');
document.getElementById('pdf-title').textContent = document.title;

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.message === "scrollXY") {
        sendResponse({ scrollPos: [window.scrollX, window.scrollY] });
    } else if (request.message === "scrollTo") {
        window.scrollTo({ left: request.x, top: request.y, behavior: 'smooth' });
    }
});

function renderBookmarkMarkers() {
    document.querySelectorAll('.saved-anchor-marker').forEach(el => el.remove());
    chrome.storage.local.get(['saves'], (result) => {
        const entry = (result.saves || []).find(s => s.url === pdfUrl);
        if (!entry) return;
        const container = document.getElementById('pdf-container');
        container.style.position = 'relative';
        entry.positions.forEach(pos => {
            const marker = document.createElement('div');
            marker.id = `anchor-${pos[0]}-${pos[1]}`;
            marker.classList.add('saved-anchor-marker');
            marker.textContent = pos[2];
            marker.style.cssText = `position:absolute;left:0;top:${pos[1]}px;background:red;color:white;padding:10px;z-index:10000;`;
            container.appendChild(marker);
        });
    });
}

chrome.storage.onChanged.addListener(renderBookmarkMarkers);

async function loadPdf() {
    const loadingTask = pdfjsLib.getDocument({
        url : pdfUrl,
        cMapUrl: chrome.runtime.getURL('pdfjs/cmaps/'),
        cMapPacked: true
    });

    const pdf = await loadingTask.promise;
    const container = document.getElementById('pdf-container');
    const scale = 1.5;
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const viewport = page.getViewport({ scale });
        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        canvas.dataset.pageNum = pageNum;
        canvas.classList.add('pdf-page');
        container.appendChild(canvas);

        await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
    }
        updatePage();
        renderBookmarkMarkers();

}
function updatePage() {
      const canvases = document.querySelectorAll('.pdf-page');
  const scrollMid = window.scrollY + window.innerHeight / 2;
  for (const canvas of canvases) {
    const top = canvas.offsetTop;
    const bottom = top + canvas.height;
    if (scrollMid >= top && scrollMid < bottom) {
      document.getElementById('page-indicator').textContent =
        `Page ${canvas.dataset.pageNum}`;
      break;
    }
  }
}

window.addEventListener('scroll', updatePage, { passive: true });
loadPdf();

