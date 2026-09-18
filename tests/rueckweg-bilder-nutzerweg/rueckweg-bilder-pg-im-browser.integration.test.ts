// ================================================================================================
// JOB 4329 · DIE WEB-HÄLFTE DES BILDRÜCKWEGS ALS EINE GEMESSENE STRECKE.
// ================================================================================================
//
//   Nutzlast im Format von `rwLadung` (vom Test erzeugt)  →  echter Socket, echter Keks
//   →  `PUT /api/kos/:id { action: "propose" }`           →  PostgreSQL (`kos.data::text`)
//   →  `decide-proposal`                                  →  `GET /api/kos/:id`
//   →  gebaute Fläche, echtes Chromium                    →  Leinwand UND Bildschirmfoto
//   →  und nach dem Entzug des Leserechts: nichts davon.
//
// ------------------------------------------------------------------------------------------------
// WAS HIER AUSDRÜCKLICH NICHT LÄUFT — und was kein Satz dieser Datei behaupten darf
// ------------------------------------------------------------------------------------------------
// KEIN echtes Word, kein Microsoft-365-Host, kein `Office.CoercionType.Html`, kein Aufgabenfenster
// (`taskpane.html`), keine `.docx`, kein Add-in-Code. DIE NUTZLAST ENTSPRICHT DEM ADD-IN-FORMAT
// (`rwLadung`, `apps/web/public/word-addin/rueckweg.js:606-614`), WURDE ABER NICHT VOM ADD-IN
// ERZEUGT. Daraus folgt kein Word- und kein M365-Nachweis; die Word-Hälfte bleibt F-Aufgabe von
// Pedi und Codex (`archiv/4299/AUFTRAG.md` §10). Gemessen ist die WEB-Hälfte, die
// `archiv/4085/runde-2/ben.md:27`, `archiv/4115/runde-1/ben.md:27` und `archiv/3667/runde-9/ben.md:23`
// als unbewiesen benannt haben.
//
// DASS DAS ADD-IN-FORMAT NOCH DASSELBE IST, misst nicht diese Datei, sondern `tor-zeuge.test.ts` im
// normalen Tor — gegen die Produktdatei. Ohne ihn veraltete die Nachbildung eines Tages still.
//
// ------------------------------------------------------------------------------------------------
// ZWEI MESSUNGEN, DIE VERSCHIEDENE DINGE SAGEN (Auftrag §5 Nr. 5b)
// ------------------------------------------------------------------------------------------------
//   (b1) LEINWAND — die dekodierten Bildpunkte, vollständig. CSS geht darin NICHT ein. Eine
//        Abweichung hier ist NIE ein Darstellungsbefund, sondern einer an Transport, Säuberung oder
//        Ablage (`sanitize.ts`, `richText.ts`, `service.ts`, `repo-pg.ts`).
//   (b3) BILDSCHIRMFOTO — der gerenderte Innenbereich. Eine Abweichung hier bei grünem (b1) ist ein
//        Darstellungsbefund (`index.css`, `SanitizedHtml.tsx`, `BibliothekLesen.tsx`).
//   Ist (b1) rot, wird (b3) nicht mehr bewertet: ein falscher Inhalt erklärt jedes Foto.
//
// PRÜFGRENZE, LAUT GEMELDET: ohne erreichbares PostgreSQL wird der Grund SICHTBAR auf stderr
// gemeldet und übersprungen — und der Laufzustand-Zeuge unten sagt es maschinenlesbar. Ein stiller
// Skip sähe aus wie ein bestandener Lauf (`archiv/4299/AUFTRAG.md` §2e). KEINE PRODUKTIVDATEN:
// ausschliesslich Wegwerf-Datenbanken mit `test` im Namen, am Ende entfernt.
import { existsSync } from "node:fs";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  type Browser,
  type Instanz,
  type Kontext,
  type Pruefplatz,
  type Seite,
  type Wegwerfdatenbank,
  flaecheBereitstellen,
  instanzStarten,
  pruefplatzOeffnen,
  starteChromium,
  warte,
} from "../d5-gesamtweg/platz";
import {
  PASSWORT,
  Sitzung,
  type Strecke,
  ersteinrichtung,
  gastAnlegen,
  mussGelingen,
  wissensobjektAnlegen,
} from "../gast-nutzerweg/strecke";
import { repoPfad } from "../support/repoPfad";
import {
  type Ausblendbefund,
  BILDSAMMLUNG,
  type Fotobefund,
  type Punktbefund,
  type Sichtbefund,
  bildAusblenden,
  bildpunkteLesen,
  ersteAbweichung,
  farbzahl,
  fotoInnenbereich,
  punkteAlsBytes,
  quellenLesen,
  seitenquelltext,
  sichtLesen,
} from "./bildablesung";
import {
  FIXTUREN,
  FOTO_INNEN_MINDESTKANTE,
  FOTO_RAND,
  JOB,
  KALIBRIERUNGSMARKE,
  STATEMENT,
  bodyHtmlWieAusWord,
  erwartetePunkteRGBA,
  fotoInnenmass,
  nutzlastWieRwLadung,
  sha256,
} from "./pruefbilder";

const ADMIN = "admin@rueckweg-bilder-4329.test";
const EXPERTE = "experte@rueckweg-bilder-4329.test";
const LESER = "leser@rueckweg-bilder-4329.test";
const TITEL = "Ventil X · Dichtungswechsel (JOB 4329)";
/**
 * Das zweite Objekt der Strecke — es bleibt INTERN und ist der Zeuge des Messwegs (Runde 2).
 *
 * Ohne es wäre die Liste des Lesers nach dem Rechteentzug LEER, und eine leere Liste enthält jede
 * Kennung nicht: der Ausschluss wäre wieder wahr, ohne etwas zu belegen.
 */
const KONTROLLTITEL = "Kontrollobjekt · bleibt intern (JOB 4329)";
const LADEFEHLER = "Der Eintrag ließ sich nicht laden.";

/** Breit genug für die zweispaltige Bibliothek (≥ 900 px) und hoch genug, dass nichts rollt. */
const FENSTER = { width: 1280, height: 2400 };

/** GELAUFEN mit Quelle oder ÜBERSPRUNGEN mit Grund — `undefined` heißt: `beforeAll` lief nicht. */
type Laufzustand =
  | { readonly gelaufen: true; readonly quelle: string }
  | { readonly gelaufen: false; readonly grund: string };

/** Die erwarteten RGBA-Reihen beider Bilder, einmal berechnet. */
const ERWARTET: readonly Buffer[] = FIXTUREN.map((f) =>
  Buffer.from(Uint8Array.from(erwartetePunkteRGBA(f.bild))),
);

// ================================================================================================
// DIE STRECKE — von der leeren Datenbank bis zum übernommenen Vorschlag.
// ================================================================================================

interface Lage {
  db: Wegwerfdatenbank;
  instanz: Instanz;
  admin: Sitzung;
  leser: Sitzung;
  koId: string;
  abraeumen(): Promise<void>;
}

async function anmeldenApi(sitzung: Sitzung, email: string): Promise<void> {
  mussGelingen(
    `Anmeldung ${email}`,
    await sitzung.sende("POST", "/api/auth/login", { email, password: PASSWORT }),
    200,
  );
}

interface Stand {
  version: number;
  bodyHtml?: string | null;
  proposals?: { id: string; status: string }[];
}

async function stand(wer: Sitzung, id: string): Promise<Stand> {
  return mussGelingen(`GET /api/kos/${id} (${wer.name})`, await wer.sende("GET", `/api/kos/${id}`))
    .json as Stand;
}

/**
 * Konten, Objekt, Einreichung, Übernahme — der ganze Serverteil der Strecke.
 *
 * Das Objekt entsteht OHNE Bilder. Nur so kann „die Bilder stehen da" allein der Rückweg erklären.
 */
async function fahreStrecke(platz: Pruefplatz, marke: string): Promise<Lage> {
  const db = await platz.wegwerfdatenbank(marke);
  let instanz: Instanz | undefined;
  try {
    instanz = await instanzStarten(db.pool);
    const laufende = instanz;
    const strecke: Strecke = {
      app: laufende.app,
      basis: laufende.basis,
      profil: (name, sprache) => new Sitzung(laufende.basis, name, sprache),
      schliessen: () => laufende.schliessen(),
    };

    // ── Konten über den ECHTEN Anmeldeweg, jedes mit eigenem Keksbeutel. ───────────────────────
    const admin = (await ersteinrichtung(strecke, ADMIN)).sitzung;
    mussGelingen(
      "Experte anlegen",
      await gastAnlegen(admin, { name: "Experte A", email: EXPERTE, role: "experte" }),
      201,
    );
    mussGelingen(
      "Leser anlegen",
      await gastAnlegen(admin, { name: "Leser B", email: LESER, role: "viewer" }),
      201,
    );
    const experte = strecke.profil("experte");
    const leser = strecke.profil("leser");
    await anmeldenApi(experte, EXPERTE);
    await anmeldenApi(leser, LESER);

    // ── Ein freigegebenes Objekt OHNE Fließtext. ───────────────────────────────────────────────
    const koId = await wissensobjektAnlegen(admin, TITEL);
    mussGelingen(
      "admin-validate",
      await admin.sende("PUT", `/api/kos/${koId}`, { action: "admin-validate" }),
    );
    const vorRueckweg = await stand(admin, koId);
    expect(
      vorRueckweg.bodyHtml ?? "",
      "das Objekt trägt VOR dem Rückweg schon einen Fließtext — dann erklärte nicht der Rückweg die Bilder",
    ).not.toContain("data:image/png;base64,");

    // ── DER EINREICHWEG: die Nutzlast im Add-in-Format über den echten Socket. ─────────────────
    // `rwRuf` lädt das Ziel und liest die Version (`rueckweg.js:440`), `rwLadung` baut daraus die
    // Ladung (`:606-614`), `rwEinreichen` sendet sie als PUT mit content-type application/json
    // (`:766-771`). Genau diese drei Schritte, in dieser Reihenfolge — nur eben vom Test.
    const ziel = await stand(experte, koId);
    const rumpf = bodyHtmlWieAusWord();
    const ladung = nutzlastWieRwLadung({
      statement: STATEMENT,
      bodyHtml: rumpf,
      baseVersion: ziel.version,
    });

    // Was wirklich hinausgeht — vor dem Senden gelesen, nicht behauptet.
    const gesendet = JSON.parse(JSON.stringify(ladung)) as {
      action: string;
      proposal: Record<string, unknown>;
    };
    expect(
      Object.keys(gesendet),
      "der gesendete Körper hat nicht genau { action, proposal }",
    ).toEqual(["action", "proposal"]);
    expect(
      Object.keys(gesendet.proposal),
      "der gesendete Vorschlag trägt nicht genau die vier Felder von rwLadung",
    ).toEqual(["statement", "bodyHtml", "baseVersion", "origin"]);
    expect(gesendet.proposal.origin, "origin ist nicht word_addin").toBe("word_addin");
    expect(gesendet.proposal.baseVersion, "baseVersion ist nicht die geladene Version").toBe(
      ziel.version,
    );
    for (const fix of FIXTUREN) {
      expect(
        String(gesendet.proposal.bodyHtml).includes(fix.quelle),
        `die Quelle von Bild ${fix.bild.nr} geht gar nicht erst hinaus`,
      ).toBe(true);
    }

    const eingereicht = await experte.sende("PUT", `/api/kos/${koId}`, ladung);
    expect(
      eingereicht.status,
      `der Vorschlag kam nicht an: ${eingereicht.status} ${eingereicht.text.slice(0, 400)}`,
    ).toBe(200);

    // ── DIE FREMDE ÜBERNAHME (`ko-routes.ts:2525`). ────────────────────────────────────────────
    const mitVorschlag = await stand(admin, koId);
    const offen = (mitVorschlag.proposals ?? []).filter((v) => v.status === "offen");
    expect(offen, "an der echten Route wurde KEIN Vorschlag angelegt").toHaveLength(1);
    mussGelingen(
      "decide-proposal uebernehmen",
      await admin.sende("PUT", `/api/kos/${koId}`, {
        action: "decide-proposal",
        proposalId: (offen[0] as { id: string }).id,
        decision: "uebernehmen",
        expectedVersion: mitVorschlag.version,
      }),
    );

    return {
      db,
      instanz: laufende,
      admin,
      leser,
      koId,
      abraeumen: async () => {
        try {
          await laufende.schliessen();
        } finally {
          await db.schliessen();
        }
      },
    };
  } catch (fehler) {
    await instanz?.schliessen().catch(() => undefined);
    await db.schliessen();
    throw fehler;
  }
}

// ================================================================================================
// STATION (a) — DIE ABLAGE, ZWEIMAL GELESEN: DATENBANK UND API MÜSSEN DASSELBE SAGEN.
// ================================================================================================

/** Die `data:`-Quellen, die in einem Text stehen, in Dokumentreihenfolge. */
function quellenAus(text: string): string[] {
  return [...text.matchAll(/data:image\/png;base64,[A-Za-z0-9+/=]+/g)].map((m) => m[0]);
}

async function pruefeAblage(lage: Lage): Promise<void> {
  // (a1) EINE FRISCHE VERBINDUNG zur Wegwerf-Datenbank — nicht der Pool, den die App bedient.
  const url = lage.db.pool.options.connectionString;
  expect(url, "die Wegwerf-Datenbank nennt keine Verbindungszeichenkette").toBeTruthy();
  expect(
    String(url).toLowerCase().includes("test"),
    "die zurückgelesene Datenbank trägt kein „test“ im Namen — hier wird ausschliesslich auf Wegwerf-Datenbanken gelesen",
  ).toBe(true);
  const frisch = new Pool({ connectionString: String(url) });
  let ausDerZeile: string[] = [];
  let inDerGanzenZeile = 0;
  try {
    const zeile = await frisch.query<{ data: string }>(
      "SELECT data::text AS data FROM kos WHERE id = $1",
      [lage.koId],
    );
    const roh = zeile.rows[0]?.data;
    expect(roh, `in kos steht keine Zeile zu ${lage.koId}`).toBeTruthy();
    // GEMESSEN, nicht angenommen (erster Cloud-Lauf ce591b75d23d4ae6b766734f3a5f9244): die Zeile
    // trägt die zwei Quellen ZWEIMAL — einmal als aktueller `bodyHtml`, einmal in dem Vorschlag,
    // der übernommen wurde und in derselben `data`-Spalte aufbewahrt bleibt. Das ist kein Befund,
    // sondern der Vorschlagsspeicher (`ko-routes.ts:2487` legt ihn an, `:2525` entscheidet ihn).
    // Was die Fläche zeichnet, ist der AKTUELLE Rumpf — also wird genau der zurückgelesen, und die
    // Gesamtzahl daneben ausgewiesen, statt sie stillschweigend mitzuzählen.
    inDerGanzenZeile = quellenAus(String(roh)).length;
    const abgelegt = JSON.parse(String(roh)) as { bodyHtml?: string | null };
    expect(
      typeof abgelegt.bodyHtml,
      "in der abgelegten Zeile steht gar kein Fließtext — der übernommene Vorschlag ist nicht in den Bestand gewandert",
    ).toBe("string");
    ausDerZeile = quellenAus(String(abgelegt.bodyHtml));
  } finally {
    await frisch.end();
  }
  expect(
    ausDerZeile.length,
    `im abgelegten Fließtext stehen nicht genau zwei Bildquellen (in der ganzen Zeile: ${inDerGanzenZeile})`,
  ).toBe(2);
  expect(
    ausDerZeile.map((q) => sha256(q)),
    "die Bildquellen in PostgreSQL weichen ab oder stehen in falscher Reihenfolge",
  ).toEqual(FIXTUREN.map((f) => f.sha256Quelle));
  // Der aufbewahrte Vorschlag trägt sie ebenfalls — die Kette „eingereicht → übernommen" steht damit
  // beidseitig in der Zeile und nicht nur im Ergebnis.
  expect(
    inDerGanzenZeile,
    "die Zeile trägt nicht Rumpf UND aufbewahrten Vorschlag mit je zwei Quellen",
  ).toBe(4);

  // (a2) DIESELBE FRAGE ÜBER DIE API, als Leser B, über den echten Socket mit echtem Keks.
  const gelesen = await stand(lage.leser, lage.koId);
  const ausDerApi = quellenAus(String(gelesen.bodyHtml ?? ""));
  expect(ausDerApi.length, "GET /api/kos/:id liefert nicht genau zwei Bildquellen").toBe(2);
  expect(
    ausDerApi.map((q) => sha256(q)),
    "Datenbank und API sagen NICHT dasselbe — die API weicht ab",
  ).toEqual(ausDerZeile.map((q) => sha256(q)));
  expect(
    (String(gelesen.bodyHtml ?? "").match(/<img/g) ?? []).length,
    "der Fließtext aus der API trägt nicht genau zwei <img>",
  ).toBe(2);
}

// ================================================================================================
// STATION (b) — DIE FLÄCHE IM ECHTEN CHROMIUM.
// ================================================================================================

async function anmelden(seite: Seite, basis: string, email: string): Promise<void> {
  await seite.goto(`${basis}/`, { waitUntil: "domcontentloaded" });
  await warte(seite, `() => !!document.querySelector("#auth-email")`, `Anmeldemaske für ${email}`);
  await seite.fill("#auth-email", email);
  await seite.fill("#auth-password", PASSWORT);
  await seite.keyboard.press("Enter");
  await warte(
    seite,
    `() => !document.querySelector("#auth-email")`,
    `die Anmeldung von ${email} trägt`,
    undefined,
    45_000,
  );
}

async function neuerKontext(browser: Browser): Promise<{ kontext: Kontext; seite: Seite }> {
  // `deviceScaleFactor: 1` steht hier AUSDRÜCKLICH: nur bei Maßstab 1 hat ein Bildschirmfoto so
  // viele Bildpunkte wie sein Ausschnitt CSS-Pixel breit ist, und nur dann ist ein exakter
  // Punktvergleich zulässig. `browserweg.ts:396` setzt bloss `viewport`/`locale`.
  const kontext = await browser.newContext({
    viewport: FENSTER,
    locale: "de-DE",
    deviceScaleFactor: 1,
  });
  await kontext.addInitScript(`try { localStorage.setItem("kw.sprache", "de"); } catch (e) {}`);
  return { kontext, seite: await kontext.newPage() };
}

/** Die Lesefläche öffnen und warten, bis BEIDE Bilder wirklich dekodiert sind. */
async function leseflaecheOeffnen(seite: Seite, basis: string, koId: string): Promise<void> {
  await seite.goto(`${basis}/bibliothek?eintrag=${encodeURIComponent(koId)}`, {
    waitUntil: "load",
  });
  await warteAufBeideBilder(seite);
}

async function warteAufBeideBilder(seite: Seite): Promise<void> {
  await warte(
    seite,
    `() => { const b = document.querySelectorAll(${JSON.stringify(BILDSAMMLUNG)});
      return b.length === 2 && Array.from(b).every((i) => i.complete && i.naturalWidth > 0); }`,
    "zwei dekodierte Bilder im Fließtext der Lesefläche",
    undefined,
    60_000,
  );
}

/** Vorab: genau zwei Bilder, in Dokumentreihenfolge, mit den erwarteten Quellen. */
async function pruefeSammlung(seite: Seite, marke: string): Promise<void> {
  const quellen = await quellenLesen(seite);
  expect(
    quellen.length,
    `${marke}: unter ${BILDSAMMLUNG} stehen nicht genau zwei Bilder (gefunden: ${quellen.length})`,
  ).toBe(2);
  expect(
    quellen.map((q) => sha256(q)),
    `${marke}: die Bilder stehen nicht in Dokumentreihenfolge Bild 1, Bild 2`,
  ).toEqual(FIXTUREN.map((f) => f.sha256Quelle));
}

/** (b1) Die dekodierten Bildpunkte — vollständig, ohne Toleranz. */
async function pruefeInhalt(
  seite: Seite,
  marke: string,
  erwartet: readonly Buffer[],
): Promise<Punktbefund[]> {
  const befunde: Punktbefund[] = [];
  for (const fix of FIXTUREN) {
    const i = fix.bild.nr - 1;
    const b = await bildpunkteLesen(seite, i);
    // Ein ausgefallener Messweg ist ein MASCHINENFEHLER und kein Inhaltsbefund — zuerst gelesen.
    expect(
      b.fehler,
      `${marke} (b1) Bild ${fix.bild.nr}: die Bildpunkte waren nicht messbar — das ist ein Maschinenfehler, kein Inhaltsbefund`,
    ).toBeNull();
    expect(
      [b.natBreite, b.natHoehe],
      `${marke} (b1) Bild ${fix.bild.nr}: der Browser hat ein Bild ANDERER Grösse dekodiert`,
    ).toEqual([fix.bild.breite, fix.bild.hoehe]);
    const gemessen = punkteAlsBytes(b);
    const soll = erwartet[i] as Buffer;
    expect(
      gemessen.length,
      `${marke} (b1) Bild ${fix.bild.nr}: die Leinwand gibt nicht für jeden Bildpunkt vier Werte her`,
    ).toBe(soll.length);
    const ab = ersteAbweichung(soll, gemessen, fix.bild.breite);
    expect(
      ab,
      ab === null
        ? ""
        : `${marke} (b1) Bild ${fix.bild.nr}: die DEKODIERTEN Bildpunkte weichen ab — zuerst bei (${ab.x},${ab.y}): erwartet ${ab.erwartet.join(",")}, gemessen ${ab.gemessen.join(",")}. Das ist ein Befund an Transport, Säuberung oder Ablage (sanitize.ts, richText.ts, service.ts, repo-pg.ts) und NIE ein CSS-Befund.`,
    ).toBeNull();
    befunde.push(b);
  }
  return befunde;
}

/** (b2) Sichtbarkeit und Geometrie — getrennt vom Inhalt, feldweise je Bild. */
async function pruefeSicht(seite: Seite, marke: string): Promise<Sichtbefund[]> {
  const befunde: Sichtbefund[] = [];
  for (const fix of FIXTUREN) {
    const name = `Bild ${fix.bild.nr}`;
    const s = await sichtLesen(seite, fix.bild.nr - 1);
    expect(
      s.fehler,
      `${marke} (b2) ${name}: die Sichtbarkeit war nicht messbar — Maschinenfehler, kein Befund`,
    ).toBeNull();
    expect(
      s.sichtbar,
      `${marke} (b2) ${name}: checkVisibility() sagt NEIN — es ist nicht zu sehen`,
    ).toBe(true);
    expect(s.display, `${marke} (b2) ${name}: display ist none`).not.toBe("none");
    expect(s.visibility, `${marke} (b2) ${name}: visibility ist nicht visible`).toBe("visible");
    expect(s.opacity, `${marke} (b2) ${name}: opacity ist nicht 1`).toBe("1");
    expect(
      [s.natBreite, s.natHoehe],
      `${marke} (b2) ${name}: die Eigenmaße sind nicht die des Quellbildes`,
    ).toEqual([fix.bild.breite, fix.bild.hoehe]);
    // Maßstab 1: das Bild ist kleiner als die 720-px-Spalte, `max-width: 100%` greift nicht.
    expect(
      Math.abs(s.rect.breite - fix.bild.breite),
      `${marke} (b2) ${name}: gerendert ${s.rect.breite} px breit statt ${fix.bild.breite} — verzerrt`,
    ).toBeLessThanOrEqual(0.5);
    expect(
      Math.abs(s.rect.hoehe - fix.bild.hoehe),
      `${marke} (b2) ${name}: gerendert ${s.rect.hoehe} px hoch statt ${fix.bild.hoehe} — verzerrt`,
    ).toBeLessThanOrEqual(0.5);
    // Das Bezugssystem muss eindeutig sein, sonst ist der Fotoausschnitt eine Annahme.
    expect(
      [s.scrollX, s.scrollY],
      `${marke} (b2) ${name}: das Fenster ist gerollt — Fensterkoordinaten und Seitenkoordinaten fielen dann auseinander`,
    ).toEqual([0, 0]);
    expect(
      s.rect.x >= 0 &&
        s.rect.y >= 0 &&
        s.rect.x + s.rect.breite <= s.fensterBreite &&
        s.rect.y + s.rect.hoehe <= s.fensterHoehe,
      `${marke} (b2) ${name}: das Rechteck (${s.rect.x},${s.rect.y},${s.rect.breite}×${s.rect.hoehe}) liegt nicht vollständig im Fenster (${s.fensterBreite}×${s.fensterHoehe})`,
    ).toBe(true);
    expect(
      s.obenAuf === "selbst" || s.obenAuf === "nachkomme",
      `${marke} (b2) ${name}: in der Bildmitte liegt etwas anderes obenauf (${s.obenAuf}) — es ist verdeckt`,
    ).toBe(true);
    befunde.push(s);
  }
  return befunde;
}

/**
 * (b3) Das echte Bildschirmfoto: der gerenderte Innenbereich, Punkt für Punkt.
 *
 * Das Rechteck wird HIER frisch gemessen und nicht aus (b2) übernommen: zwischen beiden Messungen
 * kann die Fläche gerollt sein, und ein Ausschnitt nach einem veralteten Rechteck fotografierte
 * irgendetwas. Ein veralteter Wert ist die klassische Art, wie ein Bildvergleich still danebengreift.
 */
async function pruefeFoto(
  seite: Seite,
  marke: string,
  erwartet: readonly Buffer[],
  rand = FOTO_RAND,
): Promise<Fotobefund[]> {
  const befunde: Fotobefund[] = [];
  for (const fix of FIXTUREN) {
    const i = fix.bild.nr - 1;
    const name = `Bild ${fix.bild.nr}`;
    const s = await sichtLesen(seite, i);
    expect(
      s.fehler,
      `${marke} (b3) ${name}: das Rechteck war nicht messbar — Maschinenfehler, kein Befund`,
    ).toBeNull();
    const foto = await fotoInnenbereich(seite, s.rect, rand);
    expect(
      [foto.fotoBreite, foto.fotoHoehe],
      `${marke} (b3) ${name}: das Foto hat ${foto.fotoBreite}×${foto.fotoHoehe} Bildpunkte statt ${foto.ausschnitt.width}×${foto.ausschnitt.height} — Maßstab ≠ 1`,
    ).toEqual([foto.ausschnitt.width, foto.ausschnitt.height]);
    // VOR jedem Vergleich: ein leerer Innenbereich ist rot, kein Grün.
    expect(
      foto.innenBreite >= FOTO_INNEN_MINDESTKANTE && foto.innenHoehe >= FOTO_INNEN_MINDESTKANTE,
      `${marke} (b3) ${name}: der Innenbereich ist ${foto.innenBreite}×${foto.innenHoehe} und damit kleiner als ${FOTO_INNEN_MINDESTKANTE}×${FOTO_INNEN_MINDESTKANTE} — er könnte nichts belegen`,
    ).toBe(true);
    const soll = fotoInnenmass(fix.bild);
    expect(
      [foto.innenBreite, foto.innenHoehe],
      `${marke} (b3) ${name}: der Innenbereich hat nicht die erwartete Grösse`,
    ).toEqual([soll.breite, soll.hoehe]);
    expect(
      farbzahl(foto.innen),
      `${marke} (b3) ${name}: der Innenbereich ist einfarbig — ein Fleck darf nie grün sein`,
    ).toBeGreaterThan(1);

    // Die erwarteten Punkte des Innenbereichs, aus derselben einen Wahrheit ausgeschnitten.
    const quelle = erwartet[i] as Buffer;
    const innenSoll = Buffer.alloc(soll.breite * soll.hoehe * 4);
    for (let y = 0; y < soll.hoehe; y += 1) {
      const von = ((y + rand) * fix.bild.breite + rand) * 4;
      quelle.copy(innenSoll, y * soll.breite * 4, von, von + soll.breite * 4);
    }
    const ab = ersteAbweichung(innenSoll, foto.innen, soll.breite);
    expect(
      ab,
      ab === null
        ? ""
        : `${marke} (b3) ${name}: der GERENDERTE Innenbereich weicht ab — zuerst bei (${ab.x},${ab.y}) im Innenbereich (also (${ab.x + rand},${ab.y + rand}) im Bild): erwartet ${ab.erwartet.join(",")}, fotografiert ${ab.gemessen.join(",")}. Bei grünem (b1) ist das ein Darstellungsbefund (index.css, SanitizedHtml.tsx, BibliothekLesen.tsx).`,
    ).toBeNull();
    befunde.push(foto);
  }
  return befunde;
}

/** Alle drei Messungen an einer Fläche — die Reihenfolge ist Teil der Aussage. */
async function messeAlles(
  seite: Seite,
  marke: string,
  erwartet: readonly Buffer[] = ERWARTET,
): Promise<{ sichten: Sichtbefund[]; fotos: Fotobefund[] }> {
  await pruefeSammlung(seite, marke);
  await pruefeInhalt(seite, marke, erwartet);
  const sichten = await pruefeSicht(seite, marke);
  const fotos = await pruefeFoto(seite, marke, erwartet);
  return { sichten, fotos };
}

// ================================================================================================
// STATION (e) — DER RECHTEENTZUG, MIT DEN VORAUSSETZUNGEN VOR DEM VERGLEICH (RUNDE 2).
// ================================================================================================
//
// WARUM DIESER ABSCHNITT NEU IST. Runde 1 belegte den Listenausschluss mit EINER Zeile:
// `liste.text.includes(koId) === false`. BEN hat gemessen, was daran falsch ist
// (`jobs/4329/runde-1/ben.md`, „Entscheidende Gegenprobe"): ersetzt man nach dem echten Abruf
// ausschliesslich den GELESENEN Antwortwert durch `{ status: 503, text: "Service unavailable",
// json: undefined }`, bleibt der Fall GRÜN (`Tests 2 passed`, Exit 0) und die Protokollzeile sagt
// weiter „GELAUFEN". In „Service unavailable" steht die Kennung eben nicht. Ein AUSGEFALLENER
// MESSWEG galt damit als fachlicher Erfolg — und dasselbe gilt für eine strukturfremde oder leere
// Antwort.
//
// AB HIER GILT DIE REIHENFOLGE (REGELN.md, GEGENPROBEN-Pflicht bei neuen Abnahmewegen):
//   1. ERFOLGSSTATUS      — HTTP 200, sonst ist nichts gelesen worden.
//   2. GÜLTIGE STRUKTUR   — eine JSON-Liste, deren Einträge Kennungen im erwarteten Format tragen.
//   3. ERFORDERLICHER INHALT — die Liste führt das interne Kontrollobjekt; sie ist also nicht bloss
//      leer oder ein Ersatzwert.
//   4. UND ERST DANN       — die Kennung des vertraulichen Objekts fehlt.
// Fällt eine der ersten drei aus, ist der Fall ROT an der Voraussetzung und sagt das wörtlich; er
// wird nie grün, weil der Vergleich in Schritt 4 trivial erfüllt wäre.
//
// KALIBRIERT WIRD DAS von KAL-v (HTTP 503) und KAL-vi (Objekt statt Liste, Einträge ohne Kennung,
// leere Liste, gültige aber fremde Liste) — dieselbe Messstelle, nur der gelesene Wert ersetzt.

/** Nur so viel von `Antwort`, wie die Listenmessung liest — damit eine Kalibrierung es ersetzen kann. */
interface Listenantwort {
  readonly status: number;
  readonly text: string;
  readonly json: unknown;
}

/** Eine Kalibrierung ersetzt den GELESENEN Wert NACH dem echten Abruf — und nichts sonst. */
type Verstellung = (echt: Listenantwort) => Listenantwort;

/** Die Kennungen dieses Produkts sind `randomUUID()` (`knowledge-object/src/service.ts:715`). */
const KENNUNGSFORM = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Was da wirklich stand — eine Fehlermeldung ohne die vorgefundene Form hilft niemandem. */
function struktur(wert: unknown): string {
  if (wert === undefined) {
    return "gar kein gültiges JSON";
  }
  if (wert === null) {
    return "null";
  }
  if (Array.isArray(wert)) {
    return `ein Array mit ${wert.length} Einträgen`;
  }
  if (typeof wert === "object") {
    return `ein Objekt mit den Schlüsseln [${Object.keys(wert as object).join(", ")}]`;
  }
  return `ein ${typeof wert}`;
}

/** Die Kennung eines Listeneintrags — oder `null`, wenn der Eintrag keine im erwarteten Format trägt. */
function kennungVon(zeile: unknown): string | null {
  const id = (zeile as { id?: unknown } | null | undefined)?.id;
  return typeof id === "string" && KENNUNGSFORM.test(id) ? id : null;
}

/**
 * `GET /api/kos` lesen und den Messweg selbst prüfen — Status, Struktur, Kennungen.
 *
 * Diese Funktion urteilt NICHT über Anwesenheit oder Abwesenheit. Sie stellt nur fest, ob überhaupt
 * eine Liste vorliegt, über die man urteilen darf.
 */
async function listeLesen(
  wer: Sitzung,
  marke: string,
  verstellen?: Verstellung,
): Promise<{ ids: string[]; antwort: Listenantwort }> {
  const echt = await wer.sende("GET", "/api/kos");
  const antwort: Listenantwort = verstellen === undefined ? echt : verstellen(echt);
  // 1. ERFOLGSSTATUS.
  expect(
    antwort.status,
    `${marke}: GET /api/kos war NICHT ABRUFBAR — HTTP ${antwort.status} statt 200 (Rumpf: ${antwort.text.slice(0, 200)}). Ein ausgefallener Messweg belegt keine Abwesenheit.`,
  ).toBe(200);
  // 2. GÜLTIGE STRUKTUR: eine Liste.
  expect(
    Array.isArray(antwort.json),
    `${marke}: die Antwort auf GET /api/kos ist KEINE JSON-LISTE, sondern ${struktur(antwort.json)}. Ohne gültige Struktur ist jeder Abwesenheitsvergleich leer.`,
  ).toBe(true);
  const zeilen = antwort.json as readonly unknown[];
  // 3a. NICHT LEER: eine leere Liste enthält jede Kennung nicht.
  expect(
    zeilen.length,
    `${marke}: die Liste ist LEER. Eine leere Liste enthält jede Kennung nicht und belegt deshalb nichts.`,
  ).toBeGreaterThan(0);
  // 2b. JEDER EINTRAG TRÄGT EINE KENNUNG im erwarteten Format.
  const ohne = zeilen.findIndex((z) => kennungVon(z) === null);
  expect(
    ohne,
    ohne < 0
      ? ""
      : `${marke}: Eintrag ${ohne} der Liste TRÄGT KEINE KENNUNG im erwarteten Format (${struktur(zeilen[ohne])}). Eine Liste ohne Kennungen kann keine Kennung ausschliessen.`,
  ).toBe(-1);
  return { ids: zeilen.map((z) => kennungVon(z) as string), antwort };
}

/** Der Ausschluss selbst — erst nachdem der Messweg als tragend nachgewiesen ist. */
async function pruefeListeOhne(
  wer: Sitzung,
  marke: string,
  koId: string,
  kontrollId: string,
  verstellen?: Verstellung,
): Promise<void> {
  const { ids, antwort } = await listeLesen(wer, marke, verstellen);
  // 3b. ERFORDERLICHER INHALT: das interne Kontrollobjekt steht da. Fehlt es, liefert die Liste für
  // diesen Leser gar nichts mehr — dann sagt die Abwesenheit des vertraulichen Objekts nichts.
  expect(
    ids.includes(kontrollId),
    `${marke}: die Liste FÜHRT DAS INTERNE KONTROLLOBJEKT NICHT (${kontrollId}) — der Messweg liefert für diesen Leser nichts mehr, und eine Abwesenheit belegt dann nichts.`,
  ).toBe(true);
  // 4. UND ERST JETZT der fachliche Vergleich, zweimal: über die Kennungen und über den Rumpf.
  expect(
    ids.includes(koId),
    `${marke}: die Liste des Lesers FÜHRT DIE KENNUNG des vertraulichen Objekts weiterhin (${koId}).`,
  ).toBe(false);
  expect(
    antwort.text.includes(koId),
    `${marke}: die Kennung des vertraulichen Objekts steht weiterhin im Rumpf der Listenantwort.`,
  ).toBe(false);
}

/**
 * Der ganze API-Teil von Station (e): Kontrollobjekt, Vorherlesung, Rechtegriff, 404, Ausschluss.
 *
 * Die VORHERLESUNG ist die Kalibrierung des Messwegs im laufenden Fall: derselbe Abruf, dieselben
 * Voraussetzungen, und er MUSS beide Kennungen führen. Erst wenn er das tut, ist die Nachherlesung
 * eine Aussage über das Recht und nicht über die Erreichbarkeit der Route.
 */
async function pruefeRechteentzug(
  lage: Lage,
  marke: string,
  kontrollId: string,
  verstellen?: Verstellung,
): Promise<void> {
  expect(
    kennungVon({ id: kontrollId }),
    `${marke} Vorbedingung: das Kontrollobjekt hat keine Kennung im erwarteten Format (${kontrollId})`,
  ).not.toBeNull();

  const vorher = await listeLesen(lage.leser, `${marke} Vorbedingung (Liste VOR dem Entzug)`);
  expect(
    vorher.ids.includes(lage.koId),
    `${marke} Vorbedingung: die Liste des Lesers führt das Objekt schon VOR dem Entzug nicht — seine Abwesenheit danach belegte dann nichts.`,
  ).toBe(true);
  expect(
    vorher.ids.includes(kontrollId),
    `${marke} Vorbedingung: die Liste des Lesers führt das interne Kontrollobjekt nicht — dann taugt es nicht als Zeuge des Messwegs.`,
  ).toBe(true);

  mussGelingen(
    "confidentiality vertraulich",
    await lage.admin.sende("PUT", `/api/kos/${lage.koId}`, {
      action: "confidentiality",
      level: "vertraulich",
    }),
  );

  const verwehrt = await lage.leser.sende("GET", `/api/kos/${lage.koId}`);
  expect(
    verwehrt.status,
    `${marke}: der Leser bekommt das vertrauliche Objekt weiterhin: ${verwehrt.status}`,
  ).toBe(404);

  await pruefeListeOhne(
    lage.leser,
    `${marke} Liste nach dem Entzug`,
    lage.koId,
    kontrollId,
    verstellen,
  );
}

// ================================================================================================
// DER LAUF.
// ================================================================================================

describe("JOB 4329 · Bilder aus dem Word-Rückweg, sichtbar in der Bibliothek", () => {
  let platz: Pruefplatz | undefined;
  let browser: Browser | undefined;
  let laufzustand: Laufzustand | undefined;
  let chromiumFassung = "(Fassung nicht abfragbar)";
  let flaeche = "nicht hergestellt";
  let protokollzeile = "";

  beforeAll(async () => {
    const ergebnis = await pruefplatzOeffnen();
    if (ergebnis.skipGrund !== undefined) {
      laufzustand = { gelaufen: false, grund: ergebnis.skipGrund };
      process.stderr.write(
        `${JOB} ÜBERSPRUNGEN — KEINE DATENBANK ERREICHBAR: ${ergebnis.skipGrund}\n` +
          `${JOB} Die Bilddarstellung des Rückwegs ist damit NICHT gemessen.\n`,
      );
      return;
    }
    platz = ergebnis.platz;
    flaeche = flaecheBereitstellen();
    browser = await starteChromium();
    chromiumFassung =
      typeof (browser as unknown as { version?: () => string }).version === "function"
        ? (browser as unknown as { version: () => string }).version()
        : chromiumFassung;
    laufzustand = { gelaufen: true, quelle: `${platz.pgFassung} · Chromium ${chromiumFassung}` };
    process.stderr.write(
      `${JOB} STARTBELEG: PostgreSQL=${platz.pgFassung} · Chromium=${chromiumFassung} · Fläche=${flaeche}\n`,
    );
  }, 900_000);

  afterAll(async () => {
    await browser?.close().catch(() => undefined);
    await platz?.abraeumen();
    // Entweder die Protokollzeile ODER die Skip-Zeile — nie beides (Auftrag §5 Nr. 7).
    if (protokollzeile !== "") {
      process.stderr.write(`${protokollzeile}\n`);
    } else if (laufzustand?.gelaufen !== true) {
      process.stderr.write(
        `${JOB} KEINE PROTOKOLLZEILE: die Strecke ist nicht gefahren — ein übersprungener Lauf ist KEIN bestandener.\n`,
      );
    }
  }, 180_000);

  // ------------------------------------------------------------------------------------------------
  // DER LAUFZUSTAND-ZEUGE — er läuft bei JEDEM Lauf DIESER Datei (Hausform
  // `services/audit/src/repo-pg.integration.test.ts:38-52`). Er ruft nie den Prüfplatz und kann
  // deshalb nie übersprungen werden: ein Skip darf nie wie ein Lauf aussehen.
  // ------------------------------------------------------------------------------------------------
  it("W0 · Laufzustand: GELAUFEN mit Quelle oder ÜBERSPRUNGEN mit Grund — nie stumm", () => {
    expect(
      laufzustand,
      "KEIN LAUFZUSTAND — beforeAll lief nicht durch. Das ist ein Befund und kein Grün.",
    ).toBeDefined();
    const z = laufzustand as Laufzustand;
    if (z.gelaufen) {
      expect(z.quelle, "GELAUFEN ohne Quelle wäre eine leere Zusage").not.toBe("");
      process.stderr.write(`${JOB} LAUFZUSTAND: GELAUFEN gegen ${z.quelle}.\n`);
    } else {
      expect(z.grund, "ÜBERSPRUNGEN ohne Grund wäre ein stiller Skip").not.toBe("");
      process.stderr.write(
        `${JOB} LAUFZUSTAND: ÜBERSPRUNGEN — Grund: ${z.grund}. Die Stationen (a)–(e) wurden NICHT geprüft.\n`,
      );
    }
  });

  it("W1 · Nutzlast im rwLadung-Format → Socket → PostgreSQL → Übernahme → Chromium zeigt beide Bilder", async (ctx) => {
    if (!platz || !browser) {
      ctx.skip();
      return;
    }
    const lage = await fahreStrecke(platz, "haupt");
    const fenster: Kontext[] = [];
    try {
      // ── (a) DIE ABLAGE, ZWEIMAL GELESEN ───────────────────────────────────────────────────────
      await pruefeAblage(lage);

      // ── (b) DIE FLÄCHE IM ECHTEN CHROMIUM ─────────────────────────────────────────────────────
      const erste = await neuerKontext(browser);
      fenster.push(erste.kontext);
      await anmelden(erste.seite, lage.instanz.basis, LESER);
      await leseflaecheOeffnen(erste.seite, lage.instanz.basis, lage.koId);
      const messung = await messeAlles(erste.seite, "(b) erste Sitzung");

      // ── (c) NACH EINEM ECHTEN NEULADEN ────────────────────────────────────────────────────────
      await erste.seite.reload({ waitUntil: "load" });
      await warteAufBeideBilder(erste.seite);
      await messeAlles(erste.seite, "(c) nach dem Neuladen");

      // ── (d) EINE NEUE SITZUNG AUS EINEM FRISCHEN PROFIL ───────────────────────────────────────
      // Damit ist „aus dem Speicher der ersten Seite" ausgeschlossen: leerer Keksbeutel, neue
      // Anmeldung, dieselbe Adresse.
      await erste.kontext.close();
      fenster.pop();
      const zweite = await neuerKontext(browser);
      fenster.push(zweite.kontext);
      await anmelden(zweite.seite, lage.instanz.basis, LESER);
      await leseflaecheOeffnen(zweite.seite, lage.instanz.basis, lage.koId);
      await messeAlles(zweite.seite, "(d) neue Sitzung");
      await zweite.kontext.close();
      fenster.pop();

      // ── (e) GEGENPROBE LESERECHT — begrenzt auf FRISCHE Zugriffe ──────────────────────────────
      // Kalibriert dadurch, dass (b)/(c)/(d) mit DEMSELBEN Leser an DERSELBEN Adresse positiv
      // waren. Einziger Unterschied ist jetzt die Stufe.
      //
      // Der API-Teil steht in `pruefeRechteentzug`: Kontrollobjekt, Vorherlesung, Rechtegriff, 404
      // und der Ausschluss ERST NACH Status, Struktur und erforderlichem Inhalt der Liste (Runde 2,
      // BENs Gegenprobe). Danach dasselbe in einem frischen Browserkontext.
      const kontrollId = await wissensobjektAnlegen(lage.admin, KONTROLLTITEL);
      await pruefeRechteentzug(lage, "(e)", kontrollId);

      const dritte = await neuerKontext(browser);
      fenster.push(dritte.kontext);
      await anmelden(dritte.seite, lage.instanz.basis, LESER);
      await dritte.seite.goto(
        `${lage.instanz.basis}/bibliothek?eintrag=${encodeURIComponent(lage.koId)}`,
        { waitUntil: "load" },
      );
      // Ein positives Signal, dass der Ladeversuch WIRKLICH stattgefunden hat und gescheitert ist —
      // ohne es wäre „kein Bild da" auch dann wahr, wenn die Fläche noch gar nichts geladen hätte.
      await warte(
        dritte.seite,
        `() => { const l = document.querySelector('[data-testid="bib-lesen"]');
          return !!l && (l.innerText || "").indexOf(${JSON.stringify(LADEFEHLER)}) >= 0; }`,
        "(e) die Lesefläche sagt, dass der Eintrag nicht zu laden war",
        undefined,
        45_000,
      );
      const restQuellen = await quellenLesen(dritte.seite);
      expect(
        restQuellen,
        "(e) im frischen Kontext stehen nach dem Entzug weiterhin Bilder in der Lesefläche",
      ).toEqual([]);
      const quelltext = await seitenquelltext(dritte.seite);
      for (const fix of FIXTUREN) {
        expect(
          quelltext.includes(fix.quelle.slice(0, 64)),
          `(e) der Seitenquelltext trägt weiterhin den Anfang der Quelle von Bild ${fix.bild.nr}`,
        ).toBe(false);
      }
      expect(
        quelltext.includes(TITEL),
        "(e) der Seitenquelltext nennt weiterhin den Titel des vertraulichen Objekts",
      ).toBe(false);
      await dritte.kontext.close();
      fenster.pop();

      // ── DIE PROTOKOLLZEILE (Auftrag §5 Nr. 7) ────────────────────────────────────────────────
      const teile = FIXTUREN.map((fix, i) => {
        const innen = messung.fotos[i] as Fotobefund;
        return `Bild${fix.bild.nr}=${fix.bild.breite}×${fix.bild.hoehe} sha256(RGBA,dekodiert)=${fix.sha256Rgba} Foto-Innen=${innen.innenBreite}×${innen.innenHoehe} gleich`;
      });
      protokollzeile = `${JOB} GELAUFEN · PostgreSQL=${platz.pgFassung} · Chromium=${chromiumFassung} · Socket=127.0.0.1:${lage.instanz.port} · Objekt=${lage.koId} · Nutzlast=rwLadung-Format(Test) · ${teile.join(" · ")} · Maßstab=1 · Ablage=2 Quellen (DB=API)`;
    } finally {
      for (const k of fenster) {
        await k.close().catch(() => undefined);
      }
      await lage.abraeumen();
    }
  }, 900_000);

  // ==============================================================================================
  // DIE KALIBRIERUNGEN — sie sind ABSICHTLICH ROT und laufen nur auf ausdrückliche Anforderung.
  // ==============================================================================================
  //
  // Jede verstellt genau EINE Sache und zeigt, dass genau die zugehörige Station das merkt. Sie
  // enden mit einem eigenen Wurf, damit der Lauf Exit 1 hat UND die Rückgabe den Satz zitieren
  // kann, mit dem die Station rot wurde. Eine Kalibrierung, die grün bliebe, wäre der Beweis, dass
  // die Station nichts misst — auch dann ist sie rot, aber mit anderem Grund.
  //
  // ZWEI SCHALTER, EIN GRUND: `KLARWERK_KALIBRIERUNG=1` (so steht es im Auftrag) ODER die Marke
  // im Arbeitsbaum. Warum die Marke überhaupt existiert, steht bei `KALIBRIERUNGSMARKE` in
  // `pruefbilder.ts`: der Cloud-Wrapper nimmt keine Umgebungsvariable entgegen.
  const kalibriert =
    process.env.KLARWERK_KALIBRIERUNG === "1" || existsSync(repoPfad(KALIBRIERUNGSMARKE));

  function ueberspringe(ctx: { skip: () => void }, welche: string): boolean {
    if (kalibriert) {
      return false;
    }
    process.stderr.write(
      `${JOB} KALIBRIERUNG ${welche} übersprungen: sie ist absichtlich ROT und läuft nur mit KLARWERK_KALIBRIERUNG=1 oder der Marke ${KALIBRIERUNGSMARKE}.\n`,
    );
    ctx.skip();
    return true;
  }

  it("KAL-i · Bild 2 ausblenden → (b2) wird rot, (b1) bleibt grün", async (ctx) => {
    if (ueberspringe(ctx, "(i)")) {
      return;
    }
    if (!platz || !browser) {
      ctx.skip();
      return;
    }
    const lage = await fahreStrecke(platz, "kali");
    const { kontext, seite } = await neuerKontext(browser);
    try {
      await anmelden(seite, lage.instanz.basis, LESER);
      await leseflaecheOeffnen(seite, lage.instanz.basis, lage.koId);
      await pruefeSammlung(seite, "KAL-i Vorbedingung");

      // Der Griff geht über die SAMMLUNG und belegt jeden Schritt — kein `img:nth-of-type(2)`.
      const aus: Ausblendbefund = await bildAusblenden(seite, 1);
      expect(aus.fehler, `KAL-i Vorbedingung: ${aus.fehler ?? ""}`).toBeNull();
      expect(aus.anzahl, "KAL-i Vorbedingung: es stehen nicht genau zwei Bilder da").toBe(2);
      const zwei = FIXTUREN[1] as (typeof FIXTUREN)[number];
      expect(
        aus.srcAnfang === zwei.quelle.slice(0, 64) &&
          aus.srcEnde === zwei.quelle.slice(-64) &&
          aus.srcLaenge === zwei.quelle.length,
        "KAL-i Vorbedingung: das ausgeblendete Element trägt NICHT die Quelle von Bild 2",
      ).toBe(true);
      expect(
        [aus.breiteDanach, aus.hoeheDanach],
        "KAL-i Vorbedingung: das Ausblenden hat nichts bewirkt — das Rechteck ist nicht 0×0",
      ).toEqual([0, 0]);
      expect(
        aus.sichtbarDanach,
        "KAL-i Vorbedingung: checkVisibility() meldet das Bild weiterhin als sichtbar",
      ).toBe(false);

      // (b1) muss GRÜN bleiben: die dekodierte Quelle ist unverändert. Das zeigt, dass (b1) und
      // (b2) verschiedene Dinge messen.
      await pruefeInhalt(seite, "KAL-i (b1) bleibt grün", ERWARTET);

      let gefangen: unknown;
      try {
        await pruefeSicht(seite, "KAL-i");
      } catch (fehler) {
        gefangen = fehler;
      }
      expect(
        gefangen,
        "KAL-i: Bild 2 war ausgeblendet und (b2) blieb GRÜN — die Sichtbarkeitsmessung misst nichts",
      ).toBeDefined();
      const satz = String((gefangen as Error).message ?? gefangen);
      expect(satz, "KAL-i: die Meldung nennt nicht das Feld „Bild 2“").toContain("Bild 2");
      expect(satz, "KAL-i: die Meldung nennt nicht die Station (b2)").toContain("(b2)");
      throw new Error(
        `${JOB} KALIBRIERUNG (i) HAT GEGRIFFEN — (b2) wurde feldweise rot, (b1) blieb grün. Wörtlich: ${satz}`,
      );
    } finally {
      await kontext.close().catch(() => undefined);
      await lage.abraeumen();
    }
  }, 900_000);

  it("KAL-ii · einen Kanal von Bild 1 verstellen → (b1) und (b3) werden rot, an derselben Stelle", async (ctx) => {
    if (ueberspringe(ctx, "(ii)")) {
      return;
    }
    if (!platz || !browser) {
      ctx.skip();
      return;
    }
    const lage = await fahreStrecke(platz, "kalii");
    const { kontext, seite } = await neuerKontext(browser);
    try {
      await anmelden(seite, lage.instanz.basis, LESER);
      await leseflaecheOeffnen(seite, lage.instanz.basis, lage.koId);

      // Ein Punkt MITTEN im Innenbereich (x=20, y=20 liegt in 14…81 × 14…49), damit auch (b3) ihn
      // sehen muss. Verstellt wird die ERWARTUNG, nicht das Produkt.
      const eins = FIXTUREN[0] as (typeof FIXTUREN)[number];
      const verstellt = Buffer.from(ERWARTET[0] as Buffer);
      const stelle = (20 * eins.bild.breite + 20) * 4;
      verstellt[stelle + 1] = ((verstellt[stelle + 1] as number) + 7) % 256;
      const erwartung = [verstellt, ERWARTET[1] as Buffer] as const;

      await pruefeSammlung(seite, "KAL-ii Vorbedingung");
      let ausB1: unknown;
      try {
        await pruefeInhalt(seite, "KAL-ii", erwartung);
      } catch (fehler) {
        ausB1 = fehler;
      }
      expect(
        ausB1,
        "KAL-ii: die Erwartung war verstellt und (b1) blieb GRÜN — der Inhalt wird nicht gemessen",
      ).toBeDefined();
      const satzB1 = String((ausB1 as Error).message ?? ausB1);
      expect(satzB1, "KAL-ii: (b1) meldet nicht den Inhalt").toContain("(b1)");
      expect(satzB1, "KAL-ii: (b1) nennt nicht die Stelle (20,20)").toContain("(20,20)");
      expect(satzB1, "KAL-ii: (b1) wurde an der ZAHL der Bilder rot statt am Inhalt").not.toContain(
        "nicht genau zwei Bilder",
      );

      // Und dieselbe Stelle im Foto: (20,20) im Bild ist (6,6) im Innenbereich.
      await pruefeSicht(seite, "KAL-ii Vorbedingung");
      let ausB3: unknown;
      try {
        await pruefeFoto(seite, "KAL-ii", erwartung);
      } catch (fehler) {
        ausB3 = fehler;
      }
      expect(
        ausB3,
        "KAL-ii: die Erwartung war verstellt und (b3) blieb GRÜN — das Foto wird nicht verglichen",
      ).toBeDefined();
      const satzB3 = String((ausB3 as Error).message ?? ausB3);
      expect(satzB3, "KAL-ii: (b3) meldet nicht den Innenbereich").toContain("(b3)");
      expect(satzB3, "KAL-ii: (b3) nennt nicht dieselbe Stelle im Bild").toContain("(20,20)");
      throw new Error(`${JOB} KALIBRIERUNG (ii) HAT GEGRIFFEN — (b1): ${satzB1}\n(b3): ${satzB3}`);
    } finally {
      await kontext.close().catch(() => undefined);
      await lage.abraeumen();
    }
  }, 900_000);

  it("KAL-iii · Station (e) OHNE den confidentiality-Griff → (e) wird rot", async (ctx) => {
    if (ueberspringe(ctx, "(iii)")) {
      return;
    }
    if (!platz || !browser) {
      ctx.skip();
      return;
    }
    const lage = await fahreStrecke(platz, "kaliii");
    const { kontext, seite } = await neuerKontext(browser);
    try {
      // KEIN `{ action: "confidentiality", level: "vertraulich" }` — alles andere wie in (e).
      const kontrollId = await wissensobjektAnlegen(lage.admin, KONTROLLTITEL);
      const abruf = await lage.leser.sende("GET", `/api/kos/${lage.koId}`);
      const liste = await listeLesen(lage.leser, "KAL-iii Vorbedingung (Liste ohne Entzug)");
      await anmelden(seite, lage.instanz.basis, LESER);
      await leseflaecheOeffnen(seite, lage.instanz.basis, lage.koId);
      const quellen = await quellenLesen(seite);
      const quelltext = await seitenquelltext(seite);
      const eins = FIXTUREN[0] as (typeof FIXTUREN)[number];
      // DIE URSACHE STEHT IM ERSTEN HALBSATZ (Runde 2, HINWEIS Punkt 4): wer diesen Fehler liest,
      // soll nicht einen Produktbefund vermuten, sondern den ausgelassenen Griff.
      const ursache =
        "URSACHE: der confidentiality-Griff wurde in DIESER Kalibrierung ABSICHTLICH AUSGELASSEN — das ist kein Produktbefund, sondern der verstellte Handgriff.";
      const satz =
        `${ursache} Folge: B sieht weiterhin alles: GET /api/kos/:id → ${abruf.status} (Station (e) erwartet 404), ` +
        `Kennung in GET /api/kos: ${liste.ids.includes(lage.koId)} (Kontrollobjekt ${kontrollId}: ${liste.ids.includes(kontrollId)}), ` +
        `${quellen.length} Bilder in der Lesefläche, Quelle von Bild 1 im Seitenquelltext: ${quelltext.includes(eins.quelle.slice(0, 64))}`;
      expect(abruf.status, `KAL-iii: ${satz}`).toBe(200);
      expect(liste.ids.includes(lage.koId), `KAL-iii: ${satz}`).toBe(true);
      expect(quellen.length, `KAL-iii: ${satz}`).toBe(2);
      throw new Error(
        `${JOB} KALIBRIERUNG (iii) HAT GEGRIFFEN — ${satz}. Station (e) misst also den Rechtegriff und nicht die Abwesenheit der Fläche.`,
      );
    } finally {
      await kontext.close().catch(() => undefined);
      await lage.abraeumen();
    }
  }, 900_000);

  it("KAL-iv · Innenbereich künstlich auf 0×0 (Randabzug 50 px) → (b3) wird rot an der Vorbedingung", async (ctx) => {
    if (ueberspringe(ctx, "(iv)")) {
      return;
    }
    if (!platz || !browser) {
      ctx.skip();
      return;
    }
    const lage = await fahreStrecke(platz, "kaliv");
    const { kontext, seite } = await neuerKontext(browser);
    try {
      await anmelden(seite, lage.instanz.basis, LESER);
      await leseflaecheOeffnen(seite, lage.instanz.basis, lage.koId);
      await pruefeSammlung(seite, "KAL-iv Vorbedingung");
      await pruefeSicht(seite, "KAL-iv Vorbedingung");
      let gefangen: unknown;
      try {
        // 50 px Rand je Seite: 96−100 < 0 und 80−100 < 0 — der Innenbereich ist leer.
        await pruefeFoto(seite, "KAL-iv", ERWARTET, 50);
      } catch (fehler) {
        gefangen = fehler;
      }
      expect(
        gefangen,
        "KAL-iv: der Innenbereich war leer und (b3) blieb GRÜN — die Grösse wird gar nicht zugesichert",
      ).toBeDefined();
      const satz = String((gefangen as Error).message ?? gefangen);
      expect(satz, "KAL-iv: die Meldung nennt nicht die Station (b3)").toContain("(b3)");
      expect(
        satz,
        "KAL-iv: (b3) wurde nicht an der Vorbedingung „Innenbereich zu klein“ rot",
      ).toContain("kleiner als");
      throw new Error(
        `${JOB} KALIBRIERUNG (iv) HAT GEGRIFFEN — (b3) wurde an der Vorbedingung rot statt still grün. Wörtlich: ${satz}`,
      );
    } finally {
      await kontext.close().catch(() => undefined);
      await lage.abraeumen();
    }
  }, 900_000);

  // ----------------------------------------------------------------------------------------------
  // KAL-v UND KAL-vi — DIE ZWEI KALIBRIERUNGEN DER RUNDE 2.
  // ----------------------------------------------------------------------------------------------
  //
  // Sie treffen genau die Stelle, an der BEN Runde 1 rot gemacht hat: den Listenausschluss in
  // Station (e). Verstellt wird NICHT das Produkt und NICHT die Erwartung, sondern — wörtlich wie in
  // BENs Gegenprobe — der GELESENE ANTWORTWERT nach dem echten Abruf. Beide fahren dafür die ganze
  // Station (e) (Kontrollobjekt, Vorherlesung, Rechtegriff, 404) und ersetzen nur die eine Lesung.
  //
  // Sie brauchen kein Chromium: der Befund sitzt in der API-Messung. Der Browserteil von (e) bleibt
  // von KAL-iii gedeckt.

  /** BENs Gegenprobe, wörtlich (`jobs/4329/runde-1/ben.md`): ein ausgefallener Abruf. */
  const AUSFALL_503: Verstellung = () => ({
    status: 503,
    text: "Service unavailable",
    json: undefined,
  });

  it("KAL-v · Liste als HTTP 503 ohne Rumpf → (e) wird an der VORAUSSETZUNG Status rot", async (ctx) => {
    if (ueberspringe(ctx, "(v)")) {
      return;
    }
    if (!platz) {
      ctx.skip();
      return;
    }
    const lage = await fahreStrecke(platz, "kalv");
    try {
      const kontrollId = await wissensobjektAnlegen(lage.admin, KONTROLLTITEL);
      let gefangen: unknown;
      try {
        await pruefeRechteentzug(lage, "(e)", kontrollId, AUSFALL_503);
      } catch (fehler) {
        gefangen = fehler;
      }
      expect(
        gefangen,
        "KAL-v: eine 503-Antwort OHNE Liste kam durch und (e) blieb GRÜN — ein ausgefallener Messweg gilt weiterhin als fachlicher Erfolg (genau der Befund BENs aus Runde 1)",
      ).toBeDefined();
      const satz = String((gefangen as Error).message ?? gefangen);
      expect(satz, "KAL-v: die Meldung nennt den Status 503 nicht").toContain("HTTP 503");
      expect(satz, "KAL-v: die Meldung nennt die Voraussetzung „nicht abrufbar“ nicht").toContain(
        "NICHT ABRUFBAR",
      );
      // Rot geworden ist die VORAUSSETZUNG und nicht der Abwesenheitsvergleich …
      expect(
        satz,
        "KAL-v: rot wurde der Abwesenheitsvergleich statt die Voraussetzung",
      ).not.toContain("FÜHRT DIE KENNUNG");
      // … und nicht die Vorherlesung: die lief unverstellt und war tragend.
      expect(satz, "KAL-v: rot wurde die Vorherlesung statt die Lesung nach dem Entzug").toContain(
        "Liste nach dem Entzug",
      );

      // DIE POSITIVE KONTROLLE: dieselbe Messstelle, dieselbe Lage, nur ohne Verstellung → GRÜN.
      // Damit ist belegt, dass allein der ersetzte Antwortwert das Rot erklärt.
      await pruefeListeOhne(
        lage.leser,
        "KAL-v positive Kontrolle (Liste nach dem Entzug, unverstellt)",
        lage.koId,
        kontrollId,
      );

      throw new Error(
        `${JOB} KALIBRIERUNG (v) HAT GEGRIFFEN — der Listenausschluss ist gegen ausgefallene Abrufe gesichert; unverstellt bleibt dieselbe Messstelle grün. Wörtlich: ${satz}`,
      );
    } finally {
      await lage.abraeumen();
    }
  }, 900_000);

  it("KAL-vi · untaugliche Liste (Objekt, Einträge ohne Kennung, leer, fremd) → (e) wird an der VORAUSSETZUNG rot", async (ctx) => {
    if (ueberspringe(ctx, "(vi)")) {
      return;
    }
    if (!platz) {
      ctx.skip();
      return;
    }
    const lage = await fahreStrecke(platz, "kalvi");
    try {
      const kontrollId = await wissensobjektAnlegen(lage.admin, KONTROLLTITEL);

      // (a) OBJEKT STATT LISTE — über den GANZEN Stationsweg, wie in (e).
      let ausObjekt: unknown;
      try {
        await pruefeRechteentzug(lage, "(e)", kontrollId, () => ({
          status: 200,
          text: '{"items":[]}',
          json: { items: [] },
        }));
      } catch (fehler) {
        ausObjekt = fehler;
      }
      expect(
        ausObjekt,
        "KAL-vi (a): ein Objekt statt einer Liste kam durch und (e) blieb GRÜN — die Struktur wird nicht geprüft",
      ).toBeDefined();
      const satzObjekt = String((ausObjekt as Error).message ?? ausObjekt);
      expect(satzObjekt, "KAL-vi (a): die Meldung nennt die Struktur nicht").toContain(
        "KEINE JSON-LISTE",
      );
      expect(satzObjekt, "KAL-vi (a): die Meldung nennt die vorgefundene Form nicht").toContain(
        "Objekt mit den Schlüsseln [items]",
      );
      expect(
        satzObjekt,
        "KAL-vi (a): rot wurde der Abwesenheitsvergleich statt die Voraussetzung",
      ).not.toContain("FÜHRT DIE KENNUNG");

      // DIE POSITIVE KONTROLLE zwischen den Varianten: das Objekt IST jetzt vertraulich (der Griff
      // aus (a) ist gefahren), und unverstellt ist genau diese Messstelle GRÜN.
      await pruefeListeOhne(
        lage.leser,
        "KAL-vi positive Kontrolle (Liste nach dem Entzug, unverstellt)",
        lage.koId,
        kontrollId,
      );

      // (b) EINE LISTE, DEREN EINTRÄGE KEINE KENNUNG TRAGEN.
      const ohneKennung = [{ title: "Zeile ohne Kennung" }, { id: 17 }];
      let ausOhneKennung: unknown;
      try {
        await pruefeListeOhne(
          lage.leser,
          "(e) Liste nach dem Entzug",
          lage.koId,
          kontrollId,
          () => ({ status: 200, text: JSON.stringify(ohneKennung), json: ohneKennung }),
        );
      } catch (fehler) {
        ausOhneKennung = fehler;
      }
      expect(
        ausOhneKennung,
        "KAL-vi (b): eine Liste ohne Kennungen kam durch und (e) blieb GRÜN — die Einträge werden nicht geprüft",
      ).toBeDefined();
      const satzOhneKennung = String((ausOhneKennung as Error).message ?? ausOhneKennung);
      expect(satzOhneKennung, "KAL-vi (b): die Meldung nennt die fehlende Kennung nicht").toContain(
        "TRÄGT KEINE KENNUNG",
      );
      expect(
        satzOhneKennung,
        "KAL-vi (b): rot wurde der Abwesenheitsvergleich statt die Voraussetzung",
      ).not.toContain("FÜHRT DIE KENNUNG");

      // (c) EINE LEERE LISTE — der Ersatzwert, der jeden Ausschluss erfüllt.
      let ausLeer: unknown;
      try {
        await pruefeListeOhne(
          lage.leser,
          "(e) Liste nach dem Entzug",
          lage.koId,
          kontrollId,
          () => ({ status: 200, text: "[]", json: [] }),
        );
      } catch (fehler) {
        ausLeer = fehler;
      }
      expect(
        ausLeer,
        "KAL-vi (c): eine LEERE Liste kam durch und (e) blieb GRÜN — dann belegte der Ausschluss nichts",
      ).toBeDefined();
      const satzLeer = String((ausLeer as Error).message ?? ausLeer);
      expect(satzLeer, "KAL-vi (c): die Meldung nennt die leere Liste nicht").toContain("ist LEER");
      expect(
        satzLeer,
        "KAL-vi (c): rot wurde der Abwesenheitsvergleich statt die Voraussetzung",
      ).not.toContain("FÜHRT DIE KENNUNG");

      // (d) EINE GÜLTIGE, ABER FREMDE LISTE: Status, Struktur und Kennungen sind in Ordnung, nur der
      // Zeuge fehlt — so sieht eine Antwort aus, die zu einem anderen Leser oder zu einem älteren
      // Stand gehört. Sie ist die letzte Form, in der ein Ausschluss noch still wahr wäre.
      const fremd = [{ id: "11111111-2222-4333-8444-555555555555", title: "fremder Eintrag" }];
      let ausFremd: unknown;
      try {
        await pruefeListeOhne(
          lage.leser,
          "(e) Liste nach dem Entzug",
          lage.koId,
          kontrollId,
          () => ({ status: 200, text: JSON.stringify(fremd), json: fremd }),
        );
      } catch (fehler) {
        ausFremd = fehler;
      }
      expect(
        ausFremd,
        "KAL-vi (d): eine gültige, aber FREMDE Liste ohne das Kontrollobjekt kam durch und (e) blieb GRÜN — der erforderliche Inhalt wird nicht geprüft",
      ).toBeDefined();
      const satzFremd = String((ausFremd as Error).message ?? ausFremd);
      expect(satzFremd, "KAL-vi (d): die Meldung nennt den fehlenden Zeugen nicht").toContain(
        "FÜHRT DAS INTERNE KONTROLLOBJEKT NICHT",
      );
      expect(
        satzFremd,
        "KAL-vi (d): rot wurde der Abwesenheitsvergleich statt die Voraussetzung",
      ).not.toContain("FÜHRT DIE KENNUNG");

      throw new Error(
        `${JOB} KALIBRIERUNG (vi) HAT GEGRIFFEN — vier untaugliche Listen scheitern je an ihrer Voraussetzung, unverstellt bleibt dieselbe Messstelle grün.\n(a) ${satzObjekt}\n(b) ${satzOhneKennung}\n(c) ${satzLeer}\n(d) ${satzFremd}`,
      );
    } finally {
      await lage.abraeumen();
    }
  }, 900_000);
});
