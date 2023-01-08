const CHAT_ID ='';
const BOT_TOKEN = '';
// const CHAT_ID ='';
// const BOT_TOKEN = '';

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

  const formatImages = (images) => {
    return (images || []).map((img, i) => `[Image ${i + 1}](${img})`).join('\n')
  }

  ads.forEach(pAd => {
    message += `${pAd.title}\n\n`;
    message += `${formatImages(pAd.images)}\n\n`;
    message += `${pAd.description}\n\n`;
  })

  message = encodeURIComponent(message)

  return `https://api.telegram.org/bot${botToken}/sendMessage?chat_id=${chatId}&text=${message}&parse_mode=Markdown`
}

async function injectParseAdsScript() {
  window.scrollTo(0, document.body.scrollHeight)

  await new Promise((res, rej) => setTimeout(res, 700 + 100*Math.random()))
  
  const parseImages = (container) => {
    const images = container.querySelectorAll('img');

    const srcs = [];

    images.forEach(img => {
      const { height, width } = img;

      if (height * width < 1000) return

      const src = img.getAttribute('src');

      srcs.push(src);
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
    if (!possibleContainer.contains(possibleContainer.querySelector(`div[data-ad-preview]`))) return false;

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
  ads: []
}

chrome.storage.onChanged.addListener(
  async (changes, namespace) => {
    if (namespace !== 'sync') return;

    for (const [key, change] of Object.entries(changes)) {

      const { oldValue, newValue } = change;
      const { tabId } = newValue;

      if (newValue.activateButton) {

        const loop = async () => {
          const tabStateView = (await chrome.storage.sync.get(String(tabId)))[tabId];
          const tabState = (await chrome.storage.local.get(String(tabId)))[tabId];

          if (!tabStateView.activateButton) return;

          const [ tabData ] = await parseAds(Number(tabId));

          const newAds = getDiff(tabData.result.data, tabState.ads)

          if (newAds.length) {
            try {
              fetch(getTelegramMessageLink(newAds, CHAT_ID, BOT_TOKEN))
            } catch (e) {
              console.error(e);
            }

            const newState = {
              ...tabState,
              ads: [...tabState.ads, ...newAds]
            }

            await chrome.storage.local.set({ [tabId]: newState });
          }
        
          await sleep(200 + 100*Math.random())

          loop();
        }

        loop();

      } else {
        // clear state after turning off
        const tabState = (await chrome.storage.local.get(String(tabId)))[tabId];

        const newState = {
          ...tabState,
          ads: []
        }

        await chrome.storage.local.set({ [tabId]: newState });
      }

    }
});