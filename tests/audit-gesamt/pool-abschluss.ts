export interface ClientMitEnde {
  once(ereignis: "end", listener: () => void): unknown;
  off(ereignis: "end", listener: () => void): unknown;
}

export interface PoolMitEnde {
  on(ereignis: "connect" | "remove", listener: (client: ClientMitEnde) => void): unknown;
  off(ereignis: "connect" | "remove", listener: (client: ClientMitEnde) => void): unknown;
  end(): Promise<void>;
}

// Ab Erzeugung anbringen. Pool.end() allein bestätigt noch nicht jedes tatsächliche Clientende.
// Public remove wird von pg-pool erst im Client.end-Callback gemeldet; Client.end ist ebenfalls
// eine Abschlussbestätigung. Beide Wege lösen denselben Beobachter genau einmal.
export function poolAbschluss(pool: PoolMitEnde): () => Promise<void> {
  const offen = new Map<
    ClientMitEnde,
    { warten: Promise<void>; freigeben: () => void; listener: () => void }
  >();
  const beendet = (client: ClientMitEnde) => {
    const ende = offen.get(client);
    if (!ende) return;
    offen.delete(client);
    client.off("end", ende.listener);
    ende.freigeben();
  };
  const verbunden = (client: ClientMitEnde) => {
    if (offen.has(client)) return;
    let freigeben!: () => void;
    const warten = new Promise<void>((resolve) => {
      freigeben = resolve;
    });
    const listener = () => beendet(client);
    offen.set(client, { warten, freigeben, listener });
    client.once("end", listener);
  };
  pool.on("connect", verbunden);
  pool.on("remove", beendet);

  let abschluss: Promise<void> | undefined;
  async function schliessen(): Promise<void> {
    try {
      let abgelehnt = false;
      let fehler: unknown;
      try {
        await pool.end();
      } catch (ursache) {
        abgelehnt = true;
        fehler = ursache;
      }
      // Auch nach einer Ablehnung zuerst alle beobachteten eigenen Verbindungen abwarten.
      while (offen.size > 0) {
        await Promise.all([...offen.values()].map((ende) => ende.warten));
      }
      if (abgelehnt) throw fehler;
    } finally {
      pool.off("connect", verbunden);
      pool.off("remove", beendet);
      for (const [client, ende] of offen) client.off("end", ende.listener);
      offen.clear();
    }
  }
  return () => {
    abschluss ??= schliessen();
    return abschluss;
  };
}
