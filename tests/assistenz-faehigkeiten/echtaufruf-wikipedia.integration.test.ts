// ================================================================================================
// produkt:20261011:assistenz-skills-werkzeuge (BPA-11) · AC10 — DER TATSÄCHLICHE SKILLAUFRUF.
// ================================================================================================
//
// Ein zulässiger, kostenfreier Fähigkeitsaufruf über den INTEGRIERTEN Produktweg, im regulären
// Integrationslauf: echte Anwendung, echte Anmeldung, Vorschau mit Fingerabdruck, bestätigte
// Ausführung von `wikipedia-suche` über den VORHANDENEN Wikipedia-Provider (`external-search`,
// echter Netzweg, Transport `echt`) → de.wikipedia.org. Keine Attrappe, kein Ersatztransport.
//
// Belegt werden (`echtprobe-wikipedia.ts`, Beleg als JSON in der Ausgabe und als Anhang):
//   · Kandidat (KLARWERK_KANDIDAT, sonst Git-Stand des Laufs), Plattform, Adapter-/Providerstand
//     (Zeile „AC10-ECHTBELEG" in der Testausgabe);
//   · Rolle und Auftragskennung, Ergebnis mit Originalquellen, gespeicherter Stand und Rücklink;
//   · überprüfte Wirkung: die zurückgegebene Originalquelle wird abgerufen (HTTP 200, Titel steht
//     darin);
//   · Wiederholung derselben Kennung ohne zweite Wirkung;
//   · Negativfall: externe Wissensabfrage gesperrt → kein Aufruf, konkrete Voraussetzung.
//
// KEIN STILLES ÜBERSPRINGEN: ist de.wikipedia.org vom Prüfhost aus nicht erreichbar, wird dieser
// Fall ROT und nennt die Meldung des Produkts (z. B. „Die externe Suche ist zurzeit nicht
// erreichbar") — das ist dann der Nachweis des konkreten externen Hindernisses.
import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { ExternalSearchService, createWikipediaProvider } from "../../services/external-search";
import { SUCHBEGRIFF, fuehreEchtprobeAus } from "./echtprobe-wikipedia";

function kandidat(): string {
  const gesetzt = process.env.KLARWERK_KANDIDAT;
  if (gesetzt) {
    return gesetzt;
  }
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  } catch {
    return "unbekannt";
  }
}

describe("AC10 · tatsächlicher Skillaufruf über den Produktweg (wikipedia-suche, transport=echt)", () => {
  it("ausgeführt, Wirkung an der Originalquelle überprüft, keine zweite Wirkung, Negativfall gesperrt", async () => {
    const beleg = await fuehreEchtprobeAus({
      env: { ...process.env, KLARWERK_KANDIDAT: kandidat() },
      externeSuche: new ExternalSearchService({
        provider: createWikipediaProvider({ lang: "de" }),
      }),
    });
    // Der Beleg gehört in den Bericht — auch wenn der Fall rot wird.
    console.log(`AC10-ECHTBELEG ${JSON.stringify(beleg)}`);

    const ergebnis = beleg.ergebnis as {
      stand?: string;
      transport?: string;
      meldung?: string;
      eintraege?: { titel?: string; url?: string }[];
      ruecklink?: { arbeitsbereich: string | null; auftragId: string };
    } | null;
    // Erst die Produktmeldung — so nennt ein roter Lauf das tatsächliche Hindernis.
    expect(beleg.voraussetzungen, beleg.meldung).toEqual([]);
    expect(ergebnis?.stand, ergebnis?.meldung).toBe("erfolgreich");
    expect(beleg.adapter).toMatchObject({
      faehigkeit: "wikipedia-suche",
      fassung: "1.0.0",
      provider: "Wikipedia",
      transport: "echt",
    });
    expect(ergebnis?.transport).toBe("echt");
    expect(ergebnis?.eintraege?.length ?? 0).toBeGreaterThan(0);
    for (const e of ergebnis?.eintraege ?? []) {
      expect(e.url).toMatch(/^https:\/\/de\.wikipedia\.org\/wiki\//);
    }
    expect(ergebnis?.ruecklink).toEqual({
      arbeitsbereich: "echtprobe-ac10",
      auftragId: beleg.auftragId,
    });
    expect(
      (beleg.gespeichert as { auftrag?: { ergebnis?: { stand?: string } } }).auftrag?.ergebnis
        ?.stand,
    ).toBe("erfolgreich");
    expect(beleg.wirkung.httpStatus).toBe(200);
    expect(beleg.wirkung.titelGefunden).toBe(true);
    expect(beleg.wiederholung.wiederholt).toBe(true);
    expect(beleg.negativfall.voraussetzungen).toContain("freigabe_extern");
    expect(beleg.stand).toBe("durchgefuehrt");
    expect(SUCHBEGRIFF).toBe("Kreiselpumpe");
  });
});
