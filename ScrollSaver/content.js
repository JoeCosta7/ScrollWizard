
chrome.storage.local.get(['saves', 'settings'], async function(result) {
    const existingUrls = result.saves || [];
    const entry = existingUrls.find(ent => ent.url === location.href)
    if (entry) {
        entry.positions.forEach((pos) => {
            const newElement = document.createElement("div");
            newElement.className = "saved-anchor-marker";
            newElement.setAttribute("id", `anchor-${pos[0]}-${pos[1]}`);
            newElement.textContent = pos[2];
            newElement.style.cssText = `
                position: absolute; left: 0; top: ${pos[1]}px; z-index: 10000;
                background: #ef4444; color: #fff; font-weight: 600;
                padding: 0.5rem 1rem; border-radius: 9999px;
                box-shadow: 0 4px 6px -1px rgba(0,0,0,.1), 0 2px 4px -1px rgba(0,0,0,.06);
                letter-spacing: .025em; user-select: none; font-family: sans-serif;
            `;

            document.body.appendChild(newElement);
        });
    }

    window.navigation.addEventListener("navigate", () =>{
        console.log('location changed!');
        const anchors = document.querySelectorAll(".saved-anchor-marker");
        const urlMatchExists = existingUrls.some(ent => ent.url === location.href);

        anchors.forEach(anchor => {
            if (urlMatchExists){
                anchor.style.visibility = "hidden";
            } else {
                anchor.style.visibility = "visible";
            }
        });
    });
});
