// Test-only stub for the "server-only" import guard. In real Next.js builds
// this package throws when bundled into a Client Component; under Vitest
// there is no RSC boundary to guard, so importing it should be a no-op.
export {};
