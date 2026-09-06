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
// (`white-space: nowrap`), muss WIEDER rot werden. Ein Test, der auch mit abgeschnittenem Text grün
// bliebe, misst die falsche Sache.
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

/** Die vollen Rollennamen (`role.name.*`, de) in der Reihenfolge von `ROLES`. */
const NAMEN = ["Betrachter", "Experte", "Controller", "Administrator"] as const;
/** Der Reiter, unter dem die Zeile „Ansicht als Rolle" wohnt (`adm.sec.konten`, de). */
const REITER = "Konten";

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
const MESSEN = `(async ([reiterName, nowrap, breite, timeout]) => {
  const norm = (s) => (s || '').replace(/\\s+/g, ' ').trim();
  const warte = async (pruefung, ms = 8000) => {
    const bis = Date.now() + ms;
    while (Date.now() < bis) {
      if (pruefung()) return true;
      await new Promise((r) => requestAnimationFrame(r));
    }
    return pruefung();
  };
  const leer = { viewport: 0, dokumentScrollWidth: 0, rasterKlasse: '', rasterBreite: 0, knoepfe: [] };

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
  const layout = () => {
    const knoepfe = [...karte.querySelectorAll('button[aria-pressed]')];
    const raster = knoepfe[0]?.parentElement;
    const spalten = raster ? getComputedStyle(raster).gridTemplateColumns.split(' ') : [];
    const breiten = knoepfe.map(b => b.getBoundingClientRect().width);
    const hoehen = knoepfe.map(b => b.getBoundingClientRect().height);
    return { viewport: window.innerWidth, rasterBreite: raster?.clientWidth ?? 0, spalten, breiten, hoehen };
  };
  if (!(await warte(() => {
    const ist = layout();
    const spalten = breite >= 1024 ? 4 : breite >= 640 ? 2 : 1;
    return ist.viewport === breite && ist.rasterBreite > 0
      && ist.spalten.length === spalten && ist.spalten.every(s => parseFloat(s) > 0)
      && ist.breiten.length === 4 && ist.breiten.every(b => b > 0) && ist.hoehen.every(h => h > 0);
  }, timeout))) return Object.assign({ fehler: 'Rollenraster nicht bereit: ' + JSON.stringify(layout()) }, leer);
  await document.fonts.ready;
  const knoepfe = [...karte.querySelectorAll('button[aria-pressed]')];

  // 3. Nur für die Gegenprobe S3: den Vertrag einsetzen, der den Schaden macht — und ihn danach
  //    wieder abräumen. Jede Messung ohne Flagge stellt den Auslieferungszustand her.
  for (const b of knoepfe) {
    b.style.whiteSpace = nowrap ? 'nowrap' : '';
    b.style.overflow = nowrap ? 'hidden' : '';
    b.style.textOverflow = nowrap ? 'ellipsis' : '';
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

let stand: Stand;
const messungen = new Map<number, Messung>();

async function messen(breite: number, nowrap = false, timeout = 8_000): Promise<Messung> {
  const seite = stand.seite;
  if (seite === null) {
    throw new Error(`Bühne steht nicht: ${stand.fehler ?? "unbekannt"}`);
  }
  await (seite as unknown as SeiteMitViewport).setViewportSize({ width: breite, height: 740 });
  return await seite.evaluate<Messung>(fn(MESSEN), [REITER, nowrap, breite, timeout]);
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
    `  Viewport ${breite} px · Raster ${m.rasterBreite} px (${m.rasterKlasse})`,
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
    await beende(stand);
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
    it(`S1 · bei ${breite} px stehen alle vier Namen vollständig im Knopf`, () => {
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
      "mit white-space:nowrap + ellipsis müsste der Text kürzen — der Test misst sonst die falsche Sache",
    ).toBeGreaterThan(0);
    // Und der gesunde Zustand kommt zurück, sobald die eingesetzte Störung weg ist.
    const geheilt = await messen(320);
    for (const k of geheilt.knoepfe) {
      expect(k.scrollWidth, `„${k.text}" nach der Gegenprobe`).toBeLessThanOrEqual(k.clientWidth);
    }
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
