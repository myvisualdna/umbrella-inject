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
  frontline?: boolean;
  frontRank?: number; // 0-10, only used when frontline is true
  frontUntil?: string; // ISO datetime string, only used when frontline is true
  rightHeadline?: boolean;
  justIn?: boolean;
  
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
      priority: 4,
    },
    apNewsWorld: {
      rightHeadline: true,
      featured: true,
      priority: 5,
    },
    yahooWorldNews: {
      rightHeadline: true,
      priority: 4,
    },
    apNewsPolitics: {
      justIn: true,
      featured: true,
      priority: 5,
    },
    apNewsBusiness: {
      justIn: true,
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
      priority: 4,
    },
    yahooPoliticsNews: {
      justIn: true,
      featured: true,
      priority: 5,
    },
    apNewsWorld: {
      justIn: true,
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
      featured: true,
      priority: 5,
    },
    yahooEntertainmentNews: {
      priority: 4,
    },
    abcNewsInternational: {
      rightHeadline: true,
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
      priority: 5,
    },
    yahooEntertainmentNews: {
      frontline: true,
      frontRank: 5,
      priority: 4,
    },
    cbsUS: {
      rightHeadline: true,
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
      priority: 5,
    },
    yahooScienceNews: {
      justIn: true,
      priority: 4,
    },
    yahooLifestyleNews: {
      priority: 4,
    },
    abcNewsUS: {
      justIn: true,
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
      priority: 4,
    },
    apNewsLifestyle: {
      frontline: true,
      frontRank: 5,
      priority: 4,
    }, 
    yahooWorldNews: {
      mainHeadline: true,
      priority: 5,
    }, 
  },
};

/**
 * Gets editorial flags for a specific run and origin
 * 
 * @param runId - The run ID (e.g., "run1", "run2")
 * @param origin - The article origin (e.g., "apNewsUS", "yahooUSNews")
 * @returns Editorial flags or undefined if no configuration exists
 */
export function getEditorialFlags(
  runId: string,
  origin: string | undefined
): EditorialFlags | undefined {
  if (!origin) {
    return undefined;
  }

  const runConfig = EDITORIAL_CONFIG[runId];
  if (!runConfig) {
    return undefined;
  }

  return runConfig[origin];
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


