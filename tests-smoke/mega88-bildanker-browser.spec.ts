// AUFTRAG-mega88 Block E — DER PRODUKTNAHE BELEG IM ECHTEN BROWSER.
//
// bens vierte Vor-Ship-Anforderung, wörtlich der Umfang: ein produktnaher Test deckt DIE LOKALE
// DATEIAUSWAHL SOWIE MINDESTENS DROP ODER PASTE ab — Bild einfügen, Bildbeschreibungsformular
// öffnen, Beschreibung übernehmen, SPEICHERN UND ERNEUT LESEN. Der Kreis muss sich schließen.
//
// WARUM DAS HIER STEHT UND NICHT IN jsdom — die Lehre aus mega87, ab jetzt in jedem Auftrag: eine
// Aussage über Browserverhalten wird im Browser gemessen. Beide Wege dieses Falls sind genau das,
// und beide sind in jsdom NICHT fahrbar:
//
//   · Die lokale Dateiauswahl und Drop laufen über `fileToThumbDataUrl` — das verkleinert das Bild
//     über ein `<canvas>`. jsdom hat keins; der Weg endet dort im `catch` und fügt nichts ein. Was
//     ein gemounteter Test über diese beiden Wege sagen könnte, wäre über die Vorrichtung geredet,
//     nicht über das Produkt.
//   · Drop braucht ein echtes `DataTransfer` mit einer echten `File`. jsdom hat kein DataTransfer.
//   · Und der Einfüge-Weg des Bild-Knopfs fährt über `document.execCommand`, das jsdom nicht kennt.
//
// Der gemountete Beleg (`tests/capture/mega88-bildweg-anker-mounted.test.tsx`) bleibt daneben
// stehen und ist nicht überflüssig: er fährt den ALTBESTAND und den HTML-Einfügeweg und schließt
// den Sanitizer-Rundlauf deterministisch. Die beiden Dateien belegen verschiedene Hälften derselben
// Zusage.
//
// WAS DIESE SONDE BELEGT: dass ein Bild, das ein Nutzer über die lokale Dateiauswahl bzw. per Drop
// in den Fließtext bringt, in einem echten Browser sofort eine Bildbeschreibung tragen kann — und
// dass diese Beschreibung nach dem Speichern und erneuten Öffnen des Entwurfs noch da ist. Vor
// mega88 war beides unmöglich: `insertImageSrcHtml` lieferte ein nacktes `<img>`, es entstand keine
// Fußnote, und der Knopf am Bild tat lautlos nichts.
//
// AUFTRAG-JOB-1189 D1 — EINE PRÄZISIERUNG AM SATZ DARÜBER, WEIL ER MEHR VERSPRACH ALS ER HIELT:
// „bzw. per Drop … nach dem Speichern und erneuten Öffnen" galt bis heute NUR für die lokale
// Dateiauswahl. Der Drop-Fall endete am DOM (belegt in JOB 1187 D1, BASIC6, mit Zeile). Seit diesem
// Auftrag fahren BEIDE Wege den Kreis, und der Satz oben stimmt für beide. Wer hier einen dritten
// Weg ergänzt, prüft bitte, ob dieser Satz dann noch trägt — genau daran ist in JOB 1170 D1 eine
// andere Datei aufgefallen.
//
// EINE UNGENAUIGKEIT BLEIBT, und sie steht hier, damit sie niemand für ein Versehen hält: der
// TITEL des Drop-Falls sagt weiterhin nur „ist sofort beschreibbar". Der Grund und was zu tun wäre,
// stehen ausführlich direkt über dem Fall.
//
// HERMETISCH: kein Modell, kein Schlüssel, kein Netz, kein Egress. Das Bild ist ein winziges
// eingebettetes PNG, das im Browser zu einer `File` gebaut wird — keine Datei auf der Platte, kein
// Objekt-Store, kein Upload. Der KI-Knopf im Formular ist ohne Modell deaktiviert und wird nicht
// berührt.
//
// DIE DATENLAGE BLEIBT UNBERÜHRT: gespeichert wird ein ENTWURF (kein Wissensobjekt), und er wird am
// Ende wieder gelöscht. `ui-smoke.spec.ts` „mega49: die Datenlage dieses Laufs ist die zugesagte"
// misst das Prüf-Board (Wissensobjekte) — dort entsteht nichts. Das ist nachgesehen, nicht
// angenommen: genau an dieser Kalibrierung ist in mega87 ein erster Entwurf gescheitert.
//
// Aufruf: npm run smoke:ui:gate (Chromium, hermetisch) oder npm run smoke:ui (drei Engines).
import { type Page, expect, test } from "@playwright/test";
import { ensureLoggedIn } from "./support/auth";

test.describe.configure({ mode: "serial" });

const TINY_PNG_B64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
const BESCHREIBUNG = "Riefen in Laufrichtung bei Schmiermangel";
// AUFTRAG-JOB-1189 D1: der Text des Drop-Falls stand bisher zweimal als Literal da. Er wird jetzt
// ein drittes und viertes Mal gebraucht — NACH dem Rundlauf —, und dieselbe Zeichenkette an vier
// Stellen ist genau die Sorte Doppelung, die beim nächsten Umbenennen halb stehen bleibt.
const DROP_BESCHREIBUNG = "Lagerschale, Innenring";
const FUSSNOTE = "figcaption[data-kw-caption-open]";
const FELD = "#caption-form-text";
const BILDFELD = 'input[type="file"][accept*="image/png"]';

async function vorderTuer(page: Page): Promise<void> {
  await page.goto("/capture/frontdoor");
  await expect(page.getByRole("textbox", { name: "Wissensseite — Fließtext" }).first()).toBeVisible(
    { timeout: 15_000 },
  );
}

/** Der Weg, den Pedi genommen hat: „Bild vom Rechner …". Playwright bedient das echte Dateifeld. */
async function bildVomRechner(page: Page): Promise<void> {
  await page.setInputFiles(BILDFELD, {
    name: "fuehrungsschiene.png",
    mimeType: "image/png",
    buffer: Buffer.from(TINY_PNG_B64, "base64"),
  });
}

/** Drop: ein echtes DataTransfer mit einer echten File, auf den echten Editor-Knoten. */
async function bildFallenLassen(page: Page): Promise<void> {
  await page.evaluate(async (b64) => {
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const datei = new File([bytes], "lager.png", { type: "image/png" });
    const dt = new DataTransfer();
    dt.items.add(datei);
    const el = document.querySelector('[contenteditable="true"]') as HTMLElement;
    el.dispatchEvent(
      new DragEvent("dragover", { bubbles: true, cancelable: true, dataTransfer: dt }),
    );
    el.dispatchEvent(new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: dt }));
  }, TINY_PNG_B64);
}

/** Das Formular über den Weg aus mega84 öffnen: Klick auf die Beschreibung selbst. */
async function beschreibungSchreiben(page: Page, text: string): Promise<void> {
  await page.locator(FUSSNOTE).first().click();
  const feld = page.locator(FELD);
  await expect(feld, "Das Bildbeschreibungs-Formular hat sich nicht geöffnet").toBeVisible({
    timeout: 10_000,
  });
  await feld.click();
  await page.keyboard.type(text);
  await page.locator('[data-testid="caption-form-save"]').click();
  await expect(page.locator(FELD)).toHaveCount(0, { timeout: 10_000 });
}

/**
 * Speichern und ERNEUT LESEN. Der Entwurf wird über die Oberfläche gespeichert und über die
 * Oberfläche wieder geöffnet (`?draft=…` ist der Wiederaufnahme-Weg der Vordertür). Die Entwurfs-Id
 * kommt aus der bestehenden Sitzung — sie ist die ADRESSE, nicht der Prüfling; geprüft wird, was der
 * Nutzer nach dem Wiederöffnen SIEHT.
 */
async function speichernUndWiederOeffnen(page: Page): Promise<string> {
  await page.getByRole("button", { name: "Als Entwurf speichern" }).click();
  // Erst wenn der Entwurf wirklich liegt, ist die Id da.
  let id = "";
  await expect
    .poll(
      async () => {
        const antwort = await page.request.get("/api/drafts");
        if (!antwort.ok()) {
          return 0;
        }
        const liste = (await antwort.json()) as { id: string; updatedAt?: string }[];
        id = liste[0]?.id ?? "";
        return liste.length;
      },
      { message: "Der Entwurf ist nicht gespeichert worden", timeout: 15_000 },
    )
    .toBeGreaterThan(0);

  await page.goto(`/capture/frontdoor?draft=${id}`);
  await expect(page.getByRole("textbox", { name: "Wissensseite — Fließtext" }).first()).toBeVisible(
    { timeout: 15_000 },
  );
  return id;
}

async function entwurfLoeschen(page: Page, id: string): Promise<void> {
  if (id) {
    await page.request.delete(`/api/drafts/${id}`);
  }
}

test("mega88: lokale Dateiauswahl — Bild einfügen, beschreiben, speichern, erneut lesen", async ({
  page,
}) => {
  await ensureLoggedIn(page);
  await vorderTuer(page);

  // Vorbedingung: es gibt noch keine Bild-Fußnote.
  await expect(page.locator(FUSSNOTE)).toHaveCount(0);

  await bildVomRechner(page);

  // DER SHIP-BLOCKER, in einer Zeile: vor mega88 blieb es hier bei einem nackten <img>.
  await expect(
    page.locator(FUSSNOTE).first(),
    "Das über die lokale Dateiauswahl eingefügte Bild hat keine Bildbeschreibung bekommen — genau der Auslieferungsblocker aus mega87/mega88",
  ).toBeVisible({ timeout: 15_000 });
  // Beidseitig verankert (WP-BILD-1b): Bild und Fußnote tragen dieselbe Kennung.
  const kennung = await page.locator(FUSSNOTE).first().getAttribute("data-image-id");
  expect(kennung ?? "", "Die Fußnote trägt keine Bildkennung").toMatch(/^kw-img-[a-z0-9]+-\d+$/);
  await expect(page.locator(`img[data-image-id="${kennung}"]`)).toHaveCount(1);

  await beschreibungSchreiben(page, BESCHREIBUNG);
  await expect(page.locator(FUSSNOTE).first()).toContainText(BESCHREIBUNG);

  // Der Kreis: speichern, erneut lesen.
  const id = await speichernUndWiederOeffnen(page);
  try {
    await expect(
      page.locator(FUSSNOTE).first(),
      "Nach dem Wiederöffnen des Entwurfs ist die Bildbeschreibung verschwunden — der Kreis schließt sich nicht",
    ).toContainText(BESCHREIBUNG, { timeout: 15_000 });
    // …und sie ist weiterhin BEDIENBAR, nicht bloß sichtbar.
    await page.locator(FUSSNOTE).first().click();
    await expect(page.locator(FELD)).toBeVisible({ timeout: 10_000 });
    await expect(page.locator(FELD)).toContainText(BESCHREIBUNG);
  } finally {
    await entwurfLoeschen(page, id);
  }
});

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// AUFTRAG-JOB-1189 D1 — DER DROP-FALL ENDETE AM DOM. JETZT SCHLIESST AUCH ER DEN KREIS.
// ══════════════════════════════════════════════════════════════════════════════════════════════════
//
// DER BEFUND, aus JOB 1187 D1 (BASIC6) und dort mit Zeile belegt: Dieser Fall endete bis heute mit
// `await expect(page.locator(FUSSNOTE).first()).toContainText("Lagerschale, Innenring")` — und
// danach kam nichts. Kein Speichern, kein erneutes Öffnen. Der NACHBARFALL 40 Zeilen darüber
// („lokale Dateiauswahl", `:139`) trägt „speichern, erneut lesen" im Namen und fährt es; der
// Drop-Fall tat es nicht. Derselbe Editor, dieselbe Einbettung, derselbe Helfer
// (`speichernUndWiederOeffnen`, `:107`) — nur hier ungenutzt.
//
// WARUM DIE ERGÄNZUNG HIER UND NICHT IN jsdom: JOB 1187 D1 hat den Rundlauf für den Drop-BEITRAG
// deterministisch geschlossen (`tests/capture/mega89-mehrbild-rundlauf-mounted.test.tsx`, neun
// Merkmale einzeln, Differenz leer). Was dort NICHT ging und hier geht, ist das Drop-EREIGNIS
// selbst: `fileToThumbDataUrl` verkleinert über ein `<canvas>`, und jsdom hat keins — der Weg endet
// dort im `catch` und fügt nichts ein (in 1187 D1 gemessen, nicht vermutet). **Dieser Fall
// erweitert jenen Beleg, er widerlegt ihn nicht.**
//
// JE MERKMAL EINE ERWARTUNG, nicht eine Sammelzusicherung: eine einzige Zusage über „alles noch da"
// sagt beim Bruch nur, dass irgendetwas fehlt. Geprüft werden einzeln: Anzahl der Fußnoten, ihr
// Text, ihre Kennung, die BEIDSEITIGE Verankerung am Bild und die Bedienbarkeit. Die Kennung ist
// dabei das Merkmal, an dem in 1187 D1 die Gegenmutation hing — sie fällt zuerst, wenn der
// Speicherweg etwas verliert.
//
// ── WARUM DER NAME NICHT MITGEWACHSEN IST — vermerkt statt verschwiegen ───────────────────────────
//
// Dieser Fall tut seit JOB 1189 D1 MEHR, als sein Titel sagt: er fährt den ganzen Kreis. Der Titel
// müsste „…, speichern, erneut lesen" heißen, wie der Nachbarfall darüber. Er heißt es nicht, weil
// die Smoke-Titel VERSIONIERT gepinnt sind: `tests/smoke/smoke-mengen-manifest.json` nennt je
// Projekt die vollständigen Titel, und `tests/smoke/mengenpruefung.test.ts` („P0c · je Projekt
// stimmen die vollständigen TITEL — Umbenennen wird sichtbar") wird bei jeder Umbenennung rot.
// GEMESSEN in diesem Durchgang, nicht vermutet: mit dem längeren Titel meldete `./tools/check`
// „Titeldrift in Projekt chromium".
//
// Das Manifest liegt AUSSERHALB der Lease dieses Durchgangs — geleast ist nur diese Datei, und ein
// ungeleasteter Productwrite ist nach der Blockerregel keine Kleinigkeit. Der Titel bleibt deshalb
// unverändert; die Nachführung „Titel UND Manifest in einem Zug" gehört in einen eigenen, winzigen
// Durchgang. Wer ihn schneidet: beide Pfade zusammen leasen, sonst wird der Wächter rot.
test("mega88: Drop — ein fallengelassenes Bild ist sofort beschreibbar", async ({ page }) => {
  await ensureLoggedIn(page);
  await vorderTuer(page);
  await expect(page.locator(FUSSNOTE)).toHaveCount(0);

  await bildFallenLassen(page);

  await expect(
    page.locator(FUSSNOTE).first(),
    "Das fallengelassene Bild hat keine Bildbeschreibung bekommen",
  ).toBeVisible({ timeout: 15_000 });

  await beschreibungSchreiben(page, DROP_BESCHREIBUNG);
  await expect(page.locator(FUSSNOTE).first()).toContainText(DROP_BESCHREIBUNG);

  // Beidseitig verankert VOR dem Rundlauf — sonst wäre der Vergleich danach gegen `null`.
  const kennung = await page.locator(FUSSNOTE).first().getAttribute("data-image-id");
  expect(kennung ?? "", "Die Fußnote des fallengelassenen Bildes trägt keine Kennung").toMatch(
    /^kw-img-[a-z0-9]+-\d+$/,
  );
  await expect(
    page.locator(`img[data-image-id="${kennung}"]`),
    "Das fallengelassene Bild trägt die Kennung seiner Fußnote nicht",
  ).toHaveCount(1);

  // DER KREIS: speichern, erneut lesen.
  const id = await speichernUndWiederOeffnen(page);
  try {
    await expect(
      page.locator(FUSSNOTE),
      "Nach dem Wiederöffnen ist die Fußnote des fallengelassenen Bildes weg oder verdoppelt",
    ).toHaveCount(1, { timeout: 15_000 });

    await expect(
      page.locator(FUSSNOTE).first(),
      "Nach dem Wiederöffnen ist die Beschreibung des fallengelassenen Bildes verschwunden",
    ).toContainText(DROP_BESCHREIBUNG, { timeout: 15_000 });

    await expect(
      page.locator(FUSSNOTE).first(),
      "Die Bildkennung hat den Rundlauf nicht überlebt — genau das Merkmal, an dem in JOB 1187 D1 die Gegenmutation hing",
    ).toHaveAttribute("data-image-id", kennung ?? "");

    await expect(
      page.locator(`img[data-image-id="${kennung}"]`),
      "Nach dem Wiederöffnen zeigt die Fußnote auf ein Bild, das es nicht mehr gibt — die beidseitige Verankerung ist gebrochen",
    ).toHaveCount(1);

    // …und sie ist weiterhin BEDIENBAR, nicht bloß sichtbar.
    await page.locator(FUSSNOTE).first().click();
    await expect(page.locator(FELD)).toBeVisible({ timeout: 10_000 });
    await expect(page.locator(FELD)).toContainText(DROP_BESCHREIBUNG);
  } finally {
    await entwurfLoeschen(page, id);
  }
});

test("mega88: zwei Bilder auf zwei Wegen bekommen zwei EIGENE Beschreibungen", async ({ page }) => {
  await ensureLoggedIn(page);
  await vorderTuer(page);

  await bildVomRechner(page);
  await expect(page.locator(FUSSNOTE)).toHaveCount(1, { timeout: 15_000 });
  await bildFallenLassen(page);
  await expect(
    page.locator(FUSSNOTE),
    "Das zweite Bild teilt sich die Fußnote des ersten oder hat gar keine",
  ).toHaveCount(2, { timeout: 15_000 });

  const kennungen = await page
    .locator(FUSSNOTE)
    .evaluateAll((els) => els.map((e) => e.getAttribute("data-image-id")));
  expect(new Set(kennungen).size, "Beide Bilder tragen dieselbe Kennung").toBe(2);

  // Und die Beschreibung landet bei DEM Bild, das angeklickt wurde.
  await page.locator(FUSSNOTE).nth(1).click();
  await expect(page.locator(FELD)).toBeVisible({ timeout: 10_000 });
  await page.locator(FELD).click();
  await page.keyboard.type("Nur das zweite Bild");
  await page.locator('[data-testid="caption-form-save"]').click();

  await expect(page.locator(FUSSNOTE).nth(1)).toContainText("Nur das zweite Bild");
  await expect(
    page.locator(FUSSNOTE).nth(0),
    "Die Beschreibung ist beim falschen Bild gelandet",
  ).not.toContainText("Nur das zweite Bild");
});
