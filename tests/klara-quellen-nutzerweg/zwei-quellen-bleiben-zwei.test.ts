// ================================================================================================
// JOB 4224 · D5 · LIEFERUNG 3 — ZWEI ABWEICHENDE QUELLEN BLEIBEN ZWEI
// ================================================================================================
//
// DER VORHANDENE WEG WIRD BENUTZT, NICHT ERSETZT. Das Produkt hat den Widerspruchsweg seit
// JOB 3365: hält die Zitatdeckung eines Modelltextes nicht (`pruefeDeckung`, „EINE MARKE IST KEIN
// BELEG"), entscheidet `rueckfallStand`, WAS ausgegeben wird — und trägt eine zweite, abweichende
// Auskunft mit ihrer Quelle daneben, statt still eine zu wählen. Gemessen wird das an der Fläche
// bereits in `tests/ask-c02/konflikt-flaeche-mounted.test.tsx`.
//
// WAS DIESE DATEI DAZU BEITRÄGT: dieselbe Zusage IN DER KETTE DIESES AUFTRAGS — also mit dem
// kontrollierten Modelladapter, über `POST /api/ask`, mit Quellen, die ein hinterlegtes Original
// tragen. Ohne diesen Fall könnte der Belegweg aus Lieferung 2 eine widersprüchliche Lage zu einer
// scheinbar eindeutigen Aussage verschmelzen, und niemand hätte es gemerkt.
//
// DER ADAPTER IST ALS ADAPTER BENANNT (`kette.ts`). Damit darf weder eine reale semantische
// Antwortqualität noch eine Microsoft-365-Host-Abnahme behauptet werden.
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import {
  type App,
  type Aufbau,
  type Draht,
  type Konto,
  adapterUmgebungSetzen,
  appAufbauen,
  drahtAufbauen,
  fragen,
  neuesKonto,
} from "./kette";

adapterUmgebungSetzen();

const FRAGE_FRIST = "Welche Zahlungsfrist gilt für eine Standardrechnung?";
const SATZ_30 = "Standardrechnungen sind 30 Kalendertage nach dem Rechnungsdatum fällig.";
const SATZ_45 = "Standardrechnungen sind 45 Kalendertage nach dem Rechnungsdatum fällig.";
const TITEL_A = "Zahlungsfrist Standardrechnung (freigegebener Stand)";
const TITEL_B = "Zahlungsfrist Standardrechnung (Kopie aus dem Altbestand)";
/** Der FREIE Satz des Adapters — keine Quelle deckt ihn; das Produkt muss ihn verwerfen. */
const FREIER_SATZ = "Die Quellen widersprechen sich bei der Zahlungsfrist.";

let draht: Draht;
let aufbau: Aufbau | null = null;

beforeAll(() => {
  draht = drahtAufbauen();
});

afterAll(() => {
  draht.abbauen();
});

afterEach(async () => {
  if (aufbau) {
    await aufbau.app.close();
    aufbau = null;
  }
  draht.setzeApp(null);
  draht.lage.generierungen = 0;
  draht.lage.vorlagen.length = 0;
  draht.lage.zusatz = null;
});

async function eintrag(app: App, konto: Konto, titel: string, satz: string): Promise<string> {
  const res = await app.inject({
    method: "POST",
    url: "/api/kos",
    headers: konto.kopf,
    payload: {
      title: titel,
      statement: satz,
      // Der zweite Stimme-Weg liest den DOKUMENTauszug (`dokumentAuszug`), nicht die Kernaussage —
      // deshalb trägt jeder Eintrag seinen Satz auch im Fließtext.
      bodyHtml: `<p>${satz}</p><p>Die Frist beginnt mit dem Rechnungsdatum.</p>`,
      type: "best_practice",
      category: "Kaufmännisch",
      confidentiality: "intern",
      neededValidations: 1,
    },
  });
  expect(res.statusCode, res.body).toBe(201);
  const id = (res.json() as { id: string }).id;
  expect(
    (
      await app.inject({
        method: "PUT",
        url: `/api/kos/${id}`,
        headers: konto.kopf,
        payload: { action: "admin-validate" },
      })
    ).statusCode,
  ).toBe(200);
  return id;
}

async function vorrichtung(zweiterSatz: string): Promise<{ a: Aufbau; leser: Konto }> {
  const a = await appAufbauen();
  aufbau = a;
  draht.setzeApp(a.app);
  await eintrag(a.app, a.admin, TITEL_A, SATZ_30);
  await eintrag(a.app, a.admin, TITEL_B, zweiterSatz);
  const leser = await neuesKonto(a.app, "leser", a.admin);
  return { a, leser };
}

describe("JOB 4224 · D5 · W — zwei abweichende Quellen bleiben zwei", () => {
  it("W1 · widersprechende Fristen: die Antwort trägt BEIDE, jede mit ihrer Quelle", async () => {
    draht.lage.zusatz = FREIER_SATZ;
    const { a, leser } = await vorrichtung(SATZ_45);
    const antwort = await fragen(a.app, leser, FRAGE_FRIST);

    expect(draht.lage.generierungen, "der Adapter wurde nicht befragt").toBeGreaterThan(0);
    expect(antwort.answered, antwort.roh).toBe(true);
    const text = antwort.answer ?? "";
    // 1. DER KERN: nicht die scheinbar eindeutige Frist aus EINER Quelle.
    expect(text.trim(), "die Antwort ist der stille 30-Tage-Rückfall").not.toBe(SATZ_30);
    expect(text, "die erste Frist fehlt").toContain("30 Kalendertage");
    expect(text, "die zweite Frist fehlt — der Widerspruch wurde verschmolzen").toContain(
      "45 Kalendertage",
    );
    // 2. Jede Auskunft trägt ihre Quelle IM Antworttext, nicht nur als Chip daneben.
    expect(text).toContain(TITEL_A);
    expect(text).toContain(TITEL_B);
    // 3. Der freie Modellsatz geht weiterhin NICHT hinaus.
    expect(text, "ein ungedeckter Modellsatz wurde ausgeliefert").not.toContain(FREIER_SATZ);
  });

  it("W2 · GEGENFALL: derselbe Satz in beiden Quellen — genau eine Auskunft, keine erfundene Uneinigkeit", async () => {
    draht.lage.zusatz = FREIER_SATZ;
    const { a, leser } = await vorrichtung(SATZ_30);
    const antwort = await fragen(a.app, leser, FRAGE_FRIST);

    expect(antwort.answered, antwort.roh).toBe(true);
    const text = antwort.answer ?? "";
    expect(text).toContain("30 Kalendertage");
    expect(text, "eine Frist, die in keiner Quelle steht").not.toContain("45 Kalendertage");
    expect(text).not.toContain(FREIER_SATZ);
  });
});
