// This script runs in the context of the web page

console.log("SpyDelta Content Script Injected.");

// Listen for messages from the background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "extractLinks") {
    console.log("Content script received request to extract links.");
    const data = extractPageData();
    console.log("Extracted data:", data);
    sendResponse({ data: data });
  }
  // Keep the message channel open for asynchronous response (though not needed here)
  // return true;
});

function extractPageData() {
  const links = document.querySelectorAll('a[href*="facebook.com"], a[href*="instagram.com"]');
  let facebookLink = null;
  let instagramLink = null;

  links.forEach(link => {
    const href = link.href;
    if (!facebookLink && href.includes('facebook.com')) {
      // Basic check to avoid share/login links - might need refinement
      if (!href.includes('/sharer/') && !href.includes('/login') && !href.includes('/dialog/')) {
          facebookLink = href;
      }
    }
    if (!instagramLink && href.includes('instagram.com')) {
       // Basic check to avoid non-profile links
       if (!href.includes('/p/') && !href.includes('/explore/') && !href.includes('/accounts/')) {
           instagramLink = href;
       }
    }
  });

  return {
    facebookLink: facebookLink,
    instagramLink: instagramLink,
    currentUrl: window.location.href
  };
}

console.log("SpyDelta Content Script listeners ready.");

// Initial check in case the script is injected after the page is loaded
// and the background script expects an immediate response (though the current
// background script logic sends a message first)
// extractPageData(); // This might not be needed depending on timing 