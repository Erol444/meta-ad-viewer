const analyzeBtn = document.getElementById('analyzeBtn');
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

// Platform Icon Styles Mapping
const platformStyles = {
    FACEBOOK: 'mask-image: url(&quot;icons/fb_sprite.png&quot;); mask-size: 21px 515px; mask-position: 0px -424px;',
    INSTAGRAM: 'mask-image: url(&quot;icons/fb_sprite.png&quot;); mask-size: 21px 515px; mask-position: 0px -437px;',
    AUDIENCE_NETWORK: 'mask-image: url(&quot;icons/sprite-network.png&quot;); mask-size: 81px 236px; mask-position: -68px -189px;',
    MESSENGER: 'mask-image: url(&quot;icons/fb_sprite_others.png&quot;); mask-size: 441px 673px; mask-position: -355px -524px;'
    // Add other platforms here if needed
};

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
    }
});

analyzeBtn.addEventListener('click', () => {
    statusDiv.textContent = 'Analyzing...';
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
            statusDiv.textContent = 'Analysis complete.';
            displayResults(response.results);
        } else {
            // Clear potential stale page ID
            currentPageId = null;
            statusDiv.textContent = 'Received unexpected response from background script.';
            console.warn("Unexpected response:", response);
        }
    });
});

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

    // Display Searched Term first
    pageInfoDiv.innerHTML += `<p><strong>Searched For:</strong> ${results.searchedTerm || 'N/A'}</p>`;

    if (results.foundPage) {
        const page = results.foundPage;
        pageInfoDiv.innerHTML += `
            <p><strong>Found Page:</strong> <a href="https://facebook.com/${page.id}" target="_blank">${page.name}</a> (ID: ${page.id})</p>
            <p><strong>Category:</strong> ${page.category || 'N/A'}</p>
            <p><strong>Likes:</strong> ${page.likes?.toLocaleString() || 'N/A'}</p>
            <p><strong>Verified:</strong> ${page.verification || 'N/A'}</p>
            ${page.ig_username ? `<p><strong>Instagram:</strong> <a href="https://instagram.com/${page.ig_username}" target="_blank">@${page.ig_username}</a> (${page.ig_followers?.toLocaleString() || 'N/A'} followers)</p>` : ''}
        `;
        // Store page ID when displaying page info
        currentPageId = page.id;

        if (results.ads && results.ads.length > 0) {
            adsListUl.innerHTML = ''; // Clear only once before loop
            results.ads.forEach((ad, adIndex) => {
                const li = document.createElement('li');
                li.setAttribute('data-ad-index', adIndex);

                // --- Platform Icons --- (Prepare first)
                const platforms = ad.platforms || [];
                const platformIconsHTML = platforms.map(platform => {
                    const style = platformStyles[platform];
                    if (style) {
                        return `<span class="platform-icon" style="${style}" title="${platform}"></span>`;
                    } else {
                        return `<span class="platform-fallback" title="${platform}">${platform.substring(0, 2)}</span>`;
                    }
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
                            ${ad.is_aaa_eligible ? `<button class="transparency-btn" data-ad-id="${ad.id}">EU 🇪🇺 transparency</button>` : ''}
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
                            // Optionally show a loading state on the button or near it
                            transparencyBtn.textContent = 'Loading...';
                            transparencyBtn.disabled = true;
                            console.log(`Requesting details for Ad ID: ${adId}, Page ID: ${currentPageId}`);
                            chrome.runtime.sendMessage(
                                { action: "getAdDetails", data: { adId: adId, pageId: currentPageId } },
                                (response) => {
                                    // Reset button state
                                    transparencyBtn.textContent = 'EU 🇪🇺 transparency';
                                    transparencyBtn.disabled = false;
                                    if (chrome.runtime.lastError) {
                                        console.error('Error fetching ad details:', chrome.runtime.lastError.message);
                                        // Display error message near the button or in a status area
                                        displayAdDetailsError(li, `Error: ${chrome.runtime.lastError.message}`);
                                    } else if (response.error) {
                                        console.error('Error from background fetching details:', response.error);
                                        displayAdDetailsError(li, `Error: ${response.error}`);
                                    } else if (response.details) {
                                        console.log('Received ad details:', response.details);
                                        displayAdDetails(li, response.details);
                                    } else {
                                        console.warn('Unexpected response for ad details:', response);
                                        displayAdDetailsError(li, 'Unexpected response from server.');
                                    }
                                }
                            );
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
        pageInfoDiv.innerHTML += `<p>Facebook page not found.</p>`;
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

// --- NEW: Functions to Display Ad Details / Errors ---
function displayAdDetails(listItemElement, details) {
    // Clear previous details/errors first
    let detailsDiv = listItemElement.querySelector('.ad-details-display');
    if (detailsDiv) {
        detailsDiv.remove();
    }

    detailsDiv = document.createElement('div');
    detailsDiv.className = 'ad-details-display'; // Add a class for styling

    // Simple display for now, can be enhanced
    detailsDiv.innerHTML = `
        <h4>Targeting Info:</h4>
        <p><strong>Locations:</strong> ${details.locations?.join(', ') || 'N/A'}</p>
        <p><strong>Excluded Locations:</strong> ${details.excluded_locations?.join(', ') || 'N/A'}</p>
        <p><strong>Gender:</strong> ${details.gender || 'N/A'}</p>
        <p><strong>Age Range:</strong> ${details.age_range?.min ?? 'N/A'} - ${details.age_range?.max ?? 'N/A'}</p>
        <p><strong>EU Reach:</strong> ${details.eu_total_reach?.toLocaleString() || 'N/A'}</p>
        <!-- Add more details as needed -->
    `;

    // Insert the details section after the main ad content (e.g., after media/CTA)
    const ctaArea = listItemElement.querySelector('.ad-cta-area');
    if (ctaArea) {
        listItemElement.insertBefore(detailsDiv, ctaArea.nextSibling);
    } else {
        listItemElement.appendChild(detailsDiv); // Fallback append
    }
}

function displayAdDetailsError(listItemElement, errorMessage) {
    // Clear previous details/errors first
    let errorDiv = listItemElement.querySelector('.ad-details-display.error');
    if (errorDiv) {
        errorDiv.remove();
    }

    errorDiv = document.createElement('div');
    errorDiv.className = 'ad-details-display error'; // Add error class
    errorDiv.textContent = errorMessage;

     // Insert the error section similarly to the details section
    const ctaArea = listItemElement.querySelector('.ad-cta-area');
    if (ctaArea) {
        listItemElement.insertBefore(errorDiv, ctaArea.nextSibling);
    } else {
        listItemElement.appendChild(errorDiv); // Fallback append
    }
}
// --- END NEW ---