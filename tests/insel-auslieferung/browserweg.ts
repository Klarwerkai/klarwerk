// ================================================================================================
// JOB B4-INSEL-RELEASE — DER BETREIBER AM ECHTEN BROWSER, gegen die Oberfläche AUS DEM PAKET.
// ================================================================================================
//
// Jede Anmeldung bekommt ein EIGENES, echtes Chromium-Profil auf der Platte (`launchPersistentContext`
// in einem frischen Ordner): keine Kekse, kein Speicher, kein Dienstarbeiter aus einem früheren
// Schritt. Die Seite, die geladen wird, liefert der Serverprozess des Pakets aus
// (`<release>/apps/web/dist`) — nicht der Arbeitsbaum.
//
// Die Bedienschritte des Datei-Imports sind NICHT neu geschrieben. Sie stehen einmal in den
// Bühnen der D3-/UX19-Ketten und werden von dort genommen (sichtbarer Dateiwähler, „Ganzes
// Dokument übernehmen", Speichern, Einreichen mit Vertraulichkeit). Neu ist hier nur die
// Ersteinrichtung an der Maske und das Wiederlesen samt Download der Originaldatei.
//
// Diese Datei enthält keine Erwartung — sie liefert Befunde; geurteilt wird in `bestand.ts`
// (`bestandsmaengel`), damit dieselbe Prüfung im Hauptlauf und in der Gegenprobe greift.
import { mkdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { type BrowserContext, type Page, chromium } from "playwright";
import { CAPTURE_FILE_TEXT } from "../../apps/web/src/lib/captureFromFile";
import {
  type SeiteMitDialog,
  aufEingelesenWarten,
  dateiUeberSichtbareAuswahl,
  einreichenUndKennung,
} from "../d3-dateien-durchgaengig/d3-buehne";
import type { Seite } from "../gast-nutzerweg/browserweg";
import {
  type SeiteMitDialogUndRoute,
  aufSichtbarkeitWarten,
  persistierteQuellenzeile,
} from "../import-wiederoeffnen-nutzerweg/strecke";
import { baueDocx } from "../m5-docx-bildunterschriften/docx-bauen";
import { anmeldenAnDerMaske } from "../rollen-sichtbar-nutzerweg/flaeche";
import {
  type DateiAnlage,
  dateiwegOeffnen,
  flaechensatz,
  ganzdokumentWaehlen,
  kennungAusOeffnenLink,
  speichernDruecken,
} from "../ux19-speichern-oeffnen-reload/ux19-buehne";
import {
  ABSAETZE,
  type Bestandsbefund,
  type Bestandserwartung,
  DATEI_NAME,
  DOKUMENTSATZ,
} from "./bestand";
import { sha256Datei, sha256Puffer } from "./pruefplatz";

const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

/** Das Konto des Betreibers — eigene Adresse, nichts aus einem fremden Lauf. */
export const KONTO = {
  name: "Inselbetreiber B4",
  email: "betreiber@inselprobe-b4.invalid",
  passwort: "inselprobe-b4-2026",
} as const;

let anlage: DateiAnlage | undefined;
/** EINMAL gebaut, dann dieselbe Datei — der Abdruck am Ende wird gegen genau diese Bytes geprüft. */
export async function pruefdatei(): Promise<DateiAnlage> {
  if (anlage === undefined) {
    const { bytes } = await baueDocx(ABSAETZE);
    anlage = { name: DATEI_NAME, mimeType: DOCX_MIME, buffer: bytes };
  }
  return anlage;
}

export interface Profil {
  readonly ordner: string;
  readonly kontext: BrowserContext;
  readonly version: string;
}

/** Ein frisches, echtes Chromium-Profil in einem eigenen Ordner. */
export async function neuesProfil(ordner: string): Promise<Profil> {
  mkdirSync(ordner, { recursive: true });
  const kontext = await chromium.launchPersistentContext(ordner, {
    headless: true,
    args: ["--no-sandbox", "--disable-gpu"],
    viewport: { width: 1280, height: 800 },
    locale: "de-DE",
    acceptDownloads: true,
  });
  // Die Sprache wird gesetzt, nicht geraten (Begründung: `gast-nutzerweg/browserweg.ts: profil`).
  await kontext.addInitScript(`try { localStorage.setItem("kw.sprache", "de"); } catch (e) {}`);
  return { ordner, kontext, version: kontext.browser()?.version() ?? chromium.name() };
}

async function frischeSeite(profil: Profil): Promise<Page> {
  return profil.kontext.newPage();
}

async function schliesse(seite: Page): Promise<void> {
  await seite.close({ runBeforeUnload: false }).catch(() => undefined);
}

/** Ob das Profil einen Sitzungskeks trägt. */
export async function hatSitzung(profil: Profil): Promise<boolean> {
  return (await profil.kontext.cookies()).some((k) => k.name === "kw_session");
}

/**
 * DIE ERSTEINRICHTUNG AN DER MASKE — der erste Mensch einer leeren Insel wird Administrator
 * (`AuthScreens.tsx`, Modus `setup`). Kein API-Umweg.
 */
export async function richteEinAnDerMaske(profil: Profil, basis: string): Promise<void> {
  const seite = await frischeSeite(profil);
  try {
    await seite.goto(`${basis}/`, { waitUntil: "domcontentloaded" });
    await seite.waitForSelector("#auth-name", { timeout: 60_000 });
    await seite.fill("#auth-name", KONTO.name);
    await seite.fill("#auth-email", KONTO.email);
    await seite.fill("#auth-password", KONTO.passwort);
    await seite.fill("#auth-password-repeat", KONTO.passwort);
    await seite.click('button[type="submit"]');
    await seite.waitForSelector('[data-testid="kopfband"]', { timeout: 60_000 });
  } finally {
    await schliesse(seite);
  }
}

/** Die Anmeldung an der Maske (`rollen-sichtbar-nutzerweg/flaeche.ts: anmeldenAnDerMaske`). */
export async function meldeAn(profil: Profil, basis: string): Promise<void> {
  const seite = await frischeSeite(profil);
  try {
    await anmeldenAnDerMaske(seite as unknown as Seite, basis, KONTO.email, KONTO.passwort);
    await seite.waitForSelector('[data-testid="kopfband"]', { timeout: 60_000 });
  } finally {
    await schliesse(seite);
  }
}

export interface Import {
  readonly entwurfId: string;
  readonly koId: string;
}

/**
 * DER DOCX-IMPORT DURCH DIE OBERFLÄCHE: `/erfassen` → „Datei" → „Ganzes Dokument übernehmen" →
 * sichtbarer Dateiwähler → Speichern als Entwurf → Entwurf öffnen → Einreichen. Die Oberfläche
 * lädt dabei die Originaldatei als Objekt hoch und vermerkt die Quelle im Rumpf.
 */
export async function importiereUndReicheEin(profil: Profil, basis: string): Promise<Import> {
  const datei = await pruefdatei();
  const seite = await frischeSeite(profil);
  let entwurfId: string | null = null;
  try {
    await seite.goto(`${basis}/erfassen`, { waitUntil: "load" });
    await seite.waitForSelector('[data-testid="blatt"]', { timeout: 60_000 });
    const s = seite as unknown as SeiteMitDialog;
    await dateiwegOeffnen(s);
    await ganzdokumentWaehlen(s);
    await dateiUeberSichtbareAuswahl(s, datei);
    await aufEingelesenWarten(s, DATEI_NAME);
    if (!(await speichernDruecken(s))) {
      throw new Error("Der Speichern-Knopf des Ganzdokument-Wegs war nicht betätigbar.");
    }
    await aufSichtbarkeitWarten(
      seite as unknown as SeiteMitDialogUndRoute,
      flaechensatz(CAPTURE_FILE_TEXT.wholeSavedTitle),
      "Erfolgskasten des Ganzdokument-Wegs",
    );
    entwurfId = await kennungAusOeffnenLink(s);
  } finally {
    await schliesse(seite);
  }
  if (entwurfId === null) {
    throw new Error("Nach dem Speichern steht kein Öffnen-Link mit Entwurfskennung da.");
  }
  const zweite = await frischeSeite(profil);
  try {
    await zweite.goto(`${basis}/erfassen?draft=${encodeURIComponent(entwurfId)}`, {
      waitUntil: "load",
    });
    await zweite.waitForSelector('[data-testid="blatt"]', { timeout: 60_000 });
    await aufSichtbarkeitWarten(
      zweite as unknown as SeiteMitDialogUndRoute,
      DOKUMENTSATZ,
      "Dokumentinhalt im fortgesetzten Entwurf",
    );
    const koId = await einreichenUndKennung(zweite as unknown as SeiteMitDialog);
    return { entwurfId, koId };
  } finally {
    await schliesse(zweite);
  }
}

/**
 * DAS WIEDERLESEN: `/wissen/<id>` öffnen, Titel, Rumpf und Quellenvermerk ablesen, die
 * Originaldatei über den Link im Rumpf HERUNTERLADEN (echtes Download-Ereignis des Browsers) und
 * ihren Abdruck bilden. Scheitert ein Teil, steht das im Befund — geurteilt wird woanders.
 */
export async function liesBestand(
  profil: Profil,
  basis: string,
  koId: string,
  ablage: string,
): Promise<Bestandsbefund> {
  const seite = await frischeSeite(profil);
  const adresse = `${basis}/wissen/${encodeURIComponent(koId)}`;
  try {
    await seite.goto(adresse, { waitUntil: "load" });
    const angemeldet = await seite
      .waitForSelector('[data-testid="bib-text"]', { timeout: 60_000 })
      .then(() => true)
      .catch(() => false);
    const text = async (sel: string) =>
      ((await seite.textContent(sel, { timeout: 5_000 }).catch(() => null)) ?? "")
        .replace(/\s+/g, " ")
        .trim();
    const titel = await text('[data-testid="bib-titel"]');
    const rumpf = await text('[data-testid="bib-text"]');
    const quelle = await text('[data-testid="bib-text"] blockquote');
    const link = '[data-testid="bib-text"] .attachment a[href^="/api/objects/"]';
    const originalHref =
      (await seite.getAttribute(link, "href", { timeout: 5_000 }).catch(() => null)) ?? "";
    const inselmarke =
      (await seite
        .getAttribute('meta[name="klarwerk-island"]', "content", { timeout: 5_000 })
        .catch(() => null)) ?? "";
    let download: Bestandsbefund["download"] = null;
    let downloadFehler = "";
    if (originalHref === "") {
      downloadFehler = "kein Link auf die Originaldatei im Rumpf";
    } else {
      try {
        const [ereignis] = await Promise.all([
          seite.waitForEvent("download", { timeout: 30_000 }),
          seite.click(link),
        ]);
        const pfad = join(ablage, `${Date.now()}-${ereignis.suggestedFilename()}`);
        mkdirSync(ablage, { recursive: true });
        await ereignis.saveAs(pfad);
        download = {
          name: ereignis.suggestedFilename(),
          sha256: sha256Datei(pfad),
          bytes: statSync(pfad).size,
        };
      } catch (fehler) {
        // Was der Server auf genau diesen Pfad antwortet — gefragt AUS DER SEITE (mit ihrer Sitzung),
        // nur für die Meldung, nie als Ersatz für den Download.
        const status = await seite
          .goto(adresse, { waitUntil: "load" })
          .then(() =>
            seite.evaluate<number>(
              `fetch(${JSON.stringify(originalHref)}, { credentials: "include" }).then((r) => r.status)`,
            ),
          )
          .catch(() => 0);
        downloadFehler = `kein Download (${String(fehler).split("\n")[0]}); GET ${originalHref} → HTTP ${status}`;
      }
    }
    return {
      adresse,
      angemeldet,
      titel,
      text: rumpf,
      quelle,
      originalHref,
      download,
      downloadFehler,
      inselmarke,
    };
  } finally {
    await schliesse(seite);
  }
}

/**
 * Was das Urteil (`bestand.ts`) erwartet: die Quellenzeile aus dem echten Rumpfbauer des Produkts
 * und der Abdruck genau der Prüfdatei, die hochgeladen wurde.
 */
export async function bestandserwartung(): Promise<Bestandserwartung> {
  return {
    quellenzeile: persistierteQuellenzeile(DATEI_NAME),
    dateiSha256: sha256Puffer((await pruefdatei()).buffer),
  };
}
