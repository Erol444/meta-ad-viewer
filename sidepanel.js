const statusDiv = document.getElementById('status');
const resultsDiv = document.getElementById('results');
const pageInfoDiv = document.getElementById('pageInfo');
const adsListUl = document.getElementById('adsList');

// --- NEW: Store page ID globally for detail requests ---
let currentPageId = null;

// Modal elements
const modal = document.getElementById("imageModal");
const modalImg = document.getElementById("modalImage");
const closeModal = document.querySelector(".modal-close");

// Video Modal elements
const videoModal = document.getElementById("videoModal");
const modalVideo = document.getElementById("modalVideo");
const closeVideoModal = document.querySelector(".modal-close-video");

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
            displayResults(response.results);
        } else {
            // Clear potential stale page ID
            currentPageId = null;
            statusDiv.textContent = 'Received unexpected response from background script.';
            console.warn("Unexpected response:", response);
        }
    });
}

// --- Keyboard Listener for Escape Key ---
window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
        if (modal.style.display === 'block') {
            modal.style.display = 'none';
        }
        if (videoModal.style.display === 'block') {
            videoModal.style.display = 'none';
            modalVideo.pause();
            modalVideo.src = ''; // Stop loading
        }
        // Close EU Modal on Escape
        if (euModal && euModal.style.display === 'flex') {
            closeEuModalFunction();
        }
    }
});

// --- Trigger Analysis Automatically on Load ---
triggerAnalysis();

// Close modal listeners
closeModal.onclick = function() {
    modal.style.display = "none";
}
modal.onclick = function(event) {
    // Close if clicked outside the image content
    if (event.target == modal) {
        modal.style.display = "none";
    }
}

// Video modal
closeVideoModal.onclick = function() {
    videoModal.style.display = "none";
    modalVideo.pause(); // Pause video when closing
    modalVideo.src = ''; // Clear source
}
videoModal.onclick = function(event) {
    // Close if clicked outside the video content
    if (event.target == videoModal) {
        videoModal.style.display = "none";
        modalVideo.pause();
        modalVideo.src = ''; // Clear source
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

// Function to open modal
function openImageModal(src) {
    if (modal && modalImg) {
        modal.style.display = "block";
        modalImg.src = src;
    }
}

function openVideoModal(src, poster) {
    if (videoModal && modalVideo) {
        modalVideo.src = src;
        modalVideo.poster = poster || '';
        videoModal.style.display = "block";
        // Optionally try to play - may be blocked by browser policy
        // modalVideo.play().catch(e => console.log("Modal video autoplay blocked.")); 
    }
}

function displayResults(results) {
    resultsDiv.style.display = 'block';
    pageInfoDiv.innerHTML = ''; // Clear previous info
    adsListUl.innerHTML = ''; // Clear previous ads
    currentPageId = null; // Reset page ID on new results

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
            results.ads.forEach((ad, adIndex) => {
                const li = document.createElement('li');
                li.setAttribute('data-ad-index', adIndex);

                // --- Platform Icons --- (Prepare first)
                const platforms = ad.platforms || [];
                const platformIconsHTML = platforms.map(platform => {
                    return createPlatformIcon(platform); // Use helper
                }).join(' ');

                // --- New Header Structure ---
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
                        openImageModal(img.src);
                    });
                });

                // Video click listener
                li.querySelectorAll('.ad-video').forEach(video => {
                    video.addEventListener('click', (event) => {
                         const rect = video.getBoundingClientRect();
                         const clickY = event.clientY;
                         const controlsHeight = 30; 
                         const videoAreaBottom = rect.bottom;

                         if (clickY < videoAreaBottom - controlsHeight) {
                             event.preventDefault();
                             event.stopPropagation();
                             const videoSrc = video.querySelector('source')?.src;
                             const posterUrl = video.getAttribute('poster');

                             // PAUSE the original video before opening modal
                             video.pause();

                            if (videoSrc) {
                                openVideoModal(videoSrc, posterUrl);
                            } else {
                                 console.warn('Video clicked, but no source found to play in modal.');
                            }
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
                    const carouselElement = li.querySelector(`#carousel-${adIndex}`);
                    if (carouselElement) {
                        setupCarousel(carouselElement);
                    }
                }
            });
        } else {
            adsListUl.innerHTML = '<li>No active ads found for this page.</li>';
        }
    } else {
        // Page not found case
        pageInfoDiv.innerHTML = `<div class="page-info-block"><p>Facebook page not found for "${results.searchedTerm || 'the given links'}".</p></div>`;
        adsListUl.innerHTML = '<li>Cannot fetch ads as the page was not found.</li>';
    }
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

// --- NEW: EU Modal close listeners/functions ---
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