import { logger } from "./config/logger";
import { scraperSwitches, isScraperEnabled } from "./config/scraperSwitches";

// AP News scrapers
import { scrapeAPNews } from "./scrapers/apnews/us";
import { scrapeAPNewsWorld } from "./scrapers/apnews/world";
import { scrapeAPNewsPolitics } from "./scrapers/apnews/politics";
import { scrapeAPNewsBusiness } from "./scrapers/apnews/business";
import { scrapeAPNewsScience } from "./scrapers/apnews/science";
import { scrapeAPNewsTechnology } from "./scrapers/apnews/technology";
import { scrapeAPNewsLifestyle } from "./scrapers/apnews/lifestyle";
import { scrapeAPNewsEntertainment } from "./scrapers/apnews/entertainment";

// Yahoo News scrapers
import { scrapeYahooNewsUS } from "./scrapers/yahoo/us";
import { scrapeYahooNewsWorld } from "./scrapers/yahoo/world";
import { scrapeYahooNewsPolitics } from "./scrapers/yahoo/politics";
import { scrapeYahooNewsFinance } from "./scrapers/yahoo/finance";
import { scrapeYahooNewsEntertainment } from "./scrapers/yahoo/entertainment";
import { scrapeYahooNewsLifestyle } from "./scrapers/yahoo/lifestyle";
import { scrapeYahooNewsScience } from "./scrapers/yahoo/science";

// CBS News scrapers
import { scrapeCBSUS } from "./scrapers/cbs/us";
import { scrapeCBSWorld } from "./scrapers/cbs/world";
import { scrapeCBSPolitics } from "./scrapers/cbs/politics";

// TechCrunch scraper
import { scrapeTechCrunch } from "./scrapers/techcrunch/index";

// ABC News scrapers
import { scrapeABCNewsUS } from "./scrapers/abcnews/us";
import { scrapeABCNewsInternational } from "./scrapers/abcnews/world";
import { scrapeABCNewsBusiness } from "./scrapers/abcnews/business";
import { scrapeABCNewsTechnology } from "./scrapers/abcnews/technology";

async function bootstrap() {
  logger.info("🚀 App started");

  // Log active scrapers
  logger.info("Scraper switches:", scraperSwitches);

  // AP News scrapers
  if (isScraperEnabled("apNewsUS")) {
    await scrapeAPNews();
  } else {
    logger.info("⏸️  AP News US scraping is disabled");
  }

  if (isScraperEnabled("apNewsWorld")) {
    await scrapeAPNewsWorld();
  } else {
    logger.info("⏸️  AP News World scraping is disabled");
  }

  if (isScraperEnabled("apNewsPolitics")) {
    await scrapeAPNewsPolitics();
  } else {
    logger.info("⏸️  AP News Politics scraping is disabled");
  }

  if (isScraperEnabled("apNewsBusiness")) {
    await scrapeAPNewsBusiness();
  } else {
    logger.info("⏸️  AP News Business scraping is disabled");
  }

  if (isScraperEnabled("apNewsScience")) {
    await scrapeAPNewsScience();
  } else {
    logger.info("⏸️  AP News Science scraping is disabled");
  }

  if (isScraperEnabled("apNewsTechnology")) {
    await scrapeAPNewsTechnology();
  } else {
    logger.info("⏸️  AP News Technology scraping is disabled");
  }

  if (isScraperEnabled("apNewsLifestyle")) {
    await scrapeAPNewsLifestyle();
  } else {
    logger.info("⏸️  AP News Lifestyle scraping is disabled");
  }

  if (isScraperEnabled("apNewsEntertainment")) {
    await scrapeAPNewsEntertainment();
  } else {
    logger.info("⏸️  AP News Entertainment scraping is disabled");
  }

  // Yahoo News scrapers
  if (isScraperEnabled("yahooUSNews")) {
    await scrapeYahooNewsUS();
  } else {
    logger.info("⏸️  Yahoo US News scraping is disabled");
  }

  if (isScraperEnabled("yahooWorldNews")) {
    await scrapeYahooNewsWorld();
  } else {
    logger.info("⏸️  Yahoo World News scraping is disabled");
  }

  if (isScraperEnabled("yahooPoliticsNews")) {
    await scrapeYahooNewsPolitics();
  } else {
    logger.info("⏸️  Yahoo Politics News scraping is disabled");
  }

  if (isScraperEnabled("yahooFinanceNews")) {
    await scrapeYahooNewsFinance();
  } else {
    logger.info("⏸️  Yahoo Finance News scraping is disabled");
  }

  if (isScraperEnabled("yahooEntertainmentNews")) {
    await scrapeYahooNewsEntertainment();
  } else {
    logger.info("⏸️  Yahoo Entertainment News scraping is disabled");
  }

  if (isScraperEnabled("yahooLifestyleNews")) {
    await scrapeYahooNewsLifestyle();
  } else {
    logger.info("⏸️  Yahoo Lifestyle News scraping is disabled");
  }

  if (isScraperEnabled("yahooScienceNews")) {
    await scrapeYahooNewsScience();
  } else {
    logger.info("⏸️  Yahoo Science News scraping is disabled");
  }

  // CBS News scrapers
  if (isScraperEnabled("cbsUS")) {
    await scrapeCBSUS();
  } else {
    logger.info("⏸️  CBS US scraping is disabled");
  }

  if (isScraperEnabled("cbsWorld")) {
    await scrapeCBSWorld();
  } else {
    logger.info("⏸️  CBS World scraping is disabled");
  }

  if (isScraperEnabled("cbsPolitics")) {
    await scrapeCBSPolitics();
  } else {
    logger.info("⏸️  CBS Politics scraping is disabled");
  }

  // TechCrunch scraper
  if (isScraperEnabled("techCrunch")) {
    await scrapeTechCrunch();
  } else {
    logger.info("⏸️  TechCrunch scraping is disabled");
  }

  // ABC News scrapers
  if (isScraperEnabled("abcNewsUS")) {
    await scrapeABCNewsUS();
  } else {
    logger.info("⏸️  ABC News US scraping is disabled");
  }

  if (isScraperEnabled("abcNewsInternational")) {
    await scrapeABCNewsInternational();
  } else {
    logger.info("⏸️  ABC News International scraping is disabled");
  }

  if (isScraperEnabled("abcNewsBusiness")) {
    await scrapeABCNewsBusiness();
  } else {
    logger.info("⏸️  ABC News Business scraping is disabled");
  }

  if (isScraperEnabled("abcNewsTechnology")) {
    await scrapeABCNewsTechnology();
  } else {
    logger.info("⏸️  ABC News Technology scraping is disabled");
  }
}

void bootstrap();
