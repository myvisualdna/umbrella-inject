/**
 * Shared Sanity reference type used by cache resolvers
 */
export interface SanityCategoryReference {
  _type: "reference";
  _ref: string;
  _weak?: boolean;
  _key?: string;
}
