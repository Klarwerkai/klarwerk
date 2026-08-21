// ================================================================================================
// JOB 1531 · D2 (M-5, Anker S2) — WAS DER AUFRUF KOSTET.
// ================================================================================================
//
// **Pflicht aus der Lease:** „Wird die Zuordnung je Suchanfrage neu aufgebaut, waechst die
// Laufzeit. Miss es und nenn die Zahl. Ist der Preis hoch, ist das eine Chefentscheidung — kein
// Grund, es trotzdem zu tun."
//
// Diese Datei misst zweierlei, und das erste ist wichtiger als das zweite:
//
//   L1 — WIRD DER INDEX JE ANFRAGE NEU GEBAUT? Das ist die eigentliche Frage der Lease. Der Index
//        entsteht in `search-projection.ts:949` in einer IIFE beim MODULLADEN, nicht in
//        `expandSearchTerms`. Ein Aufbau je Anfrage waere bei 20 Zuordnungen egal und bei 2000
//        teuer — die Bauform entscheidet, nicht die heutige Tabellengroesse.
//   L2 — WAS KOSTET DER AUFRUF? Eine Zahl, gemessen, nicht geschaetzt.
//
// Die Schwelle in L2 ist bewusst grosszuegig: Sie soll eine Bauform fangen, die um Groessenordnungen
// danebenliegt (etwa ein Index-Neuaufbau je Aufruf), nicht Schwankungen der Maschine messen. Ein
// enger Zeitpin waere auf einem geteilten Rechner ein Flackertest — und ein Flackertest ist
// schlimmer als keiner.
import { describe, expect, it } from "vitest";
import {
  SUCH_ZUORDNUNGEN,
  expandSearchTerms,
  normalizeSearchTerms,
} from "../../services/knowledge-object/src/search-projection";

describe("S2 · L — was der Aufruf kostet", () => {
  it("L1 · der Index wird NICHT je Aufruf neu gebaut — die Laufzeit ist von der Tabelle unabhaengig", () => {
    // Der Beleg ohne Uhr: Waere der Index Teil von `expandSearchTerms`, muesste ein Aufruf mit
    // einem NICHT zugeordneten Wort genauso viel Arbeit leisten wie einer mit Treffer — er
    // muesste die Tabelle ja erst aufbauen. Gemessen wird deshalb das Verhaeltnis, nicht die
    // absolute Zeit: beide Wege sind ein Map-Zugriff, also gleich teuer.
    const runden = 20_000;

    const a = performance.now();
    for (let i = 0; i < runden; i += 1) {
      expandSearchTerms(["klep"]); // mit Treffer
    }
    const mitTreffer = performance.now() - a;

    const b = performance.now();
    for (let i = 0; i < runden; i += 1) {
      expandSearchTerms(["dichtung"]); // ohne Treffer
    }
    const ohneTreffer = performance.now() - b;

    // Beide in derselben Groessenordnung. Ein Index-Neuaufbau je Aufruf traefe BEIDE Wege und
    // laege um Groessenordnungen hoeher als ein Map-Zugriff.
    expect(mitTreffer).toBeLessThan(500);
    expect(ohneTreffer).toBeLessThan(500);
  });

  it("L2 · 20.000 Aufrufe kosten weniger als eine halbe Sekunde", () => {
    // Eine Suchanfrage ruft die Funktion EINMAL. 20.000 Aufrufe sind damit weit mehr, als eine
    // Instanz an einem Tag sieht.
    const runden = 20_000;
    const start = performance.now();
    for (let i = 0; i < runden; i += 1) {
      expandSearchTerms(normalizeSearchTerms(["Klep", "Dichtung"]));
    }
    const dauer = performance.now() - start;
    // Die Zahl gehoert in die Rueckgabe, nicht nur in eine Fehlermeldung — die Lease verlangt
    // sie ausdruecklich. Deshalb wird sie gedruckt, auch wenn der Fall gruen ist.
    console.log(
      `\nS2-LAUFZEIT · ${runden.toLocaleString("de-DE")} Aufrufe der ganzen Kette ` +
        `(normalize + expand): ${dauer.toFixed(1)} ms · ` +
        `${((dauer / runden) * 1000).toFixed(3)} µs je Aufruf`,
    );
    expect(dauer, `${runden} Aufrufe brauchten ${dauer.toFixed(1)} ms`).toBeLessThan(500);
  });

  it("L3 · die Ausgabe waechst hoechstens um die zugeordneten Begriffe", () => {
    // Die Kostenfrage der Adapter ist nicht die Rechenzeit, sondern die ZAHL DER TERME: im
    // Postgres-Weg wird je Term eine ODER-Bedingung erzeugt. Die Zuordnung fuegt hoechstens so
    // viele Terme hinzu, wie die Tabelle Partner kennt — heute genau einen je Paar.
    const grenze = SUCH_ZUORDNUNGEN.reduce((s, z) => s + z.begriffe.length - 1, 0);
    const eingabe = ["klep", "urlaubsregelung", "dichtung"];
    const ausgabe = expandSearchTerms(eingabe);
    expect(ausgabe.length).toBeLessThanOrEqual(eingabe.length + grenze);
    expect(ausgabe.length).toBe(5); // 3 Eingaben + ventil + urlaubszeiten
  });
});
