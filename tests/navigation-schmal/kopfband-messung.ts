// ================================================================================================
// JOB 3571 · LIEFERUNG 1 — DAS MESSWERKZEUG DER KOPFBANDZEILE STEHT EINMAL, NICHT ZWEIMAL.
// ================================================================================================
//
// Bis hierher wohnte die ganze Messung in `kopfband-schmal-chromium.test.ts` (JOB 3525). JOB 3571
// misst DIESELBE Zeile ein zweites Mal — nur mit eingeschalteter Firmen-CI. Eine Kopie des
// Messcodes wäre die naheliegende und die falsche Antwort: zwei Kästenlisten, zwei Umbruchregeln,
// zwei Toleranzen, und beim nächsten Umbau der Hülle wird eine davon nachgeführt und die andere
// nicht. Genau so entstehen zwei Wahrheiten über dieselbe Zeile.
//
// DESHALB WANDERT DER MESSCODE HIERHER und wird von beiden Dateien importiert. Was NICHT mitwandert,
// ist die ZUSAGE: welche Breiten streng gelten und unter welcher Kennung gemessen wird, entscheidet
// die jeweilige Datei, denn das ist die Zusage ihres Jobs. `pruefeZeile` bekommt beides deshalb als
// Argument, statt es sich aus einer hier gepflegten Menge zu nehmen.
//
// Diese Datei enthält selbst KEINEN Testfall — sie ist Werkzeug, keine Aussage. Und sie startet
// keinen Browser: sie reitet auf `tests/design/h6-chromium.ts`, dem gemeinsamen Prüfstand. Über
// dessen Importhülle ordnet sich jede Datei, die dieses Werkzeug benutzt, von selbst in die
// serielle Browser-Gruppe ein (`tests/tor-inventar/browser-gruppe.ts`).
//
// ================================================================================================
// JOB 3582 — UND DER EINE SCHALTER FÜR DIE FIRMEN-CI WOHNT SEITDEM EBENFALLS HIER.
// ================================================================================================
//
// Bis JOB 3582 standen Anmeldung, `PUT /api/admin/branding` und die Bereitschaft „das Logo ist
// gezeichnet" in `kopfband-ci-chromium.test.ts`. JOB 3582 misst dieselbe Zeile ein drittes Mal —
// mit gedeckeltem Logokasten (`tests/chr-navigation-ci-logo/`). Ein abgeschriebener Schalter wäre
// derselbe Fehler wie eine zweite Kopie des Messcodes: zwei Wege, die Firmen-CI einzuschalten, und
// beim nächsten Vertragswechsel wird einer nachgeführt und der andere nicht. Der Schalter steht
// deshalb hier, EINMAL, und beide Messdateien importieren ihn.
import { expect } from "vitest";
import { type BrowserFn, type Seite, type Stand, fn, wechsle } from "../design/h6-chromium";

/** Die Bühne reicht die rohe Playwright-Seite durch — nur so lässt sich die Breite verstellen. */
export interface SeiteMitViewport {
  setViewportSize(size: { width: number; height: number }): Promise<void>;
}

export interface Kasten {
  name: string;
  links: number;
  rechts: number;
  oben: number;
  unten: number;
  text: string;
}

export interface Messung {
  bandHoehe: number;
  bandOben: number;
  bandUnten: number;
  scrollBreite: number;
  clientBreite: number;
  fensterBreite: number;
  kaesten: Kasten[];
  punkte: string[];
  menueText: string;
  geheZuText: string;
  entwuerfeText: string;
}

// In der Seite: jedes Bedienelement des Kopfbands mit seiner tatsächlichen Lage. Die Auswahl ist
// bewusst die der SICHTBAREN Griffe — Logo, Menü-Knopf, jeder Punkt, „Gehe zu …", Suche, Zahnrad,
// Konto. Was der Browser nicht zeichnet (`offsetParent === null`), fällt heraus statt als
// Nullkasten alles zu überlappen.
//
// `marke` ist dabei der Kasten, der die Firmen-CI von selbst mitträgt: das Firmenlogo hängt
// INNERHALB von `.kw-kopfband-marke` (`shell/Logo.tsx`), die Marke wächst also im vorhandenen
// Raster mit. Für JOB 3571 braucht es deshalb kein zweites Raster, nur einen zweiten Lauf.
export const MESSUNG = fn(`() => {
  const band = document.querySelector('header[data-testid="kopfband"]');
  if (!band) return null;
  const br = band.getBoundingClientRect();
  const sel = [
    ['menue', '[data-testid="kopfband-menue"]'],
    ['marke', '.kw-kopfband-marke'],
    ['gehezu', '[data-testid="kopfband-gehezu"]'],
    ['suche', '.kw-kopfband-suche'],
    ['zahnrad', '[data-testid="kopfband-zahnrad"]'],
    ['konto', '[data-testid="kopfband-konto"]'],
  ];
  const kaesten = [];
  for (const [name, s] of sel) {
    const el = band.querySelector(s);
    if (!el || el.offsetParent === null) continue;
    const r = el.getBoundingClientRect();
    kaesten.push({ name, links: r.left, rechts: r.right, oben: r.top, unten: r.bottom, text: (el.innerText || '').trim() });
  }
  for (const a of band.querySelectorAll('[data-kopfband-punkt]')) {
    if (a.offsetParent === null) continue;
    const r = a.getBoundingClientRect();
    kaesten.push({ name: 'punkt:' + a.getAttribute('data-kopfband-punkt'), links: r.left, rechts: r.right, oben: r.top, unten: r.bottom, text: (a.innerText || '').trim() });
  }
  const menue = band.querySelector('[data-testid="kopfband-menue"]');
  const gehezu = band.querySelector('[data-testid="kopfband-gehezu"]');
  const entwuerfe = band.querySelector('[data-kopfband-punkt="entwuerfe"]');
  return {
    bandHoehe: br.height,
    bandOben: br.top,
    bandUnten: br.bottom,
    scrollBreite: band.scrollWidth,
    clientBreite: band.clientWidth,
    fensterBreite: window.innerWidth,
    kaesten,
    punkte: [...band.querySelectorAll('[data-kopfband-punkt]')].map((a) => a.getAttribute('data-kopfband-punkt')),
    menueText: menue ? (menue.innerText || '').trim() : '',
    geheZuText: gehezu ? (gehezu.innerText || '').trim() : '',
    entwuerfeText: entwuerfe ? (entwuerfe.innerText || '').trim() : '',
  };
}`);

export function seiteRoh(stand: Stand): Seite & SeiteMitViewport {
  const seite = stand.seite;
  if (seite === null) {
    throw new Error(`Bühne steht nicht: ${stand.fehler ?? "unbekannt"}`);
  }
  return seite as unknown as Seite & SeiteMitViewport;
}

/**
 * Ein zusätzlicher Beweis, dass die Seite für die Messung wirklich fertig ist.
 *
 * JOB 3525 brauchte ihn nicht: sein Kopfband steht, sobald der `<header>` da ist. JOB 3571 misst
 * das Firmenlogo, und das kommt erst mit der Antwort von `/api/branding` und dem geladenen Bild —
 * eine Messung davor läse die Breite der Zeile OHNE CI und nennte sie „mit CI". Wer nichts
 * übergibt, misst wie bisher.
 */
export interface Bereitschaft {
  pruefung: BrowserFn;
  was: string;
}

/** Die Seite auf `breite` stellen, `/start` neu aufbauen und messen. */
export async function messe(
  stand: Stand,
  breite: number,
  hoehe: number,
  bereit?: Bereitschaft,
): Promise<Messung> {
  const seite = seiteRoh(stand);
  await seite.setViewportSize({ width: breite, height: hoehe });
  await wechsle(stand, "/start", 'header[data-testid="kopfband"]');
  expect(stand.fehler, `die Seite kam bei ${breite}px nicht hoch`).toBeNull();
  if (bereit) {
    try {
      await seite.waitForFunction(bereit.pruefung, undefined, { timeout: 30_000 });
    } catch (e) {
      throw new Error(`bei ${breite}px kam die Voraussetzung nicht: ${bereit.was} — ${String(e)}`);
    }
  }
  const m = await seite.evaluate<Messung | null>(MESSUNG);
  expect(m, `bei ${breite}px steht kein Kopfband`).not.toBeNull();
  if (m === null) {
    throw new Error("unerreichbar");
  }
  return m;
}

/**
 * Der grösste freie Zwischenraum der Zeile, abzüglich der Fuge, die dort ohnehin steht.
 *
 * WOZU: Die Zeile schiebt ihre rechte Gruppe mit `ml-auto` an den Rand. Alles, was übrig ist,
 * sammelt sich deshalb in GENAU EINER Lücke — der vor der rechten Gruppe. Diese Zahl sagt also, wie
 * viel Luft eine Breite wirklich noch hat, und sie ist die einzige, die das sagen kann:
 * `scrollWidth === clientWidth` heisst nur „es passt", nicht „um wie viel".
 *
 * `fuge` ist der Spaltenabstand, der an dieser Stelle zum Bau gehört und keine Reserve ist
 * (schmal 20 px, `shell/Kopfband.tsx`).
 */
export function freierRaum(m: Messung, fuge: number): number {
  const sortiert = [...m.kaesten].sort((a, b) => a.links - b.links);
  let groesste = 0;
  for (let i = 1; i < sortiert.length; i++) {
    const vor = sortiert[i - 1];
    const nach = sortiert[i];
    if (!vor || !nach) {
      continue;
    }
    groesste = Math.max(groesste, nach.links - vor.rechts);
  }
  return groesste - fuge;
}

/**
 * WELCHE DER DREI ENGEN ACHSEN AN DIESER BREITE ZUGESICHERT WERDEN.
 *
 * Bis JOB 3571 war das EIN Schalter („streng" ja/nein), weil es genau zwei Lagen gab: die Breiten,
 * die JOB 3525 baut, und die eine, die dem Bestand von JOB 3060 gehört. JOB 3571 hat mit aktiver
 * Firmen-CI eine DRITTE Lage gemessen und deshalb die drei Achsen getrennt: „zu breit" und „die
 * Elemente schneiden einander" sind für einen Menschen zwei verschiedene Fehler, und ein einziger
 * Schalter hätte mit der einen gefallenen Aussage auch die andere fallen lassen.
 *
 * DER ANLASS DIESER AUFTRENNUNG IST SEIT JOB 3582 FORT, die Auftrennung bleibt. Die damalige dritte
 * Lage war der Befund CI5: bei 390 px trug die Zeile die Breite des Firmenlogos nicht, der
 * Konto-Kreis stand rund 20 px ausserhalb des Fensters. Seit der Logokasten eine Obergrenze hat
 * (`shell/Logo.tsx`, JOB 3582) ist bei 390 px wieder ALLES zugesichert. Die getrennten Achsen stehen
 * trotzdem weiter hier: sie beschreiben, was eine Zusage sagen KANN, nicht was heute rot ist — und
 * die nächste enge Lage kommt bestimmt.
 */
export interface Zusage {
  /** L3 — kein Überlauf: `scrollWidth` übersteigt `clientWidth` nicht. */
  ueberlauf: boolean;
  /** Jedes Element steht im Fenster, nichts ist links oder rechts angeschnitten. */
  fenster: boolean;
  /** L4 — nichts überlappt. */
  ueberlappung: boolean;
  /** Steht im Lauf hinter der Zahl, sobald eine Achse NICHT zugesichert ist. */
  grund?: string;
}

/** Die Zusage der Breiten, die ein Auftrag wirklich baut. */
export const STRENG_ALLES: Zusage = { ueberlauf: true, fenster: true, ueberlappung: true };

/** Gemessen und ausgegeben, aber nichts davon zugesichert. */
export function nurGemessen(grund: string): Zusage {
  return { ueberlauf: false, fenster: false, ueberlappung: false, grund };
}

/**
 * L1–L4 in einem Stück: die vier Aussagen gehören zusammen, sie beschreiben EINE Zeile.
 *
 * `zusage` und `kennung` kommen von aussen — welche Breite was zusichert und unter welcher Kennung
 * die Zahl im Lauf steht, ist die Entscheidung des messenden Jobs, nicht die des Werkzeugs.
 */
export function pruefeZeile(m: Messung, breite: number, zusage: Zusage, kennung: string): void {
  // L1 — die Höhe des Mockups, unverändert.
  expect(m.bandHoehe, `${breite}px: die Kopfbandhöhe ist nicht 56 px`).toBeCloseTo(56, 1);
  expect(m.kaesten.length, `${breite}px: es wurde nichts gemessen`).toBeGreaterThan(2);
  // L3 — nichts läuft seitlich heraus. 1 px Toleranz für die Teilpixel des Browsers.
  const zusatz = zusage.ueberlauf ? "" : ` (Überlauf nicht zugesichert: ${zusage.grund ?? "—"})`;
  console.log(
    `${kennung} · ${breite}px · Kopfband scrollWidth ${m.scrollBreite} / clientWidth ${m.clientBreite}${zusatz}`,
  );
  if (zusage.ueberlauf) {
    expect(
      m.scrollBreite,
      `${breite}px: das Kopfband läuft über (${m.scrollBreite} > ${m.clientBreite})`,
    ).toBeLessThanOrEqual(m.clientBreite + 1);
  }
  for (const k of m.kaesten) {
    // L2 — jedes Element liegt IN der Zeile; ein Umbruch schöbe es unter `bandUnten`.
    expect(k.oben, `${breite}px: „${k.name}“ steht über dem Kopfband`).toBeGreaterThanOrEqual(
      m.bandOben - 1,
    );
    expect(
      k.unten,
      `${breite}px: „${k.name}“ ragt unter das Kopfband — die Zeile ist umgebrochen`,
    ).toBeLessThanOrEqual(m.bandUnten + 1);
    if (!zusage.fenster) {
      continue;
    }
    // Und es steht im Fenster, nicht daneben.
    expect(k.links, `${breite}px: „${k.name}“ steht links ausserhalb`).toBeGreaterThanOrEqual(-1);
    expect(k.rechts, `${breite}px: „${k.name}“ ist rechts angeschnitten`).toBeLessThanOrEqual(
      m.fensterBreite + 1,
    );
  }
  if (!zusage.ueberlappung) {
    return;
  }
  // L4 — nichts überlappt: nach links sortiert folgt jedes Element auf das vorige.
  const sortiert = [...m.kaesten].sort((a, b) => a.links - b.links);
  for (let i = 1; i < sortiert.length; i++) {
    const vor = sortiert[i - 1];
    const nach = sortiert[i];
    if (!vor || !nach) {
      continue;
    }
    expect(
      nach.links,
      `${breite}px: „${nach.name}“ überlappt „${vor.name}“ (${nach.links} < ${vor.rechts})`,
    ).toBeGreaterThanOrEqual(vor.rechts - 1);
  }
}

// ================================================================================================
// DIE FIRMEN-CI — EINGESCHALTET ÜBER DEN ECHTEN WEG, EINMAL FÜR ALLE MESSDATEIEN (JOB 3582).
// ================================================================================================

/** Die echte Fastify-App der Bühne (`tests/design/h6-chromium.ts`). */
export type Buehne = NonNullable<Stand["app"]>;

/**
 * Die Anmeldedaten der Bühne.
 *
 * Sie stehen hier ein zweites Mal, und das ist bewusst: `starte()` registriert und meldet dieses
 * ERSTE Konto selbst an (`tests/design/h6-chromium.ts`, Ersteinrichtung → Admin) und reicht seinen
 * Bearer nicht heraus. Der Rückruf `vorbereiten` bekommt nur die App. Da eine Messung mit Firmen-CI
 * den echten Adminweg drücken MUSS (`users.manage`), meldet sie sich ein zweites Mal an demselben
 * Konto an. Ginge das Konto der Bühne je verloren, wäre der Fall sofort rot (HTTP 401), nicht
 * still grün.
 */
export const BUEHNEN_KONTO = { email: "pedi@job3065.test", password: "geheim12345" } as const;

/** Der Bearer der Bühne — über die echte Anmelderoute, nicht aus einem gebauten Token. */
export async function meldeAn(app: Buehne): Promise<string> {
  const antwort = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: BUEHNEN_KONTO.email, password: BUEHNEN_KONTO.password },
  });
  if (antwort.statusCode !== 200) {
    throw new Error(
      `Anmeldung der Bühne: HTTP ${antwort.statusCode} — ${antwort.body.slice(0, 160)}`,
    );
  }
  return (antwort.json() as { token: string }).token;
}

/**
 * Die Firmen-CI über den ECHTEN Adminweg schalten und die Antwort des Servers zurückgeben.
 *
 * Der Rückgabewert ist nicht Zierde: er ist der Beleg, dass der Server die Schaltung wirklich
 * übernommen hat. Ein `PUT`, der 403 sagt, während der Test weiterläuft, wäre genau die stille
 * Lücke, gegen die die Voraussetzungsfälle (CI0, L0) stehen.
 */
export async function schalteCi(
  app: Buehne,
  bearer: string,
  an: boolean,
): Promise<{ profil: string | null; aktiv: boolean; version: number }> {
  const antwort = await app.inject({
    method: "PUT",
    url: "/api/admin/branding",
    headers: { authorization: `Bearer ${bearer}` },
    payload: { profil: an ? "advisor" : null, aktiv: an },
  });
  if (antwort.statusCode !== 200) {
    throw new Error(
      `PUT /api/admin/branding (an=${an}): HTTP ${antwort.statusCode} — ${antwort.body.slice(0, 160)}`,
    );
  }
  const gestellt = antwort.json() as { profil: string | null; aktiv: boolean; version: number };
  if (gestellt.aktiv !== an || (an && gestellt.profil !== "advisor")) {
    throw new Error(`der Server hat die Schaltung nicht übernommen: ${JSON.stringify(gestellt)}`);
  }
  return gestellt;
}

/**
 * Die Bereitschaft, auf die JEDE Messung mit Firmen-CI wartet: das Firmenlogo ist gezeichnet UND
 * sein Bild ist wirklich geladen. Ohne das Zweite wäre die Breite des `<img>` (`h-5`, `w-auto`)
 * schlicht 0 — die Marke sähe schmaler aus, als sie ist, und der Lauf hielte ein Nichts für ein
 * Ergebnis.
 */
export const LOGO_STEHT: Bereitschaft = {
  pruefung: fn(`() => {
    const bild = document.querySelector('[data-testid="kopfband-firmenlogo"] img');
    if (!bild) return false;
    const span = bild.parentElement;
    return span.offsetParent !== null && bild.complete && bild.naturalWidth > 0
      && span.getBoundingClientRect().width > 0;
  }`),
  was: "das Firmenlogo ist gezeichnet und sein Bild geladen",
};

/**
 * Was `MESSUNG` nicht beantwortet: steht das Logo wirklich da, wie breit ist sein Kasten, und in
 * welchem Verhältnis steht seine gezeichnete Breite zur Breite der Bilddatei?
 *
 * DAS LETZTE IST DIE FRAGE VON JOB 3582: `bildNaturBreite`/`bildNaturHoehe` sind die Masse der
 * ORIGINALDATEI. Aus ihnen folgt, wie breit das Bild bei 20 px Höhe (`h-5`) OHNE Deckelung wäre —
 * und nur so lässt sich messen, ob eine Deckelung an einer Breite GREIFT oder eben nicht (§5.4:
 * bei 1280 px darf sie nicht greifen). Eine gepinnte Zahl an ihrer Stelle wäre wieder der
 * Überschlag, den JOB 3571 abgelöst hat.
 */
export interface LogoBefund {
  logoDa: boolean;
  logoGezeichnet: boolean;
  logoBreite: number;
  logoHoehe: number;
  bildBreite: number;
  bildHoehe: number;
  bildGeladen: boolean;
  bildNaturBreite: number;
  bildNaturHoehe: number;
  markeBreite: number;
  markeText: string;
  fensterBreite: number;
}

export const LOGO_BEFUND = fn(`() => {
  const band = document.querySelector('header[data-testid="kopfband"]');
  if (!band) return null;
  const logo = band.querySelector('[data-testid="kopfband-firmenlogo"]');
  const bild = logo ? logo.querySelector('img') : null;
  const marke = band.querySelector('.kw-kopfband-marke');
  const lr = logo ? logo.getBoundingClientRect() : null;
  const br = bild ? bild.getBoundingClientRect() : null;
  return {
    logoDa: logo !== null,
    logoGezeichnet: logo !== null && logo.offsetParent !== null,
    logoBreite: lr ? lr.width : 0,
    logoHoehe: lr ? lr.height : 0,
    bildBreite: br ? br.width : 0,
    bildHoehe: br ? br.height : 0,
    bildGeladen: bild ? (bild.complete && bild.naturalWidth > 0) : false,
    bildNaturBreite: bild ? bild.naturalWidth : 0,
    bildNaturHoehe: bild ? bild.naturalHeight : 0,
    markeBreite: marke ? marke.getBoundingClientRect().width : 0,
    markeText: marke ? (marke.innerText || '').trim() : '',
    fensterBreite: window.innerWidth,
  };
}`);

/** Nur den Logobefund an der STEHENDEN Seite lesen — ohne Neuaufbau, ohne zweite Breitenstellung. */
export async function liesLogoBefund(stand: Stand): Promise<LogoBefund> {
  const seite = seiteRoh(stand);
  const b = await seite.evaluate<LogoBefund | null>(LOGO_BEFUND);
  if (b === null) {
    throw new Error("kein Kopfband in der Seite");
  }
  return b;
}

/** Die Kopfbandzeile an der STEHENDEN Seite messen — ohne Neuaufbau (für Messungen nach einem
 * Eingriff in die Seite, etwa einem ausgetauschten Logobild). */
export async function messeStehend(stand: Stand): Promise<Messung> {
  const seite = seiteRoh(stand);
  const m = await seite.evaluate<Messung | null>(MESSUNG);
  expect(m, "an der stehenden Seite steht kein Kopfband").not.toBeNull();
  if (m === null) {
    throw new Error("unerreichbar");
  }
  return m;
}

/**
 * Messen MIT eingeschalteter Firmen-CI — und zwar nachweislich: erst wenn das Logo gezeichnet ist,
 * wird gemessen, und danach wird noch einmal nachgesehen, dass es beim Messen wirklich stand.
 */
export async function messeMitCi(
  stand: Stand,
  breite: number,
  hoehe: number,
): Promise<{ m: Messung; logo: LogoBefund }> {
  const m = await messe(stand, breite, hoehe, LOGO_STEHT);
  const logo = await liesLogoBefund(stand);
  expect(
    logo.logoGezeichnet,
    `${breite}px: gemessen wurde OHNE Firmenlogo — der Lauf misst nichts`,
  ).toBe(true);
  expect(logo.bildGeladen, `${breite}px: das Firmenlogo ist ein leeres Bild`).toBe(true);
  expect(logo.logoBreite, `${breite}px: das Firmenlogo ist 0 px breit`).toBeGreaterThan(0);
  return { m, logo };
}
