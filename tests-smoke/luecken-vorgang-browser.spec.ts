import { type APIRequestContext, type Browser, type Page, expect, test } from "@playwright/test";

import { ensureLoggedIn, workspaceMarker } from "./support/auth";

// ================================================================================================
// WISSENSLÜCKE BIS ZUR GEPRÜFTEN ANTWORT UND RÜCKMELDUNG — IM ECHTEN BROWSER
// (produkt:20261010:wissenskreislauf-schliessen).
// ================================================================================================
//
// Geklickt wird gegen den Smoke-Server mit GETRENNTEN fiktiven Rollen, je in eigenem Browserkontext:
//   Frida (fragt, Experte) · Fachmann (Fachzuständigkeit, Experte) · Smoke-Admin (Verwaltung) ·
//   drei Prüfende (Controller, bewerten über die vorhandene Bewertungsroute).
//
//   Frage → Lücke → „Keine Fachzuständigkeit" sichtbar → Frida übergibt an Fachmann → Rückfrage →
//   Frida sieht sie in der Glocke, springt in den Vorgang und antwortet → Fachmann verknüpft seinen
//   eingereichten Eintrag → Abschluss gesperrt, auch nach einer Verwalterfreigabe OHNE Bewertungen →
//   vorgeschriebene Bewertungen → fachlicher Abschluss → Frida bekommt GENAU EINE Erfolgsmeldung,
//   öffnet das Ergebnis → dieselbe Frage erneut nutzt denselben Eintrag.
//
// Die Frage geht über die Ask-Schnittstelle in Fridas eigener Sitzung (dieselbe, die die
// Fragenseite benutzt); alles danach wird in der Oberfläche bedient. Zustand anlegend — läuft
// deshalb im isolierten Kontext (`chromium-zustand`). Alle Konten und Inhalte sind erfundene
// Testdaten mit Laufmarke.
//
// WAS NICHT GEMESSEN IST: Rechteentzug, Doppelaktion, mehrere Fragende und administrative Rücknahme
// im Browser (am Draht in `tests/wissenskreislauf/vorgang-am-draht.test.ts`), und ob Menschen die
// Fläche verstehen.

const PASS = "Luecke-Passwort-1";

function marke(): string {
  const buchstaben = "abcdefghijklmnopqrstuvwxyz";
  let raus = "";
  for (let i = 0; i < 8; i += 1) {
    raus += buchstaben[Math.floor(Math.random() * buchstaben.length)];
  }
  return raus;
}

async function bild(page: Page, name: string): Promise<void> {
  await test.info().attach(name, { body: await page.screenshot(), contentType: "image/png" });
}

async function kontoAnlegen(
  admin: APIRequestContext,
  name: string,
  email: string,
  role: string,
): Promise<string> {
  const res = await admin.post("/api/users", { data: { name, email, password: PASS, role } });
  expect(res.status(), await res.text()).toBe(201);
  return ((await res.json()) as { id: string }).id;
}

async function anmelden(browser: Browser, email: string): Promise<Page> {
  const adresse = test.info().project.use.baseURL;
  const kontext = await browser.newContext(adresse === undefined ? {} : { baseURL: adresse });
  const seite = await kontext.newPage();
  await seite.goto("/");
  await expect(seite.locator('input[type="password"]').first()).toBeVisible({ timeout: 15_000 });
  await seite.locator('input[type="email"]').fill(email);
  await seite.locator('input[type="password"]').first().fill(PASS);
  await seite.locator('button[type="submit"]').click();
  await expect(workspaceMarker(seite)).toBeVisible({ timeout: 15_000 });
  if (await seite.getByTestId("notice-ack").count()) {
    await seite.getByTestId("notice-ack").click();
  }
  return seite;
}

async function vorgangOeffnen(seite: Page, gapId: string): Promise<void> {
  await seite.goto(`/luecke/${gapId}`);
  await expect(seite.getByTestId("luecke-vorgang-stand")).toBeVisible({ timeout: 15_000 });
}

test("Wissenskreislauf: Frage bis geprüfte Antwort und Rückmeldung mit getrennten Rollen", async ({
  page,
  browser,
  request,
}) => {
  test.setTimeout(180_000);
  await ensureLoggedIn(page);
  const m = marke();
  const frage = `Wie wird der Zyrlax-${m}-Kreislauf nach dem Stillstand eingestellt?`;
  await kontoAnlegen(page.request, `Frida ${m}`, `frida-${m}@luecke.test`, "experte");
  const fachmannName = `Fachmann ${m}`;
  await kontoAnlegen(page.request, fachmannName, `fachmann-${m}@luecke.test`, "experte");
  const pruefende: string[] = [];
  for (let i = 0; i < 5; i += 1) {
    const mail = `pruefer${i}-${m}@luecke.test`;
    await kontoAnlegen(page.request, `Prüfer ${i} ${m}`, mail, "controller");
    pruefende.push(mail);
  }

  const frida = await anmelden(browser, `frida-${m}@luecke.test`);
  const fachmann = await anmelden(browser, `fachmann-${m}@luecke.test`);
  try {
    // ---- Frage → Lücke; fehlende Zuständigkeit ist sichtbar ------------------------------------
    const gefragt = await frida.request.post("/api/ask", { data: { question: frage } });
    expect(gefragt.status(), await gefragt.text()).toBe(200);
    const gapId = ((await gefragt.json()) as { gap: { id: string } }).gap.id;
    await vorgangOeffnen(frida, gapId);
    await expect(frida.getByTestId("luecke-vorgang-stand")).toContainText(
      "Keine Fachzuständigkeit",
    );
    await expect(frida.getByTestId("luecke-vorgang-naechster")).toContainText(
      "An eine berechtigte Fachzuständigkeit übergeben",
    );
    await expect(frida.getByTestId("luecke-klara")).toContainText("keine Fachprüfung durch Klara");
    await bild(frida, "1-frida-ohne-zustaendigkeit");

    // ---- Übergabe an die Fachzuständigkeit ----------------------------------------------------
    await frida.getByTestId("luecke-uebergeben").selectOption({ label: fachmannName });
    await expect(frida.getByTestId("luecke-vorgang-stand")).toContainText(
      "In Bearbeitung durch die zuständige Person",
      { timeout: 15_000 },
    );
    await bild(frida, "2-frida-uebergeben");

    // ---- Rückfrage der zuständigen Person -----------------------------------------------------
    await vorgangOeffnen(fachmann, gapId);
    await fachmann.getByTestId("luecke-rueckfrage-text").fill("Welche Baureihe ist gemeint?");
    await fachmann.getByRole("button", { name: "Rückfrage senden" }).click();
    await expect(fachmann.getByTestId("luecke-vorgang-stand")).toContainText(
      "Rückfrage an die Fragenden offen",
      { timeout: 15_000 },
    );
    await bild(fachmann, "3-fachmann-rueckfrage");

    // ---- Frida: Glocke → Vorgang → Antwort ----------------------------------------------------
    await frida.goto("/start");
    await frida.getByTestId("kopfband-meldungen").click();
    const rueckfrage = frida.locator('[data-testid="meldung-oeffnen"][data-art="luecke"]').first();
    await expect(rueckfrage).toContainText("Rückfrage zu deiner Frage", { timeout: 15_000 });
    await bild(frida, "4-frida-glocke-rueckfrage");
    await rueckfrage.click();
    await expect(frida).toHaveURL(new RegExp(`/luecke/${gapId}`), { timeout: 15_000 });
    await frida.getByTestId("luecke-rueckfrage-antwort").fill("Baureihe 4, Werk Nord.");
    await frida.getByRole("button", { name: "Antwort senden" }).click();
    await expect(frida.getByTestId("luecke-vorgang-stand")).toContainText(
      "In Bearbeitung durch die zuständige Person",
      { timeout: 15_000 },
    );

    // ---- Fachmann: eingereichter Eintrag → verknüpft; Abschluss bleibt gesperrt ---------------
    // Der Eintrag teilt bewusst KEIN Wort mit der Frage (eigene Marke): so beantwortet die
    // Antwortsuche die Wiederholungsfrage nicht von selbst, und gemessen wird der Vorgangsweg.
    const m2 = marke();
    const angelegt = await fachmann.request.post("/api/kos", {
      data: {
        confidentiality: "intern",
        title: `Kälteanlage ${m2} im Wiederanlauf hochfahren`,
        statement: `Ventil V7 erst bei Druckausgleich öffnen, dann Pumpe P2 starten (${m2}).`,
        type: "best_practice",
        category: "Instandhaltung",
      },
    });
    expect(angelegt.status(), await angelegt.text()).toBe(201);
    const ko = (await angelegt.json()) as { id: string; title: string; neededValidations: number };
    await vorgangOeffnen(fachmann, gapId);
    await fachmann.getByTestId("luecke-entwurf-verknuepfen").selectOption(ko.id);
    await expect(fachmann.getByTestId("luecke-vorgang-stand")).toContainText(
      "Antwortentwurf in der Fachprüfung",
      { timeout: 15_000 },
    );
    await expect(fachmann.getByTestId("luecke-abschliessen")).toBeDisabled();
    // Eine Verwalterfreigabe OHNE die vorgeschriebenen Bewertungen ersetzt die Fachprüfung nicht.
    const verwalter = await page.request.put(`/api/kos/${ko.id}`, {
      data: { action: "admin-validate" },
    });
    expect(verwalter.status(), await verwalter.text()).toBe(200);
    await vorgangOeffnen(fachmann, gapId);
    await expect(fachmann.getByTestId("luecke-eintrag")).toHaveAttribute("data-nutzbar", "nein");
    await expect(fachmann.getByTestId("luecke-eintrag")).toContainText(
      "vorgeschriebene Bewertungen fehlen",
    );
    await expect(fachmann.getByTestId("luecke-abschliessen")).toBeDisabled();
    await bild(fachmann, "5-fachmann-abschluss-gesperrt");

    // ---- Vorgeschriebene Bewertungen über die vorhandene Bewertungsroute ----------------------
    for (const mail of pruefende.slice(0, ko.neededValidations)) {
      const login = await request.post("/api/auth/login", {
        data: { email: mail, password: PASS },
      });
      expect(login.status(), await login.text()).toBe(200);
      const token = ((await login.json()) as { token: string }).token;
      const bewertet = await request.put(`/api/kos/${ko.id}`, {
        headers: { authorization: `Bearer ${token}` },
        data: { action: "rate", verdict: "up" },
      });
      expect(bewertet.status(), await bewertet.text()).toBe(200);
    }

    // ---- Fachlicher Abschluss -----------------------------------------------------------------
    await vorgangOeffnen(fachmann, gapId);
    await expect(fachmann.getByTestId("luecke-vorgang-stand")).toContainText(
      "Fachprüfung bestanden",
    );
    await fachmann.getByTestId("luecke-abschliessen").click();
    await expect(fachmann.getByTestId("luecke-vorgang-stand")).toContainText("Fachlich gelöst", {
      timeout: 15_000,
    });
    await bild(fachmann, "6-fachmann-geloest");

    // ---- Frida: genau EINE Erfolgsmeldung, Ergebnis mit Quelle --------------------------------
    await frida.goto("/start");
    await frida.getByTestId("kopfband-meldungen").click();
    const geloest = frida.locator(
      '[data-testid="meldung-oeffnen"][data-art="luecke"]:has([data-luecken-art="geloest"])',
    );
    await expect(geloest).toHaveCount(1, { timeout: 15_000 });
    await expect(geloest).toContainText(ko.title);
    await bild(frida, "7-frida-glocke-geloest");
    await geloest.click();
    await expect(frida).toHaveURL(new RegExp(`/luecke/${gapId}`), { timeout: 15_000 });
    await expect(frida.getByTestId("luecke-eintrag")).toHaveAttribute("data-nutzbar", "ja");
    await bild(frida, "8-frida-ergebnis");
    await frida.getByTestId("luecke-ergebnis-oeffnen").click();
    await expect(frida).toHaveURL(new RegExp(`/wissen/${ko.id}`), { timeout: 15_000 });

    // ---- Wiederholungsfrage nutzt denselben gültigen Eintrag ----------------------------------
    const wieder = await frida.request.post("/api/ask", { data: { question: frage } });
    expect(wieder.status(), await wieder.text()).toBe(200);
    const antwort = (await wieder.json()) as {
      gap: unknown;
      geloesteLuecke?: { koId: string };
    };
    expect(antwort.gap).toBeNull();
    expect(antwort.geloesteLuecke?.koId).toBe(ko.id);
  } finally {
    await frida.context().close();
    await fachmann.context().close();
  }
});
