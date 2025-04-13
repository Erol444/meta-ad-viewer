const statusDiv = document.getElementById('status');
const resultsDiv = document.getElementById('results');
const pageInfoDiv = document.getElementById('pageInfo');
const adsListUl = document.getElementById('adsList');

// --- NEW: Store page ID globally for detail requests ---
let currentPageId = null;
// --- NEW: Store full results globally for modal navigation ---
let currentResultsData = null;
// --- NEW: Pagination State ---
let currentAdCursor = null;
let hasMoreAds = false;
let isLoadingMoreAds = false;

// Modal elements
const mediaModal = document.getElementById("mediaModal"); // Changed selector
const modalMediaContent = document.getElementById("modalMediaContent"); // New content area
const modalPrevBtn = document.getElementById("modalPrevBtn"); // New prev button
const modalNextBtn = document.getElementById("modalNextBtn"); // New next button
const closeModal = mediaModal?.querySelector(".modal-close"); // Find close within mediaModal

// --- NEW: Loading Indicator Element ---
const loadingIndicator = document.getElementById("loadingIndicator"); 

// --- NEW: EU Modal elements ---
const euModal = document.getElementById("euModal");
const euModalContent = document.getElementById("euModalContent");
const closeEuModal = document.querySelector(".modal-close-eu");
// --- END NEW ---

// --- NEW: Reference to the custom close button ---
const customCloseBtn = document.getElementById('customCloseBtn');
// --- END NEW ---

// Platform Icon Styles Mapping
const platformStyles = {
    FACEBOOK: 'mask-image: url(&quot;assets/fb_sprite.png&quot;); mask-size: 21px 515px; mask-position: 0px -424px;',
    INSTAGRAM: 'mask-image: url(&quot;assets/fb_sprite.png&quot;); mask-size: 21px 515px; mask-position: 0px -437px;',
    AUDIENCE_NETWORK: 'mask-image: url(&quot;assets/sprite-network.png&quot;); mask-size: 81px 236px; mask-position: -68px -189px;',
    MESSENGER: 'mask-image: url(&quot;assets/fb_sprite_others.png&quot;); mask-size: 441px 673px; mask-position: -355px -524px;'
};

// --- Helper to create platform icon span ---
function createPlatformIcon(platform) {
     const style = platformStyles[platform];
     const fallback = platform.substring(0, 2);
     const size = '12px'; // Define icon size
     if (style) {
         return `<span class="platform-icon" style="${style} width:${size}; height:${size};" title="${platform}"></span>`;
     } else {
         return `<span class="platform-fallback" title="${platform}" style="width:${size}; height:${size}; font-size:10px;">${fallback}</span>`;
     }
}

// Function to trigger analysis
function triggerAnalysis() {
    statusDiv.textContent = 'Fetching ads...';
    resultsDiv.style.display = 'none'; // Hide previous results
    pageInfoDiv.innerHTML = '';
    adsListUl.innerHTML = '';
    currentResultsData = null; // Reset results data
    currentAdCursor = null; // Reset pagination
    hasMoreAds = false;
    isLoadingMoreAds = false;
    if (loadingIndicator) loadingIndicator.style.display = 'none'; // Hide indicator initially
    statusDiv.classList.remove('loading-more'); // Remove loading class if present

    chrome.runtime.sendMessage({ action: "analyzePage" }, (response) => {
        if (chrome.runtime.lastError) {
            statusDiv.textContent = `Error: ${chrome.runtime.lastError.message}`;
            console.error(chrome.runtime.lastError.message);
            return;
        }

        if (response.error) {
            statusDiv.textContent = `Error: ${response.error}`;
            console.error('Error from background:', response.error);
        } else if (response.results) {
            statusDiv.textContent = ''; // Clear status
            currentResultsData = response.results; // Store results globally
            displayResults(currentResultsData);
        } else {
            // Clear potential stale page ID
            currentPageId = null;
            statusDiv.textContent = 'Received unexpected response from background script.';
            console.warn("Unexpected response:", response);
        }
    });
}

// --- Keyboard Listener for Escape Key --- (and now arrows)
window.addEventListener('keydown', (event) => {
    // Check if Media Modal is open first
    if (mediaModal && mediaModal.style.display === 'block') {
        if (event.key === 'Escape') {
            closeMediaModalFunction();
            event.preventDefault(); // Prevent other escape actions
        } else if (event.key === 'ArrowLeft') {
            if (modalPrevBtn && !modalPrevBtn.disabled) {
                modalPrevBtn.click();
                event.preventDefault(); // Prevent browser back navigation
            }
        } else if (event.key === 'ArrowRight') {
            if (modalNextBtn && !modalNextBtn.disabled) {
                modalNextBtn.click();
                event.preventDefault(); // Prevent default arrow actions
            }
        }
        // If modal is open, don't process other keys (like EU modal close)
        return;
    }
    
    // Close EU Modal on Escape (only if media modal isn't open)
    if (euModal && euModal.style.display === 'flex' && event.key === 'Escape') {
        closeEuModalFunction();
        event.preventDefault();
    }
});

// --- Trigger Analysis Automatically on Load ---
triggerAnalysis();

// --- Media Modal Close Logic --- 
function closeMediaModalFunction() {
    if (mediaModal) {
        mediaModal.style.display = "none";
        // Stop any video that might be playing
        const video = modalMediaContent.querySelector('video');
        if (video) {
            video.pause();
            video.src = ''; // Prevent further loading
        }
        modalMediaContent.innerHTML = ''; // Clear content
    }
}

if (closeModal) {
    closeModal.onclick = closeMediaModalFunction;
}

if (mediaModal) {
    mediaModal.onclick = function(event) {
        // Close if clicked on the background, but not on the content or nav buttons
        if (event.target == mediaModal) {
            closeMediaModalFunction();
        }
    }
}

// --- NEW: Add listener for the custom close button ---
if (customCloseBtn) {
    customCloseBtn.addEventListener('click', () => {
        console.log('Close button clicked. Closing sidepanel.');
        window.close(); // Close the side panel window
    });
}
// --- END NEW ---

// --- NEW: EU Modal Functions ---
function closeEuModalFunction() {
    if (euModal) {
        euModal.style.display = "none";
        euModalContent.innerHTML = '<p>Loading EU Transparency details...</p>'; // Reset content
    }
}

if(closeEuModal) {
    closeEuModal.onclick = closeEuModalFunction;
}

if(euModal) {
    euModal.onclick = function(event) {
        // Close if clicked outside the modal content area
        if (event.target == euModal) {
            closeEuModalFunction();
        }
    }
}
// --- END NEW ---

// --- Combined Media Modal Functions --- 

// Function to load specific creative into the modal
function loadCreativeInModal(adIndex, creativeIndex) {
    if (!currentResultsData || !currentResultsData.ads || !currentResultsData.ads[adIndex]) return;
    const ad = currentResultsData.ads[adIndex];
    if (!ad.creatives || !ad.creatives[creativeIndex]) return;

    const creative = ad.creatives[creativeIndex];
    modalMediaContent.innerHTML = ''; // Clear previous content

    if (creative.video_url) {
        const video = document.createElement('video');
        video.src = creative.video_url;
        video.poster = creative.image_url || '';
        video.controls = true;
        video.controlsList = "nodownload";
        // Consider adding autoplay or other attributes if needed
        // video.autoplay = true; 
        video.onerror = () => { modalMediaContent.innerHTML = '<p class="error">Error loading video.</p>'; };
        modalMediaContent.appendChild(video);
        video.play().catch(e => console.log("Modal video autoplay likely blocked."));
    } else if (creative.image_url) {
        const img = document.createElement('img');
        img.src = creative.image_url;
        img.alt = "Ad Creative";
        img.onerror = () => { modalMediaContent.innerHTML = '<p class="error">Error loading image.</p>'; };
        modalMediaContent.appendChild(img);
    } else {
        modalMediaContent.innerHTML = '<p>No media available for this creative.</p>';
    }

    // Store current indices in the modal
    mediaModal.dataset.adIndex = adIndex;
    mediaModal.dataset.creativeIndex = creativeIndex;

    updateModalNavButtons();
}

// Function to update the enable/disable state of modal nav buttons
function updateModalNavButtons() {
    if (!mediaModal || !currentResultsData) return;

    const adIndex = parseInt(mediaModal.dataset.adIndex, 10);
    const creativeIndex = parseInt(mediaModal.dataset.creativeIndex, 10);

    if (isNaN(adIndex) || isNaN(creativeIndex)) {
        modalPrevBtn.disabled = true;
        modalNextBtn.disabled = true;
        return;
    }

    const ad = currentResultsData.ads[adIndex];
    const numCreatives = ad?.creatives?.length || 0;

    modalPrevBtn.disabled = creativeIndex <= 0;
    modalNextBtn.disabled = creativeIndex >= numCreatives - 1;

    // Hide buttons if only one creative
    if (numCreatives <= 1) {
        modalPrevBtn.style.display = 'none';
        modalNextBtn.style.display = 'none';
    } else {
        modalPrevBtn.style.display = 'block';
        modalNextBtn.style.display = 'block';
    }
}

// Function to open the combined media modal
function openMediaModal(adIndex, creativeIndex) {
    if (!mediaModal || !modalMediaContent) return;
    
    // Stop video in the main list if it was playing
    const adElement = adsListUl.querySelector(`li[data-ad-index="${adIndex}"]`);
    if (adElement) {
        const videoInList = adElement.querySelector(`video`); // Assuming only one video per slide for simplicity
        if (videoInList) videoInList.pause();
    }

    loadCreativeInModal(adIndex, creativeIndex);
    mediaModal.style.display = "block"; // Use block for modal display
}

// --- Add Event Listeners for Modal Navigation --- 
if (modalPrevBtn) {
    modalPrevBtn.addEventListener('click', () => {
        const adIndex = parseInt(mediaModal.dataset.adIndex, 10);
        let creativeIndex = parseInt(mediaModal.dataset.creativeIndex, 10);
        if (!isNaN(adIndex) && !isNaN(creativeIndex) && creativeIndex > 0) {
            loadCreativeInModal(adIndex, creativeIndex - 1);
        }
    });
}

if (modalNextBtn) {
    modalNextBtn.addEventListener('click', () => {
        const adIndex = parseInt(mediaModal.dataset.adIndex, 10);
        let creativeIndex = parseInt(mediaModal.dataset.creativeIndex, 10);
        const numCreatives = currentResultsData?.ads[adIndex]?.creatives?.length || 0;
        if (!isNaN(adIndex) && !isNaN(creativeIndex) && creativeIndex < numCreatives - 1) {
            loadCreativeInModal(adIndex, creativeIndex + 1);
        }
    });
}

function displayResults(results) {
    resultsDiv.style.display = 'block';
    pageInfoDiv.innerHTML = ''; // Clear previous info
    adsListUl.innerHTML = ''; // Clear previous ads
    currentPageId = null; // Reset page ID on new results
    // --- NEW: Reset pagination state on new results display ---
    currentAdCursor = null;
    hasMoreAds = false;
    isLoadingMoreAds = false;
    if (loadingIndicator) loadingIndicator.style.display = 'none'; // Hide indicator
    statusDiv.classList.remove('loading-more');

    // -- NEW Page Info Display --
    if (results.foundPage) {
        const page = results.foundPage;
        currentPageId = page.id; // Store page ID

        let pageHTML = `<div class="page-info-block">`; // Wrapper div
        pageHTML += `<p class="page-id-category">${page.id} - ${page.category || 'N/A'}</p>`;

        // Facebook Row
        pageHTML += `<p class="page-link-row">`;
        pageHTML += createPlatformIcon('FACEBOOK');
        pageHTML += ` <a href="https://facebook.com/${page.id}" target="_blank">${page.name}</a>`;
        if (page.likes != null) {
             pageHTML += `&nbsp;- ${page.likes.toLocaleString()} likes`;
        }
        pageHTML += `</p>`;

        // Instagram Row (conditional)
        if (page.ig_username) {
            pageHTML += `<p class="page-link-row">`;
            pageHTML += createPlatformIcon('INSTAGRAM');
            pageHTML += ` <a href="https://instagram.com/${page.ig_username}" target="_blank">@${page.ig_username}</a>`;
             if (page.ig_followers != null) {
                 pageHTML += `&nbsp;- ${page.ig_followers.toLocaleString()} followers`;
             }
            pageHTML += `</p>`;
        }

        pageHTML += `</div>`; // Close wrapper
        pageInfoDiv.innerHTML = pageHTML;

        // Display Ads (if page found)
        if (results.ads && results.ads.length > 0) {
            adsListUl.innerHTML = ''; // Clear only once before loop
            // Pass 0 as startIndex for the initial load
            appendAdsToList(results.ads, 0);
            
            // --- Store initial pagination state --- 
            if (results.page_info) {
                currentAdCursor = results.page_info.end_cursor;
                hasMoreAds = results.page_info.has_next_page;
            } else {
                console.warn("Initial results missing page_info.");
                currentAdCursor = null;
                hasMoreAds = false;
            }
            console.log(`Initial load: Has more ads? ${hasMoreAds}, Cursor: ${currentAdCursor}`);
        } else {
            adsListUl.innerHTML = '<li>No active ads found for this page.</li>';
        }
    } else {
        // Page not found case
        pageInfoDiv.innerHTML = `<div class="page-info-block"><p>Facebook page not found for "${results.searchedTerm || 'the given links'}".</p></div>`;
        adsListUl.innerHTML = '<li>Cannot fetch ads as the page was not found.</li>';
    }
}

// --- NEW: Helper function to append ads to the list ---
// Accepts startIndex parameter
function appendAdsToList(ads, startIndex = 0) { 
    if (!ads || ads.length === 0) return;
    console.log(`[sidepanel] appendAdsToList called with startIndex: ${startIndex}, ${ads.length} ads`); // LOGGING
    
    ads.forEach((ad, indexOffset) => {
        // Calculate adIndex based on provided startIndex
        const adIndex = startIndex + indexOffset;
        console.log(`[sidepanel] Appending ad with calculated adIndex: ${adIndex} (startIndex=${startIndex}, indexOffset=${indexOffset})`); // LOGGING
        const li = document.createElement('li');
        li.setAttribute('data-ad-index', adIndex); // Use the correct global index

        // --- Platform Icons --- (Prepare first)
        const platforms = ad.platforms || [];
        const platformIconsHTML = platforms.map(platform => {
            return createPlatformIcon(platform); // Use helper
        }).join(' ');

        // --- Ad Header Structure ---
        let adHTML = `
            <div class="ad-header">
                <div class="ad-header-left">
                    <div><strong>${ad.display_format || 'Ad'}</strong> (<a href="https://www.facebook.com/ads/library/?id=${ad.id}&country=ALL" target="_blank">${ad.id}</a>)</div>
                    <div><strong>Duration:</strong> ${ad.start_date ? new Date(ad.start_date * 1000).toLocaleDateString() : 'N/A'} - ${ad.end_date ? new Date(ad.end_date * 1000).toLocaleDateString() : 'N/A'}</div>
                </div>
                <div class="ad-header-right">
                     ${platformIconsHTML || 'N/A'}
                    ${ad.is_aaa_eligible ? `<button class="transparency-btn" data-ad-id="${ad.id}">EU Transparency</button>` : ''}
                </div>
            </div>
        `;

        // --- Display Creatives & Text ---
        if (ad.creatives && ad.creatives.length > 0) {
            const firstCreative = ad.creatives[0]; // Use first creative for representative text

            // Headline (no label, larger)
            adHTML += `
                ${firstCreative.headline ? `<div class="ad-headline">${firstCreative.headline}</div>` : ''}
            `;
            // Body (no label, longer substring)
            adHTML += `
                ${firstCreative.body ? `<div class="ad-body">${firstCreative.body.substring(0, 300)}${firstCreative.body.length > 300 ? '...' : ''}</div>` : ''}
            `;

            // --- Media Container ---
            adHTML += `<div class="ad-media-container">`;
            if (ad.creatives.length === 1) {
                // Single Creative
                const creative = ad.creatives[0];
                if (creative.video_url) {
                    adHTML += `
                        <video controls class="ad-video" poster="${creative.image_url || ''}" style="max-width: 100%; max-height: 300px;">
                            <source src="${creative.video_url}" type="video/mp4">
                            Your browser does not support the video tag.
                        </video>
                    `;
                } else if (creative.image_url) {
                     adHTML += `<img src="${creative.image_url}" alt="Ad Creative" class="ad-image" style="max-width: 100%; max-height: 300px; object-fit: contain;">`;
                }
            } else {
                // Multiple Creatives - Carousel
                adHTML += `
                    <div class="carousel" id="carousel-${adIndex}">
                        <!-- Carousel Buttons -->
                        <button class="carousel-btn prev" disabled>&lt;</button>
                        <!-- Slides -->
                        <div class="slides-container">
                            <div class="slides">
                                ${ad.creatives.map((creative, index) => `
                                    <div class="slide ${index === 0 ? 'active' : ''}">
                                        ${creative.video_url
                                            ? `<video controls class="ad-video" poster="${creative.image_url || ''}" style="max-width: 100%; max-height: 300px;">
                                                   <source src="${creative.video_url}" type="video/mp4">
                                                   Your browser does not support the video tag.
                                               </video>`
                                            : creative.image_url
                                                ? `<img src="${creative.image_url}" alt="Ad Creative ${index + 1}" class="ad-image" style="max-width: 100%; max-height: 300px; object-fit: contain;">`
                                                : '<p>No media</p>'
                                        }
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                        <button class="carousel-btn next">></button>
                        <!-- Indicators -->
                        <div class="carousel-indicators">
                             ${ad.creatives.map((_, index) => `<span class="indicator ${index === 0 ? 'active' : ''}" data-slide-index="${index}"></span>`).join('')}
                         </div>
                    </div>
                `;
            }
            adHTML += `</div>`; // Close media-container
            // --- End Media Container ---

            // --- CTA / Link / Caption Area Below Media ---
             adHTML += `<div class="ad-cta-area">`;
             adHTML += `   <div class="ad-caption">${firstCreative.caption || '&nbsp;'}</div>`; // Use caption if available, or non-breaking space
             if (firstCreative.cta_text && firstCreative.link_url) {
                 adHTML += `<a href="${firstCreative.link_url}" target="_blank" class="ad-cta-link">
                               ${firstCreative.cta_text}
                            </a>`;
             } else if (firstCreative.cta_text) {
                 // CTA text without link
                 adHTML += `<span class="ad-cta-link">${firstCreative.cta_text}}</span>`;
             } else {
                 adHTML += `<div></div>`; // Placeholder to maintain structure if no CTA
             }
             adHTML += `</div>`; // Close ad-cta-area

        } else {
            adHTML += `<p>No creative information available.</p>`;
        }

        li.innerHTML = adHTML;
        adsListUl.appendChild(li);

        // --- Add Event Listeners AFTER appending li ---
        // Image Modal listeners (for actual img tags)
        li.querySelectorAll('.ad-image').forEach(img => {
            img.addEventListener('click', () => {
                const slide = img.closest('.slide');
                const slideIndex = slide ? Array.from(slide.parentNode.children).indexOf(slide) : 0;
                openMediaModal(adIndex, slideIndex); // Pass adIndex and creativeIndex
            });
        });

        // Video click listener (to open modal)
        li.querySelectorAll('.ad-video').forEach(video => {
            video.addEventListener('click', (event) => {
                // Simple check: if click is not on controls area (approximate)
                const rect = video.getBoundingClientRect();
                const controlsHeight = 30; 
                if (event.clientY < rect.bottom - controlsHeight) {
                    event.preventDefault(); 
                    event.stopPropagation();
                    
                    const slide = video.closest('.slide');
                    const slideIndex = slide ? Array.from(slide.parentNode.children).indexOf(slide) : 0;
                    
                    // PAUSE the original video before opening modal
                    video.pause();

                    openMediaModal(adIndex, slideIndex); // Pass adIndex and creativeIndex
                }
           });
        });

        // --- NEW: Transparency Button Listener ---
        const transparencyBtn = li.querySelector('.transparency-btn');
        if (transparencyBtn) {
            transparencyBtn.addEventListener('click', () => {
                const adId = transparencyBtn.getAttribute('data-ad-id');
                if (adId && currentPageId) {
                    // Open the modal and trigger the request
                    openEuModal(adId, currentPageId);
                } else {
                    console.error('Missing adId or currentPageId for transparency button click.');
                }
            });
        }
        // --- END: Transparency Button Listener ---

        // Carousel setup
        if (ad.creatives && ad.creatives.length > 1) {
            const carouselElement = li.querySelector(`.carousel`); // Use class selector now
            if (carouselElement) {
                 // Assign unique ID dynamically if needed, or just use class
                carouselElement.id = `carousel-${adIndex}`;
                setupCarousel(carouselElement);
            }
        }
    });
}

function setupCarousel(carouselElement) {
    const prevButton = carouselElement.querySelector('.prev');
    const nextButton = carouselElement.querySelector('.next');
    const slides = carouselElement.querySelectorAll('.slide');
    const indicators = carouselElement.querySelectorAll('.indicator');
    let currentSlide = 0;

    function showSlide(index) {
        slides.forEach((slide, i) => {
            slide.classList.toggle('active', i === index);
            // Pause videos in inactive slides
             const video = slide.querySelector('video');
             if (video && i !== index) {
                video.pause();
             }
        });
        indicators.forEach((indicator, i) => {
            indicator.classList.toggle('active', i === index);
        });
        currentSlide = index;
        prevButton.disabled = currentSlide === 0;
        nextButton.disabled = currentSlide === slides.length - 1;
    }

    prevButton.addEventListener('click', () => {
        if (currentSlide > 0) {
            showSlide(currentSlide - 1);
        }
    });

    nextButton.addEventListener('click', () => {
        if (currentSlide < slides.length - 1) {
            showSlide(currentSlide + 1);
        }
    });

     indicators.forEach(indicator => {
         indicator.addEventListener('click', () => {
             const slideIndex = parseInt(indicator.getAttribute('data-slide-index'), 10);
             showSlide(slideIndex);
         });
     });

    // Initialize
    showSlide(0);
}

// --- NEW: EU Modal Functions ---
function openEuModal(adId, pageId) {
    if (!euModal || !euModalContent) {
        console.error("EU Modal elements (#euModal or #euModalContent) not found in the HTML!");
        return;
    }

    // Show modal with loading state
    euModalContent.innerHTML = '<p>Loading EU Transparency details...</p>';
    euModal.style.display = "flex"; // Use flex to enable centering

    // Send request to background
    console.log(`Requesting EU details for Ad ID: ${adId}, Page ID: ${pageId}`);
    chrome.runtime.sendMessage(
        { action: "getAdDetails", data: { adId: adId, pageId: pageId } },
        (response) => {
            if (chrome.runtime.lastError) {
                console.error('Error fetching EU details:', chrome.runtime.lastError.message);
                populateEuModalError(`Error: ${chrome.runtime.lastError.message}`);
            } else if (response.error) {
                console.error('Error from background fetching EU details:', response.error);
                populateEuModalError(`Error: ${response.error}`);
            } else if (response.details) {
                console.log('Received EU details:', response.details);
                populateEuModal(response.details);
            } else {
                console.warn('Unexpected response for EU details:', response);
                populateEuModalError('Unexpected response from server.');
            }
        }
    );
}

function populateEuModal(details) {
    if (!euModalContent) return;

    let contentHTML = `<h3>EU Transparency Details</h3>`;

    // --- General Details (Strong on Value) ---
    contentHTML += `
        <p>Locations: <strong>${details.locations?.join(', ') || 'N/A'}</strong></p>
        ${(details.excluded_locations && details.excluded_locations.length > 0) ? `<p>Excluded Locations: <strong>${details.excluded_locations.join(', ')}</strong></p>` : ''}
        <p>Gender: <strong>${details.gender || 'N/A'}</strong></p>
        <p>Age Range: <strong>${details.age_range?.min ?? 'N/A'} - ${details.age_range?.max ?? 'N/A'}</strong></p>
        <p>Estimated EU Reach: <strong>${details.eu_total_reach?.toLocaleString() || 'N/A'}</strong></p>
    `;

    // Demographics Table
    if (details.demographic_breakdown && details.demographic_breakdown.length > 0) {
        // Assuming we only display the first country's breakdown if multiple exist
        const firstCountryBreakdown = details.demographic_breakdown[0];
        const ageGenderBreakdowns = firstCountryBreakdown?.age_gender_breakdowns;

        if (ageGenderBreakdowns && ageGenderBreakdowns.length > 0) {
            contentHTML += `<h4>Demographic Breakdown (Reach - ${firstCountryBreakdown.country || 'Unknown Country'})</h4>`;
            contentHTML += `<table class="demographics-table">`;
            contentHTML += `<thead><tr><th>Age Range</th><th>Male</th><th>Female</th></tr></thead>`;
            contentHTML += `<tbody>`;

            let totalMale = 0;
            let totalFemale = 0;

            ageGenderBreakdowns.forEach(row => {
                 // Format numbers with commas, handle nulls
                 const formatNumber = (num) => num != null ? num.toLocaleString() : '-';

                 // Accumulate totals (treat null as 0 for sum)
                 totalMale += row.male || 0;
                 totalFemale += row.female || 0;

                 contentHTML += `
                    <tr>
                        <td>${row.age_range || 'N/A'}</td>
                        <td>${formatNumber(row.male)}</td>
                        <td>${formatNumber(row.female)}</td>
                    </tr>
                `;
            });
            contentHTML += `</tbody>`;
            // --- Add Total Row --- 
            contentHTML += `<tfoot>`;
            contentHTML += `
                 <tr>
                      <td><strong>Total</strong></td>
                      <td><strong>${totalMale.toLocaleString()}</strong></td>
                      <td><strong>${totalFemale.toLocaleString()}</strong></td>
                 </tr>
            `;
            contentHTML += `</tfoot>`;
            contentHTML += `</table>`;
        } else {
             contentHTML += `<p>No age/gender breakdown data available for the primary country.</p>`;
        }
    } else {
        contentHTML += `<p>No demographic breakdown data available.</p>`;
    }

    euModalContent.innerHTML = contentHTML;
}

function populateEuModalError(errorMessage) {
    if (!euModalContent) return;
    euModalContent.innerHTML = `
        <h3>Error Fetching EU Details</h3>
        <p class="error">${errorMessage}</p>
    `;
}
// --- END NEW ---

// --- NEW: Scroll Listener for Infinite Loading ---
window.addEventListener('scroll', () => {
    // Check if we should load more
    if (!isLoadingMoreAds && hasMoreAds && currentPageId && currentAdCursor) {
        const { scrollTop, scrollHeight, clientHeight } = document.documentElement;
        // Trigger load when user is near the bottom (e.g., 80% scrolled)
        if (scrollTop + clientHeight >= scrollHeight * 0.8) {
            loadMoreAds();
        }
    }
});

// --- NEW: Function to Load More Ads ---
function loadMoreAds() {
    if (isLoadingMoreAds || !hasMoreAds || !currentPageId || !currentAdCursor) {
        return; // Already loading, no more ads, or missing data
    }

    isLoadingMoreAds = true;
    statusDiv.textContent = ''; // Clear status text
    if (loadingIndicator) loadingIndicator.style.display = 'flex'; // Show spinner
    
    // Calculate the starting index for the ads we are about to append
    const currentAdsLength = currentResultsData?.ads?.length || 0;
    console.log(`[sidepanel] loadMoreAds: currentResultsData.ads.length = ${currentAdsLength}`); // LOGGING
    const startIndexForAppend = currentAdsLength;
    console.log(`[sidepanel] loadMoreAds: Requesting more ads starting from index ${startIndexForAppend} (cursor: ${currentAdCursor})`); // LOGGING

    chrome.runtime.sendMessage(
        { action: "getMoreAds", data: { pageId: currentPageId, cursor: currentAdCursor } },
        (response) => {
            isLoadingMoreAds = false;
            if (loadingIndicator) loadingIndicator.style.display = 'none'; // Hide spinner

            if (chrome.runtime.lastError) {
                console.error('Error fetching more ads:', chrome.runtime.lastError.message);
                statusDiv.textContent = `Error: ${chrome.runtime.lastError.message}`;
                hasMoreAds = false; // Stop trying on error
            } else if (response.error) {
                console.error('Error from background fetching more ads:', response.error);
                statusDiv.textContent = `Error: ${response.error}`;
                hasMoreAds = false; // Stop trying on error
            } else if (response.results && response.results.ads) {
                console.log(`Received ${response.results.ads.length} more ads. Has next page: ${response.results.page_info?.has_next_page}`);
                
                // Append new ads using the calculated starting index
                appendAdsToList(response.results.ads, startIndexForAppend); 
                
                 // --- Concatenate new ads to global data *after* appending to UI ---
                if (currentResultsData && currentResultsData.ads) {
                     currentResultsData.ads = currentResultsData.ads.concat(response.results.ads);
                } else {
                     console.warn("currentResultsData.ads was not initialized correctly before appending.");
                     currentResultsData = { ...(currentResultsData || {}), ads: response.results.ads };
                }

                // Update pagination state from the new response
                if (response.results.page_info) {
                    currentAdCursor = response.results.page_info.end_cursor;
                    hasMoreAds = response.results.page_info.has_next_page;
                } else {
                    console.warn("Pagination response missing page_info.");
                    currentAdCursor = null;
                    hasMoreAds = false;
                }

                if (!hasMoreAds) {
                    console.log("No more ads to load.");
                }
            } else {
                console.warn('Unexpected response for loading more ads:', response);
                hasMoreAds = false; // Stop trying on unexpected response
            }
        }
    );
}