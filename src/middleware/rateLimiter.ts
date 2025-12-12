/**
 * Rate Limiter for ChatGPT API Requests
 * 
 * Ensures we don't exceed OpenAI's rate limits (3 RPM = 3 requests per minute)
 * This is a smarter alternative to fixed delays
 */

interface RequestRecord {
  timestamp: number;
}

export class ChatGPTRateLimiter {
  private requests: RequestRecord[] = [];
  private readonly maxRequests: number;
  private readonly timeWindowMs: number;

  /**
   * @param maxRequests - Maximum requests allowed (default: 3 for OpenAI)
   * @param timeWindowMs - Time window in milliseconds (default: 60000 = 1 minute)
   */
  constructor(maxRequests: number = 3, timeWindowMs: number = 60000) {
    this.maxRequests = maxRequests;
    this.timeWindowMs = timeWindowMs;
  }

  /**
   * Cleans up old requests outside the time window
   */
  private cleanup(): void {
    const now = Date.now();
    this.requests = this.requests.filter(
      (req) => now - req.timestamp < this.timeWindowMs
    );
  }

  /**
   * Waits until we can make a request without exceeding rate limits
   * @returns Promise that resolves when it's safe to make a request
   */
  async waitForSlot(): Promise<void> {
    this.cleanup();

    // If we're under the limit, we can proceed immediately
    if (this.requests.length < this.maxRequests) {
      return;
    }

    // Find the oldest request
    const oldestRequest = this.requests[0];
    const now = Date.now();
    const timeSinceOldest = now - oldestRequest.timestamp;
    const waitTime = this.timeWindowMs - timeSinceOldest + 100; // Add 100ms buffer

    if (waitTime > 0) {
      // Wait until the oldest request falls outside the time window
      await new Promise((resolve) => setTimeout(resolve, waitTime));
      this.cleanup();
    }
  }

  /**
   * Records that a request was made
   * Call this AFTER making the request
   */
  recordRequest(): void {
    this.requests.push({ timestamp: Date.now() });
    this.cleanup();
  }

  /**
   * Gets the number of requests in the current time window
   */
  getCurrentRequestCount(): number {
    this.cleanup();
    return this.requests.length;
  }
}



