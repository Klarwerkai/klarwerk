// ================================================================================================
// JOB 3584 · DIE KI-PALETTE AM HANDY — 390 px, Tab/Enter, lange Vorlagen, im ECHTEN Chromium.
// ================================================================================================
//
// WARUM ES DIESE DATEI GIBT. Die Zusage „wer am Handy die KI-Palette öffnet, sieht Vorlagen, freie
// Anweisung und Ausführen-Knopf vollständig im Fenster und erreicht sie mit Tab und Enter" war bis
// heute eine ANNAHME: jeder Nachweis dieser Fläche läuft in jsdom
// (`standardeditor-mounted.test.tsx:1`, `vorlagen-fehler-mounted.test.tsx:1`), und jsdom hat kein
// Layout — dort ist jedes Rechteck null, nichts bricht um und nichts wird gekürzt. Die Lehre steht
// im Haus schon geschrieben (`tests/d1-meine-entwuerfe/zugang-schmal-chromium.test.ts:18-21`), und
// zweimal wurde dieser Fall ausdrücklich liegen gelassen (`archiv/3566/runde-1/ben.md:33` NICHT
// GEPRÜFT; `archiv/3566/runde-2/RUECKGABE.md:47` „bleibt offen und gehört in eine eigene Zeile").
//
// AUFBAU: die H3-Bühne (`tests/design/h3-blatt-buehne.ts`) — die ECHTE gebaute Anwendung aus
// `apps/web/dist` in Chromium, jeder `/api/*`-Aufruf an die ECHTE Fastify-App. Diese Datei SCHREIBT
// den Prüfstand NICHT ab, sie importiert ihn; das Fenster und die Tastatur gehören seit diesem
// Auftrag in die Bühne (`h3-blatt-buehne.ts`, `export interface Seite`), nicht hierher. EIN Browser,
// EINE Seite für den ganzen Lauf.
//
// GESTELLT SIND GENAU ZWEI ANTWORTEN, beide über den vorgesehenen Weg der Bühne (`skript`):
//   · `GET /api/reasoner/assist-presets` — drei Vorlagen, die es im leeren Bestand nicht gibt:
//     eine kurze, eine mit einem 48 Zeichen langen Wort ohne Umbruchpunkt, eine mit einer
//     Anweisung über 200 Zeichen. Ohne sie misst niemand, was ein langer Name mit der Fläche macht.
//   · `GET /api/reasoner/status` — ein nutzbares Modell. Gemessen bleibt, was der echte Client
//     daraus macht.
//
// RUNDE 2 — WAS DER PRÜFER AN RUNDE 1 ZERLEGT HAT, UND WAS DARAUS FOLGT.
// Runde 1 hat NUR die waagerechte Achse gemessen (links/rechts/`scrollWidth`) und daraus
// „vollständig im Fenster" behauptet. Der Prüfer hat beides widerlegt, mit eigenen Zahlen:
//   (i)  bei 390×844 liegen die freie Eingabe (y=848,75–884,75) und der Ausführen-Knopf
//        (y=849–884,5) UNTERHALB des Fensters. Die Behauptung war also falsch.
//   (ii) er hat den langen Hilfesatz auf `height:1px; overflow:hidden` gestellt — 155 px Text auf
//        1 px Fläche — und B1/B2 blieben GRÜN. Die Textprüfung hielt senkrecht nichts.
// Daraus folgen zwei Dinge, die diese Datei jetzt trennt und getrennt belegt:
//   · WAAGERECHT ist eine harte Zusage: nichts läuft seitlich hinaus, nichts liegt hinter einem
//     Seitwärtsrollen. Seitwärts zu rollen ist auf einer Seite kein Weg, es ist ein Mangel.
//   · SENKRECHT ist die Zusage „ERREICHBAR", nicht „gleichzeitig zu sehen": die Palette ist am
//     Handy höher als das Fenster, und die Seite senkrecht zu rollen ist der normale Weg dorthin.
//     Gemessen wird das nicht gerechnet, sondern GEFAHREN (`scrollIntoView`, dann nachgemessen) —
//     und zusätzlich, dass KEIN wegschneidender Vorfahre ein Stück unwiederbringlich hält.
// Was diese Datei ausdrücklich NICHT belegt: dass am Handy alles OHNE Rollen gleichzeitig zu sehen
// ist. Das ist bei 390×844 gemessen NICHT der Fall (die Zahlen stehen in der Rückgabe), und es zu
// ändern hiesse, an der Hilfeform oder an der Menüsetzung (`Menue.tsx`) zu bauen — beides liegt
// ausserhalb der Zielpfade dieses Auftrags und ist dort als REST benannt.
//
// FÄLLE
// B1  Maus, 390 px: Palette offen, kein waagerechter Überlauf; jedes Stück senkrecht ERREICHBAR.
// B2  der lange Name und die lange Anweisung: LAGE und TEXT, waagerecht UND senkrecht (JOB 3266 R2).
// B3  nur Tastatur: vom Werkzeug über Tab/Enter bis zum ausgelösten Lauf über eine VORLAGE.
// B4  nur Tastatur, freie Anweisung: gemessen wird der ausgehende `POST /api/reasoner`-Rumpf.
// B5a Cache + gescheiterte Auffrischung, schmal: die Vorlagen BLEIBEN, der Satz kommt darunter dazu.
// B5b gescheiterter Vorlagenabruf ganz, schmal: der Satz steht da, ist lesbar und verdrängt nichts.
// K1  KALIBRIERUNG waagerecht: `max-w-full break-words` zurückgenommen → die Messung MUSS rot werden.
// K2  KALIBRIERUNG senkrecht/Text: der Hilfesatz auf 1 px gedeckelt → die Messung MUSS rot werden.
//     (Genau die Gegenprobe, an der Runde 1 grün geblieben ist.)
// K3  KALIBRIERUNG Erreichbarkeit: ein NICHT rollbarer Deckel über der Palette → die Messung MUSS
//     rot werden. Ohne ihn hiesse „erreichbar" nur „scrollIntoView wurde gerufen".
// K4  KALIBRIERUNG rollbare Beschneidung: eine weiterhin ROLLBARE, aber zu kleine Fläche über dem
//     Stück → Erreichbarkeitsmesser UND Fokusmesser MÜSSEN rot werden. Genau die Gegenprobe, an der
//     RUNDE 2 grün geblieben ist (Korrekturpflicht 1).
// P   die Seite hat während aller Messungen nichts geworfen.
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { type Buehne, ORIGIN, type Seite, buehneAufbauen, fn } from "../design/h3-blatt-buehne";

// ---- Die drei gestellten Vorlagen ---------------------------------------------------------------
//
// An einer kurzen Vorlage fiele weder ein Überlauf noch ein abgeschnittener Name auf. Die zweite
// ist der Fall, den ein gewöhnlicher Umbruch NICHT auflösen kann: ein einzelnes Wort ohne
// Leerzeichen (48 Zeichen) — nur `overflow-wrap: break-word` bricht darin, alles andere schiebt es
// über den Rand. Die dritte trägt die lange ANWEISUNG: sie steht als Hilfesatz unter dem Knopf
// (`AiAssistBox.tsx:207-209`) und ist damit der längste Textblock der Palette.
const KURZ = { id: "v1", name: "Übergabe kurz", instruction: "Fasse die Übergabe in zwei Sätzen." };
/** Ein einzelnes Wort ohne Umbruchpunkt. Die Länge steht nicht als Zahl da, sie wird in B0 gemessen. */
const LANGER_NAME = "Instandhaltungsuebergabeprotokollzusammenfassung";
const LANG = {
  id: "v2",
  name: LANGER_NAME,
  instruction: "Fasse das Protokoll zusammen.",
};
const LANGE_ANWEISUNG =
  "Formuliere die Übergabe sachlich und höflich, ohne Fakten hinzuzufügen, ohne Zahlen zu ändern " +
  "und ohne Namen zu nennen; behalte die Reihenfolge der Schritte bei und nenne am Ende die noch " +
  "offenen Punkte in einem eigenen Satz.";
const LANGE = { id: "v3", name: "Übergabe ausführlich", instruction: LANGE_ANWEISUNG };
const VORLAGEN = [KURZ, LANG, LANGE];
const NAMEN = VORLAGEN.map((v) => v.name);

/** Die Wurzel, auf die jede Fahrt wartet — das gemountete Blatt. */
const BLATT = '[data-testid="blatt"]';

/** Der Text, der im Blatt steht — ohne ihn ist die KI-Palette gesperrt (`Blatt.tsx:1273`). */
const INHALT = "Der Kunde hat den Router am Montag übernommen.";
const PFAD = `/erfassen/neu?text=${encodeURIComponent(INHALT)}`;

const SKRIPT = {
  "GET /api/reasoner/assist-presets": VORLAGEN,
  // Ohne nutzbares Modell graut die Palette in ihrem zweiten Aufrufer (`AiAssistBox`) aus, und ein
  // ausgegrauter Knopf nimmt keinen Tabstopp an — der Tastaturfall misst dann nichts.
  "GET /api/reasoner/status": {
    active: true,
    mode: "cloud",
    reachable: "active",
    tasks: { assist: true, structure: true },
  },
};

// ---- Der Messer ----------------------------------------------------------------------------------
//
// GEMESSEN WIRD LAGE UND TEXT, an jedem Stück der Palette. Die Lage allein genügt nicht: JOB 3266
// ist in Runde 2 genau daran gescheitert (`zugang-schmal-chromium.test.ts:12-14` — das Kästchen saß
// richtig, der Inhalt passte nicht hinein). Deshalb steht neben `left`/`right` immer auch, was der
// Browser selbst über den Textknoten weiss: `scrollWidth` gegen `clientWidth` heisst „es steht mehr
// da, als zu sehen ist", und `white-space`/`text-overflow`/`overflow-wrap` benennen die Ursache.
// RUNDE 2: derselbe Messer, jetzt auf BEIDEN Achsen. Neu sind `oben`/`unten`/`hoehe`,
// `sichthoehe`/`texthoehe` (senkrechte Beschneidung im Stück selbst — das war die 1-px-Lücke) und
// `verluste`: was jeder wegschneidende Vorfahre diesem Stück wirklich wegnimmt, in welche Richtung,
// und ob dieser Rand ROLLBAR ist. Rollbar heisst verborgen und wieder hervorzuholen; nicht rollbar
// heisst fort. Nur diese Unterscheidung trennt „muss gescrollt werden" von „ist nicht zu erreichen".
//
// UND ROLLBAR HEISST: DER NUTZER KANN DORTHIN ROLLEN. Also `overflow: auto` oder `scroll`, nicht
// `hidden`. Der Unterschied ist gemessen, nicht gemeint: `scrollHeight > clientHeight` allein gilt
// auch an einer Fläche mit `overflow: hidden` — dort kann ein Skript rollen (`scrollIntoView` tut es
// klaglos), ein Finger und ein Rad können es nicht. Mit der laxen Fassung hielt K3 einen 60-px-Deckel
// mit `overflow:hidden` für erreichbar und blieb grün; genau das wäre wieder ein Scheinbeleg.
//
// RUNDE 3 — WANN „ROLLBAR" ALS ENTSCHULDIGUNG GILT UND WANN NICHT (Korrekturpflicht 1 des Prüfers).
// Runde 2 hat jeden rollbar weggeschnittenen Rand ENTSCHULDIGT, auch NACH dem Heranrollen und nach
// dem Fokussieren. Der Prüfer hat die Lücke vorgeführt: er hat die vorhandene Rollfläche der Palette
// (`Menue.tsx:346`, `max-h-[420px] … overflow-auto`) auf `height:1px … overflow:auto` gestellt — die
// Fläche blieb rollbar, zeigte vom 155 px hohen Hilfesatz aber einen 1-px-Streifen — und die Messung
// blieb GRÜN, wörtlich: „B1a und B1b grün trotz {"hoehe":155.3,…,"verluste":[{…"px":77.5,
// "rollbar":true}]}". Die Trennlinie liegt deshalb nicht am Rand, sondern am ZEITPUNKT:
//   · VOR dem Rollen darf rollbar weggeschnitten sein — es ist ja noch nicht hingerollt (`nichtFort`).
//   · NACH dem Rollen bzw. nach dem Fokussieren gilt kein Rand mehr als Entschuldigung: das Stück
//     muss GANZ in der Schnittfläche aus Fenster und ALLEN wegschneidenden Vorfahren liegen
//     (`ganzInDerSchnittflaeche`, `fokusLage`). Wer hingerollt hat und immer noch nur einen Streifen
//     sieht, kommt nicht weiter — ob der Rand rollbar heisst, ändert daran nichts.
// `passt` sagt dabei, WELCHER der beiden Mängel es ist: `passt:false` heisst, die Fläche ist kleiner
// als das Stück und kann es in KEINEM Rollstand ganz zeigen; `passt:true` heisst, sie könnte, tut es
// aber an dieser Stelle nicht. Beides ist rot, beides steht mit dieser Unterscheidung in der Meldung.
const MASSE = `(arg) => {
  const namen = arg.namen;
  const rd = (z) => Math.round(z * 10) / 10;
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
      const marke = p.getAttribute('data-testid') || (p.tagName + '.' + String(p.className || '').slice(0, 40));
      if (schneidetX) {
        const fehlt = Math.max(pb.left - b.left, b.right - pb.right);
        if (fehlt > 1) { raus.push({ marke: marke, richtung: 'waagerecht', px: rd(fehlt), rollbar: rollbar(s.overflowX, p.scrollWidth > p.clientWidth + 1), passt: b.width <= p.clientWidth + 1 }); }
      }
      if (schneidetY) {
        const fehlt = Math.max(pb.top - b.top, b.bottom - pb.bottom);
        if (fehlt > 1) { raus.push({ marke: marke, richtung: 'senkrecht', px: rd(fehlt), rollbar: rollbar(s.overflowY, p.scrollHeight > p.clientHeight + 1), passt: b.height <= p.clientHeight + 1 }); }
      }
    }
    return raus;
  };
  // Ränder, an die NUR EIN SKRIPT rollen kann: overflow hidden (oder clip) mit mehr Inhalt, als
  // hineinpasst. GEMESSEN, nicht vermutet: scrollIntoView rollt solche Flächen klaglos — der Griff
  // K3 hat es vorgeführt, der Knopf kam unter einem 60-px-Deckel mit overflow hidden ins Bild
  // (Kasten y=252-312, Knopf y=270-305,5). Ein Finger und ein Mausrad tun das NICHT. Ohne diese
  // Liste hiesse „erreichbar" also „ein Skript käme hin", und das ist keine Zusage an Nutzer.
  const heimlich = (el) => {
    const raus = [];
    for (let p = el.parentElement; p; p = p.parentElement) {
      const s = getComputedStyle(p);
      const marke = p.getAttribute('data-testid') || (p.tagName + '.' + String(p.className || '').slice(0, 40));
      const zu = (wie) => wie !== 'visible' && wie !== 'auto' && wie !== 'scroll';
      if (zu(s.overflowY) && p.scrollHeight > p.clientHeight + 1) {
        raus.push({ marke: marke, richtung: 'senkrecht', px: rd(p.scrollHeight - p.clientHeight), rollbar: false });
      }
      if (zu(s.overflowX) && p.scrollWidth > p.clientWidth + 1) {
        raus.push({ marke: marke, richtung: 'waagerecht', px: rd(p.scrollWidth - p.clientWidth), rollbar: false });
      }
    }
    return raus;
  };
  const r = (el) => {
    const b = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    return {
      links: rd(b.left),
      rechts: rd(b.right),
      oben: rd(b.top),
      unten: rd(b.bottom),
      breite: rd(b.width),
      hoehe: rd(b.height),
      sichtbreite: el.clientWidth,
      textbreite: el.scrollWidth,
      sichthoehe: el.clientHeight,
      texthoehe: el.scrollHeight,
      umbruch: s.whiteSpace,
      kuerzung: s.textOverflow,
      wortbruch: s.overflowWrap,
      eigenrollen: s.overflowX + '/' + s.overflowY,
      verluste: verluste(el),
      heimlich: heimlich(el),
      text: (el.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 70),
    };
  };
  const palette = document.querySelector('[data-testid="blatt-menue-ki"]');
  const knoepfe = palette ? [...palette.querySelectorAll('button')] : [];
  const treffer = (n) => knoepfe.find((x) => (x.textContent || '').replace(/\\s+/g, ' ').trim() === n) || null;
  const hilfe = (n) => { const b = treffer(n); return b && b.parentElement ? b.parentElement.querySelector('p') : null; };
  const feld = palette ? palette.querySelector('input') : null;
  const knopf = feld && feld.parentElement ? feld.parentElement.querySelector('button') : null;
  const satz = palette ? palette.querySelector('[data-testid="ki-vorlagen-fehler"]') : null;
  // Die nächste Fläche über dem Stück, die WEGSCHNEIDET statt überstehen zu lassen. Nur sie sagt,
  // ob ein zu breites Kind hinter einem Seitwärtsrollen verschwindet — das Rechteck des Kindes
  // meldet auch dann seine volle Breite, wenn davon nichts zu sehen ist.
  const rollflaeche = (el) => {
    for (let p = el ? el.parentElement : null; p; p = p.parentElement) {
      if (getComputedStyle(p).overflowX !== 'visible') {
        return {
          marke: p.getAttribute('data-testid') || String(p.className || '').slice(0, 50),
          sichtbreite: p.clientWidth,
          textbreite: p.scrollWidth,
        };
      }
    }
    return null;
  };
  // HERANROLLEN, wenn verlangt: die Zusage „durch senkrechtes Rollen GANZ zu erreichen" wird
  // GEFAHREN, nicht gerechnet. Alle Zahlen unten entstehen danach, aus derselben Seite.
  if (arg.heran) {
    const ziel = arg.heran === 'palette' ? palette
      : arg.heran === 'feld' ? feld
      : arg.heran === 'knopf' ? knopf
      : arg.heran === 'satz' ? satz
      : arg.heran.indexOf('vorlage:') === 0 ? treffer(namen[Number(arg.heran.slice(8))])
      : arg.heran.indexOf('hilfe:') === 0 ? hilfe(namen[Number(arg.heran.slice(6))])
      : null;
    if (ziel) { ziel.scrollIntoView({ block: 'center', inline: 'nearest' }); }
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
    return Object.assign(grund, { palette: null, vorlagen: [], hilfesaetze: [], rollflaechen: [], feld: null, knopf: null, satz: null });
  }
  return Object.assign(grund, {
    rollflaechen: namen.map((n) => rollflaeche(treffer(n))),
    palette: r(palette),
    vorlagen: namen.map((n) => { const b = treffer(n); return b ? r(b) : null; }),
    hilfesaetze: namen.map((n) => { const p = hilfe(n); return p ? r(p) : null; }),
    feld: feld ? r(feld) : null,
    knopf: knopf ? r(knopf) : null,
    satz: satz ? r(satz) : null,
  });
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

interface Stueck {
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
  verluste: Verlust[];
  /** Ränder über dem Stück, an die nur ein Skript rollen kann — für den Nutzer ist dort Schluss. */
  heimlich: Verlust[];
  text: string;
}

/** Die wegschneidende Fläche über einem Stück — ihr `scrollWidth` verrät verborgenen Text. */
interface Rollflaeche {
  marke: string;
  sichtbreite: number;
  textbreite: number;
}

interface Masse {
  fenster: number;
  fensterhoehe: number;
  seitenbreite: number;
  seitenhoehe: number;
  rollstand: number;
  heran: string | null;
  palette: Stueck | null;
  vorlagen: (Stueck | null)[];
  hilfesaetze: (Stueck | null)[];
  rollflaechen: (Rollflaeche | null)[];
  feld: Stueck | null;
  knopf: Stueck | null;
  satz: Stueck | null;
}

/**
 * Der fokussierte Knoten — wer er ist UND wo er liegt, auf BEIDEN Achsen.
 *
 * Ein Tabstopp ausserhalb des Fensters ist keiner. Runde 1 hat hier nur links/rechts geprüft und
 * damit die Hälfte gelassen: der Browser rollt einen Knoten beim Fokussieren selbst heran, also ist
 * „oben/unten im Fenster" nach jedem Tab eine Zusage, die der Browser HALTEN muss — und sie bricht
 * genau dann, wenn ein Vorfahre den Knoten wegschneidet.
 *
 * RUNDE 3: gemeldet wird jetzt JEDER Rand, der NACH dem Fokussieren noch etwas wegnimmt — auch ein
 * rollbarer. Runde 2 hat rollbare Ränder hier ausgenommen (dieselbe Lücke wie im Messer oben), und
 * damit galt ein Knopf in einer 20 px hohen Rollfläche als erreichbarer Tabstopp. Das Fokussieren
 * IST die Bewegung: der Browser hat danach alles gerollt, was er rollen kann. Was jetzt noch fehlt,
 * fehlt dem Nutzer, der gerade Tab gedrückt hat.
 */
const FOKUS = `() => {
  const a = document.activeElement;
  if (!a || a === document.body) { return null; }
  const b = a.getBoundingClientRect();
  const rd = (z) => Math.round(z * 10) / 10;
  const fort = [];
  for (let p = a.parentElement; p; p = p.parentElement) {
    const s = getComputedStyle(p);
    const schneidetX = s.overflowX !== 'visible';
    const schneidetY = s.overflowY !== 'visible';
    if (!schneidetX && !schneidetY) { continue; }
    const pb = p.getBoundingClientRect();
    const marke = p.getAttribute('data-testid') || (p.tagName + '.' + String(p.className || '').slice(0, 40));
    // „rollbar" steht in der Meldung, nicht im Filter: es sagt dem Leser, welcher Art der Rand ist,
    // nimmt ihn aber nicht mehr aus. Nach dem Fokussieren zählt allein, was noch weggeschnitten ist.
    const art = (wie, mehr, passt) => (wie === 'auto' || wie === 'scroll' ? 'rollbar' : 'nicht rollbar') + (passt ? '' : ', passt nicht hinein') + (mehr ? '' : ', ohne verborgenen Inhalt');
    if (schneidetX && Math.max(pb.left - b.left, b.right - pb.right) > 1) {
      fort.push(marke + ' waagerecht ' + rd(Math.max(pb.left - b.left, b.right - pb.right)) + 'px (' + art(s.overflowX, p.scrollWidth > p.clientWidth + 1, b.width <= p.clientWidth + 1) + ')');
    }
    if (schneidetY && Math.max(pb.top - b.top, b.bottom - pb.bottom) > 1) {
      fort.push(marke + ' senkrecht ' + rd(Math.max(pb.top - b.top, b.bottom - pb.bottom)) + 'px (' + art(s.overflowY, p.scrollHeight > p.clientHeight + 1, b.height <= p.clientHeight + 1) + ')');
    }
  }
  return {
    marke: a.getAttribute('data-testid') || '',
    marke2: a.getAttribute('aria-label') || '',
    tag: a.tagName,
    text: (a.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 70),
    links: rd(b.left),
    rechts: rd(b.right),
    oben: rd(b.top),
    unten: rd(b.bottom),
    hoehe: rd(b.height),
    fensterhoehe: document.documentElement.clientHeight,
    fort: fort,
    ring: getComputedStyle(a).outlineStyle,
  };
}`;

interface Fokus {
  marke: string;
  marke2: string;
  tag: string;
  text: string;
  links: number;
  rechts: number;
  oben: number;
  unten: number;
  hoehe: number;
  fensterhoehe: number;
  /** Ränder, die den Knoten NACH dem Fokussieren immer noch wegschneiden — rollbar oder nicht. */
  fort: string[];
  ring: string;
}

let b: Buehne | null = null;
/** Jeder ausgehende `POST /api/reasoner` — Rumpf im Wortlaut, nicht das Aussehen der Fläche. */
const gesendet: { url: string; rumpf: string | null }[] = [];

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
  await s.setViewportSize({ width: breite, height: 844 });
  await s.goto(`${ORIGIN}${PFAD}`, { waitUntil: "load", timeout: 60_000 });
  await s.waitForFunction(fn("(sel) => document.querySelector(sel) !== null"), BLATT, {
    timeout: 30_000,
  });
  return s;
}

/**
 * Auf die GESTELLTEN Vorlagen warten, bevor gemessen wird.
 *
 * Die Palette steht sofort; die Vorlagen kommen aus einem Abruf und brauchen einen Wimpernschlag
 * länger. Ohne dieses Warten misst der Messer eine Palette OHNE Vorlagen und meldet „die Vorlage
 * steht nicht da" — genau so ist Fall B3 im ersten Lauf gescheitert, ohne dass am Produkt etwas
 * fehlte. Ein fehlendes Element bleibt trotzdem ein Fehlschlag: hier wird gewartet, nicht geduldet.
 */
async function vorlagenAbwarten(): Promise<void> {
  await seite().waitForFunction(
    fn(
      `(n) => [...document.querySelectorAll('[data-testid="blatt-menue-ki"] button')].some((x) => (x.textContent || '').trim() === n)`,
    ),
    LANGER_NAME,
    { timeout: 20_000 },
  );
}

/** Fenster stellen, Blatt mit Inhalt fahren, KI-Palette über die Maus öffnen. */
async function paletteOeffnen(breite: number, mitVorlagen = true): Promise<void> {
  const s = await blattFahren(breite);
  // Der Klick geht auf den ECHTEN Knopf des Produkts (`Menue.tsx:269`); dass er im Fenster liegt,
  // behauptet dieser Griff nicht — das misst der Messer darunter mit `getBoundingClientRect`.
  await s.evaluate(
    fn(`() => { document.querySelector('[data-testid="blatt-werkzeug-ki"]').click(); }`),
  );
  await s.waitForFunction(
    fn(`() => document.querySelector('[data-testid="blatt-menue-ki"]') !== null`),
    undefined,
    { timeout: 20_000 },
  );
  if (mitVorlagen) {
    await vorlagenAbwarten();
  }
}

async function messen(lage: string, heran: string | null = null): Promise<Masse> {
  const m = await seite().evaluate<Masse>(fn(MASSE), { namen: NAMEN, heran });
  console.info(`JOB 3584 · ${lage} · ${JSON.stringify(m)}`);
  return m;
}

/** Die Stücke, die dieser Fall benennt — Name, wie der Messer sie holt, und wie sie heissen. */
const STUECKE: { heran: string; was: string; hol: (m: Masse) => Stueck | null }[] = [
  { heran: "vorlage:0", was: `die Vorlage „${KURZ.name}"`, hol: (m) => m.vorlagen[0] ?? null },
  { heran: "vorlage:1", was: `die Vorlage „${LANGER_NAME}"`, hol: (m) => m.vorlagen[1] ?? null },
  { heran: "vorlage:2", was: `die Vorlage „${LANGE.name}"`, hol: (m) => m.vorlagen[2] ?? null },
  {
    heran: "hilfe:0",
    was: `der Hilfesatz zu „${KURZ.name}"`,
    hol: (m) => m.hilfesaetze[0] ?? null,
  },
  {
    heran: "hilfe:1",
    was: `der Hilfesatz zu „${LANGER_NAME}"`,
    hol: (m) => m.hilfesaetze[1] ?? null,
  },
  {
    heran: "hilfe:2",
    was: "der Hilfesatz der langen Anweisung",
    hol: (m) => m.hilfesaetze[2] ?? null,
  },
  { heran: "feld", was: "die freie Eingabe", hol: (m) => m.feld },
  { heran: "knopf", was: "der Ausführen-Knopf", hol: (m) => m.knopf },
];

/** Ein Stück steht wirklich da und trägt Fläche — auf beiden Achsen. */
function vorhanden(st: Stueck | null, was: string, lage: string): Stueck {
  expect(st, `${lage}: ${was} steht nicht da`).not.toBeNull();
  const s = st as Stueck;
  expect(s.breite, `${lage}: ${was} ist nur ${s.breite} px breit`).toBeGreaterThan(0);
  expect(s.hoehe, `${lage}: ${was} ist nur ${s.hoehe} px hoch`).toBeGreaterThan(0);
  return s;
}

/**
 * Kein Rand hält einen Teil des Stückes UNWIEDERBRINGLICH.
 *
 * Rollbar weggeschnitten heisst verborgen (der Nutzer rollt hin); nicht rollbar weggeschnitten
 * heisst fort — kein Rollen der Welt bringt es zurück. Nur die zweite Art ist ein Mangel, und genau
 * sie hat Runde 1 gar nicht gesucht.
 */
function nichtFort(st: Stueck, was: string, lage: string): void {
  const fort = st.verluste.filter((v) => !v.rollbar);
  expect(
    fort,
    `${lage}: ${was} wird unwiederbringlich weggeschnitten — ${JSON.stringify(fort)} („${st.text}")`,
  ).toEqual([]);
}

/**
 * NACH der Bewegung: das Stück liegt GANZ in der Schnittfläche aus Fenster und allen Rändern.
 *
 * Das ist die Korrekturpflicht 1 aus Runde 2. `nichtFort` (oben) gilt VOR dem Rollen und entschuldigt
 * dort zu Recht jeden rollbaren Rand — dorthin ist ja noch niemand gerollt. NACH dem Rollen
 * entschuldigt nichts mehr: wurde herangerollt und fehlt immer noch ein Stück, dann fehlt es. Der
 * Prüfer hat genau hier die Lücke vorgeführt (Rollfläche auf 1 px, Hilfesatz 155 px, `rollbar:true`
 * — und Runde 2 blieb grün). Die Meldung trennt die zwei Gründe, weil sie verschieden schwer wiegen:
 * `passt:false` heisst, die Fläche ist zu klein für das Stück und zeigt es in KEINEM Rollstand ganz;
 * `passt:true` heisst, sie könnte, steht aber falsch.
 */
function ganzInDerSchnittflaeche(st: Stueck, was: string, lage: string): void {
  const zuKlein = st.verluste.filter((v) => v.passt === false);
  expect(
    zuKlein,
    `${lage}: ${was} ist höher/breiter als die Fläche, die es zeigen soll — in KEINEM Rollstand ` +
      `ganz zu sehen: ${JSON.stringify(zuKlein)} (Stück ${st.breite}×${st.hoehe} px, „${st.text}")`,
  ).toEqual([]);
  expect(
    st.verluste,
    `${lage}: ${was} bleibt NACH dem Heranrollen weggeschnitten — ${JSON.stringify(st.verluste)} („${st.text}")`,
  ).toEqual([]);
}

/**
 * WAAGERECHT ist eine harte Zusage: das Stück liegt ganz zwischen 0 und der Fensterbreite, und
 * nichts davon liegt hinter einem Seitwärtsrollen. Seitwärts zu rollen ist auf einer Seite kein
 * Weg, sondern der Mangel selbst.
 */
function waagerechtImFenster(st: Stueck | null, was: string, m: Masse, lage: string): Stueck {
  const s = vorhanden(st, was, lage);
  expect(
    s.links,
    `${lage}: ${was} beginnt links ausserhalb (x=${s.links}, „${s.text}")`,
  ).toBeGreaterThanOrEqual(0);
  expect(
    s.rechts,
    `${lage}: ${was} endet rechts ausserhalb (x=${s.rechts} von ${m.fenster}, „${s.text}")`,
  ).toBeLessThanOrEqual(m.fenster);
  const seitwaerts = s.verluste.filter((v) => v.richtung === "waagerecht");
  expect(
    seitwaerts,
    `${lage}: ${was} liegt zum Teil hinter einem Seitwärtsrollen — ${JSON.stringify(seitwaerts)}`,
  ).toEqual([]);
  nichtFort(s, was, lage);
  return s;
}

/**
 * Der TEXT steht ganz da — waagerecht UND senkrecht.
 *
 * Die senkrechte Hälfte ist die Lehre aus Runde 2: der Prüfer hat den Hilfesatz auf
 * `height:1px; overflow:hidden` gestellt (155 px Text auf 1 px Fläche) und die Prüfung blieb grün,
 * weil sie nur `scrollWidth/clientWidth` ansah. `scrollHeight > clientHeight` an einem Stück, das
 * selbst nicht rollen kann, heisst: da steht mehr, als je zu sehen sein wird.
 */
function ganzLesbar(st: Stueck, was: string, lage: string): void {
  const wie =
    `white-space=${st.umbruch}, text-overflow=${st.kuerzung}, overflow-wrap=${st.wortbruch}, ` +
    `overflow=${st.eigenrollen}, „${st.text}"`;
  expect(
    st.textbreite,
    `${lage}: ${was} ist waagerecht beschnitten (${st.textbreite} px Text auf ${st.sichtbreite} px Fläche, ${wie})`,
  ).toBeLessThanOrEqual(st.sichtbreite + 1);
  expect(
    st.texthoehe,
    `${lage}: ${was} ist senkrecht beschnitten (${st.texthoehe} px Text auf ${st.sichthoehe} px Fläche, ${wie})`,
  ).toBeLessThanOrEqual(st.sichthoehe + 1);
}

/** Die WAAGERECHTE Zusage von B1 in einem Satz, für ein beliebiges Fenster. */
function paletteWaagerecht(m: Masse, lage: string): void {
  expect(
    m.seitenbreite,
    `${lage}: die SEITE läuft waagerecht über (scrollWidth=${m.seitenbreite} auf clientWidth=${m.fenster})`,
  ).toBeLessThanOrEqual(m.fenster + 1);
  const p = waagerechtImFenster(m.palette, "die Palette", m, lage);
  expect(
    p.textbreite,
    `${lage}: die Palette selbst läuft waagerecht über (${p.textbreite} px auf ${p.sichtbreite} px)`,
  ).toBeLessThanOrEqual(p.sichtbreite + 1);
  for (const s of STUECKE) {
    waagerechtImFenster(s.hol(m), s.was, m, lage);
  }
}

/**
 * JEDER Textblock der Palette steht ganz da — auf beiden Achsen.
 *
 * Absichtlich über ALLE Vorlagen und Hilfesätze, nicht nur über den langen: die 1-px-Gegenprobe des
 * Prüfers hätte an einer einzigen ungeprüften Stelle wieder durchgehen können. Die freie Eingabe
 * bleibt aussen vor — bei einem `<input>` heisst `scrollWidth > clientWidth` „der Nutzer hat viel
 * getippt", nicht „die Fläche schneidet ab"; das wäre eine falsche Aussage über eine wahre Zahl.
 */
function paletteTexteLesbar(m: Masse, lage: string): void {
  for (const [i, name] of NAMEN.entries()) {
    const v = m.vorlagen[i];
    const h = m.hilfesaetze[i];
    expect(v, `${lage}: die Vorlage „${name}" steht nicht da`).not.toBeNull();
    expect(h, `${lage}: der Hilfesatz zu „${name}" steht nicht da`).not.toBeNull();
    ganzLesbar(v as Stueck, `die Vorlage „${name}"`, lage);
    ganzLesbar(h as Stueck, `der Hilfesatz zu „${name}"`, lage);
  }
}

/**
 * Die SENKRECHTE Zusage, und sie heisst ERREICHBAR, nicht „gleichzeitig zu sehen".
 *
 * Gemessen wird sie nicht gerechnet, sondern gefahren: das Stück wird herangerollt und DANACH
 * nachgemessen. Erst dann muss es ganz zwischen 0 und der Fensterhöhe liegen. Ein Stück, das ein
 * nicht rollbarer Rand hält, bleibt auch nach dem Rollen draussen — genau das fängt diese Prüfung,
 * und K3 belegt, dass sie es fängt.
 *
 * RUNDE 3: und ein Stück, das ein ROLLBARER Rand nach dem Heranrollen weiter beschneidet, bleibt
 * ebenfalls draussen — dafür steht `ganzInDerSchnittflaeche`, K4 belegt es. „Erreichbar" heisst ab
 * hier: hingerollt UND danach ganz zu sehen, im Fenster wie in jeder Fläche darüber.
 */
async function senkrechtErreichbar(
  heran: string,
  was: string,
  lage: string,
  hol: (m: Masse) => Stueck | null,
): Promise<Stueck> {
  const m = await messen(`${lage} · herangerollt ${heran}`, heran);
  const s = vorhanden(hol(m), was, lage);
  ganzInDerSchnittflaeche(s, was, lage);
  // Das Heranrollen darf NICHT durch einen Rand gegangen sein, den nur ein Skript bewegt. Ohne
  // diese Zeile beweist die Messung bloss, dass `scrollIntoView` etwas getan hat.
  expect(
    s.heimlich,
    `${lage}: ${was} liegt hinter einem Rand, an den nur ein Skript rollen kann — ${JSON.stringify(s.heimlich)}`,
  ).toEqual([]);
  expect(
    s.oben,
    `${lage}: ${was} bleibt nach dem Heranrollen oben draussen (y=${s.oben}, Rollstand ${m.rollstand}, „${s.text}")`,
  ).toBeGreaterThanOrEqual(0);
  expect(
    s.unten,
    `${lage}: ${was} bleibt nach dem Heranrollen unten draussen (y=${s.unten} von ${m.fensterhoehe}, ` +
      `Rollstand ${m.rollstand}, „${s.text}")`,
  ).toBeLessThanOrEqual(m.fensterhoehe);
  return s;
}

/**
 * Die Lage EINES fokussierten Knotens — die Zusage aus §5 B3, in einer eigenen Funktion.
 *
 * Eigen, damit K4 sie auf denselben Weg zwingen kann, auf dem K1/K2 `paletteWaagerecht` und
 * `ganzLesbar` zwingen: die Prüfung selbst muss an einem verstellten Zustand rot werden, nicht nur
 * eine Zahl daneben. Steht sie nur inmitten der Tab-Schleife, lässt sie sich nicht kalibrieren.
 */
function fokusLage(f: Fokus, wer: string, fenster: number): void {
  expect(f.links, `${wer} beginnt bei x=${f.links}`).toBeGreaterThanOrEqual(0);
  expect(f.rechts, `${wer} endet bei x=${f.rechts} von ${fenster}`).toBeLessThanOrEqual(fenster);
  // Der Browser hat beim Fokussieren schon gerollt, was er rollen kann. Was JETZT noch weggeschnitten
  // ist, bleibt es für den Nutzer — ob der Rand rollbar heisst, ändert daran nichts (Runde 3).
  expect(
    f.fort,
    `${wer} bleibt nach dem Fokussieren weggeschnitten — ${JSON.stringify(f.fort)}`,
  ).toEqual([]);
  // Höher als das Fenster kann kein Knoten ganz hineinpassen; dann bleibt die schwächere,
  // aber wahre Aussage: er überlappt das Fenster überhaupt.
  if (f.hoehe <= f.fensterhoehe) {
    expect(f.oben, `${wer} beginnt bei y=${f.oben}`).toBeGreaterThanOrEqual(0);
    expect(f.unten, `${wer} endet bei y=${f.unten} von ${f.fensterhoehe}`).toBeLessThanOrEqual(
      f.fensterhoehe,
    );
  } else {
    expect(f.oben, `${wer} liegt ganz unterhalb des Fensters`).toBeLessThan(f.fensterhoehe);
    expect(f.unten, `${wer} liegt ganz oberhalb des Fensters`).toBeGreaterThan(0);
  }
}

/** Tab drücken, bis `pruefung` im Browser wahr ist. Jeder Zwischenhalt wird auf seine Lage geprüft. */
async function tabBis(
  pruefung: string,
  arg: unknown,
  lage: string,
  fenster: number,
  schritte = 40,
): Promise<Fokus> {
  const s = seite();
  for (let i = 0; i < schritte; i++) {
    await s.keyboard.press("Tab");
    const f = await s.evaluate<Fokus | null>(fn(FOKUS));
    if (f !== null) {
      // Die Zusage aus §5 B3: der jeweils fokussierte Knoten liegt bei JEDEM Schritt im Fenster —
      // seit Runde 2 auf BEIDEN Achsen. Senkrecht ist das keine Härte, sondern eine Selbstprüfung
      // des Browsers: er rollt den fokussierten Knoten selbst heran. Bleibt er danach draussen,
      // hält ihn ein Rand — dann ist der Tabstopp keiner.
      fokusLage(f, `${lage}: Tabstopp „${f.marke || f.marke2 || f.text}"`, fenster);
    }
    const treffer = await s.evaluate<boolean>(fn(pruefung), arg);
    if (treffer) {
      expect(f, `${lage}: der Treffer trägt keinen Fokus`).not.toBeNull();
      return f as Fokus;
    }
  }
  throw new Error(`${lage}: Tab erreicht das Ziel in ${schritte} Schritten nicht`);
}

const AM_WERKZEUG = `() => { const a = document.activeElement; return !!a && a.getAttribute('data-testid') === 'blatt-werkzeug-ki'; }`;
const AM_KNOPF_MIT_TEXT = `(t) => { const a = document.activeElement; return !!a && a.tagName === 'BUTTON' && (a.textContent || '').replace(/\\s+/g, ' ').trim() === t; }`;
const AM_FREIEN_FELD = `() => { const a = document.activeElement; const p = document.querySelector('[data-testid="blatt-menue-ki"]'); return !!a && !!p && a.tagName === 'INPUT' && p.contains(a); }`;

// KEIN `describe.runIf`: fehlt `apps/web/dist` oder startet Chromium nicht, wird dieser Lauf ROT und
// nennt den Ausfall wörtlich (er steht in `Buehne.fehler`). Ein übersprungener Prüfstand ist grün und
// belegt nichts — genau der Scheinbeleg, den JOB 3578 R1 und JOB 3573/3581 gekostet haben.
describe("JOB 3584 · die KI-Palette bei 390 px im echten Chromium", () => {
  beforeAll(async () => {
    // Die Bühne fährt SCHON schmal an (neuer Fensterparameter) — kein Umstellen nach dem Aufbau,
    // also auch keine erste Zeichnung in einem Fenster, das niemand misst.
    b = await buehneAufbauen(PFAD, BLATT, SKRIPT, { width: 390, height: 844 });
    if (b.fehler === null) {
      b.seite.on("request", (arg: unknown) => {
        const a = arg as { url(): string; method(): string; postData(): string | null };
        if (a.method() === "POST" && a.url().includes("/api/reasoner")) {
          gesendet.push({ url: a.url(), rumpf: a.postData() });
        }
      });
    }
  }, 180_000);

  afterAll(async () => {
    await b?.schliessen();
  }, 60_000);

  it("B0 · die Bühne steht wirklich, und die gestellten Vorlagen sind wirklich lang", () => {
    const stand = b as Buehne;
    expect(stand.fehler, `Bühne nicht aufgebaut: ${stand.fehler}`).toBeNull();
    console.info(
      `JOB 3584 · Chromium ${stand.version} · Theme ${stand.theme} · Name ${LANGER_NAME.length} Zeichen · ` +
        `Anweisung ${LANGE_ANWEISUNG.length} Zeichen`,
    );
    // Ohne diese zwei Zahlen misst der ganze Lauf eine kurze Vorlage und nennt sie lang.
    expect(LANGER_NAME.length, "der lange Name ist zu kurz").toBeGreaterThanOrEqual(40);
    expect(LANGER_NAME.includes(" "), "der lange Name hat einen Umbruchpunkt").toBe(false);
    expect(LANGE_ANWEISUNG.length, "die lange Anweisung ist zu kurz").toBeGreaterThanOrEqual(200);
  });

  // 390 px ist das Fenster des Auftrags; 1280 px ist der Gegenhalt (Prüflücke ii): was die schmale
  // Lage bringt, darf die breite nicht kosten.
  for (const breite of [390, 1280]) {
    it(`B1a · ${breite} px: die geöffnete Palette läuft NICHT waagerecht über, und jeder Text steht ganz da`, async () => {
      await paletteOeffnen(breite);
      const m = await messen(`B1a · ${breite}`);
      paletteWaagerecht(m, `B1a · ${breite}`);
      paletteTexteLesbar(m, `B1a · ${breite}`);
    }, 120_000);

    // B1b · DIE SENKRECHTE ACHSE, EHRLICH BENANNT (Korrekturpflicht 1 des Prüfers).
    //
    // Bei 390×844 stehen die freie Eingabe und der Ausführen-Knopf UNTERHALB des Fensters — der
    // Prüfer hat es an Runde 1 nachgemessen (y=848,75–884,75 bzw. y=849–884,5), und die Zahlen
    // dieses Laufs stehen in der Ausgabe von B1a. „Vollständig gleichzeitig sichtbar" ist deshalb
    // FALSCH und wird hier nicht behauptet. Was WAHR und geprüft ist: jedes Stück ist durch
    // senkrechtes Rollen GANZ zu erreichen, und keines hält ein Rand fest, aus dem niemand es
    // hervorholen kann. Gefahren, nicht gerechnet: `scrollIntoView`, dann nachgemessen.
    it(`B1b · ${breite} px: jedes Stück der Palette ist durch senkrechtes Rollen GANZ zu erreichen`, async () => {
      await paletteOeffnen(breite);
      const lage = `B1b · ${breite}`;
      const vorher = await messen(lage);
      // Erst die ehrliche Bestandsaufnahme: was steht schon im Fenster, was nicht.
      const draussen = STUECKE.filter((s) => {
        const st = s.hol(vorher);
        return st !== null && (st.oben < 0 || st.unten > vorher.fensterhoehe);
      }).map((s) => `${s.was} (y=${s.hol(vorher)?.oben}–${s.hol(vorher)?.unten})`);
      console.info(
        `JOB 3584 · ${lage} · Fenster ${vorher.fenster}×${vorher.fensterhoehe} · Seite ${vorher.seitenhoehe} px hoch · ` +
          `ohne Rollen NICHT im Fenster: ${draussen.length === 0 ? "nichts" : draussen.join(" · ")}`,
      );
      for (const s of STUECKE) {
        await senkrechtErreichbar(s.heran, s.was, lage, s.hol);
      }
    }, 120_000);

    it(`B2 · ${breite} px: der lange Name und die lange Anweisung stehen ganz da — nicht halb verborgen`, async () => {
      await paletteOeffnen(breite);
      const m = await messen(`B2 · ${breite}`);
      const lage = `B2 · ${breite}`;
      // Erst die Lage (ein Stück ausserhalb des Fensters wäre sonst „vollständig"), dann der Text.
      const langer = waagerechtImFenster(
        m.vorlagen[1] ?? null,
        `die Vorlage „${LANGER_NAME}"`,
        m,
        lage,
      );
      expect(langer.text, `${lage}: der lange Name steht gar nicht da`).toBe(LANGER_NAME);
      ganzLesbar(langer, `die Vorlage „${LANGER_NAME}"`, lage);
      expect(
        langer.kuerzung,
        `${lage}: der lange Name wird mit Auslassungspunkten gekürzt`,
      ).not.toBe("ellipsis");
      // UND DIE ZWEITE, UNABHÄNGIGE AUSSAGE ZUR SELBEN SACHE: die Fläche, die über dem Knopf
      // wegschneidet, versteckt nichts. Das Rechteck des Knopfes meldet seine volle Breite auch
      // dann, wenn davon nichts zu sehen ist — erst `scrollWidth > clientWidth` der Rollfläche
      // sagt, dass Text hinter einem Seitwärtsrollen liegt. Genau das war der Basisbefund.
      const roll = m.rollflaechen[1] ?? null;
      expect(roll, `${lage}: über dem Vorlagenknopf schneidet nichts weg`).not.toBeNull();
      const rf = roll as Rollflaeche;
      expect(
        rf.textbreite,
        `${lage}: die Fläche „${rf.marke}" verbirgt den Namen hinter dem Seitwärtsrollen ` +
          `(${rf.textbreite} px Inhalt auf ${rf.sichtbreite} px Sicht)`,
      ).toBeLessThanOrEqual(rf.sichtbreite + 1);
      // Und die lange Anweisung darunter schiebt nichts hinaus.
      const satz = waagerechtImFenster(
        m.hilfesaetze[2] ?? null,
        "der Hilfesatz der langen Anweisung",
        m,
        lage,
      );
      expect(satz.text.length, `${lage}: der Hilfesatz ist leer`).toBeGreaterThan(20);
      ganzLesbar(satz, "der Hilfesatz der langen Anweisung", lage);
      // Die Fläche als Ganzes bleibt heil — die lange Anweisung ist der längste Textblock darin.
      paletteWaagerecht(m, lage);
      // Und der Hilfesatz, der den Prüfer in Runde 1 durchgelassen hat, ist auch senkrecht ganz da.
      const herangerollt = await senkrechtErreichbar(
        "hilfe:2",
        "der Hilfesatz der langen Anweisung",
        lage,
        (x) => x.hilfesaetze[2] ?? null,
      );
      ganzLesbar(herangerollt, "der Hilfesatz der langen Anweisung (herangerollt)", lage);
    }, 120_000);
  }

  it("B3 · 390 px, NUR Tastatur: vom Werkzeug bis zum ausgelösten Lauf über eine VORLAGE", async () => {
    const s = await blattFahren(390);
    await s.evaluate(fn("() => { document.body.focus(); }"));
    gesendet.length = 0;

    const amWerkzeug = await tabBis(AM_WERKZEUG, undefined, "B3 · Werkzeug", 390);
    // Der Fokus ist auch SICHTBAR (globale `*:focus-visible`-Regel, index.css).
    expect(amWerkzeug.ring, "B3: kein sichtbarer Fokusring am KI-Werkzeug").not.toBe("none");
    await s.keyboard.press("Enter");
    await s.waitForFunction(
      fn(`() => document.querySelector('[data-testid="blatt-menue-ki"]') !== null`),
      undefined,
      { timeout: 20_000 },
    );
    await vorlagenAbwarten();
    // Die Palette, die der Tastaturweg öffnet, ist dieselbe, die B1a mit der Maus gemessen hat.
    const amTastaturweg = await messen("B3 · Tastatur");
    paletteWaagerecht(amTastaturweg, "B3 · Tastatur");
    paletteTexteLesbar(amTastaturweg, "B3 · Tastatur");

    const aufVorlage = await tabBis(AM_KNOPF_MIT_TEXT, LANGER_NAME, "B3 · Vorlage", 390);
    expect(aufVorlage.ring, "B3: kein sichtbarer Fokusring auf der Vorlage").not.toBe("none");
    await s.keyboard.press("Enter");
    // Gemessen wird der ausgelöste LAUF, nicht die Bewegung des Knopfes.
    await warteAufAnfrage("B3");
    const rumpf = JSON.parse(gesendet[0]?.rumpf ?? "{}") as Record<string, unknown>;
    console.info(`JOB 3584 · B3 · Rumpf ${JSON.stringify(rumpf)}`);
    expect(rumpf.task, "B3: die Anfrage trägt nicht die Aufgabe assist").toBe("assist");
    expect(rumpf.instruction, "B3: die Vorlage sendet eine andere Anweisung").toBe(
      LANG.instruction,
    );
  }, 120_000);

  it("B4 · 390 px, NUR Tastatur: die freie Anweisung geht WÖRTLICH hinaus", async () => {
    const s = await blattFahren(390);
    await s.evaluate(fn("() => { document.body.focus(); }"));
    gesendet.length = 0;

    await tabBis(AM_WERKZEUG, undefined, "B4 · Werkzeug", 390);
    await s.keyboard.press("Enter");
    await s.waitForFunction(
      fn(`() => document.querySelector('[data-testid="blatt-menue-ki"]') !== null`),
      undefined,
      { timeout: 20_000 },
    );
    const imFeld = await tabBis(AM_FREIEN_FELD, undefined, "B4 · freies Feld", 390);
    expect(imFeld.tag).toBe("INPUT");

    // Getippt wird ZEICHEN FÜR ZEICHEN mit derselben `press`-Taste, die auch Tab und Enter schickt —
    // die Vorrichtung braucht dafür kein zweites Werkzeug.
    const ANWEISUNG = "Kuerzen";
    for (const zeichen of ANWEISUNG) {
      await s.keyboard.press(zeichen);
    }
    const angekommen = await s.evaluate<string>(
      fn(
        `() => { const p = document.querySelector('[data-testid="blatt-menue-ki"]'); const i = p ? p.querySelector('input') : null; return i ? i.value : ''; }`,
      ),
    );
    expect(angekommen, "B4: die getippte Anweisung steht nicht im Feld").toBe(ANWEISUNG);

    const aufKnopf = await tabBis(
      `() => { const a = document.activeElement; const p = document.querySelector('[data-testid="blatt-menue-ki"]'); const i = p ? p.querySelector('input') : null; return !!a && !!i && a.tagName === 'BUTTON' && i.parentElement.contains(a); }`,
      undefined,
      "B4 · Ausführen",
      390,
      6,
    );
    expect(aufKnopf.ring, "B4: kein sichtbarer Fokusring am Ausführen-Knopf").not.toBe("none");
    await s.keyboard.press("Enter");
    await warteAufAnfrage("B4");
    const rumpf = JSON.parse(gesendet[0]?.rumpf ?? "{}") as Record<string, unknown>;
    console.info(`JOB 3584 · B4 · Rumpf ${JSON.stringify(rumpf)}`);
    expect(rumpf.task, "B4: die Anfrage trägt nicht die Aufgabe assist").toBe("assist");
    expect(rumpf.instruction, "B4: die freie Anweisung kam nicht wörtlich an").toBe(ANWEISUNG);
    expect(String(rumpf.text), "B4: der Text des Blattes fehlt in der Anfrage").toContain("Router");
  }, 120_000);

  // ==============================================================================================
  // K1 · DIE KALIBRIERUNG DER WAAGERECHTEN ACHSE — ohne sie misst B1a/B2 nichts (JOB 3266 K, 3573).
  // ==============================================================================================
  //
  // Zurückgenommen wird in der LAUFENDEN Seite GENAU das, was dieser Auftrag gesetzt hat:
  // `max-w-full` und `break-words` am Vorlagenknopf (`AiAssistBox.tsx`). Beides zusammen ist die
  // Reparatur; beides zusammen wird hier weggenommen, und nichts sonst — `white-space` bleibt
  // `normal` wie am Basisstand, sonst kalibrierte dieser Fall gegen einen Zustand, den es nie gab.
  // Wird die Messung dann rot, hält B2 wirklich etwas; bleibt sie grün, misst B2 nichts.
  it("K1 · 390 px: wird `max-w-full break-words` am Vorlagenknopf zurückgenommen, IST die Messung rot", async () => {
    await paletteOeffnen(390);
    const s = seite();
    const vorher = await s.evaluate<string>(
      fn(
        `(n) => { const b = [...document.querySelectorAll('[data-testid="blatt-menue-ki"] button')].find((x) => (x.textContent || '').trim() === n); const alt = b.getAttribute('style') || ''; b.style.maxWidth = 'none'; b.style.overflowWrap = 'normal'; return alt; }`,
      ),
      LANGER_NAME,
    );
    const ohne = await messen("K1 · ohne max-w-full break-words");
    const langer = ohne.vorlagen[1] as Stueck;
    expect(langer, "K1: der lange Vorlagenknopf ist nicht mehr da").not.toBeNull();
    const roll = ohne.rollflaechen[1] as Rollflaeche | null;
    // Genau die zwei Aussagen, die B2 verlangt — mindestens eine MUSS jetzt verletzt sein: der
    // Knopf steht aus dem Fenster (gemessen am Basisstand: rechts 398 von 390) oder sein Name
    // liegt hinter dem Seitwärtsrollen seiner Fläche.
    expect(
      langer.rechts > ohne.fenster || (roll !== null && roll.textbreite > roll.sichtbreite + 1),
      `K1: ohne die Reparatur bliebe alles im Fenster und alles lesbar (Knopf rechts=${langer.rechts} von ${ohne.fenster}, Rollfläche ${roll?.textbreite} px auf ${roll?.sichtbreite} px) — dann misst B2 nichts`,
    ).toBe(true);
    // Und dieselbe Prüffunktion, die B1a fährt, IST an diesem Zustand rot — nicht nur die Zahlen.
    expect(
      () => paletteWaagerecht(ohne, "K1 · ohne max-w-full break-words"),
      "K1: die Prüfung von B1a bleibt ohne die Reparatur grün — dann misst B1a nichts",
    ).toThrow();
    // Zurückgesetzt, damit der nächste Fall auf dem echten Produktzustand misst.
    await s.evaluate(
      fn(
        `([n, alt]) => { const b = [...document.querySelectorAll('[data-testid="blatt-menue-ki"] button')].find((x) => (x.textContent || '').trim() === n); if (alt) { b.setAttribute('style', alt); } else { b.removeAttribute('style'); } }`,
      ),
      [LANGER_NAME, vorher],
    );
    const zurueck = await messen("K1 · nach Rücknahme");
    paletteWaagerecht(zurueck, "K1 · nach Rücknahme");
    paletteTexteLesbar(zurueck, "K1 · nach Rücknahme");
  }, 120_000);

  // ==============================================================================================
  // K2 · DIE KALIBRIERUNG DER SENKRECHTEN TEXTMESSUNG — genau die Gegenprobe, an der Runde 1
  // GRÜN geblieben ist.
  // ==============================================================================================
  //
  // Der Prüfer hat den langen Hilfesatz auf `height:1px; overflow:hidden` gestellt — 155 px Text
  // auf 1 px Fläche — und meldete wörtlich: „BEN GEGENPROBE: bestehende B1/B2-Prüfungen grün trotz
  // {"clientHeight":1,"scrollHeight":155}". Derselbe Griff, hier als fester Fall: er MUSS jetzt rot
  // machen. Bleibt er grün, sagt „der Text steht ganz da" wieder nichts über die senkrechte Achse.
  it("K2 · 390 px: wird der lange Hilfesatz senkrecht auf 1 px gedeckelt, IST die Messung rot", async () => {
    await paletteOeffnen(390);
    const s = seite();
    // DER GESICHERTE STIL WIRD HEREINGEREICHT, nicht im Browser noch einmal gelesen. Liest die
    // Rücknahme ihn selbst, liest sie den SCHON verstellten Stand und schreibt genau den Deckel
    // zurück, den sie wegnehmen soll. So ist dieser Fall im ersten Lauf rot geworden, wörtlich:
    // „K2 · nach Rücknahme: der Hilfesatz zu „Übergabe ausführlich" ist senkrecht beschnitten
    // (155 px Text auf 1 px Fläche) … expected 155 to be less than or equal to 2".
    const GRIFF = `([n, hoehe, alt]) => {
      const b = [...document.querySelectorAll('[data-testid="blatt-menue-ki"] button')].find((x) => (x.textContent || '').trim() === n);
      const p = b && b.parentElement ? b.parentElement.querySelector('p') : null;
      if (!p) { return 'KEIN HILFESATZ'; }
      const gesichert = p.getAttribute('style') || '';
      if (hoehe === null) { if (alt) { p.setAttribute('style', alt); } else { p.removeAttribute('style'); } return gesichert; }
      p.style.height = hoehe; p.style.overflow = 'hidden';
      return gesichert;
    }`;
    const vorher = await s.evaluate<string>(fn(GRIFF), [LANGE.name, "1px", null]);
    expect(vorher, "K2: der Hilfesatz zur langen Anweisung ist nicht da").not.toBe(
      "KEIN HILFESATZ",
    );
    const gedeckelt = await messen("K2 · Hilfesatz auf 1 px");
    const satz = gedeckelt.hilfesaetze[2] as Stueck;
    console.info(
      `JOB 3584 · K2 · ${satz.texthoehe} px Text auf ${satz.sichthoehe} px Fläche · overflow=${satz.eigenrollen}`,
    );
    expect(
      satz.texthoehe,
      "K2: der Griff hat gar nicht gedeckelt — dann kalibriert dieser Fall nichts",
    ).toBeGreaterThan(satz.sichthoehe + 1);
    // Die Prüfung selbst, nicht nur die Zahl: beide Wege, die den Satz anfassen, MÜSSEN rot werden.
    expect(
      () => ganzLesbar(satz, "der Hilfesatz der langen Anweisung", "K2"),
      "K2: `ganzLesbar` lässt 155 px Text auf 1 px Fläche durch — genau die Lücke aus Runde 1",
    ).toThrow();
    expect(
      () => paletteTexteLesbar(gedeckelt, "K2"),
      "K2: die Textprüfung von B1a lässt den gedeckelten Satz durch",
    ).toThrow();
    // Zurück auf den echten Produktzustand, und er hält.
    await s.evaluate(fn(GRIFF), [LANGE.name, null, vorher]);
    const zurueck = await messen("K2 · nach Rücknahme");
    paletteTexteLesbar(zurueck, "K2 · nach Rücknahme");
  }, 120_000);

  // ==============================================================================================
  // K3 · DIE KALIBRIERUNG DER ERREICHBARKEIT — sonst hiesse „erreichbar" nur „scrollIntoView wurde
  // gerufen".
  // ==============================================================================================
  //
  // B1b sagt: jedes Stück ist durch senkrechtes Rollen GANZ hereinzuholen. Diese Zusage kann nur
  // etwas wert sein, wenn sie an einem Stück bricht, das ein NICHT rollbarer Rand festhält.
  //
  // WO DER DECKEL SITZEN MUSS, UND WARUM NICHT AUF DER PALETTE. Der erste Versuch deckelte die
  // Palettenwurzel (`height:60px; overflow:hidden`) — und die Prüfung blieb zu Recht GRÜN: der
  // Ausführen-Knopf kam trotzdem ins Bild, weil INNERHALB der Palette eine eigene rollbare Fläche
  // sitzt (`overflow-auto`, gemessen: 320 px Sicht). Sie holte ihn heran, der Deckel machte nichts
  // unerreichbar. Gemessen war die Lage also richtig — der Griff war falsch. Deshalb sitzt der
  // Deckel jetzt auf GENAU dieser rollbaren Fläche: sie wird gesucht (nicht geraten), auf feste
  // Höhe gesetzt und ihres Rollens beraubt. Erst dann ist wirklich fort, was darunter liegt.
  it("K3 · 390 px: hält ein NICHT rollbarer Deckel den Ausführen-Knopf, IST die Erreichbarkeit rot", async () => {
    await paletteOeffnen(390);
    const s = seite();
    // DIE RÜCKNAHME SUCHT NICHT NOCH EINMAL. Gesucht wird die Fläche an ihrem `overflow` — und genau
    // das hat der Deckel verstellt; beim Zurücknehmen fände die Suche sie deshalb nicht mehr und
    // liesse den Deckel stehen. So ist dieser Fall im vorigen Lauf rot geworden („K3 · nach
    // Rücknahme: … [{"marke":"DIV.max-h-[420px] …","px":462}]"). Deshalb trägt die gedeckelte Fläche
    // eine Marke, und die Rücknahme greift sie daran.
    const DECKEL = `([hoehe, alt]) => {
      if (hoehe === null) {
        const g = document.querySelector('[data-k3-deckel]');
        if (!g) { return 'KEIN DECKEL'; }
        if (alt) { g.setAttribute('style', alt); } else { g.removeAttribute('style'); }
        g.removeAttribute('data-k3-deckel');
        return 'ZURUECK';
      }
      const p = document.querySelector('[data-testid="blatt-menue-ki"]');
      const feld = p ? p.querySelector('input') : null;
      if (!feld) { return 'KEIN FELD'; }
      let roll = null;
      for (let x = feld.parentElement; x && p.contains(x); x = x.parentElement) {
        const wie = getComputedStyle(x).overflowY;
        if (wie === 'auto' || wie === 'scroll') { roll = x; break; }
      }
      if (!roll) { return 'KEINE ROLLFLAECHE'; }
      const gesichert = roll.getAttribute('style') || '';
      roll.setAttribute('data-k3-deckel', '1');
      roll.style.height = hoehe; roll.style.maxHeight = hoehe; roll.style.overflow = 'hidden';
      return gesichert;
    }`;
    const vorher = await s.evaluate<string>(fn(DECKEL), ["60px", null]);
    expect(
      ["KEIN FELD", "KEINE ROLLFLAECHE"],
      "K3: die rollbare Fläche der Palette war nicht zu finden — der Griff greift ins Leere",
    ).not.toContain(vorher);
    await expect(
      senkrechtErreichbar("knopf", "der Ausführen-Knopf", "K3", (x) => x.knopf),
      "K3: der Ausführen-Knopf gilt unter einem nicht rollbaren Deckel als erreichbar — dann misst B1b nichts",
    ).rejects.toThrow();
    const weg = await s.evaluate<string>(fn(DECKEL), [null, vorher]);
    expect(weg, "K3: der Deckel liess sich nicht zurücknehmen").toBe("ZURUECK");
    // Und ohne den Deckel ist er wieder erreichbar — der Fall hat die Seite nicht zerstört.
    await senkrechtErreichbar(
      "knopf",
      "der Ausführen-Knopf",
      "K3 · nach Rücknahme",
      (x) => x.knopf,
    );
  }, 120_000);

  // ==============================================================================================
  // K4 · DIE KALIBRIERUNG DER ROLLBAREN BESCHNEIDUNG — die Gegenprobe, an der RUNDE 2 grün blieb.
  // ==============================================================================================
  //
  // Der Prüfer hat die vorhandene Rollfläche der Palette (`Menue.tsx:346`) auf `height:1px;
  // max-height:1px; padding:0; overflow:auto` gestellt — sie blieb ROLLBAR, zeigte vom 155 px hohen
  // Hilfesatz aber einen 1-px-Streifen — und meldete wörtlich: „BEN GEGENPROBE: B1a und B1b grün
  // trotz {"hoehe":155.3,"oben":209.5,"unten":364.8,"verluste":[{"marke":"DIV.max-h-[420px] w-[320px]
  // max-w-full overf","richtung":"senkrecht","px":77.5,"rollbar":true}]}". Runde 2 hat jeden Rand mit
  // `rollbar:true` entschuldigt, auch NACH dem Heranrollen; genau das ist behoben.
  //
  // DIESER FALL IST DIE PROBE DARAUF, und er nimmt beide Wege mit, die Runde 2 zu lax hatte: den
  // Erreichbarkeitsmesser (`ganzInDerSchnittflaeche`, für den Hilfesatz) und den Fokusmesser
  // (`fokusLage`, für den Ausführen-Knopf). 20 px statt 1 px, damit die Fläche unbestreitbar rollbar
  // BLEIBT (`overflow:auto` mit mehr Inhalt als Sicht) und trotzdem weder den 155 px hohen Satz noch
  // den ~36 px hohen Knopf je ganz zeigen kann. Bleibt hier etwas grün, misst B1b/B3 wieder nichts.
  it("K4 · 390 px: deckelt eine ROLLBARE Fläche das Stück, IST Erreichbarkeit UND Tabstopp rot", async () => {
    await paletteOeffnen(390);
    const s = seite();
    // Derselbe Bau wie K3 — nur dass `overflow` ausdrücklich `auto` BLEIBT. Die Rücknahme greift die
    // Fläche an ihrer Marke, nicht an ihrem `overflow`: gesucht würde sonst der verstellte Stand.
    const DECKEL = `([hoehe, alt]) => {
      if (hoehe === null) {
        const g = document.querySelector('[data-k4-deckel]');
        if (!g) { return 'KEIN DECKEL'; }
        if (alt) { g.setAttribute('style', alt); } else { g.removeAttribute('style'); }
        g.removeAttribute('data-k4-deckel');
        return 'ZURUECK';
      }
      const p = document.querySelector('[data-testid="blatt-menue-ki"]');
      const feld = p ? p.querySelector('input') : null;
      if (!feld) { return 'KEIN FELD'; }
      let roll = null;
      for (let x = feld.parentElement; x && p.contains(x); x = x.parentElement) {
        const wie = getComputedStyle(x).overflowY;
        if (wie === 'auto' || wie === 'scroll') { roll = x; break; }
      }
      if (!roll) { return 'KEINE ROLLFLAECHE'; }
      const gesichert = roll.getAttribute('style') || '';
      roll.setAttribute('data-k4-deckel', '1');
      roll.style.height = hoehe; roll.style.maxHeight = hoehe; roll.style.overflow = 'auto';
      return gesichert;
    }`;
    const vorher = await s.evaluate<string>(fn(DECKEL), ["20px", null]);
    expect(
      ["KEIN FELD", "KEINE ROLLFLAECHE"],
      "K4: die rollbare Fläche der Palette war nicht zu finden — der Griff greift ins Leere",
    ).not.toContain(vorher);
    // DER GRIFF HAT GETAN, WAS ER SOLL — gemessen, bevor irgendetwas rot sein darf: die Fläche rollt
    // wirklich noch (`auto` UND mehr Inhalt als Sicht). Wäre sie nicht mehr rollbar, kalibrierte
    // dieser Fall bloss ein zweites Mal K3.
    const zustand = await s.evaluate<{ wie: string; sicht: number; inhalt: number }>(
      fn(
        `() => { const g = document.querySelector('[data-k4-deckel]'); return { wie: getComputedStyle(g).overflowY, sicht: g.clientHeight, inhalt: g.scrollHeight }; }`,
      ),
    );
    console.info(`JOB 3584 · K4 · Rollfläche ${JSON.stringify(zustand)}`);
    expect(["auto", "scroll"], "K4: die gedeckelte Fläche ist nicht mehr rollbar").toContain(
      zustand.wie,
    );
    expect(
      zustand.inhalt,
      `K4: die gedeckelte Fläche hat nichts zu verbergen (${zustand.inhalt} px Inhalt auf ${zustand.sicht} px Sicht)`,
    ).toBeGreaterThan(zustand.sicht + 1);

    // (a) DER ERREICHBARKEITSMESSER. Der Hilfesatz wird herangerollt und bleibt trotzdem beschnitten
    //     — von einem Rand, den Runde 2 entschuldigt hätte. Die Zahlen stehen in der Ausgabe.
    const gerollt = await messen("K4 · Hilfesatz herangerollt", "hilfe:2");
    const satz = gerollt.hilfesaetze[2] as Stueck;
    expect(satz, "K4: der Hilfesatz der langen Anweisung ist nicht mehr da").not.toBeNull();
    const rollbarWeg = satz.verluste.filter((v) => v.rollbar);
    console.info(
      `JOB 3584 · K4 · Hilfesatz ${satz.hoehe} px, y=${satz.oben}–${satz.unten} · verluste ${JSON.stringify(satz.verluste)}`,
    );
    expect(
      rollbarWeg.length,
      `K4: nach dem Heranrollen schneidet kein ROLLBARER Rand mehr weg — dann ist dies nicht die Gegenprobe des Prüfers (${JSON.stringify(satz.verluste)})`,
    ).toBeGreaterThan(0);
    expect(
      () => ganzInDerSchnittflaeche(satz, "der Hilfesatz der langen Anweisung", "K4"),
      "K4: `ganzInDerSchnittflaeche` lässt einen rollbar beschnittenen Satz durch — genau die Lücke aus Runde 2",
    ).toThrow();
    await expect(
      senkrechtErreichbar(
        "hilfe:2",
        "der Hilfesatz der langen Anweisung",
        "K4",
        (x) => x.hilfesaetze[2] ?? null,
      ),
      "K4: der Hilfesatz gilt in einer 20 px hohen Rollfläche als erreichbar — dann misst B1b nichts",
    ).rejects.toThrow();

    // (b) DER FOKUSMESSER. Fokussiert wird echt (der Browser rollt dabei selbst heran, so weit er
    //     kann); gemessen wird derselbe `fokusLage`, den jeder Tabstopp in B3/B4 durchläuft.
    //
    //     WARUM DIE VORLAGE UND NICHT DER AUSFÜHREN-KNOPF. Der erste Versuch fokussierte den
    //     Ausführen-Knopf und wurde zu Recht rot: `K4: der Ausführen-Knopf liess sich nicht
    //     fokussieren: expected false to be true`. Bei leerem freien Feld ist er GESPERRT
    //     (`AiAssistBox.tsx:63`), und ein gesperrter Knopf nimmt keinen Fokus — dieselbe Tatsache,
    //     die schon `/api/reasoner/status` ins `skript` gezwungen hat. Die Vorlage mit dem langen
    //     Namen ist offen, 46 px hoch und genau der Tabstopp, den B3 anfährt.
    const fokussiert = await s.evaluate<boolean>(
      fn(
        `(n) => { const k = [...document.querySelectorAll('[data-testid="blatt-menue-ki"] button')].find((x) => (x.textContent || '').trim() === n); if (!k) { return false; } k.focus(); return document.activeElement === k; }`,
      ),
      LANGER_NAME,
    );
    expect(fokussiert, "K4: die lange Vorlage liess sich nicht fokussieren").toBe(true);
    const f = await s.evaluate<Fokus | null>(fn(FOKUS));
    expect(f, "K4: die fokussierte Vorlage meldet keine Lage").not.toBeNull();
    console.info(`JOB 3584 · K4 · Fokus ${JSON.stringify(f)}`);
    expect(
      () => fokusLage(f as Fokus, "K4: Tabstopp lange Vorlage", 390),
      "K4: `fokusLage` hält einen Knopf in einer 20 px hohen Rollfläche für einen gültigen Tabstopp — dann misst B3/B4 die Tastaturzusage nicht",
    ).toThrow();

    // Zurück auf den echten Produktzustand — und dort hält beides wieder.
    const weg = await s.evaluate<string>(fn(DECKEL), [null, vorher]);
    expect(weg, "K4: der Deckel liess sich nicht zurücknehmen").toBe("ZURUECK");
    await senkrechtErreichbar(
      "hilfe:2",
      "der Hilfesatz der langen Anweisung",
      "K4 · nach Rücknahme",
      (x) => x.hilfesaetze[2] ?? null,
    );
    await senkrechtErreichbar(
      "knopf",
      "der Ausführen-Knopf",
      "K4 · nach Rücknahme",
      (x) => x.knopf,
    );
    // Und derselbe Fokus, derselbe Messer: am echten Produktzustand hält er. Neu fokussiert, weil
    // die Zeilen darüber gerollt haben — der Browser rollt beim Fokussieren wieder selbst heran.
    const wiederFokussiert = await s.evaluate<boolean>(
      fn(
        `(n) => { const k = [...document.querySelectorAll('[data-testid="blatt-menue-ki"] button')].find((x) => (x.textContent || '').trim() === n); if (!k) { return false; } k.focus(); return document.activeElement === k; }`,
      ),
      LANGER_NAME,
    );
    expect(wiederFokussiert, "K4: nach der Rücknahme nimmt die Vorlage keinen Fokus").toBe(true);
    const zurueckFokus = await s.evaluate<Fokus | null>(fn(FOKUS));
    expect(zurueckFokus, "K4: nach der Rücknahme trägt nichts mehr den Fokus").not.toBeNull();
    fokusLage(zurueckFokus as Fokus, "K4 · nach Rücknahme: Tabstopp lange Vorlage", 390);
  }, 180_000);

  // ==============================================================================================
  // B5 · DER GESCHEITERTE VORLAGENABRUF, SCHMAL — und warum er GANZ ZUM SCHLUSS steht.
  // ==============================================================================================
  //
  // Die Bühne beantwortet `assist-presets` über ihr `skript` immer mit 200. Der FEHLER ist deshalb
  // eine zusätzliche Route auf derselben Seite; Playwright nimmt die ZULETZT eingetragene zuerst,
  // sie gilt also ab hier für den Rest des Laufs und lässt sich mit der schlanken `Seite` nicht
  // wieder abmelden. Darum ist dies der letzte messende Fall — jeder davor hat seine Vorlagen schon.

  /** Ab hier antwortet der Vorlagen-Endpunkt mit 500. Gilt für den Rest des Laufs. */
  async function vorlagenAbrufScheiternLassen(): Promise<void> {
    await seite().route(`${ORIGIN}/api/reasoner/assist-presets`, async (route) => {
      await route.fulfill({
        status: 500,
        body: JSON.stringify({ error: "ERROR", message: "Vorlagen nicht erreichbar" }),
        headers: { "content-type": "application/json" },
      });
    });
  }

  // ----------------------------------------------------------------------------------------------
  // B5a · CACHE MIT GESCHEITERTER AUFFRISCHUNG — die HÖCHSTE Palette, die es gibt.
  // ----------------------------------------------------------------------------------------------
  //
  // Der Auftrag verlangt in §9 ausdrücklich DIESE Lage („Vorlagen bleiben sichtbar UND der Satz kommt
  // darunter dazu — der Fall, der die Palette am HÖCHSTEN macht"), und der Prüfer hat sie an Runde 1
  // als offen benannt: dort wurde nur der leere Fehlerfall gemessen. Beides zusammen steht sonst
  // nirgends auf einer Fläche mit Layout.
  //
  // WARUM HIER 31 SEKUNDEN GEWARTET WIRD — und warum das nicht abzukürzen ist. Dieser Zustand
  // entsteht NUR echt: der Bestand muss im Speicher von react-query liegen UND eine AUFFRISCHUNG
  // muss scheitern. Aufgefrischt wird beim Aufbau der Fläche erst, wenn der Bestand nicht mehr als
  // frisch gilt — `staleTime` steht app-weit auf `ZAEHLER_FRISCHE_MS` = 30 000 ms
  // (`main.tsx:43-45`, `lib/loadingState.ts:84`). Kürzer ginge nur, indem der Test die Uhr oder den
  // Speicher des Clients von aussen verstellt; dann misst er seinen eigenen Aufbau statt des
  // Produkts. Neu geladen werden darf ebenfalls nicht: ein `goto` wirft den Speicher weg, und
  // genau er IST der Fall. Also: Palette zu, warten, Palette auf — dieselbe Seite, derselbe Client.
  it("B5a · 390 px: Cache + gescheiterte Auffrischung — die Vorlagen BLEIBEN und der Satz kommt dazu", async () => {
    await paletteOeffnen(390);
    const s = seite();
    await vorlagenAbrufScheiternLassen();
    await s.evaluate(fn("() => new Promise((r) => setTimeout(r, 31000))"));
    const KLICK = `() => { document.querySelector('[data-testid="blatt-werkzeug-ki"]').click(); }`;
    await s.evaluate(fn(KLICK));
    await s.waitForFunction(
      fn(`() => document.querySelector('[data-testid="blatt-menue-ki"]') === null`),
      undefined,
      { timeout: 20_000 },
    );
    await s.evaluate(fn(KLICK));
    await s.waitForFunction(
      fn(
        `() => { const p = document.querySelector('[data-testid="blatt-menue-ki"]'); return !!p && p.querySelector('[data-testid="ki-vorlagen-fehler"]') !== null; }`,
      ),
      undefined,
      { timeout: 30_000 },
    );
    const m = await messen("B5a · Cache + gescheiterte Auffrischung");
    const lage = "B5a · 390";
    // DAS Zustandsmodell aus §7 der Regeln: die zuletzt erfolgreich geholten Werte bleiben SICHTBAR.
    for (const [i, name] of NAMEN.entries()) {
      expect(
        m.vorlagen[i],
        `${lage}: die Vorlage „${name}" wurde bei der gescheiterten Auffrischung geleert`,
      ).not.toBeNull();
    }
    const satz = waagerechtImFenster(m.satz, "der Satz unter den Vorlagen", m, lage);
    expect(satz.text.length, `${lage}: der Satz ist leer`).toBeGreaterThan(10);
    ganzLesbar(satz, "der Satz unter den Vorlagen", lage);
    // Und in dieser höchsten Lage hält die ganze Zusage: waagerecht nichts hinaus, jeder Text ganz
    // da, jedes Stück senkrecht zu erreichen.
    paletteWaagerecht(m, lage);
    paletteTexteLesbar(m, lage);
    // GEMESSEN, nicht behauptet: die Palette wird in dieser Lage NICHT höher — sie ist gedeckelt,
    // der zusätzliche Satz landet in ihrer eigenen rollbaren Fläche. Genau deshalb steht hier eine
    // Zahl und kein Superlativ.
    console.info(
      `JOB 3584 · ${lage} · Palette ${m.palette?.hoehe} px hoch im ${m.fensterhoehe} px hohen Fenster · ` +
        `Seite ${m.seitenhoehe} px · Satz y=${m.satz?.oben}–${m.satz?.unten}`,
    );
    for (const st of STUECKE) {
      await senkrechtErreichbar(st.heran, st.was, lage, st.hol);
    }
    await senkrechtErreichbar("satz", "der Satz unter den Vorlagen", lage, (x) => x.satz);
  }, 180_000);

  it("B5b · 390 px: scheitert der Vorlagenabruf ganz, steht der Satz im Fenster und verdrängt nichts", async () => {
    const s = seite();
    await vorlagenAbrufScheiternLassen();
    // Hier darf und muss OHNE Vorlagen gewartet werden — sie kommen nicht, das ist der Fall. Der
    // `goto` in `paletteOeffnen` wirft den Speicher weg; deshalb steht dieser Fall NACH B5a.
    await paletteOeffnen(390, false);
    await s.waitForFunction(
      fn(`() => document.querySelector('[data-testid="ki-vorlagen-fehler"]') !== null`),
      undefined,
      { timeout: 20_000 },
    );
    const m = await messen("B5b · Vorlagenfehler");
    const lage = "B5b · 390";
    const satz = waagerechtImFenster(m.satz, "der Satz zum gescheiterten Vorlagenabruf", m, lage);
    expect(satz.text.length, `${lage}: der Satz ist leer`).toBeGreaterThan(10);
    ganzLesbar(satz, "der Satz zum gescheiterten Vorlagenabruf", lage);
    // Er verdrängt weder Eingabe noch Knopf: beide stehen weiterhin ganz im Fenster, UNTER ihm.
    const feld = waagerechtImFenster(m.feld, "die freie Eingabe", m, lage);
    const knopf = waagerechtImFenster(m.knopf, "der Ausführen-Knopf", m, lage);
    expect(
      feld.breite,
      `${lage}: die freie Eingabe ist auf ${feld.breite} px zusammengedrückt`,
    ).toBeGreaterThan(100);
    expect(
      knopf.breite,
      `${lage}: der Ausführen-Knopf ist auf ${knopf.breite} px zusammengedrückt`,
    ).toBeGreaterThan(40);
    expect(
      m.seitenbreite,
      `${lage}: die SEITE läuft waagerecht über (scrollWidth=${m.seitenbreite} auf clientWidth=${m.fenster})`,
    ).toBeLessThanOrEqual(m.fenster + 1);
    // Die Vorlagen fehlen ehrlich — sie werden nicht erfunden.
    expect(
      m.vorlagen.filter((v) => v !== null),
      `${lage}: eine Vorlage steht trotz Fehler da`,
    ).toEqual([]);
  }, 120_000);

  it("P · die Seite hat während aller Messungen nichts geworfen", () => {
    expect(buehne().seitenfehler).toEqual([]);
  });
});

/** Warten, bis der Client den Assist-Lauf WIRKLICH hinausgeschickt hat. */
async function warteAufAnfrage(lage: string): Promise<void> {
  const s = seite();
  for (let i = 0; i < 60 && gesendet.length === 0; i++) {
    await s.evaluate(fn("() => new Promise((r) => setTimeout(r, 250))"));
  }
  expect(gesendet.length, `${lage}: es ging keine Assist-Anfrage hinaus`).toBeGreaterThan(0);
}
