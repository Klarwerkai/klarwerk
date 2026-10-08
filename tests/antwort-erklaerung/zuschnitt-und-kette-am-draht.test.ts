// ================================================================================================
// AUFNAHME 20260922 · BEN NACHARBEIT-9 — ZUSCHNITT UND BELEGTE KETTE AN DER ECHTEN ROUTE.
// ================================================================================================
//
// Gemessen an `POST /api/ask` über `app.inject()` (buildApp, InMemory-Bestand). Die Synthese ist
// eine feste Kunst-Antwort auf der geteilten Reasoner-Instanz (dieselbe Bauart wie
// `tests/app/mega79-klara-antwort-ohne-modell.test.ts`) — kein Modell, kein Egress.
//
//   Befund 2 (R-0346)  Rolle und Anlass verändern die ANTWORT selbst: Fachrolle → wörtliche
//                      Voraussetzungen/Maßnahmen der tragenden Quelle; Lesende → Begriffe aus dem
//                      Firmenwörterbuch. Der wörtliche Weg (`retrieval-only`) bleibt unverändert,
//                      die Quellenbindung (`citedSources`) ebenso.
//   Befund 1 (R-1627)  Eine Beziehung steht nur aus einer aktiven kuratierten Kante; ohne sie
//                      stehen die Aussagen ausdrücklich unabhängig. Der Schluss trägt die Antwort.
import { describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";

type Services = ReturnType<typeof buildServices>;
type App = ReturnType<typeof buildApp>;
type Kopf = { authorization: string };
type ReasonerAnswer = Services["reasoner"]["answer"];

const SELTENES_WORT = "Querstromventilhaube";
const SYNTHESE = `Die ${SELTENES_WORT} vor der Wartung entlasten.`;
const JETZT = "2026-10-08T08:00:00.000Z";

interface Stufe {
  art: string;
  koId?: string;
  beziehung?: string;
  vonKoId?: string;
  zuKoId?: string;
  gesetztVon?: string | null;
  aussage?: string | null;
  gestuetztAuf?: string[];
  unabhaengig?: boolean;
}

interface Antwort {
  result: {
    answered: boolean;
    answer: string | null;
    citedSources: string[];
    belastbarkeit: {
      argumentation: Stufe[];
      quellenAnzahl: { herangezogen: number; tragend: number };
      quellen: { koId: string }[];
      vertrauenswert: { wert: number | null; schwaechsteQuelle: string | null };
      woerterbuch?: {
        benennung: string;
        herkunft: Record<string, unknown>;
        vertrauenswert: null;
        belastbarkeit: string;
      }[];
    };
  };
  antwortZuschnitt?: {
    tiefe: string;
    fachsprache: string;
    reihenfolge: string[];
    ergaenzungen: { art: string; quelleId: string | null; eintraege: string[] }[];
  };
}

async function anmelden(app: App, mail: string): Promise<{ kopf: Kopf; id: string }> {
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: mail, password: "geheim12345" },
  });
  expect(login.statusCode, login.body).toBe(200);
  return {
    kopf: { authorization: `Bearer ${login.json().token}` },
    id: login.json().user.id as string,
  };
}

async function start(
  mail: string,
): Promise<{ app: App; services: Services; admin: Kopf; adminId: string }> {
  const services = buildServices();
  // Getragen wird nur, was die Testobjekte sind — ein zufälliger Treffer im Bestand trägt nichts.
  const synthese: ReasonerAnswer = async (_frage, kontext) => {
    const eigene = kontext.filter((k) => k.statement.includes(SELTENES_WORT)).map((k) => k.id);
    return {
      answered: true,
      answer: SYNTHESE,
      knowledgeClass: "gesichert",
      trust: 50,
      sources: eigene,
      citedSources: eigene,
      steps: [],
      demo: false,
    };
  };
  Object.assign(services.reasoner, { answer: synthese });
  const app = buildApp(services);
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Admin", email: mail, password: "geheim12345" },
  });
  const { kopf, id } = await anmelden(app, mail);
  return { app, services, admin: kopf, adminId: id };
}

async function anlegen(
  app: App,
  kopf: Kopf,
  titel: string,
  felder: { statement?: string; conditions?: string[]; measures?: string[] } = {},
): Promise<string> {
  const res = await app.inject({
    method: "POST",
    url: "/api/kos",
    headers: kopf,
    payload: {
      confidentiality: "intern",
      title: titel,
      statement: `Die ${SELTENES_WORT} wird vor jeder Wartung entlastet.`,
      type: "best_practice",
      category: "Anlage 1",
      ...felder,
    },
  });
  expect(res.statusCode, res.body).toBe(201);
  const id = res.json().id as string;
  const val = await app.inject({
    method: "PUT",
    url: `/api/kos/${id}`,
    headers: kopf,
    payload: { action: "admin-validate" },
  });
  expect(val.statusCode, val.body).toBe(200);
  return id;
}

async function fragen(app: App, kopf: Kopf, mode?: string): Promise<Antwort> {
  const frage = `${SELTENES_WORT} Wartung entlasten`;
  const res = await app.inject({
    method: "POST",
    url: "/api/ask",
    headers: kopf,
    payload: mode ? { question: frage, mode } : { question: frage },
  });
  expect(res.statusCode, res.body).toBe(200);
  return res.json() as Antwort;
}

describe("R-0346 · Rolle und Anlass wirken auf die Antwort selbst", () => {
  it("Fachrolle: die Antwort ergänzt wörtlich Voraussetzungen und Maßnahmen der tragenden Quelle", async () => {
    const { app, admin } = await start("zu-a@antwort.test");
    const ko = await anlegen(app, admin, `Wartung ${SELTENES_WORT}`, {
      conditions: ["Anlage abgeschaltet"],
      measures: ["Druck am Manometer M2 ablesen"],
    });
    const a = await fragen(app, admin);
    expect(a.result.answered).toBe(true);
    // Die Quellenbindung bleibt: dieselbe tragende Quelle, nichts hinzugezogen.
    expect(a.result.citedSources).toEqual([ko]);
    expect(a.result.answer?.startsWith(SYNTHESE)).toBe(true);
    expect(a.result.answer).toContain(
      `Voraussetzungen (Wartung ${SELTENES_WORT}):\n- Anlage abgeschaltet`,
    );
    expect(a.result.answer).toContain(
      `Maßnahmen (Wartung ${SELTENES_WORT}):\n- Druck am Manometer M2 ablesen`,
    );
    expect(a.antwortZuschnitt).toEqual({
      tiefe: "ausfuehrlich",
      fachsprache: "fach",
      reihenfolge: ["technik", "negativwissen", "lernkurve", "best_practice", "bauchgefuehl"],
      ergaenzungen: [
        { art: "voraussetzungen", quelleId: ko, eintraege: ["Anlage abgeschaltet"] },
        { art: "massnahmen", quelleId: ko, eintraege: ["Druck am Manometer M2 ablesen"] },
      ],
    });
    // Der Schluss der Kette trägt genau die ausgelieferte Antwort.
    expect(a.result.belastbarkeit.argumentation.at(-1)).toMatchObject({
      art: "schluss",
      aussage: a.result.answer,
      gestuetztAuf: [ko],
    });
  });

  it("der wörtliche Weg (retrieval-only) bleibt unverändert — kein Zuschnitt an der Antwort", async () => {
    const { app, admin } = await start("zu-b@antwort.test");
    await anlegen(app, admin, `Wartung ${SELTENES_WORT}`, {
      measures: ["Druck am Manometer M2 ablesen"],
    });
    const a = await fragen(app, admin, "retrieval-only");
    expect(a.result.answer ?? "").not.toContain("Manometer");
    expect(a.antwortZuschnitt).toBeUndefined();
  });

  it("Lesende: kurz und allgemein — Begriffserklärung aus dem Firmenwörterbuch, keine Maßnahmenliste", async () => {
    const { app, services, admin } = await start("zu-c@antwort.test");
    await anlegen(app, admin, `Wartung ${SELTENES_WORT}`, {
      measures: ["Druck am Manometer M2 ablesen"],
    });
    await services.begriffe.lege({
      id: "begriff-haube",
      version: 1,
      geaendertVon: "admin",
      geaendertAm: JETZT,
      geltungsbereich: "Anlage 1",
      verantwortlich: "Instandhaltung",
      definition: { de: "Abdeckung über dem Querstromventil." },
      bezeichnungen: { de: { vorzug: SELTENES_WORT, synonyme: [], unerwuenscht: [] } },
    });
    const anlage = await app.inject({
      method: "POST",
      url: "/api/users",
      headers: admin,
      payload: {
        name: "Leserin",
        email: "leserin@antwort.test",
        password: "geheim12345",
        role: "viewer",
      },
    });
    expect(anlage.statusCode, anlage.body).toBe(201);
    const leserin = await anmelden(app, "leserin@antwort.test");
    const a = await fragen(app, leserin.kopf);
    expect(a.result.answered).toBe(true);
    // Ben nacharbeit-11: die Erklärung steht mit ihrer Herkunft da und ist von der Quellenbilanz
    // abgegrenzt — Eintrag, Fassung, Geltungsbereich, Verantwortung.
    const kopf = "Begriffe (aus dem Firmenwörterbuch, nicht Teil der Quellenbilanz):";
    const zusatz =
      "[Wörterbucheintrag begriff-haube, Fassung 1, Anlage 1, verantwortlich: Instandhaltung]";
    expect(a.result.answer).toContain(
      `${kopf}\n- ${SELTENES_WORT}: Abdeckung über dem Querstromventil. ${zusatz}`,
    );
    expect(a.result.answer).not.toContain("Manometer");
    const herkunft = {
      eintragId: "begriff-haube",
      fassung: 1,
      geltungsbereich: "Anlage 1",
      verantwortlich: "Instandhaltung",
      geaendertAm: JETZT,
    };
    expect(a.antwortZuschnitt).toMatchObject({
      tiefe: "kurz",
      fachsprache: "allgemein",
      ergaenzungen: [
        { art: "begriffe", quelleId: null, benennungen: [SELTENES_WORT], herkunft: [herkunft] },
      ],
    });
    // Die Kennung dessen, der den Eintrag zuletzt geändert hat, geht nicht hinaus.
    expect(JSON.stringify(a.antwortZuschnitt)).not.toContain("geaendertVon");
    // Die Quellenbilanz bleibt die der Wissensobjekte; das Wörterbuch steht GETRENNT daneben —
    // ohne Vertrauenswert, ausdrücklich nicht bewertet, nicht in der Kette.
    const b = a.result.belastbarkeit;
    expect(b.quellenAnzahl.tragend).toBe(a.result.citedSources.length);
    expect(b.quellen.map((q) => q.koId)).toEqual(a.result.citedSources);
    expect(b.vertrauenswert.schwaechsteQuelle).toBe(a.result.citedSources[0]);
    expect(b.woerterbuch).toEqual([
      { benennung: SELTENES_WORT, herkunft, vertrauenswert: null, belastbarkeit: "nicht_bewertet" },
    ]);
    expect(JSON.stringify(b.argumentation)).not.toContain("begriff-haube");
  });

  it("ohne angehängten Begriff steht kein Wörterbuchabschnitt an der Belastbarkeit", async () => {
    const { app, admin } = await start("zu-e@antwort.test");
    await anlegen(app, admin, `Wartung ${SELTENES_WORT}`);
    const a = await fragen(app, admin);
    expect(a.result.belastbarkeit.woerterbuch).toBeUndefined();
  });
});

describe("R-1627 · belegte Beziehungen statt Listenposition, an der echten Route", () => {
  it("ohne Kante: zwei gleichrangige Aussagen, ausdrücklich unabhängig; mit Kante: die Beziehung", async () => {
    const { app, services, admin, adminId } = await start("zu-d@antwort.test");
    const eins = await anlegen(app, admin, `Wartung ${SELTENES_WORT}`);
    // Eine EIGENE Aussage: bei wortgleicher Aussage legte die Dublettenprüfung (R-0247) automatisch
    // eine offene Dublette an, und die Freigabe verlangte zu Recht eine Bestätigung (409).
    const zwei = await anlegen(app, admin, `Frostschutz ${SELTENES_WORT}`, {
      statement: `Bei Frost bekommt die ${SELTENES_WORT} zur Wartung nach dem Entlasten eine Matte.`,
    });

    const ohne = await fragen(app, admin);
    expect([...ohne.result.citedSources].sort()).toEqual([eins, zwei].sort());
    const ketteOhne = ohne.result.belastbarkeit.argumentation;
    expect(ketteOhne.filter((s) => s.art === "aussage")).toHaveLength(2);
    expect(ketteOhne.some((s) => s.art === "beziehung")).toBe(false);
    expect(ketteOhne.some((s) => s.art === "stuetzung")).toBe(false);
    expect(ketteOhne.at(-1)).toMatchObject({ art: "schluss", unabhaengig: true });

    await services.kanten.setze({
      id: "kante-zu-d",
      quelleId: zwei,
      zielId: eins,
      art: "ergaenzt",
      richtung: "gerichtet",
      urheber: adminId,
      gesetztAm: JETZT,
      geaendertAm: JETZT,
      status: "aktiv",
      version: 1,
    });
    const mit = await fragen(app, admin);
    const ketteMit = mit.result.belastbarkeit.argumentation;
    expect(ketteMit.filter((s) => s.art === "beziehung")).toEqual([
      expect.objectContaining({
        beziehung: "ergaenzt",
        vonKoId: zwei,
        zuKoId: eins,
        gesetztVon: "Admin",
      }),
    ]);
    expect(ketteMit.at(-1)).toMatchObject({
      art: "schluss",
      aussage: mit.result.answer,
      unabhaengig: false,
    });
  });
});
