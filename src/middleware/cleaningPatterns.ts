/**
 * Regex patterns used to clean scraped news article bodies.
 * Keep this file source-agnostic but informed by real junk seen in feeds.
 */

export const DROP_LINE_PATTERNS: RegExp[] = [
  // --- Generic promos / CTAs ---
  /\b(stay up to date|keep reading|continue reading|read on)\b/i,
  /\b(sign up|subscribe|subscription|newsletter)\b/i,
  /\b(download|get)\b.*\b(app|the app)\b/i,
  /\b(follow us|follow)\b.*\b(whatsapp|newsletter|app|facebook|instagram|tiktok|twitter|x|youtube|threads|linkedin)\b/i,
  /\b(join)\b.*\b(channel|community)\b/i,
  /\b(turn on|enable)\b.*\b(notifications|alerts)\b/i,
  /\b(push notifications|breaking news alerts)\b/i,
  /\b(click here|tap here|learn more|read more)\b/i,
  /\b(register|create an account|log in|sign in)\b/i,
  /\b(support our journalism|support independent journalism)\b/i,
  /\b(donate|contribute)\b/i,
  /\b(advertisement|sponsored|promoted)\b/i,

  // --- Social/share prompts ---
  /\b(share this|share on|share via)\b/i,
  /\b(link in bio)\b/i,

  // --- AP-specific junk ---
  /following our whatsapp channel/i,

  // --- CBS/Publisher boilerplate ---
  /^\s*updated on:\s*/i,
  /^\s*\/\s*[a-z0-9 .-]+news\s*$/i, // e.g. "/ CBS News"
  /^\s*edited by\s*$/i,
  /^\s*the associated press\s*$/i,
  /^\s*contributed to this report\.?\s*$/i,
  /©\s*\d{4}\s+/i,
  /\ball rights reserved\b/i,

  // --- "More from / Best of" lead-in lines (often precede spam blocks) ---
  /^\s*more from\s+.+$/i,
  /^\s*best of\s+.+$/i,

  // --- TechCrunch-ish event promos ---
  /\b(check out the latest reveals)\b/i,
  /\b(this video is brought to you in partnership with)\b/i,
  /\b(last chance to get front row access)\b/i,
  /\b(don't miss it)\b/i,

  // --- Ultra-common footer links/legal ---
  /\b(terms of service|privacy policy|cookie policy)\b/i,
];

export const CUTOFF_SECTION_PATTERNS: RegExp[] = [
  // Once we hit these section markers, everything after is usually unrelated junk.
  /^\s*(related stories|recommended stories|more stories|more from|trending now|around the web)\s*:?\s*$/i,
  /^\s*(you may also like|you might also like|read next|up next|in case you missed it)\s*:?\s*$/i,

  // Yahoo-style appended unrelated headlines: often appear as multiple standalone title lines near the end.
  // We'll also handle this via "headline spam" heuristic in the cleaner.

  // CBS footer blocks / credits
  /^\s*edited by\s*$/i,
  /^\s*the associated press\s*$/i,
  /^\s*©\s*\d{4}\s+/i,

  // Hollywood Reporter / "***" separators + "Best of …"
  /^\s*\*{3,}\s*$/i,
  /^\s*best of\s+.+$/i,

  // TechCrunch "Topics" or author/editor sections and event promo sections
  /^\s*topics\s*$/i,
  /^\s*venture editor\s*$/i,
  /^\s*advertisement\s*$/i,
];
