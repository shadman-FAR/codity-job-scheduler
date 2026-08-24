/**
 * Computes the delay (in seconds) before the next retry attempt,
 * based on the queue/job's configured retry strategy.
 *
 * attemptNumber is 1-indexed: the first retry is attemptNumber = 1.
 */
export function calculateRetryDelay(strategy, baseDelaySeconds, attemptNumber) {
  switch (strategy) {
    case 'FIXED':
      return baseDelaySeconds;
    case 'LINEAR':
      return baseDelaySeconds * attemptNumber;
    case 'EXPONENTIAL':
      return baseDelaySeconds * Math.pow(2, attemptNumber - 1);
    default:
      return baseDelaySeconds;
  }
}