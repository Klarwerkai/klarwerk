// ================================================================================================
// R-0348 — GESPRÄCHSFADEN STATT EINZELFRAGEN (Auftrag aufnahme:20260922:gesamt-gespraechsfaden).
// ================================================================================================
//
// „Man kann nachfragen und weiterfragen, ohne bei null anzufangen — heute ist jede Frage ein
// Einzelschuss ohne Faden." Geprüft über die ECHTE Route POST /api/ask (Konsolenzweig, Sitzung,
// validierte Objekte, deterministischer Reasoner) — nichts ist eingesetzt.
//
// DER FALL: Erst „Wie werden Urlaubstage berechnet?", dann die Nachfrage „Und in Teilzeit?".
//   · OHNE Faden ist die Nachfrage ein Einzelschuss: ein einziges Inhaltswort erreicht das
//     Antworttor nicht — ehrliche Wissenslücke (Kalibrierung, damit der Hauptfall nicht vakuös ist).
//   · MIT Faden antwortet die Urlaubsquelle — und NICHT die Gleitzeitquelle, die „Teilzeit"
//     genauso trägt, aber nichts zum Gesprächsthema sagt.
// R-0345 (kein offener Chatbot): der Faden schafft keine Grundlage. Eine Nachfrage, deren Begriff
// keine Quelle trägt, bleibt eine Lücke — die Lücke trägt den Zusammenhang, damit sie lesbar ist.
// Add-on- und Word-Wege lassen den Faden liegen; ein zu langer Faden ist 400 aus dem Schema.
import { describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";

const ERSTFRAGE = "Wie werden Urlaubstage berechnet?";
const NACHFRAGE = "Und in Teilzeit?";

async function fadenBestand() {
  const services = buildServices();
  const app = buildApp(services);
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Admin", email: "a@x.de", password: "secret123" },
  });
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: "a@x.de", password: "secret123" },
  });
  const headers = { authorization: `Bearer ${login.json().token}` };
  const validiert = async (title: string, statement: string): Promise<string> => {
    const res = await app.inject({
      method: "POST",
      url: "/api/kos",
      headers,
      payload: {
        confidentiality: "intern",
        title,
        statement,
        type: "best_practice",
        category: "Personal",
        neededValidations: 1,
      },
    });
    const id = res.json().id as string;
    await app.inject({
      method: "PUT",
      url: `/api/kos/${id}`,
      headers,
      payload: { action: "rate", verdict: "up" },
    });
    return id;
  };
  const urlaub = await validiert(
    "Urlaubstage in Teilzeit",
    "In Teilzeit werden die Urlaubstage anteilig nach den Arbeitstagen pro Woche berechnet.",
  );
  const gleitzeit = await validiert(
    "Gleitzeit in Teilzeit",
    "In Teilzeit gilt die Kernzeit nur an den vereinbarten Arbeitstagen.",
  );
  const fragen = (payload: Record<string, unknown>) =>
    app.inject({ method: "POST", url: "/api/ask", headers, payload });
  return { app, fragen, urlaub, gleitzeit };
}

describe("R-0348 · Nachfragen im Gesprächsfaden", () => {
  it("F1 · die Erstfrage wird aus der Urlaubsquelle beantwortet", async () => {
    const { fragen, urlaub, gleitzeit } = await fadenBestand();
    const res = await fragen({ question: ERSTFRAGE });
    expect(res.statusCode).toBe(200);
    expect(res.json().result.answered).toBe(true);
    expect(res.json().result.sources).toContain(urlaub);
    expect(res.json().result.sources).not.toContain(gleitzeit);
  });

  it("F2 · KALIBRIERUNG: ohne Faden ist die Nachfrage ein Einzelschuss — Wissenslücke", async () => {
    const { fragen } = await fadenBestand();
    const res = await fragen({ question: NACHFRAGE });
    expect(res.statusCode).toBe(200);
    expect(res.json().result.answered).toBe(false);
    // Gegenprobe: ohne Faden bleibt die Frage wörtlich die Frage — auch in der Lücke.
    expect(res.json().gap.question).toBe(NACHFRAGE);
  });

  it("F3 · KERN: mit Faden knüpft die Nachfrage an — die Urlaubsquelle antwortet, die Gleitzeitquelle nicht", async () => {
    const { fragen, urlaub, gleitzeit } = await fadenBestand();
    const res = await fragen({ question: NACHFRAGE, thread: [ERSTFRAGE] });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.result.answered).toBe(true);
    expect(body.result.sources).toContain(urlaub);
    expect(body.result.sources).not.toContain(gleitzeit);
    expect(body.gap).toBeNull();
  });

  it("F4 · R-0345: der Faden schafft keine Grundlage — ohne tragende Quelle bleibt es eine lesbare Lücke", async () => {
    const { fragen } = await fadenBestand();
    const res = await fragen({ question: "Und in Elternzeit?", thread: [ERSTFRAGE] });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.result.answered).toBe(false);
    expect(body.gap.question).toBe(`${ERSTFRAGE} → Und in Elternzeit?`);
  });

  it("F5 · der Word-Weg (retrieval-only) lässt den Faden liegen — dieselbe Lücke wie ohne", async () => {
    const { fragen } = await fadenBestand();
    const res = await fragen({ question: NACHFRAGE, thread: [ERSTFRAGE], mode: "retrieval-only" });
    expect(res.statusCode).toBe(200);
    expect(res.json().result.answered).toBe(false);
  });

  it("F7 · Ben, Nacharbeit 2: nach mehreren Nachfragen trägt der Anker im Faden weiter das Thema", async () => {
    const { fragen, urlaub, gleitzeit } = await fadenBestand();
    // So sendet die Fragen-Seite nach mehreren Nachfragen: Anker plus die jüngsten zwei.
    const res = await fragen({
      question: NACHFRAGE,
      thread: [ERSTFRAGE, "Und bei Azubis?", "Und im Minijob?"],
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().result.answered).toBe(true);
    expect(res.json().result.sources).toContain(urlaub);
    expect(res.json().result.sources).not.toContain(gleitzeit);
  });

  it("F6 · mehr als drei Fadenfragen sind 400 aus dem Schema", async () => {
    const { fragen } = await fadenBestand();
    const res = await fragen({ question: NACHFRAGE, thread: ["a", "b", "c", "d"] });
    expect(res.statusCode).toBe(400);
  });
});
