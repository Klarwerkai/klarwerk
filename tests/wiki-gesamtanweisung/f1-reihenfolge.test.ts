// ================================================================================================
// JOB 4154 · F1 — EIN UNVERÄNDERTER BAUSTEIN IN ANDERER REIHENFOLGE IST EINE ANDERE ANWEISUNG.
// ================================================================================================
//
// Startvertrag, erster entscheidender Fall, wörtlich:
//   „Ein unveraenderter Baustein in anderer Reihenfolge erzeugt eine geaenderte Gesamtfassung."
//
// Das ist keine Formalie. Eine Anweisung IST eine geordnete Folge: „Anlage entlüften, dann Ventil
// öffnen" und „Ventil öffnen, dann Anlage entlüften" sind zwei verschiedene Anweisungen, obwohl
// jeder Satz für sich unverändert ist. Ein Vergleich, der nur Texte vergleicht, meldete hier
// „unverändert" — und genau das wäre die gefährliche Unwahrheit.
//
// GEGENPROBE (Abschnitt „Gegenprobe" unten beschrieben, ausgeführt und zurückgenommen):
// In `staendeVergleichen` (`gesamtanweisung-service.ts`) den Positionsbefund entfernen. Dann meldet
// der Fall unten `unveraendert`, und dieser Test wird namentlich rot.
import { describe, expect, it } from "vitest";
import { bauDienst, eintrag, sichtbarAls } from "./pruefstand";

const LESER = sichtbarAls({ id: "anna", darfPruefen: false });

const EINTRAEGE = [
  eintrag({ id: "ko-entlueften", title: "Anlage entlüften", version: 2 }, [
    { version: 1 },
    { version: 2, bodyHtml: "<p>Erst entlüften.</p>" },
  ]),
  eintrag({ id: "ko-ventil", title: "Ventil öffnen", version: 3 }, [
    { version: 3, bodyHtml: "<p>Ventil öffnen.</p>" },
  ]),
];

describe("F1 · die Reihenfolge zählt zur Gesamtfassung", () => {
  it("dieselben Bausteine in anderer Folge ergeben einen GEÄNDERTEN Vergleich", async () => {
    const { dienst } = bauDienst(EINTRAEGE);
    const angelegt = await dienst.anlegen({ titel: "Anlage in Betrieb nehmen" }, "anna");

    const mitErstem = await dienst.bausteinAufnehmen(
      angelegt.id,
      angelegt.version,
      { koId: "ko-entlueften", koVersion: 2, nachweisHash: "h-entlueften" },
      LESER,
    );
    const mitBeiden = await dienst.bausteinAufnehmen(
      angelegt.id,
      mitErstem.version,
      { koId: "ko-ventil", koVersion: 3, nachweisHash: "h-ventil" },
      LESER,
    );
    const [ersterId, zweiterId] = mitBeiden.bausteine.map((b) => b.id);
    expect(ersterId).toBeDefined();
    expect(zweiterId).toBeDefined();

    // NICHTS ausser der Folge ändert sich: dieselben Kennungen, dieselben Fassungen, dieselben
    // Nachweise. Wäre hier auch nur ein Feld anders, prüfte der Fall etwas anderes als F1.
    const getauscht = await dienst.reihenfolgeSetzen(
      mitBeiden.id,
      mitBeiden.version,
      [zweiterId as string, ersterId as string],
      LESER,
    );

    const vergleich = await dienst.vergleichen(
      mitBeiden.id,
      mitBeiden.version,
      getauscht.version,
      LESER,
    );

    expect(vergleich.gesamt).toBe("geaendert");
    const positionsbefunde = vergleich.befunde.filter((b) => b.feld === "reihenfolge");
    expect(positionsbefunde).toHaveLength(2);
    expect(positionsbefunde.every((b) => b.auswirkung === "geaendert")).toBe(true);
  });

  it("die gebundenen Fassungen und Nachweise sind dabei NACHWEISLICH unverändert", async () => {
    // Die Kehrseite desselben Falls: der Vergleich darf die Änderung nicht dadurch „finden", dass
    // er nebenbei etwas anderes falsch liest. Fassung und Nachweis bleiben unverändert — nur die
    // Position nicht.
    const { dienst } = bauDienst(EINTRAEGE);
    const a = await dienst.anlegen({ titel: "Anlage in Betrieb nehmen" }, "anna");
    const b1 = await dienst.bausteinAufnehmen(
      a.id,
      a.version,
      { koId: "ko-entlueften", koVersion: 2, nachweisHash: "h-entlueften" },
      LESER,
    );
    const b2 = await dienst.bausteinAufnehmen(
      a.id,
      b1.version,
      { koId: "ko-ventil", koVersion: 3, nachweisHash: "h-ventil" },
      LESER,
    );
    const ids = b2.bausteine.map((b) => b.id);
    const getauscht = await dienst.reihenfolgeSetzen(a.id, b2.version, [...ids].reverse(), LESER);

    const vergleich = await dienst.vergleichen(a.id, b2.version, getauscht.version, LESER);
    expect(vergleich.befunde.filter((b) => b.feld === "fassung")).toHaveLength(2);
    expect(
      vergleich.befunde
        .filter((b) => b.feld === "fassung")
        .every((b) => b.auswirkung === "unveraendert"),
    ).toBe(true);
    // Und die Gesamtaussage bleibt trotzdem „geaendert" — die Reihenfolge allein genügt.
    expect(vergleich.gesamt).toBe("geaendert");
  });

  it("eine unveränderte Folge bleibt unverändert — sonst wäre der Fall oben wertlos", async () => {
    const { dienst } = bauDienst(EINTRAEGE);
    const a = await dienst.anlegen({ titel: "Anlage in Betrieb nehmen" }, "anna");
    const b1 = await dienst.bausteinAufnehmen(
      a.id,
      a.version,
      { koId: "ko-entlueften", koVersion: 2, nachweisHash: "h-entlueften" },
      LESER,
    );
    const b2 = await dienst.bausteinAufnehmen(
      a.id,
      b1.version,
      { koId: "ko-ventil", koVersion: 3, nachweisHash: "h-ventil" },
      LESER,
    );
    // Dieselbe Folge noch einmal setzen: ein Schreibvorgang, kein Inhaltsunterschied.
    const gleich = await dienst.reihenfolgeSetzen(
      a.id,
      b2.version,
      b2.bausteine.map((b) => b.id),
      LESER,
    );
    const vergleich = await dienst.vergleichen(a.id, b2.version, gleich.version, LESER);
    expect(vergleich.gesamt).toBe("unveraendert");
  });
});
