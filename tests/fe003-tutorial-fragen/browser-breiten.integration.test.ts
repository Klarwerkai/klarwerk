// ================================================================================================
// FE-003 · E1/E5/E6/E7 IM ECHTEN CHROMIUM — gegen den laufenden Kandidaten, 1280/1024/390 px.
// ================================================================================================
//
// Gegen DENSELBEN Server wie `vorschau-weg.integration.test.ts` (Prüfstand in `kandidat.ts`; vor dem
// ersten Fall wird er hart zugeordnet: Commit, Version, KI aus). Je Breite entsteht eine JSON-
// Belegdatei mit Browserversion, Rolle, URL, Commit und Breite samt den Messwerten, dazu ein
// technisches Prüfbild der gerenderten Oberfläche. Beides ist PRÜFARTEFAKT unter
// `.local/run/fe003-belege/<commit>/` (oder `FE003_BELEGORDNER`) — KEIN Tutorial-Inhalt.
//
// Hart geprüft, je Breite:
//   E1  Knopf „Tutorial“ direkt unter dem Kopfband, links unter dem Schriftzug, andere
//       Hintergrundfarbe als das Kopfband.
//   E6  Titel und Lernziel nicht zusammengedrückt (Mindestbreite unten begründet); kein
//       waagerechtes Überlaufen; Steuerung im Bild.
//   E6  Tastatur: Shift+Tab vom echten Fragefeld erreicht den Knopf, Enter öffnet, Tab erreicht
//       „Weiter“, Shift+Tab geht zurück, Enter schaltet weiter, Escape schliesst, der Fokus steht
//       wieder auf dem Knopf — jede Station der Steuerung mit SICHTBAREM Fokus (Umriss/Unterstrich).
//   E6  Quellenblatt: geöffnet über „…“ → „Mehr …“ UND über die Teilliste, je mit beiden Rückwahlen
//       („Chip“, „…“): das Blatt schliesst, das gewählte Ziel ist hervorgehoben, liegt unter keinem
//       `inert` und nimmt einen echten Klick an.
//   E5  Eine vorbefüllte echte Frage bleibt beim Öffnen, Durchlaufen, Schliessen und beim Übergang
//       „Eigene Frage stellen“ stehen; ab dem Öffnen geht keine verändernde Anfrage hinaus.
// Dazu einmal: reduzierte Bewegung, eine vorhandene Antwort bleibt stehen, andere Seiten ohne Knopf.
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { type Browser, type BrowserContext, type Page, type Request, chromium } from "playwright";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";
import {
  type Befund,
  type Kandidat,
  WURZEL,
  erwarteterStand,
  kandidatBereitstellen,
  pruefeKandidat,
} from "./kandidat";

const BREITEN = [
  { name: "Desktop 1280", width: 1280, height: 800 },
  { name: "Laptop 1024", width: 1024, height: 768 },
  { name: "schmal 390", width: 390, height: 844 },
] as const;

const SCHRITTE = 7;
const BEISPIELFRAGE = "Wie viele Homeoffice-Tage sind erlaubt?";
const ECHTE_FRAGE = "Meine echte Frage aus der FE-003-Prüfung";

// Das Konto dieser Prüfung. Auf einem frisch gestarteten In-Memory-Kandidaten entsteht es in der
// Ersteinrichtung und ist damit Admin (erstes Konto); die Rolle wird trotzdem gemessen, nicht
// angenommen. Wegwerfdaten eines Prüfservers — kein Geheimnis.
const KONTO = {
  name: "FE-003 Prüfung",
  mail: "fe003-pruefung@klarwerk.test",
  passwort: "fe003-Pruefung-1",
};

/**
 * DIE MINDESTBREITE VON TITEL UND LERNZIEL — hergeleitet, nicht getippt.
 *
 * Befund (Berater, Kandidat 3486671c): bei 390×844 bekam die Textspalte 62,7 px, der Titel brach
 * fast Wort für Wort um. Die Spalte hat seit Lauf 2 die Grundbreite 16 rem (`flex-[1_1_16rem]` in
 * `TutorialBereich.tsx`): reicht der Platz daneben nicht, rücken die Knöpfe darunter. Gefordert ist
 * deshalb: die Spalte bekommt ihre Grundbreite (256 px) — oder, wo der Bereich dafür zu schmal ist,
 * mindestens 70 % seiner INHALTSBREITE (Breite ohne Rand und Innenabstand, im Browser gemessen).
 * Bei 390 px sind das rund 0,7 × 320 ≈ 225 px, das Dreieinhalbfache des Befunds. Zusätzlich darf die
 * so abgeleitete Grenze selbst nie unter 150 px fallen — sonst wäre schon der Bereich zu schmal, und
 * auch das ist rot.
 */
const GRUNDBREITE_PX = 256;
const ANTEIL_INHALTSBREITE = 0.7;
const UNTERGRENZE_PX = 150;
const BEFUND_PX = 62.703125;

const BELEGORDNER =
  process.env.FE003_BELEGORDNER ??
  join(WURZEL, ".local/run/fe003-belege", erwarteterStand().commit.slice(0, 12));

let kandidat: Kandidat | undefined;
let befund: Befund;
let browser: Browser | undefined;
let anmeldung: Awaited<ReturnType<BrowserContext["storageState"]>>;
let rolle = "unbekannt";

function url(pfad: string): string {
  if (!kandidat) {
    throw new Error("kein Kandidat");
  }
  return `${kandidat.url}${pfad}`;
}

function veraendernd(anfragen: Request[]): string[] {
  return anfragen
    .filter((r) => r.url().includes("/api/") && !["GET", "HEAD", "OPTIONS"].includes(r.method()))
    .map((r) => `${r.method()} ${new URL(r.url()).pathname}`);
}

/**
 * Code, der IM BROWSER läuft, steht als Zeichenkette: der Wurzel-Typprüfer ist Node-rein
 * (`tsconfig.json`: `lib: ["ES2022"]`), und `/// <reference lib="dom" />` verschöbe die Typen des
 * Produktcodes (Begründung in `tests/app/ka2-vertrag-bestandsblick.test.ts`).
 */
function imBrowser<T>(page: Page, ausdruck: string): Promise<T> {
  return page.evaluate(ausdruck) as Promise<T>;
}

async function kontext(
  viewport: { width: number; height: number },
  extra: Record<string, unknown> = {},
): Promise<{ ktx: BrowserContext; page: Page }> {
  if (!browser) {
    throw new Error("kein Browser");
  }
  const ktx = await browser.newContext({
    viewport,
    locale: "de-DE",
    storageState: anmeldung,
    ...extra,
  });
  await ktx.addInitScript(`try { localStorage.setItem("kw.sprache", "de"); } catch (e) {}`);
  return { ktx, page: await ktx.newPage() };
}

async function oeffneFragen(page: Page): Promise<void> {
  await page.goto(url("/fragen"));
  await page.getByTestId("page-fragen").waitFor({ state: "visible", timeout: 20_000 });
}

function echtesFeld(page: Page) {
  return page.getByTestId("page-fragen").locator('input[data-tutorial-ziel="fragen.fragefeld"]');
}

interface Fokus {
  testid: string | null;
  tag: string;
  text: string;
  imBereich: boolean;
  inDemo: boolean;
  sichtbar: boolean;
}

/**
 * Wer den Fokus hat — und ob man es sieht: das Element gilt dem Browser als `:focus-visible` UND
 * trägt einen Fokusstil — Umriss (`focus-visible:outline` der Tutorial-Knöpfe), Unterstrich (die
 * Überschrift) oder den globalen Ring (`*:focus-visible` in `index.css`, ein `box-shadow`).
 */
function fokus(page: Page): Promise<Fokus> {
  return imBrowser<Fokus>(
    page,
    `(() => {
      const el = document.activeElement;
      if (!el || el === document.body) {
        return { testid: null, tag: "body", text: "", imBereich: false, inDemo: false, sichtbar: false };
      }
      const s = getComputedStyle(el);
      const umriss = s.outlineStyle !== "none" && Number.parseFloat(s.outlineWidth) > 0;
      const unterstrich = s.textDecorationLine.includes("underline");
      const ring = s.boxShadow !== "none";
      return {
        testid: el.getAttribute("data-testid"),
        tag: el.tagName.toLowerCase(),
        text: (el.textContent || "").trim().slice(0, 60),
        imBereich: el.closest('[data-testid="tutorial-bereich"]') !== null,
        inDemo: el.closest("[data-tutorial-demo]") !== null,
        sichtbar: el.matches(":focus-visible") && (umriss || unterstrich || ring),
      };
    })()`,
  );
}

async function keinWaagerechterUeberlauf(page: Page, wann: string): Promise<void> {
  const b = await imBrowser<{
    scroll: number;
    breite: number;
    bereich: { scroll: number; client: number } | null;
  }>(
    page,
    `(() => {
      const el = document.querySelector('[data-testid="tutorial-bereich"]');
      return {
        scroll: document.documentElement.scrollWidth,
        breite: window.innerWidth,
        bereich: el ? { scroll: el.scrollWidth, client: el.clientWidth } : null,
      };
    })()`,
  );
  expect(b.scroll, `${wann}: die Seite läuft waagerecht über`).toBeLessThanOrEqual(b.breite + 1);
  if (b.bereich) {
    expect(b.bereich.scroll, `${wann}: der Tutorial-Bereich läuft über`).toBeLessThanOrEqual(
      b.bereich.client + 1,
    );
  }
}

async function imBild(page: Page, testId: string, wann: string): Promise<void> {
  const box = await page.getByTestId(testId).first().boundingBox();
  const breite = page.viewportSize()?.width ?? 0;
  expect(box, `${wann}: ${testId} nicht gerendert`).not.toBeNull();
  if (box) {
    expect(box.x, `${wann}: ${testId} links abgeschnitten`).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width, `${wann}: ${testId} rechts abgeschnitten`).toBeLessThanOrEqual(
      breite + 1,
    );
  }
}

async function kapitel(page: Page, schritt: string): Promise<void> {
  await page.locator(`[data-testid="tutorial-kapitel"][data-schritt="${schritt}"]`).click();
}

function demoBlatt(page: Page) {
  return page.getByTestId("tutorial-demo-mehr");
}

beforeAll(async () => {
  kandidat = await kandidatBereitstellen(inject("fe003KandidatUrl"));
  befund = await pruefeKandidat(kandidat.url, erwarteterStand());
  mkdirSync(BELEGORDNER, { recursive: true });
  browser = await chromium.launch({ headless: true, args: ["--no-sandbox", "--disable-gpu"] });
  // Einmal anmelden (Ersteinrichtung oder Anmeldung), dann den Zustand für jede Breite mitnehmen.
  const ktx = await browser.newContext({ viewport: { width: 1280, height: 800 }, locale: "de-DE" });
  const page = await ktx.newPage();
  await page.goto(url("/"));
  const pw = page.locator('input[type="password"]');
  await pw.first().or(page.getByTestId("kopfband")).waitFor({ state: "visible", timeout: 20_000 });
  if (await pw.count()) {
    const name = page.locator('form input:not([type="email"]):not([type="password"])');
    if (await name.count()) {
      await name.first().fill(KONTO.name);
    }
    await page.locator('input[type="email"]').fill(KONTO.mail);
    for (let i = 0; i < (await pw.count()); i++) {
      await pw.nth(i).fill(KONTO.passwort);
    }
    await page.locator('button[type="submit"]').click();
  }
  await page.getByTestId("kopfband").waitFor({ state: "visible", timeout: 20_000 });
  const ich = await imBrowser<{ role?: string }>(
    page,
    `fetch("/api/auth/me").then((r) => r.json())`,
  );
  rolle = ich.role ?? "unbekannt";
  anmeldung = await ktx.storageState();
  await ktx.close();
}, 900_000);

afterAll(async () => {
  await browser?.close();
  if (kandidat?.selbstGestartet) {
    expect(await kandidat.beenden(), "der selbst gestartete Server ist beendet").toBe(true);
  }
});

describe("FE-003 im echten Chromium — je Breite", () => {
  for (const b of BREITEN) {
    it(`${b.name}: Knopf, Lesbarkeit, Tastatur, Quellenblatt, keine Mutation`, async () => {
      const { ktx, page } = await kontext({ width: b.width, height: b.height });
      try {
        await oeffneFragen(page);

        // --- E1 · Lage und Farbe des Knopfs -----------------------------------------------------
        const knopf = page.getByTestId("tutorial-knopf");
        expect((await knopf.textContent())?.trim()).toBe("Tutorial");
        const kopfBox = await page.getByTestId("kopfband").boundingBox();
        const knopfBox = await knopf.boundingBox();
        const markeBox = await page.locator(".kw-kopfband-marke").first().boundingBox();
        if (!kopfBox || !knopfBox || !markeBox) {
          throw new Error(`${b.name}: Kopfband, Schriftzug oder Knopf nicht gerendert`);
        }
        const unterkante = kopfBox.y + kopfBox.height;
        expect(knopfBox.y, "Knopf unter dem Kopfband").toBeGreaterThanOrEqual(unterkante - 1);
        expect(knopfBox.y - unterkante, "Knopf direkt unter dem Kopfband").toBeLessThan(24);
        expect(knopfBox.x, "Knopf nicht rechts vom Schriftzug").toBeLessThanOrEqual(markeBox.x + 4);
        if (b.width >= 900) {
          expect(
            Math.abs(knopfBox.x - markeBox.x),
            "bündig unter dem Schriftzug",
          ).toBeLessThanOrEqual(8);
        }
        const farben = await imBrowser<{ kopf: string; knopf: string }>(
          page,
          `(() => {
            const bg = (sel) => getComputedStyle(document.querySelector(sel)).backgroundColor;
            return { kopf: bg('[data-testid="kopfband"]'), knopf: bg('[data-testid="tutorial-knopf"]') };
          })()`,
        );
        expect(farben.knopf, "Knopf farblich vom Kopfband abgesetzt").not.toBe(farben.kopf);

        // --- E5 · eine echte, nicht gesendete Frage; Netz ab jetzt beobachtet ---------------------
        await echtesFeld(page).fill(ECHTE_FRAGE);
        // KI aus auf der echten Seite: trotz Frage im Feld ist Absenden gesperrt (leer wäre es das
        // ohnehin), und die echten Alternativen stehen da.
        await expect
          .poll(() => page.getByTestId("page-fragen").locator('button[type="submit"]').isDisabled())
          .toBe(true);
        expect(
          await page
            .getByTestId("page-fragen")
            .getByTestId("ask-ai-alternative")
            .first()
            .isVisible(),
        ).toBe(true);
        const anfragen: Request[] = [];
        page.on("request", (r) => anfragen.push(r));

        // --- E6 · Tastatur: Shift+Tab vom Feld bis zum Knopf, Enter öffnet ----------------------
        await echtesFeld(page).focus();
        let bisKnopf = 0;
        for (; bisKnopf < 80; bisKnopf++) {
          if ((await fokus(page)).testid === "tutorial-knopf") {
            break;
          }
          await page.keyboard.press("Shift+Tab");
        }
        const aufKnopf = await fokus(page);
        expect(aufKnopf.testid, "Shift+Tab erreicht den Knopf „Tutorial“").toBe("tutorial-knopf");
        expect(aufKnopf.sichtbar, "sichtbarer Fokus auf dem Knopf").toBe(true);
        await page.keyboard.press("Enter");
        const bereich = page.getByTestId("tutorial-bereich");
        await bereich.waitFor({ state: "visible" });
        expect(await knopf.getAttribute("aria-expanded")).toBe("true");
        const aufTitel = await fokus(page);
        expect(aufTitel.tag, "Öffnen fokussiert die Überschrift").toBe("h2");
        expect(aufTitel.text).toBe("Tutorial: Fragen");
        expect(aufTitel.sichtbar, "sichtbarer Fokus auf der Überschrift").toBe(true);
        await page
          .getByTestId("tutorial-demo")
          .locator("[data-tutorial-ziel]")
          .first()
          .waitFor({ state: "visible", timeout: 15_000 });

        // Tab bis „Weiter“: jede Station der Steuerung (ausserhalb der Demo) sichtbar fokussiert.
        const stationen: Fokus[] = [];
        for (let i = 0; i < 60; i++) {
          await page.keyboard.press("Tab");
          const f = await fokus(page);
          stationen.push(f);
          expect(f.imBereich, `Tab verlässt den Bereich vor „Weiter“ (${JSON.stringify(f)})`).toBe(
            true,
          );
          if (!f.inDemo) {
            expect(f.sichtbar, `kein sichtbarer Fokus auf ${JSON.stringify(f)}`).toBe(true);
          }
          if (f.testid === "tutorial-weiter") {
            break;
          }
        }
        expect(stationen.at(-1)?.testid, "Tab erreicht „Weiter“").toBe("tutorial-weiter");
        await page.keyboard.press("Shift+Tab");
        const zurueck = await fokus(page);
        expect(
          zurueck.imBereich && zurueck.sichtbar,
          "Shift+Tab bleibt sichtbar in der Steuerung",
        ).toBe(true);
        await page.keyboard.press("Tab");
        expect((await fokus(page)).testid).toBe("tutorial-weiter");
        await page.keyboard.press("Enter");
        await expect
          .poll(() => page.getByTestId("tutorial-fortschritt").textContent())
          .toContain(`Schritt 2 von ${SCHRITTE}`);

        // --- E6 · Titel und Lernziel lesbar, nichts läuft über, Steuerung im Bild -----------------
        const kopf = await imBrowser<{
          innen: number;
          spalte: number;
          titel: number;
          lernziel: number;
        }>(
          page,
          `(() => {
            const r = (sel) => document.querySelector(sel).getBoundingClientRect().width;
            const bereichEl = document.querySelector('[data-testid="tutorial-bereich"]');
            const s = getComputedStyle(bereichEl);
            return {
              innen:
                bereichEl.clientWidth -
                Number.parseFloat(s.paddingLeft) -
                Number.parseFloat(s.paddingRight),
              spalte: r('[data-testid="tutorial-kopftext"]'),
              titel: r('[data-testid="tutorial-bereich"] h2'),
              lernziel: r('[data-testid="tutorial-lernziel"]'),
            };
          })()`,
        );
        const mindest = Math.min(GRUNDBREITE_PX, ANTEIL_INHALTSBREITE * kopf.innen);
        expect(mindest, `${b.name}: der Bereich selbst ist zu schmal`).toBeGreaterThanOrEqual(
          UNTERGRENZE_PX,
        );
        expect(mindest).toBeGreaterThan(2 * BEFUND_PX);
        expect(kopf.spalte, `${b.name}: Titel/Lernziel-Spalte`).toBeGreaterThanOrEqual(mindest);
        expect(kopf.titel, `${b.name}: Titel „Tutorial: Fragen“`).toBeGreaterThanOrEqual(mindest);
        expect(kopf.lernziel, `${b.name}: Lernziel`).toBeGreaterThanOrEqual(mindest);
        await keinWaagerechterUeberlauf(page, `${b.name}, geöffnet`);
        for (const id of [
          "tutorial-zurueck",
          "tutorial-weiter",
          "tutorial-abspielen",
          "tutorial-wiederholen",
          "tutorial-schliessen",
          "tutorial-demo",
        ]) {
          await imBild(page, id, b.name);
        }
        await page.screenshot({ path: join(BELEGORDNER, `pruefbild-${b.width}-geoeffnet.png`) });

        // --- E6 · Quellenblatt: zwei Öffnungswege × zwei Rückwahlen -------------------------------
        const quellenwege: Record<string, unknown>[] = [];
        for (const weg of ["menue", "teilliste"] as const) {
          for (const [rueckwahl, ziel] of [
            [0, "fragen.quellenchip"],
            [1, "fragen.menue"],
          ] as const) {
            await kapitel(page, "quelle");
            if (weg === "menue") {
              await page.getByTestId("tutorial-demo-menue").click();
              await page.getByTestId("tutorial-demo-menue-punkt-mehr").click();
            } else {
              await page.getByTestId("tutorial-teil").nth(2).click();
            }
            await demoBlatt(page).waitFor({ state: "visible" });
            await imBild(page, "tutorial-demo-mehr", `${b.name}, Blatt über ${weg}`);
            // Ein Knopf unter `inert` nimmt keinen Klick an — Playwright liefe hier in die Frist.
            await demoBlatt(page).getByTestId("tutorial-teil-blatt").nth(rueckwahl).click();
            await demoBlatt(page).waitFor({ state: "detached" });
            const zielSelektor = `[data-testid="tutorial-demo"] [data-tutorial-ziel="${ziel}"][data-tutorial-aktiv="true"]`;
            await page.locator(zielSelektor).first().waitFor({ state: "visible" });
            const gesperrt = await imBrowser<boolean>(
              page,
              `document.querySelector(${JSON.stringify(zielSelektor)}).closest("[inert]") !== null`,
            );
            expect(gesperrt, `${weg} → Rückwahl ${rueckwahl + 1}: Ziel unter inert`).toBe(false);
            expect(
              await page.getByTestId("tutorial-teil").nth(rueckwahl).getAttribute("aria-current"),
            ).toBe("step");
            // Das Ziel nimmt einen echten Klick an.
            if (ziel === "fragen.quellenchip") {
              const chip = page.getByTestId("tutorial-demo-chip");
              await chip.click();
              expect(await chip.getAttribute("aria-expanded")).toBe("true");
              await chip.click();
              expect(await chip.getAttribute("aria-expanded")).toBe("false");
            } else {
              const menue = page.getByTestId("tutorial-demo-menue");
              await menue.click();
              await page
                .getByTestId("tutorial-demo-menue-punkt-mehr")
                .waitFor({ state: "visible" });
              await page.keyboard.press("Escape");
              await page
                .getByTestId("tutorial-demo-menue-punkt-mehr")
                .waitFor({ state: "detached" });
            }
            expect(await bereich.isVisible(), "das Tutorial bleibt offen").toBe(true);
            quellenwege.push({ weg, rueckwahl: rueckwahl + 1, ziel, gesperrt });
          }
        }

        // --- E2/E6 · alle Schritte, keine fehlenden Ziele -----------------------------------------
        await kapitel(page, "verstehen");
        for (let nr = 1; nr < SCHRITTE; nr++) {
          await page.getByTestId("tutorial-weiter").click();
          await expect
            .poll(() => page.getByTestId("tutorial-fortschritt").textContent())
            .toContain(`Schritt ${nr + 1} von ${SCHRITTE}`);
          expect(await page.locator("[data-tutorial-ziel-fehlt]").count()).toBe(0);
          await keinWaagerechterUeberlauf(page, `${b.name}, Schritt ${nr + 1}`);
        }
        const demoFeld = page.getByTestId("tutorial-demo").locator("input");
        await demoFeld.fill("Meine Übungsfrage");
        await demoFeld.press("Enter");
        await page
          .getByTestId("tutorial-demo")
          .getByText("Übungsantwort")
          .first()
          .waitFor({ state: "visible", timeout: 10_000 });
        // Ohne Modell sagt der Übergang das ehrlich, samt nutzbarer Alternative.
        expect(await page.getByTestId("tutorial-uebergang-ki-aus").isVisible()).toBe(true);

        // --- E5 · Übergang „Eigene Frage stellen“: Fokus ins echte Feld, Frage steht, nichts gesendet
        await page.getByTestId("tutorial-eigene-frage").click();
        await bereich.waitFor({ state: "detached" });
        expect(
          await imBrowser<boolean>(
            page,
            `document.activeElement === document.querySelector('[data-testid="page-fragen"] input[data-tutorial-ziel="fragen.fragefeld"]')`,
          ),
          "Fokus im echten Fragefeld",
        ).toBe(true);
        expect(await echtesFeld(page).inputValue()).toBe(ECHTE_FRAGE);

        // --- E6 · Escape schliesst, Fokus zurück zum Knopf, die Seite bleibt bedienbar -----------
        await knopf.focus();
        await page.keyboard.press("Enter");
        await bereich.waitFor({ state: "visible" });
        await page.keyboard.press("Escape");
        await bereich.waitFor({ state: "detached" });
        const nachEscape = await fokus(page);
        expect(nachEscape.testid, "Fokus zurück auf „Tutorial“").toBe("tutorial-knopf");
        expect(nachEscape.sichtbar).toBe(true);
        expect(await echtesFeld(page).inputValue()).toBe(ECHTE_FRAGE);
        await echtesFeld(page).fill(`${ECHTE_FRAGE}, ergänzt`);
        expect(await echtesFeld(page).inputValue()).toBe(`${ECHTE_FRAGE}, ergänzt`);

        await page.waitForTimeout(500);
        const mutationen = veraendernd(anfragen);
        expect(mutationen, "das Tutorial hat etwas verändert oder gesendet").toEqual([]);

        writeFileSync(
          join(BELEGORDNER, `beleg-${b.width}.json`),
          `${JSON.stringify(
            {
              kriterien: ["E1", "E5", "E6"],
              browser: { name: "chromium", version: browser?.version() },
              rolle,
              url: url("/fragen"),
              kandidat: {
                commit: befund.health.commit,
                version: befund.health.version,
                ki: befund.ki,
              },
              breite: { name: b.name, width: b.width, height: b.height },
              knopf: {
                box: knopfBox,
                kopfbandUnterkante: unterkante,
                schriftzug: markeBox,
                farben,
              },
              kopf: { ...kopf, mindest, befundPx: BEFUND_PX },
              tastatur: { shiftTabBisKnopf: bisKnopf, stationen, nachEscape },
              quellenwege,
              veraenderndeAnfragen: mutationen,
              anfragenGesamt: anfragen.length,
              pruefbild: `pruefbild-${b.width}-geoeffnet.png (technischer Prüfbeleg, kein Tutorial-Inhalt)`,
              zeit: new Date().toISOString(),
            },
            null,
            2,
          )}\n`,
        );
      } finally {
        await ktx.close();
      }
    });
  }
});

describe("FE-003 im echten Chromium — einmalige Fälle", () => {
  it("E6 · reduzierte Bewegung: die Beispielfrage steht sofort da, kein Aufleuchten", async () => {
    const { ktx, page } = await kontext({ width: 1280, height: 800 }, { reducedMotion: "reduce" });
    try {
      await oeffneFragen(page);
      await page.getByTestId("tutorial-knopf").click();
      await kapitel(page, "formulieren");
      expect(await page.getByTestId("tutorial-demo").locator("input").inputValue()).toBe(
        BEISPIELFRAGE,
      );
      expect(await page.getByTestId("tutorial-reduziert").isVisible()).toBe(true);
      const animation = await imBrowser<string>(
        page,
        `(() => {
          const el = document.querySelector('[data-tutorial-aktiv="true"]');
          return el ? getComputedStyle(el).animationName : "kein-ziel";
        })()`,
      );
      expect(animation).toBe("none");
    } finally {
      await ktx.close();
    }
  });

  // Der Kandidat läuft bewusst OHNE Modell; eine echte Antwort kann er nicht erzeugen. Für diesen
  // Fall beantwortet der BROWSER die eine Frage vorab selbst (`route.fulfill`, erreicht den Server
  // nie) und meldet dafür ein Modell. Gemessen wird danach nur, was das Tutorial mit der
  // vorhandenen Antwort tut — und dass ab dem Öffnen nichts mehr hinausgeht.
  it("E1/E5 · eine vorhandene Frage und Antwort überstehen Öffnen, Durchlaufen und Schliessen", async () => {
    const { ktx, page } = await kontext({ width: 1280, height: 800 });
    try {
      let fragen = 0;
      await page.route("**/api/reasoner/status", (route) =>
        route.fulfill({
          json: { active: true, mode: "local", reachable: "active", tasks: { answer: true } },
        }),
      );
      await page.route("**/api/ask", (route) => {
        fragen += 1;
        return route.fulfill({
          json: {
            result: {
              answered: true,
              answer: "Reisen werden vorab von der Leitung genehmigt.",
              knowledgeClass: "gesichert",
              trust: 80,
              sources: [],
              citedSources: [],
              steps: [],
              demo: false,
              captionSources: [],
            },
            gap: null,
            receipt: "fe003-pruefung",
          },
        });
      });
      await oeffneFragen(page);
      await echtesFeld(page).fill("Wie werden Reisen genehmigt?");
      await page.getByTestId("page-fragen").locator('button[type="submit"]').click();
      const antwort = page.getByTestId("ask-answer");
      await antwort.waitFor({ state: "visible", timeout: 15_000 });
      const antwortText = await antwort.textContent();
      expect(antwortText).toContain("Reisen werden vorab");
      expect(fragen).toBe(1);

      const anfragen: Request[] = [];
      page.on("request", (r) => anfragen.push(r));
      await page.getByTestId("tutorial-knopf").click();
      await page.getByTestId("tutorial-bereich").waitFor({ state: "visible" });
      for (let nr = 1; nr < SCHRITTE; nr++) {
        await page.getByTestId("tutorial-weiter").click();
      }
      await page.getByTestId("tutorial-schliessen").click();
      await page.getByTestId("tutorial-bereich").waitFor({ state: "detached" });
      expect(await antwort.textContent(), "die Antwort steht unverändert").toBe(antwortText);
      expect(await echtesFeld(page).inputValue()).toBe("Wie werden Reisen genehmigt?");
      await page.waitForTimeout(500);
      expect(veraendernd(anfragen)).toEqual([]);
      expect(fragen, "keine weitere Frage").toBe(1);
    } finally {
      await ktx.close();
    }
  });

  it("E7 · andere Seiten tragen kein Tutorial", async () => {
    const { ktx, page } = await kontext({ width: 1280, height: 800 });
    try {
      for (const pfad of ["/start", "/bibliothek"]) {
        await page.goto(url(pfad));
        await page.getByTestId("kopfband").waitFor({ state: "visible" });
        await page.waitForTimeout(300);
        expect(await page.getByTestId("tutorial-knopf").count(), pfad).toBe(0);
        expect(await page.getByTestId("tutorial-bereich").count(), pfad).toBe(0);
      }
    } finally {
      await ktx.close();
    }
  });
});
