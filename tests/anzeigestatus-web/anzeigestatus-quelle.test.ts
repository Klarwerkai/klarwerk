// ================================================================================================
// JOB 3072 · N4 — DIE EINE STELLE, DIE ENTSCHEIDET, WELCHEN ZUSTAND DIE WEB-APP ZEIGT.
// ================================================================================================
//
// PEDIS ZEILE N4: „Jeder Eintrag zeigt seinen echten Zustand: Entwurf, offen, in Prüfung,
// validiert, abgelehnt, Re-Validierung, Konflikt."
//
// DER AUSGANGSBEFUND, den diese Datei rot zeigt: Der Server ERHEBT den Zustand seit JOB 3024
// (Detail), JOB 3043 (Liste) und JOB 3054 (Re-Validierung) und schickt ihn als `anzeigestatus` mit
// (`services/knowledge-object/src/display-status.ts:131`). Die Oberfläche warf ihn weg und rechnete
// mit `deriveStatus` selbst — aus `ko.status` und `ko.assignments`. `assignments` ist im Produkt
// tot (`service.ts:1644` setzt es einmalig auf `[]`, kein Schreibweg ändert es je), also konnte das
// Raten von den sieben Zuständen genau drei erreichen: `offen`, `validiert` und — aus einer anderen
// Quelle — `konflikt`. `pruefung`, `abgelehnt` und `revalidierung` waren unerreichbar.
//
// DIESE DATEI IST DER REINE TEIL DER MESSUNG (kein DOM): sie misst die Entscheidungsregel selbst.
// Dass die Regel auch WIRKT — in Liste, Pille und Segment-Umschalter — misst
// `anzeigestatus-in-der-bibliothek.test.tsx` an der gemounteten Fläche.
//
// DIE DREI ZWEIGE DER REGEL, in dieser Reihenfolge (lib/displayStatus.ts):
//   1. Ein bekannter Konflikt aus der Konfliktliste der Oberfläche schlägt alles. Er ist die
//      EINZIGE Konfliktkenntnis, die es gibt: der Server weist diesen Eingang an beiden Leserouten
//      dauerhaft als `ungeprueft` aus (`ko-routes.ts:473-480`).
//   2. Sonst gilt `ko.anzeigestatus` — die Zahl, die der Server erhoben hat.
//   3. Fehlt sie, gilt `deriveStatus(ko)` als BENANNTER Rückfall, nicht als stille Umdeutung.
import { describe, expect, it } from "vitest";
import type { KnowledgeObject } from "../../apps/web/src/api/types";
import {
  anzeigestatusAnker,
  anzeigestatusAus,
  deriveStatus,
} from "../../apps/web/src/lib/displayStatus";

/** Ein Wissensobjekt in der Form, die der Draht wirklich führt. */
function ko(overrides: Partial<KnowledgeObject>): KnowledgeObject {
  return {
    id: "ko-1",
    title: "Pumpe entlüften",
    statement: "Nach dem Anfahren 10 Sekunden warten.",
    conditions: [],
    measures: [],
    type: "best_practice",
    category: "Wartung",
    tags: [],
    confidence: 0,
    trust: 0,
    status: "offen",
    version: 1,
    originalAuthor: "u1",
    author: "u1",
    neededValidations: 2,
    assignments: [],
    asset: null,
    createdAt: "2026-08-01T00:00:00.000Z",
    history: [],
    ...overrides,
  } as KnowledgeObject;
}

/** Die Herkunftsauskunft des Servers in der Form aus `display-status.ts:101-107`. */
const HERKUNFT_VOLL = {
  status: "geprueft",
  zuweisungen: "geprueft",
  bewertungen: "geprueft",
  konflikt: "ungeprueft",
  revalidierung: "geprueft",
  ungeprueft: { konflikt: "Der Konfliktweg wird derzeit umgebaut (JOB 3002); …" },
} as const;

/** Die Lage über dem Listendeckel: alle VIER beschafften Eingänge tragen den Deckelgrund. */
const DECKELGRUND =
  "Diese Liste fuehrt 201 sichtbare Eintraege und liegt damit ueber dem Deckel von 200: fuer KEINEN Eintrag wurde die Pruefstandslage abgefragt.";
const HERKUNFT_DECKEL = {
  status: "geprueft",
  zuweisungen: "ungeprueft",
  bewertungen: "ungeprueft",
  konflikt: "ungeprueft",
  revalidierung: "ungeprueft",
  ungeprueft: {
    zuweisungen: DECKELGRUND,
    bewertungen: DECKELGRUND,
    konflikt: DECKELGRUND,
    revalidierung: DECKELGRUND,
  },
} as const;

describe("JOB 3072 · N4 — der Anzeigestatus der Web-App kommt vom Server, nicht aus dem Raten", () => {
  // ----------------------------------------------------------------------------------------------
  // Q1 · DIE DREI ZUSTÄNDE, DIE DAS RATEN NIE ERREICHT HAT.
  // ----------------------------------------------------------------------------------------------
  it.each([
    ["pruefung", "offen"],
    ["abgelehnt", "offen"],
    ["revalidierung", "validiert"],
  ] as const)(
    "Q1 · `%s` kommt vom Server an — `deriveStatus` allein läge auf `%s`",
    (erhoben, geraten) => {
      const objekt = ko({
        status: geraten === "validiert" ? "validiert" : "offen",
        anzeigestatus: erhoben,
        anzeigestatusHerkunft: HERKUNFT_VOLL,
      });
      // Die Kalibrierung: ohne den Serverzweig kommt hier nachweislich etwas ANDERES heraus.
      expect(deriveStatus(objekt)).toBe(geraten);
      const auskunft = anzeigestatusAus(objekt, { konflikt: false });
      expect(auskunft.status).toBe(erhoben);
      expect(auskunft.herkunft).toBe("server");
    },
  );

  it("Q2 · auch `offen` und `validiert` kommen vom Server, wenn er sie schickt", () => {
    const offen = anzeigestatusAus(
      ko({ status: "offen", anzeigestatus: "offen", anzeigestatusHerkunft: HERKUNFT_VOLL }),
      { konflikt: false },
    );
    expect([offen.status, offen.herkunft]).toEqual(["offen", "server"]);
    const gueltig = anzeigestatusAus(
      ko({
        status: "validiert",
        anzeigestatus: "validiert",
        anzeigestatusHerkunft: HERKUNFT_VOLL,
      }),
      { konflikt: false },
    );
    expect([gueltig.status, gueltig.herkunft]).toEqual(["validiert", "server"]);
  });

  // ----------------------------------------------------------------------------------------------
  // Q3 · DER RÜCKFALL IST BENANNT, NICHT STILL.
  // ----------------------------------------------------------------------------------------------
  it("Q3 · fehlt das Feld, steht das heutige Wort da — und die Herkunft sagt `bestand`", () => {
    const offen = anzeigestatusAus(ko({ status: "offen" }), { konflikt: false });
    expect(offen.status).toBe("offen");
    expect(offen.herkunft).toBe("bestand");
    // Keine erfundene Liste: ohne Herkunftsauskunft wird kein Eingang als ungeprüft BEHAUPTET —
    // dass gar nichts erhoben wurde, sagt bereits `bestand`.
    expect(offen.ungeprueft).toEqual([]);
    const gueltig = anzeigestatusAus(ko({ status: "validiert" }), { konflikt: false });
    expect([gueltig.status, gueltig.herkunft]).toEqual(["validiert", "bestand"]);
  });

  // ----------------------------------------------------------------------------------------------
  // Q4 · DER KONFLIKT DER OBERFLÄCHE SCHLÄGT DIE SERVERZAHL — UND SEIN FEHLEN BEHAUPTET NICHTS.
  // ----------------------------------------------------------------------------------------------
  it("Q4 · ein bekannter Konflikt schlägt `validiert` vom Server", () => {
    const auskunft = anzeigestatusAus(
      ko({
        status: "validiert",
        anzeigestatus: "validiert",
        anzeigestatusHerkunft: HERKUNFT_VOLL,
      }),
      { konflikt: true },
    );
    expect(auskunft.status).toBe("konflikt");
    // `bestand`, weil diese Zahl NICHT die des Servers ist: die Konfliktkenntnis gehört der Fläche.
    expect(auskunft.herkunft).toBe("bestand");
  });

  it("Q4b · ohne bekannten Konflikt entsteht KEINE Konfliktaussage (JOB 3025)", () => {
    const auskunft = anzeigestatusAus(
      ko({
        status: "validiert",
        anzeigestatus: "validiert",
        anzeigestatusHerkunft: HERKUNFT_VOLL,
      }),
      { konflikt: false },
    );
    expect(auskunft.status).toBe("validiert");
  });

  // ----------------------------------------------------------------------------------------------
  // Q5 · ÜBER DEM LISTENDECKEL SAGT DIE FLÄCHE WENIGER, NICHT MEHR.
  // ----------------------------------------------------------------------------------------------
  it("Q5 · sind alle vier Eingänge ungeprüft, trägt die Auskunft genau diese vier", () => {
    // Der Server liefert über dem Deckel den GESPEICHERTEN Status als Anzeigestatus — ohne einen
    // einzigen gesetzten Flag (display-status.ts:142-154). Die Fläche behauptet nichts darüber.
    const auskunft = anzeigestatusAus(
      ko({ status: "offen", anzeigestatus: "offen", anzeigestatusHerkunft: HERKUNFT_DECKEL }),
      { konflikt: false },
    );
    expect(auskunft.status).toBe("offen");
    expect([...auskunft.ungeprueft].sort()).toEqual([
      "bewertungen",
      "konflikt",
      "revalidierung",
      "zuweisungen",
    ]);
  });

  it("Q5b · unterhalb des Deckels steht nur der eine ungeprüfte Eingang da", () => {
    const auskunft = anzeigestatusAus(
      ko({ status: "offen", anzeigestatus: "pruefung", anzeigestatusHerkunft: HERKUNFT_VOLL }),
      { konflikt: false },
    );
    expect(auskunft.ungeprueft).toEqual(["konflikt"]);
  });

  // ----------------------------------------------------------------------------------------------
  // Q6 · DER ANKER — MASCHINENLESBAR, OHNE EIN EINZIGES NEUES WORT AUF DEM BILDSCHIRM.
  // ----------------------------------------------------------------------------------------------
  it("Q6 · der Anker nennt Herkunft und ungeprüfte Eingänge", () => {
    const anker = anzeigestatusAnker(
      anzeigestatusAus(
        ko({ status: "offen", anzeigestatus: "offen", anzeigestatusHerkunft: HERKUNFT_DECKEL }),
        { konflikt: false },
      ),
    );
    expect(anker["data-anzeigestatus-herkunft"]).toBe("server");
    expect(anker["data-anzeigestatus-ungeprueft"]?.split(" ").sort()).toEqual([
      "bewertungen",
      "konflikt",
      "revalidierung",
      "zuweisungen",
    ]);
  });

  it("Q6b · ohne ungeprüften Eingang fehlt das Attribut — eine leere Angabe wäre eine Aussage", () => {
    const anker = anzeigestatusAnker(
      anzeigestatusAus(ko({ status: "offen" }), { konflikt: false }),
    );
    expect(anker["data-anzeigestatus-herkunft"]).toBe("bestand");
    expect(anker["data-anzeigestatus-ungeprueft"]).toBeUndefined();
  });
});
