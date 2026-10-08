// ================================================================================================
// aufnahme:20260922:gesamt-negativwissen-erfassung — LERNEFFEKT GEFÜHRT UND VERTRAULICH ERFASSEN.
// ================================================================================================
//
// Gemessen an der ECHTEN App (`buildApp(buildServices())`, `app.inject`), nicht an einer Attrappe:
// die Aussagen betreffen den Weg vom Rumpf bis zum gespeicherten Wissensobjekt.
//
//   N1 (package:negativwissen / K4) Die Wissensart `negativwissen` wird gespeichert und ist filterbar.
//   N2 (R-2179, R-1664 / K1, K2)   Die geführten Angaben samt Warnsignalen reisen über POST /api/kos
//                                  in die gespeicherte Fassung — normalisiert, ohne Leerwerte.
//   N3 (R-2179 / K2)               Derselbe Fall über Entwurf sichern → Fortsetzen → Einreichen
//                                  (Promote) verliert keine Angabe.
//   N4 (R-2180 / K3)               Mit Personenbezug wird ein „intern" auf „vertraulich" angehoben;
//                                  eine strengere Wahl bleibt; ohne Bezug bleibt „intern".
//   N5 (R-2180 / K3)               Auch Administratoren können einen solchen Fall nicht unter
//                                  „vertraulich" setzen (403); Anheben bleibt erlaubt.
//   N6 (K1/K2, Gegenfall)          Bei jeder anderen Wissensart werden die Angaben verworfen.
import { describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";

async function setup() {
  const app = buildApp(buildServices());
  // Der erste Nutzer ist Administrator — damit misst N5 die härteste Rolle.
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
  return { app, headers: { authorization: `Bearer ${login.json().token}` } };
}

const FALL = {
  title: "Frostschaden an Pumpe P3",
  statement: "Pumpe P3 ist im Winter eingefroren, weil die Begleitheizung abgeschaltet war.",
  type: "negativwissen",
  category: "Pumpen",
} as const;

const ANGABEN = {
  incidentTrigger: "  Begleitheizung bei Wartung abgeschaltet  ",
  mistakePattern: "Annahme: Frost erst unter -5 °C kritisch.",
  impact: "Zwei Tage Stillstand.",
  recoveryAction: "Pumpe getauscht, Heizung wieder eingeschaltet.",
  avoidanceRule: "Begleitheizung nie ohne Freigabe abschalten.",
  earlyWarningSigns: ["Druckabfall am Morgen", "", "Druckabfall am Morgen", "Eis an der Leitung"],
  bezug: ["produktion"],
};

type Ko = Record<string, unknown> & {
  id: string;
  confidentiality?: string;
  negativwissen?: Record<string, unknown>;
};

describe("Negativwissen geführt und vertraulich erfassen", () => {
  it("N1 — die Wissensart negativwissen wird gespeichert und ist filterbar", async () => {
    const { app, headers } = await setup();
    const res = await app.inject({
      method: "POST",
      url: "/api/kos",
      headers,
      payload: { ...FALL, confidentiality: "vertraulich" },
    });
    expect(res.statusCode, res.body).toBe(201);
    const id = (res.json() as Ko).id;
    const detail = await app.inject({ method: "GET", url: `/api/kos/${id}`, headers });
    expect((detail.json() as Ko).type).toBe("negativwissen");
    const liste = await app.inject({ method: "GET", url: "/api/kos?type=negativwissen", headers });
    expect(liste.statusCode).toBe(200);
    expect((liste.json() as Ko[]).map((k) => k.id)).toContain(id);
  });

  it("N2 — die geführten Angaben samt Warnsignalen werden normalisiert gespeichert", async () => {
    const { app, headers } = await setup();
    const res = await app.inject({
      method: "POST",
      url: "/api/kos",
      headers,
      payload: { ...FALL, confidentiality: "vertraulich", negativwissen: ANGABEN },
    });
    expect(res.statusCode, res.body).toBe(201);
    const detail = await app.inject({
      method: "GET",
      url: `/api/kos/${(res.json() as Ko).id}`,
      headers,
    });
    expect((detail.json() as Ko).negativwissen).toEqual({
      incidentTrigger: "Begleitheizung bei Wartung abgeschaltet",
      mistakePattern: "Annahme: Frost erst unter -5 °C kritisch.",
      impact: "Zwei Tage Stillstand.",
      recoveryAction: "Pumpe getauscht, Heizung wieder eingeschaltet.",
      avoidanceRule: "Begleitheizung nie ohne Freigabe abschalten.",
      earlyWarningSigns: ["Druckabfall am Morgen", "Eis an der Leitung"],
      bezug: ["produktion"],
    });
  });

  it("N3 — Entwurf sichern, fortsetzen und einreichen verliert keine Angabe", async () => {
    const { app, headers } = await setup();
    const angelegt = await app.inject({
      method: "POST",
      url: "/api/drafts",
      headers,
      payload: { ...FALL, negativwissen: { ...ANGABEN, bezug: [] } },
    });
    expect(angelegt.statusCode, angelegt.body).toBeLessThan(300);
    const draftId = (angelegt.json() as { id: string }).id;
    // Fortsetzen: Bezug nachtragen und Stufe wählen — der Bezug hebt beim Einreichen an.
    const fortgesetzt = await app.inject({
      method: "PUT",
      url: `/api/drafts/${draftId}`,
      headers,
      payload: { confidentiality: "intern", negativwissen: { ...ANGABEN, bezug: ["personen"] } },
    });
    expect(fortgesetzt.statusCode, fortgesetzt.body).toBe(200);
    const geladen = await app.inject({ method: "GET", url: `/api/drafts/${draftId}`, headers });
    const payload = (geladen.json() as { payload: { negativwissen?: Record<string, unknown> } })
      .payload;
    expect(payload.negativwissen?.earlyWarningSigns).toEqual([
      "Druckabfall am Morgen",
      "Eis an der Leitung",
    ]);
    expect(payload.negativwissen?.bezug).toEqual(["personen"]);

    const eingereicht = await app.inject({
      method: "POST",
      url: `/api/drafts/${draftId}/promote`,
      headers,
      payload: { operationId: "negativwissen-n3-0001" },
    });
    expect(eingereicht.statusCode, eingereicht.body).toBe(201);
    const ko = eingereicht.json() as Ko;
    expect(ko.type).toBe("negativwissen");
    expect(ko.negativwissen?.avoidanceRule).toBe("Begleitheizung nie ohne Freigabe abschalten.");
    expect(ko.negativwissen?.bezug).toEqual(["personen"]);
    // R-2180: der Personenbezug hat das gewählte „intern" auf „vertraulich" angehoben.
    expect(ko.confidentiality).toBe("vertraulich");
  });

  it("N4 — Personenbezug hebt auf mindestens vertraulich an; strengere Wahl bleibt; ohne Bezug unverändert", async () => {
    const { app, headers } = await setup();
    const anlegen = async (confidentiality: string, bezug: string[]) => {
      const res = await app.inject({
        method: "POST",
        url: "/api/kos",
        headers,
        payload: { ...FALL, confidentiality, negativwissen: { ...ANGABEN, bezug } },
      });
      expect(res.statusCode, res.body).toBe(201);
      return res.json() as Ko;
    };
    expect((await anlegen("intern", ["personen"])).confidentiality).toBe("vertraulich");
    expect((await anlegen("intern", ["kunden"])).confidentiality).toBe("vertraulich");
    expect((await anlegen("streng_vertraulich", ["personen"])).confidentiality).toBe(
      "streng_vertraulich",
    );
    expect((await anlegen("intern", [])).confidentiality).toBe("intern");
  });

  it("N5 — auch ein Administrator setzt einen Fall mit Bezug nicht unter vertraulich", async () => {
    const { app, headers } = await setup();
    const res = await app.inject({
      method: "POST",
      url: "/api/kos",
      headers,
      payload: {
        ...FALL,
        confidentiality: "vertraulich",
        negativwissen: { ...ANGABEN, bezug: ["personen"] },
      },
    });
    const id = (res.json() as Ko).id;
    const senken = await app.inject({
      method: "PUT",
      url: `/api/kos/${id}`,
      headers,
      payload: { action: "confidentiality", level: "intern" },
    });
    expect(senken.statusCode, senken.body).toBe(403);
    const nachher = await app.inject({ method: "GET", url: `/api/kos/${id}`, headers });
    expect((nachher.json() as Ko).confidentiality).toBe("vertraulich");
    const anheben = await app.inject({
      method: "PUT",
      url: `/api/kos/${id}`,
      headers,
      payload: { action: "confidentiality", level: "streng_vertraulich" },
    });
    expect(anheben.statusCode, anheben.body).toBe(200);
    expect((anheben.json() as Ko).confidentiality).toBe("streng_vertraulich");
  });

  it("N6 — bei einer anderen Wissensart werden die Angaben verworfen und die Stufe bleibt", async () => {
    const { app, headers } = await setup();
    const res = await app.inject({
      method: "POST",
      url: "/api/kos",
      headers,
      payload: {
        ...FALL,
        type: "best_practice",
        confidentiality: "intern",
        negativwissen: { ...ANGABEN, bezug: ["personen"] },
      },
    });
    expect(res.statusCode, res.body).toBe(201);
    const ko = res.json() as Ko;
    expect(ko.negativwissen).toBeUndefined();
    expect(ko.confidentiality).toBe("intern");
  });
});
