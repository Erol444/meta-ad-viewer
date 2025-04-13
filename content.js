// This script runs in the context of the web page

console.log("SpyDelta Content Script Injected.");

// Listen for messages from the background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "extractLinks") {
    console.log("Content script received request to extract links.");
    const data = extractLinks();
    console.log("Extracted links:", data);
    sendResponse({ data: data });
  } else if (message.action === "toggleUiModal") {
    toggleSpyDeltaModal();
    sendResponse({ success: true }); // Acknowledge the toggle
  } else if (message.action === "getUiState") { // Respond to state request
    console.log("[content] Received getUiState request"); // LOGGING
    const isActive = checkPageActivity();
    console.log(`[content] Responding with isActive: ${isActive}`); // LOGGING
    sendResponse({ isActive: isActive });
  }
  // Note: Returning true is important for sendResponse to work asynchronously IF NEEDED.
  // In this case, getUiState responds synchronously, but it's good practice if async work might be added.
  return true;
});

function extractLinks() {
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

// --- NEW: In-Page UI Modal Logic ---

let spyDeltaContainer = null; // Renamed from spyDeltaIframe for clarity
let isSpyDeltaVisible = false;
const SPYDELTA_CONTAINER_ID = 'spydelta-modal-container';
const SPYDELTA_IFRAME_ID = 'spydelta-modal-iframe';
const SPYDELTA_RESIZER_ID = 'spydelta-modal-resizer';

// Function to create and inject the CSS
function injectModalStyles() {
    const styleId = 'spydelta-iframe-styles';
    if (document.getElementById(styleId)) return; // Inject only once

    const css = `
        #${SPYDELTA_CONTAINER_ID} {
            position: fixed;
            top: 0;
            right: 0;
            height: 100%;
            width: 400px; /* Initial width */
            min-width: 400px; /* Min resize width */
            max-width: 800px; /* Max resize width */
            z-index: 99999999; /* High z-index */
            transform: translateX(100%); /* Start off-screen */
            transition: transform 0.3s ease-in-out; /* Animation */
            display: flex; /* Use flex for iframe + resizer */
            box-shadow: -2px 0 10px rgba(0, 0, 0, 0.2);
        }

        #${SPYDELTA_CONTAINER_ID}.visible {
            transform: translateX(0%); /* Slide in */
        }

        #${SPYDELTA_RESIZER_ID} {
             width: 8px; /* Width of the handle */
             height: 100%;
             background-color: #f1f1f1;
             border-left: 1px solid #ccc;
             cursor: ew-resize; /* East-West resize cursor */
             flex-shrink: 0; /* Prevent resizer from shrinking */
             order: 0; /* Position on the left */
         }

        #${SPYDELTA_IFRAME_ID} {
            border: none;
            flex-grow: 1; /* Take remaining space */
            height: 100%; /* Full height of container */
            width: 100%; /* Full width of its flex item space */
            background-color: white;
            order: 1; /* Position after the resizer */
        }
    `;
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = css;
    document.head.appendChild(style);
}

// Function to create the modal container and its contents (iframe, resizer)
function createSpyDeltaModalContainer() {
    if (document.getElementById(SPYDELTA_CONTAINER_ID)) {
        return document.getElementById(SPYDELTA_CONTAINER_ID);
    }

    injectModalStyles(); // Ensure styles are present

    const container = document.createElement('div');
    container.id = SPYDELTA_CONTAINER_ID;

    const resizer = document.createElement('div');
    resizer.id = SPYDELTA_RESIZER_ID;

    const iframe = document.createElement('iframe');
    iframe.id = SPYDELTA_IFRAME_ID;
    iframe.src = chrome.runtime.getURL('sidepanel.html');

    container.appendChild(resizer); // Add resizer first
    container.appendChild(iframe); // Add iframe second

    document.body.appendChild(container);

    // --- Add Resizing Logic ---
    let isResizing = false;
    let startX, initialWidth;

    const handleMouseMove = (e) => {
        if (!isResizing) return;
        requestAnimationFrame(() => {
             const currentX = e.clientX;
             const deltaX = currentX - startX;
             let newWidth = initialWidth - deltaX; // Subtract because dragging left increases width

             // Apply constraints (getComputedStyle for min/max)
             const computedStyle = window.getComputedStyle(container);
             const minWidth = parseInt(computedStyle.minWidth, 10);
             const maxWidth = parseInt(computedStyle.maxWidth, 10) || (window.innerWidth * 0.8); // Fallback for max width
             newWidth = Math.max(minWidth, Math.min(newWidth, maxWidth));

             container.style.width = `${newWidth}px`;
        });
    };

    const handleMouseUp = () => {
        if (isResizing) {
            isResizing = false;
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
            document.body.style.cursor = ''; // Reset cursor
            document.body.style.userSelect = ''; // Re-enable text selection
            // Allow iframe events again
             iframe.style.pointerEvents = 'auto';
            console.log('Resizing finished');
        }
    };

    resizer.addEventListener('mousedown', (e) => {
        isResizing = true;
        startX = e.clientX;
        initialWidth = container.offsetWidth;
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);

        // Prevent text selection and set cursor during resize
        document.body.style.cursor = 'ew-resize';
        document.body.style.userSelect = 'none';
        // Prevent accidental interaction with iframe during resize
        iframe.style.pointerEvents = 'none'; 
        console.log('Resizing started');
    });
    // --- End Resizing Logic ---

    return container;
}

// Function to toggle the visibility of the modal
function toggleSpyDeltaModal() {
    spyDeltaContainer = createSpyDeltaModalContainer(); // Get or create the container

    if (isSpyDeltaVisible) {
        spyDeltaContainer.classList.remove('visible');
    } else {
        requestAnimationFrame(() => {
            spyDeltaContainer.classList.add('visible');
        });
    }
    isSpyDeltaVisible = !isSpyDeltaVisible;
    console.log('SpyDelta Modal visibility toggled:', isSpyDeltaVisible);
}

// Ensure spyDeltaContainer variable points to the actual iframe for the message listener
const getIframeElement = () => document.getElementById(SPYDELTA_IFRAME_ID);

// Listen for messages FROM the iframe (e.g., close button)
window.addEventListener('message', (event) => {
    const iframeElement = getIframeElement();
    // Basic security check: Ensure the message is from our iframe
    // This check might need refinement based on how the iframe src is set
    if (iframeElement && event.source === iframeElement.contentWindow) {
         if (event.data && event.data.action === 'closeModal') {
            console.log('Received close message from iframe.');
            if (isSpyDeltaVisible) {
                 toggleSpyDeltaModal(); // Use the toggle function to hide it
            }
        }
    }
});

console.log("SpyDelta Content Script listeners ready.");

// Initial check in case the script is injected after the page is loaded
// and the background script expects an immediate response (though the current
// background script logic sends a message first)
// extractLinks(); // This might not be needed depending on timing 

// --- NEW: Function to check if the page is considered 'active' (has FB/IG link) ---
// Renamed to checkPageActivity and simplified to return boolean
function checkPageActivity() {
    // Look for links containing facebook.com or instagram.com, excluding common non-profile links
    const relevantLinkSelector = 'a[href*="facebook.com"]:not([href*="/sharer/"]):not([href*="/login"]):not([href*="/dialog/"]), a[href*="instagram.com"]:not([href*="/p/"]):not([href*="/explore/"]):not([href*="/accounts/"])';
    const linkElement = document.querySelector(relevantLinkSelector); // Get the element itself
    const hasRelevantLink = !!linkElement;
    console.log(`[content] checkPageActivity: Found link? ${hasRelevantLink}`, linkElement); // LOGGING link element
    return hasRelevantLink;
}
// --- END NEW --- 

// --- RE-ENABLE Initial state check on script load ---
// Background script requests state on events, but content script
// reporting its state on load is more reliable for initial injection.
setTimeout(() => {
    console.log("[content] Sending initial state report after timeout."); // LOGGING
    const initialState = checkPageActivity();
    chrome.runtime.sendMessage({ action: "reportUiState", isActive: initialState }, (response) => {
        if (chrome.runtime.lastError) {
            console.warn("[content] Could not send initial state report:", chrome.runtime.lastError.message); // LOGGING
            // Don't worry too much, background script will poll on tab events anyway
        }
    });
}, 100); // Small delay to increase chance background is ready 