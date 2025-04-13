// Define data structures similar to Python's dataclasses

class Creative {
    constructor({ headline = null, body = null, caption = null, cta_text = null, cta_type = null, link_url = null, image_url = null, video_url = null }) {
        this.headline = headline; // Corresponds to snapshot.title ?
        this.body = body;         // Corresponds to snapshot.body.text ?
        this.caption = caption;   // Corresponds to snapshot.caption ?
        this.cta_text = cta_text;
        this.cta_type = cta_type;
        this.link_url = link_url;
        this.image_url = image_url; // Could be image or video thumbnail
        this.video_url = video_url; // If available
    }
}

class FacebookPage {
    constructor({
        id, category, entity_type, image_uri, likes, name, page_alias,
        page_is_deleted, country = null, ig_username = null, ig_followers = null,
        ig_verification = null, verification = null, fetch_time = null
    }) {
        this.id = id;
        this.category = category;
        this.entity_type = entity_type;
        this.image_uri = image_uri;
        this.likes = likes;
        this.name = name;
        this.page_alias = page_alias;
        this.page_is_deleted = page_is_deleted;
        this.country = country;
        this.ig_username = ig_username;
        this.ig_followers = ig_followers;
        this.ig_verification = ig_verification;
        this.verification = verification;
        this.fetch_time = fetch_time || new Date().toISOString();
    }
}

class FacebookAd {
    constructor({
        id, page_id, page_name,
        // Removed creative fields: title, body, caption, cta_text, cta_type, link_url, image_url
        display_format = null, // Added: 'IMAGE', 'VIDEO', 'DCO', 'DPA', etc.
        creatives = [],       // Added: Array of Creative objects
        platforms = null, start_date = null, end_date = null, fetch_time = null,
        is_aaa_eligible = null
    }) {
        this.id = id;
        this.page_id = page_id;
        this.page_name = page_name;
        this.display_format = display_format;
        this.creatives = creatives;
        this.platforms = platforms;
        this.start_date = start_date;
        this.end_date = end_date;
        this.fetch_time = fetch_time || new Date().toISOString();
        this.is_aaa_eligible = is_aaa_eligible;
    }
}

class TargetingInfo {
    constructor({
        locations, excluded_locations, gender, age_range, eu_total_reach = null,
        demographic_breakdown = []
    }) {
        this.locations = locations;
        this.excluded_locations = excluded_locations;
        this.gender = gender;
        this.age_range = age_range; // { min: number | null, max: number | null }
        this.eu_total_reach = eu_total_reach;
        this.demographic_breakdown = demographic_breakdown;
    }
}

class AdInfo {
    constructor({
        archive_id, page_id, spend = null, is_political, targeting,
        payer_beneficiary = [], is_taken_down, has_violations
    }) {
        this.archive_id = archive_id;
        this.page_id = page_id;
        this.spend = spend;
        this.is_political = is_political;
        this.targeting = targeting; // Instance of TargetingInfo
        this.payer_beneficiary = payer_beneficiary;
        this.is_taken_down = is_taken_down;
        this.has_violations = has_violations;
    }
}

class PageInfo {
     constructor({
        name, category, about = null, verification, profile_url = null, likes
    }) {
        this.name = name;
        this.category = category;
        this.about = about;
        this.verification = verification;
        this.profile_url = profile_url;
        this.likes = likes;
    }
}


class AdDetails {
     constructor({ ad, page, fetch_time = null }) {
        this.ad = ad; // Instance of AdInfo
        this.page = page; // Instance of PageInfo (Note: Python code didn't actually populate PageInfo in get_ad_details)
        this.fetch_time = fetch_time || new Date().toISOString();
    }
}


class FacebookScraper {
    constructor() {
        // GraphQL doc_ids
        this.doc_ids = {
            page_search: '9333890689970605',
            page_ads: '8539922039449935',
            ad_details: '9407590475934210' // Added from get_ad_details
        };

        // Default cookies - In a browser context, fetch might handle these automatically if credentials: 'include' is used,
        // or they might need careful setting depending on the extension's permissions and context.
        // These specific values are likely tied to a user session and might need to be obtained dynamically.
        // Hardcoding them like this might not work reliably.
        this.cookies = {
            datr: '4SxPZUh5ui2ibThObJTg7Gfk', // Example, likely needs dynamic update
            c_user: '100001401300300', // Example, likely needs dynamic update
            // ... other cookies from Python code ...
            xs: '16:Ml14BMs_UQ3cjg:2:1699733852:-1:13648::AcX5IqEhPKWT3rrzLrJPdrbhy8FaZOiJrDdIWgzqR7C4vA' // Example, likely needs dynamic update
        };

        // Request parameters extracted from page source
        this.fb_dtsg = null;
        this.client_revision = null;
        this.lsd = null;
        this.hsi = null;
        this.spin_r = null;
        this.spin_b = null;

        this._req_counter = 0; // For generating __req parameter

        // Headers - mimicking the Python script's headers
        this.headers = {
            'accept': '*/*',
            'accept-language': 'en-US,en;q=0.9',
            'content-type': 'application/x-www-form-urlencoded',
            'origin': 'https://www.facebook.com',
            'referer': 'https://www.facebook.com/ads/library/',
            'sec-ch-prefers-color-scheme': 'dark',
            'sec-ch-ua': '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"', // Adjust if necessary
            'sec-ch-ua-mobile': '?0',
            'sec-ch-ua-platform': '"macOS"', // Adjust if necessary
            'sec-fetch-dest': 'empty',
            'sec-fetch-mode': 'cors',
            'sec-fetch-site': 'same-origin',
            'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36', // Adjust if necessary
            'x-asbd-id': '129477',
            // x-fb-lsd will be added dynamically
        };
    }

    // Method to initialize the scraper by fetching page params
    async init() {
        console.info("Initializing scraper, extracting page parameters...");
        const success = await this._extractPageParams();
        if (!success) {
            console.error("Failed to extract necessary parameters from Ad Library page. Scraping might fail.");
            // Decide how to handle failure - throw error? proceed cautiously?
        } else {
            console.info("Successfully extracted page parameters.");
        }
        // Potentially add logic here to get/verify cookies if needed, e.g., using chrome.cookies API
    }


    async _extractPageParams() {
        console.info("Fetching Ad Library page to extract parameters...");
        try {
            const response = await fetch('https://www.facebook.com/ads/library/', {
                method: 'GET',
                headers: {
                    // Use a subset of headers for the initial fetch, mimicking a browser request
                    'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
                    'accept-language': this.headers['accept-language'],
                    'sec-ch-ua': this.headers['sec-ch-ua'],
                    'sec-ch-ua-mobile': this.headers['sec-ch-ua-mobile'],
                    'sec-ch-ua-platform': this.headers['sec-ch-ua-platform'],
                    'sec-fetch-dest': 'document',
                    'sec-fetch-mode': 'navigate',
                    'sec-fetch-site': 'same-origin', // Adjust if needed, e.g., 'none' if first visit
                    'sec-fetch-user': '?1',
                    'upgrade-insecure-requests': '1',
                    'user-agent': this.headers['user-agent'],
                },
                credentials: 'omit' // Explicitly omit cookies
            });

            if (!response.ok) {
                console.error(`Failed to fetch Ad Library page: ${response.status} ${response.statusText}`);
                return false;
            }

            const pageContent = await response.text();

            // Extract fb_dtsg token
            const fb_dtsg_match = pageContent.match(/name="fb_dtsg" value="([^"]+)"/);
            if (fb_dtsg_match) {
                this.fb_dtsg = fb_dtsg_match[1];
                console.info(`Found fb_dtsg token: ${this.fb_dtsg}`);
            } else console.warn("Could not find fb_dtsg token.");

            // Extract client revision
            const rev_match = pageContent.match(/"client_revision":(\d+),/);
            if (rev_match) {
                this.client_revision = rev_match[1];
                console.info(`Found client revision: ${this.client_revision}`);
            } else console.warn("Could not find client_revision.");

            // Extract LSD token
            const lsd_match = pageContent.match(/"LSD",\[\],\{"token":"([^"]+)"/);
            if (lsd_match) {
                this.lsd = lsd_match[1];
                console.info(`Found LSD token: ${this.lsd}`);
            } else console.warn("Could not find LSD token.");

            // Extract haste session
            const hsi_match = pageContent.match(/"haste_session":"([^"]+)"/);
            if (hsi_match) {
                this.hsi = hsi_match[1];
                console.info(`Found haste session: ${this.hsi}`);
            } else console.warn("Could not find haste_session (hsi).");

            // Extract spin parameters
            const spin_r_match = pageContent.match(/"__spin_r":(\d+),/);
            if (spin_r_match) {
                this.spin_r = spin_r_match[1];
                console.info(`Found spin_r: ${this.spin_r}`);
            } else console.warn("Could not find spin_r.");

            const spin_b_match = pageContent.match(/"__spin_b":"([^"]+)"/);
            if (spin_b_match) {
                this.spin_b = spin_b_match[1];
                console.info(`Found spin_b: ${this.spin_b}`);
            } else console.warn("Could not find spin_b.");

            // Check if essential params were found
            // return !!(this.fb_dtsg && this.lsd && this.client_revision);
            return true;

        } catch (error) {
            console.error(`Error extracting page parameters: ${error}`);
            return false;
        }
    }


    _parseResponse(responseText) {
        try {
            // Remove potential "for (;;);" prefix
            if (responseText.startsWith('for (;;);')) {
                responseText = responseText.substring(9);
            }
            return JSON.parse(responseText);
        } catch (e) {
            console.error(`Failed to parse JSON response: ${e}`);
            console.error("Response Text:", responseText.substring(0, 500) + "..."); // Log beginning of text
            return null; // Return null instead of {} to indicate failure more clearly
        }
    }

     _getNextReqId() {
        this._req_counter++;
        // Simple rotating counter a-z (like Python code)
        // More robust implementations might use base 36 or similar if collisions are a concern
        const baseCharCode = 'a'.charCodeAt(0);
        return String.fromCharCode(baseCharCode + (this._req_counter % 26));
     }

     _generateSessionString() {
        // Generates a random hex string, similar to Python's ::{random_hex}
        const randomHex = Math.floor(Math.random() * (2**32)).toString(16).padStart(8, '0');
        return `::${randomHex}`;
     }

     _generateCsr() {
         // Generates a 32-character random alphanumeric string
         const chars = '0123456789abcdefghijklmnopqrstuvwxyz';
         let result = '';
         for (let i = 0; i < 32; i++) {
             result += chars.charAt(Math.floor(Math.random() * chars.length));
         }
         return result;
     }

     _generateJazoest() {
         // Replicates the simple checksum algorithm from Python
         if (!this.fb_dtsg) return "25730"; // Default if fb_dtsg is missing
         let sum = 0;
         for (let i = 0; i < this.fb_dtsg.length; i++) {
             sum += this.fb_dtsg.charCodeAt(i);
         }
         return "2" + sum.toString();
     }


    _getRequestParams() {
        // Generate base parameters for a GraphQL request
        if (!this.lsd || !this.client_revision || !this.fb_dtsg || !this.spin_r || !this.spin_b || !this.hsi) {
            console.warn("One or more required parameters (lsd, client_revision, fb_dtsg, spin_r, spin_b, hsi) are missing. Request might fail.");
            // Handle this case - perhaps throw an error or return a special value
            // For now, proceed but expect potential failure
        }

        const params = {
            'av': '0', // Assuming these are static or default like in Python
            '__aaid': '0',
            '__user': '0', // May need dynamic user ID if logged in state is required
            '__a': '1',
            '__req': this._getNextReqId(),
            '__hs': this.hsi || '', // Use extracted hsi
            'dpr': '2', // Use browser's DPR
            '__ccg': 'EXCELLENT', // Connection quality, might be dynamic
            '__rev': this.client_revision || '', // Use extracted revision
            '__s': this._generateSessionString(),
            '__hsi': this.hsi || (Date.now() * 1000).toString(), // Use extracted hsi or fallback
            // Example __dyn value - This is complex and might change frequently.
            // Hardcoding is brittle. Ideally, it should be extracted or generated if possible.
            '__dyn': '7xeUmwlECdwn8K2Wmh0no6u5U4e1Fx-ewSAwHwNw9G2S2q0_EtxG4o0B-qbwgE1EEb87C1xwEwgo9oO0n24oaEd86a3a1YwBgao6C0Mo6i588Etw8WfK1LwPxe2GewbCXwJwmEtwse5o4q0HU1IEGdw46wbLwrU6C2-0VE6O1Fw59G2O1TwmUaE2Two8',
            '__csr': this._generateCsr(),
            '__comet_req': '5', // Value seen in some requests, Python had '1'
            'lsd': this.lsd || '', // Use extracted lsd
            'jazoest': this._generateJazoest(),
            '__spin_r': this.spin_r || '', // Use extracted spin_r
            '__spin_b': this.spin_b || '', // Use extracted spin_b
            '__spin_t': Math.floor(Date.now() / 1000).toString(), // Current timestamp in seconds
             'fb_dtsg': this.fb_dtsg || '', // Use extracted fb_dtsg - NOTE: Python code commented this out, check if needed
        };

        // Remove fb_dtsg if it was intentionally omitted in python version
        // delete params.fb_dtsg; 

        return new URLSearchParams(params); // URLSearchParams handles encoding
    }

    async searchPages(query) {
        const url = "https://www.facebook.com/api/graphql/";
        const friendlyName = 'useAdLibraryTypeaheadSuggestionDataSourceQuery';

        const variables = {
            queryString: query,
            isMobile: false,
            country: "ALL",
            adType: "ALL"
        };

        const baseParams = this._getRequestParams();
        baseParams.set('fb_api_caller_class', 'RelayModern');
        baseParams.set('fb_api_req_friendly_name', friendlyName);
        baseParams.set('variables', JSON.stringify(variables));
        baseParams.set('server_timestamps', 'true');
        baseParams.set('doc_id', this.doc_ids.page_search);

        const requestOptions = {
            method: 'POST',
            headers: {
                 ...this.headers, // Base headers
                'x-fb-friendly-name': friendlyName,
                'x-fb-lsd': this.lsd || '' // Add LSD header
                // Content-Type is set by URLSearchParams/fetch
            },
            body: baseParams,
             credentials: 'omit' // Explicitly omit cookies
        };

        try {
            console.info(`Searching pages for query: ${query}`);
            const response = await fetch(url, requestOptions);

            if (!response.ok) {
                console.error(`Page search failed: ${response.status} ${response.statusText}`);
                 console.error("Response Body:", await response.text()); // Log error response
                return [];
            }

            const responseText = await response.text();

            console.log(responseText);
            const data = this._parseResponse(responseText);

             if (!data || !data.data) {
                 console.error("Failed to parse page search response or data is missing.");
                 // console.log("Raw response text for debugging:", responseText); // Uncomment for deep debug
                 return [];
             }

            // Log the raw data for inspection (similar to writing to file)
            console.log("Raw page search data:", JSON.stringify(data, null, 2));


            const pages = [];
            const pageResults = data?.data?.ad_library_main?.typeahead_suggestions?.page_results || [];

            for (const result of pageResults) {
                const page = new FacebookPage({
                    id: result?.page_id,
                    name: result?.name,
                    verification: result?.verification,
                    category: result?.category,
                    entity_type: result?.entity_type,
                    ig_username: result?.ig_username,
                    ig_followers: result?.ig_followers,
                    ig_verification: result?.ig_verification,
                    image_uri: result?.image_uri,
                    likes: result?.likes,
                    page_alias: result?.page_alias,
                    page_is_deleted: result?.page_is_deleted,
                    country: result?.country
                });
                if (page.id) { // Only add if we got a valid ID
                    pages.push(page);
                }
            }

            console.info(`Found ${pages.length} pages for query: ${query}`);
            return pages;

        } catch (error) {
            console.error(`Error searching pages: ${error}`);
            return [];
        }
    }

    async getPageAds(pageId, cursor = null) {
        const url = "https://www.facebook.com/api/graphql/";
        const friendlyName = 'AdLibrarySearchPaginationQuery';

        const variables = {
            activeStatus: "ACTIVE", // or INACTIVE or ALL
            adType: "ALL", // 
            bylines: [],
            collationToken: crypto.randomUUID(), // Use browser's crypto API
            contentLanguages: [],
            countries: ["ALL"],
            cursor: cursor, // Use the provided cursor
            excludedIDs: [],
            first: 30, // Keep fetching 30 at a time
            isTargetedCountry: false,
            location: null,
            mediaType: "all", // or IMAGE, MEME (img with text), VIDEO
            multiCountryFilterMode: null,
            pageIDs: [],
            potentialReachInput: null,
            publisherPlatforms: [], // multiselect: FACEBOOK, INSTAGRAM,AUDIENCE_NETWORK,MESSENGER,THREADS
            queryString: "",
            regions: null,
            searchType: "page",
            sessionID: crypto.randomUUID(),
            sortData: null,
            source: null, // Or specific source like 'vast' if known
            startDate: null,
            // v: "96184a", // This might be a version parameter, potentially dynamic
            viewAllPageID: pageId
        };

        const baseParams = this._getRequestParams();
        baseParams.set('fb_api_caller_class', 'RelayModern');
        baseParams.set('fb_api_req_friendly_name', friendlyName);
        baseParams.set('variables', JSON.stringify(variables));
        baseParams.set('server_timestamps', 'true');
        baseParams.set('doc_id', this.doc_ids.page_ads);

        const requestOptions = {
            method: 'POST',
            headers: {
                 ...this.headers,
                'x-fb-friendly-name': friendlyName,
                'x-fb-lsd': this.lsd || ''
            },
            body: baseParams,
             credentials: 'omit' // Explicitly omit cookies
        };

        try {
            console.info(`Fetching ads for page ID: ${pageId}`);
            const response = await fetch(url, requestOptions);

            
            if (!response.ok) {
                console.error(`Get page ads failed: ${response.status} ${response.statusText}`);
                console.error("Response Body:", await response.text());
                return [];
            }
            
            const responseText = await response.text();
            console.log(responseText);
            const data = this._parseResponse(responseText);

            if (!data || !data.data) {
                 console.error("Failed to parse page ads response or data is missing.");
                 // console.log("Raw response text for debugging:", responseText);
                 return [];
             }

            const page_info = data?.data?.ad_library_main?.search_results_connection?.page_info || { end_cursor: null, has_next_page: false };
            const ads = [];
            const edges = data?.data?.ad_library_main?.search_results_connection?.edges || [];

            for (const edge of edges) {
                const node = edge?.node;
                const collated_results = node?.collated_results || [];

                if (collated_results.length === 0) continue;
                const result = collated_results[0];

                const ad_archive_id = result?.ad_archive_id;
                if (!ad_archive_id) continue;

                const snapshot = result?.snapshot || {};
                const display_format = snapshot?.display_format;
                const creatives = [];

                // Helper function to parse body text
                const getBodyText = (body) => {
                    if (typeof body === 'object' && body !== null && 'text' in body) {
                        return body.text;
                    } else if (typeof body === 'string') {
                        return body;
                    }
                    return null;
                };

                // --- Creative Extraction Logic based on display_format ---

                // Category 1: DCO, DPA, CAROUSEL (Distinct creatives per card)
                if (['DCO', 'DPA', 'CAROUSEL'].includes(display_format)) {
                    const cards = snapshot.cards || [];
                    console.info(`Ad ID ${ad_archive_id}: Handling format '${display_format}' with ${cards.length} cards.`);
                    if (cards.length > 0) {
                        for (const card of cards) {
                            creatives.push(new Creative({
                                // Use card-specific elements
                                headline: card.title,
                                body: getBodyText(card.body),
                                caption: card.caption || card.link_description,
                                cta_text: card.cta_text,
                                cta_type: card.cta_type,
                                link_url: card.link_url,
                                image_url: card.original_image_url || card.resized_image_url  || card.video_preview_image_url || null,
                                video_url: card.video_hd_url || card.video_sd_url  || null
                            }));
                        }
                    } else {
                        console.warn(`Ad ID ${ad_archive_id}: Format '${display_format}', but no cards found.`);
                    }
                }
                // Category 2: MULTI_IMAGES, MULTI_VIDEOS, MULTI_MEDIAS (Shared text, multiple media)
                else if (['MULTI_IMAGES', 'MULTI_VIDEOS', 'MULTI_MEDIAS'].includes(display_format)) {
                     console.info(`Ad ID ${ad_archive_id}: Handling format '${display_format}' with shared text.`);
                    // Use common text elements from top-level snapshot
                     const commonHeadline = snapshot?.title;
                     const commonBody = getBodyText(snapshot?.body);
                     const commonCaption = snapshot?.caption;
                     const commonCtaText = snapshot?.cta_text;
                     const commonCtaType = snapshot?.cta_type;
                     const commonLinkUrl = snapshot?.link_url;
                     let mediaFound = false;

                     // Handle Images (for MULTI_IMAGES and MULTI_MEDIAS)
                     if (['MULTI_IMAGES', 'MULTI_MEDIAS'].includes(display_format)) {
                        const images = snapshot?.images || [];
                         if (images.length > 0) {
                             mediaFound = true;
                             console.info(`Ad ID ${ad_archive_id}: Found ${images.length} images.`);
                            for (const imageData of images) {
                                creatives.push(new Creative({
                                    headline: commonHeadline,
                                    body: commonBody,
                                    caption: commonCaption,
                                    cta_text: commonCtaText,
                                    cta_type: commonCtaType,
                                    link_url: commonLinkUrl,
                                    image_url: imageData.resized_image_url || imageData.original_image_url || null,
                                    video_url: null
                                }));
                            }
                         }
                     }

                     // Handle Videos (for MULTI_VIDEOS and MULTI_MEDIAS)
                      if (['MULTI_VIDEOS', 'MULTI_MEDIAS'].includes(display_format)) {
                        const videos = snapshot?.videos || [];
                          if (videos.length > 0) {
                             mediaFound = true;
                             console.info(`Ad ID ${ad_archive_id}: Found ${videos.length} videos.`);
                            for (const videoData of videos) {
                                 creatives.push(new Creative({
                                    headline: commonHeadline,
                                    body: commonBody,
                                    caption: commonCaption,
                                    cta_text: commonCtaText,
                                    cta_type: commonCtaType,
                                    link_url: commonLinkUrl,
                                    image_url: videoData.video_preview_image_url || null, // Use preview image
                                    video_url: videoData.video_sd_url || videoData.video_hd_url || null
                                }));
                            }
                          }
                      }

                      if (!mediaFound) {
                          console.warn(`Ad ID ${ad_archive_id}: Format '${display_format}', but no images or videos found.`);
                      }
                }
                // Category 3: IMAGE, VIDEO (Single media, shared text)
                else if (display_format === 'IMAGE' || display_format === 'VIDEO') {
                     console.info(`Ad ID ${ad_archive_id}: Handling format '${display_format}' with single media.`);
                     // Use common text elements from top-level snapshot
                     const commonHeadline = snapshot?.title;
                     const commonBody = getBodyText(snapshot?.body);
                     const commonCaption = snapshot?.caption;
                     const commonCtaText = snapshot?.cta_text;
                     const commonCtaType = snapshot?.cta_type;
                     const commonLinkUrl = snapshot?.link_url;
                     let imageUrl = null;
                     let videoUrl = null;
                     let mediaFound = false;

                    if (display_format === 'IMAGE') {
                        const images = snapshot?.images || [];
                        if (images.length > 0) {
                            const imageData = images[0];
                            imageUrl = imageData.resized_image_url || imageData.original_image_url || null;
                            console.info(`Ad ID ${ad_archive_id}: Extracted single image data.`);
                            mediaFound = true;
                        } else {
                            // Fallback to top-level image_url if images array is empty/missing
                            imageUrl = snapshot?.image_url || null;
                            if (imageUrl) {
                                console.warn(`Ad ID ${ad_archive_id}: IMAGE format, no images array. Using top-level image_url.`);
                                mediaFound = true;
                            } else {
                                console.warn(`Ad ID ${ad_archive_id}: IMAGE format, but no image data found.`);
                            }
                        }
                    } else { // display_format === 'VIDEO'
                        const videos = snapshot?.videos || [];
                        if (videos.length > 0) {
                            const videoData = videos[0];
                            videoUrl = videoData.video_sd_url || videoData.video_hd_url || null;
                            imageUrl = videoData.video_preview_image_url || null; // Use preview image
                            console.info(`Ad ID ${ad_archive_id}: Extracted video data.`);
                            mediaFound = true;
                        } else {
                            console.warn(`Ad ID ${ad_archive_id}: VIDEO format, but no video data found.`);
                        }
                    }

                     if (mediaFound) {
                        creatives.push(new Creative({
                            headline: commonHeadline,
                            body: commonBody,
                            caption: commonCaption,
                            cta_text: commonCtaText,
                            cta_type: commonCtaType,
                            link_url: commonLinkUrl,
                            image_url: imageUrl,
                            video_url: videoUrl
                        }));
                     } else {
                         // If no media found even for IMAGE/VIDEO, still add placeholder with text
                         console.warn(`Ad ID ${ad_archive_id}: No media found for ${display_format}, adding text-only creative.`);
                          creatives.push(new Creative({
                            headline: commonHeadline,
                            body: commonBody,
                            caption: commonCaption,
                            cta_text: commonCtaText,
                            cta_type: commonCtaType,
                            link_url: commonLinkUrl
                        }));
                     }
                }
                // Fallback for Unknown Formats
                else {
                    console.warn(`Ad ID ${ad_archive_id}: Unknown or unhandled display_format '${display_format}'. Attempting basic creative extraction.`);
                    // Use common text elements as fallback
                    const commonHeadline = snapshot?.title;
                    const commonBody = getBodyText(snapshot?.body);
                    const commonCaption = snapshot?.caption;
                    const commonCtaText = snapshot?.cta_text;
                    const commonCtaType = snapshot?.cta_type;
                    const commonLinkUrl = snapshot?.link_url;
                    creatives.push(new Creative({
                       headline: commonHeadline,
                       body: commonBody,
                       caption: commonCaption,
                       cta_text: commonCtaText,
                       cta_type: commonCtaType,
                       link_url: commonLinkUrl,
                       image_url: snapshot?.image_url || null, // Best guess media
                       video_url: snapshot?.video_url || null
                   }));
                }

                // --- End Creative Extraction ---

                // Ensure at least one creative exists, even if just text (handled within IMAGE/VIDEO block now)
                if (creatives.length === 0 && !['DCO', 'DPA', 'CAROUSEL', 'MULTI_IMAGES', 'MULTI_VIDEOS', 'MULTI_MEDIAS', 'IMAGE', 'VIDEO'].includes(display_format)) {
                    // This case should only be hit by unknown formats where the fallback extraction failed
                    console.error(`Ad ID ${ad_archive_id}: CRITICAL - Failed to extract any creatives for unknown format '${display_format}'. Snapshot:`, snapshot);
                    // Consider adding a minimal placeholder if absolutely necessary
                    // creatives.push(new Creative({ headline: 'Error extracting creative' }));
                }
                else if (creatives.length === 0) {
                     // This case handles formats where media arrays might be empty
                     console.warn(`Ad ID ${ad_archive_id}: No creatives extracted for format '${display_format}', check warnings. Snapshot:`, snapshot);
                     // Potentially add a placeholder with common text if desired, but category 3 handles this.
                }


                ads.push(new FacebookAd({
                    id: ad_archive_id,
                    page_id: result?.page_id,
                    page_name: result?.page_name,
                    display_format: display_format,
                    creatives: creatives,
                    is_aaa_eligible: result?.is_aaa_eligible,
                    platforms: result?.publisher_platform,
                    start_date: result?.start_date,
                    end_date: result?.end_date,
                }));
            }
            console.info(`Found ${ads.length} ad snapshots for page ID: ${pageId}` + (cursor ? ` (Cursor: ${cursor})` : '(Initial fetch)') + `. Has next page: ${page_info.has_next_page}`);
            // Return ads and pagination info
            return {
                ads: ads,
                page_info: {
                    end_cursor: page_info.end_cursor,
                    has_next_page: page_info.has_next_page
                }
            };

        } catch (error) {
            console.error(`Error getting page ads: ${error}`);
            // Return structure indicating error or empty state
            return { ads: [], page_info: { end_cursor: null, has_next_page: false } };
        }
    }

    async getAdDetails(adArchiveId, pageId) {
        const url = "https://www.facebook.com/api/graphql/";
        const friendlyName = 'AdLibraryAdDetailsV2Query';

        const variables = {
            adArchiveID: adArchiveId,
            pageID: pageId,
            country: "ALL", // Or a specific country if needed
            sessionID: crypto.randomUUID(),
            source: null, // Or specific source
            isAdNonPolitical: true, // Based on Python code defaults
            isAdNotAAAEligible: false, // Based on Python code defaults
            // "__relay_internal__pv__AdLibraryFinservGraphQLGKrelayprovider": true // Check if this Relay provider key is necessary/valid
        };

        const baseParams = this._getRequestParams();
        baseParams.set('fb_api_caller_class', 'RelayModern');
        baseParams.set('fb_api_req_friendly_name', friendlyName);
        baseParams.set('variables', JSON.stringify(variables));
        baseParams.set('server_timestamps', 'true');
        baseParams.set('doc_id', this.doc_ids.ad_details);


        const requestOptions = {
            method: 'POST',
            headers: {
                 ...this.headers,
                'x-fb-friendly-name': friendlyName,
                'x-fb-lsd': this.lsd || ''
            },
            body: baseParams,
             credentials: 'omit' // Explicitly omit cookies
        };

        try {
            console.info(`Fetching details for Ad ID: ${adArchiveId}, Page ID: ${pageId}`);
            const response = await fetch(url, requestOptions);

            if (!response.ok) {
                console.error(`Get ad details failed: ${response.status} ${response.statusText}`);
                console.error("Response Body:", await response.text());
                return null;
            }

            const responseText = await response.text();
            const data = this._parseResponse(responseText);


             if (!data || !data.data) {
                 console.error("Failed to parse ad details response or data is missing.");
                 // console.log("Raw response text for debugging:", responseText);
                 return null;
             }

            // Log raw data
            console.log("Raw ad details data:", JSON.stringify(data, null, 2));

            const main_data = data?.data?.ad_library_main;
            const ad_details = main_data?.ad_details;
            // const advertiser = ad_details?.advertiser; // Not used in Python for final structure
            // const page_spend_info = advertiser?.ad_library_page_info?.page_spend || {}; // Renamed for clarity
            const page_info_data = ad_details?.advertiser?.ad_library_page_info || {}; // For PageInfo
            const aaa_info = ad_details?.aaa_info || {};


            // Create TargetingInfo
            const location_audience = aaa_info?.location_audience || [];
            return new TargetingInfo({
                 locations: location_audience.filter(loc => loc && !loc.excluded).map(loc => loc.name || ''),
                 excluded_locations: location_audience.filter(loc => loc && loc.excluded).map(loc => loc.name || ''),
                 gender: aaa_info?.gender_audience || 'Unknown',
                 age_range: {
                     min: aaa_info?.age_audience?.min || null,
                     max: aaa_info?.age_audience?.max || null
                 },
                 eu_total_reach: aaa_info?.eu_total_reach,
                 demographic_breakdown: aaa_info?.age_country_gender_reach_breakdown || []
             });

            // Create AdInfo
            // let spend = null;
            // const lifetime_disclaimers = page_info_data?.page_spend?.lifetime_by_disclaimer || [];
            // if (Array.isArray(lifetime_disclaimers) && lifetime_disclaimers.length > 0) {
            //     spend = lifetime_disclaimers[0]?.spend; // Assuming first disclaimer is relevant
            // }

            //  const adInfo = new AdInfo({
            //      archive_id: adArchiveId,
            //      page_id: pageId,
            //      spend: spend, // Updated spend
            //      is_political: page_info_data?.page_spend?.is_political_page || false,
            //      targeting: targetingInfo,
            //      payer_beneficiary: aaa_info?.payer_beneficiary_data || [],
            //      is_taken_down: aaa_info?.is_ad_taken_down || false,
            //      has_violations: aaa_info?.has_violating_payer_beneficiary || false
            //  });
            console.info(`Successfully fetched details for Ad ID: ${adArchiveId}`);
            return adDetailsResult;
        } catch (error) {
            console.error(`Error getting ad details: ${error}`);
            return null;
        }
    }
}

export { FacebookScraper };