import * as pdfjsLib from './pdfjs/pdf.mjs';

pdfjsLib.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL('pdfjs/pdf.worker.mjs');

const params = new URLSearchParams(window.location.search);
const pdfUrl = params.get('url');
let scrollTarget = null;

if (params.has('scrollX') && params.has('scrollY')) {
    scrollTarget = {
        x: parseInt(params.get('scrollX')),
        y: parseInt(params.get('scrollY'))
    };
}

document.title = decodeURIComponent(pdfUrl.split('/').pop() || 'PDF Document');
document.getElementById('pdf-title').textContent = document.title;

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.message === "scrollXY") {
        sendResponse({ scrollPos: [window.scrollX, window.scrollY] });
    } else if (request.message === "scrollTo") {
        window.scrollTo({ left: request.x, top: request.y, behavior: 'smooth' });
    } else if (request.message === "setAnchorsVisible") {
        document.querySelectorAll('.saved-anchor-marker').forEach(el => {
            el.style.visibility = request.visible ? 'visible' : 'hidden';
        });
    }
});

function renderBookmarkMarkers() {
    document.querySelectorAll('.saved-anchor-marker').forEach(el => el.remove());
    chrome.storage.local.get(['saves', 'settings'], (result) => {
        const anchorsVisible = result.settings?.anchorsVisible !== false;
        const entry = (result.saves || []).find(s => s.url === pdfUrl);
        if (!entry) return;
        const container = document.getElementById('pdf-container');
        container.style.position = 'relative';
        entry.positions.forEach(pos => {
            const marker = document.createElement('div');
            marker.id = `anchor-${pos[0]}-${pos[1]}`;
            marker.classList.add('saved-anchor-marker');
            marker.textContent = pos[2];
            marker.style.cssText = `position:absolute; left:0; top:${pos[1]}px; z-index:10000; background:#ef4444; color:#fff; font-weight:600; padding: 0.5rem 1.5rem 0.5rem 1rem; border-radius: 4px 0 0 4px; box-shadow:0 4px 6px -1px rgba(0,0,0,.1),0 2px 4px -1px rgba(0,0,0,.06); letter-spacing:.025em; user-select:none; font-family:sans-serif; user-select: none; clip-path: polygon(0% 0%, 100% 0%, 92% 50%, 100% 100%, 0% 100%);`;
            marker.style.visibility = anchorsVisible ? 'visible' : 'hidden';
            container.appendChild(marker);
        });
    });
}

chrome.storage.onChanged.addListener(renderBookmarkMarkers);

async function loadPdf() {
    try {
        const loadingTask = pdfjsLib.getDocument({
            url : pdfUrl,
            cMapUrl: chrome.runtime.getURL('pdfjs/cmaps/'),
            cMapPacked: true,
            wasmUrl: chrome.runtime.getURL('pdfjs/wasm/')
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
        if (scrollTarget) {
            window.scrollTo({ left: scrollTarget.x, top: scrollTarget.y, behavior: 'smooth' });
        }
    } catch (err) {
        console.error('ScrollSaver PDF load failed:', err);
        const container = document.getElementById('pdf-container');
        if (container) {
            const box = document.createElement('div');
            box.style.cssText = 'color:#fecaca; background:rgba(127,29,29,.4); border:1px solid #ef4444; border-radius:.5rem; padding:1rem; margin:1rem; max-width:42rem; font-size:.875rem; white-space:pre-wrap; overflow-wrap:break-word; font-family:sans-serif;';
            box.textContent = `Failed to load PDF:\n${err && err.message ? err.message : err}`;
            container.appendChild(box);
        }
    }
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