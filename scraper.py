import json
import logging
import sys
import time
import random
from typing import Dict, List, Optional, Any
from dataclasses import dataclass
from datetime import datetime
import uuid
import re
from curl_cffi.requests import Session  # Import curl_cffi Session

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('fb_scraper.log'),
        logging.StreamHandler(sys.stdout)
    ]
)

@dataclass
class FacebookPage:
    """Data model for a Facebook page"""
    id: str
    category: str
    entity_type: str
    # Facebook
    image_uri: str
    likes: int
    name: str
    page_alias: str
    page_is_deleted: bool
    fetch_time: str = None

    country: Optional[str] = None
    # Instagram
    ig_username: Optional[str] = None
    ig_followers: Optional[int] = None
    ig_verification: Optional[bool] = None
    verification: Optional[str] = None

    def __post_init__(self):
        if self.fetch_time is None:
            self.fetch_time = datetime.now().isoformat()

@dataclass
class FacebookAd:
    """Data model for a Facebook ad"""
    id: str
    page_id: str
    page_name: str
    title: Optional[str] = None
    body: Optional[str] = None
    caption: Optional[str] = None
    cta_text: Optional[str] = None
    cta_type: Optional[str] = None
    link_url: Optional[str] = None
    image_url: Optional[str] = None
    platforms: List[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    fetch_time: str = None

    def __post_init__(self):
        if self.fetch_time is None:
            self.fetch_time = datetime.now().isoformat()

@dataclass
class TargetingInfo:
    locations: List[str]
    excluded_locations: List[str]
    gender: str
    age_range: Dict[str, Optional[int]]
    eu_total_reach: Optional[Any] # Type might need refinement based on actual data
    demographic_breakdown: List[Any] # Type might need refinement based on actual data

@dataclass
class AdInfo:
    archive_id: str
    page_id: str
    spend: Optional[Any] # Type might need refinement
    is_political: bool
    targeting: TargetingInfo
    payer_beneficiary: List[Any] # Type might need refinement
    is_taken_down: bool
    has_violations: bool

@dataclass
class PageInfo:
    name: str
    category: str
    about: Optional[str]
    verification: str
    profile_url: Optional[str]
    likes: int

@dataclass
class AdDetails:
    ad: AdInfo
    page: PageInfo
    fetch_time: str = None

    def __post_init__(self):
        if self.fetch_time is None:
            self.fetch_time = datetime.now().isoformat()

class FacebookScraper:
    """Scraper for Facebook Ad Library"""
    def __init__(self):
        # Initialize curl_cffi Session with Chrome 131 impersonation
        self.session = Session(impersonate="chrome131")

        # GraphQL doc_ids for different operations
        self.doc_ids = {
            'page_search': '9333890689970605',  # useAdLibraryTypeaheadSuggestionDataSourceQuery
            'page_ads': '8539922039449935'      # AdLibrarySearchPaginationQuery
        }

        # Default cookies that seem to be required
        self.cookies = {
            'datr': '4SxPZUh5ui2ibThObJTg7Gfk',
            'c_user': '100001401300300',
            'ps_n': '1',
            'ps_l': '1',
            'oo': 'v1',
            'dpr': '1.7999999523162842',
            'sb': 'C0tgZxWq1EcVbQNrl4pca_tT',
            'fr': '15F1ccvaya1kduWHS.AWVlShrGaEOx_gX8XjP1KsX6vfw.Bnc7FK..AAA.0.0.BndAKq.AWWpP1WLcZM',
            'xs': '16:Ml14BMs_UQ3cjg:2:1699733852:-1:13648::AcX5IqEhPKWT3rrzLrJPdrbhy8FaZOiJrDdIWgzqR7C4vA'
        }

        self._setup_session()
        self._extract_page_params()  # Extract parameters from Ad Library page

    def _setup_session(self):
        """Setup session with default headers and cookies"""
        self.session.headers.update({
            'accept': '*/*',
            'accept-language': 'en-US,en;q=0.9',
            'content-type': 'application/x-www-form-urlencoded',
            'origin': 'https://www.facebook.com',
            'referer': 'https://www.facebook.com/ads/library/',
            'sec-ch-prefers-color-scheme': 'dark',
            'sec-ch-ua': '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
            'sec-ch-ua-mobile': '?0',
            'sec-ch-ua-platform': '"macOS"',
            'sec-fetch-dest': 'empty',
            'sec-fetch-mode': 'cors',
            'sec-fetch-site': 'same-origin',
            'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
            'x-asbd-id': '129477',
            'x-fb-friendly-name': 'useAdLibraryTypeaheadSuggestionDataSourceQuery',
            'x-fb-lsd': '1oMsaEuqGqy53uwEmB0Ecv'
        })
        
        # Update session cookies
        self.session.cookies.update(self.cookies)

    def search_pages(self, query: str) -> List[FacebookPage]:
        """Search for Facebook pages"""
        url = "https://www.facebook.com/api/graphql/"
        
        variables = {
            "queryString": query,
            "isMobile": False,
            "country": "ALL",
            "adType": "ALL"
        }

        # Get base parameters and add request specific ones
        data = self._get_request_params()
        data.update({
            'fb_api_caller_class': 'RelayModern',
            'fb_api_req_friendly_name': 'useAdLibraryTypeaheadSuggestionDataSourceQuery',
            'variables': json.dumps(variables),
            'server_timestamps': 'true',
            'doc_id': self.doc_ids['page_search']
        })

        try:
            response = self.session.post(url, data=data)
            response.raise_for_status()

            # Parse response
            data = self._parse_response(response.text)

            with open('data/search.json', 'w') as f:
                json.dump(data, f, indent=4)

            if not data or 'data' not in data:
                logging.error("Failed to parse page search response")
                return []

            pages = []
            page_results = data.get('data', {}).get('ad_library_main', {}).get('typeahead_suggestions', {}).get('page_results', [])
            for result in page_results:
                page = FacebookPage(
                    id=result.get('page_id'),
                    name=result.get('name'),
                    verification=result.get('verification'),
                    category=result.get('category'),
                    entity_type=result.get('entity_type'),
                    ig_username=result.get('ig_username'),
                    ig_followers=result.get('ig_followers'),
                    ig_verification=result.get('ig_verification'),
                    image_uri=result.get('image_uri'),
                    likes=result.get('likes'),
                    page_alias=result.get('page_alias'),
                    page_is_deleted=result.get('page_is_deleted'),
                    country=result.get('country')
                )
                if page.id:  # Only add if we got a valid ID
                    pages.append(page)

            logging.info(f"Found {len(pages)} pages for query: {query}")
            return pages

        except Exception as e:
            logging.error(f"Error searching pages: {str(e)}")
            return []

    def get_page_ads(self, page_id: str) -> List[FacebookAd]:
        """Get ads for a specific page"""
        url = "https://www.facebook.com/api/graphql/"

        variables = {
            "activeStatus": "active",
            "adType": "ALL",
            "bylines": [],
            "collationToken": str(uuid.uuid4()),
            "contentLanguages": [],
            "countries": ["ALL"],
            "cursor": None,
            "excludedIDs": [],
            "first": 30,
            "isTargetedCountry": False,
            "location": None,
            "mediaType": "all",
            "multiCountryFilterMode": None,
            "pageIDs": [],
            "potentialReachInput": None,
            "publisherPlatforms": [],
            "queryString": "",
            "regions": None,
            "searchType": "page",
            "sessionID": str(uuid.uuid4()),
            "sortData": None,
            "source": None,
            "startDate": None,
            "v": "96184a",
            "viewAllPageID": page_id
        }

        # Get base parameters and add request specific ones
        data = self._get_request_params()
        data.update({
            'fb_api_caller_class': 'RelayModern',
            'fb_api_req_friendly_name': 'AdLibrarySearchPaginationQuery',
            'variables': json.dumps(variables),
            'server_timestamps': 'true',
            'doc_id': self.doc_ids['page_ads']
        })

        try:
            response = self.session.post(url, data=data)
            response.raise_for_status()
            # Parse response
            data = self._parse_response(response.text)

            with open('data/ads.json', 'w') as f:
                json.dump(data, f, indent=4)

            if not data or 'data' not in data:
                logging.error("Failed to parse page ads response")
                return []

            ads = []
            edges = data.get('data', {}).get('ad_library_main', {}).get('search_results_connection', {}).get('edges', [])

            for edge in edges:
                node = edge.get('node', {})
                collated_results = node.get('collated_results', [])

                for result in collated_results:
                    if not result:
                        continue

                    ad_archive_id = result.get('ad_archive_id')
                    if not ad_archive_id:
                        continue

                    snapshot = result.get('snapshot', {}) or {}

                    # Extract body text safely
                    body_text = None
                    body = snapshot.get('body', {})
                    if isinstance(body, dict):
                        body_text = body.get('text')
                    elif isinstance(body, str):
                        body_text = body

                        # Create ad object with all available fields
                    ads.append(FacebookAd(
                        id=ad_archive_id,
                        page_id=result.get('page_id'),
                        page_name=result.get('page_name'),
                        title=snapshot.get('title'),
                        body=body_text,
                        caption=snapshot.get('caption'),
                        cta_text=snapshot.get('cta_text'),
                        cta_type=snapshot.get('cta_type'),
                        link_url=snapshot.get('link_url'),
                        image_url=snapshot.get('image_url'),
                        platforms=snapshot.get('publisher_platform'),
                        start_date=result.get('start_date'),
                        end_date=result.get('end_date'),
                    ))
            return ads

        except Exception as e:
            logging.error(f"Error getting page ads: {str(e)}")
            return []

    def get_ad_details(self, ad_archive_id: str, page_id: str) -> AdInfo:
        """Get detailed information for a specific ad and its page"""
        url = "https://www.facebook.com/api/graphql/"

        variables = {
            "adArchiveID": ad_archive_id,
            "pageID": page_id,
            "country": "ALL",
            "sessionID": str(uuid.uuid4()),
            "source": None,
            "isAdNonPolitical": True,
            "isAdNotAAAEligible": False,
            "__relay_internal__pv__AdLibraryFinservGraphQLGKrelayprovider": True
        }

        # Get base parameters and add request specific ones
        data = self._get_request_params()
        data.update({
            'fb_api_caller_class': 'RelayModern',
            'fb_api_req_friendly_name': 'AdLibraryAdDetailsV2Query',
            'variables': json.dumps(variables),
            'server_timestamps': 'true',
            'doc_id': '9407590475934210'  # doc_id for ad details query
        })

        try:
            response = self.session.post(url, data=data)
            response.raise_for_status()

            # Parse response
            data = self._parse_response(response.text)

            with open('data/details.json', 'w') as f:
                json.dump(data, f, indent=4)

            main_data = data.get('data', {}).get('ad_library_main', {})
            ad_details = main_data.get('ad_details', {})
            advertiser = ad_details.get('advertiser', {})
            page_spend = (advertiser.get('ad_library_page_info', {}) or {}).get('page_spend', {}) or {}
            aaa_info = ad_details.get('aaa_info', {}) or {}

            # Create nested dataclasses first
            targeting_info = TargetingInfo(
                locations=[loc.get('name', '') for loc in aaa_info.get('location_audience', []) if loc and not loc.get('excluded')] if aaa_info.get('location_audience') else [],
                excluded_locations=[loc.get('name', '') for loc in aaa_info.get('location_audience', []) if loc and loc.get('excluded')] if aaa_info.get('location_audience') else [],
                gender=aaa_info.get('gender_audience', 'Unknown'),
                age_range={
                    'min': aaa_info.get('age_audience', {}).get('min'),
                    'max': aaa_info.get('age_audience', {}).get('max')
                },
                eu_total_reach=aaa_info.get('eu_total_reach'),
                demographic_breakdown=aaa_info.get('age_country_gender_reach_breakdown', [])
            )

            ad_info = AdInfo(
                archive_id=ad_archive_id,
                page_id=page_id,
                spend=None, # Will be updated later if found
                is_political=page_spend.get('is_political_page', False),
                targeting=targeting_info,
                payer_beneficiary=aaa_info.get('payer_beneficiary_data', []),
                is_taken_down=aaa_info.get('is_ad_taken_down', False),
                has_violations=aaa_info.get('has_violating_payer_beneficiary', False)
            )

            # Try to get lifetime spend if available
            lifetime_disclaimers = page_spend.get('lifetime_by_disclaimer', [])
            if lifetime_disclaimers and isinstance(lifetime_disclaimers, list) and len(lifetime_disclaimers) > 0:
                # formatted_details['ad']['spend'] = lifetime_disclaimers[0].get('spend')
                ad_info.spend = lifetime_disclaimers[0].get('spend')

            return ad_info

        except Exception as e:
            logging.error(f"Error getting ad details: {str(e)}")
            return None

    def _generate_session_id(self) -> str:
        """Generate a session ID"""
        return f"{int(time.time())}_{random.randint(1000, 9999)}"

    def _parse_response(self, response_text: str) -> Dict:
        """Parse response text to JSON"""
        try:
            # Remove potential "for (;;);" prefix
            if response_text.startswith('for (;;);'):
                response_text = response_text[9:]
            return json.loads(response_text)
        except json.JSONDecodeError as e:
            logging.error(f"Failed to parse JSON response: {str(e)}")
            return {}

    def _extract_page_params(self):
        """Extract important parameters from Ad Library page"""
        try:
            response = self.session.get('https://www.facebook.com/ads/library/')
            if response.status_code == 200:
                page_content = response.text

                # Extract fb_dtsg token
                fb_dtsg_match = re.search(r'"DTSGInitData",\[\],{"token":"([^"]+)"', page_content)
                if fb_dtsg_match:
                    self.fb_dtsg = fb_dtsg_match.group(1)
                    logging.info(f"Found fb_dtsg token: {self.fb_dtsg}")
                
                # Extract client revision
                rev_match = re.search(r'"client_revision":(\d+),', page_content)
                if rev_match:
                    self.client_revision = rev_match.group(1)
                    logging.info(f"Found client revision: {self.client_revision}")
                
                # Extract LSD token
                lsd_match = re.search(r'"LSD",\[\],{"token":"([^"]+)"', page_content)
                if lsd_match:
                    self.lsd = lsd_match.group(1)
                    logging.info(f"Found LSD token: {self.lsd}")
                
                # Extract haste session
                hsi_match = re.search(r'"haste_session":"([^"]+)"', page_content)
                if hsi_match:
                    self.hsi = hsi_match.group(1)
                    logging.info(f"Found haste session: {self.hsi}")
                
                # Extract spin parameters
                spin_r_match = re.search(r'"__spin_r":(\d+),', page_content)
                if spin_r_match:
                    self.spin_r = spin_r_match.group(1)
                    logging.info(f"Found spin_r: {self.spin_r}")
                
                spin_b_match = re.search(r'"__spin_b":"([^"]+)"', page_content)
                if spin_b_match:
                    self.spin_b = spin_b_match.group(1)
                    logging.info(f"Found spin_b: {self.spin_b}")
                
                return True
                
        except Exception as e:
            logging.error(f"Error extracting page parameters: {str(e)}")
            return False

    def _get_request_params(self):
        """Generate parameters for GraphQL request"""
        return {
            'av': 0,
            '__aaid': 0,
            '__user': 0,
            '__a': '1',
            '__req': self._get_next_req_id(),  # Increment request counter
            '__hs': getattr(self, 'hsi', ''),
            'dpr': '2',
            '__ccg': 'EXCELLENT',
            '__rev': getattr(self, 'client_revision', ''),
            '__s': self._generate_session_string(),
            '__hsi': str(int(time.time() * 1000)),
            '__dyn': '7xeUmwlECdwn8K2Wmh0no6u5U4e1Fx-ewSAwHwNw9G2S2q0_EtxG4o0B-qbwgE1EEb87C1xwEwgo9oO0n24oaEd86a3a1YwBgao6C0Mo6i588Etw8WfK1LwPxe2GewbCXwJwmEtwse5o4q0HU1IEGdw46wbLwrU6C2-0VE6O1Fw59G2O1TwmUaE2Two8',
            '__csr': self._generate_csr(),
            '__comet_req': '1',
            'lsd': getattr(self, 'lsd', ''),
            'jazoest': self._generate_jazoest(),
            '__spin_r': getattr(self, 'spin_r', ''),
            '__spin_b': getattr(self, 'spin_b', ''),
            '__spin_t': str(int(time.time())),
            # 'fb_dtsg': getattr(self, 'fb_dtsg', ''),
        }

    def _get_next_req_id(self):
        """Generate next request ID"""
        if not hasattr(self, '_req_counter'):
            self._req_counter = 0
        self._req_counter += 1
        return chr(97 + (self._req_counter % 26))  # a, b, c, ...

    def _generate_session_string(self):
        """Generate session string"""
        return f"::{hex(random.randint(0, 16**8))[2:]}"

    def _generate_csr(self):
        """Generate CSR parameter"""
        return ''.join(random.choices('0123456789abcdefghijklmnopqrstuvwxyz', k=32))

    def _generate_jazoest(self):
        """Generate jazoest parameter"""
        # Facebook uses a simple algorithm to generate this
        base = "2" + str(sum(ord(c) for c in self.fb_dtsg)) if hasattr(self, 'fb_dtsg') else "25730"
        return base

def main():
    scraper = FacebookScraper()

    pages = scraper.search_pages("Lelosi")
    if pages: # Check if pages list is not empty
        time.sleep(2 * random.random())
        page = pages[0]
        print('page', page)
        all_ads = scraper.get_page_ads(page.id)
        if all_ads: # Check if all_ads list is not empty
            first_ad = all_ads[0] # Assuming all_ads contains FacebookAd instances
            time.sleep(2 * random.random())
            print('first_ad snapshot (from get_page_ads):', first_ad) # Print the whole ad object
            ad_details = scraper.get_ad_details(first_ad.id, page.id)
            print('ad_details object:', ad_details) # Print the AdDetails object
            # You can access specific fields like: print(ad_details.ad.targeting.locations)
            exit()

    # This loop might not be reached if exit() is called above
    for page in pages:
        print(page)

if __name__ == "__main__":
    main()