const initialTabState = {
    tabId: null,
    activateButton: false,
    actionType: '',
    adds: [],
}

const init = async () => {
    const activateButton = document.getElementById('activate');
    const activateButtonActionType = 'ACTIVATE_BUTTON';

    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const tabId = String(tabs[0].id);
    
    if (!tabId) console.error('Tab id not found')

    const tabState = (await chrome.storage.local.get(tabId))[tabId] || {};

    activateButton.checked = tabState.activateButton;
    
    activateButton.addEventListener('click', async (e) => {
        const tabState = (await chrome.storage.local.get(tabId))[tabId];
        const isActive = e.target.checked;

        const newState = {
            ...initialTabState,
            ...tabState,
            tabId: tabId,
            actionType: activateButtonActionType,
            activateButton: isActive,
        }
        await chrome.storage.local.set({ [tabId]: newState });
    });
}

init();