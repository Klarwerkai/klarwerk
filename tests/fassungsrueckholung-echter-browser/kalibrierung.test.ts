// ================================================================================================
// JOB 4263 · K — DIE GEGENPROBE, DIE DAS GANZE TRÄGT.
// ================================================================================================
//
// WARUM ES DIESE DATEI GEBEN MUSS. `rueckholung-im-echten-browser.test.ts` ist grün — aber ein
// grüner Abnahmeweg auf BESTEHENDER Funktion beweist zunächst nur, dass nichts geworfen hat. Die
// Frage, die er selbst nicht beantworten kann, ist: WÜRDE er es merken? Ein Weg, der eine zerstörte
// Zusage nicht sieht, ist keiner — BEN hat das an JOB 4223 R1 belegt (Tastaturnachweis blieb grün,
// obwohl der Knopf mit `tabIndex={-1}` aus der Tab-Reihenfolge genommen war), und die Lehre aus
// JOB 4227 R1/R3 sagt dasselbe von der anderen Seite: eine ungeprüfte Zusage darf nicht als geprüft
// ausgegeben werden.
//
// DIE MUTATION LIEGT AUSSCHLIESSLICH IM PRÜFSTAND. Kein Produktionscode wird angefasst: der Haken
// sitzt als `preHandler` VOR der echten Route, ist auf GENAU EINEN Eintrag begrenzt und ausserhalb
// des jeweiligen Falls ausgeschaltet (`weg.ts`, Abschnitt „DIE MUTATION"). Der Weg selbst ist Zeile
// für Zeile derselbe wie im Abnahmelauf — was sich ändert, ist allein, was der Server tut.
//
// DREI KRANKHEITEN, DREI FÄLLE — und sie sind ausdrücklich verschieden:
//
//   K2 · ES PASSIERT NICHTS. Der Server meldet 200, ohne etwas zu tun; die Fläche sagt
//        „Übernommen". Ein Nachweis, der nur auf den Erfolgssatz schaut, bliebe hier grün.
//   K3 · ES PASSIERT DAS FALSCHE. Die Fassungsnummer wird unterwegs umgebogen; es entsteht eine
//        neue Fassung, sie trägt nur den Inhalt der falschen. Ein Nachweis, der nur zählt, ob eine
//        Fassung dazukam, bliebe hier grün.
//   K4 · ES PASSIERT NUR ZUR HÄLFTE. Kernaussage und Fassungsnummer stimmen, der BERICHT geht
//        verloren. Genau dieser Fall blieb in Runde 1 grün — BENs Befund, und der Grund für die
//        getrennten Marken pro Inhaltsfeld (`weg.ts`, Abschnitt „Die Marken").
//
// K1 ist die Kalibrierung der Kalibrierung: DERSELBE reduzierte Weg, OHNE Mutation, muss grün sein.
// Ohne ihn bewiesen K2, K3 und K4 nur, dass irgendetwas rot wird.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type Browser, starteChromium } from "../gast-nutzerweg/browserweg";
import {
  type Sitzung,
  type Strecke,
  ersteinrichtung,
  starteStrecke,
} from "../gast-nutzerweg/strecke";
import {
  BERICHT_ALT,
  type Bremse,
  FASSUNG_ALT,
  FASSUNG_MITTE,
  FASSUNG_NEU,
  type Fassungstext,
  MARKE_ALT,
  MARKE_MITTE,
  type Mutation,
  fahreDieRueckholung,
  holeStand,
  legeFassungenAn,
  liesImFrischenProfil,
  mitFlaecheBremseMutation,
  neueBremse,
  neueMutation,
  stelleFlaecheBereit,
} from "./weg";

const ADMIN = "kalibrierer@fassung-4263.test";
const TITEL_BERICHT = "Kalibrierung verlorener Bericht (JOB 4263)";

let strecke: Strecke | undefined;
let browser: Browser | undefined;
let adminApi: Sitzung;
const bremse: Bremse = neueBremse();
const mutation: Mutation = neueMutation();

beforeAll(async () => {
  stelleFlaecheBereit();
  browser = await starteChromium();
  strecke = await starteStrecke(mitFlaecheBremseMutation(bremse, mutation));
  adminApi = (await ersteinrichtung(strecke, ADMIN)).sitzung;
}, 900_000);

afterAll(async () => {
  mutation.art = "keine";
  await browser?.close();
  await strecke?.schliessen();
}, 120_000);

function zeug(): { browser: Browser; strecke: Strecke } {
  if (!browser || !strecke) {
    throw new Error("JOB 4263: Browser oder Strecke fehlen — der Aufbau ist nicht durchgelaufen.");
  }
  return { browser, strecke };
}

/**
 * Der reduzierte Weg: derselbe Ablauf wie in der Abnahme, nur ohne den fremden Schreibvorgang.
 * Der Konflikt ist hier nicht der Gegenstand — gefragt ist, ob die RÜCKHOLUNG selbst gemerkt wird.
 */
async function fahre(titel: string, fassungen: readonly Fassungstext[]): Promise<string> {
  const { browser: b, strecke: s } = zeug();
  const koId = await legeFassungenAn(adminApi, titel, fassungen);
  const vorher = await holeStand(adminApi, koId);
  expect(vorher.version, "der Ausgangsstand stimmt nicht").toBe(fassungen.length);
  expect(vorher.bodyHtml, "der Ausgangsstand trägt gar keinen Bericht").toContain(
    fassungen[fassungen.length - 1]?.bericht,
  );
  mutation.koId = koId;
  await fahreDieRueckholung({
    browser: b,
    strecke: s,
    bremse,
    eigeneApi: adminApi,
    eigeneEmail: ADMIN,
    koId,
    titel,
    zielFassung: 1,
    markeZiel: MARKE_ALT,
    berichtZiel: BERICHT_ALT,
    standVorher: fassungen.length,
  });
  return koId;
}

describe("JOB 4263 K · die Kalibrierung des Abnahmeweges", () => {
  it("K1 — OHNE Mutation läuft derselbe Weg durch: die Rückholung findet statt und trägt den richtigen Inhalt", async () => {
    mutation.art = "keine";
    const koId = await fahre("Kalibrierung ungestört (JOB 4263)", [FASSUNG_ALT, FASSUNG_NEU]);
    const danach = await holeStand(adminApi, koId);
    expect(danach.version, "ohne Mutation entsteht keine neue Fassung").toBe(3);
    expect(danach.statement, "ohne Mutation kommt der falsche Inhalt an").toBe(MARKE_ALT);
    expect(danach.bodyHtml, "ohne Mutation fehlt der Bericht der Zielfassung").toContain(
      BERICHT_ALT,
    );
  }, 900_000);

  it("K2 — eine Übernahme, die GAR NICHT stattfindet, wird rot erkannt (Server meldet 200 und tut nichts)", async () => {
    mutation.art = "ohne-wirkung";
    mutation.stattdessen = 0;
    try {
      await expect(
        fahre("Kalibrierung ohne Wirkung (JOB 4263)", [FASSUNG_ALT, FASSUNG_NEU]),
      ).rejects.toThrow("sie hat NICHT stattgefunden");
    } finally {
      mutation.art = "keine";
    }
    // Und die Mutation hat wirklich verhindert, was sie verhindern sollte — sonst wäre oben etwas
    // ANDERES rot geworden und dieser Fall bewiese nichts über die Rückholung.
    const danach = await holeStand(adminApi, mutation.koId);
    expect(danach.version, "trotz `ohne-wirkung` ist eine Fassung entstanden").toBe(2);
    expect(danach.statement, "trotz `ohne-wirkung` hat sich der Inhalt geändert").toBe(
      FASSUNG_NEU.kern,
    );
  }, 900_000);

  it("K3 — ein FALSCHER Zielinhalt wird rot erkannt (die Fassungsnummer wird unterwegs umgebogen)", async () => {
    mutation.art = "falsche-fassung";
    // v1 = ALT (das Ziel), v2 = MITTE (das Falsche), v3 = NEU (der aktuelle Stand).
    mutation.stattdessen = 2;
    try {
      await expect(
        fahre("Kalibrierung falsche Fassung (JOB 4263)", [FASSUNG_ALT, FASSUNG_MITTE, FASSUNG_NEU]),
      ).rejects.toThrow("gespeichert ist der Inhalt einer ANDEREN Fassung");
    } finally {
      mutation.art = "keine";
    }
    // Hier IST etwas passiert — nur das Falsche. Genau dieser Unterschied zu K2 ist der Punkt:
    // ein Nachweis, der bloss zählt, ob eine Fassung dazukam, bliebe hier grün.
    const danach = await holeStand(adminApi, mutation.koId);
    expect(danach.version, "`falsche-fassung` hat gar keine Fassung erzeugt").toBe(4);
    expect(danach.statement, "`falsche-fassung` hat doch den richtigen Inhalt geschrieben").toBe(
      MARKE_MITTE,
    );
  }, 900_000);

  // ══════════════════════════════════════════════════════════════════════════════════════════════
  // K4 · DIE KRANKHEIT, DIE RUNDE 1 NICHT SAH — und sie ist die heimtückischste der drei.
  // ══════════════════════════════════════════════════════════════════════════════════════════════
  //
  // BEN hat sie an Runde 1 gemessen: Kernaussage richtig, Fassungsnummer richtig, Bericht weg — und
  // dieser Weg blieb GRÜN (`"version":4,"vorher":"<p>ᚠᚨᛊᛊᚢᚾᚷᚨᛚᛏ4263</p>","nachher":null`). Weder an
  // der Fläche noch am Datensatz fiel es auf: die Leseansicht zeichnet bei fehlendem Bericht die
  // Kernaussage an genau derselben Stelle (`BibliothekLesen.tsx:2976-3004`), und mit EINER Marke für
  // beide Felder füllte der Ersatztext den Nachweis des Ersetzten aus.
  //
  // DIESER FALL BEWEIST BEIDES: dass der Weg den Verlust jetzt rot sieht — UND dass die Fläche ihn
  // weiterhin verdeckt. Das Zweite ist kein Beiwerk: es ist der Grund, warum die getrennte Marke
  // nötig war, und es wird hier gemessen statt behauptet.
  it("K4 — eine Rückholung mit RICHTIGER Kernaussage und RICHTIGER Fassungsnummer, aber verlorenem Bericht, wird rot erkannt", async () => {
    const { browser: b, strecke: s } = zeug();
    mutation.art = "verlorener-bericht";
    mutation.kernZiel = MARKE_ALT;
    try {
      await expect(fahre(TITEL_BERICHT, [FASSUNG_ALT, FASSUNG_NEU])).rejects.toThrow(
        "der Berichtstext der Fassung v1 fehlt im gespeicherten Stand",
      );
    } finally {
      mutation.art = "keine";
    }

    // ── DIE MUTATION HAT GENAU EINES ZERSTÖRT, und das ist der Punkt dieses Falles. ─────────────
    const danach = await holeStand(adminApi, mutation.koId);
    expect(danach.version, "`verlorener-bericht` hat gar keine Fassung erzeugt").toBe(3);
    expect(danach.statement, "`verlorener-bericht` hat auch die Kernaussage verstellt").toBe(
      MARKE_ALT,
    );
    expect(danach.bodyHtml, "`verlorener-bericht` hat den Bericht gar nicht entfernt").toBe("");

    // ── UND SO SIEHT DER VERLUST AUF DER FLÄCHE AUS: die Kernaussage steht an seiner Stelle. ────
    // Wer nur nach ihr sucht, liest hier ein Ergebnis, das es nicht gibt. Genau deshalb prüft der
    // Weg den Berichtstext mit einer EIGENEN Marke — an der Seite wie am Datensatz.
    const seitentext = await liesImFrischenProfil(b, s.basis, ADMIN, mutation.koId, TITEL_BERICHT);
    expect(
      seitentext,
      "die Leseansicht zeigt nach dem Verlust nicht einmal mehr die Kernaussage",
    ).toContain(MARKE_ALT);
    expect(
      seitentext,
      "der Bericht ist laut Datensatz weg, steht auf der Seite aber noch — dann misst dieser Fall etwas anderes als gedacht",
    ).not.toContain(BERICHT_ALT);
  }, 900_000);
});
