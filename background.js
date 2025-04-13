import { FacebookScraper } from './scraper.js';

// --- Scraper Singleton ---
let scraper = null;

async function getScraperInstance() {
  if (!scraper) {
    console.log("Initializing FacebookScraper...");
    scraper = new FacebookScraper();
    await scraper.init();
    console.log("FacebookScraper initialized.");
  }
  return scraper;
}

// --- Action Click Logic: Toggle In-Page UI ---
chrome.action.onClicked.addListener((tab) => {
    if (tab.id) {
        chrome.tabs.sendMessage(tab.id, { action: "toggleUiModal" }, (response) => {
            if (chrome.runtime.lastError) {
                 console.error(`Could not send toggle message to tab ${tab.id}: ${chrome.runtime.lastError.message}. Maybe script not injected?`);
                 // Attempt injection if sending fails
                 chrome.scripting.executeScript({
                     target: { tabId: tab.id },
                     files: ['content.js']
                 }).then(() => {
                     console.log("Injected content script after initial message failure.");
                     chrome.tabs.sendMessage(tab.id, { action: "toggleUiModal" }); // Retry
                 }).catch(err => {
                     console.error(`Failed to inject content script on tab ${tab.id}: ${err}`);
                 });
            }
        });
    } else {
        console.error("Clicked tab has no ID.");
    }
});

// --- Function to Update Icon Based on State (Per Tab) ---
function updateIconForTab(tabId, isActive) {
    if (!tabId) return;
    const iconPathBase = isActive ? "assets/icons/favicon-active" : "assets/icons/favicon";
    const iconPaths = {
        "16": `${iconPathBase}-16.png`,
        "32": `${iconPathBase}-32.png`,
        "48": `${iconPathBase}-48.png`,
        "128": `${iconPathBase}-128.png`
    };
    chrome.action.setIcon({
        path: iconPaths,
        tabId: tabId
    }).catch(error => {
        // Ignore common errors when tab closes quickly
        if (!error.message.includes("No tab with id") && !error.message.includes("Cannot access contents of url")) {
            console.warn(`Error setting icon for tab ${tabId}:`, error.message);
        }
    });
}

// --- Request UI State from Content Script ---
async function requestAndUpdateState(tabId) {
    if (!tabId) return;
    try {
        console.log(`[background] Requesting UI state from tab ${tabId}`);
        const response = await chrome.tabs.sendMessage(tabId, { action: "getUiState" });
        if (response && typeof response.isActive === 'boolean') {
            console.log(`[background] Received UI state from tab ${tabId}: ${response.isActive}`);
            updateIconForTab(tabId, response.isActive);
        } else {
             console.warn(`[background] Received invalid response for getUiState from tab ${tabId}:`, response);
             updateIconForTab(tabId, false);
        }
    } catch (error) {
         console.warn(`[background] Failed to send/receive getUiState for tab ${tabId}: ${error.message}. Assuming inactive.`);
         updateIconForTab(tabId, false);
    }
}

// --- Tab Event Listeners ---
chrome.tabs.onActivated.addListener(activeInfo => {
    requestAndUpdateState(activeInfo.tabId);
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.url && tab.url.startsWith('http')) {
        requestAndUpdateState(tabId);
    }
});

// --- Content Script Interaction & Scraping Logic ---
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Handle Analysis Request (from sidepanel)
  if (message.action === "analyzePage") {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const activeTab = tabs[0];
      if (activeTab && activeTab.id) {
        // Ensure content script is injected first
        chrome.scripting.executeScript({
          target: { tabId: activeTab.id },
          files: ['content.js']
        })
        .then(() => chrome.tabs.sendMessage(activeTab.id, { action: "extractLinks" }))
        .then(response => {
          if (chrome.runtime.lastError) throw new Error(`ExtractLinks Error: ${chrome.runtime.lastError.message}`);
          if (!response || !response.data) throw new Error("No data received from content script");
          console.log('Received data from content script:', response.data);
          return scrapeAndSendData(response.data);
        })
        .then(scrapeResults => {
           sendResponse({ results: scrapeResults });
        })
        .catch(error => {
          console.error('Error during analyzePage flow:', error);
          sendResponse({ error: error.message || "Analysis failed." });
        });
      } else {
        sendResponse({ error: "Could not get active tab" });
      }
    });
    return true; // Async response
  }

  // Handle Ad Details Request (from sidepanel)
  else if (message.action === "getAdDetails") {
      const { adId, pageId } = message.data;
      if (!adId || !pageId) {
          sendResponse({ error: "Missing adId or pageId" });
          return false;
      }
      (async () => {
          try {
              const scraper = await getScraperInstance();
              const details = await scraper.getAdDetails(adId, pageId);
              sendResponse({ details: details || null }); // Send details or null
          } catch (error) {
              console.error("Error fetching ad details in background:", error);
              sendResponse({ error: `Failed to fetch ad details: ${error.message}` });
          }
      })();
      return true; // Async response
  }

  // --- ADD BACK: Handle State Report from Content Script ---
  else if (message.action === "reportUiState") {
      const tabId = sender.tab?.id;
      if (tabId && typeof message.isActive === 'boolean') {
           console.log(`[background] Received reportUiState from tab ${tabId}: ${message.isActive}`); // LOGGING
           updateIconForTab(tabId, message.isActive);
      } else {
          console.warn(`[background] Received invalid reportUiState:`, message, sender); // LOGGING
      }
      // No response needed back to content script
      return false;
  }

  // --- NEW: Handle Request for More Ads (Pagination) ---
  else if (message.action === "getMoreAds") {
     const { pageId, cursor } = message.data;
     if (!pageId || !cursor) {
         sendResponse({ error: "Missing pageId or cursor for pagination" });
         return false;
     }
     (async () => {
         try {
             const scraper = await getScraperInstance();
             const results = await scraper.getPageAds(pageId, cursor); // Fetch next page
             sendResponse({ results: results }); // Send back { ads: [...], page_info: {...} }
         } catch (error) {
             console.error(`Error fetching more ads (page ${pageId}, cursor ${cursor}):`, error);
             sendResponse({ error: `Failed to fetch more ads: ${error.message}` });
         }
     })();
     return true; // Async response
  }

  // No need to listen for "reportUiState" anymore, handled in requestAndUpdateState

});

// --- Combined Scraping Logic (Return results object) ---
async function scrapeAndSendData(pageData) {
    try {
        const currentScraper = await getScraperInstance();
        const targetPage = await findFacebookPage(currentScraper, pageData);
        const searchTerm = pageData.facebookLink
            ? (pageData.facebookLink.match(/facebook\.com\/([\w.]+)/)?.[1] || pageData.facebookLink)
            : (pageData.instagramLink ? (pageData.instagramLink.match(/instagram\.com\/([\w.]+)/)?.[1] || pageData.instagramLink) : 'current page');

        if (targetPage) {
            const adsResult = await findFacebookAds(currentScraper, targetPage.id);
            console.log(`Found ${adsResult.ads.length} ads for page ${targetPage.name}.`);
            return {
                searchedTerm: targetPage.name || searchTerm,
                foundPage: targetPage,
                ads: adsResult.ads,
                page_info: adsResult.page_info
            };
        } else {
            console.log(`No Facebook page found for term: ${searchTerm}`);
            return {
                searchedTerm: searchTerm,
                foundPage: null,
                ads: [],
                page_info: { end_cursor: null, has_next_page: false }
            };
        }
    } catch (error) {
        console.error("Scraping error in scrapeAndSendData:", error);
        throw new Error(`Scraping failed: ${error.message || error}`);
    }
}

// --- Facebook Scraping Functions (Keep as they were) ---
async function findFacebookPage(scraperInstance, pageData) {
    console.log("Starting Facebook page finding process with data:", pageData);
    const { facebookLink, instagramLink } = pageData;
    let pageNameToSearch = null;
    let searchSource = '';
    if (facebookLink) {
        const fbMatch = facebookLink.match(/facebook\.com\/(?:pages\/[^\/]+\/)?([\w\.]+)(?:[/?]|$)/);
        if (fbMatch && fbMatch[1] && fbMatch[1].toLowerCase() !== 'profile.php') {
            pageNameToSearch = fbMatch[1];
            searchSource = 'Facebook Link';
        }
    }
    if (!pageNameToSearch && instagramLink) {
        const igMatch = instagramLink.match(/instagram\.com\/([\w\.]+)(?:[/?]|$)/);
        if (igMatch && igMatch[1]) {
            pageNameToSearch = igMatch[1];
            searchSource = 'Instagram Link';
        }
    }
    if (!pageNameToSearch) return null;
    console.log(`Searching Facebook Pages for: ${pageNameToSearch} (Source: ${searchSource})`);
    try {
        const pages = await scraperInstance.searchPages(pageNameToSearch);
        if (!pages || pages.length === 0) return null;
        let targetPage = null;
        if (searchSource === 'Facebook Link') targetPage = pages.find(p => p.page_alias === pageNameToSearch);
        if (!targetPage && searchSource === 'Instagram Link') targetPage = pages.find(p => p.ig_username === pageNameToSearch);
        if (!targetPage && pages.length > 0) targetPage = pages[0]; // Fallback
        console.log(`Selected page: ${targetPage?.name}`);
        return targetPage;
    } catch (error) {
        console.error(`Error during page search for '${pageNameToSearch}':`, error);
        throw error;
    }
}

async function findFacebookAds(scraperInstance, pageIdToSearch) {
    if (!pageIdToSearch) return [];
    console.log(`Fetching ads for Page ID: ${pageIdToSearch}`);
    try {
        const adsResult = await scraperInstance.getPageAds(pageIdToSearch);
        console.log(`Found ${adsResult.ads.length} ads for page ID ${pageIdToSearch}. Has next: ${adsResult.page_info.has_next_page}`);
        return adsResult;
    } catch (error) {
        console.error(`Error fetching ads for page ID ${pageIdToSearch}:`, error);
        throw error;
    }
}