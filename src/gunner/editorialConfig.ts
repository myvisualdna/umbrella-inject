/**
 * Editorial Flags Configuration
 * 
 * Defines how articles are displayed based on their run ID and origin.
 * Each run can have different editorial positioning rules for different sources.
 */

/**
 * Editorial flags that can be set for articles
 */
export interface EditorialFlags {
  // Main positioning flags
  mainHeadline?: boolean;
  mainHeadlineRank?: number; // 0-10, only used when mainHeadline is true
  mainHeadlineUntil?: string; // ISO datetime string, only used when mainHeadline is true
  frontline?: boolean;
  frontRank?: number; // 0-10, only used when frontline is true
  frontUntil?: string; // ISO datetime string, only used when frontline is true
  rightHeadline?: boolean;
  rightHeadlineRank?: number; // 0-10, only used when rightHeadline is true
  rightHeadlineUntil?: string; // ISO datetime string, only used when rightHeadline is true
  justIn?: boolean;
  justInRank?: number; // 0-10, only used when justIn is true
  justInUntil?: string; // ISO datetime string, only used when justIn is true
  
  // Just In sub-flags (only used when justIn is true)
  breakingNews?: boolean;
  developingStory?: boolean;
  
  // Other flags
  featured?: boolean;
  priority?: number; // 0-10
}

/**
 * Configuration structure: runId -> origin -> editorial flags
 */
export type EditorialConfig = {
  [runId: string]: {
    [origin: string]: EditorialFlags;
  };
};

/**
 * Editorial configuration for all runs
 * 
 * Structure:
 * - run1: Articles from run1 with specific origins get these flags
 * - run2: Articles from run2 with specific origins get these flags
 * - etc.
 * 
 * Example:
 * - run1 + apNewsUS → frontline: true, frontRank: 6
 * - run2 + yahooUSNews → mainHeadline: true
 */
export const EDITORIAL_CONFIG: EditorialConfig = {
  run1: {
    apNewsUS: {
      frontline: true,
      frontRank: 5,
      featured: true,
      priority: 5,
    },
    yahooUSNews: {
      mainHeadline: true,
      mainHeadlineRank: 4,
      priority: 4,
    },
    apNewsWorld: {
      rightHeadline: true,
      rightHeadlineRank: 4,
      featured: true,
      priority: 5,
    },
    yahooWorldNews: {
      rightHeadline: true,
      rightHeadlineRank: 4,
      priority: 4,
    },
    apNewsPolitics: {
      justIn: true,
      justInRank: 4,
      featured: true,
      priority: 5,
    },
    apNewsBusiness: {
      justIn: true,
      justInRank: 4,
      priority: 3,      
      frontline: true,
      frontRank: 4,
    },
  },
  run2: {
    // Add run2 configurations here
    apNewsBusiness: {
      frontline: true,
      frontRank: 5,
      featured: true,
      priority: 4,
    },
    cbsUS: {
      mainHeadline: true,
      mainHeadlineRank: 4,
      priority: 4,
    },
    yahooPoliticsNews: {
      justIn: true,
      justInRank: 4,
      featured: true,
      priority: 5,
    },
    apNewsWorld: {
      justIn: true,
      justInRank: 4,
      featured: true,
      priority: 4,
    },
    cbsWorld: {
      frontline: true,
      frontRank: 5,
      featured: true,
      priority: 4,
    },
    techCrunch: {
      frontline: true,
      frontRank: 4,
      featured: true,
      priority: 4,
    },
    yahooFinanceNews: {
      justIn: true,
      justInRank: 4,
      featured: true,
      priority: 5,
    },
    yahooEntertainmentNews: {
      priority: 4,
    },
    abcNewsInternational: {
      rightHeadline: true,
      rightHeadlineRank: 4,
      featured: true,
      priority: 5,
    },
    abcNewsTechnology: {
      priority: 4,
    },
  },
  run3: {
    // Add run3 configurations here
    apNewsUS: {
      mainHeadline: true,
      mainHeadlineRank: 4,
      priority: 5,
    },
    yahooEntertainmentNews: {
      frontline: true,
      frontRank: 5,
      priority: 4,
    },
    cbsUS: {
      rightHeadline: true,
      rightHeadlineRank: 4,
      featured: true,
      priority: 5,
    },
    cbsWorld: {
      frontline: true,
      frontRank: 5,
      featured: true,
      priority: 4,
    },
    apNewsBusiness: {
      justIn: true,
      justInRank: 4,
      priority: 5,
    },
    yahooScienceNews: {
      justIn: true,
      justInRank: 4,
      priority: 4,
    },
    yahooLifestyleNews: {
      priority: 4,
    },
    abcNewsUS: {
      justIn: true,
      justInRank: 4,
      priority: 5,
    },
  },
  run4: {
    // Add run4 configurations here
    yahooEntertainmentNews: {
      priority: 4,
    }, 
    apNewsScience: {
      justIn: true,
      justInRank: 4,
      priority: 4,
    },
    apNewsLifestyle: {
      frontline: true,
      frontRank: 5,
      priority: 4,
    }, 
    yahooWorldNews: {
      mainHeadline: true,
      mainHeadlineRank: 4,
      priority: 5,
    }, 
  },
};

/**
 * Gets editorial flags for a specific run and origin
 * 
 * @param runId - The run ID (e.g., "run1", "run2")
 * @param origin - The article origin (e.g., "apNewsUS", "yahooUSNews")
 * @param publishedAt - Optional published date (ISO string) to calculate frontUntil
 * @returns Editorial flags or undefined if no configuration exists
 */
export function getEditorialFlags(
  runId: string,
  origin: string | undefined,
  publishedAt?: string
): EditorialFlags | undefined {
  if (!origin) {
    return undefined;
  }

  const runConfig = EDITORIAL_CONFIG[runId];
  if (!runConfig) {
    return undefined;
  }

  const flags = runConfig[origin];
  if (!flags) {
    return undefined;
  }

  // If mainHeadline is true, calculate mainHeadlineUntil (72 hours from publishedAt)
  if (flags.mainHeadline) {
    const baseDate = publishedAt ? new Date(publishedAt) : new Date();
    const mainHeadlineUntil = new Date(baseDate.getTime() + 72 * 60 * 60 * 1000).toISOString();
    
    return {
      ...flags,
      mainHeadlineUntil,
    };
  }

  // If frontline is true, calculate frontUntil (72 hours from publishedAt)
  if (flags.frontline) {
    const baseDate = publishedAt ? new Date(publishedAt) : new Date();
    const frontUntil = new Date(baseDate.getTime() + 72 * 60 * 60 * 1000).toISOString();
    
    return {
      ...flags,
      frontUntil,
    };
  }

  // If rightHeadline is true, calculate rightHeadlineUntil (72 hours from publishedAt)
  if (flags.rightHeadline) {
    const baseDate = publishedAt ? new Date(publishedAt) : new Date();
    const rightHeadlineUntil = new Date(baseDate.getTime() + 72 * 60 * 60 * 1000).toISOString();
    
    return {
      ...flags,
      rightHeadlineUntil,
    };
  }

  // If justIn is true, calculate justInUntil (72 hours from publishedAt)
  if (flags.justIn) {
    const baseDate = publishedAt ? new Date(publishedAt) : new Date();
    const justInUntil = new Date(baseDate.getTime() + 72 * 60 * 60 * 1000).toISOString();
    
    return {
      ...flags,
      justInUntil,
    };
  }

  return flags;
}

/**
 * Merges editorial flags with default values
 * 
 * @param flags - Editorial flags from config
 * @param defaults - Default values to use if flags don't specify
 * @returns Merged editorial flags
 */
export function mergeEditorialFlags(
  flags: EditorialFlags | undefined,
  defaults: Partial<EditorialFlags> = {}
): EditorialFlags {
  if (!flags) {
    return defaults as EditorialFlags;
  }

  return {
    ...defaults,
    ...flags,
  };
}


