// @vitest-environment jsdom
// ================================================================================================
// R-0169 (Nacharbeit 8, bens F1) — DIE DOKUMENTKENNUNG IM WORD-PANEL, AUCH WENN DAS SPEICHERN SCHEITERT.
// ================================================================================================
//
// Gefahren wird das AUSGELIEFERTE `apps/web/public/word-addin/taskpane.html` über die vorhandene
// Panel-Fixture (`tests/app/klara-panel-fixture.ts`): Rumpf und Skript werden aus der Datei
// geschnitten und wirklich ausgeführt. Der Office-Fake bekommt Dokumenteinstellungen
// (`dokumentEinstellungen`), deren `saveAsync` gezielt scheitert oder gelingt.
//
// WAS DAS BELEGT: dass das Panel das Ergebnis des Speicherns AUSWERTET, eine unvollständige
// Bindung sichtbar meldet, eine Wiederholung dieselbe Serverkennung trägt (statt still ein neues
// Dokument zu senden), und dass eine erfolgreich gespeicherte Kennung beim nächsten Öffnen wieder
// gesendet wird. WAS ES NICHT BELEGT: dass echtes Word die Einstellung im .docx behält und nach
// Schliessen und Wiederöffnen herausgibt — das bleibt eine Prüfung am echten Word-Host.
import { afterEach, describe, expect, it } from "vitest";
import {
  type FakeDokumentEinstellungen,
  type KlaraPanel,
  createKlaraPanel,
  reply,
} from "./klara-panel-fixture";

const MARKIERUNG = "Erster Absatz der Markierung.\nZweiter Absatz der Markierung.";
const SCHLUESSEL = "klarwerkDokumentId";

let panel: KlaraPanel | null = null;
afterEach(() => {
  panel?.restore();
  panel = null;
  Reflect.deleteProperty(globalThis, "Word");
});

/**
 * Ein Server-Ersatz für `POST /api/drafts`: ohne mitgebrachte Kennung vergibt er eine neue (wie
 * `DokumentaktenService.festschreiben`), mit Kennung bleibt er bei ihr.
 */
function draftServer(scheitertBeiAufruf?: number) {
  let vergeben = 0;
  let aufrufe = 0;
  return (_url: string, init: Record<string, unknown> | undefined) => {
    aufrufe += 1;
    if (aufrufe === scheitertBeiAufruf) {
      return reply(500, { error: "INTERNAL" });
    }
    const rumpf = JSON.parse(typeof init?.body === "string" ? init.body : "{}") as {
      dokumentId?: string;
    };
    vergeben += 1;
    const dokumentId = rumpf.dokumentId ?? `dok-${vergeben}`;
    return reply(201, {
      id: `entwurf-${vergeben}`,
      dokumentHerkunft: { dokumentId, fassung: vergeben, fassungId: `fassung-${vergeben}` },
    });
  };
}

function oeffnen(einstellungen?: FakeDokumentEinstellungen): KlaraPanel {
  panel = createKlaraPanel({
    selectionText: MARKIERUNG,
    routes: {
      "/api/categories": reply(200, { categories: [] }),
      "/api/drafts": draftServer(),
    },
    ...(einstellungen ? { dokumentEinstellungen: einstellungen } : {}),
  });
  return panel;
}

async function senden(p: KlaraPanel): Promise<void> {
  p.sendSelection();
  await p.flush();
}

function gesendeteKennungen(p: KlaraPanel): Array<unknown> {
  return p.calls
    .filter((c) => c.method === "POST" && c.url === "/api/drafts")
    .map((c) => (JSON.parse(c.body ?? "{}") as { dokumentId?: unknown }).dokumentId);
}

describe("R-0169 · Word-Panel: Dokumentkennung speichern, Fehlschlag melden, Kennung halten", () => {
  it("F1 · saveAsync scheitert: Bindung erkennbar unvollständig, die Wiederholung trägt DIESELBE Serverkennung", async () => {
    const gespeichert: Record<string, unknown> = {};
    const p = oeffnen({ speichernScheitert: true, gespeichert });
    await p.flush();
    p.setTab("capture");
    await p.flush();

    await senden(p);
    expect(p.text("#send-status"), "der Speicherfehler blieb unbemerkt").toBe(
      p.t("sendDocIdUnsaved"),
    );
    expect(gespeichert[SCHLUESSEL], "ein gescheitertes Speichern hat etwas hinterlassen").toBe(
      undefined,
    );

    await senden(p);
    expect(
      gesendeteKennungen(p),
      "die Wiederholung ging ohne die vergebene Kennung hinaus",
    ).toEqual([undefined, "dok-1"]);
    expect(p.text("#send-status")).toBe(p.t("sendDocIdUnsaved"));
  });

  it("F1 · ohne Einstellungs-Schnittstelle: ebenfalls gemeldet und in der Sitzung gehalten", async () => {
    const p = oeffnen();
    await p.flush();
    p.setTab("capture");
    await p.flush();
    await senden(p);
    expect(p.text("#send-status")).toBe(p.t("sendDocIdUnsaved"));
    await senden(p);
    expect(gesendeteKennungen(p)).toEqual([undefined, "dok-1"]);
  });

  it("Positiv · saveAsync gelingt: Kennung gespeichert, keine Warnung, nach dem Wiederöffnen wieder gesendet", async () => {
    const gespeichert: Record<string, unknown> = {};
    const erst = oeffnen({ gespeichert });
    await erst.flush();
    erst.setTab("capture");
    await erst.flush();
    await senden(erst);
    expect(gespeichert[SCHLUESSEL]).toBe("dok-1");
    expect(erst.text("#send-status")).not.toBe(erst.t("sendDocIdUnsaved"));
    erst.restore();
    panel = null;

    // „Wiederöffnen": ein neues Panel über einem Dokument, das den gespeicherten Stand mitbringt.
    const wieder = oeffnen({ werte: { ...gespeichert } });
    await wieder.flush();
    wieder.setTab("capture");
    await wieder.flush();
    await senden(wieder);
    expect(gesendeteKennungen(wieder)).toEqual(["dok-1"]);
  });
});

// ================================================================================================
// WORD-HOST-GESAMTWEG (Realhostbeleg 06.10.2026) — `saveAsync` ANTWORTET SPÄTER ALS DER SENDEWEG.
// ================================================================================================
//
// Am echten Word stand die Warnung `sendDocIdUnsaved` da, obwohl `klarwerkDokumentId` nachweislich
// gespeichert war: die Warnung erschien, solange die Speicherung noch lief, und der spätere Erfolg
// nahm sie nicht zurück. Die Attrappe ruft hier verzögert zurück (`verzoegert`); geprüft wird für
// BEIDE Übernahmewege: ausstehend, verzögerter Erfolg, verzögerter Fehler, eine zwischenzeitlich
// neuere Meldung — und dass ein später Erfolg genau die Warnung seiner Kennung zurücknimmt.

type Weg = "auswahl" | "ganzdokument";
const WEGE: readonly Weg[] = ["auswahl", "ganzdokument"];
const DOCX = { bytes: [0x50, 0x4b, 0x03, 0x04, 0x14, 0x00], scheibenBytes: 4 };

function oeffnenAuf(
  weg: Weg,
  einstellungen: FakeDokumentEinstellungen,
  scheitertBeiAufruf?: number,
): KlaraPanel {
  const server = draftServer(scheitertBeiAufruf);
  const ziel = weg === "auswahl" ? "/api/drafts" : "/api/drafts/from-docx";
  panel = createKlaraPanel({
    selectionText: MARKIERUNG,
    routes: { "/api/categories": reply(200, { categories: [] }), [ziel]: server },
    ...(weg === "ganzdokument" ? { docxDatei: DOCX } : {}),
    dokumentEinstellungen: einstellungen,
  });
  return panel;
}

async function bereit(p: KlaraPanel): Promise<void> {
  await p.flush();
  p.setTab("capture");
  await p.flush();
}

async function sendenAuf(p: KlaraPanel, weg: Weg): Promise<void> {
  if (weg === "auswahl") {
    p.sendSelection();
  } else {
    p.sendDocument();
  }
  await p.flush();
}

/** Die älteste ausstehende `saveAsync`-Rückmeldung auslösen. */
async function rueckmelden(p: KlaraPanel, e: FakeDokumentEinstellungen): Promise<void> {
  const antwort = e.ausstehend?.shift();
  if (antwort === undefined) {
    throw new Error("keine ausstehende saveAsync-Rückmeldung");
  }
  antwort();
  await p.flush();
}

function wegAufrufe(p: KlaraPanel, weg: Weg): number {
  const ziel = weg === "auswahl" ? "/api/drafts" : "/api/drafts/from-docx";
  return p.calls.filter((c) => c.method === "POST" && c.url === ziel).length;
}

for (const weg of WEGE) {
  describe(`Word-Host-Gesamtweg · verzögertes saveAsync · ${weg}`, () => {
    it("V1 · ausstehend: keine Speicherfehlerwarnung, noch nichts gespeichert", async () => {
      const e: FakeDokumentEinstellungen = { verzoegert: true, gespeichert: {} };
      const p = oeffnenAuf(weg, e);
      await bereit(p);
      await sendenAuf(p, weg);
      expect(wegAufrufe(p, weg), "der Lauf ging nicht über diesen Weg").toBe(1);
      expect(e.ausstehend).toHaveLength(1);
      expect(e.gespeichert?.[SCHLUESSEL]).toBeUndefined();
      expect(p.text("#send-status")).not.toBe(p.t("sendDocIdUnsaved"));
    });

    it("V2 · verzögerter Erfolg: Kennung gespeichert, keine Warnung — auch danach nicht", async () => {
      const e: FakeDokumentEinstellungen = { verzoegert: true, gespeichert: {} };
      const p = oeffnenAuf(weg, e);
      await bereit(p);
      await sendenAuf(p, weg);
      await rueckmelden(p, e);
      expect(e.gespeichert?.[SCHLUESSEL]).toBe("dok-1");
      expect(p.text("#send-status")).not.toBe(p.t("sendDocIdUnsaved"));
    });

    it("V3 · verzögerter Fehler: die Warnung erscheint, die Wiederholung trägt dieselbe Kennung", async () => {
      const e: FakeDokumentEinstellungen = { verzoegert: true, gespeichert: {} };
      const p = oeffnenAuf(weg, e);
      await bereit(p);
      await sendenAuf(p, weg);
      e.speichernScheitert = true;
      await rueckmelden(p, e);
      expect(p.text("#send-status")).toBe(p.t("sendDocIdUnsaved"));
      expect(e.gespeichert?.[SCHLUESSEL]).toBeUndefined();
    });

    it("V4 · eine zwischenzeitlich neuere Meldung bleibt stehen, wenn der Erfolg spät kommt", async () => {
      const e: FakeDokumentEinstellungen = { verzoegert: true, gespeichert: {} };
      const p = oeffnenAuf(weg, e, 2);
      await bereit(p);
      await sendenAuf(p, weg);
      await sendenAuf(p, weg);
      const neuere = p.text("#send-status");
      expect(neuere.length, "der zweite Lauf hat keine eigene Meldung").toBeGreaterThan(0);
      expect(neuere).not.toBe(p.t("sendDocIdUnsaved"));
      await rueckmelden(p, e);
      expect(p.text("#send-status")).toBe(neuere);
      expect(e.gespeichert?.[SCHLUESSEL]).toBe("dok-1");
    });

    it("V5 · ein später ECHTER Fehler bleibt sichtbar, auch über einer neueren Meldung", async () => {
      const e: FakeDokumentEinstellungen = { verzoegert: true, gespeichert: {} };
      const p = oeffnenAuf(weg, e, 2);
      await bereit(p);
      await sendenAuf(p, weg);
      await sendenAuf(p, weg);
      e.speichernScheitert = true;
      await rueckmelden(p, e);
      expect(p.text("#send-status")).toBe(p.t("sendDocIdUnsaved"));
    });

    it("V6 · ein späterer Erfolg nimmt die Warnung DERSELBEN Kennung zurück", async () => {
      const e: FakeDokumentEinstellungen = { verzoegert: true, gespeichert: {} };
      const p = oeffnenAuf(weg, e);
      await bereit(p);
      await sendenAuf(p, weg);
      await sendenAuf(p, weg);
      expect(gesendeteKennungenAuf(p, weg)).toEqual([undefined, "dok-1"]);
      expect(e.ausstehend).toHaveLength(2);
      e.speichernScheitert = true;
      await rueckmelden(p, e);
      expect(p.text("#send-status")).toBe(p.t("sendDocIdUnsaved"));
      e.speichernScheitert = false;
      await rueckmelden(p, e);
      expect(e.gespeichert?.[SCHLUESSEL]).toBe("dok-1");
      expect(p.text("#send-status")).not.toBe(p.t("sendDocIdUnsaved"));
    });
  });
}

function gesendeteKennungenAuf(p: KlaraPanel, weg: Weg): Array<unknown> {
  const ziel = weg === "auswahl" ? "/api/drafts" : "/api/drafts/from-docx";
  return p.calls
    .filter((c) => c.method === "POST" && c.url === ziel)
    .map((c) => (JSON.parse(c.body ?? "{}") as { dokumentId?: unknown }).dokumentId);
}
