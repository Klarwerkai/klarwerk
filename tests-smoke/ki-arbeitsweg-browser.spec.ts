// ================================================================================================
// BPA-13 (produkt:20261011:assistenz-ki-arbeitsbegleitung) — DIE OBERFLÄCHE DES KI-ARBEITSWEGS,
// IM BROWSER BEDIENT (Ben, Nacharbeit 6)
// ================================================================================================
//
// Bens Prüfgrenze: die Providerprobe (`ki-arbeitsweg-modell.spec.ts`) fährt nur HTTP-Wege und belegt
// keine Bedienung. Diese Sonde bedient die TATSÄCHLICHE Fläche `KiArbeitsweg.tsx` in der beweglichen
// Klara — Klicks, Eingaben, Auswahl — und misst, was sichtbar wird:
//   1. Auftrag vorbereiten → der Prompt steht sichtbar da (mit der freigegebenen Quelle).
//   2. Übergeben → Stand „übergeben"; Ergebnis einfügen → Antwort und Beleg „manuelle_uebergabe".
//   3. SICHTBARE SPERRE „Keine KI": ein vorbereiteter Prompt verschwindet, der Sperrsatz steht da,
//      das Vorbereiten ist nicht mehr angeboten.
//   4. SICHTBARE SPERRE nach Rechteentzug: der Antworttext ist zurückgehalten, der Hinweis steht da.
// Kandidat (`/health`: Version, Commit) und Host (Browser, Version, User-Agent) stehen im Anhang.
//
// KEIN MODELL: der manuelle Weg braucht keins; die Sonde läuft im hermetischen Tor. Den realen
// Anbieterlauf belegt die Modell-Sonde. Nur Chromium — der vorhandene Browserprüfweg; Firefox und
// WebKit sind hier nicht abgenommen. Keine Menschenprobe: geprüft wird automatisierte Bedienung.
import { type Locator, type Page, type TestInfo, expect, test } from "@playwright/test";
import { ensureLoggedIn } from "./support/auth";

test.skip(({ browserName }) => browserName !== "chromium", "Bedienprobe im Chromium-Prüfweg");

const KENNWORT = "Ki-Arbeitsweg-Kennwort-1";

interface TaskConfig {
  global: string;
  perTask: Record<string, string>;
  kiFreigabe?: { oeffentlicheKi?: boolean; vertraulicheInhalte?: boolean };
}

function marke(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

async function anmelden(page: Page, email: string): Promise<void> {
  await page.goto("/");
  const pw = page.locator('input[type="password"]');
  await expect(pw.first()).toBeVisible({ timeout: 15_000 });
  await page.locator('input[type="email"]').fill(email);
  await pw.first().fill(KENNWORT);
  await page.locator('button[type="submit"]').click();
  await expect(page.getByTestId("kopfband")).toBeVisible({ timeout: 15_000 });
}

/** Klara öffnen und warten, bis das gespeicherte Gespräch und der KI-Arbeitsweg geladen sind. */
async function oeffnen(page: Page): Promise<Locator> {
  await page.goto("/klara-vorschau");
  const figur = page.getByTestId("klara-figur");
  await expect(figur).toBeVisible({ timeout: 15_000 });
  if (!(await page.getByTestId("klara-gespraech").isVisible())) {
    await figur.click();
  }
  await expect(page.getByTestId("klara-echt-hinweis")).toHaveAttribute("data-laden", "bereit", {
    timeout: 15_000,
  });
  return page.getByTestId("ki-arbeitsweg");
}

async function bild(page: Page, info: TestInfo, name: string): Promise<void> {
  await info.attach(`KI-Arbeitsweg — ${name}`, {
    body: await page.screenshot({ fullPage: false }),
    contentType: "image/png",
  });
}

async function konfig(admin: Page, daten: TaskConfig): Promise<void> {
  const antwort = await admin.request.put("/api/reasoner/config", { data: daten });
  expect(antwort.status(), await antwort.text()).toBe(200);
}

test("KI-Arbeitsweg · Auftrag, Prompt, Übergabe, Antwort und sichtbare Sperren in der Oberfläche", async ({
  page,
  browser,
}, info) => {
  test.setTimeout(180_000);
  const admin = page;
  await ensureLoggedIn(admin);

  // Kandidat und Host — gebunden an DIESEN Lauf.
  const health = (await (await admin.request.get("/health")).json()) as {
    version?: string;
    commit?: string;
  };
  await info.attach("kandidat-und-host.json", {
    contentType: "application/json",
    body: JSON.stringify(
      {
        kandidat: { version: health.version ?? null, commit: health.commit ?? null },
        host: {
          browser: browser.browserType().name(),
          browserVersion: browser.version(),
          userAgent: await admin.evaluate(() => navigator.userAgent),
        },
      },
      null,
      2,
    ),
  });

  const vorher = (
    (await (await admin.request.get("/api/reasoner/config")).json()) as { taskConfig: TaskConfig }
  ).taskConfig;
  const freigabe = (oeffentlicheKi: boolean) => ({
    oeffentlicheKi,
    vertraulicheInhalte: vorher.kiFreigabe?.vertraulicheInhalte === true,
  });

  try {
    // Grundfreigabe öffentlicher KI über den vorhandenen Adminweg; Zuordnung unverändert.
    await konfig(admin, {
      global: vorher.global,
      perTask: vorher.perTask,
      kiFreigabe: freigabe(true),
    });

    // Synthetische, ausdrücklich interne Quelle und ein eigenes Konto (Experte).
    const ko = (await (
      await admin.request.post("/api/kos", {
        data: {
          title: `Synthetisches Preisblatt ${marke()}`,
          statement: "Der Listenpreis beträgt 120 EUR je Lizenz.",
          type: "best_practice",
          category: "Test",
          confidentiality: "intern",
        },
      })
    ).json()) as { id: string };
    expect(typeof ko.id).toBe("string");
    const email = `ki-arbeitsweg-${marke()}@klarwerk.test`;
    const konto = await admin.request.post("/api/users", {
      data: { name: "KI Arbeitsweg Probe", email, password: KENNWORT, role: "experte" },
    });
    expect(konto.status(), await konto.text()).toBe(201);

    const kontext = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const p = await kontext.newPage();
    await anmelden(p, email);
    await oeffnen(p);
    // Ein gespeichertes Gespräch entsteht mit der Einwilligung — erst dann gibt es den KI-Arbeitsweg.
    await p.getByTestId("klara-einwilligung-erteilen").click();
    await expect(p.getByTestId("klara-einwilligung-erteilt")).toBeVisible();
    const panel = p.getByTestId("ki-arbeitsweg");
    await expect(panel).toBeVisible({ timeout: 15_000 });

    const vorbereiten = async (ziel: string) => {
      await p.getByTestId("ki-arbeitsweg-ziel").fill(ziel);
      await p.getByTestId("ki-arbeitsweg-format").selectOption("stichpunkte");
      await p.getByTestId("ki-arbeitsweg-anbieter").selectOption("anthropic");
      await p.getByTestId("ki-arbeitsweg-weg").selectOption("prompt_manuell");
      await p.getByTestId("ki-arbeitsweg-weitere").fill(ko.id);
      await p.getByTestId("ki-arbeitsweg-weitere-freigeben").check();
      await p.getByTestId("ki-arbeitsweg-vorbereiten").click();
      const karte = p.getByTestId("ki-auftrag").filter({ hasText: ziel });
      await expect(karte).toHaveAttribute("data-status", "vorbereitet", { timeout: 15_000 });
      return karte;
    };

    // 1. Auftrag vorbereiten → Prompt sichtbar, mit der freigegebenen Quelle.
    const zielEins = `Fasse die Preisbedingungen zusammen ${marke()}`;
    const eins = await vorbereiten(zielEins);
    await expect(eins.getByTestId("ki-auftrag-prompt")).toHaveValue(
      /Der Listenpreis beträgt 120 EUR je Lizenz\./,
    );
    await bild(p, info, "1 Auftrag vorbereitet, Prompt sichtbar");

    // 2. Übergeben, Ergebnis einfügen → Antwort und Beleg.
    await eins.getByTestId("ki-auftrag-uebergeben").click();
    await expect(eins).toHaveAttribute("data-status", "gesendet", { timeout: 15_000 });
    await expect(p.getByTestId("ki-arbeitsweg-hinweis")).toBeVisible();
    const antwort = "- Listenpreis: 120 EUR je Lizenz";
    await eins.getByTestId("ki-auftrag-ergebnis").fill(antwort);
    await eins.getByTestId("ki-auftrag-ergebnis-speichern").click();
    await expect(eins).toHaveAttribute("data-status", "antwort_erhalten", { timeout: 15_000 });
    await expect(eins.getByTestId("ki-auftrag-antwort")).toContainText(antwort);
    await expect(eins.getByTestId("ki-auftrag-beleg")).toHaveAttribute(
      "data-klasse",
      "manuelle_uebergabe",
    );
    await bild(p, info, "2 übergeben, Antwort und Beleg sichtbar");

    // 3. Sichtbare Sperre „Keine KI": ein vorbereiteter Prompt verschwindet.
    const zielZwei = `Zweiter Auftrag ${marke()}`;
    const zwei = await vorbereiten(zielZwei);
    await expect(zwei.getByTestId("ki-auftrag-prompt")).toBeVisible();
    await konfig(admin, {
      global: vorher.global,
      perTask: { ...vorher.perTask, answer: "deterministic" },
      kiFreigabe: freigabe(true),
    });
    await oeffnen(p);
    await expect(p.getByTestId("ki-arbeitsweg-keine-ki")).toBeVisible({ timeout: 15_000 });
    await expect(p.getByTestId("ki-arbeitsweg-vorbereiten")).toHaveCount(0);
    const zweiGesperrt = p.getByTestId("ki-auftrag").filter({ hasText: zielZwei });
    await expect(zweiGesperrt.getByTestId("ki-auftrag-weg-gesperrt")).toContainText("Keine KI");
    await expect(zweiGesperrt.getByTestId("ki-auftrag-prompt")).toHaveCount(0);
    await expect(zweiGesperrt.getByTestId("ki-auftrag-uebergeben")).toBeDisabled();
    await bild(p, info, "3 Keine KI: Prompt weg, Sperrsatz sichtbar");

    // 4. Sichtbare Sperre nach Rechteentzug: Antworttext zurückgehalten.
    await konfig(admin, {
      global: vorher.global,
      perTask: vorher.perTask,
      kiFreigabe: freigabe(true),
    });
    const entzug = await admin.request.put(`/api/kos/${ko.id}`, {
      data: { action: "confidentiality", level: "vertraulich" },
    });
    expect(entzug.status(), await entzug.text()).toBe(200);
    await oeffnen(p);
    const einsEntzogen = p.getByTestId("ki-auftrag").filter({ hasText: zielEins });
    await expect(einsEntzogen.getByTestId("ki-auftrag-zurueckgehalten")).toBeVisible({
      timeout: 15_000,
    });
    await expect(einsEntzogen.getByTestId("ki-auftrag-paket-veraltet")).toBeVisible();
    await expect(einsEntzogen).not.toContainText(antwort);
    await expect(p.getByTestId("ki-arbeitsweg")).not.toContainText("120 EUR je Lizenz");
    await bild(p, info, "4 Rechteentzug: Inhalte zurückgehalten");

    await kontext.close();
  } finally {
    await konfig(admin, {
      global: vorher.global,
      perTask: vorher.perTask,
      kiFreigabe: freigabe(vorher.kiFreigabe?.oeffentlicheKi === true),
    });
  }
});
