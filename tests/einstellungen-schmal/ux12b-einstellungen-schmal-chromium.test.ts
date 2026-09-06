// ================================================================================================
// JOB 3155 · UX-12b — DIE EINSTELLUNGEN AUF DEM TELEFON: GEMESSEN, NICHT GERECHNET.
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
//   S1  320 px, DE — die Inhaltsspalte misst mindestens 240 px (75 % des Fensters) statt ~30 px.
//   S2  390 px, DE — mindestens 292 px statt ~100 px.
//   S3  320 px, DE — kein seitlicher Überlauf; jeder Reiter ganz lesbar, ≥ 40 px hoch, ohne
//       Ellipse, ohne Überlappung, und der letzte Reiter ohne Mausrad erreichbar.
//   S4  320 px, EN — dieselbe Messung mit den längeren englischen Beschriftungen.
//   S5  1280 px, DE — die 200-px-Reiterspalte steht weiterhin LINKS NEBEN dem Inhalt. Dieser Fall
//       ist HEUTE GRÜN und ist die Sperre gegen „schmal repariert, breit kaputt".
//   S6  320/390 px, DE — das Rollenraster aus JOB 3124 an derselben Stelle nachgemessen: die
//       Zusage von damals darf sich nicht verschlechtern, nur verbessern.
//   T1  320 px, DE — echte `Tab`-Anschläge des Browsers durch alle Reiter in den Inhalt, und
//       `Shift+Tab` zurück. Ohne diesen Fall wäre „Reiterspalte schmal ausblenden" eine grüne
//       Halbheit.
//   G   320 px — DIE GEGENPROBE LÄUFT DAUERHAFT MIT: der alte Vertrag (`width: 200px;
//       flex-shrink: 0` an der Reiterspalte, `flex-direction: row; flex-wrap: nowrap` an der
//       Elternzeile) wird per `style` wieder eingesetzt, und S1 MUSS dann wieder rot werden.
//       Ein Test, der auch mit dem alten Layout grün bliebe, misst die falsche Sache.
//
// EIN BROWSER, EINE INSTANZ JE DATEI (s. Kopf von `tests/design/h6-chromium.ts`), und jeder Hook,
// der Browser oder App auf- oder abbaut, bekommt einen EIGENEN Zeitrahmen — Vitest gibt Hooks sonst
// 10 s, unabhängig von `testTimeout`, und die Datei wird rot, obwohl jede Prüfung grün ist
// (Lehre JOB 3130 R5).
import { afterAll, beforeAll, describe, expect, it } from "vitest";
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
/** Dieselben vier auf Englisch — sie sind länger und hüten Lieferung 3 und 4 gegen die Länge. */
const REITER_EN = ["Accounts", "AI", "Data", "Security"] as const;
/** Der Reiter, unter dem die Zeile „Ansicht als Rolle" wohnt (`adm.sec.konten`, de). */
const RASTER_REITER = "Konten";
/** Die vollen Rollennamen (`role.name.*`, de) in der Reihenfolge von `ROLES` — JOB 3124. */
const ROLLEN = ["Betrachter", "Experte", "Controller", "Administrator"] as const;
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
  leisteVor.style.width = stoerung ? '200px' : '';
  leisteVor.style.flexShrink = stoerung ? '0' : '';
  zeile.style.flexDirection = stoerung ? 'row' : '';
  zeile.style.flexWrap = stoerung ? 'nowrap' : '';
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
  const leer = { viewport: window.innerWidth, dokumentScrollWidth: 0, rasterBreite: 0, knoepfe: [] };

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
    rasterBreite: knoepfe[0].parentElement.clientWidth,
    knoepfe: mass,
  };
})`;

/** Was gerade den Fokus hat — der Beleg, dass die Tabreihenfolge wirklich dort ankommt. */
interface Fokus {
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
  if (!a) return { tag: '', text: '', reiterIndex: -1, imInhalt: false, boxShadow: '' };
  const reiter = [...document.querySelectorAll('[data-einst="reiter"]')];
  const spalte = document.querySelector('[data-einst="spalte"]');
  return {
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
const messungen = new Map<number, Messung>();
const raster = new Map<number, Rastermass>();

/** Die Seite roh — die Bühne reicht sie durch, ihr Typ nennt nur, was hier gebraucht wird. */
function seiteRoh(): Seite & SeiteMitViewport & SeiteMitTastatur {
  const seite = stand.seite;
  if (seite === null) {
    throw new Error(`Bühne steht nicht: ${stand.fehler ?? "unbekannt"}`);
  }
  return seite as unknown as Seite & SeiteMitViewport & SeiteMitTastatur;
}

async function messen(breite: number, stoerung = false): Promise<Messung> {
  const seite = seiteRoh();
  await seite.setViewportSize({ width: breite, height: 740 });
  return await seite.evaluate<Messung>(fn(MESSEN), [stoerung]);
}

async function messeRaster(breite: number): Promise<Rastermass> {
  const seite = seiteRoh();
  await seite.setViewportSize({ width: breite, height: 740 });
  return await seite.evaluate<Rastermass>(fn(MESSEN_RASTER), [RASTER_REITER]);
}

/** Die Sprachwahl des Produkts setzen und neu laden (`tests/profil-schmal/schmal-buehne.ts:226`). */
async function setzeSprache(sprache: string): Promise<void> {
  await seiteRoh().evaluate<null>(
    fn(
      "([schluessel, wert]) => { try { localStorage.setItem(schluessel, wert); } catch (e) {} return null; }",
    ),
    [SPRACHE_STORAGE_KEY, sprache],
  );
  await wechsle(stand, "/admin", '[data-einst="seite"]');
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
    `  document.scrollWidth ${m.dokumentScrollWidth} px`,
    ...m.reiter.map(
      (r) =>
        `    „${r.text}" — ${Math.round(r.rect.breite)}×${Math.round(r.rect.hoehe)} px, ` +
        `client ${r.clientWidth} px, scroll ${r.scrollWidth} px, text-overflow ${r.textOverflow}`,
    ),
  ].join("\n");
}

function rasterProtokoll(r: Rastermass): string {
  return [
    `  Viewport ${r.viewport} px · Rollenraster ${r.rasterBreite} px`,
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

describe("JOB 3155 UX-12b · die Einstellungen bei 320 und 390 px, in Chromium gemessen", () => {
  beforeAll(async () => {
    stand = await starte("/admin", '[data-einst="seite"]', 320, 740);
    if (stand.fehler === null) {
      messungen.set(320, await messen(320));
      messungen.set(390, await messen(390));
      messungen.set(1280, await messen(1280));
      raster.set(320, await messeRaster(320));
      raster.set(390, await messeRaster(390));
    }
  }, 240_000);

  afterAll(async () => {
    await beende(stand);
  }, 60_000);

  it("S0 · die Bühne steht: gebaute App, echtes Backend, Chromium", () => {
    expect(stand.fehler, "Chromium-Bühne kam nicht hoch").toBeNull();
    expect(stand.seitenfehler, "die Seite hat selbst Fehler geworfen").toEqual([]);
    for (const breite of [320, 390, 1280]) {
      const m = messungen.get(breite);
      expect(m?.fehler, `Messung bei ${breite} px`).toBeNull();
      expect(m?.viewport, `Viewport bei ${breite} px`).toBe(breite);
      // eslint-disable-next-line no-console -- die Messwerte sind der Beleg der Rückgabe
      console.log(`JOB 3155 · Einstellungshülle gemessen:\n${protokoll(m as Messung)}`);
    }
  });

  it("S1 · bei 320 px bekommt die Inhaltsspalte mindestens 240 px (heute ~30 px)", () => {
    const m = messungen.get(320) as Messung;
    expect(m.sprache, "S1 misst die deutsche Fläche").toBe("de");
    pruefeSchmaleFlaeche(m, REITER_DE);
    expect(m.spalteBreite).toBeGreaterThanOrEqual(240);
  });

  it("S2 · bei 390 px bekommt die Inhaltsspalte mindestens 292 px (heute ~100 px)", () => {
    const m = messungen.get(390) as Messung;
    pruefeSchmaleFlaeche(m, REITER_DE);
    expect(m.spalteBreite).toBeGreaterThanOrEqual(292);
  });

  it("S3 · bei 320 px läuft nichts über, jeder Reiter ist lesbar, treffbar und ganz da", () => {
    const m = messungen.get(320) as Messung;
    // pruefeSchmaleFlaeche trägt die Zusicherungen; hier steht der Fall, der sie benennt.
    pruefeSchmaleFlaeche(m, REITER_DE);
    expect(m.reiter.length, "vier Reiter — keiner darf schmal verschwinden").toBe(4);
  });

  it("S4 · dieselbe Messung auf Englisch: die längeren Beschriftungen brechen nichts", async () => {
    try {
      await setzeSprache("en");
      expect(stand.fehler, "die Adminansicht kam auf Englisch nicht hoch").toBeNull();
      const m = await messen(320);
      expect(m.fehler, "EN-Messung bei 320 px").toBeNull();
      expect(m.sprache, "die Sprachwahl griff nicht").toBe("en");
      // eslint-disable-next-line no-console -- der Beleg der Rückgabe
      console.log(`JOB 3155 · Einstellungshülle EN gemessen:\n${protokoll(m)}`);
      pruefeSchmaleFlaeche(m, REITER_EN);
      expect(m.spalteBreite).toBeGreaterThanOrEqual(240);
    } finally {
      // Kein Fall erbt die fremde Sprache — auch dann nicht, wenn dieser hier rot geworden ist.
      await setzeSprache("de");
    }
  }, 120_000);

  it("S5 · bei 1280 px bleibt die 200-px-Reiterspalte links neben dem Inhalt", () => {
    const m = messungen.get(1280) as Messung;
    expect(m.leisteBreite, "die breite Fläche hat ihre 200-px-Reiterspalte verloren").toBe(200);
    expect(
      m.leisteRect.rechts,
      "die Reiterspalte steht bei 1280 px nicht mehr LINKS vom Inhalt",
    ).toBeLessThanOrEqual(m.spalteRect.x + 1);
    expect(
      Math.abs(m.leisteRect.y - m.spalteRect.y),
      "Reiterspalte und Inhalt haben bei 1280 px nicht mehr dieselbe Oberkante",
    ).toBeLessThanOrEqual(1);
    expect(
      m.dokumentScrollWidth,
      `die breite Seite läuft waagerecht über (${m.dokumentScrollWidth} px)`,
    ).toBeLessThanOrEqual(1280 + 1);
  });

  for (const breite of [320, 390] as const) {
    it(`S6 · bei ${breite} px trägt das Rollenraster aus JOB 3124 seine Namen weiterhin ungekürzt`, () => {
      const r = raster.get(breite) as Rastermass;
      expect(r.fehler, `Rastermessung bei ${breite} px`).toBeNull();
      expect(r.viewport).toBe(breite);
      // eslint-disable-next-line no-console -- Lieferung 7: die Zahlen gehören in die Rückgabe
      console.log(`JOB 3155 · Rollenraster nachgemessen:\n${rasterProtokoll(r)}`);
      expect(r.knoepfe.map((k) => k.text)).toEqual([...ROLLEN]);
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
          expect(ueberlappt(a.rect, b.rect), `„${a.text}" und „${b.text}" überlappen sich`).toBe(
            false,
          );
        }
      }
      // Die Zusage von JOB 3124 darf sich nur VERBESSERN: gemessen wurden damals 30 px (320 px)
      // und 100 px (390 px) Rasterbreite (`archiv/3124/runde-4/ben.md:26`).
      const vorher = breite === 320 ? 30 : 100;
      expect(
        r.rasterBreite,
        `das Rollenraster ist bei ${breite} px auf ${r.rasterBreite} px geschrumpft (JOB 3124 mass ${vorher} px)`,
      ).toBeGreaterThanOrEqual(vorher);
    });
  }

  it("T1 · bei 320 px führt Tab durch jeden Reiter in den Inhalt, Shift+Tab wieder zurück", async () => {
    const seite = seiteRoh();
    await seite.setViewportSize({ width: 320, height: 740 });
    // Frischer Aufbau: die Tabreihenfolge soll aus dem Nichts starten, nicht dort, wo eine
    // vorherige Messung den Fokus liegen liess.
    await wechsle(stand, "/admin", '[data-einst="seite"]');
    expect(stand.fehler, "die Adminansicht kam nach dem Neuladen nicht hoch").toBeNull();
    const ohneFokus = await seite.evaluate<string>(fn(RING_OHNE_FOKUS));

    const gesehen: number[] = [];
    let inhaltNach = -1;
    let ringLagen = 0;
    for (let i = 1; i <= 60 && inhaltNach < 0; i++) {
      await seite.keyboard.press("Tab");
      const f = await seite.evaluate<Fokus>(fn(FOKUS));
      if (f.reiterIndex >= 0) {
        gesehen.push(f.reiterIndex);
        ringLagen = Math.max(ringLagen, schattenLagen(f.boxShadow).length);
        continue;
      }
      if (gesehen.length > 0 && f.imInhalt) {
        inhaltNach = i;
      }
    }
    expect(
      gesehen,
      "Tab erreicht nicht jeden Reiter in Lesereihenfolge — das wäre die Halbheit: Reiterleiste schmal ausgeblendet",
    ).toEqual([0, 1, 2, 3]);
    expect(
      inhaltNach,
      "nach dem letzten Reiter kam die Tabreihenfolge nicht im Inhalt an (`schritte === -1`)",
    ).toBeGreaterThan(0);
    // Der Fokusring kommt aus der globalen Regel (`apps/web/src/index.css`, Scheibe D-024) — hier
    // wird gemessen, dass er wirklich zeichnet, statt es zu behaupten.
    expect(
      ringLagen,
      `ein fokussierter Reiter zeichnet keinen sichtbaren Ring (ohne Fokus: ${ohneFokus})`,
    ).toBeGreaterThan(schattenLagen(ohneFokus).length);

    await seite.keyboard.press("Shift+Tab");
    const zurueck = await seite.evaluate<Fokus>(fn(FOKUS));
    expect(zurueck.reiterIndex, "Shift+Tab führt nicht zum letzten Reiter zurück").toBe(3);
    // eslint-disable-next-line no-console -- der Beleg der Rückgabe
    console.log(
      `JOB 3155 · Tastaturweg bei 320 px: Reiter in Lesereihenfolge ${gesehen.join(", ")} · ` +
        `Inhalt nach ${inhaltNach} Anschlägen · Ring ${ringLagen} Lage(n)`,
    );
  }, 120_000);

  it("G · Gegenprobe: mit dem alten Vertrag (200 px, nowrap) wird S1 wieder rot", async () => {
    const kaputt = await messen(320, true);
    expect(kaputt.fehler, "Gegenprobenmessung").toBeNull();
    expect(
      kaputt.spalteBreite,
      `mit width:200px + flex-wrap:nowrap müsste die Inhaltsspalte unter 240 px fallen — sie misst ${kaputt.spalteBreite} px. Der Test misst sonst die falsche Sache.`,
    ).toBeLessThan(240);
    // eslint-disable-next-line no-console -- der Beleg, dass die Gegenprobe wirklich greift
    console.log(
      `JOB 3155 · Gegenprobe G bei 320 px: Inhaltsspalte ${kaputt.spalteBreite} px (alter Vertrag)`,
    );

    // Und der gesunde Zustand kommt zurück, sobald der Eingriff weg ist.
    const geheilt = await messen(320);
    expect(geheilt.fehler).toBeNull();
    expect(
      geheilt.spalteBreite,
      "nach der Gegenprobe kam die volle Breite nicht zurück",
    ).toBeGreaterThanOrEqual(240);
  }, 120_000);
});
