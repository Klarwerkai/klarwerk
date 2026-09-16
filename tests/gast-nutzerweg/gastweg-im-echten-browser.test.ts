// ================================================================================================
// JOB 4223 · C — DER GASTDURCHLAUF IN EINEM ECHTEN BROWSER, IM ZWEITEN PROFIL.
// ================================================================================================
//
// WAS DIESE DATEI ALS EINZIGE KANN, und warum sie neben den vorhandenen Chromium-Vorrichtungen
// steht statt in ihnen: `tests/design/h1-chromium.ts:239` und `h6-chromium.ts:307` fangen jeden
// `/api/*`-Aufruf mit `page.route` ab und setzen dabei EINEN festen Bearer in jede Anfrage. Dort
// trägt nicht die SITZUNG, sondern der Bearer — ein Auftrag, der vom Anmelden, vom Ablaufen und vom
// Verlängern einer Sitzung handelt, ist auf einer solchen Bühne baulich nicht messbar.
//
// HIER GIBT ES KEINE ROUTENABFANGUNG. Die echte, gebaute Anwendung (`apps/web/dist`) wird von der
// ECHTEN Fastify-Instanz ausgeliefert (`registerWebStatic`, derselbe Aufruf wie in
// `services/app/src/server.ts:66`), die auf einem echten Port horcht. Chromium lädt
// `http://127.0.0.1:<port>/` und spricht von dort mit demselben Server — echte Kekse, echter
// Ursprung. `127.0.0.1` ist ein SICHERER KONTEXT, also gibt es `crypto.randomUUID` und damit auch
// Toasts (die Falle, die JOB 3818 in h4 gefunden hat).
//
// ZWEI PROFILE, NICHT ZWEI TABS. `browser.newContext()` gibt je einen eigenen Keks- und
// Speicherzustand — die technische Entsprechung zu „ein frisches, getrenntes Browserprofil". Zwei
// Seiten in EINEM Kontext teilten sich den Sitzungskeks, und der ganze Auftrag wäre nicht gemessen.
//
// ================================================================================================
// RUNDE 2 — DER WEG STEHT NICHT MEHR HIER, SONDERN IN `browserweg.ts`.
// ================================================================================================
//
// BEN hat an Runde 1 beanstandet, dass „der durchgehende Weg" in Wahrheit zwei getrennte
// Behauptungen waren (Browser gegen Speicher, PostgreSQL nur über HTTP ohne Formular) und dass der
// Tastaturnachweis in Wahrheit ein JavaScript-`click()` war — belegt mit einer eigenen Mutation:
// `tabIndex={-1}` am Knopf „Befristung setzen", und der Fall blieb grün.
//
// Beides ist behoben, und zwar an EINER Stelle: `browserweg.ts` beschreibt den ganzen Weg genau
// einmal (Anlegen → Anmelden → Arbeiten → Ablauf → gesperrter Abruf → Verlängern → Weiterarbeiten)
// und bedient JEDES Bedienelement über Tab, sichtbaren Fokus und Enter. Diese Datei fährt ihn gegen
// SPEICHERablagen — der schnelle Nachweis, der im Tor ohne Datenbank läuft.
// `gastweg-pg-im-browser.integration.test.ts` fährt DENSELBEN Weg gegen echtes PostgreSQL.
//
// LAUFVORAUSSETZUNG, LAUT UND NICHT STILL: `apps/web/dist` muss da sein. Im Tor läuft
// `./tools/build` davor (`tools/check:9`). Fehlt es, wird dieser Lauf ROT mit Handlungsanweisung —
// ein stiller Übersprung sähe aus wie ein bestandener Lauf.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  type Browser,
  LIES_TEXT,
  SCHMAL,
  type Zeilenbefund,
  fahreDenGanzenWeg,
  fn,
  mitFlaeche,
  profil,
  starteChromium,
  warte,
} from "./browserweg";
import {
  PASSWORT,
  type Sitzung,
  type Strecke,
  ersteinrichtung,
  starteStrecke,
  wissensobjektAnlegen,
} from "./strecke";

const ADMIN = "browseradmin@gastweg-4223.test";
const TITEL = "Wartungsplan Halle 3 (JOB 4223)";
const GAST_NAME = "Gast im Browser";
const GAST_EMAIL = "browsergast@gastweg-4223.test";
/**
 * Ein sehr langer Name OHNE Leerzeichen — genau der Fall, an dem eine Zeile aufbricht. Ein langer
 * Name MIT Leerzeichen bewiese nichts: er darf umbrechen, und jeder Umbruchvertrag trägt ihn.
 */
const LANGER_NAME = "Wolkenkuckucksheimverwaltungsangelegenheitenbeauftragte-Vertretung";

let strecke: Strecke | undefined;
let browser: Browser | undefined;
let adminApi: Sitzung;

beforeAll(async () => {
  browser = await starteChromium();
  strecke = await starteStrecke(mitFlaeche());
  adminApi = (await ersteinrichtung(strecke, ADMIN)).sitzung;
  await wissensobjektAnlegen(adminApi, TITEL);
}, 180_000);

afterAll(async () => {
  await browser?.close();
  await strecke?.schliessen();
}, 60_000);

function zeug(): { browser: Browser; strecke: Strecke } {
  if (!browser || !strecke) {
    throw new Error("JOB 4223: Browser oder Strecke fehlen — der Aufbau ist nicht durchgelaufen.");
  }
  return { browser, strecke };
}

describe("JOB 4223 C · der Gastweg im echten Browser, in zwei getrennten Profilen", () => {
  it("C1 — der ganze Weg an einer Instanz: anlegen (Tastatur, 390 px) → anmelden → arbeiten → Ablauf → gesperrt → verlängern → weiterarbeiten", async () => {
    const { browser: b, strecke: s } = zeug();
    const befund = await fahreDenGanzenWeg({
      browser: b,
      strecke: s,
      adminApi,
      adminEmail: ADMIN,
      gastName: GAST_NAME,
      gastEmail: GAST_EMAIL,
      titel: TITEL,
      fristTag: "2031-03-14",
      verlaengerungsTag: "2032-07-09",
      vergangenerTag: "2020-01-02",
    });

    // Die Belege, die der Weg zurückgibt — hier noch einmal ausdrücklich, damit ein Mensch sie
    // in der Rückgabe wiederfindet und nicht im Ablauf suchen muss.
    expect(befund.zeileNachAnlage.wert).toContain("befristet bis");
    expect(befund.zeileNachAnlage.wert).toContain(befund.erwarteteAnzeige);
    expect(befund.nachbarWert).not.toContain("befristet bis");
    expect([401, 403]).toContain(befund.gesperrterAbruf.status);
    expect(befund.gesperrterAbruf.rumpf).not.toContain(TITEL);
    // Jedes Bedienelement des Weges wurde per Tab erreicht — eine Null wäre ein nie gegangener
    // Weg, und `tastaturAusloesen` hätte vorher geworfen.
    for (const [was, schritte] of Object.entries(befund.tastatur)) {
      expect(schritte, `${was} wurde nicht per Tab erreicht`).toBeGreaterThan(0);
    }
    // DIE SOLLLISTE IST DAS INVENTAR DES TASTATURWEGES. Sie steht hier und nicht in `browserweg.ts`,
    // damit eine Station nicht still verschwinden kann: wer sie dort herausnimmt, muss sie hier
    // austragen und dabei erklären, warum. RUNDE 3: die vier Anmeldemasken und das Namensfeld sind
    // dazugekommen — bis dahin wurden E-Mail-Feld und Namensfeld ANGEKLICKT, und genau daran ist
    // BENs Mutation `tabIndex={-1}` am Namensfeld unbemerkt vorbeigegangen.
    expect(
      Object.keys(befund.tastatur).sort(),
      "die Tastaturstationen des Weges sind nicht vollständig",
    ).toEqual(
      [
        "anlegen",
        "anmeldungAdmin_email",
        "anmeldungAdmin_passwort",
        "anmeldungGastNachAblauf_email",
        "anmeldungGastNachAblauf_passwort",
        "anmeldungGastVerlaengert_email",
        "anmeldungGastVerlaengert_passwort",
        "anmeldungGast_email",
        "anmeldungGast_passwort",
        "befristungOeffnen",
        "datumsfeldAnlage",
        "datumsfeld_beenden",
        "datumsfeld_verlaengern",
        "fristBeenden",
        "fristVerlaengern",
        "namensfeld",
        "rollenauswahl",
        "speichern_beenden",
        "speichern_verlaengern",
        "zeileOeffnen",
      ].sort(),
    );
  }, 600_000);

  it("C2 — Gegenprobe: mit falschem Passwort bleibt der Arbeitsweg unerreichbar", async () => {
    const { browser: b, strecke: s } = zeug();
    const { kontext, seite } = await profil(b);
    try {
      await seite.goto(`${s.basis}/`, { waitUntil: "domcontentloaded" });
      await warte(seite, `() => !!document.querySelector("#auth-email")`, "Anmeldemaske");
      await seite.fill("#auth-email", GAST_EMAIL);
      await seite.fill("#auth-password", `${PASSWORT}-falsch`);
      await seite.keyboard.press("Enter");
      await warte(
        seite,
        "(t) => document.body.innerText.includes(t)",
        "die Maske sagt, dass die Angaben nicht stimmen",
        "E-Mail oder Passwort falsch.",
      );
      expect(
        (await kontext.cookies()).some((k) => k.name === "kw_session"),
        "eine gescheiterte Anmeldung setzt keinen Keks",
      ).toBe(false);

      await seite.goto(`${s.basis}/bibliothek`, { waitUntil: "domcontentloaded" });
      await warte(
        seite,
        `() => !!document.querySelector("#auth-email")`,
        "der Arbeitsweg führt zurück auf die Maske",
      );
      expect(
        await seite.evaluate<string>(fn(LIES_TEXT)),
        "kein geschützter Inhalt auf der Seite",
      ).not.toContain(TITEL);
    } finally {
      await kontext.close();
    }
  }, 240_000);

  it("C3 — ein sehr langer Name bricht die Zeile der Kontenliste bei 390 px nicht auf", async () => {
    const { browser: b, strecke: s } = zeug();
    // Das Konto entsteht über die echte Route — die Kante ist hier die ANZEIGE, nicht das
    // Anlegen; das misst C1.
    const angelegt = await adminApi.sende("POST", "/api/users", {
      name: LANGER_NAME,
      email: "langer.name@gastweg-4223.test",
      password: PASSWORT,
      role: "viewer",
    });
    expect(angelegt.status, angelegt.text).toBe(201);

    const { kontext, seite } = await profil(b, SCHMAL);
    try {
      await seite.goto(`${s.basis}/`, { waitUntil: "domcontentloaded" });
      await warte(seite, `() => !!document.querySelector("#auth-email")`, "Anmeldemaske");
      await seite.fill("#auth-email", ADMIN);
      await seite.fill("#auth-password", PASSWORT);
      await seite.keyboard.press("Enter");
      await warte(seite, `() => !document.querySelector("#auth-email")`, "Anmeldung des Admins");
      await seite.goto(`${s.basis}/admin?bereich=konten`, { waitUntil: "domcontentloaded" });
      await warte(
        seite,
        `(n) => [...document.querySelectorAll('[data-einst="zeile"]')].some((z) => (z.textContent || "").includes(n))`,
        "die Kontenliste führt den langen Namen",
        LANGER_NAME,
        45_000,
      );

      const befund = await seite.evaluate<Zeilenbefund | null>(
        fn(`(n) => {
            const z = [...document.querySelectorAll('[data-einst="zeile"]')].find((e) => (e.textContent || "").includes(n));
            if (!z) return null;
            const wert = z.querySelector('[data-einst="wert"]');
            const label = z.querySelector('[data-einst="label"]');
            const zr = z.getBoundingClientRect();
            const lr = label ? label.getBoundingClientRect() : zr;
            return {
              wert: (wert ? wert.textContent : "") || "",
              zeileUeberlauf: z.scrollWidth - z.clientWidth,
              seiteUeberlauf: document.documentElement.scrollWidth - document.documentElement.clientWidth,
              labelRechts: Math.round(lr.right),
              zeileRechts: Math.round(zr.right),
            };
          }`),
        LANGER_NAME,
      );
      expect(befund, "die Zeile ist da").not.toBeNull();
      const b2 = befund as Zeilenbefund;
      expect(b2.zeileUeberlauf, "die Zeile läuft über").toBeLessThanOrEqual(0);
      expect(
        b2.seiteUeberlauf,
        "die Seite bekommt einen waagerechten Überlauf",
      ).toBeLessThanOrEqual(0);
      expect(b2.labelRechts, "der Name läuft aus seiner Zeile heraus").toBeLessThanOrEqual(
        b2.zeileRechts + 1,
      );
    } finally {
      await kontext.close();
    }
  }, 240_000);
});
