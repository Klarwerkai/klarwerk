// ================================================================================================
// produkt:20261012:klara-setup-shortcuts-hostpruefung (AA-05) — KLARA-TASTENKÜRZEL IM ECHTEN BROWSER.
// ================================================================================================
//
// Die Nutzerwege aus AA-05 am gebündelten Produkt, mit echtem Server, echter Anmeldung und echten
// Tastenereignissen des Browsers (nicht jsdom):
//   1. Setup › Klara über Zahnrad › Persönliche Einstellungen; Nutzerhilfe im „?“ der Karte;
//      Festlegen mit Abbruch (Escape), ungeprüftem Kandidaten Control+Command+K, VoiceOver-Taste,
//      reinen Zusatztasten; Speichern; Doppelbelegung; Auslösen genau einmal; Textfeld;
//      gedrückt gehalten; offener Dialog; Ändern; Speicherfehler; Neuladen; neue Sitzung (neuer
//      Browserkontext) ohne Besuch des Setups; Entfernen; Standard; alle zurücksetzen.
//   2. Diktat, Aufnahme/„Auftrag sprechen“, Aufnahme stoppen, Vorlesen stoppen und Seitenhilfe über
//      ihre Kürzel und den vorhandenen Weg — kein zweiter Rekorder, nichts gesendet ohne Klick;
//      Bearbeitungskürzel im Textfeld; Dialog sperrt; Ändern und Entfernen einer Belegung.
//   3. Voraussetzungen: ohne Spracherkennung und bei abgelehntem Mikrofon ein ehrlicher Hinweis.
//   4. Rollen: die Leserolle erreicht den Bereich, verwaltet ihre eigenen Kürzel, fremde wirken nicht.
//
// ATTRAPPEN, ausdrücklich (wie Klara 02, `klara-sprache-browser.spec.ts`): Die Bahn hat kein Mikrofon
// und keine hörbare Ausgabe. Ein Init-Skript ersetzt die BROWSER-SCHNITTSTELLEN `SpeechRecognition`
// und `speechSynthesis`; alles dahinter — Bündel, Setup, Ablage, Ausführungsweg, Klara — ist echt.
// Ein zweiter Hörer am Fenster protokolliert nur, welche Klara-Aktion der Ausführungsweg meldet.
//
// WAS DIESER LAUF NICHT IST: kein Mac-Host. Die Tasten erzeugt Playwright (US-Belegung) im Browser
// des Prüfrechners; physische deutsche/englische Mac-Tastaturen, VoiceOver, ein echtes Mikrofon und
// Safari auf macOS misst er nicht. Diese Hostfälle stehen offen in
// `docs/klara-setup-shortcuts/HOSTPRUEFUNG.md`. Im hermetischen Tor ist kein Modell aktiv.
import { type Browser, type Page, type TestInfo, expect, test } from "@playwright/test";
import { ensureLoggedIn } from "./support/auth";

const KENNWORT = "Klara-Kuerzel-Kennwort-1";
const BASIS = "/api/me/assistenz/tastenkuerzel";
const AKTIONEN = [
  "oeffnen",
  "seitenhilfe",
  "diktieren",
  "auftragSprechen",
  "aufnahmeStoppen",
  "vorlesenStoppen",
] as const;
type Aktion = (typeof AKTIONEN)[number];

// Kombinationen mit Strg + Umschalt, die keine der Konfliktregeln trifft.
const E = "Control+Shift+KeyE";
const U = "Control+Shift+KeyU";
const X = "Control+Shift+KeyX";
const SECHS = "Control+Shift+Digit6";
const SIEBEN = "Control+Shift+Digit7";
const ACHT = "Control+Shift+Digit8";
const NEUN = "Control+Shift+Digit9";
// Mac-Symbole (WebKit meldet ein Apple-Gerät) oder ausgeschrieben (Chromium).
const MIT_E = /⌃⇧E|Strg\+Umschalt\+E/;
const MIT_U = /⌃⇧U|Strg\+Umschalt\+U/;

function marke(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

async function eigenesKonto(admin: Page, name: string, role = "experte"): Promise<string> {
  await ensureLoggedIn(admin);
  const email = `klara-kuerzel-${name}-${marke()}@klarwerk.test`;
  const angelegt = await admin.request.post("/api/users", {
    data: { name: `Klara Kuerzel ${name}`, email, password: KENNWORT, role },
  });
  expect(angelegt.status(), await angelegt.text()).toBe(201);
  return email;
}

type Lage = "ok" | "verweigert" | "ohne";

interface Protokoll {
  aktionen: string[];
  rekorder: number;
  rec: unknown;
  gesprochen: number;
  abgebrochen: number;
}

/** Läuft im Browser vor jedem Skript der Seite. */
function vorbereiten(lage: Lage): void {
  const w = window as unknown as Record<string, unknown> & { __kuerzel: Protokoll };
  w.__kuerzel = { aktionen: [], rekorder: 0, rec: null, gesprochen: 0, abgebrochen: 0 };
  window.addEventListener("klarwerk:klara-aktion", (e) => {
    w.__kuerzel.aktionen.push((e as CustomEvent<{ aktion: string }>).detail.aktion);
  });
  const setze = (name: string, wert: unknown): void => {
    Object.defineProperty(w, name, { value: wert, configurable: true, writable: true });
  };
  setze("speechSynthesis", {
    speak: () => {
      w.__kuerzel.gesprochen += 1;
    },
    cancel: () => {
      w.__kuerzel.abgebrochen += 1;
    },
    getVoices: () => [],
    addEventListener: () => {},
    removeEventListener: () => {},
  });
  if (lage === "ohne") {
    // Wie ein Browser ohne Spracherkennung: die Eigenschaften FEHLEN (s. Klara 02).
    for (const name of ["SpeechRecognition", "webkitSpeechRecognition"]) {
      let traeger: object | null = w;
      while (traeger && name in w) {
        if (Object.prototype.hasOwnProperty.call(traeger, name)) {
          Reflect.deleteProperty(traeger, name);
        }
        traeger = Object.getPrototypeOf(traeger) as object | null;
      }
      if (name in w) {
        throw new Error(`Init-Skript: ${name} lässt sich in diesem Browser nicht entfernen`);
      }
    }
    return;
  }
  class Rekorder {
    lang = "";
    continuous = false;
    interimResults = false;
    onresult: ((e: unknown) => void) | null = null;
    onend: (() => void) | null = null;
    onerror: ((e: { error: string }) => void) | null = null;
    start(): void {
      w.__kuerzel.rekorder += 1;
      w.__kuerzel.rec = this;
      if (lage === "verweigert") {
        setTimeout(() => {
          this.onerror?.({ error: "not-allowed" });
          this.onend?.();
        }, 0);
      }
    }
    stop(): void {
      setTimeout(() => this.onend?.(), 0);
    }
    abort(): void {
      setTimeout(() => this.onend?.(), 0);
    }
    hoert(text: string): void {
      this.onresult?.({
        resultIndex: 0,
        results: [Object.assign([{ transcript: text }], { isFinal: true })],
      });
    }
  }
  setze("SpeechRecognition", Rekorder);
  setze("webkitSpeechRecognition", Rekorder);
}

async function anmelden(
  browser: Browser,
  email: string,
  lage: Lage,
): Promise<{ p: Page; schliessen: () => Promise<void> }> {
  const kontext = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await kontext.addInitScript(vorbereiten, lage);
  const p = await kontext.newPage();
  await p.goto("/");
  const pw = p.locator('input[type="password"]');
  await expect(pw.first()).toBeVisible({ timeout: 15_000 });
  await p.locator('input[type="email"]').fill(email);
  await pw.first().fill(KENNWORT);
  await p.locator('button[type="submit"]').click();
  await expect(p.getByTestId("kopfband")).toBeVisible({ timeout: 15_000 });
  return { p, schliessen: () => kontext.close() };
}

const zeile = (p: Page, aktion: Aktion) => p.getByTestId(`klara-kuerzel-${aktion}`);
const wert = (p: Page, aktion: Aktion) => zeile(p, aktion).getByTestId("klara-kuerzel-wert");
const meldung = (p: Page) => p.getByTestId("klara-kuerzel-meldung");
const gespraech = (p: Page) => p.getByTestId("klara-gespraech");
const hilfeFlaeche = (p: Page) => p.locator('section[data-klara="1"][aria-label]');
const hilfeKnopf = (p: Page) =>
  p.locator('button[data-klara="1"][aria-label="Assistenz öffnen — Hilfe zu dieser Seite"]');
const letzteKlara = (p: Page) =>
  p.locator('[data-testid="klara-nachricht"][data-von="klara"]').last();

function aktionen(p: Page): Promise<string[]> {
  return p.evaluate(() =>
    (window as unknown as { __kuerzel: Protokoll }).__kuerzel.aktionen.slice(),
  );
}

function protokoll(p: Page): Promise<Omit<Protokoll, "aktionen" | "rec">> {
  return p.evaluate(() => {
    const k = (window as unknown as { __kuerzel: Protokoll }).__kuerzel;
    return { rekorder: k.rekorder, gesprochen: k.gesprochen, abgebrochen: k.abgebrochen };
  });
}

async function hoert(p: Page, text: string): Promise<void> {
  await p.evaluate((t) => {
    const k = (window as unknown as { __kuerzel: { rec: { hoert(t: string): void } } }).__kuerzel;
    k.rec.hoert(t);
  }, text);
}

/** Eine Betätigung, die nichts auslösen darf: kurz warten, dann ist das Protokoll unverändert. */
async function loestNichtsAus(p: Page, kombi: string, warum: string): Promise<void> {
  const vorher = await aktionen(p);
  await p.keyboard.press(kombi);
  await p.waitForTimeout(300);
  expect(await aktionen(p), warum).toEqual(vorher);
}

/**
 * Nach einem Seitenaufbau: „Klara öffnen“ über `kombi`, sobald die Belegung des Kontos geladen ist.
 * Ein Druck davor darf folgenlos bleiben; „Öffnen“ ist idempotent, das Wiederholen ist unschädlich.
 */
async function wirktBald(p: Page, kombi: string): Promise<void> {
  await expect(async () => {
    await p.keyboard.press(kombi);
    await expect(gespraech(p)).toBeVisible({ timeout: 1_000 });
  }).toPass({ timeout: 15_000 });
  await expect(gespraech(p)).toHaveCount(1);
}

async function amServer(p: Page, aktion: Aktion) {
  const r = await p.request.get(BASIS);
  expect(r.status(), await r.text()).toBe(200);
  const stand = (await r.json()) as {
    aktionen: { aktion: string; belegung: Record<string, unknown> | null; quelle: string }[];
  };
  return stand.aktionen.find((a) => a.aktion === aktion);
}

async function beleg(p: Page, info: TestInfo, name: string): Promise<void> {
  await info.attach(`Klara-Kürzel — ${name}`, {
    body: await p.screenshot({ fullPage: false }),
    contentType: "image/png",
  });
}

async function bereitImSetup(p: Page): Promise<void> {
  const karte = p.getByTestId("detail-assistenz");
  await expect(karte).toBeVisible({ timeout: 15_000 });
  await expect(karte.locator('[data-einst="detailtitel"]')).toHaveText("Klara");
  await expect(p.getByTestId("klara-kuerzel-liste")).toBeVisible({ timeout: 15_000 });
}

/** Der reguläre Weg: Zahnrad › Persönliche Einstellungen › Klara. */
async function zumKlaraSetup(p: Page): Promise<void> {
  await p.getByTestId("kopfband-zahnrad").click();
  await p.getByTestId("zahnrad-persoenlich").click();
  const z = p.getByTestId("zeile-assistenz");
  await expect(z).toContainText("Klara", { timeout: 15_000 });
  const knopf = z.locator("button");
  await ((await knopf.count()) > 0 ? knopf.first() : z).click();
  await bereitImSetup(p);
}

async function klaraSchliessen(p: Page): Promise<void> {
  if (await gespraech(p).isVisible()) {
    await p.getByTestId("klara-schliessen").click();
    await expect(gespraech(p)).toHaveCount(0);
  }
}

/** „Festlegen/Ändern“ wählen; die Aufnahme hat den Fokus; dann `taste` drücken. */
async function aufnehmen(p: Page, aktion: Aktion, taste: string): Promise<void> {
  await zeile(p, aktion).getByTestId("klara-kuerzel-festlegen").click();
  await expect(p.getByTestId("klara-kuerzel-aufnahme")).toBeFocused();
  await p.keyboard.press(taste);
}

async function belegen(p: Page, aktion: Aktion, kombi: string): Promise<void> {
  await aufnehmen(p, aktion, kombi);
  await expect(meldung(p)).toHaveText(/^Gespeichert: /, { timeout: 15_000 });
  await expect(zeile(p, aktion)).toHaveAttribute("data-quelle", "eigen");
}

test("Klara-Kürzel · Setup › Klara: festlegen, speichern, auslösen, ändern, entfernen, zurücksetzen; Neuladen und neue Sitzung", async ({
  page,
  browser,
}, info) => {
  test.setTimeout(240_000);
  const email = await eigenesKonto(page, "weg");
  const { p, schliessen } = await anmelden(browser, email, "ok");
  const puts: string[] = [];
  p.on("request", (r) => {
    if (r.method() === "PUT" && new URL(r.url()).pathname === BASIS) {
      puts.push(r.postData() ?? "");
    }
  });

  // --- Setup › Klara über die reguläre Navigation; Geltungsbereich; Nutzerhilfe -------------------
  await zumKlaraSetup(p);
  await expect(p.getByRole("region", { name: "Tastenkürzel", exact: true })).toBeVisible();
  const geltung = p.getByTestId("klara-kuerzel-geltung");
  await expect(geltung).toContainText("in Klarwerk, solange das Klarwerk-Fenster aktiv ist");
  await expect(geltung).toContainText("für später vorgemerkt");
  await expect(
    p.getByRole("list", { name: "Klara-Aktionen und ihre Tastenkürzel", exact: true }),
  ).toBeVisible();
  for (const aktion of AKTIONEN) {
    await expect(zeile(p, aktion), aktion).toHaveAttribute("data-quelle", "standard");
    await expect(wert(p, aktion), aktion).toContainText("Nicht belegt");
  }
  const hilfe = p.getByTestId("detail-assistenz").locator('[data-einst="hilfe"]');
  await hilfe.click();
  const hilfeMenue = p.locator('[data-einst="hilfemenue"]');
  await expect(hilfeMenue).toContainText("Tastenkürzel");
  await expect(hilfeMenue).toContainText("Escape bricht ab");
  await expect(hilfeMenue).toContainText("ab Werk ist keine Aktion belegt");
  await beleg(p, info, "1 Setup › Klara mit Nutzerhilfe");
  await hilfe.press("Enter");
  await expect(hilfeMenue).toHaveCount(0);

  // --- Abbrechen mit Escape: bisherige Belegung bleibt, Fokus zurück, die Karte bleibt offen -------
  await aufnehmen(p, "oeffnen", "Escape");
  await expect(meldung(p)).toHaveText("Abgebrochen – es bleibt bei der bisherigen Belegung.");
  await expect(
    p.getByRole("button", { name: "Kürzel für „Klara öffnen“ festlegen", exact: true }),
  ).toBeFocused();
  await expect(zeile(p, "oeffnen")).toHaveAttribute("data-quelle", "standard");
  await expect(p.getByTestId("detail-assistenz")).toBeVisible();

  // --- Der ungeprüfte Kandidat Control+Command+K und die VoiceOver-Taste ---------------------------
  await aufnehmen(p, "oeffnen", "Control+Meta+KeyK");
  await expect(meldung(p)).toHaveAttribute("role", "alert");
  await expect(meldung(p)).toContainText("öffnet bereits die Befehlspalette");
  await expect(meldung(p)).toContainText("Es bleibt bei der bisherigen Belegung.");
  await expect(p.locator('[data-cmd="suchfeld"]'), "Palette ging mit auf").toHaveCount(0);
  await aufnehmen(p, "oeffnen", "Control+Alt+KeyX");
  await expect(meldung(p)).toContainText("für VoiceOver (Mac)");
  expect(puts, "abgelehnte Kombination wurde gespeichert").toEqual([]);

  // --- Nur Zusatztasten: die Aufnahme wartet; dann die tatsächlich gedrückte Kombination ----------
  await aufnehmen(p, "oeffnen", "Shift");
  await expect(p.getByTestId("klara-kuerzel-aufnahme")).toBeFocused();
  await expect(zeile(p, "oeffnen")).toContainText("Halte die Zusatztasten");
  await p.keyboard.press(E);
  await expect(meldung(p)).toHaveText(/^Gespeichert: „Klara öffnen“ mit /, { timeout: 15_000 });
  await expect(meldung(p)).toContainText(MIT_E);
  await expect(meldung(p)).toHaveAttribute("role", "status");
  await expect(zeile(p, "oeffnen")).toHaveAttribute("data-quelle", "eigen");
  await expect(wert(p, "oeffnen")).toContainText(MIT_E);
  await expect(
    p.getByRole("button", { name: "Kürzel für „Klara öffnen“ ändern", exact: true }),
  ).toBeFocused();
  expect((await amServer(p, "oeffnen"))?.belegung).toMatchObject({
    code: "KeyE",
    strg: true,
    umschalt: true,
    alt: false,
    meta: false,
  });
  expect(puts).toHaveLength(1);
  expect(await aktionen(p), "Aufnahme hat eine Aktion ausgelöst").toEqual([]);
  await beleg(p, info, "2 gespeichert");

  // --- Doppelbelegung: konkrete Meldung, nichts gespeichert, nichts ausgelöst ----------------------
  await aufnehmen(p, "diktieren", E);
  await expect(meldung(p)).toContainText("ist schon „Klara öffnen“ zugeordnet");
  await expect(zeile(p, "diktieren")).toHaveAttribute("data-quelle", "standard");
  expect(puts).toHaveLength(1);
  expect(await aktionen(p)).toEqual([]);
  await expect(gespraech(p)).toHaveCount(0);

  // --- Auslösen: eine Betätigung, eine Aktion; Klara öffnet mit Fokus im Gespräch -----------------
  await p.keyboard.press(E);
  await expect(gespraech(p)).toBeVisible();
  await expect(p.getByTestId("klara-panel-titel")).toBeFocused();
  expect(await aktionen(p)).toEqual(["oeffnen"]);
  await beleg(p, info, "3 Klara über das Kürzel geöffnet");

  // --- Texteingabe bleibt normal; erneutes Auslösen erzeugt keine zweite Fläche -------------------
  const eingabe = p.getByTestId("klara-eingabe");
  await eingabe.click();
  await p.keyboard.type("Entwurf bleibt e E");
  await expect(eingabe).toHaveValue("Entwurf bleibt e E");
  expect(await aktionen(p)).toEqual(["oeffnen"]);
  await p.keyboard.press(E);
  expect(await aktionen(p)).toEqual(["oeffnen", "oeffnen"]);
  await expect(gespraech(p)).toHaveCount(1);
  await expect(eingabe).toHaveValue("Entwurf bleibt e E");

  // --- Gedrückt gehalten: die Wiederholung ist keine neue Betätigung -------------------------------
  await p.keyboard.down("Control");
  await p.keyboard.down("Shift");
  await p.keyboard.down("KeyE");
  await p.keyboard.down("KeyE");
  await p.keyboard.down("KeyE");
  await p.keyboard.up("KeyE");
  await p.keyboard.up("Shift");
  await p.keyboard.up("Control");
  expect(await aktionen(p)).toEqual(["oeffnen", "oeffnen", "oeffnen"]);
  await expect(gespraech(p)).toHaveCount(1);

  // --- Ein offener Dialog (Befehlspalette) sperrt die Kürzel ---------------------------------------
  await p.evaluate(() => window.dispatchEvent(new Event("open-command-palette")));
  const suchfeld = p.locator('[data-cmd="suchfeld"]');
  await expect(suchfeld).toBeVisible();
  await loestNichtsAus(p, E, "Kürzel wirkte im offenen Dialog");
  await suchfeld.press("Escape");
  await expect(suchfeld).toHaveCount(0);
  await klaraSchliessen(p);

  // --- Ändern: die neue Belegung wirkt sofort, die alte nicht mehr ---------------------------------
  await belegen(p, "oeffnen", U);
  await expect(meldung(p)).toContainText(MIT_U);
  await loestNichtsAus(p, E, "alte Belegung wirkt noch");
  await p.keyboard.press(U);
  await expect(gespraech(p)).toBeVisible();
  expect((await aktionen(p)).slice(-1)).toEqual(["oeffnen"]);
  await klaraSchliessen(p);

  // --- Speicherfehler: nichts vorgetäuscht, die bisherige Belegung gilt weiter ---------------------
  await p.route(`**${BASIS}`, (route) =>
    route.request().method() === "PUT"
      ? route.fulfill({ status: 500, contentType: "application/json", body: '{"error":"smoke"}' })
      : route.continue(),
  );
  await aufnehmen(p, "oeffnen", X);
  await expect(meldung(p)).toHaveAttribute("data-fehler", "true", { timeout: 15_000 });
  await expect(meldung(p)).toHaveAttribute("role", "alert");
  await expect(meldung(p)).toContainText("Nicht gespeichert");
  await expect(meldung(p)).toContainText("bisherige Belegung");
  await beleg(p, info, "4 Speicherfehler sichtbar");
  await p.unroute(`**${BASIS}`);
  await expect(wert(p, "oeffnen")).toContainText(MIT_U);
  expect((await amServer(p, "oeffnen"))?.belegung).toMatchObject({ code: "KeyU" });
  await loestNichtsAus(p, X, "nicht gespeicherte Belegung wirkt");
  await p.keyboard.press(U);
  await expect(gespraech(p)).toBeVisible();
  await klaraSchliessen(p);

  // --- Neuladen über den Direktweg: dieselbe Belegung steht da und wirkt ---------------------------
  await p.goto("/profil?bereich=klara");
  await bereitImSetup(p);
  await expect(zeile(p, "oeffnen")).toHaveAttribute("data-quelle", "eigen");
  await expect(wert(p, "oeffnen")).toContainText(MIT_U);
  await wirktBald(p, U);
  expect(new Set(await aktionen(p))).toEqual(new Set(["oeffnen"]));
  await schliessen();

  // --- Neue Sitzung (neuer Browserkontext): wirkt auf Start, ohne das Setup zu besuchen ------------
  const { p: q, schliessen: schliessen2 } = await anmelden(browser, email, "ok");
  await expect(q.getByTestId("klara-figur")).toBeVisible({ timeout: 15_000 });
  await wirktBald(q, U);
  await beleg(q, info, "5 neue Sitzung, Start, Klara über das Kürzel");
  await klaraSchliessen(q);

  // --- Entfernen: danach löst die Kombination nichts mehr aus — auch nach Neuladen -----------------
  await q.goto("/profil?bereich=klara");
  await bereitImSetup(q);
  await klaraSchliessen(q);
  await zeile(q, "oeffnen").getByTestId("klara-kuerzel-entfernen").click();
  await expect(zeile(q, "oeffnen")).toHaveAttribute("data-quelle", "entfernt", { timeout: 15_000 });
  await expect(meldung(q)).toHaveText("Entfernt: „Klara öffnen“ hat kein Kürzel mehr.");
  await expect(zeile(q, "oeffnen").getByTestId("klara-kuerzel-festlegen")).toBeFocused();
  await loestNichtsAus(q, U, "entfernte Belegung wirkt");
  await q.reload();
  await bereitImSetup(q);
  await expect(zeile(q, "oeffnen")).toHaveAttribute("data-quelle", "entfernt");
  await expect(wert(q, "oeffnen")).toContainText("Nicht belegt");
  await loestNichtsAus(q, U, "entfernte Belegung wirkt nach Neuladen");
  await expect(gespraech(q)).toHaveCount(0);

  // --- Standard wiederherstellen und alle zurücksetzen -------------------------------------------
  await zeile(q, "oeffnen").getByTestId("klara-kuerzel-standard").click();
  await expect(zeile(q, "oeffnen")).toHaveAttribute("data-quelle", "standard", { timeout: 15_000 });
  await expect(meldung(q)).toHaveText("„Klara öffnen“ ist wieder auf dem Standard: Nicht belegt.");
  await belegen(q, "diktieren", X);
  await belegen(q, "oeffnen", E);
  await q.getByTestId("klara-kuerzel-alle-standard").click();
  await expect(meldung(q)).toHaveText("Alle Kürzel sind wieder auf dem Standard.", {
    timeout: 15_000,
  });
  for (const aktion of AKTIONEN) {
    await expect(zeile(q, aktion), aktion).toHaveAttribute("data-quelle", "standard");
    expect((await amServer(q, aktion))?.quelle, aktion).toBe("standard");
  }
  await loestNichtsAus(q, E, "nach dem Zurücksetzen wirkt eine alte Belegung");
  await beleg(q, info, "6 alle auf Standard");
  await schliessen2();
});

test("Klara-Kürzel · Diktat, Aufnahme, Stopp, Vorlesen stoppen und Seitenhilfe über den vorhandenen Weg; Textfeld, Dialog, Ändern, Entfernen", async ({
  page,
  browser,
}, info) => {
  test.setTimeout(240_000);
  const email = await eigenesKonto(page, "sprache");
  const { p, schliessen } = await anmelden(browser, email, "ok");
  const fragen: string[] = [];
  p.on("request", (r) => {
    if (r.method() === "POST" && new URL(r.url()).pathname === "/api/ask") {
      fragen.push((JSON.parse(r.postData() ?? "{}") as { question?: string }).question ?? "");
    }
  });

  await p.goto("/profil?bereich=klara");
  await bereitImSetup(p);
  // Mit Spracherkennung keine Voraussetzungswarnung.
  await expect(zeile(p, "diktieren").getByTestId("klara-kuerzel-voraussetzung")).toHaveCount(0);
  for (const [aktion, kombi] of [
    ["seitenhilfe", SECHS],
    ["diktieren", X],
    ["auftragSprechen", SIEBEN],
    ["aufnahmeStoppen", ACHT],
    ["vorlesenStoppen", NEUN],
  ] as const) {
    await belegen(p, aktion, kombi);
  }
  expect(await aktionen(p)).toEqual([]);
  await beleg(p, info, "S1 fünf Aktionen belegt");

  // --- Diktieren: öffnet Klara und startet das vorhandene Diktat; kein zweiter Rekorder -----------
  await p.keyboard.press(X);
  await expect(gespraech(p)).toBeVisible();
  await expect(p.getByTestId("klara-aufnahme-laeuft")).toHaveAttribute("data-art", "diktat");
  await expect.poll(async () => (await protokoll(p)).rekorder).toBe(1);
  await hoert(p, "Hallo aus dem Diktat");
  await expect(p.getByTestId("klara-eingabe")).toHaveValue(/Hallo aus dem Diktat/);
  await p.keyboard.press(X);
  await p.waitForTimeout(300);
  expect((await protokoll(p)).rekorder, "zweite Aufnahme gestartet").toBe(1);
  await beleg(p, info, "S2 Diktat über das Kürzel");
  // --- Aufnahme stoppen über sein Kürzel ---------------------------------------------------------
  await p.keyboard.press(ACHT);
  await expect(p.getByTestId("klara-aufnahme-laeuft")).toHaveCount(0);
  expect(fragen, "Diktieren hat gesendet").toEqual([]);
  expect(await aktionen(p)).toEqual(["diktieren", "diktieren", "aufnahmeStoppen"]);

  // --- Vorlesen stoppen über sein Kürzel ---------------------------------------------------------
  const eingabe = p.getByTestId("klara-eingabe");
  await eingabe.fill("");
  await expect(p.getByTestId("klara-echt-hinweis")).toHaveAttribute("data-laden", "bereit", {
    timeout: 15_000,
  });
  await p.getByTestId("klara-einwilligung-erteilen").click();
  await expect(p.getByTestId("klara-einwilligung-erteilt")).toBeVisible();
  const frageweg = p.waitForResponse(
    (r) => new URL(r.url()).pathname === "/api/ask" && r.request().method() === "POST",
  );
  await eingabe.fill("Was kann ich hier tun?");
  await eingabe.press("Enter");
  expect((await frageweg).status()).toBe(200);
  const klara = letzteKlara(p);
  await expect(klara).toHaveAttribute("data-gespeichert", "ja", { timeout: 15_000 });
  await klara.getByTestId("klara-vorlesen").click();
  await expect.poll(async () => (await protokoll(p)).gesprochen).toBe(1);
  await expect(p.getByTestId("klara-vorlesen-stoppen")).toBeVisible();
  const abgebrochenVorher = (await protokoll(p)).abgebrochen;
  await p.keyboard.press(NEUN);
  await expect(p.getByTestId("klara-vorlesen-stoppen")).toHaveCount(0);
  expect((await protokoll(p)).abgebrochen).toBeGreaterThan(abgebrochenVorher);

  // --- Textfeld: Schreiben und Bearbeitungskürzel bleiben unverändert ----------------------------
  const vorTippen = await aktionen(p);
  await eingabe.click();
  await p.keyboard.type("xX 8 Text");
  await expect(eingabe).toHaveValue("xX 8 Text");
  await p.keyboard.press("ControlOrMeta+a");
  await p.keyboard.press("Backspace");
  await expect(eingabe).toHaveValue("");
  expect(await aktionen(p), "Schreiben hat eine Aktion ausgelöst").toEqual(vorTippen);

  // --- Offener Dialog: kein Diktat ---------------------------------------------------------------
  await p.evaluate(() => window.dispatchEvent(new Event("open-command-palette")));
  const suchfeld = p.locator('[data-cmd="suchfeld"]');
  await expect(suchfeld).toBeVisible();
  await loestNichtsAus(p, X, "Diktat-Kürzel wirkte im offenen Dialog");
  await expect(p.getByTestId("klara-aufnahme-laeuft")).toHaveCount(0);
  await suchfeld.press("Escape");
  await expect(suchfeld).toHaveCount(0);

  // --- Auftrag sprechen (Aufnahme): die vorhandene Karte; gesendet wird erst auf Klick -----------
  await p.keyboard.press(SIEBEN);
  await expect(gespraech(p)).toBeVisible();
  await expect(p.getByTestId("klara-aufnahme-laeuft")).toHaveAttribute("data-art", "auftrag");
  const gesprochen = `Wie wird die Anlage ${marke()} gesichert?`;
  await hoert(p, gesprochen);
  await p.keyboard.press(ACHT);
  await expect(p.getByTestId("klara-auftrag")).toBeVisible();
  await expect(p.getByTestId("klara-auftrag-text")).toHaveValue(gesprochen);
  await p.waitForTimeout(300);
  expect(fragen, "Auftrag ohne Klick gesendet").toEqual(["Was kann ich hier tun?"]);
  await beleg(p, info, "S3 Auftrag über das Kürzel aufgenommen, nicht gesendet");

  // --- Seitenhilfe: dieselbe Fläche wie der ?-Knopf; nie zwei offene Flächen ---------------------
  await p.keyboard.press(SECHS);
  await expect(hilfeFlaeche(p)).toBeVisible();
  await expect(gespraech(p)).toHaveCount(0);
  await beleg(p, info, "S4 Seitenhilfe über das Kürzel");
  await hilfeKnopf(p).click();
  await expect(hilfeFlaeche(p)).toHaveCount(0);

  // --- Ändern (Seitenhilfe) und Entfernen (Diktieren) ---------------------------------------------
  await belegen(p, "seitenhilfe", U);
  await loestNichtsAus(p, SECHS, "alte Seitenhilfe-Belegung wirkt");
  await p.keyboard.press(U);
  await expect(hilfeFlaeche(p)).toBeVisible();
  await hilfeKnopf(p).click();
  await expect(hilfeFlaeche(p)).toHaveCount(0);
  await zeile(p, "diktieren").getByTestId("klara-kuerzel-entfernen").click();
  await expect(zeile(p, "diktieren")).toHaveAttribute("data-quelle", "entfernt", {
    timeout: 15_000,
  });
  await loestNichtsAus(p, X, "entferntes Diktat-Kürzel wirkt");
  await expect(p.getByTestId("klara-aufnahme-laeuft")).toHaveCount(0);
  expect((await amServer(p, "diktieren"))?.quelle).toBe("entfernt");
  expect((await amServer(p, "seitenhilfe"))?.belegung).toMatchObject({ code: "KeyU" });
  await schliessen();
});

for (const lage of ["ohne", "verweigert"] as const) {
  const titel = lage === "ohne" ? "ohne Spracherkennung" : "bei abgelehntem Mikrofon";
  test(`Klara-Kürzel · Diktat und Aufnahme ${titel}: ehrlicher Hinweis, keine Aufnahme, nichts gesendet`, async ({
    page,
    browser,
  }, info) => {
    test.setTimeout(150_000);
    const email = await eigenesKonto(page, lage);
    const { p, schliessen } = await anmelden(browser, email, lage);
    const fragen: string[] = [];
    p.on("request", (r) => {
      if (r.method() === "POST" && new URL(r.url()).pathname === "/api/ask") {
        fragen.push(r.postData() ?? "");
      }
    });
    await p.goto("/profil?bereich=klara");
    await bereitImSetup(p);
    for (const aktion of ["diktieren", "auftragSprechen"] as const) {
      const voraussetzung = zeile(p, aktion).getByTestId("klara-kuerzel-voraussetzung");
      if (lage === "ohne") {
        await expect(voraussetzung).toContainText("Braucht die Spracherkennung des Browsers");
      } else {
        await expect(voraussetzung).toHaveCount(0);
      }
    }
    await belegen(p, "diktieren", X);
    await belegen(p, "auftragSprechen", SIEBEN);

    for (const kombi of [X, SIEBEN]) {
      await p.keyboard.press(kombi);
      await expect(gespraech(p)).toBeVisible();
      if (lage === "ohne") {
        await expect(p.getByTestId("klara-sprache-na")).toBeVisible();
        await expect(p.getByTestId("klara-diktieren")).toHaveCount(0);
      } else {
        await expect(p.getByTestId("klara-sprache-hinweis")).toContainText(
          "Das Mikrofon ist nicht erlaubt",
        );
      }
      await p.waitForTimeout(300);
      await expect(p.getByTestId("klara-aufnahme-laeuft")).toHaveCount(0);
      await klaraSchliessen(p);
    }
    expect(await aktionen(p)).toEqual(["diktieren", "auftragSprechen"]);
    expect(fragen).toEqual([]);
    await beleg(p, info, `Voraussetzung ${titel}`);
    await schliessen();
  });
}

test("Klara-Kürzel · Leserolle: Setup › Klara erreichbar, eigene Belegung, fremde Belegung wirkt nicht", async ({
  page,
  browser,
}, info) => {
  test.setTimeout(150_000);
  const experte = await eigenesKonto(page, "experte");
  const leser = await eigenesKonto(page, "leser", "viewer");

  const a = await anmelden(browser, experte, "ok");
  await a.p.goto("/profil?bereich=klara");
  await bereitImSetup(a.p);
  await belegen(a.p, "oeffnen", U);

  const b = await anmelden(browser, leser, "ok");
  await zumKlaraSetup(b.p);
  await expect(zeile(b.p, "oeffnen")).toHaveAttribute("data-quelle", "standard");
  await expect(b.p.getByTestId("klara-setup-verwaltung")).toHaveCount(0);
  await expect(b.p.getByTestId("klara-setup-organisation")).toContainText("nicht änderbar");
  await loestNichtsAus(b.p, U, "Belegung eines anderen Kontos wirkt");
  await belegen(b.p, "oeffnen", E);
  await b.p.keyboard.press(E);
  await expect.poll(() => aktionen(b.p)).toEqual(["oeffnen"]);
  await beleg(b.p, info, "Leserolle mit eigener Belegung");
  expect((await amServer(b.p, "oeffnen"))?.belegung).toMatchObject({ code: "KeyE" });
  expect((await amServer(a.p, "oeffnen"))?.belegung).toMatchObject({ code: "KeyU" });
  await b.schliessen();
  await a.schliessen();
});
