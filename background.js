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

  const formatImages = (images) => {
    return (images || []).map((img, i) => `[Image ${i + 1}](${img})`).join('\n')
  }

  const formatSiteLinks = (links) => {
    return (links || []).map((link, i) => {
      const { href, text } = link;

      if (text === '') return `[Other Link: ${i + 1}](${href})`

      return `[${text}](${href})`
    }).join('\n')
  }

  ads.forEach(pAd => {
    message += `${pAd.title}\n\n`;
    message += `${formatImages(pAd.images)}\n\n`;
    message += `${pAd.description}\n\n`;
    message += `${formatSiteLinks(pAd.links)}\n\n`;
  })

  message = encodeURIComponent(message)

  return `https://api.telegram.org/bot${botToken}/sendMessage?chat_id=${chatId}&text=${message}&parse_mode=Markdown`
}

async function injectParseAdsScript() {
  window.scrollTo(0, document.body.scrollHeight);

  const waitTextContentChange = async (el) => {
    const prevTextContent = el.textContent;
    const maxAttempt = 10;
    const repeatCheckMs = 100;
    let attemptCount = 0;
    
    return new Promise((res, rej) => {
        setTimeout(() => check(), 0)
        
        const interval = setInterval(
            () => {
                check()

                attemptCount += 1;
                
            },
            repeatCheckMs
        );

        const check = () => {
            if (el.textContent !== prevTextContent) {
                clearInterval(interval);
                res(el.textContent);
            }

            if (attemptCount > maxAttempt) {
                clearInterval(interval);
                rej('waitTextContentChange: timeout')
            }
        }

        
    })
  };

  await new Promise((res, rej) => setTimeout(res, 700 + 100*Math.random()));
  
  const lang = document.querySelector('html').lang || 'en';

  const adKeyWords = {
    ru:'Реклама',
    uk:'Реклама',
    en:'Sponsored',
  };

  const seeMoreWords = {
    ru:'Eщё',
    uk:'Показати більше',
    en:'See more',
  };

  const seeMoreWord = seeMoreWords[lang];
  const adHookKeyWord = adKeyWords[lang];


  const parseImageSrcs = (container) => {
    const images = container.querySelectorAll('img');

    const srcs = [];

    images.forEach(img => {
      const { height, width } = img;

      if (height * width < 1000) return

      const src = img.getAttribute('src');

      srcs.push(src);
    });

    return srcs;
  };

  const parseDescription = (container) =>  container.querySelector(`div[data-ad-preview]`);

  const parseTitle = (container) => container.querySelector('strong');

  const parseThirdPartyLinks = (container) => {
    const links = container.querySelectorAll('a');

    return Array.from(links).map(link => {
      const href = link.getAttribute('href');
      const text = link.textContent.trim();

      return { href, text };
    }).filter(({ href })=> {
      if (!href || !href.trim()) return false
      
      const isFbLink = new RegExp('ads/about').test(href);
      
      return !isFbLink
    }).sort((a, b) => b.text.length - a.text.length)

  };

  const parseContainerData = (container) => {
    return {
      images: parseImageSrcs(container),
      description: parseDescription(container).textContent,
      title: parseTitle(container).textContent,
      links: parseThirdPartyLinks(container),
    }
  };

  const parseSeeMoreButton = (container) => {
    return Array.from(container.querySelectorAll('div[role="button"]')).find(el => el.textContent.includes(seeMoreWord))
  }

  const isAdContainer = (possibleContainer) => {
    if (!possibleContainer.contains(possibleContainer.querySelector(`div[data-ad-preview]`))) return false;

    return true
  };


  const adsContainerHooks = document.querySelectorAll(`a[aria-label="${adHookKeyWord}"]`) || []
  const adContainers = [];

  adsContainerHooks.forEach(adHook => {
    const container = adHook.closest('div[class=""]')

    if (!container) return;
    if (!isAdContainer(container)) return;

    adContainers.push(container);
  });

  for (const container of adContainers) {
    const seeMoreButton = parseSeeMoreButton(container);

    if (!seeMoreButton) continue;

    const descriptionBlock = parseDescription(container);

    seeMoreButton.click();

    await waitTextContentChange(descriptionBlock);
  };


  const data = [];

  adContainers.forEach(adContainer => {
    const parsed = parseContainerData(adContainer);

    data.push(parsed);
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
          let tabState = (await chrome.storage.local.get(String(tabId)))[tabId];

          if (!tabState.tabId) {
            tabState = {
              ...initialTabState,
              tabId,
            }
          }

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