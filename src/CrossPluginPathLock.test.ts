import { describe, expect, it } from 'vitest';
import { CrossPluginPathLock, ID_LOCK_REGISTRY_KEY } from './CrossPluginPathLock';

/** Deferred promise whose settle moment the test controls. */
interface Deferred {
  promise: Promise<void>;
  resolve: () => void;
  reject: (error: unknown) => void;
}

function deferred(): Deferred {
  let resolve!: () => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<void>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

/** Lets already-settled promise chains run to completion (macrotask hop). */
function flushAsync(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

/** The registry the lock created on the host — for white-box assertions. */
function registryOn(host: Record<string, unknown>): Map<string, Promise<unknown>> {
  const registry = host[ID_LOCK_REGISTRY_KEY];
  if (!(registry instanceof Map)) {
    throw new Error('registry not created on host');
  }
  return registry as Map<string, Promise<unknown>>;
}

describe('CrossPluginPathLock', () => {
  describe('runExclusive', () => {
    it('should serialize same-path tasks: the second does not start until the first resolves (AC-L1)', async () => {
      // GIVEN two tasks contending for one path
      const lock = new CrossPluginPathLock({});
      const gate = deferred();
      const log: string[] = [];
      const first = lock.runExclusive('a', async () => {
        log.push('start1');
        await gate.promise;
        log.push('end1');
      });
      const second = lock.runExclusive('a', async () => {
        log.push('start2');
      });
      // WHEN the first task is still running
      await flushAsync();
      const logWhileFirstRuns = [...log];
      // AND the first task completes
      gate.resolve();
      await Promise.all([first, second]);
      // THEN the second task only ran after the first finished
      expect({ logWhileFirstRuns, log })
        .toEqual({ logWhileFirstRuns: ['start1'], log: ['start1', 'end1', 'start2'] });
    });

    it('should run distinct-path tasks in parallel (AC-L2)', async () => {
      // GIVEN a task on 'a' that never finishes within the test window
      const lock = new CrossPluginPathLock({});
      const gate = deferred();
      void lock.runExclusive('a', () => gate.promise);
      // WHEN a task on 'b' is submitted
      const resultOnB = await lock.runExclusive('b', async () => 'b-done');
      // THEN it ran to completion while 'a' stayed blocked
      expect(resultOnB).toBe('b-done');
      gate.resolve();
    });

    it('should surface a task rejection to its caller AND still run the queued successor (AC-L3)', async () => {
      // GIVEN a rejecting first task and a queued second task on the same path
      const lock = new CrossPluginPathLock({});
      const first = lock.runExclusive('a', async () => {
        throw new Error('boom');
      });
      const second = lock.runExclusive('a', async () => 'second-ran');
      // WHEN / THEN the caller sees the rejection and the successor is released
      await expect(first).rejects.toThrow('boom');
      expect(await second).toBe('second-ran');
    });

    it('should store a tail promise that never rejects even when the task throws (AC-L4)', async () => {
      // GIVEN a throwing task
      const host: Record<string, unknown> = {};
      const lock = new CrossPluginPathLock(host);
      const run = lock.runExclusive('a', async () => {
        throw new Error('boom');
      });
      // capture the stored tail synchronously, before cleanup deletes it
      const storedTail = registryOn(host).get('a');
      // WHEN the task rejects
      await expect(run).rejects.toThrow('boom');
      // THEN the stored tail RESOLVES (foreign-version waiters are protected)
      await expect(storedTail).resolves.toBeUndefined();
    });

    it('should delete the Map entry after the sole task settles (AC-L5a)', async () => {
      // GIVEN a sole task
      const host: Record<string, unknown> = {};
      const lock = new CrossPluginPathLock(host);
      // WHEN it settles and cleanup runs
      await lock.runExclusive('a', async () => 'done');
      await flushAsync();
      // THEN the path entry is gone (no unbounded registry growth)
      expect(registryOn(host).has('a')).toBe(false);
    });

    it('should NOT let a predecessor cleanup detach a queued successor (AC-L5b)', async () => {
      // GIVEN a running first task and a queued second task
      const host: Record<string, unknown> = {};
      const lock = new CrossPluginPathLock(host);
      const gate1 = deferred();
      const gate2 = deferred();
      const first = lock.runExclusive('a', () => gate1.promise);
      void lock.runExclusive('a', () => gate2.promise);
      const successorTail = registryOn(host).get('a');
      // WHEN the first task settles and its cleanup runs
      gate1.resolve();
      await first;
      await flushAsync();
      // THEN the entry still points at the successor's tail (=== next guard held)
      expect(registryOn(host).get('a')).toBe(successorTail);
      gate2.resolve();
    });

    it('should serialize same-path tasks across TWO lock instances sharing one host (AC-L6, two bundled copies)', async () => {
      // GIVEN two lock instances (two plugins' bundled lib copies) on one window
      const host: Record<string, unknown> = {};
      const lockOfPluginA = new CrossPluginPathLock(host);
      const lockOfPluginB = new CrossPluginPathLock(host);
      const gate = deferred();
      const log: string[] = [];
      const first = lockOfPluginA.runExclusive('a', async () => {
        log.push('start1');
        await gate.promise;
        log.push('end1');
      });
      const second = lockOfPluginB.runExclusive('a', async () => {
        log.push('start2');
      });
      // WHEN plugin A's task is still running
      await flushAsync();
      const logWhileFirstRuns = [...log];
      gate.resolve();
      await Promise.all([first, second]);
      // THEN plugin B's task waited for plugin A's to finish
      expect({ logWhileFirstRuns, log })
        .toEqual({ logWhileFirstRuns: ['start1'], log: ['start1', 'end1', 'start2'] });
    });

    it('should wait for a foreign pre-seeded pending tail before running (AC-L7a)', async () => {
      // GIVEN a registry pre-seeded by an older lib version with a pending tail
      const host: Record<string, unknown> = {};
      const foreignGate = deferred();
      const registry = new Map<string, Promise<unknown>>([['a', foreignGate.promise]]);
      host[ID_LOCK_REGISTRY_KEY] = registry;
      const lock = new CrossPluginPathLock(host);
      const log: string[] = [];
      const run = lock.runExclusive('a', async () => {
        log.push('ran');
      });
      // WHEN the foreign tail is still pending
      await flushAsync();
      const logWhileForeignPending = [...log];
      // AND the foreign tail settles
      foreignGate.resolve();
      await run;
      // THEN our task waited for it
      expect({ logWhileForeignPending, log }).toEqual({ logWhileForeignPending: [], log: ['ran'] });
    });

    it('should not be wedged by a foreign REJECTING tail (AC-L7b, predecessor rejection swallowed)', async () => {
      // GIVEN a registry pre-seeded with a rejecting foreign tail
      const host: Record<string, unknown> = {};
      const foreignTail = Promise.reject(new Error('foreign failure'));
      foreignTail.catch(() => undefined); // avoid unhandled-rejection noise
      const registry = new Map<string, Promise<unknown>>([['a', foreignTail]]);
      host[ID_LOCK_REGISTRY_KEY] = registry;
      const lock = new CrossPluginPathLock(host);
      // WHEN / THEN our task still runs and resolves
      expect(await lock.runExclusive('a', async () => 'survived')).toBe('survived');
    });
  });

  // ── Cross-version wire contract ─────────────────────────────────────────────
  // These pin the shared-state SHAPE that lets a differently-versioned bundled
  // copy interoperate (README ap_e7fWGWziwxrLmnegjIYKX_E). Behavioral tests above
  // import ID_LOCK_REGISTRY_KEY as a symbol, so they would still pass if the key
  // literal or value shape silently changed — these guard exactly that, so a
  // contract-breaking change can only happen deliberately (a failing test).
  describe('cross-version wire contract', () => {
    it('should keep the registry key at the FROZEN v1 literal (foreign copies key off this exact string)', () => {
      // A rename or _v1_ bump silently stops old and new copies from sharing one
      // registry — each would create its own, and same-path work would NOT
      // serialize across versions. Change this literal only as a deliberate break.
      expect(ID_LOCK_REGISTRY_KEY).toBe('__obsidian_id_lib_path_lock_registry_v1__');
    });

    it('should store the registry as a PLAIN Map (foreign copies do Map.get/set/delete on it)', () => {
      // GIVEN a fresh host
      const host: Record<string, unknown> = {};
      const lock = new CrossPluginPathLock(host);
      // WHEN the registry is created
      void lock.runExclusive('a', async () => 'x');
      // THEN it is a plain Map instance — not a subclass with overridden methods
      // a foreign copy might not honor (value shape = Map<string, Promise>)
      expect(Object.getPrototypeOf(host[ID_LOCK_REGISTRY_KEY])).toBe(Map.prototype);
    });

    it('should store a NATIVE Promise as the tail (foreign copies call .then on it)', () => {
      // GIVEN a fresh host and an in-flight task holding the tail
      const host: Record<string, unknown> = {};
      const lock = new CrossPluginPathLock(host);
      void lock.runExclusive('a', () => new Promise<void>(() => undefined));
      const tail = registryOn(host).get('a');
      // THEN the tail is a native Promise (not a custom thenable/subclass) so a
      // foreign copy's `tail.then(...)` acquire step behaves as the protocol expects
      expect(Object.getPrototypeOf(tail)).toBe(Promise.prototype);
    });
  });
});
