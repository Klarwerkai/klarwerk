import { type APIRequestContext, type Page, expect, test } from "@playwright/test";

import { SMOKE_PASS, ensureLoggedIn } from "./support/auth";

// ================================================================================================
// HAUPTVERANTWORTUNG ÜBERGEBEN IN DER ECHTEN APP — Kontokarte, Pakete, Vorschau, Übergabe, Zugang.
// ================================================================================================
//
// Geklickt wird im echten Browser gegen den echten Smoke-Server (produkt:20261007:ownership-uebergabe):
//   K1/K2 · Drei Beiträge einer Person auf ZWEI Nachfolger verteilen; die Vorschau nennt je
//           Nachfolger die Anzahl; vor „Übergabe ausführen" ist nichts geändert.
//   K4/K6 · Danach trägt jeder Beitrag den gewählten Nachfolger; Autor und Fassung sind unverändert
//           (vom Server bestätigt).
//   K5    · „Übergeben und Zugang beenden" beendet den Zugang erst ohne Restbestand; die Person
//           kommt danach nicht mehr herein.
//   K3    · Ein Teilfehler wird angezeigt und „Offene erneut übertragen" holt genau den Rest nach.
//
// WAS AM K3-FALL SIMULIERT IST — ehrlich benannt: der Smoke-Server hat keinen Störschalter. Der
// erste Übergabeaufruf wird deshalb unterwegs verändert: ein Beitrag wird aus der Anfrage
// genommen (der Server überträgt ihn also WIRKLICH nicht), und die echte Antwort bekommt für ihn
// eine `fehlgeschlagen`-Zeile und den Status 207 — genau die Gestalt, die der Server bei einem
// Schreibfehler sendet (gemessen in `tests/ownership-uebergabe/uebergabe-api.test.ts`). Die
// Wiederholung läuft unverändert gegen den Server.
//
// JEDER LAUF HAT SEINE EIGENEN NAMEN; alle Konten und Inhalte sind erfundene Testdaten.

function marke(): string {
  const buchstaben = "abcdefghijklmnopqrstuvwxyz";
  let raus = "";
  for (let i = 0; i < 8; i += 1) {
    raus += buchstaben[Math.floor(Math.random() * buchstaben.length)];
  }
  return raus;
}

async function kontoAnlegen(
  request: APIRequestContext,
  name: string,
  email: string,
  role: string,
): Promise<string> {
  const res = await request.post("/api/users", {
    data: { name, email, password: SMOKE_PASS, role },
  });
  expect(res.status(), await res.text()).toBe(201);
  return ((await res.json()) as { id: string }).id;
}

/** Ein Beitrag, für den `owner` hauptverantwortlich ist (Autor bleibt das Smoke-Konto). */
async function beitragFuer(
  request: APIRequestContext,
  titel: string,
  owner: string,
  stufe = "intern",
): Promise<{ id: string; version: number; author: string }> {
  const angelegt = await request.post("/api/kos", {
    data: {
      confidentiality: stufe,
      title: titel,
      statement: `${titel} wird vor jeder Schicht geprüft.`,
      type: "best_practice",
      category: "Prüfmittel",
    },
  });
  expect(angelegt.status(), await angelegt.text()).toBe(201);
  const ko = (await angelegt.json()) as { id: string; version: number; author: string };
  const gesetzt = await request.put(`/api/kos/${ko.id}`, {
    data: { action: "ownership", ownership: { owner } },
  });
  expect(gesetzt.status(), await gesetzt.text()).toBe(200);
  return ko;
}

async function verantwortlich(request: APIRequestContext, koId: string) {
  const res = await request.get(`/api/kos/${koId}`);
  expect(res.status()).toBe(200);
  return (await res.json()) as {
    version: number;
    author: string;
    ownership?: { owner?: string };
  };
}

async function karteOeffnen(page: Page, personId: string): Promise<void> {
  await page.goto(`/admin?bereich=konten&detail=${encodeURIComponent(`nutzer:${personId}`)}`);
  await expect(page.getByTestId("detail-nutzer")).toBeVisible({ timeout: 15_000 });
  await page.getByTestId("verantwortung-oeffnen").click();
  await expect(page.getByTestId("verantwortung-flaeche")).toBeVisible({ timeout: 15_000 });
}

async function zuteilen(page: Page, koIds: readonly string[], ziel: string): Promise<void> {
  for (const id of koIds) {
    await page
      .locator(`[data-testid="verantwortung-zeile"][data-ko="${id}"]`)
      .getByTestId("verantwortung-auswahl")
      .check();
  }
  await page.getByTestId("verantwortung-ziel").selectOption({ label: ziel });
  await page.getByTestId("verantwortung-zuteilen").click();
}

test.describe("Hauptverantwortung übergeben · der Weg in der echten App", () => {
  test("K1/K2/K4/K5/K6: auf zwei Nachfolger verteilen, Vorschau, Übergabe, Zugang beenden", async ({
    page,
    request,
  }) => {
    await ensureLoggedIn(page);
    const m = marke();
    const paulaName = `Paula ${m}`;
    const noraName = `Nora ${m}`;
    const ottoName = `Otto ${m}`;
    const paulaMail = `paula-${m}@uebergabe.test`;
    const paula = await kontoAnlegen(page.request, paulaName, paulaMail, "experte");
    const nora = await kontoAnlegen(page.request, noraName, `nora-${m}@uebergabe.test`, "experte");
    const otto = await kontoAnlegen(
      page.request,
      ottoName,
      `otto-${m}@uebergabe.test`,
      "controller",
    );
    const k1 = await beitragFuer(page.request, `Messschieber ${m}`, paula);
    const k2 = await beitragFuer(page.request, `Lehrring ${m}`, paula);
    const k3 = await beitragFuer(page.request, `Prüfstift ${m}`, paula);

    await karteOeffnen(page, paula);
    await expect(page.getByTestId("verantwortung-zeile")).toHaveCount(3);
    await expect(page.getByTestId("verantwortung-stand")).toContainText("3 Beiträge");
    // Nur zulässige aktive Nachfolger: Paula selbst steht nicht zur Wahl.
    const zielwahl = page.getByTestId("verantwortung-ziel");
    const optionen = await zielwahl.locator("option").allTextContents();
    expect(optionen).toContain(noraName);
    expect(optionen).toContain(ottoName);
    expect(optionen).not.toContain(paulaName);

    await zuteilen(page, [k1.id, k2.id], noraName);
    await zuteilen(page, [k3.id], ottoName);
    await page.getByTestId("verantwortung-vorschau-holen").click();
    const vorschau = page.getByTestId("verantwortung-vorschau");
    await expect(vorschau).toBeVisible({ timeout: 15_000 });
    await expect(vorschau.locator(`[data-an="${nora}"]`)).toContainText(`${noraName}: 2 Beiträge`);
    await expect(vorschau.locator(`[data-an="${otto}"]`)).toContainText(`${ottoName}: 1 Beiträge`);
    await expect(vorschau).toContainText(`Messschieber ${m}`);
    await expect(page.getByTestId("verantwortung-verbleibt")).toContainText(": 0 Beiträge");
    await test.info().attach("vorschau", {
      body: await page.getByTestId("verantwortung-flaeche").screenshot(),
      contentType: "image/png",
    });
    // Vor der Ausführung ist nichts geschehen.
    expect((await verantwortlich(page.request, k1.id)).ownership?.owner).toBe(paula);

    await page.getByTestId("verantwortung-ausfuehren").click();
    const ergebnis = page.getByTestId("verantwortung-ergebnis");
    await expect(ergebnis).toHaveAttribute("data-vollstaendig", "ja", { timeout: 15_000 });
    await expect(ergebnis).toContainText("3 Beiträge übertragen");
    for (const [ko, an] of [
      [k1, nora],
      [k2, nora],
      [k3, otto],
    ] as const) {
      const nachher = await verantwortlich(page.request, ko.id);
      expect(nachher.ownership?.owner).toBe(an);
      expect(nachher.author).toBe(ko.author);
      expect(nachher.version).toBe(ko.version);
    }
    await expect(page.getByTestId("verantwortung-zeile")).toHaveCount(0, { timeout: 15_000 });

    // K5: jetzt liegt nichts mehr bei Paula — der Zugang darf enden.
    await page.getByTestId("verantwortung-deaktivieren").click();
    await expect(page.getByTestId("verantwortung-meldung")).toContainText("Zugang beendet", {
      timeout: 15_000,
    });
    await test.info().attach("zugang-beendet", {
      body: await page.getByTestId("detail-nutzer").screenshot(),
      contentType: "image/png",
    });
    // Ein eigener Anfragekontext ohne die Sitzung der Seite: Paula selbst versucht sich anzumelden.
    const anmeldung = await request.post("/api/auth/login", {
      data: { email: paulaMail, password: SMOKE_PASS },
    });
    expect(anmeldung.status()).toBe(403);
  });

  test("K5: ohne Übergabe bleibt der Zugang offen; K3: ein Teilfehler wird angezeigt und nachgeholt", async ({
    page,
  }) => {
    await ensureLoggedIn(page);
    const m = marke();
    const paulaName = `Paula ${m}`;
    const noraName = `Nora ${m}`;
    const paulaMail = `paula-${m}@uebergabe.test`;
    const paula = await kontoAnlegen(page.request, paulaName, paulaMail, "experte");
    const nora = await kontoAnlegen(page.request, noraName, `nora-${m}@uebergabe.test`, "experte");
    const k1 = await beitragFuer(page.request, `Härteprüfer ${m}`, paula);
    const k2 = await beitragFuer(page.request, `Rauheitsmesser ${m}`, paula);

    // Löschen ist gesperrt, solange Paula Beiträge verantwortet.
    const loeschen = await page.request.delete(`/api/users/${paula}`);
    expect(loeschen.status(), await loeschen.text()).toBe(409);

    let erster = true;
    await page.route("**/api/verantwortung/uebergabe", async (route) => {
      if (!erster) {
        await route.continue();
        return;
      }
      erster = false;
      const eingabe = route.request().postDataJSON() as {
        von: string;
        zuteilung: { koId: string; an: string }[];
      };
      const zurueck = eingabe.zuteilung.find((z) => z.koId === k2.id);
      const rest = eingabe.zuteilung.filter((z) => z.koId !== k2.id);
      const postData = JSON.stringify({ ...eingabe, zuteilung: rest });
      const antwort = await route.fetch({ postData });
      const echt = (await antwort.json()) as Record<string, unknown>;
      await route.fulfill({
        response: antwort,
        status: 207,
        json: {
          ...echt,
          vollstaendig: false,
          verbleibt: 1,
          fehlgeschlagen: [
            {
              koId: k2.id,
              titel: `Rauheitsmesser ${m}`,
              an: zurueck?.an ?? nora,
              anName: noraName,
              grund: "SCHREIBFEHLER",
              text: "Der Beitrag konnte nicht gespeichert werden. Er ist unverändert und kann erneut übertragen werden.",
            },
          ],
        },
      });
    });

    await karteOeffnen(page, paula);
    await zuteilen(page, [k1.id, k2.id], noraName);
    await page.getByTestId("verantwortung-vorschau-holen").click();
    await expect(page.getByTestId("verantwortung-vorschau")).toBeVisible({ timeout: 15_000 });
    await page.getByTestId("verantwortung-ausfuehren").click();

    const ergebnis = page.getByTestId("verantwortung-ergebnis");
    await expect(ergebnis).toHaveAttribute("data-vollstaendig", "nein", { timeout: 15_000 });
    await expect(ergebnis).toContainText("1 offen");
    await expect(
      page.getByTestId("verantwortung-offen").locator(`[data-ko="${k2.id}"]`),
    ).toContainText("erneut übertragen");
    await test.info().attach("teilfehler", {
      body: await page.getByTestId("verantwortung-flaeche").screenshot(),
      contentType: "image/png",
    });
    expect((await verantwortlich(page.request, k1.id)).ownership?.owner).toBe(nora);
    expect((await verantwortlich(page.request, k2.id)).ownership?.owner).toBe(paula);

    // Solange K2 offen ist, endet der Zugang nicht.
    const zuFrueh = await page.request.post("/api/verantwortung/deaktivierung", {
      data: { person: paula },
    });
    expect(zuFrueh.status()).toBe(409);

    await page.getByTestId("verantwortung-erneut").click();
    await expect(ergebnis).toHaveAttribute("data-vollstaendig", "ja", { timeout: 15_000 });
    await expect(ergebnis).toContainText("1 Beiträge übertragen");
    expect((await verantwortlich(page.request, k2.id)).ownership?.owner).toBe(nora);
  });

  // Nacharbeit 2 (Ben K2): die Auswahlliste bietet für ein Paket nur an, wer JEDEN seiner Beiträge
  // übernehmen darf — hier fehlt Nora, sobald ein vertraulicher Beitrag im Paket ist.
  test("K2: die Nachfolgerauswahl gilt für das angehakte Paket", async ({ page }) => {
    await ensureLoggedIn(page);
    const m = marke();
    const noraName = `Nora ${m}`;
    const ottoName = `Otto ${m}`;
    const paulaMail = `paula-${m}@uebergabe.test`;
    const paula = await kontoAnlegen(page.request, `Paula ${m}`, paulaMail, "experte");
    await kontoAnlegen(page.request, noraName, `nora-${m}@uebergabe.test`, "experte");
    await kontoAnlegen(page.request, ottoName, `otto-${m}@uebergabe.test`, "controller");
    const intern = await beitragFuer(page.request, `Messuhr ${m}`, paula);
    const geheim = await beitragFuer(page.request, `Prüflabor ${m}`, paula, "vertraulich");

    await karteOeffnen(page, paula);
    const zeile = (id: string) =>
      page
        .locator(`[data-testid="verantwortung-zeile"][data-ko="${id}"]`)
        .getByTestId("verantwortung-auswahl");
    const zielwahl = page.getByTestId("verantwortung-ziel");

    await zeile(geheim.id).check();
    await expect(zielwahl).toContainText(ottoName);
    await expect(zielwahl).not.toContainText(noraName);

    await zeile(geheim.id).uncheck();
    await zeile(intern.id).check();
    await expect(zielwahl).toContainText(noraName);
    await expect(zielwahl).toContainText(ottoName);
    await test.info().attach("auswahl-je-paket", {
      body: await page.getByTestId("verantwortung-flaeche").screenshot(),
      contentType: "image/png",
    });
  });
});
