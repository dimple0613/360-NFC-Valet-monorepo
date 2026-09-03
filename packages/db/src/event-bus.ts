// FR-133: a domain event bus so modules/plugins can react to core lifecycle
// events without core knowing they exist (per CLAUDE.md's "modules self-register"
// principle — core publishes, modules subscribe, no hardcoded list of listeners).
// In-process pub/sub to start, per ROADMAP.md; swapping in a durable queue-backed
// bus later shouldn't need to change `on`/`emit` call sites.
//
// FR-102 lists domain events among the things that must be tenant-scoped: event
// payloads carry organizationId explicitly (they're plain serializable objects,
// not closures), and a handler that needs to do DB work is responsible for
// wrapping it in runWithTenant(payload.organizationId, ...) itself — the bus
// doesn't do this for you, since not every event is organization-scoped.

export type EventHandler<T> = (payload: T) => void | Promise<void>;

export class EventBus {
  private handlers = new Map<string, Set<EventHandler<never>>>();

  /** Subscribes to `eventName`. Returns an unsubscribe function. */
  on<T>(eventName: string, handler: EventHandler<T>): () => void {
    const set = this.handlers.get(eventName) ?? new Set();
    set.add(handler as EventHandler<never>);
    this.handlers.set(eventName, set);
    return () => set.delete(handler as EventHandler<never>);
  }

  /**
   * Runs every handler registered for `eventName` with `payload`, sequentially,
   * awaiting each. A handler that throws stops the remaining handlers for this
   * emit and the error propagates to the caller — emit is not fire-and-forget;
   * callers that want lifecycle actions to succeed even if a listener fails
   * should catch around their own emit call.
   */
  async emit<T>(eventName: string, payload: T): Promise<void> {
    const set = this.handlers.get(eventName);
    if (!set) return;
    for (const handler of set) {
      await handler(payload as never);
    }
  }
}

/** Process-wide singleton — same hot-reload guard pattern as the Prisma client in client.ts. */
declare global {
  // eslint-disable-next-line no-var
  var __eventBus: EventBus | undefined;
}

export const eventBus = globalThis.__eventBus ?? new EventBus();

if (process.env.NODE_ENV !== "production") {
  globalThis.__eventBus = eventBus;
}
