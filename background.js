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

// --- Side Panel Logic ---
chrome.action.onClicked.addListener((tab) => {
  chrome.sidePanel.open({ windowId: tab.windowId });
});

// --- Content Script Interaction & Scraping Logic ---
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "analyzePage") {
    // 1. Inject content script into the active tab
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const activeTab = tabs[0];
      if (activeTab && activeTab.id) {
        chrome.scripting.executeScript({
          target: { tabId: activeTab.id },
          files: ['content.js']
        }, (injectionResults) => {
          if (chrome.runtime.lastError || !injectionResults || injectionResults.length === 0) {
            console.error('Failed to inject content script:', chrome.runtime.lastError?.message);
            sendResponse({ error: "Failed to inject content script" });
            return;
          }
          // Content script executed, now send message to it to get data
          chrome.tabs.sendMessage(activeTab.id, { action: "extractLinks" }, (response) => {
            if (chrome.runtime.lastError) {
              console.error('Error receiving data from content script:', chrome.runtime.lastError.message);
              sendResponse({ error: "Failed to get data from page" });
              return;
            }
            if (response && response.data) {
              console.log('Received data from content script:', response.data);
              // 2. Use scraper with the extracted data
              scrapeAndSendData(response.data, sendResponse);
            } else {
               sendResponse({ error: "No data received from content script" });
            }
          });
        });
      } else {
        console.error('Could not get active tab ID.');
        sendResponse({ error: "Could not get active tab" });
      }
    });

    return true; // Indicates that the response is sent asynchronously
  }
  // --- NEW: Handle Get Ad Details Request ---
  else if (message.action === "getAdDetails") {
      const { adId, pageId } = message.data;
      if (!adId || !pageId) {
          console.error('Missing adId or pageId for getAdDetails');
          sendResponse({ error: "Missing adId or pageId" });
          return false; // Synchronous response
      }

      (async () => { // Use an async IIFE to handle async logic
          try {
              const scraper = await getScraperInstance();
              const details = await scraper.getAdDetails(adId, pageId);
              if (details) {
                  sendResponse({ details: details });
              } else {
                  // If scraper returns null, it might mean not found or error during scrape
                  sendResponse({ error: "Could not fetch ad details (may not exist or scraping issue)." });
              }
          } catch (error) {
              console.error("Error fetching ad details in background:", error);
              sendResponse({ error: `Failed to fetch ad details: ${error.message || error}` });
          }
      })();

      return true; // Indicates asynchronous response
  }
  // --- END: Handle Get Ad Details Request ---
});

// --- Combined Scraping Logic ---
async function scrapeAndSendData(pageData, sendResponse) {
    try {
        const currentScraper = await getScraperInstance(); // Get or init scraper
        const targetPage = await findFacebookPage(currentScraper, pageData); // Pass scraper

        if (targetPage) {
            const ads = await findFacebookAds(currentScraper, targetPage.id); // Pass scraper
            console.log(`Found ${ads.length} ads for page ${targetPage.name}.`);
            sendResponse({
                results: {
                    searchedTerm: pageData.facebookLink ? (pageData.facebookLink.match(/facebook\.com\/([\w\.]+)/)?.[1] || pageData.facebookLink) : (pageData.instagramLink.match(/instagram\.com\/([\w\.]+)/)?.[1] || pageData.instagramLink),
                    foundPage: targetPage,
                    ads: ads
                }
            });
        } else {
            // Determine searched term even if page not found
            const searchTerm = pageData.facebookLink ? (pageData.facebookLink.match(/facebook\.com\/([\w\.]+)/)?.[1] || pageData.facebookLink) : (pageData.instagramLink.match(/instagram\.com\/([\w\.]+)/)?.[1] || pageData.instagramLink);
            console.log(`No Facebook page found for term derived from links: ${searchTerm}`);
            sendResponse({ results: { searchedTerm: searchTerm, foundPage: null, ads: [] } });
        }
    } catch (error) {
        console.error("Scraping error in scrapeAndSendData:", error);
        sendResponse({ error: `Scraping failed: ${error.message || error}` }); // Ensure error message is passed
    }
}

// --- Facebook Scraping Functions ---
async function findFacebookPage(scraperInstance, pageData) {
    console.log("Starting Facebook page finding process with data:", pageData);
    const { facebookLink, instagramLink } = pageData;

    let pageNameToSearch = null;
    let searchSource = '';

    // Prioritize Facebook link if available
    if (facebookLink) {
        console.log(`Attempting to extract Page ID/Name from Facebook URL: ${facebookLink}`);
        // Basic extraction (needs refinement for different URL formats)
        const fbMatch = facebookLink.match(/facebook\.com\/([\w\.]+)(?:\/|$)/);
        if (fbMatch && fbMatch[1]) {
            pageNameToSearch = fbMatch[1]; // Use the profile name/alias
            searchSource = 'Facebook Link';
            console.log(`Extracted potential page alias: ${pageNameToSearch}`);
            // TODO: Consider if we can get the numerical ID more directly?
        } else {
            console.warn(`Could not extract page alias from Facebook URL: ${facebookLink}`);
        }
    }

    // Fallback to Instagram link if no Facebook link or if FB alias fails
    if (!pageNameToSearch && instagramLink) {
        console.log(`Attempting to extract username from Instagram URL: ${instagramLink}`);
        const igMatch = instagramLink.match(/instagram\.com\/([\w\.]+)(?:\/|$)/);
        if (igMatch && igMatch[1]) {
            pageNameToSearch = igMatch[1]; // Use IG username for search
            searchSource = 'Instagram Link';
            console.log(`Using Instagram username for search: ${pageNameToSearch}`);
        }
         else {
            console.warn(`Could not extract username from Instagram URL: ${instagramLink}`);
        }
    }

    if (!pageNameToSearch) {
        console.error("Could not determine a page name/ID to search from the provided links.");
        return null;
    }

    console.log(`Searching Facebook Pages for: ${pageNameToSearch} (Source: ${searchSource})`);
    const pages = await scraperInstance.searchPages(pageNameToSearch);

    if (!pages || pages.length === 0) {
        console.log(`No Facebook pages found matching '${pageNameToSearch}'.`);
        return null;
    }

    // Find correct page based on page_alias
    const targetPage = pages.find(page => page.page_alias === pageNameToSearch) || pages.find(page => page.ig_username === pageNameToSearch);

    if (!targetPage) {
      console.error("Failed to find a valid page from search results.");
      return null;
    }

    // Strategy: Pick the most likely page. Often the first result is good,
    // but might need refinement (e.g., check for verification, follower count match?)
    console.log(`Found the match: ${targetPage.name} (ID: ${targetPage.id}, Likes: ${targetPage.likes})`);
    return targetPage
}

async function findFacebookAds(scraperInstance, pageIdToSearch) {
    if (!pageIdToSearch) {
        console.error("No Page ID provided to findFacebookAds.");
        return []; // Return empty array if no ID
    }
    console.log(`Fetching ads for Page ID: ${pageIdToSearch}`);
    const ads = await scraperInstance.getPageAds(pageIdToSearch);

    console.log(`Found ${ads.length} ads for page ID ${pageIdToSearch}.`);

    // Removed logic dependent on variables from findFacebookPage scope
    // Removed fetching details for first ad for simplicity now

    return ads; // Return only the ads array
}