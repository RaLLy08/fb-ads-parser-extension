const CHAT_ID ='';
const BOT_TOKEN = '';

const sleep = async (ms) => await new Promise((res, rej) => setTimeout(res, ms));

const getDiff = (parsedAds, stateAds=[]) => {
  const newAds = [];

  parsedAds.forEach(pAd => {

    const isExist = stateAds.some(tAd => {
      if (
          tAd.images?.length === tAd.images?.length && 
          tAd.description === pAd.description && 
          tAd.title === pAd.title
        ) {

          return true;
        }
    })

    if (!isExist) newAds.push(pAd);
  })

  return newAds;

}

const getTelegramMessageLink = (ads, chatId, botToken) => {
  let message = '';

  ads.forEach(pAd => {
    message += `${pAd.title}\n\n`;
    message += `${pAd.images.join('\n')}\n\n`;
    message += `${pAd.description}\n\n`;
  })

  message = encodeURI(message)

  return `https://api.telegram.org/bot${botToken}/sendMessage?chat_id=${chatId}&text=${message}`
}

async function injectParseAdsScript() {
  window.scrollTo(0, document.body.scrollHeight)

  await new Promise((res, rej) => setTimeout(res, 300))

  const parseImages = (container) => {
    const images = container.querySelectorAll('img');

    const srcs = [];

    images.forEach(img => {
      const { height, width } = img;

      if (height * width < 100) return

      const src = img.getAttribute('src');

      result.push(src);
    });

    return srcs;
  }

  const parseContainer = (container) => {
    let images = [];
    let description = '';
    let title = '';

    if (container) {
      images = parseImages(container);
      description = container.querySelector(`div[data-ad-preview]`).textContent;
      title = container.querySelector('strong').textContent;
    }

    return {
      images,
      description,
      title,
    }
  }

  const isAdContainer = (possibleContainer) => {
    if (possibleContainer.childElementCount < 3) return false;

    return true
  }

  const data = [];

  const adsContainerHooks = document.querySelectorAll(`a[aria-label="Реклама"]`) || []

  adsContainerHooks.forEach(adHook => {
    const container = adHook.closest('div[class=""]')

    if (!container) return;
    if (!isAdContainer(container)) return;

    data.push(parseContainer(container));
  })
  
  return {
    data,
  };
};

const parseAds = async (tabId) => {
  try {
    return await chrome.scripting.executeScript({
      target: { tabId },
      func: injectParseAdsScript,
    });
  } catch (e) {
    console.error(e);
  }
}
const initialTabState = {
  tabId: null,
  activateButton: false,
  actionType: '',
  ads: []
}

chrome.storage.onChanged.addListener(
  async (changes, namespace) => {

    for (const [key, change] of Object.entries(changes)) {

      const { oldValue, newValue } = change;
      const { tabId, actionType } = newValue;

      if (!tabId || actionType !== 'ACTIVATE_BUTTON') return;
  
      if (newValue.activateButton) {

        const loop = async () => {
          
          const tabState = (await chrome.storage.sync.get(String(tabId)))[tabId];

          if (!tabState.activateButton) return;

          const [ result ] = await parseAds(Number(tabId));
        
          const newAds = getDiff(result.data, tabState.ads)

          if (newAds.length) {
            fetch(getTelegramMessageLink(newAds, CHAT_ID, BOT_TOKEN))

            const newState = {
              ...tabState,
              ads: [...tabState.ads, ...newAds]
            }

            await chrome.storage.sync.set({ [tabId]: newState });
          }

          await sleep(1000)

          loop();
        }

        loop();


        const newState = {
          ...newValue,
          actionType: 'INTERVAL_SET',
        }

        await chrome.storage.sync.set({ [tabId]: newState });
      } else {
        // clear state after turning off
        const tabState = (await chrome.storage.sync.get(String(tabId)))[tabId];

        const newState = {
          ...tabState,
          ads: []
        }

        await chrome.storage.sync.set({ [tabId]: newState });
      }

    }
});