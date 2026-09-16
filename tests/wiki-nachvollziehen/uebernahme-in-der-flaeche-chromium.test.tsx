// @vitest-environment jsdom
// ================================================================================================
// JOB 4213 · AUF DER ECHTEN FLÄCHE — AUSWAHL, ÜBERNAHMEKNOPF UND DIE KONFLIKTAUSKUNFT.
// ================================================================================================
//
// DER GEMESSENE AUSGANGSZUSTAND (Basisstand f5fe18b): die Fassungskarte trug GENAU EINEN Knopf, und
// der klappte nur auf und zu (`MehrAbschnitte.tsx:1920-1935`). Im geöffneten Zustand stand wörtlich
// „Alte Fassung v{{version}} · nur lesbar". Es gab keinen Übernahmeweg — weder Knopf noch Aufruf —
// und keine Auswahl, mit der sich zwei Fassungen vergleichen liessen. Jeder Fall dieser Datei ist
// vor dieser Runde rot.
//
// WAS DER NAME DIESER DATEI SAGT UND WAS SIE WIRKLICH MISST (Ehrlichkeit vor Optik): der Auftrag
// verlangt sie unter diesem Namen und in der Bauform von
// `tests/ux28-fassungen/fassung-per-tastatur-oeffnen.test.tsx` — und das ist jsdom, kein Chromium.
// Gemessen wird deshalb genau das, was in jsdom messbar ist: die Tabulator-Reihenfolge als Menge
// der fokussierbaren Elemente, der Fokus, und die AUSLÖSUNG über das Klick-Ereignis, das ein
// Browser an einem nativen `<button>` aus Eingabe- UND Leertaste erzeugt. Dass die Tasten dieses
// Ereignis erzeugen, leistet der Browser; diese Datei behauptet es nicht.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../apps/web/src/api/endpoints", async () => (await import("./netz")).endpointsDoppel());
vi.mock("../../apps/web/src/api/auth", async () => (await import("./netz")).authDoppel());

import {
  abbauen,
  ausloesen,
  erneutKnopf,
  fassungsInhalt,
  fassungsKnopf,
  flaecheMit,
  i18n,
  tabFolge,
  text,
  uebernahmeKnopf,
  uebernahmeKnopfOderNull,
  uebernahmeLage,
  vergleichsFeld,
  vergleichsFlaeche,
  vergleichsWahl,
  waehlen,
} from "./flaeche";
import { BERICHT_V1_TEXT, dreiFassungen, konfliktFehler, netz, zuruecksetzen } from "./netz";

beforeEach(async () => {
  zuruecksetzen();
  netz.fassungen = dreiFassungen();
});

afterEach(() => {
  abbauen();
  zuruecksetzen();
});

describe("JOB 4213 · A — zwei Fassungen zum Vergleich bestimmen", () => {
  beforeEach(async () => {
    await flaecheMit();
  });

  it("die Auswahl steht als natives `<select>` in der Tabulator-Reihenfolge des Abschnitts", () => {
    expect(vergleichsFlaeche(), "es gibt keine Vergleichsfläche").not.toBeNull();
    const folge = tabFolge();
    for (const welche of ["von", "bis"] as const) {
      const feld = vergleichsWahl(welche);
      expect(feld.tagName, `die Auswahl „${welche}" ist kein natives Auswahlfeld`).toBe("SELECT");
      expect(feld.disabled).toBe(false);
      expect(feld.tabIndex).toBe(0);
      expect(folge.includes(feld), `der Tabulator überspringt die Auswahl „${welche}"`).toBe(true);
      // Jede gespeicherte Fassung steht zur Wahl — sonst wäre „frei gewählt" eine Behauptung. Der
      // leere Eintrag steht vorn: „noch nichts gewählt" ist ein eigener Zustand.
      expect([...feld.options].map((o) => o.value)).toEqual(["", "3", "2", "1"]);
      expect(feld.value, "die Auswahl ist vorbelegt").toBe("");
    }
  });

  it("ohne Wahl steht KEINE Gegenüberstellung da — auch keine leere", () => {
    // Eine Vorbelegung stellte beim blossen Aufklappen ungefragt zwei Fassungsinhalte nebeneinander
    // (dagegen steht `tests/ux28-fassungen/fassung-per-tastatur-oeffnen.test.tsx` B).
    expect(vergleichsFeld("statement"), "verglichen wird ungefragt").toBeNull();
    expect(vergleichsFeld("bodyHtml")).toBeNull();
    expect(text(vergleichsFlaeche())).toContain(i18n.t("ko.snapshotCompareHint"));
    expect(text(vergleichsFlaeche()), "eine Verneinung ohne gewählte Fassungen").not.toContain(
      i18n.t("ko.snapshotCompareNone"),
    );
  });

  it("die Auswahl nimmt den Fokus an — gemessen, nicht behauptet", () => {
    const feld = vergleichsWahl("von");
    feld.focus();
    expect(document.activeElement).toBe(feld);
  });

  it("v1 gegen v3 zeigt die Unterschiede BEIDER Fassungen, je Feld mit beiden Werten", async () => {
    await waehlen(vergleichsWahl("von"), "1");
    await waehlen(vergleichsWahl("bis"), "3");

    const aussage = vergleichsFeld("statement");
    expect(aussage, "die Aussage fehlt in der Gegenüberstellung").not.toBeNull();
    expect(text(aussage), "der ALTE Wert steht nicht da").toContain("Nur trocken abkehren.");
    expect(text(aussage), "der NEUE Wert steht nicht da").toContain("Dichtungen");
    // Und das Feld, das sich NUR zwischen v2 und v3 ändert, ist ebenfalls dabei — der Vergleich
    // hängt also wirklich nicht mehr am unmittelbaren Vorgänger.
    expect(vergleichsFeld("measures"), "die Maßnahmen fehlen").not.toBeNull();
    expect(text(vergleichsFeld("measures"))).toContain("Trockenreinigung");
  });

  it("der Bericht der Gegenüberstellung geht durch den EINEN Zeichenweg des Hauses", async () => {
    await waehlen(vergleichsWahl("von"), "1");
    await waehlen(vergleichsWahl("bis"), "3");
    const bericht = vergleichsFeld("bodyHtml");
    expect(bericht, "der ausführliche Inhalt fehlt in der Gegenüberstellung").not.toBeNull();
    expect(text(bericht)).toContain(BERICHT_V1_TEXT);
    // Kein `dangerouslySetInnerHTML` von Hand: das Markup ist gezeichnet, nicht als Text gedruckt.
    expect(bericht?.innerHTML ?? "", "das Roh-HTML steht als Text auf der Fläche").not.toContain(
      "&lt;p&gt;",
    );
  });

  it("zwei gleiche Fassungen ergeben KEINE Verneinung über eine Änderung", async () => {
    await waehlen(vergleichsWahl("von"), "3");
    await waehlen(vergleichsWahl("bis"), "3");
    expect(text(vergleichsFlaeche())).toContain(i18n.t("ko.snapshotCompareSame"));
    expect(text(vergleichsFlaeche())).not.toContain(i18n.t("ko.snapshotCompareNone"));
  });
});

describe("JOB 4213 · B — mit nur EINER Fassung steht ein Satz, kein toter Knopf", () => {
  it("die Auswahl fehlt, und der Grund steht da", async () => {
    netz.fassungen = dreiFassungen().slice(0, 1);
    await flaecheMit();
    expect(vergleichsFlaeche(), "eine Auswahl mit einem einzigen Eintrag").toBeNull();
    expect(text(document.querySelector('[data-bib-abschnitt="schnappschuesse"]'))).toContain(
      i18n.t("ko.snapshotCompareNeedsTwo"),
    );
  });
});

describe("JOB 4213 · C — „Als Arbeitsfassung übernehmen“", () => {
  beforeEach(async () => {
    await flaecheMit();
    await ausloesen(fassungsKnopf(1));
  });

  it("der Knopf ist ein nativer Schalter, erreichbar, und sein Name nennt die Fassung", () => {
    const knopf = uebernahmeKnopf(1);
    expect(knopf.tagName).toBe("BUTTON");
    expect(knopf.type, "ein Absendeknopf statt eines Schalters").toBe("button");
    expect(knopf.disabled).toBe(false);
    expect(knopf.tabIndex).toBe(0);
    expect(tabFolge().includes(knopf), "der Tabulator überspringt den Übernahmeknopf").toBe(true);
    knopf.focus();
    expect(document.activeElement, "der Knopf nimmt den Fokus nicht an").toBe(knopf);

    const name = knopf.getAttribute("aria-label") ?? text(knopf);
    expect(name, "der Name nennt die Version nicht").toContain("v1");
    expect(name, "der Name nennt die Handlung nicht").toContain(i18n.t("ko.snapshotRestore"));
  });

  it("der alte Satz „nur lesbar“ steht dort NICHT mehr, wo übernommen werden kann", () => {
    expect(
      text(fassungsInhalt(1)),
      "die Fläche behauptet weiterhin, hier sei nur zu lesen",
    ).not.toContain("nur lesbar");
    // Was wahr bleibt, steht weiterhin da: DIESE Fassung ändert sich nicht.
    expect(text(fassungsInhalt(1))).toContain(i18n.t("ko.snapshotReadOnly", { version: 1 }));
  });

  it("die Auslösung schickt NUR die Fassungsnummer und den gesehenen Stand — keinen Inhalt", async () => {
    // RUNDE 3 · BENs Korrekturpflicht 2. Bis dahin schickte diese Fläche die Felder der alten
    // Fassung selbst mit, und der Server glaubte sie: mit `restoredFromVersion: 1` liess sich
    // beliebiger Text speichern und wurde danach als „aus Fassung v1 übernommen" gelesen. Was der
    // Aufruf NICHT trägt, kann auch nicht gefälscht werden — deshalb misst dieser Fall die
    // ABWESENHEIT jedes Inhaltsfeldes, nicht seinen Wert.
    await ausloesen(uebernahmeKnopf(1));
    expect(netz.aufrufe.length, "es ist kein Schreibvorgang losgegangen").toBe(1);
    const aufruf = netz.aufrufe[0] as {
      action: string;
      expectedVersion: number;
      changes: Record<string, unknown>;
    };
    expect(aufruf.action, "es entstand eine zweite Schreibtür neben `revise`").toBe("revise");
    expect(aufruf.expectedVersion, "die Übernahme ist an keinen gesehenen Stand gebunden").toBe(3);
    expect(aufruf.changes.restoredFromVersion, "die Herkunft reist nicht mit").toBe(1);
    expect(
      Object.keys(aufruf.changes).sort(),
      "die Fläche schickt neben der Fassungsnummer noch etwas anderes mit",
    ).toEqual(["restoredFromVersion"]);

    expect(text(uebernahmeLage(1)), "der Ausgang wird nicht gemeldet").toContain(
      i18n.t("ko.snapshotRestoreDone", { version: 1 }),
    );
  });

  it("an der aktuellen Fassung steht kein Knopf, sondern der Grund", () => {
    expect(uebernahmeKnopfOderNull(3), "die aktuelle Fassung bietet eine Übernahme an").toBeNull();
  });
});

describe("JOB 4213 · D — der Konflikt sagt die Wahrheit und erhält die Absicht", () => {
  beforeEach(async () => {
    netz.actFehler = konfliktFehler();
    await flaecheMit();
    await ausloesen(fassungsKnopf(1));
    await ausloesen(uebernahmeKnopf(1));
  });

  it("die Meldung sagt, dass nichts übernommen wurde — und empfiehlt KEIN Neuladen", () => {
    const lage = text(uebernahmeLage(1));
    expect(lage, "der Konflikt wird gar nicht gemeldet").toContain(
      i18n.t("ko.snapshotRestoreStale"),
    );
    // Die Korrekturpflicht aus JOB 4146 R6/R7, hier als dauerhafter Fall: wer neu lädt, verliert,
    // was er gerade tun wollte. Gemessen an der VOLLSTÄNDIGEN sichtbaren Meldung, nicht nur am Satz.
    for (const wort of ["neu laden", "neu lesen", "Neuladen", "aktualisieren"]) {
      expect(lage.toLowerCase(), `die Meldung empfiehlt „${wort}“`).not.toContain(
        wort.toLowerCase(),
      );
    }
    // Und die Servermeldung steht nicht roh daneben — sie nennt Versionszahlen, die hier niemand
    // deuten kann.
    expect(lage, "die Rohmeldung des Servers steht auf der Fläche").not.toContain("erwartet 3");
  });

  it("das Vorhaben bleibt: derselbe Weg steht als ausdrücklicher zweiter Griff daneben", async () => {
    const erneut = erneutKnopf(1);
    expect(erneut, "nach dem Konflikt gibt es keinen Weg weiter").not.toBeNull();
    expect(erneut?.getAttribute("aria-label") ?? "").toContain("v1");
    expect(fassungsInhalt(1), "die Fassung, um die es ging, ist zugefallen").not.toBeNull();

    netz.actFehler = null;
    await ausloesen(erneut as HTMLButtonElement);
    expect(netz.aufrufe.length, "der zweite Griff geht nicht los").toBe(2);
    expect(
      (netz.aufrufe[1] as { changes: { restoredFromVersion: number } }).changes.restoredFromVersion,
      "der zweite Griff meint eine andere Fassung",
    ).toBe(1);
    expect(text(uebernahmeLage(1))).toContain(i18n.t("ko.snapshotRestoreDone", { version: 1 }));
  });
});

describe("JOB 4213 · E — ohne Bearbeitungsrecht steht ein Satz statt einer verschlossenen Tür", () => {
  it("der `viewer` sieht, warum hier nichts zu holen ist", async () => {
    netz.rolle = "viewer";
    await flaecheMit();
    await ausloesen(fassungsKnopf(1));
    expect(
      uebernahmeKnopfOderNull(1),
      "der viewer bekommt einen Knopf, der ihm nichts nützt",
    ).toBeNull();
    expect(text(fassungsInhalt(1)), "die Tür ist zu und niemand sagt warum").toContain(
      i18n.t("ko.snapshotRestoreNoRight"),
    );
  });
});
