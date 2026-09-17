// ================================================================================================
// JOB 4293 · K — DIE KALIBRIERUNG: WÜRDE DIESER NACHWEIS ES ÜBERHAUPT MERKEN?
// ================================================================================================
//
// WARUM ES DIESE DATEI GEBEN MUSS. `rundlauf-am-echten-socket.test.ts` ist grün — aber grün heisst
// zunächst nur, dass nichts geworfen hat. Die Frage, die ein Abnahmeweg über sich selbst nicht
// beantworten kann, ist: sieht er eine zerstörte Zusage? Der Auftrag verlangt sie einzeln je Zusage
// (§ 7), und die Lehren sagen, warum: JOB 4263 R1 blieb grün, obwohl der Bericht verloren ging;
// JOB 4281 R1 blieb grün, obwohl jeder Klick wirkungslos war.
//
// DIE MUTATION LIEGT AUSSCHLIESSLICH IM PRÜFSTAND (`weg.ts`, Abschnitt „DIE MUTATION"): ein Haken
// vor bzw. hinter der echten Route, ausserhalb des jeweiligen Falls ausgeschaltet. Kein Zeichen
// Produktionscode wird angefasst. Der Weg selbst ist Zeile für Zeile derselbe wie in der Abnahme —
// was sich ändert, ist allein, was der Server tut.
//
// VIER KRANKHEITEN, VIER FÄLLE, jede mit Baseline → Mutation → ausgelöster Assertion → Rücknahme:
//
//   K1 · NUR DER VOLLTEXT FEHLT. Titel, Kernaussage und Schlagworte kommen RICHTIG an. Ein Nachweis,
//        der nur „es ist etwas angekommen" prüft, bliebe hier grün. Genau diese Verstellung hat
//        JOB 4263 in Runde 1 als Scheingrün entlarvt.
//   K2 · DER VOLLTEXT IST ERFUNDEN — aus `statement` gebaut. Ein Nachweis, der nur „bodyHtml ist
//        nicht leer" prüft, bliebe hier grün. § 5.3 verbietet genau das.
//   K3 · DER MESSWEG IST BLOCKIERT. Die Warteschlange antwortet 503. Ein Nachweis, der seine
//        Fehlschläge schluckt, bliebe hier grün (Lehre JOB 4281).
//   K4 · DIE BEREINIGUNG IST AUS. Der rohe, ausführbare Volltext kommt beim Leser an. Ein
//        Sicherheitsfall, der nur den harmlosen Teil sucht, bliebe hier grün.
//
// K0 ist die Kalibrierung der Kalibrierung: DERSELBE Weg auf DEMSELBEN Prüfstand, OHNE Mutation,
// muss grün sein. Ohne ihn bewiesen K1–K4 nur, dass irgendetwas rot wird.
import { afterEach, describe, expect, it } from "vitest";
import {
  type Sitzung,
  type Strecke,
  ersteinrichtung,
  starteStrecke,
} from "../gast-nutzerweg/strecke";
import {
  BOESE_SPUREN,
  JOB,
  KERNAUSSAGE,
  type Mutation,
  type Rundlaufinstanzen,
  type Rundlaufplan,
  VOLLTEXT_MARKE,
  auswahlLesen,
  boeserVolltext,
  einreihen,
  entscheiden,
  fahreDenRundlauf,
  kandidatMitTitel,
  koLesen,
  mitMutation,
  neueMutation,
  pruefeVolltextZusage,
  volltextHtml,
} from "./weg";

const ADMIN = "kalibrierer@volltext-4293.test";
const TAGS = ["dichtung", "presse-7"];

const laufende: Strecke[] = [];
const mutation: Mutation = neueMutation();

/**
 * Zwei frische Instanzen je Fall — die ZIELinstanz trägt den Haken.
 *
 * Er sitzt dort, weil dort die Wege liegen, die gestört werden sollen: das Einreihen
 * (`POST .../candidates`), das Lesen der Warteschlange und der Abruf des Zielobjekts. Die
 * Quellinstanz bleibt unangetastet — sonst wäre schon die Ausgangsdatei verfälscht und das Rot
 * bewiese nichts über den Weg.
 */
async function neuesPaar(): Promise<Rundlaufinstanzen> {
  const quellStrecke = await starteStrecke();
  const zielStrecke = await starteStrecke(mitMutation(mutation));
  laufende.push(quellStrecke, zielStrecke);
  return {
    quelle: (await ersteinrichtung(quellStrecke, ADMIN)).sitzung,
    ziel: (await ersteinrichtung(zielStrecke, ADMIN)).sitzung,
  };
}

afterEach(async () => {
  // Rücknahme, auch wenn ein Fall unterwegs geworfen hat: ein stehen gebliebener Haken wäre eine
  // stille Verfälschung jedes folgenden Falls.
  mutation.art = "keine";
  mutation.rohtext = "";
  for (const strecke of laufende.splice(0)) {
    await strecke.schliessen();
  }
}, 60_000);

function plan(marke: string): Rundlaufplan {
  return {
    titel: `Kalibrierung ${marke} (${JOB})`,
    kern: KERNAUSSAGE,
    volltext: volltextHtml(),
    tags: TAGS,
  };
}

/** Der reduzierte Weg: fahren und die Zusage prüfen — genau das, was die Abnahme tut. */
async function fahreUndPruefe(p: Rundlaufplan): Promise<void> {
  pruefeVolltextZusage(await fahreDenRundlauf(await neuesPaar(), p), p);
}

/** Der Sicherheitsfall, genau einmal beschrieben — Abnahme und K4 fahren denselben. */
async function fahreSicherheitsfall(ziel: Sitzung, titel: string): Promise<string> {
  const items = auswahlLesen(
    JSON.stringify([
      {
        title: titel,
        statement: KERNAUSSAGE,
        type: "best_practice",
        category: "Wartung",
        bodyHtml: boeserVolltext(),
      },
    ]),
  );
  const kandidat = kandidatMitTitel(await einreihen(ziel, items), titel);
  const angenommen = await entscheiden(ziel, kandidat.id, "accept");
  expect(angenommen.koId, `${JOB}: der Sicherheitsfall hat kein Zielobjekt.`).not.toBeNull();
  const zielObjekt = await koLesen(ziel, angenommen.koId as string);
  const gespeichert = String(zielObjekt.bodyHtml ?? "");
  expect(gespeichert, `${JOB}: auch der harmlose Teil ist weg.`).toContain(VOLLTEXT_MARKE);
  for (const spur of BOESE_SPUREN) {
    expect(
      gespeichert.toLowerCase(),
      `${JOB}: „${spur}" steht im ausgelieferten Volltext — die Bereinigung greift nicht.`,
    ).not.toContain(spur);
  }
  return gespeichert;
}

describe(`${JOB} · K · die Kalibrierung des Rundlaufs`, () => {
  it("K0 · Baseline: derselbe Weg, ohne Mutation, ist grün", async () => {
    mutation.art = "keine";
    await fahreUndPruefe(plan("K0"));
  });

  it("K1 · nur der Volltext fällt aus — und der Nachweis scheitert AM VOLLTEXT", async () => {
    mutation.art = "volltext-weg";
    const p = plan("K1");
    let gefangen: unknown;
    const befund = await fahreDenRundlauf(await neuesPaar(), p);
    try {
      pruefeVolltextZusage(befund, p);
    } catch (fehler) {
      gefangen = fehler;
    }
    mutation.art = "keine";
    expect(
      gefangen,
      `${JOB}: K1 · der Nachweis blieb GRÜN, obwohl der Volltext unterwegs ausgefallen ist.`,
    ).toBeDefined();
    const meldung = gefangen instanceof Error ? gefangen.message : String(gefangen);
    // AM VOLLTEXT, nicht irgendwo: die Meldung muss das Glied und die Volltextmarke nennen.
    expect(meldung, `${JOB}: K1 · das Rot nennt den Volltext nicht: ${meldung}`).toContain(
      VOLLTEXT_MARKE,
    );
    expect(meldung).toContain("Kandidat");
    // UND: alles ausser dem Volltext ist richtig angekommen. Genau darum ist dieses Rot ein Beleg
    // für den Volltext und nicht für „irgendetwas ist kaputt".
    expect(befund.zielKo.title, `${JOB}: K1 · auch der Titel ist verrutscht.`).toBe(p.titel);
    expect(befund.zielKo.statement, `${JOB}: K1 · auch die Kernaussage ist verrutscht.`).toBe(
      p.kern,
    );
    expect(befund.zielKo.version, `${JOB}: K1 · auch die Fassung ist verrutscht.`).toBe(1);
    // Rücknahme belegt: derselbe Weg ist danach wieder grün.
    await fahreUndPruefe(plan("K1-zurueck"));
  });

  it("K2 · der Volltext wird aus der Kernaussage erfunden — das muss rot werden", async () => {
    mutation.art = "volltext-erfunden";
    const p = plan("K2");
    let gefangen: unknown;
    try {
      await fahreUndPruefe(p);
    } catch (fehler) {
      gefangen = fehler;
    }
    mutation.art = "keine";
    expect(
      gefangen,
      `${JOB}: K2 · ein aus statement gebauter Ersatz ging als Volltext durch.`,
    ).toBeDefined();
    const meldung = gefangen instanceof Error ? gefangen.message : String(gefangen);
    // Das Rot benennt die KRANKHEIT, nicht nur ihr Symptom: „ein aus statement gebauter Ersatz".
    expect(meldung, `${JOB}: K2 · das Rot benennt die Erfindung nicht: ${meldung}`).toContain(
      "aus statement gebauter Ersatz",
    );
    await fahreUndPruefe(plan("K2-zurueck"));
  });

  it("K3 · der Messweg ist blockiert — das muss rot werden, nicht still grün bleiben", async () => {
    mutation.art = "messweg-blockiert";
    const p = plan("K3");
    let gefangen: unknown;
    try {
      await fahreUndPruefe(p);
    } catch (fehler) {
      gefangen = fehler;
    }
    mutation.art = "keine";
    expect(
      gefangen,
      `${JOB}: K3 · der Weg blieb grün, obwohl die Warteschlange gar nicht antwortete.`,
    ).toBeDefined();
    const meldung = gefangen instanceof Error ? gefangen.message : String(gefangen);
    expect(
      meldung,
      `${JOB}: K3 · das Rot nennt den ausgefallenen Abruf nicht: ${meldung}`,
    ).toContain("GET /api/library/import/candidates");
    expect(meldung).toContain("503");
    await fahreUndPruefe(plan("K3-zurueck"));
  });

  it("K4 · die Bereinigung ist aus — der Sicherheitsfall muss rot werden", async () => {
    mutation.art = "keine";
    // JE LAUF EINE EIGENE ZIELINSTANZ — gemessen, nicht vorsorglich (Arbeitsprüfung 0ff6fee3…):
    // dreimal derselbe Inhalt in DIESELBE Instanz ist beim zweiten Mal richtigerweise eine Dublette,
    // der Accept legt dann gar kein Objekt an, und der Fall wäre an dieser Stelle gescheitert statt
    // an der Bereinigung.
    // Baseline: derselbe Sicherheitsfall ist grün.
    await fahreSicherheitsfall((await neuesPaar()).ziel, `Kalibrierung K4-Baseline (${JOB})`);
    mutation.art = "ohne-bereinigung";
    mutation.rohtext = boeserVolltext();
    let gefangen: unknown;
    try {
      await fahreSicherheitsfall((await neuesPaar()).ziel, `Kalibrierung K4 (${JOB})`);
    } catch (fehler) {
      gefangen = fehler;
    }
    mutation.art = "keine";
    mutation.rohtext = "";
    expect(
      gefangen,
      `${JOB}: K4 · der Sicherheitsfall blieb grün, obwohl rohes HTML ausgeliefert wurde.`,
    ).toBeDefined();
    const meldung = gefangen instanceof Error ? gefangen.message : String(gefangen);
    expect(meldung, `${JOB}: K4 · das Rot nennt die Bereinigung nicht: ${meldung}`).toContain(
      "Bereinigung",
    );
    await fahreSicherheitsfall((await neuesPaar()).ziel, `Kalibrierung K4-zurueck (${JOB})`);
  });
});
