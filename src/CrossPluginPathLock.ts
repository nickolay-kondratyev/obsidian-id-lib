// ── Cross-plugin per-path lock ────────────────────────────────────────────────
// This library is BUNDLED into each consuming plugin, so two plugins hold two
// copies of this code. The only shared-state channel between the copies is the
// window/globalThis object — the lock registry lives there under a versioned
// key, and its name + value shape are a cross-plugin compatibility contract.
// Contract documented in README.md at ref.ap_e7fWGWziwxrLmnegjIYKX_E.

/**
 * The versioned registry key (public cross-plugin API). Value shape:
 * a plain Map<string, Promise<unknown>> — path → current tail promise.
 * Plain promises only, so differently-versioned bundled copies interoperate.
 * Bump the `_v1_` suffix ONLY as a deliberate breaking change.
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
 * PathLock whose registry lives on a shared host object (window/globalThis),
 * so every bundled copy of this library — across plugins and versions —
 * serializes same-path work through ONE promise chain per path.
 */
export class CrossPluginPathLock implements PathLock {
  /**
   * registryHost: where the versioned key lives. Default globalThis
   * (=== window in Obsidian's renderer). Tests pass a fresh {} for
   * isolation / to simulate two bundled copies sharing one window.
   */
  constructor(private readonly registryHost: object = globalThis) {
  }

  runExclusive<T>(path: string, task: () => Promise<T>): Promise<T> {
    const registry = this.getOrCreateRegistry();
    const predecessor = registry.get(path) ?? Promise.resolve();
    // Swallow predecessor rejection: a FOREIGN lib copy may have stored a
    // rejecting promise — its failure must not wedge this waiter.
    const run = predecessor.then(NOOP, NOOP).then(task);
    // Store a tail that NEVER rejects, so foreign waiters (which may not
    // swallow) cannot be wedged by OUR task's failure. The tail settling on
    // success or throw IS the release (the finally semantics — no expiry).
    const next = run.then(NOOP, NOOP);
    registry.set(path, next);
    // Tail cleanup: only the CURRENT tail removes the entry — a queued
    // successor must not be detached by its predecessor's cleanup.
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
      // Trusted per the cross-plugin contract: the key only ever holds a
      // Map<string, Promise<unknown>> (see ID_LOCK_REGISTRY_KEY doc).
      return existing as LockRegistry;
    }
    const created: LockRegistry = new Map();
    host[ID_LOCK_REGISTRY_KEY] = created;
    return created;
  }
}
