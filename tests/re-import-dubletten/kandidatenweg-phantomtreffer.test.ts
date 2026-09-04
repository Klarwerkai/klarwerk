// ================================================================================================
// JOB 3050 RUNDE 3 (bens ROT) — EINE TREFFER-ID, DIE DIE WARTESCHLANGE NIE GESEHEN HAT.
// ================================================================================================
//
// DER BEFUND. Runde 2 baute in `createImportCandidates` erst ALLE Kandidaten (und liess dabei den
// Vergleichsbestand um jeden davon wachsen) und reihte sie DANACH ein. Zwischen beiden Schleifen
// liegt die Persistenzgrenze — und `insertIfAbsent` darf `false` liefern: ein bereits offener
// Kandidat derselben (provider@externalId, sourceVersion) wird bewusst NICHT erneut angelegt
// (SCRUM-510 WP3). Der abgelehnte Kandidat stand trotzdem im Vergleich, und ein SPAETERER Eintrag
// desselben Laufs bekam als Treffer dessen `kandidatId`.
//
// WARUM DAS SCHWER WIEGT: `duplicate: true` ist eine Entscheidung, und die Auskunft daneben soll
// sagen, WORAUF getroffen wurde. Zeigt sie auf eine Id, die `GET /api/library/import/candidates`
// nicht kennt, ist sie erfunden — der Reviewer kann den genannten Partner nicht aufrufen, und die
// Kette Route → Persistenz → Auskunft ist gebrochen. „Wissenslücke statt Erfindung" (REGELN §7).
//
// WARUM DIESE DATEI DIE ECHTE ROUTE FAEHRT UND NICHT DEN DIENST: die Luecke lag genau AN der
// Persistenzgrenze und war nur sichtbar, wenn man die ausgegebene Id danach in der Warteschlange
// SUCHT. Beides gehoert zusammen gemessen — POST und der darauffolgende GET, durch dieselbe App.
//
// DER AUFBAU BRAUCHT DEN ANKER-STRANG (`KLARWERK_CONFLUENCE_IMPORT`), weil nur dort
// `insertIfAbsent` benutzt wird. Das Flag wird ausschliesslich um `buildServices()` gelegt und
// danach wieder entfernt (Muster `tests/app/import-group-routes.test.ts`).
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import type { KandidatDublettenbefund } from "../../services/library-analytics";

const ZUGANG = { name: "Admin", email: "phantomtreffer@x.de", password: "secret123" };

interface KandidatDto {
  id: string;
  item: { title: string; externalId?: string };
  duplicate: boolean;
  dublettenbefund?: KandidatDublettenbefund;
}

const ANKER_ITEM = {
  title: "Pumpe warten",
  statement: "Die Pumpe alle 200 Betriebsstunden schmieren",
  type: "best_practice" as const,
  category: "Wartung",
  provider: "Confluence",
  externalId: "PX-1",
  sourceVersion: 1,
};

/** DERSELBE Text, aber OHNE Herkunftsanker — dieser Eintrag laeuft durch die Textregel. */
const OHNE_ANKER = {
  title: ANKER_ITEM.title,
  statement: ANKER_ITEM.statement,
  type: ANKER_ITEM.type,
  category: ANKER_ITEM.category,
};

const FLAG = "KLARWERK_CONFLUENCE_IMPORT";
let gesichert: string | undefined;

beforeEach(() => {
  gesichert = process.env[FLAG];
});

afterEach(() => {
  if (gesichert === undefined) {
    delete process.env[FLAG];
  } else {
    process.env[FLAG] = gesichert;
  }
});

/** Eine App mit AKTIVEM Anker-/Upsert-Strang — nur dort greift `insertIfAbsent`. */
async function ankerApp() {
  process.env[FLAG] = "1";
  const services = buildServices();
  delete process.env[FLAG];
  const app = buildApp(services);
  await app.inject({ method: "POST", url: "/api/auth/register", payload: ZUGANG });
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: ZUGANG.email, password: ZUGANG.password },
  });
  return { app, headers: { authorization: `Bearer ${login.json().token}` } };
}

type App = Awaited<ReturnType<typeof ankerApp>>["app"];
type Headers = Record<string, string>;

async function reiheEin(app: App, headers: Headers, items: unknown[]): Promise<KandidatDto[]> {
  const res = await app.inject({
    method: "POST",
    url: "/api/library/import/candidates",
    headers,
    payload: { items },
  });
  expect(res.statusCode, res.body).toBe(201);
  return res.json() as KandidatDto[];
}

async function warteschlange(app: App, headers: Headers): Promise<KandidatDto[]> {
  const res = await app.inject({ method: "GET", url: "/api/library/import/candidates", headers });
  expect(res.statusCode, res.body).toBe(200);
  return res.json() as KandidatDto[];
}

/** Die genannten Kandidaten-Ids EINER Antwort — nur die Treffer der Art „kandidat". */
function genannteKandidatIds(kandidaten: readonly KandidatDto[]): string[] {
  const raus: string[] = [];
  for (const kandidat of kandidaten) {
    const befund = kandidat.dublettenbefund;
    if (
      (befund?.ergebnis === "identisch" || befund?.ergebnis === "aehnlich") &&
      befund.treffer.art === "kandidat"
    ) {
      raus.push(befund.treffer.kandidatId);
    }
  }
  return raus;
}

describe("JOB 3050 · K10 — jede genannte Kandidaten-Id steht wirklich in der Warteschlange", () => {
  it("K10 · abgelehnte Einreihung (insertIfAbsent false) darf kein Treffer werden", async () => {
    const { app, headers } = await ankerApp();

    // ---- Lauf 1: der Anker-Kandidat kommt in die Warteschlange und bleibt offen. ------------
    const erster = await reiheEin(app, headers, [ANKER_ITEM]);
    expect(erster, "Vorbedingung: der Anker-Kandidat ist wirklich eingereiht.").toHaveLength(1);
    const offeneId = erster[0]?.id;
    expect(await warteschlange(app, headers)).toHaveLength(1);

    // ---- Lauf 2: DERSELBE Anker (wird abgelehnt) + derselbe Text OHNE Anker. ----------------
    // Der erste Eintrag laeuft in `insertIfAbsent` → false: es gibt schon einen offenen Kandidaten
    // derselben (provider@externalId, sourceVersion). Er wird also NICHT eingereiht. Der zweite
    // Eintrag traegt denselben Text ohne Anker und geht darum durch die Textregel — in Runde 2
    // traf er auf den PLATZHALTER des abgelehnten Kandidaten.
    const zweiter = await reiheEin(app, headers, [ANKER_ITEM, OHNE_ANKER]);

    // Die Vorbedingung wird gemessen, nicht geglaubt: der Anker-Eintrag ist NICHT eingereiht.
    expect(
      zweiter.map((k) => k.item.externalId),
      "Vorbedingung von K10: der wiederholte Anker-Eintrag wird idempotent abgelehnt.",
    ).toEqual([undefined]);

    // ---- Die Zusicherung: keine Auskunft nennt eine Id, die es nicht gibt. -----------------
    const inDerQueue = new Set((await warteschlange(app, headers)).map((k) => k.id));
    for (const genannt of genannteKandidatIds(zweiter)) {
      expect(
        inDerQueue.has(genannt),
        `Der ausgegebene Treffer ${genannt} muss in der Queue existieren.`,
      ).toBe(true);
    }
    // Und der abgelehnte Kandidat selbst taucht nirgends auf.
    expect(inDerQueue.size, "Genau der offene Kandidat aus Lauf 1 plus der neue ohne Anker.").toBe(
      2,
    );
    expect(inDerQueue.has(offeneId ?? "")).toBe(true);

    // Ehrlich ausgeschrieben, was der Eintrag OHNE Anker jetzt bekommt: der Vergleichsbestand
    // sind die WISSENSOBJEKTE und die Kandidaten DIESES Laufs — ein bereits in der Warteschlange
    // LIEGENDER Kandidat ist keins von beidem. `keine` ist damit die richtige Auskunft, und sie
    // nennt niemanden. Vorher stand hier `identisch` mit einer erfundenen Id.
    expect(zweiter[0]?.dublettenbefund).toEqual({ ergebnis: "keine" });
    expect(zweiter[0]?.duplicate).toBe(false);
  });

  // ==============================================================================================
  // K10b — DIE KALIBRIERUNG: die Prüfung oben ist nicht deshalb grün, weil NIE ein Kandidat
  // genannt wird. Zwei Einträge OHNE Anker in EINEM Lauf werden beide eingereiht, der zweite
  // nennt den ersten — und diese Id steht danach wirklich in der Warteschlange.
  // ==============================================================================================
  it("K10b · KALIBRIERUNG: ein Lauf-interner Treffer wird genannt UND ist auffindbar", async () => {
    const { app, headers } = await ankerApp();

    const kandidaten = await reiheEin(app, headers, [OHNE_ANKER, OHNE_ANKER]);

    expect(
      kandidaten,
      "Beide Eintraege werden eingereiht (kein Anker → plain insert).",
    ).toHaveLength(2);
    const genannt = genannteKandidatIds(kandidaten);
    expect(genannt, "Der zweite Eintrag nennt den ersten — sonst prueft K10 nichts.").toEqual([
      kandidaten[0]?.id,
    ]);
    const inDerQueue = new Set((await warteschlange(app, headers)).map((k) => k.id));
    expect(inDerQueue.has(genannt[0] ?? "")).toBe(true);
  });
});
