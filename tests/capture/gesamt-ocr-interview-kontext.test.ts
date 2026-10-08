// ================================================================================================
// Aufnahme `gesamt-ocr` (FR-CAP-05) — DER ERKANNTE BILDTEXT IM INTERVIEW: Route, Prompt, Vertraulichkeit
// ================================================================================================
//
// Bens Befund (Nacharbeit 2): Das geführte Interview bekam nur die Antworten. Jetzt reist der auf
// Klick erkannte Bildtext als `context` mit. Hier wird seine TATSÄCHLICHE Verwendung belegt:
//
//   R1  echte Route `POST /api/reasoner` → Kette → Modell-Client samt Chokepoint: der erkannte Text
//       steht in der Anfrage, die das Netz verlassen würde (nur `fetch` ist ersetzt).
//   R2  derselbe Weg mit vertraulicher Stufe: der Text erreicht das Netz NICHT — die bestehende
//       Vertraulichkeitsregel gilt für den Kontext genauso wie für die Antworten.
//   R3  ein Kontext, der keine Zeichenkette ist, wird nicht weitergereicht.
//   P1  der Prompt nennt den Text ausdrücklich als Kontext (keine Antwort) und deckelt seine Länge.
//   K1–K4  der Client schickt die erkannten Abschnitte des Rohtextes in ihrer AKTUELLEN Fassung —
//          auch korrigiert, und erst nach dem Entfernen nicht mehr (Nacharbeit 3). Das Fortsetzen
//          eines gespeicherten Entwurfs belegt der gemountete Test I4.
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  interviewKontext,
  ocrAbschnittKopf,
  ocrAbschnitte,
} from "../../apps/web/src/lib/interviewKontext";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import { InMemoryModelRunRepo } from "../../services/model-runs";
import { DeterministicProvider, ModelProvider, Reasoner } from "../../services/reasoner";
import { createCappedCloudClientFromEnv } from "../../services/reasoner/src/model-client";
import {
  MAX_INTERVIEW_CONTEXT_LENGTH,
  type ModelClient,
} from "../../services/reasoner/src/provider-model";
import { erteileKiFreigabe } from "../../services/reasoner/src/testhelfer-ki-freigabe";

const ERKANNT = "Bei Druckabfall an P2 zuerst Ventil V3 prüfen.";

const CLOUD_ENV = {
  ANTHROPIC_API_KEY: "test-schluessel-nur-hier",
  REASONER_MODEL: "claude-sonnet-4-6",
};

afterEach(() => {
  vi.unstubAllGlobals();
});

/** Gebauter Server mit Cloud-Client aus der Umgebungsfabrik; das Netz zeichnet nur auf. */
async function umgebung() {
  const gesendet: string[] = [];
  vi.stubGlobal("fetch", (async (_url: unknown, init?: { body?: unknown }) => {
    gesendet.push(String(init?.body ?? ""));
    return {
      ok: true,
      status: 200,
      json: async () => ({ content: [{ type: "text", text: "Woran erkennst du das?" }] }),
    } as unknown as Response;
  }) as unknown as typeof fetch);
  const clients = createCappedCloudClientFromEnv(
    CLOUD_ENV,
    () => undefined,
    () => false,
  );
  const client = clients.openai ?? clients.anthropic;
  const services = buildServices();
  const mutable = services as unknown as { reasoner: Reasoner };
  mutable.reasoner = new Reasoner(
    new ModelProvider(client),
    new DeterministicProvider(),
    new InMemoryModelRunRepo(),
  );
  await erteileKiFreigabe(mutable.reasoner);
  const app = buildApp(services);
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Admin", email: "admin@x.de", password: "secret123" },
  });
  const anmeldung = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: "admin@x.de", password: "secret123" },
  });
  const admin = { authorization: `Bearer ${anmeldung.json().token}` };
  const ko = await app.inject({
    method: "POST",
    url: "/api/kos",
    headers: admin,
    payload: {
      confidentiality: "intern",
      title: "Wartung Hauptschalter",
      statement: "Vor der Wartung verriegeln.",
      type: "best_practice",
      category: "Anlage 2",
      neededValidations: 1,
    },
  });
  return { app, admin, koId: ko.json().id as string, gesendet };
}

describe("gesamt-ocr · FR-CAP-05 · erkannter Bildtext an der echten Interview-Route", () => {
  it("R1 · intern: der erkannte Text steht in der Anfrage an das Modell", async () => {
    const env = await umgebung();
    const lauf = await env.app.inject({
      method: "POST",
      url: "/api/reasoner",
      headers: env.admin,
      payload: {
        task: "interview",
        answers: ["Die Kernaussage."],
        context: `[aushang.png]\n${ERKANNT}`,
        source: "draft",
        confidentiality: "intern",
        koId: env.koId,
      },
    });
    expect(lauf.statusCode).toBe(200);
    expect(env.gesendet).toHaveLength(1);
    expect(env.gesendet[0]).toContain("Ventil V3");
    expect(env.gesendet[0]).toContain("Im Bild erkannter Text");
  });

  it("R2 · vertraulich: der erkannte Text verlässt das Haus nicht", async () => {
    const env = await umgebung();
    const lauf = await env.app.inject({
      method: "POST",
      url: "/api/reasoner",
      headers: env.admin,
      payload: {
        task: "interview",
        answers: ["Die Kernaussage."],
        context: `[aushang.png]\n${ERKANNT}`,
        source: "draft",
        confidentiality: "vertraulich",
        koId: env.koId,
      },
    });
    expect(lauf.statusCode).toBe(200);
    expect(env.gesendet.some((b) => b.includes("Ventil V3"))).toBe(false);
  });

  it("R3 · ein Kontext, der keine Zeichenkette ist, wird nicht weitergereicht", async () => {
    const env = await umgebung();
    const lauf = await env.app.inject({
      method: "POST",
      url: "/api/reasoner",
      headers: env.admin,
      payload: {
        task: "interview",
        answers: ["Die Kernaussage."],
        context: { text: ERKANNT },
        source: "draft",
        confidentiality: "intern",
        koId: env.koId,
      },
    });
    expect(lauf.statusCode).toBe(200);
    expect(env.gesendet).toHaveLength(1);
    expect(env.gesendet[0]).not.toContain("Ventil V3");
    expect(env.gesendet[0]).not.toContain("Im Bild erkannter Text");
  });
});

describe("gesamt-ocr · FR-CAP-05 · Prompt und Client-Auswahl", () => {
  function aufzeichnend(): { client: ModelClient; user: string[] } {
    const user: string[] = [];
    return {
      user,
      client: {
        name: "aufzeichnend",
        complete: async (_system, u) => {
          user.push(u);
          return "Woran erkennst du das?";
        },
      },
    };
  }

  it("P1 · Kontext vor den Antworten, als Kontext beschriftet und gedeckelt; ohne Kontext kein Block", async () => {
    const mit = aufzeichnend();
    const lang = `${ERKANNT} ${"x".repeat(MAX_INTERVIEW_CONTEXT_LENGTH)}`;
    await new ModelProvider(mit.client).interview(["Die Kernaussage."], "de", false, lang);
    const prompt = mit.user[0] ?? "";
    expect(prompt.startsWith("Im Bild erkannter Text (Kontext, keine Antwort):\n")).toBe(true);
    expect(prompt).toContain(ERKANNT);
    expect(prompt.indexOf(ERKANNT)).toBeLessThan(prompt.indexOf("Bisherige Antworten:"));
    expect(prompt).not.toContain("x".repeat(MAX_INTERVIEW_CONTEXT_LENGTH));

    const ohne = aufzeichnend();
    await new ModelProvider(ohne.client).interview(["Die Kernaussage."], "de", false);
    expect(ohne.user[0]).not.toContain("Im Bild erkannter Text");
    expect(ohne.user[0]?.startsWith("Bisherige Antworten:")).toBe(true);
  });

  it("K1 · Kontext sind nur die erkannten Abschnitte des Rohtextes, nicht der übrige Text", () => {
    const raw = [
      "Mein eigener Text.",
      "",
      `${ocrAbschnittKopf("aushang.png")}\n${ERKANNT}`,
      "",
      "[Handbuch.pdf]\nText aus einem Dokument, kein Bild.",
      "",
      `${ocrAbschnittKopf("notiz.jpg")}\nZweiter erkannter Block.`,
    ].join("\n");
    expect(interviewKontext(raw)).toBe(
      `[aushang.png]\n${ERKANNT}\n\n[notiz.jpg]\nZweiter erkannter Block.`,
    );
    expect(interviewKontext("Nur eigener Text.")).toBe("");
    expect(interviewKontext("")).toBe("");
  });

  it("K2 · Bens Befund: eine Korrektur im erkannten Block aktualisiert den Kontext", () => {
    const korrigiert = ERKANNT.replace("V3", "V8");
    const raw = `Mein Text.\n\n${ocrAbschnittKopf("aushang.png")}\n${korrigiert}`;
    expect(interviewKontext(raw)).toBe(`[aushang.png]\n${korrigiert}`);
  });

  it("K3 · erst das Entfernen schließt aus: Kopf gelöscht oder Inhalt geleert", () => {
    expect(interviewKontext(`Mein Text.\n\n${ERKANNT}`)).toBe("");
    expect(interviewKontext(`Mein Text.\n\n${ocrAbschnittKopf("aushang.png")}\n   \n`)).toBe("");
  });

  it("K4 · Abschnitte enden an der nächsten Kopfzeile; der Bildname bleibt erhalten", () => {
    const raw = `${ocrAbschnittKopf("aushang.png")}\n${ERKANNT}\n\n[Transkript: band.mp3]\nGesprochen.`;
    expect(ocrAbschnitte(raw)).toEqual([{ name: "aushang.png", text: ERKANNT }]);
  });
});
