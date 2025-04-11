const analyzeBtn = document.getElementById('analyzeBtn');
const statusDiv = document.getElementById('status');
const resultsDiv = document.getElementById('results');
const pageInfoDiv = document.getElementById('pageInfo');
const adsListUl = document.getElementById('adsList');

// Modal elements
const modal = document.getElementById("imageModal");
const modalImg = document.getElementById("modalImage");
const closeModal = document.querySelector(".modal-close");

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

// Function to open modal
function openImageModal(src) {
    if (modal && modalImg) {
        modal.style.display = "block";
        modalImg.src = src;
    }
}

function displayResults(results) {
    resultsDiv.style.display = 'block';
    pageInfoDiv.innerHTML = ''; // Clear previous info
    adsListUl.innerHTML = ''; // Clear previous ads

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

        if (results.ads && results.ads.length > 0) {
            adsListUl.innerHTML = ''; // Clear only once before loop
            results.ads.forEach((ad, adIndex) => {
                const li = document.createElement('li');
                li.setAttribute('data-ad-index', adIndex); // Add index for potential future use

                let adHTML = `
                    <div><strong>Ad ID:</strong> <a href="https://www.facebook.com/ads/library/?id=${ad.id}" target="_blank">${ad.id}</a></div>
                    <div><strong>Display Format:</strong> ${ad.display_format || 'N/A'}</div>
                `;

                // --- Display Creatives ---
                if (ad.creatives && ad.creatives.length > 0) {
                    // Use first creative for representative text elements
                    const firstCreative = ad.creatives[0];
                    adHTML += `
                        ${firstCreative.headline ? `<div><strong>Headline:</strong> ${firstCreative.headline}</div>` : ''}
                        ${firstCreative.body ? `<div><strong>Body:</strong> ${firstCreative.body.substring(0, 200)}${firstCreative.body.length > 200 ? '...' : ''}</div>` : ''}
                        ${firstCreative.caption ? `<div><strong>Caption:</strong> ${firstCreative.caption}</div>` : ''}
                        ${firstCreative.cta_text ? `<div><strong>CTA:</strong> ${firstCreative.cta_text} ${firstCreative.cta_type ? `(${firstCreative.cta_type})` : ''}</div>` : ''}
                        ${firstCreative.link_url ? `<div><strong>Link:</strong> <a href="${firstCreative.link_url}" target="_blank">${firstCreative.link_url}</a></div>` : ''}
                    `;

                    // Media Container
                    adHTML += `<div class="ad-media-container">`;

                    if (ad.creatives.length === 1) {
                        // Single Creative
                        const creative = ad.creatives[0];
                        if (creative.is_video) {
                            // Add ad-video-wrapper class
                            adHTML += `
                                <div class="video-wrapper ad-video-wrapper">
                                    <video controls poster="${creative.image_url || ''}" style="max-width: 100%; max-height: 200px;">
                                        <source src="${creative.video_url}" type="video/mp4">
                                        Your browser does not support the video tag.
                                    </video>
                                </div>
                            `;
                        } else if (creative.image_url) {
                             // Add ad-image class for modal click
                             adHTML += `<img src="${creative.image_url}" alt="Ad Creative" class="ad-image" style="max-width: 100%; max-height: 200px; object-fit: contain;">`;
                        }
                    } else {
                        // Multiple Creatives - Carousel
                        adHTML += `
                            <div class="carousel" id="carousel-${adIndex}">
                                <button class="carousel-btn prev" disabled>&lt;</button>
                                <div class="slides-container">
                                    <div class="slides">
                                        ${ad.creatives.map((creative, index) => `
                                            <div class="slide ${index === 0 ? 'active' : ''}">
                                                ${creative.is_video
                                                    // Add ad-video-wrapper class
                                                    ? `<div class="video-wrapper ad-video-wrapper">
                                                           <video controls poster="${creative.image_url || ''}" style="max-width: 100%; max-height: 200px;">
                                                               <source src="${creative.video_url}" type="video/mp4">
                                                               Your browser does not support the video tag.
                                                           </video>
                                                       </div>`
                                                    : creative.image_url
                                                        // Add ad-image class for modal click
                                                        ? `<img src="${creative.image_url}" alt="Ad Creative ${index + 1}" class="ad-image" style="max-width: 100%; max-height: 200px; object-fit: contain;">`
                                                        : '<p>No media</p>'
                                                }
                                            </div>
                                        `).join('')}
                                    </div>
                                </div>
                                <button class="carousel-btn next">></button>
                                <div class="carousel-indicators">
                                     ${ad.creatives.map((_, index) => `<span class="indicator ${index === 0 ? 'active' : ''}" data-slide-index="${index}"></span>`).join('')}
                                 </div>
                            </div>
                        `;
                    }
                    adHTML += `</div>`; // Close media-container
                } else {
                    adHTML += `<p>No creative information available.</p>`;
                }

                // --- Common Ad Info Below Creatives ---
                adHTML += `
                    <div><strong>Platforms:</strong> ${ad.platforms?.join(', ') || 'N/A'}</div>
                    <div><strong>Start Date:</strong> ${ad.start_date ? new Date(ad.start_date * 1000).toLocaleDateString() : 'N/A'}</div>
                    <div><strong>End Date:</strong> ${ad.end_date ? new Date(ad.end_date * 1000).toLocaleDateString() : 'N/A'}</div>
                `;

                li.innerHTML = adHTML;
                adsListUl.appendChild(li);

                // --- Add Event Listeners AFTER appending li ---

                // Image Modal listeners
                li.querySelectorAll('.ad-image').forEach(img => {
                    img.addEventListener('click', () => {
                        openImageModal(img.src);
                    });
                });

                // Video Click-to-Play/Pause listeners
                li.querySelectorAll('.ad-video-wrapper').forEach(videoWrapper => {
                    const video = videoWrapper.querySelector('video');
                    if (video) {
                        // Click on wrapper toggles play/pause
                        videoWrapper.addEventListener('click', (event) => {
                            // Prevent click on controls from toggling state unintentionally
                            if (event.target === videoWrapper || event.target === video.poster) {
                                if (video.paused) {
                                    video.play();
                                } else {
                                    video.pause();
                                }
                            }
                        });

                        // Sync play icon overlay with video state
                        video.addEventListener('play', () => {
                            videoWrapper.classList.add('playing');
                        });
                        video.addEventListener('pause', () => {
                            videoWrapper.classList.remove('playing');
                        });
                        video.addEventListener('ended', () => {
                             videoWrapper.classList.remove('playing'); // Remove class when video ends
                        });
                    }
                });

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