// ================================================================================================
// JOB 3941 · C-B10 – C-B12 — DIE ZWEI RÜCKWEGE, IN DER GEBAUTEN ANWENDUNG UND MIT ECHTER BEDIENUNG.
// ================================================================================================
//
// WORUM ES GEHT. Wer über einen geteilten Link mit einer Eingrenzung auf eine frische, leere
// Instanz kommt, liest „Nichts gefunden." — richtig, denn die Adresse hat eingegrenzt. Setzt er die
// Filter zurück oder wendet er eine neutrale gemerkte Sicht an, ist nichts mehr eingegrenzt, und
// dann muss „Noch keine Einträge." dastehen. JOB 3913 hat beide Wege mit B10/B11 abgesichert
// (`leersatz-sagt-die-wahrheit.test.tsx:488`, `:522`) — aber in jsdom, und dort öffnet der
// gemeinsame Helfer die Untermenüs, indem er ihnen das Attribut setzt (`tests/library/support/
// bib-flaeche.tsx:71-75`, sein Kommentar `:52-56` sagt es selbst). BEN hat genau das als Prüflücke
// gemeldet (`archiv/3913/runde-1/ben.md:24`, Prüfpunkt 6): der Öffnungsvorgang ist nie gemessen
// worden.
//
// WAS DIESE DATEI HINZUFÜGT — und was sie NICHT ablöst. B10–B12 in jsdom bleiben unverändert
// bestehen: sie sind schnell und decken die LOGIK (Weiche, Befund, Rücksetzweg). Die drei Fälle
// hier decken die BEDIENUNG und die SICHTBARKEIT an der gebauten Anwendung: echter Zeigerklick auf
// das Untermenü, echte Fastify-App hinter jedem `/api/*` (`tests/design/h4-harness.ts:9-11`, `:26`),
// und ein Leersatz, der am berechneten Layout wirklich zu lesen ist. Keiner der beiden Wege ist
// doppelt; sie messen zwei verschiedene Dinge an derselben Zusage. Diese Datei ändert am Produkt
// nichts und erwartet auch nichts anderes als jsdom.
//
// RUNDE 2 — WAS BEN AN RUNDE 1 GEMESSEN HAT. Der Leersatz wurde nur als `textContent` gelesen. BEN
// blendete den Absatz vor jeder Lesung mit `display:none!important` aus, wies seine Unsichtbarkeit
// nach — und alle drei Fälle blieben grün. Ein Browserfall, der einen unsichtbaren Satz für erfüllt
// hält, hat die Rendering-Umgebung getauscht und sonst nichts. Seither gilt: erst SICHTBAR, dann
// RICHTIG (`leersatzIst()`), und die Kalibrierung am Ende dieser Datei fährt BENs beide
// Verstellungen selbst, damit der Beleg nicht am Prüfer hängt.
//
// ------------------------------------------------------------------------------------------------
// WIE DIE AUSGANGSLAGE ENTSTEHT — der eine Punkt, an dem der Browser anders ist als jsdom.
// ------------------------------------------------------------------------------------------------
// In jsdom ist der leere Bestand eine Zeile (`lage.bestand = abfrage([])`). Hier gibt es keinen
// Mock: die Bühne `h4Stand` legt zwei echte Wissensobjekte an und WARTET beim Öffnen auf eine
// Listenzeile (`h4-harness.ts:351-355`) — mit leerem Bestand käme sie gar nicht erst hoch. Der
// leere sichtbare Bestand wird deshalb NACH dem Aufbau hergestellt, und zwar über den echten
// Bedienweg des Produkts: `DELETE /api/kos/:id` aus der Seite heraus (`ko-routes.ts:1761`, der Weg
// des Löschknopfs). Getrashte Objekte wirken überall gelöscht (`knowledge-object/src/service.ts:2891`).
//
// DIE AUSGANGSLAGE WIRD DABEI NICHT ABGESCHWÄCHT, sondern GEMESSEN (BEN, `ben.md:31`:
// „Ausgangslagenprüfungen dafür abzuschwächen wäre falsch"): `bestandLeeren()` prüft die zwei
// Löschantworten UND liest danach `GET /api/kos` und `GET /api/library/search` leer zurück; jeder
// der drei Fälle prüft vor seiner Bedienung, dass der Auswahlsatz dasteht und der Rücksetzweg
// angeboten wird. Ohne diese Prüfungen wären C-B10/C-B11 auch dann grün, wenn der Bestandssatz
// schon vorher dastünde.
//
// ------------------------------------------------------------------------------------------------
// WAS BELEGT IST — und was ausdrücklich NICHT.
// ------------------------------------------------------------------------------------------------
// BELEGT: die drei Bedienwege (gemerkte neutrale Sicht, „Alle zurücksetzen", eingrenzende Sicht) in
// Chromium, an der gebauten Anwendung, bei EINER Fensterbreite (1620 × 900, die Bühne setzt sie) und
// in DEUTSCH; das Aufklappen des Untermenüs durch einen echten Zeigerklick samt Sichtbarkeit des
// Eintrags am berechneten Layout; die Sichtbarkeit des Leersatzes selbst (gezeichnet, unbeschnitten,
// undurchsichtig, an jeder Textzeile erreichbar) — mit der Kalibrierung als Beleg, dass diese
// Messung trägt.
// NICHT BELEGT, jede Zeile einzeln:
//   · EN/NL — BENs zweiter Ergänzungsvorschlag (`ben.md:24`) ist eine EIGENE Zeile und nicht Teil
//     dieses Auftrags. In jsdom deckt B8 die Sprachen für die Weiche selbst ab.
//   · schmale Breiten, Telefon- und Tablet-Layout, ein zweiter Browser.
//   · Tastaturbedienung AUSSERHALB des Untermenüs (Tab-Wege durch das Menü: `tests/bibliothek-sichten/
//     sichten-chromium.test.ts`). Hier wird getippt und geklickt, nicht durchgetabbt.
//   · Mehrbenutzerfälle — gemerkte Sichten hängen am `localStorage` EINES Browsers.
//   · Die Lagen „Fehler", „gescheiterte Auffrischung" und „offline" (§9): diese Bühne liefert jede
//     `/api/*`-Antwort aus der echten App aus, ein Fehlerzustand wäre hier gestellt und nicht
//     bedient. Dass in diesen Lagen KEIN Leersatz dasteht, misst B9 in jsdom
//     (`leersatz-sagt-die-wahrheit.test.tsx:445`); hier wird darüber nichts behauptet.
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import i18n from "../../apps/web/src/i18n";
import { type H4Stand, ORIGIN, fn, h4Stand } from "../design/h4-harness";

let stand: H4Stand;

// ------------------------------------------------------------------------------------------------
// DIE SÄTZE KOMMEN AUS DEM PRODUKT, NICHT AUS DIESER DATEI.
// ------------------------------------------------------------------------------------------------
// Gelesen wird die Sprachressource selbst — dieselbe Quelle und dieselbe Bauart wie
// `leersatz-sagt-die-wahrheit.test.tsx:197-205`. Ein deutscher Literaltext hier wäre eine zweite
// Wahrheit über denselben Satz und bliebe grün, während im Produkt etwas anderes steht.
function ressource(schluessel: string): string {
  const wert: unknown = i18n.getResource("de", "translation", schluessel);
  if (typeof wert !== "string" || wert.trim() === "") {
    throw new Error(`Schlüssel ${schluessel} fehlt in der Sprachressource de`);
  }
  return wert;
}
const BESTANDSSATZ = (): string => ressource("lib.liste.leer");
const AUSWAHLSATZ = (): string => ressource("lib.liste.leerSuche");
const RUECKSETZEN = (): string => ressource("facet.reset");
const SICHT_SPEICHERN = (): string => ressource("lib.menue.sichtSpeichern");
const SICHTEN = (): string => ressource("lib.menue.sichten");

const SICHT_NEUTRAL = "Ganzer Bestand";
const SICHT_EINGRENZEND = "Nur Ventile";
const SUCHWORT = "ventil";

// ------------------------------------------------------------------------------------------------
// IN DER SEITE: DIE EINE MESSUNG „STEHT DAS WIRKLICH DA?" — für jeden gemessenen Gegenstand dieselbe.
// ------------------------------------------------------------------------------------------------
// Diese Griffe werden in BEIDE Lesefunktionen unten hineingeschrieben (Leersatz und Untermenü), damit
// über „sichtbar" hier nur EINE Wahrheit existiert. Eine zweite Fassung liefe beim nächsten Umbau
// auseinander.
//
// GEMESSEN WIRD AM BERECHNETEN LAYOUT, NICHT AM DOM-BESTAND (LEHREN.md JOB 3919 R1: Inhalt und
// begrenzende Fläche gehören zusammen geprüft):
//   · `ausschnitt(el)` — was ALLE Vorfahren mit `overflow` ≠ `visible` zusammen übrig lassen, zuletzt
//     das Fenster. Das ist die Fläche, die von einem Kasten überhaupt noch zu sehen sein kann.
//   · `deckkraft(el)` — `opacity` multiplikativ über die ganze Kette; ein einziges `opacity: 0`
//     irgendwo oben genügt zum Verschwinden, und `checkVisibility()` merkt das von sich aus nicht.
//   · `trifft(el, x, y)` — die Trefferprobe `elementFromPoint`: sie ist die einzige Messgrösse, die
//     auch VERDECKUNG bemerkt (ein Kasten kann Höhe haben und trotzdem hinter etwas liegen).
const MESSEN = `
  const ausschnitt = (el) => {
    let links = 0, oben = 0, rechts = window.innerWidth, unten = window.innerHeight;
    for (let a = el.parentElement; a; a = a.parentElement) {
      const st = getComputedStyle(a);
      if (st.overflowX !== 'visible' || st.overflowY !== 'visible') {
        const ar = a.getBoundingClientRect();
        links = Math.max(links, ar.left); oben = Math.max(oben, ar.top);
        rechts = Math.min(rechts, ar.right); unten = Math.min(unten, ar.bottom);
      }
    }
    return { links: links, oben: oben, rechts: rechts, unten: unten };
  };
  const drin = (a, r) => r.left >= a.links - 0.5 && r.right <= a.rechts + 0.5 &&
    r.top >= a.oben - 0.5 && r.bottom <= a.unten + 0.5;
  const deckkraft = (el) => {
    let f = 1;
    for (let a = el; a; a = a.parentElement) {
      const o = Number(getComputedStyle(a).opacity);
      if (Number.isFinite(o)) { f *= o; }
    }
    return f;
  };
  const trifft = (el, x, y) => {
    const t = document.elementFromPoint(x, y);
    return !!t && (t === el || el.contains(t));
  };
  const kurz = (r) => Math.round(r.left) + ',' + Math.round(r.top) + ' ' +
    Math.round(r.width) + '×' + Math.round(r.height);
  const LEER_MASS = { hoehe: 0, breite: 0, x: 0, y: 0, imAusschnitt: false, getroffen: false,
    gezeichnet: false, kasten: '—' };
  const mass = (el, scrollen) => {
    if (!el) { return LEER_MASS; }
    if (scrollen) { el.scrollIntoView({ block: 'nearest' }); }
    const r = el.getBoundingClientRect();
    const a = ausschnitt(el);
    const x = r.left + r.width / 2, y = r.top + r.height / 2;
    const t = document.elementFromPoint(x, y);
    return {
      hoehe: r.height, breite: r.width, x: x, y: y,
      imAusschnitt: r.height > 0 && r.width > 0 && drin(a, r),
      getroffen: !!t && el.contains(t),
      // Die Auskunft des Browsers selbst, wenn er sie hat (checkVisibility, seit Chrome 105) —
      // sie steht als BELEG im Protokoll, geurteilt wird über die Erreichbarkeit.
      gezeichnet: typeof el.checkVisibility === 'function' ? el.checkVisibility() : r.height > 0,
      kasten: kurz(r) +
        ' | Ausschnitt ' + Math.round(a.links) + ',' + Math.round(a.oben) + '–' +
        Math.round(a.rechts) + ',' + Math.round(a.unten) +
        ' | getroffen: ' + (t ? t.tagName.toLowerCase() : 'nichts'),
    };
  };
`;

// ------------------------------------------------------------------------------------------------
// IN DER SEITE: DER GERENDERTE LEERSATZ — UND OB ER WIRKLICH ZU LESEN IST.
// ------------------------------------------------------------------------------------------------
// Gelesen wird der ABSATZ unter `bib-leer` (`BibliothekListe.tsx:411-413`), nicht der Kasten
// mitsamt Knopf — sonst misst man Text über Text (dieselbe Grenze wie `leersatz()` in jsdom).
//
// WARUM HIER NICHT NUR `textContent` STEHT (Korrekturpflicht 1, BEN zu Runde 1): `textContent` ist
// eine Aussage über den DOM, nicht über die Auskunft, die ein Mensch bekommt. BEN hat den Absatz vor
// jeder Lesung mit `display:none!important` ausgeblendet und dessen Unsichtbarkeit nachgewiesen —
// C-B10/C-B11/C-B12 blieben trotzdem grün. Ein Browserfall, der einen unsichtbaren Satz für erfüllt
// hält, misst nur die Rendering-Umgebung und nicht die Zusage aus §1 („der Leersatz danach ist am
// tatsächlich gerenderten Text abgelesen").
//
// GEMESSEN WIRD DER TEXT SELBST, nicht sein Kasten: `Range.getClientRects()` über den Inhalt des
// Absatzes gibt die Kästen der gezeichneten ZEILEN. Ein Absatz kann Höhe haben, während sein Text
// abgeschnitten, durchsichtig oder verdeckt ist; gezählt wird darum je Zeile, ob sie im Ausschnitt
// aller abschneidenden Vorfahren liegt und an ihrer Mitte erreichbar ist. Vorher wird der Absatz in
// den Blick gerollt — ein Mensch scrollt auch.
const LEERSATZ_LESEN = `() => {
  ${MESSEN}
  const p = document.querySelector('[data-testid="bib-leer"] p');
  if (!p) {
    return { da: false, text: null, zeilen: 0, abgeschnitten: 0, unerreichbar: 0, deckkraft: 0,
      absatz: LEER_MASS, protokoll: 'kein [data-testid="bib-leer"] p in der Seite' };
  }
  p.scrollIntoView({ block: 'nearest' });
  const absatz = mass(p, false);
  const a = ausschnitt(p);
  const bereich = document.createRange();
  bereich.selectNodeContents(p);
  const zeilen = [...bereich.getClientRects()].filter((z) => z.width > 0.5 && z.height > 0.5);
  const abgeschnitten = zeilen.filter((z) => !drin(a, z));
  const unerreichbar = zeilen.filter((z) => !trifft(p, z.left + z.width / 2, z.top + z.height / 2));
  return {
    da: true,
    text: (p.textContent || '').replace(/\\s+/g, ' ').trim(),
    zeilen: zeilen.length,
    abgeschnitten: abgeschnitten.length,
    unerreichbar: unerreichbar.length,
    deckkraft: deckkraft(p),
    absatz: absatz,
    protokoll: 'Absatz ' + absatz.kasten +
      ' | Textzeilen ' + zeilen.length + ' [' + zeilen.map(kurz).join(' · ') + ']' +
      ' | abgeschnitten ' + abgeschnitten.length + ' | unerreichbar ' + unerreichbar.length +
      ' | Deckkraft ' + deckkraft(p) + ' | gezeichnet ' + absatz.gezeichnet,
  };
}`;

/** Der Menüknopf und das Menü darunter (`Menue.tsx:86-101`: das Menü lebt neben dem Knopf). */
const MENUE_ZUSTAND = `(id) => {
  const b = document.querySelector('[data-testid="' + id + '"]');
  if (!b) { return { da: false, offen: false, menue: false }; }
  return {
    da: true,
    offen: b.getAttribute('aria-expanded') === 'true',
    menue: !!(b.parentElement && b.parentElement.querySelector('[role="menu"]')),
  };
}`;

/**
 * IN DER SEITE: alles, was über das Aufklappen eines Untermenüs zu sagen ist — vorher wie nachher
 * mit demselben Griff gelesen, damit die zwei Messungen wirklich vergleichbar sind.
 *
 * `mass()` ist der gemeinsame Griff von oben (`MESSEN`) und beantwortet Lieferung 4 am BERECHNETEN
 * Layout: Höhe und Breite aus `getBoundingClientRect()`, der Ausschnitt aus JEDEM Vorfahren, der
 * etwas abschneiden kann (das Menü selbst ist `max-h-[26rem] overflow-y-auto`, `Menue.tsx:91`), und
 * zuletzt die Trefferprobe `elementFromPoint`.
 *
 * WARUM „ZU" NICHT ÜBER DIE HÖHE GEMESSEN WIRD — gemessen, nicht angenommen (erster Lauf dieses
 * Auftrags, Chromium 149.0.7827.55): der Speicherknopf im GESCHLOSSENEN Untermenü meldet
 * `getBoundingClientRect().height === 24`, nicht 0. Chromium versteckt den Inhalt eines
 * geschlossenen `<details>` heute über `::details-content { content-visibility: hidden }` statt
 * über `display: none` — die Kästen bleiben also erhalten, gezeichnet und ANKLICKBAR ist der Inhalt
 * trotzdem nicht. Die ehrliche Messgrösse für „zu" ist deshalb die ERREICHBARKEIT (`getroffen`,
 * `elementFromPoint`) und nicht die Höhe; für „offen" bleibt es bei Höhe, Ausschnitt UND
 * Erreichbarkeit zusammen. Das ist ein Befund über die Messmethode, kein Produktbefund: der Mensch
 * kann den Eintrag im geschlossenen Untermenü weder sehen noch treffen. In jsdom stellt sich die
 * Frage gar nicht — dort gibt es kein Layout.
 */
const UNTERMENUE_LESEN = `({ knopf, untermenue, eintragSel, eintragText, rollen }) => {
  ${MESSEN}
  const leer = LEER_MASS;
  const b = document.querySelector('[data-testid="' + knopf + '"]');
  const m = b && b.parentElement ? b.parentElement.querySelector('[role="menu"]') : null;
  if (!m) {
    return { fehler: 'Menü „' + knopf + '" ist nicht offen', offen: false, summary: leer,
      eintrag: leer, fokusImSummary: false, eintraege: [] };
  }
  const s = [...m.querySelectorAll('summary')]
    .find((e) => (e.textContent || '').includes(untermenue));
  if (!s || !s.parentElement) {
    return { fehler: 'Untermenü „' + untermenue + '" fehlt; vorhanden: ' +
      [...m.querySelectorAll('summary')].map((e) => (e.textContent || '').trim()).join(' · '),
      offen: false, summary: leer, eintrag: leer, fokusImSummary: false, eintraege: [] };
  }
  const d = s.parentElement;
  const eintraege = [...d.querySelectorAll('[role="menuitem"], [role="menuitemcheckbox"]')];
  const eintrag = eintragSel
    ? d.querySelector(eintragSel)
    : eintraege.find((e) => (e.textContent || '').includes(eintragText)) || null;
  const aktiv = document.activeElement;
  return {
    offen: d.open,
    summary: mass(s, true),
    eintrag: mass(eintrag, rollen),
    fokusImSummary: !!aktiv && (aktiv === s || s.contains(aktiv)),
    eintraege: eintraege.map((e) => (e.textContent || '').trim()),
  };
}`;

interface Mass {
  hoehe: number;
  breite: number;
  x: number;
  y: number;
  imAusschnitt: boolean;
  getroffen: boolean;
  gezeichnet: boolean;
  kasten: string;
}
interface Untermenue {
  fehler?: string;
  offen: boolean;
  summary: Mass;
  eintrag: Mass;
  fokusImSummary: boolean;
  eintraege: string[];
}

interface Leersatz {
  da: boolean;
  text: string | null;
  zeilen: number;
  abgeschnitten: number;
  unerreichbar: number;
  deckkraft: number;
  absatz: Mass;
  protokoll: string;
}

async function leersatz(): Promise<Leersatz> {
  return await stand.seite.evaluate<Leersatz>(fn(LEERSATZ_LESEN));
}

/**
 * DER LEERSATZ: ERST ZU SEHEN, DANN RICHTIG — in dieser Reihenfolge, vor JEDER Textwertung.
 *
 * Die Reihenfolge ist die Aussage. Ein Fall, der nur den Wortlaut prüft, bleibt grün, während dem
 * Menschen nichts dasteht — genau das hat BEN in Runde 1 nachgewiesen (Absatz ausgeblendet, alle
 * drei Fälle weiter grün). Erst wenn der Satz gezeichnet, unbeschnitten, undurchsichtig und an
 * jeder seiner Textzeilen erreichbar ist, hat sein Wortlaut überhaupt eine Bedeutung.
 *
 * Jede Meldung trägt das volle Messprotokoll (Kasten, Zeilenkästen, Ausschnitt, Deckkraft) — wer sie
 * liest, sieht ohne zweiten Lauf, WAS gefehlt hat.
 */
async function leersatzIst(wo: string, soll: string): Promise<void> {
  const g = await leersatz();
  expect(g.da, `${wo} · der Leerkasten ist gar nicht da — ${g.protokoll}`).toBe(true);
  expect(
    g.absatz.gezeichnet,
    `${wo} · der Browser zeichnet den Leersatz nicht — ${g.protokoll}`,
  ).toBe(true);
  expect(
    g.absatz.hoehe,
    `${wo} · der Absatz des Leersatzes hat keine Höhe — ${g.protokoll}`,
  ).toBeGreaterThan(0);
  expect(
    g.zeilen,
    `${wo} · der Leersatz hat keine einzige gezeichnete Textzeile — ${g.protokoll}`,
  ).toBeGreaterThan(0);
  expect(
    g.abgeschnitten,
    `${wo} · Textzeilen des Leersatzes liegen ausserhalb dessen, was die Vorfahren übrig lassen — ${g.protokoll}`,
  ).toBe(0);
  expect(
    g.unerreichbar,
    `${wo} · Textzeilen des Leersatzes sind an ihrer Mitte nicht zu treffen (verdeckt oder ungezeichnet) — ${g.protokoll}`,
  ).toBe(0);
  expect(
    g.deckkraft,
    `${wo} · der Leersatz steht durchsichtig da — ${g.protokoll}`,
  ).toBeGreaterThan(0);
  expect(g.text, `${wo} — ${g.protokoll}`).toBe(soll);
}

/** Ein Menü über seinen Knopf öffnen — mit einem echten Klick, und danach nachgemessen. */
async function menueOeffnen(knopf: string): Promise<void> {
  const vorher = await stand.seite.evaluate<{ da: boolean; offen: boolean; menue: boolean }>(
    fn(MENUE_ZUSTAND),
    knopf,
  );
  expect(vorher.da, `Menüknopf „${knopf}" fehlt auf der Seite`).toBe(true);
  if (!vorher.offen) {
    await stand.seite.click(`[data-testid="${knopf}"]`);
  }
  const nachher = await stand.seite.evaluate<{ da: boolean; offen: boolean; menue: boolean }>(
    fn(MENUE_ZUSTAND),
    knopf,
  );
  expect(nachher.offen && nachher.menue, `Menü „${knopf}" hat sich nicht geöffnet`).toBe(true);
}

async function menueSchliessen(knopf: string): Promise<void> {
  const zustand = await stand.seite.evaluate<{ da: boolean; offen: boolean; menue: boolean }>(
    fn(MENUE_ZUSTAND),
    knopf,
  );
  if (zustand.offen) {
    // Escape ist der Weg, den das Menü selbst anbietet (`Menue.tsx:52-57`); er gibt den Fokus
    // ausdrücklich an den Knopf zurück. Ein Klick „irgendwohin" träfe womöglich etwas anderes.
    await stand.seite.keyboard.press("Escape");
  }
}

/**
 * LIEFERUNG 4 — DER ÖFFNUNGSVORGANG WIRD SELBST GEPRÜFT, NICHT NUR BENUTZT.
 *
 * Vorher: das `<details>` ist zu, der gesuchte Eintrag darin ist an seinem eigenen Mittelpunkt
 * NICHT zu treffen (s. den Absatz über `content-visibility` bei `UNTERMENUE_LESEN`), und die
 * Zusammenfassung ist an ihrem Mittelpunkt WIRKLICH erreichbar (`elementFromPoint`) — sonst ginge
 * der Klick unten ins Leere und der Fall bewiese nichts.
 * Dann: ein echter Zeigerklick auf diesen Mittelpunkt (`page.mouse.click`), keine Attributsetzung.
 * Nachher: das `<details>` ist offen, der Eintrag hat Höhe, liegt im Ausschnitt aller
 * abschneidenden Vorfahren und ist an seinem Mittelpunkt getroffen — UND der Fokus liegt auf der
 * bedienten Zusammenfassung.
 *
 * WARUM DER FOKUS MITGEMESSEN WIRD (Gegenprobe V2): Er ist die eine Messgrösse, die ein gesetztes
 * `details.open` NICHT nebenbei erzeugt. Ohne ihn bliebe dieser Griff auch dann grün, wenn man den
 * Klick durch das jsdom-Muster ersetzte — dann wäre nur die Rendering-Umgebung getauscht und nicht
 * die Bedienung, also genau die Halbheit, die dieser Auftrag ausschliesst.
 */
async function untermenueOeffnen(o: {
  fall: string;
  knopf: string;
  untermenue: string;
  eintragSel?: string;
  eintragText?: string;
}): Promise<Mass> {
  const arg = {
    knopf: o.knopf,
    untermenue: o.untermenue,
    eintragSel: o.eintragSel ?? null,
    eintragText: o.eintragText ?? null,
    rollen: false,
  };
  const wo = `${o.fall} · Untermenü „${o.untermenue}"`;
  const vorher = await stand.seite.evaluate<Untermenue>(fn(UNTERMENUE_LESEN), arg);
  expect(vorher.fehler ?? "", wo).toBe("");
  expect(vorher.offen, `${wo}: war schon offen — dann misst der Fall das Aufklappen nicht`).toBe(
    false,
  );
  expect(
    vorher.eintrag.getroffen,
    `${wo}: der Eintrag ist schon erreichbar, bevor aufgeklappt wurde (${vorher.eintrag.kasten})`,
  ).toBe(false);
  expect(
    vorher.eintrag.gezeichnet,
    `${wo}: der Browser hält den Eintrag im geschlossenen Untermenü für gezeichnet (${vorher.eintrag.kasten})`,
  ).toBe(false);
  expect(
    vorher.summary.getroffen,
    `${wo}: die Zusammenfassung ist an ihrem Mittelpunkt nicht anklickbar (${JSON.stringify(vorher.summary)})`,
  ).toBe(true);

  await stand.seite.mouse.click(vorher.summary.x, vorher.summary.y);

  const nachher = await stand.seite.evaluate<Untermenue>(fn(UNTERMENUE_LESEN), {
    ...arg,
    rollen: true,
  });
  expect(nachher.fehler ?? "", wo).toBe("");
  expect(nachher.offen, `${wo}: der echte Klick hat es nicht aufgeklappt`).toBe(true);
  expect(
    nachher.fokusImSummary,
    `${wo}: nach dem Klick liegt der Fokus nicht auf der bedienten Zusammenfassung — eine blosse Attributsetzung sähe genau so aus (V2)`,
  ).toBe(true);
  expect(
    nachher.eintrag.hoehe,
    `${wo}: der Eintrag ist nach dem Aufklappen ohne Höhe`,
  ).toBeGreaterThan(0);
  expect(
    nachher.eintrag.imAusschnitt,
    `${wo}: der Eintrag wird von einem Vorfahren abgeschnitten (${JSON.stringify(nachher.eintrag)})`,
  ).toBe(true);
  expect(
    nachher.eintrag.getroffen,
    `${wo}: der Eintrag ist an seinem Mittelpunkt nicht erreichbar (${JSON.stringify(nachher.eintrag)})`,
  ).toBe(true);
  expect(
    nachher.eintrag.gezeichnet,
    `${wo}: der Browser zeichnet den Eintrag nach dem Aufklappen nicht (${nachher.eintrag.kasten})`,
  ).toBe(true);
  console.info(
    `${wo}: vorher ${JSON.stringify(vorher)} · nachher ${JSON.stringify(nachher)} · Einträge ${nachher.eintraege.join(" | ")}`,
  );
  return nachher.eintrag;
}

/**
 * Wird der Rücksetzweg `facet.reset` im Menü „Filter" ANGEBOTEN? Gemessen wird auch die
 * ABWESENHEIT — der Eintrag hängt an `anyFilterActive` (`BibliothekFlaeche.tsx:1815`), also an
 * genau der Grösse, um die es in C-B10/C-B11 geht.
 */
async function ruecksetzwegAngeboten(): Promise<boolean> {
  await menueOeffnen("bib-menue-filter");
  const da = await stand.seite.evaluate<boolean>(
    fn(`(label) => {
      const b = document.querySelector('[data-testid="bib-menue-filter"]');
      const m = b && b.parentElement ? b.parentElement.querySelector('[role="menu"]') : null;
      const e = m ? m.querySelector('[data-testid="bib-filter-reset"]') : null;
      return !!e && (e.textContent || '').includes(label);
    }`),
    RUECKSETZEN(),
  );
  await menueSchliessen("bib-menue-filter");
  return da;
}

/**
 * DIE AUSGANGSLAGE, in jedem der drei Fälle verpflichtend geprüft (Lieferung 6).
 *
 * Gewartet wird auf einen ZUSTAND und nie auf eine Millisekundenzahl: der Leerkasten steht
 * ausschliesslich bei `!laedt && !fehler && !pausiert` (`BibliothekListe.tsx:410`), und dass die
 * Wertprüfung der Adresse durch ist, sieht man daran, dass `tag=` aus der Adresse verschwunden ist
 * — die Fortschreibung Facetten⇄URL läuft erst, wenn der Keim verbraucht ist
 * (`BibliothekFlaeche.tsx:334-336`, `libraryUrlFilters.ts:80`).
 */
async function ausgangslage(fall: string): Promise<void> {
  // Gemerkte Sichten liegen im `localStorage` und überlebten sonst den Fall, der sie angelegt hat
  // (dieselbe Vorsorge wie `leersatz-sagt-die-wahrheit.test.tsx:269`). Kein Fall lebt vom Nachlass
  // eines anderen.
  await stand.seite.evaluate<null>(
    fn(`() => {
      for (const k of Object.keys(localStorage)) {
        if (k.startsWith('klarwerk.library.views.')) { localStorage.removeItem(k); }
      }
      return null;
    }`),
  );
  await stand.seite.goto(`${ORIGIN}/bibliothek?tag=gibtesnicht`, {
    waitUntil: "load",
    timeout: 60_000,
  });
  await stand.seite.waitForFunction(
    fn(
      `() => !!document.querySelector('[data-testid="bib-leer"] p') && !location.search.includes('tag=')`,
    ),
    undefined,
    { timeout: 30_000 },
  );
  await leersatzIst(
    `${fall} · Ausgangslage: die Eingrenzung ist verworfen, gilt aber — der Auswahlsatz muss SICHTBAR dastehen`,
    AUSWAHLSATZ(),
  );
  expect(
    await ruecksetzwegAngeboten(),
    `${fall} · Ausgangslage: bei verworfener Eingrenzung fehlt der Weg zurück`,
  ).toBe(true);
}

/** Eine Sicht über den echten Bedienweg merken; das Untermenü wird dabei WIRKLICH aufgeklappt. */
async function sichtSpeichern(fall: string, name: string): Promise<void> {
  await menueOeffnen("bib-liste-menue");
  await untermenueOeffnen({
    fall,
    knopf: "bib-liste-menue",
    untermenue: SICHT_SPEICHERN(),
    eintragSel: '[data-testid="bib-sicht-speichern"]',
  });
  // Der Fokus steht nach dem Klick auf der Zusammenfassung; ein Tabulatorschritt führt von dort in
  // das Namensfeld (dieselbe Kette wie `sichten-chromium.test.ts:62-65`).
  await stand.seite.keyboard.press("Tab");
  expect(
    await stand.seite.evaluate<string>(fn("() => document.activeElement.id")),
    `${fall}: nach dem Aufklappen führt der Tabulator nicht ins Namensfeld`,
  ).toBe("bib-sichtname");
  await stand.seite.keyboard.type(name);
  const knopf = await stand.seite.evaluate<{ wert: string; gesperrt: boolean }>(
    fn(`() => {
      const feld = document.querySelector('#bib-sichtname');
      const k = document.querySelector('[data-testid="bib-sicht-speichern"]');
      return { wert: feld ? feld.value : '', gesperrt: !k || k.disabled };
    }`),
  );
  expect(knopf.wert, `${fall}: der getippte Name steht nicht im Feld`).toBe(name);
  expect(knopf.gesperrt, `${fall}: „${name}" lässt sich nicht speichern`).toBe(false);
  await stand.seite.click('[data-testid="bib-sicht-speichern"]');
  // Das Speichern schliesst das Menü (`BibliothekFlaeche.tsx`, `schliessen()` im Knopf) — ein
  // Zustand, der aus der Bedienung folgt und nichts über den Leersatz vorwegnimmt.
  await stand.seite.waitForFunction(
    fn(
      `() => document.querySelector('[data-testid="bib-liste-menue"]').getAttribute('aria-expanded') === 'false'`,
    ),
    undefined,
    { timeout: 10_000 },
  );
}

/** Eine gemerkte Sicht über den echten Bedienweg anwenden — Untermenü aufklicken, Eintrag klicken. */
async function sichtAnwenden(fall: string, name: string): Promise<void> {
  await menueOeffnen("bib-liste-menue");
  const eintrag = await untermenueOeffnen({
    fall,
    knopf: "bib-liste-menue",
    untermenue: SICHTEN(),
    eintragText: name,
  });
  await stand.seite.mouse.click(eintrag.x, eintrag.y);
  await stand.seite.waitForFunction(
    fn(
      `() => document.querySelector('[data-testid="bib-liste-menue"]').getAttribute('aria-expanded') === 'false'`,
    ),
    undefined,
    { timeout: 10_000 },
  );
}

/** Ins Suchfeld tippen und auf die ENTPRELLTE Fortschreibung warten — Zustand statt Frist. */
async function suchen(fall: string, wort: string): Promise<void> {
  expect(
    await stand.seite.evaluate<boolean>(
      fn(`() => {
        const el = document.querySelector('[data-testid="bib-suche"]');
        if (!el) { return false; }
        el.focus();
        return document.activeElement === el;
      }`),
    ),
    `${fall}: das Suchfeld ist nicht erreichbar`,
  ).toBe(true);
  await stand.seite.keyboard.type(wort);
  await stand.seite.waitForFunction(fn(`(wort) => location.search.includes('q=' + wort)`), wort, {
    timeout: 15_000,
  });
}

/** Das Suchwort Zeichen für Zeichen zurücknehmen — der Weg, den ein Mensch geht. */
async function sucheLeeren(fall: string, wort: string): Promise<void> {
  expect(
    await stand.seite.evaluate<boolean>(
      fn(`() => {
        const el = document.querySelector('[data-testid="bib-suche"]');
        if (!el) { return false; }
        el.focus();
        el.setSelectionRange(el.value.length, el.value.length);
        return document.activeElement === el;
      }`),
    ),
    `${fall}: das Suchfeld ist nicht erreichbar`,
  ).toBe(true);
  for (let i = 0; i < wort.length; i += 1) {
    await stand.seite.keyboard.press("Backspace");
  }
  await stand.seite.waitForFunction(fn(`() => !location.search.includes('q=')`), undefined, {
    timeout: 15_000,
  });
}

/**
 * Eine CSS-Regel für die Dauer einer Messung in die Seite legen und danach restlos entfernen.
 *
 * Über ein eigenes `<style>`-Blatt und nicht über `element.style`: ein Inline-Stil an einem Knoten,
 * den React besitzt, verschwindet beim nächsten Zeichnen wieder — die Verstellung wäre dann von der
 * Zeit abhängig statt vom Test. Der Rückbau wird nachgemessen (`vorhanden === false`).
 */
async function mitStil<T>(css: string, messen: () => Promise<T>): Promise<T> {
  await stand.seite.evaluate<null>(
    fn(`(regel) => {
      const s = document.createElement('style');
      s.id = 'job3941-gegenprobe';
      s.textContent = regel;
      document.head.appendChild(s);
      return null;
    }`),
    css,
  );
  try {
    return await messen();
  } finally {
    const weg = await stand.seite.evaluate<boolean>(
      fn(`() => {
        const s = document.getElementById('job3941-gegenprobe');
        if (s) { s.remove(); }
        return !document.getElementById('job3941-gegenprobe');
      }`),
    );
    expect(weg, "die Verstellung der Gegenprobe liess sich nicht zurücknehmen").toBe(true);
  }
}

/** Was die Fläche gerade über den Bestand sagt — Suchfeld und Leersatz in EINEM Lesegang. */
async function suchfeld(): Promise<string> {
  return await stand.seite.evaluate<string>(
    fn(`() => {
      const el = document.querySelector('[data-testid="bib-suche"]');
      return el ? el.value : '(kein Suchfeld)';
    }`),
  );
}

describe("JOB 3941 · der Leersatz nach echter Bedienung, in der gebauten Anwendung (Chromium)", () => {
  beforeAll(async () => {
    stand = await h4Stand("/bibliothek", "pedi@job3941.test");
    // ------------------------------------------------------------------------------------------
    // DER LEERE SICHTBARE BESTAND — hergestellt über die echte Route, danach nachgelesen.
    // ------------------------------------------------------------------------------------------
    const geloescht = await stand.seite.evaluate<number[]>(
      fn(`async (ids) => {
        const out = [];
        for (const id of ids) {
          const r = await fetch('/api/kos/' + id, { method: 'DELETE' });
          out.push(r.status);
        }
        return out;
      }`),
      [stand.koId, stand.koOffenId],
    );
    expect(
      geloescht,
      "die zwei Einträge liessen sich nicht über DELETE /api/kos/:id entfernen",
    ).toEqual([204, 204]);
    const rest = await stand.seite.evaluate<{ bestand: number; suche: number }>(
      fn(`async () => {
        const zahl = async (pfad) => {
          const r = await fetch(pfad);
          const j = await r.json();
          return Array.isArray(j) ? j.length : (Array.isArray(j.items) ? j.items.length : -1);
        };
        return { bestand: await zahl('/api/kos'), suche: await zahl('/api/library/search') };
      }`),
    );
    expect(rest, "der sichtbare Bestand ist nach dem Löschen nicht leer").toEqual({
      bestand: 0,
      suche: 0,
    });
    console.info(
      `JOB 3941 · Bühne: ${stand.version}, Theme ${stand.theme}, Bestand ${JSON.stringify(rest)}`,
    );
  }, 180_000);

  afterAll(async () => {
    await stand?.browser.close();
    await stand?.app.close();
  }, 60_000);

  it("C-B10 · eine gemerkte NEUTRALE Sicht bringt den Satz über den BESTAND zurück", async () => {
    await ausgangslage("C-B10");
    // WARUM DIESE SICHT NEUTRAL IST: gespeichert wird `currentViewState`
    // (`BibliothekFlaeche.tsx:522`) — q, Facetten, Zeitraum, Gruppierung, Segment und
    // Geltungsbereich stehen hier alle auf Standard, denn die Wertprüfung hat die Facette
    // weggeräumt. Der Befund `verworfeneEingrenzung` gehört NICHT zum Zustand einer Sicht.
    await sichtSpeichern("C-B10", SICHT_NEUTRAL);
    await leersatzIst("C-B10 · das blosse Merken ändert die Lage nicht", AUSWAHLSATZ());
    await sichtAnwenden("C-B10", SICHT_NEUTRAL);
    // `applyView` → `keimVerbrauchen()` (`:717`, `:649-655`): der Befund ist weg, also ist nichts
    // mehr eingegrenzt — und über den leeren Bestand ist „Noch keine Einträge." wieder wahr.
    await leersatzIst(
      "C-B10 · nach der gemerkten Sicht behauptet die gebaute Fläche weiter eine Eingrenzung",
      BESTANDSSATZ(),
    );
    expect(
      await ruecksetzwegAngeboten(),
      "C-B10: nichts ist mehr eingegrenzt — ein Rücksetzweg zeigte auf nichts",
    ).toBe(false);
    expect(stand.seitenfehler).toEqual([]);
  }, 120_000);

  it("C-B11 · „Alle zurücksetzen“ bringt den Satz über den BESTAND zurück", async () => {
    await ausgangslage("C-B11");
    await menueOeffnen("bib-menue-filter");
    // `onResetFilters` (`:691-698`) geht über DENSELBEN Griff `keimVerbrauchen()` wie die Sicht.
    // Der Eintrag schliesst das Menü nicht — die Abwesenheit unten wird deshalb im OFFENEN Menü
    // gemessen, was die stärkere Aussage ist: das Menü steht da, der Weg steht nicht mehr drin.
    await stand.seite.click('[data-testid="bib-filter-reset"]');
    await leersatzIst(
      "C-B11 · nach dem Zurücksetzen behauptet die gebaute Fläche weiter eine Eingrenzung",
      BESTANDSSATZ(),
    );
    const nochDa = await stand.seite.evaluate<{ menueOffen: boolean; eintrag: boolean }>(
      fn(`() => {
        const b = document.querySelector('[data-testid="bib-menue-filter"]');
        const m = b && b.parentElement ? b.parentElement.querySelector('[role="menu"]') : null;
        return { menueOffen: !!m, eintrag: !!(m && m.querySelector('[data-testid="bib-filter-reset"]')) };
      }`),
    );
    expect(nochDa.menueOffen, "C-B11: das Filtermenü ist beim Messen gar nicht mehr offen").toBe(
      true,
    );
    expect(
      nochDa.eintrag,
      "C-B11: nichts ist mehr eingegrenzt — ein Rücksetzweg zeigte auf nichts",
    ).toBe(false);
    await menueSchliessen("bib-menue-filter");
    expect(stand.seitenfehler).toEqual([]);
  }, 120_000);

  it("C-B12 · eine Sicht, die SELBST eingrenzt, lässt den Satz über die AUSWAHL stehen", async () => {
    // DIE GEGENRICHTUNG, und sie trägt die Beweislast von C-B10/C-B11 mit: ohne sie wären beide
    // auch dann grün, wenn die gebaute Fläche nach JEDER Bedienung stur den Bestandssatz zeigte.
    // Der Befund aus der Adresse ist auch hier gelöscht — aber die Sicht bringt ihre EIGENE
    // Eingrenzung mit (ein Suchwort), und die trägt den Satz über die Auswahl weiter.
    await ausgangslage("C-B12");
    await suchen("C-B12", SUCHWORT);
    await sichtSpeichern("C-B12", SICHT_EINGRENZEND);
    // Zurück auf die Ausgangslage: ohne Suchwort steht der Auswahlsatz allein wegen der verworfenen
    // Eingrenzung da. Das Suchfeld ist leer — die Sicht bringt ihr Wort gleich selbst mit.
    await sucheLeeren("C-B12", SUCHWORT);
    expect(await suchfeld(), "C-B12: das Suchfeld ist nicht leer").toBe("");
    await leersatzIst(
      "C-B12 · ohne Suchwort trägt die verworfene Eingrenzung den Satz",
      AUSWAHLSATZ(),
    );
    await sichtAnwenden("C-B12", SICHT_EINGRENZEND);
    await stand.seite.waitForFunction(
      fn(`(wort) => location.search.includes('q=' + wort)`),
      SUCHWORT,
      { timeout: 15_000 },
    );
    expect(
      await suchfeld(),
      "C-B12: die Sicht hat ihr Suchwort nicht mitgebracht — dann misst dieser Fall nichts",
    ).toBe(SUCHWORT);
    await leersatzIst(
      "C-B12 · eine eingrenzende Sicht darf den Bestandssatz nicht herbeiführen",
      AUSWAHLSATZ(),
    );
    expect(
      await ruecksetzwegAngeboten(),
      "C-B12: die Sicht grenzt ein — der Weg zurück gehört dazu",
    ).toBe(true);
    expect(stand.seitenfehler).toEqual([]);
  }, 120_000);

  // ==============================================================================================
  // KALIBRIERUNG · TRÄGT DIE SICHTBARKEITSMESSUNG? (Korrekturpflicht 1, BEN zu Runde 1)
  // ==============================================================================================
  // Runde 1 las den Leersatz nur als `textContent`. BEN hat den Absatz vor jeder Lesung ausgeblendet
  // und dessen Unsichtbarkeit nachgewiesen — C-B10/C-B11/C-B12 blieben alle drei grün. Dass die neue
  // Messung diese Lage RÖTET, wird hier nicht behauptet, sondern in derselben Bühne gefahren; die
  // Gegenprobe steht damit dauerhaft in der Datei und kann nicht beim nächsten Umbau verloren gehen.
  //
  // Zwei Verstellungen, einzeln und je zurückgenommen (BENs Promptverbesserung nennt genau diese):
  //   (a) AUSGEBLENDET — `display: none !important` auf dem Absatz.
  //   (b) ABGESCHNITTEN — ein Vorfahre lässt nichts mehr übrig (`overflow: hidden`, `height: 0`).
  //       Der Absatz ist dabei nach `checkVisibility()` weiterhin „gezeichnet"; es ist der
  //       Ausschnitt der Vorfahren, der die Wahrheit sagt. Genau deshalb wird er mitgemessen.
  //
  // In BEIDEN Lagen steht der richtige Wortlaut unverändert im DOM — das wird ausdrücklich
  // nachgewiesen. Sonst könnte man die Rötung für eine blosse Textänderung halten, und der Fall
  // bewiese nicht, dass die SICHTBARKEIT den Ausschlag gibt.
  it("KALIBRIERUNG · ein ausgeblendeter und ein abgeschnittener Leersatz röten die Prüfung, obwohl sein Wortlaut im DOM steht", async () => {
    await ausgangslage("KALIBRIERUNG");

    const ausgeblendet = await mitStil(
      '[data-testid="bib-leer"] p { display: none !important; }',
      async () => {
        const g = await leersatz();
        await expect(leersatzIst("KALIBRIERUNG (a) ausgeblendet", AUSWAHLSATZ())).rejects.toThrow(
          /Leersatz/,
        );
        return g;
      },
    );
    expect(
      ausgeblendet.text,
      "KALIBRIERUNG (a): der Wortlaut müsste im DOM unverändert dastehen — sonst rötet die Textänderung und nicht die Unsichtbarkeit",
    ).toBe(AUSWAHLSATZ());
    expect(ausgeblendet.zeilen, `KALIBRIERUNG (a): ${ausgeblendet.protokoll}`).toBe(0);
    expect(ausgeblendet.absatz.gezeichnet, `KALIBRIERUNG (a): ${ausgeblendet.protokoll}`).toBe(
      false,
    );

    await leersatzIst(
      "KALIBRIERUNG · nach (a) muss die Lage wiederhergestellt sein",
      AUSWAHLSATZ(),
    );

    const abgeschnitten = await mitStil(
      '[data-testid="bib-leer"] { overflow: hidden !important; height: 0 !important; padding: 0 !important; }',
      async () => {
        const g = await leersatz();
        await expect(leersatzIst("KALIBRIERUNG (b) abgeschnitten", AUSWAHLSATZ())).rejects.toThrow(
          /Leersatz/,
        );
        return g;
      },
    );
    expect(
      abgeschnitten.text,
      "KALIBRIERUNG (b): der Wortlaut müsste im DOM unverändert dastehen",
    ).toBe(AUSWAHLSATZ());
    expect(
      abgeschnitten.abgeschnitten,
      `KALIBRIERUNG (b): keine einzige Textzeile liegt ausserhalb des Ausschnitts — ${abgeschnitten.protokoll}`,
    ).toBeGreaterThan(0);

    await leersatzIst(
      "KALIBRIERUNG · nach (b) muss die Lage wiederhergestellt sein",
      AUSWAHLSATZ(),
    );
    console.info(`KALIBRIERUNG · (a) ${ausgeblendet.protokoll} · (b) ${abgeschnitten.protokoll}`);
    expect(stand.seitenfehler).toEqual([]);
  }, 120_000);
});
