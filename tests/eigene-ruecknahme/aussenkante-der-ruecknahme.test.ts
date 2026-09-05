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

  // GEMESSENER BEFUND, NICHT BEHOBEN (Auftrag §7.4): `GET /api/duplicates/:id` liefert den
  // geschlossenen Befund nach dem Rückzug NICHT mehr aus. Der Grund liegt nicht am Befund, sondern
  // an der Sichtbarkeitsregel davor: `paarSichtbar` (services/app/src/routes/overlap-routes.ts:125)
  // verlangt Sichtbarkeit BEIDER Seiten, und die zurückgezogene Seite liegt im Papierkorb — für
  // jeden Sichtweg also „nicht vorhanden". Die Route antwortet 404, und zwar bewusst ununterscheid-
  // bar von „gibt es nicht" (mega74 D / JOB 1125 Pflicht 3).
  //
  // Das ist der Zustand VOR diesem Auftrag und wird hier nicht angefasst: die Regel zu lockern wäre
  // eine Sichtbarkeitsentscheidung mit eigener Begründungslast und liegt ausserhalb der Zielpfade.
  // Der Befund gehört in die nächste Scheibe; dieser Fall hält ihn fest, damit er nicht wieder
  // verloren geht — und wird rot, sobald jemand die Kante öffnet, ohne es zu benennen.
  it("GET /api/duplicates/:id trägt sie NICHT — die zurückgezogene Seite ist im Papierkorb", async () => {
    const { app, admin, eintrag } = await zurueckgezogeneLage();
    const res = await app.inject({
      method: "GET",
      url: `/api/duplicates/${eintrag.id}`,
      headers: admin.headers,
    });
    expect(res.statusCode).toBe(404);
    expect(res.json()).toMatchObject({ error: "NOT_FOUND" });
  });

  // DIE FOLGE DAVON, GEMESSEN STATT ERSCHLOSSEN: auch die Liste trägt den neuen Grund nicht — sie
  // liefert ausschliesslich OFFENE Befunde (`overlaps.unresolved()`, overlap-routes.ts:54), und ein
  // zurückgezogener ist geschlossen. Die Oberfläche (apps/web, §10: Scheibe 4) kann `withdrawn_own`
  // heute also gar nicht erreichen; ihr fehlender Übersetzungsschlüssel ist unerreichbar, nicht
  // kaputt. Wird eine der beiden Kanten geöffnet, wird dieser Fall rot — und dann gehört die
  // Beschriftung in denselben Schritt.
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
