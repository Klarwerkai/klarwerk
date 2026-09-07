// ================================================================================================
// JOB 3175 · UX-12c — UNABHÄNGIGE DE/EN-MESSUNGEN DER SCHMALEN EINSTELLUNGEN.
// Arbeitsbasis VOR dem externen Rebase: a50b23f9b23f695e4821603ee2b6596699741706.
// Der unmittelbare Elterncommit des Prüfstands NACH dem Rebase ist hier noch nicht bekannt;
// vor der Abnahme nachführen (keine Gleichsetzung mit dieser Arbeitsbasis).
// Letzte grüne Auslieferung JOB 3155: 1.0.0-beta.1.153, Archiv-LIVE laut
// gespraech/CODEX-ANTWORT-79.md:7. Hiesiger Quellstand: 1.0.0-beta.1.155.
// Ohne apps/web/dist gibt es ausdrücklich keine gemessene Browser-/Auslieferungsversion.
// ================================================================================================
//
// WARUM ES DIESE DATEI GIBT. Der Prüfer von JOB 3124 hat den Rest, den dieser Auftrag schliesst,
// selbst gemessen und wörtlich festgehalten (`archiv/3124/runde-4/ben.md:26`, Prüfpunkt 4):
//
//   „Gemessen: 320 px → 30 px Raster, drei bis fünf Textzeilen; 390 px → 100 px Raster, jeweils
//    eine Textzeile."
//
// Der Engpass sass NICHT im Rollenraster — das ist seit JOB 3124 einspaltig und bricht um. Er sass
// in der Hülle der Einstellungsseite: `components/einstellungen/Seite.tsx` stellte Reiterspalte
// (feste 200 px, `shrink-0`) und Inhaltsspalte in EINER Flexzeile OHNE Breiten-Weiche nebeneinander.
// Bei 320 px blieben dem Inhalt damit rund 30 px. Derselbe Prüfer hat daraus einen eigenen
// Layoutauftrag verlangt („Behandle die schmale Reiterspalte als eigenen Layoutauftrag") — das ist
// dieser hier.
//
// WAS HIER GEMESSEN WIRD: die GEBAUTE Anwendung (`apps/web/dist`) in Chromium, mit dem echten
// Fastify-Backend dahinter, über die gemeinsame Bühne `tests/design/h6-chromium.ts` — derselbe Weg
// wie `tests/rollenvorschau-sperre/rollenraster-schmal-chromium.test.ts`. Kein jsdom für eine
// Breitenaussage: jsdom hat keine Layout-Maschine, jede Zahl daraus wäre erfunden.
//
//   S1/S2/S3/S4: unabhängige Paare 320/360/390 px × DE/EN, jeweils ≥ 75 % Inhalt.
//   S5: unveränderte 200-px-Spalte links bei 1280 px DE. B1/B2: Weiche 639/640 px DE.
//   S6: Rollenraster der Admin-Einstellungen bei 320/390 px × DE/EN; die Rollensperre
//       selbst gehört weiterhin ausschließlich tests/rollenvorschau-sperre (JOB 3173).
//   T1: Tab durch vier namentlich geprüfte Reiter in den Inhalt, Shift+Tab zurück, DE/EN.
//   L1: echter page.reload() trägt EN und die Rückkehr DE, bei 320/360/390 px.
//   R1–R4: Laufzeitstörungen am ORIGINALDOM aus Seite.tsx, mit geprüftem Rückbau:
//       alte 200-px-Zeile, immer schmale Weiche, tabindex=-1, DE-Messung im EN-Speicher.
//       Sie prüfen dauerhaft die Ablehnung durch dieselben Zusicherungen. Für eine rote
//       Vitest-Ausgabe ohne Teständerung: KLARWERK_UX12C_GEGENPROBE=R1 (bzw. R2/R3/R4)
//       und -t 'R1' (bzw. R2/R3/R4); die erkannte Assertion wird dann weitergeworfen.
//
// EIN BROWSER, EINE INSTANZ JE DATEI (s. Kopf von `tests/design/h6-chromium.ts`), und jeder Hook,
// der Browser oder App auf- oder abbaut, bekommt einen EIGENEN Zeitrahmen — Vitest gibt Hooks sonst
// 10 s, unabhängig von `testTimeout`, und die Datei wird rot, obwohl jede Prüfung grün ist
// (Lehre JOB 3130 R5).
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import {
  type Seite,
  type Stand,
  beende,
  fn,
  schattenLagen,
  starte,
  wechsle,
} from "../design/h6-chromium";

/** Die vier Reiter der Adminfläche (`adm.sec.*`), in der Reihenfolge von `ADMIN_SECTIONS`. */
const REITER_DE = ["Konten", "KI", "Daten", "Sicherheit"] as const;
/** Dieselben vier auf Englisch (`adm.sec.*`). */
const REITER_EN = ["Accounts", "AI", "Data", "Security"] as const;
/** Der Reiter, unter dem die Zeile „Ansicht als Rolle" wohnt (`adm.sec.konten`, de). */
const RASTER_REITER = "Konten";
/** Die vollen Rollennamen (`role.name.*`, de) in der Reihenfolge von `ROLES` — JOB 3124. */
const ROLLEN = ["Betrachter", "Experte", "Controller", "Administrator"] as const;
/** Englischer Reiter der Rollenvorschau (`adm.sec.konten`, en). */
const RASTER_REITER_EN = "Accounts";
/** Volle englische Rollennamen (`role.name.*`, en), Reihenfolge von `ROLES`. */
const ROLLEN_EN = ["Viewer", "Expert", "Controller", "Administrator"] as const;
type Sprache = "de" | "en";
type Messschluessel = `${number}/${Sprache}`;
type Stoerung = "alt" | "schmal" | null;
const REITER = { de: REITER_DE, en: REITER_EN } as const;
/** Der Sprachschalter des Produkts (`apps/web/src/lib/sprachwahl.ts:23`). */
const SPRACHE_STORAGE_KEY = "kw.sprache";

interface Kasten {
  x: number;
  y: number;
  breite: number;
  hoehe: number;
  rechts: number;
  unten: number;
}
interface Reitermass {
  text: string;
  tag: string;
  typ: string;
  /** Ein gesetztes `tabindex` wäre der Weg an der Tabreihenfolge vorbei — hier muss es fehlen. */
  tabindexAttribut: string | null;
  clientWidth: number;
  scrollWidth: number;
  rect: Kasten;
  textOverflow: string;
  whiteSpace: string;
}
interface Messung {
  fehler: string | null;
  viewport: number;
  dokumentScrollWidth: number;
  /** Die Inhaltsspalte `[data-einst="spalte"]` — der Wert, um den es in diesem Auftrag geht. */
  spalteBreite: number;
  spalteRect: Kasten;
  /** Die Reiterleiste `[data-einst="reiterspalte"]`. */
  leisteBreite: number;
  leisteScrollWidth: number;
  leisteRect: Kasten;
  leisteOverflowX: string;
  reiter: Reitermass[];
  /** `document.documentElement.lang` — der Beleg, welche Sprache wirklich stand. */
  sprache: string;
}

interface Rastermass {
  sprache: string;
  fehler: string | null;
  viewport: number;
  dokumentScrollWidth: number;
  rasterBreite: number;
  knoepfe: {
    text: string;
    clientWidth: number;
    scrollWidth: number;
    rect: Kasten;
    zeilen: number;
    whiteSpace: string;
    textOverflow: string;
  }[];
}

/** Setzt die Fensterbreite — die Bühne aus `h6-chromium.ts` reicht die Seite roh durch. */
interface SeiteMitViewport {
  setViewportSize(size: { width: number; height: number }): Promise<void>;
}
/** Echte Tastenanschläge des Browsers (Playwright) — dieselbe rohe Seite. */
interface SeiteMitTastatur {
  keyboard: { press(taste: string): Promise<void> };
}

// ---- In der Seite: die Hülle vermessen -----------------------------------------------------------
//
// `stoerung` ist die Gegenprobe G: sie setzt den ALTEN Vertrag per `style` wieder ein. Ohne Flagge
// räumt dieselbe Funktion die Eigenschaften wieder ab — jede Messung stellt damit den
// Auslieferungszustand her, und kein Fall erbt den Eingriff des vorigen.
const MESSEN = `(async ([stoerung]) => {
  const norm = (s) => (s || '').replace(/\\s+/g, ' ').trim();
  const kasten = (r) => ({ x: r.x, y: r.y, breite: r.width, hoehe: r.height, rechts: r.right, unten: r.bottom });
  const rahmen = () => new Promise((r) => requestAnimationFrame(() => r(null)));
  const leerKasten = { x: 0, y: 0, breite: 0, hoehe: 0, rechts: 0, unten: 0 };
  const leer = {
    viewport: window.innerWidth, dokumentScrollWidth: 0, spalteBreite: 0, spalteRect: leerKasten,
    leisteBreite: 0, leisteScrollWidth: 0, leisteRect: leerKasten, leisteOverflowX: '',
    reiter: [], sprache: document.documentElement.lang,
  };

  // ----------------------------------------------------------------------------------------------
  // ERST SETZEN LASSEN, DANN GREIFEN — sonst misst dieser Test abgehängte Knoten.
  // ----------------------------------------------------------------------------------------------
  // Die Huelle wechselt bei 900 px die Bauform (shell/AppShell.tsx, useMediaQuery(NARROW_QUERY)).
  // Ein Breitenwechsel über diese Grenze löst also einen React-Neuaufbau aus: die vorher gegriffenen
  // Knoten hängen danach nicht mehr im Dokument und melden clientWidth 0. Genau das ist beim
  // ersten Lauf dieser Datei passiert — 1280 px meldete „Reiterleiste 0 px", während die Reiter
  // 200 px breit dastanden. Gewartet wird deshalb auf einen Knoten, der WIRKLICH im Dokument steht.
  // Ein blosses „ist da und breiter als 0" genügt dafür NICHT: unmittelbar nach dem Breitenwechsel
  // steht noch der ALTE Baum im Dokument und erfüllt beides. Gewartet wird deshalb darauf, dass
  // DERSELBE Knoten den Umbau ÜBERLEBT — er wird gegriffen, 120 ms später erneut befragt, und nur
  // wenn er dann noch im Dokument hängt, ist die Hülle zur Ruhe gekommen.
  const ruhe = async (sel, ms = 6000) => {
    const bis = Date.now() + ms;
    while (Date.now() < bis) {
      const el = document.querySelector(sel);
      if (el !== null && el.clientWidth > 0) {
        await new Promise((r) => setTimeout(r, 120));
        await rahmen();
        if (el.isConnected && el.clientWidth > 0) return true;
        continue;
      }
      await new Promise((r) => setTimeout(r, 30));
    }
    return false;
  };
  if (!(await ruhe('[data-einst="spalte"]'))) return Object.assign({ fehler: 'die Hülle kam nach dem Breitenwechsel nicht zur Ruhe' }, leer);

  const spalteVor = document.querySelector('[data-einst="spalte"]');
  const leisteVor = document.querySelector('[data-einst="reiterspalte"]');
  if (spalteVor === null) return Object.assign({ fehler: 'die Inhaltsspalte fehlt' }, leer);
  if (leisteVor === null) return Object.assign({ fehler: 'die Reiterleiste fehlt' }, leer);
  const zeile = leisteVor.parentElement;
  if (zeile === null) return Object.assign({ fehler: 'die Aufteilungszeile fehlt' }, leer);

  // Der alte Vertrag, an genau denselben Elementen — oder sein Abräumen.
  leisteVor.style.width = stoerung === 'alt' ? '200px' : stoerung === 'schmal' ? '100%' : '';
  leisteVor.style.flexShrink = stoerung === 'alt' ? '0' : '';
  leisteVor.style.flexDirection = stoerung === 'schmal' ? 'row' : '';
  leisteVor.style.flexWrap = stoerung === 'schmal' ? 'wrap' : '';
  zeile.style.flexDirection = stoerung === 'alt' ? 'row' : stoerung === 'schmal' ? 'column' : '';
  zeile.style.flexWrap = stoerung === 'alt' ? 'nowrap' : '';
  zeile.style.alignItems = stoerung === 'schmal' ? 'stretch' : '';
  await rahmen();

  // Frisch greifen: der Eingriff oben rendert nichts neu, aber gemessen wird, was JETZT im
  // Dokument steht — nicht, was vor dem Warten dastand.
  const spalte = document.querySelector('[data-einst="spalte"]');
  const leiste = document.querySelector('[data-einst="reiterspalte"]');
  if (spalte === null || leiste === null) return Object.assign({ fehler: 'die Hülle verschwand während der Messung' }, leer);

  const reiter = [...document.querySelectorAll('[data-einst="reiter"]')].map((b) => {
    const s = getComputedStyle(b);
    return {
      text: norm(b.textContent),
      tag: b.tagName.toLowerCase(),
      typ: String(b.getAttribute('type') || ''),
      tabindexAttribut: b.getAttribute('tabindex'),
      clientWidth: b.clientWidth,
      scrollWidth: b.scrollWidth,
      rect: kasten(b.getBoundingClientRect()),
      textOverflow: s.textOverflow,
      whiteSpace: s.whiteSpace,
    };
  });
  return {
    fehler: null,
    viewport: window.innerWidth,
    dokumentScrollWidth: document.documentElement.scrollWidth,
    spalteBreite: spalte.clientWidth,
    spalteRect: kasten(spalte.getBoundingClientRect()),
    leisteBreite: leiste.clientWidth,
    leisteScrollWidth: leiste.scrollWidth,
    leisteRect: kasten(leiste.getBoundingClientRect()),
    leisteOverflowX: getComputedStyle(leiste).overflowX,
    reiter,
    sprache: document.documentElement.lang,
  };
})`;

// ---- In der Seite: das Rollenraster von JOB 3124 nachmessen ---------------------------------------
// Der Weg ist wörtlich der aus `rollenraster-schmal-chromium.test.ts:234-242`: über den Reiter
// „Konten" die Zeile „Ansicht als Rolle" öffnen. Diese Datei ÄNDERT dort nichts — sie misst nur nach,
// dass die neue Aufteilung die Zusage von JOB 3124 nicht verschlechtert.
const MESSEN_RASTER = `(async ([reiterName]) => {
  const norm = (s) => (s || '').replace(/\\s+/g, ' ').trim();
  const rahmen = () => new Promise((r) => requestAnimationFrame(() => r(null)));
  const warte = async (pruefung, ms = 8000) => {
    const bis = Date.now() + ms;
    while (Date.now() < bis) {
      if (pruefung()) return true;
      await new Promise((r) => setTimeout(r, 50));
    }
    return pruefung();
  };
  const leer = { sprache: document.documentElement.lang, viewport: window.innerWidth, dokumentScrollWidth: 0, rasterBreite: 0, knoepfe: [] };

  // Dieselbe Ruhe wie in MESSEN, aus demselben Grund: nach einem Breitenwechsel über 900 px baut
  // die Hülle sich neu auf, und der zuerst gegriffene Knoten haengt danach nicht mehr im Dokument.
  const ruhe = async (sel, ms = 6000) => {
    const bis = Date.now() + ms;
    while (Date.now() < bis) {
      const el = document.querySelector(sel);
      if (el !== null && el.clientWidth > 0) {
        await new Promise((r) => setTimeout(r, 120));
        await rahmen();
        if (el.isConnected && el.clientWidth > 0) return true;
        continue;
      }
      await new Promise((r) => setTimeout(r, 30));
    }
    return false;
  };
  if (!(await ruhe('[data-einst="seite"]'))) return Object.assign({ fehler: 'die Hülle kam nach dem Breitenwechsel nicht zur Ruhe' }, leer);

  if (document.querySelector('[data-testid="zeile-ansicht-rolle"]') === null) {
    const zurueck = document.querySelector('[data-einst="zurueck"]');
    if (zurueck) { zurueck.click(); await warte(() => document.querySelector('[data-einst="detail"]') === null, 4000); }
    const r = [...document.querySelectorAll('[data-einst="reiter"]')].find((b) => norm(b.textContent) === reiterName);
    if (!r) return Object.assign({ fehler: 'Reiter „' + reiterName + '" nicht gefunden' }, leer);
    r.click();
    if (!(await warte(() => document.querySelector('[data-testid="zeile-ansicht-rolle"]') !== null)))
      return Object.assign({ fehler: 'Zeile „Ansicht als Rolle" erschien nicht' }, leer);
  }
  if (document.querySelector('[data-testid="detail-ansicht-rolle"]') === null) {
    document.querySelector('[data-testid="zeile-ansicht-rolle"]').click();
    if (!(await warte(() => document.querySelector('[data-testid="detail-ansicht-rolle"]') !== null)))
      return Object.assign({ fehler: 'Detailkarte „Ansicht als Rolle" ging nicht auf' }, leer);
  }
  await rahmen();
  // Frisch greifen NACH dem Bildlauf: gemessen wird, was jetzt im Dokument steht.
  const karte = document.querySelector('[data-testid="detail-ansicht-rolle"]');
  if (karte === null) return Object.assign({ fehler: 'die Detailkarte verschwand während der Messung' }, leer);
  const knoepfe = [...karte.querySelectorAll('button[aria-pressed]')];
  if (knoepfe.length === 0) return Object.assign({ fehler: 'keine Rollenknöpfe in der Detailkarte' }, leer);

  const kasten = (r) => ({ x: r.x, y: r.y, breite: r.width, hoehe: r.height, rechts: r.right, unten: r.bottom });
  const mass = knoepfe.map((b) => {
    const s = getComputedStyle(b);
    const bereich = document.createRange();
    bereich.selectNodeContents(b);
    return {
      text: norm(b.textContent),
      clientWidth: b.clientWidth,
      scrollWidth: b.scrollWidth,
      rect: kasten(b.getBoundingClientRect()),
      zeilen: [...bereich.getClientRects()].length,
      whiteSpace: s.whiteSpace,
      textOverflow: s.textOverflow,
    };
  });
  return {
    fehler: null,
    viewport: window.innerWidth,
    dokumentScrollWidth: document.documentElement.scrollWidth,
    sprache: document.documentElement.lang,
    rasterBreite: knoepfe[0].parentElement.clientWidth,
    knoepfe: mass,
  };
})`;

/** Was gerade den Fokus hat — der Beleg, dass die Tabreihenfolge wirklich dort ankommt. */
interface Fokus {
  name: string;
  tag: string;
  text: string;
  /** Der Index dieses Elements in `[data-einst="reiter"]` — `-1`, wenn es kein Reiter ist. */
  reiterIndex: number;
  /** Liegt das fokussierte Element INNERHALB der Inhaltsspalte? */
  imInhalt: boolean;
  boxShadow: string;
}
const FOKUS = `() => {
  const a = document.activeElement;
  if (!a) return { name: '', tag: '', text: '', reiterIndex: -1, imInhalt: false, boxShadow: '' };
  const reiter = [...document.querySelectorAll('[data-einst="reiter"]')];
  const spalte = document.querySelector('[data-einst="spalte"]');
  return {
    name: a.getAttribute('aria-label') || a.querySelector('[data-einst="label"]')?.textContent.trim() || (a.textContent || '').trim(),
    tag: a.tagName.toLowerCase(),
    text: (a.textContent || '').replace(/\\s+/g, ' ').trim(),
    reiterIndex: reiter.indexOf(a),
    imInhalt: spalte !== null && spalte.contains(a),
    boxShadow: getComputedStyle(a).boxShadow,
  };
}`;

/** Der `box-shadow` des ersten Reiters OHNE Fokus — der Vergleichswert für den Fokusring. */
const RING_OHNE_FOKUS = `() => {
  const b = document.querySelector('[data-einst="reiter"]');
  return b ? getComputedStyle(b).boxShadow : '';
}`;

let stand: Stand;
const messungen = new Map<Messschluessel, Messung>();
const raster = new Map<Messschluessel, Rastermass>();
const schluessel = (breite: number, sprache: Sprache): Messschluessel => `${breite}/${sprache}`;

/** Die Seite roh — die Bühne reicht sie durch, ihr Typ nennt nur, was hier gebraucht wird. */
function seiteRoh(): Seite & SeiteMitViewport & SeiteMitTastatur {
  const seite = stand.seite;
  if (seite === null || stand.fehler !== null) {
    throw new Error(`Bühne steht nicht: ${stand.fehler ?? "unbekannt"}`);
  }
  return seite as unknown as Seite & SeiteMitViewport & SeiteMitTastatur;
}

/** Jede Aufnahme UND jeder Speicherabruf prüft die tatsächliche Sprache und Breite. */
function pruefeZuordnung(
  m: { fehler: string | null; viewport: number; sprache: string },
  breite: number,
  sprache: Sprache,
): void {
  expect(m.fehler, `Messung ${schluessel(breite, sprache)}`).toBeNull();
  expect(m.viewport, "falsche Messbreite im Speicher").toBe(breite);
  expect(
    m.sprache,
    `die Sprachwahl griff nicht: ${schluessel(breite, sprache)} enthält ${m.sprache}`,
  ).toBe(sprache);
}

async function messen(
  breite: number,
  sprache: Sprache,
  stoerung: Stoerung = null,
): Promise<Messung> {
  const seite = seiteRoh();
  await seite.setViewportSize({ width: breite, height: 740 });
  const m = await seite.evaluate<Messung>(fn(MESSEN), [stoerung]);
  pruefeZuordnung(m, breite, sprache);
  return m;
}

async function messwert(breite: number, sprache: Sprache): Promise<Messung> {
  const key = schluessel(breite, sprache);
  const m = messungen.get(key) ?? (await messen(breite, sprache));
  pruefeZuordnung(m, breite, sprache);
  messungen.set(key, m);
  return m;
}

async function messeRaster(breite: number, sprache: Sprache): Promise<Rastermass> {
  const key = schluessel(breite, sprache);
  const seite = seiteRoh();
  await seite.setViewportSize({ width: breite, height: 740 });
  const r =
    raster.get(key) ??
    (await seite.evaluate<Rastermass>(fn(MESSEN_RASTER), [
      sprache === "de" ? RASTER_REITER : RASTER_REITER_EN,
    ]));
  pruefeZuordnung(r, breite, sprache);
  raster.set(key, r);
  return r;
}

/** Produktschlüssel setzen, anschließend neuer Dokumentaufbau über die echte Route. */
async function setzeSprache(sprache: Sprache): Promise<void> {
  await seiteRoh().evaluate<null>(
    fn("([schluessel, wert]) => { localStorage.setItem(schluessel, wert); return null; }"),
    [SPRACHE_STORAGE_KEY, sprache],
  );
  await wechsle(stand, "/admin", '[data-einst="seite"]');
  await pruefeSprache(sprache);
}

async function pruefeSprache(sprache: Sprache): Promise<void> {
  const seite = seiteRoh();
  const ist = await seite.evaluate<{
    sprache: string;
    gespeichert: string | null;
    reiter: string[];
  }>(
    fn(`() => ({
    sprache: document.documentElement.lang,
    gespeichert: localStorage.getItem('${SPRACHE_STORAGE_KEY}'),
    reiter: [...document.querySelectorAll('[data-einst="reiter"]')].map(b => b.textContent.trim()),
  })`),
  );
  expect(ist.sprache, "die Sprachwahl griff nicht").toBe(sprache);
  expect(ist.gespeichert, "die gespeicherte Sprachwahl stimmt nicht").toBe(sprache);
  expect(ist.reiter, "die sichtbaren Reiter tragen die falsche Sprache").toEqual([
    ...REITER[sprache],
  ]);
  expect(stand.seitenfehler, "die Seite hat selbst Fehler geworfen").toEqual([]);
}

/** Jeder Fall baut selbst auf und belegt im finally den DE-Rückweg, auch nach roter Assertion. */
async function inSprache(
  breite: number,
  sprache: Sprache,
  pruefung: () => Promise<void>,
): Promise<void> {
  const seite = seiteRoh();
  try {
    await seite.setViewportSize({ width: breite, height: 740 });
    await setzeSprache(sprache);
    await pruefung();
  } finally {
    await setzeSprache("de");
  }
}

/** Überlappen sich zwei Kästen? (Berührung an der Kante zählt nicht.) */
function ueberlappt(a: Kasten, b: Kasten): boolean {
  return a.x < b.rechts && b.x < a.rechts && a.y < b.unten && b.y < a.unten;
}

/** Ein Protokollblock, damit die Zahlen in der Rückgabe belegt und nicht behauptet sind. */
function protokoll(m: Messung): string {
  return [
    `  Viewport ${m.viewport} px (lang=${m.sprache}) · Inhaltsspalte ${m.spalteBreite} px ` +
      `(${Math.round((m.spalteBreite / m.viewport) * 100)} % des Fensters), ${Math.round(m.spalteRect.hoehe)} px hoch`,
    `  Reiterleiste ${m.leisteBreite} px · scrollWidth ${m.leisteScrollWidth} px · overflow-x ${m.leisteOverflowX}`,
    `  document.scrollWidth ${m.dokumentScrollWidth} px · Überlauf ${Math.max(0, m.dokumentScrollWidth - m.viewport)} px`,
    ...m.reiter.map(
      (r) =>
        `    „${r.text}" — ${Math.round(r.rect.breite)}×${Math.round(r.rect.hoehe)} px, ` +
        `client ${r.clientWidth} px, scroll ${r.scrollWidth} px, text-overflow ${r.textOverflow}`,
    ),
  ].join("\n");
}

function rasterProtokoll(r: Rastermass): string {
  return [
    `  Viewport ${r.viewport} px (lang=${r.sprache}) · Rollenraster ${r.rasterBreite} px`,
    ...r.knoepfe.map(
      (k) =>
        `    „${k.text}" — ${Math.round(k.rect.breite)} px, client ${k.clientWidth} px, ` +
        `scroll ${k.scrollWidth} px, ${k.zeilen} Textzeile(n)`,
    ),
  ].join("\n");
}

/** Die Zusicherungen, die S1/S3 und S4 gemeinsam haben — einmal geschrieben, zweimal gemessen. */
function pruefeSchmaleFlaeche(m: Messung, beschriftungen: readonly string[]): void {
  // Lieferung 2 — der Inhalt bekommt die Breite (mindestens 75 % des Fensters).
  const mindestens = Math.ceil(m.viewport * 0.75);
  expect(
    m.spalteBreite,
    `die Inhaltsspalte misst bei ${m.viewport} px nur ${m.spalteBreite} px (verlangt: ≥ ${mindestens} px)`,
  ).toBeGreaterThanOrEqual(mindestens);

  // „Breit" allein genügt nicht: `flex-1` bedeutet in einer SPALTE `flex-basis: 0` auf der HÖHE.
  // Ein Inhalt, der dabei auf null Höhe zusammenfällt, wäre breit und trotzdem unbenutzbar.
  expect(
    m.spalteRect.hoehe,
    `die Inhaltsspalte ist bei ${m.viewport} px auf ${Math.round(m.spalteRect.hoehe)} px Höhe zusammengefallen`,
  ).toBeGreaterThan(40);

  // Lieferung 3 — kein seitlicher Überlauf.
  expect(
    m.dokumentScrollWidth,
    `die Seite läuft bei ${m.viewport} px waagerecht über (${m.dokumentScrollWidth} px)`,
  ).toBeLessThanOrEqual(m.viewport + 1);

  // Lieferung 1 — die Reiterleiste steht ÜBER dem Inhalt, nicht daneben.
  expect(
    m.leisteRect.unten,
    "die Reiterleiste steht bei schmaler Fläche nicht über dem Inhalt",
  ).toBeLessThanOrEqual(m.spalteRect.y + 1);

  // Lieferung 4 — jeder Reiter bleibt vollständig lesbar und treffbar.
  expect(m.reiter.map((r) => r.text)).toEqual([...beschriftungen]);
  for (const r of m.reiter) {
    expect(r.tag, `„${r.text}" ist kein echtes <button>`).toBe("button");
    expect(r.tabindexAttribut, `„${r.text}" trägt ein eigenes tabindex`).toBeNull();
    expect(r.textOverflow, `„${r.text}": text-overflow kürzt`).not.toBe("ellipsis");
    expect(
      r.scrollWidth,
      `„${r.text}" läuft aus dem Reiter heraus: scrollWidth ${r.scrollWidth} > clientWidth ${r.clientWidth}`,
    ).toBeLessThanOrEqual(r.clientWidth);
    expect(
      r.rect.hoehe,
      `„${r.text}" ist nur ${Math.round(r.rect.hoehe)} px hoch — die Trefffläche verlangt 40 px`,
    ).toBeGreaterThanOrEqual(40);
  }
  for (let i = 0; i < m.reiter.length; i++) {
    for (let j = i + 1; j < m.reiter.length; j++) {
      const a = m.reiter[i] as Reitermass;
      const b = m.reiter[j] as Reitermass;
      expect(ueberlappt(a.rect, b.rect), `„${a.text}" und „${b.text}" überlappen sich`).toBe(false);
    }
  }
  // Läuft die Leiste waagerecht, muss der letzte Reiter ohne Mausrad erreichbar sein: entweder es
  // ragt gar nichts heraus (Umbruch), oder der Streifen ist sichtbar scrollbar.
  const scrollbar = m.leisteOverflowX === "auto" || m.leisteOverflowX === "scroll";
  expect(
    m.leisteScrollWidth <= m.leisteBreite + 1 || scrollbar,
    `die Reiterleiste schneidet ${m.leisteScrollWidth - m.leisteBreite} px ab, ohne scrollbar zu sein ` +
      `(overflow-x: ${m.leisteOverflowX})`,
  ).toBe(true);
}

/** S5-Vertrag, auch für den gemessenen Umschaltpunkt bei 640 px. */
function pruefeBreiteFlaeche(m: Messung): void {
  expect(
    m.leisteBreite,
    `bei ${m.viewport} px: Reiterspalte ${m.leisteBreite} px statt 200 px`,
  ).toBe(200);
  expect(
    m.leisteRect.rechts,
    `bei ${m.viewport} px steht die Reiterspalte nicht LINKS vom Inhalt`,
  ).toBeLessThanOrEqual(m.spalteRect.x + 1);
  expect(
    Math.abs(m.leisteRect.y - m.spalteRect.y),
    "Reiterspalte und Inhalt haben nicht dieselbe Oberkante",
  ).toBeLessThanOrEqual(1);
  expect(
    m.dokumentScrollWidth,
    `die breite Seite läuft waagerecht über (${m.dokumentScrollWidth} px)`,
  ).toBeLessThanOrEqual(m.viewport + 1);
}

function pruefeRaster(r: Rastermass, sprache: Sprache): void {
  expect(r.knoepfe.map((k) => k.text)).toEqual([...(sprache === "de" ? ROLLEN : ROLLEN_EN)]);
  expect(
    r.dokumentScrollWidth,
    "das geöffnete Rollenraster erzeugt Dokumentüberlauf",
  ).toBeLessThanOrEqual(r.viewport + 1);
  for (const k of r.knoepfe) {
    expect(k.whiteSpace, `„${k.text}": white-space verhindert den Umbruch`).not.toBe("nowrap");
    expect(k.textOverflow, `„${k.text}": text-overflow kürzt`).not.toBe("ellipsis");
    expect(
      k.scrollWidth,
      `„${k.text}" läuft aus dem Knopf: scrollWidth ${k.scrollWidth} > clientWidth ${k.clientWidth}`,
    ).toBeLessThanOrEqual(k.clientWidth);
  }
  for (let i = 0; i < r.knoepfe.length; i++) {
    for (let j = i + 1; j < r.knoepfe.length; j++) {
      const a = r.knoepfe[i] as Rastermass["knoepfe"][number];
      const b = r.knoepfe[j] as Rastermass["knoepfe"][number];
      expect(ueberlappt(a.rect, b.rect), `„${a.text}" und „${b.text}" überlappen sich`).toBe(false);
    }
  }
  // JOB 3124: 30 px bei 320, 100 px bei 390 — nur Verbesserung erlaubt, in beiden Sprachen.
  const vorher = r.viewport === 320 ? 30 : 100;
  expect(
    r.rasterBreite,
    `das Rollenraster ist bei ${r.viewport} px auf ${r.rasterBreite} px geschrumpft (JOB 3124 mass ${vorher} px)`,
  ).toBeGreaterThanOrEqual(vorher);
}

function logMessung(fall: string, m: Messung): void {
  console.log(`JOB 3175 · ${fall}:\n${protokoll(m)}`);
}

/** Die erste Inhaltszeile ist das vom echten Backend angelegte Konto Pedi (starte). */
async function tastaturweg(sprache: Sprache): Promise<void> {
  const reiter: readonly string[] = REITER[sprache];
  const seite = seiteRoh();
  await seite.waitForFunction(
    fn(
      `() => [...document.querySelectorAll('[data-testid="flaeche-nutzer"] button [data-einst="label"]')].some(el => el.textContent === 'Pedi')`,
    ),
  );
  const ohneFokus = await seite.evaluate<string>(fn(RING_OHNE_FOKUS));
  const gesehen: string[] = [];
  const schritt = async (taste: string): Promise<Fokus> => {
    await seite.keyboard.press(taste);
    const f = await seite.evaluate<Fokus>(fn(FOKUS));
    console.log(`JOB 3175 · T1 ${sprache} · ${taste}: ${JSON.stringify(f)}`);
    return f;
  };
  let inhalt: Fokus | undefined;
  for (let i = 0; i < 60; i++) {
    const f = await schritt("Tab");
    if (f.reiterIndex >= 0) {
      const soll = REITER[sprache][gesehen.length];
      expect(f.text, `Tab erreicht Reiter „${soll}" nicht; Fokus: „${f.text}"`).toBe(soll);
      expect(f.tag, `„${soll}" ist kein fokussierter Knopf`).toBe("button");
      expect(
        schattenLagen(f.boxShadow).length,
        `„${soll}" zeichnet keinen sichtbaren Fokusring`,
      ).toBeGreaterThan(schattenLagen(ohneFokus).length);
      gesehen.push(f.text);
    } else if (f.imInhalt) {
      inhalt = f;
      break;
    }
  }
  for (const name of REITER[sprache]) {
    expect(
      gesehen,
      `Tab erreicht Reiter „${name}" nicht; letzter Fokus: „${inhalt?.text ?? "kein Inhalt"}"`,
    ).toContain(name);
  }
  expect(gesehen).toEqual([...REITER[sprache]]);
  expect(inhalt?.tag, "Tab kommt nicht auf dem Inhaltsknopf Pedi an").toBe("button");
  expect(inhalt?.name, "Tab kommt nicht auf dem Inhaltsknopf Pedi an").toBe("Pedi");
  // Jeden Rückwärtsschritt benennen und prüfen, bis wieder der erste Reiter erreicht ist.
  for (const name of [...REITER[sprache]].reverse()) {
    const f = await schritt("Shift+Tab");
    expect(f.text, `Shift+Tab erreicht Reiter „${name}" nicht; Fokus: „${f.text}"`).toBe(name);
    expect(f.reiterIndex).toBe(reiter.indexOf(name));
    expect(
      schattenLagen(f.boxShadow).length,
      `„${name}" zeichnet rückwärts keinen Fokusring`,
    ).toBeGreaterThan(schattenLagen(ohneFokus).length);
  }
}

/** Echter Browser-Reload, einschließlich Nachweis des ausgetauschten Dokuments. */
async function neuLaden(sprache: Sprache): Promise<void> {
  const seite = seiteRoh() as ReturnType<typeof seiteRoh> & {
    reload(opts: { waitUntil: string; timeout: number }): Promise<unknown>;
  };
  await seite.evaluate(fn('() => { document.documentElement.dataset.ux12cVorReload = "ja"; }'));
  await seite.reload({ waitUntil: "load", timeout: 60_000 });
  await seite.waitForFunction(
    fn("() => document.querySelectorAll('[data-einst=\"reiter\"]').length === 4"),
  );
  expect(
    await seite.evaluate(fn("() => document.documentElement.dataset.ux12cVorReload ?? null")),
    "Reload hat das Dokument nicht ersetzt",
  ).toBeNull();
  expect(
    await seite.evaluate(fn('() => performance.getEntriesByType("navigation")[0].type')),
    "kein echter Browser-Reload",
  ).toBe("reload");
  await pruefeSprache(sprache);
}

/** Nur die erwartete fachliche Assertion zählt; Bühnenfehler dürfen keine Gegenprobe bestehen. */
async function erwarteRot(
  id: string,
  pruefung: () => void | Promise<void>,
  meldung: RegExp,
): Promise<void> {
  let fehler: unknown;
  try {
    await pruefung();
  } catch (e) {
    fehler = e;
  }
  expect(fehler, `${id}: die Störung wurde nicht erkannt`).toBeInstanceOf(Error);
  expect(String(fehler), `${id}: falscher Rotgrund`).toMatch(meldung);
  console.log(`JOB 3175 · ${id} ROT: ${String(fehler)}`);
  if (process.env.KLARWERK_UX12C_GEGENPROBE === id) throw fehler;
}

describe("JOB 3175 UX-12c · unabhängige DE/EN-Einstellungen in Chromium", () => {
  beforeAll(async () => {
    stand = await starte("/admin", '[data-einst="seite"]', 320, 740);
  }, 240_000);

  afterAll(async () => {
    await beende(stand);
  }, 60_000);

  afterEach(async () => {
    // Zusätzlich zum finally: keine EN-Vererbung an den nächsten Fall, kein später Seitenfehler.
    if (stand.seite !== null && stand.fehler === null) await pruefeSprache("de");
    expect(stand.seitenfehler, "die Seite hat selbst Fehler geworfen").toEqual([]);
  }, 60_000);

  it("S0 · die Bühne steht: gebaute App, echtes Backend, Chromium", async () => {
    expect(stand.fehler, "Chromium-Bühne kam nicht hoch").toBeNull();
    await setzeSprache("de");
    console.log(`JOB 3175 · Chromium ${stand.version}`);
  });

  for (const sprache of ["de", "en"] as const) {
    for (const breite of [320, 360, 390] as const) {
      const fall =
        sprache === "en"
          ? `S4-EN${breite}`
          : breite === 320
            ? "S1/S3"
            : breite === 390
              ? "S2"
              : "S360-DE";
      it(`${fall} · ${breite} px ${sprache}: ≥ 75 % Inhalt, kein Überlauf, vier vollständig lesbare Reiter`, async () => {
        await inSprache(breite, sprache, async () => {
          const m = await messwert(breite, sprache);
          logMessung(fall, m);
          pruefeSchmaleFlaeche(m, REITER[sprache]);
          expect(m.reiter.length, "vier Reiter — keiner darf schmal verschwinden").toBe(4);
          expect(m.spalteBreite).toBeGreaterThanOrEqual(breite === 390 ? 292 : breite * 0.75);
        });
      }, 120_000);
    }
    for (const breite of [320, 390] as const) {
      it(`S6 · ${breite} px ${sprache}: das Rollenraster trägt alle vollen Namen ungekürzt`, async () => {
        await inSprache(breite, sprache, async () => {
          const r = await messeRaster(breite, sprache);
          // Frische Hüllenmessung bei geöffneter Detailkarte, keine Zahl vom anderen Zustand.
          logMessung("S6", await messen(breite, sprache));
          console.log(`JOB 3175 · S6:\n${rasterProtokoll(r)}`);
          pruefeRaster(r, sprache);
        });
      }, 120_000);
    }
    it(`T1 · 320 px ${sprache}: Tab durch alle Reiter in den Inhalt, Shift+Tab zurück, sichtbarer Fokus`, async () => {
      await inSprache(320, sprache, async () => {
        logMessung("T1", await messen(320, sprache));
        await tastaturweg(sprache);
      });
    }, 120_000);
  }

  for (const breite of [639, 640, 1280] as const) {
    const fall = breite === 639 ? "B1" : breite === 640 ? "B2" : "S5";
    it(`${fall} · ${breite} px de: ${breite === 639 ? "Reiterleiste über dem Inhalt" : "200-px-Reiterspalte links neben dem Inhalt"}`, async () => {
      await inSprache(breite, "de", async () => {
        const m = await messwert(breite, "de");
        logMessung(fall, m);
        if (breite === 639) pruefeSchmaleFlaeche(m, REITER_DE);
        else pruefeBreiteFlaeche(m);
      });
    }, 120_000);
  }

  for (const breite of [320, 360, 390] as const) {
    it(`L1 · ${breite} px: echter Reload trägt EN und die Rückkehr DE`, async () => {
      await inSprache(breite, "en", async () => {
        await neuLaden("en");
        const en = await messen(breite, "en");
        logMessung("L1 Reload EN", en);
        pruefeSchmaleFlaeche(en, REITER_EN);
        await setzeSprache("de");
        await neuLaden("de");
        const de = await messen(breite, "de");
        logMessung("L1 Reload DE", de);
        pruefeSchmaleFlaeche(de, REITER_DE);
        // Beide Objekte stammen aus eigenen Dokumenten; auch ihr Inhalt muss sich unterscheiden.
        expect(en).not.toBe(de);
        expect(en.reiter.map((r) => r.text)).not.toEqual(de.reiter.map((r) => r.text));
      });
    }, 180_000);
  }

  // G aus JOB 3155 lebt in R1 bei 320/de fort, mit derselben Störung und Breitenzusage.
  for (const [breite, sprache] of [
    [320, "de"],
    [360, "de"],
    [360, "en"],
    [390, "en"],
  ] as const) {
    it(`R1 · ${breite} px ${sprache}: die alte 200-px-Zeile macht die Spaltenzusage rot`, async () => {
      await inSprache(breite, sprache, async () => {
        const vorher = await messen(breite, sprache);
        pruefeSchmaleFlaeche(vorher, REITER[sprache]);
        try {
          const kaputt = await messen(breite, sprache, "alt");
          logMessung("R1 Störung", kaputt);
          await erwarteRot(
            "R1",
            () => pruefeSchmaleFlaeche(kaputt, REITER[sprache]),
            /die Inhaltsspalte misst bei \d+ px nur \d+ px/,
          );
        } finally {
          const danach = await messen(breite, sprache);
          pruefeSchmaleFlaeche(danach, REITER[sprache]);
          expect(danach.spalteBreite, "R1: Breite nach Rücknahme verändert").toBe(
            vorher.spalteBreite,
          );
        }
      });
    }, 120_000);
  }

  it("R2 · immer schmal: 639 px bleibt grün, 640 px verliert die linke Reiterspalte", async () => {
    await inSprache(639, "de", async () => {
      try {
        const schmal = await messen(639, "de", "schmal");
        logMessung("R2 Störung 639", schmal);
        pruefeSchmaleFlaeche(schmal, REITER_DE);
      } finally {
        pruefeSchmaleFlaeche(await messen(639, "de"), REITER_DE);
      }
      const vorher = await messen(640, "de");
      pruefeBreiteFlaeche(vorher);
      try {
        const kaputt = await messen(640, "de", "schmal");
        logMessung("R2 Störung 640", kaputt);
        await erwarteRot(
          "R2",
          () => pruefeBreiteFlaeche(kaputt),
          /bei 640 px: Reiterspalte \d+ px statt 200 px/,
        );
      } finally {
        const danach = await messen(640, "de");
        pruefeBreiteFlaeche(danach);
        expect(danach.spalteBreite, "R2: Breite nach Rücknahme verändert").toBe(
          vorher.spalteBreite,
        );
      }
    });
  }, 120_000);

  it("R3 · 320 px en: tabindex=-1 macht den englischen Tastaturweg rot und nennt Accounts", async () => {
    await inSprache(320, "en", async () => {
      const seite = seiteRoh();
      try {
        await seite.evaluate(
          fn(
            `() => document.querySelectorAll('[data-einst="reiter"]').forEach(b => b.setAttribute('tabindex', '-1'))`,
          ),
        );
        expect(
          await seite.evaluate(
            fn(
              `() => [...document.querySelectorAll('[data-einst="reiter"]')].map(b => b.getAttribute('tabindex'))`,
            ),
          ),
        ).toEqual(["-1", "-1", "-1", "-1"]);
        await erwarteRot("R3", () => tastaturweg("en"), /Tab erreicht Reiter „Accounts" nicht/);
      } finally {
        await seite.evaluate(
          fn(
            `() => document.querySelectorAll('[data-einst="reiter"]').forEach(b => b.removeAttribute('tabindex'))`,
          ),
        );
        expect(
          await seite.evaluate(
            fn(
              `() => [...document.querySelectorAll('[data-einst="reiter"]')].map(b => b.getAttribute('tabindex'))`,
            ),
          ),
        ).toEqual([null, null, null, null]);
        await setzeSprache("en");
        await tastaturweg("en");
      }
    });
  }, 180_000);

  for (const art of ["Hülle", "Raster"] as const) {
    it(`R4 · 390 px ${art}: die EN-Sprachkarte lehnt eine echte DE-Messung ab`, async () => {
      await inSprache(390, "de", async () => {
        const de = await messen(390, "de");
        const deRaster = await messeRaster(390, "de");
        await setzeSprache("en");
        const key = schluessel(390, "en");
        const vorher = messungen.get(key);
        const rasterVorher = raster.get(key);
        try {
          // Historischer Erbfall: ECHTE DE-Zahlen unter dem angeforderten EN-Schlüssel.
          // Keine erfundenen Messwerte und keine ausgetauschte Übersetzungstabelle.
          if (art === "Hülle") messungen.set(key, de);
          else raster.set(key, deRaster);
          await erwarteRot(
            "R4",
            async () => {
              if (art === "Hülle") await messwert(390, "en");
              else await messeRaster(390, "en");
            },
            /die Sprachwahl griff nicht: 390\/en enthält de/,
          );
        } finally {
          if (vorher) messungen.set(key, vorher);
          else messungen.delete(key);
          if (rasterVorher) raster.set(key, rasterVorher);
          else raster.delete(key);
          expect(messungen.get(key), "R4: Hüllenspeicher nicht wiederhergestellt").toBe(vorher);
          expect(raster.get(key), "R4: Rasterspeicher nicht wiederhergestellt").toBe(rasterVorher);
          logMessung("R4 Rücknahme EN", await messen(390, "en"));
          pruefeZuordnung(await messeRaster(390, "en"), 390, "en");
        }
      });
    }, 180_000);
  }
});
