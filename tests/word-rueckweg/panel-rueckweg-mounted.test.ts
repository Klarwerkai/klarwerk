// @vitest-environment jsdom
// ================================================================================================
// JOB 3667 · WORD-RÜCKWEG — DER WEG AUS WORD ZURÜCK AUF DASSELBE OBJEKT, AM LAUFENDEN FENSTER.
// ================================================================================================
//
// PEDIS FALL (Auftrag §1): er öffnet ein Wissensobjekt in Word, ändert den Text und gibt die
// Änderung zurück — danach trägt DASSELBE Objekt den neuen Stand, nicht ein zweites daneben.
// UND: „Es kommt dabei aber darauf an, wer angemeldet ist" (Primärquelle
// SICHTBARES-GESPRAECH.jsonl:693). Diese Datei misst alle drei Fälle am laufenden Fenster:
//   · Fall 1 — berechtigtes Konto: aktualisiert UND gibt frei, in EINEM Aufruf (R3, R13).
//   · Fall 2 — jedes andere Konto: reicht einen an DASSELBE Objekt gebundenen Vorschlag ein; das
//     Objekt behält Inhalt, Version und Prüfstand (R5).
//   · Fall 3 — berechtigtes Konto wählt den Prüfweg freiwillig (R6).
//   · Der Kreis: das berechtigte Konto übernimmt (R11) oder lehnt ab (R12) — und am EIGENEN
//     Vorschlag steht kein Knopf, weil eine Prüfung durch sich selbst keine ist (R14).
//
// RUNDE 2 — WAS SICH GEGENÜBER RUNDE 1 GEÄNDERT HAT, und warum die Fälle hier anders messen:
//   · Fall 1 ist EIN Aufruf (`revise-release`) statt zwei (`revise` + `admin-validate`). Der
//     Prüfer hat die Spanne dazwischen benannt: fremder Text, der in ihr geschrieben wird, wäre
//     mitfreigegeben worden. R3 zählt deshalb die Schreibaufrufe.
//   · Der Vorschlag ist ein eigener Datensatz (`ko.proposals`) statt eines markierten Kommentars.
//     Er trägt einen ENTSCHIEDENEN Zustand; R12 misst, dass eine Ablehnung ihn aus der Liste nimmt.
//
// GEMESSEN WIRD AM AUSGELIEFERTEN AUFGABENFENSTER (`tests/app/klara-panel-fixture.ts`): das
// vollständige Inline-Skript von `apps/web/public/word-addin/taskpane.html` läuft im jsdom, die
// Knöpfe werden wirklich geklickt, und was hinausgeht, steht in `panel.calls`.
//
// WAS DIESE DATEI NICHT MISST: den echten Word-Host und die Serverregeln — die stehen in
// `tests/word-rueckweg/route-accountregel.test.ts` an der echten Route.
import { afterEach, describe, expect, it } from "vitest";
import { type KlaraPanel, createKlaraPanel, reply } from "../app/klara-panel-fixture";

const MARKIERUNG =
  "Ventil vor jeder Wartung drucklos schalten und gegen Wiedereinschalten sichern.\nDanach den Druck protokollieren.";

/** Die Dublettenantwort, aus der die Kandidatenliste des Rückwegs entsteht. */
const ZWEI_TREFFER = {
  duplicates: [
    {
      koId: "ko-1",
      koTitle: "Ventilwartung",
      relation: "teilweise",
      koStatus: "validiert",
      koCategory: "Wartung",
    },
    {
      koId: "ko-2",
      koTitle: "Druckentlastung",
      relation: "verwandt",
      koStatus: "offen",
      koCategory: null,
    },
  ],
  conflicts: [],
  note: null,
};

interface KoAntwort {
  status: number;
  body: unknown;
}

interface Vorschlag {
  id: string;
  author: string;
  at: string;
  baseVersion: number;
  statement: string;
  status: string;
  /** RUNDE 4: der Fließtext des Vorschlags — das zweite Feld, das eine Übernahme schreibt. */
  bodyHtml?: string | null;
  /** RUNDE 5: die AUSDRÜCKLICHE Löschung — ohne sie bleibt der Fließtext des Eintrags stehen. */
  clearBody?: boolean;
}

/** Ein Objekt, wie `GET /api/kos/:id` es ausgibt — nur die Felder, die der Rückweg liest. */
function ko(
  id: string,
  titel: string,
  version: number | null,
  proposals: Vorschlag[] = [],
  status = "validiert",
  bodyHtml: string | null = null,
): Record<string, unknown> {
  return { id, title: titel, version, status, trust: 99, comments: [], proposals, bodyHtml };
}

function vorschlag(teil: Partial<Vorschlag> = {}): Vorschlag {
  return {
    id: "v-1",
    author: "gast-1",
    at: "2026-09-11T09:30:00.000Z",
    baseVersion: 3,
    statement: "Neuer Wortlaut aus Word, eingereicht von jemandem ohne Freigaberecht.",
    status: "offen",
    ...teil,
  };
}

/**
 * Der Fake für `/api/kos/…`: GET beantwortet das Laden des Ziels, PUT das Schreiben — in der
 * Reihenfolge, in der das Panel schreibt. Beide gehen im Panel durch DIESELBE Stelle (`rwRuf`).
 */
function kosRoute(
  lesen: KoAntwort,
  schreiben: KoAntwort[],
): (url: string, init: Record<string, unknown> | undefined) => KoAntwort {
  const offen = [...schreiben];
  return (_url, init) => {
    const method = typeof init?.method === "string" ? init.method : "GET";
    if (method !== "PUT") {
      return lesen;
    }
    return offen.shift() ?? { status: 500, body: { error: "TEST_OHNE_ANTWORT" } };
  };
}

let panel: KlaraPanel | null = null;
afterEach(() => {
  panel?.restore();
  panel = null;
});

/** Das angemeldete Konto. OHNE Rolle = nicht freigabeberechtigt (der Grundfall der Fixture). */
function konto(rolle?: string, id = "pedi-1"): KoAntwort {
  return {
    status: 200,
    body: rolle === undefined ? { id: "gast-1", name: "Gast" } : { id, name: "Pedi", role: rolle },
  };
}

async function erfassenFlaeche(routen: Record<string, unknown>): Promise<KlaraPanel> {
  panel = createKlaraPanel({
    selectionText: MARKIERUNG,
    routes: { "/api/check-text": reply(200, ZWEI_TREFFER), ...routen } as never,
  });
  panel.setTab("capture");
  await panel.flush();
  return panel;
}

function alle(
  sel: string,
): { textContent: string | null; click(): void; getAttribute(n: string): string | null }[] {
  const dokument = (
    globalThis as unknown as {
      document: {
        querySelectorAll(sel: string): ArrayLike<{
          textContent: string | null;
          click(): void;
          getAttribute(n: string): string | null;
        }>;
      };
    }
  ).document;
  return Array.from(dokument.querySelectorAll(sel));
}

const kandidaten = (): ReturnType<typeof alle> => alle("#rw-liste button");

function vorschauAbsaetze(): string[] {
  return alle("#rw-vorschau p").map((p) => String(p.textContent ?? ""));
}

function schreibrufe(p: KlaraPanel): { url: string; koerper: Record<string, unknown> }[] {
  return p.calls
    .filter((c) => c.method === "PUT")
    .map((c) => ({ url: c.url, koerper: JSON.parse(c.body ?? "{}") as Record<string, unknown> }));
}

/**
 * Den Haken WIRKLICH klicken (nicht `checked` setzen): nur der Klick löst das `change`-Ereignis aus,
 * an dem die Fläche ihre Beschriftung nachführt — eine von Hand gesetzte Eigenschaft misst einen
 * Zustand, den ein Mensch so nie erzeugt.
 */
function hakenKlicken(p: KlaraPanel): void {
  const feld = p.q("#rw-zweit");
  if (feld === null) {
    throw new Error("#rw-zweit fehlt");
  }
  feld.click();
}

/** Steht der Haken? Der Gate-tsc ist Node-rein — deshalb der schmale Struktur-Typ. */
function hakenStand(): boolean {
  const feld = (
    globalThis as unknown as {
      document: { getElementById(id: string): { checked: boolean } | null };
    }
  ).document.getElementById("rw-zweit");
  return feld !== null && feld.checked === true;
}

/** Word liefert ab jetzt eine ANDERE Markierung — der Fall „Host ohne DocumentSelectionChanged". */
function markierungInWordAendern(text: string): void {
  const office = (
    globalThis as unknown as {
      Office: {
        context: {
          document: {
            getSelectedDataAsync(
              typ: string,
              cb: (r: { status: string; value: string }) => void,
            ): void;
          };
        };
        AsyncResultStatus: { Succeeded: string };
      };
    }
  ).Office;
  office.context.document.getSelectedDataAsync = (_typ, cb): void => {
    cb({ status: office.AsyncResultStatus.Succeeded, value: text });
  };
}

describe("JOB 3667 · der Rückweg im Aufgabenfenster", () => {
  it("R1: mit Kandidaten steht der Kasten im Bild — aber NICHTS ist vorgewählt und nichts geschrieben", async () => {
    const p = await erfassenFlaeche({
      "/api/kos/": kosRoute({ status: 200, body: ko("ko-1", "Ventilwartung", 4) }, []),
    });
    expect(p.q("#rw-block")?.className).toBe("");
    expect(kandidaten().map((k) => k.textContent)).toEqual(["Ventilwartung", "Druckentlastung"]);
    // „Nicht raten": kein Knopf ist gedrückt, der Zielblock ist zu.
    expect(kandidaten().map((k) => k.getAttribute("aria-pressed"))).toEqual(["false", "false"]);
    expect(p.q("#rw-ziel")?.className).toBe("hidden");
    // Und es ist nichts gelesen und nichts geschrieben worden — die Fläche hat nur gefragt.
    expect(p.calls.filter((c) => c.url.startsWith("/api/kos/"))).toHaveLength(0);
  });

  it("R2: die Wahl LIEST das Ziel (GET) und zeigt Titel, Version und was freigegeben würde — noch immer ohne Schreibzugriff", async () => {
    const p = await erfassenFlaeche({
      "/api/kos/": kosRoute({ status: 200, body: ko("ko-1", "Ventilwartung", 4) }, []),
    });
    kandidaten()[0]?.click();
    await p.flush();

    const lesen = p.calls.filter((c) => c.url.startsWith("/api/kos/"));
    expect(lesen).toHaveLength(1);
    expect(lesen[0]?.method).toBe("GET");
    expect(lesen[0]?.url).toBe("/api/kos/ko-1");
    expect(p.q("#rw-ziel")?.className).toBe("");
    expect(p.text("#rw-ziel-zeile")).toBe("Ventilwartung · Version 4");
    // §4.4: was freigegeben wird, steht vorher lesbar da — genau die Absätze der Markierung.
    expect(vorschauAbsaetze()).toEqual([
      "Ventil vor jeder Wartung drucklos schalten und gegen Wiedereinschalten sichern.",
      "Danach den Druck protokollieren.",
    ]);
    // §6(b): ohne ausdrücklichen Griff passiert nichts.
    expect(schreibrufe(p)).toHaveLength(0);
  });

  it("R3 (FALL 1): das berechtigte Konto aktualisiert und gibt frei — EIN Aufruf, mit der gesehenen Version", async () => {
    const p = await erfassenFlaeche({
      "/api/auth/me": konto("admin"),
      "/api/kos/": kosRoute({ status: 200, body: ko("ko-1", "Ventilwartung", 4) }, [
        { status: 200, body: ko("ko-1", "Ventilwartung", 5) },
      ]),
    });
    kandidaten()[0]?.click();
    await p.flush();
    expect(p.text("#rw-btn")).toBe("Aktualisieren und freigeben");
    // Der Haken ist die Wahl DIESES Kontos (Fall 3) — und die Pflicht-Zeile steht nicht da.
    expect(p.q("#rw-zweit-zeile")?.className).toBe("");
    expect(p.q("#rw-pflicht")?.className).toBe("muted hidden");
    p.q("#rw-btn")?.click();
    await p.flush();

    const rufe = schreibrufe(p);
    // RUNDE 2: GENAU EIN Schreibaufruf. Zwei wären wieder die Spanne, in der fremder Text
    // mitfreigegeben werden könnte.
    expect(rufe).toHaveLength(1);
    expect(rufe[0]?.url).toBe("/api/kos/ko-1");
    expect(rufe[0]?.koerper.action).toBe("revise-release");
    expect(rufe[0]?.koerper.expectedVersion).toBe(4);
    const changes = rufe[0]?.koerper.changes as { bodyHtml: string; statement: string };
    expect(changes.statement).toContain("drucklos schalten");
    expect(changes.bodyHtml.length).toBeGreaterThan(0);
    // KEIN zweites Objekt: der Entwurfsweg bleibt unberührt.
    expect(p.calls.filter((c) => c.url.startsWith("/api/drafts"))).toHaveLength(0);
    expect(p.text("#rw-status")).toBe("Aktualisiert und freigegeben: Version 5.");
    expect(p.text("#rw-ziel-zeile")).toBe("Ventilwartung · Version 5");
  });

  it("R4: fremd geändert (409) — kein stilles Überschreiben, die Fläche sagt die jetzige Version und lässt den Menschen entscheiden", async () => {
    const p = await erfassenFlaeche({
      "/api/auth/me": konto("admin"),
      "/api/kos/": kosRoute({ status: 200, body: ko("ko-1", "Ventilwartung", 4) }, [
        { status: 409, body: { error: "KO_STALE", message: "…", currentVersion: 7 } },
      ]),
    });
    kandidaten()[0]?.click();
    await p.flush();
    p.q("#rw-btn")?.click();
    await p.flush();

    expect(p.text("#rw-status")).toBe(
      "Der Eintrag steht inzwischen auf Version 7. Es wurde nichts überschrieben.",
    );
    expect(p.q("#rw-status")?.className).toBe("warn");
    // Nichts wird automatisch entschieden — es steht ein Weg da, kein zweiter Versuch.
    expect(p.q("#rw-status-btn")?.className).toBe("ghost");
    expect(p.text("#rw-status-btn")).toBe("Stand neu laden");
    expect(schreibrufe(p)).toHaveLength(1);

    p.q("#rw-status-btn")?.click();
    await p.flush();
    // Der Knopf LIEST neu, er schreibt nicht.
    expect(schreibrufe(p)).toHaveLength(1);
    expect(p.calls.filter((c) => c.method === "GET" && c.url === "/api/kos/ko-1")).toHaveLength(2);
  });

  it("R5 (FALL 2): das NICHT berechtigte Konto aktualisiert nicht — es reicht einen gebundenen Vorschlag ein, der Stand bleibt", async () => {
    const eingereicht = vorschlag({
      id: "v-9",
      author: "gast-1",
      baseVersion: 2,
      statement: MARKIERUNG,
    });
    const p = await erfassenFlaeche({
      "/api/kos/": kosRoute({ status: 200, body: ko("ko-2", "Druckentlastung", 2) }, [
        { status: 200, body: ko("ko-2", "Druckentlastung", 2, [eingereicht]) },
      ]),
    });
    kandidaten()[1]?.click();
    await p.flush();
    // Keine Wahl: der Haken steht nicht da, die Pflicht schon.
    expect(p.q("#rw-zweit-zeile")?.className).toBe("hidden");
    expect(p.q("#rw-pflicht")?.className).toBe("muted");
    expect(p.text("#rw-pflicht")).toBe("Freigabe durch andere ist Pflicht.");
    expect(p.text("#rw-btn")).toBe("Zur Freigabe einreichen");

    p.q("#rw-btn")?.click();
    await p.flush();

    const rufe = schreibrufe(p);
    // GENAU EIN Aufruf, und es ist KEIN revise: das Objekt wird nicht angefasst.
    expect(rufe.map((r) => r.koerper.action)).toEqual(["propose"]);
    expect(rufe[0]?.url).toBe("/api/kos/ko-2");
    const nutzlast = rufe[0]?.koerper.proposal as {
      statement: string;
      baseVersion: number;
      origin: string;
      bodyHtml: string;
    };
    expect(nutzlast.statement).toBe(MARKIERUNG);
    expect(nutzlast.baseVersion).toBe(2);
    // Die feste Herkunft: wer den Vorschlag in KLARWERK öffnet, sieht, wo er entstand.
    expect(nutzlast.origin).toBe("word_addin");
    // ==========================================================================================
    // JOB 4085 — DIE BEWUSSTE NACHFÜHRUNG: DER VORSCHLAG TRÄGT JETZT DEN RUMPF.
    // ==========================================================================================
    //
    // WAS HIER BIS JOB 4085 STAND: drei Felder, und der Kommentar vor R18 nannte das „nur Text".
    // Das war keine Zusage, sondern eine Ungleichheit — der Word-SCHREIBweg (R3) und der
    // Einreichweg der Web-Fläche (`web-einreichweg-mounted.test.tsx`, E24: genau vier Felder)
    // trugen den Rumpf längst, und der Server nimmt ihn am `propose` an (`rumpf-erhalt.test.ts`,
    // G1/G2). Nur wer NICHT freigeben durfte, verlor Formatierung und Bilder, ohne einen Satz
    // darüber. Das Feld wandert deshalb hier herein, und zwar als DIESELBEN vier Felder wie im
    // Browser — mehr trägt ein `KoProposal` nicht, und mehr schreibt die Übernahme nicht.
    //
    // WAS DABEI NICHT WANDERT, und R18 misst es unverändert weiter: `clearBody`. Dieses Fenster
    // schickt es nie — weder gesetzt noch als `false`. Ein Rumpf, der aus Word kommt, ist eine
    // Ersetzung, keine Löschung.
    expect(Object.keys(nutzlast).sort()).toEqual([
      "baseVersion",
      "bodyHtml",
      "origin",
      "statement",
    ]);
    // Und der Rumpf ist wirklich einer — nicht ein leeres Feld, das der Dienst als „nicht
    // eingereicht" läse und das den bestehenden Inhalt stehen liesse. Er stammt aus dem WORD-HTML
    // der Markierung (`Office.CoercionType.Html`, hier der Vorgabewert der Fixture), nicht aus dem
    // Klartext: genau darin liegt der Gewinn dieses Wegs — Formatierung und Bilder reisen mit.
    expect(nutzlast.bodyHtml.length).toBeGreaterThan(0);
    expect(nutzlast.bodyHtml).toContain("<p>Ventil entlasten vor der Wartung</p>");
    expect(p.text("#rw-status")).toBe(
      "Eingereicht. Der Eintrag trägt weiter den freigegebenen Stand.",
    );
    // Die Version des Ziels ist NICHT gestiegen — nichts wurde ersetzt.
    expect(p.text("#rw-ziel-zeile")).toBe("Druckentlastung · Version 2");
    // Der eingereichte Vorschlag steht sofort in der Liste, mit Urheber und Herkunftsversion.
    expect(p.q("#rw-vorschlaege")?.className).toBe("");
    expect(alle("#rw-vorschlaege-liste li p")[0]?.textContent).toBe(
      "gast-1 · 2026-09-11 · aus Version 2",
    );
    // OHNE Freigaberecht steht dort kein Entscheidungsknopf.
    expect(alle("#rw-vorschlaege-liste button")).toHaveLength(0);
  });

  it("R6 (FALL 3): das berechtigte Konto wählt den Prüfweg — dann reicht auch es ein, statt zu aktualisieren", async () => {
    const p = await erfassenFlaeche({
      "/api/auth/me": konto("admin"),
      "/api/kos/": kosRoute({ status: 200, body: ko("ko-1", "Ventilwartung", 4) }, [
        { status: 200, body: ko("ko-1", "Ventilwartung", 4) },
      ]),
    });
    kandidaten()[0]?.click();
    await p.flush();
    hakenKlicken(p);
    expect(hakenStand()).toBe(true);
    // Der Knopf sagt jetzt dasselbe wie beim nicht berechtigten Konto — dieselbe Handlung.
    expect(p.text("#rw-btn")).toBe("Zur Freigabe einreichen");
    p.q("#rw-btn")?.click();
    await p.flush();

    expect(schreibrufe(p).map((r) => r.koerper.action)).toEqual(["propose"]);
    expect(p.text("#rw-status")).toBe(
      "Eingereicht. Der Eintrag trägt weiter den freigegebenen Stand.",
    );
  });

  it("R8: eine inzwischen andere Markierung geht NICHT an das alte Ziel — nichts wird gesendet, und es steht da", async () => {
    const p = await erfassenFlaeche({
      "/api/auth/me": konto("admin"),
      "/api/kos/": kosRoute({ status: 200, body: ko("ko-1", "Ventilwartung", 4) }, [
        { status: 200, body: ko("ko-1", "Ventilwartung", 5) },
      ]),
    });
    kandidaten()[0]?.click();
    await p.flush();
    markierungInWordAendern("Ein ganz anderer Absatz aus einem ganz anderen Kapitel.");
    p.q("#rw-btn")?.click();
    await p.flush();

    expect(schreibrufe(p)).toHaveLength(0);
    expect(p.text("#rw-status")).toBe("Die Markierung hat sich geändert — nichts gesendet.");
    // Die Zielwahl ist damit zurückgenommen: der Text, für den sie galt, steht nicht mehr da.
    expect(p.q("#rw-ziel")?.className).toBe("hidden");
  });

  it("R9: ohne belegte Version gibt es kein Ziel — lieber kein Rückweg als einer, der still überschreibt", async () => {
    const p = await erfassenFlaeche({
      "/api/kos/": kosRoute({ status: 200, body: ko("ko-1", "Ventilwartung", null) }, []),
    });
    kandidaten()[0]?.click();
    await p.flush();

    expect(p.q("#rw-ziel")?.className).toBe("hidden");
    expect(p.text("#rw-status")).toBe("Eintrag konnte nicht geladen werden.");
    expect(schreibrufe(p)).toHaveLength(0);
  });

  it("R10: ohne Kandidaten steht der Kasten NICHT im Bild — kein leeres Angebot ohne Ziel", async () => {
    panel = createKlaraPanel({
      selectionText: MARKIERUNG,
      routes: { "/api/check-text": reply(200, { duplicates: [], conflicts: [], note: null }) },
    });
    panel.setTab("capture");
    await panel.flush();
    expect(panel.q("#rw-block")?.className).toBe("hidden");
    expect(panel.calls.filter((c) => c.url.startsWith("/api/kos/"))).toHaveLength(0);
  });

  it("R11: der Kreis schliesst sich — das berechtigte Konto ÜBERNIMMT einen eingereichten Vorschlag", async () => {
    const p = await erfassenFlaeche({
      "/api/auth/me": konto("admin"),
      "/api/kos/": kosRoute({ status: 200, body: ko("ko-1", "Ventilwartung", 4, [vorschlag()]) }, [
        { status: 200, body: ko("ko-1", "Ventilwartung", 5) },
      ]),
    });
    kandidaten()[0]?.click();
    await p.flush();

    const zeilen = alle("#rw-vorschlaege-liste li p").map((x) => x.textContent);
    expect(zeilen[0]).toBe("gast-1 · 2026-09-11 · aus Version 3");
    expect(zeilen[1]).toBe("Neuer Wortlaut aus Word, eingereicht von jemandem ohne Freigaberecht.");
    // Der Vorschlag ist ÄLTER als der Stand — das sagt die Zeile, statt es zu verschweigen.
    expect(zeilen[2]).toBe("Der Vorschlag stammt aus Version 3, der Eintrag steht auf 4.");

    const knoepfe = alle("#rw-vorschlaege-liste button");
    expect(knoepfe.map((k) => k.textContent)).toEqual(["Vorschlag freigeben", "Ablehnen"]);
    knoepfe[0]?.click();
    await p.flush();

    const rufe = schreibrufe(p);
    expect(rufe).toHaveLength(1);
    expect(rufe[0]?.koerper.action).toBe("decide-proposal");
    expect(rufe[0]?.koerper.decision).toBe("uebernehmen");
    expect(rufe[0]?.koerper.proposalId).toBe("v-1");
    // Entschieden wird gegen den GELADENEN Stand (4), nicht gegen die Grundlage des Vorschlags (3).
    expect(rufe[0]?.koerper.expectedVersion).toBe(4);
    expect(p.text("#rw-status")).toBe("Aktualisiert und freigegeben: Version 5.");
  });

  it("R12: die ABLEHNUNG entscheidet den Vorschlag, ohne den Eintrag anzufassen — und er ist danach nicht mehr offen", async () => {
    const p = await erfassenFlaeche({
      "/api/auth/me": konto("admin"),
      "/api/kos/": kosRoute({ status: 200, body: ko("ko-1", "Ventilwartung", 4, [vorschlag()]) }, [
        {
          status: 200,
          body: ko("ko-1", "Ventilwartung", 4, [{ ...vorschlag(), status: "abgelehnt" }]),
        },
      ]),
    });
    kandidaten()[0]?.click();
    await p.flush();
    alle("#rw-vorschlaege-liste button")[1]?.click();
    await p.flush();

    const rufe = schreibrufe(p);
    expect(rufe).toHaveLength(1);
    expect(rufe[0]?.koerper.decision).toBe("ablehnen");
    expect(p.text("#rw-status")).toBe("Vorschlag abgelehnt. Der Eintrag bleibt unverändert.");
    // Die Version bleibt, und der entschiedene Vorschlag steht nicht mehr in der offenen Liste —
    // genau der Zustand, den ein Kommentar in Runde 1 nicht tragen konnte.
    expect(p.text("#rw-ziel-zeile")).toBe("Ventilwartung · Version 4");
    expect(p.q("#rw-vorschlaege")?.className).toBe("hidden");
    expect(alle("#rw-vorschlaege-liste li")).toHaveLength(0);
  });

  it("R13: sagt der Server nach dem Schreiben NICHT „validiert“, heisst es auch nicht „freigegeben“", async () => {
    const p = await erfassenFlaeche({
      "/api/auth/me": konto("admin"),
      "/api/kos/": kosRoute({ status: 200, body: ko("ko-1", "Ventilwartung", 4) }, [
        { status: 200, body: ko("ko-1", "Ventilwartung", 5, [], "offen") },
      ]),
    });
    kandidaten()[0]?.click();
    await p.flush();
    p.q("#rw-btn")?.click();
    await p.flush();

    expect(p.text("#rw-status")).toBe("Aktualisiert: Version 5. Die Freigabe steht noch aus.");
  });

  it("R14: am EIGENEN Vorschlag steht kein Entscheidungsknopf — eine Prüfung durch sich selbst ist keine", async () => {
    const p = await erfassenFlaeche({
      // Dasselbe Konto, das den Vorschlag eingereicht hat — und es darf freigeben.
      "/api/auth/me": konto("admin", "gast-1"),
      "/api/kos/": kosRoute(
        { status: 200, body: ko("ko-1", "Ventilwartung", 4, [vorschlag()]) },
        [],
      ),
    });
    kandidaten()[0]?.click();
    await p.flush();

    expect(p.q("#rw-vorschlaege")?.className).toBe("");
    expect(alle("#rw-vorschlaege-liste button")).toHaveLength(0);
    expect(alle("#rw-vorschlaege-liste li p").map((x) => x.textContent)).toContain(
      "Eigener Vorschlag — das prüft jemand anders.",
    );
  });

  it("R15: ein bereits entschiedener Vorschlag steht nicht mehr im Bild — der Zustand wird gelesen, nicht geraten", async () => {
    const p = await erfassenFlaeche({
      "/api/auth/me": konto("admin"),
      "/api/kos/": kosRoute(
        {
          status: 200,
          body: ko("ko-1", "Ventilwartung", 4, [
            { ...vorschlag({ id: "v-alt" }), status: "uebernommen" },
            { ...vorschlag({ id: "v-weg" }), status: "abgelehnt" },
          ]),
        },
        [],
      ),
    });
    kandidaten()[0]?.click();
    await p.flush();

    expect(p.q("#rw-vorschlaege")?.className).toBe("hidden");
    expect(alle("#rw-vorschlaege-liste li")).toHaveLength(0);
  });

  // ==============================================================================================
  // RUNDE 4 · BEFUND 1 DES PRÜFERS — FREIGEGEBEN WIRD NUR, WAS ANGEZEIGT WURDE.
  // ==============================================================================================
  //
  // `KoService.decideProposal` schreibt aus dem Vorschlag `statement` UND `bodyHtml` in die neue
  // Fassung (`service.ts:3891`). Dieses Fenster zeigt aber keinen HTML-Rumpf — es setzt nirgends
  // fremdes HTML in den Baum. Ein Freigabeknopf daneben hiesse: der Mensch genehmigt Text, den er
  // nie gesehen hat. Also gibt es ihn dort nicht, und der Satz nennt den Weg, auf dem es geht.

  it("R16: ein Vorschlag MIT Fließtext wird hier nicht freigegeben — der Satz sagt, warum und wohin", async () => {
    const p = await erfassenFlaeche({
      "/api/auth/me": konto("admin"),
      "/api/kos/": kosRoute(
        {
          status: 200,
          body: ko("ko-1", "Ventilwartung", 4, [
            vorschlag({ bodyHtml: "<p>Ein ganzer Abschnitt, den dieses Fenster nicht zeigt.</p>" }),
          ]),
        },
        [],
      ),
    });
    kandidaten()[0]?.click();
    await p.flush();

    // Der Vorschlag steht im Bild — verschwiegen wird er nicht.
    expect(alle("#rw-vorschlaege-liste li")).toHaveLength(1);
    const saetze = alle("#rw-vorschlaege-liste li p").map((x) => x.textContent);
    expect(saetze).toContain(
      "Dieser Vorschlag trägt einen ausführlichen Inhalt. Dieses Fenster kann ihn nicht anzeigen — freigegeben wird er deshalb hier nicht. In KLARWERK ansehen und dort entscheiden.",
    );
    // KEIN Freigabeknopf. Ablehnen bleibt: eine Ablehnung schreibt keinen Inhalt.
    const knoepfe = alle("#rw-vorschlaege-liste button");
    expect(knoepfe.map((k) => k.textContent)).toEqual(["Ablehnen"]);
    expect(alle("#rw-vorschlaege-liste [data-freigabe]")).toHaveLength(0);
    // Und die Ablehnung geht weiterhin — der Weg ist nicht zugemauert, nur die Freigabe.
    expect(alle("#rw-vorschlaege-liste [data-ablehnen]")).toHaveLength(1);
    expect(schreibrufe(p)).toHaveLength(0);
  });

  it("R17: bringt der Vorschlag KEINEN Fließtext mit, bleibt der des Eintrags stehen — und das steht da", async () => {
    const p = await erfassenFlaeche({
      "/api/auth/me": konto("admin"),
      "/api/kos/": kosRoute(
        {
          status: 200,
          body: ko(
            "ko-1",
            "Ventilwartung",
            4,
            [vorschlag()],
            "validiert",
            "<p>Der gepflegte Fließtext des Eintrags.</p>",
          ),
        },
        [],
      ),
    });
    kandidaten()[0]?.click();
    await p.flush();

    // RUNDE 5: DAS IST DIE NEUE WIRKUNG, nicht mehr die alte. Der Dienst lässt einen nicht
    // mitgeschickten Rumpf stehen (`rumpfAusVorschlag`) — der Satz sagt genau das, und er warnt
    // nicht mehr vor einer Löschung, die nicht mehr stattfindet.
    expect(alle("#rw-vorschlaege-liste li p").map((x) => x.textContent)).toContain(
      "Der Vorschlag ändert nur die Aussage. Der ausführliche Inhalt des Eintrags bleibt unverändert bestehen.",
    );
    expect(p.q("#rw-vorschlaege-liste [data-rumpf]")?.getAttribute("data-rumpf")).toBe("bleibt");
    // Hier bleibt die Freigabe möglich: die Folge ist SICHTBAR, und der Mensch entscheidet.
    expect(alle("#rw-vorschlaege-liste button").map((k) => k.textContent)).toEqual([
      "Vorschlag freigeben",
      "Ablehnen",
    ]);
  });

  // ==============================================================================================
  // RUNDE 5 · AUSGELASSEN IST NICHT GELÖSCHT — UND DIE LÖSCHUNG SAGT ES SELBST.
  // ==============================================================================================
  //
  // Der Rückweg aus Word schickte bis JOB 4085 nur Text. Bis R4 hätte seine Übernahme den
  // ausführlichen Inhalt des Eintrags entfernt; seit R5 bleibt er stehen. Der Warnsatz gehört
  // deshalb allein dem Vorschlag, der WIRKLICH löschen will (`clearBody`).
  //
  // JOB 4085 HAT DIE EINE STELLE GEÄNDERT UND DIE ANDERE AUSDRÜCKLICH NICHT: `rwEinreichen` trägt
  // den Rumpf jetzt mit (vier Felder, s. R5) — ein `clearBody` schickt dieses Fenster weiterhin
  // NIE. R18 misst genau das und bleibt unverändert grün: Der Warnsatz hängt am Löschsignal des
  // Vorschlags, nicht daran, ob der Vorschlag einen Rumpf hat. Ohne diesen Satz hier stünde die
  // Erwartung gewandert und die Begründung nicht.

  it("R18: nur der Vorschlag MIT Löschsignal warnt vor dem Verlust des ausführlichen Inhalts", async () => {
    const p = await erfassenFlaeche({
      "/api/auth/me": konto("admin"),
      "/api/kos/": kosRoute(
        {
          status: 200,
          body: ko(
            "ko-1",
            "Ventilwartung",
            4,
            [vorschlag({ clearBody: true })],
            "validiert",
            "<p>Der gepflegte Fließtext des Eintrags.</p>",
          ),
        },
        [],
      ),
    });
    kandidaten()[0]?.click();
    await p.flush();

    expect(alle("#rw-vorschlaege-liste li p").map((x) => x.textContent)).toContain(
      "Achtung: Dieser Vorschlag löscht den ausführlichen Inhalt — der Einreicher hat ihn geleert. Freigeben entfernt ihn aus dem Eintrag.",
    );
    expect(p.q("#rw-vorschlaege-liste [data-rumpf]")?.getAttribute("data-rumpf")).toBe("entfernt");
    // Die Freigabe bleibt möglich — eine Löschung ist in Worten vollständig zu zeigen, und sie steht da.
    expect(alle("#rw-vorschlaege-liste button").map((k) => k.textContent)).toEqual([
      "Vorschlag freigeben",
      "Ablehnen",
    ]);
  });

  it("R19: ein Eintrag OHNE ausführlichen Inhalt bekommt gar keinen Satz darüber", async () => {
    // Ohne diesen Fall wäre R17 auch dann grün, wenn das Fenster den Satz IMMER setzte — und er
    // behauptete dann einen Inhalt, den es nicht gibt.
    const p = await erfassenFlaeche({
      "/api/auth/me": konto("admin"),
      "/api/kos/": kosRoute(
        { status: 200, body: ko("ko-1", "Ventilwartung", 4, [vorschlag()], "validiert", null) },
        [],
      ),
    });
    kandidaten()[0]?.click();
    await p.flush();

    expect(alle("#rw-vorschlaege-liste [data-rumpf]")).toHaveLength(0);
  });
});
