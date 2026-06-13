import axios from "axios";
import * as cheerio from "cheerio";
import {
  discoverABCNewsStories,
  extractABCNewsArticleDetailsFromPage,
  type ABCNewsArticleItem,
  type ABCNewsArticleDetails,
} from "./abcNewsShared";

export type { ABCNewsArticleItem as ABCNewsTechnologyArticleItem };
export type { ABCNewsArticleDetails as ABCNewsTechnologyArticleDetails };

export async function scrapeABCNewsTechnologyHomepage(
  limit = 5
): Promise<ABCNewsArticleItem[]> {
  const abcNewsTechnologyUrl = "https://abcnews.com/Technology";
  const response = await axios.get(abcNewsTechnologyUrl);
  const $ = cheerio.load(response.data);
  return discoverABCNewsStories($, abcNewsTechnologyUrl, "Technology", limit);
}

export async function scrapeABCNewsTechnologyArticleDetails(
  articleUrl: string
): Promise<ABCNewsArticleDetails> {
  const response = await axios.get(articleUrl);
  const $ = cheerio.load(response.data);
  return extractABCNewsArticleDetailsFromPage($, articleUrl, "Technology");
}
