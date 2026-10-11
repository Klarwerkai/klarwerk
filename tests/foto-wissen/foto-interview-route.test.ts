// ================================================================================================
// R-1624 · FOTO-ZU-WISSEN — der Bildbefund an der HTTP-Grenze (`POST /api/reasoner`, task interview).
// ================================================================================================
//
// Gemessen an der ECHTEN App (`buildApp`) über die ECHTE Route, mit einem Spion genau dort, wo der
// Aufruf den Reasoner erreicht (`interview(answers, locale, confidential, imageContext)`):
//   R1  Ein Befund (String) kommt unverändert als viertes Argument an — und ändert an der
//       Vertraulichkeit nichts: ein vertraulicher Entwurf bleibt vertraulich.
//   R2  Fremdtypen und ein fehlendes Feld ergeben „kein Foto-Interview" (undefined), keinen Fehler.
// Gekappt wird nicht hier, sondern autoritativ im Provider (tests/foto-wissen/foto-interview-reasoner).
import { describe, expect, it, vi } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";

const BEFUND = "Kehlnaht an einem Stahlträger mit Riss am Nahtübergang.";

type Dienste = ReturnType<typeof buildServices>;
type App = ReturnType<typeof buildApp>;

function interviewSpion(services: Dienste): ReturnType<typeof vi.fn> {
  const interview = vi.fn(async () => ({ question: "q", done: false, demo: true }));
  (services.reasoner as unknown as Record<string, unknown>).interview = interview;
  return interview;
}

async function anmelden(app: App): Promise<Record<string, string>> {
  const email = "pedi@r1624.test";
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
  if (login.statusCode !== 200) {
    throw new Error(`Anmeldung fehlgeschlagen: ${login.statusCode} ${login.body}`);
  }
  return { authorization: `Bearer ${(login.json() as { token: string }).token}` };
}

async function entwurf(services: Dienste): Promise<string> {
  const d = await services.capture.createDraft(
    { title: "Foto R-1624", statement: "Riss an der Naht.", confidentiality: "vertraulich" },
    "autor-r1624",
  );
  return d.id;
}

function letzterAufruf(spy: ReturnType<typeof vi.fn>): unknown[] {
  return (spy.mock.calls.at(-1) as unknown[] | undefined) ?? [];
}

describe("R-1624 R1 · der Befund erreicht den Reasoner", () => {
  it("als viertes Argument, unverändert — die Vertraulichkeit bleibt die des Entwurfs", async () => {
    const services = buildServices();
    const spy = interviewSpion(services);
    const app = buildApp(services);
    const headers = await anmelden(app);
    const draftId = await entwurf(services);

    const res = await app.inject({
      method: "POST",
      url: "/api/reasoner",
      headers,
      payload: {
        task: "interview",
        answers: [],
        imageContext: BEFUND,
        source: "draft",
        confidentiality: "intern",
        draftId,
      },
    });

    expect(res.statusCode).toBe(200);
    expect(spy).toHaveBeenCalledTimes(1);
    const [antworten, , vertraulich, befund] = letzterAufruf(spy);
    expect(antworten).toEqual([]);
    expect(vertraulich, "der Befund darf die gespeicherte Stufe nicht senken").toBe(true);
    expect(befund).toBe(BEFUND);
  });
});

describe("R-1624 R2 · kein Befund, kein Foto-Interview", () => {
  it("Fremdtyp und fehlendes Feld → undefined, Antwort 200", async () => {
    const services = buildServices();
    const spy = interviewSpion(services);
    const app = buildApp(services);
    const headers = await anmelden(app);
    const draftId = await entwurf(services);
    const basis = { task: "interview", answers: ["a"], source: "draft", draftId };

    const fremd = await app.inject({
      method: "POST",
      url: "/api/reasoner",
      headers,
      payload: { ...basis, imageContext: { text: BEFUND } },
    });
    expect(fremd.statusCode).toBe(200);
    expect(letzterAufruf(spy)[3]).toBeUndefined();

    const ohne = await app.inject({
      method: "POST",
      url: "/api/reasoner",
      headers,
      payload: basis,
    });
    expect(ohne.statusCode).toBe(200);
    expect(letzterAufruf(spy)[3]).toBeUndefined();
    expect(spy).toHaveBeenCalledTimes(2);
  });
});
