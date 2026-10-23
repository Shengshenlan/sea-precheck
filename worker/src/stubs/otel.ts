// Stub for @opentelemetry/api, pulled in transitively by pi-ai -> @mistralai/mistralai (unused provider).
const noopSpan = { setAttribute() {}, setAttributes() {}, setStatus() {}, recordException() {}, end() {}, addEvent() {}, isRecording: () => false, spanContext: () => ({}) };
const tracer = { startSpan: () => noopSpan, startActiveSpan: (_n: string, ...a: any[]) => a[a.length - 1](noopSpan) };
export const trace = { getTracer: () => tracer, getActiveSpan: () => undefined, setSpan: (c: unknown) => c };
export const context = { active: () => ({}), with: (_c: unknown, fn: () => unknown) => fn() };
export const propagation = { inject() {}, extract: (c: unknown) => c };
export const SpanStatusCode = { UNSET: 0, OK: 1, ERROR: 2 };
export const SpanKind = { INTERNAL: 0, SERVER: 1, CLIENT: 2 };
export default { trace, context, propagation, SpanStatusCode, SpanKind };
