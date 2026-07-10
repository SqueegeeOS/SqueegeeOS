// Node 20 has no global WebSocket (added in Node 22); @supabase/supabase-js
// constructs a RealtimeClient (which requires one) on every client creation,
// even for tests that never open a socket. Provide a minimal stub so client
// construction succeeds under Vitest without requiring Node 22+ locally.
if (typeof globalThis.WebSocket === "undefined") {
  class NoopWebSocket {
    static readonly CONNECTING = 0;
    static readonly OPEN = 1;
    static readonly CLOSING = 2;
    static readonly CLOSED = 3;
    onopen: (() => void) | null = null;
    onclose: (() => void) | null = null;
    onerror: (() => void) | null = null;
    onmessage: (() => void) | null = null;
    readyState = 3;
    close(): void {}
    send(): void {}
  }

  // @ts-expect-error - intentionally partial, test-only polyfill.
  globalThis.WebSocket = NoopWebSocket;
}
