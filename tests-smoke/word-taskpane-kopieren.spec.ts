// ================================================================================================
// AUFTRAG-mega36 BLOCK E — DER TASTATUR-KOPIERWEG IN EINEM ECHTEN BROWSER.
// ================================================================================================
//
// bens Satz aus sammel34: „Ein echter Cmd+C- und Kontextmenue-Test gehoert zum Word-Smoke."
// Was davon der Browser zeigen kann, zeigt er HIER — und zwar mit echten Tastenanschlaegen und
// einer echten Zwischenablage, nicht mit einem nachgebauten Ereignis:
//
//   1. Das ECHTE Taskpane wird geladen (dieselbe statische Datei, die Word ausliefert).
//   2. Der Antwortkoerper wird mit einem ECHTEN Strg+A / Cmd+A markiert.
//   3. Ein ECHTES Strg+C / Cmd+C loest den `copy`-Rueckruf des Panels aus.
//   4. Der Inhalt wird mit einem ECHTEN Strg+V / Cmd+V in ein ANDERES Feld zurueckgeholt.
//
// Damit ist die volle Runde belegt: Tastendruck → Panel-Rueckruf → Zwischenablage des Browsers →
// Einfuegen. Der jsdom-Test (tests/app/mega36-word-ausgaenge.test.tsx) prueft die Verzweigungen
// (Teilauswahl, Ausschneiden, Ziehen, Rueckfall); dieser hier prueft, dass der Weg in einer echten
// Engine ueberhaupt greift.
//
// WAS DIESER TEST NICHT ZEIGT — und deshalb im Bericht als HANDPRUEFUNG steht:
//   - Das KONTEXTMENUE. Es ist ein Betriebssystem-Menue; kein Browser-Treiber kann es bedienen.
//     Es loest dasselbe `copy`-Ereignis aus wie die Tastatur (deshalb ist es im Code EIN Rueckruf),
//     aber der Beleg dafuer ist eine menschliche Pruefung im echten Word.
//   - Der Word-Host und die SYSTEM-Zwischenablage von macOS. Geprueft ist die Zwischenablage der
//     Engine, nicht die des Betriebssystems.
//
// HERMETIK: `office.js` liegt auf einem Microsoft-CDN. Diese Sonde BLOCKT die Anfrage ausdruecklich
// (kein Egress im Tor-Lauf) — ohne Office faellt das Panel in seinen ehrlichen „kein Office"-Zustand,
// der Kopierweg braucht Office ohnehin nicht. Alle drei API-Wege sind gestubbt; die Sonde spricht
// mit keinem Dritten.
import { expect, test } from "@playwright/test";

const TASKPANE = "/word-addin/taskpane.html";
const ANTWORT = "Ventil V4 wird jaehrlich geprueft und vor der Wartung entlastet.";

// macOS bedient Markieren/Kopieren mit der Befehlstaste, Linux/Windows mit Strg.
const MOD = process.platform === "darwin" ? "Meta" : "Control";

test("mega36 E · echtes Cmd+C am Antwortfeld traegt Einstufung und Quellen-Zeile", async ({
  page,
  browserName,
}) => {
  // Die Zwischenablage-Runde ueber echte Tastenanschlaege ist nur in Chromium verlaesslich
  // steuerbar; Firefox und WebKit verweigern unter dem Treiber den Zugriff. Das wird hier
  // ausdruecklich benannt statt still uebersprungen — der Tor-Lauf (`smoke:ui:gate`) faehrt
  // ohnehin Chromium, die Sonde laeuft also in jedem Tor mit.
  test.skip(
    browserName !== "chromium",
    "Zwischenablage-Runde nur in Chromium treiberseitig steuerbar (benannte Grenze, kein stilles Ueberspringen)",
  );

  // Kein Egress: das Office-CDN wird hart abgewiesen.
  await page.route("https://appsforoffice.microsoft.com/**", (route) => route.abort());
  await page.route("**/api/auth/me", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: '{"name":"Testerin"}' }),
  );
  await page.route("**/api/ask", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        result: {
          answered: true,
          answer: ANTWORT,
          trust: 90,
          sources: ["k1"],
          steps: [],
          demo: false,
          evidence: { grade: "unverified" },
        },
        gap: null,
        receipt: "r",
      }),
    }),
  );
  await page.route("**/api/kos/**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        id: "k1",
        title: "Wartungsplan Ventil V4",
        status: "validiert",
        trust: 90,
        createdAt: "2026-07-01T00:00:00.000Z",
      }),
    }),
  );

  await page.goto(TASKPANE);

  // Fragen und auf die aufgeloeste Antwort warten (der Kopieren-Knopf wird erst dann frei — an
  // seinem Zustand haengt auch die Vollstaendigkeit der Quellen-Zeile).
  await page.fill("#ask-input", "Wie oft wird Ventil V4 geprueft?");
  await page.click("#ask-btn");
  await expect(page.locator("#ask-answer-edit")).toHaveValue(ANTWORT);
  await expect(page.locator("#ask-copy-btn")).toBeEnabled();

  // ECHTE Tastenanschlaege: alles markieren, kopieren.
  await page.click("#ask-answer-edit");
  await page.keyboard.press(`${MOD}+a`);
  await page.keyboard.press(`${MOD}+c`);

  // ECHTES Einfuegen in ein ANDERES Feld — was hier ankommt, lag wirklich in der Zwischenablage.
  await page.click("#ask-input");
  await page.keyboard.press(`${MOD}+a`);
  await page.keyboard.press(`${MOD}+v`);

  const eingefuegt = await page.inputValue("#ask-input");
  expect(eingefuegt).toContain(ANTWORT);
  // mega69 Block C: die sichtbaren deutschen Texte tragen echte Umlaute.
  expect(eingefuegt).toContain("Einstufung: ungeprüft");
  expect(eingefuegt).toContain("Wartungsplan Ventil V4");
  expect(eingefuegt).toContain("KLARWERK-Wissen");
  // Genau EINMAL — der native Weg baut denselben Text wie die Schaltflaeche, nicht mehr.
  expect(eingefuegt.split("Einstufung:").length).toBe(2);
  expect(eingefuegt.split("Quelle:").length).toBe(2);
});

test("mega36 E · Kalibrierung: eine TEILAUSWAHL kommt roh aus der echten Zwischenablage", async ({
  page,
  browserName,
}) => {
  // Ohne diese Gegenprobe koennte der Test oben auch dann gruen sein, wenn das Panel STETS den
  // abgeleiteten Text schriebe — die Unterscheidung waere unbelegt.
  test.skip(browserName !== "chromium", "siehe oben — Zwischenablage nur in Chromium steuerbar");

  await page.route("https://appsforoffice.microsoft.com/**", (route) => route.abort());
  await page.route("**/api/auth/me", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: '{"name":"Testerin"}' }),
  );
  await page.route("**/api/ask", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        result: {
          answered: true,
          answer: ANTWORT,
          trust: 90,
          sources: ["k1"],
          steps: [],
          demo: false,
          evidence: { grade: "unverified" },
        },
        gap: null,
        receipt: "r",
      }),
    }),
  );
  await page.route("**/api/kos/**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ id: "k1", title: "Wartungsplan Ventil V4", status: "validiert" }),
    }),
  );

  await page.goto(TASKPANE);
  await page.fill("#ask-input", "Wie oft wird Ventil V4 geprueft?");
  await page.click("#ask-btn");
  await expect(page.locator("#ask-answer-edit")).toHaveValue(ANTWORT);
  await expect(page.locator("#ask-copy-btn")).toBeEnabled();

  // Nur die ersten zehn Zeichen markieren — ein Bruchstueck.
  await page.locator("#ask-answer-edit").evaluate((el) => {
    (el as HTMLTextAreaElement).focus();
    (el as HTMLTextAreaElement).setSelectionRange(0, 10);
  });
  await page.keyboard.press(`${MOD}+c`);

  await page.click("#ask-input");
  await page.keyboard.press(`${MOD}+a`);
  await page.keyboard.press(`${MOD}+v`);

  const eingefuegt = await page.inputValue("#ask-input");
  expect(eingefuegt).toBe(ANTWORT.slice(0, 10));
  expect(eingefuegt).not.toContain("Einstufung");
  // Und die Oberflaeche schweigt dazu nicht.
  await expect(page.locator("#ask-status")).toContainText("Teilauswahl");
});

// ================================================================================================
// AUFTRAG-mega37 BLOCK C2 — DASSELBE ZEITFENSTER IN EINER ECHTEN ENGINE.
// ================================================================================================
//
// Die beiden Sonden oben warten auf den aktivierten Kopieren-Knopf — und damit auf die
// abgeschlossene Quellenaufloesung. Genau deshalb blieb der gefaehrliche Zustand unbelegt: Antwort
// im Feld, Quellentitel noch unterwegs. Diese Sonde HAELT die Quellenantwort an, kopiert nativ und
// prueft an der ECHTEN Zwischenablage, dass nichts hinausging.
//
// KALIBRIERUNG: die Zwischenablage wird vorher mit einem Kennsatz gefuellt. Bliebe sie schlicht
// leer, waere „nichts angekommen" nicht von „Einfuegen tut hier nichts" zu unterscheiden.
test("mega37 C2 · waehrend die Quellen laden, geht bei Cmd+C NICHTS in die echte Zwischenablage", async ({
  page,
  browserName,
}) => {
  test.skip(browserName !== "chromium", "siehe oben — Zwischenablage nur in Chromium steuerbar");

  await page.route("https://appsforoffice.microsoft.com/**", (route) => route.abort());
  await page.route("**/api/auth/me", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: '{"name":"Testerin"}' }),
  );
  await page.route("**/api/ask", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        result: {
          answered: true,
          answer: ANTWORT,
          trust: 90,
          sources: ["k1"],
          steps: [],
          demo: false,
          evidence: { grade: "unverified" },
        },
        gap: null,
        receipt: "r",
      }),
    }),
  );

  // Das Tor: die Quellenantwort haengt, bis der Test sie freigibt.
  let quellenFreigeben: () => void = () => undefined;
  const quellenTor = new Promise<void>((res) => {
    quellenFreigeben = res;
  });
  await page.route("**/api/kos/**", async (route) => {
    await quellenTor;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        id: "k1",
        title: "Wartungsplan Ventil V4",
        status: "validiert",
        trust: 90,
        createdAt: "2026-07-01T00:00:00.000Z",
      }),
    });
  });

  await page.goto(TASKPANE);
  await page.fill("#ask-input", "Wie oft wird Ventil V4 geprueft?");
  await page.click("#ask-btn");
  await expect(page.locator("#ask-answer-edit")).toHaveValue(ANTWORT);
  // Das Fenster ist offen: die Antwort steht, die Schaltflaeche ist noch gesperrt.
  await expect(page.locator("#ask-copy-btn")).toBeDisabled();

  // Kennsatz in die echte Zwischenablage legen — das Fragefeld wird bewusst NICHT abgefangen.
  const KENNSATZ = "KENNSATZ-VOR-DEM-KOPIEREN";
  await page.fill("#ask-input", KENNSATZ);
  await page.click("#ask-input");
  await page.keyboard.press(`${MOD}+a`);
  await page.keyboard.press(`${MOD}+c`);

  // ECHTES Cmd+C am Antwortfeld — mitten im offenen Zeitfenster.
  await page.click("#ask-answer-edit");
  await page.keyboard.press(`${MOD}+a`);
  await page.keyboard.press(`${MOD}+c`);
  await expect(page.locator("#ask-status")).toContainText("NOCH NICHT ausgegeben");

  // Was liegt jetzt wirklich in der Zwischenablage? Der Kennsatz — sonst nichts.
  await page.click("#ask-input");
  await page.keyboard.press(`${MOD}+a`);
  await page.keyboard.press(`${MOD}+v`);
  expect(await page.inputValue("#ask-input")).toBe(KENNSATZ);

  // Tor auf — und derselbe Weg traegt jetzt den echten Beleg.
  quellenFreigeben();
  await expect(page.locator("#ask-copy-btn")).toBeEnabled();
  await page.click("#ask-answer-edit");
  await page.keyboard.press(`${MOD}+a`);
  await page.keyboard.press(`${MOD}+c`);

  await page.click("#ask-input");
  await page.keyboard.press(`${MOD}+a`);
  await page.keyboard.press(`${MOD}+v`);
  const eingefuegt = await page.inputValue("#ask-input");
  expect(eingefuegt).toContain(ANTWORT);
  expect(eingefuegt).toContain("Wartungsplan Ventil V4");
  expect(eingefuegt).not.toContain("Quelle: KLARWERK");
});
