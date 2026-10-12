// ================================================================================================
// KLARA 03 · NACHARBEIT 5 (Bens Befund K1) — DER GEWÄHLTE SEITENKONTEXT ERREICHT DEN ANTWORTWEG.
// ================================================================================================
//
// Gemessen am ECHTEN Frageweg `POST /api/ask` der echten App (`kette.ts`): Anmeldung, Sichtbarkeit,
// Fragedienst, Reasoner. An der Stelle des Modells antwortet der kontrollierte Adapter der Kette —
// er hält fest, was der Server ihm WIRKLICH vorlegt (Frage im Zusammenhang und Quellenliste). Damit
// ist unterscheidbar, welcher Kontext übertragen UND verwendet wurde. Eine tatsächliche
// Modellantwort ist das nicht.
//
// Dieselbe Frage, zwei Artikel, die sie beide decken:
//   S1  ohne Seitenbezug (frei)            → beide Artikel liegen dem Antwortweg vor
//   S2  „Dieser Artikel“ = B (mit Fassung) → NUR B liegt vor und trägt; Auskunft: Objekt, Fassung
//   S3  „Dieser Artikel“ = A               → NUR A — eine andere Wissensanfrage als S2
//   S4  Erfassung (Entwurfstitel)          → der Titel steht im Zusammenhang der Frage; frei nicht
//   S5  Fragen (aktuelle Frage + Beitrag)  → beides wirkt: nur der Beitrag, die Frage im Zusammenhang
//   S6  Objekt nicht sichtbar / vertraulich → keine Grundlage, kein Modellaufruf, kein Titel im Rumpf
//   S7  abweichende Fassung wird benannt; unbekannte Felder werden abgewiesen
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import {
  type Aufbau,
  type Draht,
  type Eintrag,
  type Konto,
  adapterUmgebungSetzen,
  appAufbauen,
  drahtAufbauen,
  eintragMitOriginal,
  neuesKonto,
} from "../klara-quellen-nutzerweg/kette";

adapterUmgebungSetzen();

const FRAGE = "Wie wird die Zylinderkopfdichtung XQ42 vor dem Wechsel entlastet?";
const B_AUSSAGE = "Vor dem Wechsel wird die Zylinderkopfdichtung XQ42 in Halle Sieben entlastet.";

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
  draht.lage.generierungen = 0;
  draht.lage.vorlagen.length = 0;
});

interface Antwort {
  status: number;
  roh: string;
  answered: boolean;
  sources: string[];
  seitenbezug?: Record<string, unknown>;
}

async function vorrichtung(): Promise<{ a: Aufbau; leser: Konto; artA: Eintrag; artB: Eintrag }> {
  const a = await appAufbauen(false);
  aufbau = a;
  const artA = await eintragMitOriginal(a.app, a.admin);
  const artB = await eintragMitOriginal(a.app, a.admin, {
    titel: "Dichtungstausch Halle Sieben",
    kernaussage: B_AUSSAGE,
    originaltext: `Anweisung Halle Sieben: ${B_AUSSAGE}`,
    quelle: { label: "Anweisung Halle Sieben", excerpt: B_AUSSAGE },
  });
  const leser = await neuesKonto(a.app, "seitenbezug", a.admin);
  return { a, leser, artA, artB };
}

async function fragen(
  a: Aufbau,
  konto: Konto,
  seitenbezug?: Record<string, unknown>,
): Promise<Antwort> {
  const vorher = draht.lage.vorlagen.length;
  const r = await a.app.inject({
    method: "POST",
    url: "/api/ask",
    headers: konto.kopf,
    payload: { question: FRAGE, locale: "de", ...(seitenbezug ? { seitenbezug } : {}) },
  });
  const koerper =
    r.statusCode === 200
      ? (r.json() as {
          result: { answered: boolean; sources: string[] };
          seitenbezug?: Record<string, unknown>;
        })
      : null;
  return {
    status: r.statusCode,
    roh: `${r.body.slice(0, 400)} · Vorlagen: ${draht.lage.vorlagen.slice(vorher).join(" ¦ ").slice(0, 600)}`,
    answered: koerper?.result.answered ?? false,
    sources: koerper?.result.sources ?? [],
    ...(koerper?.seitenbezug ? { seitenbezug: koerper.seitenbezug } : {}),
  };
}

/** Was der Server dem Modelladapter bei der LETZTEN Generierung vorgelegt hat. */
function letzteVorlage(): string {
  return draht.lage.vorlagen[draht.lage.vorlagen.length - 1] ?? "";
}

async function fassungVon(a: Aufbau, konto: Konto, koId: string): Promise<number> {
  const r = await a.app.inject({ method: "GET", url: `/api/kos/${koId}`, headers: konto.kopf });
  expect(r.statusCode, r.body).toBe(200);
  return (r.json() as { version: number }).version;
}

describe("S1–S3 · „Dieser Artikel“ bestimmt die Grundlage — dieselbe Frage, verschiedene Anfragen", () => {
  it("frei: beide Artikel; Artikel B: nur B; Artikel A: nur A", async () => {
    const { a, leser, artA, artB } = await vorrichtung();

    const frei = await fragen(a, leser);
    expect(frei.status, frei.roh).toBe(200);
    expect(frei.answered, `Kalibrierung: ohne Seitenbezug beantwortet — ${frei.roh}`).toBe(true);
    expect(frei.sources, frei.roh).toEqual(expect.arrayContaining([artA.koId, artB.koId]));
    expect(frei.seitenbezug).toBeUndefined();
    const freiVorlage = letzteVorlage();
    expect(freiVorlage).toContain(artA.titel);
    expect(freiVorlage).toContain(artB.titel);

    const fassungB = await fassungVon(a, leser, artB.koId);
    const nurB = await fragen(a, leser, { art: "artikel", koId: artB.koId, fassung: fassungB });
    expect(nurB.status, nurB.roh).toBe(200);
    expect(nurB.answered, nurB.roh).toBe(true);
    expect(nurB.sources).toEqual([artB.koId]);
    const vorlageB = letzteVorlage();
    expect(vorlageB).toContain(artB.titel);
    expect(vorlageB).not.toContain(artA.titel);
    expect(nurB.seitenbezug).toMatchObject({
      art: "artikel",
      status: "objekt",
      koId: artB.koId,
      fassung: fassungB,
      angefragteFassung: fassungB,
      fassungAbweichend: false,
      verwendet: true,
    });

    const nurA = await fragen(a, leser, { art: "artikel", koId: artA.koId });
    expect(nurA.sources, nurA.roh).toEqual([artA.koId]);
    expect(letzteVorlage()).not.toContain(artB.titel);
    // Verschiedene Seitenkontexte → verschiedene Wissensanfragen.
    expect(nurA.sources).not.toEqual(nurB.sources);
  });
});

describe("S4/S5 · Erfassung und Fragen tragen ihren Kontext in den Antwortweg", () => {
  it("Entwurfstitel und aktuelle Frage stehen im Zusammenhang der vorgelegten Frage; frei nicht", async () => {
    const { a, leser, artA } = await vorrichtung();
    const ENTWURF = "Ölwechsel Presse Vier";
    const AKTUELL = "Wann ist die Wartung fällig?";

    const frei = await fragen(a, leser);
    expect(frei.answered, frei.roh).toBe(true);
    expect(letzteVorlage()).not.toContain(ENTWURF);
    expect(letzteVorlage()).not.toContain(AKTUELL);

    const entwurf = await fragen(a, leser, { art: "entwurf", kontext: ENTWURF });
    expect(entwurf.status, entwurf.roh).toBe(200);
    expect(entwurf.answered, entwurf.roh).toBe(true);
    expect(letzteVorlage()).toContain(ENTWURF);
    expect(letzteVorlage()).toContain(FRAGE);
    expect(entwurf.seitenbezug).toMatchObject({ art: "entwurf", status: "kontext" });

    // Fragen mit Beitrag aus `?ko=`: der Beitrag begrenzt, die aktuelle Frage steht im Zusammenhang.
    const frage = await fragen(a, leser, { art: "frage", kontext: AKTUELL, koId: artA.koId });
    expect(frage.answered, frage.roh).toBe(true);
    expect(frage.sources).toEqual([artA.koId]);
    expect(letzteVorlage()).toContain(AKTUELL);
    expect(frage.seitenbezug).toMatchObject({ art: "frage", status: "objekt", koId: artA.koId });
  });
});

describe("S6 · Rechte gelten für den Seitenkontext", () => {
  it("unsichtbares und vertrauliches Objekt: keine Grundlage, kein Modellaufruf, kein Titel", async () => {
    const { a, leser } = await vorrichtung();
    const GEHEIM_TITEL = "Zylinderkopfdichtung XQ42 Sonderfreigabe Geheim";
    const angelegt = await a.app.inject({
      method: "POST",
      url: "/api/kos",
      headers: a.admin.kopf,
      payload: {
        title: GEHEIM_TITEL,
        statement: "Die Zylinderkopfdichtung XQ42 wird vor dem Wechsel geheim entlastet.",
        type: "best_practice",
        category: "Betrieb",
        confidentiality: "vertraulich",
        neededValidations: 1,
      },
    });
    expect(angelegt.statusCode, angelegt.body).toBe(201);
    const geheimId = (angelegt.json() as { id: string }).id;
    const frei = await a.app.inject({
      method: "PUT",
      url: `/api/kos/${geheimId}`,
      headers: a.admin.kopf,
      payload: { action: "admin-validate" },
    });
    expect(frei.statusCode, frei.body).toBe(200);

    const generierungenVorher = draht.lage.generierungen;
    const fremd = await fragen(a, leser, { art: "artikel", koId: geheimId });
    expect(fremd.status, fremd.roh).toBe(200);
    expect(fremd.answered).toBe(false);
    expect(fremd.sources).toEqual([]);
    expect(fremd.seitenbezug).toEqual({ art: "artikel", status: "nicht_zugaenglich" });
    expect(fremd.roh).not.toContain(GEHEIM_TITEL);
    expect(draht.lage.generierungen).toBe(generierungenVorher);

    // Unbekannte Kennung: dieselbe Auskunft wie fremd — keine Existenzauskunft.
    const unbekannt = await fragen(a, leser, { art: "artikel", koId: "gibt-es-nicht" });
    expect(unbekannt.seitenbezug).toEqual(fremd.seitenbezug);
    expect(unbekannt.answered).toBe(false);

    // Selbst wer es sehen darf (Admin), bekommt aus Vertraulichem keinen Seitenkontext.
    const admin = await fragen(a, a.admin, { art: "artikel", koId: geheimId });
    expect(admin.answered).toBe(false);
    expect(admin.seitenbezug).toMatchObject({ status: "vertraulich", koId: geheimId });
    expect(draht.lage.generierungen).toBe(generierungenVorher);
  });
});

describe("S7 · Fassung und Form", () => {
  it("eine abweichende Fassung wird benannt; ungültige Angaben sind 400", async () => {
    const { a, leser, artA } = await vorrichtung();
    const aktuell = await fassungVon(a, leser, artA.koId);
    const alt = await fragen(a, leser, { art: "artikel", koId: artA.koId, fassung: aktuell + 5 });
    expect(alt.seitenbezug).toMatchObject({
      status: "objekt",
      fassung: aktuell,
      angefragteFassung: aktuell + 5,
      fassungAbweichend: true,
    });
    const falscheArt = await fragen(a, leser, { art: "alles" });
    expect(falscheArt.status).toBe(400);
    const nullFassung = await fragen(a, leser, { art: "artikel", koId: artA.koId, fassung: 0 });
    expect(nullFassung.status).toBe(400);
    const ohneArt = await fragen(a, leser, { koId: artA.koId });
    expect(ohneArt.status).toBe(400);
  });
});
