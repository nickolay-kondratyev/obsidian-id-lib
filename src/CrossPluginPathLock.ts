// ── Cross-plugin, cross-VERSION per-path lock ─────────────────────────────────
// This library is BUNDLED into each consuming plugin, so N plugins hold N copies
// of this code — and they will be DIFFERENT VERSIONS, because plugins upgrade on
// their own schedules. Those copies never share module state; the ONLY channel
// between them is the window/globalThis object. So the lock lives there, and the
// shape of what lives there is a frozen wire contract every version must honor.
//
//   THE FROZEN CONTRACT (change only as a deliberate, coordinated break):
//     1. KEY      — the exact string `ID_LOCK_REGISTRY_KEY` below. All copies
//                   rendezvous on this literal; a rename/`_v1_`-bump makes an old
//                   and a new copy key off different slots, each builds its own
//                   registry, and same-path work STOPS serializing across them.
//     2. VALUE    — a plain `Map<string, Promise<unknown>>`: path → tail promise.
//                   Plain builtins only (no Map subclass, no custom thenable), so
//                   a foreign copy's Map.get/set/delete and `tail.then(...)`
//                   behave exactly as it expects.
//     3. PROTOCOL — how a copy acquires/releases against a path's tail (see
//                   runExclusive): chain off the tail swallowing its rejection;
//                   store a never-rejecting tail; release IS the tail settling
//                   (no expiry); only the current tail (`=== next`) deletes its
//                   entry. A different version may re-implement this class however
//                   it likes, but MUST obey these steps or it corrupts shared
//                   paths for every other version living beside it.
//
// Everything else here (class name, internals, helpers) is free to evolve. The
// frozen surface is pinned by the `cross-version wire contract` tests in
// CrossPluginPathLock.test.ts and documented in README.md at
// ref.ap_e7fWGWziwxrLmnegjIYKX_E — keep all three in lockstep.

/**
 * FROZEN CONTRACT part 1 — the versioned registry key (public cross-version API).
 * Every bundled copy, of every plugin, of every version, rendezvous on this exact
 * literal. Bump the `_v1_` suffix ONLY as a deliberate breaking change that
 * intentionally partitions this version's locking from all prior deployed ones.
 */
export const ID_LOCK_REGISTRY_KEY = '__obsidian_id_lib_path_lock_registry_v1__';

type LockRegistry = Map<string, Promise<unknown>>;

const NOOP = (): void => undefined;

export interface PathLock {
  /**
   * Runs task exclusively per path: same path serializes (FIFO), distinct
   * paths run in parallel. The caller observes the task's own result or
   * rejection; the lock is always released (no timeout/expiry).
   */
  runExclusive<T>(path: string, task: () => Promise<T>): Promise<T>;
}

/**
 * The reference implementation of the cross-version lock protocol. Its registry
 * lives on a shared host object (window/globalThis), so every bundled copy of
 * this library — across plugins AND across versions — serializes same-path work
 * through ONE promise chain per path. This class is free to evolve; the frozen
 * KEY/VALUE/PROTOCOL surface it speaks (file header) is not.
 */
export class CrossPluginPathLock implements PathLock {
  /**
   * registryHost: where the versioned key lives. Default globalThis
   * (=== window in Obsidian's renderer). Tests pass a fresh {} for
   * isolation / to simulate two bundled copies sharing one window.
   */
  constructor(private readonly registryHost: object = globalThis) {
  }

  // This is one conforming implementation of the FROZEN PROTOCOL (contract
  // step 3, file header). Each numbered step below is a contract clause, not an
  // implementation choice: a different lib version may write this method
  // differently, but the predecessor it reads and the tail it stores here are
  // shared with THAT version, so it must uphold the same four guarantees.
  runExclusive<T>(path: string, task: () => Promise<T>): Promise<T> {
    const registry = this.getOrCreateRegistry();
    const predecessor = registry.get(path) ?? Promise.resolve();
    // (3a) Acquire by chaining off the path's current tail — this is what makes
    // OUR task wait for whatever another version queued before us. Swallow the
    // predecessor's rejection: a foreign copy may have stored a rejecting tail,
    // and its failure must not wedge this waiter.
    const run = predecessor.then(NOOP, NOOP).then(task);
    // (3b) Store a tail that NEVER rejects. A foreign successor may chain off it
    // WITHOUT swallowing (its version's business), so OUR task's failure must
    // not wedge it. (3c) The tail settling — on success or throw — IS the
    // release; there is deliberately no timeout/expiry a foreign copy would have
    // to know about.
    const next = run.then(NOOP, NOOP);
    registry.set(path, next);
    // (3d) Only the CURRENT tail removes the entry (`=== next` guard). A queued
    // successor — possibly from another version — has already overwritten the
    // slot with its own tail; a predecessor's cleanup must not detach it.
    void next.then(() => {
      if (registry.get(path) === next) {
        registry.delete(path);
      }
    });
    return run;
  }

  private getOrCreateRegistry(): LockRegistry {
    // Boundary cast: the host is an untyped shared global (window).
    const host = this.registryHost as Record<string, unknown>;
    const existing = host[ID_LOCK_REGISTRY_KEY];
    if (existing instanceof Map) {
      // Adopt whatever a foreign copy already created — that shared Map IS the
      // rendezvous point. Trusted per the frozen VALUE contract (step 2): the
      // key only ever holds a Map<string, Promise<unknown>>, so any version's
      // registry is safe for this version to get/set/delete on.
      return existing as LockRegistry;
    }
    const created: LockRegistry = new Map();
    host[ID_LOCK_REGISTRY_KEY] = created;
    return created;
  }
}
