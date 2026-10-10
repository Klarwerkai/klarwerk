import { type APIRequestContext, type Page, expect, test } from "@playwright/test";

import { ensureLoggedIn } from "./support/auth";

// ================================================================================================
// R-1631 / R-1647 / R-2174 (aufnahme:20260922:gesamt-anlagenzugang) — ANLAGENWISSEN PER QR-CODE,
// IN DER ECHTEN APP.
// ================================================================================================
//
// Geklickt und aufgerufen wird gegen den echten Smoke-Server und das gebaute Bündel:
//   B1 · Am Wissen einer Anlage steht im Abschnitt „Kopplung und Anlagen" der QR-Code (sichtbar,
//        mit Modulen), daneben der Weg „Wissen dieser Anlage öffnen". Der Klick führt in die
//        Bibliothek, die genau das Wissen dieser Anlage zeigt — das einer anderen Anlage nicht.
//   B2 · Die Adresse, die der Code trägt, direkt aufgerufen wie nach einem Scan — auf
//        Telefonbreite und nach einem Neuladen: dieselbe Auswahl.
//   B3 · R-1631 (Ben Nacharbeit 1): Bauteil-Code und Geltungskontext. Der Code eines Bauteils mit
//        Standort öffnet das allgemeine und das am Standort geltende Wissen; die Kontextleiste
//        wechselt im Browser auf eine Schicht, und das Neuladen behält die Wahl.
//
// WAS NICHT GEMESSEN IST, ausdrücklich: das Scannen eines gedruckten Etiketts mit einer echten
// Telefonkamera. Dass der Code GENAU diese Adresse trägt, liest
// `tests/anlagenzugang/qr-in-der-wissensansicht-mounted.test.tsx` am gerenderten SVG mit einem
// unabhängigen Leser zurück; die Kamera selbst bleibt eine menschliche Probe.
//
// Jeder Lauf trägt eine frische Marke: der Smoke-Server hält seinen Bestand über alle Fälle.

function marke(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

async function legeAn(
  request: APIRequestContext,
  title: string,
  asset: string,
  anlagenkontext?: Record<string, string[]>,
): Promise<{ id: string }> {
  const antwort = await request.post("/api/kos", {
    data: {
      title,
      statement: `Aussage zu ${title}. Sie ist lang genug, um die Formprüfung zu bestehen.`,
      type: "best_practice",
      category: "Instandhaltung",
      tags: ["anlagenzugang"],
      asset,
      ...(anlagenkontext ? { anlagenkontext } : {}),
      confidentiality: "intern",
    },
  });
  expect(
    antwort.ok(),
    `Anlegen von „${title}" scheiterte: ${antwort.status()} ${await antwort.text()}`,
  ).toBe(true);
  return (await antwort.json()) as { id: string };
}

function zeilenIds(page: Page) {
  return page.locator('[data-testid="bib-zeile"]');
}

// ================================================================================================
// NACHARBEIT 12 · DER LADEWEG WIRD MITGESCHRIEBEN — EIN LADEFEHLER IST KEINE LEERE LISTE.
// ================================================================================================
//
// Der rote Lauf von B2 (HISTORIE/nacharbeit-12) endete nicht an einer falschen Auswahl, sondern an
// der Karte „Neue Version verfügbar" (`ladefehler-neue-version`): die Fehlergrenze der Seite hatte
// einen gescheiterten Modulabruf gefangen (`isStaleChunkError`). Gezählt wurden danach 0 Zeilen —
// gemessen war also der Ladeweg, nicht die Anlagenauswahl. Welche Datei scheiterte, stand weder im
// Bericht noch im Fehlerkontext.
//
// Darum schreibt jeder Fall jetzt mit, was auf dem Weg scheitert: abgebrochene Abrufe, Antworten
// ab 400 auf `/assets/` und Seitenfehler (nur Name, Meldung, Pfad — keine Inhalte, keine Abfragen).
// `bibliothekSteht` wartet auf die Bibliotheksfläche ODER die Ladefehlerkarte und nennt im zweiten
// Fall den Mitschnitt. Die Sollwerte danach bleiben unverändert; es gibt bewusst KEINEN stillen
// zweiten Versuch — ein wiederkehrender Ladefehler auf Telefonbreite wäre ein Befund, kein Rauschen.
function ladeprotokoll(page: Page): () => string {
  const zeilen: string[] = [];
  const pfad = (url: string): string => {
    try {
      return new URL(url).pathname;
    } catch {
      return "(unlesbar)";
    }
  };
  page.on("requestfailed", (request) => {
    zeilen.push(
      `requestfailed ${request.resourceType()} ${pfad(request.url())} ${request.failure()?.errorText ?? ""}`,
    );
  });
  page.on("response", (response) => {
    if (response.status() >= 400 && pfad(response.url()).startsWith("/assets/")) {
      zeilen.push(`response ${response.status()} ${pfad(response.url())}`);
    }
  });
  page.on("pageerror", (error) => {
    zeilen.push(`pageerror ${error.name}: ${error.message.replace(/\?[^\s]*/g, "")}`);
  });
  return () => (zeilen.length > 0 ? zeilen.join("\n") : "(keine Lade- oder Seitenfehler)");
}

async function bibliothekSteht(page: Page, protokoll: () => string): Promise<void> {
  const flaeche = page.getByTestId("page-bibliothek");
  const ladefehler = page.getByTestId("ladefehler-neue-version");
  await expect(flaeche.or(ladefehler)).toBeVisible({ timeout: 15_000 });
  const fehlerkarte = await ladefehler.count();
  if (fehlerkarte > 0) {
    await test.info().attach("ladeprotokoll.txt", { body: protokoll(), contentType: "text/plain" });
  }
  expect(
    fehlerkarte,
    `Die Bibliothek ist nicht geladen — die Seite zeigt den Ladefehler „Neue Version“ (${page.url()}).\n${protokoll()}`,
  ).toBe(0);
}

test.describe("Anlagenzugang · QR-Code und Anlagenauswahl in der echten App", () => {
  test("B1: QR-Code am Wissen, der Weg daneben öffnet genau diese Anlage", async ({ page }) => {
    const protokoll = ladeprotokoll(page);
    await ensureLoggedIn(page);
    const m = marke();
    const anlage = `Smoke Linie ${m} / DP-4`;
    const a = await legeAn(page.request, `Dosierpumpe entlüften ${m}`, anlage);
    const b = await legeAn(page.request, `Dosiermenge prüfen ${m}`, anlage);
    const fremd = await legeAn(page.request, `Spindel schmieren ${m}`, `Smoke Fräse ${m}`);

    await page.goto(`/wissen/${a.id}`);
    await expect(page.getByTestId("bib-lesen")).toBeVisible({ timeout: 15_000 });
    await page.getByTestId("bib-mehr").click();
    await page.locator('[data-bib-abschnitt="kopplung"] > summary').click();

    const bild = page.getByTestId("anlagen-qr-bild");
    await expect(bild, "kein QR-Code im Abschnitt „Kopplung und Anlagen“").toBeVisible({
      timeout: 15_000,
    });
    expect(await bild.getAttribute("aria-label")).toContain(anlage);
    const pfad = (await bild.locator("path").getAttribute("d")) ?? "";
    expect(pfad.length, "der QR-Code hat keine Module").toBeGreaterThan(100);
    const box = await bild.boundingBox();
    expect(box?.width ?? 0, "der QR-Code ist zu klein, um ihn abzulesen").toBeGreaterThanOrEqual(
      100,
    );

    await page.getByTestId("anlagen-qr-oeffnen").click();
    // Integration nacharbeit-26: EINE Anlagenachse mit mains Schlüssel `asset` (R-0477/R-0082).
    await expect(page).toHaveURL(/\/bibliothek\?asset=/);
    await bibliothekSteht(page, protokoll);
    const zeilen = zeilenIds(page);
    await expect(zeilen).toHaveCount(2, { timeout: 15_000 });
    const ids = await zeilen.evaluateAll((els) => els.map((e) => e.getAttribute("data-bib-id")));
    expect(ids.sort()).toEqual([a.id, b.id].sort());
    expect(ids).not.toContain(fremd.id);
  });

  test("B2: die Adresse des Codes, direkt geöffnet auf Telefonbreite und neu geladen", async ({
    page,
  }) => {
    const protokoll = ladeprotokoll(page);
    await ensureLoggedIn(page);
    const m = marke();
    const anlage = `Smoke Presse ${m}`;
    const a = await legeAn(page.request, `Werkzeugwechsel ${m}`, anlage);
    await legeAn(page.request, `Ölstand prüfen ${m}`, `Smoke Säge ${m}`);

    await page.setViewportSize({ width: 390, height: 844 });
    const p = new URLSearchParams();
    p.set("asset", anlage);
    await page.goto(`/bibliothek?${p.toString()}`);
    await bibliothekSteht(page, protokoll);
    const zeilen = zeilenIds(page);
    await expect(zeilen).toHaveCount(1, { timeout: 15_000 });
    await expect(zeilen.first()).toHaveAttribute("data-bib-id", a.id);

    await page.reload();
    await bibliothekSteht(page, protokoll);
    await expect(zeilen).toHaveCount(1, { timeout: 15_000 });
    await expect(zeilen.first()).toHaveAttribute("data-bib-id", a.id);
  });

  test("B3: Bauteil-Code mit Standort, Schicht in der Kontextleiste, Neuladen behält sie", async ({
    page,
  }) => {
    const protokoll = ladeprotokoll(page);
    await ensureLoggedIn(page);
    const m = marke();
    const anlage = `Smoke Linie ${m}`;
    const bauteil = `BT-${m}`;
    const allgemein = await legeAn(page.request, `Lager prüfen ${m}`, anlage, {
      bauteile: [bauteil],
    });
    const nord = await legeAn(page.request, `Lager Nord ${m}`, anlage, {
      bauteile: [bauteil],
      standorte: ["Werk Nord"],
    });
    await legeAn(page.request, `Lager Süd ${m}`, anlage, {
      bauteile: [bauteil],
      standorte: ["Werk Süd"],
    });
    const nacht = await legeAn(page.request, `Lager Nacht ${m}`, anlage, {
      bauteile: [bauteil],
      schichten: ["Nacht"],
    });
    const frueh = await legeAn(page.request, `Lager Früh ${m}`, anlage, {
      bauteile: [bauteil],
      schichten: ["Früh"],
    });

    const p = new URLSearchParams();
    p.set("bauteil", bauteil);
    p.set("standort", "Werk Nord");
    await page.goto(`/bibliothek?${p.toString()}`);
    await bibliothekSteht(page, protokoll);
    const zeilen = zeilenIds(page);
    const ids = async (): Promise<(string | null)[]> =>
      (await zeilen.evaluateAll((els) => els.map((e) => e.getAttribute("data-bib-id")))).sort();
    await expect(zeilen).toHaveCount(4, { timeout: 15_000 });
    expect(await ids()).toEqual([allgemein.id, nord.id, nacht.id, frueh.id].sort());

    await expect(page.getByTestId("bib-kontext")).toBeVisible();
    await page.getByTestId("bib-kontext-schicht").selectOption("Nacht");
    await expect(page).toHaveURL(/schicht=Nacht/);
    await expect(zeilen).toHaveCount(3, { timeout: 15_000 });
    expect(await ids()).toEqual([allgemein.id, nord.id, nacht.id].sort());

    await page.reload();
    await bibliothekSteht(page, protokoll);
    await expect(zeilen).toHaveCount(3, { timeout: 15_000 });
    expect(await ids()).toEqual([allgemein.id, nord.id, nacht.id].sort());
    await expect(page.getByTestId("bib-kontext-standort")).toHaveValue("Werk Nord");
  });
});
