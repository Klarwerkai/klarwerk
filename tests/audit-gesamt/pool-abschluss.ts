export interface ClientMitEnde {
  once(ereignis: "end", listener: () => void): unknown;
}

export interface PoolMitEnde {
  on(ereignis: "connect", listener: (client: ClientMitEnde) => void): unknown;
  off(ereignis: "connect", listener: (client: ClientMitEnde) => void): unknown;
  end(): Promise<void>;
}

// Vor der ersten Verbindung anbringen: Pool.end() kann vor dem tatsächlichen Clientende erfüllen.
export function poolAbschluss(pool: PoolMitEnde): () => Promise<void> {
  const clientEnden: Promise<void>[] = [];
  const verbunden = (client: ClientMitEnde) => {
    clientEnden.push(
      new Promise<void>((resolve) => {
        client.once("end", resolve);
      }),
    );
  };
  pool.on("connect", verbunden);
  let abschluss: Promise<void> | undefined;
  async function schliessen(): Promise<void> {
    await pool.end();
    await Promise.all(clientEnden);
    pool.off("connect", verbunden);
  }
  return () => {
    abschluss ??= schliessen();
    return abschluss;
  };
}
