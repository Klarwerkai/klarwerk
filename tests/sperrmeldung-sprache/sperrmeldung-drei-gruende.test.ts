import { beforeAll, describe, expect, it, vi } from "vitest";
import { buildApp, buildServices } from "../../services/app";
import { ModelProvider, Reasoner } from "../../services/reasoner";

// JOB 3415: vollständiger Wortlaut als Sprachvertrag, unabhängig von der Produktfunktion.
// Jeder Text nennt Einstufung, Cloud-Verbot und den zum Grund gehörenden nächsten Schritt.
const FAELLE = [
  {
    reason: "unsaved_draft",
    en: "Unsaved draft: this text is treated as confidential, so the cloud AI cannot process it. Save the draft so its classification can be checked, or choose the local AI.",
    de: "Nicht gesicherter Entwurf: ohne gesicherten Stand gilt der Text als vertraulich eingestuft — die Cloud-KI darf ihn nicht bearbeiten. Entwurf sichern (die Einstufung wird dann geprüft) oder lokale KI wählen.",
  },
  {
    reason: "backstop",
    en: "The saved entry is classified as confidential, so the cloud AI cannot process this text. Change the classification of the saved entry, or choose the local AI.",
    de: "Der gespeicherte Beitrag ist als vertraulich eingestuft — die Cloud-KI darf ihn nicht bearbeiten. Einstufung des gespeicherten Beitrags ändern oder lokale KI wählen.",
  },
  {
    reason: "declared",
    en: "This text is classified as confidential, so the cloud AI cannot process it. Change the classification here, or choose the local AI.",
    de: "Dieser Text ist als vertraulich eingestuft — die Cloud-KI darf ihn nicht bearbeiten. Einstufung ändern oder lokale KI wählen.",
  },
] as const;

type Grund = (typeof FAELLE)[number]["reason"];
type Sprache = "de" | "en";
type Antwort = {
  status: number;
  body: { error: string; code: string; reason: string; message: string };
  cloudAufrufe: number;
};

describe("JOB 3415: drei Sperrgründe in DE und EN über die echte Route", () => {
  const antworten = new Map<`${Grund}:${Sprache}`, Antwort>();

  beforeAll(async () => {
    const services = buildServices();
    const complete = vi.fn(async () => '{"text":"Cloud-Antwort"}');
    // Der echte Reasoner entscheidet über die Sperre; nur der Cloud-Transport ist ein Spion.
    // Ohne lokales Modell bleibt assist bei vertraulichem Text ehrlich ohne Ergebnis.
    const app = buildApp({
      ...services,
      reasoner: new Reasoner(new ModelProvider({ name: "cloud:sprachtest", complete })),
    });
    try {
      const email = "advisor@job3415.test";
      const password = "test-passwort-3415";
      const registration = await app.inject({
        method: "POST",
        url: "/api/auth/register",
        payload: { name: "Advisor", email, password },
      });
      expect(registration.statusCode).toBe(201);
      const login = await app.inject({
        method: "POST",
        url: "/api/auth/login",
        payload: { email, password },
      });
      expect(login.statusCode).toBe(200);
      const { token } = login.json<{ token: string }>();
      for (const fall of FAELLE) {
        // Tatsächlich gespeicherte Anker: intern für declared, vertraulich für backstop.
        const draft =
          fall.reason === "unsaved_draft"
            ? undefined
            : await services.capture.createDraft(
                {
                  title: "Routerübergabe",
                  statement: "The customer received the router.",
                  confidentiality: fall.reason === "backstop" ? "vertraulich" : "intern",
                },
                "autor-3415",
              );
        for (const locale of ["de", "en"] as const) {
          complete.mockClear();
          const response = await app.inject({
            method: "POST",
            url: "/api/reasoner",
            headers: { authorization: `Bearer ${token}` },
            payload: {
              task: "assist",
              text: "The customer recieved the router.",
              instruction: "Correct spelling",
              source: "draft",
              confidentiality: fall.reason === "declared" ? "vertraulich" : "intern",
              ...(draft ? { draftId: draft.id } : {}),
              locale,
            },
          });
          antworten.set(`${fall.reason}:${locale}`, {
            status: response.statusCode,
            body: response.json<Antwort["body"]>(),
            cloudAufrufe: complete.mock.calls.length,
          });
        }
      }
    } finally {
      await app.close();
    }
  });

  for (const fall of FAELLE) {
    for (const locale of ["de", "en"] as const) {
      it(`${fall.reason} / ${locale}: 409 mit Einstufung, Cloud-Verbot und passendem Ausweg`, () => {
        const antwort = antworten.get(`${fall.reason}:${locale}`);
        expect(antwort).toBeDefined();
        expect(antwort?.status).toBe(409);
        expect(antwort?.cloudAufrufe).toBe(0);
        expect(antwort?.body.error).toBe("CONFIDENTIAL_CLOUD_BLOCKED");
        expect(antwort?.body.code).toBe("CONFIDENTIAL_CLOUD_BLOCKED");
        expect(antwort?.body.reason).toBe(fall.reason);
        const message = antwort?.body.message;
        expect(message).toContain(locale === "en" ? "confidential" : "als vertraulich eingestuft");
        expect(message).toBe(fall[locale]);
        // Sprachtrennung und paarweise Verschiedenheit an den tatsächlich gelieferten Texten.
        for (const anderer of FAELLE) {
          const andereSprache = locale === "en" ? "de" : "en";
          expect(message).not.toBe(
            antworten.get(`${anderer.reason}:${andereSprache}`)?.body.message,
          );
          if (locale === "en" && anderer.reason !== fall.reason) {
            expect(message).not.toBe(antworten.get(`${anderer.reason}:en`)?.body.message);
          }
        }
        if (locale === "en") {
          expect(message).not.toMatch(/[()]|unsaved_draft|backstop|declared/);
        }
      });
    }
  }
});
