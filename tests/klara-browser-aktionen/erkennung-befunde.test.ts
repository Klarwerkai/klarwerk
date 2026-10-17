// ================================================================================================
// produkt:20261011:assistenz-browser-aktionen (BPA-03) — GEGENPROBEN ZU DEN BEFUNDEN DER
// UNABHÄNGIGEN PRÜFUNG (Chat 62, 17.10.2026) AN DER AUFTRAGSERKENNUNG.
// ================================================================================================
//
// Jeder Fall war vor der Behebung nachgestellt falsch (ein Wert im falschen Feld, ein verschluckter
// oder ein ungewollter Auftragsteil). Die Regel jetzt: nicht raten, nichts verschlucken — im
// Zweifel Klärung, eine nicht freigegebene Außenhandlung ist Übergabe.
import { describe, expect, it } from "vitest";
import { erkenneBrowserAuftrag } from "../../services/app/src/klara-browser-auftrag-erkennung";
import { BETREFF, EMPFAENGER, NACHRICHT, TESTSEITE } from "./testseite";

const erkenne = (w: string) => erkenneBrowserAuftrag(w, TESTSEITE);
const art = (w: string) => {
  const r = erkenne(w);
  return r.ok ? "ok" : r.art;
};

describe("BPA-03 · Erkennung · Gegenproben zu den Prüfbefunden", () => {
  it("Kontrolle: die dokumentierte, die gesprochene und die Sende-Satzform bleiben erkannt", () => {
    expect(
      erkenne(
        `Fülle den Angebotsentwurf aus: Betreff „${BETREFF}", Empfänger ${EMPFAENGER}, Nachricht „${NACHRICHT}" und speichere ihn als Entwurf.`,
      ),
    ).toEqual({
      ok: true,
      formular: "Angebotsentwurf",
      felder: [
        { label: "Betreff", wert: BETREFF },
        { label: "Empfänger", wert: EMPFAENGER },
        { label: "Nachricht", wert: NACHRICHT },
      ],
      speichern: true,
      ausloesen: null,
    });
    expect(
      erkenne(
        "Rückmeldung Betreff Rückruf Wartung Nachricht Bitte um Rückruf zur Wartung und speichere sie",
      ),
    ).toMatchObject({
      ok: true,
      formular: "Rückmeldung",
      felder: [
        { label: "Betreff", wert: "Rückruf Wartung" },
        { label: "Nachricht", wert: "Bitte um Rückruf zur Wartung" },
      ],
      speichern: true,
    });
    expect(
      erkenne(`Fülle den Angebotsentwurf aus: Betreff „${BETREFF}" und klicke „Endgültig senden".`),
    ).toMatchObject({ ok: true, ausloesen: "Endgültig senden", speichern: false });
  });

  it("M1 · verneintes Speichern speichert nicht — Klärung", () => {
    expect(
      art(`Fülle den Angebotsentwurf aus: Betreff „${BETREFF}", aber noch nicht speichern.`),
    ).toBe("klaerung");
    expect(
      art(`Fülle den Angebotsentwurf aus: Betreff „${BETREFF}" und speichere ihn bitte nicht.`),
    ).toBe("klaerung");
    expect(art(`Fülle den Angebotsentwurf aus: Betreff „${BETREFF}" ohne zu speichern.`)).toBe(
      "klaerung",
    );
  });

  it("M2 · Befehlswörter in einem ungeklammerten Wert kürzen ihn nicht still und speichern nicht", () => {
    for (const w of [
      "Angebotsentwurf Betreff Datensicherung Nachricht Bitte speichern Sie die Datei bis Freitag",
      "Angebotsentwurf Betreff Archiv Nachricht Bitte sichern Sie das Archiv",
      "Angebotsentwurf Betreff Fehler Nachricht Wir haben den Fehler gefunden und lösen ihn bis Freitag",
      "Angebotsentwurf Betreff Link Nachricht Bitte prüfen und klicken Sie auf den Link",
    ]) {
      const r = erkenne(w);
      expect(r.ok, w).toBe(false);
      expect(r.ok ? "" : r.art, w).not.toBe("ok");
    }
  });

  it("M3 · eine Beschriftung im Wert schreibt nichts in ein anderes Feld", () => {
    // Ungeklammert ist offen, ob „Nachricht" ein Feld beginnt: Klärung (zweite Prüfung, N1).
    expect(
      art("Angebotsentwurf Betreff Antwort auf Ihre Nachricht vom Montag Empfänger a@b.invalid"),
    ).toBe("klaerung");
    expect(
      erkenne(
        'Angebotsentwurf Betreff „Antwort auf Ihre Nachricht vom Montag" Empfänger a@b.invalid',
      ),
    ).toMatchObject({
      ok: true,
      felder: [
        { label: "Betreff", wert: "Antwort auf Ihre Nachricht vom Montag" },
        { label: "Empfänger", wert: "a@b.invalid" },
      ],
    });
    // „lass die Nachricht leer", „den Empfänger nicht ändern": nie als Wert „leer" bzw. „nicht ändern".
    for (const w of [
      `Fülle den Angebotsentwurf aus: Betreff „${BETREFF}", lass die Nachricht leer`,
      `Fülle den Angebotsentwurf aus: Betreff „${BETREFF}", den Empfänger nicht ändern`,
    ]) {
      const r = erkenne(w);
      if (r.ok) {
        expect(
          r.felder.map((f) => f.label),
          w,
        ).toEqual(["Betreff"]);
      } else {
        expect(r.art, w).toBe("klaerung");
      }
    }
  });

  it("M4 · ein gewünschtes Auslösen mit anderem Verb fällt nicht still weg — Übergabe", () => {
    for (const w of [
      `Fülle den Angebotsentwurf aus: Betreff „${BETREFF}" und übermittle ihn an den Kunden.`,
      `Fülle den Angebotsentwurf aus: Betreff „${BETREFF}" und leite ihn weiter.`,
      `Fülle den Angebotsentwurf aus: Betreff „${BETREFF}" and submit it`,
    ]) {
      expect(art(w), w).toBe("gesperrt");
    }
  });

  it("M5 · ein verneintes oder aufgeschobenes Auslösen wird kein Auslösen — Klärung", () => {
    expect(
      art(
        `Fülle den Angebotsentwurf aus: Betreff „${BETREFF}", speichere, aber klicke auf keinen Fall Endgültig senden.`,
      ),
    ).toBe("klaerung");
    expect(
      art(
        `Fülle den Angebotsentwurf aus: Betreff „${BETREFF}", Endgültig senden erst morgen, heute nur speichern.`,
      ),
    ).toBe("klaerung");
  });

  it("N1 · eine Beschriftung nach Satzpartikel im ungeklammerten Wert wird geklärt, nie in den Wert gefaltet; „ist/lautet“ leiten ein", () => {
    for (const w of [
      `Angebotsentwurf Betreff ${BETREFF} Nachricht Wir bieten die jährliche Wartung an Empfänger ${EMPFAENGER} und speichere den Entwurf`,
      "Rückmeldung Nachricht Wir rufen Sie morgen an Betreff Rückruf und speichere sie",
      "Rückmeldung Nachricht Bitte füllen Sie das Formular aus Betreff Antrag und speichere sie",
    ]) {
      expect(art(w), w).toBe("klaerung");
    }
    expect(erkenne(`Angebotsentwurf Betreff ist ${BETREFF} und speichere ihn`)).toMatchObject({
      ok: true,
      felder: [{ label: "Betreff", wert: BETREFF }],
      speichern: true,
    });
    expect(erkenne(`Angebotsentwurf Betreff lautet ${BETREFF}`)).toMatchObject({
      ok: true,
      felder: [{ label: "Betreff", wert: BETREFF }],
    });
    // Mit Doppelpunkt ist „Ist" Teil des Werts.
    expect(erkenne("Angebotsentwurf Nachricht: Ist das Angebot noch gültig")).toMatchObject({
      ok: true,
      felder: [{ label: "Nachricht", wert: "Ist das Angebot noch gültig" }],
    });
  });

  it("N5 · übliche Formen werden erkannt; ein offenes „aus“ wird gezielt geklärt", () => {
    expect(
      erkenne(
        `Fülle den Angebotsentwurf aus Betreff ${BETREFF} Empfänger ${EMPFAENGER} und speichere ihn`,
      ),
    ).toMatchObject({
      ok: true,
      felder: [
        { label: "Betreff", wert: BETREFF },
        { label: "Empfänger", wert: EMPFAENGER },
      ],
      speichern: true,
    });
    expect(erkenne(`Trage im Angebotsentwurf den Betreff „${BETREFF}" ein.`)).toMatchObject({
      ok: true,
      felder: [{ label: "Betreff", wert: BETREFF }],
    });
    expect(
      erkenne(`Angebotsentwurf: Betreff ist ${BETREFF}, Empfänger ist ${EMPFAENGER}, speichern.`),
    ).toMatchObject({ ok: true, speichern: true });
    const r = erkenne(
      `Bitte fülle den Angebotsentwurf mit Betreff „${BETREFF}" und Empfänger ${EMPFAENGER} aus und speichere ihn.`,
    );
    expect(r.ok ? "" : r.art === "klaerung" && r.text).toContain('„aus"');
  });

  it("M4 · ein Klick ohne genannten Knopf fällt nicht still weg — Klärung nennt die Knöpfe", () => {
    for (const w of [
      `Fülle den Angebotsentwurf aus: Betreff „${BETREFF}" und klicke auf den Knopf.`,
      `Fülle den Angebotsentwurf aus: Betreff „${BETREFF}" und löse aus.`,
    ]) {
      const r = erkenne(w);
      expect(r.ok ? "" : r.art === "klaerung" && r.text, w).toContain("Welchen Knopf");
    }
  });

  it("m9 · ein Wert darf mit „Mit“ beginnen; verschachtelte Anführungszeichen werden geklärt", () => {
    expect(
      erkenne("Fülle den Angebotsentwurf aus: Nachricht: Mit freundlichen Grüßen"),
    ).toMatchObject({
      ok: true,
      felder: [{ label: "Nachricht", wert: "Mit freundlichen Grüßen" }],
    });
    expect(art('Fülle den Angebotsentwurf aus: Nachricht „Wir bieten „Premium" an"')).toBe(
      "klaerung",
    );
  });
});
