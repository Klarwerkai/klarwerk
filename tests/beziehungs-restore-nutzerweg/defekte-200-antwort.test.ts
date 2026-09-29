// ================================================================================================
// HTTP 200 MIT KAPUTTEM RUMPF — ÜBER DEN ECHTEN SOCKET, OHNE DATENBANK, IM SCHNELLEN TOR.
// ================================================================================================
//
// Rest aus JOB 4275 (Runde 3, Prüflücke 6): „HTTP 200 mit kaputtem Rumpf vom ECHTEN Server". K4 in
// `beziehungen-ueberleben-den-produkt-restore.integration.test.ts` führt solche Antworten seit
// JOB 4305 zwar über einen Test-HTTP-Server — aber nur mitten im PG-Integrationslauf: ohne
// PostgreSQL läuft K4 nie, und ungültiges JSON MIT `application/json` kommt dort nicht vor.
//
// Hier steht derselbe Weg SEPARAT: ein `node:http`-Server auf 127.0.0.1, ein vom Betriebssystem
// vergebener Port, und jede Antwort geht durch `fetch` in `sende` (Verbraucher 1) und durch
// `erhebeAbdruck` (Verbraucher 2). Die Tabellenhälfte des Abdrucks ist hier bewusst leer — gemessen
// wird ausschließlich der Leseweg. Die Positivprobe zeigt, dass derselbe Aufbau mit einer tragenden
// Antwort grün ist: das Rot der Defektfälle kommt vom Rumpf, nicht vom Aufbau.
import { type Server, createServer } from "node:http";
import type { AddressInfo } from "node:net";
import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  type Konto,
  erhebeAbdruck,
  pruefeAbdruck,
  sende,
  stabil,
  totalVon,
  vergleicheAbdruecke,
} from "./vorrichtung";

const KO = "ko-defekt-200";
const KONTEN: readonly Konto[] = [
  { rolle: "admin", token: "token-admin" },
  { rolle: "experte", token: "token-experte" },
];

/** Leere Tabellenhälfte: `erhebeAbdruck` fragt `ko_kanten` und `ko_kanten_beitrag` — beide leer. */
const OHNE_TABELLEN = {
  query: async () => ({ rows: [] }),
} as unknown as Pool;

const tragendeKante = {
  id: "kante-1",
  art: "ergaenzt",
  richtung: "ungerichtet",
  urheber: "u-anna",
  gesetztAm: "2026-09-22T00:00:00.000Z",
  status: "aktiv",
  herkunft: "kuratiert",
  version: 1,
  gegenstueck: { id: "ko-gegen", title: "Gegenstück" },
};

interface Form {
  was: string;
  typ: string;
  rumpf: string;
  /** Was die Erhebung im Fehlertext nennen muss. */
  erwartet: string;
  /** Ist der Rohtext überhaupt JSON? Entscheidet, was `sende` als `json` ablegen muss. */
  parsebar: boolean;
}

const DEFEKT: readonly Form[] = [
  {
    was: "abgeschnittenes JSON mit application/json",
    typ: "application/json",
    rumpf: `{"koId":"${KO}","total":1,"kanten":[{"id":"kante-1","art":`,
    erwartet: "kein JSON-Objekt",
    parsebar: false,
  },
  {
    was: "leerer Rumpf mit application/json",
    typ: "application/json",
    rumpf: "",
    erwartet: "kein JSON-Objekt",
    parsebar: false,
  },
  {
    was: "HTML-Fehlerseite mit Status 200",
    typ: "text/html",
    rumpf: "<html><body>502 Bad Gateway</body></html>",
    erwartet: "kein JSON-Objekt",
    parsebar: false,
  },
  {
    was: "gültiges JSON, aber null",
    typ: "application/json",
    rumpf: "null",
    erwartet: "kein JSON-Objekt",
    parsebar: true,
  },
  {
    was: "gültiges JSON, aber eine Liste",
    typ: "application/json",
    rumpf: "[]",
    erwartet: "kein JSON-Objekt",
    parsebar: true,
  },
  {
    was: "gültiges JSON, aber total ist Text",
    typ: "application/json",
    rumpf: JSON.stringify({ koId: KO, total: "1", kanten: [tragendeKante] }),
    erwartet: "keine Anzahl",
    parsebar: true,
  },
];

const TRAGEND: Form = {
  was: "tragende Antwort",
  typ: "application/json",
  rumpf: JSON.stringify({ koId: KO, total: 1, kanten: [tragendeKante] }),
  erwartet: "",
  parsebar: true,
};

describe("Defekte HTTP-200-Antwort · echter Socket → sende → erhebeAbdruck", () => {
  let server: Server;
  let basis = "";
  let aktuell: Form = TRAGEND;
  /** Jede Anfrage, die WIRKLICH am Socket ankam — der Beleg, dass nichts im Speicher abgekürzt wurde. */
  const angekommen: string[] = [];

  beforeAll(async () => {
    server = createServer((anfrage, antwort) => {
      angekommen.push(`${anfrage.method} ${anfrage.url} ${anfrage.headers.authorization ?? "-"}`);
      antwort.writeHead(200, { "content-type": aktuell.typ });
      antwort.end(aktuell.rumpf);
    });
    await new Promise<void>((fertig) => server.listen(0, "127.0.0.1", () => fertig()));
    basis = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterAll(async () => {
    await new Promise<void>((fertig) => server.close(() => fertig()));
  });

  it("Positivprobe: dieselbe Strecke mit tragender Antwort ergibt einen gültigen Abdruck und keinen Unterschied", async () => {
    aktuell = TRAGEND;
    const a = await erhebeAbdruck(OHNE_TABELLEN, basis, KONTEN, [KO]);
    const b = await erhebeAbdruck(OHNE_TABELLEN, basis, KONTEN, [KO]);
    expect(pruefeAbdruck(a, "Positivprobe")).toEqual([]);
    expect(a.sichten.map((s) => totalVon(s))).toEqual([1, 1]);
    expect(vergleicheAbdruecke(a, b)).toEqual([]);
  });

  for (const form of DEFEKT) {
    it(`${form.was}: kein gültiger Inhalts- und kein Wiederherstellungsnachweis`, async () => {
      aktuell = form;
      const vorher = angekommen.length;

      // VERBRAUCHER 1 — `sende`: Status 200 und der Rohtext kommen unverändert an; aus einem nicht
      // parsebaren Rumpf wird KEIN Ersatzobjekt.
      const antwort = await sende(basis, "GET", `/api/kos/${KO}/beziehungen`, "token-admin");
      expect(antwort.status).toBe(200);
      expect(antwort.text).toBe(form.rumpf);
      if (form.parsebar) {
        expect(antwort.json).toEqual(JSON.parse(form.rumpf));
      } else {
        expect(antwort.json).toBeUndefined();
      }

      // VERBRAUCHER 2 — `erhebeAbdruck`, streng: aus dieser Antwort entsteht GAR KEIN Abdruck.
      let ausfall = "";
      try {
        await erhebeAbdruck(OHNE_TABELLEN, basis, KONTEN, [KO]);
      } catch (fehler) {
        ausfall = fehler instanceof Error ? fehler.message : String(fehler);
      }
      expect(ausfall, `${form.was}: die Erhebung hat einen Abdruck gemacht`).not.toBe("");
      expect(ausfall).toContain("keinen gueltigen Bestand");
      expect(ausfall).toContain(form.erwartet);
      for (const konto of KONTEN) {
        expect(ausfall).toContain(`KO ${KO}, Rolle ${konto.rolle}, HTTP 200`);
      }

      // Und ohne die Sperre der Erhebung: zwei identische Erhebungen derselben Defektantwort sind
      // KEIN Wiederherstellungsnachweis — der Vergleich bleibt rot, obwohl vorher == nachher.
      const ohne = { ohnePruefung: true } as const;
      const a = await erhebeAbdruck(OHNE_TABELLEN, basis, KONTEN, [KO], ohne);
      const b = await erhebeAbdruck(OHNE_TABELLEN, basis, KONTEN, [KO], ohne);
      expect(stabil(a.sichten)).toBe(stabil(b.sichten));
      expect([...new Set(a.sichten.map((s) => s.status))]).toEqual([200]);
      const rot = vergleicheAbdruecke(a, b);
      expect(rot.length, `${form.was}: der Vergleich blieb grün`).toBeGreaterThan(0);
      expect(rot.join("\n")).toContain(form.erwartet);
      expect(rot.join("\n")).toContain("FAELLT AUS");
      expect(() => totalVon(a.sichten[0] as (typeof a.sichten)[number])).toThrow(
        "kein gueltiger Bestand",
      );

      // Alles ging über den Draht: 1 (sende) + 3 Erhebungen × 2 Rollen, jede mit ihrem Token.
      const neu = angekommen.slice(vorher);
      expect(neu).toHaveLength(1 + 3 * KONTEN.length);
      expect(neu.every((z) => z.startsWith(`GET /api/kos/${KO}/beziehungen Bearer token-`))).toBe(
        true,
      );
    });
  }
});
