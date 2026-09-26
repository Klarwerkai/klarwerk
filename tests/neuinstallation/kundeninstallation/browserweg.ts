// ==================================================================================================
// DER BROWSERWEG DER KUNDENINSTALLATIONS-STRECKE — echtes Chromium, echtes HTTPS, echte Oberflaeche.
// ==================================================================================================
//
// Jedes Profil ist FRISCH: ein eigenes Nutzerdatenverzeichnis und ein eigenes HOME. Im HOME liegt
// der NSS-Speicher, aus dem Chromium unter Linux seine lokalen Vertrauensanker liest — dort und nur
// dort steht die Test-CA. `ignoreHTTPSErrors` bleibt aus: ein Zertifikat, das nicht gegen diese CA
// prueft, laesst die Seite nicht laden (die Gegenprobe dazu ist `tlsGegenprobe`).
//
// Die Selektoren sind die sichtbaren deutschen Beschriftungen aus `apps/web/src/i18n.ts` und die
// `data-testid`s, die auch `tests-smoke/**` benutzt. Wo eine Messung die Oberflaeche verlaesst
// (ein unerlaubter Schreibversuch, eine direkte Objektanfrage), geschieht das im Seitenkontext mit
// der Sitzung des angemeldeten Nutzers — nie mit einem zweiten, im Test gebauten Zugang.
import { createHash } from "node:crypto";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { type BrowserContext, type Page, type Response, chromium } from "playwright";

export interface Profil {
  name: string;
  kontext: BrowserContext;
  seite: Page;
  schliessen(): Promise<void>;
}

export interface Profilaufbau {
  /** Wurzel fuer Profil- und HOME-Verzeichnisse. */
  ordner: string;
  instanzname: string;
  /** Legt im HOME den NSS-Speicher mit der Test-CA an (nur fuer Profile, die ihr vertrauen sollen). */
  vertrauen: ((home: string) => Promise<void>) | null;
}

export async function oeffneProfil(name: string, aufbau: Profilaufbau): Promise<Profil> {
  const home = join(aufbau.ordner, `home-${name}`);
  const daten = join(aufbau.ordner, `profil-${name}`);
  mkdirSync(home, { recursive: true });
  mkdirSync(daten, { recursive: true });
  if (aufbau.vertrauen) {
    await aufbau.vertrauen(home);
  }
  const kontext = await chromium.launchPersistentContext(daten, {
    channel: "chromium",
    headless: true,
    locale: "de-DE",
    ignoreHTTPSErrors: false,
    serviceWorkers: "block",
    env: { ...process.env, HOME: home },
    args: [`--host-resolver-rules=MAP ${aufbau.instanzname} 127.0.0.1`],
  });
  const seite = kontext.pages()[0] ?? (await kontext.newPage());
  return { name, kontext, seite, schliessen: () => kontext.close() };
}

/** Ein Profil OHNE die Test-CA muss an der Zertifikatspruefung scheitern — sonst prueft niemand. */
export async function tlsGegenprobe(aufbau: Profilaufbau, basis: string): Promise<string> {
  const p = await oeffneProfil("ohne-vertrauen", { ...aufbau, vertrauen: null });
  try {
    await p.seite.goto(`${basis}/`, { timeout: 30_000 });
    return "GELADEN";
  } catch (fehler) {
    const text = String(fehler);
    return /ERR_CERT_[A-Z_]+/.exec(text)?.[0] ?? text.slice(0, 200);
  } finally {
    await p.schliessen();
  }
}

const KOPFBAND = '[data-testid="kopfband"]';

async function ueberschrift(seite: Page): Promise<string> {
  const h1 = seite.locator("h1").first();
  await h1.waitFor({ state: "visible", timeout: 60_000 });
  return (await h1.innerText()).trim();
}

export interface Konto {
  name: string;
  email: string;
  passwort: string;
}

/** Oeffnet die Instanz und liefert die Ueberschrift der ersten Maske („Ersteinrichtung" / „Anmelden"). */
export async function ersteMaske(seite: Page, basis: string): Promise<string> {
  await seite.goto(`${basis}/`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  return ueberschrift(seite);
}

export async function ersteinrichtung(seite: Page, admin: Konto): Promise<void> {
  await seite.locator("#auth-name").fill(admin.name);
  await seite.locator("#auth-email").fill(admin.email);
  await seite.locator("#auth-password").fill(admin.passwort);
  await seite.locator("#auth-password-repeat").fill(admin.passwort);
  await seite.getByRole("button", { name: "Admin anlegen & starten" }).click();
  await seite.locator(KOPFBAND).waitFor({ state: "visible", timeout: 60_000 });
}

export async function anmelden(seite: Page, basis: string, konto: Konto): Promise<string> {
  const maske = await ersteMaske(seite, basis);
  if (maske !== "Anmelden") {
    return maske;
  }
  await seite.locator("#auth-email").fill(konto.email);
  await seite.locator("#auth-password").fill(konto.passwort);
  await seite.getByRole("button", { name: "Anmelden", exact: true }).click();
  await seite.locator(KOPFBAND).waitFor({ state: "visible", timeout: 60_000 });
  return maske;
}

export interface Sitzungscookie {
  vorhanden: boolean;
  secure: boolean;
  httpOnly: boolean;
  sameSite: string;
}

export async function sitzungscookie(kontext: BrowserContext): Promise<Sitzungscookie> {
  const keks = (await kontext.cookies()).find((c) => c.name === "kw_session");
  return {
    vorhanden: keks !== undefined,
    secure: keks?.secure ?? false,
    httpOnly: keks?.httpOnly ?? false,
    sameSite: keks?.sameSite ?? "",
  };
}

/** Eine Anfrage im Seitenkontext — mit genau der Sitzung, die dieser Browser gerade hat. */
export async function imSeitenkontext(
  seite: Page,
  verfahren: string,
  pfad: string,
  rumpf?: unknown,
): Promise<{ status: number; text: string }> {
  return seite.evaluate(
    async ([v, p, r]) => {
      const init: RequestInit = { method: v, credentials: "include" };
      if (r !== null) {
        init.headers = { "content-type": "application/json" };
        init.body = r;
      }
      const antwort = await fetch(p, init);
      return { status: antwort.status, text: await antwort.text() };
    },
    [verfahren, pfad, rumpf === undefined ? null : JSON.stringify(rumpf)] as const,
  );
}

// --------------------------------------------------------------------------------------------------
// Verwaltung: ein Betrachter-Konto ueber den regulaeren Weg
// --------------------------------------------------------------------------------------------------

export async function betrachterAnlegen(seite: Page, basis: string, konto: Konto): Promise<void> {
  await seite.goto(`${basis}/admin`, { waitUntil: "domcontentloaded" });
  await seite.getByTestId("knopf-nutzer-hinzufuegen").click();
  const karte = seite.getByTestId("detail-nutzer-neu");
  await karte.waitFor({ state: "visible", timeout: 30_000 });
  await karte.getByLabel("Name", { exact: true }).fill(konto.name);
  await karte.getByLabel("E-Mail", { exact: true }).fill(konto.email);
  await karte.getByLabel("Passwort", { exact: true }).fill(konto.passwort);
  await karte.getByLabel("Passwort wiederholen", { exact: true }).fill(konto.passwort);
  await karte.locator("select").selectOption("viewer");
  const angelegt = seite.waitForResponse(
    (r) => r.url().endsWith("/api/users") && r.request().method() === "POST",
    { timeout: 30_000 },
  );
  await karte.getByRole("button", { name: "Anlegen", exact: true }).click();
  const antwort = await angelegt;
  if (antwort.status() !== 201) {
    throw new Error(`Nutzer anlegen: HTTP ${antwort.status()} ${await antwort.text()}`);
  }
  // Zurueck in der Liste steht das neue Konto — die sichtbare Quittung der Verwaltung.
  await seite.getByText(konto.name).first().waitFor({ state: "visible", timeout: 30_000 });
}

// --------------------------------------------------------------------------------------------------
// Erfassen: Blatt → Einreichen → Wissensobjekt
// --------------------------------------------------------------------------------------------------

export interface Dokumententwurf {
  titel: string;
  text: string;
  /** Sichtbare Stufe im Vertraulichkeitsmenue: „Öffentlich-intern" oder „Vertraulich". */
  stufe: "Öffentlich-intern" | "Vertraulich";
}

/** Erfasst ueber das Blatt und liefert die Objektkennung aus dem Weiterweg `/wissen/<id>`. */
export async function dokumentErfassen(
  seite: Page,
  basis: string,
  d: Dokumententwurf,
): Promise<string> {
  await seite.goto(`${basis}/erfassen`, { waitUntil: "domcontentloaded" });
  const einreichen = seite.getByRole("button", { name: "Einreichen", exact: true });
  await einreichen.waitFor({ state: "visible", timeout: 60_000 });
  await seite.getByRole("textbox", { name: "Titel", exact: true }).fill(d.titel);
  const editor = seite.getByTestId("blatt-text").locator('[contenteditable="true"]').first();
  await editor.fill(d.text);
  await seite.getByTestId("blatt-werkzeug-vertraulichkeit").click();
  await seite.getByRole("menuitem", { name: d.stufe, exact: true }).click();
  await einreichen.click();
  const weiter = seite.getByTestId("blatt-lage").getByRole("link").first();
  await weiter.waitFor({ state: "visible", timeout: 60_000 });
  const ziel = (await weiter.getAttribute("href")) ?? "";
  const kennung = /\/wissen\/([^/?#]+)/.exec(ziel)?.[1];
  if (!kennung) {
    throw new Error(`Einreichen lieferte keinen Weiterweg zum Objekt (href=${ziel}).`);
  }
  return decodeURIComponent(kennung);
}

async function oeffneMehrAbschnitt(seite: Page, schluessel: string, titel: string): Promise<void> {
  const abschnitt = seite.locator(`details[data-bib-abschnitt="${schluessel}"]`);
  if ((await abschnitt.count()) === 0 || !(await abschnitt.isVisible())) {
    await seite.getByTestId("bib-mehr").click();
  }
  await abschnitt.waitFor({ state: "visible", timeout: 30_000 });
  if ((await abschnitt.getAttribute("open")) === null) {
    await abschnitt.locator("summary").filter({ hasText: titel }).first().click();
  }
  // Der Inhalt eines Abschnitts entsteht erst beim Aufklappen — vorher ist er nicht im Dokument.
  await seite
    .locator(`details[data-bib-abschnitt="${schluessel}"][open]`)
    .waitFor({ state: "visible", timeout: 30_000 });
}

/** Wartet, bis im Abschnitt etwas steht; bleibt er leer, ist das ein Befund, kein Fehler. */
async function ersterEintrag(seite: Page, selektor: string): Promise<void> {
  await seite
    .locator(selektor)
    .first()
    .waitFor({ state: "visible", timeout: 15_000 })
    .catch(() => undefined);
}

async function oeffneObjekt(seite: Page, basis: string, kennung: string): Promise<void> {
  await seite.goto(`${basis}/wissen/${encodeURIComponent(kennung)}`, {
    waitUntil: "domcontentloaded",
  });
  await seite.getByTestId("bib-titel").waitFor({ state: "visible", timeout: 60_000 });
}

export interface Datei {
  name: string;
  mime: string;
  bytes: Buffer;
}

export async function anhangHochladen(
  seite: Page,
  basis: string,
  kennung: string,
  datei: Datei,
): Promise<void> {
  await oeffneObjekt(seite, basis, kennung);
  await oeffneMehrAbschnitt(seite, "anhaenge", "Anhänge");
  const gebunden = seite.waitForResponse(
    (r) => r.url().includes(`/api/kos/${kennung}`) && r.request().method() === "PUT",
    { timeout: 60_000 },
  );
  await seite
    .locator('[data-bib-abschnitt="anhaenge"] input[type=file]')
    .setInputFiles({ name: datei.name, mimeType: datei.mime, buffer: datei.bytes });
  const antwort = await gebunden;
  if (antwort.status() !== 200) {
    throw new Error(`Anhang binden: HTTP ${antwort.status()} ${await antwort.text()}`);
  }
}

export interface Quelle {
  bezeichnung: string;
  auszug: string;
  /** Name des Anhangs, an dem die Quelle verankert wird. */
  anhang: string;
}

export async function quelleHinzufuegen(
  seite: Page,
  basis: string,
  kennung: string,
  q: Quelle,
): Promise<void> {
  await oeffneObjekt(seite, basis, kennung);
  await oeffneMehrAbschnitt(seite, "quellen", "Quellen und Belege");
  const bereich = seite.locator('[data-bib-abschnitt="quellen"]');
  await bereich.getByPlaceholder("Bezeichnung der Quelle (Pflicht)").fill(q.bezeichnung);
  await bereich.getByPlaceholder("Auszug / Notiz (optional)").fill(q.auszug);
  await bereich.locator("select").selectOption({ label: q.anhang });
  const gesendet = seite.waitForResponse(
    (r) => r.url().includes(`/api/kos/${kennung}`) && r.request().method() === "PUT",
    { timeout: 60_000 },
  );
  await bereich.getByRole("button", { name: "Externe Quelle hinzufügen", exact: true }).click();
  const antwort = await gesendet;
  if (antwort.status() !== 200) {
    throw new Error(`Quelle hinzufuegen: HTTP ${antwort.status()} ${await antwort.text()}`);
  }
}

// --------------------------------------------------------------------------------------------------
// Lesen: was der Nutzer sieht — und was er herunterlaedt
// --------------------------------------------------------------------------------------------------

export interface Gelesen {
  kennung: string;
  fassung: string;
  titel: string;
  text: string;
  /** Je Quelle: Bezeichnung ⟶ verankerte Datei ⟶ Auszug, so wie die Quellenliste sie zeigt. */
  quellen: string[];
  dateiSha256: string | null;
  dateiStatus: number | null;
  /** Objektkennung der Datei aus der tatsaechlich geladenen Adresse `/api/objects/<id>/raw`. */
  dateiObjekt: string | null;
}

function normalisiere(text: string): string {
  return text.replace(/ /g, " ").replace(/\s+/g, " ").trim();
}

/** Laedt die Seite NEU und liest alles ueber die Oberflaeche; die Datei ueber die Anhangskachel. */
export async function lese(seite: Page, basis: string, kennung: string): Promise<Gelesen> {
  await oeffneObjekt(seite, basis, kennung);
  await seite.reload({ waitUntil: "domcontentloaded" });
  await seite.getByTestId("bib-titel").waitFor({ state: "visible", timeout: 60_000 });
  const titel = normalisiere(await seite.getByTestId("bib-titel").innerText());
  const text = normalisiere(await seite.getByTestId("bib-text").innerText());

  await oeffneMehrAbschnitt(seite, "quellen", "Quellen und Belege");
  await ersterEintrag(seite, '[data-bib-abschnitt="quellen"] ul > li');
  const quellen: string[] = [];
  for (const eintrag of await seite.locator('[data-bib-abschnitt="quellen"] ul > li').all()) {
    const bezeichnung = normalisiere(await eintrag.locator("span.font-medium").first().innerText());
    const datei = eintrag.getByTestId("bib-quelle-datei");
    const verankert = (await datei.count()) > 0 ? normalisiere(await datei.innerText()) : "";
    const notiz = eintrag.locator("p");
    const auszug = (await notiz.count()) > 0 ? normalisiere(await notiz.first().innerText()) : "";
    quellen.push(`${bezeichnung} ⟶ ${verankert} ⟶ ${auszug}`);
  }

  await oeffneMehrAbschnitt(seite, "historie", "Historie");
  await ersterEintrag(seite, '[data-bib-abschnitt="historie"] [data-bib-historie-vermerk]');
  const fassungen: number[] = [];
  for (const vermerk of await seite
    .locator('[data-bib-abschnitt="historie"] [data-bib-historie-vermerk]')
    .all()) {
    fassungen.push(Number(await vermerk.getAttribute("data-bib-historie-vermerk")));
  }
  const fassung = fassungen.length > 0 ? String(Math.max(...fassungen)) : "";

  // DIE DATEI: ueber die Anhangskachel, so wie ein Nutzer sie oeffnet (neuer Tab auf `/raw`). Die
  // Bytes kommen aus der Antwort, die der Browser dafuer tatsaechlich geladen hat.
  let dateiSha256: string | null = null;
  let dateiStatus: number | null = null;
  let dateiObjekt: string | null = null;
  await oeffneMehrAbschnitt(seite, "anhaenge", "Anhänge");
  await ersterEintrag(seite, '[data-bib-abschnitt="anhaenge"] [data-bib-anhang]');
  const kachel = seite.locator('[data-bib-abschnitt="anhaenge"] [data-bib-anhang]').first();
  if ((await kachel.count()) > 0) {
    const geladen = seite.context().waitForEvent("response", {
      predicate: (r: Response) => /\/api\/objects\/[^/]+\/raw/.test(r.url()),
      timeout: 60_000,
    });
    const neuerTab = seite.context().waitForEvent("page", { timeout: 60_000 });
    await kachel.click();
    const antwort = await geladen;
    dateiStatus = antwort.status();
    dateiObjekt = /\/api\/objects\/([^/]+)\/raw/.exec(antwort.url())?.[1] ?? null;
    if (antwort.ok()) {
      dateiSha256 = createHash("sha256")
        .update(await antwort.body())
        .digest("hex");
    }
    await (await neuerTab).close();
  }
  return { kennung, fassung, titel, text, quellen, dateiSha256, dateiStatus, dateiObjekt };
}

/** Was eine Objektseite zeigt, wenn der Eintrag fuer diesen Nutzer nicht existiert. */
export async function objektseiteGesperrt(
  seite: Page,
  basis: string,
  kennung: string,
): Promise<boolean> {
  await seite.goto(`${basis}/wissen/${encodeURIComponent(kennung)}`, {
    waitUntil: "domcontentloaded",
  });
  try {
    await seite
      .getByText("Der Eintrag ließ sich nicht laden.")
      .first()
      .waitFor({ state: "visible", timeout: 30_000 });
    return (await seite.getByTestId("bib-titel").count()) === 0;
  } catch {
    return false;
  }
}

// --------------------------------------------------------------------------------------------------
// Kennwort vergessen — der Weg, ueber den eine Instanz ihre eigene Adresse verschickt
// --------------------------------------------------------------------------------------------------

export async function kennwortVergessen(seite: Page, basis: string, email: string): Promise<void> {
  const maske = await ersteMaske(seite, basis);
  if (maske !== "Anmelden") {
    throw new Error(`Kennwort vergessen: erwartet die Anmeldemaske, gefunden „${maske}".`);
  }
  await seite.getByRole("button", { name: "Passwort vergessen?" }).click();
  await seite.locator("#auth-email").fill(email);
  const gesendet = seite.waitForResponse(
    (r) => r.url().endsWith("/api/auth/forgot") && r.request().method() === "POST",
    { timeout: 30_000 },
  );
  await seite.getByRole("button", { name: "Link senden" }).click();
  const antwort = await gesendet;
  if (antwort.status() !== 204) {
    throw new Error(`Kennwort vergessen: HTTP ${antwort.status()}`);
  }
  await seite.getByText("E-Mail unterwegs").first().waitFor({ state: "visible", timeout: 30_000 });
}
