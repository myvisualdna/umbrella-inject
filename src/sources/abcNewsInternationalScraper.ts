import axios from "axios";
import * as cheerio from "cheerio";
import {
  discoverABCNewsStories,
  extractABCNewsArticleDetailsFromPage,
  type ABCNewsArticleItem,
  type ABCNewsArticleDetails,
} from "./abcNewsShared";

export type { ABCNewsArticleItem as ABCNewsInternationalArticleItem };
export type { ABCNewsArticleDetails as ABCNewsInternationalArticleDetails };

export async function scrapeABCNewsInternationalHomepage(
  limit = 5
): Promise<ABCNewsArticleItem[]> {
  const abcNewsInternationalUrl = "https://abcnews.com/International";
  const response = await axios.get(abcNewsInternationalUrl);
  const $ = cheerio.load(response.data);
  return discoverABCNewsStories($, abcNewsInternationalUrl, "International", limit);
}

export async function scrapeABCNewsInternationalArticleDetails(
  articleUrl: string
): Promise<ABCNewsArticleDetails> {
  const response = await axios.get(articleUrl);
  const $ = cheerio.load(response.data);
  return extractABCNewsArticleDetailsFromPage($, articleUrl, "International");
}
