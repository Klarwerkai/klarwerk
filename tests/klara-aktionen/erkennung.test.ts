// ================================================================================================
// KLARA 05 (produkt:20261008:klara-aktionen) — WELCHER SATZ IST EIN KLARER AUSFÜHRUNGSAUFTRAG?
// ================================================================================================
//
// Die reine Erkennung (`apps/web/src/lib/klaraAuftragErkennung.ts`), ohne Browser. Sie ist für
// getippte und gesprochene Aufträge DIESELBE Funktion (K1); was sie nicht erkennt, wird nicht
// ausgeführt — Fragen, Diktat, Versand- und Einladungsaufforderungen bleiben Text (K6, K10).
import { describe, expect, it } from "vitest";
import {
  erkenneAuftrag,
  istAusfuehrungsauftrag,
  zitate,
} from "../../apps/web/src/lib/klaraAuftragErkennung";
import { auftragsArt } from "../../apps/web/src/lib/klaraSprache";

describe("E1 · K1 — die vier vorhandenen Aktionen, DE und EN", () => {
  it("öffnen: Artikel, Entwurf, ohne Art", () => {
    expect(erkenneAuftrag("Öffne den Artikel „Hydraulikfilter H7“")?.schritte).toEqual([
      { aktion: "oeffnen", suche: "wissensobjekt", name: "Hydraulikfilter H7" },
    ]);
    expect(erkenneAuftrag("Klara, öffne den Entwurf „Wartung Presse 4“.")?.schritte).toEqual([
      { aktion: "oeffnen", suche: "entwurf", name: "Wartung Presse 4" },
    ]);
    expect(erkenneAuftrag("Öffne Hydraulikfilter H7")?.schritte).toEqual([
      { aktion: "oeffnen", suche: "beliebig", name: "Hydraulikfilter H7" },
    ]);
    expect(erkenneAuftrag('Open the article "Hydraulic filter"')?.schritte).toEqual([
      { aktion: "oeffnen", suche: "wissensobjekt", name: "Hydraulic filter" },
    ]);
  });

  it("Entwurf anlegen: einer, mehrere, mit Inhalt, mit anschliessendem Öffnen", () => {
    expect(erkenneAuftrag("Lege den Entwurf „Wartung Presse 4“ an")?.schritte).toEqual([
      { aktion: "entwurf_erstellen", suche: "neu", name: "Wartung Presse 4" },
    ]);
    expect(
      erkenneAuftrag("Lege die Entwürfe „A-Linie“, „B-Linie“ und „C-Linie“ an")?.schritte.map(
        (s) => [s.aktion, s.name],
      ),
    ).toEqual([
      ["entwurf_erstellen", "A-Linie"],
      ["entwurf_erstellen", "B-Linie"],
      ["entwurf_erstellen", "C-Linie"],
    ]);
    expect(
      erkenneAuftrag("Lege den Entwurf „Ölwechsel“ mit dem Text „Alle 500 Stunden.“ an")?.schritte,
    ).toEqual([
      {
        aktion: "entwurf_erstellen",
        suche: "neu",
        name: "Ölwechsel",
        inhalt: "Alle 500 Stunden.",
      },
    ]);
    expect(erkenneAuftrag("Lege den Entwurf „Ölwechsel“ an und öffne ihn")?.schritte).toEqual([
      { aktion: "entwurf_erstellen", suche: "neu", name: "Ölwechsel" },
      { aktion: "oeffnen", suche: "entwurf", name: "Ölwechsel", ausSchritt: 0 },
    ]);
    expect(erkenneAuftrag('Create a draft "Oil change"')?.schritte).toEqual([
      { aktion: "entwurf_erstellen", suche: "neu", name: "Oil change" },
    ]);
  });

  it("Entwurf bearbeiten: ergänzen und umbenennen", () => {
    expect(erkenneAuftrag("Ergänze im Entwurf „Ölwechsel“: Filter mitprüfen")?.schritte).toEqual([
      {
        aktion: "entwurf_bearbeiten",
        suche: "entwurf",
        name: "Ölwechsel",
        aenderung: { art: "ergaenzen", text: "Filter mitprüfen" },
      },
    ]);
    expect(
      erkenneAuftrag("Ergänze den Entwurf „Ölwechsel“ um „Filter mitprüfen“")?.schritte,
    ).toEqual([
      {
        aktion: "entwurf_bearbeiten",
        suche: "entwurf",
        name: "Ölwechsel",
        aenderung: { art: "ergaenzen", text: "Filter mitprüfen" },
      },
    ]);
    expect(erkenneAuftrag("Benenne den Entwurf „Alt“ in „Neu“ um")?.schritte).toEqual([
      {
        aktion: "entwurf_bearbeiten",
        suche: "entwurf",
        name: "Alt",
        aenderung: { art: "umbenennen", titel: "Neu" },
      },
    ]);
  });

  it("Aufgabe bearbeiten — auch „öffne die Aufgabe …“ ist eine Aufgabe, kein Objekt", () => {
    expect(erkenneAuftrag("Bearbeite die Aufgabe „Hydraulikfilter H7“")?.schritte).toEqual([
      { aktion: "aufgabe_bearbeiten", suche: "aufgabe", name: "Hydraulikfilter H7" },
    ]);
    expect(erkenneAuftrag("Öffne die Aufgabe Hydraulikfilter H7")?.schritte[0]?.aktion).toBe(
      "aufgabe_bearbeiten",
    );
  });

  it("Nacharbeit 4: eine genannte Aufgabenaktion (Priorität, zuweisen, eskalieren) reist mit", () => {
    const aufgabe = (name: string, aufgabenaktion: unknown) => [
      { aktion: "aufgabe_bearbeiten", suche: "aufgabe", name, aufgabenaktion },
    ];
    expect(
      erkenneAuftrag("Setze die Priorität der Aufgabe „Filter F3“ auf hoch")?.schritte,
    ).toEqual(aufgabe("Filter F3", { art: "prioritaet", wert: "hoch" }));
    expect(erkenneAuftrag("Set the priority of task “Filter F3” to low")?.schritte).toEqual(
      aufgabe("Filter F3", { art: "prioritaet", wert: "niedrig" }),
    );
    expect(erkenneAuftrag("Weise die Aufgabe „Filter F3“ Erik Experte zu")?.schritte).toEqual(
      aufgabe("Filter F3", { art: "zuweisen", person: "Erik Experte" }),
    );
    expect(erkenneAuftrag("Weise die Aufgabe „Filter F3“ an Erik Experte zu")?.schritte).toEqual(
      aufgabe("Filter F3", { art: "zuweisen", person: "Erik Experte" }),
    );
    expect(erkenneAuftrag("Eskaliere die Aufgabe „Drehmoment Flansch“")?.schritte).toEqual(
      aufgabe("Drehmoment Flansch", { art: "eskalieren" }),
    );
    // Ohne genannte Aktion: keine — Klara fragt vor der Handlung nach (Engine, nicht Erkennung).
    expect(
      erkenneAuftrag("Bearbeite die Aufgabe „Filter F3“")?.schritte[0]?.aufgabenaktion,
    ).toBeUndefined();
  });

  it("getippt und gesprochen: dieselbe Funktion, dasselbe Ergebnis (Anrede und Satzzeichen egal)", () => {
    const getippt = erkenneAuftrag("Lege den Entwurf „Wartung“ an");
    const gesprochen = erkenneAuftrag("klara bitte lege den Entwurf „Wartung“ an.");
    expect(gesprochen).toEqual(getippt);
  });
});

describe("E2 · K6/K10 — was KEIN Ausführungsauftrag ist, bleibt Text", () => {
  it("Fragen, Zusammenfassen, Versand, Einladung, Veröffentlichung und Löschen", () => {
    for (const text of [
      "Wie wird die Zylinderkopfdichtung XQ42 vor dem Wechsel entlastet?",
      "Öffne den Artikel „Hydraulikfilter“?",
      "Fasse diese Anleitung zusammen",
      "Sende diese Anleitung sofort per E-Mail an alle Mitarbeitenden",
      "Schicke den Entwurf „Wartung“ an Anna",
      "Lade Anna zum Termin ein",
      "Veröffentliche den Artikel „Hydraulikfilter“",
      "Lösche den Entwurf „Wartung“",
      "Lege eine Aufgabe zur Zylinderkopfdichtung an",
      "Zeige mir den nächsten Schritt",
      "",
    ]) {
      expect(erkenneAuftrag(text), text).toBeNull();
      expect(istAusfuehrungsauftrag(text), text).toBe(false);
    }
  });

  it("Klara 02 bleibt unverändert: der nicht ausführbare Arbeitsauftrag heisst weiter „aktion“", () => {
    expect(auftragsArt("Lege eine Aufgabe zur Zylinderkopfdichtung an")).toBe("aktion");
    expect(auftragsArt("Wie lange dauert der Ölwechsel?")).toBe("frage");
  });

  it("Namen in Anführungszeichen werden genau übernommen", () => {
    expect(zitate('„A“, "B" und “C”')).toEqual(["A", "B", "C"]);
  });
});
