import { calculateRetryDelay } from '../src/utils/retryCalculator.js';

describe('Retry delay calculation', () => {
  test('FIXED strategy returns constant delay', () => {
    expect(calculateRetryDelay('FIXED', 5, 1)).toBe(5);
    expect(calculateRetryDelay('FIXED', 5, 3)).toBe(5);
  });

  test('LINEAR strategy grows linearly', () => {
    expect(calculateRetryDelay('LINEAR', 5, 1)).toBe(5);
    expect(calculateRetryDelay('LINEAR', 5, 2)).toBe(10);
    expect(calculateRetryDelay('LINEAR', 5, 3)).toBe(15);
  });

  test('EXPONENTIAL strategy doubles each time', () => {
    expect(calculateRetryDelay('EXPONENTIAL', 5, 1)).toBe(5);
    expect(calculateRetryDelay('EXPONENTIAL', 5, 2)).toBe(10);
    expect(calculateRetryDelay('EXPONENTIAL', 5, 3)).toBe(20);
    expect(calculateRetryDelay('EXPONENTIAL', 5, 4)).toBe(40);
  });
});
