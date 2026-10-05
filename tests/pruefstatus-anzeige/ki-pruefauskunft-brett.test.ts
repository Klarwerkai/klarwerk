// ================================================================================================
// PRÜFSTATUS-ANZEIGE (R-0208) · DAS PRÜFBRETT LEITET „LÄUFT" UND „KONFLIKT GEFUNDEN" AB.
// ================================================================================================
//
// Der gespeicherte KI-Prüfvermerk kennt nur pending/done/failed. `GET /api/validation/board` hängt
// zwei Leseauskünfte an — nie gespeichert:
//   · `laeuft` (nur pending): bearbeitet der Worker den Job gerade? Sonst ist er „ausstehend".
//   · `konfliktGefunden` (nur done): steht zu diesem Objekt als Subjekt ein offener, AUTOMATISCH
//     erkannter Konflikt? Ein von Hand gemeldeter zählt nicht — es geht um das Prüfergebnis.
// Scheitert die Konfliktabfrage, fehlt das Feld (weder ja noch nein).
//
// Echte App (`buildApp`) mit In-Memory-Bestand über `app.inject`: kein Netz, keine Datenbank.
import { describe, expect, it } from "vitest";
import type { AiCheckWorker } from "../../services/app/src/ai-check-worker";
import { buildApp, buildServices } from "../../services/app/src/build-app";

interface BrettZeile {
  id: string;
  aiCheck?: { status: string; laeuft?: boolean; konfliktGefunden?: boolean };
}

/** Ein Worker, der nichts ausführt — `laufend` bestimmt, was er auf `laeuft` antwortet. */
function stillerWorker(laufend: Set<string>): AiCheckWorker {
  return {
    enqueue: () => {},
    // `true`: das Brett soll den Job nicht neu einreihen — der Fall misst nur die Auskunft.
    has: () => true,
    laeuft: (koId) => laufend.has(koId),
    queuedCount: () => 0,
    idle: async () => {},
  };
}

async function aufbau(laufend = new Set<string>()) {
  const services = buildServices();
  services.aiCheckWorker = stillerWorker(laufend);
  const app = buildApp(services);
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Pedi", email: "p@x.de", password: "secret123" },
  });
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: "p@x.de", password: "secret123" },
  });
  const headers = { authorization: `Bearer ${login.json().token}` };
  const anlegen = async (title: string): Promise<string> => {
    const res = await app.inject({
      method: "POST",
      url: "/api/kos",
      headers,
      payload: {
        confidentiality: "intern",
        title,
        statement: `Aussage zu ${title}`,
        type: "best_practice",
        category: "K",
      },
    });
    expect(res.statusCode).toBe(201);
    return (res.json() as { id: string }).id;
  };
  const abschliessen = async (id: string): Promise<void> => {
    const ko = await services.ko.get(id);
    expect(ko?.aiCheck?.status).toBe("pending");
    expect(await services.ko.resolveAiCheck(id, { ok: true }, ko?.aiCheck?.koVersion)).toBe(true);
  };
  const brett = async (): Promise<BrettZeile[]> => {
    const res = await app.inject({ method: "GET", url: "/api/validation/board", headers });
    expect(res.statusCode).toBe(200);
    return res.json() as BrettZeile[];
  };
  const zeile = async (id: string): Promise<BrettZeile> => {
    const gefunden = (await brett()).find((z) => z.id === id);
    expect(gefunden, `Brettzeile ${id} fehlt`).toBeDefined();
    return gefunden as BrettZeile;
  };
  return { services, anlegen, abschliessen, zeile };
}

describe("R-0208 · Leseauskunft des Prüfbretts zum KI-Prüfvermerk", () => {
  it("pending: `laeuft` folgt dem Worker — eingereiht heißt ausstehend, bearbeitet heißt läuft", async () => {
    const laufend = new Set<string>();
    const { anlegen, zeile } = await aufbau(laufend);
    const id = await anlegen("Wartend");
    expect((await zeile(id)).aiCheck).toMatchObject({ status: "pending", laeuft: false });
    laufend.add(id);
    expect((await zeile(id)).aiCheck).toMatchObject({ status: "pending", laeuft: true });
  });

  it("done + offener AUTOMATISCHER Konflikt mit diesem Objekt als Subjekt → konfliktGefunden", async () => {
    const { services, anlegen, abschliessen, zeile } = await aufbau();
    const a = await anlegen("Subjekt");
    const b = await anlegen("Bestand");
    await abschliessen(a);
    await abschliessen(b);
    expect((await zeile(a)).aiCheck).toMatchObject({ status: "done", konfliktGefunden: false });
    await services.conflicts.createAuto(
      { koA: a, koB: b, type: "truth", description: "Widerspruch" },
      { trigger: "validation", method: "model", confidence: 0.9 },
    );
    expect((await zeile(a)).aiCheck).toMatchObject({ status: "done", konfliktGefunden: true });
    // Die Gegenseite ist nicht das Subjekt dieses Prüflaufs — ihr Kennzeichen bleibt „geprüft".
    expect((await zeile(b)).aiCheck).toMatchObject({ status: "done", konfliktGefunden: false });
  });

  it("Gegenprobe: ein von Hand gemeldeter Konflikt ist kein Prüfergebnis", async () => {
    const { services, anlegen, abschliessen, zeile } = await aufbau();
    const a = await anlegen("Subjekt");
    const b = await anlegen("Bestand");
    await abschliessen(a);
    await services.conflicts.create({ koA: a, koB: b, type: "truth", description: "Gemeldet" });
    expect((await zeile(a)).aiCheck).toMatchObject({ status: "done", konfliktGefunden: false });
  });

  it("scheitert die Konfliktabfrage, fehlt `konfliktGefunden` — weder ja noch nein", async () => {
    const { services, anlegen, abschliessen, zeile } = await aufbau();
    const a = await anlegen("Subjekt");
    await abschliessen(a);
    services.conflicts.unresolved = async () => {
      throw new Error("Konfliktablage nicht erreichbar");
    };
    const vermerk = (await zeile(a)).aiCheck;
    expect(vermerk?.status).toBe("done");
    expect(vermerk && "konfliktGefunden" in vermerk).toBe(false);
  });

  it("die Auskunft wird nicht gespeichert", async () => {
    const { services, anlegen, abschliessen, zeile } = await aufbau();
    const a = await anlegen("Subjekt");
    await abschliessen(a);
    await zeile(a);
    const gespeichert = await services.ko.get(a);
    expect(gespeichert?.aiCheck && "konfliktGefunden" in gespeichert.aiCheck).toBe(false);
    expect(gespeichert?.aiCheck && "laeuft" in gespeichert.aiCheck).toBe(false);
  });
});
