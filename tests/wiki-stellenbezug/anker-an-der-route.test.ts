// ================================================================================================
// P-WIKI-STELLENBEZUG · D3 — DIE STELLE AN DER ECHTEN ROUTE `PUT /api/kos/:id` (action: comment)
// ================================================================================================
//
// Bauform und Hülle aus `tests/wiki-diskussion/huelle.ts` (echtes Login, echte Rollen, echter PUT).
//
// R1  ein angemeldeter Mitleser OHNE Bearbeitungsrecht setzt eine Rückfrage an einen Absatz; sie
//     kommt mit Stelle zurück und steht beim nächsten Lesen da
// R2  eine unlesbare Stelle ist ein Formfehler (400) — sie wird nicht still fallen gelassen
// R3  eine erfundene Textstelle: 400, nichts geschrieben
// R4  nach einer Überarbeitung: die Stelle aus der alten Fassung bekommt 409 `KO_STALE` mit der
//     jetzt gespeicherten Version; der verankerte Altbeitrag steht unverändert da
// R5  NACHARBEIT 3 (BEN): <h2>A</h2><p>Hallo</p> — ein Tabellenanker im Abschnitt „B" mit dem Text
//     „Hallo" wird abgewiesen (400), obwohl „Hallo" im Inhalt steht
import { describe, expect, it } from "vitest";
import { stellenFingerabdruck } from "../../services/knowledge-object/src/stellen-fingerabdruck";
import {
  type App,
  type Kopf,
  type Objektstand,
  beitraege,
  flaeche,
  konto,
  lesen,
  put,
} from "../wiki-diskussion/huelle";

const INHALT =
  "<h2>Ablauf</h2><p>Erst das <strong>Ventil X</strong> schließen.</p><p>Danach spülen.</p>";

const STELLE = {
  koVersion: 1,
  art: "absatz",
  abschnitt: "Ablauf",
  text: "Erst das Ventil X schließen.",
  fingerabdruck: stellenFingerabdruck("absatz", "Ablauf", "Erst das Ventil X schließen."),
};

async function anlegenMitInhalt(app: App, headers: Kopf): Promise<Objektstand> {
  const angelegt = await app.inject({
    method: "POST",
    url: "/api/kos",
    headers,
    payload: {
      confidentiality: "intern",
      title: "Ventil X schließt bei Überdruck",
      statement: "Bei Überdruck Ventil X manuell schließen.",
      bodyHtml: INHALT,
      type: "best_practice",
      category: "Anlage 1",
    },
  });
  expect(angelegt.statusCode).toBe(201);
  return angelegt.json() as Objektstand;
}

describe("P-WIKI-STELLENBEZUG · D3 — Stelle an der Route", () => {
  it("R1 · ein Mitleser ohne Bearbeitungsrecht setzt eine Rückfrage an einen Absatz", async () => {
    const { app, admin } = await flaeche();
    const leser = await konto(app, admin, "viewer", "leser@klarwerk.test");
    const ko = await anlegenMitInhalt(app, admin);
    expect(ko.version).toBe(1);

    const res = await put(app, leser, ko.id, {
      action: "comment",
      text: "Welches Ventil genau?",
      stelle: STELLE,
    });

    expect(res.statusCode).toBe(200);
    const gelesen = beitraege(await lesen(app, admin, ko.id));
    expect(gelesen).toHaveLength(1);
    expect((gelesen[0] as unknown as { stelle?: unknown }).stelle).toEqual(STELLE);
  });

  it("R2 · eine unlesbare Stelle ist ein Formfehler — 400, nichts geschrieben", async () => {
    const { app, admin } = await flaeche();
    const ko = await anlegenMitInhalt(app, admin);

    for (const stelle of [
      "Absatz 1",
      { ...STELLE, art: "fussnote" },
      { ...STELLE, koVersion: 0 },
      { ...STELLE, text: "   " },
      // Ohne Abdruck des vollständigen Inhalts ist die Identität der Stelle nicht belegbar.
      { ...STELLE, fingerabdruck: undefined },
      { ...STELLE, fingerabdruck: "abc" },
    ]) {
      const res = await put(app, admin, ko.id, { action: "comment", text: "Frage.", stelle });
      expect(res.statusCode, JSON.stringify(stelle)).toBe(400);
    }
    expect(beitraege(await lesen(app, admin, ko.id))).toEqual([]);
  });

  it("R3 · eine erfundene Textstelle: 400, nichts geschrieben", async () => {
    const { app, admin } = await flaeche();
    const ko = await anlegenMitInhalt(app, admin);

    const res = await put(app, admin, ko.id, {
      action: "comment",
      text: "Frage.",
      stelle: { ...STELLE, text: "Diesen Satz gibt es nicht." },
    });

    expect(res.statusCode).toBe(400);
    expect(beitraege(await lesen(app, admin, ko.id))).toEqual([]);
  });

  it("R4 · nach einer Überarbeitung: 409 für die alte Stelle, der Altbeitrag bleibt unverändert", async () => {
    const { app, admin } = await flaeche();
    const ko = await anlegenMitInhalt(app, admin);
    const erst = await put(app, admin, ko.id, {
      action: "comment",
      text: "Welches Ventil genau?",
      stelle: STELLE,
    });
    expect(erst.statusCode).toBe(200);

    const revidiert = await put(app, admin, ko.id, {
      action: "revise",
      changes: { bodyHtml: "<h2>Ablauf</h2><p>Erst das Ventil Y schließen.</p>" },
    });
    expect(revidiert.statusCode).toBe(200);

    const spaet = await put(app, admin, ko.id, {
      action: "comment",
      text: "Noch eine Frage zur alten Stelle.",
      stelle: STELLE,
    });
    expect(spaet.statusCode).toBe(409);
    expect(spaet.json()).toMatchObject({ error: "KO_STALE", currentVersion: 2 });

    const stand = await lesen(app, admin, ko.id);
    expect(stand.version).toBe(2);
    const liste = beitraege(stand) as unknown as { text: string; stelle?: unknown }[];
    expect(liste).toHaveLength(1);
    expect(liste[0]?.stelle).toEqual(STELLE);
  });

  it("R5 · BENs Beispiel: Tabellenanker im Abschnitt „B“ zum Text „Hallo“ wird abgewiesen", async () => {
    const { app, admin } = await flaeche();
    const angelegt = await app.inject({
      method: "POST",
      url: "/api/kos",
      headers: admin,
      payload: {
        confidentiality: "intern",
        title: "Gruss",
        statement: "Hallo.",
        bodyHtml: "<h2>A</h2><p>Hallo</p>",
        type: "best_practice",
        category: "Anlage 1",
      },
    });
    expect(angelegt.statusCode).toBe(201);
    const ko = angelegt.json() as Objektstand;

    const falsch = await put(app, admin, ko.id, {
      action: "comment",
      text: "Frage.",
      stelle: {
        koVersion: 1,
        art: "tabelle",
        abschnitt: "B",
        text: "Hallo",
        fingerabdruck: stellenFingerabdruck("tabelle", "B", "Hallo"),
      },
    });
    expect(falsch.statusCode).toBe(400);
    expect(beitraege(await lesen(app, admin, ko.id))).toEqual([]);

    // KALIBRIERUNG: der echte Block (Absatz in Abschnitt „A“) wird angenommen.
    const echt = await put(app, admin, ko.id, {
      action: "comment",
      text: "Frage.",
      stelle: {
        koVersion: 1,
        art: "absatz",
        abschnitt: "A",
        text: "Hallo",
        fingerabdruck: stellenFingerabdruck("absatz", "A", "Hallo"),
      },
    });
    expect(echt.statusCode).toBe(200);
  });
});
