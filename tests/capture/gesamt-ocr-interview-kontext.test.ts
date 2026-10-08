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
//   K1–K3  der Client schickt die erkannten Abschnitte des Rohtextes in ihrer AKTUELLEN Fassung —
//          auch korrigiert, und erst nach dem Entfernen nicht mehr (Nacharbeit 3).
//   K4–K7  eindeutige Grenzen und gesicherte Abschnitte (Nacharbeit 4).
//   E1–E3  der Entwurfsdienst sichert die Abschnitte als eigenes Feld (strukturierte Entwürfe).
//          Das Fortsetzen belegen die gemounteten Tests I4 (unstrukturiert) und I5 (strukturiert).
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  gesicherteOhneRohtext,
  interviewKontext,
  ocrAbschnittKopf,
  ocrAbschnittText,
  ocrAbschnitte,
  ocrAbschnitteFuerEntwurf,
} from "../../apps/web/src/lib/interviewKontext";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import { InMemoryDraftRepo } from "../../services/capture/src/repo";
import { CaptureService } from "../../services/capture/src/service";
import type { DraftPayload } from "../../services/capture/src/types";
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
      ocrAbschnittText("aushang.png", ERKANNT),
      "Danach getippt, nicht erkannt.",
      "",
      "[Handbuch.pdf]\nText aus einem Dokument, kein Bild.",
      "",
      ocrAbschnittText("notiz.jpg", "Zweiter erkannter Block."),
    ].join("\n");
    expect(interviewKontext(raw)).toBe(
      `[aushang.png]\n${ERKANNT}\n\n[notiz.jpg]\nZweiter erkannter Block.`,
    );
    expect(interviewKontext("Nur eigener Text.")).toBe("");
    expect(interviewKontext("")).toBe("");
  });

  it("K2 · eine Korrektur im erkannten Block aktualisiert den Kontext", () => {
    const korrigiert = ERKANNT.replace("V3", "V8");
    const raw = `Mein Text.\n\n${ocrAbschnittText("aushang.png", korrigiert)}`;
    expect(interviewKontext(raw)).toBe(`[aushang.png]\n${korrigiert}`);
  });

  it("K3 · erst das Entfernen schließt aus: Kopf gelöscht oder Inhalt geleert", () => {
    const ohneKopf = `Mein Text.\n\n${ERKANNT}\n[/OCR]`;
    expect(interviewKontext(ohneKopf)).toBe("");
    expect(interviewKontext(`Mein Text.\n\n${ocrAbschnittText("aushang.png", "   ")}`)).toBe("");
  });

  it("K4 · Bens Befund (Nacharbeit 4): Klammern im Bildnamen — Schreiben und Lesen passen", () => {
    for (const name of ["aushang[1].png", "[scan] seite 2.jpg", "a]b.png", "foto (2).heic"]) {
      const raw = ocrAbschnittText(name, ERKANNT);
      expect(ocrAbschnitte(raw), name).toEqual([{ name, text: ERKANNT }]);
    }
  });

  it("K5 · Bens Befund (Nacharbeit 4): Klammerzeilen im erkannten Text schneiden nichts ab", () => {
    const erkannt = [
      "Aushang Halle 3",
      "[Hinweis]",
      "Nur mit Schutzbrille.",
      "[/OCR]",
      "[OCR: kein Kopf]",
      "[Transkript: auch kein Kopf]",
      "Letzte Zeile.",
    ].join("\n");
    const raw = `${ocrAbschnittText("aushang.png", erkannt)}\n\nDanach.`;
    expect(ocrAbschnitte(raw)).toEqual([{ name: "aushang.png", text: erkannt }]);
  });

  it("K6 · Endzeile gelöscht: der Abschnitt reicht bis zum nächsten OCR-Kopf oder Textende", () => {
    const raw = [
      ocrAbschnittKopf("aushang.png"),
      ERKANNT,
      "[Hinweis]",
      ocrAbschnittText("notiz.jpg", "Zweiter."),
    ].join("\n");
    expect(ocrAbschnitte(raw)).toEqual([
      { name: "aushang.png", text: `${ERKANNT}\n[Hinweis]` },
      { name: "notiz.jpg", text: "Zweiter." },
    ]);
  });

  it("K7 · gesicherte Abschnitte (strukturierter Entwurf) sind Kontext; Doppeltes kommt nicht zweimal", () => {
    const gesichert = [{ name: "aushang.png", text: ERKANNT }];
    expect(interviewKontext("", gesichert)).toBe(`[aushang.png]\n${ERKANNT}`);
    expect(ocrAbschnitteFuerEntwurf(gesichert, "")).toEqual(gesichert);
    const rohtextMitDemselben = ocrAbschnittText("aushang.png", ERKANNT);
    expect(gesicherteOhneRohtext(gesichert, rohtextMitDemselben)).toEqual([]);
    expect(gesicherteOhneRohtext(gesichert, "Anderer Rohtext.")).toEqual(gesichert);
  });
});

describe("gesamt-ocr · Nacharbeit 4 · der Entwurfsdienst sichert die erkannten Abschnitte", () => {
  it("E1 · angelegt und gelesen: Abschnitte bleiben, Kaputtes und Leeres fällt weg", async () => {
    const svc = new CaptureService({ repo: new InMemoryDraftRepo() });
    const d = await svc.createDraft(
      {
        title: "T",
        statement: "Verdichtete Aussage.",
        ocrAbschnitte: [
          { name: "aushang[1].png", text: ERKANNT },
          { name: "leer.png", text: "   " },
          "kaputt",
          { name: 7, text: "Ohne gültigen Namen." },
        ],
      } as unknown as DraftPayload,
      "anna",
    );
    expect(d.payload.ocrAbschnitte).toEqual([
      { name: "aushang[1].png", text: ERKANNT },
      { name: "", text: "Ohne gültigen Namen." },
    ]);
    const gelesen = await svc.listDrafts();
    expect(gelesen[0]?.payload.ocrAbschnitte?.[0]?.text).toBe(ERKANNT);
  });

  it("E2 · beim Aktualisieren: weggelassen bleibt, leere Liste löscht", async () => {
    const svc = new CaptureService({ repo: new InMemoryDraftRepo() });
    const d = await svc.createDraft(
      { title: "T", ocrAbschnitte: [{ name: "aushang.png", text: ERKANNT }] },
      "anna",
    );
    const behalten = await svc.continueDraft(d.id, { title: "T2" }, "anna");
    expect(behalten.payload.ocrAbschnitte).toEqual([{ name: "aushang.png", text: ERKANNT }]);
    const geleert = await svc.continueDraft(d.id, { ocrAbschnitte: [] }, "anna");
    expect(geleert.payload.ocrAbschnitte).toBeUndefined();
  });

  it("E3 · Deckel: höchstens 20 Abschnitte, je höchstens 20.000 Zeichen Text", async () => {
    const svc = new CaptureService({ repo: new InMemoryDraftRepo() });
    const viele = Array.from({ length: 25 }, (_, i) => ({
      name: `b${i}.png`,
      text: "x".repeat(25_000),
    }));
    const d = await svc.createDraft({ title: "T", ocrAbschnitte: viele }, "anna");
    expect(d.payload.ocrAbschnitte).toHaveLength(20);
    expect(d.payload.ocrAbschnitte?.[0]?.text).toHaveLength(20_000);
  });
});
