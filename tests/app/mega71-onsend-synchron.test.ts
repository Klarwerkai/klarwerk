// ================================================================================================
// AUFTRAG-mega71 BLOCK A — DIE SEND-PIPELINE BLEIBT ATOMAR, GEPINNT AM DRAHT.
// ================================================================================================
//
// DER BEFUND (Sonde _relay/messung/a71-onsend-fenster.ts, am echten Socket gemessen):
// der async-onSend-Hook aus mega69 (web-static.ts:46) öffnete das wrap-thenable-Doppel-Send-
// Fenster HEUTE noch NICHT — mit genau EINEM nicht-awaitenden async-Hook gewinnt die erste
// Pipeline um exakt einen Microtask (fastify/lib/wrap-thenable.js prüft `reply.sent === false &&
// headersSent === false`, und die Pipeline schließt im selben Microtask, in dem der Hook
// resolved). Aber der Abstand ist EIN Edit: ein `await` im Hook selbst ODER ein zweiter
// async-Hook irgendwo, und jede Route mit dem Handler-Muster `reply.send(); return;` (im
// Produktbaum ~54 Stellen) beantwortet dieselbe Anfrage ZWEIMAL — ERR_HTTP_HEADERS_SENT als
// unbehandelte Zurückweisung, Prozess-Crash (Mechanik: routes/addin-static-routes.ts:130 ff.).
//
// Der mega69-Test (mega69-klara-auslieferung) prüft zwei ERFOLGREICHE Abrufe und kann diese
// Fehlerklasse nicht sehen — der Fehler liegt nicht auf dem Erfolgspfad. Dieser Test pinnt
// deshalb DREI Antwortklassen (200 / Wächter-4xx / Fehler-5xx), jede über einen Handler nach
// genau dem Muster `reply.send(); return;`, gegen die produktionsverdrahtete Auslieferung
// (Reihenfolge wie server.ts/configureWebDelivery: Security-Header → Noindex → WebStatic) —
// am ECHTEN Socket (listen + fetch, nicht inject: das Fenster hängt an writeHead-Timing und
// Socket-Zustand), mit Spion auf `unhandledRejection` und Zähler auf `res.writeHead`.
//
// TEIL 1 pinnt die reine Produktionsverdrahtung: genau EINE Antwort je Klasse, KEINE
// unbehandelte Zurückweisung. Rot, sobald jemand einem Produkt-Hook ein await gibt.
// TEIL 2 pinnt die WP-E-ZUSAGE selbst: die app-globalen Produkt-Hooks tragen NULL async-Hops —
// gemessen daran, dass EIN fremder async-Hook (die nächste Registrierung von irgendwem: Plugin,
// Folgeauftrag, Drittcode) die Pipeline NICHT kippt. Gegen die asynchrone mega69-Fassung von
// web-static.ts ist genau das rot (zwei Hops → Doppel-Send auf allen drei Klassen — der
// geforderte Rot-Lauf dieses Blocks); mit dem Callback-Stil ist es grün.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Fastify, { type FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { registerNoindexHook } from "../../services/app/src/noindex-hook";
import { registerSecurityHeaders } from "../../services/app/src/security-headers";
import { registerWebStatic } from "../../services/app/src/web-static";

// ================================================================================================
// JOB 2508 D1 — HORCHRECHT: GEMESSEN, NICHT ANGENOMMEN.
// ================================================================================================
//
// Alle sechs Faelle unten brauchen einen ECHTEN Socket; der Grund steht oben in Zeile 20: „am
// ECHTEN Socket (listen + fetch, nicht inject: das Fenster haengt an writeHead-Timing und
// Socket-Zustand)". In einer Bahnsitzung ist der `listen`-Systemaufruf gesperrt — am 26.08.2026
// in acht Varianten gemessen (TCP auf 127.0.0.1 mit freiem und festem Port, ohne Host, ::1,
// 0.0.0.0, localhost, HTTP-Server UND UNIX-Socket im beschreibbaren TMPDIR): **alle acht `EPERM`,
// `syscall=listen`.** Es ist kein Port- und kein Adressproblem, sondern der Aufruf selbst.
//
// Folge bis heute: diese sechs Faelle waren in JEDEM Torlauf JEDER Bahn rot. Ein Test, der nie
// gruen werden kann, macht jedes Tor rot und verdeckt echte Befunde — dieselbe Lehre und dieselbe
// Bauart wie in `services/app/src/routes/addin-static-routes.test.ts:213-227` (JOB 2370).
//
// DIE PROBE MISST, SIE BEHAUPTET NICHT. Sie versucht wirklich zu horchen. Auf einer Maschine mit
// Horchrecht (Chef, CI) laufen die sechs Faelle deshalb **unveraendert mit**; nur dort, wo der
// Aufruf verboten ist, werden sie sauber uebersprungen statt rot.
const KANN_HORCHEN = await new Promise<boolean>((resolve) => {
  const probe = createServer();
  probe.on("error", () => resolve(false));
  probe.listen(0, "127.0.0.1", () => probe.close(() => resolve(true)));
});

// Die drei Antwortklassen, jede über das produkttypische Muster `reply.send(); return;`
// (async-Handler, der nach dem Send undefined resolved — exakt der wrap-thenable-Zweig).
const KLASSEN = [
  { name: "200", url: "/mega71/ok", status: 200 },
  { name: "Wächter-4xx", url: "/mega71/tor", status: 401 },
  { name: "Fehler-5xx", url: "/mega71/stoerung", status: 500 },
] as const;

let dist: string;

beforeAll(() => {
  dist = mkdtempSync(join(tmpdir(), "kw-mega71-"));
  mkdirSync(join(dist, "word-addin"));
  writeFileSync(join(dist, "index.html"), "<!doctype html><title>SPA</title>");
  writeFileSync(join(dist, "word-addin", "taskpane.html"), "<!doctype html>ok");
});

afterAll(() => {
  rmSync(dist, { recursive: true, force: true });
});

interface Draht {
  status: number;
  writeHeads: number;
  rejections: string[];
}

// Produktionsverdrahtung wie server.ts/configureWebDelivery, danach die drei Probe-Routen.
// `fremderAsyncHook` ist Teil 2: die nächste onSend-Registrierung, die NICHT aus dem Produktbaum
// kommt — bewusst OHNE await, denn schon die bloße async-Form kostet den einen Microtask.
async function messeAmDraht(url: string, opts: { fremderAsyncHook: boolean }): Promise<Draht> {
  const app: FastifyInstance = Fastify();
  // Zähler VOR allem anderen: jedes writeHead dieser Antwort wird gezählt — „genau eine Antwort"
  // heißt genau ein writeHead, nicht bloß ein plausibler Client-Eindruck.
  let writeHeads = 0;
  app.addHook("onRequest", (_request, reply, done) => {
    const original = reply.raw.writeHead.bind(reply.raw);
    reply.raw.writeHead = ((...args: Parameters<typeof original>) => {
      writeHeads += 1;
      return original(...args);
    }) as typeof reply.raw.writeHead;
    done();
  });
  await registerSecurityHeaders(app);
  registerNoindexHook(app);
  await registerWebStatic(app, dist);
  if (opts.fremderAsyncHook) {
    app.addHook("onSend", async (_request, reply) => {
      reply.header("x-mega71-fremder-hook", "1");
    });
  }
  app.get("/mega71/ok", async (_request, reply) => {
    reply.send({ ok: true });
    return;
  });
  app.get("/mega71/tor", async (_request, reply) => {
    reply.code(401).send({ error: "UNAUTHENTICATED", message: "Kein Zugang." });
    return;
  });
  app.get("/mega71/stoerung", async (_request, reply) => {
    reply.code(500).send({ error: "INTERNAL", message: "Störung." });
    return;
  });

  const rejections: string[] = [];
  const spion = (reason: unknown): void => {
    rejections.push(String((reason as { code?: string })?.code ?? reason));
  };
  process.on("unhandledRejection", spion);
  try {
    await app.listen({ port: 0, host: "127.0.0.1" });
    const adresse = app.server.address() as { port: number };
    const res = await fetch(`http://127.0.0.1:${adresse.port}${url}`, {
      headers: { connection: "close" },
    });
    await res.text();
    // Eine verspätete zweite Pipeline läuft NACH der ersten Antwort — ohne diesen Flush wäre der
    // Spion still grün, obwohl der Prozess in Produktion stürbe (Makrotask, s. Merkregel 16).
    await new Promise((r) => setTimeout(r, 50));
    return { status: res.status, writeHeads, rejections };
  } finally {
    process.off("unhandledRejection", spion);
    await app.close();
  }
}

describe("mega71 A · die Send-Pipeline der Auslieferung bleibt atomar (eine Antwort, kein Crash)", () => {
  for (const klasse of KLASSEN) {
    it.skipIf(!KANN_HORCHEN)(
      `${klasse.name}: produktionsverdrahtet — genau EINE Antwort, keine unbehandelte Zurückweisung`,
      async () => {
        const draht = await messeAmDraht(klasse.url, { fremderAsyncHook: false });
        expect(draht.status).toBe(klasse.status);
        expect(draht.writeHeads).toBe(1);
        expect(draht.rejections).toEqual([]);
      },
    );

    it.skipIf(!KANN_HORCHEN)(
      `${klasse.name}: WP-E-Zusage — EIN fremder async-Hook kippt die Pipeline NICHT (Produkt-Hops = 0)`,
      async () => {
        const draht = await messeAmDraht(klasse.url, { fremderAsyncHook: true });
        expect(draht.status).toBe(klasse.status);
        expect(draht.writeHeads).toBe(1);
        expect(draht.rejections).toEqual([]);
      },
    );
  }
});
