import "@testing-library/jest-dom";

/**
 * `matchMedia` shim for jsdom component tests.
 *
 * Guarded so node-environment suites can share this setup file: the proxy tests
 * (`@vitest-environment node`) need node's own `Request`/`Headers` rather than
 * jsdom's, and there is no `window` there.
 */
if (typeof window !== "undefined") {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => {},
    }),
  });
}
