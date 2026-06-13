import axios from "axios";
import * as cheerio from "cheerio";
import {
  discoverABCNewsStories,
  extractABCNewsArticleDetailsFromPage,
  type ABCNewsArticleItem,
  type ABCNewsArticleDetails,
} from "./abcNewsShared";

export type { ABCNewsArticleItem as ABCNewsUSArticleItem };
export type { ABCNewsArticleDetails as ABCNewsUSArticleDetails };

export async function scrapeABCNewsUSHomepage(
  limit = 5
): Promise<ABCNewsArticleItem[]> {
  const abcNewsUSUrl = "https://abcnews.com/US";
  const response = await axios.get(abcNewsUSUrl);
  const $ = cheerio.load(response.data);
  return discoverABCNewsStories($, abcNewsUSUrl, "US", limit);
}

export async function scrapeABCNewsUSArticleDetails(
  articleUrl: string
): Promise<ABCNewsArticleDetails> {
  const response = await axios.get(articleUrl);
  const $ = cheerio.load(response.data);
  return extractABCNewsArticleDetailsFromPage($, articleUrl, "US");
}
