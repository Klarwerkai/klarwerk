// ================================================================================================
// aufnahme:20260922:gesamt-sprachfeedback · R-1649 — „Das war nicht hilfreich, ich habe es so
// gemacht …": Negativ-Bewährung registrieren, abweichenden Weg als Wissens-Entwurf aufnehmen.
// ================================================================================================
//
// Am echten Draht (vollständige App, Bühne der Rollenabnahme): POST /api/ask/not-helpful nach einer
// echten Antwort. Gelesen wird danach, was wirklich entstand — der Audit-Beleg `answer.not_helpful`
// mit Verweis auf den Entwurf, und der Entwurf selbst mit dem Weg in den Worten des Bedieners.
import { afterEach, describe, expect, it } from "vitest";
import {
  type FrischeBuehne,
  type Rolle,
  baueFrischeBuehne,
  schliesseBuehnen,
} from "../beta-rollenabnahme/buehne";

afterEach(async () => {
  await schliesseBuehnen();
});

const KO_INHALT = {
  title: "Dichtungswechsel L4",
  statement: "Dichtung vor jedem Anlauf prüfen.",
  type: "best_practice",
  category: "Instandhaltung",
  bodyHtml: "<p>Dichtung nach 500 h tauschen.</p>",
  confidentiality: "intern",
} as const;

const PASSENDE_FRAGE = "Dichtung vor dem Anlauf prüfen";
const WEG = "Ich tausche die Dichtung schon nach 300 h, weil sie bei L4 früher reißt.";

function kopf(b: FrischeBuehne, rolle: Rolle): Record<string, string> {
  return { authorization: `Bearer ${b.sitzung[rolle]}` };
}

async function frage(b: FrischeBuehne, rolle: Rolle): Promise<{ koId: string; receipt: string }> {
  const res = await b.app.inject({
    method: "POST",
    url: "/api/ask",
    headers: kopf(b, rolle),
    payload: { question: PASSENDE_FRAGE },
  });
  expect(res.statusCode, res.body).toBe(200);
  const antwort = res.json() as { receipt?: string; result?: { sources?: string[] } };
  const koId = antwort.result?.sources?.[0];
  if (typeof antwort.receipt !== "string" || typeof koId !== "string") {
    throw new Error(`keine Antwort mit Quelle: ${res.body.slice(0, 300)}`);
  }
  return { koId, receipt: antwort.receipt };
}

// Die Fragenseite antwortet nur aus GEPRÜFTEM Wissen (R-0584). Ein bloß angelegtes Objekt bleibt
// ohne Modell ungeprüft (KI-Prüfung `no-model`), und die Frage endet in einer Wissenslücke — gemessen
// in Nacharbeit 2. Deshalb wie im Betrieb: der Experte legt an, der Admin gibt frei.
async function aufbau(): Promise<{ b: FrischeBuehne; koId: string }> {
  const b = await baueFrischeBuehne();
  const res = await b.app.inject({
    method: "POST",
    url: "/api/kos",
    headers: kopf(b, "experte"),
    payload: { ...KO_INHALT },
  });
  expect(res.statusCode, res.body).toBe(201);
  const koId = (res.json() as { id: string }).id;
  const freigabe = await b.app.inject({
    method: "PUT",
    url: `/api/kos/${koId}`,
    headers: kopf(b, "admin"),
    payload: { action: "admin-validate" },
  });
  expect(freigabe.statusCode, freigabe.body).toBeLessThan(300);
  return { b, koId };
}

function melde(b: FrischeBuehne, rolle: Rolle, payload: Record<string, unknown>) {
  return b.app.inject({
    method: "POST",
    url: "/api/ask/not-helpful",
    headers: kopf(b, rolle),
    payload,
  });
}

describe("R-1649 · nicht hilfreich + abweichender Weg als Entwurf (HTTP)", () => {
  it("Experte: Vermerk an der tragenden Quelle, Weg wird Entwurf, Beleg verweist auf ihn", async () => {
    const { b, koId } = await aufbau();
    const { koId: quelle, receipt } = await frage(b, "experte");
    expect(quelle).toBe(koId);
    const vertrauenVorher = (await b.services.ko.get(koId))?.trust;

    const res = await melde(b, "experte", {
      koId,
      receipt,
      alternative: WEG,
      entwurfTitel: "Abweichender Weg zu „Dichtungswechsel L4“",
    });
    expect(res.statusCode, res.body).toBe(200);
    const { vermerkt, entwurfId } = res.json() as { vermerkt: boolean; entwurfId: string | null };
    expect(vermerkt).toBe(true);
    expect(typeof entwurfId).toBe("string");

    // Der Entwurf gehört dem Bediener und trägt seinen Weg wörtlich.
    const entwurf = await b.services.capture.getDraft(entwurfId as string);
    expect(entwurf?.originalAuthor).toBe(b.konto.experte.id);
    expect(entwurf?.payload.statement).toBe(WEG);
    expect(entwurf?.payload.title).toBe("Abweichender Weg zu „Dichtungswechsel L4“");

    // Die Negativ-Bewährung ist registriert: wer, welches Objekt, welcher Entwurf.
    const belege = await b.services.audit.list({ action: "answer.not_helpful" });
    expect(belege).toHaveLength(1);
    expect(belege[0]?.actor).toBe(b.konto.experte.id);
    expect(belege[0]?.target).toBe(koId);
    expect(belege[0]?.payload).toMatchObject({ koTitle: KO_INHALT.title, entwurfId });

    // Keine Prüfstimme und kein Trust-Abzug — registriert, nicht vollzogen.
    expect((await b.services.ko.get(koId))?.trust).toBe(vertrauenVorher);
    // Und kein „Hat geholfen" nebenbei.
    expect(await b.services.audit.list({ action: "answer.helpful" })).toEqual([]);
  });

  it("zweite Meldung derselben Person: kein zweiter Beleg, der neue Weg geht nicht verloren", async () => {
    const { b, koId } = await aufbau();
    const { receipt } = await frage(b, "experte");
    expect((await melde(b, "experte", { koId, receipt })).json()).toEqual({
      vermerkt: true,
      entwurfId: null,
    });
    const zweite = await melde(b, "experte", { koId, receipt, alternative: WEG });
    expect(zweite.statusCode, zweite.body).toBe(200);
    const antwort = zweite.json() as { vermerkt: boolean; entwurfId: string | null };
    expect(antwort.vermerkt).toBe(false);
    expect(typeof antwort.entwurfId).toBe("string");
    expect(await b.services.audit.list({ action: "answer.not_helpful" })).toHaveLength(1);
  });

  it("Leser ohne ko.create: Vermerk ja, Weg als Entwurf → 403 und NICHTS geschrieben", async () => {
    const { b, koId } = await aufbau();
    const { receipt } = await frage(b, "viewer");
    const verweigert = await melde(b, "viewer", { koId, receipt, alternative: WEG });
    expect(verweigert.statusCode, verweigert.body).toBe(403);
    expect(await b.services.audit.list({ action: "answer.not_helpful" })).toEqual([]);

    const nurVermerk = await melde(b, "viewer", { koId, receipt });
    expect(nurVermerk.statusCode, nurVermerk.body).toBe(200);
    expect(nurVermerk.json()).toEqual({ vermerkt: true, entwurfId: null });
  });

  it("ohne gültigen Beleg: 403, kein Vermerk und kein Entwurf", async () => {
    const { b, koId } = await aufbau();
    const fremd = await frage(b, "controller");
    const entwuerfeVorher = (await b.services.capture.listDraftsForResume(undefined)).length;
    // (a) gar kein Beleg, (b) der Beleg einer anderen Person
    for (const receipt of ["", fremd.receipt]) {
      const res = await melde(b, "experte", { koId, receipt, alternative: WEG });
      expect(res.statusCode, res.body).toBe(403);
    }
    expect(await b.services.audit.list({ action: "answer.not_helpful" })).toEqual([]);
    expect((await b.services.capture.listDraftsForResume(undefined)).length).toBe(entwuerfeVorher);
  });

  it("Gestalt erst nach dem Tor: anonym 401, angemeldet mit kaputtem Rumpf 400", async () => {
    const { b } = await aufbau();
    const anonym = await b.app.inject({
      method: "POST",
      url: "/api/ask/not-helpful",
      payload: { koId: 5 },
    });
    expect(anonym.statusCode).toBe(401);
    const kaputt = await melde(b, "experte", { koId: 5 });
    expect(kaputt.statusCode).toBe(400);
  });
});
