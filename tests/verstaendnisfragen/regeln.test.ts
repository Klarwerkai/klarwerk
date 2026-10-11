// ================================================================================================
// VERSTÄNDNISFRAGEN · DIE REINEN REGELN (aufnahme:20260922:gesamt-lernwege, Zusatz 03.10.2026).
// ================================================================================================
//
// Ohne App, ohne Datenbank: Bewertung, Belegprüfung, fachliche Gleichheit zweier Fassungen und die
// Formprüfung der Eingabe. Getrennte, fiktive Beispieldaten — keine produktiven Inhalte.
//
//   R1  (K17) richtig / falsch / unvollständig nach der festgelegten Regel; ohne Regel keine Bewertung.
//   R2  (K16/K17) eine Frage ohne wörtlich gefundene Belegstelle ist nicht veröffentlichbar; ohne
//       vorliegende Quelle gilt keine Belegstelle als gefunden.
//   R3  (K19) eine reine Bestätigung (neue Versionsnummer, gleicher Inhalt) ist keine fachliche
//       Änderung; eine geänderte Aussage ist eine.
//   R4  Formprüfung: Grenzen und Typen, aber fehlende Belege sind Befunde, keine Formfehler.
//   R5  die gültige Version ist die höchste angenommene, nicht die jüngste.
import { describe, expect, it } from "vitest";
import {
  type FragensatzFassung,
  VerstaendnisFehler,
  befundeFuer,
  belegGefunden,
  bewerte,
  fragenAus,
  gleicherInhalt,
  gueltigeFassung,
  htmlText,
  ohneBefund,
  pruefeEingabe,
  quelltext,
  textNormal,
} from "../../services/app/src/verstaendnisfragen";

const QUELLE = {
  title: "Druckluftbehälter vor Inbetriebnahme prüfen",
  statement:
    "Vor dem Einschalten das Sicherheitsventil von Hand anlüften und im Prüfbuch festhalten.",
  bodyHtml:
    "<p>Der Prüfdruck beträgt <strong>11&nbsp;bar</strong>.</p><ul><li>Schild anbringen</li></ul>",
  conditions: ["Nur bei drucklosem Behälter"],
  measures: ["Prüfbuch führen"],
};

function fassung(teil: Partial<FragensatzFassung> = {}): FragensatzFassung {
  const eingabe = pruefeEingabe({
    koVersion: 2,
    titel: "Druckluft · Beispiel",
    rollen: ["experte"],
    regel: { mindestRichtig: 2, hoechstVersuche: 2 },
    fragen: [
      {
        text: "Was wird vor dem Einschalten von Hand angelüftet?",
        optionen: ["Das Sicherheitsventil", "Der Kompressor", "Die Leitung"],
        richtig: [0],
        erlaeuterung: "Die Anweisung nennt das Sicherheitsventil.",
        beleg: "das Sicherheitsventil von Hand anlüften",
      },
      {
        text: "Wie hoch ist der Prüfdruck?",
        optionen: ["6 bar", "11 bar"],
        richtig: [1],
        erlaeuterung: "Der Text nennt 11 bar.",
        beleg: "Der Prüfdruck beträgt 11 bar",
      },
      {
        text: "Was gehört zur Dokumentation?",
        optionen: ["Prüfbuch führen", "Schild anbringen", "Foto posten"],
        richtig: [0, 1],
        erlaeuterung: "Prüfbuch und Schild sind genannt.",
        beleg: "Prüfbuch führen",
      },
    ],
  });
  return {
    id: "satz-1",
    version: 1,
    koId: "ko-beispiel",
    koVersion: 2,
    titel: eingabe.titel,
    rollen: eingabe.rollen,
    fragen: fragenAus(eingabe),
    regel: eingabe.regel,
    status: "entwurf",
    geaendertVon: "konto-anna",
    geaendertAm: "2026-10-11T08:00:00.000Z",
    vorgelegtVon: null,
    vorgelegtAm: null,
    entschiedenVon: null,
    entschiedenAm: null,
    begruendung: null,
    ...teil,
  };
}

describe("R1 · Bewertung nach der festgelegten Regel", () => {
  const f = fassung();

  it("richtig: alle drei genau richtig → bestanden", () => {
    const b = bewerte(f, [
      { frageId: "f1", gewaehlt: ["o1"] },
      { frageId: "f2", gewaehlt: ["o2"] },
      { frageId: "f3", gewaehlt: ["o2", "o1"] },
    ]);
    expect(b).toMatchObject({ richtig: 3, fragen: 3, bestanden: true, unvollstaendig: false });
  });

  it("falsch: Mehrfachfrage nur halb gewählt und eine falsche Wahl → nicht bestanden", () => {
    const b = bewerte(f, [
      { frageId: "f1", gewaehlt: ["o2"] },
      { frageId: "f2", gewaehlt: ["o2"] },
      { frageId: "f3", gewaehlt: ["o1"] },
    ]);
    expect(b.je.map((e) => e.urteil)).toEqual(["falsch", "richtig", "falsch"]);
    expect(b).toMatchObject({ richtig: 1, bestanden: false, unvollstaendig: false });
  });

  it("unvollständig: unbeantwortet zählt als nicht richtig — die Regel entscheidet", () => {
    const zwei = bewerte(f, [
      { frageId: "f1", gewaehlt: ["o1"] },
      { frageId: "f2", gewaehlt: ["o2"] },
    ]);
    expect(zwei.je.map((e) => e.urteil)).toEqual(["richtig", "richtig", "unbeantwortet"]);
    expect(zwei).toMatchObject({ richtig: 2, unbeantwortet: 1, bestanden: true });
    expect(zwei.unvollstaendig).toBe(true);
    const eins = bewerte(f, [{ frageId: "f1", gewaehlt: ["o1"] }]);
    expect(eins).toMatchObject({ richtig: 1, unbeantwortet: 2, bestanden: false });
    expect(eins.unvollstaendig).toBe(true);
  });

  it("ohne festgelegte Regel gibt es keine Bewertung", () => {
    const ohne = fassung({ regel: { mindestRichtig: null, hoechstVersuche: 1 } });
    expect(() => bewerte(ohne, [])).toThrow(VerstaendnisFehler);
  });
});

describe("R2 · Belegstelle wörtlich in der gebundenen Fassung", () => {
  const text = quelltext(QUELLE);

  it("HTML wird zu lesbarem Text (Entitäten aufgelöst, Tags entfernt)", () => {
    expect(textNormal(htmlText("<p>11&nbsp;bar &amp; mehr</p>"))).toBe("11 bar & mehr");
    expect(text).toContain("Der Prüfdruck beträgt 11 bar.");
  });

  it("gefunden — auch über Zeilenumbrüche; nicht gefunden bei abweichendem Wortlaut", () => {
    expect(belegGefunden("das Sicherheitsventil\n von Hand   anlüften", text)).toBe(true);
    expect(belegGefunden("das Sicherheitsventil öffnen", text)).toBe(false);
    // Zu kurze Stellen gelten nicht als Beleg.
    expect(belegGefunden("bar", text)).toBe(false);
  });

  it("vollständig belegt → keine Befunde; ein fehlender Beleg erzeugt keine Musterantwort", () => {
    expect(ohneBefund(befundeFuer(fassung(), text, "aktuell"))).toBe(true);
    const ohneBeleg = fassung();
    const erste = ohneBeleg.fragen[0];
    if (!erste) {
      throw new Error("Beispiel ohne Frage");
    }
    erste.beleg = "";
    const zweite = ohneBeleg.fragen[1];
    if (!zweite) {
      throw new Error("Beispiel ohne zweite Frage");
    }
    zweite.beleg = "Der Prüfdruck beträgt 16 bar";
    const b = befundeFuer(ohneBeleg, text, "aktuell");
    expect(b.fragen[0]?.befunde).toContain("beleg_fehlt");
    expect(b.fragen[1]?.befunde).toContain("beleg_nicht_in_quelle");
    expect(ohneBefund(b)).toBe(false);
  });

  it("ohne vorliegende Quelle gilt keine Stelle als gefunden — und die Lage wird Befund", () => {
    const b = befundeFuer(fassung(), null, "fehlt");
    expect(b.satz).toContain("quelle_fehlt");
    expect(b.fragen.every((f) => f.befunde.includes("beleg_nicht_in_quelle"))).toBe(true);
  });

  it("Regel und Wiederholung sind Pflicht, aber nicht vorbelegt", () => {
    const ohneRegel = fassung({ regel: { mindestRichtig: null, hoechstVersuche: null } });
    expect(befundeFuer(ohneRegel, text, "aktuell").satz).toEqual([
      "regel_fehlt",
      "wiederholung_fehlt",
    ]);
    const zuHoch = fassung({ regel: { mindestRichtig: 4, hoechstVersuche: 0 } });
    expect(befundeFuer(zuHoch, text, "aktuell").satz).toEqual([
      "regel_ungueltig",
      "wiederholung_ungueltig",
    ]);
  });

  it("eine Frage ohne richtige Antwort ist nicht veröffentlichbar", () => {
    const f = fassung();
    const erste = f.fragen[0];
    if (!erste) {
      throw new Error("Beispiel ohne Frage");
    }
    erste.richtig = [];
    expect(befundeFuer(f, text, "aktuell").fragen[0]?.befunde).toEqual(["keine_richtige_antwort"]);
  });
});

describe("R3 · fachliche Änderung der Quelle", () => {
  it("gleicher Inhalt (nur Bestätigung) ist keine Änderung; eine neue Aussage ist eine", () => {
    expect(gleicherInhalt(QUELLE, { ...QUELLE })).toBe(true);
    const geaendert = { ...QUELLE, statement: `${QUELLE.statement} Neu: 12 bar.` };
    expect(gleicherInhalt(QUELLE, geaendert)).toBe(false);
  });
});

describe("R4 · Formprüfung der Eingabe", () => {
  it("Positionen der richtigen Antworten werden zu stabilen Kennungen je Version", () => {
    const fragen = fassung().fragen;
    expect(fragen.map((f) => f.id)).toEqual(["f1", "f2", "f3"]);
    expect(fragen[2]?.richtig).toEqual(["o1", "o2"]);
  });

  it("Formfehler werfen 400 — ein leerer Beleg dagegen nicht", () => {
    expect(() => pruefeEingabe({ titel: "x", koVersion: 0 })).toThrow(VerstaendnisFehler);
    expect(() => pruefeEingabe({ titel: "", koVersion: 2 })).toThrow(VerstaendnisFehler);
    expect(() => pruefeEingabe({ titel: "x", koVersion: 2, rollen: ["gast"] })).toThrow(
      VerstaendnisFehler,
    );
    expect(() =>
      pruefeEingabe({
        titel: "x",
        koVersion: 2,
        fragen: [{ text: "a", optionen: ["1", "2"], richtig: [5] }],
      }),
    ).toThrow(VerstaendnisFehler);
    const ok = pruefeEingabe({ titel: "x", koVersion: 2, fragen: [{ text: "a", optionen: [] }] });
    expect(ok.fragen[0]?.beleg).toBe("");
    expect(ok.regel).toEqual({ mindestRichtig: null, hoechstVersuche: null });
  });
});

describe("R5 · die gültige Version", () => {
  it("ist die höchste angenommene, auch wenn ein neuerer Entwurf existiert", () => {
    const v1 = fassung({ version: 1, status: "angenommen" });
    const v2 = fassung({ version: 2, status: "entwurf" });
    expect(gueltigeFassung([v1, v2])?.version).toBe(1);
    expect(gueltigeFassung([v2])).toBeNull();
  });
});
