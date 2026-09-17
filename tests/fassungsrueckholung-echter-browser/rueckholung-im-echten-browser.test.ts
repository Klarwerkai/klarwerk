// ================================================================================================
// JOB 4263 · R — DIE RÜCKHOLUNG IM ECHTEN BROWSER, GEGEN SPEICHERABLAGEN.
// ================================================================================================
//
// DIESE DATEI FÄHRT DEN WEG AUS `weg.ts` mit den Speicherfassungen — der schnelle Nachweis, der im
// Tor ohne Docker und ohne Datenbank läuft. `rueckholung-pg.integration.test.ts` fährt DENSELBEN
// Weg gegen echte PostgreSQL und legt Neustart und eine unabhängige Lesung am Pool daneben.
//
// LAUFVORAUSSETZUNG, laut und nicht still: `apps/web/dist`. Im Tor liegt es vor (`tools/check:9`);
// fehlt es, stellt `stelleFlaecheBereit()` es mit demselben Bündler her, statt zu überspringen.
//
// WAS DIESE DATEI NICHT BEHAUPTET: nichts über PostgreSQL, nichts über einen App-Neustart. Beides
// steht ausschliesslich im Integrationslauf daneben.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type Browser, starteChromium } from "../gast-nutzerweg/browserweg";
import {
  PASSWORT,
  type Sitzung,
  type Strecke,
  ersteinrichtung,
  gastAnlegen,
  starteStrecke,
} from "../gast-nutzerweg/strecke";
import { ermittleBrowserbefund } from "../tor-inventar/browser-gruppe";
import {
  BERICHT_ALT,
  BERICHT_FREMD,
  BERICHT_NEU,
  type Bremse,
  FASSUNG_ALT,
  FASSUNG_NEU,
  MARKE_ALT,
  MARKE_FREMD,
  MARKE_NEU,
  T,
  browserKennung,
  fahreAnhangkontrolle,
  fahreDieRueckholung,
  fahreRechtekontrolle,
  holeStand,
  ladeBildHoch,
  legeEintragAn,
  legeFassungenAn,
  mitFlaecheBremseMutation,
  neueBremse,
  stelleFlaecheBereit,
  ueberarbeite,
} from "./weg";

const ADMIN = "rueckholer@fassung-4263.test";
const FREMD = "fremder@fassung-4263.test";
const LESER = "leser@fassung-4263.test";
const TITEL = "Dichtungswechsel Presse 7 (JOB 4263)";
const ANHANG_TITEL = "Typenschild-Fall (JOB 4263)";

/** Der Pfad dieser Datei, wie ihn `browser-gruppe.ts` führt — posix-relativ zur Werkswurzel. */
const SELBST = "tests/fassungsrueckholung-echter-browser/rueckholung-im-echten-browser.test.ts";

let strecke: Strecke | undefined;
let browser: Browser | undefined;
let adminApi: Sitzung;
let fremderApi: Sitzung;
let leserApi: Sitzung;
let koId = "";
let anhangKoId = "";
let bildId = "";
let flaeche = "nicht hergestellt";
const bremse: Bremse = neueBremse();

beforeAll(async () => {
  flaeche = stelleFlaecheBereit();
  browser = await starteChromium();
  // Der Prüfstand nennt sich selbst — die Zahlen im Bericht stammen aus dem Lauf, nicht aus einer
  // Abhängigkeitsliste (Auftrag § 5, Lieferung 6).
  process.stderr.write(
    `[KLARWERK] JOB 4263 · Prüfstand: Chromium ${browserKennung(browser)} · Fläche: ${flaeche}\n`,
  );
  strecke = await starteStrecke(mitFlaecheBremseMutation(bremse));
  adminApi = (await ersteinrichtung(strecke, ADMIN)).sitzung;

  // Zwei weitere Menschen an derselben Instanz: einer, der dazwischenschreibt, und einer, der
  // lesen darf und nicht bearbeiten.
  const fremd = await gastAnlegen(adminApi, { name: "Fremde Hand", email: FREMD, role: "admin" });
  expect(fremd.status, fremd.text).toBe(201);
  const leser = await gastAnlegen(adminApi, { name: "Nur Lesen", email: LESER, role: "viewer" });
  expect(leser.status, leser.text).toBe(201);
  fremderApi = strecke.profil("fremder");
  leserApi = strecke.profil("leser");
  for (const [sitzung, email] of [
    [fremderApi, FREMD],
    [leserApi, LESER],
  ] as const) {
    const an = await sitzung.sende("POST", "/api/auth/login", { email, password: PASSWORT });
    expect(an.status, `${email}: ${an.text}`).toBe(200);
  }

  // ── DER EINTRAG MIT ZWEI EIGENEN TEXTFASSUNGEN (Auftrag § 5, Lieferung 2a). ─────────────────
  koId = await legeFassungenAn(adminApi, TITEL, [FASSUNG_ALT, FASSUNG_NEU]);
  const ausgang = await holeStand(adminApi, koId);
  expect(ausgang.version, "der Ausgangsstand ist nicht v2").toBe(2);
  expect(ausgang.statement, "der Ausgangsstand trägt nicht die jüngere Marke").toBe(MARKE_NEU);
  // DER AUSGANGS-SNAPSHOT DES BERICHTS, getrennt festgehalten: Kernaussage und Bericht tragen
  // verschiedene Marken, und nur so ist später zu sehen, ob der BERICHT zurückgeholt wurde.
  expect(ausgang.bodyHtml, "der Ausgangsstand trägt nicht die jüngere Berichtsmarke").toContain(
    BERICHT_NEU,
  );
  expect(ausgang.bodyHtml, "der Ausgangsbericht trägt schon die ältere Marke").not.toContain(
    BERICHT_ALT,
  );

  // ── DER ANHANGSFALL: A lädt das Bild hoch, der Fremde schreibt es in seinen Eintrag und ────
  //    entfernt es in v2. Zurückholen würde die Kennung wiederbeleben — genau das darf nicht.
  bildId = await ladeBildHoch(adminApi, "typenschild-4263.png");
  anhangKoId = await legeEintragAn(
    fremderApi,
    ANHANG_TITEL,
    "Mit Bild.",
    `<p>Typenschild: <img src="/api/objects/${bildId}/raw"></p>`,
  );
  const ohneBild = await ueberarbeite(fremderApi, anhangKoId, {
    statement: "Ohne Bild.",
    bodyHtml: "<p>Ohne Bild.</p>",
  });
  expect(ohneBild.status, ohneBild.text).toBe(200);
}, 900_000);

afterAll(async () => {
  await browser?.close();
  await strecke?.schliessen();
}, 120_000);

function zeug(): { browser: Browser; strecke: Strecke } {
  if (!browser || !strecke) {
    throw new Error("JOB 4263: Browser oder Strecke fehlen — der Aufbau ist nicht durchgelaufen.");
  }
  return { browser, strecke };
}

describe("JOB 4263 R · eine frühere Fassung per Tastatur zurückholen, im echten Browser", () => {
  it("R1 — vergleichen, übernehmen, Konflikt erleben, erneut greifen — und der Inhalt steht nach erneutem Öffnen wieder da", async () => {
    const { browser: b, strecke: s } = zeug();
    process.stderr.write(`[KLARWERK] JOB 4263 R1 läuft · Fläche: ${flaeche}\n`);
    const befund = await fahreDieRueckholung({
      browser: b,
      strecke: s,
      bremse,
      eigeneApi: adminApi,
      eigeneEmail: ADMIN,
      koId,
      titel: TITEL,
      zielFassung: 1,
      markeZiel: MARKE_ALT,
      berichtZiel: BERICHT_ALT,
      standVorher: 2,
      fremderApi,
    });

    // ── DIE GEGENÜBERSTELLUNG hat wirklich BEIDE Fassungen gezeigt. ────────────────────────────
    expect(befund.vergleichStatement, "der ALTE Wert fehlt in der Gegenüberstellung").toContain(
      MARKE_ALT,
    );
    expect(befund.vergleichStatement, "der JÜNGERE Wert fehlt in der Gegenüberstellung").toContain(
      MARKE_NEU,
    );

    // ── DIE DREI ZUSTÄNDE DER ÜBERNAHMELAGE (Auftrag § 9). ─────────────────────────────────────
    expect(befund.konfliktSatz, "der Konfliktzustand wurde nicht erreicht").toContain(
      T("ko.snapshotRestoreStale"),
    );
    // Und er empfiehlt KEIN Neuladen — dieselbe Korrekturpflicht wie in JOB 4146 R6/R7, hier am
    // echten Browser statt in jsdom.
    for (const wort of ["neu laden", "neu lesen", "neuladen", "aktualisieren"]) {
      expect(
        (befund.konfliktSatz ?? "").toLowerCase(),
        `die Konfliktauskunft empfiehlt „${wort}"`,
      ).not.toContain(wort);
    }
    expect(befund.erfolgSatz, "der Erfolgszustand wurde nicht erreicht").toContain(
      T("ko.snapshotRestoreDone", { version: 1 }),
    );
    expect(
      befund.ladenGelesen,
      "der Ladezustand wurde trotz Bremse nicht gelesen — dann steht er im Bericht unter „Nicht gemessen“",
    ).toBe(true);

    // ── UND DAS ERGEBNIS: vier Fassungen, der Inhalt von v1, die fremde Arbeit nicht verloren. ─
    expect(befund.standNachher.version, "die Fassungskette stimmt nicht").toBe(4);
    expect(befund.standNachher.statement).toBe(MARKE_ALT);
    // DER BERICHT IST EINE EIGENE ZUSAGE, am Datensatz wie auf der Seite (BEN R1, Korrekturpflicht
    // 1): die Kernaussage vertritt ihn auf der Fläche, aber sie ersetzt ihn nicht.
    expect(
      befund.standNachher.bodyHtml,
      "der zurückgeholte Bericht steht nicht im gespeicherten Stand",
    ).toContain(BERICHT_ALT);
    expect(
      befund.standNachher.bodyHtml,
      "im zurückgeholten Bericht steht noch der Text der jüngeren Fassung",
    ).not.toContain(BERICHT_NEU);
    expect(
      befund.textImFrischenProfil,
      "der zurückgeholte Berichtstext steht nach erneutem Öffnen nicht auf der Seite",
    ).toContain(BERICHT_ALT);
    // WAS DIESE VIER ZEILEN WERT SIND, ehrlich unterschieden: die beiden BERICHTS-Zeilen wiegen
    // schwer — der Bericht ist das, was die Leseansicht zeichnet. Die beiden KERNAUSSAGE-Zeilen sind
    // heute schwächer, weil die Leseansicht Kernaussagen überhaupt nur ersatzweise zeigt (gemessen
    // in `weg.ts`, Schritt 7). Sie bleiben als Wächter stehen: taucht eine Kernaussage später doch
    // auf der Seite auf, muss es die zurückgeholte sein und keine andere.
    for (const [was, marke] of [
      ["die jüngere Kernaussage", MARKE_NEU],
      ["der jüngere Berichtstext", BERICHT_NEU],
      ["die Kernaussage des fremden Schreibvorgangs", MARKE_FREMD],
      ["der Berichtstext des fremden Schreibvorgangs", BERICHT_FREMD],
    ] as const) {
      expect(
        befund.textImFrischenProfil,
        `${was} steht nach der Rückholung noch auf der Seite`,
      ).not.toContain(marke);
    }

    // ── DIE SOLLLISTE DES TASTATURWEGES. ───────────────────────────────────────────────────────
    // Sie steht HIER und nicht in `weg.ts`, damit keine Station still verschwinden kann: wer sie
    // dort herausnimmt, muss sie hier austragen und dabei erklären, warum (Bauform aus
    // `tests/gast-nutzerweg/gastweg-im-echten-browser.test.ts:123-127`).
    for (const [was, schritte] of Object.entries(befund.tastatur)) {
      expect(schritte, `${was} wurde nicht per Tab erreicht`).toBeGreaterThan(0);
    }
    expect(
      Object.keys(befund.tastatur).sort(),
      "die Tastaturstationen des Weges sind nicht vollständig",
    ).toEqual(
      [
        "anmeldung_email",
        "anmeldung_passwort",
        "eintrag_mehr",
        "eintrag_abschnitt",
        "vergleich_von",
        "vergleich_bis",
        "fassung_aufklappen",
        "uebernehmen",
        "uebernehmen_erneut",
      ].sort(),
    );
  }, 900_000);

  it("R2 — ohne Übernahmerecht gibt es weder den Knopf noch den Weg am Server vorbei", async () => {
    const { browser: b, strecke: s } = zeug();
    const vorher = await holeStand(adminApi, koId);
    const befund = await fahreRechtekontrolle(b, s, LESER, leserApi, koId, TITEL, 1);

    expect(befund.knopfDa, "der Leser bekommt einen Knopf, der ihm nichts nützt").toBe(false);
    expect(befund.satzAmInhalt, "die Tür ist zu und niemand sagt warum").toContain(
      T("ko.snapshotRestoreNoRight"),
    );
    // BEIDE Hälften: der direkte Griff aus SEINEM Profil, mit SEINEN Keksen, wird abgewiesen.
    expect(
      [401, 403],
      `der direkte Griff des Lesers antwortete ${befund.direkterGriff.status}: ${befund.direkterGriff.rumpf}`,
    ).toContain(befund.direkterGriff.status);
    expect(befund.standDanach.version, "trotz Abweisung ist eine Fassung entstanden").toBe(
      vorher.version,
    );
    expect(befund.standDanach.statement, "trotz Abweisung hat sich der Inhalt geändert").toBe(
      vorher.statement,
    );
    expect(befund.standDanach.bodyHtml, "trotz Abweisung hat sich der Bericht geändert").toBe(
      vorher.bodyHtml,
    );
  }, 600_000);

  it("R3 — ein Anhang, der aus einer älteren Fassung entfernt wurde, bleibt nach der Rückholung gesperrt", async () => {
    const { browser: b, strecke: s } = zeug();
    const befund = await fahreAnhangkontrolle(
      b,
      s,
      ADMIN,
      adminApi,
      leserApi,
      anhangKoId,
      ANHANG_TITEL,
      bildId,
      1,
    );

    expect(
      befund.bildVorher,
      "Vorbedingung verletzt: die Datei ist schon vor der Übernahme offen",
    ).toBe(404);
    // Die Fläche sagt, was los ist, und nennt die Datei, die im Weg steht.
    expect(befund.lageSatz, "die Absage nennt die Datei nicht").toContain(bildId);
    expect(
      befund.lageSatz,
      "die Fläche meldet eine gelungene Übernahme, obwohl der Server abgewiesen hat",
    ).not.toContain(T("ko.snapshotRestoreDone", { version: 1 }));
    expect(befund.standDanach.version, "trotz Abweisung ist eine Fassung entstanden").toBe(2);
    expect(befund.bildNachher, "nach der Übernahme bekommt der Dritte die Rohbytes").toBe(404);
  }, 600_000);

  it("G — dieser Lauf gehört in die serielle Browser-Gruppe des Tors, und das ist gemessen", () => {
    // Auftrag § 8, Prüfpunkt 6: ein reiner Testauftrag kann nichts am Produkt kaputt machen, wohl
    // aber das Tor belasten. Der Nachweis steht deshalb im Lauf und nicht in der Rückgabe.
    const befund = ermittleBrowserbefund();
    expect(befund.browserTests, "dieser Lauf rutscht in den parallelen Rest-Aufruf").toContain(
      SELBST,
    );
    // Die Kette zeigt auf die EINE vorhandene Startstelle — dieser Ordner bringt keine neue mit
    // (und lässt damit den Pin `tor-bestand-vollstaendig.test.ts:381` unberührt).
    expect(befund.ketten.get(SELBST) ?? []).toContain("tests/gast-nutzerweg/browserweg.ts");
    for (const eigene of ["tests/fassungsrueckholung-echter-browser/weg.ts", SELBST]) {
      expect(
        befund.startdateien,
        `${eigene} ist eine neue Chromium-Startstelle geworden`,
      ).not.toContain(eigene);
    }
    // Der PostgreSQL-Lauf trägt `.integration.test.ts` und wird vom Sammler ausgenommen
    // (`browser-gruppe.ts:95`) — er läuft nicht im Standardtor mit.
    expect(befund.browserTests).not.toContain(
      "tests/fassungsrueckholung-echter-browser/rueckholung-pg.integration.test.ts",
    );
  }, 120_000);
});
