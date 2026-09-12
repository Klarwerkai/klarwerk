// ================================================================================================
// JOB 3126 · UX-23 — „FOTO ANHÄNGEN" MIT DER TASTATUR: ERREICHBAR, AUSLÖSBAR, SICHTBAR.
// ================================================================================================
//
// DER BEFUND, DER DIESE DATEI AUSGELÖST HAT (Live 1.124, 06.09.2026 06:07–06:12 CEST, Beleg
// `gespraech/nutzerpruefung/belege/anhaenge-20260906-060659/16-upload-tastatur.json`):
//
//   :16-19  der sichtbare Auslöser ist ein `LABEL` mit `tabIndex: -1` und `role: null`
//   :21-25  das umschlossene Dateifeld hat zwar `tabIndex: 0`, liegt aber auf `display: none`
//   :4      die gemessene Tab-Folge springt von „Anhang entfernen" DIREKT zu „Nachbarschaft"
//   :3      mit der Maus öffnet derselbe Auslöser den Dateidialog
//
// Es gab damit genau einen Bedienweg zu dieser Aktion, und der ging nur mit der Maus.
//
// GEMESSEN WIRD AN DER ECHTEN, GEBAUTEN ANWENDUNG (`apps/web/dist`) in Chromium, gegen die echte
// Fastify-App mit echtem Bestand — dieselbe Vorrichtung wie JOB 3063 H4 (`tests/design/h4-harness.ts`).
// Das ist hier keine Formsache: ein nachgebautes Element mit derselben Klassenkette könnte die
// Tab-Folge der Seite gar nicht messen, und genau die Tab-Folge ist der Gegenstand („Die
// Chromium-Prüfung muss die ECHTE Seite mounten und deren reale Elemente messen", ben an D4,
// zitiert im Kopf der Vorrichtung).
//
// WIE DAS AUSLÖSEN OHNE BETRIEBSSYSTEMDIALOG NACHGEWIESEN WIRD: in der Seite wird
// `HTMLInputElement.prototype.click` für Dateifelder durch einen ZÄHLER ersetzt. Steigt er, hat der
// Knopf die Dateiauswahl wirklich angestoßen — und kein echter Dialog blockiert den Lauf. Der
// Zähler hängt am ECHTEN Dateifeld der ECHTEN Seite, nicht an einem Ereignis, das der Test selbst
// erzeugt.
//
// DER ZÄHLER ALLEIN WÄRE ABER ZU WENIG: er sagt nichts darüber, ob nach dem Umbau vom `<label>` zum
// `<button>` das Hochladen selbst noch funktioniert (`onChange`). Fall 6 legt deshalb eine echte
// Bilddatei ins Feld und wartet darauf, dass eine zweite Kachel entsteht — durch Vorschau, Upload,
// `attach`-Aktion und Rücklauf hindurch.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import i18n from "../../apps/web/src/i18n";
import { type H4Stand, ORIGIN, fn, h4Stand } from "../design/h4-harness";

// ------------------------------------------------------------------------------------------------
// In der Seite gemessen — je ein Zug, damit zwischen zwei Auslesungen kein Rücklauf dazwischenfährt.
// ------------------------------------------------------------------------------------------------

const BEREICH = '[data-bib-abschnitt="anhaenge"]';

/**
 * Der zugängliche Name eines Elements — so, wie ihn ein Vorleser bildet, und nur so weit, wie diese
 * Messung ihn braucht: `aria-label`, sonst der sichtbare Text OHNE die als `aria-hidden` markierte
 * Zierde (Paperclip, Pfeil). Für ein `<input>` gilt zusätzlich das umschließende bzw. verknüpfte
 * `<label>` — genau dadurch trug das versteckte Dateifeld VOR diesem Auftrag denselben Namen wie der
 * sichtbare Auslöser, und genau das macht Fall 4 sichtbar.
 */
const NAME_FN = `
  const ohneZierde = (el) => [...el.childNodes]
    .map((n) => (n.nodeType === 1 && n.getAttribute && n.getAttribute('aria-hidden') === 'true' ? '' : n.textContent))
    .join('').replace(/\\s+/g, ' ').trim();
  const name = (el) => {
    if (!el || el.nodeType !== 1) return '';
    if (el.closest('[aria-hidden="true"]')) return '';
    const beschriftung = el.getAttribute('aria-label');
    if (beschriftung) return beschriftung.trim();
    if (el.tagName === 'INPUT') {
      const l = el.closest('label') || (el.id ? document.querySelector('label[for="' + el.id + '"]') : null);
      return l ? ohneZierde(l) : '';
    }
    return ohneZierde(el);
  };
`;

/** Alles über den Auslöser und das Dateifeld in EINEM Zug. */
const INVENTAR = `(marke) => {
  ${NAME_FN}
  const bereich = document.querySelector('${BEREICH}');
  if (!bereich) return null;
  const kandidaten = [...bereich.querySelectorAll('button, a[href], input, select, textarea, summary, label, [role], [tabindex]')];
  const feld = bereich.querySelector('input[type="file"]');
  const treffer = kandidaten.filter((el) => name(el) === marke);
  const stil = treffer[0] ? getComputedStyle(treffer[0]) : null;
  return {
    ausloeser: treffer.map((el) => ({ tag: el.tagName, typ: el.getAttribute('type'), rolle: el.getAttribute('role'), tabIndex: el.tabIndex })),
    ruhe: stil ? { outline: stil.outlineStyle + ' ' + stil.outlineWidth + ' ' + stil.outlineColor, boxShadow: stil.boxShadow, borderColor: stil.borderColor } : null,
    klasse: treffer[0] ? treffer[0].getAttribute('class') : null,
    ariaDisabled: treffer[0] ? treffer[0].getAttribute('aria-disabled') : null,
    feldDa: !!feld,
    feldTabIndex: feld ? feld.tabIndex : null,
    feldAriaHidden: feld ? feld.getAttribute('aria-hidden') : null,
    feldAccept: feld ? feld.getAttribute('accept') : null,
    feldDisabled: feld ? feld.disabled : null,
    feldDisplay: feld ? getComputedStyle(feld).display : null,
    kacheln: bereich.querySelectorAll('img').length,
    grenzenHinweis: bereich.querySelectorAll('[data-testid="upload-limits-hint"]').length,
    leersatz: (bereich.innerText || '').replace(/\\s+/g, ' ').trim(),
  };
}`;

/** Wer trägt gerade den Fokus — und wie sieht er aus? */
const AKTIV = `() => {
  ${NAME_FN}
  const el = document.activeElement;
  if (!el || el === document.body) return { tag: '(niemand)', name: '', outline: '', boxShadow: '', borderColor: '' };
  const s = getComputedStyle(el);
  return {
    tag: el.tagName,
    name: name(el),
    outline: s.outlineStyle + ' ' + s.outlineWidth + ' ' + s.outlineColor,
    boxShadow: s.boxShadow,
    borderColor: s.borderColor,
  };
}`;

/** Den Ausgangspunkt der Tab-Kette setzen: den Knopf „Anhang entfernen" der ersten Kachel. */
const START_FOKUS = `(marke) => {
  const bereich = document.querySelector('${BEREICH}');
  const b = bereich ? [...bereich.querySelectorAll('button')].find((e) => e.getAttribute('aria-label') === marke) : null;
  if (!b) return false;
  b.focus();
  return document.activeElement === b;
}`;

/** Der Zähler: für Dateifelder ZÄHLT `click()` nur noch, statt einen Dialog zu öffnen. */
const INSTRUMENT = `() => {
  if (window.__kwDateiKlicks !== undefined) { window.__kwDateiKlicks = 0; return true; }
  window.__kwDateiKlicks = 0;
  const urspruenglich = HTMLInputElement.prototype.click;
  HTMLInputElement.prototype.click = function () {
    if (this.type === 'file') {
      window.__kwDateiKlicks = (window.__kwDateiKlicks || 0) + 1;
      return;
    }
    return urspruenglich.apply(this, arguments);
  };
  return true;
}`;

const ZAEHLER = "() => window.__kwDateiKlicks";

/** Den Anhangbereich in die Mitte des Fensters holen — für den echten Mausklick. */
const IN_SICHT = `() => {
  const bereich = document.querySelector('${BEREICH}');
  if (bereich) bereich.scrollIntoView({ block: 'center' });
  return !!bereich;
}`;

const RECHTECK = `(marke) => {
  ${NAME_FN}
  const bereich = document.querySelector('${BEREICH}');
  const el = bereich ? [...bereich.querySelectorAll('button, label')].find((e) => name(e) === marke) : null;
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2, breite: r.width, hoehe: r.height };
}`;

interface Inventar {
  ausloeser: { tag: string; typ: string | null; rolle: string | null; tabIndex: number }[];
  ruhe: { outline: string; boxShadow: string; borderColor: string } | null;
  klasse: string | null;
  ariaDisabled: string | null;
  feldDa: boolean;
  feldTabIndex: number | null;
  feldAriaHidden: string | null;
  feldAccept: string | null;
  feldDisabled: boolean | null;
  feldDisplay: string | null;
  kacheln: number;
  grenzenHinweis: number;
  leersatz: string;
}

interface Fokus {
  tag: string;
  name: string;
  outline: string;
  boxShadow: string;
  borderColor: string;
}

// ------------------------------------------------------------------------------------------------
// Der Bestand: ein eigener, freigegebener Eintrag MIT einem Anhang.
// ------------------------------------------------------------------------------------------------
//
// Der Anhang ist nicht Zierde, sondern der Ausgangspunkt der Messung: der Beleg misst die Lücke
// genau zwischen „Anhang entfernen" und „Nachbarschaft" (`16-upload-tastatur.json:4`). Ohne Kachel
// gäbe es den Knopf „Anhang entfernen" nicht, und die Kette begänne woanders als in der Wirklichkeit.
// Ein 1×1-PNG genügt: gemessen wird die Bedienung, nicht das Bild.
const PNG_1X1 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
const ANHANG_NAME = "pruefbild.png";

let stand: H4Stand | null = null;
let fehler: string | null = null;

/** Was gemessen wurde — je Fall genau ein Ergebnis, alles in `beforeAll` in einer Ordnung erhoben. */
let vorher: Inventar | null = null;
let tabKette: Fokus[] = [];
let zurueck: Fokus | null = null;
let fokusAmAusloeser: Fokus | null = null;
let enterKlicks: { vor: number; nach: number } | null = null;
let spaceKlicks: { vor: number; nach: number } | null = null;
let mausKlicks: { vor: number; nach: number } | null = null;
let kachelnNachUpload: number | null = null;

interface EnglischeMessung {
  inventar: Inventar | null;
  fokus: Fokus | null;
  enter: { vor: number; nach: number };
}
let englisch: EnglischeMessung | null = null;

/** Die englische Beschriftung — aus DERSELBEN Textquelle, nicht abgeschrieben. */
const enText = (schluessel: string): string => i18n.t(schluessel, { lng: "en" });

const seite = (): H4Stand["seite"] => (stand as H4Stand).seite;

/** „Mehr" aufklappen und darin NUR den Abschnitt „Anhänge" — jeder weitere Abschnitt brächte
 *  fremde Bedienelemente in die Tab-Kette und machte die Messung unscharf. */
async function anhangbereichOeffnen(): Promise<void> {
  const s = seite();
  await s.evaluate(
    fn(
      `() => { const b = document.querySelector('[data-testid="bib-mehr"]'); if (b && b.getAttribute('aria-expanded') !== 'true') b.click(); }`,
    ),
  );
  await s.waitForFunction(fn(`() => !!document.querySelector('${BEREICH}')`), undefined, {
    timeout: 30_000,
  });
  await s.evaluate(
    fn(
      `() => { const d = document.querySelector('${BEREICH}'); if (d && !d.open) d.open = true; }`,
    ),
  );
  // Der Inhalt entsteht ERST beim Aufklappen (`MehrAbschnitte`, `Abschnitt`) — auf ihn warten,
  // nicht auf eine geratene Zeitspanne. Das Dateifeld gibt es in beiden Bauformen (Label wie Knopf),
  // damit misst diese Wartebedingung nicht schon das Ergebnis mit.
  await s.waitForFunction(
    fn(`() => !!document.querySelector('${BEREICH} input[type="file"]')`),
    undefined,
    { timeout: 30_000 },
  );
}

const inventar = async (marke: string): Promise<Inventar | null> =>
  await seite().evaluate<Inventar | null>(fn(INVENTAR), marke);

const aktiv = async (): Promise<Fokus> => (await seite().evaluate<Fokus>(fn(AKTIV))) as Fokus;

const zaehler = async (): Promise<number> =>
  ((await seite().evaluate<number>(fn(ZAEHLER))) as number) ?? -1;

/** Vom Knopf „Anhang entfernen" aus tabben, bis der Auslöser dran ist (höchstens acht Schritte). */
async function tabbenBis(marke: string, entfernenMarke: string): Promise<Fokus[]> {
  const gesetzt = await seite().evaluate<boolean>(fn(START_FOKUS), entfernenMarke);
  if (!gesetzt) {
    throw new Error(`Startpunkt „${entfernenMarke}“ nicht fokussierbar — der Anhang fehlt`);
  }
  const kette: Fokus[] = [];
  for (let i = 0; i < 8; i++) {
    await seite().keyboard.press("Tab");
    const f = await aktiv();
    kette.push(f);
    if (f.name === marke) {
      break;
    }
  }
  return kette;
}

describe("JOB 3126 · UX-23 — der Auslöser „Foto anhängen“ ist ein Bedienelement, kein Schild", () => {
  beforeAll(async () => {
    try {
      await i18n.changeLanguage("de");
      stand = await h4Stand("/wissen/:frei", "pedi@job3126.test", async (z) => {
        // Der Anhang entsteht über den ECHTEN Dienst — denselben, den die `attach`-Route benutzt
        // (`ko-routes.ts:1846`, `ko.addAttachment`). Kein Nachbau, kein Sonderpfad.
        await z.services.ko.addAttachment(z.freiId, z.autorId, {
          name: ANHANG_NAME,
          mime: "image/png",
          dataUrl: `data:image/png;base64,${PNG_1X1}`,
        });
      });
      await anhangbereichOeffnen();
      await seite().evaluate(fn(INSTRUMENT));

      const marke = i18n.t("ko.attachmentAdd");
      const entfernen = i18n.t("ko.attachmentRemove");

      // 1 · Ruhezustand ZUERST — der Vergleichswert für den Fokus muss vom unberührten Element
      //     stammen, nicht von einem, das schon einmal Fokus hatte.
      vorher = await inventar(marke);

      // 2 · Die Tab-Kette ab „Anhang entfernen" (die Stelle, an der der Beleg die Lücke maß).
      tabKette = await tabbenBis(marke, entfernen);
      fokusAmAusloeser = await aktiv();
      if (fokusAmAusloeser.name === marke) {
        // Shift+Tab führt zurück — der Abnahmeweg aus UIUX-AUFTRAEGE-13 §UX-23 nennt beide
        // Richtungen.
        await seite().keyboard.press("Shift+Tab");
        zurueck = await aktiv();
        await seite().keyboard.press("Tab");

        // 3 · Enter und Leertaste, je gegen den Zähler am echten Dateifeld.
        const vorEnter = await zaehler();
        await seite().keyboard.press("Enter");
        enterKlicks = { vor: vorEnter, nach: await zaehler() };
        const vorSpace = await zaehler();
        await seite().keyboard.press("Space");
        spaceKlicks = { vor: vorSpace, nach: await zaehler() };
      }

      // 4 · Der Mausweg — ein echter Klick an den echten Bildschirmkoordinaten des Knopfes.
      await seite().evaluate(fn(IN_SICHT));
      await seite().waitForTimeout(400);
      const r = await seite().evaluate<{ x: number; y: number } | null>(fn(RECHTECK), marke);
      const vorMaus = await zaehler();
      if (r) {
        await seite().mouse.click(r.x, r.y);
      }
      mausKlicks = { vor: vorMaus, nach: await zaehler() };

      // 5 · Die ganze Kette: eine echte Datei ins Feld, dann muss eine zweite Kachel entstehen.
      //     Das misst `onChange` → Vorschau → Upload → `attach` → Rücklauf, also genau das, was
      //     beim Umbau vom `<label>` zum `<button>` hätte verloren gehen können.
      await seite().setInputFiles(`${BEREICH} input[type="file"]`, [
        { name: ANHANG_NAME, mimeType: "image/png", buffer: Buffer.from(PNG_1X1, "base64") },
      ]);
      await seite().waitForFunction(
        fn(`() => document.querySelectorAll('${BEREICH} img').length >= 2`),
        undefined,
        { timeout: 30_000 },
      );
      kachelnNachUpload = ((await inventar(marke)) as Inventar).kacheln;

      // 6 · Dieselbe Bedienung auf ENGLISCH — der Abnahmeweg verlangt DE UND EN. Die Sprache ist
      //     eine gespeicherte Wahl (`lib/sprachwahl.ts`, `kw.sprache`), also wird sie wie im
      //     Betrieb gesetzt und die Seite neu geladen.
      await seite().evaluate(fn(`() => localStorage.setItem('kw.sprache', 'en')`));
      await seite().goto(`${ORIGIN}/wissen/${(stand as H4Stand).koId}`, {
        waitUntil: "load",
        timeout: 60_000,
      });
      await seite().waitForFunction(
        fn(`() => !!document.querySelector('[data-testid="bib-titel"]')`),
        undefined,
        { timeout: 30_000 },
      );
      await anhangbereichOeffnen();
      await seite().evaluate(fn(INSTRUMENT));
      const markeEn = enText("ko.attachmentAdd");
      const enInventar = await inventar(markeEn);
      await tabbenBis(markeEn, enText("ko.attachmentRemove"));
      const enFokus = await aktiv();
      const enVor = await zaehler();
      if (enFokus.name === markeEn) {
        await seite().keyboard.press("Enter");
      }
      englisch = {
        inventar: enInventar,
        fokus: enFokus,
        enter: { vor: enVor, nach: await zaehler() },
      };

      console.info(
        `JOB 3126 UX-23 · vorher ${JSON.stringify(vorher)} · Kette ${JSON.stringify(tabKette)} · Fokus ${JSON.stringify(fokusAmAusloeser)} · zurück ${JSON.stringify(zurueck)} · Enter ${JSON.stringify(enterKlicks)} · Space ${JSON.stringify(spaceKlicks)} · Maus ${JSON.stringify(mausKlicks)} · Kacheln ${kachelnNachUpload} · EN ${JSON.stringify(englisch)}`,
      );
    } catch (e) {
      fehler = String(e).split("\n").slice(0, 5).join(" | ");
    }
  }, 420_000);

  afterAll(async () => {
    await stand?.browser.close();
    await stand?.app.close();
  }, 60_000);

  it("UX23-0 · die Vorrichtung steht: gebautes dist, echte App, Chromium, keine Seitenfehler", () => {
    expect(fehler).toBeNull();
    expect((stand as H4Stand).version.length).toBeGreaterThan(0);
    expect((stand as H4Stand).seitenfehler, "Chromium meldete Seitenfehler").toEqual([]);
    // Kalibrierung: ohne Kachel gäbe es „Anhang entfernen" nicht und die Kette begänne falsch.
    expect((vorher as Inventar).kacheln, "der Bestand trägt genau eine Anhangkachel").toBe(1);
  });

  it("UX23-1 · ERREICHBARKEIT: Tab führt von „Anhang entfernen“ auf den Auslöser (Beleg: sprang zu „Nachbarschaft“)", () => {
    expect(fehler).toBeNull();
    const marke = i18n.t("ko.attachmentAdd");
    const namen = tabKette.map((f) => f.name);
    expect(namen, `Tab-Kette ohne „${marke}“: ${JSON.stringify(namen)}`).toContain(marke);
    // Der Beleg maß den Sprung DIREKT von „Anhang entfernen" zu „Nachbarschaft"
    // (16-upload-tastatur.json:4). Der Auslöser ist genau diese eine fehlende Station.
    expect(tabKette[0]?.name).toBe(marke);
    expect(tabKette[0]?.tag, "der Fokus sitzt auf einem echten Knopf").toBe("BUTTON");
    // Und der Rückweg: Shift+Tab landet wieder beim Ausgangspunkt.
    expect(zurueck?.name).toBe(i18n.t("ko.attachmentRemove"));
  });

  it("UX23-2 · AUSLÖSBARKEIT: Enter UND Leertaste stoßen die Dateiauswahl an", () => {
    expect(fehler).toBeNull();
    expect(fokusAmAusloeser?.name, "gemessen wurde am fokussierten Auslöser").toBe(
      i18n.t("ko.attachmentAdd"),
    );
    expect((enterKlicks as { vor: number; nach: number }).nach).toBe(
      (enterKlicks as { vor: number; nach: number }).vor + 1,
    );
    expect((spaceKlicks as { vor: number; nach: number }).nach).toBe(
      (spaceKlicks as { vor: number; nach: number }).vor + 1,
    );
  });

  it("UX23-3 · SICHTBARER FOKUS: der fokussierte Auslöser sieht anders aus als im Ruhezustand", () => {
    expect(fehler).toBeNull();
    const f = fokusAmAusloeser as Fokus;
    // Erst die Voraussetzung, dann die Aussage: gemessen wird der Fokus AM AUSLÖSER. Sitzt er
    // woanders, ist über seine Sichtbarkeit hier nichts belegt — dann fällt dieser Fall mit genau
    // diesem Satz, statt zufällig zwei fremde Elemente zu vergleichen.
    expect(f.name, "der Fokus sitzt nicht auf dem Auslöser").toBe(i18n.t("ko.attachmentAdd"));
    const ruhe = (vorher as Inventar).ruhe as {
      outline: string;
      boxShadow: string;
      borderColor: string;
    };
    // Verglichen wird gegen den EIGENEN Ruhezustand, nicht gegen einen abgeschriebenen Sollwert:
    // ein fester Erwartungswert wäre nur eine zweite Kopie der Gestaltung.
    const unterschied =
      f.outline !== ruhe.outline ||
      f.boxShadow !== ruhe.boxShadow ||
      f.borderColor !== ruhe.borderColor;
    expect(
      unterschied,
      `Fokus nicht sichtbar — Ruhe ${JSON.stringify(ruhe)} gegen Fokus ${JSON.stringify(f)}`,
    ).toBe(true);
    // Der Ring kommt aus der globalen Regel `*:focus-visible` (index.css:58, Scheibe D-024); er ist
    // ein `box-shadow`. Diese Zeile hält fest, WORAN der Unterschied hängt — sonst bliebe „irgendwas
    // ist anders" stehen, und ein bloßer Farbwechsel beim Zeichnen käme als Fokus durch.
    expect(ruhe.boxShadow).toBe("none");
    expect(f.boxShadow).not.toBe("none");
  });

  it("UX23-4 · ABLÖSUNG: genau EIN Auslöser, und das Dateifeld ist aus der Bedienung genommen", () => {
    expect(fehler).toBeNull();
    const v = vorher as Inventar;
    expect(v.ausloeser.length, `Auslöser: ${JSON.stringify(v.ausloeser)}`).toBe(1);
    expect(v.ausloeser[0]?.tag).toBe("BUTTON");
    expect(v.ausloeser[0]?.typ, "kein Absende-Knopf in einem Formular").toBe("button");
    expect(v.ausloeser[0]?.tabIndex, "in der natürlichen Tab-Folge, ohne Kunstgriff").toBe(0);
    expect(v.feldDa, "das Dateifeld bleibt als technisches Mittel").toBe(true);
    expect(v.feldTabIndex).toBe(-1);
    expect(v.feldAriaHidden).toBe("true");
    expect(v.feldAccept, "unverändert").toBe("image/*");
    expect(v.feldDisplay, "unverändert versteckt").toBe("none");
  });

  it("UX23-5 · MAUSWEG unversehrt: ein echter Klick löst dieselbe Dateiauswahl aus", () => {
    expect(fehler).toBeNull();
    expect((mausKlicks as { vor: number; nach: number }).nach).toBe(
      (mausKlicks as { vor: number; nach: number }).vor + 1,
    );
  });

  it("UX23-6 · HOCHLADEN unversehrt: eine echte Datei im Feld erzeugt eine zweite Kachel", () => {
    expect(fehler).toBeNull();
    expect(kachelnNachUpload).toBe(2);
  });

  it("UX23-7 · der Abschnitt bleibt sonst unverändert: Grenzenhinweis, Kachel, keine neue Aussage", () => {
    expect(fehler).toBeNull();
    const v = vorher as Inventar;
    expect(v.grenzenHinweis, "UploadLimitsHint steht weiterhin an der Auswahlstelle").toBe(1);
    expect(v.ariaDisabled, "im Ruhezustand nicht gesperrt").toBe("false");
    // EIN PIN, KEINE STILVORSCHRIFT: die Klassenkette steht hier, weil sie beim Wechsel
    // `<label>` → `<button>` VOLLSTÄNDIG übernommen werden musste — der Beleg hält sie wörtlich
    // fest (`16-upload-tastatur.json:19`), und eine halb übernommene Kette wäre eine unbemerkte
    // Änderung des Aussehens. Wer den Auslöser später bewusst umgestaltet, führt diese Zeile mit
    // nach; wer ihn versehentlich verändert, sieht es hier.
    expect(
      v.klasse,
      "die Ruhedarstellung des Auslösers hat sich geändert — wenn gewollt, diesen Pin nachführen",
    ).toBe(
      "mt-3 inline-flex cursor-pointer items-center gap-1.5 rounded-btn border border-hairline px-3 py-1.5 text-[12.5px] font-semibold text-muted hover:text-text",
    );
    // Keine neue Aussage: im Abschnitt steht der Titel, die Beschriftung und der Grenzensatz —
    // der Leersatz gehört nicht dazu, solange eine Kachel da ist.
    expect(v.leersatz).not.toContain(i18n.t("ko.attachmentsEmpty"));
  });

  it("UX23-8 · ENGLISCH: derselbe Weg mit „Attach photo“ — erreichbar, auslösbar, ein Auslöser", () => {
    expect(fehler).toBeNull();
    const en = englisch as EnglischeMessung;
    const markeEn = enText("ko.attachmentAdd");
    expect(markeEn).toBe("Attach photo");
    expect((en.inventar as Inventar).ausloeser.length).toBe(1);
    expect((en.inventar as Inventar).ausloeser[0]?.tag).toBe("BUTTON");
    expect((en.inventar as Inventar).feldTabIndex).toBe(-1);
    expect(en.fokus?.name).toBe(markeEn);
    expect(en.enter.nach).toBe(en.enter.vor + 1);
  });
});
