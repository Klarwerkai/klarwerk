// ================================================================================================
// JOB 3117 · UX-13 — DIE PROFILZEILE GIBT BEI 320 PIXELN DIE BESCHRIFTUNG NICHT MEHR PREIS.
// ================================================================================================
//
// DER SCHADEN, GEMESSEN (Gegenprüfung N-0030 vom 2026-09-06T06:01:59 auf Live 1.0.0-beta.1.124,
// `belege/gegenpruefung-N-0030-20260906-0600/messungen.json`), Viewport 320 × 740 auf `/profil`:
//   · Label „E-Mail"      `clientWidth` 15 px bei `scrollWidth` 40 px  → sichtbar „E..“
//   · Name „Codex Abnahme" `clientWidth` 95 px bei `scrollWidth` 103 px → sichtbar „Codex Abnah…“
//   · Wert `codex-abnahme@demo.klarwerk` 208 px = 208 px               → ungekürzt
// Der Wert nahm 208 von 320 px, die Beschriftung behielt 15. Kein Datenverlust — die Volltexte
// standen im DOM —, sondern ein Lesbarkeitsschaden aus der Aufteilung im Engpass.
//
// DIESELBE MESSGRÖSSE PRÜFT DIESE DATEI: `scrollWidth <= clientWidth` an jedem Träger, der
// Beschriftungstext trägt. Gemessen wird nicht an einem Nachbau, sondern an der GEBAUTEN Anwendung
// (`apps/web/dist`) in Chromium, mit dem echten Fastify-Backend dahinter — derselbe Weg wie
// `tests/design/zielbild-h6-einstellungen.test.ts`, nur mit wählbarem Konto und wählbarer Breite
// (`schmal-buehne.ts`).
//
// DIE GEGENPROBE LÄUFT MIT (Fall G). Sie setzt den alten Vertrag an denselben Elementen wieder ein
// — Zeile `flex-wrap: nowrap`, Wert-Träger `flex-shrink: 0`, Beschriftung `overflow: hidden;
// text-overflow: ellipsis; white-space: nowrap` — und verlangt, dass die Messung dann WIEDER rot
// wird. Ein Test, der auch mit dem alten Verhalten grün bliebe, misst die falsche Sache.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { fn } from "../design/h6-chromium";
import {
  type Buehne,
  type Konto,
  beendeBuehne,
  setzeBreite,
  setzeSprache,
  starteBuehne,
  wechsleKonto,
} from "./schmal-buehne";

/** Das Konto der Gegenprüfung N-0030 — Wort für Wort, damit die Zahlen vergleichbar bleiben. */
const KONTO_BELEG: Konto = { name: "Codex Abnahme", email: "codex-abnahme@demo.klarwerk" };
/** Deutlich länger als der Beleg — Auftrag § 6.3. */
const KONTO_LANG: Konto = {
  name: "Maximiliane Schweighofer-Brandenburg",
  email: "maximiliane.schweighofer-brandenburg@abnahme.klarwerk.example",
};

const ZEILEN = ["zeile-name", "zeile-email", "zeile-sprache", "zeile-passwort"] as const;
type ZeilenId = (typeof ZEILEN)[number];

interface Mass {
  text: string;
  /** Wie viele Zeilenkästen der Inhalt belegt — 1 heißt: nicht umbrochen. */
  textZeilen: number;
  klasse: string;
  clientWidth: number;
  scrollWidth: number;
  rect: { x: number; y: number; width: number; height: number };
  whiteSpace: string;
  textOverflow: string;
  overflowX: string;
}
interface ZeilenMass {
  zeile: Mass;
  label: Mass;
  /** Der Träger, der den Beschriftungstext SELBST hält (ohne das Kürzelzeichen davor). */
  beschriftung: Mass;
  /** Der Label-Träger selbst UND jedes Element darin, das Text trägt. */
  beschriftungsTraeger: Mass[];
  wertRahmen: Mass | null;
  wert: Mass | null;
  symbol: Mass | null;
  steuerung: Mass | null;
  knoepfe: Mass[];
  /** Das Kürzelzeichen vor dem Label (nur `zeile-name`). */
  vorn: Mass | null;
}
interface Messung {
  fehlt: string | null;
  zeilen: Record<ZeilenId, ZeilenMass>;
  documentWidth: number;
  viewportWidth: number;
}

// ---- In der Seite: messen ------------------------------------------------------------------------
const MESSEN = `(testIds) => {
  const zeilenkaesten = (el) => {
    const bereich = document.createRange();
    bereich.selectNodeContents(el);
    return bereich.getClientRects().length;
  };
  const mass = (el) => {
    if (!el) { return null; }
    const r = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    return {
      textZeilen: zeilenkaesten(el),
      text: (el.textContent || '').replace(/\\s+/g, ' ').trim(),
      klasse: String(el.getAttribute('class') || ''),
      clientWidth: el.clientWidth,
      scrollWidth: el.scrollWidth,
      rect: { x: r.x, y: r.y, width: r.width, height: r.height },
      whiteSpace: s.whiteSpace,
      textOverflow: s.textOverflow,
      overflowX: s.overflowX,
    };
  };
  const zeilen = {};
  for (const id of testIds) {
    const zeile = document.querySelector('[data-testid="' + id + '"]');
    if (!zeile) { return { fehlt: id, zeilen: {}, documentWidth: 0, viewportWidth: 0 }; }
    const label = zeile.querySelector('[data-einst="label"]');
    if (!label) { return { fehlt: id + ' (Label)', zeilen: {}, documentWidth: 0, viewportWidth: 0 }; }
    const traeger = [label]
      .concat(Array.prototype.slice.call(label.querySelectorAll('*')))
      .filter((el) => el.tagName.toLowerCase() !== 'svg' && (el.textContent || '').trim() !== '');
    zeilen[id] = {
      zeile: mass(zeile),
      label: mass(label),
      beschriftung: mass(label.firstElementChild ? label.lastElementChild : label),
      beschriftungsTraeger: traeger.map(mass),
      wertRahmen: mass(label.nextElementSibling),
      wert: mass(zeile.querySelector('[data-einst="wert"]')),
      symbol: mass(zeile.querySelector('[data-einst="chevron"], [data-einst="schloss"]')),
      steuerung: mass(zeile.querySelector('[data-testid="sprach-knoepfe"]')),
      knoepfe: Array.prototype.slice
        .call(zeile.querySelectorAll('[data-testid="sprach-knoepfe"] button'))
        .map(mass),
      vorn: mass(label.firstElementChild),
    };
  }
  return {
    fehlt: null,
    zeilen: zeilen,
    documentWidth: document.documentElement.scrollWidth,
    viewportWidth: window.innerWidth,
  };
}`;

/**
 * In der Seite: den ALTEN Vertrag ein- und wieder ausschalten — als Inline-Stil, damit die
 * Gegenprobe nicht davon abhängt, welche Tailwind-Klassen im Bündel gelandet sind.
 *
 * Die vier Stellen sind genau die, die der Auftrag als Ursache belegt hat
 * (`Zeilenkarte.tsx:117-119`, `:122`, `:126`, `:131` am Ausgangsstand).
 */
const ALTER_VERTRAG = `([an, testIds]) => {
  for (const id of testIds) {
    const zeile = document.querySelector('[data-testid="' + id + '"]');
    if (!zeile) { continue; }
    const label = zeile.querySelector('[data-einst="label"]');
    if (!label) { continue; }
    zeile.style.flexWrap = an ? 'nowrap' : '';
    const rahmen = label.nextElementSibling;
    if (rahmen) { rahmen.style.flexShrink = an ? '0' : ''; }
    const kuerzen = [label].concat(Array.prototype.slice.call(label.querySelectorAll('span')));
    for (const el of kuerzen) {
      el.style.overflow = an ? 'hidden' : '';
      el.style.textOverflow = an ? 'ellipsis' : '';
      el.style.whiteSpace = an ? 'nowrap' : '';
    }
  }
  return null;
}`;

async function miss(buehne: Buehne): Promise<Messung> {
  const seite = buehne.seite;
  if (seite === null) {
    throw new Error(`Bühne steht nicht: ${buehne.fehler ?? "unbekannt"}`);
  }
  return seite.evaluate<Messung>(fn(MESSEN), [...ZEILEN]);
}

async function mitAltemVertrag(buehne: Buehne, an: boolean): Promise<void> {
  const seite = buehne.seite;
  if (seite === null) {
    throw new Error(`Bühne steht nicht: ${buehne.fehler ?? "unbekannt"}`);
  }
  await seite.evaluate<null>(fn(ALTER_VERTRAG), [an, [...ZEILEN]]);
}

// ---- Zusicherungen als Bausteine ------------------------------------------------------------------
/** Kein Träger der Beschriftung schneidet Text ab: `scrollWidth <= clientWidth`. */
function beschriftungVollstaendig(m: Messung, id: ZeilenId): void {
  for (const t of m.zeilen[id].beschriftungsTraeger) {
    expect(
      t.scrollWidth,
      `${id}: Beschriftungsträger „${t.text}" gekürzt — scrollWidth ${t.scrollWidth} > clientWidth ${t.clientWidth} (Klasse „${t.klasse}", white-space ${t.whiteSpace}, text-overflow ${t.textOverflow}, overflow-x ${t.overflowX})`,
    ).toBeLessThanOrEqual(t.clientWidth);
  }
}
/**
 * Die Beschriftung wird nicht MITTEN IM WORT zerlegt.
 *
 * „Vollständig lesbar" ist mehr als „nicht abgeschnitten": passte „E-Mail" für sich allein in die
 * Zeilenbreite, muss die ZEILE als Ganzes umbrechen (der Wert rückt darunter) — nicht das Wort.
 * Ohne diese Zusicherung wäre auch ein „E-" über „Mail" grün, und der Lesbarkeitsschaden wäre nur
 * verschoben statt behoben. Genau das misst der `flex-wrap`-Teil des Umbruchvertrags.
 */
function beschriftungEinzeilig(m: Messung, id: ZeilenId): void {
  const b = m.zeilen[id].beschriftung;
  expect(
    b.textZeilen,
    `${id}: Beschriftung „${b.text}" steht auf ${b.textZeilen} Zeilen — sie hätte auf eine gepasst, wenn die ZEILE umgebrochen wäre`,
  ).toBe(1);
}
/** Mindestens ein Träger schneidet ab — die Aussage der Gegenprobe. */
function beschriftungGekuerzt(m: Messung, id: ZeilenId): void {
  const gekuerzt = m.zeilen[id].beschriftungsTraeger.filter((t) => t.scrollWidth > t.clientWidth);
  expect(
    gekuerzt.length,
    `${id}: mit dem alten Vertrag wurde NICHTS gekürzt — dann misst der Test nicht die Ursache. Träger: ${JSON.stringify(
      m.zeilen[id].beschriftungsTraeger.map((t) => [t.text, t.clientWidth, t.scrollWidth]),
    )}`,
  ).toBeGreaterThan(0);
}
/** Zwei Kästen stehen auf derselben Zeile (überlappende senkrechte Bereiche). */
function gleicheZeile(a: Mass, b: Mass): boolean {
  return (
    Math.min(a.rect.y + a.rect.height, b.rect.y + b.rect.height) > Math.max(a.rect.y, b.rect.y)
  );
}

describe("JOB 3117 UX-13 · Profil bei 320 px — gemessen an der gebauten Seite in Chromium", () => {
  let buehne: Buehne | null = null;
  let m320: Messung | null = null;
  let mGegenprobe: Messung | null = null;
  let mNachRuecknahme: Messung | null = null;
  let m390: Messung | null = null;
  let mLangDe: Messung | null = null;
  let mLangEn: Messung | null = null;
  let mLangGegenprobe: Messung | null = null;

  beforeAll(async () => {
    buehne = await starteBuehne(KONTO_BELEG, 320, 740);
    if (buehne.fehler !== null) {
      return;
    }
    // 1) Das Konto des Belegs bei 320 px — die Messung, die den Schaden belegt hat.
    m320 = await miss(buehne);
    // G) Alter Vertrag wieder eingesetzt → dieselbe Messgröße muss wieder rot werden.
    await mitAltemVertrag(buehne, true);
    mGegenprobe = await miss(buehne);
    await mitAltemVertrag(buehne, false);
    mNachRuecknahme = await miss(buehne);
    // 2) Dieselbe Seite bei 390 px — die breite Ansicht darf nicht umbrechen.
    await setzeBreite(buehne, 390, 844);
    m390 = await miss(buehne);
    // 3) Ein deutlich längerer Name und eine längere Adresse, DE und EN, wieder bei 320 px.
    await setzeBreite(buehne, 320, 740);
    await wechsleKonto(buehne, KONTO_LANG);
    mLangDe = await miss(buehne);
    await mitAltemVertrag(buehne, true);
    mLangGegenprobe = await miss(buehne);
    await mitAltemVertrag(buehne, false);
    await setzeSprache(buehne, "en");
    mLangEn = await miss(buehne);
    console.info(
      `JOB 3117 UX-13 · Chromium ${buehne.version} · Theme ${buehne.theme} · 320px E-Mail-Label ` +
        `${JSON.stringify(m320?.zeilen["zeile-email"].label.clientWidth)}/${JSON.stringify(
          m320?.zeilen["zeile-email"].label.scrollWidth,
        )} · Gegenprobe ${JSON.stringify(
          mGegenprobe?.zeilen["zeile-email"].label.clientWidth,
        )}/${JSON.stringify(mGegenprobe?.zeilen["zeile-email"].label.scrollWidth)}`,
    );
  }, 180_000);

  afterAll(async () => {
    if (buehne) {
      await beendeBuehne(buehne);
    }
  }, 60_000);

  it("S · die gebaute Seite steht: Theme modern, alle Profilzeilen da, keine Seitenfehler", () => {
    expect(buehne?.fehler, "Bühne nicht gestartet").toBeNull();
    expect(buehne?.theme).toBe("modern");
    expect(m320?.fehlt, "eine Profilzeile fehlt").toBeNull();
    expect(m320?.viewportWidth).toBe(320);
    expect(buehne?.seitenfehler).toEqual([]);
    // Die Volltexte stehen in der Seite — der Schaden war Lesbarkeit, nicht Datenverlust.
    expect(m320?.zeilen["zeile-name"].beschriftung.text).toBe(KONTO_BELEG.name);
    expect(m320?.zeilen["zeile-email"].wert?.text).toBe(KONTO_BELEG.email);
  });

  it("F1 · 320 px: „E-Mail“ und der Name werden nicht mehr gekürzt (scrollWidth ≤ clientWidth)", () => {
    const m = m320 as Messung;
    expect(m.zeilen["zeile-email"].beschriftung.text).toBe("E-Mail");
    // Alle Zeilen der Karte — die Reparatur sitzt in der geteilten Zeile, nicht in einer von ihnen.
    for (const id of ZEILEN) {
      beschriftungVollstaendig(m, id);
      beschriftungEinzeilig(m, id);
    }
  });

  it("F1b · 320 px: kein horizontaler Überlauf — die Reparatur schiebt nichts ins Seitwärtsscrollen", () => {
    expect((m320 as Messung).documentWidth).toBe(320);
  });

  it("G · Gegenprobe: mit dem alten Vertrag wird dieselbe Messung wieder rot, ohne ihn wieder grün", () => {
    const alt = mGegenprobe as Messung;
    beschriftungGekuerzt(alt, "zeile-email");
    beschriftungGekuerzt(alt, "zeile-name");
    // Und die Rücknahme wirkt: derselbe Baum, dieselbe Messung, wieder vollständig.
    beschriftungVollstaendig(mNachRuecknahme as Messung, "zeile-email");
    beschriftungVollstaendig(mNachRuecknahme as Messung, "zeile-name");
  });

  it("F4 · 320 px: Symbol, Sprachknöpfe und Kürzelzeichen bleiben ganz und am rechten Platz", () => {
    const m = m320 as Messung;
    for (const id of ["zeile-email", "zeile-passwort"] as const) {
      const z = m.zeilen[id];
      expect(z.symbol, `${id}: Chevron/Schloss fehlt`).not.toBeNull();
      const s = z.symbol as Mass;
      expect(s.rect.width, `${id}: Symbol zusammengedrückt`).toBeGreaterThanOrEqual(13);
      expect(
        s.rect.x + s.rect.width,
        `${id}: Symbol ragt über die Zeile hinaus`,
      ).toBeLessThanOrEqual(z.zeile.rect.x + z.zeile.rect.width + 0.5);
      // Rechts: das Symbol schließt den Wert-Block ab.
      const rahmen = z.wertRahmen as Mass;
      expect(
        s.rect.x + s.rect.width,
        `${id}: Symbol steht nicht rechts außen`,
      ).toBeGreaterThanOrEqual(rahmen.rect.x + rahmen.rect.width - 0.5);
    }
    // Die Sprachwahl: das Bedienelement steht in der Zeile, drei Knöpfe, jeder mit Fläche.
    const sprache = m.zeilen["zeile-sprache"];
    expect(sprache.steuerung, "die Sprachwahl steht nicht mehr in der Zeile").not.toBeNull();
    // Der sichtbare Text ist versal gesetzt (CSS `uppercase`); im DOM stehen die Sprachkürzel.
    expect(sprache.knoepfe.map((k) => k.text)).toEqual(["de", "en", "nl"]);
    for (const k of sprache.knoepfe) {
      expect(k.rect.width, `Sprachknopf ${k.text} ohne Fläche`).toBeGreaterThan(20);
      expect(
        k.rect.x + k.rect.width,
        `Sprachknopf ${k.text} ragt aus dem Fenster`,
      ).toBeLessThanOrEqual(320.5);
    }
    // Das Kürzelzeichen bleibt 32 × 32 und steht am linken Rand des Zeileninhalts.
    const vorn = m.zeilen["zeile-name"].vorn as Mass;
    expect(vorn.text).toBe("CO");
    expect(vorn.rect.width).toBe(32);
    expect(vorn.rect.height).toBe(32);
    expect(vorn.rect.x).toBeCloseTo(m.zeilen["zeile-name"].label.rect.x, 1);
  });

  it("F5 · 320 px: der Wert bleibt vollständig zugänglich, auch der Zusatz aus dem Zustandsmodell", () => {
    const m = m320 as Messung;
    for (const id of ["zeile-name", "zeile-email"] as const) {
      const w = m.zeilen[id].wert as Mass;
      expect(w, `${id}: Wert fehlt`).not.toBeNull();
      expect(
        w.scrollWidth,
        `${id}: Wert „${w.text}" gekürzt — ${w.scrollWidth} > ${w.clientWidth}`,
      ).toBeLessThanOrEqual(w.clientWidth);
    }
    expect(m.zeilen["zeile-name"].wert?.text).toBe("Administrator");
  });

  it("F2 · 390 px: Beschriftung und Wert stehen weiter auf EINER Zeile, Label links, Wert rechts", () => {
    const m = m390 as Messung;
    expect(m.viewportWidth).toBe(390);
    expect(m.documentWidth).toBe(390);
    for (const id of ["zeile-name", "zeile-email"] as const) {
      const z = m.zeilen[id];
      const rahmen = z.wertRahmen as Mass;
      expect(gleicheZeile(z.label, rahmen), `${id}: bei 390 px umgebrochen`).toBe(true);
      expect(z.label.rect.x, `${id}: Label steht nicht links`).toBeLessThan(rahmen.rect.x);
      beschriftungVollstaendig(m, id);
      beschriftungEinzeilig(m, id);
    }
  });

  it("F3 · 320 px, langer Name und lange Adresse: Beschriftung vollständig in DE und EN", () => {
    for (const [sprache, m] of [
      ["de", mLangDe as Messung],
      ["en", mLangEn as Messung],
    ] as const) {
      expect(m.fehlt, `${sprache}: Zeile fehlt`).toBeNull();
      expect(
        m.zeilen["zeile-name"].beschriftung.text,
        `${sprache}: Name unvollständig im DOM`,
      ).toBe(KONTO_LANG.name);
      expect(m.zeilen["zeile-email"].wert?.text, `${sprache}: Adresse unvollständig im DOM`).toBe(
        KONTO_LANG.email,
      );
      for (const id of ZEILEN) {
        beschriftungVollstaendig(m, id);
      }
      // Der Name DARF hier umbrechen — er ist länger als die Zeile. Die feste Beschriftung nicht:
      // sie passt, und dann bricht die Zeile um, nicht das Wort.
      beschriftungEinzeilig(m, "zeile-email");
      beschriftungEinzeilig(m, "zeile-sprache");
      beschriftungEinzeilig(m, "zeile-passwort");
      expect(m.documentWidth, `${sprache}: horizontaler Überlauf`).toBe(320);
      // Der Wert bleibt erreichbar — er darf umbrechen, aber nicht abgeschnitten werden.
      const wert = m.zeilen["zeile-email"].wert as Mass;
      expect(
        wert.scrollWidth,
        `${sprache}: lange Adresse gekürzt — ${wert.scrollWidth} > ${wert.clientWidth}`,
      ).toBeLessThanOrEqual(wert.clientWidth);
    }
    // Die Beschriftungen unterscheiden sich wirklich zwischen DE und EN — sonst hätte der
    // Sprachwechsel gar nicht stattgefunden und der EN-Fall wäre eine Wiederholung.
    expect((mLangEn as Messung).zeilen["zeile-email"].beschriftung.text).not.toBe(
      (mLangDe as Messung).zeilen["zeile-email"].beschriftung.text,
    );
  });

  it("G3 · Gegenprobe im langen Fall: der alte Vertrag kürzt hier wieder Name und Beschriftung", () => {
    beschriftungGekuerzt(mLangGegenprobe as Messung, "zeile-name");
    beschriftungGekuerzt(mLangGegenprobe as Messung, "zeile-email");
  });
});
