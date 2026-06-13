import { describe, it, expect, vi, beforeEach } from 'vitest';
import fc from 'fast-check';
import api, { setupInterceptors } from '@/lib/api';
import { auth } from '@/lib/firebase';

// Mock firebase
vi.mock('@/lib/firebase', () => ({
  auth: {
    currentUser: null
  }
}));

describe('Interceptor Properties', () => {
  let toastMock;

  beforeEach(() => {
    toastMock = vi.fn();
  });

  it('Property 3: Axios Response Interceptor Displays Toast for All Error Status Codes', async () => {
    // We register it once — this also updates currentToastFn in api.js
    setupInterceptors(toastMock);

    // Find the response error handler from the registered interceptors
    function getResponseErrorHandler() {
      const handlers = api.interceptors.response.handlers;
      for (let i = handlers.length - 1; i >= 0; i--) {
        if (handlers[i] && handlers[i].rejected) return handlers[i].rejected;
      }
      throw new Error('No response error interceptor found');
    }

    const responseErrorHandler = getResponseErrorHandler();

    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 400, max: 599 }),
        async (statusCode) => {
          toastMock.mockClear();
          // Re-register to ensure currentToastFn points at the current toastMock
          setupInterceptors(toastMock);

          const errorObj = {
            response: {
              status: statusCode,
              data: { error: 'Test error' }
            }
          };

          try {
            await responseErrorHandler(errorObj);
          } catch (e) {
            // Expected to throw
          }

          expect(toastMock).toHaveBeenCalledWith('Test error', 'error');
        }
      )
    );
  });

  it('Preservation: No toast for 200-299 status codes', () => {
    setupInterceptors(toastMock);

    function getResponseSuccessHandler() {
      const handlers = api.interceptors.response.handlers;
      for (let i = handlers.length - 1; i >= 0; i--) {
        if (handlers[i] && handlers[i].fulfilled) return handlers[i].fulfilled;
      }
      throw new Error('No response success interceptor found');
    }

    const responseSuccessHandler = getResponseSuccessHandler();

    fc.assert(
      fc.property(
        fc.integer({ min: 200, max: 299 }),
        (statusCode) => {
          toastMock.mockClear();
          const responseObj = { status: statusCode };
          
          const result = responseSuccessHandler(responseObj);
          expect(result).toBe(responseObj);
          expect(toastMock).not.toHaveBeenCalled();
        }
      )
    );
  });

  it('Property 4: Axios Request Interceptor Attaches Fresh Token for Any Authenticated User', async () => {
    setupInterceptors(toastMock);

    function getRequestHandler() {
      const handlers = api.interceptors.request.handlers;
      for (let i = handlers.length - 1; i >= 0; i--) {
        if (handlers[i] && handlers[i].fulfilled) return handlers[i].fulfilled;
      }
      throw new Error('No request interceptor found');
    }

    const requestHandler = getRequestHandler();

    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 10 }),
        async (freshToken) => {
          auth.currentUser = {
            getIdToken: vi.fn().mockResolvedValue(freshToken)
          };

          const config = { headers: {} };
          const newConfig = await requestHandler(config);

          expect(newConfig.headers['Authorization']).toBe(`Bearer ${freshToken}`);
          expect(auth.currentUser.getIdToken).toHaveBeenCalledWith(true);
        }
      )
    );
  });

  it('Property 4: Request Interceptor passes config through if no user', async () => {
    setupInterceptors(toastMock);

    function getRequestHandler() {
      const handlers = api.interceptors.request.handlers;
      for (let i = handlers.length - 1; i >= 0; i--) {
        if (handlers[i] && handlers[i].fulfilled) return handlers[i].fulfilled;
      }
      throw new Error('No request interceptor found');
    }

    const requestHandler = getRequestHandler();

    auth.currentUser = null;
    const config = { headers: { 'X-Custom': '123' } };
    const newConfig = await requestHandler(config);

    expect(newConfig.headers['Authorization']).toBeUndefined();
    expect(newConfig.headers['X-Custom']).toBe('123');
  });
});
