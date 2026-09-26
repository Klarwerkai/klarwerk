// ================================================================================================
// UX-08 · QUELLENHINWEIS-HÄLFTE — vom Hinweis am Wissensobjekt bis zur Stufenauswahl, im echten Browser.
// ================================================================================================
//
// DIE FRAGE ist nicht „steht im Katalog ein Pfeil", sondern: kommt ein Administrator, der den
// Hinweis im Quellenbereich liest, mit GENAU diesen Namen über das bestehende Menü an die Stelle,
// an der er die Stufe umstellen kann — und wieder zurück zum Wissensobjekt und seiner Quelle?
//
// DESHALB wird hier gegen die GEBAUTE Fläche (`apps/web/dist`) an einem echten Server gemessen
// (`tests/gast-nutzerweg/strecke.ts`, Kekse statt Bearer). Der Weg wird zweimal gefahren — mit der
// Maus und ausschliesslich mit Tab/Pfeil/Enter —, und zwar in DE/EN/NL, breit und bei 320 px.
// Gelesen werden auf der Strecke die TATSÄCHLICH ANGEZEIGTEN Namen (Seitentitel, aktiver Reiter,
// Titel der Detailkarte); sie werden zu einem Weg verbunden und gegen den ANGEZEIGTEN Hinweis
// gelegt. Kein Name ist in dieser Datei abgeschrieben: stimmten Hinweis und Fläche gemeinsam
// nicht, fiele das trotzdem auf, weil der Sollweg aus der Fläche kommt und nicht aus dem Katalog.
//
// DIE GEGENPROBE zum früheren Text („Verwaltung → Externes Wissen") steht zweifach: der alte Weg
// taucht in keiner Lesung auf, UND er ist an der Fläche nicht begehbar — sein Anfang ist nicht der
// Seitentitel, der Reiter dazwischen fehlte, und sein Ziel gibt es in DE/NL weder als Reiter noch
// als Zeile.
//
// KEIN SCHREIBEN DURCH LESEN (K3): jede Anfrage an `/api/*`, die nicht lesend ist, wird am Server
// mitgeschrieben. Während Lesen und Navigieren muss diese Liste leer bleiben, und die Stufe steht
// am Ende unverändert auf der Vorgabe.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import i18n from "../../apps/web/src/i18n";
import { stelleFlaecheBereit } from "../fassungsrueckholung-echter-browser/weg";
import {
  type Browser,
  type Seite,
  fn,
  mitFlaeche,
  profil,
  starteChromium,
  tabBisZu,
  tippeMitTastatur,
  warte,
} from "../gast-nutzerweg/browserweg";
import {
  PASSWORT,
  type Sitzung,
  type Strecke,
  ersteinrichtung,
  gastAnlegen,
  mussGelingen,
  starteStrecke,
  wissensobjektAnlegen,
} from "../gast-nutzerweg/strecke";

const SPRACHEN = ["de", "en", "nl"] as const;
type Sprache = (typeof SPRACHEN)[number];

const BREIT = { width: 1280, height: 900 };
const SCHMAL = { width: 320, height: 760 };

const ADMIN = "admin@ux08-quellenhinweis.test";
const EXPERTE = "experte@ux08-quellenhinweis.test";
const LESER = "leser@ux08-quellenhinweis.test";
const TITEL = "Dichtungswechsel Linie 4 (UX-08)";
const QUELLE = "Pruefbericht-UX08.pdf";

/**
 * Der frühere, falsche Weg — nur als Gegenprobe. Er begann an einem Ort, der kein Seitentitel ist,
 * und liess den Reiter aus. Im Englischen hiess das ZIEL schon damals richtig („External
 * knowledge"); falsch waren dort Anfang und fehlender Zwischenschritt.
 */
const ALTER_WEG: Record<Sprache, readonly [string, string]> = {
  de: ["Verwaltung", "Externes Wissen"],
  en: ["Administration", "External knowledge"],
  nl: ["Beheer", "Externe kennis"],
};
const alterWeg = (sprache: Sprache): string => ALTER_WEG[sprache].join(" → ");

const PDF_DATA_URL = `data:application/pdf;base64,${Buffer.from("%PDF-1.4 Pruefbericht UX08").toString("base64")}`;

let strecke: Strecke | undefined;
let browser: Browser | undefined;
let adminApi: Sitzung;
let koId = "";
/** Nicht lesende Anfragen an `/api/*`, am Server mitgeschrieben. */
const schreibzugriffe: string[] = [];

beforeAll(async () => {
  stelleFlaecheBereit();
  browser = await starteChromium();
  const flaeche = mitFlaeche();
  strecke = await starteStrecke({
    vorListen: async (app) => {
      app.addHook("onRequest", async (anfrage) => {
        if (
          anfrage.url.startsWith("/api/") &&
          anfrage.method !== "GET" &&
          anfrage.method !== "HEAD"
        ) {
          schreibzugriffe.push(`${anfrage.method} ${anfrage.url.split("?")[0]}`);
        }
      });
      await flaeche.vorListen(app);
    },
  });
  adminApi = (await ersteinrichtung(strecke, ADMIN)).sitzung;
  for (const [name, email, role] of [
    ["Erika Experte", EXPERTE, "experte"],
    ["Lena Leser", LESER, "viewer"],
  ] as const) {
    const an = await gastAnlegen(adminApi, { name, email, role });
    expect(an.status, an.text).toBe(201);
  }

  // DAS VORHANDENE WISSENSOBJEKT MIT SEINER QUELLE — Vorbereitung über die echten Routen, kein
  // Schritt des gemessenen Weges. Die Quelle hängt an einem hinterlegten Dokument; nur so ist sie
  // auf der Vorgabestufe überhaupt zulässig.
  koId = await wissensobjektAnlegen(adminApi, TITEL);
  const objekt = mussGelingen(
    "POST /api/objects",
    await adminApi.sende("POST", "/api/objects", {
      name: QUELLE,
      mime: "application/pdf",
      data: PDF_DATA_URL,
    }),
    201,
  );
  const objectId = (objekt.json as { id: string }).id;
  mussGelingen(
    "Anhang",
    await adminApi.sende("PUT", `/api/kos/${koId}`, {
      action: "attach",
      attachment: { name: QUELLE, mime: "application/pdf", objectId },
    }),
  );
  mussGelingen(
    "Quelle",
    await adminApi.sende("PUT", `/api/kos/${koId}`, {
      action: "add-source",
      source: { label: QUELLE, excerpt: "Abschnitt 3.2", objectId },
    }),
  );
  expect(await stufe()).toBe("search_on_click");
}, 900_000);

afterAll(async () => {
  await browser?.close();
  await strecke?.schliessen();
}, 120_000);

async function stufe(): Promise<string> {
  const antwort = mussGelingen(
    "GET /api/external/policy",
    await adminApi.sende("GET", "/api/external/policy"),
  );
  return (antwort.json as { stage: string }).stage;
}

function zeug(): { browser: Browser; strecke: Strecke } {
  if (!browser || !strecke) {
    throw new Error("UX-08: Browser oder Strecke fehlen — der Aufbau ist nicht durchgelaufen.");
  }
  return { browser, strecke };
}

// ------------------------------------------------------------------------------------------------
// Sonden, die IM Browser laufen.
// ------------------------------------------------------------------------------------------------

const GIBT_ES = "(sel) => !!document.querySelector(sel)";

/**
 * Ein Hinweis in einem Abschnitt des Wissensobjekts — gefunden an seinem TEXT, nicht an einer
 * Kennung: die lesende Rolle bekommt denselben Satz in einem Absatz ohne `data-testid`, und der
 * Quellenhinweis im Formular ist eine `<output>`, die zwei Sätze trägt.
 * Gemessen wird, ob ein Mensch ihn GANZ lesen kann: sichtbar, im Fenster, nicht abgeschnitten
 * (weder vom Element selbst noch von einem Vorfahren), und als Text im Fluss, nicht als `title`.
 */
const HINWEIS_BEFUND = `([abschnitt, soll, genau]) => {
  const bereich = document.querySelector('[data-bib-abschnitt="' + abschnitt + '"]');
  if (!bereich) return { gefunden: false, grund: "Abschnitt fehlt" };
  const kandidaten = [...bereich.querySelectorAll("p, output")];
  const norm = (e) => (e.textContent || "").replace(/\\s+/g, " ").trim();
  const el = kandidaten.find((e) => (genau ? norm(e) === soll : norm(e).includes(soll)));
  if (!el) {
    return { gefunden: false, grund: "kein Absatz mit dem Sollsatz", ist: kandidaten.map((e) => e.textContent) };
  }
  const r = el.getBoundingClientRect();
  const s = getComputedStyle(el);
  const abgeschnitten = [];
  if (el.scrollWidth > el.clientWidth + 1) abgeschnitten.push("breite");
  if (el.scrollHeight > el.clientHeight + 1) abgeschnitten.push("hoehe");
  if (s.textOverflow === "ellipsis") abgeschnitten.push("ellipsis");
  for (let a = el.parentElement; a; a = a.parentElement) {
    const as = getComputedStyle(a);
    if (as.overflowX === "hidden" || as.overflowY === "hidden" || as.overflow === "clip") {
      const ar = a.getBoundingClientRect();
      if (r.left < ar.left - 1 || r.right > ar.right + 1 || r.top < ar.top - 1 || r.bottom > ar.bottom + 1) {
        abgeschnitten.push("vorfahr:" + a.tagName.toLowerCase());
      }
    }
  }
  return {
    gefunden: true,
    lesung: el.innerText.replace(/\\s+/g, " ").trim(),
    links: Math.round(r.left),
    rechts: Math.round(r.right),
    fenster: window.innerWidth,
    hoehe: Math.round(r.height),
    sichtbar: s.visibility !== "hidden" && s.display !== "none" && Number(s.opacity) > 0 && r.width > 0 && r.height > 0,
    abgeschnitten,
    seiteUeberlauf: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  };
}`;

interface Hinweisbefund {
  gefunden: boolean;
  grund?: string;
  ist?: unknown;
  lesung: string;
  links: number;
  rechts: number;
  fenster: number;
  hoehe: number;
  sichtbar: boolean;
  abgeschnitten: string[];
  seiteUeberlauf: number;
}

/** Was auf /admin gerade angezeigt ist: Seitentitel, aktiver Reiter, Titel der Detailkarte. */
const ADMIN_LESUNG = `() => {
  const text = (e) => (e ? (e.textContent || "").replace(/\\s+/g, " ").trim() : null);
  const detail = document.querySelector('[data-testid="detail-ki-extern"]');
  const kopf = detail ? detail.querySelector(":scope > div:first-child > span") : null;
  return {
    titel: text(document.querySelector('[data-einst="titel"]')),
    reiter: text(document.querySelector('[data-einst="reiter"][aria-pressed="true"]')),
    alleReiter: [...document.querySelectorAll('[data-einst="reiter"]')].map(text),
    zeilen: [...document.querySelectorAll('[data-einst="label"]')].map(text),
    detailTitel: text(kopf),
    stufen: detail ? [...detail.querySelectorAll("button[aria-pressed]")].map((b) => ({
      name: text(b.querySelector("span > span")),
      gewaehlt: b.getAttribute("aria-pressed") === "true",
    })) : [],
  };
}`;

interface AdminLesung {
  titel: string | null;
  reiter: string | null;
  alleReiter: string[];
  zeilen: string[];
  detailTitel: string | null;
  stufen: { name: string | null; gewaehlt: boolean }[];
}

// ------------------------------------------------------------------------------------------------
// Schritte des Weges.
// ------------------------------------------------------------------------------------------------

async function anmelden(seite: Seite, email: string): Promise<void> {
  const { strecke: s } = zeug();
  await seite.goto(`${s.basis}/`, { waitUntil: "domcontentloaded" });
  await warte(seite, `() => !!document.querySelector("#auth-email")`, `Anmeldemaske (${email})`);
  await tippeMitTastatur(seite, "#auth-email", email, "E-Mail");
  await tippeMitTastatur(seite, "#auth-password", PASSWORT, "Passwort");
  await seite.keyboard.press("Enter");
  await warte(
    seite,
    `() => !document.querySelector("#auth-email")`,
    `Anmeldung ${email}`,
    undefined,
    60_000,
  );
}

/** Wissensobjekt öffnen, „Mehr" aufklappen, einen Abschnitt öffnen — mit Maus ODER Tastatur. */
async function oeffneAbschnitt(
  seite: Seite,
  abschnitt: "extern" | "quellen",
  art: "maus" | "tastatur",
  neuLaden = true,
): Promise<void> {
  const { strecke: s } = zeug();
  if (neuLaden) {
    await seite.goto(`${s.basis}/wissen/${koId}`, { waitUntil: "domcontentloaded" });
  }
  await warte(seite, "(t) => document.body.innerText.includes(t)", "Leseansicht", TITEL, 60_000);
  await warte(seite, GIBT_ES, "Zeile „Mehr“", '[data-testid="bib-mehr"]');
  const kopf = `[data-bib-abschnitt="${abschnitt}"] > summary`;
  const offen = `[data-bib-abschnitt="${abschnitt}"][open]`;
  if (!(await seite.evaluate<boolean>(fn(GIBT_ES), kopf))) {
    await ausloesen(seite, '[data-testid="bib-mehr"]', art);
    await warte(seite, GIBT_ES, `Abschnitt ${abschnitt}`, kopf);
  }
  if (!(await seite.evaluate<boolean>(fn(GIBT_ES), offen))) {
    await ausloesen(seite, kopf, art);
  }
  await warte(seite, GIBT_ES, `Abschnitt ${abschnitt} offen`, offen);
}

async function ausloesen(seite: Seite, selektor: string, art: "maus" | "tastatur"): Promise<void> {
  if (art === "maus") {
    await seite.click(selektor);
    return;
  }
  await tabBisZu(seite, selektor, 320, true);
  await seite.keyboard.press("Enter");
}

async function liesHinweis(
  seite: Seite,
  soll: string,
  abschnitt: "extern" | "quellen" = "extern",
  genau = true,
): Promise<Hinweisbefund> {
  const arg = [abschnitt, soll, genau];
  await warte(
    seite,
    `(a) => (${HINWEIS_BEFUND})(a).gefunden === true`,
    `Hinweis im Abschnitt „${abschnitt}“`,
    arg,
  );
  const befund = await seite.evaluate<Hinweisbefund>(fn(HINWEIS_BEFUND), arg);
  expect(befund.gefunden, JSON.stringify(befund)).toBe(true);
  return befund;
}

function hinweisIstLesbar(befund: Hinweisbefund, wo: string): void {
  expect(befund.sichtbar, `${wo}: Hinweis nicht sichtbar`).toBe(true);
  expect(befund.abgeschnitten, `${wo}: Hinweis abgeschnitten`).toEqual([]);
  expect(befund.links, `${wo}: Hinweis links aus dem Fenster`).toBeGreaterThanOrEqual(0);
  expect(befund.rechts, `${wo}: Hinweis rechts aus dem Fenster`).toBeLessThanOrEqual(
    befund.fenster,
  );
  expect(befund.seiteUeberlauf, `${wo}: Seite läuft seitlich über`).toBeLessThanOrEqual(0);
}

/**
 * Pfeiltaste im offenen Menü, bis die Zeile den Fokus hat. Das Zahnrad-Menü ist `role="menu"`
 * (`shell/Menue.tsx`): dort wandert man mit Pfeilen, nicht mit Tab.
 */
async function pfeilBisZu(seite: Seite, selektor: string): Promise<number> {
  const treffer = "(sel) => { const a = document.activeElement; return !!a && a.matches(sel); }";
  for (let schritte = 0; schritte <= 20; schritte += 1) {
    if (await seite.evaluate<boolean>(fn(treffer), selektor)) {
      return schritte;
    }
    await seite.keyboard.press("ArrowDown");
  }
  throw new Error(`UX-08: ${selektor} war im Menü mit Pfeiltasten nicht erreichbar.`);
}

/** Tab bis zum Reiter mit GENAU diesem Namen. */
async function tabBisReiter(seite: Seite, name: string): Promise<number> {
  const treffer = `(n) => { const a = document.activeElement; return !!a && a.matches('[data-einst="reiter"]') && (a.textContent || "").trim() === n; }`;
  await seite.evaluate<boolean>(
    fn("() => { const a = document.activeElement; if (a && a.blur) a.blur(); return true; }"),
  );
  for (let schritte = 1; schritte <= 200; schritte += 1) {
    await seite.keyboard.press("Tab");
    if (await seite.evaluate<boolean>(fn(treffer), name)) {
      return schritte;
    }
  }
  throw new Error(`UX-08: Reiter „${name}" war per Tab nicht erreichbar.`);
}

/**
 * DER WEG vom Wissensobjekt bis zur Stufenauswahl — über Zahnrad → Einstellungen → Reiter → Zeile.
 * Kein `goto` auf eine Einstellungsadresse: jede Station wird über das bestehende Menü erreicht.
 * Gibt die an der Fläche GELESENEN Namen zurück.
 */
async function folgeDemWeg(
  seite: Seite,
  art: "maus" | "tastatur",
  reiterName: string,
): Promise<AdminLesung> {
  const zahnrad = '[data-testid="kopfband-zahnrad"]';
  const einstellungen = '[data-testid="zahnrad-einstellungen"]';
  await warte(seite, GIBT_ES, "Zahnrad im Kopfband", zahnrad);
  if (art === "maus") {
    await seite.click(zahnrad);
    await warte(seite, GIBT_ES, "Zahnrad-Menü offen", einstellungen);
    await seite.click(einstellungen);
  } else {
    await tabBisZu(seite, zahnrad, 320, true);
    await seite.keyboard.press("Enter");
    await warte(seite, GIBT_ES, "Zahnrad-Menü offen", einstellungen);
    await pfeilBisZu(seite, einstellungen);
    await seite.keyboard.press("Enter");
  }
  await warte(seite, GIBT_ES, "Einstellungsseite", '[data-einst="titel"]');
  const reiter = `[data-einst="reiter"]:text-is("${reiterName}")`;
  if (art === "maus") {
    await seite.click(reiter);
  } else {
    await tabBisReiter(seite, reiterName);
    await seite.keyboard.press("Enter");
  }
  const zeile = '[data-testid="zeile-ki-extern"]';
  await warte(seite, GIBT_ES, "Zeile zur externen Wissensabfrage", zeile);
  const imReiter = await seite.evaluate<AdminLesung>(fn(ADMIN_LESUNG));
  if (art === "maus") {
    await seite.click(zeile);
  } else {
    await tabBisZu(seite, zeile, 320, true);
    await seite.keyboard.press("Enter");
  }
  await warte(
    seite,
    GIBT_ES,
    "Stufenauswahl",
    '[data-testid="detail-ki-extern"] button[aria-pressed]',
    45_000,
  );
  if (art === "tastatur") {
    // Bis IN die Stufenauswahl, ohne etwas zu wählen.
    await tabBisZu(seite, '[data-testid="detail-ki-extern"] button[aria-pressed]', 320, true);
  }
  const lesung = await seite.evaluate<AdminLesung>(fn(ADMIN_LESUNG));
  // Die Zeilen des Reiters gehören zur Lesung — in der Detailansicht stehen sie nicht mehr da.
  return { ...lesung, zeilen: imReiter.zeilen };
}

/** Der Rückweg: Browser-Zurück, bis wieder das Wissensobjekt dasteht. Gibt die Schritte zurück. */
async function zurueckZumObjekt(seite: Seite): Promise<number> {
  for (let schritte = 1; schritte <= 6; schritte += 1) {
    await seite.evaluate<boolean>(fn("() => { history.back(); return true; }"));
    try {
      await warte(
        seite,
        "(p) => location.pathname === p",
        "zurück am Wissensobjekt",
        `/wissen/${koId}`,
        3_000,
      );
      return schritte;
    } catch {
      // noch nicht angekommen — ein Schritt weiter zurück
    }
  }
  throw new Error(`UX-08: der Rückweg führte nicht zum Wissensobjekt (${seite.url()}).`);
}

// ------------------------------------------------------------------------------------------------
// Die Fälle.
// ------------------------------------------------------------------------------------------------

describe("UX-08 · Quellenhinweis → Einstellungen → KI → Externe Wissensabfrage, im echten Browser", () => {
  for (const sprache of SPRACHEN) {
    for (const [breite, fenster] of [
      ["breit", BREIT],
      ["320px", SCHMAL],
    ] as const) {
      for (const art of ["maus", "tastatur"] as const) {
        it(`K1/K2/K4 · ${sprache} · ${breite} · ${art}: Hinweis lesen, dem Weg folgen, zurück`, async () => {
          const t = i18n.getFixedT(sprache);
          const { browser: b } = zeug();
          const { kontext, seite } = await profil(b, fenster, sprache);
          try {
            await anmelden(seite, ADMIN);
            // Kalibrierung: der Mitschreiber sieht Schreibaufrufe wirklich — die Anmeldung ist einer.
            expect(schreibzugriffe).toContain("POST /api/auth/login");
            schreibzugriffe.length = 0;

            // K1 — der Hinweis im Quellenbereich des vorhandenen Wissensobjekts.
            await oeffneAbschnitt(seite, "extern", art);
            const hinweis = await liesHinweis(seite, t("ext.attachBlocked"));
            hinweisIstLesbar(hinweis, `${sprache}/${breite}`);
            const seitentext = await seite.evaluate<string>(fn("() => document.body.innerText"));
            expect(seitentext, "alter Weg noch sichtbar").not.toContain(alterWeg(sprache));

            // K2 — dem Weg folgen, nur über das bestehende Menü.
            const lesung = await folgeDemWeg(seite, art, t("adm.sec.ki"));
            expect(seite.url(), "keine eingetippte Route").toContain("/admin");
            const gegangen = [lesung.titel, lesung.reiter, lesung.detailTitel].join(" → ");
            expect(
              hinweis.lesung,
              `der gelesene Hinweis nennt nicht den gegangenen Weg „${gegangen}"`,
            ).toContain(gegangen);
            // Die Stufenauswahl ist da, mit der unveränderten Vorgabe gewählt.
            expect(lesung.stufen.length).toBe(4);
            expect(lesung.stufen.filter((s) => s.gewaehlt).map((s) => s.name)).toEqual([
              t("adm.ext.stage.search_on_click"),
            ]);
            // K4 — Gegenprobe: der alte Weg ist an der Fläche nicht begehbar. Sein Anfang ist nicht
            // der Seitentitel, zwischen Titel und Ziel liegt der Reiter, und wo sein Ziel anders
            // hiess als die Zeile (DE/NL), gibt es dieses Ziel weder als Reiter noch als Zeile.
            const [altAnfang, altZiel] = ALTER_WEG[sprache];
            expect(lesung.titel).not.toBe(altAnfang);
            expect(gegangen).not.toContain(alterWeg(sprache));
            if (altZiel !== lesung.detailTitel) {
              expect(lesung.alleReiter).not.toContain(altZiel);
              expect(lesung.zeilen).not.toContain(altZiel);
            }
            expect(lesung.alleReiter).toContain(lesung.reiter);
            expect(lesung.zeilen).toContain(lesung.detailTitel);

            // Rückweg — zum selben Wissensobjekt und seiner Quelle.
            await zurueckZumObjekt(seite);
            await oeffneAbschnitt(seite, "quellen", art, false);
            await warte(
              seite,
              "(q) => (document.querySelector('[data-bib-abschnitt=\"quellen\"]')?.textContent || '').includes(q)",
              "die Quelle steht wieder da",
              QUELLE,
            );
            // Der zweite Hinweis desselben Quellenwegs: eine öffentliche Adresse im Quellenformular.
            // Nur getippt, nicht abgeschickt — der Hinweis steht VOR dem Absenden da.
            await tippeMitTastatur(
              seite,
              `[data-bib-abschnitt="quellen"] input[placeholder="${t("ko.sourceUrl")}"]`,
              "https://example.org/dichtung",
              "Quellenadresse",
            );
            const quellenHinweis = await liesHinweis(seite, t("ext.gate.how"), "quellen", false);
            hinweisIstLesbar(quellenHinweis, `${sprache}/${breite}/quellen`);
            expect(quellenHinweis.lesung).toContain(gegangen);
            expect(quellenHinweis.lesung).not.toContain(alterWeg(sprache));

            // K3 — Lesen und Navigieren haben nichts geschrieben; die Stufe ist unverändert.
            expect(schreibzugriffe).toEqual([]);
            expect(await stufe()).toBe("search_on_click");
          } finally {
            await kontext.close();
          }
        }, 180_000);
      }
    }
  }

  for (const sprache of SPRACHEN) {
    for (const [rolle, email] of [
      ["experte", EXPERTE],
      ["viewer", LESER],
    ] as const) {
      it(`K3/K4 · ${sprache} · ${rolle} · 320px: dieselbe Anweisung an den Administrator, kein Einstellungszugang, kein Schreiben`, async () => {
        const t = i18n.getFixedT(sprache);
        const { browser: b } = zeug();
        const { kontext, seite } = await profil(b, SCHMAL, sprache);
        try {
          await anmelden(seite, email);
          schreibzugriffe.length = 0;
          await oeffneAbschnitt(seite, "extern", "tastatur");
          const hinweis = await liesHinweis(seite, t("ext.attachBlocked"));
          hinweisIstLesbar(hinweis, `${sprache}/${rolle}`);
          // Derselbe Weg wie beim Administrator — gelesen aus denselben Namen, die er anklickt.
          const weg = [t("einst.titel"), t("adm.sec.ki"), t("adm.ext.title")].join(" → ");
          expect(hinweis.lesung).toContain(weg);
          expect(hinweis.lesung).not.toContain(alterWeg(sprache));
          // Die Person selbst hat den Zugang nicht — und der Text behauptet ihn auch nicht.
          await ausloesen(seite, '[data-testid="kopfband-zahnrad"]', "maus");
          await warte(seite, GIBT_ES, "Zahnrad-Menü offen", '[data-testid="zahnrad-menue"]');
          expect(
            await seite.evaluate<boolean>(fn(GIBT_ES), '[data-testid="zahnrad-einstellungen"]'),
          ).toBe(false);
          expect(schreibzugriffe).toEqual([]);
          expect(await stufe()).toBe("search_on_click");
        } finally {
          await kontext.close();
        }
      }, 180_000);
    }
  }
});
