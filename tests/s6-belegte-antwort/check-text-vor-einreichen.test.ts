// @vitest-environment jsdom
// ================================================================================================
// JOB 3092 · S6 (W6) — DIE DUBLETTENPRUEFUNG VOR DEM EINREICHEN, AM LAUFENDEN ERFASSEN-WEG.
// ================================================================================================
//
// W6 (OFFEN.md) hiess bis hierher: `POST /api/check-text` ist die Dublettenpruefung — und Klara ruft
// sie nirgends. Der Weg dorthin (`w6DublettenAusCheckText`, tests/app/w6-dublettenweg-checktext)
// war gebaut, aber inert. Diese Datei misst am AUSGELIEFERTEN Aufgabenfenster (klara-panel-fixture,
// jsdom), dass die Erfassen-Flaeche ihn benutzt, SOBALD eine Markierung steht — also VOR dem Klick
// auf „Senden" — und was sie dabei sagt:
//   · Treffer: Titel, Beziehung, Fundort (soweit geliefert) — und der Sendeknopf bleibt frei
//     (blockiert nichts automatisch, §6).
//   · Kein Treffer: „Nichts Vergleichbares gefunden (geprueft <Zeit>)." — NUR nach erfolgreichem
//     Lauf (§9: keine negative Aussage ohne frische Datengrundlage).
//   · Fehler/Netz: „Pruefung nicht moeglich." — nie „nichts gefunden".
//   · Zu kurz (< 40 Zeichen, check-text-routes.ts:20): kein Ruf, ehrlicher Satz.
//   · Ohne Anmeldung: kein Ruf, keine Aussage.
// RED-FIRST: vor dem Umbau geht kein `POST /api/check-text` hinaus und `#capture-dubletten` fehlt.
import { afterEach, describe, expect, it } from "vitest";
import { type KlaraPanel, createKlaraPanel, reply } from "../app/klara-panel-fixture";

const MARKIERUNG =
  "Ventil vor jeder Wartung drucklos schalten und gegen Wiedereinschalten sichern.\nDanach den Druck protokollieren.";
const KURZ = "Ventil drucklos schalten.";

let panel: KlaraPanel | null = null;
afterEach(() => {
  panel?.restore();
  panel = null;
});

function oeffnen(opts: Parameters<typeof createKlaraPanel>[0] = {}): KlaraPanel {
  panel = createKlaraPanel({ selectionText: MARKIERUNG, ...opts });
  return panel;
}

function checkTextRufe(p: KlaraPanel): Array<Record<string, unknown>> {
  return p.calls
    .filter((c) => c.method === "POST" && c.url === "/api/check-text")
    .map((c) => JSON.parse(c.body ?? "{}") as Record<string, unknown>);
}

function drafts(p: KlaraPanel): number {
  return p.calls.filter((c) => c.method === "POST" && c.url === "/api/drafts").length;
}

/** Die Trefferzeilen (je <li>), leerraumnormiert. Der Gate-tsc ist Node-rein (keine DOM-lib) —
 *  dieselbe schmale Typisierung des Laufzeit-Globals wie in der Panel-Fixture. */
function zeilen(p: KlaraPanel): string[] {
  if (p.q("#capture-dubletten-liste") === null) throw new Error("#capture-dubletten-liste fehlt");
  const dokument = (
    globalThis as unknown as {
      document: { querySelectorAll(sel: string): ArrayLike<{ textContent: string | null }> };
    }
  ).document;
  return Array.from(dokument.querySelectorAll("#capture-dubletten-liste li")).map((li) =>
    String(li.textContent ?? "")
      .replace(/\s+/g, " ")
      .trim(),
  );
}

describe("JOB 3092 · S6 — Dublettenpruefung vor dem Einreichen (gemountet)", () => {
  it("C1 · mit Markierung geht GENAU EIN POST /api/check-text hinaus (Text, Sprache, Herkunft) — VOR jedem Senden, und der Knopf bleibt frei", async () => {
    const p = oeffnen({
      routes: {
        "/api/check-text": reply(200, {
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
        }),
      },
    });
    p.setTab("capture");
    await p.flush();
    const rufe = checkTextRufe(p);
    expect(rufe, "die Dublettenpruefung wurde nicht (genau einmal) gerufen").toHaveLength(1);
    expect(rufe[0]?.text).toBe(MARKIERUNG);
    expect(rufe[0]?.locale).toBe("de");
    expect(rufe[0]?.source).toBe("transient-document");
    // Noch NICHTS eingereicht — die Pruefung kam vor dem Senden.
    expect(drafts(p)).toBe(0);
    // Die Treffer stehen sichtbar in der Erfassen-Flaeche: Titel, Beziehung, Fundort soweit geliefert.
    expect(p.q("#capture-dubletten")?.className).toBe("");
    expect(p.q("#capture-dubletten")?.getAttribute("hidden")).toBeNull();
    expect(p.text("#capture-dubletten-satz")).toMatch(
      /^Dazu gibt es schon Vergleichbares \(geprüft \d{2}:\d{2}\):$/,
    );
    expect(zeilen(p)).toEqual([
      "Ventilwartung · teilweise gleich · Wartung · Validiert",
      "Druckentlastung · verwandt · Offen",
    ]);
    const link = p.q("#capture-dubletten-liste a");
    expect(link?.href).toContain("/wissen/ko-1");
    // Nichts wird blockiert: der Sendeknopf ist frei, das Senden geht weiter.
    expect(p.q("#send-btn")?.disabled).toBe(false);
    p.sendSelection();
    await p.flush();
    expect(drafts(p)).toBe(1);
  });

  it("C2 · kein Treffer: „Nichts Vergleichbares gefunden (geprueft <Zeit>).“ — nur nach erfolgreichem Lauf", async () => {
    const p = oeffnen({
      routes: { "/api/check-text": reply(200, { duplicates: [], conflicts: [], note: null }) },
    });
    p.setTab("capture");
    await p.flush();
    expect(checkTextRufe(p)).toHaveLength(1);
    expect(p.q("#capture-dubletten")?.className).toBe("");
    expect(p.text("#capture-dubletten-satz")).toMatch(
      /^Nichts Vergleichbares gefunden \(geprüft \d{2}:\d{2}\)\.$/,
    );
    expect(zeilen(p)).toEqual([]);
  });

  it("C3 · Fehlerantwort (503) und Netzfehler: „Pruefung nicht moeglich.“ — nie „nichts gefunden“", async () => {
    const p = oeffnen({ routes: { "/api/check-text": reply(503, {}) } });
    p.setTab("capture");
    await p.flush();
    expect(p.q("#capture-dubletten")?.className).toBe("");
    expect(p.text("#capture-dubletten-satz")).toBe("Prüfung nicht möglich.");
    expect(zeilen(p)).toEqual([]);
    p.restore();

    const netz = oeffnen({
      routes: {
        "/api/check-text": () => {
          throw new TypeError("Failed to fetch");
        },
      },
    });
    netz.setTab("capture");
    await netz.flush();
    expect(netz.text("#capture-dubletten-satz")).toBe("Prüfung nicht möglich.");
    expect(netz.text("#capture-dubletten-satz")).not.toMatch(/gefunden/);
  });

  it("C4 · zu kurze Markierung (< 40 Zeichen): kein Ruf, ehrlicher Satz", async () => {
    const p = oeffnen({
      selectionText: KURZ,
      routes: { "/api/check-text": reply(200, { duplicates: [], conflicts: [] }) },
    });
    p.setTab("capture");
    await p.flush();
    expect(checkTextRufe(p)).toHaveLength(0);
    expect(p.q("#capture-dubletten")?.className).toBe("");
    expect(p.text("#capture-dubletten-satz")).toBe("Dublettenprüfung erst ab 40 Zeichen.");
  });

  it("C5 · ohne Markierung oder ohne Anmeldung: kein Ruf, keine Aussage", async () => {
    const leer = oeffnen({
      selectionText: "",
      routes: { "/api/check-text": reply(200, { duplicates: [], conflicts: [] }) },
    });
    leer.setTab("capture");
    await leer.flush();
    expect(checkTextRufe(leer)).toHaveLength(0);
    expect(leer.q("#capture-dubletten")?.className).toBe("hidden");
    leer.restore();

    const abgemeldet = oeffnen({
      routes: {
        "/api/auth/me": reply(401, {}),
        "/api/check-text": reply(200, { duplicates: [], conflicts: [] }),
      },
    });
    abgemeldet.setTab("capture");
    await abgemeldet.flush();
    expect(checkTextRufe(abgemeldet)).toHaveLength(0);
    expect(abgemeldet.q("#capture-dubletten")?.className).toBe("hidden");
  });

  it("C6 · DE/EN gleichwertig: der Sprachwechsel zieht Satz und Beziehungen nach — ohne zweiten Ruf", async () => {
    const p = oeffnen({
      routes: {
        "/api/check-text": reply(200, {
          duplicates: [
            {
              koId: "ko-1",
              koTitle: "Ventilwartung",
              relation: "identisch",
              koStatus: "validiert",
              koCategory: "Wartung",
            },
          ],
          conflicts: [],
        }),
      },
    });
    p.setTab("capture");
    await p.flush();
    p.setLang("en");
    await p.flush();
    expect(checkTextRufe(p)).toHaveLength(1);
    expect(p.text("#capture-dubletten-satz")).toMatch(
      /^Comparable entries already exist \(checked \d{2}:\d{2}\):$/,
    );
    expect(zeilen(p)).toEqual(["Ventilwartung · identical · Wartung · Validated"]);
  });

  it("C7 · nach dem bestaetigten Senden (201) tritt die Dublettenauskunft zurueck — die Karte zeigt die Ergebniszeile", async () => {
    const p = oeffnen({
      routes: { "/api/check-text": reply(200, { duplicates: [], conflicts: [] }) },
    });
    p.setTab("capture");
    await p.flush();
    expect(p.q("#capture-dubletten")?.className).toBe("");
    p.sendSelection();
    await p.flush();
    expect(p.q("#capture-ergebnis")?.className).toBe("");
    expect(p.q("#capture-dubletten")?.className).toBe("hidden");
  });

  // ==============================================================================================
  // RUNDE 2 — BENS GEGENBEISPIELE (Korrekturpflichten 1 und 2, Pruefluecke 6).
  // ==============================================================================================
  // Die Route nimmt hoechstens 8.000 Zeichen (check-text-routes.ts:21); der Weg schneidet davor.
  // Bis Runde 1 sagte die Karte danach uneingeschraenkt „Nichts Vergleichbares gefunden" — obwohl
  // der Rest der Markierung nie geprueft wurde. Und eine Trefferliste, deren Eintraege keine
  // Kennung tragen, wurde still zu einer Leere. Beides ist „Erfindung statt Wissensluecke".
  const LANGER_ABSATZ = "Ventil vor jeder Wartung drucklos schalten und sichern. ";
  const LANG_TEXT = `${LANGER_ABSATZ.repeat(150)}\nHINTER DER SCHNITTGRENZE: Turboverdichter TVX99.`;

  it("C8 · Markierung ueber 8.000 Zeichen: nur der Anfang geht an die Route, und der Leersatz sagt das — keine uneingeschraenkte Entwarnung", async () => {
    expect(LANG_TEXT.length).toBeGreaterThan(8000);
    const p = oeffnen({
      selectionText: LANG_TEXT,
      routes: { "/api/check-text": reply(200, { duplicates: [], conflicts: [], note: null }) },
    });
    p.setTab("capture");
    await p.flush();
    const rufe = checkTextRufe(p);
    expect(rufe).toHaveLength(1);
    expect(String(rufe[0]?.text).length).toBe(8000);
    // Der Treffer laege ausschliesslich hinter Zeichen 8.000 — die Karte darf nicht „nichts" sagen.
    const satz = p.text("#capture-dubletten-satz");
    expect(satz).toMatch(
      /^Nur die ersten 8000 Zeichen konnten geprüft werden \(geprüft \d{2}:\d{2}\)/,
    );
    expect(satz).toMatch(/Rest bleibt ungeprüft/);
    expect(satz).not.toMatch(/^Nichts Vergleichbares gefunden/);
    // Mit Treffern im geprueften Anfang: dieselbe Einschraenkung, dann die Liste.
    p.restore();
    const mit = oeffnen({
      selectionText: LANG_TEXT,
      routes: {
        "/api/check-text": reply(200, {
          duplicates: [{ koId: "ko-1", koTitle: "Ventilwartung", relation: "teilweise" }],
          conflicts: [],
        }),
      },
    });
    mit.setTab("capture");
    await mit.flush();
    expect(mit.text("#capture-dubletten-satz")).toMatch(
      /^Nur die ersten 8000 Zeichen konnten geprüft werden \(geprüft \d{2}:\d{2}\) — darin schon Vergleichbares:$/,
    );
    expect(zeilen(mit)).toEqual(["Ventilwartung · teilweise gleich"]);
    // EN gleichwertig.
    mit.setLang("en");
    await mit.flush();
    expect(mit.text("#capture-dubletten-satz")).toMatch(
      /^Only the first 8000 characters could be checked \(checked \d{2}:\d{2}\) — comparable entries in them:$/,
    );
  });

  it("C9 · beschaedigte Trefferdaten (Eintraege ohne Kennung) sind KEINE Leere: „Pruefung nicht moeglich.“ — echte `duplicates: []` bleibt der Leersatz", async () => {
    const kaputt = oeffnen({
      routes: {
        "/api/check-text": reply(200, {
          duplicates: [{ koTitle: "Treffer ohne Kennung" }],
          conflicts: [],
        }),
      },
    });
    kaputt.setTab("capture");
    await kaputt.flush();
    expect(kaputt.text("#capture-dubletten-satz")).toBe("Prüfung nicht möglich.");
    expect(zeilen(kaputt)).toEqual([]);
    kaputt.restore();

    // Auch ein gueltiger neben einem ungueltigen Eintrag ist keine vollstaendige Auswertung.
    const gemischt = oeffnen({
      routes: {
        "/api/check-text": reply(200, {
          duplicates: [
            { koId: "ko-1", koTitle: "Ventilwartung" },
            { koId: "", koTitle: "leer" },
          ],
          conflicts: [],
        }),
      },
    });
    gemischt.setTab("capture");
    await gemischt.flush();
    expect(gemischt.text("#capture-dubletten-satz")).toBe("Prüfung nicht möglich.");
    expect(zeilen(gemischt)).toEqual([]);
    gemischt.restore();

    const echtLeer = oeffnen({
      routes: { "/api/check-text": reply(200, { duplicates: [], conflicts: [] }) },
    });
    echtLeer.setTab("capture");
    await echtLeer.flush();
    expect(echtLeer.text("#capture-dubletten-satz")).toMatch(
      /^Nichts Vergleichbares gefunden \(geprüft \d{2}:\d{2}\)\.$/,
    );
  });

  it("C10 · nach einem Netzfehler prueft die naechste Markierungslesung denselben Text erneut — ein Fehler ist kein Endzustand", async () => {
    let versuch = 0;
    const p = oeffnen({
      routes: {
        "/api/check-text": () => {
          versuch += 1;
          if (versuch === 1) throw new TypeError("Failed to fetch");
          return reply(200, { duplicates: [], conflicts: [] });
        },
      },
    });
    p.setTab("capture");
    await p.flush();
    expect(checkTextRufe(p)).toHaveLength(1);
    expect(p.text("#capture-dubletten-satz")).toBe("Prüfung nicht möglich.");
    // Der Reiterwechsel liest die Markierung neu (captureMarkierungLesen) — derselbe Text, aber
    // nach einem Fehler ein neuer Lauf.
    p.setTab("ask");
    p.setTab("capture");
    await p.flush();
    expect(checkTextRufe(p)).toHaveLength(2);
    expect(p.text("#capture-dubletten-satz")).toMatch(
      /^Nichts Vergleichbares gefunden \(geprüft \d{2}:\d{2}\)\.$/,
    );
    // Nach dem Erfolg wird derselbe Text NICHT noch einmal geprueft.
    p.setTab("ask");
    p.setTab("capture");
    await p.flush();
    expect(checkTextRufe(p)).toHaveLength(2);
  });
});
