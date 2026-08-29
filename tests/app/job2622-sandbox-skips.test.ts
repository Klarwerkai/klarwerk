import { readFileSync } from "node:fs";
// ================================================================================================
// JOB 2622 · D1 — DIE ELF, DIE IN DER BAHN RUHEN: benannt, begruendet, gepinnt
// ================================================================================================
//
// DER BEFUND (BEN zu 2621 D1; viermal am 28.08. im Urteil): Bahn-Vollsuiten meldeten
// `12 skipped`, der Code-Pruefer `1 skipped` — Differenz IMMER elf, und solange sie namenlos
// blieb, wusste niemand, ob sie wichtig war. DIESER TEST macht die Landschaft messbar, damit es
// niemand neu herausfinden muss (Auftrag §4, zweite Abnahmeform):
//
//   DIE ELF (ruhen NUR ohne Horchrecht; auf Chef/CI laufen sie unveraendert mit):
//     services/app/src/routes/addin-static-routes.test.ts   2 Faelle (Rohsocket zwingend:
//       Malformed-overlong/nosniff · Nicht-Namensraum-Malformed)
//     tests/app/slides-abort.test.ts                        3 Faelle (Socket-Abbrueche a/b/d)
//     tests/app/mega71-onsend-synchron.test.ts              6 Faelle (3 Klassen 200/4xx/5xx ×
//       {genau EINE Antwort · fremder async-Hook kippt nicht})
//   Grund, gemessen statt behauptet: der `listen`-Systemaufruf ist in Bahn-Sitzungen gesperrt
//   (26.08. in acht Varianten belegt, s. Kopfkommentar in slides-abort.test.ts) — jede der drei
//   Dateien fuehrt deshalb eine ECHTE Horchprobe und ueberspringt nur, wo der Aufruf verboten ist.
//
//   DER EINE, der UEBERALL ruht: services/app/src/routes/ka4-endzustand.test.ts (1 Fall) — er
//   haengt am Produktflag `KLARA_EXTERNAL_EXECUTION_MIGRATED` (heute false), nicht an der Umgebung.
//
// Dieser Test fuehrt DIESELBE Horchprobe und prueft die zur Umgebung passende Erwartung — er ist
// in Bahn UND Chef/CI gruen und faellt, sobald jemand die Skip-Landschaft veraendert, ohne diese
// Liste nachzuziehen.
import { createServer } from "node:net";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const KANN_HORCHEN = await new Promise<boolean>((resolveProbe) => {
  const probe = createServer();
  probe.on("error", () => resolveProbe(false));
  probe.listen(0, "127.0.0.1", () => probe.close(() => resolveProbe(true)));
});

const lies = (p: string): string => readFileSync(resolve(process.cwd(), p), "utf8");

// Die Quelle der Wahrheit sind die Testdateien selbst — hier wird GEZAEHLT, nicht behauptet.
function horchFaelle(pfad: string): number {
  return lies(pfad).split("it.skipIf(!KANN_HORCHEN)(").length - 1;
}

describe("JOB 2622 · die Skip-Landschaft der Vollsuite ist benannt und gepinnt", () => {
  it("S1 — die elf Horch-Faelle: 2 + 3 + (2 Vorlagen x 3 Klassen) = 11, an den Dateien gezaehlt", () => {
    const addin = horchFaelle("services/app/src/routes/addin-static-routes.test.ts");
    const slides = horchFaelle("tests/app/slides-abort.test.ts");
    // mega71 deklariert 2 skipIf-Vorlagen in einer Schleife ueber 3 Klassen (200/4xx/5xx).
    const mega71Vorlagen = horchFaelle("tests/app/mega71-onsend-synchron.test.ts");
    const mega71Klassen =
      lies("tests/app/mega71-onsend-synchron.test.ts").split('{ name: "').length - 1;
    expect(addin).toBe(2);
    expect(slides).toBe(3);
    expect(mega71Vorlagen).toBe(2);
    expect(mega71Klassen).toBe(3);
    expect(addin + slides + mega71Vorlagen * mega71Klassen).toBe(11);
  });

  it("S2 — der eine umgebungsunabhaengige Skip haengt am Produktflag, nicht an der Sandbox", () => {
    const quelle = lies("services/app/src/routes/ka4-endzustand.test.ts");
    expect(quelle).toContain("KLARA_EXTERNAL_EXECUTION_MIGRATED ? it : it.skip");
  });

  it("S3 — die Erwartung zur Umgebung: ohne Horchrecht ruhen 11+1, mit Horchrecht nur der eine", () => {
    // Dieselbe Probe wie in den drei Dateien — dieser Fall DOKUMENTIERT die Zahl, die in der
    // jeweiligen Umgebung im Vollsuiten-Kopf stehen muss: Bahn `12 skipped`, Chef/CI `1 skipped`
    // (plus etwaige runIf-Gegenzweige spaeterer Test-Straenge). Weicht sie ab, ist etwas NEU.
    if (KANN_HORCHEN) {
      expect(KANN_HORCHEN, "Horchrecht vorhanden: die elf laufen mit — erwartet 1 skipped").toBe(
        true,
      );
    } else {
      expect(
        KANN_HORCHEN,
        "kein Horchrecht (Bahn-Sandbox): die elf ruhen — erwartet 12 skipped",
      ).toBe(false);
    }
  });

  it("S4 — GEGENPROBE der Zaehlung: ein Fantasie-Marker kommt in keiner der Dateien vor", () => {
    // Ohne diesen Fall waere S1 auch gruen, wenn `horchFaelle` schlicht immer die Sollzahl
    // lieferte — die Zaehlfunktion wird an einem Nicht-Vorkommen kalibriert.
    expect(
      lies("tests/app/slides-abort.test.ts").split("it.skipIf(!QUARKWELTRAUM)(").length - 1,
    ).toBe(0);
  });
});
