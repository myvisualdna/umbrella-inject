/**
 * Generates a URL-friendly slug from a title.
 * Local implementation (not imported from legacy gunner) to keep the worker
 * isolated from the old publishing pipeline.
 */
export function generateSlug(title: string): string {
  return String(title ?? "")
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .substring(0, 96)
    .replace(/-+$/g, "");
}
