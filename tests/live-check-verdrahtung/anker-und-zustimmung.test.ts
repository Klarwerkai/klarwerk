// ==================================================================================================
// JOB 3556 R3 · DER ANKER UND DIE ZUSTIMMUNG — die zwei Löcher, die BEN in Runde 2 gemessen hat.
// ==================================================================================================
// BEN, Befund 5: „Derselbe Text bleibt mit dem korrekten vertraulichen Entwurfsanker gesperrt,
// erreicht aber nach Weglassen oder Ersetzen durch eine unbekannte Kennung den Judge." Ein Backstop,
// den man durch Weglassen eines Feldes umgeht, ist keiner.
// BEN, Befund 4: die Route führte `dokumentZustimmung` fest als `false` — Lieferung 3 war damit
// weder erfüllt noch messbar.
//
// Gemessen wird an der ECHTEN Route mit dem ECHTEN Konflikt-Kern; gestellt sind nur Auth, Bestand,
// Entwurfsablage und der Judge-Spion. Die tragende Zeile ist überall `judgeConflict` — nicht ein
// Statuswort und nicht ein Feld in der Nutzlast: es geht um den Egress des Freitexts.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DRAFT, KLARA_BINDUNG, appWith, conflictVerdict } from "./fixture";

type Ablage = Map<string, { payload: { confidentiality?: unknown } }>;

let ablage: Ablage;
let server: Awaited<ReturnType<typeof appWith>>;

async function starte(opts: { ka4?: { erlaubt: boolean } } = {}): Promise<void> {
  server = await appWith({
    active: true,
    verdict: conflictVerdict,
    capture: { getDraft: async (id: string) => ablage.get(id) },
    ...(opts.ka4 ? { ka4: opts.ka4 } : {}),
  });
}

async function frage(
  nutzlast: Record<string, unknown>,
  headers: Record<string, string> = {},
): Promise<{ status: string; judge: number }> {
  const antwort = await server.app.inject({
    method: "POST",
    url: "/api/knowledge/check",
    payload: nutzlast,
    headers,
  });
  expect(antwort.statusCode).toBe(200);
  return { status: antwort.json().status, judge: server.judgeConflict.mock.calls.length };
}

beforeEach(() => {
  ablage = new Map([
    ["d-intern", { payload: { confidentiality: "intern" } }],
    ["d-vertraulich", { payload: { confidentiality: "vertraulich" } }],
    ["d-ohne", { payload: {} }],
  ]);
});
afterEach(async () => {
  await server.app.close();
});

// --------------------------------------------------------------------------------------------
// K1 · OHNE AUFLÖSBAREN ANKER GILT „draft" ALS VERTRAULICH.
// --------------------------------------------------------------------------------------------
describe("K1 · Ankersperre (BEN-Korrekturpflicht 1)", () => {
  it("K1a · dieselbe Deklaration OHNE Kennung erreicht den Judge NICHT", async () => {
    await starte();
    // Genau die Nutzlast, mit der BEN in Runde 2 an der Sperre vorbeikam.
    expect(await frage({ text: DRAFT, source: "draft", confidentiality: "intern" })).toEqual({
      status: "pending",
      judge: 0,
    });
  });

  it("K1b · eine UNBEKANNTE Entwurfskennung erreicht den Judge NICHT", async () => {
    await starte();
    expect(
      await frage({
        text: DRAFT,
        source: "draft",
        confidentiality: "intern",
        draftId: "gibt-es-nicht",
      }),
    ).toEqual({ status: "pending", judge: 0 });
  });

  it("K1c · POSITIVE KONTROLLE: der aufgelöste interne Entwurf wird geprüft", async () => {
    await starte();
    // Ohne diesen Fall wäre die Sperre eine Abschaltung: alles rot zu färben ist keine Sicherheit.
    expect(
      await frage({ text: DRAFT, source: "draft", confidentiality: "intern", draftId: "d-intern" }),
    ).toEqual({ status: "done", judge: 1 });
  });

  it("K1d · der KO-Anker bleibt gültig (KnowledgeDetail-Editor, unverändert)", async () => {
    await starte();
    expect(
      await frage({ text: DRAFT, source: "draft", confidentiality: "intern", koId: "kc" }),
    ).toEqual({ status: "done", judge: 1 });
  });

  it("K1e · der aufgelöste VERTRAULICHE Entwurf hebt weiter (Deklaration 'intern' hilft nicht)", async () => {
    await starte();
    expect(
      await frage({
        text: DRAFT,
        source: "draft",
        confidentiality: "intern",
        draftId: "d-vertraulich",
      }),
    ).toEqual({ status: "pending", judge: 0 });
  });

  it("K1f · ein aufgelöster Entwurf OHNE gespeicherte Stufe lässt die Deklaration gelten", async () => {
    await starte();
    // JOB 2692 D1, Fall A5, hier unverändert: ein Anker, der auflöst, aber keine Stufe trägt, hebt
    // nichts — er ist ein Anker, kein Freibrief und keine zweite Sperre.
    expect(
      await frage({ text: DRAFT, source: "draft", confidentiality: "intern", draftId: "d-ohne" }),
    ).toEqual({ status: "done", judge: 1 });
  });

  it("K1g · der Upload-Weg (`transient-document`) bleibt unberührt", async () => {
    await starte();
    // Ein Upload ist neuer Inhalt und hat naturgemäß keinen gespeicherten Entwurf; die neue Regel
    // gilt ausdrücklich nur für `source:"draft"` (dieselbe Grenze wie `reasoner-routes.ts:321`).
    expect(
      await frage({ text: DRAFT, source: "transient-document", confidentiality: "intern" }),
    ).toEqual({ status: "done", judge: 1 });
  });
});

// --------------------------------------------------------------------------------------------
// K3 · DIE DOKUMENTZUSTIMMUNG LÄUFT ÜBER DEN BESTEHENDEN RIEGEL (Lieferung 3).
// --------------------------------------------------------------------------------------------
describe("K3 · Dokumentzustimmung (BEN-Korrekturpflicht 3)", () => {
  // Nicht eingestufter Text, wie ihn `draftProvenance(undefined)` bildet: „vertraulich" plus die
  // ehrliche Beifügung, dass niemand eingestuft hat. NUR eine bestätigte Einwilligung darf daraus
  // serverseitig einen prüfbaren Text machen — genau das misst K3b.
  const NICHT_EINGESTUFT = {
    text: DRAFT,
    source: "draft",
    confidentiality: "vertraulich",
    nichtEingestuft: true,
    draftId: "d-intern",
  };

  it("K3a · POSITIVER BELEG: mit bestätigter Einwilligung läuft die Prüfung", async () => {
    await starte({ ka4: { erlaubt: true } });
    expect(await frage(NICHT_EINGESTUFT, KLARA_BINDUNG)).toEqual({ status: "done", judge: 1 });
    // Und sie kam aus dem echten Riegel, nicht aus einem Vorgabewert: der Prüfer wurde mit der
    // Bindung dieser Anfrage befragt.
    expect(server.pruefeExterneAusfuehrung).toHaveBeenCalledWith("s-1", {
      actorId: "u1",
      addinInstanceId: "i-1",
      documentContextId: "d-1",
    });
  });

  it("K3b · NEGATIVE KONTROLLE: dieselbe Anfrage ohne Einwilligung wird nicht geprüft", async () => {
    await starte({ ka4: { erlaubt: false } });
    expect(await frage(NICHT_EINGESTUFT, KLARA_BINDUNG)).toEqual({ status: "pending", judge: 0 });
    expect(server.pruefeExterneAusfuehrung).toHaveBeenCalled();
  });

  it("K3c · eine gebundene Anfrage OHNE Einwilligung ist auch als 'intern' gesperrt", async () => {
    await starte({ ka4: { erlaubt: false } });
    // Der Riegel wirkt wie eine fehlende Zustimmung zu DIESEM Text (`reasoner-routes.ts:324`) —
    // eine gültige Deklaration hebt ihn nicht auf.
    expect(
      await frage(
        { text: DRAFT, source: "draft", confidentiality: "intern", draftId: "d-intern" },
        KLARA_BINDUNG,
      ),
    ).toEqual({ status: "pending", judge: 0 });
  });

  it("K3d · die Einwilligung hebt den Backstop NICHT auf", async () => {
    await starte({ ka4: { erlaubt: true } });
    expect(
      await frage(
        {
          text: DRAFT,
          source: "draft",
          confidentiality: "vertraulich",
          nichtEingestuft: true,
          draftId: "d-vertraulich",
        },
        KLARA_BINDUNG,
      ),
    ).toEqual({ status: "pending", judge: 0 });
  });

  it("K3e · der Browser-Editor ist ungebunden: kein Riegel, keine Zustimmung, unverändert", async () => {
    await starte({ ka4: { erlaubt: true } });
    // Ohne Klara-Kopfzeilen wird der Prüfer gar nicht erst gefragt — eine Einwilligung, die für ein
    // Word-Dokument erteilt wurde, gilt nicht für ein Blatt im Browser.
    expect(await frage(NICHT_EINGESTUFT)).toEqual({ status: "pending", judge: 0 });
    expect(server.pruefeExterneAusfuehrung).not.toHaveBeenCalled();
  });
});
