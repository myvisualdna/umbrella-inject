/**
 * Cleans scraped article body by:
 * - Removing promo/footer/byline/network/agency/junk lines
 * - Cutting off the article when we reach known "related/recommended/topics" sections
 * - Removing common appended headline spam (Yahoo-style)
 *
 * Returns undefined if body becomes empty after cleaning.
 */

import { CUTOFF_SECTION_PATTERNS, DROP_LINE_PATTERNS } from "./cleaningPatterns";

export function cleanArticleBody(body?: string): string | undefined {
  if (!body) return body;

  // Normalize line endings and trim trailing whitespace
  const rawLines = body.replace(/\r\n/g, "\n").split("\n");

  const cleaned: string[] = [];
  let emptyStreak = 0;

  for (const rawLine of rawLines) {
    const line = rawLine.trim();

    // Preserve paragraph breaks (but collapse multiple blank lines)
    if (!line) {
      emptyStreak += 1;
      if (emptyStreak <= 1 && cleaned.length > 0) cleaned.push("");
      continue;
    }
    emptyStreak = 0;

    // Cut off if we hit a "section marker" that usually means "junk from here on"
    if (CUTOFF_SECTION_PATTERNS.some((re) => re.test(line))) {
      break;
    }

    // Drop obvious junk lines
    if (DROP_LINE_PATTERNS.some((re) => re.test(line))) {
      continue;
    }

    // Drop CBS-style credit headers that can be split across multiple lines
    // e.g. "Updated on: ..." "/ CBS News"
    // (Some are already caught above; this is extra safety.)
    if (/^\s*\/\s*(cbs|abc|nbc|cnn|fox|bbc)\s+news\s*$/i.test(line)) continue;

    // Drop standalone "agency/network" credit lines when they appear alone
    if (
      /^(cbs news|ap news|associated press|reuters|bloomberg|afp|the guardian|new york times|washington post)$/i.test(
        line
      )
    ) {
      continue;
    }

    // Remove lines that are very likely *appended unrelated headlines* (Yahoo pattern):
    // - short-ish
    // - looks like a headline (title case-ish)
    // - no ending punctuation
    // - not a normal sentence
    //
    // This is conservative: it won't catch everything, but avoids nuking real content.
    const looksLikeHeadlineSpam =
      line.length <= 120 &&
      !/[.!?]"?$/.test(line) &&
      !/^\d+%?$/.test(line) &&
      !/^(mr\.|mrs\.|ms\.)\b/i.test(line) &&
      // avoid killing legit short sentences that start with common narrative patterns
      !/^(in|on|at|after|before|during|as|when|while|because|since|although)\b/i.test(line) &&
      // headline-ish: begins with capital and has few commas
      /^[A-Z0-9][^:]{8,}$/.test(line) &&
      (line.match(/,/g)?.length ?? 0) <= 1;

    if (looksLikeHeadlineSpam) {
      // If the last real paragraph already exists, these often come in clusters at the end.
      // We can safely drop them.
      continue;
    }

    cleaned.push(rawLine.trim());
  }

  // Remove trailing empty lines
  while (cleaned.length > 0 && cleaned[cleaned.length - 1] === "") {
    cleaned.pop();
  }

  const result = cleaned.join("\n").trim();
  return result.length > 0 ? result : undefined;
}
