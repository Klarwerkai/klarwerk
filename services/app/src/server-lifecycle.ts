// Geordneter Abschluss der vorhandenen Arbeiten dieser Serverinstanz.
export interface SignalPort {
  on(signal: "SIGTERM" | "SIGINT", listener: () => void): unknown;
  off(signal: "SIGTERM" | "SIGINT", listener: () => void): unknown;
}

export function serverLifecycle(deps: {
  closeApp: () => Promise<unknown>;
  closePool: () => Promise<unknown>;
  workerIdle: () => Promise<unknown>;
}) {
  const stopps: (() => void)[] = [];
  const arbeit = new Set<Promise<unknown>>();
  let beendet = false;
  let ressourcen: Promise<void> | undefined;
  let abschluss: Promise<void> | undefined;
  const stoppeTakte = (): void => {
    beendet = true;
    for (const stopp of stopps.splice(0)) stopp();
  };
  const verfolge = <T>(p: Promise<T>): Promise<T> => {
    arbeit.add(p);
    void p.then(
      () => arbeit.delete(p),
      () => arbeit.delete(p),
    );
    return p;
  };
  const schliesseRessourcen = (): Promise<void> => {
    if (!ressourcen)
      ressourcen = (async () => {
        stoppeTakte();
        while (arbeit.size) await Promise.allSettled([...arbeit]);
        try {
          await deps.workerIdle();
        } finally {
          await deps.closePool();
        }
      })();
    return ressourcen;
  };
  const beende = (): Promise<void> => {
    if (!abschluss)
      abschluss = (async () => {
        stoppeTakte();
        try {
          await deps.closeApp();
        } finally {
          await schliesseRessourcen();
        }
      })();
    return abschluss;
  };
  return {
    verfolge,
    lauf<T>(fn: () => Promise<T>): () => Promise<T> {
      return () =>
        beendet ? Promise.resolve(undefined as T) : verfolge(Promise.resolve().then(fn));
    },
    takt<T extends { stop: () => void } | null>(handle: T): T {
      if (handle) {
        if (beendet) handle.stop();
        else stopps.push(() => handle.stop());
      }
      return handle;
    },
    stoppeTakte,
    schliesseRessourcen,
    beende,
    get beendet() {
      return beendet;
    },
  };
}

export function registriereServerSignale(
  port: SignalPort,
  beende: () => Promise<void>,
  fehler: () => void,
): () => void {
  const signal = (): void => {
    void beende().catch(fehler);
  };
  port.on("SIGTERM", signal);
  port.on("SIGINT", signal);
  return () => {
    port.off("SIGTERM", signal);
    port.off("SIGINT", signal);
  };
}

/** Auch ein Fehler vor dem Aufbau der HTTP-App gibt den bereits erzeugten Pool frei. */
export async function initialisiereMitPool<T>(
  pool: { end: () => Promise<unknown> },
  initialisieren: () => Promise<T>,
): Promise<T> {
  try {
    return await initialisieren();
  } catch (error) {
    await pool.end();
    throw error;
  }
}
