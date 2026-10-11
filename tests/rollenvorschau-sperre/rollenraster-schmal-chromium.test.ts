import { afterAll, beforeAll, describe, expect, it } from "vitest";
// ================================================================================================
// JOB 3124 · UX-12 (Runde 2) — DIE SCHMALE FLÄCHE WIRD GEMESSEN, NICHT GERECHNET.
// ================================================================================================
//
// WARUM ES DIESE DATEI GIBT (BENs Korrekturpflicht 1 an Runde 1):
// Runde 1 hat die Zusage aus Lieferung 4 („bei 320 px und 390 px sind alle vier Namen vollständig
// lesbar") NICHT gemessen, sondern GERECHNET — aus den Breitenabzügen im Quelltext und einer
// oberen Schranke für die Zeichenbreite — und aus dieser Rechnung geschlossen, vollständige
// Lesbarkeit sei bei beiden Breiten unmöglich. BENs eigene Browsermessung hat das widerlegt: bei
// 390 px brach der Text im Knopf um und stand vollständig da. Die Rechnung war falsch, weil sie
// eine EINZEILIGE Textbreite mit dem Platzbedarf verwechselt: bei erlaubtem Umbruch (`break-words`,
// kein `whitespace-nowrap`) braucht der Text nicht die Breite seiner längsten Zeile, sondern nur
// die seines längsten unteilbaren Stücks — nach `break-words` ist das EIN Zeichen.
//
// Die Lehre daraus, wörtlich aus BENs Promptverbesserung: „Breitenrechnungen sind Hypothesen. Bei
// erlaubtem Textumbruch belegt eine zu geringe einzeilige Textbreite keine Unlesbarkeit."
//
// WAS HIER GEMESSEN WIRD: die GEBAUTE Anwendung (`apps/web/dist`) in Chromium, mit dem echten
// Fastify-Backend dahinter, bei 320 und bei 390 px — derselbe Weg wie
// `tests/profil-schmal/ux13-profil-320.test.ts`, nur an der Detailkarte „Ansicht als Rolle".
// Gemessen wird an jedem der vier Rollenknöpfe:
//   · der volle Name steht im Knopf (keine Ellipse, kein Rest im DOM, der nicht zu sehen ist),
//   · `scrollWidth <= clientWidth` — nichts läuft aus dem Knopf heraus,
//   · jede Textzeile liegt innerhalb des Inhaltskastens ihres Knopfes,
//   · keine zwei Knöpfe überlappen sich,
//   · die Seite bekommt keinen waagerechten Überlauf.
//
// DIE GEGENPROBE LÄUFT MIT (Fall S3): dieselbe Messung mit dem Vertrag, der den Schaden macht
// (`white-space: nowrap` samt Engpass, s. Nachtrag JOB 3155 bei der Störung in `MESSEN`), muss
// WIEDER rot werden. Ein Test, der auch mit abgeschnittenem Text grün bliebe, misst die falsche
// Sache.
//
// ================================================================================================
// RUNDE 4 — DER TASTATURWEG WIRD JETZT GEGANGEN, NICHT NACHGEBILDET (Fälle T1–T3).
// ================================================================================================
//
// Die verbliebene Prüflücke der Runden 1–3 (BENs Prüflücke 6, in jeder Rückgabe offen genannt):
// Lieferung 2 verspricht einen Rückweg, der „per Tab erreichbar, mit sichtbarem Fokus, mit Enter UND
// Leertaste auslösbar" ist — belegt war das bis hierher nur in jsdom. jsdom hat aber weder eine
// Tabreihenfolge noch eine Standardaktivierung von `<button>`: `sperrkarte-sagt-vorschau-mounted`
// muss den Fokus selbst setzen und das Klickereignis selbst auslösen. Das prüft, dass der Aufruf am
// Knopf hängt — nicht, dass die TASTATUR ihn erreicht. Genau das ist der Unterschied zwischen einem
// `<button>` und einem `<div onClick tabIndex={-1}>`, und genau die Halbheit nennt der Auftrag
// („ein Rückweg, der nur mit der Maus geht").
//
// Hier drückt Chromium selbst: echte `Tab`-Anschläge bis der Knopf den Fokus hat, echtes `Enter`,
// echte `Leertaste` — an der gebauten Anwendung, im selben Browser wie die Breitenmessung (eine
// Instanz je Messdatei; s. Kopf von `tests/design/h6-chromium.ts`). Der Weg ist der echte: im
// Raster „Betrachter" wählen, worauf der Rollen-Guard `/admin` wegnimmt und die Sperrkarte steht.
import { ROLES } from "../../apps/web/src/app/navigation";
import i18n from "../../apps/web/src/i18n";
import { ADMIN_SECTIONS } from "../../apps/web/src/lib/adminSections";
import {
  type Seite,
  type Stand,
  fn,
  schattenLagen,
  setzeSprache,
  starte,
  wechsle,
} from "../design/h6-chromium";
import { schliesseChromium } from "../tor-bereitschaft/chromium-abbau";

/** Die vollen Rollennamen (`role.name.*`, de) in der Reihenfolge von `ROLES`. */
const NAMEN = ROLES.map((rolle) => i18n.t(`role.name.${rolle}`, { lng: "de" }));
/**
 * Der Reiter, unter dem die Zeile „Ansicht als Rolle" wohnt — das ERSTE Thema der Verwaltung.
 *
 * JOB 3337: hier stand „Konten" als Zeichenkette. Seit Pedis Auftrag vom 08.09. heißt dieses Thema
 * „Benutzer und Rollen", und der Griff unten sucht den Reiter über einen ZEICHENGLEICHEN Vergleich
 * (`norm(b.textContent) === reiterName`) — eine abgeschriebene Beschriftung hätte diese Messung
 * ohne eigenes Verschulden rot gemacht. Der Name wird deshalb aus derselben Quelle gelesen, aus der
 * die Fläche ihn zeichnet; die Zeile selbst ist unverändert dort zu Hause.
 */
const REITER = i18n.t(ADMIN_SECTIONS[0].labelKey, { lng: "de" });

interface Kasten {
  x: number;
  y: number;
  breite: number;
  hoehe: number;
  rechts: number;
  unten: number;
}
interface Knopfmass {
  text: string;
  klasse: string;
  clientWidth: number;
  scrollWidth: number;
  rect: Kasten;
  /** Die Zeilenkästen des Textes — mehr als einer heißt: umbrochen, nicht abgeschnitten. */
  zeilen: Kasten[];
  /** Wie weit die breiteste Textzeile über den Inhaltskasten hinausragt (0 = gar nicht). */
  ueberlaufPx: number;
  whiteSpace: string;
  textOverflow: string;
  overflowWrap: string;
  fontSize: string;
}
interface Messung {
  fehler: string | null;
  viewport: number;
  dokumentScrollWidth: number;
  rasterKlasse: string;
  rasterBreite: number;
  /** `grid-template-columns` des Rasters, wie Chromium es aufgelöst hat — eine Angabe = einspaltig. */
  rasterSpalten: string;
  knoepfe: Knopfmass[];
}

/** Setzt die Fensterbreite — die Bühne aus `h6-chromium.ts` reicht die Seite roh durch. */
interface SeiteMitViewport {
  setViewportSize(size: { width: number; height: number }): Promise<void>;
}
/** Echte Tastenanschläge des Browsers (Playwright) — dieselbe rohe Seite. */
interface SeiteMitTastatur {
  keyboard: { press(taste: string): Promise<void> };
}

/** Was gerade den Fokus hat — der Beleg, dass die Tabreihenfolge den Knopf WIRKLICH erreicht. */
interface Fokus {
  tag: string;
  typ: string;
  text: string;
  /** Liegt das fokussierte Element im Vorschauhinweis der Sperrkarte? */
  imHinweis: boolean;
  /**
   * DER FOKUSRING IST EIN `box-shadow`, KEIN `outline` — und das ist gemessen, nicht gelesen.
   *
   * Der erste Anlauf dieser Runde hat den Umriss zugesichert (`outline-style`/`outline-width`) und
   * war GRÜN. Er war es zu Unrecht: die eine Fokusregel des Produkts (`apps/web/src/index.css`,
   * Scheibe D-024) lautet `@apply outline-none ring-2 ring-brand/60 …` — sie schaltet den Umriss
   * ABSICHTLICH ab und zeichnet stattdessen einen Ring, und `outline-none` von Tailwind heisst
   * `outline: 2px solid transparent`. Stil „solid" und Breite „2px" standen also da, während die
   * Farbe `rgba(0, 0, 0, 0)` war — der Test hätte auch dann grün gemeldet, wenn niemand mehr etwas
   * sieht. Gemessen wird deshalb die Eigenschaft, die den Ring wirklich trägt.
   */
  boxShadow: string;
}
/** Der Zustand der Fläche: Sperrkarte mit Hinweis — oder wieder die Einstellungen. */
interface Lage {
  hinweisText: string | null;
  knopfText: string | null;
  /** Ein echtes `<button>` im Hinweis? (0 = keins — dann wäre es die Maus-Halbheit.) */
  echteKnoepfe: number;
  gateTitel: string | null;
  einstellungenDa: boolean;
  /** Auf der Sperrkarte darf NIE ein Rollenraster stehen (Auftrag §10). */
  rasterDa: boolean;
}

// ---- In der Seite: die Detailkarte öffnen und messen ---------------------------------------------
const MESSEN = `(async ([reiterName, nowrap, breite, timeout, namen, attrappe]) => {
  const start = Date.now();
  const norm = (s) => (s || '').replace(/\\s+/g, ' ').trim();
  const warte = async (pruefung, ms = 8000) => {
    const bis = Date.now() + ms;
    while (Date.now() < bis) {
      if (pruefung()) return true;
      await new Promise((r) => requestAnimationFrame(r));
    }
    return pruefung();
  };
  const leer = { viewport: 0, dokumentScrollWidth: 0, rasterKlasse: '', rasterBreite: 0, rasterSpalten: '', knoepfe: [] };

  // 1. Reiter „Konten" — dort wohnt die Zeile „Ansicht als Rolle".
  if (document.querySelector('[data-testid="zeile-ansicht-rolle"]') === null
      && document.querySelector('[data-testid="detail-ansicht-rolle"]') === null) {
    const zurueck = document.querySelector('[data-einst="zurueck"]');
    if (zurueck) { zurueck.click(); await warte(() => document.querySelector('[data-einst="detail"]') === null, 4000); }
    const r = [...document.querySelectorAll('[data-einst="reiter"]')].find((b) => norm(b.textContent) === reiterName);
    if (!r) return Object.assign({ fehler: 'Reiter „' + reiterName + '" nicht gefunden' }, leer);
    r.click();
    if (!(await warte(() => document.querySelector('[data-testid="zeile-ansicht-rolle"]') !== null)))
      return Object.assign({ fehler: 'Zeile „Ansicht als Rolle" erschien nicht' }, leer);
  }

  // 2. Detailkarte aufmachen (sie ist nach einem Breitenwechsel noch offen — dann nichts tun).
  if (document.querySelector('[data-testid="detail-ansicht-rolle"]') === null) {
    document.querySelector('[data-testid="zeile-ansicht-rolle"]').click();
    if (!(await warte(() => document.querySelector('[data-testid="detail-ansicht-rolle"]') !== null)))
      return Object.assign({ fehler: 'Detailkarte „Ansicht als Rolle" ging nicht auf' }, leer);
  }
  const karte = document.querySelector('[data-testid="detail-ansicht-rolle"]');

  // JOB 3448: JEDE Messung ohne Attrappen-Flagge stellt zuerst den Auslieferungszustand her — genau
  // wie der Kürzungsvertrag unten bei jedem Lauf ohne \`nowrap\` zurückgesetzt wird. Deshalb steht
  // das Abräumen VOR der Bereitschaftsprüfung: der Folgelauf soll die Produktrollen zählen, nicht
  // die Reste des vorigen Laufs. Fällt diese Rücknahme weg, wird der Folgelauf rot (Gegenprobe G4).
  if (!attrappe) {
    for (const alt of karte.querySelectorAll('[data-job3448-attrappe]')) alt.remove();
  }

  const layout = () => {
    const knoepfe = [...karte.querySelectorAll('button[aria-pressed]')];
    const raster = knoepfe[0]?.parentElement;
    const spalten = raster ? getComputedStyle(raster).gridTemplateColumns.split(' ') : [];
    const breiten = knoepfe.map(b => b.getBoundingClientRect().width);
    const hoehen = knoepfe.map(b => b.getBoundingClientRect().height);
    return { namen: knoepfe.map(b => norm(b.textContent)), viewport: window.innerWidth, rasterBreite: raster?.clientWidth ?? 0, spalten, breiten, hoehen };
  };
  if (!(await warte(() => {
    const ist = layout();
    // WAS DIESE ZAHL IST UND WAS NICHT (JOB 3448): sie kommt aus den Tailwind-Haltepunkten des
    // Rasters und ist eine Aussage über das CSS-RASTER — nicht über die Zahl der Rollen. Sie wird
    // hier ABSICHTLICH nicht aus dem gemessenen \`gridTemplateColumns\` abgeleitet: dann verglichen
    // sich zwei Namen derselben Messung, und die Gegenprobe „falsche Spaltenzahl" von JOB 3152
    // (\`t1b-raster.test.ts\`, \`repeat(4, 1fr)\` bei 320 px) würde grün, obwohl das Raster kaputt ist.
    // Dass das Raster auch bei WACHSENDER Rollenliste einspaltig bleibt, misst stattdessen S4.
    const spalten = breite >= 1024 ? 4 : breite >= 640 ? 2 : 1;
    return ist.viewport === breite && ist.rasterBreite > 0
      && ist.spalten.length === spalten && ist.spalten.every(s => parseFloat(s) > 0)
      && ist.breiten.length === namen.length && ist.breiten.every(b => b > 0) && ist.hoehen.every(h => h > 0);
  }, timeout))) {
    const ist = layout();
    return Object.assign({ fehler: 'Rollenraster nicht bereit: erwartet ' + namen.length
      + ' [' + namen.join(', ') + '], gefunden ' + ist.breiten.length + ' [' + ist.namen.join(', ')
      + '] · ' + (Date.now() - start) + 'ms · letzter Zustand: ' + JSON.stringify(ist) }, leer);
  }
  await document.fonts.ready;
  let knoepfe = [...karte.querySelectorAll('button[aria-pressed]')];

  // 2b. Nur für die Gegenprobe S4 (JOB 3448): einen zusätzlichen, gleichartigen Rollenknopf
  //     beistellen — die Prüfstandsattrappe einer sechsten Rolle. Sie wird aus einem echten Knopf
  //     geklont, damit sie dessen Klassen und damit sein Layoutverhalten trägt; ihr Text ist länger
  //     als jeder Produktname („Attrappe (Prüfstand)" statt „Administrator"), also der härtere Fall.
  //     AM PRODUKT ÄNDERT SICH NICHTS: \`ROLES\` bleibt unberührt, der Knopf lebt nur im DOM dieser
  //     Messung. Sie kommt NACH der Bereitschaftsprüfung, die weiterhin die Produktrollen zählt.
  if (attrappe && knoepfe.length > 0) {
    const vorlage = knoepfe[knoepfe.length - 1];
    const doppel = vorlage.cloneNode(true);
    doppel.setAttribute('data-job3448-attrappe', '1');
    doppel.textContent = 'Attrappe (Prüfstand)';
    vorlage.parentElement.append(doppel);
    await new Promise((r) => requestAnimationFrame(() => r(null)));
    knoepfe = [...karte.querySelectorAll('button[aria-pressed]')];
  }

  // 3. Nur für die Gegenprobe S3: den Vertrag einsetzen, der den Schaden macht — und ihn danach
  //    wieder abräumen. Jede Messung ohne Flagge stellt den Auslieferungszustand her.
  //
  //    JOB 3155 (UX-12b) — WARUM HIER SEIT DEM 07.09. AUCH EINE BREITE STEHT:
  //    Der Schaden, den JOB 3124 abgewehrt hat, hatte ZWEI Hälften — den Kürzungsvertrag UND den
  //    Engpass, in dem er zubiss: die Einstellungshülle liess dem Raster bei 320 px nur 30 px
  //    (gemessen, archiv/3124/runde-4/ben.md:26). JOB 3155 hat die zweite Hälfte beseitigt; das
  //    Raster misst bei 320 px jetzt 254 px, und dort passt „Administrator" auch mit nowrap
  //    einzeilig in den Knopf. Der Kürzungsvertrag ALLEIN kürzte deshalb nichts mehr, und diese
  //    Gegenprobe wurde grün, ohne dass sich an ihrer Aussage etwas geändert hätte — sie hätte ab
  //    da nur noch bewiesen, dass der Engpass weg ist, nicht mehr, dass die Messung Zähne hat.
  //    Die Gegenprobe stellt den Engpass deshalb selbst wieder her: 30 px, genau die gemessene
  //    Zahl von damals. Sie prüft damit weiter dasselbe wie vorher — würde das Raster den
  //    Kürzungsvertrag tragen, sähe der Nutzer „Administ…" statt des vollen Namens, und S1 wäre rot.
  for (const b of knoepfe) {
    b.style.whiteSpace = nowrap ? 'nowrap' : '';
    b.style.overflow = nowrap ? 'hidden' : '';
    b.style.textOverflow = nowrap ? 'ellipsis' : '';
    b.style.maxWidth = nowrap ? '30px' : '';
  }
  await new Promise((r) => requestAnimationFrame(() => r(null)));

  const kasten = (r) => ({ x: r.x, y: r.y, breite: r.width, hoehe: r.height, rechts: r.right, unten: r.bottom });
  const mass = knoepfe.map((b) => {
    const r = b.getBoundingClientRect();
    const s = getComputedStyle(b);
    const bereich = document.createRange();
    bereich.selectNodeContents(b);
    const zeilen = [...bereich.getClientRects()].map(kasten);
    // Der Inhaltskasten: Rahmen und Polster abgezogen — dort MUSS der Text liegen.
    const links = r.left + parseFloat(s.borderLeftWidth) + parseFloat(s.paddingLeft);
    const rechts = r.right - parseFloat(s.borderRightWidth) - parseFloat(s.paddingRight);
    let ueber = 0;
    for (const z of zeilen) {
      ueber = Math.max(ueber, z.rechts - rechts, links - z.x);
    }
    return {
      text: norm(b.textContent),
      klasse: String(b.getAttribute('class') || ''),
      clientWidth: b.clientWidth,
      scrollWidth: b.scrollWidth,
      rect: kasten(r),
      zeilen,
      ueberlaufPx: Math.round(Math.max(0, ueber) * 100) / 100,
      whiteSpace: s.whiteSpace,
      textOverflow: s.textOverflow,
      overflowWrap: s.overflowWrap,
      fontSize: s.fontSize,
    };
  });
  const raster = knoepfe[0].parentElement;
  return {
    fehler: null,
    viewport: window.innerWidth,
    dokumentScrollWidth: document.documentElement.scrollWidth,
    rasterKlasse: String(raster.getAttribute('class') || ''),
    rasterBreite: raster.clientWidth,
    rasterSpalten: String(getComputedStyle(raster).gridTemplateColumns || ''),
    knoepfe: mass,
  };
})`;

// ---- In der Seite: die Vorschau wirklich einschalten (Runde 4) ----------------------------------
// Kein `setRole` von aussen: gedrückt wird der Knopf, den auch ein Mensch drückt. Danach nimmt der
// Rollen-Guard (`routes.tsx`) die Seite `/admin` weg und die Sperrkarte steht da — derselbe Moment,
// den Pedi beschrieben hat.
const VORSCHAU_STARTEN = `(async ([reiterName, rollenName]) => {
  const norm = (s) => (s || '').replace(/\\s+/g, ' ').trim();
  const warte = async (pruefung, ms = 8000) => {
    const bis = Date.now() + ms;
    while (Date.now() < bis) {
      if (pruefung()) return true;
      await new Promise((r) => requestAnimationFrame(r));
    }
    return pruefung();
  };
  const r = [...document.querySelectorAll('[data-einst="reiter"]')].find((b) => norm(b.textContent) === reiterName);
  if (!r) return { fehler: 'Reiter „' + reiterName + '" nicht gefunden' };
  r.click();
  if (!(await warte(() => document.querySelector('[data-testid="zeile-ansicht-rolle"]') !== null)))
    return { fehler: 'Zeile „Ansicht als Rolle" erschien nicht' };
  document.querySelector('[data-testid="zeile-ansicht-rolle"]').click();
  if (!(await warte(() => document.querySelector('[data-testid="detail-ansicht-rolle"]') !== null)))
    return { fehler: 'Detailkarte „Ansicht als Rolle" ging nicht auf' };
  const karte = document.querySelector('[data-testid="detail-ansicht-rolle"]');
  const knopf = [...karte.querySelectorAll('button[aria-pressed]')].find((b) => norm(b.textContent) === rollenName);
  if (!knopf) return { fehler: 'Rollenknopf „' + rollenName + '" nicht gefunden' };
  knopf.click();
  if (!(await warte(() => document.querySelector('[data-testid="sperrkarte-vorschau"]') !== null)))
    return { fehler: 'die Sperrkarte zeigte den Vorschauhinweis nicht' };
  // Den Fokus wegräumen: nach dem Klick hinge er am gerade entfernten Rasterknopf. Die Tabreihen-
  // folge soll aus dem Nichts starten, sonst misst der Test seinen eigenen Startpunkt.
  if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
  return { fehler: null };
})`;

const FOKUS = `() => {
  const a = document.activeElement;
  const hinweis = document.querySelector('[data-testid="sperrkarte-vorschau"]');
  if (!a) return { tag: '', typ: '', text: '', imHinweis: false, boxShadow: '' };
  const s = getComputedStyle(a);
  return {
    tag: a.tagName.toLowerCase(),
    typ: String(a.getAttribute('type') || ''),
    text: (a.textContent || '').replace(/\\s+/g, ' ').trim(),
    imHinweis: hinweis !== null && hinweis.contains(a),
    boxShadow: s.boxShadow,
  };
}`;

/** Der `box-shadow` des Rückweg-Knopfes, OHNE dass er den Fokus hat — der Vergleichswert. */
const RING_OHNE_FOKUS = `() => {
  const b = document.querySelector('[data-testid="sperrkarte-vorschau"] button');
  return b ? getComputedStyle(b).boxShadow : '';
}`;

const LAGE = `() => {
  const norm = (s) => (s || '').replace(/\\s+/g, ' ').trim();
  const hinweis = document.querySelector('[data-testid="sperrkarte-vorschau"]');
  const knopf = hinweis ? hinweis.querySelector('button') : null;
  const titel = document.querySelector('h2');
  return {
    hinweisText: hinweis ? norm(hinweis.textContent) : null,
    knopfText: knopf ? norm(knopf.textContent) : null,
    echteKnoepfe: hinweis ? hinweis.querySelectorAll('button').length : 0,
    gateTitel: titel ? norm(titel.textContent) : null,
    einstellungenDa: document.querySelector('[data-einst="seite"]') !== null,
    rasterDa: document.querySelector('[data-testid="detail-ansicht-rolle"]') !== null,
  };
}`;

const WARTE_EINSTELLUNGEN = `() => document.querySelector('[data-einst="seite"]') !== null
  && document.querySelector('[data-testid="sperrkarte-vorschau"]') === null`;

// ---- N-0028 (BEN Nacharbeit 1): von der Sperrkarte „Zurück zum Start" — die Vorschau läuft weiter,
// und die Startseite muss das SELBST sagen, nicht erst das Zahnrad-Menü. ----------------------------
/** Den Link „Zurück zum Start" der Sperrkarte drücken und warten, bis `/start` steht. */
const ZUM_START = `(async ([zurueckText]) => {
  const norm = (s) => (s || '').replace(/\\s+/g, ' ').trim();
  const warte = async (pruefung, ms = 10000) => {
    const bis = Date.now() + ms;
    while (Date.now() < bis) {
      if (pruefung()) return true;
      await new Promise((r) => requestAnimationFrame(r));
    }
    return pruefung();
  };
  const link = [...document.querySelectorAll('a[href]')].find((a) => norm(a.textContent) === zurueckText);
  if (!link) return { fehler: 'kein Link „' + zurueckText + '" auf der Sperrkarte' };
  link.click();
  if (!(await warte(() => location.pathname === '/start'
      && document.querySelector('[data-testid="sperrkarte-vorschau"]') === null)))
    return { fehler: 'die Startseite kam nicht: ' + location.pathname };
  if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
  return { fehler: null };
})`;

/** Der Seitenhinweis auf einer erlaubten Seite — bei geschlossenem Zahnrad-Menü gelesen. */
interface SeitenLage {
  pfad: string;
  hinweisText: string | null;
  knopfText: string | null;
  echteKnoepfe: number;
  /** Ist der Zahnrad-Hinweis im DOM? Dann wäre das Menü offen, und der Fall bewiese nichts. */
  zahnradHinweisDa: boolean;
  /** Liegt der Seitenhinweis im Inhalt (`<main>`), nicht im Kopfband? */
  imMain: boolean;
  sprache: string;
  viewport: number;
  dokumentScrollWidth: number;
  knopf: Kasten | null;
  knopfClient: number;
  knopfScroll: number;
  sichtbar: boolean;
}
const SEITEN_LAGE = `() => {
  const norm = (s) => (s || '').replace(/\\s+/g, ' ').trim();
  const kasten = (r) => ({ x: r.x, y: r.y, breite: r.width, hoehe: r.height, rechts: r.right, unten: r.bottom });
  const hinweis = document.querySelector('[data-testid="seite-vorschau"]');
  const knopf = hinweis ? hinweis.querySelector('button') : null;
  const main = document.querySelector('main');
  const s = hinweis ? getComputedStyle(hinweis) : null;
  return {
    pfad: location.pathname,
    hinweisText: hinweis ? norm(hinweis.textContent) : null,
    knopfText: knopf ? norm(knopf.textContent) : null,
    echteKnoepfe: hinweis ? hinweis.querySelectorAll('button').length : 0,
    zahnradHinweisDa: document.querySelector('[data-testid="zahnrad-vorschau"]') !== null,
    imMain: hinweis !== null && main !== null && main.contains(hinweis),
    sprache: document.documentElement.lang,
    viewport: window.innerWidth,
    dokumentScrollWidth: document.documentElement.scrollWidth,
    knopf: knopf ? kasten(knopf.getBoundingClientRect()) : null,
    knopfClient: knopf ? knopf.clientWidth : 0,
    knopfScroll: knopf ? knopf.scrollWidth : 0,
    sichtbar: s !== null && s.display !== 'none' && s.visibility !== 'hidden'
      && hinweis.getBoundingClientRect().height > 0,
  };
}`;

/** Was den Fokus hat — bezogen auf den Seitenhinweis statt auf die Sperrkarte. */
const FOKUS_SEITE = `() => {
  const a = document.activeElement;
  const hinweis = document.querySelector('[data-testid="seite-vorschau"]');
  if (!a) return { tag: '', typ: '', text: '', imHinweis: false, boxShadow: '' };
  return {
    tag: a.tagName.toLowerCase(),
    typ: String(a.getAttribute('type') || ''),
    text: (a.textContent || '').replace(/\\s+/g, ' ').trim(),
    imHinweis: hinweis !== null && hinweis.contains(a),
    boxShadow: getComputedStyle(a).boxShadow,
  };
}`;

/** Nach dem Rückweg: das Zahnrad öffnen und die Admin-Zeile „Einstellungen" suchen, dann schliessen. */
const ADMIN_ZURUECK = `(async () => {
  const warte = async (pruefung, ms = 8000) => {
    const bis = Date.now() + ms;
    while (Date.now() < bis) {
      if (pruefung()) return true;
      await new Promise((r) => requestAnimationFrame(r));
    }
    return pruefung();
  };
  const zahnrad = document.querySelector('[data-testid="kopfband-zahnrad"]');
  if (!zahnrad) return { fehler: 'kein Zahnrad im Kopfband', admin: false };
  zahnrad.click();
  const admin = await warte(() => document.querySelector('[data-testid="zahnrad-einstellungen"]') !== null);
  zahnrad.click();
  return { fehler: null, admin };
})`;

/** Wo Hinweis und Rückweg-Knopf auf der Fläche liegen — für die schmalen Fälle (UX-12b/12c). */
interface Sicht {
  viewport: number;
  viewportHoehe: number;
  dokumentScrollWidth: number;
  sprache: string;
  hinweis: Kasten | null;
  hinweisClient: number;
  hinweisScroll: number;
  knopf: Kasten | null;
  knopfClient: number;
  knopfScroll: number;
}
const SICHT = `() => {
  const kasten = (r) => ({ x: r.x, y: r.y, breite: r.width, hoehe: r.height, rechts: r.right, unten: r.bottom });
  const hinweis = document.querySelector('[data-testid="sperrkarte-vorschau"]');
  const knopf = hinweis ? hinweis.querySelector('button') : null;
  return {
    viewport: window.innerWidth,
    viewportHoehe: window.innerHeight,
    dokumentScrollWidth: document.documentElement.scrollWidth,
    sprache: document.documentElement.lang,
    hinweis: hinweis ? kasten(hinweis.getBoundingClientRect()) : null,
    hinweisClient: hinweis ? hinweis.clientWidth : 0,
    hinweisScroll: hinweis ? hinweis.scrollWidth : 0,
    knopf: knopf ? kasten(knopf.getBoundingClientRect()) : null,
    knopfClient: knopf ? knopf.clientWidth : 0,
    knopfScroll: knopf ? knopf.scrollWidth : 0,
  };
}`;

let stand: Stand;
const messungen = new Map<number, Messung>();

async function messen(
  breite: number,
  nowrap = false,
  timeout = 8_000,
  attrappe = false,
): Promise<Messung> {
  const seite = stand.seite;
  if (seite === null) {
    throw new Error(`Bühne steht nicht: ${stand.fehler ?? "unbekannt"}`);
  }
  await (seite as unknown as SeiteMitViewport).setViewportSize({ width: breite, height: 740 });
  return await seite.evaluate<Messung>(fn(MESSEN), [
    REITER,
    nowrap,
    breite,
    timeout,
    NAMEN,
    attrappe,
  ]);
}

/** Die Seite roh — die Bühne reicht sie durch, ihr Typ nennt nur, was sie hier braucht. */
function seiteRoh(): Seite & SeiteMitViewport & SeiteMitTastatur {
  const seite = stand.seite;
  if (seite === null) {
    throw new Error(`Bühne steht nicht: ${stand.fehler ?? "unbekannt"}`);
  }
  return seite as unknown as Seite & SeiteMitViewport & SeiteMitTastatur;
}

/** Die Vorschau über den echten Rasterknopf einschalten, bis die Sperrkarte steht. */
async function vorschauStarten(rolle: string): Promise<void> {
  const seite = seiteRoh();
  await seite.setViewportSize({ width: 1280, height: 900 });
  // Frischer Seitenaufbau vor jedem Tastaturfall. Die Vorschaurolle ist reiner React-Zustand
  // (`app/RoleContext.tsx`: `useState`, nichts Persistiertes) — ein Neuladen setzt sie auf „admin"
  // zurück. So startet jeder Fall an derselben Stelle, statt davon abzuhängen, was die
  // Breitenmessung vorher offen gelassen hat.
  await wechsle(stand, "/admin", '[data-einst="seite"]');
  expect(stand.fehler, "die Adminansicht kam nach dem Neuladen nicht hoch").toBeNull();
  const r = await seite.evaluate<{ fehler: string | null }>(fn(VORSCHAU_STARTEN), [REITER, rolle]);
  expect(r.fehler, `Vorschau als „${rolle}" liess sich nicht einschalten`).toBeNull();
}

/**
 * So oft `Tab` drücken, bis der Rückweg-Knopf den Fokus hat — höchstens `max` Anschläge.
 * Gefunden = ein `<button>` INNERHALB des Vorschauhinweises. `schritte: -1` heisst: nie erreicht,
 * und genau das wäre die Halbheit „nur mit der Maus".
 */
async function tabBisRueckweg(max = 40): Promise<{ schritte: number; fokus: Fokus | null }> {
  const seite = seiteRoh();
  for (let i = 1; i <= max; i++) {
    await seite.keyboard.press("Tab");
    const f = await seite.evaluate<Fokus>(fn(FOKUS));
    if (f.imHinweis && f.tag === "button") {
      return { schritte: i, fokus: f };
    }
  }
  return { schritte: -1, fokus: null };
}

/** Überlappen sich zwei Kästen? (Berührung an der Kante zählt nicht.) */
function ueberlappt(a: Kasten, b: Kasten): boolean {
  return a.x < b.rechts && b.x < a.rechts && a.y < b.unten && b.y < a.unten;
}

/** Ein Protokollblock, damit die Zahlen in der Rückgabe nicht behauptet, sondern belegt sind. */
function protokoll(breite: number, m: Messung): string {
  const zeilen = m.knoepfe.map(
    (k) =>
      `    „${k.text}" — Knopf ${Math.round(k.rect.breite)} px, client ${k.clientWidth} px, ` +
      `scroll ${k.scrollWidth} px, ${k.zeilen.length} Textzeile(n), Überlauf ${k.ueberlaufPx} px`,
  );
  return [
    `  Viewport ${breite} px · Raster ${m.rasterBreite} px (${m.rasterKlasse}) · Spalten „${m.rasterSpalten}"`,
    `  document.scrollWidth ${m.dokumentScrollWidth} px`,
    ...zeilen,
  ].join("\n");
}

describe("JOB 3124 UX-12 · das Rollenraster bei 320 und 390 px, in Chromium gemessen", () => {
  beforeAll(async () => {
    stand = await starte("/admin", '[data-einst="seite"]', 320, 740);
    if (stand.fehler === null) {
      messungen.set(320, await messen(320));
      messungen.set(390, await messen(390));
    }
  }, 180_000);

  afterAll(async () => {
    try {
      await schliesseChromium(
        "tests/rollenvorschau-sperre/rollenraster-schmal-chromium.test.ts",
        stand?.browser,
      );
    } finally {
      await stand?.app?.close();
    }
  }, 60_000);

  it("S0 · die Bühne steht: gebaute App, echtes Backend, Chromium", () => {
    expect(stand.fehler, "Chromium-Bühne kam nicht hoch").toBeNull();
    expect(stand.seitenfehler, "die Seite hat selbst Fehler geworfen").toEqual([]);
    for (const breite of [320, 390]) {
      const m = messungen.get(breite);
      expect(m?.fehler, `Messung bei ${breite} px`).toBeNull();
      expect(m?.viewport, `Viewport bei ${breite} px`).toBe(breite);
      // eslint-disable-next-line no-console -- die Messwerte sind der Beleg der Rückgabe
      console.log(`JOB 3124 · Rollenraster gemessen:\n${protokoll(breite, m as Messung)}`);
    }
  });

  for (const breite of [320, 390]) {
    it(`S1 · bei ${breite} px stehen alle Rollennamen vollständig im Knopf`, () => {
      const m = messungen.get(breite) as Messung;
      expect(m.knoepfe.map((k) => k.text)).toEqual([...NAMEN]);
      for (const k of m.knoepfe) {
        // Kein Kürzungsvertrag — sonst steht im DOM der volle Name und auf der Fläche „Administ…".
        expect(k.whiteSpace, `„${k.text}": white-space verhindert den Umbruch`).not.toBe("nowrap");
        expect(k.textOverflow, `„${k.text}": text-overflow kürzt`).not.toBe("ellipsis");
        // Der Text liegt im Knopf — waagerecht wie senkrecht.
        expect(
          k.scrollWidth,
          `„${k.text}" läuft waagerecht aus dem Knopf: scrollWidth ${k.scrollWidth} > clientWidth ${k.clientWidth}`,
        ).toBeLessThanOrEqual(k.clientWidth);
        expect(
          k.ueberlaufPx,
          `„${k.text}": die Textzeilen ragen ${k.ueberlaufPx} px über den Inhaltskasten hinaus`,
        ).toBeLessThanOrEqual(0.5);
      }
    });

    it(`S2 · bei ${breite} px überlappt kein Knopf einen anderen, die Seite läuft nicht über`, () => {
      const m = messungen.get(breite) as Messung;
      for (let i = 0; i < m.knoepfe.length; i++) {
        for (let j = i + 1; j < m.knoepfe.length; j++) {
          const a = m.knoepfe[i] as Knopfmass;
          const b = m.knoepfe[j] as Knopfmass;
          expect(ueberlappt(a.rect, b.rect), `„${a.text}" und „${b.text}" überlappen sich`).toBe(
            false,
          );
        }
      }
      expect(
        m.dokumentScrollWidth,
        `die Seite läuft bei ${breite} px waagerecht über (${m.dokumentScrollWidth} px)`,
      ).toBeLessThanOrEqual(breite);
    });
  }

  it("S3 · Gegenprobe: mit dem Kürzungsvertrag wird dieselbe Messung wieder rot", async () => {
    const kaputt = await messen(320, true);
    expect(kaputt.fehler).toBeNull();
    const ueberlaeufe = kaputt.knoepfe.filter((k) => k.scrollWidth > k.clientWidth);
    expect(
      ueberlaeufe.length,
      "mit white-space:nowrap + ellipsis im 30-px-Engpass müsste der Text kürzen — der Test misst sonst die falsche Sache",
    ).toBeGreaterThan(0);
    // Und die Kürzung ist auch WIRKLICH die, gegen die S1 sich wehrt: sichtbar gekürzt statt
    // umbrochen. Ohne diese Zeile bewiese die Gegenprobe nur „irgendetwas passt nicht mehr".
    for (const k of kaputt.knoepfe) {
      expect(k.whiteSpace, `„${k.text}": die Störung setzte den Kürzungsvertrag nicht`).toBe(
        "nowrap",
      );
      expect(k.textOverflow, `„${k.text}": die Störung setzte die Ellipse nicht`).toBe("ellipsis");
    }
    // Und der gesunde Zustand kommt zurück, sobald die eingesetzte Störung weg ist.
    const geheilt = await messen(320);
    for (const k of geheilt.knoepfe) {
      expect(k.scrollWidth, `„${k.text}" nach der Gegenprobe`).toBeLessThanOrEqual(k.clientWidth);
      expect(k.whiteSpace, `„${k.text}": die Störung wurde nicht abgeräumt`).not.toBe("nowrap");
    }
  }, 120_000);

  // ================================================================================================
  // JOB 3448 · S4 — WÄCHST DIE ROLLENLISTE, IST DIE SPALTENLAGE GEMESSEN STATT ANGENOMMEN.
  // ================================================================================================
  // Die Bereitschaftsprüfung in `MESSEN` erwartet die Spaltenzahl aus den Tailwind-Haltepunkten
  // (`:186`) — sie ist eine Aussage über das CSS-Raster, NICHT über die Zahl der Rollen. Eine sechste
  // Rolle liefe deshalb in dieselbe Prüfung, ohne dass ein Fall belegt, dass das Raster bei 320 px
  // noch einspaltig passt. S4 stellt dem Raster einen zusätzlichen, gleichartigen
  // `button[aria-pressed]` bei (dieselbe Technik wie die Störung in S3) und misst dieselben drei
  // Zusagen wie S1/S2 an der vergrößerten Liste. AM PRODUKT ÄNDERT SICH NICHTS: `ROLES` bleibt, wie
  // es ist; der zusätzliche Knopf ist eine Prüfstandsattrappe im DOM, und der Folgelauf belegt, dass
  // sie wieder weg ist.
  it("S4 · Gegenprobe: mit einem zusätzlichen Rollenknopf bleibt das Raster bei 320 px einspaltig", async () => {
    const gross = await messen(320, false, 8_000, true);
    expect(gross.fehler).toBeNull();
    expect(
      gross.knoepfe.map((k) => k.text),
      "die Attrappe wurde nicht mitgemessen",
    ).toHaveLength(NAMEN.length + 1);
    // Einspaltig, an zwei unabhängigen Merkmalen gemessen: das Raster nennt EINE Spalte …
    expect(
      gross.rasterSpalten.trim().split(/\s+/),
      `das Raster meldet mehr als eine Spalte: „${gross.rasterSpalten}"`,
    ).toHaveLength(1);
    // … und alle Knöpfe stehen an derselben linken Kante.
    expect(
      new Set(gross.knoepfe.map((k) => k.rect.x)).size,
      "die Knöpfe stehen nicht alle an derselben linken Kante",
    ).toBe(1);
    for (let i = 0; i < gross.knoepfe.length; i++) {
      for (let j = i + 1; j < gross.knoepfe.length; j++) {
        const a = gross.knoepfe[i] as Knopfmass;
        const b = gross.knoepfe[j] as Knopfmass;
        expect(ueberlappt(a.rect, b.rect), `„${a.text}" und „${b.text}" überlappen sich`).toBe(
          false,
        );
      }
    }
    expect(
      gross.dokumentScrollWidth,
      `die Seite läuft mit ${gross.knoepfe.length} Knöpfen waagerecht über (${gross.dokumentScrollWidth} px)`,
    ).toBeLessThanOrEqual(320);
    // eslint-disable-next-line no-console -- die Messwerte sind der Beleg der Rückgabe
    console.log(`JOB 3448 · S4 mit Attrappe:\n${protokoll(320, gross)}`);

    // Und der Auslieferungszustand kommt zurück: der Folgelauf sieht wieder genau die Produktrollen.
    const zurueck = await messen(320);
    expect(zurueck.fehler, "die Attrappe wurde nicht abgeräumt").toBeNull();
    expect(zurueck.knoepfe.map((k) => k.text)).toEqual([...NAMEN]);
  }, 120_000);

  // ==============================================================================================
  // T1–T3 (Runde 4) — DER RÜCKWEG, MIT ECHTER TASTATUR GEDRÜCKT.
  // ==============================================================================================
  // Läuft NACH den Breitenfällen und stellt am Ende jedes Falls die Admin-Ansicht wieder her, damit
  // kein Fall den nächsten in einem fremden Zustand vorfindet.
  describe("der Rückweg auf der Sperrkarte", () => {
    it("T1 · die Sperrkarte trägt Vorschausatz und Rückweg-Knopf, ohne Rollenraster", async () => {
      await vorschauStarten("Betrachter");
      const lage = await seiteRoh().evaluate<Lage>(fn(LAGE));
      expect(lage.gateTitel, "die Sperrkarte des Rollen-Tors steht nicht").toBe(
        "Dieser Bereich gehört einer anderen Rolle",
      );
      expect(lage.hinweisText).toContain("Vorschau als Betrachter");
      expect(lage.hinweisText).toContain("du bleibst Admin");
      expect(lage.knopfText).toBe("Zur Admin-Ansicht");
      // Ein echtes <button>, kein <div onClick> — sonst gäbe es den Tastaturweg gar nicht.
      expect(lage.echteKnoepfe, "der Rückweg ist kein echtes <button>").toBe(1);
      // Auftrag §10: auf der Sperrkarte steht der Rückweg zur EIGENEN Rolle, nie ein Rollenraster.
      expect(lage.rasterDa, "auf der Sperrkarte steht ein Rollenraster").toBe(false);
      expect(
        lage.einstellungenDa,
        "die Einstellungsseite steht noch — die Sperre griff nicht",
      ).toBe(false);
      // eslint-disable-next-line no-console -- der Beleg der Rückgabe
      console.log(`JOB 3124 · Sperrkarte in Chromium: „${lage.hinweisText}"`);
    }, 120_000);

    it("T2 · Tab erreicht den Knopf mit sichtbarem Fokus, Enter stellt die Adminansicht her", async () => {
      await vorschauStarten("Betrachter");
      // Der Vergleichswert VOR dem Fokus: ohne ihn wüsste niemand, ob der Ring vom Fokus kommt.
      const ohneFokus = await seiteRoh().evaluate<string>(fn(RING_OHNE_FOKUS));
      const { schritte, fokus } = await tabBisRueckweg();
      expect(
        schritte,
        "der Rückweg-Knopf war in 40 Tab-Anschlägen nicht erreichbar — das ist die Halbheit: nur mit der Maus",
      ).toBeGreaterThan(0);
      expect(fokus?.text).toBe("Zur Admin-Ansicht");
      expect(fokus?.typ, "ohne type=button löst der Knopf in einem Formular ein Absenden aus").toBe(
        "button",
      );
      // SICHTBARER FOKUS, an der Eigenschaft gemessen, die ihn trägt: `schattenLagen` wirft jede
      // vollständig durchsichtige Lage weg (Tailwind schiebt zwei solche Platzhalter davor). Übrig
      // bleibt nur, was Chromium wirklich zeichnet.
      const lagenOhne = schattenLagen(ohneFokus);
      const lagenMit = schattenLagen(fokus?.boxShadow ?? "");
      expect(
        lagenMit.length,
        `der fokussierte Knopf zeichnet keinen sichtbaren Ring (box-shadow: ${fokus?.boxShadow})`,
      ).toBeGreaterThan(0);
      expect(
        lagenMit.length,
        "der Ring hängt nicht am Fokus — ohne Fokus sieht der Knopf genauso aus",
      ).toBeGreaterThan(lagenOhne.length);
      // eslint-disable-next-line no-console -- der Beleg der Rückgabe
      console.log(
        `JOB 3124 · Rückweg per Tastatur: ${schritte} Tab-Anschläge · Ring ohne Fokus ${lagenOhne.length} Lage(n), mit Fokus ${lagenMit.length}: ${lagenMit.map((l) => `rgba(${l.farbe}) ${l.masse.join("/")}`).join(" + ")}`,
      );

      await seiteRoh().keyboard.press("Enter");
      await seiteRoh().waitForFunction(fn(WARTE_EINSTELLUNGEN), undefined, { timeout: 10_000 });
      const danach = await seiteRoh().evaluate<Lage>(fn(LAGE));
      expect(danach.einstellungenDa, "nach Enter kam die Adminansicht nicht zurück").toBe(true);
      expect(danach.hinweisText, "der Vorschausatz steht noch da").toBeNull();
    }, 120_000);

    it("T3 · derselbe Knopf reagiert auch auf die Leertaste", async () => {
      await vorschauStarten("Betrachter");
      const { schritte } = await tabBisRueckweg();
      expect(schritte).toBeGreaterThan(0);
      await seiteRoh().keyboard.press("Space");
      await seiteRoh().waitForFunction(fn(WARTE_EINSTELLUNGEN), undefined, { timeout: 10_000 });
      const danach = await seiteRoh().evaluate<Lage>(fn(LAGE));
      expect(danach.einstellungenDa, "nach der Leertaste kam die Adminansicht nicht zurück").toBe(
        true,
      );
      expect(danach.hinweisText).toBeNull();
    }, 120_000);
  });

  // ==============================================================================================
  // UX-12b/UX-12c (Auftrag gesamt-rollen-vorschau) — DIE SPERRKARTE SCHMAL, DEUTSCH UND ENGLISCH.
  // ==============================================================================================
  // T1–T3 gehen den Rückweg bei 1280 px und nur auf Deutsch; die Einstellungshülle misst
  // `tests/einstellungen-schmal/ux12b-einstellungen-schmal-chromium.test.ts` in beiden Sprachen,
  // betritt aber die Vorschau nicht. Offen war damit der Weg, den UX-12b/12c beschreiben: bei
  // 320 und 390 px, je Sprache, die Vorschau über das Raster starten, den Rückweg auf der Sperrkarte
  // sehen, per Tab/Shift+Tab mit sichtbarem Fokus erreichen, per Enter zurückkehren — und nach einem
  // echten Reload ist die Vorschau beendet, die Sprache aber geblieben. Jeder Fall setzt am Ende
  // Deutsch zurück und prüft, dass die Rückkehr wirklich ankam.
  describe("UX-12b/12c · die Sperrkarte bei 320 und 390 px, DE und EN", () => {
    const ADMIN_ANKER = '[data-einst="seite"]';

    async function inSprache(
      sprache: "de" | "en",
      breite: number,
      pruefung: () => Promise<void>,
    ): Promise<void> {
      const seite = seiteRoh();
      try {
        await seite.setViewportSize({ width: breite, height: 740 });
        const lage = await setzeSprache(stand, sprache, "/admin", ADMIN_ANKER);
        expect(lage.lang, `die Sprache ${sprache} kam nicht an`).toBe(sprache);
        await pruefung();
      } finally {
        const zurueck = await setzeSprache(stand, "de", "/admin", ADMIN_ANKER);
        expect(zurueck.lang, "die Rückkehr nach Deutsch kam nicht an").toBe("de");
      }
    }

    /** Die Vorschau über den echten Rasterknopf starten — in der eingestellten Sprache und Breite. */
    async function starteVorschau(sprache: "de" | "en"): Promise<string> {
      const rolle = i18n.t("role.name.viewer", { lng: sprache });
      const reiter = i18n.t(ADMIN_SECTIONS[0].labelKey, { lng: sprache });
      const r = await seiteRoh().evaluate<{ fehler: string | null }>(fn(VORSCHAU_STARTEN), [
        reiter,
        rolle,
      ]);
      expect(
        r.fehler,
        `Vorschau als „${rolle}" (${sprache}) liess sich nicht einschalten`,
      ).toBeNull();
      return rolle;
    }

    for (const sprache of ["de", "en"] as const) {
      for (const breite of [320, 390] as const) {
        it(`N1 · ${breite} px ${sprache}: Sperrkarte nennt Vorschau und Adminrolle, Rückweg sichtbar, Tab/Shift+Tab mit Fokusring, Enter kehrt zurück`, async () => {
          await inSprache(sprache, breite, async () => {
            const rolle = await starteVorschau(sprache);
            const lage = await seiteRoh().evaluate<Lage>(fn(LAGE));
            expect(lage.gateTitel).toBe(i18n.t("role.gate.title", { lng: sprache }));
            expect(lage.hinweisText).toContain(
              i18n.t("role.previewNote", { lng: sprache, role: rolle }),
            );
            expect(lage.knopfText).toBe(i18n.t("role.backToAdmin", { lng: sprache }));
            expect(lage.echteKnoepfe, "der Rückweg ist kein echtes <button>").toBe(1);
            expect(lage.rasterDa, "auf der Sperrkarte steht ein Rollenraster").toBe(false);

            // Sichtbar heisst: ganz in der Fensterbreite, nichts läuft aus Hinweis oder Knopf.
            const sicht = await seiteRoh().evaluate<Sicht>(fn(SICHT));
            expect(sicht.viewport).toBe(breite);
            expect(sicht.sprache).toBe(sprache);
            expect(sicht.hinweis, "kein Vorschauhinweis auf der Fläche").not.toBeNull();
            expect(sicht.knopf, "kein Rückweg-Knopf auf der Fläche").not.toBeNull();
            const knopf = sicht.knopf as Kasten;
            const hinweis = sicht.hinweis as Kasten;
            expect(knopf.breite).toBeGreaterThan(0);
            expect(knopf.x, "der Rückweg ragt links aus dem Fenster").toBeGreaterThanOrEqual(0);
            expect(knopf.rechts, "der Rückweg ragt rechts aus dem Fenster").toBeLessThanOrEqual(
              breite,
            );
            expect(hinweis.x).toBeGreaterThanOrEqual(0);
            expect(hinweis.rechts).toBeLessThanOrEqual(breite);
            expect(sicht.knopfScroll, "der Knopftext läuft aus dem Knopf").toBeLessThanOrEqual(
              sicht.knopfClient,
            );
            expect(sicht.hinweisScroll, "der Hinweis läuft waagerecht über").toBeLessThanOrEqual(
              sicht.hinweisClient,
            );
            expect(
              sicht.dokumentScrollWidth,
              `die Sperrseite läuft bei ${breite} px waagerecht über`,
            ).toBeLessThanOrEqual(breite);

            // Tab erreicht den Knopf mit sichtbarem Ring; er steht dann ganz im Fenster.
            const ohneFokus = await seiteRoh().evaluate<string>(fn(RING_OHNE_FOKUS));
            const { schritte, fokus } = await tabBisRueckweg();
            expect(schritte, "Tab erreicht den Rückweg nicht").toBeGreaterThan(0);
            expect(fokus?.text).toBe(i18n.t("role.backToAdmin", { lng: sprache }));
            expect(schattenLagen(fokus?.boxShadow ?? "").length).toBeGreaterThan(
              schattenLagen(ohneFokus).length,
            );
            const imFokus = await seiteRoh().evaluate<Sicht>(fn(SICHT));
            const k = imFokus.knopf as Kasten;
            expect(
              k.y >= 0 && k.unten <= imFokus.viewportHoehe,
              "der fokussierte Rückweg steht nicht im sichtbaren Fenster",
            ).toBe(true);

            // Shift+Tab verlässt den Knopf rückwärts, Tab bringt ihn wieder — die Reihenfolge trägt
            // in beide Richtungen.
            await seiteRoh().keyboard.press("Shift+Tab");
            const rueckwaerts = await seiteRoh().evaluate<Fokus>(fn(FOKUS));
            expect(rueckwaerts.imHinweis, "Shift+Tab blieb im Rückweg stehen").toBe(false);
            await seiteRoh().keyboard.press("Tab");
            const wieder = await seiteRoh().evaluate<Fokus>(fn(FOKUS));
            expect(
              wieder.imHinweis && wieder.tag === "button",
              "Tab nach Shift+Tab fand den Rückweg nicht",
            ).toBe(true);
            expect(schattenLagen(wieder.boxShadow).length).toBeGreaterThan(
              schattenLagen(ohneFokus).length,
            );
            // eslint-disable-next-line no-console -- der Beleg der Rückgabe
            console.log(
              `UX-12c · N1 ${breite}/${sprache}: „${lage.hinweisText}" · Knopf ${Math.round(knopf.x)}–${Math.round(knopf.rechts)} px · ${schritte} Tab · Shift+Tab auf <${rueckwaerts.tag}> „${rueckwaerts.text}"`,
            );

            await seiteRoh().keyboard.press("Enter");
            await seiteRoh().waitForFunction(fn(WARTE_EINSTELLUNGEN), undefined, {
              timeout: 10_000,
            });
            const danach = await seiteRoh().evaluate<Lage>(fn(LAGE));
            expect(danach.einstellungenDa, "nach Enter kam die Adminansicht nicht zurück").toBe(
              true,
            );
            expect(danach.hinweisText).toBeNull();
          });
        }, 180_000);
      }

      it(`N2 · 390 px ${sprache}: ein echter Reload beendet die Vorschau und behält die Sprache`, async () => {
        await inSprache(sprache, 390, async () => {
          await starteVorschau(sprache);
          const seite = seiteRoh() as ReturnType<typeof seiteRoh> & {
            reload(opts: { waitUntil: string; timeout: number }): Promise<unknown>;
          };
          await seite.evaluate(
            fn('() => { document.documentElement.dataset.ux12cVorReload = "ja"; }'),
          );
          await seite.reload({ waitUntil: "load", timeout: 60_000 });
          await seite.waitForFunction(fn(WARTE_EINSTELLUNGEN), undefined, { timeout: 30_000 });
          expect(
            await seite.evaluate(
              fn("() => document.documentElement.dataset.ux12cVorReload ?? null"),
            ),
            "Reload hat das Dokument nicht ersetzt",
          ).toBeNull();
          expect(
            await seite.evaluate(fn('() => performance.getEntriesByType("navigation")[0].type')),
          ).toBe("reload");
          const lage = await seite.evaluate<Lage>(fn(LAGE));
          expect(lage.einstellungenDa, "nach dem Reload steht nicht die Adminansicht").toBe(true);
          expect(lage.hinweisText, "nach dem Reload läuft die Vorschau noch").toBeNull();
          const sicht = await seite.evaluate<Sicht>(fn(SICHT));
          expect(sicht.sprache, "der Reload hat die Sprache verloren").toBe(sprache);
        });
      }, 180_000);
    }

    // N-0028 (BEN Nacharbeit 1): Sperrkarte → „Zurück zum Start". Die Vorschau läuft weiter, und
    // die Startseite trägt Hinweis und Rückweg selbst — bei GESCHLOSSENEM Zahnrad-Menü. Breit und
    // schmal, weil `AppShell.tsx` zwei Bauformen hat und der Hinweis in beiden eingesetzt ist.
    for (const [breite, sprache] of [
      [1280, "de"],
      [390, "de"],
      [390, "en"],
    ] as const) {
      it(`N3 · ${breite} px ${sprache}: Sperrkarte → Start, die Startseite nennt die Vorschau und trägt den Rückweg, Tab/Shift+Tab und Enter`, async () => {
        await inSprache(sprache, breite, async () => {
          const rolle = await starteVorschau(sprache);
          const weg = await seiteRoh().evaluate<{ fehler: string | null }>(fn(ZUM_START), [
            i18n.t("stage2.gate.back", { lng: sprache }),
          ]);
          expect(weg.fehler, "von der Sperrkarte ging es nicht zur Startseite").toBeNull();

          const lage = await seiteRoh().evaluate<SeitenLage>(fn(SEITEN_LAGE));
          expect(lage.pfad).toBe("/start");
          expect(lage.sprache).toBe(sprache);
          expect(
            lage.zahnradHinweisDa,
            "das Zahnrad-Menü ist offen — der Fall bewiese nichts",
          ).toBe(false);
          expect(lage.hinweisText, "die Startseite sagt nicht, dass die Vorschau läuft").toContain(
            i18n.t("role.previewNote", { lng: sprache, role: rolle }),
          );
          expect(lage.knopfText).toBe(i18n.t("role.backToAdmin", { lng: sprache }));
          expect(lage.echteKnoepfe, "der Rückweg ist kein echtes <button>").toBe(1);
          expect(lage.imMain, "der Hinweis steht nicht im Inhalt").toBe(true);
          expect(lage.sichtbar, "der Hinweis ist im DOM, aber nicht sichtbar").toBe(true);
          const knopf = lage.knopf as Kasten;
          expect(knopf.x).toBeGreaterThanOrEqual(0);
          expect(knopf.rechts, "der Rückweg ragt rechts aus dem Fenster").toBeLessThanOrEqual(
            breite,
          );
          expect(lage.knopfScroll, "der Knopftext läuft aus dem Knopf").toBeLessThanOrEqual(
            lage.knopfClient,
          );
          expect(lage.dokumentScrollWidth).toBeLessThanOrEqual(breite);

          // Tastatur: Tab erreicht den Rückweg mit sichtbarem Ring, Shift+Tab verlässt ihn.
          let fokus: Fokus | null = null;
          let schritte = -1;
          for (let i = 1; i <= 40; i++) {
            await seiteRoh().keyboard.press("Tab");
            const f = await seiteRoh().evaluate<Fokus>(fn(FOKUS_SEITE));
            if (f.imHinweis && f.tag === "button") {
              fokus = f;
              schritte = i;
              break;
            }
          }
          expect(schritte, "Tab erreicht den Rückweg auf der Startseite nicht").toBeGreaterThan(0);
          expect(fokus?.text).toBe(i18n.t("role.backToAdmin", { lng: sprache }));
          expect(schattenLagen(fokus?.boxShadow ?? "").length).toBeGreaterThan(0);
          await seiteRoh().keyboard.press("Shift+Tab");
          const rueckwaerts = await seiteRoh().evaluate<Fokus>(fn(FOKUS_SEITE));
          expect(rueckwaerts.imHinweis, "Shift+Tab blieb im Rückweg stehen").toBe(false);
          await seiteRoh().keyboard.press("Tab");
          const wieder = await seiteRoh().evaluate<Fokus>(fn(FOKUS_SEITE));
          expect(wieder.imHinweis && wieder.tag === "button").toBe(true);
          // eslint-disable-next-line no-console -- der Beleg der Rückgabe
          console.log(
            `N-0028 · N3 ${breite}/${sprache}: /start „${lage.hinweisText}" · ${schritte} Tab · Shift+Tab auf <${rueckwaerts.tag}> „${rueckwaerts.text}"`,
          );

          // Enter beendet die Vorschau auf der Startseite selbst: der Hinweis geht, die
          // Admin-Zeile „Einstellungen" ist im Zahnrad-Menü zurück — ohne Reload.
          await seiteRoh().keyboard.press("Enter");
          await seiteRoh().waitForFunction(
            fn(`() => document.querySelector('[data-testid="seite-vorschau"]') === null`),
            undefined,
            { timeout: 10_000 },
          );
          const danach = await seiteRoh().evaluate<SeitenLage>(fn(SEITEN_LAGE));
          expect(danach.pfad).toBe("/start");
          expect(danach.hinweisText).toBeNull();
          const admin = await seiteRoh().evaluate<{ fehler: string | null; admin: boolean }>(
            fn(ADMIN_ZURUECK),
          );
          expect(admin.fehler).toBeNull();
          expect(admin.admin, "nach dem Rückweg fehlt die Admin-Zeile im Zahnrad").toBe(true);
        });
      }, 180_000);
    }

    // Gegenrichtung: ohne Vorschau steht auf der Startseite KEIN Seitenhinweis — er behauptet nichts.
    it("N4 · 390 px de: ohne Vorschau trägt die Startseite keinen Vorschauhinweis", async () => {
      await inSprache("de", 390, async () => {
        await wechsle(stand, "/start", 'header[data-testid="kopfband"]');
        const lage = await seiteRoh().evaluate<SeitenLage>(fn(SEITEN_LAGE));
        expect(lage.pfad).toBe("/start");
        expect(lage.hinweisText).toBeNull();
      });
    }, 120_000);
  });

  // JOB 3152: CSS/Layout kommt nach der Detailkarte an; dieselbe Messfunktion muss warten.
  describe("JOB 3152 · Rollenraster-Bereitschaft", () => {
    it("wartet auf das gezielt verspätete einspaltige Raster", async () => {
      await wechsle(stand, "/admin", '[data-einst="seite"]');
      const seite = seiteRoh();
      await messen(320);
      await seite.evaluate(
        fn(`() => {
      const stil = document.createElement('style');
      stil.textContent = '[data-testid="detail-ansicht-rolle"] .grid { grid-template-columns: repeat(4, 1fr) !important; }';
      document.head.append(stil);
      setTimeout(() => stil.remove(), 400);
    }`),
      );
      const m = await messen(320);
      expect(m.fehler).toBeNull();
      expect(new Set(m.knoepfe.map((k) => k.rect.x)).size).toBe(1);
    });
  });
});
