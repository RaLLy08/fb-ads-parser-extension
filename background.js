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

const addParseVideoFromLinks = async (pasedDatas) => {
  const videoLinkParser = new VideoLinkParser();

  for (const data of pasedDatas) {

    if (data.pageVideoLink) {
      let videoLink = 'error video link';

      try {
        videoLink = await videoLinkParser.getVideoLink(data.pageVideoLink);
      } catch (e) {
        console.error('addParseVideoFromLinks error', e)
      }

      data.videoLink = videoLink;
    }    
    
  }
  
}



const sleep = async (ms) => await new Promise((res, rej) => setTimeout(res, ms));

const getTelegramMessageLink = (ad, chatId, botToken) => {
  const htmlLink = (text, link) => {
    if (!link) return '';

    return `<a href="${link}">${text}</a>`
  }

  const formatImages = (images) => {
    return (images || []).map((img, i) => htmlLink(`Image ${i + 1}`, img)).join('\n')
  }

  const formatSiteLinks = (links) => {
    return (links || []).map((link, i) => {
      const { href, text } = link;

      if (text === '') return htmlLink(`Other Link: ${i + 1}`, href)

      return htmlLink(text, href)
    }).join('\n')
  }

  const formatVideoLink = (videoLink) => {
    return htmlLink('Video Link', videoLink)
  }

  const messageBody = [
    ad.title,
    formatVideoLink(ad.videoLink),
    formatImages(ad.images),
    ad.description,
    formatSiteLinks(ad.links),
  ].filter(Boolean).join('\n\n')

  let message = encodeURIComponent(messageBody)

  return `https://api.telegram.org/bot${botToken}/sendMessage?chat_id=${chatId}&text=${message}&parse_mode=HTML`
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
                rej(`waitChange: timeout ${initialState}`)
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
    ru:'Ещё',
    uk:'Показати більше',
    en:'See more',
  };

  const codeFrameButtonWords = {
    en: 'Embed',
    uk: 'Вбудувати',
    ru: 'Вставить на сайт',
  }

  const dialogCloseButtonWords = {
    uk: 'Закрити',
    ru: 'Закрыть',
    en: 'Close',
  }

  const seeMoreWord = seeMoreWords[lang];
  const adHookKeyWord = adKeyWords[lang];
  const codeFrameButtonWord = codeFrameButtonWords[lang];
  const dialogCloseButtonWord = dialogCloseButtonWords[lang];


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
  const parsePopupCodeFrameButton = (popup) => Array.from(popup.querySelectorAll('span')).find(el => el.textContent === codeFrameButtonWord);
  const waitForAdPopupTextContent = async () => waitForChange(undefined, () => parsePopupElement()?.textContent, 20, 300);

  const parseDialog = () => document.querySelector('div[role="dialog"]');
  // const parseDialogCloseButton = (dialog) => Array.from(dialog.querySelectorAll('span')).find(el => el.textContent === popupCloseButtonWord);
  const parseDialogCloseButton = (dialog) => dialog.querySelector(`div[aria-label="${dialogCloseButtonWord}"]`);
  const waitForChangeTextContent = async (el) => await waitForChange(el.textContent, () => el.textContent);


  const parseDescription = (container) => container.querySelector(`div[data-ad-preview]`);
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
      description: parseDescription(container)?.textContent,
      title: parseTitle(container)?.textContent,
      links: parseThirdPartyLinks(container),
    }
  };

  const parseSeeMoreButton = (container) => {
    const buttons = Array.from(container.querySelectorAll('div[role="button"]'))

    return buttons.find(el => el.textContent.includes(seeMoreWord))
  }

  const parsePopupButton = (container) => container.querySelector('div[aria-haspopup]');
  

  const isAdContainer = (possibleContainer) => {
    if (possibleContainer.contains(possibleContainer.querySelector(`div[data-ad-preview]`))) return true;
    if (possibleContainer.contains(possibleContainer.querySelector(`div[aria-haspopup]`))) return true;

    return false
  };

  const getAdHooksElements = () => {
    let hookEls = []

    if (lang === 'en') {
      hookEls = Array.from(document.querySelectorAll(`use[*|href]:not([href]):not(use[data-skipAddHook])`)).filter(el => {
        const { width, height } = el.getBBox()
    
          if (width.toFixed(1) === '56.9' && height === 16) return true;
      })
    } else {
      hookEls = document.querySelectorAll(`a[aria-label="${adHookKeyWord}"]:not([data-skipAddHook])`) || []
    }

    hookEls.forEach(el => el.setAttribute('data-skipAddHook', true));

    return hookEls;
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

  const parseInputTextIframeContent = (dialog) => /(?<=iframe).*?(?=iframe)/g.exec(dialog.outerHTML)[0];
  const parseVideoCodeFromeIframe = (iframeText) => iframeText.match(/videos.*%/g)[0]?.match(/(?<=2F).*?(?=%)/g)[0];

  const pageVideoLinks = [];

  for (let addContainerIndex = 0; addContainerIndex < adContainers.length; addContainerIndex++) {
    const adContainer = adContainers[addContainerIndex];

    const video = adContainer.querySelectorAll('video');
    // const isHistory = adContainer.querySelector('ul');

    if (video.length !== 1) continue;
    // if (isHistory) continue;
    if (adContainer.dataset._skipVideoLinkParsing) continue;

    // adContainer.scrollIntoView();
    // await new Promise((res, rej) => setTimeout(res, 1000));

    const popupBtn = parsePopupButton(adContainer);

    popupBtn.click();

    try {
      await waitForAdPopupTextContent(adContainer);
    } catch {
      // prevent cycling opening
      adContainer.dataset._skipVideoLinkParsing = true;
      continue;
    }

    const popupEl = parsePopupElement();
    const popupCodeFrameButton = parsePopupCodeFrameButton(popupEl);

    if (!popupCodeFrameButton) {
      adContainer.dataset._skipVideoLinkParsing = true;

      continue
    };
    
    // open dialog
    popupCodeFrameButton.click();

    try {
      // wait for open dialog
      await waitForChange(undefined, () => {
        if (parseDialog()?.textContent?.length > 0) return true;
      }, 20, 300);
    } catch {
      console.error('wait for change parseDialog', addContainerIndex)
      adContainer.dataset._skipVideoLinkParsing = true;
      continue;
    }

    const dialog = parseDialog();
    const inputTextIframeContent = parseInputTextIframeContent(dialog);

    const videoCode = parseVideoCodeFromeIframe(inputTextIframeContent);

    const watchLink = `https://www.facebook.com/watch/?v=${videoCode}`;

    pageVideoLinks.push([watchLink, addContainerIndex]);

    const closeBtn = parseDialogCloseButton(dialog);

    closeBtn.click();

    try {
      // wait for close dialog
      await waitForChange(dialog, () => parseDialog(), 20, 300);
    } catch {

    }
  
    adContainer.dataset._skipVideoLinkParsing = true;
  }
  // console.log(pageVideoLinks, adContainers.length)

  const data = [];

  adContainers.forEach((adContainer, i) => {
    const parsed = parseContainerData(adContainer);

    const pageVideoLink = pageVideoLinks.find(([_, index]) => index === i);
    if (pageVideoLink) parsed.pageVideoLink = pageVideoLink[0];

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


chrome.storage.onChanged.addListener(
  async (changes, namespace) => {
    if (namespace !== 'sync') return;

    for (const [key, change] of Object.entries(changes)) {

      const { oldValue, newValue } = change;
      const { tabId } = newValue;

      if (newValue.activateButton) {

        const loop = async () => {
          const tabStateView = (await chrome.storage.sync.get(String(tabId)))[tabId];


          if (!tabStateView?.activateButton) return;

          const [ tabData ] = await parseAds(Number(tabId));
          
          const newAds = tabData.result.data;
          console.log(newAds, 'before');

          if (newAds.length) {
      
            await addParseVideoFromLinks(newAds);

            for (const ad of newAds) {
              try {
                await fetch(getTelegramMessageLink(ad, CHAT_ID, BOT_TOKEN))
              } catch (e) {
                console.error(e);
              }
            }
          }
        
          await sleep(200 + 100*Math.random())

          loop();
        }

        loop();

      }

    }
});