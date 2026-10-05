import { describe, expect, it } from "vitest";
import { befund, koAnlegen, welt } from "./welt";

// ================================================================================================
// JOB 3071 · §7.4 — WELCHE AUSSENKANTE TRÄGT DIE NEUE AUSKUNFT WIRKLICH NACH AUSSEN?
// ================================================================================================
//
// Die Nutzenkette dieses Auftrags endet an der API, nicht an der Oberfläche (die ist Scheibe 4).
// Also muss GEMESSEN sein, welche der beiden in Frage kommenden Kanten die Rücknahme ausliefert —
// behauptet ist sie sonst nur. Beide werden hier am gebauten Server abgerufen.
describe("JOB 3071 · §7.4: die gemessene Aussenkante der Rücknahme", () => {
  async function zurueckgezogeneLage() {
    const w = await welt();
    const a = await koAnlegen(w.app, w.autorin, "Ventil V3 zuerst", "Bei Überdruck V3 schließen.");
    const b = await koAnlegen(
      w.app,
      w.autorin,
      "Pumpe entlüften",
      "Die Pumpe alle 200 h entlüften.",
    );
    const eintrag = await befund(w.services, a, b);
    const del = await w.app.inject({
      method: "DELETE",
      url: `/api/kos/${a}`,
      headers: w.autorin.headers,
    });
    expect(del.statusCode).toBe(204);
    return { ...w, a, b, eintrag };
  }

  it("GET /api/audit trägt sie: eigene Action und die Kennung der Autorin", async () => {
    const { app, admin, autorin, eintrag, a } = await zurueckgezogeneLage();
    const res = await app.inject({
      method: "GET",
      url: "/api/audit?action=overlap.withdrawn-own",
      headers: admin.headers,
    });
    expect(res.statusCode).toBe(200);
    const eintraege = res.json() as { actor: string; target: string; payload?: unknown }[];
    const meiner = eintraege.filter((e) => e.target === eintrag.id);
    expect(meiner).toHaveLength(1);
    expect(meiner[0]?.actor).toBe(autorin.id);
    expect(meiner[0]?.payload).toMatchObject({ koId: a });
  });

  // GEMESSENER BEFUND AUS JOB 3071 (§7.4), SEIT DEM AUFTRAG GESAMT-DUBLETTEN-RÜCKZUG BEHOBEN (Q7,
  // R-1569 „bekannte 404-Grenze"): `GET /api/duplicates/:id` lieferte den geschlossenen Befund nach
  // dem Rückzug nicht mehr aus, weil `paarSichtbar` die zurückgezogene Seite im Papierkorb nicht
  // fand. Jetzt löst die Route für einen `withdrawn_own`-Abschluss die zurückgezogene Seite über
  // den Papierkorb auf (`paarSichtbarMitPapierkorb`) — dieselbe Regel `darfSehen`, nicht gelockert.
  // Ausgeliefert wird der Grabstein: Grund, Urheber, Zeit, sonst nichts (keine Kennungen der
  // Objekte, keine Zitate, kein Vermerk). Die Kante ist damit BENANNT geöffnet.
  it("GET /api/duplicates/:id trägt sie als Grabstein — Grund, Urheber, Zeit, sonst nichts", async () => {
    const { app, admin, autorin, eintrag, services } = await zurueckgezogeneLage();
    const res = await app.inject({
      method: "GET",
      url: `/api/duplicates/${eintrag.id}`,
      headers: admin.headers,
    });
    expect(res.statusCode).toBe(200);
    const gespeichert = await services.overlaps.get(eintrag.id);
    expect(res.json()).toEqual({
      id: eintrag.id,
      status: "geschlossen",
      resolution: { reason: "withdrawn_own", by: autorin.id, at: gespeichert?.resolution?.at },
    });
  });

  // DIE LISTE BLEIBT UNVERÄNDERT: sie trägt den neuen Grund nicht — sie
  // liefert ausschliesslich OFFENE Befunde (`overlaps.unresolved()`, overlap-routes.ts:54), und ein
  // zurückgezogener ist geschlossen. Die Detailkante oben ist geöffnet, hat in apps/web aber
  // keinen Leser (`endpoints.duplicates.get` wird von keiner Fläche gerufen) — `withdrawn_own`
  // erreicht die Oberfläche also weiterhin nicht, ihr fehlender Übersetzungsschlüssel ist
  // unerreichbar, nicht kaputt. Öffnet jemand die Liste für Geschlossenes oder baut eine Fläche
  // auf die Detailkante, gehört die Beschriftung in denselben Schritt.
  it("GET /api/duplicates trägt sie ebenfalls nicht — die Liste zeigt nur Offenes", async () => {
    const { app, admin, eintrag } = await zurueckgezogeneLage();
    const res = await app.inject({ method: "GET", url: "/api/duplicates", headers: admin.headers });
    expect(res.statusCode).toBe(200);
    const liste = res.json() as { id: string }[];
    expect(liste.some((e) => e.id === eintrag.id)).toBe(false);
  });

  // Die Gegenprobe zum Befund oben: SOLANGE beide Seiten stehen, liefert dieselbe Route den
  // Eintrag aus — die Kante ist also nicht grundsätzlich zu, sondern an dieser einen Voraussetzung.
  it("dieselbe Route liefert einen Befund aus, solange beide Seiten stehen", async () => {
    const { app, admin, autorin, services } = await welt();
    const a = await koAnlegen(app, autorin, "Ventil V3 zuerst", "Bei Überdruck V3 schließen.");
    const b = await koAnlegen(app, autorin, "Pumpe entlüften", "Die Pumpe alle 200 h entlüften.");
    const eintrag = await befund(services, a, b);
    const res = await app.inject({
      method: "GET",
      url: `/api/duplicates/${eintrag.id}`,
      headers: admin.headers,
    });
    expect(res.statusCode).toBe(200);
    expect((res.json() as { status: string }).status).toBe("offen");
  });
});
