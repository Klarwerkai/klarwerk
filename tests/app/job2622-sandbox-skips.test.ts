import { readFileSync } from "node:fs";
// ================================================================================================
// JOB 2622 · D1 — DIE, DIE IN DER BAHN RUHEN: benannt, begruendet, gepinnt
// (seit JOB 2707 D1 sind es vierzehn Horch-Faelle, nicht mehr elf — s. unten)
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
//   NACHGETRAGEN IN JOB 2707 D1 — DIE DREI AUS DER 2686er KETTE:
//     apps/web/src/auth/job2686-klick-bis-sitzung.test.tsx   3 Faelle (K1/K2/K3)
//   Sie starten einen echten Fastify-Prozess auf einem eigenen Port und standen im Tor rot mit
//   „listen EPERM 127.0.0.1" (PRO4 in 2701 D1) — derselbe Grund wie bei den elf, aber bis dahin
//   ohne Schalter. Damit sind es VIERZEHN Horch-Faelle, nicht mehr elf.
//
//   DIE ZWEI, die UEBERALL ruhen — sie haengen am Produktflag `KLARA_EXTERNAL_EXECUTION_MIGRATED`
//   (heute false), nicht an der Umgebung:
//     services/app/src/routes/ka4-endzustand.test.ts (KA4-E1) und, mit derselben Bauform,
//     tests/app/job2666-stufe-die-nur-der-client-behauptet.test.ts (V2).
//   ZUR EHRLICHKEIT DER ALTEN ZEILE (JOB 3033, 03.09.2026): sie sprach von „dem EINEN". Der 2666er
//   Fall trug denselben Schalter seit dem 29.08.2026 und war nie mitgezaehlt — S2 pinnt jetzt
//   beide. Die Ownerentscheidung, freizuschalten, ist am 03.09.2026 gefallen
//   (`PRIORITAETEN.md` V2); umgelegt ist der Schalter noch nicht, weil vier Sperrgruende offen
//   sind (Kopf von `klara-policy.ts`). Faellt er, laufen beide Faelle ohne weitere Aenderung mit.
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
  it("S1 — die vierzehn Horch-Faelle: 2 + 3 + (2 Vorlagen x 3 Klassen) + 3 = 14, an den Dateien gezaehlt", () => {
    const addin = horchFaelle("services/app/src/routes/addin-static-routes.test.ts");
    const slides = horchFaelle("tests/app/slides-abort.test.ts");
    // mega71 deklariert 2 skipIf-Vorlagen in einer Schleife ueber 3 Klassen (200/4xx/5xx).
    const mega71Vorlagen = horchFaelle("tests/app/mega71-onsend-synchron.test.ts");
    const mega71Klassen =
      lies("tests/app/mega71-onsend-synchron.test.ts").split('{ name: "').length - 1;
    // JOB 2707 D1: die drei aus der 2686er Kette, mit demselben Schalter aus demselben Grund.
    const sso = horchFaelle("apps/web/src/auth/job2686-klick-bis-sitzung.test.tsx");
    expect(addin).toBe(2);
    expect(slides).toBe(3);
    expect(mega71Vorlagen).toBe(2);
    expect(mega71Klassen).toBe(3);
    expect(sso).toBe(3);
    expect(addin + slides + mega71Vorlagen * mega71Klassen + sso).toBe(14);
  });

  it("S1b — JOB 2707: die drei SSO-Faelle nennen ihren Grund IM SCHALTERTEXT, nicht daneben", () => {
    // Der Auftrag verlangt das ausdruecklich: wer die Ausgabe liest, muss sehen, WARUM
    // uebersprungen wurde. Ein Kommentar im Quelltext steht nicht in der Testausgabe.
    const quelle = lies("apps/web/src/auth/job2686-klick-bis-sitzung.test.tsx");
    const mitGrund = quelle.split("(ruht ohne Horchrecht:").length - 1;
    expect(mitGrund, "jeder der drei uebersprungenen Faelle traegt seinen Grund im Titel").toBe(3);
    // Und die Probe ist dieselbe wie hier — ein echter listen-Versuch, kein Umgebungsraten.
    expect(quelle).toContain('probe.listen(0, "127.0.0.1"');
  });

  it("S2 — die umgebungsunabhaengigen Schalter haengen am Produktflag, nicht an der Sandbox", () => {
    // NACHGEFUEHRT AM 03.09.2026 (JOB 3033): Der zweite Traeger fehlte in dieser Liste seit dem
    // 29.08.2026 — `job2666` benutzt dieselbe Bauform und wurde nie mitgezaehlt. Beide sind jetzt
    // gepinnt. Die Bauform selbst ist der Gegenstand: eine Fallunterscheidung am Produktflag statt
    // an der Umgebung, damit die Faelle beim Umlegen mitlaufen und beim Zurueckdrehen ruhen,
    // statt rot zu stehen.
    for (const datei of [
      "services/app/src/routes/ka4-endzustand.test.ts",
      "tests/app/job2666-stufe-die-nur-der-client-behauptet.test.ts",
    ]) {
      expect(lies(datei), datei).toContain("KLARA_EXTERNAL_EXECUTION_MIGRATED ? it : it.skip");
    }
  });

  it("S3 — die Erwartung zur Umgebung: ohne Horchrecht ruhen 14+2, mit Horchrecht nur die zwei", () => {
    // Dieselbe Probe wie in den vier Dateien — dieser Fall DOKUMENTIERT die Zahl, die in der
    // jeweiligen Umgebung im Vollsuiten-Kopf stehen muss: Bahn `16 skipped`, Chef/CI `2 skipped`
    // (plus etwaige runIf-Gegenzweige spaeterer Test-Straenge). Weicht sie ab, ist etwas NEU.
    //
    // JOB 2707 D1 hat die Zahl von 12 auf 15 gehoben: die drei SSO-Faelle aus der 2686er Kette
    // haben denselben Schalter bekommen. Die SUMME bleibt gleich — sie wechseln von rot nach
    // uebersprungen, nicht aus der Suite heraus.
    //
    // JOB 3033 (03.09.2026) hat sie von 15 auf 16 bzw. von 1 auf 2 berichtigt — nicht, weil etwas
    // neu waere, sondern weil `job2666` V2 denselben Schalter seit dem 29.08.2026 traegt und nie
    // mitgezaehlt wurde. GEMESSEN, NICHT GESETZT: der Vollsuitenlauf dieser Bahn (mit Horchrecht)
    // meldet `7 skipped` — zwei aus dieser Liste, fuenf runIf-Gegenzweige der fuenf
    // Zielbild-Messungen unter `tests/design/`.
    if (KANN_HORCHEN) {
      expect(
        KANN_HORCHEN,
        "Horchrecht vorhanden: die vierzehn laufen mit — erwartet 2 skipped",
      ).toBe(true);
    } else {
      expect(
        KANN_HORCHEN,
        "kein Horchrecht (Bahn-Sandbox): die vierzehn ruhen — erwartet 16 skipped",
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
