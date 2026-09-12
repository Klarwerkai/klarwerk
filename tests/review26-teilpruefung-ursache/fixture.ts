import { createAiCheckRunner } from "../../services/app/src/ai-check-worker";
import { buildServices } from "../../services/app/src/build-app";
import { detectConflictsForKo } from "../../services/app/src/conflict-detection";
import { detectDuplicatesForKo } from "../../services/app/src/duplicate-detection";
import { type ModelClient, ModelProvider, Reasoner } from "../../services/reasoner";
import { erteileKiFreigabe } from "../../services/reasoner/src/testhelfer-ki-freigabe";

export const GOOD_CONFLICT =
  '{"relation":"kein_konflikt","older":null,"confidence":0.9,"begruendung":"ok","zitat_a":"a","zitat_b":"b"}';
export const GOOD_DUPLICATE =
  '{"beziehung":"verschieden","gemeinsame_aussagen":[],"nur_in_a":"","nur_in_b":"","empfehlung":"getrennt_lassen","confidence":0.9,"begruendung":"ok"}';

export async function fixture(
  errors: readonly (Error | undefined)[] = [],
  confidential = false,
  failureKind: "conflict" | "duplicate" | "both" = "both",
) {
  const services = buildServices();
  const calls = { conflict: 0, duplicate: 0 };
  const client: ModelClient = {
    name: "test-provider",
    rejectsConfidential: true,
    async complete(system) {
      const kind = system.includes('"relation"') ? "conflict" : "duplicate";
      const failure = errors[calls[kind]++ % Math.max(1, errors.length)];
      if (failure && (failureKind === "both" || failureKind === kind)) throw failure;
      return kind === "conflict" ? GOOD_CONFLICT : GOOD_DUPLICATE;
    },
  };
  services.reasoner = new Reasoner(new ModelProvider(client));
  // JOB 3484 R9: echte Provider-Ausgänge brauchen seit JOB 3549 die Grundfreigabe.
  // Keine Freigabe vertraulicher Inhalte: die Sperrfälle müssen weiterhin ohne Client-Aufruf enden.
  // Mutation: diese Freigabe entfernen → 429-/Klassen-/Buchhaltungsfälle werden no-model und rot.
  await erteileKiFreigabe(services.reasoner);
  for (let i = 0; i < errors.length; i++) {
    await services.ko.create({
      title: `Kandidat ${i}`,
      statement: `Pumpenleistung im Betrieb Nummer ${i}`,
      type: "best_practice",
      category: "Betrieb",
      author: "u1",
      confidentiality: confidential ? "vertraulich" : "intern",
    });
  }
  const subject = await services.ko.create({
    title: "Subjekt",
    statement: "Das Ventil muss vor der Wartung geschlossen werden",
    type: "best_practice",
    category: "Betrieb",
    author: "u1",
    confidentiality: "intern",
  });
  const detect = (kind: "conflict" | "duplicate") =>
    kind === "conflict"
      ? detectConflictsForKo(subject.id, services)
      : detectDuplicatesForKo(subject.id, { ...services, settings: services.overlapSettings });
  return { services, subject, calls, detect, run: () => createAiCheckRunner(services)(subject.id) };
}
