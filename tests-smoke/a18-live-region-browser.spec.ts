// ================================================================================================
// JOB 918 D4 — DIE ANSAGEFLÄCHE, AM AX-BAUM DES BROWSERS GEMESSEN.
// ================================================================================================
//
// WAS DIESE DATEI SCHLIESST. Drei Durchgänge lang hat JOB 918 die Ansageflächen des Produkts nur
// von aussen beschrieben: Attribute im Quelltext (E1), Rolle und Name aus Playwrights eigener
// Rechnung (E2.5). Die Live-Eigenschaft — `aria-live`, `aria-atomic`, `aria-relevant` — galt als
// unmessbar, und D3 hat daraus den Satz gemacht, mit diesem Werkzeugkasten sei der vom Browser
// gerechnete Accessibility-Baum grundsätzlich unerreichbar.
//
// DER SATZ WAR FALSCH, und die Widerlegung steht unten als Kalibrierung A. Playwright ruft die
// Accessibility-Domäne von sich aus nirgends auf — das hatte D3 richtig gemessen. Daraus folgt aber
// nicht, dass die Domäne fehlt: `browserContext.newCDPSession(page)` öffnet eine GENERISCHE
// Chrome-DevTools-Sitzung, und in ihr antwortet `Accessibility.getPartialAXTree` mit genau den
// Feldern, die drei Durchgänge lang als unerreichbar galten. Gemessen an Chromium 149.0.7827.55:
//
//   <output>Text</output>          -> role=status     live="polite"  atomic=true  relevant="additions text"
//   <p>Text</p>                    -> role=paragraph  (keine dieser drei Eigenschaften)
//   <output hidden>Text</output>   -> ignored=true    (gar nicht im Baum)
//
// DIE MESSSPRACHE DIESER DATEI, und sie ist eng gehalten. Gebunden wird ausschliesslich, was das
// Protokoll TATSÄCHLICH ausgibt: `role`, `ignored`, `live`, `atomic`, `relevant`. Das ist die
// Rechnung des Browsers über sein eigenes Dokument.
//
// AUSDRÜCKLICH NICHT ZUGESAGT WIRD, dass irgendeine Vorlesehilfe irgendetwas hörbar ansagt. Zwischen
// „der Browser führt diese Fläche als Statusbereich mit polite-Live-Eigenschaft" und „eine
// Testperson hört den Satz" liegen Screenreader, Sprachausgabe und Betriebssystem — keines davon
// wird hier angefasst. Ein Testname oder eine Fehlermeldung, die mehr behauptet, wäre falsch.
//
// WARUM DIE SONDE IHREN EIGENEN SERVER NICHT BRAUCHT. Die Datei serviert das gebaute Web-Bündel
// (`apps/web/dist`) und die API-Antworten über `page.route`. Das ist kein Ausweichen vor dem
// Produkt: im Browser läuft der ECHTE Client — dasselbe Bündel, dieselbe `ToastViewport`, derselbe
// Weg über die Vordertür. Gefälscht ist allein der Transport. Drei Gründe:
//
//   1. Die Ansage ist ein reines Client-Ereignis. `ToastContext.push` → `ToastViewport` rendert
//      `<output>`; der Server kommt darin nicht vor. Ein echter Server würde an dieser Messung
//      nichts hinzufügen, aber alles daran hängen, dass er startet.
//   2. Die Sonde legt damit NICHTS im geteilten In-Memory-Bestand an. Genau daran ist AUFTRAG-163
//      gescheitert: eine Sonde, die einen Entwurf speichert, kippt `ui-smoke.spec.ts:552` und
//      `mega88-bildanker-browser.spec.ts:134`. Diese hier kann das nicht — ihr `POST /api/drafts`
//      erreicht keinen Bestand.
//   3. Sie ist deterministisch. Kein Wettlauf um die Einmal-Ressource Ersteinrichtung, kein
//      geteilter Anmeldezustand, keine Abhängigkeit von der Dateireihenfolge.
//
// EHRLICHE GRENZE DAZU, und sie bleibt hier stehen: Was diese Datei über den SERVER aussagt, ist
// nichts. Ob `POST /api/drafts` wirklich speichert, prüft `demo-ux-v1-capture-frontdoor.spec.ts` —
// diese Sonde prüft, was der Browser aus dem gerenderten Ergebnis für seinen AX-Baum macht.
//
// CHROMIUM-ONLY, und zwar aus einem Protokollgrund, nicht aus Bequemlichkeit: Das Chrome DevTools
// Protocol gibt es in Firefox und WebKit nicht. `newCDPSession` wirft dort. Der gebundene
// Rohsignalweg dieser Datei ist CDP, also läuft sie in genau einer Engine — sichtbar übersprungen
// statt still weggelassen.
import { existsSync, readFileSync, statSync } from "node:fs";
import { extname, join, relative, resolve } from "node:path";
import { type CDPSession, type Page, expect, test } from "@playwright/test";

// ------------------------------------------------------------------------------------------------
// Das gebaute Bündel. `smoke:ui:frisch` (package.json) stellt vor jedem Smoke-Lauf sicher, dass es
// zum heutigen Quellstand passt; diese Datei prüft nur noch, DASS es da ist — und sagt es laut,
// statt an einer irreführenden Zusicherung zu scheitern.
// ------------------------------------------------------------------------------------------------
const DIST = resolve(process.cwd(), "apps", "web", "dist");

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".map": "application/json; charset=utf-8",
};

// Die Antworten, die die App beim Start und auf dem Entwurfsweg braucht. Alles, was hier NICHT
// steht, wird als leere Liste beantwortet — die Listenendpunkte der Shell vertragen das. Die fünf
// Objektendpunkte vertragen es nicht (sie lesen Felder), deshalb stehen sie einzeln da.
const API: Record<string, unknown> = {
  "GET /api/auth/status": { needsSetup: false, oidcEnabled: false },
  "GET /api/auth/me": {
    id: "a18-sonde",
    name: "A18 Sonde",
    email: "a18@klarwerk.test",
    role: "admin",
  },
  "GET /api/auth/notice": { currentVersion: "1", due: false },
  "GET /api/features": { features: {} },
  "GET /api/reasoner/status": { active: false, provider: "none", mode: "deterministic" },
  "GET /api/reasoner/config": {
    provider: "none",
    configured: false,
    mode: "deterministic",
    fallbackAvailable: true,
    supportsLocales: ["de", "en", "nl"],
    tasks: [],
    taskConfig: { global: "deterministic", perTask: {} },
    effective: {},
    cloudConfigured: false,
    localConfigured: false,
    effectiveProvider: {},
    persisted: false,
  },
  "GET /api/gaps/summary": { open: 0, byPriority: {} },
  "GET /api/external/policy": { stage: "off" },
  // Der Entwurf, den das Erfassungs-Blatt speichert. Sein Erfolg ist der Auslöser des echten Toasts
  // (seit JOB 3062: `components/erfassen/Blatt.tsx`, `save.onSuccess` →
  // `push("success", t("fd.toastSaved"))`; der Toast-Text selbst ist unverändert).
  "POST /api/drafts": {
    id: "a18-entwurf",
    payload: { title: "A18 Sonde" },
    updatedAt: "2026-08-17T06:00:00.000Z",
  },
};

/** Sichtbare Beschriftungen — wörtlich aus `apps/web/src/i18n.ts`, DE-Block. */
const T = {
  entwurfSpeichern: "Entwurf sichern", // erfassen.entwurfSichern (bis JOB 3062: fd.saveDraft)
  entwurfGespeichert: "Entwurf gespeichert.", // fd.toastSaved
} as const;

const VORDERTUER = "/capture/frontdoor";
const EDITOR = '[contenteditable="true"]';
const SATZ = "Ein Satz Erfahrungswissen, damit der Entwurf speicherbar wird.";

// ------------------------------------------------------------------------------------------------
// DER ANKER AUF DEN TOAST — UND WARUM ER BEWUSST NICHT `output` HEISST.
//
// Ein Anker `output` wäre bequem und würde die Aussage dieses Tests zerstören. Unter der
// Gegenmutation (`<output>` → `<p>` in `ToastViewport.tsx`) fände er nichts mehr, der Fall würde mit
// „Element nicht gefunden" rot — und damit über den TAGNAMEN reden statt über das, was der Browser
// aus der Fläche macht. Gemessen werden soll aber die Rolle und die Live-Eigenschaft.
//
// Deshalb hängt der Anker an etwas, das die Mutation NICHT anfasst: am Schliessen-Knopf, den
// `ToastViewport` als direktes Kind in jeden Toast rendert (`aria-label={t("toast.dismiss")}`).
// `:has(> …)` verlangt das direkte Kind, also trifft der Selektor genau das Toast-Element — und
// zwar gleichgültig, ob es `<output>`, `<p>` oder `<div>` ist. Unter der Gegenmutation wird der
// Toast damit GEFUNDEN und fällt an der Rollenzusicherung: `paragraph` statt `status`.
const TOAST = '*:has(> button[aria-label="Schließen"])';

function verlangeBuendel(): void {
  const index = join(DIST, "index.html");
  if (!existsSync(index)) {
    throw new Error(
      [
        `Das gebaute Web-Buendel fehlt: ${index}`,
        "  Diese Sonde serviert den echten Client aus dem Buendel. Ohne Buendel gibt es nichts zu",
        "  messen — und ein uebersprungener Fall waere hier eine stille Luecke.",
        "  Bauen: npm run --silent smoke:ui:frisch   (die Smoke-Befehle tun das ohnehin vorweg)",
      ].join("\n"),
    );
  }
}

/** Löst einen Pfad im Bündel auf; alles Unbekannte fällt auf `index.html` (SPA-Verhalten). */
function dateiImBuendel(pfad: string): string {
  const ziel = resolve(DIST, `.${pfad === "/" ? "/index.html" : pfad}`);
  // Kein Ausbruch aus dem Bündel — diese Sonde liest ausschliesslich gebaute Artefakte.
  const drinnen = !relative(DIST, ziel).startsWith("..");
  if (drinnen && existsSync(ziel) && statSync(ziel).isFile()) {
    return ziel;
  }
  return join(DIST, "index.html");
}

/**
 * Serviert den echten Client ohne Server. `page.route` fängt die Anfrage ab, bevor sie den
 * Netzstapel erreicht — es wird kein Port geöffnet und keine Verbindung aufgebaut.
 */
async function serviereApp(page: Page): Promise<void> {
  verlangeBuendel();
  await page.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.startsWith("/api/")) {
      const schluessel = `${route.request().method()} ${url.pathname}`;
      await route.fulfill({
        status: 200,
        contentType: "application/json; charset=utf-8",
        body: JSON.stringify(schluessel in API ? API[schluessel] : []),
      });
      return;
    }
    const datei = dateiImBuendel(url.pathname);
    await route.fulfill({
      status: 200,
      contentType: MIME[extname(datei)] ?? "application/octet-stream",
      body: readFileSync(datei),
    });
  });
}

// ------------------------------------------------------------------------------------------------
// DER GEBUNDENE ROHSIGNALWEG. Eine Funktion, ein Weg — dieselbe Messung trägt die Fixtures UND den
// echten Toast. Genau darin liegt die Aussagekraft: Rot und Grün unterscheiden sich dann am
// Messobjekt, nicht am Messmittel.
// ------------------------------------------------------------------------------------------------
interface Rohsignal {
  /** Die Rolle, die der BROWSER rechnet — `status`, `paragraph`, `none`, … */
  rolle: string;
  /** `true`, wenn der Knoten gar nicht im Baum geführt wird (versteckte Flächen). */
  ignoriert: boolean;
  /** `aria-live` aus Sicht des Browsers, inklusive impliziter Werte. `null` = nicht ausgegeben. */
  live: string | null;
  atomic: boolean | null;
  relevant: string | null;
}

async function rohsignal(cdp: CDPSession, selektor: string): Promise<Rohsignal> {
  const dokument = await cdp.send("DOM.getDocument", { depth: -1 });
  const treffer = await cdp.send("DOM.querySelector", {
    nodeId: dokument.root.nodeId,
    selector: selektor,
  });
  if (!treffer.nodeId) {
    throw new Error(`Kein DOM-Knoten fuer "${selektor}" — die Messung haette keinen Gegenstand.`);
  }
  const baum = await cdp.send("Accessibility.getPartialAXTree", {
    nodeId: treffer.nodeId,
    fetchRelatives: false,
  });
  const knoten = baum.nodes.at(0);
  if (!knoten) {
    throw new Error(`getPartialAXTree lieferte keinen Knoten fuer "${selektor}".`);
  }
  const werte = new Map<string, unknown>(
    (knoten.properties ?? []).map((p) => [p.name, p.value?.value]),
  );
  const alsText = (name: string): string | null => {
    const v = werte.get(name);
    return typeof v === "string" ? v : null;
  };
  return {
    rolle: typeof knoten.role?.value === "string" ? knoten.role.value : "",
    ignoriert: knoten.ignored === true,
    live: alsText("live"),
    atomic: typeof werte.get("atomic") === "boolean" ? (werte.get("atomic") as boolean) : null,
    relevant: alsText("relevant"),
  };
}

async function sitzung(page: Page): Promise<CDPSession> {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Accessibility.enable");
  return cdp;
}

// ------------------------------------------------------------------------------------------------
// Das CDP ist ein Chromium-Protokoll. In Firefox und WebKit wirft `newCDPSession` — die Datei wird
// dort sichtbar übersprungen, mit Grund im Lauf.
// ------------------------------------------------------------------------------------------------
test.skip(
  ({ browserName }) => browserName !== "chromium",
  "Der gebundene Rohsignalweg ist das Chrome DevTools Protocol; Firefox und WebKit sprechen es nicht.",
);

// ================================================================================================
// KALIBRIERUNG A — DAS MESSMITTEL, BEVOR ES ETWAS BEHAUPTET.
// ================================================================================================
//
// Ohne diesen Fall wären alle folgenden Zusicherungen mehrdeutig: Ein fehlendes `live` könnte
// heissen „der Browser führt keine Live-Eigenschaft" ODER „meine Sitzung gibt sie nicht aus". Hier
// wird an einer Fixture, die die Eigenschaft nachweislich TRÄGT, gezeigt, dass der Weg sie
// transportiert. Erst danach ist ein fehlendes `live` ein Befund.
test("KALIBRIERUNG A · die generische CDP-Sitzung gibt Rolle, Ignoriert und die drei Live-Felder wirklich aus", async ({
  page,
}) => {
  const cdp = await sitzung(page);

  const voll = await cdp.send("Accessibility.getFullAXTree");
  expect(
    voll.nodes.length,
    "Accessibility.getFullAXTree liefert keine Knoten — die Sitzung steht, aber die Domaene antwortet leer",
  ).toBeGreaterThan(0);

  // Eine Fläche, die alle drei Eigenschaften ausdrücklich trägt. Käme hier `null` zurück, wäre der
  // Messweg blind und jede spätere Aussage über fehlende Live-Eigenschaften wertlos.
  await page.setContent(
    '<div id="probe" role="status" aria-live="assertive" aria-atomic="true" aria-relevant="additions">Kalibrierung</div>',
  );
  const gemessen = await rohsignal(cdp, "#probe");

  expect(gemessen.rolle, "die Rolle kommt nicht durch").toBe("status");
  expect(gemessen.live, "aria-live kommt nicht durch — der Messweg ist blind").toBe("assertive");
  expect(gemessen.atomic, "aria-atomic kommt nicht durch").toBe(true);
  expect(gemessen.relevant, "aria-relevant kommt nicht durch").toBe("additions");
  expect(gemessen.ignoriert, "die Fixture wird als ignoriert gefuehrt").toBe(false);
});

// ================================================================================================
// KALIBRIERUNG B — DIE ZWEITE, ANDERE MESSUNG. GETRENNT GEHALTEN.
// ================================================================================================
//
// `ariaSnapshot()` ist NICHT der AX-Baum des Browsers. Playwright rechnet Rolle und Namen selbst,
// im Injected-Script, aus DOM und berechnetem Stil. Beide Messungen nennen dieselbe Fläche
// `status` — aber nur eine von beiden führt die Live-Eigenschaft. Dieser Fall pinnt genau den
// Unterschied, damit die Messsprache der Datei nicht wieder verrutscht: Was aus `ariaSnapshot`
// kommt, ist Playwrights ARIA-Repräsentation; was aus CDP kommt, ist die Rechnung des Browsers.
test("KALIBRIERUNG B · Playwrights ARIA-Repraesentation nennt dieselbe Rolle, fuehrt aber KEINE Live-Eigenschaft", async ({
  page,
}) => {
  await page.setContent('<output id="probe">Gespeichert</output>');

  const playwrightSicht = await page.locator("#probe").ariaSnapshot();
  expect(playwrightSicht, "Playwright fuehrt die Flaeche nicht als status").toContain("status");
  for (const wort of ["live", "polite", "atomic", "relevant"]) {
    expect(
      playwrightSicht,
      `ariaSnapshot enthaelt "${wort}" — dann waere die Trennung der beiden Messungen hinfaellig`,
    ).not.toContain(wort);
  }

  const browserSicht = await rohsignal(await sitzung(page), "#probe");
  expect(browserSicht.rolle).toBe("status");
  expect(
    browserSicht.live,
    "der Browser gibt die implizite Live-Eigenschaft von <output> nicht aus",
  ).toBe("polite");
});

// ================================================================================================
// DIE DREI FÄLLE DES VERTRAGS — an Fixtures, mit demselben Rohsignalweg.
// ================================================================================================

// R1 — DER ROTE AUSGANG. `<p>` ist die Form, in die die Gegenmutation den Toast zurückversetzt.
// Dieser Fall hält fest, was der Browser dann führt: einen Absatz ohne jede Live-Eigenschaft.
test("R1 · <p> ist KEINE Statusflaeche: der Browser fuehrt paragraph und keine Live-Eigenschaft", async ({
  page,
}) => {
  await page.setContent('<p id="probe">Entwurf gespeichert.</p>');
  const gemessen = await rohsignal(await sitzung(page), "#probe");

  expect(gemessen.rolle, "<p> wird als Statusflaeche gefuehrt — das waere neu").toBe("paragraph");
  expect(gemessen.live, "<p> traegt eine Live-Eigenschaft — das waere neu").toBeNull();
  expect(gemessen.atomic).toBeNull();
  expect(gemessen.relevant).toBeNull();
});

// P1 — DIE GRÜNE STATUSFLÄCHE. `<output>` ohne jedes ARIA-Attribut. Der Browser leitet Rolle UND
// Live-Eigenschaft aus dem Element selbst ab. Das ist der Befund, der die heutige E1-Prüfform
// (`getAttribute("aria-live") === "polite"`) als zu eng entlarvt — sie nennt genau diese richtige
// Fläche rot, weil das redundante Attribut fehlt.
test("P1 · <output> ohne ARIA-Attribute ist eine Statusflaeche mit live=polite, atomic und relevant", async ({
  page,
}) => {
  await page.setContent('<output id="probe">Entwurf gespeichert.</output>');
  const gemessen = await rohsignal(await sitzung(page), "#probe");

  expect(gemessen.rolle).toBe("status");
  expect(gemessen.ignoriert).toBe(false);
  expect(gemessen.live, "die implizite Live-Eigenschaft von <output> fehlt").toBe("polite");
  expect(gemessen.atomic).toBe(true);
  expect(gemessen.relevant).toBe("additions text");
});

// N1 — DER GRÜNE NEGATIVFALL. Versteckt heisst: gar nicht im Baum. Er ist der Gegenbeleg dazu, dass
// P1 bloss „irgendein Knoten mit Attributen" misst — dieselbe Fläche verschwindet vollständig,
// sobald sie versteckt wird.
test("N1 · <output hidden> steht gar nicht im AX-Baum — versteckt ist keine Statusflaeche", async ({
  page,
}) => {
  await page.setContent('<output id="probe" hidden>Entwurf gespeichert.</output>');
  const gemessen = await rohsignal(await sitzung(page), "#probe");

  expect(gemessen.ignoriert, "die versteckte Flaeche wird im Baum gefuehrt").toBe(true);
  expect(gemessen.rolle, "eine ignorierte Flaeche traegt trotzdem die Statusrolle").not.toBe(
    "status",
  );
  expect(gemessen.live, "eine versteckte Flaeche traegt eine Live-Eigenschaft").toBeNull();
});

// ================================================================================================
// DER PRODUKTFALL — DER ECHTE TOAST DER ANWENDUNG, NICHT SEINE FORM.
// ================================================================================================
//
// Kein nachgebautes Markup: Das Erfassungs-Blatt wird betreten, Text getippt, „Entwurf sichern"
// geklickt. Was danach im Baum steht, hat `ToastViewport` gerendert, ausgelöst von
// `components/erfassen/Blatt.tsx` über `ToastContext.push`. Gemessen wird mit demselben
// `rohsignal()` wie R1, P1 und N1.
//
// DIE GEGENMUTATION, gegen die dieser Fall gebaut ist: `<output>` in `ToastViewport.tsx:22` zurück
// zu `<p>`. Dann liefert derselbe Weg `paragraph` ohne Live-Eigenschaft — wie R1 — und dieser Fall
// wird rot. Er hängt damit kausal am Produktcode und nicht an einer Fixture.
test("PRODUKT · der ausgeloeste Toast wird vom Browser als Statusflaeche mit live=polite gefuehrt", async ({
  page,
}) => {
  await serviereApp(page);
  await page.goto(VORDERTUER);

  const editor = page.locator(EDITOR).first();
  await expect(
    editor,
    "die Vordertuer ist nicht gemountet — alles Weitere waere eine Aussage ueber den Selektor",
  ).toBeVisible({ timeout: 20_000 });

  await editor.click();
  await page.keyboard.type(SATZ);

  // `exact`: ohne die Angabe matcht Playwright Teilzeichenketten — „Entwurf sichern" träfe dann
  // auch den Menüeintrag „Entwürfe" nicht, wohl aber jede künftige längere Beschriftung.
  const speichern = page.getByRole("button", { name: T.entwurfSpeichern, exact: true });
  await expect(
    speichern,
    "der Entwurfsknopf ist gesperrt — es gaebe nichts auszuloesen",
  ).toBeEnabled();
  await speichern.click();

  // Der Toast selbst. Erst wenn sein TEXT steht, ist er der Toast dieses Weges und nicht irgendeine
  // andere Fläche. Er räumt sich nach vier Sekunden selbst ab (`ToastContext.AUTO_DISMISS_MS`) —
  // die Messung darunter folgt deshalb unmittelbar.
  const toast = page.locator(TOAST).first();
  await expect(toast, "kein Toast erschienen").toBeVisible({ timeout: 10_000 });
  await expect(toast, "der sichtbare Toast ist nicht der des Entwurfsweges").toContainText(
    T.entwurfGespeichert,
  );

  const gemessen = await rohsignal(await sitzung(page), TOAST);

  expect(gemessen.rolle, "der echte Toast ist im AX-Baum keine Statusflaeche").toBe("status");
  expect(gemessen.ignoriert, "der echte Toast wird im AX-Baum ignoriert").toBe(false);
  expect(gemessen.live, "der echte Toast traegt keine Live-Eigenschaft").toBe("polite");
  expect(gemessen.atomic).toBe(true);
  expect(gemessen.relevant).toBe("additions text");

  // Was hier NICHT zugesagt wird: dass eine Vorlesehilfe diesen Satz hörbar ansagt. Gemessen ist
  // die Rechnung des Browsers über sein Dokument — nicht die Ausgabe eines Screenreaders.
});
