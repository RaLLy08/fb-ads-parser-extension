const initialTabState = {
    tabId: null,
    activateButton: false,
}

const init = async () => {
    const activateButton = document.getElementById('activate');

    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const tabId = String(tabs[0].id);
    
    if (!tabId) console.error('Tab id not found')

    const tabState = (await chrome.storage.sync.get(tabId))[tabId] || {};

    activateButton.checked = tabState.activateButton;
    
    activateButton.addEventListener('click', async (e) => {
        const tabState = (await chrome.storage.sync.get(tabId))[tabId];
        const isActive = e.target.checked;

        const newState = {
            ...initialTabState,
            ...tabState,
            tabId: tabId,
            activateButton: isActive,
        }
        await chrome.storage.sync.set({ [tabId]: newState });
    });
}

init();