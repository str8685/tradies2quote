// Empty stub — replaces the real `server-only` package during Vitest runs so
// that server-side modules (which import "server-only" to prevent client
// bundling) can be unit-tested in plain Node.
export {};
