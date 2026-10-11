import { createHmac } from "node:crypto";
import { type Browser, type Page, expect, test } from "@playwright/test";

import { SMOKE_PASS, ensureLoggedIn, workspaceMarker } from "./support/auth";

// ================================================================================================
// R-0562 · EIGENE ZWEI-FAKTOR-ANMELDUNG IN DER ECHTEN APP — ohne Firmen-Anmeldedienst.
// ================================================================================================
//
// Geklickt wird im echten Browser gegen den echten Smoke-Server (auf diesem Server ist KEIN SSO
// konfiguriert — der zweite Faktor kommt also nachweislich nicht aus einem Anmeldedienst):
//   1. Ein Konto richtet im Profil die Zwei-Faktor-Anmeldung ein (Passwort → Schlüssel → Code).
//   2. In einem frischen Browser reicht das Passwort allein nicht mehr: es erscheint der Codeschritt,
//      ein falscher Code wird abgewiesen, und der Server gibt ohne Code keine Sitzung heraus.
//   3. Mit dem Code vom „zweiten Gerät" ist die Anmeldung vollständig.
//
// DAS ZWEITE GERÄT IST HIER DIESER TEST: er rechnet den Code mit einer EIGENEN, unabhängigen
// RFC-6238-Umsetzung aus dem angezeigten Schlüssel — genau das, was eine Authenticator-App tut. Er
// importiert dafür bewusst nichts aus dem Produkt; stimmten Produkt und RFC nicht überein, fiele es
// hier auf. Eine echte App auf einem echten Telefon ersetzt das nicht (benannt in der Rückgabe).
//
// JEDER LAUF HAT SEINE EIGENEN NAMEN; alle Konten sind erfundene Testdaten.

const BASE32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function base32(text: string): Buffer {
  let bits = 0;
  let wert = 0;
  const bytes: number[] = [];
  for (const z of text.replace(/\s/g, "")) {
    wert = (wert << 5) | BASE32.indexOf(z);
    bits += 5;
    if (bits >= 8) {
      bytes.push((wert >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

/** RFC 6238: HMAC-SHA1, 30 s, 6 Stellen — `versatz` in Zeitschritten relativ zu jetzt. */
function geraeteCode(schluessel: string, versatz = 0): string {
  const schritt = Math.floor(Date.now() / 30_000) + versatz;
  const zaehler = Buffer.alloc(8);
  zaehler.writeBigUInt64BE(BigInt(schritt));
  const hmac = createHmac("sha1", base32(schluessel)).update(zaehler).digest();
  const o = (hmac[hmac.length - 1] ?? 0) & 0x0f;
  return String((hmac.readUInt32BE(o) & 0x7fffffff) % 1_000_000).padStart(6, "0");
}

function marke(): string {
  const buchstaben = "abcdefghijklmnopqrstuvwxyz";
  let raus = "";
  for (let i = 0; i < 8; i += 1) {
    raus += buchstaben[Math.floor(Math.random() * buchstaben.length)];
  }
  return raus;
}

async function frischeSeite(browser: Browser): Promise<Page> {
  const kontext = await browser.newContext();
  return kontext.newPage();
}

async function mitPasswortAnmelden(page: Page, email: string): Promise<void> {
  await page.goto("/");
  await expect(page.locator('input[type="password"]')).toBeVisible({ timeout: 15_000 });
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(SMOKE_PASS);
  await page.locator('button[type="submit"]').click();
}

test.describe("R-0562 · eigene Zwei-Faktor-Anmeldung", () => {
  test("K1: einrichten im Profil, danach verlangt die Anmeldung den Code vom zweiten Gerät", async ({
    page,
    browser,
  }) => {
    await ensureLoggedIn(page);
    const m = marke();
    const email = `anna-${m}@zweifaktor.test`;
    const angelegt = await page.request.post("/api/users", {
      data: { name: `Anna ${m}`, email, password: SMOKE_PASS, role: "experte" },
    });
    expect(angelegt.status(), await angelegt.text()).toBe(201);

    // Kein SSO auf diesem Server — der zweite Faktor kann also nur aus dem Produkt selbst kommen.
    const status = await page.request.get("/api/auth/status");
    expect(((await status.json()) as { oidcEnabled?: boolean }).oidcEnabled).toBe(false);

    // ── 1. Einrichten, als Anna, im eigenen Browser ────────────────────────────────────────────
    const anna = await frischeSeite(browser);
    await mitPasswortAnmelden(anna, email);
    await expect(workspaceMarker(anna)).toBeVisible({ timeout: 15_000 });
    // Den Pflichthinweis quittieren, damit kein Banner über dem Profil liegt.
    await anna.request.post("/api/auth/notice");
    await anna.goto("/profil");
    await expect(anna.getByTestId("zeile-zweifaktor")).toBeVisible({ timeout: 15_000 });
    await expect(anna.getByTestId("zeile-zweifaktor")).toContainText(/Aus|Off|Uit/);
    await anna.getByTestId("zeile-zweifaktor").click();
    await expect(anna.getByTestId("detail-zweifaktor")).toBeVisible();
    await anna.getByTestId("zweifaktor-passwort").fill(SMOKE_PASS);
    await anna.getByTestId("zweifaktor-absenden").click();
    const schluesselFeld = anna.getByTestId("zweifaktor-schluessel");
    await expect(schluesselFeld).toBeVisible({ timeout: 15_000 });
    const schluessel = ((await schluesselFeld.textContent()) ?? "").replace(/\s/g, "");
    expect(schluessel).toMatch(/^[A-Z2-7]{32}$/);
    await test.info().attach("einrichtung-schluessel", {
      body: await anna.getByTestId("detail-zweifaktor").screenshot(),
      contentType: "image/png",
    });
    await anna.getByTestId("zweifaktor-code").fill(geraeteCode(schluessel));
    await anna.getByTestId("zweifaktor-absenden").click();
    await expect(anna.getByTestId("zweifaktor-meldung")).toBeVisible({ timeout: 15_000 });
    const eingerichtet = await anna.request.get("/api/auth/second-factor");
    expect(((await eingerichtet.json()) as { active: boolean }).active).toBe(true);
    await test.info().attach("eingeschaltet", {
      body: await anna.getByTestId("detail-zweifaktor").screenshot(),
      contentType: "image/png",
    });
    await anna.context().close();

    // ── 2. Neuer Browser: Passwort allein reicht nicht mehr ────────────────────────────────────
    const spaeter = await frischeSeite(browser);
    await mitPasswortAnmelden(spaeter, email);
    const codeFeld = spaeter.getByTestId("auth-second-factor-code");
    await expect(codeFeld).toBeVisible({ timeout: 15_000 });
    await expect(workspaceMarker(spaeter)).toHaveCount(0);
    // Ohne Code gibt der Server KEINE Sitzung heraus — weder Cookie noch Token.
    const nurPasswort = await spaeter.request.post("/api/auth/login", {
      data: { email, password: SMOKE_PASS },
    });
    expect(nurPasswort.status()).toBe(200);
    const nurPasswortRumpf = (await nurPasswort.json()) as Record<string, unknown>;
    expect(nurPasswortRumpf.secondFactorRequired).toBe(true);
    expect(nurPasswortRumpf.token).toBeUndefined();
    expect(nurPasswort.headers()["set-cookie"]).toBeUndefined();
    expect((await spaeter.request.get("/api/auth/me")).status()).toBe(401);
    await test.info().attach("codeschritt", {
      body: await spaeter.screenshot(),
      contentType: "image/png",
    });

    // Ein falscher Code wird abgewiesen (ein gültiger Code ist nie "000000" UND zugleich dieser).
    const falsch = geraeteCode(schluessel) === "000000" ? "111111" : "000000";
    await codeFeld.fill(falsch);
    await spaeter.locator('button[type="submit"]').click();
    // Der Satz kommt vom Server in der Sprache des Browsers — geprüft wird die Fläche.
    await expect(spaeter.getByTestId("auth-error")).toBeVisible({ timeout: 15_000 });
    await expect(workspaceMarker(spaeter)).toHaveCount(0);

    // ── 3. Mit dem Code vom zweiten Gerät ist die Anmeldung vollständig ────────────────────────
    // Der nächste Zeitschritt: der Code der Einrichtung ist verbraucht (ein Code, eine Anmeldung),
    // und der Server nimmt einen Schritt Uhrabweichung an.
    await codeFeld.fill(geraeteCode(schluessel, 1));
    await spaeter.locator('button[type="submit"]').click();
    await expect(workspaceMarker(spaeter)).toBeVisible({ timeout: 15_000 });
    const ich = await spaeter.request.get("/api/auth/me");
    expect(ich.status()).toBe(200);
    expect(((await ich.json()) as { email: string }).email).toBe(email);
    await test.info().attach("angemeldet", {
      body: await spaeter.screenshot(),
      contentType: "image/png",
    });
    await spaeter.context().close();
  });
});
