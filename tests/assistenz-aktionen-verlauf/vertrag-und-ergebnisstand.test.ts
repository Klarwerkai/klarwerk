// ================================================================================================
// produkt:20261010:assistenz-aktionen-verlauf-ruecknahme (PV-02) — VERTRAG UND ERGEBNISSTAND, REIN.
// ================================================================================================
//
// Die Regeln aus `services/app/src/klara-aktionsverlauf.ts` ohne HTTP, mit erfundenen Kennungen.
//
//   R1 · K1  jede tatsächlich gelieferte Aktion hat Wirkung, Tür, Recht und Rücknahme; die
//            datenverändernden sind genau Anlegen, Bearbeiten und die drei Aufgabenaktionen; keine
//            zusätzliche Bestätigung; nicht Rücknehmbares nennt Sichtbarkeit und Arbeitsort.
//   R2 · K2  der Ergebnisstand folgt den festgehaltenen Schritten — Vorschlag, läuft, unklar,
//            ausgeführt, teilweise, fehlgeschlagen, zurückgenommen, teilweise zurückgenommen,
//            abgebrochen —, nie einer Formulierung; `stand` von Klara 05 bleibt unverändert.
//   R3 · K3  Aktionskennung = Vorgangsschlüssel; ins Protokoll gehen keine Personennamen.
//   R4 · K4/K5 was eine Rücknahme jetzt hindert (Vertrag, fremder Stand, nichts gespeichert).
import { describe, expect, it } from "vitest";
import {
  KLARA_AKTIONSVERTRAG,
  aktionskennung,
  auftragMitVerlauf,
  ergebnisstand,
  protokollStand,
  schrittVerlauf,
  vertragFuer,
} from "../../services/app/src/klara-aktionsverlauf";
import {
  KLARA_AKTIONEN,
  type KlaraAuftrag,
  auftragsStand,
  brecheAb,
  neuerAuftrag,
  setzeSchritt,
} from "../../services/app/src/klara-auftrag";

const T = "2026-10-12T09:00:00.000Z";
const NEU_A = { art: "neuer_entwurf", id: null, titel: "Fiktiv A", stand: null, pfad: null };
const NEU_B = { ...NEU_A, titel: "Fiktiv B" };

function auftrag(geplant: number): KlaraAuftrag {
  return neuerAuftrag(
    {
      quelle: "getippt",
      wortlaut: "Lege die Entwürfe „Fiktiv A“ und „Fiktiv B“ an",
      ziel: "Zwei Entwürfe anlegen",
      erlaubteAktionen: ["entwurf_erstellen"],
      erlaubteZiele: [NEU_A, NEU_B],
      erlaubteQuellen: ["Deine Eingabe (getippt)"],
      ergebnis: "Entwurf gespeichert und am Server nachgelesen",
      geplanteSchritte: geplant,
    },
    "konto-erik",
    "a-1",
    T,
  );
}

function ergebnis(id: string) {
  return {
    art: "entwurf",
    id,
    titel: id,
    stand: "2026-10-12T09:00:01.000Z",
    pfad: `/erfassen?draft=${id}`,
  };
}

/** Ein Schritt über die reine Grenze — wie die Serverausführung ihn meldet. */
function schritt(
  a: KlaraAuftrag,
  schluessel: string,
  nr: number,
  ziel: typeof NEU_A,
  stand: string,
  extra: Record<string, unknown> = {},
): KlaraAuftrag {
  return setzeSchritt(
    a,
    schluessel,
    { nr, aktion: "entwurf_erstellen", ziel, auftragFassung: 1, stand, ...extra },
    T,
  ).auftrag;
}

/** Beginnen und mit nachgelesenem Ergebnis speichern — rücknehmbar nur mit eigenem Stand. */
function gespeichert(
  a: KlaraAuftrag,
  schluessel: string,
  nr: number,
  ziel: typeof NEU_A,
  ruecknehmbar = true,
): KlaraAuftrag {
  const begonnen = schritt(a, schluessel, nr, ziel, "begonnen");
  return schritt(begonnen, schluessel, nr, ziel, "gespeichert", {
    ergebnis: ergebnis(`d-${nr}`),
    ruecknehmbar,
  });
}

describe("R1 · K1 — Wirkung, Berechtigung und Rücknahme je gelieferter Aktion", () => {
  it("deckt genau die vier Aktionen und die drei Aufgabenaktionen ab", () => {
    const aktionen = new Set(Object.values(KLARA_AKTIONSVERTRAG).map((v) => v.aktion));
    expect([...aktionen].sort()).toEqual([...KLARA_AKTIONEN].sort());
    for (const v of Object.values(KLARA_AKTIONSVERTRAG)) {
      expect(v.tuer.length, v.schluessel).toBeGreaterThan(0);
      expect(v.recht.length, v.schluessel).toBeGreaterThan(0);
      // Die vorhandenen Regeln der Tür gelten — keine zusätzliche pauschale Bestätigung.
      expect(v.bestaetigung, v.schluessel).toBe("vorhandene_regeln");
      // Wer nichts ändert, braucht keine Rücknahme; wer ändert, hat eine — oder einen Arbeitsort.
      if (!v.datenveraendernd) {
        expect(v.ruecknahme, v.schluessel).toBe("keine");
        expect(v.wirkung, v.schluessel).toBe("keine");
      } else {
        expect(v.korrekturweg, v.schluessel).not.toBeNull();
      }
      // Was andere sehen, nimmt Klara nicht zurück — das steht so im Vertrag.
      if (v.fuerAndereSichtbar) {
        expect(v.ruecknahme, v.schluessel).toBe("keine");
      }
    }
    const veraendernd = Object.values(KLARA_AKTIONSVERTRAG)
      .filter((v) => v.datenveraendernd)
      .map((v) => v.schluessel)
      .sort();
    expect(veraendernd).toEqual([
      "aufgabe_eskalieren",
      "aufgabe_prioritaet",
      "aufgabe_zuweisen",
      "entwurf_bearbeiten",
      "entwurf_erstellen",
    ]);
    expect(KLARA_AKTIONSVERTRAG.entwurf_erstellen.ruecknahme).toBe("papierkorb");
    expect(KLARA_AKTIONSVERTRAG.entwurf_bearbeiten.ruecknahme).toBe("vorherige_felder");
    expect(KLARA_AKTIONSVERTRAG.aufgabe_eskalieren).toMatchObject({
      recht: "conflict.resolve",
      korrekturweg: "konflikt",
      fuerAndereSichtbar: true,
    });
    expect(KLARA_AKTIONSVERTRAG.aufgabe_zuweisen.recht).toBe("ko.assign");
  });

  it("ordnet „Aufgabe bearbeiten“ nach der geklärten Fachaktion zu", () => {
    expect(vertragFuer("aufgabe_bearbeiten", { art: "prioritaet", wert: "hoch" }).schluessel).toBe(
      "aufgabe_prioritaet",
    );
    expect(vertragFuer("aufgabe_bearbeiten", { art: "eskalieren" }).schluessel).toBe(
      "aufgabe_eskalieren",
    );
    expect(vertragFuer("aufgabe_bearbeiten", null).schluessel).toBe("aufgabe_oeffnen");
    expect(vertragFuer("entwurf_erstellen", null).schluessel).toBe("entwurf_erstellen");
  });
});

describe("R2 · K2 — der Ergebnisstand kommt aus den Schritten", () => {
  it("Vorschlag → läuft → ausgeführt → teilweise zurückgenommen → zurückgenommen", () => {
    let a = auftrag(2);
    expect(ergebnisstand(a)).toBe("vorschlag");
    a = schritt(a, "s-1", 1, NEU_A, "begonnen");
    expect(ergebnisstand(a)).toBe("laeuft");
    a = schritt(a, "s-1", 1, NEU_A, "gespeichert", {
      ergebnis: ergebnis("d-1"),
      ruecknehmbar: true,
    });
    expect(ergebnisstand(a)).toBe("laeuft");
    a = gespeichert(a, "s-2", 2, NEU_B);
    expect(ergebnisstand(a)).toBe("ausgefuehrt");
    a = schritt(a, "s-1", 1, NEU_A, "zurueckgenommen");
    expect(ergebnisstand(a)).toBe("teilweise_zurueckgenommen");
    a = schritt(a, "s-2", 2, NEU_B, "zurueckgenommen");
    expect(ergebnisstand(a)).toBe("zurueckgenommen");
    // Klara 05 bleibt unverändert: ihr `stand` nennt den Auftrag weiter „abgeschlossen“.
    expect(auftragsStand(a)).toBe("abgeschlossen");
    // Der Verlauf hält jeden Übergang fest — nichts wird überschrieben.
    expect(a.verlauf.filter((v) => v.ereignis === "zurueckgenommen")).toHaveLength(2);
  });

  it("teilweise, fehlgeschlagen und abgebrochen — ein Teilerfolg wird nicht ungeschehen", () => {
    let a = gespeichert(auftrag(2), "s-1", 1, NEU_A);
    a = schritt(a, "s-2", 2, NEU_B, "begonnen");
    a = schritt(a, "s-2", 2, NEU_B, "fehlgeschlagen", { grund: "Dir fehlt das Recht dafür." });
    expect(ergebnisstand(a)).toBe("teilweise");

    let b = auftrag(1);
    b = schritt(b, "s-1", 1, NEU_A, "begonnen");
    b = schritt(b, "s-1", 1, NEU_A, "fehlgeschlagen", { grund: "Der Server hat abgelehnt." });
    expect(ergebnisstand(b)).toBe("fehlgeschlagen");

    // Abbruch nach einem gespeicherten Schritt: teilweise — das Gespeicherte bleibt sichtbar.
    const c = brecheAb(gespeichert(auftrag(2), "s-1", 1, NEU_A), T);
    expect(ergebnisstand(c)).toBe("teilweise");
    expect(c.schritte[0]?.stand).toBe("gespeichert");

    // Abbruch, bevor etwas geschah.
    expect(ergebnisstand(brecheAb(auftrag(1), T))).toBe("abgebrochen");
  });

  it("eine bestätigte, noch nicht nachgelesene Wirkung ist „unklar“, nie Erfolg oder Fehlschlag", () => {
    let a = auftrag(1);
    a = schritt(a, "s-1", 1, NEU_A, "begonnen");
    const mitWirkung: KlaraAuftrag = {
      ...a,
      schritte: a.schritte.map((s) => ({
        ...s,
        schreibwirkung: {
          art: "entwurf" as const,
          id: "d-1",
          pfad: "/erfassen?draft=d-1",
          stand: null,
        },
      })),
    };
    expect(ergebnisstand(mitWirkung)).toBe("unklar");
    expect(ergebnisstand(brecheAb(mitWirkung, T))).toBe("unklar");
  });
});

describe("R3 · K3 — Aktionskennung und Protokollstand", () => {
  it("die Aktionskennung ist der Vorgangsschlüssel des Anlegewegs; Namen bleiben draussen", () => {
    expect(aktionskennung("a-1", 2)).toBe("klara-auftrag-a-1-2");
    expect(protokollStand("2026-10-12T09:00:01.000Z")).toBe("2026-10-12T09:00:01.000Z");
    expect(protokollStand("prioritaet:hoch")).toBe("prioritaet:hoch");
    expect(protokollStand("zugewiesen:Erika Fiktiv")).toBe("zugewiesen");
    expect(protokollStand(null)).toBeNull();
  });
});

describe("R4 · K4/K5 — was eine Rücknahme jetzt hindert", () => {
  it("rücknehmbar, zurückgenommen, fremd überschrieben, nichts gespeichert, laut Vertrag nie", () => {
    let a = gespeichert(auftrag(2), "s-1", 1, NEU_A);
    a = gespeichert(a, "s-2", 2, NEU_B, false);
    const [s1, s2] = a.schritte;
    expect(schrittVerlauf(a, s1 as KlaraAuftrag["schritte"][number])).toEqual({
      aktionskennung: "klara-auftrag-a-1-1",
      vertrag: "entwurf_erstellen",
      ruecknahmeHinderung: null,
    });
    // Gespeichert ohne eigenen bestätigten Stand: nicht rücknehmbar (fremde Fassung möglich).
    expect(schrittVerlauf(a, s2 as KlaraAuftrag["schritte"][number]).ruecknahmeHinderung).toBe(
      "fremdstand",
    );
    const sicht = auftragMitVerlauf(a);
    expect(sicht.ergebnisstand).toBe("ausgefuehrt");
    expect(sicht.schritte.map((s) => s.aktionskennung)).toEqual([
      "klara-auftrag-a-1-1",
      "klara-auftrag-a-1-2",
    ]);
    a = schritt(a, "s-1", 1, NEU_A, "zurueckgenommen");
    expect(schrittVerlauf(a, a.schritte[0] as KlaraAuftrag["schritte"][number])).toMatchObject({
      ruecknahmeHinderung: "zurueckgenommen",
    });
  });
});
