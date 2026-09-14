// @vitest-environment jsdom
// ================================================================================================
// JOB 3943 · G3 — DER ÜBERLAPPENDE FEHLER AM SCHREIBWEG.
// ================================================================================================
//
// DIE BESTELLUNG IST WÖRTLICH UND STAMMT VOM PRÜFER (`archiv/3827/runde-1/ben.md:25`, Prüfpunkt 6):
//
//   „Folgeprüfung: verzögerte Fehlerantworten und beobachtbare Request-Abschlüsse. … und
//    überlappende Fehler durch kontrolliert gehaltene Antworten ergänzen."
//
// WARUM ES DIESEN FALL BIS HEUTE NICHT GEBEN KONNTE: der 503 kehrte in dieser Bühne VOR dem
// Haltetor zurück (`freigabe-buehne.tsx`, JOB 3827: `gestoertesPut` bei `:134-142`, `haltPut` erst
// bei `:175-179`). Eine Fehlerantwort ließ sich also gar nicht festhalten — und damit war genau der
// Hergang, den ein Mensch am ehesten erlebt, nicht herstellbar: er klickt noch einmal, WÄHREND der
// erste Fehler noch unterwegs ist. Seit JOB 3943 durchläuft auch die gestörte Antwort das Tor
// (Lieferung 2); ihre Wirkung ist unverändert, nur ihr Zeitpunkt ist steuerbar.
//
// WAS DIESER FALL MISST, DAS G1 NICHT MISST: G1 lässt das Freigabeschreiben scheitern und prüft
// DANACH. Zwischen Klick und Fehler liegt dort kein Fenster. Hier liegt es, es ist beliebig lang,
// und in ihm bedient der Mensch weiter — zweimal, auf beiden Schreibwegen derselben Karte.
//
// WELCHE PRODUKTZEILEN DIESER FALL HÄLT — es sind zwei, und sie hängen nicht aneinander:
//   · `apps/web/src/pages/AdminKiDetails.tsx:697-698` (in diesem Arbeitsbaum nachgeschlagen; JOB 3827
//     und der Auftrag nennen für dieselben zwei Zeilen noch `:693-694`)
//         const schreibenLaeuft = aiSave.isPending || freigabeSpeichern.isPending;
//         const schalterGesperrt = gesperrt || schreibenLaeuft || nachladenGescheitert;
//     — die SICHTBARE Sperre: solange irgendein Schreiben unterwegs ist, ist die Karte zu.
//   · `apps/web/src/pages/AdminKiDetails.tsx:541-548` (`schreibnummer`, der EINE Schreibkanal)
//     — die WIRKSAME Sperre: ein Griff, der trotzdem durchkommt, zieht keine Nummer und schreibt
//     nicht. Sie ist ein Ref und gilt deshalb SYNCHRON, nicht erst im nächsten Bild.
// Dieser Fall misst beide getrennt: die erste am `disabled`-Merkmal während des hängenden Fehlers,
// die zweite an der Zahl der überhaupt abgeschickten Rümpfe.
//
// WAS ER ZUSICHERT, IST ABGELESEN UND NICHT GEWÜNSCHT (Auftrag §5.3): die Karte SCHLUCKT den
// zweiten Griff. Das ist die Messung; die Frage, ob sie ihn stattdessen vormerken sollte, ist ein
// Befund für Pedi und Codex und nicht Gegenstand dieses Tests.
//
// DIE BÜHNE steht in `freigabe-buehne.tsx`; ihr Dateikopf erklärt, warum in diesem Ordner kein
// Schalterfeld beim Namen genannt wird und der Freigabestand stattdessen gegen den tatsächlich
// gesendeten Rumpf gemessen wird (Freigabe-Wächter F2).
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  abraeumen,
  bruecke,
  griffOhneWirkung,
  kaestchen,
  karteMounten,
  karteRuht,
  karteSperrt,
  karteZeigt,
  klick,
  oeffnePut,
  protokoll,
  putAntwortenFestgehalten,
  putsAngekommen,
  ruempfeAbgeschickt,
  serverFreigabe,
  serverStand,
  serverStarten,
  speichernKnopf,
  umlegen,
  und,
  wahlWert,
  warteBis,
  zuordnungWaehlen,
} from "./freigabe-buehne";

beforeEach(() => {
  bruecke.wartende = [];
  bruecke.wartendePut = [];
});

afterEach(() => {
  abraeumen();
});

describe("JOB 3943 · G3 — ein zweiter Griff, während die erste Fehlerantwort noch unterwegs ist", () => {
  it("G3 · festgehaltener Schreibfehler: die Karte schluckt beide weiteren Griffe, schickt keinen zweiten Rumpf hinaus und geht danach wieder auf", async () => {
    await serverStarten();
    const c = await karteMounten();

    // Ein Zuordnungsentwurf steht BEREIT — ohne ihn wäre der Übernehmen-Knopf ohnehin aus, und der
    // zweite Griff dieses Falles ginge gegen eine Sperre, die gar nicht die gemessene ist.
    await zuordnungWaehlen(c, "deterministic");
    expect(speichernKnopf(c).disabled, "der Knopf ist mit Entwurf immer noch aus").toBe(false);
    expect(await serverFreigabe(), "vorher steht schon eine Freigabe").toBeUndefined();

    // ---- Das Freigabeschreiben scheitert — und seine Fehlerantwort HÄNGT ------------------------
    // GEWARTET WIRD AUF DREI DINGE, UND DAS DRITTE IST DIE LEHRE AUS RUNDE 1: die beiden ersten
    // Bedingungen sind Zähler der BRÜCKE — sie sagen, was der Transport getan hat. Die dritte ist
    // eine Bedingung der KARTE. Beide Zähler gelten schon, während die Karte von ihrem eigenen
    // Schreiben noch nichts gezeichnet hat (ihre Meldung liegt einen Makrotask später an,
    // `freigabe-buehne.tsx` Dateikopf Punkt 4) — eine Zusicherung über die Fläche wäre an dieser
    // Stelle ein Wettlauf gewesen, und genau den hat Runde 1 verloren.
    bruecke.gestoertesPut = true;
    bruecke.haltPut = true;
    await umlegen(
      c,
      "ki-freigabe-oeffentlich",
      und(
        ruempfeAbgeschickt(1),
        putAntwortenFestgehalten(1),
        karteSperrt(c, "ki-freigabe-oeffentlich"),
      ),
    );

    // KALIBRIERUNG: der Rumpf ist wirklich draußen, er hat den Server wirklich NICHT erreicht, und
    // seine Antwort steht wirklich am Tor. Ohne alle drei misst dieser Fall keine Überlappung.
    expect(bruecke.putRuempfe.length, "die Freigabe wurde gar nicht erst abgeschickt").toBe(1);
    expect(
      bruecke.putRuempfe[0]?.kiFreigabe,
      "der Versuch trug den Schalterstand nicht",
    ).toBeDefined();
    expect(bruecke.angekommenePuts, "das gestörte Schreiben erreichte den Server doch").toBe(0);
    expect(bruecke.wartendePut.length, "die Fehlerantwort wurde nicht festgehalten").toBe(1);

    // (a) WÄHREND DER FEHLER UNTERWEGS IST, IST DIE KARTE ZU — beide Schreibwege, nicht nur der
    //     eigene. Das ist die SICHTBARE Sperre (`AdminKiDetails.tsx:697-698`).
    //
    //     Die eine Hälfte — der Freigabeschalter selbst — ist oben ZUGESICHERT und steht deshalb
    //     hier nicht noch einmal: `karteSperrt(c, "ki-freigabe-oeffentlich")` ist Wartebedingung
    //     UND Zusicherung. Bleibt sie aus, bricht der Lauf mit ihrem Namen ab
    //     („die Karte hat „ki-freigabe-oeffentlich" gesperrt … zuletzt gesehen: steht offen") —
    //     das sagt mehr als ein nachgestelltes `expected false to be true`.
    //
    //     Die zweite Hälfte ist die eigentlich neue Aussage und wird hier gemessen: mitgesperrt ist
    //     auch der ANDERE Schreibweg. Beide Mutationen teilen sich einen Kanal, und das ist am
    //     Zuordnungsknopf zu sehen, nicht am eigenen Schalter.
    expect(
      speichernKnopf(c).disabled,
      "der Zuordnungsknopf bleibt bedienbar, während ein Schreiben noch unterwegs ist",
    ).toBe(true);

    // (b) DIE KARTE SAGT NOCH NICHTS ÜBER DEN AUSGANG — keine Tatsachenaussage ohne Grundlage. Der
    //     Fehler ist unterwegs, nicht angekommen; ein Fehlerhinweis wäre hier geraten.
    const zeigtFehler = (): boolean =>
      c.querySelector('[data-testid="ki-freigabe-fehler"]') !== null;
    expect(zeigtFehler(), "die Karte meldet den Fehler, bevor er da ist").toBe(false);

    // (c) DER MENSCH BEDIENT TROTZDEM — zweimal, auf beiden Wegen. Beide Griffe haben KEINEN
    //     eigenen beobachtbaren Abschluss (sie sollen ja nichts auslösen); abgerechnet werden sie
    //     unter (d), sobald der erste Fehler wirklich angekommen ist. Ein doch entstandener Rumpf
    //     stünde bis dahin längst in `putRuempfe` — die Brücke schreibt ihn beim Eintritt fort.
    await griffOhneWirkung(
      kaestchen(c, "ki-freigabe-oeffentlich"),
      "Freigabeschalter, zweiter Griff",
    );
    await griffOhneWirkung(speichernKnopf(c), "Zuordnung übernehmen, während der Fehler hängt");

    // ---- (d) JETZT KOMMT DIE FEHLERANTWORT AN --------------------------------------------------
    bruecke.haltPut = false;
    bruecke.gestoertesPut = false;
    oeffnePut();
    // Der Abschluss ist beobachtet, nicht abgesessen: die Karte MELDET den Fehler und hat nichts
    // mehr offen.
    await warteBis(und(karteZeigt(c, "ki-freigabe-fehler"), karteRuht()));

    // KEIN ZWEITER RUMPF ging hinaus — das ist die WIRKSAME Sperre (`schreibnummer`), gezählt und
    // nicht daraus geschlossen, dass nichts zu sehen war.
    expect(bruecke.putRuempfe.length, "ein weiterer Griff schickte doch einen Rumpf hinaus").toBe(
      1,
    );
    expect(bruecke.angekommenePuts, "trotz hängendem Fehler erreichte etwas den Server").toBe(0);

    // Und der Bestand ist unberührt — unabhängiger GET und echtes Audit, an Tor und Karte vorbei.
    const stand = await serverStand();
    expect(
      stand.freigabe,
      "aus dem gescheiterten Versuch wurde doch eine Freigabe",
    ).toBeUndefined();
    expect(stand.global, "die überlappende Bedienung schrieb doch eine Zuordnung").toBe("auto");
    expect((await protokoll()).length, "der gescheiterte Versuch steht im Freigabeprotokoll").toBe(
      0,
    );

    // (e) DER ENTWURF IST NICHT VERLOREN GEGANGEN.
    expect(wahlWert(c), "der Zuordnungsentwurf ging in der Überlappung verloren").toBe(
      "deterministic",
    );

    // ---- (f) UND DIE KARTE IST NICHT TOT -------------------------------------------------------
    // Das Schlucken war das Fenster, nicht der Endzustand: nach der Antwort geht beides wieder auf,
    // und der Zuordnungsknopf schreibt WIRKLICH.
    expect(
      kaestchen(c, "ki-freigabe-oeffentlich").disabled,
      "der Freigabeschalter bleibt nach der Fehlerantwort gesperrt",
    ).toBe(false);
    expect(
      speichernKnopf(c).disabled,
      "der Zuordnungsknopf bleibt nach der Fehlerantwort gesperrt",
    ).toBe(false);
    await klick(speichernKnopf(c), "Zuordnung übernehmen", und(putsAngekommen(1), karteRuht()));
    const danach = await serverStand();
    expect(danach.global, "die Zuordnung steht nach der Erholung nicht beim Server").toBe(
      "deterministic",
    );
    expect(danach.freigabe, "aus dem Fehlschlag wurde doch eine Freigabe").toBeUndefined();
  }, 60_000);
});
