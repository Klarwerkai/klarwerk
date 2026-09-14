// ================================================================================================
// JOB 3810 · DIE KI-PALETTE AUF DEM SCHMALSTEN GERÄT — 320 px, gemessen statt vermutet.
// ================================================================================================
//
// WARUM ES DIESE DATEI GIBT. Sie beantwortet eine BESTELLUNG, die wörtlich in der letzten Rückgabe
// von JOB 3769 steht (`jobs/3769/runde-2/RUECKGABE.md:49`):
//
//   „320 px sowie EN und NL bleiben ungemessen (§10). Aufgefallen, nicht gebaut: bei 320 px wird
//    der Deckel `max-w-[calc(100%-1.75rem)]` enger, der 48-Zeichen-Name braucht dort
//    voraussichtlich eine dritte Zeile."
//
// „Voraussichtlich" ist eine Vermutung. Hier steht ab sofort eine ZAHL: die Zeilen des langen
// Namens werden bei 320 px gemessen (A3), und zwar an den Zeilenkästen des Textes selbst, nicht
// gerechnet.
//
// DIE ANTWORT AUF DIE BESTELLUNG: DIE VERMUTUNG TRIFFT NICHT ZU. Der 48-Zeichen-Name braucht bei
// 320 px ZWEI Zeilen — genauso viele wie bei 390 px, keine dritte. Gemessen auf BEIDEN Ständen,
// die diese Datei bisher gesehen hat:
//   · Basis `97215f2`/`dd709a1` (Deckel `max-w-full`): Knopf 278×46 px auf 276 px Fläche, 2 Zeilen;
//     bei 390 px 304×46 px auf 302 px, 2 Zeilen.
//   · Kandidatenstand MIT JOB 3769 R2 (Deckel `max-w-[calc(100%-1.75rem)]`, der aus der Bestellung):
//     Knopf 250×46 px auf 248 px Fläche, 2 Zeilen (`jobs/3810/runde-1/tor-kandidat-rot.out`, Fall A3
//     grün). Der engere Deckel kostet 28 px Breite und KEINE dritte Zeile.
// Gepinnt wird deshalb nicht eine Zahl, sondern die ZUSAGE: der Name wird umgebrochen (mindestens
// zwei Zeilen), er wird nicht gekürzt, und bei 320 px braucht er nie weniger Zeilen als bei 390 px.
//
// ================================================================================================
// RUNDE 2 — WARUM DIESE DATEI IHRE TEILE JETZT ERHEBT STATT SIE ANZUNEHMEN.
// ================================================================================================
// Runde 1 war im Kandidatentor ROT, dreimal mit derselben Zeile:
//   „A1 · 320: der Hilfesatz zu „Übergabe kurz" steht nicht da: expected null not to be null".
// Nicht das Fenster und nicht die Geometrie waren schuld, sondern eine ANNAHME über die GESTALT der
// Vorlagenzeile: Runde 1 holte den Erklärsatz als `<p>` neben dem Vorlagenknopf. Genau das hat JOB
// 3769 R2 inzwischen umgebaut — der Satz steht nicht mehr dauerhaft da, er liegt hinter einem
// „?"-Griff (`AiAssistBox.tsx`, `data-testid="ki-vorlage-hilfe-<id>"`) und erscheint erst beim
// Aufschlagen. Eine Messung, die die Bauform ihres Messobjekts festnagelt, misst ab dem nächsten
// Umbau nichts mehr — sie wird rot, ohne dass am Fenster etwas falsch wäre.
//
// DESHALB ERHEBT DIESE DATEI IHRE TEILE AUS DEM DOM (`teile()` im Messer unten):
//   · der BLOCK einer Vorlage ist das Kind der Vorlagenfläche, in dem ihr Namensknopf liegt —
//     gefunden durch Aufsteigen, nicht durch eine Klasse,
//   · der NAME ist der Knopf mit genau diesem Text,
//   · jeder WEITERE Knopf im Block ist ein Bedienstück (heute der „?"-Griff; morgen vielleicht ein
//     anderer) und wird mitgemessen,
//   · jeder ABSATZ im Block ist ein Textstück und wird mitgemessen, wenn er da ist.
// Was die Fläche heute trägt, steht als `gestalt` in jeder Messzeile — die Datei sagt also, WELCHE
// Bauform sie vorgefunden hat, statt eine zu unterstellen. Fall E fasst den Erklärsatz dann so an,
// wie die Fläche ihn anbietet: er drückt, was im Block an zusätzlichen Knöpfen da ist, und verlangt
// DANACH einen lesbaren Erklärsatz. Das gilt für beide Bauformen ohne Verzweigung im Urteil.
//
// ================================================================================================
// RUNDE 3 — DIE KALIBRIERUNG G HAT DENSELBEN FEHLER NOCH EINMAL GEMACHT.
// ================================================================================================
// Runde 2 war im Tor ROT, an genau einer Zeile — und zwar in dem Fall, der den Fehler der Vorrunde
// beheben sollte:
//   „G · 320: vor dem Umbau trägt der Block keinen Absatz: expected +0 to be 1".
// Der MESSER von Runde 2 erhebt richtig; der PRÜFSTEIN G tat es nicht. Er verlangte als
// Ausgangslage die ALTE Bauform (ein Absatz im Block), weil sein Arbeitsbaum den Umbau aus JOB 3769
// R2 noch nicht trug — und war damit selbst wieder eine Datei, die die Bauform ihres Messobjekts
// festnagelt. Auf dem Prüfstand des Tors, der JOB 3769 R2 enthält, steht dort kein Absatz mehr,
// sondern der „?"-Griff: `saetze` ist 0, und G fiel über seine eigene Annahme.
//
// SEIT DIESER RUNDE NIMMT G KEINE AUSGANGSLAGE MEHR AN, SONDERN MISST SIE — und fährt dann BEIDE
// Bauformen nacheinander, egal welche ausgeliefert ist: von der vorgefundenen in die andere, von
// dort in die vorgefundene zurück (mit nachgestellten Teilen), und zum Schluss wieder auf den
// ausgelieferten Stand. Damit gibt es in G keinen Weg mehr, den ein Stand nicht fährt — die
// Richtung „zu-griff" war in Runde 2 auf dem Torstand toter Code, sie ist es nicht mehr.
//
// WAS BISHER GEMESSEN WAR, UND WAS NICHT. Die einzige Layoutmessung dieser Fläche fährt bei 390 px
// (`tests/ki-freie-anweisung/ki-palette-390px-chromium.test.ts`); ihr Kopf zählt „Breiten unter
// 390 px" ausdrücklich zum Ungemessenen. Unterhalb von 390 px hat diese Fläche niemand gefahren —
// obwohl der Kommentar am Deckel selbst von 320 px spricht (`erfassen/Menue.tsx`: „Ohne diesen
// Deckel liefe die 320-px-Liste bei 320 px Fensterbreite an BEIDEN Rändern über").
//
// WARUM 320×568 UND NICHT 360 ODER 375. 320 px ist die schmalste Breite, die das Haus zusagt, und
// der Deckel in `Menue.tsx` nennt genau sie. 568 px ist die zugehörige Höhe desselben Geräts
// (iPhone SE der ersten Bauart) — die schmalste UND niedrigste übliche Lage; 360 und 375 liegen
// dazwischen und sind damit die leichteren Fälle. Wer die schmalste Lage hält, hält sie auch.
//
// WAS DIESE DATEI AUSDRÜCKLICH NICHT BELEGT:
//   · EN und NL (die Textschlüssel der Palette stehen vollständig in allen drei Sprachen; eine
//     Sprachmessung wäre von Anfang an grün — Auftrag §10). Vollständige Schlüssel sind KEIN Beleg
//     für ein passendes Layout: längere Wörter können anders umbrechen. Das bleibt offen.
//   · die Drehung bei OFFENER Fläche (eigener Auftrag),
//   · Bildschirmleser und echte Geräte (hier läuft ein Chromium ohne Zeigegerät),
//   · jede Breite ZWISCHEN 320 und 390 px — gemessen sind genau diese zwei Punkte.
//
// AUFBAU: die H3-Bühne (`tests/design/h3-blatt-buehne.ts`) — die ECHTE gebaute Anwendung aus
// `apps/web/dist` in Chromium, jeder `/api/*`-Aufruf an die ECHTE Fastify-App. Diese Datei
// IMPORTIERT die Bühne, sie schreibt sie nicht ab. EIN Browser, EINE Seite für den ganzen Lauf; das
// Fenster stellt die Bühne schon beim Anfahren.
//
// DIE DREI GESTELLTEN VORLAGEN sind dieselben wie im 390-px-Vorbild — anders wäre der Vergleich
// zwischen beiden Breiten keiner. Sie werden über das `skript` der Bühne gestellt, weil es sie im
// leeren Bestand nicht gibt.
//
// DIE ZWEI LEHREN DES VORBILDS GELTEN HIER WORT FÜR WORT:
//   · WAAGERECHT ist eine HARTE Zusage: nichts läuft seitlich hinaus, nichts liegt hinter einem
//     Seitwärtsrollen. Seitwärts zu rollen ist auf einer Seite kein Weg, es ist der Mangel selbst.
//   · SENKRECHT heisst ERREICHBAR, nicht „gleichzeitig zu sehen": in einem 568 px hohen Fenster ist
//     die Palette höher als das Fenster, und senkrecht zu rollen ist der normale Weg dorthin.
//     Gemessen wird das GEFAHREN (`scrollIntoView`, dann nachgemessen), nicht gerechnet — und
//     zusätzlich, dass kein wegschneidender Vorfahre ein Stück unwiederbringlich hält.
// Eine Textprüfung allein hält senkrecht NICHTS: der Prüfer hat am Vorbild 155 px Text auf 1 px
// Fläche gestellt, und die Prüfung blieb grün. Deshalb wird hier Geometrie gemessen, und
// `toBeVisible` kommt nicht vor — es ist in jedem Browser wahr für ein Stück weit ausserhalb des
// Fensters.
//
// EINE ANNAHME DES AUFTRAGS IST BEIM LESEN GEFALLEN (§9, „zu BESTÄTIGEN"): die Palette holt die
// Vorlagen NICHT bei jedem Öffnen frisch. `useAssistPresets` ist eine react-query-Abfrage
// (`apps/web/src/api/hooks.ts`), und `main.tsx` stellt app-weit `staleTime: ZAEHLER_FRISCHE_MS`
// (30 000 ms) — es GIBT einen Zwischenspeicher, und die Lage „Cache mit gescheiterter Auffrischung"
// ist echt (das 390-px-Vorbild fährt sie in B5a). Für diese Datei ändert das nichts: sie öffnet die
// Palette nach einem `goto` mit frischem Client und wartet auf die gestellten Vorlagen.
//
// FÄLLE
// A0  die Bühne steht, das Fenster ist wirklich 320×568, die gestellten Vorlagen sind wirklich lang.
// A1  WAAGERECHT: Palette, Vorlagenliste und JEDES erhobene Bedienstück liegen zwischen 0 und 320.
// A2  SENKRECHT: jedes erhobene Stück ist durch Rollen GANZ zu erreichen (gefahren, nicht gerechnet).
// A3  DER LANGE NAME: Zeilen bei 320 px gegen Zeilen bei 390 px, vollständig lesbar, im Deckel.
// E   DIE ERKLÄRUNG: was der Block an Bedienung anbietet, wird gedrückt — danach MUSS ein lesbarer
//     Erklärsatz dastehen, waagerecht im Fenster und senkrecht erreichbar.
// G   KALIBRIERUNG der Erhebung: die Vorlagenzeile wird in der laufenden Seite in BEIDE Bauformen
//     umgebaut, die dieses Haus bisher ausgeliefert hat (Satz dauerhaft im Block · Satz hinter
//     einem Griff). Die Erhebung muss jede davon MELDEN, die waagerechte Prüfung in jeder grün
//     bleiben, und der Erklärsatz in jeder über die Bedienung zu holen sein, die der Block trägt.
// W   KALIBRIERUNG waagerecht: der Breitendeckel am langen Namen wird in der laufenden Seite
//     zurückgenommen — die waagerechte Prüfung MUSS rot werden, sonst misst A1/A3 nichts.
// K   KALIBRIERUNG senkrecht: ein nicht rollbarer und ein rollbarer, zu kleiner Deckel über dem
//     Ausführen-Knopf — beide MÜSSEN die Erreichbarkeitsmessung rot machen, sonst misst A2 nichts.
// P   die Seite hat während aller Messungen nichts geworfen.
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { type Buehne, ORIGIN, type Seite, buehneAufbauen, fn } from "../design/h3-blatt-buehne";

/** Das Fenster dieses Auftrags — die schmalste Lage, die das Haus zusagt. */
const BREITE = 320;
const HOEHE = 568;
/** Der Gegenhalt: dieselbe Palette in der bisher einzigen gemessenen Breite. */
const BREITE_VORBILD = 390;

// ---- Die drei gestellten Vorlagen ---------------------------------------------------------------
//
// Dieselben drei wie im 390-px-Vorbild. An einer kurzen Vorlage fiele weder ein Überlauf noch ein
// abgeschnittener Name auf; die zweite ist der Fall, den ein gewöhnlicher Umbruch NICHT auflösen
// kann (ein einzelnes Wort ohne Leerzeichen); die dritte trägt die lange ANWEISUNG, die als
// Erklärsatz zur Vorlage gehört und damit der längste Textblock der Palette ist.
const KURZ = { id: "v1", name: "Übergabe kurz", instruction: "Fasse die Übergabe in zwei Sätzen." };
/** Ein einzelnes Wort ohne Umbruchpunkt. Die Länge steht nicht als Zahl da, sie wird in A0 gemessen. */
const LANGER_NAME = "Instandhaltungsuebergabeprotokollzusammenfassung";
const LANG = { id: "v2", name: LANGER_NAME, instruction: "Fasse das Protokoll zusammen." };
const LANGE_ANWEISUNG =
  "Formuliere die Übergabe sachlich und höflich, ohne Fakten hinzuzufügen, ohne Zahlen zu ändern " +
  "und ohne Namen zu nennen; behalte die Reihenfolge der Schritte bei und nenne am Ende die noch " +
  "offenen Punkte in einem eigenen Satz.";
const LANGE = { id: "v3", name: "Übergabe ausführlich", instruction: LANGE_ANWEISUNG };
const VORLAGEN = [KURZ, LANG, LANGE];
const NAMEN = VORLAGEN.map((v) => v.name);

/** Die Wurzel, auf die jede Fahrt wartet — das gemountete Blatt. */
const BLATT = '[data-testid="blatt"]';
/** Der Text, der im Blatt steht — ohne ihn ist die KI-Palette gesperrt (`Blatt.tsx`). */
const INHALT = "Der Kunde hat den Router am Montag übernommen.";
const PFAD = `/erfassen/neu?text=${encodeURIComponent(INHALT)}`;

const SKRIPT = {
  "GET /api/reasoner/assist-presets": VORLAGEN,
  // Ohne nutzbares Modell graut die Palette aus (`AiAssistBox.tsx`), und ein ausgegrauter Knopf
  // misst eine andere Fläche als die, um die es geht.
  "GET /api/reasoner/status": {
    active: true,
    mode: "cloud",
    reachable: "active",
    tasks: { assist: true, structure: true },
  },
};

// ---- Die Erhebung der Teile ----------------------------------------------------------------------
//
// DIESES STÜCK JAVASCRIPT STEHT IN JEDEM GRIFF DIESER DATEI, damit Messen, Drücken und Warten
// DIESELBEN Teile meinen. Es nimmt keine Klasse und keinen Aufbau an:
//   · `wurzel`  — die Fläche, in der die Vorlagenblöcke und die Zeile mit der freien Eingabe liegen
//                 (gefunden über das Eingabefeld, nicht über eine Klasse),
//   · `block`   — das Kind dieser Wurzel, in dem ein bestimmter Namensknopf liegt,
//   · `teile()` — Block, Name, JEDER weitere Knopf im Block, JEDER Absatz im Block, die freie
//                 Eingabe und der Ausführen-Knopf, jeweils mit einem stabilen Schlüssel.
// Der Schlüssel ist die Anschrift zum Heranrollen (`heran`) und zum Drücken (Fall E).
const TEILE_JS = `
  const txt = (el) => (el.textContent || '').replace(/\\s+/g, ' ').trim();
  const palette = document.querySelector('[data-testid="blatt-menue-ki"]');
  const feld = palette ? palette.querySelector('input') : null;
  const eingabezeile = feld ? feld.parentElement : null;
  const wurzel = eingabezeile ? eingabezeile.parentElement : null;
  const ausfuehren = eingabezeile ? eingabezeile.querySelector('button') : null;
  const knoepfe = palette ? [...palette.querySelectorAll('button')] : [];
  const nameKnopf = (n) => knoepfe.find((x) => txt(x) === n) || null;
  const block = (el) => {
    let x = el;
    while (x && x.parentElement && x.parentElement !== wurzel) { x = x.parentElement; }
    return x && x.parentElement === wurzel ? x : null;
  };
  const weitereKnoepfe = (bl, kn) => [...bl.querySelectorAll('button')].filter((b) => b !== kn);
  const teile = (namen) => {
    const raus = [];
    for (let i = 0; i < namen.length; i++) {
      const n = namen[i];
      const kn = nameKnopf(n);
      const bl = kn ? block(kn) : null;
      if (bl) { raus.push({ s: 'block:' + i, w: 'der Vorlagenblock „' + n + '"', a: 'flaeche', el: bl }); }
      if (kn) { raus.push({ s: 'name:' + i, w: 'die Vorlage „' + n + '"', a: 'text', el: kn }); }
      if (bl && kn) {
        weitereKnoepfe(bl, kn).forEach((b, j) => raus.push({
          s: 'griff:' + i + ':' + j,
          w: 'der Griff „' + (b.getAttribute('aria-label') || txt(b) || b.getAttribute('data-testid') || '?') + '" der Vorlage „' + n + '"',
          a: 'text',
          el: b,
        }));
        [...bl.querySelectorAll('p')].forEach((p, j) => raus.push({
          s: 'satz:' + i + ':' + j,
          w: 'der Erklärsatz der Vorlage „' + n + '"',
          a: 'text',
          el: p,
        }));
      }
    }
    if (feld) { raus.push({ s: 'feld', w: 'die freie Eingabe', a: 'eingabe', el: feld }); }
    if (ausfuehren) { raus.push({ s: 'knopf', w: 'der Ausführen-Knopf', a: 'text', el: ausfuehren }); }
    return raus;
  };
`;

// ---- Der Messer ----------------------------------------------------------------------------------
//
// GEMESSEN WIRD GEOMETRIE, auf beiden Achsen, an jedem erhobenen Stück — dazu, was der Browser
// selbst über den Textknoten weiss (`scrollWidth`/`scrollHeight` gegen `clientWidth`/`clientHeight`,
// `white-space`, `text-overflow`, `overflow-wrap`) und was jeder wegschneidende Vorfahre dem Stück
// wirklich wegnimmt (`verluste`), in welche Richtung, und ob dieser Rand ROLLBAR ist.
//
// ROLLBAR HEISST: DER NUTZER KANN DORTHIN ROLLEN — also `overflow: auto` oder `scroll`, nicht
// `hidden`. `scrollHeight > clientHeight` gilt auch an einer Fläche mit `hidden`: dort rollt ein
// Skript (`scrollIntoView` tut es klaglos), ein Finger nicht. Diese Ränder stehen deshalb getrennt
// in `heimlich` — ohne sie hiesse „erreichbar" nur „ein Skript käme hin".
//
// `zeilen` ist die Zahl, die die Bestellung verlangt: nicht aus Kastenhöhe durch `line-height`
// gerechnet (bei `line-height: normal` gäbe es dafür gar keine Zahl), sondern an den Zeilenkästen
// des Textes abgelesen — ein `Range` über den Inhalt liefert je Textzeile ein eigenes Rechteck.
const MASSE = `(arg) => {
  const namen = arg.namen;
  const rd = (z) => Math.round(z * 10) / 10;
  ${TEILE_JS}
  const marke = (p) => p.getAttribute('data-testid') || (p.tagName + '.' + String(p.className || '').slice(0, 40));
  const rollbar = (wie, mehr) => (wie === 'auto' || wie === 'scroll') && mehr;
  const verluste = (el) => {
    const b = el.getBoundingClientRect();
    const raus = [];
    for (let p = el.parentElement; p; p = p.parentElement) {
      const s = getComputedStyle(p);
      const schneidetX = s.overflowX !== 'visible';
      const schneidetY = s.overflowY !== 'visible';
      if (!schneidetX && !schneidetY) { continue; }
      const pb = p.getBoundingClientRect();
      if (schneidetX) {
        const fehlt = Math.max(pb.left - b.left, b.right - pb.right);
        if (fehlt > 1) { raus.push({ marke: marke(p), richtung: 'waagerecht', px: rd(fehlt), rollbar: rollbar(s.overflowX, p.scrollWidth > p.clientWidth + 1), passt: b.width <= p.clientWidth + 1 }); }
      }
      if (schneidetY) {
        const fehlt = Math.max(pb.top - b.top, b.bottom - pb.bottom);
        if (fehlt > 1) { raus.push({ marke: marke(p), richtung: 'senkrecht', px: rd(fehlt), rollbar: rollbar(s.overflowY, p.scrollHeight > p.clientHeight + 1), passt: b.height <= p.clientHeight + 1 }); }
      }
    }
    return raus;
  };
  const heimlich = (el) => {
    const raus = [];
    for (let p = el.parentElement; p; p = p.parentElement) {
      const s = getComputedStyle(p);
      const zu = (wie) => wie !== 'visible' && wie !== 'auto' && wie !== 'scroll';
      if (zu(s.overflowY) && p.scrollHeight > p.clientHeight + 1) {
        raus.push({ marke: marke(p), richtung: 'senkrecht', px: rd(p.scrollHeight - p.clientHeight), rollbar: false });
      }
      if (zu(s.overflowX) && p.scrollWidth > p.clientWidth + 1) {
        raus.push({ marke: marke(p), richtung: 'waagerecht', px: rd(p.scrollWidth - p.clientWidth), rollbar: false });
      }
    }
    return raus;
  };
  const zeilen = (el) => {
    const r = document.createRange();
    r.selectNodeContents(el);
    const kaesten = [...r.getClientRects()].filter((k) => k.width > 0.5 && k.height > 0.5);
    const oben = [];
    for (const k of kaesten) {
      if (!oben.some((o) => Math.abs(o - k.top) < 2)) { oben.push(k.top); }
    }
    return { zahl: oben.length, kastenhoehe: kaesten.length ? rd(Math.max.apply(null, [...kaesten].map((k) => k.height))) : 0 };
  };
  const r = (el) => {
    const b = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    const z = zeilen(el);
    return {
      links: rd(b.left), rechts: rd(b.right), oben: rd(b.top), unten: rd(b.bottom),
      breite: rd(b.width), hoehe: rd(b.height),
      sichtbreite: el.clientWidth, textbreite: el.scrollWidth,
      sichthoehe: el.clientHeight, texthoehe: el.scrollHeight,
      umbruch: s.whiteSpace, kuerzung: s.textOverflow, wortbruch: s.overflowWrap,
      eigenrollen: s.overflowX + '/' + s.overflowY,
      deckel: s.maxWidth,
      schrift: s.fontSize + '/' + s.lineHeight,
      zeilen: z.zahl, zeilenkasten: z.kastenhoehe,
      verluste: verluste(el), heimlich: heimlich(el),
      text: txt(el).slice(0, 70),
    };
  };
  // Die nächste Fläche über dem Stück, die WEGSCHNEIDET statt überstehen zu lassen. Nur sie sagt,
  // ob ein zu breites Kind hinter einem Seitwärtsrollen verschwindet — das Rechteck des Kindes
  // meldet auch dann seine volle Breite, wenn davon nichts zu sehen ist.
  const rollflaeche = (el) => {
    for (let p = el ? el.parentElement : null; p; p = p.parentElement) {
      if (getComputedStyle(p).overflowX !== 'visible') {
        return { marke: marke(p), sichtbreite: p.clientWidth, textbreite: p.scrollWidth };
      }
    }
    return null;
  };
  if (arg.heran) {
    const gefunden = arg.heran === 'palette' ? palette : (teile(namen).find((t) => t.s === arg.heran) || {}).el;
    if (gefunden) { gefunden.scrollIntoView({ block: 'center', inline: 'nearest' }); }
  }
  const grund = {
    fenster: document.documentElement.clientWidth,
    fensterhoehe: document.documentElement.clientHeight,
    seitenbreite: document.documentElement.scrollWidth,
    seitenhoehe: document.documentElement.scrollHeight,
    rollstand: rd(window.scrollY),
    heran: arg.heran || null,
  };
  if (!palette) {
    return Object.assign(grund, { palette: null, liste: null, stuecke: [], rollflaechen: [], gestalt: [] });
  }
  const liste = (() => {
    const kanten = namen.map((n) => { const kn = nameKnopf(n); const bl = kn ? block(kn) : null; return bl ? bl.getBoundingClientRect() : null; }).filter((k) => k !== null);
    if (kanten.length === 0) { return null; }
    return {
      links: rd(Math.min.apply(null, kanten.map((k) => k.left))),
      rechts: rd(Math.max.apply(null, kanten.map((k) => k.right))),
      oben: rd(Math.min.apply(null, kanten.map((k) => k.top))),
      unten: rd(Math.max.apply(null, kanten.map((k) => k.bottom))),
      bloecke: kanten.length,
    };
  })();
  // DIE VORGEFUNDENE BAUFORM, nicht die unterstellte: wie viele Blöcke, wie viele zusätzliche
  // Knöpfe je Block (heute der „?"-Griff), wie viele Absätze je Block (heute zugeklappt keiner).
  const gestalt = namen.map((n) => {
    const kn = nameKnopf(n);
    const bl = kn ? block(kn) : null;
    return {
      name: n,
      block: bl ? marke(bl) : null,
      knoepfe: bl && kn ? weitereKnoepfe(bl, kn).length : 0,
      saetze: bl ? bl.querySelectorAll('p').length : 0,
    };
  });
  return Object.assign(grund, {
    palette: r(palette),
    liste: liste,
    stuecke: teile(namen).map((t) => Object.assign({ schluessel: t.s, was: t.w, art: t.a }, r(t.el))),
    rollflaechen: namen.map((n) => rollflaeche(nameKnopf(n))),
    gestalt: gestalt,
  });
}`;

/**
 * Fall E drückt, was der Block an Bedienung anbietet — und sagt, wie viel das war.
 *
 * Auf dem Stand mit „?"-Griff ist das ein Knopf; auf dem Stand davor ist es keiner (der Satz stand
 * schon da). Beides ist eine ehrliche Bedienung dieser Fläche: gedrückt wird, was da ist.
 */
const GRIFFE_DRUECKEN = `(arg) => {
  const namen = arg.namen;
  ${TEILE_JS}
  const kn = nameKnopf(namen[arg.i]);
  const bl = kn ? block(kn) : null;
  if (!bl || !kn) { return -1; }
  const weitere = weitereKnoepfe(bl, kn);
  for (const b of weitere) { b.click(); }
  return weitere.length;
}`;

/** Wie viele Absätze der Block dieser Vorlage gerade trägt. */
const SAETZE_IM_BLOCK = `(arg) => {
  const namen = arg.namen;
  ${TEILE_JS}
  const kn = nameKnopf(namen[arg.i]);
  const bl = kn ? block(kn) : null;
  return bl ? bl.querySelectorAll('p').length : 0;
}`;

/**
 * Fall G baut die Vorlagenzeile in der laufenden Seite UM — in beide Richtungen, und nur dafür.
 *
 * `zu-griff` nimmt den Absatz aus dem Block und setzt einen Knopf neben den Namen, der ihn auf- und
 * zuklappt: die Bauform SEIT JOB 3769 R2. `zu-satz` nimmt umgekehrt den ersten zusätzlichen Knopf
 * fort und hängt einen Absatz in den Block: die Bauform DAVOR, an der Runde 1 zerbrochen ist.
 *
 * Das ist KEINE Aussage über das Produkt und keine zweite Wahrheit — es ist der Prüfstein dafür,
 * dass die Erhebung eine solche Änderung TRÄGT, statt mit „steht nicht da" rot zu werden. Der
 * nachgestellte Absatz ist deshalb schmucklos: geprüft wird die ERHEBUNG, nicht das Aussehen des
 * Produkts. Sein Text ist die Anweisung der Vorlage, kein neuer.
 *
 * DIE RÜCKNAHME LIEGT AUF EINEM STAPEL, nicht in einer Einzelablage: G baut zweimal nacheinander um
 * (vorgefundene Bauform → andere → vorgefundene), und jede Rücknahme muss genau ihren Umbau treffen.
 * Gemerkt wird der ECHTE Knoten mit Elternfläche und Nachbar — zurückgestellt wird er dorthin, nicht
 * irgendwohin.
 */
const UMBAU = `(arg) => {
  const namen = arg.namen;
  ${TEILE_JS}
  const kn = nameKnopf(namen[arg.i]);
  const bl = kn ? block(kn) : null;
  if (!bl || !kn) { return 'KEIN BLOCK'; }
  const stapel = window.__g3810 || (window.__g3810 = []);
  if (arg.zurueck) {
    const m = stapel.pop() || null;
    if (!m) { return 'NICHTS VERSTELLT'; }
    const gestellt = bl.querySelector(m.art === 'zu-griff' ? '[data-g-griff]' : '[data-g-satz]');
    if (!gestellt) { return 'DAS NACHGESTELLTE STUECK IST FORT'; }
    gestellt.remove();
    m.eltern.insertBefore(m.knoten, m.danach);
    return 'ZURUECK';
  }
  if (arg.richtung === 'zu-griff') {
    const satz = bl.querySelector('p');
    if (!satz) { return 'KEIN SATZ'; }
    stapel.push({ art: 'zu-griff', knoten: satz, eltern: satz.parentElement, danach: satz.nextSibling });
    satz.remove();
    const g = document.createElement('button');
    g.type = 'button';
    g.setAttribute('aria-label', 'Hilfe öffnen · Kalibrierung G');
    g.setAttribute('data-g-griff', '1');
    g.textContent = '?';
    g.addEventListener('click', () => {
      if (bl.contains(satz)) { satz.remove(); } else { bl.appendChild(satz); }
    });
    kn.parentElement.insertBefore(g, kn.nextSibling);
    return 'UMGEBAUT';
  }
  const griff = weitereKnoepfe(bl, kn)[0] || null;
  if (!griff) { return 'KEIN GRIFF'; }
  stapel.push({ art: 'zu-satz', knoten: griff, eltern: griff.parentElement, danach: griff.nextSibling });
  griff.remove();
  const p = document.createElement('p');
  p.setAttribute('data-g-satz', '1');
  p.textContent = arg.text;
  bl.appendChild(p);
  return 'UMGEBAUT';
}`;

/** Was ein wegschneidender Vorfahre einem Stück wegnimmt — und ob es hervorzuholen ist. */
interface Verlust {
  marke: string;
  richtung: "waagerecht" | "senkrecht";
  px: number;
  rollbar: boolean;
  /** Ob das Stück in diese Fläche überhaupt hineinpasst — `false` heisst: in KEINEM Rollstand ganz. */
  passt?: boolean;
}

/** Was der Messer an EINEM Knoten misst — ohne Anschrift; die trägt erst `Stueck`. */
interface Rechteck {
  links: number;
  rechts: number;
  oben: number;
  unten: number;
  breite: number;
  hoehe: number;
  sichtbreite: number;
  textbreite: number;
  sichthoehe: number;
  texthoehe: number;
  umbruch: string;
  kuerzung: string;
  wortbruch: string;
  eigenrollen: string;
  deckel: string;
  schrift: string;
  /** Die abgelesene Zeilenzahl des Textes — die Zahl, die die Bestellung verlangt. */
  zeilen: number;
  zeilenkasten: number;
  verluste: Verlust[];
  /** Ränder über dem Stück, an die nur ein Skript rollen kann — für den Nutzer ist dort Schluss. */
  heimlich: Verlust[];
  text: string;
}

/** Ein erhobenes Stück der Fläche: sein Rechteck und seine Anschrift. */
interface Stueck extends Rechteck {
  /** Die Anschrift des Stückes — zum Heranrollen und zum Wiederfinden. */
  schluessel: string;
  /** Wie es in einer Fehlermeldung heissen soll. */
  was: string;
  /** `text` = sein Inhalt muss ganz lesbar sein · `flaeche`/`eingabe` = nur Lage und Ränder. */
  art: "text" | "flaeche" | "eingabe";
}

/** Die Aussenkante der Vorlagenliste — die Hülle ihrer Blöcke. */
interface Liste {
  links: number;
  rechts: number;
  oben: number;
  unten: number;
  bloecke: number;
}

/** Die wegschneidende Fläche über einem Stück — ihr `scrollWidth` verrät verborgenen Text. */
interface Rollflaeche {
  marke: string;
  sichtbreite: number;
  textbreite: number;
}

/** Die vorgefundene Bauform eines Vorlagenblocks — erhoben, nicht unterstellt. */
interface Gestalt {
  name: string;
  block: string | null;
  knoepfe: number;
  saetze: number;
}

interface Masse {
  fenster: number;
  fensterhoehe: number;
  seitenbreite: number;
  seitenhoehe: number;
  rollstand: number;
  heran: string | null;
  palette: Rechteck | null;
  liste: Liste | null;
  stuecke: Stueck[];
  rollflaechen: (Rollflaeche | null)[];
  gestalt: Gestalt[];
}

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

/** Fenster stellen und das Blatt MIT Inhalt fahren — über den echten Deep-Link des Produkts. */
async function blattFahren(breite: number): Promise<Seite> {
  const s = seite();
  await s.setViewportSize({ width: breite, height: HOEHE });
  await s.goto(`${ORIGIN}${PFAD}`, { waitUntil: "load", timeout: 60_000 });
  await s.waitForFunction(fn("(sel) => document.querySelector(sel) !== null"), BLATT, {
    timeout: 30_000,
  });
  return s;
}

/**
 * Auf die GESTELLTEN Vorlagen warten, bevor gemessen wird (Auftrag §9, Lage „laden").
 *
 * Die Palette steht sofort; die Vorlagen kommen aus einem Abruf. Kommen sie NICHT, läuft dieses
 * Warten in seine Frist und der Fall wird ROT mit genau dieser Meldung — still grün wird hier
 * nichts (Auftrag §9, Lage „erfolgreich leer").
 */
async function vorlagenAbwarten(): Promise<void> {
  await seite().waitForFunction(
    fn(
      `(n) => [...document.querySelectorAll('[data-testid="blatt-menue-ki"] button')].some((x) => (x.textContent || '').replace(/\\s+/g, ' ').trim() === n)`,
    ),
    LANGER_NAME,
    { timeout: 20_000 },
  );
}

/** Fenster stellen, Blatt mit Inhalt fahren, KI-Palette über den echten Knopf öffnen. */
async function paletteOeffnen(breite: number): Promise<void> {
  const s = await blattFahren(breite);
  // Der Klick geht auf den ECHTEN Knopf des Produkts; dass er im Fenster liegt, behauptet dieser
  // Griff nicht — das misst der Messer darunter mit `getBoundingClientRect`.
  await s.evaluate(
    fn(`() => { document.querySelector('[data-testid="blatt-werkzeug-ki"]').click(); }`),
  );
  await s.waitForFunction(
    fn(`() => document.querySelector('[data-testid="blatt-menue-ki"]') !== null`),
    undefined,
    { timeout: 20_000 },
  );
  await vorlagenAbwarten();
}

async function messen(lage: string, heran: string | null = null): Promise<Masse> {
  const m = await seite().evaluate<Masse>(fn(MASSE), { namen: NAMEN, heran });
  console.info(`JOB 3810 · ${lage} · ${JSON.stringify(m)}`);
  return m;
}

/** Ein erhobenes Stück an seiner Anschrift — fehlt es, ist das ein Fehlschlag, kein Überspringen. */
function stueck(m: Masse, schluessel: string, lage: string): Stueck {
  const gefunden = m.stuecke.find((x) => x.schluessel === schluessel) ?? null;
  expect(
    gefunden,
    `${lage}: das Stück „${schluessel}" wurde nicht erhoben — vorgefunden: ${m.stuecke
      .map((x) => x.schluessel)
      .join(", ")}`,
  ).not.toBeNull();
  return gefunden as Stueck;
}

/** Ein Stück trägt Fläche — auf beiden Achsen. */
function vorhanden(st: Stueck, lage: string): Stueck {
  expect(st.breite, `${lage}: ${st.was} ist nur ${st.breite} px breit`).toBeGreaterThan(0);
  expect(st.hoehe, `${lage}: ${st.was} ist nur ${st.hoehe} px hoch`).toBeGreaterThan(0);
  return st;
}

/**
 * Kein Rand hält einen Teil des Stückes UNWIEDERBRINGLICH.
 *
 * Rollbar weggeschnitten heisst verborgen (der Nutzer rollt hin); nicht rollbar weggeschnitten
 * heisst fort — kein Rollen der Welt bringt es zurück.
 */
function nichtFort(st: Stueck, lage: string): void {
  const fort = st.verluste.filter((v) => !v.rollbar);
  expect(
    fort,
    `${lage}: ${st.was} wird unwiederbringlich weggeschnitten — ${JSON.stringify(fort)} („${st.text}")`,
  ).toEqual([]);
}

/**
 * WAAGERECHT: das Stück liegt ganz zwischen 0 und der Fensterbreite, und nichts davon liegt hinter
 * einem Seitwärtsrollen.
 */
function waagerechtImFenster(st: Stueck, m: Masse, lage: string): Stueck {
  vorhanden(st, lage);
  expect(
    st.links,
    `${lage}: ${st.was} beginnt links ausserhalb (x=${st.links}, „${st.text}")`,
  ).toBeGreaterThanOrEqual(0);
  expect(
    st.rechts,
    `${lage}: ${st.was} endet rechts ausserhalb (x=${st.rechts} von ${m.fenster}, „${st.text}")`,
  ).toBeLessThanOrEqual(m.fenster);
  const seitwaerts = st.verluste.filter((v) => v.richtung === "waagerecht");
  expect(
    seitwaerts,
    `${lage}: ${st.was} liegt zum Teil hinter einem Seitwärtsrollen — ${JSON.stringify(seitwaerts)}`,
  ).toEqual([]);
  nichtFort(st, lage);
  return st;
}

/** Der TEXT steht ganz da — waagerecht UND senkrecht, und er wird nicht gekürzt. */
function ganzLesbar(st: Stueck, lage: string): void {
  const wie =
    `white-space=${st.umbruch}, text-overflow=${st.kuerzung}, overflow-wrap=${st.wortbruch}, ` +
    `overflow=${st.eigenrollen}, max-width=${st.deckel}, „${st.text}"`;
  expect(
    st.textbreite,
    `${lage}: ${st.was} ist waagerecht beschnitten (${st.textbreite} px Text auf ${st.sichtbreite} px Fläche, ${wie})`,
  ).toBeLessThanOrEqual(st.sichtbreite + 1);
  expect(
    st.texthoehe,
    `${lage}: ${st.was} ist senkrecht beschnitten (${st.texthoehe} px Text auf ${st.sichthoehe} px Fläche, ${wie})`,
  ).toBeLessThanOrEqual(st.sichthoehe + 1);
  expect(st.kuerzung, `${lage}: ${st.was} wird mit Auslassungspunkten gekürzt (${wie})`).not.toBe(
    "ellipsis",
  );
}

/** Die WAAGERECHTE Zusage dieses Auftrags in einem Satz — über ALLE erhobenen Stücke. */
function paletteWaagerecht(m: Masse, lage: string): void {
  expect(
    m.seitenbreite,
    `${lage}: die SEITE läuft waagerecht über (scrollWidth=${m.seitenbreite} auf clientWidth=${m.fenster})`,
  ).toBeLessThanOrEqual(m.fenster + 1);
  expect(m.palette, `${lage}: die Palette steht nicht da`).not.toBeNull();
  const p: Stueck = {
    ...(m.palette as Rechteck),
    schluessel: "palette",
    was: "die Palette",
    art: "flaeche",
  };
  waagerechtImFenster(p, m, lage);
  expect(
    p.textbreite,
    `${lage}: die Palette selbst läuft waagerecht über (${p.textbreite} px auf ${p.sichtbreite} px)`,
  ).toBeLessThanOrEqual(p.sichtbreite + 1);
  // Die LISTE als Ganzes, nicht nur ihre Knöpfe: die zweite Halbheit, vor der der Auftrag warnt.
  const l = m.liste;
  expect(l, `${lage}: die Vorlagenliste steht nicht da`).not.toBeNull();
  const liste = l as Liste;
  expect(liste.bloecke, `${lage}: die Vorlagenliste hat ${liste.bloecke} statt 3 Blöcke`).toBe(3);
  expect(
    liste.links,
    `${lage}: die Vorlagenliste beginnt links ausserhalb (x=${liste.links})`,
  ).toBeGreaterThanOrEqual(0);
  expect(
    liste.rechts,
    `${lage}: die Vorlagenliste endet rechts ausserhalb (x=${liste.rechts} von ${m.fenster})`,
  ).toBeLessThanOrEqual(m.fenster);
  // Und jedes Stück, das die Fläche HEUTE trägt — erhoben, nicht aufgezählt.
  expect(
    m.stuecke.length,
    `${lage}: es wurde fast nichts erhoben (${m.stuecke.length} Stücke) — dann misst dieser Fall nichts`,
  ).toBeGreaterThanOrEqual(8);
  for (const st of m.stuecke) {
    waagerechtImFenster(st, m, lage);
  }
  // UND DIE ZWEITE, UNABHÄNGIGE AUSSAGE ZUR SELBEN SACHE: die Fläche, die über jedem Vorlagenknopf
  // wegschneidet, verbirgt nichts. Das Rechteck des Knopfes meldet seine volle Breite auch dann,
  // wenn davon nichts zu sehen ist.
  for (const [i, name] of NAMEN.entries()) {
    const roll = m.rollflaechen[i] ?? null;
    expect(roll, `${lage}: über der Vorlage „${name}" schneidet nichts weg`).not.toBeNull();
    const rf = roll as Rollflaeche;
    expect(
      rf.textbreite,
      `${lage}: die Fläche „${rf.marke}" verbirgt „${name}" hinter dem Seitwärtsrollen ` +
        `(${rf.textbreite} px Inhalt auf ${rf.sichtbreite} px Sicht)`,
    ).toBeLessThanOrEqual(rf.sichtbreite + 1);
  }
}

/** JEDES Textstück der Palette steht ganz da — auf beiden Achsen. */
function paletteTexteLesbar(m: Masse, lage: string): void {
  const texte = m.stuecke.filter((st) => st.art === "text");
  expect(
    texte.length,
    `${lage}: kein einziges Textstück erhoben — dann misst dieser Fall nichts`,
  ).toBeGreaterThanOrEqual(4);
  for (const st of texte) {
    ganzLesbar(st, lage);
  }
}

/**
 * NACH der Bewegung: das Stück liegt GANZ in der Schnittfläche aus Fenster und allen Rändern.
 *
 * VOR dem Rollen darf ein rollbarer Rand wegschneiden — dorthin ist ja noch niemand gerollt
 * (`nichtFort`). NACH dem Rollen entschuldigt nichts mehr: wer hingerollt hat und immer noch nur
 * einen Streifen sieht, kommt nicht weiter. `passt:false` trennt dabei die zwei Gründe — die Fläche
 * ist zu klein für das Stück, oder sie steht nur falsch.
 */
function ganzInDerSchnittflaeche(st: Stueck, lage: string): void {
  const zuKlein = st.verluste.filter((v) => v.passt === false);
  expect(
    zuKlein,
    `${lage}: ${st.was} ist höher/breiter als die Fläche, die es zeigen soll — in KEINEM Rollstand ` +
      `ganz zu sehen: ${JSON.stringify(zuKlein)} (Stück ${st.breite}×${st.hoehe} px, „${st.text}")`,
  ).toEqual([]);
  expect(
    st.verluste,
    `${lage}: ${st.was} bleibt NACH dem Heranrollen weggeschnitten — ${JSON.stringify(st.verluste)} („${st.text}")`,
  ).toEqual([]);
}

/**
 * Die SENKRECHTE Zusage, und sie heisst ERREICHBAR: das Stück wird herangerollt und DANACH
 * nachgemessen. Erst dann muss es ganz zwischen 0 und der Fensterhöhe liegen, und kein Rand darf es
 * halten — auch kein rollbarer, und erst recht keiner, an den nur ein Skript rollt.
 */
async function senkrechtErreichbar(schluessel: string, lage: string): Promise<Stueck> {
  const m = await messen(`${lage} · herangerollt ${schluessel}`, schluessel);
  const s = vorhanden(stueck(m, schluessel, lage), lage);
  ganzInDerSchnittflaeche(s, lage);
  expect(
    s.heimlich,
    `${lage}: ${s.was} liegt hinter einem Rand, an den nur ein Skript rollen kann — ${JSON.stringify(s.heimlich)}`,
  ).toEqual([]);
  expect(
    s.oben,
    `${lage}: ${s.was} bleibt nach dem Heranrollen oben draussen (y=${s.oben}, Rollstand ${m.rollstand}, „${s.text}")`,
  ).toBeGreaterThanOrEqual(0);
  expect(
    s.unten,
    `${lage}: ${s.was} bleibt nach dem Heranrollen unten draussen (y=${s.unten} von ${m.fensterhoehe}, ` +
      `Rollstand ${m.rollstand}, „${s.text}")`,
  ).toBeLessThanOrEqual(m.fensterhoehe);
  return s;
}

// KEIN `describe.runIf`: fehlt `apps/web/dist` oder startet Chromium nicht, wird dieser Lauf ROT und
// nennt den Ausfall wörtlich (er steht in `Buehne.fehler`). Ein übersprungener Prüfstand ist grün
// und belegt nichts.
describe("JOB 3810 · die KI-Palette bei 320 px im echten Chromium", () => {
  beforeAll(async () => {
    // Die Bühne fährt SCHON schmal an — kein Umstellen nach dem Aufbau, also auch keine erste
    // Zeichnung in einem Fenster, das niemand misst.
    b = await buehneAufbauen(PFAD, BLATT, SKRIPT, { width: BREITE, height: HOEHE });
  }, 180_000);

  afterAll(async () => {
    await b?.schliessen();
  }, 60_000);

  it("A0 · die Bühne steht, das Fenster ist 320×568, und die gestellten Vorlagen sind wirklich lang", async () => {
    const stand = b as Buehne;
    expect(stand.fehler, `Bühne nicht aufgebaut: ${stand.fehler}`).toBeNull();
    // Ohne diese Zahlen misst der ganze Lauf eine kurze Vorlage und nennt sie lang.
    expect(LANGER_NAME.length, "der lange Name ist zu kurz").toBeGreaterThanOrEqual(40);
    expect(LANGER_NAME.includes(" "), "der lange Name hat einen Umbruchpunkt").toBe(false);
    expect(LANGE_ANWEISUNG.length, "die lange Anweisung ist zu kurz").toBeGreaterThanOrEqual(200);
    await paletteOeffnen(BREITE);
    const m = await messen("A0 · Fenster");
    console.info(
      `JOB 3810 · Chromium ${stand.version} · Theme ${stand.theme} · Name ${LANGER_NAME.length} Zeichen · ` +
        `Anweisung ${LANGE_ANWEISUNG.length} Zeichen · Fenster ${m.fenster}×${m.fensterhoehe} · ` +
        `vorgefundene Bauform ${JSON.stringify(m.gestalt)}`,
    );
    // Gemessen, nicht angenommen: eine Messung im falschen Fenster wäre der ganze Auftrag umsonst.
    expect(m.fenster, `das Fenster ist ${m.fenster} px breit statt ${BREITE}`).toBe(BREITE);
    expect(m.fensterhoehe, `das Fenster ist ${m.fensterhoehe} px hoch statt ${HOEHE}`).toBe(HOEHE);
    // Die drei gestellten Vorlagen sind da, jede mit Block und Namensknopf.
    expect(m.gestalt.length, "es fehlen gestellte Vorlagen").toBe(3);
    for (const [i, g] of m.gestalt.entries()) {
      expect(g.block, `der Block der Vorlage „${g.name}" wurde nicht gefunden`).not.toBeNull();
      stueck(m, `name:${i}`, "A0");
    }
  }, 120_000);

  it("A1 · 320 px: nichts der geöffneten Palette läuft seitlich hinaus, und jeder Text steht ganz da", async () => {
    await paletteOeffnen(BREITE);
    const lage = `A1 · ${BREITE}`;
    const m = await messen(lage);
    const feld = stueck(m, "feld", lage);
    const knopf = stueck(m, "knopf", lage);
    console.info(
      `JOB 3810 · ${lage} · Palette x=${m.palette?.links}–${m.palette?.rechts} (${m.palette?.breite} px, max-width=${m.palette?.deckel}) · ` +
        `Liste x=${m.liste?.links}–${m.liste?.rechts} · Eingabe x=${feld.links}–${feld.rechts} · ` +
        `Knopf x=${knopf.links}–${knopf.rechts} · Seite scrollWidth=${m.seitenbreite} auf ${m.fenster} · ` +
        `erhoben: ${m.stuecke.map((s) => s.schluessel).join(", ")}`,
    );
    paletteWaagerecht(m, lage);
    paletteTexteLesbar(m, lage);
  }, 120_000);

  it("A2 · 320 px: jedes Bedienstück ist durch senkrechtes Rollen GANZ zu erreichen", async () => {
    await paletteOeffnen(BREITE);
    const lage = `A2 · ${BREITE}`;
    const vorher = await messen(lage);
    // Erst die ehrliche Bestandsaufnahme: was steht schon im Fenster, was nicht. Eine Zusage
    // „alles ohne Rollen sichtbar" wird hier ausdrücklich NICHT aufgestellt.
    const draussen = vorher.stuecke
      .filter((st) => st.oben < 0 || st.unten > vorher.fensterhoehe)
      .map((st) => `${st.was} (y=${st.oben}–${st.unten})`);
    console.info(
      `JOB 3810 · ${lage} · Fenster ${vorher.fenster}×${vorher.fensterhoehe} · Seite ${vorher.seitenhoehe} px hoch · ` +
        `Palette ${vorher.palette?.hoehe} px hoch, y=${vorher.palette?.oben}–${vorher.palette?.unten} · ` +
        `ohne Rollen NICHT im Fenster: ${draussen.length === 0 ? "nichts" : draussen.join(" · ")}`,
    );
    for (const st of vorher.stuecke) {
      await senkrechtErreichbar(st.schluessel, lage);
    }
  }, 180_000);

  // ==============================================================================================
  // A3 · DER LANGE NAME — DIE BESTELLTE VERMUTUNG, ALS URTEIL.
  // ==============================================================================================
  //
  // Die Bestellung (`jobs/3769/runde-2/RUECKGABE.md:49`) sagt: der 48-Zeichen-Name „braucht dort
  // voraussichtlich eine dritte Zeile". Gemessen werden deshalb DREI Dinge und nicht eines:
  //   (a) die Zeilenzahl bei 320 px, abgelesen an den Zeilenkästen des Textes,
  //   (b) dieselbe Zahl bei 390 px in derselben Seite — ohne den Gegenhalt sagt eine Zahl allein
  //       nicht, ob die schmale Lage überhaupt etwas geändert hat,
  //   (c) ob der Name dabei vollständig lesbar bleibt (kein `ellipsis`, nichts beschnitten) und im
  //       Deckel seiner Fläche bleibt.
  // Die Zusage des Hauses lautet „umgebrochen statt abgeschnitten" — ein Name, der bei 320 px in
  // EINER Zeile stünde, wäre entweder nicht der lange Name oder ein gekürzter. Deshalb hängt dieser
  // Fall am Umbruch: mit einem kurzen Namen an seiner Stelle wird er rot (Gegenprobe 2 des
  // Auftrags; gemessen: „der lange Name steht in 1 Zeile(n) … expected 1 to be greater than or
  // equal to 2"). Gepinnt ist die Zusage, nicht eine Zahl: die Zahlen beider Stände stehen im Kopf
  // dieser Datei und wandern mit dem Produkt, die Zusage nicht.
  it("A3 · 320 px: der 48-Zeichen-Name wird UMGEBROCHEN statt abgeschnitten — mit Zahl", async () => {
    await paletteOeffnen(BREITE);
    const lage = `A3 · ${BREITE}`;
    const m = await messen(lage);
    const langer = waagerechtImFenster(stueck(m, "name:1", lage), m, lage);
    expect(langer.text, `${lage}: der lange Name steht gar nicht da`).toBe(LANGER_NAME);
    ganzLesbar(langer, lage);
    // (c) DER DECKEL HÄLT. Der Breitendeckel am Knopf deckelt ihn auf die Breite seiner Fläche; die
    // Fläche selbst deckelt `Menue.tsx` auf `min(340px, 100vw-1rem)`. Beide zusammen sind die Zusage.
    const flaeche = m.palette as Rechteck;
    expect(
      langer.rechts,
      `${lage}: der lange Name sprengt die Palette (Knopf rechts=${langer.rechts}, Palette rechts=${flaeche.rechts})`,
    ).toBeLessThanOrEqual(flaeche.rechts);
    // (a) DIE ZAHL.
    const zeilen320 = langer.zeilen;
    expect(
      zeilen320,
      `${lage}: der lange Name steht in ${zeilen320} Zeile(n) — er wird also nicht umgebrochen, ` +
        `sondern passt in eine Zeile oder ist gekürzt (Knopf ${langer.breite}×${langer.hoehe} px, ` +
        `Zeilenkasten ${langer.zeilenkasten} px, ${langer.schrift})`,
    ).toBeGreaterThanOrEqual(2);

    // (b) DERSELBE NAME BEI 390 PX, in derselben Seite und demselben Browser.
    await paletteOeffnen(BREITE_VORBILD);
    const vorbild = await messen(`A3 · ${BREITE_VORBILD} (Gegenhalt)`);
    const langerVorbild = vorhanden(
      stueck(vorbild, "name:1", `A3 · ${BREITE_VORBILD}`),
      `A3 · ${BREITE_VORBILD}`,
    );
    const zeilen390 = langerVorbild.zeilen;
    console.info(
      `JOB 3810 · A3 · DER LANGE NAME: ${BREITE} px → ${zeilen320} Zeilen ` +
        `(Knopf ${langer.breite}×${langer.hoehe} px, Fläche ${langer.sichtbreite} px, Deckel ${langer.deckel}, Zeilenkasten ${langer.zeilenkasten} px) · ` +
        `${BREITE_VORBILD} px → ${zeilen390} Zeilen ` +
        `(Knopf ${langerVorbild.breite}×${langerVorbild.hoehe} px, Fläche ${langerVorbild.sichtbreite} px)`,
    );
    // Ein schmaleres Fenster kann für denselben Text nicht WENIGER Zeilen brauchen. Bricht diese
    // Aussage, misst eine der beiden Lagen nicht, was sie zu messen vorgibt.
    expect(
      zeilen320,
      `${lage}: bei ${BREITE} px braucht der Name ${zeilen320} Zeilen, bei ${BREITE_VORBILD} px ${zeilen390} — das kann nicht sein`,
    ).toBeGreaterThanOrEqual(zeilen390);
    // Und das Fenster geht auf seinen Auftragswert zurück, damit der nächste Fall dort misst.
    await paletteOeffnen(BREITE);
  }, 180_000);

  // ==============================================================================================
  // E · DIE ERKLÄRUNG ZUR VORLAGE — bedient, wie die Fläche sie anbietet.
  // ==============================================================================================
  //
  // Der Erklärsatz ist der längste Textblock dieser Fläche (über 200 Zeichen bei der dritten
  // Vorlage) und damit der härteste Fall für 320 px. WIE er zu haben ist, unterscheidet die
  // Stände: bis JOB 3769 R2 stand er dauerhaft unter dem Namen, seither liegt er hinter einem
  // „?"-Griff. Dieser Fall nimmt darauf keine Rücksicht und stellt keine Bauform fest: er DRÜCKT,
  // was der Block an zusätzlichen Knöpfen trägt (null oder einen), und verlangt danach einen
  // Erklärsatz, der ganz lesbar, waagerecht im Fenster und senkrecht erreichbar ist.
  //
  // JE BLOCK EINZELN, und das ist keine Bequemlichkeit: das Produkt lässt seit JOB 3769 R2 nur EINE
  // Erklärung gleichzeitig offen (`offeneErklaerung`). Wer alle drei Griffe nacheinander drückt,
  // hat am Ende genau einen offenen Satz — eine Prüfung „in jedem Block steht jetzt einer" wäre
  // deshalb falsch. Nach der Messung wird derselbe Griff wieder gedrückt, damit der nächste Block
  // in derselben Lage beginnt wie dieser.
  it("E · 320 px: die Erklärung jeder Vorlage ist zu bedienen und danach ganz zu lesen", async () => {
    await paletteOeffnen(BREITE);
    const s = seite();
    const lage = `E · ${BREITE}`;
    for (const [i, name] of NAMEN.entries()) {
      const vorher = await s.evaluate<number>(fn(SAETZE_IM_BLOCK), { namen: NAMEN, i });
      const gedrueckt = await s.evaluate<number>(fn(GRIFFE_DRUECKEN), { namen: NAMEN, i });
      expect(
        gedrueckt,
        `${lage}: der Block der Vorlage „${name}" war nicht zu finden`,
      ).toBeGreaterThanOrEqual(0);
      // Gewartet wird auf den Satz, nicht auf eine Zeitspanne.
      await s.waitForFunction(fn(SAETZE_IM_BLOCK), { namen: NAMEN, i }, { timeout: 20_000 });
      const m = await messen(`${lage} · „${name}" aufgeschlagen`);
      const satz = stueck(m, `satz:${i}:0`, lage);
      console.info(
        `JOB 3810 · ${lage} · „${name}": vorher ${vorher} Absatz/Absätze, ${gedrueckt} Knopf/Knöpfe gedrückt, ` +
          `danach Satz ${satz.breite}×${satz.hoehe} px, ${satz.zeilen} Zeilen, y=${satz.oben}–${satz.unten}, „${satz.text}"`,
      );
      expect(
        satz.text.length,
        `${lage}: der Erklärsatz der Vorlage „${name}" ist leer`,
      ).toBeGreaterThan(20);
      waagerechtImFenster(satz, m, lage);
      ganzLesbar(satz, lage);
      await senkrechtErreichbar(`satz:${i}:0`, lage);
      // Zurück in die Ausgangslage — gedrückt wird dasselbe, was aufgeschlagen hat.
      await s.evaluate(fn(GRIFFE_DRUECKEN), { namen: NAMEN, i });
      const nachher = await s.evaluate<number>(fn(SAETZE_IM_BLOCK), { namen: NAMEN, i });
      expect(
        nachher,
        `${lage}: nach dem Zurückdrücken steht der Block der Vorlage „${name}" nicht wieder so da wie vorher ` +
          `(${nachher} statt ${vorher} Absätze)`,
      ).toBe(vorher);
    }
  }, 180_000);

  // ==============================================================================================
  // G · DIE KALIBRIERUNG DER ERHEBUNG — der Bruch, an dem Runde 1 UND Runde 2 gescheitert sind.
  // ==============================================================================================
  //
  // Runde 1 war im Kandidatentor dreimal rot mit „der Hilfesatz zu „Übergabe kurz" steht nicht da:
  // expected null not to be null" — nicht weil die Fläche etwas falsch machte, sondern weil JOB
  // 3769 R2 die Vorlagenzeile umgebaut hatte: der Erklärsatz liegt seither hinter einem „?"-Griff.
  // Runde 2 baute daraufhin diesen Fall — und machte denselben Fehler ein zweites Mal, nur eine
  // Ebene höher: sie VERLANGTE als Ausgangslage einen Absatz im Block („G · 320: vor dem Umbau
  // trägt der Block keinen Absatz: expected +0 to be 1") und fiel im Tor über ihre eigene Annahme.
  //
  // DESHALB NIMMT DIESER FALL KEINE AUSGANGSLAGE MEHR AN, SONDERN MISST SIE, und fährt von dort aus
  // BEIDE Bauformen, die dieses Haus bisher ausgeliefert hat:
  //   Schritt 1: von der vorgefundenen Bauform in die andere,
  //   Schritt 2: von dort zurück in die Art der vorgefundenen — mit nachgestellten Teilen,
  //   danach zwei Rücknahmen, bis die Fläche wieder so dasteht, wie sie ausgeliefert ist.
  // Damit gibt es keine Richtung mehr, die ein Stand nicht fährt: auf dem Stand MIT JOB 3769 R2
  // läuft „zu-satz" zuerst, auf dem davor „zu-griff" — beide laufen immer.
  //
  // VERLANGT WIRD IN JEDEM SCHRITT DREIERLEI:
  //   1. die Erhebung MELDET die neue Bauform (`gestalt`) und erhebt genau die Stücke, die es jetzt
  //      gibt — einen Knopf mehr und einen Absatz weniger, oder umgekehrt;
  //   2. die waagerechte Prüfung bleibt GRÜN und wird nicht rot, nur weil sich die Bauform ändert —
  //      genau hier ist Runde 1 gestorben;
  //   3. derselbe Weg, den Fall E benutzt (drücken, was der Block trägt), holt den Erklärsatz, und
  //      er ist danach messbar.
  // Das ist KEINE Aussage über das Produkt: am Ende steht die Fläche wieder auf ihrem ausgelieferten
  // Stand, gemessen und nicht behauptet.
  it("G · 320 px: wird die Vorlagenzeile umgebaut, misst die Erhebung weiter — sie zählt nicht auf", async () => {
    await paletteOeffnen(BREITE);
    const s = seite();
    const lage = `G · ${BREITE}`;
    const i = 0;
    // Der Text des nachgestellten Absatzes ist die Anweisung DIESER Vorlage (i = 0), kein neuer.
    const ERSATZTEXT = KURZ.instruction;
    const vorher = await messen(`${lage} · vor dem Umbau`);
    const ausgeliefert = vorher.gestalt[i] as Gestalt | undefined;
    expect(
      ausgeliefert,
      `${lage}: der Block der ersten Vorlage wurde nicht erhoben`,
    ).not.toBeUndefined();
    const g0 = ausgeliefert as Gestalt;
    // WELCHE BAUFORM AUSGELIEFERT IST, WIRD GEMESSEN. Beide Wege müssen offen sein: trägt der Block
    // weder einen Absatz noch einen Knopf, ist die Erklärung auf KEINEM Weg zu haben — das wäre ein
    // Befund über das Produkt und kein Grund, hier still weiterzumessen.
    expect(
      g0.saetze > 0 || g0.knoepfe > 0,
      `${lage}: der Block der ersten Vorlage bietet weder Absatz noch Griff (${JSON.stringify(g0)})`,
    ).toBe(true);
    const schritte = g0.saetze > 0 ? ["zu-griff", "zu-satz"] : ["zu-satz", "zu-griff"];
    console.info(
      `JOB 3810 · ${lage} · ausgelieferte Bauform ${JSON.stringify(g0)} · Umbauten ${schritte.join(" → ")}`,
    );

    // Was vor jedem Umbau dastand — die Rücknahme wird dagegen geprüft, nicht gegen eine Erwartung.
    const staende: Gestalt[] = [g0];
    for (const richtung of schritte) {
      const vor = staende[staende.length - 1] as Gestalt;
      const stufe = `${lage} · ${richtung}`;
      expect(
        await s.evaluate<string>(fn(UMBAU), {
          namen: NAMEN,
          i,
          richtung,
          zurueck: false,
          text: ERSATZTEXT,
        }),
        `${stufe}: der Umbau ging nicht`,
      ).toBe("UMGEBAUT");
      // 1. DIE ERHEBUNG MELDET DIE NEUE BAUFORM.
      const um = await messen(stufe);
      const g1 = um.gestalt[i] as Gestalt;
      console.info(`JOB 3810 · ${stufe} · Bauform nach dem Umbau ${JSON.stringify(um.gestalt)}`);
      expect(
        g1.knoepfe,
        `${stufe}: die Zahl der Knöpfe im Block stimmt nicht (${JSON.stringify(g1)}, vorher ${JSON.stringify(vor)})`,
      ).toBe(richtung === "zu-griff" ? vor.knoepfe + 1 : vor.knoepfe - 1);
      expect(
        g1.saetze,
        `${stufe}: die Zahl der Absätze im Block stimmt nicht (${JSON.stringify(g1)}, vorher ${JSON.stringify(vor)})`,
      ).toBe(richtung === "zu-griff" ? vor.saetze - 1 : vor.saetze + 1);
      // Und die ERHOBENEN Stücke sind genau die, die es jetzt gibt — nicht die, die dastehen sollen.
      const griffe = um.stuecke.filter((x) => x.schluessel.startsWith(`griff:${i}:`));
      const saetze = um.stuecke.filter((x) => x.schluessel.startsWith(`satz:${i}:`));
      expect(
        griffe.length,
        `${stufe}: erhoben sind ${griffe.length} Griffe, im Block stehen ${g1.knoepfe}`,
      ).toBe(g1.knoepfe);
      expect(
        saetze.length,
        `${stufe}: erhoben sind ${saetze.length} Absätze, im Block stehen ${g1.saetze}`,
      ).toBe(g1.saetze);
      if (richtung === "zu-griff") {
        const neu = griffe.find((x) => x.was.includes("Kalibrierung G")) ?? null;
        expect(
          neu,
          `${stufe}: der nachgestellte Griff wurde nicht als eigenes Stück erhoben (erhoben: ${griffe
            .map((x) => x.was)
            .join(" · ")})`,
        ).not.toBeNull();
        expect(
          (neu as Stueck).text,
          `${stufe}: der erhobene Griff trägt nicht den erwarteten Text`,
        ).toBe("?");
      } else {
        const neu = saetze.find((x) => x.text === ERSATZTEXT) ?? null;
        expect(
          neu,
          `${stufe}: der nachgestellte Absatz wurde nicht als eigenes Stück erhoben (erhoben: ${saetze
            .map((x) => x.text)
            .join(" · ")})`,
        ).not.toBeNull();
      }
      // 2. UND DIE WAAGERECHTE PRÜFUNG BLEIBT GRÜN — genau hier ist Runde 1 gestorben.
      paletteWaagerecht(um, stufe);
      paletteTexteLesbar(um, stufe);
      // 3. DERSELBE WEG WIE IN FALL E HOLT DEN ERKLÄRSATZ: gedrückt wird, was der Block trägt (in
      // der Griff-Bauform einer, in der Absatz-Bauform keiner — der Satz steht dort schon).
      const gedrueckt = await s.evaluate<number>(fn(GRIFFE_DRUECKEN), { namen: NAMEN, i });
      expect(
        gedrueckt,
        `${stufe}: gedrückt wurde nicht, was der Block trägt (${gedrueckt} von ${g1.knoepfe})`,
      ).toBe(g1.knoepfe);
      await s.waitForFunction(fn(SAETZE_IM_BLOCK), { namen: NAMEN, i }, { timeout: 20_000 });
      const auf = await messen(`${stufe} · aufgeschlagen`);
      const satz = stueck(auf, `satz:${i}:0`, stufe);
      expect(satz.text.length, `${stufe}: der Erklärsatz ist leer`).toBeGreaterThan(20);
      waagerechtImFenster(satz, auf, stufe);
      ganzLesbar(satz, stufe);
      // Und wieder zu — gedrückt wird dasselbe, was aufgeschlagen hat (in der Absatz-Bauform ist
      // das nichts). Damit beginnt der nächste Schritt in genau der Bauform, die dieser gebaut hat.
      await s.evaluate(fn(GRIFFE_DRUECKEN), { namen: NAMEN, i });
      const zu = await messen(`${stufe} · wieder zugeklappt`);
      expect(
        zu.gestalt[i]?.saetze,
        `${stufe}: nach dem Zurückdrücken steht der Block nicht wieder so da wie nach dem Umbau ` +
          `(${JSON.stringify(zu.gestalt[i])} statt ${JSON.stringify(g1)})`,
      ).toBe(g1.saetze);
      staende.push(g1);
    }

    // Zwei Umbauten, zwei Rücknahmen — jede gegen den Stand, der vor ihr dastand.
    for (let k = schritte.length - 1; k >= 0; k--) {
      expect(
        await s.evaluate<string>(fn(UMBAU), { namen: NAMEN, i, zurueck: true }),
        `${lage}: die Rücknahme von „${schritte[k]}" ging nicht`,
      ).toBe("ZURUECK");
    }
    const zurueck = await messen(`${lage} · nach Rücknahme`);
    console.info(
      `JOB 3810 · ${lage} · Bauform nach Rücknahme ${JSON.stringify(zurueck.gestalt[i])} · ` +
        `ausgeliefert ${JSON.stringify(g0)}`,
    );
    expect(
      zurueck.gestalt[i]?.knoepfe,
      `${lage}: die Zahl der Knöpfe steht nicht wieder auf dem ausgelieferten Stand`,
    ).toBe(g0.knoepfe);
    expect(
      zurueck.gestalt[i]?.saetze,
      `${lage}: die Zahl der Absätze steht nicht wieder auf dem ausgelieferten Stand`,
    ).toBe(g0.saetze);
    expect(
      zurueck.stuecke.filter((x) => x.schluessel.startsWith(`griff:${i}:`)).length,
      `${lage}: ein nachgestellter Griff steht noch da`,
    ).toBe(g0.knoepfe);
    paletteWaagerecht(zurueck, `${lage} · nach Rücknahme`);
    paletteTexteLesbar(zurueck, `${lage} · nach Rücknahme`);
  }, 240_000);

  // ==============================================================================================
  // W · DIE KALIBRIERUNG DER WAAGERECHTEN ACHSE — ohne sie misst A1/A3 nichts.
  // ==============================================================================================
  //
  // Zurückgenommen wird in der LAUFENDEN Seite genau das, was den langen Namen hält: sein
  // Breitendeckel (`max-width`) und `overflow-wrap: break-word`. Beides zusammen ist die Reparatur
  // aus JOB 3584; beides zusammen wird hier weggenommen, und nichts sonst. Wird die Messung dann
  // rot, hält A1 wirklich etwas; bleibt sie grün, misst A1 nichts.
  //
  // DIESER FALL ERSETZT KEINE DER BEIDEN GEGENPROBEN DES AUFTRAGS — er macht sie dauerhaft: die
  // Gegenprobe am Produkt (`Menue.tsx`, Deckel auf 560 px, neu gebaut) ist einmal gefahren und in
  // der Rückgabe belegt; sie kann nicht im Bestand bleiben, weil sie das Produkt verstellt. Dieser
  // Griff bleibt.
  it("W · 320 px: wird der Breitendeckel am langen Namen zurückgenommen, IST die Messung rot", async () => {
    await paletteOeffnen(BREITE);
    const s = seite();
    const GRIFF = `(arg) => {
      const namen = arg.namen;
      ${TEILE_JS}
      const kn = nameKnopf(namen[1]);
      if (!kn) { return 'KEIN KNOPF'; }
      if (arg.alt === null) {
        const gesichert = kn.getAttribute('style') || '';
        kn.style.maxWidth = 'none';
        kn.style.overflowWrap = 'normal';
        return gesichert;
      }
      if (arg.alt) { kn.setAttribute('style', arg.alt); } else { kn.removeAttribute('style'); }
      return 'ZURUECK';
    }`;
    const gesichert = await s.evaluate<string>(fn(GRIFF), { namen: NAMEN, alt: null });
    expect(gesichert, "W: der lange Vorlagenknopf war nicht zu finden").not.toBe("KEIN KNOPF");
    const ohne = await messen("W · ohne Breitendeckel");
    const langer = stueck(ohne, "name:1", "W");
    const roll = ohne.rollflaechen[1] ?? null;
    // Genau die zwei Aussagen, die A1/A3 verlangen — mindestens eine MUSS jetzt verletzt sein: der
    // Knopf steht aus dem Fenster, oder sein Name liegt hinter dem Seitwärtsrollen seiner Fläche.
    expect(
      langer.rechts > ohne.fenster || (roll !== null && roll.textbreite > roll.sichtbreite + 1),
      `W: ohne den Deckel bliebe alles im Fenster und alles lesbar (Knopf rechts=${langer.rechts} von ${ohne.fenster}, ` +
        `Rollfläche ${roll?.textbreite} px auf ${roll?.sichtbreite} px) — dann misst A1 nichts`,
    ).toBe(true);
    // Und dieselbe Prüffunktion, die A1 fährt, IST an diesem Zustand rot — nicht nur die Zahlen.
    expect(
      () => paletteWaagerecht(ohne, "W · ohne Breitendeckel"),
      "W: die Prüfung von A1 bleibt ohne den Deckel grün — dann misst A1 nichts",
    ).toThrow();
    // Zurückgesetzt, damit der nächste Fall auf dem echten Produktzustand misst.
    expect(await s.evaluate<string>(fn(GRIFF), { namen: NAMEN, alt: gesichert })).toBe("ZURUECK");
    const zurueck = await messen("W · nach Rücknahme");
    paletteWaagerecht(zurueck, "W · nach Rücknahme");
    paletteTexteLesbar(zurueck, "W · nach Rücknahme");
  }, 180_000);

  // ==============================================================================================
  // K · DIE KALIBRIERUNG DER SENKRECHTEN ACHSE — sonst hiesse „erreichbar" nur „`scrollIntoView`
  // wurde gerufen".
  // ==============================================================================================
  //
  // A2 sagt: jedes Bedienstück ist durch senkrechtes Rollen GANZ hereinzuholen. Diese Zusage ist nur
  // etwas wert, wenn sie an einem Stück BRICHT, das ein Rand festhält — in den zwei Arten, an denen
  // das 390-px-Vorbild seine eigenen Lücken gefunden hat:
  //   (a) NICHT ROLLBAR: ein Deckel mit `overflow: hidden` auf der rollbaren Fläche der Palette.
  //       `scrollIntoView` rollt solche Flächen klaglos — ein Finger und ein Mausrad nicht.
  //   (b) ROLLBAR, ABER ZU KLEIN: dieselbe Fläche auf 20 px, `overflow` bleibt `auto`. Wer
  //       hingerollt hat und trotzdem nur einen Streifen sieht, kommt nicht weiter.
  // Der Griff sucht die Fläche an ihrem `overflow` und MARKIERT sie; die Rücknahme greift die Marke,
  // nicht noch einmal die Suche — sonst fände sie den verstellten Stand nicht wieder.
  it("K · 320 px: hält ein Deckel den Ausführen-Knopf, IST die Erreichbarkeit rot — beide Arten", async () => {
    await paletteOeffnen(BREITE);
    const s = seite();
    const DECKEL = `([hoehe, wie, alt]) => {
      if (hoehe === null) {
        const g = document.querySelector('[data-k-deckel]');
        if (!g) { return 'KEIN DECKEL'; }
        if (alt) { g.setAttribute('style', alt); } else { g.removeAttribute('style'); }
        g.removeAttribute('data-k-deckel');
        return 'ZURUECK';
      }
      const p = document.querySelector('[data-testid="blatt-menue-ki"]');
      const feld = p ? p.querySelector('input') : null;
      if (!feld) { return 'KEIN FELD'; }
      let roll = null;
      for (let x = feld.parentElement; x && p.contains(x); x = x.parentElement) {
        const art = getComputedStyle(x).overflowY;
        if (art === 'auto' || art === 'scroll') { roll = x; break; }
      }
      if (!roll) { return 'KEINE ROLLFLAECHE'; }
      const gesichert = roll.getAttribute('style') || '';
      roll.setAttribute('data-k-deckel', '1');
      roll.style.height = hoehe; roll.style.maxHeight = hoehe; roll.style.overflow = wie;
      return gesichert;
    }`;
    const ZUSTAND = `() => { const g = document.querySelector('[data-k-deckel]'); return g ? { wie: getComputedStyle(g).overflowY, sicht: g.clientHeight, inhalt: g.scrollHeight } : null; }`;

    // (a) NICHT ROLLBAR.
    const vorherA = await s.evaluate<string>(fn(DECKEL), ["60px", "hidden", null]);
    expect(
      ["KEIN FELD", "KEINE ROLLFLAECHE"],
      "K: die rollbare Fläche der Palette war nicht zu finden — der Griff greift ins Leere",
    ).not.toContain(vorherA);
    console.info(`JOB 3810 · K(a) · Rollfläche ${JSON.stringify(await s.evaluate(fn(ZUSTAND)))}`);
    await expect(
      senkrechtErreichbar("knopf", "K(a)"),
      "K(a): der Ausführen-Knopf gilt unter einem NICHT rollbaren Deckel als erreichbar — dann misst A2 nichts",
    ).rejects.toThrow();
    expect(await s.evaluate<string>(fn(DECKEL), [null, null, vorherA])).toBe("ZURUECK");
    await senkrechtErreichbar("knopf", "K(a) · nach Rücknahme");

    // (b) ROLLBAR, ABER ZU KLEIN. Erst gemessen, dass die Fläche wirklich noch rollt — sonst
    // kalibrierte dieser Teil bloss ein zweites Mal (a).
    const vorherB = await s.evaluate<string>(fn(DECKEL), ["20px", "auto", null]);
    expect(
      ["KEIN FELD", "KEINE ROLLFLAECHE"],
      "K(b): die rollbare Fläche der Palette war nicht zu finden",
    ).not.toContain(vorherB);
    const zustand = await s.evaluate<{ wie: string; sicht: number; inhalt: number } | null>(
      fn(ZUSTAND),
    );
    console.info(`JOB 3810 · K(b) · Rollfläche ${JSON.stringify(zustand)}`);
    const z = zustand as { wie: string; sicht: number; inhalt: number };
    expect(["auto", "scroll"], "K(b): die gedeckelte Fläche ist nicht mehr rollbar").toContain(
      z.wie,
    );
    expect(
      z.inhalt,
      `K(b): die gedeckelte Fläche hat nichts zu verbergen (${z.inhalt} px Inhalt auf ${z.sicht} px Sicht)`,
    ).toBeGreaterThan(z.sicht + 1);
    await expect(
      senkrechtErreichbar("knopf", "K(b)"),
      "K(b): der Ausführen-Knopf gilt in einer 20 px hohen Rollfläche als erreichbar — dann misst A2 nichts",
    ).rejects.toThrow();
    expect(await s.evaluate<string>(fn(DECKEL), [null, null, vorherB])).toBe("ZURUECK");

    // Und am echten Produktzustand hält A2 wieder — der Fall hat die Seite nicht zerstört.
    const m = await messen("K · nach Rücknahme");
    for (const st of m.stuecke) {
      await senkrechtErreichbar(st.schluessel, "K · nach Rücknahme");
    }
  }, 180_000);

  it("P · die Seite hat während aller Messungen nichts geworfen", () => {
    expect(buehne().seitenfehler).toEqual([]);
  });
});
