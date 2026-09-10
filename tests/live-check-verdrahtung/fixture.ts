import Fastify from "fastify";
import { vi } from "vitest";
import type { Guards } from "../../services/app/src/http";
import { knowledgeCheckRoutes } from "../../services/app/src/routes/knowledge-check-routes";
import {
  ConflictService,
  type ConflictVerdict,
  InMemoryConflictRepo,
} from "../../services/conflicts";
import type { KnowledgeObject, KoService } from "../../services/knowledge-object";
import type { Reasoner } from "../../services/reasoner";

// Fixture-Bauform aus services/app/src/routes/knowledge-check-routes.test.ts:
// echte Route und ConflictService, ausschließlich lokaler Spy als Judge. Authentifizierung
// und Bestandsabfrage sind gestellt; diese Fixture belegt keine Entwurfsautorisierung.

const fakeGuards = { requirePermission: async () => ({ id: "u1" }) } as unknown as Guards;

// Freitext + Kandidat mit hoher Tokenüberdeckung → similar trifft, und (mit Judge) assessAgainstPool
// wählt den Kandidaten und ruft den Judge.
export const DRAFT = "Bei Kaltstart keine Vorwärmung aktivieren und sichern.";

function mkKo(over: Partial<KnowledgeObject> = {}): KnowledgeObject {
  return {
    id: "kc",
    title: "Kaltstart Vorwärmung",
    statement: "Bei Kaltstart zuerst die Vorwärmung aktivieren.",
    conditions: [],
    measures: [],
    category: "Anlage",
    // JOB 3031: der Zustand gehört zum Kandidaten und reist ab jetzt mit dem Treffer nach außen.
    // „offen" ist hier der aussagekräftigere Fall: genau ihn konnte die Antwort bisher nicht nennen.
    status: "offen",
    confidentiality: "intern",
    tags: [],
    asset: null,
    ...over,
  } as unknown as KnowledgeObject;
}

// G-2-gültiges Verdikt (wörtliche Zitate in beiden Kerntexten vorhanden).
export const conflictVerdict: ConflictVerdict = {
  relation: "widerspruch",
  older: null,
  confidence: 0.9,
  begruendung: "Widersprüchliche Aussage zur Vorwärmung.",
  zitat_a: "keine Vorwärmung aktivieren",
  zitat_b: "zuerst die Vorwärmung aktivieren",
} as unknown as ConflictVerdict;

// JOB 3556: der ENTWURFS-Backstop, wie ihn `build-app.ts` der echten Route mitgibt. Ohne ihn
// verhält sich eine Anfrage MIT `draftId` fail-closed — was einen Prüfstand grün aussehen liesse,
// der die Sperre gar nicht misst („kein Judge" käme dann vom fehlenden Dienst, nicht von der
// gespeicherten Stufe). Wer die Entwurfsstufe prüft, MUSS ihn reichen.
// JOB 3556 R3: `ka4` ist der BESTEHENDE Riegel (Einwilligung je Dokument, `ask-routes.ts::ka4Freigabe`),
// den `build-app.ts` der Route ab jetzt mitgibt. Eine Fixture ohne ihn misst den Zustimmungsweg nicht:
// „kein Judge" käme dann vom fehlenden Prüfer statt von der verweigerten Einwilligung.
export async function appWith(opts: {
  active: boolean;
  verdict?: ConflictVerdict | null;
  capture?: {
    getDraft: (id: string) => Promise<{ payload: { confidentiality?: unknown } } | undefined>;
  };
  ka4?: { erlaubt: boolean; grund?: string };
}) {
  const seed = [mkKo()];
  const findCandidates = vi.fn(async () => seed);
  const get = vi.fn(async (id: string) => seed.find((k) => k.id === id));
  const ko = { findCandidates, get } as unknown as KoService;
  const judgeConflict = vi.fn(async () => opts.verdict ?? null);
  const reasoner = {
    status: () => ({ active: opts.active, provider: "cloud", mode: "model" }),
    judgeConflict,
  } as unknown as Reasoner;
  const conflicts = new ConflictService({ repo: new InMemoryConflictRepo() });
  const pruefeExterneAusfuehrung = vi.fn(async () => opts.ka4 ?? { erlaubt: false });
  const app = Fastify();
  await app.register(
    knowledgeCheckRoutes({
      ko,
      conflicts,
      reasoner,
      guards: fakeGuards,
      capture: opts.capture as Parameters<typeof knowledgeCheckRoutes>[0]["capture"],
      ...(opts.ka4 ? { ka4: { pruefeExterneAusfuehrung } } : {}),
    }),
  );
  return { app, judgeConflict, pruefeExterneAusfuehrung };
}

// Die drei Kopfzeilen der Klara-Bindung, wörtlich wie in `ask-routes.ts:150-152`. Eine Anfrage mit
// ihnen ist „gebunden" — sie braucht die bestätigte Einwilligung, sonst erreicht sie keine Cloud.
export const KLARA_BINDUNG = {
  "x-klara-session": "s-1",
  "x-klara-instance": "i-1",
  "x-klara-document": "d-1",
};
