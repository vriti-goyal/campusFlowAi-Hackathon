/**
 * Property 4: Bug Condition D — Axios Request Interceptor Attaches Fresh Token
 *
 * For any outgoing axios request while a Firebase user is authenticated, the
 * fixed request interceptor SHALL call `firebaseUser.getIdToken(true)` (force-
 * refresh) and attach the resulting token as the `Authorization: Bearer` header,
 * ensuring requests never carry an expired or cached token.
 *
 * **Validates: Requirements 2.13**
 *
 * Run on FIXED code (post task 6.1).
 * EXPECTED OUTCOME: Test PASSES confirming fresh token is attached on every request.
 */

import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import fc from 'fast-check';

// ── Mock firebase BEFORE importing api.js so the module sees the mock ────
vi.mock('@/lib/firebase', () => ({
  auth: {
    currentUser: null,
  },
}));

// ── Import AFTER mocking ─────────────────────────────────────────────────
import api, { setupInterceptors } from '@/lib/api';
import { auth } from '@/lib/firebase';

// ── Helpers ──────────────────────────────────────────────────────────────

/**
 * Return the fulfilled (success) handler from the most recently registered
 * request interceptor. Using the internal .handlers array mirrors what the
 * existing task-9 test does for the response interceptor.
 */
function getRequestFulfilledHandler() {
  const handlers = api.interceptors.request.handlers;
  for (let i = handlers.length - 1; i >= 0; i--) {
    if (handlers[i] && handlers[i].fulfilled) {
      return handlers[i].fulfilled;
    }
  }
  throw new Error('No request fulfilled interceptor found — did setupInterceptors run?');
}

// ── Suite ─────────────────────────────────────────────────────────────────

describe('Property 4: Axios Request Interceptor — Fresh Token Attached', () => {
  let toastMock;

  beforeAll(() => {
    // Register interceptors exactly once. The module-level guard in api.js
    // (`interceptorsInitialized`) ensures they are only added once even if
    // setupInterceptors is called again — but currentToastFn is always updated.
    toastMock = vi.fn();
    setupInterceptors(toastMock);
  });

  beforeEach(() => {
    // Reset auth.currentUser to null before each test so tests don't bleed
    // into each other. Individual tests that need a user will set it themselves.
    auth.currentUser = null;
    toastMock = vi.fn();
    // Re-call to keep toastFn reference current (interceptors are already registered)
    setupInterceptors(toastMock);
  });

  // ── Sanity check ─────────────────────────────────────────────────────

  it('Request interceptor is registered after setupInterceptors()', () => {
    expect(api.interceptors.request.handlers.length).toBeGreaterThan(0);
    expect(() => getRequestFulfilledHandler()).not.toThrow();
  });

  // ── Property 4a: Authenticated user receives fresh token ─────────────

  it(
    'Property 4a: For any authenticated user, Authorization header is set to Bearer <freshToken>',
    async () => {
      const requestHandler = getRequestFulfilledHandler();

      await fc.assert(
        fc.asyncProperty(
          // Generate non-trivial token strings (min 10 chars, printable ASCII)
          fc.string({ minLength: 10, maxLength: 300 }),
          async (freshToken) => {
            // Build a mock Firebase user whose getIdToken(true) returns freshToken
            const mockUser = {
              uid: 'user-123',
              getIdToken: vi.fn().mockResolvedValue(freshToken),
            };

            auth.currentUser = mockUser;

            const config = { headers: {} };
            const updatedConfig = await requestHandler(config);

            // Authorization header must be set
            expect(updatedConfig.headers['Authorization']).toBeDefined();

            // It must start with 'Bearer '
            expect(updatedConfig.headers['Authorization']).toMatch(/^Bearer /);

            // The token after 'Bearer ' must be exactly the fresh token
            const attachedToken = updatedConfig.headers['Authorization'].slice('Bearer '.length);
            expect(attachedToken).toBe(freshToken);
          }
        )
      );
    }
  );

  // ── Property 4b: getIdToken is always called with force-refresh=true ──

  it(
    'Property 4b: getIdToken is called with force-refresh=true (never cached)',
    async () => {
      const requestHandler = getRequestFulfilledHandler();

      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 10, maxLength: 300 }),
          async (freshToken) => {
            const mockUser = {
              uid: 'user-456',
              getIdToken: vi.fn().mockResolvedValue(freshToken),
            };

            auth.currentUser = mockUser;

            const config = { headers: {} };
            await requestHandler(config);

            // Must have been called exactly once with `true` (force-refresh)
            expect(mockUser.getIdToken).toHaveBeenCalledTimes(1);
            expect(mockUser.getIdToken).toHaveBeenCalledWith(true);
          }
        )
      );
    }
  );

  // ── Property 4c: Fresh token overwrites any pre-existing cached token ─

  it(
    'Property 4c: Fresh token from getIdToken(true) overwrites any previously cached token in config',
    async () => {
      const requestHandler = getRequestFulfilledHandler();

      await fc.assert(
        fc.asyncProperty(
          // staleToken: some old cached token already on the request config
          fc.string({ minLength: 10, maxLength: 200 }),
          // freshToken: what getIdToken(true) returns (must differ from stale)
          fc.string({ minLength: 10, maxLength: 200 }),
          async (staleToken, freshToken) => {
            // Skip the case where stale and fresh happen to be the same string —
            // the property is about "overwrites with fresh", which is vacuously true
            // when they're identical, but we want to test the overwrite specifically.
            fc.pre(staleToken !== freshToken);

            const mockUser = {
              uid: 'user-789',
              getIdToken: vi.fn().mockResolvedValue(freshToken),
            };

            auth.currentUser = mockUser;

            // Config already carries a stale/cached token
            const config = {
              headers: {
                Authorization: `Bearer ${staleToken}`,
              },
            };

            const updatedConfig = await requestHandler(config);

            const attachedToken = updatedConfig.headers['Authorization'].slice('Bearer '.length);

            // The stale token must NOT appear in the header
            expect(attachedToken).not.toBe(staleToken);

            // The fresh token from getIdToken(true) must be present
            expect(attachedToken).toBe(freshToken);
          }
        )
      );
    }
  );

  // ── Property 4d: Preserves existing headers other than Authorization ──

  it(
    'Property 4d: Non-Authorization headers are preserved unchanged',
    async () => {
      const requestHandler = getRequestFulfilledHandler();

      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 10, maxLength: 200 }),
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.string({ minLength: 1, maxLength: 100 }),
          async (freshToken, headerName, headerValue) => {
            // Avoid any variation of 'authorization' as the custom header
            fc.pre(headerName.toLowerCase() !== 'authorization');

            const mockUser = {
              uid: 'user-preserve',
              getIdToken: vi.fn().mockResolvedValue(freshToken),
            };

            auth.currentUser = mockUser;

            const config = {
              headers: {
                [headerName]: headerValue,
                'Content-Type': 'application/json',
              },
            };

            const updatedConfig = await requestHandler(config);

            // Custom header must be unchanged
            expect(updatedConfig.headers[headerName]).toBe(headerValue);

            // Content-Type must be unchanged
            expect(updatedConfig.headers['Content-Type']).toBe('application/json');

            // Authorization must still be set with the fresh token
            expect(updatedConfig.headers['Authorization']).toBe(`Bearer ${freshToken}`);
          }
        )
      );
    }
  );

  // ── Null user path ────────────────────────────────────────────────────

  it(
    'Null auth.currentUser: config is passed through unchanged (no Authorization set, no error)',
    async () => {
      const requestHandler = getRequestFulfilledHandler();

      auth.currentUser = null;

      const config = { headers: { 'Content-Type': 'application/json' } };

      // Must not throw
      let result;
      await expect(async () => {
        result = await requestHandler(config);
      }).not.toThrow();

      // Config returned unchanged — no Authorization header added
      expect(result.headers['Authorization']).toBeUndefined();

      // Existing headers preserved
      expect(result.headers['Content-Type']).toBe('application/json');
    }
  );

  it(
    'Null auth.currentUser: property holds for any pre-existing config headers',
    async () => {
      const requestHandler = getRequestFulfilledHandler();

      await fc.assert(
        fc.asyncProperty(
          fc.dictionary(
            fc.string({ minLength: 1, maxLength: 30 }).filter(
              (k) => k.toLowerCase() !== 'authorization'
            ),
            fc.string({ minLength: 0, maxLength: 100 })
          ),
          async (extraHeaders) => {
            auth.currentUser = null;

            const config = { headers: { ...extraHeaders } };
            const updatedConfig = await requestHandler(config);

            // No Authorization header must be added when user is null
            expect(updatedConfig.headers['Authorization']).toBeUndefined();

            // All original headers must be intact
            for (const [key, value] of Object.entries(extraHeaders)) {
              expect(updatedConfig.headers[key]).toBe(value);
            }
          }
        )
      );
    }
  );

  // ── Token format sanity ───────────────────────────────────────────────

  it(
    'Property 4e: Authorization header always has exactly the format "Bearer <token>" (no double-Bearer)',
    async () => {
      const requestHandler = getRequestFulfilledHandler();

      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 10, maxLength: 200 }),
          async (freshToken) => {
            const mockUser = {
              uid: 'user-fmt',
              getIdToken: vi.fn().mockResolvedValue(freshToken),
            };

            auth.currentUser = mockUser;

            const config = { headers: {} };
            const updatedConfig = await requestHandler(config);

            const authHeader = updatedConfig.headers['Authorization'];

            // Must start with exactly 'Bearer ' (one space, no double prefix)
            expect(authHeader.startsWith('Bearer ')).toBe(true);
            expect(authHeader.startsWith('Bearer Bearer ')).toBe(false);

            // The part after 'Bearer ' must equal freshToken exactly
            expect(authHeader).toBe(`Bearer ${freshToken}`);
          }
        )
      );
    }
  );
});
