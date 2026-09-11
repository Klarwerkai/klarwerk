// ================================================================================================
// JOB 3462 · REVIEW26-AUFGABEN-SCHMAL — DIE SCHMALE AUFGABENLISTE ZEIGT TITEL UND PHASE LESBAR.
// ================================================================================================
//
// DER BEFUND (Prüferlauf 08.09., `gespraech/advisor-freitag/NUTZERBEFUNDE-AN-CLAUDE-20260908.md:153-159`):
// „Kein horizontaler Überlauf, aber viele Titel und Phasen sind nach wenigen Worten mit … abgeschnitten.
// Der lange eigene Reviewtitel ist nicht eindeutig lesbar." Beleg
// `nutzerpruefung/belege/review26-seiteninventar-20260908-072101/146-aufgaben-schmal.json` — daraus
// stammen die Titel dieses Bestands WÖRTLICH (Konstanten unten), nichts ist erfunden.
//
// DIE URSACHE waren zwei `truncate` in `apps/web/src/pages/MyTasks.tsx`: eines am Titel (eine Zeile,
// Rest wird „…"), eines am Anfang der Meta-Zeile („Typ · Phase: …"), wo die Phase als Erstes fiel.
//
// WARUM CHROMIUM UND NICHT JSDOM: `truncate` ist reines CSS. Im DOM steht der volle Text vor UND nach
// dem Bau; jsdom kennt weder Zeilenumbruch noch Textrechtecke und hätte in beiden Zuständen grün
// gemeldet. Gemessen wird deshalb die GEBAUTE Anwendung (`apps/web/dist`) in Chromium gegen die echte
// Fastify-App über die gemeinsame Bühne `tests/design/h6-chromium.ts` — dasselbe Hausmuster wie
// `tests/einstellungen-schmal/ux12b-einstellungen-schmal-chromium.test.ts`.
//
// WAS GEMESSEN WIRD: der SICHTBARE Text. Für jedes Zeichen wird sein Rechteck mit dem Kasten des
// Elements verglichen (Muster `tests/start-karten-schmal/`); was außerhalb liegt, ist abgeschnitten —
// bei `truncate` seitlich, bei `line-clamp` unterhalb. Dazu die Zeilenzahl aus den Textrechtecken,
// `scrollWidth`/`clientWidth` und die berechneten Kürzungsregeln (`text-overflow`, `white-space`,
// `-webkit-line-clamp`) — nicht Klassennamen (Lehre JOB 3272 R2: ein Klassennamen-Test in jsdom
// prüft die Behauptung, nicht die Breite).
//
// DER BESTAND IST FEST (Lehre JOB 3425 R1: keine zufälligen IDs, kein zufälliger Bestand): drei
// Wissensobjekte über die echte Route `POST /api/kos`, alle offen → drei Validierungsaufgaben.
//   · LANGER_TITEL — der Reviewtitel des Befunds. Bei 390 px (der Breite des Befunds) zu lang für
//     eine Zeile, kurz genug für zwei: er MUSS dort vollständig sichtbar sein (Fall A). Bei 320 px
//     bleiben ihm 179 px, er bräuchte drei Zeilen — dort greift die Grenze aus Lieferung 1, und
//     Fall A verlangt zwei volle Zeilen Anfang statt einer gekappten, plus den vollen `title`.
//   · UEBERLANGER_TITEL — die Lückenfrage aus demselben Beleg (170 Zeichen). Sie braucht mehr als zwei
//     Zeilen und belegt die GRENZE aus Lieferung 1: zwei Zeilen sichtbar, Rest gekürzt, voller Text im
//     `title`-Attribut (Fall E).
//   · KURZER_TITEL — einzeilig überall; Vergleichsmaß für die unveränderte breite Ansicht (Fall F).
//
// FÄLLE: A Titel (vorher rot) · B Phase (vorher rot) · C kein Überlauf 390/320 (Wächter) · D Erklär-
// Knopf und Chevron antippbar, Erklärsatz UNTER der Zeile (Wächter) · E die Zwei-Zeilen-Grenze ·
// F breite Ansicht einzeilig wie heute · G genau eine Kürzungsregel je Zeile (Ablösung) ·
// R1 Laufzeit-Gegenprobe: der alte einzeilige Schnitt am ORIGINALDOM macht A rot, mit geprüftem Rückbau.
//
// EIN BROWSER, EINE INSTANZ JE DATEI; jeder Hook mit Auf-/Abbau bekommt einen eigenen Zeitrahmen
// (Lehre JOB 3130 R5: Vitest gibt Hooks sonst 10 s, unabhängig von `testTimeout`).
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import i18n from "../../apps/web/src/i18n";
import { type Seite, type Stand, beende, fn, starte } from "../design/h6-chromium";

// ---- Der Bestand: wörtlich aus dem Beleg des Befunds ---------------------------------------------
/** `146-aufgaben-schmal.json`, Zeile „Kritisch 1": der lange eigene Reviewtitel des Prüfers. */
const LANGER_TITEL = "NUTZERPRUEFUNG REVIEW26 065813 Langtext GEÄNDERT";
/** `146-aufgaben-schmal.json`, Gruppe „Heute": die längste Lückenfrage desselben Belegs. */
const UEBERLANGER_TITEL =
  "Welche bestätigte Homeoffice-Regelung gilt bei KLARWERK? Wie viele Tage pro Woche sind erlaubt? Bitte nenne die geprüfte Quelle; wenn keine vorliegt, sage das ausdrücklich.";
/** `146-aufgaben-schmal.json`, Gruppe „Heute": ein gewöhnlicher kurzer Titel. */
const KURZER_TITEL = "Firmenwagen: Pflichtfarbe Blau";
const TITEL = [LANGER_TITEL, UEBERLANGER_TITEL, KURZER_TITEL] as const;

/** Das Konto der Bühne (`h6-chromium.ts`, `starte`): der Admin der frischen Instanz. */
const KONTO = { email: "pedi@job3065.test", password: "geheim12345" } as const;

const t = i18n.getFixedT("de");
/** Der Meta-Anfang einer Validierungsaufgabe, wie `MyTasks.tsx` ihn setzt: „Typ · Phase: Name". */
const TYP = t("task.validation");
const PHASE = `${t("task.phaseLabel")} ${t("cycle.validate.label")}`;
const ERKLAERSATZ = t("task.explain.validation");

// ---- Die Seite roh: die Bühne reicht sie durch, der Typ nennt nur, was hier gebraucht wird -------
interface SeiteRoh extends Seite {
  setViewportSize(size: { width: number; height: number }): Promise<void>;
  mouse: { click(x: number, y: number): Promise<void> };
}

interface Kasten {
  x: number;
  y: number;
  breite: number;
  hoehe: number;
  rechts: number;
  unten: number;
}
interface Textmass {
  /** Der Text im DOM — der zugängliche Name. */
  voll: string;
  /** Der Text, den ein Mensch sieht: Zeichen für Zeichen am Kasten geprüft. */
  sichtbar: string;
  /** Zeilen, die der Text belegt (aus den Textrechtecken), auch wenn sie abgeschnitten sind. */
  zeilenGesamt: number;
  /** Zeilen, die INNERHALB des Kastens liegen — was man wirklich sieht. */
  zeilenSichtbar: number;
  clientWidth: number;
  scrollWidth: number;
  rect: Kasten;
  textOverflow: string;
  whiteSpace: string;
  lineClamp: string;
  /** Das `title`-Attribut — der volle Titel für die Maus, wo die Grenze greift. */
  titleAttribut: string | null;
}
interface Zeilenmass {
  titel: Textmass;
  /** Der kürzbare Anfang der Meta-Zeile („Typ · Phase: …") — das erste Kind von `task-meta`. */
  meta: Textmass;
  /** Die ganze Meta-Zeile als sichtbarer Text (`innerText`). */
  metaText: string;
  zeileRect: Kasten;
  knopfRect: Kasten;
  chevronRect: Kasten;
  /** Trifft `elementFromPoint` in der Mitte des Knopfs/Chevrons das Element selbst? */
  knopfTreffbar: boolean;
  chevronTreffbar: boolean;
  erklaerungHidden: boolean;
  erklaerungRect: Kasten;
}
interface Messung {
  fehler: string | null;
  viewport: number;
  dokumentScrollWidth: number;
  zeilen: Record<string, Zeilenmass>;
}

/**
 * In der Seite: die Zeilen des festen Bestands vermessen.
 *
 * `stoerung === "alt"` ist die Gegenprobe R1: sie setzt den ALTEN einzeiligen Schnitt per `style`
 * an denselben Titel-Elementen wieder ein (genau die Wirkung von `truncate` und ohne Zeilengrenze).
 * Ohne Flagge räumt dieselbe Funktion die Eigenschaften wieder ab — jede Messung stellt damit den
 * Auslieferungszustand her, und kein Fall erbt den Eingriff des vorigen.
 */
const MESSEN = `(async ([titel, stoerung]) => {
  const norm = (s) => (s || '').replace(/\\s+/g, ' ').trim();
  const kasten = (r) => ({ x: r.x, y: r.y, breite: r.width, hoehe: r.height, rechts: r.right, unten: r.bottom });
  const rahmen = () => new Promise((r) => requestAnimationFrame(() => r(null)));
  const leer = { viewport: window.innerWidth, dokumentScrollWidth: 0, zeilen: {} };

  // Erst setzen lassen, dann greifen: die Hülle wechselt bei 900 px die Bauform (AppShell,
  // NARROW_QUERY) und baut React dabei neu auf. Gewartet wird, bis DERSELBE Knoten den Umbau
  // überlebt (Muster ux12b).
  const ruhe = async (sel, ms = 8000) => {
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
  if (!(await ruhe('[data-testid="task-zeile"]'))) return Object.assign({ fehler: 'die Aufgabenliste kam nach dem Breitenwechsel nicht zur Ruhe (Pfad ' + location.pathname + ', ' + document.querySelectorAll('[data-testid="task-zeile"]').length + ' Zeilen)' }, leer);

  const zeileZu = (text) => [...document.querySelectorAll('[data-testid="task-zeile"]')]
    .find((z) => (z.textContent || '').includes(text)) || null;
  // Der Titel ist das ERSTE Element im Aufgaben-Link, die Meta-Zeile trägt ihre Kennung; ihr
  // kürzbarer Anfang ist ihr erstes Kind. Strukturell gegriffen, damit dieselbe Messung den alten
  // und den neuen Bau sieht.
  const titelVon = (z) => z.querySelector('a > span');
  const metaVon = (z) => z.querySelector('[data-testid="task-meta"] > span');

  // Die Störung (oder ihr Abräumen) an den Originalknoten, VOR der Messung.
  for (const text of titel) {
    const z = zeileZu(text);
    if (z === null) return Object.assign({ fehler: 'Zeile fehlt: ' + text }, leer);
    for (const el of [titelVon(z), metaVon(z)]) {
      if (el === null) return Object.assign({ fehler: 'Titel- oder Meta-Element fehlt: ' + text }, leer);
      el.style.whiteSpace = stoerung === 'alt' ? 'nowrap' : '';
      el.style.overflow = stoerung === 'alt' ? 'hidden' : '';
      el.style.textOverflow = stoerung === 'alt' ? 'ellipsis' : '';
      el.style.display = stoerung === 'alt' ? 'block' : '';
      el.style.webkitLineClamp = stoerung === 'alt' ? 'none' : '';
    }
  }
  await rahmen();

  const sichtbarerText = (el) => {
    const k = el.getBoundingClientRect();
    let text = '';
    const gehe = (knoten) => {
      for (const kind of knoten.childNodes) {
        if (kind.nodeType === 1) { gehe(kind); continue; }
        if (kind.nodeType !== 3) continue;
        const roh = kind.textContent || '';
        const bereich = document.createRange();
        for (let i = 0; i < roh.length; i++) {
          bereich.setStart(kind, i);
          bereich.setEnd(kind, i + 1);
          const r = bereich.getBoundingClientRect();
          if (r.width === 0 && r.height === 0) { text += roh[i]; continue; }
          const drin = r.left >= k.left - 0.5 && r.right <= k.right + 0.5
            && r.top >= k.top - 0.5 && r.bottom <= k.bottom + 0.5;
          if (drin) text += roh[i];
        }
      }
    };
    gehe(el);
    return text;
  };
  const zeilenVon = (el) => {
    const k = el.getBoundingClientRect();
    const bereich = document.createRange();
    bereich.selectNodeContents(el);
    const tops = new Set();
    const sichtbareTops = new Set();
    for (const r of bereich.getClientRects()) {
      if (r.width === 0 || r.height === 0) continue;
      const top = Math.round(r.top);
      tops.add(top);
      if (r.top >= k.top - 0.5 && r.bottom <= k.bottom + 0.5) sichtbareTops.add(top);
    }
    return { gesamt: tops.size, sichtbar: sichtbareTops.size };
  };
  const textmass = (el) => {
    const s = getComputedStyle(el);
    const z = zeilenVon(el);
    return {
      voll: norm(el.textContent),
      sichtbar: norm(sichtbarerText(el)),
      zeilenGesamt: z.gesamt,
      zeilenSichtbar: z.sichtbar,
      clientWidth: el.clientWidth,
      scrollWidth: el.scrollWidth,
      rect: kasten(el.getBoundingClientRect()),
      textOverflow: s.textOverflow,
      whiteSpace: s.whiteSpace,
      lineClamp: s.webkitLineClamp,
      titleAttribut: el.getAttribute('title'),
    };
  };
  const treffbar = (el) => {
    const r = el.getBoundingClientRect();
    const ziel = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
    return ziel !== null && (ziel === el || el.contains(ziel));
  };

  const zeilen = {};
  for (const text of titel) {
    const z = zeileZu(text);
    const knopf = z.querySelector('[data-testid="task-erklaerung-knopf"]');
    const chevron = z.querySelector('a[aria-label]');
    const erklaerung = z.querySelector('[data-testid="task-erklaerung"]');
    const meta = z.querySelector('[data-testid="task-meta"]');
    if (knopf === null || chevron === null || erklaerung === null || meta === null)
      return Object.assign({ fehler: 'Knopf, Chevron, Erklärsatz oder Meta-Zeile fehlt: ' + text }, leer);
    zeilen[text] = {
      titel: textmass(titelVon(z)),
      meta: textmass(metaVon(z)),
      metaText: norm(meta.innerText),
      zeileRect: kasten(z.getBoundingClientRect()),
      knopfRect: kasten(knopf.getBoundingClientRect()),
      chevronRect: kasten(chevron.getBoundingClientRect()),
      knopfTreffbar: treffbar(knopf),
      chevronTreffbar: treffbar(chevron),
      erklaerungHidden: erklaerung.hasAttribute('hidden'),
      erklaerungRect: kasten(erklaerung.getBoundingClientRect()),
    };
  }
  return {
    fehler: null,
    viewport: window.innerWidth,
    dokumentScrollWidth: document.documentElement.scrollWidth,
    zeilen,
  };
})`;

/**
 * In der Seite: die Mitte des Erklär-Knopfs der langen Zeile UND was dort unter der Maus liegt —
 * frisch zum Zeitpunkt des Klicks gelesen, nicht aus einer früheren Messung übernommen.
 */
const KNOPF_LAGE = `((text) => {
  const z = [...document.querySelectorAll('[data-testid="task-zeile"]')].find((z) => (z.textContent || '').includes(text));
  const el = z ? z.querySelector('[data-testid="task-erklaerung-knopf"]') : null;
  if (!el) return null;
  const r = el.getBoundingClientRect();
  const x = r.x + r.width / 2, y = r.y + r.height / 2;
  const unterMaus = document.elementFromPoint(x, y);
  return {
    x, y,
    trifftKnopf: unterMaus !== null && (unterMaus === el || el.contains(unterMaus)),
    unterMaus: unterMaus ? unterMaus.tagName.toLowerCase() + (unterMaus.getAttribute('data-testid') ? '[' + unterMaus.getAttribute('data-testid') + ']' : '') : 'nichts',
    pfad: location.pathname,
    offen: el.getAttribute('aria-expanded'),
  };
})`;
interface KnopfLage {
  x: number;
  y: number;
  trifftKnopf: boolean;
  unterMaus: string;
  pfad: string;
  offen: string | null;
}

/** Der Zustand des Erklärsatzes der langen Zeile, samt Ort — für die Wartebedingung UND den Beleg. */
const ERKLAERUNG_ZUSTAND = `((text) => {
  const z = [...document.querySelectorAll('[data-testid="task-zeile"]')].find((z) => (z.textContent || '').includes(text));
  const p = z ? z.querySelector('[data-testid="task-erklaerung"]') : null;
  return { da: p !== null, hidden: p ? p.hasAttribute('hidden') : null, pfad: location.pathname };
})`;

/**
 * Ein echter Mausklick auf den Erklär-Knopf der langen Zeile, mit Vor- und Nachbeleg: WAS unter der
 * Maus lag, WO die Seite danach steht und OB der Satz den erwarteten Zustand hat. Ein Klick, der
 * daneben trifft oder die Seite verlässt, wird so benannt statt in einer Zeitüberschreitung zu enden.
 */
async function klickeErklaerKnopf(seite: SeiteRoh, ziel: "offen" | "zu"): Promise<void> {
  const lage = await seite.evaluate<KnopfLage | null>(fn(KNOPF_LAGE), LANGER_TITEL);
  expect(lage, "Knopf der langen Zeile nicht gefunden").not.toBeNull();
  const k = lage as KnopfLage;
  expect(k.pfad, "die Seite steht vor dem Klick nicht auf /aufgaben").toBe("/aufgaben");
  expect(
    k.trifftKnopf,
    `unter der Maus liegt nicht der Knopf, sondern ${k.unterMaus} (${k.x}, ${k.y})`,
  ).toBe(true);
  expect(k.offen, "aria-expanded passt nicht zum Ausgangszustand").toBe(
    ziel === "offen" ? "false" : "true",
  );
  await seite.mouse.click(k.x, k.y);
  let zustand: { da: boolean; hidden: boolean | null; pfad: string } | null = null;
  for (let i = 0; i < 100; i++) {
    zustand = await seite.evaluate<{ da: boolean; hidden: boolean | null; pfad: string }>(
      fn(ERKLAERUNG_ZUSTAND),
      LANGER_TITEL,
    );
    if (zustand.da && zustand.hidden === (ziel === "zu")) return;
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error(
    `Erklärsatz nach dem Klick nicht „${ziel}": ${JSON.stringify(zustand)} — Klick bei (${k.x}, ${k.y}) auf ${k.unterMaus}`,
  );
}

let stand: Stand;

function seiteRoh(): SeiteRoh {
  const seite = stand.seite;
  if (seite === null || stand.fehler !== null) {
    throw new Error(`Bühne steht nicht: ${stand.fehler ?? "unbekannt"}`);
  }
  return seite as unknown as SeiteRoh;
}

async function messen(breite: number, stoerung: "alt" | null = null): Promise<Messung> {
  const seite = seiteRoh();
  await seite.setViewportSize({ width: breite, height: 740 });
  const m = await seite.evaluate<Messung>(fn(MESSEN), [TITEL, stoerung]);
  expect(m.fehler, `Messung bei ${breite} px`).toBeNull();
  expect(m.viewport, "falsche Messbreite").toBe(breite);
  expect(stand.seitenfehler, "die Seite hat selbst Fehler geworfen").toEqual([]);
  return m;
}

function zeile(m: Messung, text: string): Zeilenmass {
  const z = m.zeilen[text];
  if (z === undefined) throw new Error(`Zeile nicht gemessen: ${text}`);
  return z;
}

/** Ein Protokollblock, damit die Zahlen in der Rückgabe belegt und nicht behauptet sind. */
function protokoll(m: Messung): string {
  const t = (name: string, x: Textmass): string =>
    `    ${name}: ${x.zeilenSichtbar}/${x.zeilenGesamt} Zeile(n) sichtbar/gesamt · client ${x.clientWidth} px · ` +
    `scroll ${x.scrollWidth} px · text-overflow ${x.textOverflow} · white-space ${x.whiteSpace} · ` +
    `line-clamp ${x.lineClamp} · sichtbar „${x.sichtbar}"`;
  return [
    `  Viewport ${m.viewport} px · document.scrollWidth ${m.dokumentScrollWidth} px`,
    ...Object.entries(m.zeilen).flatMap(([text, z]) => [
      `  Zeile „${text.slice(0, 40)}…" — ${Math.round(z.zeileRect.breite)}×${Math.round(z.zeileRect.hoehe)} px`,
      t("Titel", z.titel),
      t("Meta ", z.meta),
    ]),
  ].join("\n");
}

/** Fall A — der lange Reviewtitel ist vollständig zu lesen, und zwar über MEHR als eine Zeile. */
function pruefeTitel(m: Messung): void {
  const lang = zeile(m, LANGER_TITEL);
  if (m.viewport >= 390) {
    // Bei 390 px (der Breite des Befunds) passt der Reviewtitel in zwei Zeilen: er MUSS ganz da sein.
    expect(
      lang.titel.sichtbar,
      `bei ${m.viewport} px ist der Titel abgeschnitten: sichtbar „${lang.titel.sichtbar}"`,
    ).toBe(LANGER_TITEL);
  } else {
    // Bei 320 px bleiben dem Titel 179 px (gemessen, Cloud-Lauf 63c3b6527ef63ff9792afd13): der
    // Reviewtitel braucht dort drei Zeilen, und die Zwei-Zeilen-Grenze aus Lieferung 1 greift. Das
    // ist kein seitlicher Schnitt: sichtbar sind zwei VOLLE Zeilen als Anfang des Titels (vorher
    // eine mit „NUTZERPRUEFUNG REVIEW"), der Rest liegt im `title`-Attribut.
    expect(
      LANGER_TITEL.startsWith(lang.titel.sichtbar),
      `bei ${m.viewport} px ist der sichtbare Titel kein Anfang des Titels: „${lang.titel.sichtbar}"`,
    ).toBe(true);
    expect(
      lang.titel.sichtbar.length,
      `bei ${m.viewport} px ist weniger als der einzeilige Schnitt von früher sichtbar: „${lang.titel.sichtbar}"`,
    ).toBeGreaterThan("NUTZERPRUEFUNG REVIEW".length);
    expect(lang.titel.titleAttribut, "der volle Titel fehlt als title-Attribut").toBe(LANGER_TITEL);
  }
  expect(
    lang.titel.zeilenSichtbar,
    `bei ${m.viewport} px steht der lange Titel auf ${lang.titel.zeilenSichtbar} Zeile(n) — er passt nicht in eine`,
  ).toBeGreaterThan(1);
  expect(
    lang.titel.zeilenSichtbar,
    `bei ${m.viewport} px zeigt der Titel ${lang.titel.zeilenSichtbar} Zeilen — die Grenze sind zwei`,
  ).toBeLessThanOrEqual(2);
  expect(
    lang.titel.scrollWidth,
    `bei ${m.viewport} px läuft der Titel seitlich über: scrollWidth ${lang.titel.scrollWidth} > clientWidth ${lang.titel.clientWidth}`,
  ).toBeLessThanOrEqual(lang.titel.clientWidth);
}

/** Fall B — Typ und Phase stehen sichtbar da, der kürzbare Teil ist nicht seitlich abgeschnitten. */
function pruefePhase(m: Messung): void {
  for (const text of TITEL) {
    const z = zeile(m, text);
    expect(
      z.meta.sichtbar,
      `bei ${m.viewport} px fehlt die Phase in der Meta-Zeile von „${text.slice(0, 30)}…": sichtbar „${z.meta.sichtbar}"`,
    ).toContain(PHASE);
    expect(z.meta.sichtbar).toContain(TYP);
    expect(
      z.meta.scrollWidth,
      `bei ${m.viewport} px ist der Meta-Anfang seitlich abgeschnitten: scrollWidth ${z.meta.scrollWidth} > clientWidth ${z.meta.clientWidth}`,
    ).toBeLessThanOrEqual(z.meta.clientWidth);
    expect(z.metaText, "die ganze Meta-Zeile nennt die Phase nicht").toContain(PHASE);
  }
}

/** Fall C — kein Inhalt ragt aus dem Fenster, keine Querscrollleiste. */
function pruefeKeinUeberlauf(m: Messung): void {
  expect(
    m.dokumentScrollWidth,
    `die Seite läuft bei ${m.viewport} px waagerecht über (${m.dokumentScrollWidth} px)`,
  ).toBeLessThanOrEqual(m.viewport);
  for (const [text, z] of Object.entries(m.zeilen)) {
    for (const [name, r] of [
      ["Zeile", z.zeileRect],
      ["Titel", z.titel.rect],
      ["Meta", z.meta.rect],
      ["Knopf", z.knopfRect],
      ["Chevron", z.chevronRect],
    ] as const) {
      expect(
        r.x,
        `${name} von „${text.slice(0, 30)}…" beginnt links außerhalb`,
      ).toBeGreaterThanOrEqual(0);
      expect(
        r.rechts,
        `${name} von „${text.slice(0, 30)}…" ragt rechts aus dem Fenster (${Math.round(r.rechts)} > ${m.viewport})`,
      ).toBeLessThanOrEqual(m.viewport + 0.5);
    }
  }
}

describe("JOB 3462 · schmale Aufgabenliste: Titel und Phase lesbar, in Chromium gemessen", () => {
  beforeAll(async () => {
    stand = await starte("/aufgaben", '[data-testid="task-zeile"]', 390, 740, async (app) => {
      const login = await app.inject({ method: "POST", url: "/api/auth/login", payload: KONTO });
      const token = (login.json() as { token: string }).token;
      const headers = { authorization: `Bearer ${token}` };
      // Der Rechtshinweis wird wie von einer wiederkehrenden Nutzerin quittiert — er ist Hülle.
      await app.inject({ method: "POST", url: "/api/auth/notice", headers });
      for (const title of TITEL) {
        const res = await app.inject({
          method: "POST",
          url: "/api/kos",
          headers,
          payload: {
            title,
            statement: "Aus dem Prüferlauf vom 08.09. übernommen, noch nicht freigegeben.",
            type: "best_practice",
            category: "Allgemein",
            // JOB 3429 (Q3 c): `POST /api/kos` legt ohne ausdrückliche Stufe nicht mehr an
            // (400 MISSING_CONFIDENTIALITY, `services/app/src/routes/ko-routes.ts`). „intern" ist die
            // Stufe der Oberfläche für gewöhnliches Firmenwissen — und die Aufgabenliste zeigt jede
            // Stufe gleich, hier wird nur die Zeile vermessen. (Runde 1 lief noch auf einem Stand vor
            // dieser Pflicht; das Tor rebaste auf sie, die Bühne kam ohne Stufe nicht hoch.)
            confidentiality: "intern",
          },
        });
        if (res.statusCode !== 201) {
          throw new Error(
            `POST /api/kos „${title.slice(0, 30)}…": HTTP ${res.statusCode} ${res.body}`,
          );
        }
      }
    });
    if (stand.fehler === null && stand.seite) {
      await stand.seite.waitForFunction(
        fn(`(n) => [...document.querySelectorAll('[data-testid="task-zeile"]')].length >= n`),
        TITEL.length,
        { timeout: 30_000 },
      );
    }
  }, 240_000);

  afterAll(async () => {
    if (stand) await beende(stand);
  }, 60_000);

  it("S0 · die Bühne steht: gebaute App, echtes Backend, drei Aufgaben des Befunds", async () => {
    expect(stand.fehler, "Chromium-Bühne kam nicht hoch").toBeNull();
    console.log(`JOB 3462 · Chromium ${stand.version}`);
    const m = await messen(390);
    console.log(`JOB 3462 · S0:\n${protokoll(m)}`);
    expect(Object.keys(m.zeilen).sort()).toEqual([...TITEL].sort());
    for (const text of TITEL) {
      expect(zeile(m, text).titel.voll, "der volle Titel steht nicht im DOM").toBe(text);
    }
  }, 120_000);

  for (const breite of [390, 320] as const) {
    it(`A · ${breite} px: der lange Reviewtitel läuft über zwei Zeilen ohne seitlichen Schnitt${breite >= 390 ? " und ist ganz zu lesen" : " (bei 320 px greift die Zwei-Zeilen-Grenze)"}`, async () => {
      const m = await messen(breite);
      console.log(`JOB 3462 · A ${breite}:\n${protokoll(m)}`);
      pruefeTitel(m);
    }, 120_000);

    it(`B · ${breite} px: Typ und Phase stehen sichtbar in der Meta-Zeile, der kürzbare Teil ist nicht abgeschnitten`, async () => {
      const m = await messen(breite);
      console.log(`JOB 3462 · B ${breite}:\n${protokoll(m)}`);
      pruefePhase(m);
    }, 120_000);

    it(`C · ${breite} px: kein horizontaler Überlauf, nichts ragt aus dem Fenster`, async () => {
      const m = await messen(breite);
      pruefeKeinUeberlauf(m);
    }, 120_000);
  }

  it("D · 390 px: Erklär-Knopf und Chevron sind sichtbar und antippbar; der Erklärsatz öffnet sich UNTER der Zeile", async () => {
    const seite = seiteRoh();
    const vorher = await messen(390);
    const lang = zeile(vorher, LANGER_TITEL);
    for (const [name, r, treffbar] of [
      ["Erklär-Knopf", lang.knopfRect, lang.knopfTreffbar],
      ["Chevron", lang.chevronRect, lang.chevronTreffbar],
    ] as const) {
      expect(r.breite, `${name} hat keine Breite`).toBeGreaterThan(0);
      expect(r.hoehe, `${name} hat keine Höhe`).toBeGreaterThan(0);
      expect(r.rechts, `${name} liegt außerhalb des Fensters`).toBeLessThanOrEqual(390.5);
      expect(r.unten, `${name} liegt unterhalb des Fensters`).toBeLessThanOrEqual(740.5);
      expect(treffbar, `${name} ist verdeckt — elementFromPoint trifft ihn nicht`).toBe(true);
    }
    expect(lang.erklaerungHidden, "der Erklärsatz ist schon vor dem Klick offen").toBe(true);
    // Der echte Mausklick des Browsers auf die Mitte des Knopfs — kein synthetisches `click()`.
    await klickeErklaerKnopf(seite, "offen");
    const nachher = await messen(390);
    const offen = zeile(nachher, LANGER_TITEL);
    const lage = JSON.stringify({
      zeile: offen.zeileRect,
      titel: offen.titel.rect,
      meta: offen.meta.rect,
      knopf: offen.knopfRect,
      chevron: offen.chevronRect,
      erklaerung: offen.erklaerungRect,
    });
    console.log(`JOB 3462 · D offen: ${lage}`);
    expect(offen.erklaerungHidden).toBe(false);
    expect(offen.erklaerungRect.hoehe, "der geöffnete Erklärsatz hat keine Höhe").toBeGreaterThan(
      0,
    );
    // UNTER der Zeile, nicht in ihr: der Satz beginnt unterhalb von Titel, Meta-Zeile und Knopf und
    // bleibt innerhalb der Zeile und des Fensters. (Der Chevron steht im DOM HINTER dem Satz und
    // rückt beim Aufklappen unter ihn — so war die Zeile schon vor JOB 3462 gebaut; hier zählt, dass
    // er sichtbar und treffbar bleibt und den Satz nicht überdeckt.)
    expect(
      offen.erklaerungRect.y,
      `Erklärsatz nicht unter dem Titel: ${lage}`,
    ).toBeGreaterThanOrEqual(offen.titel.rect.unten - 0.5);
    expect(
      offen.erklaerungRect.y,
      `Erklärsatz nicht unter der Meta-Zeile: ${lage}`,
    ).toBeGreaterThanOrEqual(offen.meta.rect.unten - 0.5);
    expect(
      offen.erklaerungRect.y,
      `Erklärsatz nicht unter dem Knopf: ${lage}`,
    ).toBeGreaterThanOrEqual(offen.knopfRect.unten - 0.5);
    expect(
      offen.erklaerungRect.unten,
      `Erklärsatz ragt aus der Zeile: ${lage}`,
    ).toBeLessThanOrEqual(offen.zeileRect.unten + 0.5);
    expect(offen.erklaerungRect.rechts).toBeLessThanOrEqual(390.5);
    expect(offen.knopfTreffbar, `Knopf nach dem Aufklappen verdeckt: ${lage}`).toBe(true);
    expect(offen.chevronTreffbar, `Chevron nach dem Aufklappen verdeckt: ${lage}`).toBe(true);
    const ueberdeckt =
      offen.chevronRect.x < offen.erklaerungRect.rechts &&
      offen.erklaerungRect.x < offen.chevronRect.rechts &&
      offen.chevronRect.y < offen.erklaerungRect.unten &&
      offen.erklaerungRect.y < offen.chevronRect.unten;
    expect(ueberdeckt, `Chevron und Erklärsatz überlappen sich: ${lage}`).toBe(false);
    const sichtbar = await seite.evaluate<string>(
      fn(`() => (document.querySelector('main') || document.body).innerText`),
    );
    expect(sichtbar, "der Erklärsatz steht nicht sichtbar auf der Fläche").toContain(ERKLAERSATZ);
    // Zurück in den Ausgangszustand, damit kein späterer Fall die offene Zeile erbt.
    await klickeErklaerKnopf(seite, "zu");
  }, 120_000);

  it("E · 390 px: die Grenze — ein überlanger Titel zeigt genau zwei Zeilen, der volle Text liegt im title-Attribut", async () => {
    const m = await messen(390);
    const ueber = zeile(m, UEBERLANGER_TITEL);
    console.log(`JOB 3462 · E:\n${protokoll(m)}`);
    expect(
      ueber.titel.zeilenGesamt,
      "der überlange Titel braucht bei 390 px nicht mehr als zwei Zeilen — dann belegt er die Grenze nicht",
    ).toBeGreaterThan(2);
    expect(ueber.titel.zeilenSichtbar, "sichtbar sind nicht genau zwei Zeilen").toBe(2);
    expect(ueber.titel.sichtbar, "über zwei Zeilen hinaus wird nicht gekürzt").not.toBe(
      UEBERLANGER_TITEL,
    );
    expect(ueber.titel.sichtbar.length, "die zwei sichtbaren Zeilen sind leer").toBeGreaterThan(20);
    expect(UEBERLANGER_TITEL.startsWith(ueber.titel.sichtbar.slice(0, 20))).toBe(true);
    expect(ueber.titel.titleAttribut, "der volle Titel fehlt als title-Attribut").toBe(
      UEBERLANGER_TITEL,
    );
    expect(ueber.titel.scrollWidth).toBeLessThanOrEqual(ueber.titel.clientWidth);
    // Die Grenze gilt auch für den kurzen und den langen Titel — sie ist dieselbe Regel.
    expect(zeile(m, LANGER_TITEL).titel.titleAttribut).toBe(LANGER_TITEL);
    expect(zeile(m, KURZER_TITEL).titel.titleAttribut).toBe(KURZER_TITEL);
  }, 120_000);

  it("F · 1280 px: die breite Ansicht bleibt einzeilig — lange wie kurze Zeile gleich hoch", async () => {
    const m = await messen(1280);
    console.log(`JOB 3462 · F:\n${protokoll(m)}`);
    const lang = zeile(m, LANGER_TITEL);
    const kurz = zeile(m, KURZER_TITEL);
    for (const [name, z] of [
      ["lang", lang],
      ["kurz", kurz],
    ] as const) {
      expect(z.titel.zeilenSichtbar, `Titel (${name}) ist bei 1280 px nicht einzeilig`).toBe(1);
      expect(z.titel.sichtbar).toBe(z.titel.voll);
      expect(z.meta.zeilenSichtbar, `Meta (${name}) ist bei 1280 px nicht einzeilig`).toBe(1);
      expect(z.meta.sichtbar).toContain(PHASE);
    }
    expect(
      Math.abs(lang.zeileRect.hoehe - kurz.zeileRect.hoehe),
      `bei 1280 px sind lange (${lang.zeileRect.hoehe} px) und kurze Zeile (${kurz.zeileRect.hoehe} px) verschieden hoch`,
    ).toBeLessThanOrEqual(1);
    pruefeKeinUeberlauf(m);
  }, 120_000);

  it("G · Ablösung: am Titel genau EINE Kürzungsregel (zwei Zeilen), am Meta-Anfang keine — nirgends mehr der einzeilige Schnitt", async () => {
    const m = await messen(390);
    for (const text of TITEL) {
      const z = zeile(m, text);
      expect(z.titel.textOverflow, "Titel: text-overflow kürzt noch").not.toBe("ellipsis");
      expect(z.titel.whiteSpace, "Titel: white-space verhindert den Umbruch").not.toBe("nowrap");
      expect(z.titel.lineClamp, "Titel: die Zwei-Zeilen-Grenze fehlt").toBe("2");
      expect(z.meta.textOverflow, "Meta: text-overflow kürzt noch").not.toBe("ellipsis");
      expect(z.meta.whiteSpace, "Meta: white-space verhindert den Umbruch").not.toBe("nowrap");
      expect(z.meta.lineClamp, "Meta: eine zweite Kürzungsregel").toBe("none");
    }
  }, 120_000);

  it("R1 · 390 px: der alte einzeilige Schnitt am Originaldom macht A rot — und ist nach dem Rückbau weg", async () => {
    const vorher = await messen(390);
    pruefeTitel(vorher);
    pruefePhase(vorher);
    try {
      const kaputt = await messen(390, "alt");
      console.log(`JOB 3462 · R1 Störung:\n${protokoll(kaputt)}`);
      let fehler: unknown;
      try {
        pruefeTitel(kaputt);
      } catch (e) {
        fehler = e;
      }
      expect(fehler, "R1: die Störung wurde nicht erkannt").toBeInstanceOf(Error);
      expect(String(fehler), "R1: falscher Rotgrund").toMatch(/ist der Titel abgeschnitten/);
      console.log(`JOB 3462 · R1 ROT: ${String(fehler).split("\n")[0]}`);
    } finally {
      const danach = await messen(390);
      pruefeTitel(danach);
      pruefePhase(danach);
      expect(
        danach.zeilen[LANGER_TITEL]?.titel.zeilenSichtbar,
        "R1: Zustand nach Rückbau verändert",
      ).toBe(vorher.zeilen[LANGER_TITEL]?.titel.zeilenSichtbar);
    }
  }, 120_000);
});
