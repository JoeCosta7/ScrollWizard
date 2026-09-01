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
            marker.className = "saved-anchor-marker bg-red-500 text-white text-base font-semibold px-4 py-2 rounded-full shadow-md tracking-wide select-none";
            marker.style.position = "absolute";
            marker.style.left = "0px";
            marker.style.top = pos[1] + "px";
            marker.style.zIndex = "10000";
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

            const pageWrapper = document.createElement('div');
            pageWrapper.classList.add('pdf-page-wrapper');
            pageWrapper.dataset.pageNum = pageNum;
            pageWrapper.style.position = 'relative';
            pageWrapper.style.width = viewport.width + 'px';
            pageWrapper.style.height = viewport.height + 'px';
            pageWrapper.style.setProperty('--total-scale-factor', scale);

            const canvas = document.createElement('canvas');
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            canvas.classList.add('pdf-page');
            pageWrapper.appendChild(canvas);

            await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;

            const textLayerDiv = document.createElement('div');
            textLayerDiv.classList.add('textLayer');
            pageWrapper.appendChild(textLayerDiv);
            await new pdfjsLib.TextLayer({
                textContentSource: page.streamTextContent(),
                container: textLayerDiv,
                viewport
            }).render();

            container.appendChild(pageWrapper);
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
    const pages = document.querySelectorAll('.pdf-page-wrapper');
    const scrollMid = window.scrollY + window.innerHeight / 2;
    for (const page of pages) {
    const top = page.offsetTop;
    const bottom = top + page.offsetHeight;
    if (scrollMid >= top && scrollMid < bottom) {
        document.getElementById('page-indicator').textContent =
            `Page ${page.dataset.pageNum}`;
        break;
    }
  }
}

window.addEventListener('scroll', updatePage, { passive: true });
loadPdf();