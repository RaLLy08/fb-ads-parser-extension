const CHAT_ID ='';
const BOT_TOKEN = '';

class VideoLinkParser {
  static fetchFbVideoPage = async (url) => {
    const res =  await fetch(url, {
        method: 'GET',
        headers: {
            'sec-fetch-user': '?1',
            'sec-fetch-user':'?1',
            'sec-ch-ua-mobile':'?0',
            'sec-fetch-site': 'none',
            'sec-fetch-dest': 'document',
            'sec-fetch-mode':'navigate',
            'cache-control':'max-age=0',
            'authority': 'www.facebook.com',
            'upgrade-insecure-requests': '1',
            'accept-language':'en-GB,en;q=0.9,tr-TR;q=0.8,tr;q=0.7,en-US;q=0.6',
            'sec-ch-ua':'"Google Chrome";v="89", "Chromium";v="89", ";Not A Brand";v="99"',
            'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/89.0.4389.114 Safari/537.36',
            'accept' :'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9',
        }
    });
  
    return res.text()
  }

  static cleanStr(url) {
    return JSON.parse(`{"text": "${url}"}`).text;
  }

  static getHdLink(outerHtml) {
    const url = (/playable_url_quality_hd":"([^"]+)"/g.exec(outerHtml) || [])[1]

    if (!url) return;

    return this.cleanStr(url);
  }

  static getSdLink(outerHtml) {
    const url = (/playable_url":"([^"]+)"/g.exec(outerHtml) || [])[1]

    if (!url) return;

    return this.cleanStr(url);
  }

  async getVideoLink(url) {
    const html = await VideoLinkParser.fetchFbVideoPage(url);

    const hdLink = VideoLinkParser.getHdLink(html);

    if (hdLink) return hdLink;

    return VideoLinkParser.getSdLink(html);
  }  
}


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
  // window.scrollTo(0, document.body.scrollHeight);
  const smoothScrollToBottom = () => {
    const h =  document.body.scrollHeight;
    let k = 0;

    return new Promise((res, rej) => {
        const intervalId = setInterval(() => {
        if (k > 1000) res();    
            
        if (h >= document.body.scrollHeight) {
            k++
            window.scrollBy(0, 100)
        } else {
            clearInterval(intervalId)

            res();
        }
      }, 100)
    })
  }
  await smoothScrollToBottom();

  const waitForChange = async (initialState, getUpdatedState, maxAttempt=20, repeatCheckMs=100) => {
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
            const updated = getUpdatedState();

            if (updated !== initialState) {
                clearInterval(interval);
                res(updated);
            }

            if (attemptCount > maxAttempt) {
                clearInterval(interval);
                rej('waitTextContentChange: timeout')
            }
        }    
    })
  };

  await new Promise((res, rej) => setTimeout(res, 200 + 100*Math.random()));
  
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

  const copyLinkWords = {
    en: 'Copy link',
    uk: 'Копіювати посилання',
  }

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

  const parsePopupElement = () => document.querySelector('div[role="menu"]');
  const parsePopupCopyUrlLink = (popup) => Array.from(popup.querySelectorAll('span')).find(el => el.textContent === copyLinkWords[lang]);
  const waitForAdPopupTextContent = async () => waitForChange(undefined, () => parsePopupElement()?.textContent, 20, 300);

  const waitForChangeTextContent = async (el) => await waitForChange(el.textContent, () => el.textContent);


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

  const parsePopupButton = (container) => container.querySelector('div[aria-haspopup]');
  

  const isAdContainer = (possibleContainer) => {
    if (!possibleContainer.contains(possibleContainer.querySelector(`div[data-ad-preview]`))) return false;

    return true
  };

  const getAdHooksElements = () => {

    if (lang === 'en') {
      return Array.from(document.querySelectorAll('use[*|href]:not([href])')).filter(el => {
        const { width, height } = el.getBBox()
    
          if (width.toFixed(1) === '56.9' && height === 16) return true;
      })
    }

    return document.querySelectorAll(`a[aria-label="${adHookKeyWord}"]`) || []
  }


  const adsContainerHooks = getAdHooksElements()
  const adContainers = [];

  adsContainerHooks.forEach(adHook => {
    const container = adHook.closest('div[class=""]')

    if (!container) return;
    if (!isAdContainer(container)) return;

    adContainers.push(container);
  });

  // clicking see more
  for (const adContainer of adContainers) {
    const seeMoreButton = parseSeeMoreButton(adContainer);

    if (!seeMoreButton) continue;

    const descriptionBlock = parseDescription(adContainer);

    seeMoreButton.click();

    await waitForChangeTextContent(descriptionBlock);
  };

  // getting video links
  // for (const adContainer of adContainers) {
  //   const video = adContainer.querySelector('video');

  //   if (!video) continue;

  //   const popupBtn = parsePopupButton(adContainer);

  //   // popupBtn.click();

  //   try {
  //     await waitForAdPopupTextContent(adContainer);
  //   } catch {
  //     // removing to prevent cycling opening
  //     // adContainer.remove();
  //   }

  //   const popupEl = parsePopupElement();
  //   const popupCopyUrlLinkButton = parsePopupCopyUrlLink(popupEl);
  //   console.log(popupCopyUrlLinkButton)

  //   await new Promise((res, rej) => setTimeout(res, 6000));


  //   console.log(popupCopyUrlLinkButton.click())

  //   // popupCopyUrlLink.click();

  //   // popupEl?.remove();

  //   // await new Promise((res, rej) => setTimeout(res, 100));

  //   // adContainer.remove()
  // }

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

          if (!tabState) {
            tabState = {
              ...initialTabState,
              tabId,
            }
          }

          if (!tabStateView?.activateButton) return;

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