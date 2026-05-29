function DisplayUrlsFull(entries) {
    document.getElementById("list").innerHTML = "";
    if(entries.length === 0){
        document.getElementById("list").innerHTML = '<h1 class="text-gray-400 italic text-center text-base">No bookmarks saved</h1>';
        return;
    }
    entries.forEach((entry) => {
        const urlContainer = document.createElement("div");
        
        urlContainer.className = "bg-gray-50 border border-gray-200 rounded-lg p-3 mt-3";

        const urlTitle = document.createElement("p");
        urlTitle.className = "font-semibold text-xs text-gray-700 truncate mb-2";
        urlTitle.textContent = entry.url;
        urlContainer.appendChild(urlTitle);

        entry.positions.forEach((pos, index) => {
            const itemDiv = document.createElement("div");
            itemDiv.className = "flex items-center gap-2 mt-1 ml-1";

            const posText = document.createElement("span");
            posText.className = "text-xs text-gray-500 flex-1";
            posText.textContent = pos[2] || `Position ${index + 1}: (X: ${pos[0]}, Y: ${pos[1]})`;
            posText.addEventListener("dblclick", function () {
                handleRenameDoubleClick(posText, entry.url, pos, index, DisplayUrlsFull);
            });

            const goButton = document.createElement("button");
            goButton.textContent = "Go";
            goButton.className = "bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium px-2 py-1 rounded";
            goButton.addEventListener("click", function () {
                handleButtonClick(entry.url, pos);
            });

            const deleteButton = document.createElement("button");
            deleteButton.textContent = "Delete";
            deleteButton.className = "bg-red-500 hover:bg-red-600 text-white text-xs font-medium px-2 py-1 rounded";
            deleteButton.addEventListener("click", function () {
                handleDeleteClickFromFull(entry.url, pos);
            });

            itemDiv.appendChild(posText);
            itemDiv.appendChild(goButton);
            itemDiv.appendChild(deleteButton);
            urlContainer.appendChild(itemDiv);
        });

        document.getElementById("list").appendChild(urlContainer);
    });
}

function handleDeleteClickFromFull(savedUrl, savedPosition) {
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
            DisplayUrlsFull(entries);
        });
    });
}

chrome.storage.local.get(['saves'], async (result) => {
    const entries = result.saves || [];
    DisplayUrlsFull(entries);
});