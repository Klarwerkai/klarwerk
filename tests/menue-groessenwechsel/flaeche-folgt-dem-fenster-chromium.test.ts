// ================================================================================================
// JOB 3811 · WER DAS TELEFON DREHT, WÄHREND EIN WERKZEUGMENÜ OFFEN STEHT — FOLGT DIE FLÄCHE?
// ================================================================================================
//
// WARUM ES DIESE DATEI GIBT. Die Bestellung steht wörtlich in `jobs/3769/runde-2/RUECKGABE.md:50`:
// „Ein Kasten, der schrumpft, WÄHREND das Menü offen steht, lässt die Fläche stehen, wo sie steht
// (`Menue.tsx:283-285`, aus Runde 1 unverändert)." Gemeldet, nie gemessen. Ein Mensch öffnet am
// Telefon ein gerahmtes Werkzeugmenü und dreht dann das Gerät oder klappt die Tastatur auf — die
// Breite des Fensters ändert sich, die Fläche aber wurde beim ÖFFNEN eingepasst.
//
// WAS AM QUELLTEXT GELESEN IST, UND WO DER AUFTRAG DANEBENLAG. Der Auftrag (§2.2) nahm an, es gebe
// „weder ein `window.addEventListener("resize", …)` noch einen `ResizeObserver` in dieser Datei",
// und liess ausdrücklich den Fund der Bahn gelten. GEFUNDEN WURDE DAS GEGENTEIL:
//   · `Menue.tsx:192` — der Ausgleich läuft in einem `useLayoutEffect`, dessen Abhängigkeiten
//     `[istOffen, versatz, versatzHoch]` sind (`:300`).
//   · `Menue.tsx:218` — `if (!el || versuche.current >= 3) { return; }`: drei Anläufe je Lage. Der
//     Kommentar darüber begründet den Deckel (ein endlos neu rechnender Effekt bräche React mit
//     „Maximum update depth exceeded").
//   · `Menue.tsx:262` — UND ES GIBT IHN DOCH: `window.addEventListener("resize", beiGroesse)`,
//     und `beiGroesse` setzt `versuche.current = 0` ZURÜCK (`:259`), bevor es neu einpasst. Der
//     Deckel verhindert also das Schwingen innerhalb EINER Lage, nicht das Nachrechnen bei einer
//     neuen. Eingebaut mit JOB 3266 (Commit `7027813d`, 08.09.) — also vor der Bestellung.
//
// DAS GEMESSENE ERGEBNIS, UND ES FÄLLT GEGEN DIE GEMELDETE SORGE AUS. Bei einem FENSTERwechsel bei
// offener Fläche wird nachgerechnet, und die Fläche bleibt im Fenster. Gemessen (die Zahlen stehen
// unten in der Ausgabe jedes Falls, hier am Stand von JOB 3954 nachgeführt): 390→844 schiebt den
// Versatz von 148 px auf 50 px zurück, 390→320 von 148 px auf 131 px. Diese Datei PINNT das als
// Zusage. Das ist ein vollwertiges Ergebnis und kein Fehlschlag: die Bestellung war eine begründete
// Sorge, sie trägt für diesen Fall nicht.
//
// ================================================================================================
// DER BEFUND AUS RUNDE 1 — UND WARUM ER HIER STEHT STATT IN EINER EIGENEN DATEI.
// ================================================================================================
//
// Runde 1 hat den WIRKLICHEN Fall desselben Satzes gefunden: nicht das Fenster war der fehlende
// Auslöser, sondern der eigene INHALT. Wuchs die Fläche, WÄHREND sie offen stand (erste Stufe →
// Entwurfsliste, 220 px → 330 px), lief kein Effekt — `istOffen` blieb `true`, `versatz` stand
// schon, `resize` feuerte nicht, weil sich das Fenster gar nicht geändert hatte. GEMESSEN am Stand
// `dd709a1` (12./13.09., in echtem Chromium): die Entwurfsliste lag bei 390 px um 102 px und bei
// 320 px um 76 px LINKS AUSSERHALB des Fensters, der Versatz blieb auf dem Wert der ersten Stufe
// (148 px bzw. 47 px) stehen. Das war Bens x = −237 px aus JOB 3266 R1 (`Menue.tsx:121-128`),
// unverändert am Leben. Es stand als BEFUND in einer eigenen Datei
// (`befund-flaeche-folgt-dem-eigenen-inhalt-nicht-chromium.test.ts`), getrennt, weil eine Zusage
// und ein Mangel nicht in derselben Datei stehen dürfen.
//
// DER MANGEL IST BEHOBEN. `JOB 3769 D2` (Commit `3b27c44`) hat genau den fehlenden Auslöser
// eingebaut: einen `ResizeObserver` auf die Fläche selbst (`Menue.tsx:290-298`), der dasselbe
// `beiGroesse` ruft wie der Fensterhörer. Der Befund hat daraufhin getan, wofür er gebaut war — er
// wurde im Kandidatentor am 13.09. 23:17 ROT, mit seinem eigenen Satz im Fehlertext: „DER VERSATZ
// WURDE NACHGERECHNET (148 px → 258 px) — der fehlende Auslöser ist da. Diese Datei ist umzudrehen."
//
// RUNDE 2 HAT GENAU DAS GETAN, WAS DIE DATEI VERLANGTE. Ihr Kopf schrieb vor: „NICHT LÖSCHEN —
// UMDREHEN … aus „liegt draussen" wird die Zusicherung „liegt im Fenster", und der Fall gehört nach
// flaeche-folgt-dem-fenster-chromium.test.ts." Die drei Fälle stehen deshalb HIER, umgedreht, als
// I1/I2/I3. KEIN Fall ist verlorengegangen, und die Zahl des Mangels ist es auch nicht: I1/I2
// rechnen sie aus der HEUTIGEN Messung zurück (linke Kante minus der Nachrechnung) und verlangen,
// dass sie negativ bleibt. Wäre der Ausgleich nur Zierat, stünde dort eine Zahl ≥ 0 und der Fall
// wäre rot. So bleibt belegt, dass der Mangel bestand — ohne eine Datei, die einen behobenen
// Mangel behauptet.
//
// WAS DIESE DATEI NICHT BELEGT. Keine echten Geräte. Kein echtes `orientationchange` des
// Betriebssystems (das Produkt hat dafür keinen Hörer; `setViewportSize` löst `resize` aus, ein
// Telefon feuert beides). Keine echte Bildschirmtastatur — F4 misst, WIE WEIT sich das überhaupt
// nachstellen lässt, und benennt den Rest als Prüflücke. Kein Bildschirmleser, kein EN, kein NL,
// kein Fingertippen. NUR DIE WAAGERECHTE LAGE: die senkrechte Erreichbarkeit (die Fläche im
// rollenden Kasten, `Menue.tsx:236-243`) ist Gegenstand von `tests/ki-freie-anweisung/**` und hier
// ausdrücklich ungedeckt. Und nur DIESEN einen Inhaltswechsel: die anderen Menüs der Zeile (Datei,
// KI, Bereich, Vertraulichkeit, „?") haben keine zweite Stufe. Die Bühne wird IMPORTIERT, nicht
// abgeschrieben (`h3-blatt-buehne.ts`, Zielpfad von JOB 3809); EIN Browser, EINE Seite für den
// ganzen Lauf — seit der Zusammenführung in Runde 2 für ALLE Fälle dieses Auftrags.
//
// JOB 3954 ERGÄNZT ZWEI GRENZEN. (1) Von den vier Auskünften der Entwurfsliste (`Blatt.tsx:2386-2410`)
// misst diese Datei ZWEI, und beide nach einem erfolgreichen frischen Abruf: **leer** (E0, als
// festgehaltener Ausgangszustand) und **gefüllt** (T1/T2, I1–I3). **Gestört** (`blatt-entwuerfe-fehler`)
// und **offline** bleiben ausdrücklich draussen — dafür hat diese Bühne keinen Weg, und die Auskunft
// selbst ist Gegenstand der Bestandstests. (2) Die Schaltproben S1/S2 stellen die Auslöser IN DER
// SEITE ab, nicht im Produkt: sie belegen, WELCHER Auslöser was trägt, und nicht, wie sich ein
// Browser ohne `ResizeObserver` sonst verhielte.
//
// GEMESSEN WIRD AM „…"-MENÜ DER WERKZEUGZEILE (`Blatt.tsx:2304`, `gerahmt` → `right-0`), in seiner
// ERSTEN Stufe: sechs echte Einträge (Entwürfe · Anhänge · Status · Beispiel · Klara · Eingabe
// verwerfen) — und in I1/I2/I3 eine Stufe weiter, in der Entwurfsliste (`Blatt.tsx:2366`).
//
// ================================================================================================
// JOB 3954 — DIE GEMESSENE LISTE HATTE KEINEN EINZIGEN ENTWURF. JETZT HAT SIE DREI.
// ================================================================================================
//
// DER BEFUND, der diesen Auftrag ausgelöst hat (ben zu Runde 2, Prüfpunkt 6): „Konkrete
// Entwurfstitel bleiben ungemessen … I3 isoliert den Fensterhörer nicht vom Flächenbeobachter."
// Beides traf zu. Die Bühne legt EIN Wissensobjekt an und keinen Entwurf
// (`h3-blatt-buehne.ts:241-248`), das Blatt fährt über `/erfassen/neu?text=…` — ein NEUES Blatt,
// nichts Gespeichertes. Die 330 px, die I1/I2 als „gewachsen" massen, kamen deshalb allein aus der
// Hülle (`Menue.tsx:457`: `w-[320px]`, ob ein Titel darin steht oder nicht), und der Anker
// `blatt-entwurf-eintrag-titel` kam in diesem Prüfstand gar nicht vor.
//
// DIE ENTWÜRFE KOMMEN AUS DEM ECHTEN SERVER, und zwar auf dem Weg, den ein Mensch auch nähme:
// `POST /api/drafts` aus der Seite heraus, durch die Bühnenroute an die ECHTE Fastify-App
// (`h3-blatt-buehne.ts:273-305`, Bearer von der Bühne, `:290`), danach der ECHTE Listenabruf des
// Produkts. Kein `skript`-Stub, keine erfundene Antwort; die Anlage gilt erst als belegt, wenn
// dieselben Titel in der Liste stehen (`entwuerfeAnlegen` in `menue-buehne.ts`, dort die Begründung).
//
// DIE FÄLLE LAUFEN IN FESTER REIHENFOLGE AUF EINEM GETEILTEN BESTAND. Das ist keine Bequemlichkeit,
// sondern die Folge von §7.6: EIN Browser, EINE Seite für den ganzen Lauf. E0 steht deshalb ganz
// oben — es hält fest, was VOR der Anlage dastand, und legt den Bestand an; alles danach misst ihn.
// Wer einen Fall dazwischenschiebt, der den Bestand ändert, bricht T1/T2.
//
// DIE ZWEI AUSLÖSER SIND JETZT EINZELN GEMESSEN — UND EIN SATZ IN I3 WAR FALSCH. Der Ausgleich hat
// zwei Wecker auf derselben Funktion (`Menue.tsx:258-261`): den Fensterhörer (`:262`) und den
// Flächenbeobachter (`:290-295`). I3 schaltete keinen von beiden ab und schloss trotzdem auf die
// Zuständigkeit („der Fensterhörer lebt neben dem Flächenbeobachter weiter"). GEMESSEN (S1/S2, ohne
// jede Produktänderung, über einen Vorspann in der Seite):
//   · S1, `ResizeObserver` gelöscht: der Inhaltswechsel wird NICHT nachgerechnet — der Versatz
//     bleibt auf 148 px, die Fläche liegt bei x=−102 von 390. Der Fensterwechsel 390 → 320 dagegen
//     rechnet nach (148 → 131 px) und holt sie zurück (x=8–312). DER FENSTERHÖRER TRÄGT DEN
//     FENSTERWECHSEL.
//   · S2, die `resize`-Anmeldung abgefangen (2 Stück): der Inhaltswechsel wird nachgerechnet
//     (148 → 258 px). UND der Fensterwechsel ebenfalls (258 → 131 px), weil er die Fläche von
//     330 px auf 304 px schmal macht (`max-w-[min(340px,calc(100vw-1rem))]`, `Menue.tsx:392`).
// DARAUS FOLGT: ein Fensterwechsel an der gewachsenen Fläche belegt den Fensterhörer NICHT — der
// Beobachter feuert dabei mit. I3s Zuständigkeitssatz ist deshalb BERICHTIGT (dort, mit der
// Messung), und die Zuordnung steht jetzt da, wo sie gemessen ist: in S1 und S2.
//
// ABGRENZUNG ZUM LESBARKEITSMESSER DER TITEL (`tests/d1-meine-entwuerfe/zugang-schmal-chromium.test.ts`,
// dort M1/L): DER misst den ZUGANG zu den Entwürfen bei FESTER Fenstergrösse (320/360/390/1280, DE
// und EN) — Weg hinein, Maus und Tastatur, Titeltext. HIER wird nach einem INHALTS- und einem
// FENSTERWECHSEL bei OFFENEM Menü gemessen; der Gegenstand ist der Größenwechsel, nicht der Zugang.
// Jene Datei wird von hier nur gelesen und ausdrücklich NICHT angefasst (sie ist Zielpfad des
// laufenden JOB 3951); sie hat ihre eigene Bühne, ihre eigene Fastify-Instanz und ihre eigenen drei
// Titel — kein zweiter Titel-Lesbarkeitsmesser entsteht hier, sondern die fehlende Messung am
// Größenwechsel.
//
// ZEILENANGABEN. Jede Angabe `Menue.tsx:<n>` / `Blatt.tsx:<n>` ist am Stand von `main` gelesen (mit
// JOB 3769 D2, `3b27c44`) — dem Stand, auf den dieser Auftrag vor dem Tor gesetzt wird
// (`rebase_vor_tor: true`).
//
// FÄLLE (in dieser Reihenfolge, auf EINEM Bestand)
// E0  der Ausgangsbestand der Entwurfsliste ist eine Zahl — und danach stehen echte Entwürfe darin.
// F0  die Bühne steht, und die Ausgangslage bei 390 px ist eine gemessene Zahl (Rechteck, Versatz).
// F1  DREHUNG 390×844 → 844×390 bei OFFENER Fläche: sie bleibt im Fenster und bei ihrem Knopf.
// F2  SCHRUMPFEN 390×844 → 320×568 bei OFFENER Fläche: dasselbe.
// F3  DER GEGENBEWEIS: bei der NEUEN Grösse geschlossen und neu geöffnet sitzt sie ebenfalls. Dieser
//     Fall trennt „die Fläche passt nie" von „die Fläche passt nur nicht MEHR" — und er ist der
//     Fall, den Gegenprobe A (Ausgleich abgeschaltet) rot macht.
// F4  DIE TASTATUR-LAGE, ehrlich: ein reiner Höhenwechsel, und was er NICHT nachstellt.
// I1  DER EIGENE INHALT bei 390 px: erste Stufe → Entwurfsliste OHNE Schliessen, ohne Fensterwechsel.
// I2  dasselbe bei 320 px.
// I3  BEIDE AUSLÖSER HINTEREINANDER: gewachsene Fläche, dann noch ein Fensterwechsel.
// T1/T2  DIE TITEL, DURCHGEHEND ÜBER DEN FENSTERWECHSEL: bei 390 px gemessen (Rechteck im Fenster,
//     nichts beschnitten, zeichengleich, mehrzeilig), dann auf 320 px gewechselt und DIESELBEN
//     Knoten erneut gemessen. Dass es dieselben sind, hängt an einer Marke an Dokument und Knoten
//     (R3) — Eintragszahl und Titeltexte allein belegen nur den BESTAND, kein Neuladen.
// S1  NUR DER FENSTERHÖRER lebt (ResizeObserver in der Seite gelöscht): was er trägt, was nicht.
// S2  NUR DER FLÄCHENBEOBACHTER lebt (die resize-Anmeldung am window abgefangen): dasselbe umgekehrt.
// W   nach S1/S2 ist die Seite wieder die alte — beide Auslöser zurück, I1 läuft erneut.
// P   die Seite hat während aller Messungen nichts geworfen.
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { type Buehne, type Seite, buehneAufbauen } from "../design/h3-blatt-buehne";
import {
  BLATT,
  HOCH,
  type Listenstand,
  MINDESTTITEL,
  type Masse,
  PFAD,
  QUER,
  SCHMAL,
  TITEL,
  TITEL_NORD,
  TITEL_SUED,
  TITEL_WORT,
  type Titelbild,
  type Titelmass,
  blattFahren,
  entwuerfeAnlegen,
  entwuerfeOeffnen,
  fensterStellen,
  gemessen,
  identitaetMarkieren,
  identitaetPruefen,
  listenStand,
  menueOeffnen,
  menueSchliessen,
  messen,
  schaltbefund,
  schaltungSetzen,
  schaltvorrichtungEinbauen,
  titelMessen,
} from "./menue-buehne";

let b: Buehne | null = null;

function buehne(): Buehne {
  const gefunden = b;
  expect(gefunden, "Prüfstand nicht aufgebaut").not.toBeNull();
  expect((gefunden as Buehne).fehler, "Prüfstand nicht aufgebaut").toBeNull();
  return gefunden as Buehne;
}

function seite(): Seite {
  return buehne().seite;
}

/**
 * DIE ZUSAGE: die Fläche und JEDES Stück darin liegen zwischen 0 und der Fensterbreite.
 *
 * Bewusst über die Stücke und nicht nur über die Fläche — ein Kind mit fester Breite kann über den
 * Rand seines Elternteils hinausstehen, und dann meldet der Elternteil eine heile Lage, während der
 * Mensch nichts lesen kann. Und bewusst mit ZAHLEN in der Meldung: „liegt draussen" ohne das Wieviel
 * wäre für den nächsten Leser wertlos.
 */
function imFenster(m: Masse, lage: string): void {
  const f = gemessen(m, lage);
  expect(
    m.schlimmstesLinks,
    `${lage}: die Fläche (oder ein Stück darin) beginnt links AUSSERHALB des Fensters ` +
      `(x=${m.schlimmstesLinks}, Fläche x=${f.links}–${f.rechts} von ${m.fenster}, Versatz ` +
      `${m.versatzMatrix} px, „${f.text}")`,
  ).toBeGreaterThanOrEqual(0);
  expect(
    m.schlimmstesRechts,
    `${lage}: die Fläche (oder ein Stück darin) endet rechts AUSSERHALB des Fensters ` +
      `(x=${m.schlimmstesRechts} von ${m.fenster}, Fläche x=${f.links}–${f.rechts}, Versatz ` +
      `${m.versatzMatrix} px, „${f.text}")`,
  ).toBeLessThanOrEqual(m.fenster);
  // Und die Seite hat dabei kein Seitwärtsrollen bekommen: eine Fläche, die das Dokument breiter
  // macht, liegt zwar rechnerisch „im Fenster", schiebt aber das ganze Blatt.
  expect(
    m.seitenbreite,
    `${lage}: die SEITE läuft waagerecht über (scrollWidth=${m.seitenbreite} auf clientWidth=${m.fenster})`,
  ).toBeLessThanOrEqual(m.fenster + 1);
}

/**
 * UND SIE GEHÖRT WEITERHIN SICHTBAR ZU IHREM KNOPF.
 *
 * „Im Fenster" allein wäre zu wenig: eine Fläche, die nach einem Größenwechsel irgendwo am anderen
 * Ende der Zeile steht, ist im Fenster und trotzdem falsch — niemand fände sie ihrem Werkzeug zu.
 * Geprüft wird die schwächste wahre Form davon, eine waagerechte ÜBERLAPPUNG; eine engere Zusage
 * („bündig") hat das Produkt nie gegeben, und der Ausgleich nimmt sie absichtlich zurück.
 */
function beiIhremKnopf(m: Masse, lage: string): void {
  const f = gemessen(m, lage);
  expect(m.knopf, `${lage}: das Werkzeug steht nicht da`).not.toBeNull();
  const k = m.knopf as NonNullable<Masse["knopf"]>;
  const ueberlappung = Math.min(f.rechts, k.rechts) - Math.max(f.links, k.links);
  expect(
    ueberlappung,
    `${lage}: die Fläche steht nicht mehr bei ihrem Werkzeug (Fläche x=${f.links}–${f.rechts}, ` +
      `Knopf x=${k.links}–${k.rechts}, Überlappung ${ueberlappung} px)`,
  ).toBeGreaterThan(0);
}

/**
 * JOB 3954 — JEDER TITEL STEHT GANZ DA: im Fenster, unbeschnitten, zeichengleich.
 *
 * Die vier Fragen sind vier verschiedene, und keine ersetzt eine andere:
 *   (a) das RECHTECK liegt im Fenster — gemessen am Titel selbst, nicht an seinem Elternteil;
 *   (b) nichts ist ABGESCHNITTEN (`scrollWidth`/`scrollHeight` gegen die sichtbare Fläche). Das ist
 *       die Zahl, die `truncate` rot macht und die ein Blick auf das Rechteck nicht sehen kann: das
 *       Kästchen sitzt dann richtig, nur der Inhalt passt nicht hinein;
 *   (c) der volle TEXT steht wirklich da — zeichengleich dem angelegten Titel;
 *   (d) mindestens einer ist nachweislich MEHRZEILIG. Ohne diese Zahl misst der Fall womöglich einen
 *       Titel, der ohnehin in eine Zeile passte, und wäre still grün.
 */
function titelLesbar(bild: Titelbild, lage: string): Titelmass[] {
  const fehlend = bild.titel.filter((t) => t === null).length;
  expect(
    fehlend,
    `${lage}: Entwurfszeilen ohne den Anker blatt-entwurf-eintrag-titel — dann misst dieser Fall ` +
      `nicht den Titel, sondern nichts (${fehlend} von ${bild.titel.length} Zeilen)`,
  ).toBe(0);
  const titel = bild.titel as Titelmass[];
  expect(
    titel.length,
    `${lage}: nur ${titel.length} Titel in der Liste — eine leere oder halbe Liste ist keine ` +
      `Messung, sondern eine leere Schleife (erwartet mindestens ${MINDESTTITEL})`,
  ).toBeGreaterThanOrEqual(MINDESTTITEL);

  for (const t of titel) {
    // (a) DAS RECHTECK.
    expect(
      t.links,
      `${lage}: der Titel „${t.text}" beginnt links AUSSERHALB des Fensters (x=${t.links}, ` +
        `Rechteck ${t.links}–${t.rechts} von ${bild.fenster})`,
    ).toBeGreaterThanOrEqual(0);
    expect(
      t.rechts,
      `${lage}: der Titel „${t.text}" endet rechts AUSSERHALB des Fensters (x=${t.rechts} von ` +
        `${bild.fenster}, Rechteck ${t.links}–${t.rechts})`,
    ).toBeLessThanOrEqual(bild.fenster);
    // (b) NICHTS IST ABGESCHNITTEN — mit der URSACHE in der Meldung, nicht nur der Wirkung.
    expect(
      t.textbreite,
      `${lage}: „${t.text}" ist WAAGERECHT beschnitten (${t.textbreite} px Text auf ` +
        `${t.sichtbreite} px Fläche; white-space=${t.umbruch}, text-overflow=${t.kuerzung}, ` +
        `overflow-wrap=${t.umbruchWort})`,
    ).toBeLessThanOrEqual(t.sichtbreite + 1);
    expect(
      t.texthoehe,
      `${lage}: „${t.text}" ist SENKRECHT beschnitten (${t.texthoehe} px Text auf ` +
        `${t.sichthoehe} px Fläche; white-space=${t.umbruch}, text-overflow=${t.kuerzung})`,
    ).toBeLessThanOrEqual(t.sichthoehe + 1);
  }

  // (c) DER VOLLE TEXT. Jeder angelegte Titel steht GENAU EINMAL und zeichengleich da — kein „…",
  // keine Kürzung. Geprüft wird über die angelegten Titel und nicht über die gelesenen: so fällt
  // auch der Fall auf, in dem die Liste drei Zeilen zeigt, aber die falschen.
  for (const erwartet of TITEL) {
    expect(
      titel.filter((t) => t.text === erwartet).length,
      `${lage}: der angelegte Titel „${erwartet}" steht nicht GENAU EINMAL zeichengleich da ` +
        `(gelesen: ${JSON.stringify(titel.map((t) => t.text))})`,
    ).toBe(1);
  }

  // (d) MINDESTENS EINER IST WIRKLICH UMGEBROCHEN.
  const mehrzeilig = titel.filter((t) => t.zeilen >= 2);
  const kaesten = JSON.stringify(titel.map((t) => `${t.zeilen}×„${t.text.slice(0, 24)}…"`));
  expect(
    mehrzeilig.length,
    `${lage}: KEIN Titel ist mehrzeilig (Zeilenkästen ${kaesten}) — dann misst dieser Fall Titel, ` +
      `die ohnehin in eine Zeile passten, und belegt den Umbruch nicht (${titel.length} Zeilen)`,
  ).toBeGreaterThan(0);
  return titel;
}

/**
 * EINE VOLLSTÄNDIGE TITELMESSUNG AN DER GERADE OFFENEN LISTE — Bestand, Rechtecke, Urteil.
 *
 * Eigen, weil sie ZWEIMAL im selben Fall gebraucht wird: einmal bei 390 px und, nach dem
 * Fensterwechsel, noch einmal bei 320 px. Zwischen den beiden Aufrufen darf NICHTS liegen, was die
 * Liste neu aufbaut — deshalb fährt dieser Griff selbst weder `goto` noch `menueOeffnen`; er misst
 * nur, was gerade dasteht.
 */
async function titelPruefen(
  s: Seite,
  lage: string,
): Promise<{ stand: Listenstand; bild: Titelbild; titel: Titelmass[] }> {
  // §9: erst der Bestand, dann die Geometrie. Über eine Liste, die noch lädt oder gestört ist, wird
  // nichts über Titel gesagt.
  const stand = await listenStand(s, `${lage} · Bestand vor der Titelmessung`);
  expect(stand.flaecheDa, `${lage}: die Entwurfsliste steht nicht offen`).toBe(true);
  expect(stand.laedt, `${lage}: die Liste lädt noch`).toBe(false);
  expect(stand.gestoert, `${lage}: der Entwurfsabruf ist gestört`).toBe(false);
  expect(
    stand.eintraege,
    `${lage}: die Liste trägt ${stand.eintraege} Entwürfe (Leersatz ${stand.leersatz}) — erwartet ` +
      `mindestens ${MINDESTTITEL} aus E0. Ohne Entwürfe misst dieser Fall nichts.`,
  ).toBeGreaterThanOrEqual(MINDESTTITEL);

  const bild = await titelMessen(s, `${lage} · Titelrechtecke`);
  const titel = titelLesbar(bild, lage);

  for (const t of titel) {
    console.info(
      `JOB 3954 · ${lage} · Fenster ${bild.fenster} px · „${t.text}" · Rechteck ` +
        `x=${t.links}–${t.rechts}, y=${t.oben}–${t.unten} (${t.breite}×${t.hoehe} px) · Text ` +
        `${t.textbreite}×${t.texthoehe} auf Fläche ${t.sichtbreite}×${t.sichthoehe} · ` +
        `${t.zeilen} Zeilenkästen · white-space=${t.umbruch}, text-overflow=${t.kuerzung}, ` +
        `overflow-wrap=${t.umbruchWort}`,
    );
  }

  // UND DIE ZWEI, DIE SICH ERST AM ENDE UNTERSCHEIDEN, unterscheiden sich auch SICHTBAR. Das ist
  // die eigentliche Zusage an den Menschen: er kann sie auseinanderhalten, BEVOR er klickt.
  const nord = titel.find((t) => t.text === TITEL_NORD);
  const sued = titel.find((t) => t.text === TITEL_SUED);
  const wort = titel.find((t) => t.text === TITEL_WORT);
  expect(
    nord,
    `${lage}: der Titel mit dem Ende „Nord 2026" steht nicht in der Liste`,
  ).toBeDefined();
  expect(sued, `${lage}: der Titel mit dem Ende „Süd 2026" steht nicht in der Liste`).toBeDefined();
  expect(wort, `${lage}: der Titel ohne Leerzeichen steht nicht in der Liste`).toBeDefined();
  expect(
    (nord as Titelmass).text.slice(-9),
    `${lage}: die zwei Titel desselben Vorhabens enden gleich — dann ist die Liste keine Auswahl`,
  ).not.toBe((sued as Titelmass).text.slice(-9));
  // Das überlange Wort OHNE Leerzeichen ist der Fall, für den `break-words` ausdrücklich steht
  // (`CaptureDraftList.tsx:363-367`): ein gewöhnlicher Umbruch findet darin keine Stelle. Dass es
  // trotzdem mehrzeilig steht, ist der Beleg, dass INNERHALB des Wortes gebrochen wird.
  expect(
    (wort as Titelmass).zeilen,
    `${lage}: das Wort ohne Leerzeichen steht in ${(wort as Titelmass).zeilen} Zeilenkasten auf ` +
      `${(wort as Titelmass).sichtbreite} px — dann wird nicht INNERHALB des Wortes gebrochen ` +
      `(overflow-wrap=${(wort as Titelmass).umbruchWort})`,
  ).toBeGreaterThanOrEqual(2);
  return { stand, bild, titel };
}

// KEIN `describe.runIf`: fehlt `apps/web/dist` oder startet Chromium nicht, wird dieser Lauf ROT und
// nennt den Ausfall wörtlich (er steht in `Buehne.fehler`). Ein übersprungener Prüfstand ist grün
// und belegt nichts.
describe("JOB 3811 · das offene Werkzeugmenü und der Fensterwechsel, im echten Chromium", () => {
  beforeAll(async () => {
    b = await buehneAufbauen(PFAD, BLATT, {}, HOCH);
  }, 180_000);

  afterAll(async () => {
    await b?.schliessen();
  }, 60_000);

  // ==============================================================================================
  // E0 · DER AUSGANGSBESTAND ALS ZAHL — UND DANN STEHEN ECHTE ENTWÜRFE DARIN.
  // ==============================================================================================
  //
  // WARUM DIESER FALL DER ERSTE IST. Alle Fälle dieser Datei teilen EINE Seite und EINEN Bestand
  // (§7.6: ein Browser, eine Seite). Der Bestand muss deshalb hier entstehen, vor allem, was ihn
  // misst — und was VORHER dastand, muss festgehalten sein, bevor er entsteht, sonst wäre „vorher n,
  // nachher n + k" eine Erinnerung und keine Messung.
  //
  // WAS HIER FESTGEHALTEN WIRD, IST EIN BEFUND UND KEINE ZUSAGE. Bis JOB 3954 mass dieser Prüfstand
  // die Entwurfsliste OHNE einen einzigen Entwurf: die Bühne legt ein Wissensobjekt an und keinen
  // Entwurf (`h3-blatt-buehne.ts:241-248`), das Blatt fährt über `/erfassen/neu?text=…` — ein NEUES
  // Blatt. Die 330 px Breite, die I1/I2 als „gewachsen" messen, kamen allein aus der Hülle
  // (`Menue.tsx:457`: `w-[320px]`, ob ein Titel darin steht oder nicht). Dieser Fall behauptet
  // NICHT, dass die Liste leer sein MUSS; er hält fest, was dasteht. Stünde wider Erwarten schon ein
  // Entwurf da, wäre das ein Fund und kein Fehlschlag — die Nachzählung rechnet mit dem gemessenen
  // `vorher` weiter.
  it("E0 · der Ausgangsbestand der Entwurfsliste ist eine Zahl — und danach stehen echte Entwürfe darin", async () => {
    const stand = b as Buehne;
    expect(stand.fehler, `Bühne nicht aufgebaut: ${stand.fehler}`).toBeNull();
    console.info(`JOB 3954 · E0 · Chromium ${stand.version} · Theme ${stand.theme}`);
    const s = seite();
    // Der Vorspann der Schaltproben wird HIER eingebaut, einmal für den ganzen Lauf: `addInitScript`
    // lässt sich nicht wieder entfernen, ein zweiter Einbau wäre ein zweiter Zähler. Ohne gesetzte
    // Marke ist er ein reiner Durchlass, der nur mitzählt — E0 misst also dieselbe Seite wie bisher.
    await schaltvorrichtungEinbauen(s);
    await schaltungSetzen(s, null);

    await blattFahren(s, HOCH);
    await menueOeffnen(s, "entwuerfe");
    const vorher = await listenStand(s, "E0 · 390×844 · Entwurfsliste VOR der Anlage");
    expect(
      vorher.flaecheDa,
      "E0: die Entwurfsliste steht gar nicht offen — dann ist über den Bestand nichts zu sagen",
    ).toBe(true);
    // §9: gemessen wird nach einem ERFOLGREICHEN frischen Abruf. Ein gestörter Abruf sagt über den
    // Bestand nichts, und die schwächere Aussage ist dann „unbekannt", nicht „leer".
    expect(
      vorher.gestoert,
      "E0: der Entwurfsabruf ist gestört (blatt-entwuerfe-fehler) — dann ist diese Zahl kein Bestand",
    ).toBe(false);
    expect(vorher.laedt, "E0: die Liste lädt noch — dann ist diese Zahl kein Bestand").toBe(false);
    console.info(
      `JOB 3954 · E0 · AUSGANGSBESTAND: ${vorher.eintraege} Entwurfszeilen · Leersatz ` +
        `${vorher.leersatz ? "STEHT" : "steht nicht"} (blatt-entwuerfe-leer) · Titel ` +
        `${JSON.stringify(vorher.titel)}`,
    );
    // Die zwei Auskünfte müssen zueinander passen — ein Leersatz NEBEN Einträgen wäre ein eigener
    // Mangel und darf nicht unbemerkt durchgehen.
    expect(
      vorher.leersatz,
      `E0: Leersatz (${vorher.leersatz}) und ${vorher.eintraege} Einträge stehen gleichzeitig da — ` +
        `zwei einander widersprechende Auskünfte über denselben Bestand (${JSON.stringify(vorher.titel)})`,
    ).toBe(vorher.eintraege === 0);

    // ---- UND JETZT DER BESTAND, über den echten Schreibweg ------------------------------------
    const { anlagen, stand: nachher } = await entwuerfeAnlegen(s, TITEL, HOCH, vorher.eintraege);
    console.info(
      `JOB 3954 · E0 · NACHZÄHLUNG: vorher ${vorher.eintraege} + ${TITEL.length} angelegt = ` +
        `${nachher.eintraege} Entwurfszeilen · Leersatz ${nachher.leersatz ? "STEHT" : "weg"} · ` +
        `Kennungen ${JSON.stringify(anlagen.map((a) => `${a.status}:${a.id}`))}`,
    );
    expect(
      nachher.leersatz,
      `E0: der Leersatz steht noch, obwohl ${nachher.eintraege} Entwürfe in der Liste stehen`,
    ).toBe(false);
    expect(
      nachher.filterLeer,
      `E0: die Liste meldet entwurfsliste-filter-leer, obwohl ${nachher.eintraege} Entwürfe im ` +
        `Bestand sind — dann zeigt sie ihn nicht (${JSON.stringify(nachher.titel)})`,
    ).toBe(false);
  }, 180_000);

  it("F0 · die Bühne steht, und die Ausgangslage bei 390 px ist eine gemessene Zahl", async () => {
    const stand = b as Buehne;
    expect(stand.fehler, `Bühne nicht aufgebaut: ${stand.fehler}`).toBeNull();
    console.info(`JOB 3811 · Chromium ${stand.version} · Theme ${stand.theme}`);
    const s = seite();
    await blattFahren(s, HOCH);
    await menueOeffnen(s);
    const m = await messen(s, "F0 · 390×844, frisch geöffnet");
    // DAS IST DER ZUSTAND, DEN DER EINPASS-EFFEKT HERGESTELLT HAT — der Bezugspunkt aller Fälle.
    // Und er ist nicht selbstverständlich: ohne den Ausgleich läge diese Fläche links draussen
    // (Gegenprobe A belegt es). Die sechs Einträge werden mitgezählt, damit „mit Inhalt" (§9) eine
    // Zahl ist und keine Behauptung.
    expect(
      m.eintraege,
      `F0: das „…"-Menü trägt nur ${m.eintraege} Einträge — dann misst dieser Lauf ein leeres Menü`,
    ).toBeGreaterThanOrEqual(5);
    imFenster(m, "F0 · 390×844");
    beiIhremKnopf(m, "F0 · 390×844");
    console.info(
      `JOB 3811 · F0 · Fenster ${m.fenster}×${m.fensterhoehe} · Fläche x=${m.flaeche?.links}–${m.flaeche?.rechts} ` +
        `(${m.flaeche?.breite} px, Deckel ${m.deckel}, Anker right=${m.anker}) · Versatz „${m.versatzStil}" = ` +
        `${m.versatzMatrix} px · Knopf x=${m.knopf?.links}–${m.knopf?.rechts} · ${m.eintraege} Einträge`,
    );
  }, 180_000);

  // ==============================================================================================
  // F1/F2 · DER FALL, UM DEN ES GEHT — in drei Schritten, jeder mit einer Zahl.
  // ==============================================================================================
  //
  // (a) 390×844 stellen, das gerahmte Menü öffnen, das Rechteck der Fläche festhalten.
  // (b) OHNE zu schliessen das Fenster wechseln — Drehung bzw. Schrumpfen.
  // (c) Erneut messen: liegt die Fläche noch im Fenster, und WIE hat sich ihr Versatz verhalten?
  //
  // DER VERSATZ IST DER BELEG FÜR DIE URSACHE, NICHT DAS URTEIL. Ein UNVERÄNDERTER Versatz bei
  // verändertem Fenster hiesse „es wurde nicht nachgerechnet"; er steht deshalb mit Zahlen in der
  // Ausgabe. Die harte Zusage ist trotzdem die LAGE — ein stehengebliebener Versatz, der die Fläche
  // zufällig nicht hinausschiebt, wäre kein Schaden für den Menschen, und diese Datei misst den
  // Schaden, nicht die Mechanik. Gegenprobe B (der `resize`-Hörer wird entfernt) belegt, dass die
  // Lage hier wirklich beisst: der Versatz bleibt dann auf 148 px stehen und schiebt die Fläche in
  // BEIDEN Fällen hinaus.
  for (const [fall, ziel, was] of [
    ["F1", QUER, "DREHUNG"],
    ["F2", SCHMAL, "SCHRUMPFEN"],
  ] as const) {
    it(`${fall} · ${was} ${HOCH.width}×${HOCH.height} → ${ziel.width}×${ziel.height} bei OFFENER Fläche: sie bleibt im Fenster`, async () => {
      const s = seite();
      await blattFahren(s, HOCH);
      await menueOeffnen(s);
      const vorher = await messen(s, `${fall} · vorher ${HOCH.width}×${HOCH.height}`);
      const v = gemessen(vorher, `${fall} · vorher`);
      imFenster(vorher, `${fall} · vorher ${HOCH.width}`);

      // (b) OHNE zu schliessen. Dass die Fläche offen BLEIBT, ist der ganze Fall — eine Fläche, die
      // der Größenwechsel schliesst, hätte das Problem nicht, sie hätte ein anderes.
      await fensterStellen(s, ziel);
      const nachher = await messen(s, `${fall} · nachher ${ziel.width}×${ziel.height}`);
      expect(
        nachher.flaeche,
        `${fall}: die Fläche hat den Größenwechsel nicht überlebt — sie ist verschwunden`,
      ).not.toBeNull();
      const n = gemessen(nachher, `${fall} · nachher`);
      expect(
        nachher.fenster,
        `${fall}: das Fenster hat sich gar nicht geändert (${nachher.fenster} px) — dann misst dieser Fall nichts`,
      ).not.toBe(vorher.fenster);

      console.info(
        `JOB 3811 · ${fall} · ${was} · vorher Fenster ${vorher.fenster} px, Fläche x=${v.links}–${v.rechts}, ` +
          `Versatz ${vorher.versatzMatrix} px · nachher Fenster ${nachher.fenster} px, Fläche ` +
          `x=${n.links}–${n.rechts}, Versatz ${nachher.versatzMatrix} px · Versatz ` +
          `${vorher.versatzMatrix === nachher.versatzMatrix ? "UNVERÄNDERT" : "nachgerechnet"} · ` +
          `Knopf x=${nachher.knopf?.links}–${nachher.knopf?.rechts}`,
      );

      // (c) DIE HARTE ZUSAGE.
      imFenster(nachher, `${fall} · nachher ${ziel.width}`);
      beiIhremKnopf(nachher, `${fall} · nachher ${ziel.width}`);
    }, 180_000);
  }

  // ==============================================================================================
  // F3 · DER GEGENBEWEIS — „die Fläche passt nie" gegen „die Fläche passt nur nicht MEHR".
  // ==============================================================================================
  //
  // Nach dem Wechsel wird geschlossen und bei der NEUEN Grösse neu geöffnet. Dann läuft der
  // Einpass-Effekt von vorn (`Menue.tsx:192-201`: `istOffen` wechselt, `versuche` und `versatz`
  // werden zurückgesetzt). Sässe sie hier NICHT, wäre der Befund ein ganz anderer als der bestellte
  // — dann passte die Fläche bei dieser Grösse überhaupt nicht, und der Größenwechsel wäre unschuldig.
  //
  // UND DIESER FALL IST DIE PROBE AUF DEN AUSGLEICH SELBST: bei 390 px braucht die Fläche 148 px
  // Verschiebung, bei 320 px 47 px, sonst liegt sie links draussen. Genau deshalb wird er rot,
  // wenn man `Menue.tsx:218` auf `versuche.current >= 0` stellt (Gegenprobe A).
  //
  // Die LAGE nach dem Wechsel und die nach dem Neuöffnen sind NICHT dieselbe, und das ist kein
  // Mangel: der Ausgleich korrigiert nur den ÜBERSTAND (`Menue.tsx:228-234`) und nimmt eine einmal
  // nötige Verschiebung nicht wieder zurück, solange sie nicht stört. Gemessen bei 844 px: x=616
  // nach der Drehung gegen x=566 nach dem Neuöffnen (50 px), bei 320 px x=92 gegen x=8 (84 px).
  // Beide liegen im Fenster. Die Zahlen stehen in der Ausgabe, damit der nächste
  // Leser sie hat — behauptet wird darüber nichts.
  for (const [fall, ziel, brauchtVersatz] of [
    ["F3a · nach der Drehung", QUER, false],
    ["F3b · nach dem Schrumpfen", SCHMAL, true],
  ] as const) {
    it(`${fall}: bei ${ziel.width} px geschlossen und neu geöffnet sitzt die Fläche`, async () => {
      const s = seite();
      await blattFahren(s, HOCH);
      await menueOeffnen(s);
      await fensterStellen(s, ziel);
      const gewechselt = await messen(s, `${fall} · nach dem Wechsel`);
      const gw = gemessen(gewechselt, `${fall} · nach dem Wechsel`);

      await menueSchliessen(s);
      await menueOeffnen(s);
      const neu = await messen(s, `${fall} · neu geöffnet bei ${ziel.width}`);
      const nn = gemessen(neu, `${fall} · neu geöffnet`);

      console.info(
        `JOB 3811 · ${fall} · nach Wechsel x=${gw.links}–${gw.rechts} (Versatz ${gewechselt.versatzMatrix}) · ` +
          `neu geöffnet x=${nn.links}–${nn.rechts} (Versatz ${neu.versatzMatrix}) · Fenster ${neu.fenster} · ` +
          `Unterschied ${Math.round((gw.links - nn.links) * 10) / 10} px`,
      );

      imFenster(neu, `${fall} · neu geöffnet`);
      beiIhremKnopf(neu, `${fall} · neu geöffnet`);
      // UND SIE SITZT NICHT VON SELBST, SONDERN WEIL GERECHNET WURDE — aber nur dort, wo das auch
      // stimmt. Bei 320 px steht der Knopf mitten in der umgebrochenen Zeile, die Fläche bräuchte
      // von ihm aus 38,5 px nach links über den Rand und wird gemessen um 46,5 px zurückgeschoben.
      // Bei 844 px bricht die Zeile nicht um, die Fläche passt ohne jede Verschiebung — dort wäre
      // dieselbe Forderung eine erfundene Zahl, und sie steht deshalb nicht da. (JOB 3954: die
      // Zahl bei 320 px ist gemessen 47 px, nicht 46,5 px wie bis Runde 2 notiert.)
      if (brauchtVersatz) {
        expect(
          neu.versatzMatrix,
          `${fall}: die neu geöffnete Fläche sitzt ohne jeden Ausgleich — bei ${neu.fenster} px ` +
            `braucht sie einen (gemessen ${neu.versatzMatrix} px, Fläche x=${nn.links}–${nn.rechts}, ` +
            `Knopf x=${neu.knopf?.links}–${neu.knopf?.rechts}); dann belegt dieser Fall den Ausgleich nicht`,
        ).not.toBe(0);
      }
    }, 180_000);
  }

  // ==============================================================================================
  // F4 · DIE TASTATUR-LAGE — und die ehrliche Antwort, wie weit sie sich hier nachstellen lässt.
  // ==============================================================================================
  //
  // Auf dem Telefon nimmt die eingeblendete Bildschirmtastatur HÖHE weg. Der Auftrag (§5.5) verlangt
  // zu MESSEN, ob `setViewportSize` das wirklichkeitsnah nachstellt, statt es stillschweigend
  // wegzulassen. Gemessen wird deshalb beides: was ein reiner HÖHENwechsel mit der Fläche macht, und
  // was dabei mit `window.visualViewport` geschieht.
  //
  // DER UNTERSCHIED, UM DEN ES GEHT — und er ist hier GEMESSEN, nicht behauptet: `setViewportSize`
  // verkleinert das Layout-Fenster UND das Sichtfenster im Gleichschritt (die Ausgabe zeigt beide).
  // Eine echte Bildschirmtastatur verkleinert auf den heutigen Telefonen nur das SICHTfenster; das
  // Layout-Fenster bleibt stehen, und `resize` am `window` feuert dann je nach Browser gar nicht.
  // Dieser Fall belegt also den HÖHENWECHSEL, nicht die Tastatur — das ist die schwächere Aussage,
  // und sie steht hier als solche. Die stärkere bräuchte `Page.setDeviceMetricsOverride` mit
  // getrenntem visuellem Fenster und damit einen Zugang, den die Bühne (`Seite`) nicht hat.
  it("F4 · die Tastatur-Lage: ein reiner Höhenwechsel bei offener Fläche — und was er NICHT nachstellt", async () => {
    const s = seite();
    await blattFahren(s, HOCH);
    await menueOeffnen(s);
    const vorher = await messen(s, "F4 · vorher 390×844");
    imFenster(vorher, "F4 · vorher");

    // Dieselbe Breite, deutlich weniger Höhe — die Grössenordnung einer eingeblendeten Tastatur.
    await fensterStellen(s, { width: HOCH.width, height: 400 });
    const nachher = await messen(s, "F4 · nachher 390×400");
    const n = gemessen(nachher, "F4 · nachher");
    expect(
      nachher.fenster,
      `F4: die BREITE hat sich mitgeändert (${vorher.fenster} → ${nachher.fenster}) — dann ist das kein reiner Höhenwechsel`,
    ).toBe(vorher.fenster);
    expect(
      nachher.fensterhoehe,
      `F4: die Höhe hat sich gar nicht geändert (${nachher.fensterhoehe} px)`,
    ).toBeLessThan(vorher.fensterhoehe);
    console.info(
      `JOB 3811 · F4 · Layout-Fenster ${vorher.fenster}×${vorher.fensterhoehe} → ${nachher.fenster}×${nachher.fensterhoehe} · ` +
        `Sichtfenster ${vorher.sichtfenster} → ${nachher.sichtfenster} · ` +
        `Fläche x=${n.links}–${n.rechts}, y=${n.oben}–${n.unten} · Versatz ${nachher.versatzMatrix} px`,
    );
    imFenster(nachher, "F4 · nachher");
    beiIhremKnopf(nachher, "F4 · nachher");
    // DIE PRÜFLÜCKE WIRD GEMESSEN, NICHT BEHAUPTET: dass das Sichtfenster hier MITgegangen ist, ist
    // der Beleg dafür, dass dieser Fall die stärkere Nachstellung fährt und die echte Tastaturlage
    // gerade NICHT deckt. Steht hier eines Tages ein abweichendes Sichtfenster, hat sich die Bühne
    // geändert und dieser Satz ist nachzuführen.
    expect(
      nachher.sichtfenster,
      "F4: die Bühne hat kein `visualViewport` — dann ist über die Tastatur hier gar nichts zu sagen",
    ).not.toBe("kein visualViewport");
    expect(
      nachher.sichtfenster,
      `F4: Sicht- und Layout-Fenster laufen auseinander (${nachher.sichtfenster} gegen ` +
        `${nachher.fenster}×${nachher.fensterhoehe}) — dann stellt dieser Fall etwas anderes nach, als sein Kopf sagt`,
    ).toBe(`${nachher.innen}x${nachher.innenhoehe}`);
  }, 180_000);

  // ==============================================================================================
  // I1/I2 · DER EIGENE INHALT — die umgedrehten Fälle B1/B2 aus Runde 1.
  // ==============================================================================================
  //
  // Gemessen wird ZWEIMAL an derselben offenen Fläche: erst die erste Stufe (sechs Einträge), dann
  // die Entwurfsliste. Dazwischen wird NICHT geschlossen und NICHT am Fenster gedreht — es klickt
  // nur ein Mensch auf „Entwürfe" (`entwuerfeOeffnen`). Das Fenster ist also über den ganzen Fall
  // hinweg dasselbe; der einzige Auslöser, der hier überhaupt feuern KANN, ist der
  // `ResizeObserver` auf der Fläche (`Menue.tsx:290-298`).
  //
  // DREI ZAHLEN TRAGEN DEN FALL, und die dritte ist die, die den alten Mangel am Leben hält:
  //   (a) die Fläche ist wirklich gewachsen (sonst gäbe es nichts nachzurechnen),
  //   (b) der Versatz WURDE nachgerechnet (er steht nicht mehr auf dem Wert der ersten Stufe),
  //   (c) OHNE diese Nachrechnung läge die linke Kante bei `links − (Versatz₂ − Versatz₁)`, und
  //       diese Zahl muss NEGATIV sein. Gemessen am Stand `dd709a1` war genau sie die Lage der
  //       Fläche: 8 − (258 − 148) = −102 bei 390 px, 8 − (131 − 47) = −76 bei 320 px. Wäre sie
  //       heute ≥ 0, wäre der Ausgleich an dieser Stelle Zierat — dann trüge dieser Fall nichts,
  //       und er sagt es statt still grün zu sein.
  //
  // JOB 3954: DIE FLÄCHE TRÄGT JETZT ECHTE ENTWÜRFE, und die drei Zahlen stehen unverändert da —
  // gemessen I1 (390 px) 220 px → 330 px, Versatz 148 → 258, ohne Nachrechnung x=−102; I2 (320 px)
  // 220 px → 304 px, Versatz 47 → 131, ohne Nachrechnung x=−76. Die Breite hängt hier nicht am
  // Inhalt (`w-[320px] max-w-full` deckelt sie, `Menue.tsx:457`), die Zahlen sind deshalb dieselben
  // wie über der leeren Liste. Was sich geändert hat, ist NICHT die Geometrie, sondern dass jetzt
  // etwas Lesbares darin steht — und DAS misst T1/T2.
  //
  // WELCHER AUSLÖSER DAS TUT, sagt dieser Fall nicht, und er tat es auch vorher nicht: es ist
  // GEMESSEN in S2 (der Flächenbeobachter allein, `Menue.tsx:290-295`).
  //
  // WAS ROT WIRD, WENN JEMAND DEN AUSLÖSER WIEDER ENTFERNT: (b) mit dem gemessenen Beleg „der
  // Versatz ist auf X px stehengeblieben", und unmittelbar danach `imFenster` mit der Lage. Das ist
  // dieselbe Datei, die vorher als BEFUND das Gegenteil festhielt — nur eben von der richtigen
  // Seite her.
  for (const [fall, groesse] of [
    ["I1", HOCH],
    ["I2", SCHMAL],
  ] as const) {
    it(`${fall} · ${groesse.width} px: die Fläche wächst bei OFFENEM Menü (erste Stufe → Entwurfsliste) und bleibt im Fenster`, async () => {
      const s = seite();
      await blattFahren(s, groesse);

      await menueOeffnen(s, "erste");
      const stufe1 = await messen(s, `${fall} · ${groesse.width} · erste Stufe`);
      const e = gemessen(stufe1, `${fall} · erste Stufe`);
      expect(
        stufe1.eintraege,
        `${fall}: die erste Stufe trägt nur ${stufe1.eintraege} Einträge — dann misst dieser Fall ein leeres Menü`,
      ).toBeGreaterThanOrEqual(5);
      // Die erste Stufe SITZT — das ist der Ausgangspunkt, und er ist die Zusage von F0.
      imFenster(stufe1, `${fall} · erste Stufe ${groesse.width}`);

      // EIN KLICK. Kein Schliessen, kein Fensterwechsel.
      await entwuerfeOeffnen(s);
      const stufe2 = await messen(s, `${fall} · ${groesse.width} · Entwurfsliste`);
      const l = gemessen(stufe2, `${fall} · Entwurfsliste`);
      expect(
        stufe2.fenster,
        `${fall}: das Fenster hat sich zwischen den Stufen geändert (${stufe1.fenster} → ` +
          `${stufe2.fenster} px) — dann misst dieser Fall nicht den Inhaltswechsel, sondern F1/F2`,
      ).toBe(stufe1.fenster);

      // (a) DIE VORAUSSETZUNG.
      expect(
        l.breite,
        `${fall}: die Entwurfsliste ist nicht breiter als die erste Stufe (${l.breite} px gegen ` +
          `${e.breite} px) — dann gibt es hier nichts nachzurechnen und dieser Fall misst nichts`,
      ).toBeGreaterThan(e.breite);

      // (b) DER AUSLÖSER HAT GEFEUERT.
      expect(
        stufe2.versatzMatrix,
        `${fall}: DER VERSATZ IST AUF DEM WERT DER ERSTEN STUFE STEHENGEBLIEBEN ` +
          `(${stufe1.versatzMatrix} px, Fläche jetzt ${l.breite} px statt ${e.breite} px breit, ` +
          `x=${l.links}–${l.rechts} von ${stufe2.fenster}) — der Auslöser auf der Fläche ` +
          `(Menue.tsx:290-298) fehlt oder feuert nicht. Das ist der Befund aus Runde 1 (${fall}), zurück.`,
      ).not.toBe(stufe1.versatzMatrix);

      // (c) UND ER WAR NÖTIG — die Lage, die OHNE ihn dastünde, aus heutigen Zahlen gerechnet.
      const nachgerechnet = (stufe2.versatzMatrix ?? 0) - (stufe1.versatzMatrix ?? 0);
      const ohneNachrechnung = Math.round((l.links - nachgerechnet) * 10) / 10;
      console.info(
        `JOB 3811 · ${fall} · Fenster ${groesse.width} px · erste Stufe x=${e.links}–${e.rechts} ` +
          `(${e.breite} px, Versatz ${stufe1.versatzMatrix}) → Entwurfsliste x=${l.links}–${l.rechts} ` +
          `(${l.breite} px, Versatz ${stufe2.versatzMatrix}) · nachgerechnet um ${nachgerechnet} px · ` +
          `ohne Nachrechnung läge die linke Kante bei ${ohneNachrechnung} px · Knopf ` +
          `x=${stufe2.knopf?.links}–${stufe2.knopf?.rechts}`,
      );
      expect(
        ohneNachrechnung,
        `${fall}: die Nachrechnung war gar nicht nötig — ohne sie läge die linke Kante bei ` +
          `${ohneNachrechnung} px und damit IM Fenster. Dann belegt dieser Fall den Ausgleich nicht ` +
          `(Fläche x=${l.links}–${l.rechts}, um ${nachgerechnet} px verschoben)`,
      ).toBeLessThan(0);

      // (d) DIE ZUSAGE.
      imFenster(stufe2, `${fall} · Entwurfsliste ${groesse.width}`);
      beiIhremKnopf(stufe2, `${fall} · Entwurfsliste ${groesse.width}`);
    }, 180_000);
  }

  // ==============================================================================================
  // I3 · BEIDE AUSLÖSER HINTEREINANDER — der umgedrehte Fall B3 aus Runde 1.
  // ==============================================================================================
  //
  // Erst wächst der Inhalt (erste Stufe → Entwurfsliste), DANN wechselt zusätzlich das Fenster
  // (390 → 320), und das Menü bleibt die ganze Zeit offen. In Runde 1 belegte dieser Fall, dass es
  // am AUSLÖSER lag und nicht an der Fläche: der Fensterwechsel reparierte damals eine Fläche, die
  // 102 px draussen lag. Heute ist er die schärfere Zusage — die Fläche übersteht ZWEI
  // Größenänderungen verschiedener Art hintereinander, ohne je geschlossen zu werden.
  //
  // ----------------------------------------------------------------------------------------------
  // JOB 3954 — BERICHTIGUNG: DIESER FALL ORDNET KEINEM DER ZWEI AUSLÖSER ETWAS ZU.
  // ----------------------------------------------------------------------------------------------
  //
  // Hier stand bis JOB 3954: „Er bleibt auch deshalb stehen, weil er die Halbheit ausschliesst, die
  // I1/I2 allein liessen: dass der `ResizeObserver` den Fensterhörer verdrängt haben könnte." Und
  // unten am `expect`: „Und der Fensterhörer lebt neben dem Flächenbeobachter weiter — das ist der
  // Unterschied in einer Zahl." BEIDE SÄTZE WAREN UNGEMESSEN, und die Messung trägt sie nicht.
  //
  // WAS S2 GEMESSEN HAT (dort, mit abgeschaltetem Fensterhörer): der Wechsel 390 → 320 macht die
  // Fläche von 330 px auf 304 px schmal — der Deckel `max-w-[min(340px,calc(100vw-1rem))]`
  // (`Menue.tsx:392`) greift. Der `ResizeObserver` auf der Fläche feuert also MIT, und der Versatz
  // wird von 258 px auf 131 px nachgerechnet, OBWOHL gar kein `resize`-Hörer am `window` hängt.
  // Ein Fensterwechsel an einer GEWACHSENEN Fläche belegt den Fensterhörer damit nicht.
  //
  // WO DIE ZUORDNUNG JETZT STEHT — gemessen und nicht behauptet:
  //   · Der FENSTERHÖRER trägt den Fensterwechsel: S1, mit gelöschtem `ResizeObserver`, Versatz
  //     148 px → 131 px, Fläche zurück von x=−102 auf x=8–312.
  //   · Der FLÄCHENBEOBACHTER trägt den Inhaltswechsel: S2, mit abgefangener `resize`-Anmeldung,
  //     Versatz 148 px → 258 px. Und er trägt den Fensterwechsel ebenfalls (258 px → 131 px).
  //   · Dass BEIDE weiterleben, zeigt W: 3 durchgelassene `resize`-Anmeldungen, 0 abgefangene.
  //
  // WAS I3 WEITERHIN BELEGT, und dafür bleibt er stehen: die Fläche übersteht ZWEI
  // Größenänderungen verschiedener Art hintereinander, ohne je geschlossen zu werden. Das ist eine
  // Aussage über die LAGE, und die misst dieser Fall. Über die Zuständigkeit sagt er nichts mehr.
  it("I3 · die GEWACHSENE Fläche übersteht zusätzlich einen Fensterwechsel 390 → 320, ohne je zu schliessen", async () => {
    const s = seite();
    await blattFahren(s, HOCH);
    await menueOeffnen(s, "entwuerfe");
    const vorher = await messen(s, "I3 · 390 · Entwurfsliste, gewachsen");
    const v = gemessen(vorher, "I3 · vorher");
    // Der Ausgangszustand IST schon der gewachsene — sonst misst der Rest dieses Falls F2 nach.
    expect(
      v.breite,
      `I3: die Fläche ist nur ${v.breite} px breit — das ist die erste Stufe, nicht die ` +
        `Entwurfsliste; dann misst dieser Fall denselben Fall wie F2 (Fenster ${vorher.fenster} px)`,
    ).toBeGreaterThan(300);
    imFenster(vorher, "I3 · vorher 390");

    await fensterStellen(s, SCHMAL);
    const nachher = await messen(s, "I3 · nach dem Fensterwechsel auf 320");
    const n = gemessen(nachher, "I3 · nachher");
    expect(
      nachher.fenster,
      `I3: das Fenster hat sich gar nicht geändert (${nachher.fenster} px) — dann misst dieser Fall nichts`,
    ).not.toBe(vorher.fenster);

    console.info(
      `JOB 3811 · I3 · vorher Fenster ${vorher.fenster} px, Fläche x=${v.links}–${v.rechts} ` +
        `(${v.breite} px, Versatz ${vorher.versatzMatrix}) → nachher Fenster ${nachher.fenster} px, ` +
        `Fläche x=${n.links}–${n.rechts} (${n.breite} px, Versatz ${nachher.versatzMatrix}) · ` +
        `Knopf x=${nachher.knopf?.links}–${nachher.knopf?.rechts}`,
    );

    imFenster(nachher, "I3 · nachher 320");
    beiIhremKnopf(nachher, "I3 · nachher 320");
    // UND ES WURDE NACHGERECHNET — welcher der zwei Auslöser das getan hat, sagt dieser Fall
    // ausdrücklich NICHT (s. die Berichtigung oben; gemessen wird es in S1/S2).
    expect(
      nachher.versatzMatrix,
      `I3: der Versatz ist unverändert geblieben (${vorher.versatzMatrix} px → ` +
        `${nachher.versatzMatrix} px) — dann hat der Fensterwechsel an der GEWACHSENEN Fläche ` +
        `nichts ausgelöst (Fenster ${vorher.fenster} → ${nachher.fenster} px)`,
    ).not.toBe(vorher.versatzMatrix);
  }, 180_000);

  // ==============================================================================================
  // T1/T2 · DIE TITEL SELBST — der Messpunkt, den dieser Prüfstand bis JOB 3954 nie angefasst hat.
  // ==============================================================================================
  //
  // WAS HIER ANDERS IST ALS IN F0–I3: dort ist der Gegenstand die LAGE der Fläche, hier ihr INHALT.
  // Die Fläche kann tadellos im Fenster liegen, während der Mensch die Titel trotzdem nicht lesen
  // kann — genau diesen Fall hat Ben in JOB 3266 R2 gemessen („expected 314 to be less than or equal
  // to 262 … whiteSpace: nowrap, overflow: ellipsis"), und genau deshalb steht am Titel seit JOB 3266
  // R3 `block break-words` statt `truncate` (`CaptureDraftList.tsx:375`). Bis heute hat das in DIESER
  // Datei niemand nachgemessen: der Anker `blatt-entwurf-eintrag-titel` kam hier nicht vor, und die
  // gemessene Liste hatte keinen einzigen Entwurf.
  //
  // ----------------------------------------------------------------------------------------------
  // RUNDE 2 — WARUM DAS EIN EINZIGER FALL IST UND KEINE ZWEI.
  // ----------------------------------------------------------------------------------------------
  //
  // In Runde 1 standen hier ZWEI Fälle, T1 bei 390 px und T2 bei 320 px, und jeder fuhr das Blatt
  // zuerst mit `blattFahren` NEU an und öffnete die Liste danach. Beide massen damit einen frisch
  // aufgebauten Zustand — und genau dazwischen lag die Lücke. Bens Gegenprobe (Runde 1, Prüfpunkt 2)
  // hat sie aufgedeckt: er hat die Titel ERST AM ENDE von `fensterStellen` auf
  // `white-space: nowrap; overflow: hidden; text-overflow: ellipsis` gestellt und bei 320 px
  // **464, 499 und 505 px Text auf je 230 px sichtbarer Breite** gemessen — der Prüfstand blieb
  // `Tests 16 passed (16)`, `✓ check grün`. Eine Beschneidung, die NUR nach dem Größenwechsel
  // zuschlägt, sah dieser Prüfstand nicht, weil das Neuladen sie jedes Mal wegräumte.
  //
  // DESHALB JETZT EINE DURCHGEHENDE STRECKE: bei 390 px messen, `fensterStellen` auf 320 px, und
  // DIESELBEN Knoten noch einmal vollständig messen. Zwischen den beiden Messungen liegt NICHTS —
  // kein `goto`, kein Neuladen, kein Schliessen, kein Neuöffnen.
  //
  // ----------------------------------------------------------------------------------------------
  // RUNDE 3 — WAS DIE VERGLEICHE BELEGEN, UND WAS NICHT. EINE BERICHTIGUNG.
  // ----------------------------------------------------------------------------------------------
  //
  // Hier stand in Runde 2: „Ohne diese zwei Zeilen könnte ein späterer Umbau ein Neuladen
  // einschmuggeln, und der Fall hiesse weiter durchgehend, ohne es zu sein." DAS WAR FALSCH, und
  // ben hat es widerlegt: er hat zwischen Fensterwechsel und zweiter Messung ein `blattFahren`
  // samt `menueOeffnen` eingeschoben — ein vollständiges Neuladen — und der Prüfstand blieb
  // `Tests 15 passed (15)`, `✓ check grün`. Der Grund ist einfach und hätte auffallen müssen:
  // EINTRAGSZAHL UND TITELTEXTE BELEGEN BESTANDSGLEICHHEIT, NICHT DOKUMENT- ODER KNOTENIDENTITÄT.
  // Nach einem Neuladen steht derselbe Bestand wieder da, nur in neuen Knoten.
  //
  // Die Zusage ist deshalb jetzt GEMESSEN statt behauptet (`identitaetMarkieren`/`identitaetPruefen`
  // in `menue-buehne.ts`, dort die Begründung): vor dem Wechsel bekommen das Dokument und jeder
  // Titelknoten eine Marke, die nur am Laufzeitobjekt hängt; nach dem Wechsel müssen beide noch da
  // sein. Ein Neuladen wirft die Dokumentmarke weg, ein Schliessen und Neuöffnen die Knotenmarken —
  // ein blosses Neuzeichnen (und nur das löst ein Fensterwechsel aus) lässt beide stehen.
  //
  // WAS JEDE PRÜFUNG TRÄGT, damit es niemand wieder verwechselt:
  //   · Eintragszahl und Titeltexte → der BESTAND ist derselbe (sie erkennen kein Neuladen);
  //   · Dokument- und Knotenmarke → es ist dasselbe Dokument und es sind dieselben Knoten.
  it("T1/T2 · die Titel am OFFENEN Menü: bei 390 px gemessen, auf 320 px gewechselt, DIESELBEN Knoten erneut gemessen", async () => {
    const s = seite();
    await blattFahren(s, HOCH);
    await menueOeffnen(s, "entwuerfe");

    // ---- T1 · 390 px -------------------------------------------------------------------------
    const t1 = await titelPruefen(s, "T1 · 390");
    expect(
      t1.bild.fenster,
      `T1: das Fenster ist ${t1.bild.fenster} px statt ${HOCH.width} px`,
    ).toBe(HOCH.width);

    // DIE MARKE, vor dem Wechsel gesetzt. Eine Markierung, die keinen Knoten trifft, hielte nichts
    // fest und wäre ein stiller Ausfall — deshalb die Zahl.
    const marke = `job3954-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const markiert = await identitaetMarkieren(s, marke);
    expect(
      markiert,
      `T1: die Identitätsmarke hat ${markiert} Titelknoten getroffen — dann hält sie nichts fest, und T2 könnte die Identität nicht prüfen`,
    ).toBe(t1.titel.length);

    // ---- DER WECHSEL, und sonst nichts ---------------------------------------------------------
    await fensterStellen(s, SCHMAL);

    // ---- T2 · 320 px, an DENSELBEN Knoten ------------------------------------------------------
    const t2 = await titelPruefen(s, "T2 · 320");
    expect(
      t2.bild.fenster,
      `T2: das Fenster hat sich gar nicht geändert (${t1.bild.fenster} → ${t2.bild.fenster} px) — dann misst diese Strecke denselben Zustand zweimal`,
    ).toBe(SCHMAL.width);

    // (a) DIE IDENTITÄT — das ist die Zeile, die ein eingeschobenes Neuladen rot macht.
    const ident = await identitaetPruefen(s, marke, "T2 · 320");
    expect(
      ident.dokument,
      `T2: das DOKUMENT trägt die Marke nicht mehr (gelesen ${ident.marke} statt ${marke}) — zwischen T1 und T2 wurde neu geladen, und dann misst diese Strecke keinen Übergang, sondern zwei getrennte Zustände`,
    ).toBe(true);
    expect(
      ident.markiert,
      `T2: nur ${ident.markiert} von ${ident.gesamt} Titelknoten tragen die Marke aus T1 — die Liste wurde dazwischen neu eingehängt (Schliessen/Neuöffnen oder Neuladen), es sind also NICHT dieselben Knoten`,
    ).toBe(t1.titel.length);

    // (b) UND DER BESTAND IST DERSELBE. Das ist die schwächere Aussage und steht hier als solche:
    // sie belegt, dass dieselben Entwürfe gemeint sind — ein Neuladen erkennt sie NICHT (das tut (a)).
    expect(
      t2.stand.eintraege,
      `T2: die Liste trägt nach dem Fensterwechsel ${t2.stand.eintraege} Einträge statt ${t1.stand.eintraege} — dann ist es nicht mehr derselbe Bestand`,
    ).toBe(t1.stand.eintraege);
    expect(
      t2.titel.map((t) => t.text).sort(),
      "T2: nach dem Fensterwechsel stehen andere Titel da als vorher — dann ist es nicht derselbe Bestand",
    ).toEqual(t1.titel.map((t) => t.text).sort());

    for (const vorher of t1.titel) {
      const nachher = t2.titel.find((t) => t.text === vorher.text) as Titelmass;
      console.info(
        `JOB 3954 · T1→T2 · „${vorher.text.slice(0, 40)}…" · 390 px: x=${vorher.links}–${vorher.rechts}, ` +
          `Text ${vorher.textbreite}×${vorher.texthoehe} auf ${vorher.sichtbreite}×${vorher.sichthoehe}, ` +
          `${vorher.zeilen} Zeilen → 320 px: x=${nachher.links}–${nachher.rechts}, Text ` +
          `${nachher.textbreite}×${nachher.texthoehe} auf ${nachher.sichtbreite}×${nachher.sichthoehe}, ` +
          `${nachher.zeilen} Zeilen`,
      );
    }
  }, 180_000);

  // ==============================================================================================
  // S1/S2 · JEDER AUSLÖSER EINZELN — und die Abschaltung selbst gemessen.
  // ==============================================================================================
  //
  // DIE BESTELLUNG, wörtlich (ben zu JOB 3811 R2): „I3 isoliert den Fensterhörer nicht vom
  // Flächenbeobachter; für diese engere Behauptung beide Auslöser einzeln deaktivieren." Und als
  // Promptverbesserung: „Behaupte die Wirksamkeit eines bestimmten Beobachters nur nach dessen
  // isolierter Abschaltung."
  //
  // DER GRUND, warum I3 die Frage nicht beantworten KANN: der Ausgleich hängt an EINEM
  // `useLayoutEffect` (`Menue.tsx:192`) mit ZWEI Weckern auf derselben Funktion `beiGroesse`
  // (`:258-261`) — dem Fensterhörer (`:262`) und dem Flächenbeobachter (`:290-295`). I3 schaltet
  // keinen von beiden ab. Und ein Fensterwechsel 390 → 320 ändert auch die BREITE der Fläche
  // (`max-w-[min(340px,calc(100vw-1rem))]`, `Menue.tsx:392`) — der Flächenbeobachter feuert dabei
  // also womöglich mit.
  //
  // KEINE PRODUKTÄNDERUNG, KEIN ZWEITER BROWSER: abgeschaltet wird in der SEITE, über den Vorspann
  // aus `menue-buehne.ts` (dort die Begründung) und eine Marke, die vor der Fahrt gesetzt und danach
  // zurückgenommen wird.
  //
  // UND JEDE PROBE WEIST ZUERST NACH, DASS SIE WIRKT. Ohne diesen Nachweis ist der Fall rot: eine
  // Schaltprobe, die nichts abgeschaltet hat, misst „alles liegt im Fenster" und nennt es Isolation.
  it("S1 · NUR DER FENSTERHÖRER lebt (kein ResizeObserver): was trägt er, und was trägt er nicht", async () => {
    const s = seite();
    await schaltungSetzen(s, "nur-fensterhoerer");
    await blattFahren(s, HOCH);

    // (1) DER WIRKSAMKEITSNACHWEIS — vor jeder Aussage über Auslöser.
    const befund = await schaltbefund(s, "S1 · nach der Fahrt");
    expect(
      befund.wahl,
      `S1: der Vorspann hat die Marke nicht gesehen (${befund.wahl}, Speicher ${befund.marke}, ` +
        `Klage ${befund.klage}) — dann ist nichts abgeschaltet und dieser Fall belegt nichts`,
    ).toBe("nur-fensterhoerer");
    expect(
      befund.beobachterDa,
      `S1: ResizeObserver steht in der Seite NOCH ZUR VERFÜGUNG (entfernt=${befund.beobachterEntfernt}, ` +
        `Klage ${befund.klage}) — dann läuft der Flächenbeobachter weiter und dies ist keine Isolation`,
    ).toBe(false);

    // (2) DER INHALTSWECHSEL — der Auslöser, der jetzt FEHLT.
    await menueOeffnen(s, "erste");
    // Und die zweite Hälfte des Nachweises, erst JETZT lesbar: `Menue.tsx:262` meldet den Hörer an,
    // sobald das Menü offen ist. Eine Isolation, bei der auch der übrig gelassene Auslöser fehlte,
    // wäre keine — sie mässe eine Fläche ganz ohne Ausgleich und schriebe das dem Fenster zu.
    const offen = await schaltbefund(s, "S1 · bei offenem Menü");
    expect(
      offen.resizeDurchgelassen,
      `S1: das Produkt hat bei offenem Menü KEINEN resize-Hörer angemeldet (durchgelassen ${offen.resizeDurchgelassen}, abgefangen ${offen.resizeAbgefangen}) — dann ist auch der Auslöser weg, den dieser Fall übrig lassen wollte`,
    ).toBeGreaterThanOrEqual(1);
    const stufe1 = await messen(s, "S1 · 390 · erste Stufe");
    const e = gemessen(stufe1, "S1 · erste Stufe");
    await entwuerfeOeffnen(s);
    const stufe2 = await messen(s, "S1 · 390 · Entwurfsliste, ohne Flächenbeobachter");
    const l = gemessen(stufe2, "S1 · Entwurfsliste");
    expect(
      l.breite,
      `S1: die Fläche ist beim Stufenwechsel nicht gewachsen (${e.breite} → ${l.breite} px) — dann ` +
        `gäbe es auch mit Beobachter nichts nachzurechnen (Fenster ${stufe2.fenster} px)`,
    ).toBeGreaterThan(e.breite);
    const inhaltNachgerechnet = stufe2.versatzMatrix !== stufe1.versatzMatrix;
    console.info(
      `JOB 3954 · S1 · INHALTSWECHSEL OHNE FLÄCHENBEOBACHTER · erste Stufe x=${e.links}–${e.rechts} ` +
        `(${e.breite} px, Versatz ${stufe1.versatzMatrix}) → Entwurfsliste x=${l.links}–${l.rechts} ` +
        `(${l.breite} px, Versatz ${stufe2.versatzMatrix}) · Versatz ` +
        `${inhaltNachgerechnet ? "nachgerechnet" : "UNVERÄNDERT"} · schlimmste Kante ` +
        `${stufe2.schlimmstesLinks}–${stufe2.schlimmstesRechts} von ${stufe2.fenster}`,
    );
    // DAS ERGEBNIS WIRD FESTGEHALTEN, AUCH WENN ES UNBEQUEM IST (Auftrag §8.5): der Fensterhörer
    // trägt den INHALTSWECHSEL NICHT. Gemessen bleibt der Versatz auf 148 px stehen, und die Fläche
    // liegt dann 102 px links draussen — genau die Lage des Befundes aus JOB 3811 R1. Das ist KEINE
    // Produktzusage, sondern die Isolationszahl: sie sagt, WELCHER der zwei Auslöser I1/I2 trägt
    // (der Flächenbeobachter, und S2 misst ihn allein). Wird diese Zeile eines Tages rot, ist ein
    // DRITTER Auslöser dazugekommen — dann ist die Zuordnung neu zu messen, nicht die Zeile zu
    // löschen.
    expect(
      stufe2.versatzMatrix,
      `S1: der Versatz wurde beim Inhaltswechsel nachgerechnet, OBWOHL der Flächenbeobachter abgeschaltet ist (${stufe1.versatzMatrix} px → ${stufe2.versatzMatrix} px, Fläche ${e.breite} → ${l.breite} px) — dann weckt noch etwas anderes den Ausgleich, und die Zuordnung aus S1/S2 ist neu zu messen`,
    ).toBe(stufe1.versatzMatrix);

    // (3) DER FENSTERWECHSEL — der Auslöser, der HIER ALS EINZIGER LEBT. Das ist die Zuordnung, die
    // dieser Fall belegt, und sie wird rot, wenn jemand `Menue.tsx:262` entfernt.
    await fensterStellen(s, SCHMAL);
    const nachWechsel = await messen(s, "S1 · nach dem Fensterwechsel auf 320");
    const n = gemessen(nachWechsel, "S1 · nach dem Fensterwechsel");
    expect(
      nachWechsel.fenster,
      `S1: das Fenster hat sich gar nicht geändert (${nachWechsel.fenster} px)`,
    ).not.toBe(stufe2.fenster);
    console.info(
      `JOB 3954 · S1 · FENSTERWECHSEL 390 → 320 MIT NUR DEM FENSTERHÖRER · vorher x=${l.links}–${l.rechts} ` +
        `(Versatz ${stufe2.versatzMatrix}) → nachher x=${n.links}–${n.rechts} (Versatz ` +
        `${nachWechsel.versatzMatrix}) · Fenster ${stufe2.fenster} → ${nachWechsel.fenster} · ` +
        `resize-Anmeldungen durchgelassen ${offen.resizeDurchgelassen}`,
    );
    const s1Zahlen =
      `Versatz ${stufe2.versatzMatrix} px → ${nachWechsel.versatzMatrix} px, Fenster ` +
      `${stufe2.fenster} → ${nachWechsel.fenster} px, ${offen.resizeDurchgelassen} durchgelassene ` +
      `resize-Anmeldungen, Fläche x=${n.links}–${n.rechts}`;
    expect(
      nachWechsel.versatzMatrix,
      `S1: der Fensterwechsel hat NICHTS ausgelöst, obwohl der Fensterhörer hier der einzige noch lebende Auslöser ist — dann ist der resize-Hörer am window (Menue.tsx:262) weg oder wirkungslos (${s1Zahlen})`,
    ).not.toBe(stufe2.versatzMatrix);
    imFenster(nachWechsel, "S1 · nach dem Fensterwechsel 320");
    beiIhremKnopf(nachWechsel, "S1 · nach dem Fensterwechsel 320");

    // (4) DIE MARKE WIRD ZURÜCKGENOMMEN — die Probe darf über ihre Fahrt hinaus nichts verstellen.
    await schaltungSetzen(s, null);
  }, 180_000);

  it("S2 · NUR DER FLÄCHENBEOBACHTER lebt (kein resize-Hörer am window): was trägt er", async () => {
    const s = seite();
    await schaltungSetzen(s, "nur-flaechenbeobachter");
    await blattFahren(s, HOCH);

    // (1) Der Nachweis kommt hier NACH dem Öffnen: `Menue.tsx:262` meldet den Hörer erst an, wenn
    // das Menü offen ist — vorher wäre der Zähler 0, und ein Nachweis auf 0 wäre keiner.
    await menueOeffnen(s, "erste");
    const befund = await schaltbefund(s, "S2 · nach dem Öffnen");
    expect(
      befund.wahl,
      `S2: der Vorspann hat die Marke nicht gesehen (${befund.wahl}, Speicher ${befund.marke})`,
    ).toBe("nur-flaechenbeobachter");
    expect(
      befund.resizeAbgefangen,
      `S2: es wurde KEINE resize-Anmeldung abgefangen (abgefangen ${befund.resizeAbgefangen}, ` +
        `durchgelassen ${befund.resizeDurchgelassen}) — dann hat diese Probe nichts abgeschaltet, ` +
        `und ihr Grün wäre falsch (Marke ${befund.marke})`,
    ).toBeGreaterThanOrEqual(1);
    expect(
      befund.beobachterDa,
      "S2: der ResizeObserver fehlt in dieser Seite — dann sind BEIDE Auslöser weg statt einer",
    ).toBe(true);

    // (2) DER INHALTSWECHSEL — hier ist der Flächenbeobachter der einzige, der feuern kann. Das ist
    // die Zuordnung, die dieser Fall belegt; sie wird rot, wenn jemand `Menue.tsx:290-295` entfernt.
    const stufe1 = await messen(s, "S2 · 390 · erste Stufe");
    const e = gemessen(stufe1, "S2 · erste Stufe");
    await entwuerfeOeffnen(s);
    const stufe2 = await messen(s, "S2 · 390 · Entwurfsliste, ohne Fensterhörer");
    const l = gemessen(stufe2, "S2 · Entwurfsliste");
    expect(
      l.breite,
      `S2: die Fläche ist beim Stufenwechsel nicht gewachsen (${e.breite} → ${l.breite} px)`,
    ).toBeGreaterThan(e.breite);
    console.info(
      `JOB 3954 · S2 · INHALTSWECHSEL OHNE FENSTERHÖRER · erste Stufe x=${e.links}–${e.rechts} ` +
        `(${e.breite} px, Versatz ${stufe1.versatzMatrix}) → Entwurfsliste x=${l.links}–${l.rechts} ` +
        `(${l.breite} px, Versatz ${stufe2.versatzMatrix}) · abgefangene resize-Anmeldungen ` +
        `${befund.resizeAbgefangen}`,
    );
    expect(
      stufe2.versatzMatrix,
      `S2: der Versatz ist auf dem Wert der ersten Stufe stehengeblieben (${stufe1.versatzMatrix} px, ` +
        `Fläche jetzt ${l.breite} px statt ${e.breite} px breit, x=${l.links}–${l.rechts} von ` +
        `${stufe2.fenster}) — der Flächenbeobachter (Menue.tsx:290-295) trägt den Inhaltswechsel NICHT`,
    ).not.toBe(stufe1.versatzMatrix);
    imFenster(stufe2, "S2 · Entwurfsliste 390 ohne Fensterhörer");

    // (3) UND JETZT DIE FRAGE, DIE I3 NICHT BEANTWORTEN KONNTE: feuert der Flächenbeobachter auch
    // beim FENSTERwechsel mit? Er muss es, wenn sich dabei die Breite der Fläche ändert
    // (`max-w-[min(340px,calc(100vw-1rem))]`). Hier wird es GEMESSEN und nicht überlegt — das
    // Ergebnis ist die Isolationszahl, nicht eine neue Produktzusage.
    await fensterStellen(s, SCHMAL);
    const nachWechsel = await messen(s, "S2 · nach dem Fensterwechsel auf 320");
    const n = gemessen(nachWechsel, "S2 · nach dem Fensterwechsel");
    const wechselNachgerechnet = nachWechsel.versatzMatrix !== stufe2.versatzMatrix;
    console.info(
      `JOB 3954 · S2 · FENSTERWECHSEL 390 → 320 OHNE FENSTERHÖRER · vorher x=${l.links}–${l.rechts} ` +
        `(${l.breite} px, Versatz ${stufe2.versatzMatrix}) → nachher x=${n.links}–${n.rechts} ` +
        `(${n.breite} px, Versatz ${nachWechsel.versatzMatrix}) · Versatz ` +
        `${wechselNachgerechnet ? "nachgerechnet" : "UNVERÄNDERT"} · Flächenbreite ` +
        `${l.breite === n.breite ? "gleich geblieben" : "mitgeändert"} · schlimmste Kante ` +
        `${nachWechsel.schlimmstesLinks}–${nachWechsel.schlimmstesRechts} von ${nachWechsel.fenster}`,
    );
    expect(
      nachWechsel.fenster,
      `S2: das Fenster hat sich gar nicht geändert (${nachWechsel.fenster} px)`,
    ).not.toBe(stufe2.fenster);
    // DAS IST DIE ZAHL, DIE I3s ALTEN SATZ WIDERLEGT HAT. Gemessen: 390 → 320 macht die Fläche von
    // 330 px auf 304 px schmal (der Deckel `max-w-[min(340px,calc(100vw-1rem))]` greift), der
    // Flächenbeobachter feuert also MIT — und der Versatz wird von 258 px auf 131 px nachgerechnet,
    // OBWOHL kein resize-Hörer am `window` hängt. Ein Fensterwechsel belegt den Fensterhörer
    // deshalb NICHT; das tut nur S1, wo der Beobachter fehlt. Die zwei Zeilen unten sind der Beleg,
    // auf den der berichtigte Kommentar in I3 verweist.
    expect(
      n.breite,
      `S2: die Fläche ist beim Fensterwechsel gleich breit geblieben (${l.breite} px) — dann hätte der Flächenbeobachter gar keinen Grund zu feuern, und diese Messung sagt über I3 nichts`,
    ).not.toBe(l.breite);
    expect(
      nachWechsel.versatzMatrix,
      `S2: der Versatz blieb beim Fensterwechsel stehen (${stufe2.versatzMatrix} px), obwohl die Fläche von ${l.breite} px auf ${n.breite} px schmal wurde — dann trägt der Flächenbeobachter den Fensterwechsel doch nicht, und I3s Zuordnung ist neu zu messen`,
    ).not.toBe(stufe2.versatzMatrix);
    imFenster(nachWechsel, "S2 · nach dem Fensterwechsel 320 ohne Fensterhörer");

    await schaltungSetzen(s, null);
  }, 180_000);

  // ==============================================================================================
  // W · NACH DEN SCHALTPROBEN IST DIE SEITE WIEDER DIE ALTE.
  // ==============================================================================================
  //
  // Die Gefahr einer Schaltprobe auf einer GETEILTEN Seite ist, dass sie über ihre Fahrt hinaus
  // wirkt und spätere Fälle verfälscht. Dieser Fall misst, dass sie es nicht tut: die Marke ist weg,
  // beide Auslöser sind wieder da, und I1 läuft ein zweites Mal — mit derselben Zusage.
  it("W · nach S1/S2: beide Auslöser sind zurück, und der Inhaltswechsel sitzt wieder", async () => {
    const s = seite();
    await schaltungSetzen(s, null);
    await blattFahren(s, HOCH);
    const befund = await schaltbefund(s, "W · nach der Rücknahme");
    expect(
      befund.marke,
      `W: die Marke der Schaltprobe steht noch im Speicher (${befund.marke})`,
    ).toBeNull();
    expect(
      befund.wahl,
      `W: der Vorspann hat noch eine Schaltung vorgefunden (${befund.wahl})`,
    ).toBe("null");
    expect(befund.beobachterDa, "W: der ResizeObserver fehlt noch immer").toBe(true);
    expect(
      befund.resizeAbgefangen,
      `W: es werden noch resize-Anmeldungen abgefangen (${befund.resizeAbgefangen})`,
    ).toBe(0);

    await menueOeffnen(s, "erste");
    const stufe1 = await messen(s, "W · 390 · erste Stufe");
    const e = gemessen(stufe1, "W · erste Stufe");
    await entwuerfeOeffnen(s);
    const stufe2 = await messen(s, "W · 390 · Entwurfsliste");
    const l = gemessen(stufe2, "W · Entwurfsliste");
    const befundDanach = await schaltbefund(s, "W · nach dem Öffnen");
    console.info(
      `JOB 3954 · W · erste Stufe x=${e.links}–${e.rechts} (${e.breite} px, Versatz ` +
        `${stufe1.versatzMatrix}) → Entwurfsliste x=${l.links}–${l.rechts} (${l.breite} px, Versatz ` +
        `${stufe2.versatzMatrix}) · resize-Anmeldungen durchgelassen ` +
        `${befundDanach.resizeDurchgelassen}, abgefangen ${befundDanach.resizeAbgefangen}`,
    );
    // Der Fensterhörer wird wirklich wieder angemeldet — das ist die Zahl, die belegt, dass S2 nur
    // für seine eigene Fahrt galt.
    expect(
      befundDanach.resizeDurchgelassen,
      `W: das Produkt hat bei offenem Menü keinen resize-Hörer angemeldet (durchgelassen ${befundDanach.resizeDurchgelassen}, abgefangen ${befundDanach.resizeAbgefangen})`,
    ).toBeGreaterThanOrEqual(1);
    expect(
      stufe2.versatzMatrix,
      `W: der Versatz ist auf dem Wert der ersten Stufe stehengeblieben — dann wirkt eine Schaltprobe über ihre Fahrt hinaus (${stufe1.versatzMatrix} px, Fläche ${l.breite} px)`,
    ).not.toBe(stufe1.versatzMatrix);
    imFenster(stufe2, "W · Entwurfsliste 390");
    beiIhremKnopf(stufe2, "W · Entwurfsliste 390");
  }, 180_000);

  it("P · die Seite hat während aller Messungen nichts geworfen", () => {
    expect(buehne().seitenfehler).toEqual([]);
  });
});
