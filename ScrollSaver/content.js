
if (/\.pdf($|\?)/i.test(location.href)) return;

chrome.storage.local.get(['saves'], async function(result) {
    const existingUrls = result.saves || [];
    const entry = existingUrls.find(ent => ent.url === location.href)
    if (entry) {
        entry.positions.forEach((pos) => {
            const index = existingUrls.indexOf(location.href);
            const newElement = document.createElement("div");
            newElement.classList.add("saved-anchor-marker");
            newElement.setAttribute("id", `anchor-${pos[0]}-${pos[1]}`);
            newElement.textContent = pos[2];
            newElement.style.position = "absolute";
            newElement.style.left = "0px";
            newElement.style.top = pos[1] + "px";
            newElement.style.backgroundColor = "red";
            newElement.style.padding = "10px";
            newElement.style.zIndex = "10000";

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

