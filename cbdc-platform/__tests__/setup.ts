import "@testing-library/jest-dom";

// Required env vars consumed by lib/env.ts at import time
process.env.APP_ROLE = process.env.APP_ROLE ?? "operator";
process.env.DLT_API_URL = process.env.DLT_API_URL ?? "http://localhost:3000";
process.env.DLT_API_KEY = process.env.DLT_API_KEY ?? "test-key";
process.env.ORG_ID = process.env.ORG_ID ?? "bi-central";
process.env.DATABASE_URL = process.env.DATABASE_URL ?? "postgresql://cbdc:cbdc@localhost:5432/cbdc_platform";
process.env.AUTH_SECRET = process.env.AUTH_SECRET ?? "test-secret-32-chars-minimum-len!!!";

// jsdom does not implement window.matchMedia; next-themes requires it
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
    dispatchEvent: () => false,
  }),
});
