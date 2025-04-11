import { FacebookScraper } from './scraper.js';

const scraper = new FacebookScraper();
await scraper.init();

const pages = await scraper.searchPages('Substance Digital Media Europe');
console.log(pages);
const page = pages[0];
const ads = await scraper.getPageAds(page.id);
for (const ad of ads) {
    // const adDetails = await scraper.getAdDetails(ad.id, page.id);
    console.log(ad);
}
