import { describe, expect, it, vi } from "vitest";
import {
  ConfidentialCloudBlockedError,
  DeterministicProvider,
  ModelProvider,
  Reasoner,
} from "../../../reasoner";
import { buildApp, buildServices } from "../build-app";
import { CONFIDENTIAL_CLOUD_BLOCKED, classifyProvenanceConfidential } from "./reasoner-routes";

// SCRUM-502 Round 4: die Einstufung ist an den VERARBEITETEN TEXT gebunden, nicht an eine lose koId.
// Gültige Text-Quellen: "draft" (Editor) / "transient-document" (Upload) — beide mit AKTUELLER Stufe.
// Eine koId ist nur ein HEBENDER Backstop (nie senkend), source:"ko" wird nicht mehr geehrt.
describe("SCRUM-502 Round 4: classifyProvenanceConfidential (an den Text gebunden)", () => {
  const NONE = { found: false } as const;

  it("draft/transient-document + explizit intern → nicht vertraulich", () => {
    expect(classifyProvenanceConfidential("draft", "intern", NONE)).toBe(false);
    expect(classifyProvenanceConfidential("transient-document", "intern", NONE)).toBe(false);
  });

  it("draft/transient-document + vertraulich/streng → vertraulich", () => {
    expect(classifyProvenanceConfidential("draft", "vertraulich", NONE)).toBe(true);
    expect(classifyProvenanceConfidential("transient-document", "streng_vertraulich", NONE)).toBe(
      true,
    );
  });

  it("draft ohne/ungültige Stufe → fail-safe vertraulich", () => {
    expect(classifyProvenanceConfidential("draft", undefined, NONE)).toBe(true);
    expect(classifyProvenanceConfidential("draft", "quatsch", NONE)).toBe(true);
    expect(classifyProvenanceConfidential("transient-document", 42, NONE)).toBe(true);
  });

  it("koId-Backstop HEBT: intern deklariert + gespeichert-vertrauliches KO → vertraulich", () => {
    expect(
      classifyProvenanceConfidential("draft", "intern", { found: true, level: "vertraulich" }),
    ).toBe(true);
    expect(
      classifyProvenanceConfidential("transient-document", "intern", {
        found: true,
        level: "streng_vertraulich",
      }),
    ).toBe(true);
  });

  it("koId-Backstop SENKT NIE: vertraulich deklariert + internes/fremdes KO → bleibt vertraulich", () => {
    expect(
      classifyProvenanceConfidential("draft", "vertraulich", { found: true, level: "intern" }),
    ).toBe(true);
  });

  it("internes KO als Backstop hebt nichts (kein falscher Freigabe-Anker)", () => {
    // Ein internes/unbekanntes KO darf eine intern-Deklaration nicht verändern → bleibt intern.
    expect(
      classifyProvenanceConfidential("draft", "intern", { found: true, level: "intern" }),
    ).toBe(false);
    expect(classifyProvenanceConfidential("draft", "intern", { found: false })).toBe(false);
  });

  it('source:"ko" (loser Anker) wird NICHT mehr geehrt → fail-safe vertraulich', () => {
    // Genau die R4-Lücke: frei gelieferter Text unter source:"ko" darf NIE an die Cloud.
    expect(classifyProvenanceConfidential("ko", "intern", NONE)).toBe(true);
    expect(classifyProvenanceConfidential("ko", "intern", { found: true, level: "intern" })).toBe(
      true,
    );
  });

  it("fehlende/unbekannte Quelle → fail-safe vertraulich", () => {
    expect(classifyProvenanceConfidential(undefined, "intern", NONE)).toBe(true);
    expect(classifyProvenanceConfidential("plain", "intern", NONE)).toBe(true);
    expect(classifyProvenanceConfidential("bogus", "vertraulich", NONE)).toBe(true);
  });
});

describe("N11b: Zustimmung ist ein zusätzlicher Eingang der reinen Regel", () => {
  const backstop = { found: true, level: "intern" } as const;
  it("bestätigte Zustimmung hebt fehlende/ungültige Einstufung für beide Textquellen", () => {
    for (const source of ["draft", "transient-document"]) {
      for (const declared of [undefined, null, "", "falsch", 0, {}]) {
        expect(
          classifyProvenanceConfidential(source, declared, backstop, { dokumentZustimmung: true }),
        ).toBe(false);
        expect(classifyProvenanceConfidential(source, declared, backstop)).toBe(true);
      }
    }
  });
  it("nur der boolesche Marker hebt gewaschenes vertraulich, streng bleibt immer gesperrt", () => {
    expect(
      classifyProvenanceConfidential("draft", "vertraulich", backstop, {
        dokumentZustimmung: true,
        nichtEingestuft: true,
      }),
    ).toBe(false);
    for (const nichtEingestuft of [undefined, false, "true", 1]) {
      expect(
        classifyProvenanceConfidential("draft", "vertraulich", backstop, {
          dokumentZustimmung: true,
          nichtEingestuft,
        }),
      ).toBe(true);
    }
    expect(
      classifyProvenanceConfidential("draft", "streng_vertraulich", backstop, {
        dokumentZustimmung: true,
        nichtEingestuft: true,
      }),
    ).toBe(true);
  });
  it("Zustimmung ersetzt weder sichere Quelle noch den hebenden Bestandswert", () => {
    for (const source of [undefined, "ko", "unbekannt"]) {
      expect(
        classifyProvenanceConfidential(source, undefined, backstop, { dokumentZustimmung: true }),
      ).toBe(true);
    }
    for (const level of ["vertraulich", "streng_vertraulich"] as const) {
      expect(
        classifyProvenanceConfidential(
          "draft",
          undefined,
          { found: true, level },
          { dokumentZustimmung: true },
        ),
      ).toBe(true);
    }
  });
});

// ================================================================================================
// JOB 3353 · B — DIE GESPERRTE CLOUD ANTWORTET TYPISIERT, NICHT MIT EINEM 500.
// ================================================================================================
//
// DER LIVEBEFUND (Codex 21:57 auf 1.202, „KI → Rechtschreibung" im Erfassen-Blatt): HTTP 500 nach
// 86 ms, „The AI returned no answer. Reason: The text is classified as confidential — the cloud AI
// must not process it." Der Grund stand IM Text, aber der Statuscode sagte „mein Fehler". Die Fläche
// kann daraus nur die generische Karte machen — und Pedi hatte keinen Weg vorwärts, obwohl es drei
// gibt: sichern, umstufen, lokale KI wählen.
//
// WAS DIESE FÄLLE MESSEN — an der ECHTEN App über die ECHTE Route. Die Abbildung hängt an EINEM
// positiven Beleg: `ConfidentialCloudBlockedError`, den der Reasoner nur wirft, wenn er gemessen hat,
// dass kein Modell in der Kette stand und die Cloud genau wegen der Vertraulichkeit fehlte (die
// Bedingungen und ihre Prüfung stehen in `services/reasoner/src/job3353-vertraulichkeit-sperre.test.ts`).
// B10 fährt zusätzlich die GANZE Kette — echter `Reasoner`, echte Route, kein Spion.
//
// DIE GEGENPROBEN SIND HIER DER EIGENTLICHE INHALT (B5–B8): ein Zeitlimit, ein beliebiger anderer
// Fehler, ein Fehler bei nicht vertraulichem Text und ein ERFOLGREICHER Lauf bleiben, was sie sind.
type Dienste = ReturnType<typeof buildServices>;
type App = ReturnType<typeof buildApp>;

/** Der POSITIV belegte Ausgang, wie ihn `Reasoner.runTask` wirft. */
const CLOUD_GESPERRT = (task: string): unknown => new ConfidentialCloudBlockedError(task as never);

function spione(services: Dienste, fehler: (task: string) => unknown = CLOUD_GESPERRT) {
  const assistText = vi.fn(async () => {
    throw fehler("assist");
  });
  const structure = vi.fn(async () => {
    throw fehler("structure");
  });
  const r = services.reasoner as unknown as Record<string, unknown>;
  r.assistText = assistText;
  r.structure = structure;
  return { assistText, structure };
}

/**
 * Ein Anbieter, der bei `assistText` ohne Ergebnis bleibt — für B10, wo die ganze Kette läuft.
 * Begründung wie im Reasoner-Test: der deterministische Ersatz ANTWORTET auf diesem Stand noch;
 * der Lauf, um den es geht, ist der ohne Ergebnis.
 */
class ErsatzOhneErgebnis extends DeterministicProvider {
  override async assistText(): Promise<never> {
    throw new Error("Ersatz: kein Ergebnis");
  }
}

async function anmelden(app: App, email: string): Promise<Record<string, string>> {
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Pedi", email, password: "geheim12345" },
  });
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email, password: "geheim12345" },
  });
  return { authorization: `Bearer ${(login.json() as { token: string }).token}` };
}

/** Ein WIRKLICH gespeicherter Entwurf über den echten Capture-Dienst — kein Handwert. */
async function entwurf(services: Dienste, stufe: string): Promise<string> {
  const d = await services.capture.createDraft(
    {
      title: "Routerübergabe",
      statement: "the customer recieved the router.",
      confidentiality: stufe as never,
    },
    "autor-3353",
  );
  return d.id;
}

async function assistUeberRoute(
  app: App,
  headers: Record<string, string>,
  body: Record<string, unknown>,
) {
  return app.inject({
    method: "POST",
    url: "/api/reasoner",
    headers,
    payload: {
      task: "assist",
      text: "the customer recieved the router and the instalation was completed.",
      instruction: "Rechtschreibung",
      ...body,
    },
  });
}

describe("JOB 3353 B: Cloud wegen Vertraulichkeit gesperrt → typisierte 409 statt 500", () => {
  it("B1 — nicht gesicherter Entwurf (kein Anker): 409, Kennung, Grund `unsaved_draft`, deutscher Satz", async () => {
    const services = buildServices();
    const s = spione(services);
    const app = buildApp(services);
    const headers = await anmelden(app, "b1@job3353.test");

    const res = await assistUeberRoute(app, headers, {
      source: "draft",
      confidentiality: "intern",
      locale: "de",
    });

    // Der Lauf ist WIRKLICH gefahren — die Route hat nicht vorab abgebrochen.
    expect(s.assistText).toHaveBeenCalledTimes(1);
    expect(res.statusCode).toBe(409);
    const body = res.json() as Record<string, string>;
    // `error` ist das Feld, das der Client auf `ApiError.code` abbildet (api/client.ts:37) — ohne
    // es könnte das Blatt die Sperre nicht von einem beliebigen Konflikt unterscheiden.
    expect(body.error).toBe(CONFIDENTIAL_CLOUD_BLOCKED);
    expect(body.code).toBe(CONFIDENTIAL_CLOUD_BLOCKED);
    expect(body.reason).toBe("unsaved_draft");
    expect(body.message).toContain("Nicht gesicherter Entwurf");
    expect(body.message).toContain("lokale KI");
  });

  it("B2 — derselbe Aufruf mit `locale: en`: der Satz kommt vom SERVER, in der Sprache des Requests", async () => {
    const services = buildServices();
    spione(services);
    const app = buildApp(services);
    const headers = await anmelden(app, "b2@job3353.test");

    const en = await assistUeberRoute(app, headers, {
      source: "draft",
      confidentiality: "intern",
      locale: "en",
    });
    expect(en.statusCode).toBe(409);
    expect((en.json() as Record<string, string>).message).toContain("Unsaved draft");
    expect((en.json() as Record<string, string>).message).toContain("local AI");

    // GEMESSEN und dokumentiert: die Route kennt nur DE/EN (`normalizeLocale`, FR-I18N-01). Eine
    // dritte Sprache bekommt den deutschen Satz — wie jeder andere Text dieser Route auch. Das ist
    // keine Lücke dieses Auftrags, sondern die Sprachregel des Endpunkts, hier festgehalten, damit
    // niemand eine Abdeckung annimmt, die es nicht gibt.
    const nl = await assistUeberRoute(app, headers, {
      source: "draft",
      confidentiality: "intern",
      locale: "nl",
    });
    expect(nl.statusCode).toBe(409);
    expect((nl.json() as Record<string, string>).message).toContain("Nicht gesicherter Entwurf");
  });

  it("B3 — gespeicherter Entwurf, Aufruf deklariert ‹vertraulich› → Grund `declared`", async () => {
    const services = buildServices();
    spione(services);
    const app = buildApp(services);
    const headers = await anmelden(app, "b3@job3353.test");
    const draftId = await entwurf(services, "intern");

    const res = await assistUeberRoute(app, headers, {
      source: "draft",
      confidentiality: "vertraulich",
      draftId,
      locale: "de",
    });
    expect(res.statusCode).toBe(409);
    const body = res.json() as Record<string, string>;
    expect(body.reason).toBe("declared");
    expect(body.message).toContain("als vertraulich eingestuft");
  });

  it("B4 — gespeicherter Entwurf ist ‹vertraulich›, Aufruf behauptet ‹intern› → Grund `backstop`", async () => {
    const services = buildServices();
    spione(services);
    const app = buildApp(services);
    const headers = await anmelden(app, "b4@job3353.test");
    const draftId = await entwurf(services, "vertraulich");

    const res = await assistUeberRoute(app, headers, {
      source: "draft",
      confidentiality: "intern",
      draftId,
      locale: "de",
    });
    expect(res.statusCode).toBe(409);
    const body = res.json() as Record<string, string>;
    // Der nächste Schritt des Menschen ist ein ANDERER als bei `declared`: nicht das Formular,
    // sondern der gespeicherte Beitrag trägt die Stufe.
    expect(body.reason).toBe("backstop");
    expect(body.message).toContain("gespeicherte Beitrag");
  });

  it("B5 — GEGENPROBE: vertraulich, aber das Modell lief in ein ZEITLIMIT → bleibt ein Fehler, keine Sperre", async () => {
    // Ein Zeitlimit setzt einen ECHTEN Aufruf voraus. Ihn als „die Cloud darf nicht" auszugeben,
    // wäre eine falsche Erklärung — der Mensch änderte eine Einstufung, die nichts damit zu tun hat.
    const services = buildServices();
    spione(services, () => new Error("Zeitlimit überschritten (Modell)"));
    const app = buildApp(services);
    const headers = await anmelden(app, "b5@job3353.test");

    const res = await assistUeberRoute(app, headers, {
      source: "draft",
      confidentiality: "intern",
      locale: "de",
    });
    expect(res.statusCode).not.toBe(409);
    expect(res.body).not.toContain(CONFIDENTIAL_CLOUD_BLOCKED);
  });

  it("B6 — GEGENPROBE: vertraulich, aber ein PROGRAMMFEHLER brach den Lauf ab → bleibt ein Fehler", async () => {
    // Genau der Fall, an dem der Umkehrschluss aus der Fehlerklasse zerbrach (Codex 73217c82): ein
    // TypeError ist nicht einzuordnen — und trotzdem ist er keine Vertraulichkeitssperre.
    const services = buildServices();
    spione(services, () => new TypeError("x.y ist keine Funktion"));
    const app = buildApp(services);
    const headers = await anmelden(app, "b6@job3353.test");

    const res = await assistUeberRoute(app, headers, {
      source: "draft",
      confidentiality: "intern",
      locale: "de",
    });
    expect(res.statusCode).not.toBe(409);
    expect(res.body).not.toContain(CONFIDENTIAL_CLOUD_BLOCKED);
  });

  it("B7 — GEGENPROBE: NICHT vertraulicher Text, Lauf ohne Anbieter → kein erfundener Sperrgrund", async () => {
    const services = buildServices();
    spione(services);
    const app = buildApp(services);
    const headers = await anmelden(app, "b7@job3353.test");
    const draftId = await entwurf(services, "intern");

    const res = await assistUeberRoute(app, headers, {
      source: "draft",
      confidentiality: "intern",
      draftId,
      locale: "de",
    });
    expect(res.statusCode).not.toBe(409);
    expect(res.body).not.toContain(CONFIDENTIAL_CLOUD_BLOCKED);
  });

  it("B8 — GEGENPROBE: KEIN Kurzschluss vor dem Lauf — vertraulicher Text mit Ergebnis geht als 200 hinaus", async () => {
    // Genau der Ausweg, den die Meldung selbst nennt: ein LOKALER Anbieter (oder der
    // deterministische Weg) darf vertraulichen Text bearbeiten. Er steht hier stellvertretend als
    // erfolgreicher `assistText`. Die Route darf die Einstufung NICHT vorab in einen Fehler
    // verwandeln.
    const services = buildServices();
    const assistText = vi.fn(async () => ({
      text: "the customer received the router.",
      demo: true,
    }));
    (services.reasoner as unknown as Record<string, unknown>).assistText = assistText;
    const app = buildApp(services);
    const headers = await anmelden(app, "b8@job3353.test");

    const res = await assistUeberRoute(app, headers, {
      source: "draft",
      confidentiality: "intern",
      locale: "de",
    });
    expect(res.statusCode).toBe(200);
    // Der Text WAR vertraulich (kein Anker) — die Cloud war also aus der Kette (4. Argument), und
    // trotzdem kam eine Antwort heraus.
    expect((assistText.mock.calls.at(-1) as unknown[] | undefined)?.[3]).toBe(true);
    expect((res.json() as Record<string, string>).text).toContain("received");
  });

  it("B9 — derselbe Ausgang auf dem Struktur-Weg (zweite Stelle, dieselbe Regel)", async () => {
    const services = buildServices();
    spione(services);
    const app = buildApp(services);
    const headers = await anmelden(app, "b9@job3353.test");

    const res = await app.inject({
      method: "POST",
      url: "/api/reasoner",
      headers,
      payload: {
        task: "structure",
        text: "the customer recieved the router.",
        source: "draft",
        confidentiality: "intern",
        locale: "en",
      },
    });
    expect(res.statusCode).toBe(409);
    const body = res.json() as Record<string, string>;
    expect(body.code).toBe(CONFIDENTIAL_CLOUD_BLOCKED);
    expect(body.reason).toBe("unsaved_draft");
    expect(body.message).toContain("Unsaved draft");
  });

  it("B10 — DIE GANZE KETTE ohne Spion: echter Reasoner mit verdrahteter Cloud → 409, und die Cloud wird nie gerufen", async () => {
    // Kein gestellter Fehler mehr: hier entscheidet der ECHTE `Reasoner`, ob dieser Lauf die Sperre
    // war. Die Cloud ist verdrahtet (sonst wäre es „kein Modell da" und keine Sperre), der Text gilt
    // ohne Anker als vertraulich, und der Ersatz bleibt ohne Ergebnis.
    let cloudAufrufe = 0;
    const services = buildServices();
    (services as unknown as { reasoner: unknown }).reasoner = new Reasoner(
      new ModelProvider({
        name: "cloud:spy",
        complete: async () => {
          cloudAufrufe += 1;
          return "darf nie passieren";
        },
      }),
      new ErsatzOhneErgebnis(),
    );
    const app = buildApp(services);
    const headers = await anmelden(app, "b10@job3353.test");

    const res = await assistUeberRoute(app, headers, {
      source: "draft",
      confidentiality: "intern",
      locale: "de",
    });

    expect(res.statusCode).toBe(409);
    const body = res.json() as Record<string, string>;
    expect(body.code).toBe(CONFIDENTIAL_CLOUD_BLOCKED);
    expect(body.reason).toBe("unsaved_draft");
    expect(body.message).toContain("Nicht gesicherter Entwurf");
    // Die Schutzregel, um die es die ganze Zeit geht: der vertrauliche Text hat den Rechner nie
    // verlassen.
    expect(cloudAufrufe).toBe(0);
  });
});
