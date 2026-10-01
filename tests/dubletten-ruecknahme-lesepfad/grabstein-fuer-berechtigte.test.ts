import { describe, expect, it } from "vitest";
import { type App, type Konto, befund, welt } from "../eigene-ruecknahme/welt";

// ================================================================================================
// Q7 (priority:Q7:890a0e2e4bfa) — DER GESCHLOSSENE LESEPFAD NACH DEM RÜCKZUG.
// ================================================================================================
//
// „Nach dem Zurückziehen des eigenen Beitrags bleibt der abgeschlossene Dublettenbefund für
// Berechtigte mit Grund und Urheber nachvollziehbar, ohne fremde geschützte Inhalte offenzulegen."
//
// BERECHTIGT ist, wer BEIDE Seiten sehen darf — dieselbe Regel `darfSehen` wie vor dem Rückzug; die
// zurückgezogene Seite wird dafür im Papierkorb nachgeschlagen (`paarSichtbarMitPapierkorb`). Wer
// eine Seite nicht sehen durfte, bekommt dasselbe 404 wie für eine unbekannte Kennung (kein
// Existenzsignal). Ausgeliefert wird NUR der Grabstein: Kennung des Befunds, Status, Grund, Urheber,
// Zeit — keine Objektkennungen, keine Zitate, keine Eigenanteile, kein Vermerk, keine Begründung.

async function anlegen(
  app: App,
  konto: Konto,
  titel: string,
  satz: string,
  confidentiality: "intern" | "vertraulich" = "intern",
): Promise<string> {
  const res = await app.inject({
    method: "POST",
    url: "/api/kos",
    headers: konto.headers,
    payload: {
      confidentiality,
      title: titel,
      statement: satz,
      type: "best_practice",
      category: "Anlage 1",
    },
  });
  expect(res.statusCode).toBeLessThan(300);
  return res.json().id as string;
}

async function lesen(app: App, konto: Konto | undefined, id: string) {
  return app.inject({ url: `/api/duplicates/${id}`, ...(konto ? { headers: konto.headers } : {}) });
}

async function unbekannt(app: App, konto: Konto) {
  return app.inject({ url: "/api/duplicates/gibt-es-nicht", headers: konto.headers });
}

describe("Q7: der Grabstein nach dem eigenen Rückzug — für Berechtigte, und nur für sie", () => {
  it("beide Seiten intern: Autorin, Fremde und Admin lesen denselben Grabstein, sonst nichts", async () => {
    const { app, services, autorin, fremde, admin } = await welt();
    const a = await anlegen(app, autorin, "Ventil V3 zuerst", "Bei Überdruck V3 schließen.");
    const b = await anlegen(app, fremde, "Pumpe entlüften", "Die Pumpe alle 200 h entlüften.");
    const eintrag = await befund(services, a, b);
    // Vorher: das volle Paar für alle drei.
    expect((await lesen(app, fremde, eintrag.id)).json()).toMatchObject({ koA: a, koB: b });

    const del = await app.inject({
      method: "DELETE",
      url: `/api/kos/${a}`,
      headers: autorin.headers,
    });
    expect(del.statusCode).toBe(204);

    const gespeichert = await services.overlaps.get(eintrag.id);
    const grabstein = {
      id: eintrag.id,
      status: "geschlossen",
      resolution: { reason: "withdrawn_own", by: autorin.id, at: gespeichert?.resolution?.at },
    };
    for (const konto of [autorin, fremde, admin]) {
      const res = await lesen(app, konto, eintrag.id);
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual(grabstein);
      // Kein geschützter Inhalt, auch nicht als Teilzeichenkette der Antwort.
      for (const geschuetzt of [a, b, "entlüften", "gleiche Anweisung"]) {
        expect(res.body).not.toContain(geschuetzt);
      }
    }
    expect((await lesen(app, undefined, eintrag.id)).statusCode).toBe(401);
  });

  it("die zurückgezogene Seite war vertraulich: wer sie nicht sehen durfte, bleibt beim 404", async () => {
    const { app, services, autorin, fremde, admin } = await welt();
    const a = await anlegen(
      app,
      autorin,
      "Ventil V3",
      "Bei Überdruck V3 schließen.",
      "vertraulich",
    );
    const b = await anlegen(app, fremde, "Pumpe entlüften", "Die Pumpe alle 200 h entlüften.");
    const eintrag = await befund(services, a, b);
    // Schon vorher sah die Fremde dieses Paar nicht.
    expect((await lesen(app, fremde, eintrag.id)).statusCode).toBe(404);

    await app.inject({ method: "DELETE", url: `/api/kos/${a}`, headers: autorin.headers });

    const fremd = await lesen(app, fremde, eintrag.id);
    expect(fremd.statusCode).toBe(404);
    expect(fremd.body).toBe((await unbekannt(app, fremde)).body);
    // Admin darf Vertrauliches sehen (ko.validate) — und liest den Grabstein.
    const adm = await lesen(app, admin, eintrag.id);
    expect(adm.statusCode).toBe(200);
    expect(adm.json().resolution).toMatchObject({ reason: "withdrawn_own", by: autorin.id });
  });

  it("die verbleibende Seite ist fremd und vertraulich: die Autorin liest nur ihren eigenen Abschluss", async () => {
    const { app, services, autorin, fremde, admin } = await welt();
    const a = await anlegen(app, autorin, "Ventil V3 zuerst", "Bei Überdruck V3 schließen.");
    const b = await anlegen(app, fremde, "Pumpe", "Die Pumpe alle 200 h entlüften.", "vertraulich");
    const eintrag = await befund(services, a, b);

    await app.inject({ method: "DELETE", url: `/api/kos/${a}`, headers: autorin.headers });

    // Die Autorin darf B nicht sehen — sie liest trotzdem den Nachweis ihres EIGENEN Abschlusses
    // (JOB 3450), und er nennt nichts von B.
    const eigene = await lesen(app, autorin, eintrag.id);
    expect(eigene.statusCode).toBe(200);
    expect(eigene.body).not.toContain(b);
    // Fremde (Autorin von B) und Admin sehen beide Seiten.
    for (const konto of [fremde, admin]) {
      expect((await lesen(app, konto, eintrag.id)).statusCode).toBe(200);
    }
  });

  it("nach der Endlöschung der zurückgezogenen Seite: 404 für alle ausser der Abschliessenden", async () => {
    const { app, services, autorin, fremde, admin } = await welt();
    const a = await anlegen(app, autorin, "Ventil V3 zuerst", "Bei Überdruck V3 schließen.");
    const b = await anlegen(app, fremde, "Pumpe entlüften", "Die Pumpe alle 200 h entlüften.");
    const eintrag = await befund(services, a, b);
    await app.inject({ method: "DELETE", url: `/api/kos/${a}`, headers: autorin.headers });
    const purge = await app.inject({
      method: "DELETE",
      url: `/api/kos/trash/${a}`,
      headers: admin.headers,
    });
    expect(purge.statusCode).toBeLessThan(300);

    // Die Seite ist nicht mehr auflösbar — fail-closed. Nur der eigene Abschluss bleibt lesbar.
    for (const konto of [fremde, admin]) {
      const res = await lesen(app, konto, eintrag.id);
      expect(res.statusCode).toBe(404);
      expect(res.body).toBe((await unbekannt(app, konto)).body);
    }
    expect((await lesen(app, autorin, eintrag.id)).statusCode).toBe(200);
  });

  it("andere geschlossene Befunde bleiben, wie sie waren: kein Grabstein für eine fremde Löschung", async () => {
    const { app, services, autorin, fremde, admin } = await welt();
    const a = await anlegen(app, autorin, "Ventil V3 zuerst", "Bei Überdruck V3 schließen.");
    const b = await anlegen(app, fremde, "Pumpe entlüften", "Die Pumpe alle 200 h entlüften.");
    const eintrag = await befund(services, a, b);
    // Der Admin löscht — kein eigener Rückzug, `participant_deleted` ohne Urheber.
    await app.inject({ method: "DELETE", url: `/api/kos/${a}`, headers: admin.headers });

    const res = await lesen(app, fremde, eintrag.id);
    expect(res.statusCode).toBe(404);
    expect(res.body).toBe((await unbekannt(app, fremde)).body);
  });
});
