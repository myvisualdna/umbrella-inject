import { getSanityClient } from "../sanity/client";
import type { SanityDraftPost } from "./types";

export interface CreateDraftOptions {
  /** When true, overwrite an existing draft via createOrReplace. */
  overwrite?: boolean;
}

export interface CreateDraftResult {
  sanityDocumentId: string;
  created: boolean;
  skippedExisting: boolean;
}

export async function sanityDocumentExists(id: string): Promise<boolean> {
  const client = getSanityClient();
  if (!client) {
    throw new Error("Sanity client could not be initialized (missing project id / token)");
  }
  const doc = await client.getDocument(id);
  return Boolean(doc);
}

/**
 * Creates a draft `post` document in Sanity.
 *
 * - Default: `createIfNotExists` — never overwrites an existing document.
 *   If the draft already exists, the write is skipped and the existing id is
 *   returned (skippedExisting=true).
 * - `overwrite: true` (GUNNER_OVERWRITE_DRAFT): uses `createOrReplace`.
 *
 * This worker NEVER publishes: ids are always `drafts.` ids and no transaction
 * promotes a draft to a published document.
 */
export async function createDraft(
  doc: SanityDraftPost,
  options: CreateDraftOptions = {}
): Promise<CreateDraftResult> {
  const client = getSanityClient();
  if (!client) {
    throw new Error("Sanity client could not be initialized (missing project id / token)");
  }

  if (!doc._id.startsWith("drafts.")) {
    throw new Error(`Refusing to write non-draft document id: ${doc._id}`);
  }

  if (options.overwrite) {
    const result = await client.createOrReplace(doc as unknown as Record<string, unknown> & { _id: string; _type: string });
    return { sanityDocumentId: result._id, created: true, skippedExisting: false };
  }

  const existing = await client.getDocument(doc._id);
  if (existing) {
    return { sanityDocumentId: doc._id, created: false, skippedExisting: true };
  }

  const result = await client.createIfNotExists(
    doc as unknown as Record<string, unknown> & { _id: string; _type: string }
  );
  return { sanityDocumentId: result._id, created: true, skippedExisting: false };
}
