// ================================================================================================
// Aufnahme gesamt-wissen-herkunft · R-0228 — DIE VERIFIZIERUNGSMARKE, WIE SIE AM EINTRAG STEHT.
// ================================================================================================
//
// Die Marke (apps/web/src/components/trust/Verifizierungsmarke.tsx) führt zusammen, was bisher aus
// getrennten Anzeigen und der Herkunftskette zusammengesucht werden musste: wer fachlich prüfte,
// wann, für welche Fassung — und ob der maschinelle Prüflauf vollständig war. Geprüft wird hier,
// dass jeder Zustand seinen eigenen, ehrlichen Satz bekommt und Fehlendes nie als „geprüft"
// erscheint. Der Einbau unter dem Kopf der Lesefläche steht als Quelltextzusage am Ende.
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it } from "vitest";
import { createElement } from "../../apps/web/node_modules/react";
import type { KnowledgeObject } from "../../apps/web/src/api/types";
import { Verifizierungsmarke } from "../../apps/web/src/components/trust/Verifizierungsmarke";
import { renderMarkup, setLanguage } from "../../apps/web/src/test/render";
import { repoPfad } from "../support/repoPfad";

const NAMEN: Record<string, string> = { "u-pia": "Pia Admin", "u-bo": "Bo Prüfer" };
const nameOf = (id: string): string => NAMEN[id] ?? `Unbekannte Person (${id})`;

type Marke = Pick<KnowledgeObject, "verifizierung" | "aiCheck">;

function zeige(ko: Marke): string {
  return renderMarkup(createElement(Verifizierungsmarke, { ko, nameOf }));
}

const BELEGT: Marke["verifizierung"] = {
  mensch: {
    stand: "belegt",
    art: "bewertung",
    pruefer: "u-bo",
    zeitpunkt: "2026-09-01T10:00:00.000Z",
    fassung: 3,
    aktuell: true,
  },
  validiertVon: ["u-bo", "u-pia"],
};

const VOLL = {
  available: 10,
  selected: 10,
  alreadyOpen: 0,
  attempted: 10,
  completed: 10,
  skipped: 0,
  capped: false,
  aborted: false,
};

afterEach(async () => {
  await setLanguage("de");
});

describe("R-0228 · die Marke nennt Prüfer, Zeitpunkt und Vollständigkeit gemeinsam", () => {
  it("belegt + vollständiger KI-Lauf: Name, Datum, Validierende und „vollständig“ in einer Marke", async () => {
    await setLanguage("de");
    const html = zeige({
      verifizierung: BELEGT,
      aiCheck: {
        status: "done",
        requestedAt: "2026-08-31T09:00:00.000Z",
        finishedAt: "2026-08-31T09:05:00.000Z",
        coverage: VOLL,
      },
    });
    expect(html).toContain('data-testid="ko-verifizierungsmarke"');
    expect(html).toContain("Fachlich geprüft von Bo Prüfer am 01.09.2026");
    expect(html).toContain("Validiert von: Bo Prüfer, Pia Admin");
    expect(html).toContain("Prüflauf vollständig");
    expect(html).toContain("abgeschlossen am 31.08.2026");
    // Die Kennung erscheint nicht als Name.
    expect(html).not.toContain("u-bo");
  });

  it("eine Prüfung der früheren Fassung sagt das ausdrücklich", async () => {
    await setLanguage("de");
    const html = zeige({
      verifizierung: {
        ...BELEGT,
        mensch: { ...BELEGT.mensch, fassung: 2, aktuell: false } as never,
      },
    });
    expect(html).toContain("Die Prüfung galt Fassung v2");
  });

  it("Verwalterfreigabe und Rückgabe sind eigene Sätze", async () => {
    await setLanguage("de");
    for (const [art, satz] of [
      ["verwalter", "als gültig gekennzeichnet (Verwalter, ohne Gegenprüfung)"],
      ["rueckgabe", "zur Nacharbeit zurückgegeben"],
    ] as const) {
      const html = zeige({
        verifizierung: { ...BELEGT, mensch: { ...BELEGT.mensch, art } as never },
      });
      expect(html, art).toContain(satz);
    }
  });
});

describe("R-0228 · Fehlendes wird ehrlich gekennzeichnet — nie „geprüft“", () => {
  it("jeder menschliche Zustand hat seinen eigenen Satz", async () => {
    await setLanguage("de");
    const faelle: [Marke["verifizierung"], string][] = [
      [{ mensch: { stand: "keine" }, validiertVon: [] }, "Noch nicht fachlich geprüft"],
      [{ mensch: { stand: "nicht_auffindbar" }, validiertVon: [] }, "nicht auffindbar"],
      [{ mensch: { stand: "nicht_abrufbar" }, validiertVon: [] }, "derzeit nicht abrufbar"],
      [undefined, "Angaben nicht geladen"],
    ];
    for (const [verifizierung, satz] of faelle) {
      const html = zeige(verifizierung ? { verifizierung } : {});
      expect(html, satz).toContain(satz);
      expect(html, satz).not.toContain("Fachlich geprüft von");
    }
  });

  it("kein KI-Lauf, unvollständiger Lauf und Lauf ohne Abdeckungsprotokoll sind unterscheidbar", async () => {
    await setLanguage("de");
    const keiner = zeige({ verifizierung: BELEGT });
    expect(keiner).toContain("Maschinelle Prüfung: keine erfasst");

    const luecke = zeige({
      verifizierung: BELEGT,
      aiCheck: {
        status: "done",
        requestedAt: "2026-08-31T09:00:00.000Z",
        coverage: { ...VOLL, completed: 7, attempted: 10, capped: true },
      },
    });
    expect(luecke).toContain("Prüflauf unvollständig (7 von 10)");
    expect(luecke).not.toContain("Prüflauf vollständig");

    const ohneProtokoll = zeige({
      verifizierung: BELEGT,
      aiCheck: { status: "done", requestedAt: "2026-08-31T09:00:00.000Z" },
    });
    expect(ohneProtokoll).toContain("Umfang des Prüflaufs nicht protokolliert");
  });

  it("ein laufender oder fehlgeschlagener Lauf behauptet keine Vollständigkeit", async () => {
    await setLanguage("de");
    for (const status of ["pending", "failed"] as const) {
      const html = zeige({
        verifizierung: BELEGT,
        aiCheck: { status, requestedAt: "2026-08-31T09:00:00.000Z", coverage: VOLL },
      });
      expect(html, status).not.toContain("Prüflauf vollständig");
    }
  });
});

describe("R-0228 · drei Sprachen und der Platz am Eintrag", () => {
  it("die Marke spricht Englisch und Niederländisch", async () => {
    await setLanguage("en");
    expect(zeige({ verifizierung: BELEGT })).toContain("Reviewed by Bo Prüfer");
    await setLanguage("nl");
    expect(zeige({ verifizierung: BELEGT })).toContain("Inhoudelijk gecontroleerd door Bo Prüfer");
  });

  it("die Lesefläche zeigt die Marke direkt unter dem Kopf — nicht in einem zugeklappten Abschnitt", () => {
    const lesen = readFileSync(
      repoPfad("apps/web/src/components/bibliothek/BibliothekLesen.tsx"),
      "utf8",
    );
    const kopfEnde = lesen.indexOf("</Menue>");
    const marke = lesen.indexOf("<Verifizierungsmarke ko={ko} nameOf={nameOf} />");
    const mehr = lesen.indexOf("<MehrAbschnitte");
    expect(marke).toBeGreaterThan(kopfEnde);
    expect(marke).toBeLessThan(mehr);
  });
});
