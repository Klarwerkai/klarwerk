// Gemeinsame Vorrichtungen der Kundenbetriebsproben: ein echter HTTP-Server, der `/health`
// beantwortet, und ein Node-Kindprozess, der asynchron läuft — ein synchroner Aufruf hielte die
// Ereignisschleife an, und der Server in DIESEM Prozess könnte nie antworten.
import { execFile } from "node:child_process";
import { type Server, createServer } from "node:http";
import type { AddressInfo } from "node:net";

export interface Lauf {
  readonly code: number | null;
  readonly stdout: string;
  readonly stderr: string;
}

/** Startet `node <args>` und wartet auf das Ende, ohne die Ereignisschleife anzuhalten. */
export function fahreNode(args: readonly string[], env?: NodeJS.ProcessEnv): Promise<Lauf> {
  return new Promise((fertig) => {
    execFile(
      "node",
      [...args],
      { encoding: "utf8", env: env ?? process.env, timeout: 30_000 },
      (fehler, stdout, stderr) => {
        const roh = (fehler as { code?: unknown } | null)?.code;
        const code = fehler === null ? 0 : typeof roh === "number" ? roh : null;
        fertig({ code, stdout, stderr });
      },
    );
  });
}

export interface HealthServer {
  readonly port: number;
  readonly adresse: string;
  schliessen(): Promise<void>;
}

/** Ein Server auf 127.0.0.1, der unter `/health` die Antwort der Funktion liefert. */
export async function healthServer(antwort: (adresse: string) => unknown): Promise<HealthServer> {
  let adresse = "";
  const server: Server = createServer((anfrage, rueckgabe) => {
    if (anfrage.url !== "/health") {
      rueckgabe.statusCode = 404;
      rueckgabe.end();
      return;
    }
    rueckgabe.setHeader("content-type", "application/json");
    rueckgabe.end(JSON.stringify(antwort(adresse)));
  });
  await new Promise<void>((bereit) => server.listen(0, "127.0.0.1", () => bereit()));
  const port = (server.address() as AddressInfo).port;
  adresse = `http://127.0.0.1:${port}`;
  return {
    port,
    adresse,
    schliessen: () => new Promise<void>((zu) => server.close(() => zu())),
  };
}

/** Eine Adresse, unter der gerade nichts horcht: Server öffnen, Port merken, wieder schliessen. */
export async function freieAdresse(): Promise<string> {
  const server = await healthServer(() => ({}));
  await server.schliessen();
  return server.adresse;
}
