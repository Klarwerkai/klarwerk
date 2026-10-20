import { expect } from "vitest";
import type { buildApp } from "../../services/app/src/build-app";
import type { KlaraAuftrag } from "../../services/app/src/klara-auftrag";

export type App = ReturnType<typeof buildApp>;
export function draht(app: App, token: string) {
  return (method: "GET" | "POST" | "PUT" | "DELETE", url: string, payload?: unknown) =>
    app.inject({
      method,
      url,
      headers: { authorization: `Bearer ${token}` },
      ...(payload === undefined ? {} : { payload: payload as Record<string, unknown> }),
    });
}
export async function anmelden(app: App, email = "g-fiktiv@example.test") {
  const r = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email, password: "fiktiver-g-test-2026" },
  });
  expect(r.statusCode, r.body).toBe(200);
  return r.json().token as string;
}
export async function registrieren(app: App) {
  const r = await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "G Fiktiv", email: "g-fiktiv@example.test", password: "fiktiver-g-test-2026" },
  });
  expect(r.statusCode, r.body).toBe(201);
  return anmelden(app);
}
export async function vorgang(app: App, token: string, quelle = "getippt") {
  const auf = draht(app, token);
  const g = await auf("POST", "/api/me/klara/gespraeche", {
    objektbezug: { pfad: "/fragen", seitenName: "Fragen", objekt: "Fiktiver G-Test" },
  });
  expect(g.statusCode, g.body).toBe(201);
  const gid = g.json().gespraech.id as string;
  const basis = `/api/me/klara/gespraeche/${gid}/auftraege`;
  const ziele = ["Anforderung G", "Anfrage G", "Vergleich G"].map((titel) => ({
    art: "neuer_entwurf",
    id: null,
    titel,
    stand: null,
    pfad: null,
  }));
  const r = await auf("POST", basis, {
    quelle,
    wortlaut: "Lege drei interne Entwürfe an",
    ziel: "Fiktives Produkt G intern vorbereiten",
    erlaubteAktionen: ["entwurf_erstellen"],
    erlaubteZiele: ziele,
    erlaubteQuellen: ["Ausdrücklicher eigener Auftrag"],
    ergebnis: "Drei interne Entwürfe, kein Versand und kein Kauf",
    geplanteSchritte: 3,
    plan: ziele.map((ziel) => ({
      aktion: "entwurf_erstellen",
      ziel,
      ausSchritt: null,
      inhalt: "Fiktiver Inhalt; keine Außenaktion.",
    })),
  });
  expect(r.statusCode, r.body).toBe(201);
  const a = r.json().auftrag as KlaraAuftrag;
  const pfad = `${basis}/${a.id}`;
  const aus = async (nr: number, fassung = 1, key = `g-${nr}`) =>
    auf("POST", `${pfad}/schritte/${key}/ausfuehrung`, { nr, auftragFassung: fassung });
  const lese = async () => {
    const r = await auf("GET", basis);
    expect(r.statusCode).toBe(200);
    return r.json().auftraege.find((x: KlaraAuftrag) => x.id === a.id) as KlaraAuftrag;
  };
  return { gid, basis, a, pfad, aus, lese, ziele };
}
