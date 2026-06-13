import axios from "axios";
import * as cheerio from "cheerio";
import {
  discoverABCNewsStories,
  extractABCNewsArticleDetailsFromPage,
  type ABCNewsArticleItem,
  type ABCNewsArticleDetails,
} from "./abcNewsShared";

export type { ABCNewsArticleItem as ABCNewsBusinessArticleItem };
export type { ABCNewsArticleDetails as ABCNewsBusinessArticleDetails };

export async function scrapeABCNewsBusinessHomepage(
  limit = 5
): Promise<ABCNewsArticleItem[]> {
  const abcNewsBusinessUrl = "https://abcnews.com/Business";
  const response = await axios.get(abcNewsBusinessUrl);
  const $ = cheerio.load(response.data);
  return discoverABCNewsStories($, abcNewsBusinessUrl, "Business", limit);
}

export async function scrapeABCNewsBusinessArticleDetails(
  articleUrl: string
): Promise<ABCNewsArticleDetails> {
  const response = await axios.get(articleUrl);
  const $ = cheerio.load(response.data);
  return extractABCNewsArticleDetailsFromPage($, articleUrl, "Business");
}
