/**
 * Wikimedia Commons image selection algorithm
 *
 * Goal:
 * - Given a list of Wikimedia search results (with imageinfo/extmetadata),
 *   pick the "best" cover image for a news post.
 *
 * Why this approach:
 * - Commons search can return maps/logos/flags/random uploads.
 * - "first 3 results" is not reliable.
 * - So we:
 *   1) HARD FILTER (remove obviously bad / unusable)
 *   2) SCORE remaining candidates (relevance + photo-likeness + quality)
 *   3) PICK highest score (with deterministic tie-breakers)
 *
 * Enhancements added:
 * - Structured Data / "depicts" support (strong relevance signal)
 * - Stronger named-entity safety mode (avoid wrong person)
 * - Better resolution scoring curve (meaningful, capped)
 * - More robust non-photo filtering (title/desc/category signals)
 * - "Looks like a photo" boosts (EXIF-like hints + photo categories)
 * - Duplicate clustering (by SHA1 / base filename when available)
 * - Low-confidence threshold => return null (so you can fallback to Pexels/Pixabay)
 *
 * This file assumes you've already called the Wikimedia API and have candidates that include:
 * - title (File:Something.jpg)
 * - imageinfo.url / imageinfo.thumburl / width / height / mime
 * - imageinfo.extmetadata (LicenseShortName, LicenseUrl, Artist, ImageDescription, etc.)
 * - optionally categories (prop=categories)
 * - optionally structured data "depicts" labels (if you fetch it) or any tags you can provide
 *
 * You can adapt parsing depending on your specific API response shape.
 */

/** ---- Types (lightweight, shaped to what we need) ---- */

export type CommonsExtMetadataValue = {
  value?: string; // Often HTML
};

export type CommonsExtMetadata = Partial<{
  Artist: CommonsExtMetadataValue;
  Credit: CommonsExtMetadataValue;
  ImageDescription: CommonsExtMetadataValue;
  LicenseShortName: CommonsExtMetadataValue;
  LicenseUrl: CommonsExtMetadataValue;
  UsageTerms: CommonsExtMetadataValue;
  Attribution: CommonsExtMetadataValue;
  AttributionRequired: CommonsExtMetadataValue;
  ObjectName: CommonsExtMetadataValue; // sometimes used as a title
  // Sometimes available depending on request:
  DateTimeOriginal: CommonsExtMetadataValue;
  Model: CommonsExtMetadataValue;
  Make: CommonsExtMetadataValue;
}>;

export type CommonsImageInfo = Partial<{
  url: string; // direct original
  thumburl: string; // thumbnail
  descriptionurl: string; // file page URL (sometimes provided)
  width: number;
  height: number;
  mime: string; // image/jpeg, image/png, image/svg+xml...
  extmetadata: CommonsExtMetadata;

  // OPTIONAL, if you request it:
  sha1: string; // can be used for dedupe (prop=imageinfo&iiprop=sha1)
}>;

export type CommonsCandidate = {
  title: string; // e.g. "File:Commons-logo.svg"
  pageid?: number;

  // Optional categories if you request prop=categories
  categories?: string[]; // e.g. ["Category:Featured pictures", "Category:Maps of Texas"]

  // OPTIONAL: if you fetch structured data / depicts labels (recommended)
  // Put human-readable labels here if you can (e.g. ["Lionel Messi", "Argentina national football team"])
  depicts?: string[];

  imageinfo?: CommonsImageInfo; // Usually the first element of imageinfo array
};

/** ---- Output type you can store into your Sanity cover fields ---- */
export type SelectedCommonsImage = {
  externalUrl: string; // direct file url
  sourcePageUrl?: string; // file page on commons
  creditProvider: "Wikimedia Commons";
  creator?: string;
  license?: string;
  licenseUrl?: string;
  imageTitle?: string; // file title / object name (optional)
  // A concise "display credit line" you can render in UI
  creditLine: string;
  // Useful for debugging
  debug: {
    score: number;
    reasons: string[];
    width?: number;
    height?: number;
    mime?: string;
    sha1?: string;
  };
};

export type SelectBestCommonsImageInput = {
  keyword: string; // 1–4 words (imageKeyword from your pipeline)
  candidates: CommonsCandidate[];
  minWidth?: number; // default 900
  allowLicenses?: string[]; // allowlist of license short names

  /**
   * If your keyword is a named entity (person/org/place), set true to avoid wrong-subject picks.
   * If omitted, we infer "likely entity" from capitalization/shape (best-effort).
   */
  strictEntityMatch?: boolean;

  /**
   * If the best score is below this threshold, return null so your pipeline can fallback to stock.
   * Default: 55
   */
  minAcceptScore?: number;
};

/** ---- Public API ---- */

export function selectBestCommonsImage(
  input: SelectBestCommonsImageInput
): SelectedCommonsImage | null {
  const keywordRaw = (input.keyword ?? "").toString().trim();
  const keyword = normalize(keywordRaw);
  const minWidth = input.minWidth ?? 900;
  const minAcceptScore = input.minAcceptScore ?? 55;

  const strictEntityMatch =
    input.strictEntityMatch ?? inferStrictEntityMode(keywordRaw);

  // Licenses:
  // - Commons content is mixed. For a news site, you likely want:
  //   CC BY, CC BY-SA, CC0, Public Domain (and similar)
  // This allowlist is deliberately conservative.
  const allowLicenses =
    input.allowLicenses ??
    [
      "CC BY 4.0",
      "CC BY-SA 4.0",
      "CC BY 3.0",
      "CC BY-SA 3.0",
      "CC BY 2.0",
      "CC BY-SA 2.0",
      "CC0",
      "Public domain",
      "Public Domain",
      "PD",
    ].map(normalize);

  // Step 0: normalize/enrich
  const enriched = input.candidates.map(enrichCandidate);

  // Step 0.5: dedupe (sha1 preferred; fallback to base filename)
  const deduped = dedupeCandidates(enriched);

  // Step 1: HARD FILTER
  // Remove candidates that are obviously unusable for a hero/cover image.
  const filtered = deduped
    .filter((c) => hasUsableUrl(c))
    .filter((c) => isAllowedLicense(c, allowLicenses))
    .filter((c) => isBigEnough(c, minWidth))
    .filter((c) => isNotObviouslyNonPhoto(c, keyword))
    .filter((c) => passesEntitySafetyIfNeeded(c, keyword, strictEntityMatch));

  if (filtered.length === 0) return null;

  // Step 2: SCORE
  const scored = filtered.map((c) => {
    const { score, reasons } = scoreCandidate(c, keyword, keywordRaw, strictEntityMatch);
    return { c, score, reasons };
  });

  // Step 3: PICK BEST (deterministic)
  scored.sort((a, b) => {
    // Higher score wins
    if (b.score !== a.score) return b.score - a.score;
    // Tie-breaker: larger width wins
    const aw = a.c.imageinfo?.width ?? 0;
    const bw = b.c.imageinfo?.width ?? 0;
    if (bw !== aw) return bw - aw;
    // Tie-breaker: JPEG > PNG > others
    return (
      mimePreference(b.c.imageinfo?.mime) - mimePreference(a.c.imageinfo?.mime)
    );
  });

  const best = scored[0];

  // Low-confidence guard: if even the best is weak, return null so you can fallback to stock.
  if (best.score < minAcceptScore) return null;

  return toSelectedCommonsImage(best.c, best.score, best.reasons);
}

/** ---- Hard-filter helpers ---- */

function hasUsableUrl(c: CommonsCandidate): boolean {
  const url = c.imageinfo?.url;
  return !!url && /^https?:\/\//i.test(url);
}

function isBigEnough(c: CommonsCandidate, minWidth: number): boolean {
  const w = c.imageinfo?.width ?? 0;
  return w >= minWidth;
}

function isAllowedLicense(c: CommonsCandidate, allow: string[]): boolean {
  // Commons extmetadata is often HTML and inconsistent.
  // We use LicenseShortName as primary.
  const lic = normalize(getMetaText(c, "LicenseShortName"));
  if (!lic) return false;
  return allow.includes(lic);
}

function isNotObviouslyNonPhoto(c: CommonsCandidate, keyword: string): boolean {
  // Many Commons search results are symbols/maps/logos/flags/random uploads.
  // Allow them only if the keyword implies them.
  const wantsMapLike =
    keyword.includes("map") ||
    keyword.includes("flag") ||
    keyword.includes("logo") ||
    keyword.includes("seal") ||
    keyword.includes("coat of arms") ||
    keyword.includes("coat") ||
    keyword.includes("diagram") ||
    keyword.includes("chart") ||
    keyword.includes("icon");

  if (wantsMapLike) return true;

  const title = normalize(stripHtml(c.title));
  const desc = normalize(getMetaText(c, "ImageDescription"));
  const cats = (c.categories ?? []).map((x) => normalize(x));
  const categories = cats.join(" ");

  const mime = normalize(c.imageinfo?.mime ?? "");
  const isSvg = mime.includes("svg");
  if (isSvg) return false;

  // Hard reject if text screams "non-photo"
  const hardRejectTokens = [
    "map of",
    "flag of",
    "coat of arms",
    "logo",
    "seal",
    "icon",
    "pictogram",
    "diagram",
    "chart",
    "infographic",
    "collage",
    "montage",
    "vector",
    "svg",
  ];

  const joined = `${title} ${desc} ${categories}`;
  if (hardRejectTokens.some((t) => joined.includes(t))) return false;

  // Block common non-photo category signals.
  const blockedCategorySignals = [
    "category:maps",
    "category:flags",
    "category:logos",
    "category:coats of arms",
    "category:seals",
    "category:icons",
    "category:pictograms",
    "category:diagrams",
    "category:charts",
    "category:svg",
    "category:vector",
  ];

  if (
    cats.some((cat) =>
      blockedCategorySignals.some((sig) => cat.includes(sig))
    )
  ) {
    return false;
  }

  return true;
}

/**
 * Entity safety:
 * If keyword is likely a named entity (person/org/place) and strictEntityMatch is true,
 * require stronger evidence that the file is about the keyword:
 * - depicts contains the keyword, OR
 * - exact phrase match in title/categories/description.
 */
function passesEntitySafetyIfNeeded(
  c: CommonsCandidate,
  keyword: string,
  strictEntityMatch: boolean
): boolean {
  if (!strictEntityMatch) return true;

  const title = normalize(stripHtml(c.title));
  const desc = normalize(getMetaText(c, "ImageDescription"));
  const categories = (c.categories ?? []).map((x) => normalize(x)).join(" ");
  const depicts = (c.depicts ?? []).map((x) => normalize(x)).join(" ");

  // Must hit at least one strong field:
  const strongHit =
    (depicts && depicts.includes(keyword)) ||
    title.includes(keyword) ||
    categories.includes(keyword) ||
    desc.includes(keyword);

  return strongHit;
}

/** ---- Scoring ---- */

function scoreCandidate(
  c: CommonsCandidate,
  keyword: string,
  keywordRaw: string,
  strictEntityMatch: boolean
): { score: number; reasons: string[] } {
  let score = 0;
  const reasons: string[] = [];

  const title = normalize(stripHtml(c.title));
  const desc = normalize(getMetaText(c, "ImageDescription"));
  const artist = normalize(getMetaText(c, "Artist"));
  const categoriesArr = (c.categories ?? []).map((x) => normalize(x));
  const categories = categoriesArr.join(" ");
  const depictsArr = (c.depicts ?? []).map((x) => normalize(x));
  const depicts = depictsArr.join(" ");

  // A) Relevance scoring (most important)
  const tokens = tokenize(keyword);
  const tokenSet = new Set(tokens);

  // A0) Structured Data / depicts (strongest signal)
  if (depicts) {
    if (depicts.includes(keyword)) {
      score += 60;
      reasons.push("Depicts matches keyword (+60)");
    } else {
      // partial depicts matches
      const depictsTokens = tokenize(depicts);
      const overlap = countOverlap(depictsTokens, tokenSet);
      if (overlap > 0) {
        const pts = Math.min(30, overlap * 10);
        score += pts;
        reasons.push(`Depicts token overlap ${overlap} (+${pts})`);
      }
    }
  }

  // A1) Exact phrase match (boost)
  if (
    keyword.length >= 3 &&
    (title.includes(keyword) || desc.includes(keyword) || categories.includes(keyword))
  ) {
    score += 35;
    reasons.push("Exact keyword phrase match (+35)");
  }

  // A2) Field-weighted token matches (avoid generic domination)
  const titleHits = countHits(tokens, title);
  const descHits = countHits(tokens, desc);
  const catHits = countHits(tokens, categories);

  // Title is strongest, then description, then categories
  const titlePts = Math.min(24, titleHits * 12);
  const descPts = Math.min(16, descHits * 8);
  const catPts = Math.min(12, catHits * 6);

  if (titlePts) reasons.push(`Title token hits ${titleHits} (+${titlePts})`);
  if (descPts) reasons.push(`Description token hits ${descHits} (+${descPts})`);
  if (catPts) reasons.push(`Category token hits ${catHits} (+${catPts})`);

  score += titlePts + descPts + catPts;

  // If strict entity mode and no depicts match, slightly penalize weak-only evidence
  if (strictEntityMatch && !depicts.includes(keyword)) {
    const evidence = titleHits + descHits + catHits;
    if (evidence <= 1) {
      score -= 15;
      reasons.push("Strict entity mode: weak evidence (-15)");
    }
  }

  // B) Photo-likeness (prefer photo signals over mime)
  const mime = normalize(c.imageinfo?.mime ?? "");
  if (mime.includes("jpeg") || mime.includes("jpg") || mime.includes("png")) {
    score += 2;
    reasons.push("Standard raster image (+2)");
  }

  // Photo-ish category hints
  const photoCategorySignals = [
    "category:photographs",
    "category:images of",
    "category:portraits",
  ];
  if (categoriesArr.some((cat) => photoCategorySignals.some((s) => cat.includes(s)))) {
    score += 8;
    reasons.push("Photo-like categories (+8)");
  }

  // EXIF-ish hints in extmetadata (best-effort; presence-only)
  const hasCameraModel = !!normalize(getMetaText(c, "Model"));
  const hasCameraMake = !!normalize(getMetaText(c, "Make"));
  const hasOriginalDate = !!normalize(getMetaText(c, "DateTimeOriginal"));
  if (hasCameraModel || hasCameraMake || hasOriginalDate) {
    score += 8;
    reasons.push("EXIF-like metadata present (+8)");
  }

  // C) Quality / usability
  const w = c.imageinfo?.width ?? 0;
  const h = c.imageinfo?.height ?? 0;

  const resBoost = resolutionBoost(w);
  score += resBoost;
  if (resBoost > 0) reasons.push(`Resolution curve boost w=${w} (+${resBoost})`);

  const ratio = aspectRatio(w, h);
  // aspect ratio curve
  if (ratio >= 1.3 && ratio <= 1.9) {
    score += 12;
    reasons.push(`Aspect ratio ${ratio.toFixed(2)} ideal (+12)`);
  } else if ((ratio >= 1.1 && ratio < 1.3) || (ratio > 1.9 && ratio <= 2.2)) {
    score += 6;
    reasons.push(`Aspect ratio ${ratio.toFixed(2)} acceptable (+6)`);
  } else if (ratio >= 0.9 && ratio < 1.1) {
    score += 2;
    reasons.push(`Aspect ratio ${ratio.toFixed(2)} square-ish (+2)`);
  } else if (ratio > 0) {
    score -= 10;
    reasons.push(`Aspect ratio ${ratio.toFixed(2)} unfriendly (-10)`);
  }

  // D) Featured / Quality signals
  if (categories.includes("featured pictures")) {
    score += 25;
    reasons.push("Featured picture category (+25)");
  }
  if (categories.includes("quality images")) {
    score += 18;
    reasons.push("Quality image category (+18)");
  }

  // E) Penalties for generic / bad-for-hero files
  const joined = `${title} ${desc} ${categories}`.trim();

  // camera dump filename
  if (/(\bimg[_-]\d+\b|\bdsc[_-]\d+\b|\bp\d{6,}\b)/i.test(title)) {
    score -= 6;
    reasons.push("Camera-dump filename pattern (-6)");
  }

  // “gallery / list / collection” style files (often poor hero)
  if (/\bgallery\b|\bcollage\b|\bmontage\b|\bset of\b|\bcollection\b/i.test(joined)) {
    score -= 12;
    reasons.push("Gallery/collage/collection penalty (-12)");
  }

  // Strong non-photo terms (should have been filtered, but keep safety net)
  if (/\bmap\b|\bflag\b|\blogo\b|\bcoat of arms\b|\bseal\b|\bdiagram\b|\bchart\b|\binfographic\b/i.test(joined)) {
    score -= 20;
    reasons.push("Non-photo safety penalty (-20)");
  }

  // Small boost if Artist exists (helps attribution completeness)
  if (artist) {
    score += 3;
    reasons.push("Artist metadata present (+3)");
  }

  // Small preference for JPEG over PNG (tie-ish, not decisive)
  if (mime.includes("jpeg") || mime.includes("jpg")) {
    score += 2;
    reasons.push("JPEG slight preference (+2)");
  } else if (mime.includes("png")) {
    score += 1;
    reasons.push("PNG slight preference (+1)");
  }

  // Cap score to keep debugging sane (optional)
  score = Math.max(-100, Math.min(200, score));

  return { score, reasons };
}

/** ---- Mapping to your schema fields ---- */

function toSelectedCommonsImage(
  c: CommonsCandidate,
  score: number,
  reasons: string[]
): SelectedCommonsImage {
  const externalUrl = c.imageinfo?.url!;
  const license = stripHtml(getMetaText(c, "LicenseShortName")) || "Unknown";
  const licenseUrl = stripHtml(getMetaText(c, "LicenseUrl")) || undefined;

  // Commons API sometimes provides descriptionurl. If not, you can derive it from the title:
  // https://commons.wikimedia.org/wiki/File:...
  const sourcePageUrl =
    c.imageinfo?.descriptionurl ||
    (c.title.startsWith("File:")
      ? `https://commons.wikimedia.org/wiki/${encodeURIComponent(c.title)}`
      : undefined);

  // Creator often comes as HTML (links). Strip it for storage/display.
  const creator = stripHtml(getMetaText(c, "Artist")) || undefined;

  // "ObjectName" or file title can be used as "imageTitle"
  const imageTitle =
    stripHtml(getMetaText(c, "ObjectName")) ||
    stripHtml(c.title.replace(/^File:/, "")) ||
    undefined;

  // Build a consistent credit line
  const bits: string[] = [];
  if (creator) bits.push(`Photo by ${creator}`);
  bits.push("via Wikimedia Commons");
  if (license) bits.push(`(${license})`);
  const creditLine = bits.join(" ");

  return {
    externalUrl,
    sourcePageUrl,
    creditProvider: "Wikimedia Commons",
    creator,
    license,
    licenseUrl,
    imageTitle,
    creditLine,
    debug: {
      score,
      reasons,
      width: c.imageinfo?.width,
      height: c.imageinfo?.height,
      mime: c.imageinfo?.mime,
      sha1: c.imageinfo?.sha1,
    },
  };
}

/** ---- Normalization / metadata helpers ---- */

function enrichCandidate(c: CommonsCandidate): CommonsCandidate {
  // If your API returns imageinfo as an array, normalize it before calling selectBestCommonsImage.
  // This is a good place to map structured data "depicts" into c.depicts if you fetch it elsewhere.
  return c;
}

function getMetaText(c: CommonsCandidate, key: keyof CommonsExtMetadata): string {
  const meta = c.imageinfo?.extmetadata?.[key];
  return (meta?.value ?? "").toString();
}

function stripHtml(input: string): string {
  if (!input) return "";
  return input
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<\/p>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalize(input: string): string {
  return (input ?? "").toString().trim().toLowerCase();
}

function aspectRatio(w: number, h: number): number {
  if (!w || !h) return 0;
  return w / h;
}

function mimePreference(mime?: string): number {
  const m = normalize(mime ?? "");
  if (m.includes("jpeg") || m.includes("jpg")) return 3;
  if (m.includes("png")) return 2;
  return 1;
}

/** ---- Tokenization / scoring utilities ---- */

function tokenize(text: string): string[] {
  return normalize(text)
    .replace(/['’]/g, "")
    .split(/[^a-z0-9]+/i)
    .filter((t) => t.length >= 2)
    .filter((t) => !STOPWORDS.has(t));
}

const STOPWORDS = new Set([
  "the",
  "a",
  "an",
  "and",
  "or",
  "of",
  "to",
  "in",
  "on",
  "for",
  "with",
  "at",
  "by",
  "from",
  "as",
  "is",
  "are",
  "was",
  "were",
  "be",
  "been",
  "this",
  "that",
  "these",
  "those",
  "it",
]);

function countHits(tokens: string[], haystack: string): number {
  let hits = 0;
  for (const t of tokens) {
    if (haystack.includes(t)) hits += 1;
  }
  return hits;
}

function countOverlap(tokens: string[], set: Set<string>): number {
  let n = 0;
  for (const t of tokens) {
    if (set.has(t)) n += 1;
  }
  return n;
}

/**
 * Better resolution curve:
 * Rewards 900→1400→2000→2800 strongly, then flattens.
 */
function resolutionBoost(width: number): number {
  if (!width) return 0;
  if (width >= 3600) return 18;
  if (width >= 2800) return 16;
  if (width >= 2000) return 12;
  if (width >= 1400) return 6;
  if (width >= 900) return 2;
  return 0;
}

/**
 * Heuristic: treat as "entity" if keyword looks like a proper name (multi-word or contains dots)
 * or if raw keyword includes uppercase letters (best-effort).
 */
function inferStrictEntityMode(keywordRaw: string): boolean {
  const raw = (keywordRaw ?? "").trim();
  const words = raw.split(/\s+/).filter(Boolean);
  const hasCaps = /[A-Z]/.test(raw);
  const looksLikeName = words.length >= 2 || raw.includes(".") || raw.includes("-");
  return hasCaps || looksLikeName;
}

/** ---- Dedupe ---- */

function dedupeCandidates(list: CommonsCandidate[]): CommonsCandidate[] {
  const seen = new Map<string, CommonsCandidate>();

  for (const c of list) {
    const sha1 = c.imageinfo?.sha1?.trim();
    const key =
      sha1 ||
      baseFilenameKey(c.title) ||
      // last resort: url
      (c.imageinfo?.url ? c.imageinfo.url : c.title);

    const existing = seen.get(key);
    if (!existing) {
      seen.set(key, c);
      continue;
    }

    // keep the "better" one by preferring larger width
    const ew = existing.imageinfo?.width ?? 0;
    const cw = c.imageinfo?.width ?? 0;
    if (cw > ew) {
      seen.set(key, c);
    }
  }

  return Array.from(seen.values());
}

function baseFilenameKey(title: string): string {
  // "File:Some_Name (1).jpg" => "some_name"
  const t = (title ?? "").replace(/^File:/i, "").trim();
  if (!t) return "";
  const noExt = t.replace(/\.[a-z0-9]{2,5}$/i, "");
  const normalized = normalize(noExt)
    .replace(/\(\d+\)/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
  return normalized;
}
