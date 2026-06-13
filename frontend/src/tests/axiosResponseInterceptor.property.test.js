/**
 * Property 3: Bug Condition B — Axios Response Interceptor Displays Toast for All Error Status Codes
 *
 * For any axios response with HTTP status ≥ 400, the fixed frontend SHALL invoke
 * the global toast system to display a visible, dismissible error notification,
 * ensuring no API failure is silently swallowed.
 *
 * **Validates: Requirements 2.11**
 *
 * Run on FIXED code (post task 6.1).
 * EXPECTED OUTCOME: Test PASSES for all generated error status codes.
 */

import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import fc from 'fast-check';

// Mock firebase before importing api.js
vi.mock('@/lib/firebase', () => ({
  auth: {
    currentUser: null,
  },
}));

// Import AFTER mocking
import api, { setupInterceptors } from '@/lib/api';

describe('Property 3: Axios Response Interceptor — Toast on Error Status Codes', () => {
  let toastMock;

  beforeAll(() => {
    // Register interceptors once with a fresh mock.
    // The module-level flag `interceptorsInitialized` may already be true
    // from other test files; calling setupInterceptors again will still update
    // `currentToastFn` to our mock, which is what we need.
    toastMock = vi.fn();
    setupInterceptors(toastMock);
  });

  beforeEach(() => {
    toastMock = vi.fn();
    // Re-call setupInterceptors to update the module's currentToastFn reference
    // to our fresh mock for each test run.
    setupInterceptors(toastMock);
  });

  // Grab the response error handler from the registered interceptor
  function getResponseErrorHandler() {
    const handlers = api.interceptors.response.handlers;
    // Find the last registered handler (our setup handler)
    for (let i = handlers.length - 1; i >= 0; i--) {
      if (handlers[i] && handlers[i].rejected) {
        return handlers[i].rejected;
      }
    }
    throw new Error('No response error interceptor found — did setupInterceptors run?');
  }

  function getResponseSuccessHandler() {
    const handlers = api.interceptors.response.handlers;
    for (let i = handlers.length - 1; i >= 0; i--) {
      if (handlers[i] && handlers[i].fulfilled) {
        return handlers[i].fulfilled;
      }
    }
    throw new Error('No response success interceptor found — did setupInterceptors run?');
  }

  it('Interceptors are registered after setupInterceptors()', () => {
    expect(api.interceptors.response.handlers.length).toBeGreaterThan(0);
    // Should not throw
    expect(() => getResponseErrorHandler()).not.toThrow();
    expect(() => getResponseSuccessHandler()).not.toThrow();
  });

  it(
    'Property 3a: For any HTTP error status in [400, 599], toast is called exactly once with a non-empty string',
    async () => {
      const responseErrorHandler = getResponseErrorHandler();

      await fc.assert(
        fc.asyncProperty(
          // Generate arbitrary status codes in the error range [400, 599]
          fc.integer({ min: 400, max: 599 }),
          async (statusCode) => {
            toastMock.mockClear();

            const errorObj = {
              response: {
                status: statusCode,
                data: { error: `Server error ${statusCode}` },
              },
              message: `Request failed with status code ${statusCode}`,
            };

            // The interceptor should call toast and then re-throw
            let didThrow = false;
            try {
              await responseErrorHandler(errorObj);
            } catch (_) {
              didThrow = true;
            }

            // Must have re-thrown the error
            expect(didThrow).toBe(true);

            // Toast must have been called exactly once
            expect(toastMock).toHaveBeenCalledTimes(1);

            // The message argument must be a non-empty string
            const [msg, type] = toastMock.mock.calls[0];
            expect(typeof msg).toBe('string');
            expect(msg.length).toBeGreaterThan(0);
            expect(type).toBe('error');
          }
        )
      );
    }
  );

  it(
    'Property 3b: Toast uses error.response.data.error when present',
    async () => {
      const responseErrorHandler = getResponseErrorHandler();

      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 400, max: 599 }),
          fc.string({ minLength: 1, maxLength: 200 }),
          async (statusCode, errorMessage) => {
            toastMock.mockClear();

            const errorObj = {
              response: {
                status: statusCode,
                data: { error: errorMessage },
              },
              message: 'fallback',
            };

            try {
              await responseErrorHandler(errorObj);
            } catch (_) {
              // expected
            }

            expect(toastMock).toHaveBeenCalledTimes(1);
            // Should use the response data error message
            expect(toastMock.mock.calls[0][0]).toBe(errorMessage);
          }
        )
      );
    }
  );

  it(
    'Property 3c: Toast falls back to error.message when response.data.error is absent',
    async () => {
      const responseErrorHandler = getResponseErrorHandler();

      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 400, max: 599 }),
          fc.string({ minLength: 1, maxLength: 200 }),
          async (statusCode, fallbackMessage) => {
            toastMock.mockClear();

            const errorObj = {
              response: {
                status: statusCode,
                data: {}, // no error field
              },
              message: fallbackMessage,
            };

            try {
              await responseErrorHandler(errorObj);
            } catch (_) {
              // expected
            }

            expect(toastMock).toHaveBeenCalledTimes(1);
            // Should fall back to error.message
            expect(toastMock.mock.calls[0][0]).toBe(fallbackMessage);
          }
        )
      );
    }
  );

  it(
    'Property 3d (Preservation): For any HTTP success status in [200, 299], toast is NOT called',
    () => {
      const responseSuccessHandler = getResponseSuccessHandler();

      fc.assert(
        fc.property(
          fc.integer({ min: 200, max: 299 }),
          (statusCode) => {
            toastMock.mockClear();

            const successResponse = {
              status: statusCode,
              data: { success: true },
            };

            // The success handler should pass the response through unchanged
            const result = responseSuccessHandler(successResponse);

            expect(result).toBe(successResponse);
            expect(toastMock).not.toHaveBeenCalled();
          }
        )
      );
    }
  );

  it(
    'Property 3e: Network errors (no response) also trigger toast with a non-empty message',
    async () => {
      const responseErrorHandler = getResponseErrorHandler();

      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 100 }),
          async (errorMessage) => {
            toastMock.mockClear();

            // Simulate a network error — no response object
            const networkError = {
              response: undefined,
              message: errorMessage,
            };

            let didThrow = false;
            try {
              await responseErrorHandler(networkError);
            } catch (_) {
              didThrow = true;
            }

            expect(didThrow).toBe(true);
            expect(toastMock).toHaveBeenCalledTimes(1);

            const [msg, type] = toastMock.mock.calls[0];
            expect(typeof msg).toBe('string');
            expect(msg.length).toBeGreaterThan(0);
            expect(type).toBe('error');
          }
        )
      );
    }
  );
});
