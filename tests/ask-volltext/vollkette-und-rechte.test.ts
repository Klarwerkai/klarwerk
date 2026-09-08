// ================================================================================================
// JOB 3298 · ASK-VOLLTEXT — DIE VOLLKETTE UND DIE RECHTE.
// ================================================================================================
//
// `antwortkontext.test.ts` misst den Baustein. Diese Datei misst den WEG: echte Dienste
// (KoService mit aktiver Suchprojektion → AskService → Reasoner → ModelProvider), ein einziges
// Testdoppel, und das ist der Modell-Client — er schreibt mit, was ihm vorgelegt wird. Was hier
// im Prompt ankommt, ist Zeichen für Zeichen das, was ein Cloud-Modell zu sehen bekäme.
//
//   V · DER NUTZERWEG   Import (bodyHtml) → Suchprojektion → Kandidat → Auszug → Antwort mit Beleg.
//   R · DIE RECHTE      ein VERTRAULICHES Objekt liefert weder Auszug noch Kennung noch ein Wort
//                       seines Dokumenttexts; im Modus `validatedOnly` gilt dasselbe für ein
//                       unvalidiertes Objekt. Die Sichtbarkeitsregeln laufen VOR den Refs, und
//                       dieser Auftrag hat daran nichts angefasst — belegt statt behauptet.
//
// DETERMINISTISCH: `KLARWERK_SKIP_KEYCHAIN` schaltet die Schlüsselbund-Auflösung ab, damit auf
// einer Entwicklungsmaschine mit hinterlegtem Schlüssel kein ECHTER Modellaufruf über das Ergebnis
// entscheidet (dieselbe Vorsichtsmaßnahme wie in `tests/ask/g27-klara-volltext.test.ts`).
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { InMemoryGapRepo } from "../../services/ask/src/repo";
import { AskService } from "../../services/ask/src/service";
import { AuditService, InMemoryAuditRepo } from "../../services/audit";
import { InMemoryKoRepo, KoService } from "../../services/knowledge-object";
import { type ModelClient, Reasoner } from "../../services/reasoner";
import { ModelProvider } from "../../services/reasoner/src/provider-model";

const VORGEFUNDEN = process.env.KLARWERK_SKIP_KEYCHAIN;
beforeAll(() => {
  process.env.KLARWERK_SKIP_KEYCHAIN = "1";
});
afterAll(() => {
  if (VORGEFUNDEN === undefined) {
    delete process.env.KLARWERK_SKIP_KEYCHAIN;
  } else {
    process.env.KLARWERK_SKIP_KEYCHAIN = VORGEFUNDEN;
  }
});

const FRAGE = "How many days does the customer have to report a defect?";
const REGELSATZ = "The customer must report a defect within 30 calendar days after delivery.";
const C02_HTML = [
  "<p>This page was imported from Confluence for the demonstration.</p>",
  `<p>${REGELSATZ}</p>`,
  "<p>Invoices are settled by the finance team once a quarter.</p>",
].join("");

function mitschreiber(antwort: string): { client: ModelClient; prompts: () => string[] } {
  const prompts: string[] = [];
  return {
    client: {
      name: "mitschreiber",
      complete: async (_system: string, user: string) => {
        prompts.push(user);
        return antwort;
      },
    },
    prompts: () => prompts,
  };
}

async function aufbauen(
  opts: { vertraulich?: boolean; status?: "offen" | "validiert" } = {},
  antwort = `${REGELSATZ} [1]`,
) {
  const koService = new KoService({ repo: new InMemoryKoRepo() });
  // Entscheidung 06 §4: die Suche ist fail-closed, die Projektion wird über den Produktpfad aktiv.
  await koService.activateSearchProjectionV2();
  const ko = await koService.create({
    // Der Titel trägt Frageworte, damit die Quelle den Kandidatenweg auch dann erreicht, wenn der
    // Dokumenttext (vertraulich/unvalidiert) gar nicht erst gelesen werden darf — sonst wäre jeder
    // Rechte-Fall unten schon deshalb grün, weil es überhaupt keinen Kandidaten gibt.
    title: "Customer defect reporting",
    statement: "DEMO notice: content imported for the demonstration.",
    type: "best_practice",
    category: "Vertrag",
    author: "anna",
    bodyHtml: C02_HTML,
    ...(opts.vertraulich ? { confidentiality: "vertraulich" as const } : {}),
  });
  // Ein zweites, unbedenkliches Objekt (validiert, nicht vertraulich, ohne den Regelsatz). Es sorgt
  // dafür, dass in den Rechte-Fällen WIRKLICH ein Modellaufruf stattfindet: „der Satz steht nicht im
  // Prompt" ist nur dann eine Aussage, wenn es einen Prompt gibt.
  const harmlos = await koService.create({
    title: "Customer defect intake desk",
    statement: "Reports are received by the service desk.",
    type: "best_practice",
    category: "Vertrag",
    author: "bea",
  });
  await koService.setValidationState(harmlos.id, { trust: 90, status: "validiert" });
  if (opts.status === "validiert") {
    // Der Prüfstand über den Produktpfad — dieselbe Methode, die der Validierungsdienst ruft
    // (services/validation/src/service.ts:333); kein Handgriff am Datensatz.
    await koService.setValidationState(ko.id, { trust: 90, status: "validiert" });
  }
  const { client, prompts } = mitschreiber(antwort);
  const ask = new AskService({
    reasoner: new Reasoner(new ModelProvider(client)),
    koService,
    gaps: new InMemoryGapRepo(),
    audit: new AuditService({ repo: new InMemoryAuditRepo() }),
  });
  return { ask, ko, harmlos, prompts, koService };
}

describe("JOB 3298 V · der Nutzerweg: Import → Suche → Auszug → Antwort mit Beleg", () => {
  it("V0 · KALIBRIERUNG: die Suchprojektion trägt den Regelsatz, die Kernaussage nicht", async () => {
    const { ko, koService } = await aufbauen();
    const projektion = await koService.searchProjectionOf(ko.id);
    expect(projektion?.bodyText).toContain("30 calendar days");
    expect(`${ko.title} ${ko.statement}`).not.toContain("30 calendar days");
  });

  it("V1 · der Modell-Prompt trägt den Regelsatz, und die Antwort nennt ihn mit der Quelle", async () => {
    const { ask, ko, prompts } = await aufbauen();
    const antwort = await ask.ask(FRAGE, "anna", "en");
    expect(prompts()).toHaveLength(1);
    const prompt = prompts()[0] ?? "";
    expect(prompt).toContain("Document text (excerpt):");
    expect(prompt).toContain("30 calendar days");
    expect(antwort.result.answered).toBe(true);
    expect(antwort.result.answer).toContain("30 calendar days");
    expect(antwort.result.citedSources).toEqual([ko.id]);
  });
});

describe("JOB 3298 R · die Rechte gelten vor dem Auszug", () => {
  it("R1 · ein VERTRAULICHES Objekt gibt seinen Dokumenttext nicht an das Modell", async () => {
    const { ask, ko, harmlos, prompts } = await aufbauen({ vertraulich: true });
    const antwort = await ask.ask(FRAGE, "anna", "en");
    // Das Modell WURDE gefragt (über das unbedenkliche Objekt) — und im Prompt steht kein Wort
    // des vertraulichen Objekts, weder Auszug noch Titel noch Kennung.
    expect(prompts()).toHaveLength(1);
    const prompt = prompts()[0] ?? "";
    expect(prompt).toContain(harmlos.title);
    expect(prompt).not.toContain("30 calendar days");
    expect(prompt).not.toContain("Customer defect reporting");
    expect(prompt).not.toContain(ko.id);
    expect(antwort.result.sources).not.toContain(ko.id);
  });

  it("R2 · `validatedOnly`: ein UNVALIDIERTES Objekt gibt seinen Dokumenttext nicht an das Modell", async () => {
    const { ask, ko, harmlos, prompts } = await aufbauen({ status: "offen" });
    const antwort = await ask.ask(FRAGE, "anna", "en", { validatedOnly: true });
    expect(prompts()).toHaveLength(1);
    const prompt = prompts()[0] ?? "";
    expect(prompt).toContain(harmlos.title);
    expect(prompt).not.toContain("30 calendar days");
    expect(antwort.result.sources).not.toContain(ko.id);
  });

  it("R3 · KALIBRIERUNG der beiden Rechte-Fälle: validiert und nicht vertraulich kommt an", async () => {
    // Ohne diesen Fall wären R1 und R2 auch dann grün, wenn der Auszug generell nicht mehr liefe.
    const { ask, ko, prompts } = await aufbauen({ status: "validiert" });
    const antwort = await ask.ask(FRAGE, "anna", "en", { validatedOnly: true });
    expect(prompts()[0] ?? "").toContain("30 calendar days");
    expect(antwort.result.citedSources).toEqual([ko.id]);
  });
});
