// ================================================================================================
// R-1632 / R-1633 — GELTUNG ÜBER DIE ÖFFENTLICHEN ROUTEN, FRAGEN MIT FRAGEKONTEXT.
// ================================================================================================
//
// Ohne Dienst-, Routen- oder Antwortattrappen: `buildApp(buildServices())`, ein Konto über die
// echten Auth-Routen, Anlage über `POST /api/kos`, Geltung über `PUT /api/kos/:id`
// (`action: "geltung"`), Fragen über `POST /api/ask` (Konsolenzweig, deterministischer Reasoner).
//
//   R1  Geltung setzen, ändern, ungültig abweisen, mit `null` entfernen — samt Prüfprotokoll.
//   F1  KERN R-1633: zwei gleich relevante, validierte Quellen (Frühschicht / Nachtschicht). Wer
//       für die Frühschicht fragt, bekommt die Frühschicht-Antwort, wer für die Nachtschicht fragt,
//       die Nachtschicht-Antwort — dieselbe Frage, derselbe Bestand. Die Antwort trägt die
//       Auskunft `geltung` mit Kontext und Passung der Quelle.
//   F2  „falls relevant" steht als Rangfolgeregel in `geltung-rangfolge.test.ts` (der Frageweg
//       bindet alle Fragebegriffe, R-0473 — dort ist der Fall direkt messbar).
//   F3  Ohne Fragekontext fehlt die Auskunft; der Word-Weg (retrieval-only) lässt den Kontext
//       liegen; ein ungültiger Kontext ist 400.
import { describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";

const FRAGE = "Auf wie viel Grad wird das Werkzeug beim Anfahren der Presse vorgewärmt?";
const FRUEH = { ebene: "schicht", werk: "Werk Nord", schicht: "Frühschicht" };
const NACHT = { ebene: "schicht", werk: "Werk Nord", schicht: "Nachtschicht" };

async function bestand() {
  const services = buildServices();
  const app = buildApp(services);
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Admin", email: "admin@standort.test", password: "secret123" },
  });
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: "admin@standort.test", password: "secret123" },
  });
  const headers = { authorization: `Bearer ${login.json().token}` };
  const geltung = (id: string, wert: unknown) =>
    app.inject({
      method: "PUT",
      url: `/api/kos/${id}`,
      headers,
      payload: { action: "geltung", geltung: wert },
    });
  const validiert = async (title: string, statement: string, g?: unknown): Promise<string> => {
    const res = await app.inject({
      method: "POST",
      url: "/api/kos",
      headers,
      payload: {
        confidentiality: "intern",
        title,
        statement,
        type: "best_practice",
        category: "Presswerk",
        neededValidations: 1,
      },
    });
    expect(res.statusCode, res.body).toBe(201);
    const id = res.json().id as string;
    // Nacharbeit 2 (Befund F1): die Schichtvarianten derselben Aussage sind absichtlich fast
    // gleich — die Dublettenerkennung legt dazu eine offene Dublette an, und `rate up` ohne
    // Bestätigung endet dann mit 409 (R-0247), das Objekt bleibt unvalidiert und fällt im
    // Konsolenweg (`validatedOnly`) heraus. Bestätigt wird wie durch einen Menschen über den
    // vorgesehenen Weg; ohne offene Dublette ist das Kennzeichen wirkungslos. Die Bewertung muss
    // durchgehen — sonst prüfte die Gegenprobe still nur eine einzige Quelle.
    const bewertet = await app.inject({
      method: "PUT",
      url: `/api/kos/${id}`,
      headers,
      payload: { action: "rate", verdict: "up", duplicateAcknowledged: true },
    });
    expect(bewertet.statusCode, bewertet.body).toBe(200);
    const gelesen = await app.inject({ method: "GET", url: `/api/kos/${id}`, headers });
    expect(gelesen.json().status, `${title}: nicht validiert`).toBe("validiert");
    if (g !== undefined) {
      const gesetzt = await geltung(id, g);
      expect(gesetzt.statusCode, gesetzt.body).toBe(200);
    }
    return id;
  };
  const fragen = (payload: Record<string, unknown>) =>
    app.inject({ method: "POST", url: "/api/ask", headers, payload });
  return { app, services, headers, geltung, validiert, fragen };
}

describe("R-1632 · Geltung am Wissensobjekt über die öffentliche Route", () => {
  it("R1 · setzen → ändern → abweisen → entfernen, jeweils gelesen über GET und im Protokoll", async () => {
    const { app, services, headers, geltung, validiert } = await bestand();
    try {
      const id = await validiert("Presse anfahren", "Das Werkzeug wird vorgewärmt.");
      const lesen = async () =>
        (await app.inject({ method: "GET", url: `/api/kos/${id}`, headers })).json();

      const werk = await geltung(id, { ebene: "werk", werk: " Werk  Nord " });
      expect(werk.statusCode, werk.body).toBe(200);
      expect((await lesen()).geltung).toEqual({ ebene: "werk", werk: "Werk Nord" });
      const versionVorher = (await lesen()).version;

      const schicht = await geltung(id, FRUEH);
      expect(schicht.statusCode, schicht.body).toBe(200);
      expect((await lesen()).geltung).toEqual(FRUEH);
      // Die Geltung ist Einordnung, keine neue Inhaltsfassung.
      expect((await lesen()).version).toBe(versionVorher);

      for (const falsch of [{ ebene: "werk" }, { ebene: "konzern", werk: "Werk Nord" }, "werk"]) {
        const res = await geltung(id, falsch);
        expect(res.statusCode, JSON.stringify(falsch)).toBe(400);
      }
      const ohneFeld = await app.inject({
        method: "PUT",
        url: `/api/kos/${id}`,
        headers,
        payload: { action: "geltung" },
      });
      expect(ohneFeld.statusCode).toBe(400);
      expect((await lesen()).geltung).toEqual(FRUEH);

      const entfernt = await geltung(id, null);
      expect(entfernt.statusCode, entfernt.body).toBe(200);
      expect("geltung" in (await lesen())).toBe(false);

      // Je Änderung genau ein Beleg; die abgewiesenen Versuche schreiben keinen.
      const protokoll = await services.audit.list({ action: "ko.geltung-changed", target: id });
      expect(protokoll).toHaveLength(3);
      expect(protokoll.map((e) => e.payload)).toEqual(
        expect.arrayContaining([
          { vorher: null, nachher: { ebene: "werk", werk: "Werk Nord" } },
          { vorher: { ebene: "werk", werk: "Werk Nord" }, nachher: FRUEH },
          { vorher: FRUEH, nachher: null },
        ]),
      );
    } finally {
      await app.close();
    }
  });
});

describe("R-1633 · Schicht- und Rollen-Filter beim Fragen", () => {
  it("F1 · KERN: die Quelle der eigenen Schicht trägt die Antwort, die Auskunft sagt es", async () => {
    const { app, validiert, fragen } = await bestand();
    try {
      const frueh = await validiert(
        "Presse anfahren",
        "Beim Anfahren der Presse wird das Werkzeug auf 60 Grad vorgewärmt.",
        FRUEH,
      );
      const nacht = await validiert(
        "Presse anfahren",
        "Beim Anfahren der Presse wird das Werkzeug auf 80 Grad vorgewärmt.",
        NACHT,
      );

      const ausFrueh = await fragen({
        question: FRAGE,
        fragekontext: { werk: "Werk Nord", schicht: "Frühschicht" },
      });
      expect(ausFrueh.statusCode, ausFrueh.body).toBe(200);
      // Der deterministische Antwortweg meldet nur die TRAGENDE Quelle (`sources: [best.id]`) —
      // welche das ist, entscheidet die Rangfolge. Dass die andere Kandidat bleibt, misst
      // `geltung-rangfolge.test.ts` (P1).
      const a = ausFrueh.json();
      expect(a.result.answered).toBe(true);
      expect(a.result.sources).toEqual([frueh]);
      expect(a.result.answer).toContain("60 Grad");
      expect(a.geltung).toEqual({
        fragekontext: { werk: "Werk Nord", schicht: "Frühschicht" },
        quellen: [{ id: frueh, passung: "eigene_schicht", geltung: FRUEH }],
      });

      // Gegenprobe mit derselben Frage und demselben Bestand: nur der Kontext ist ein anderer.
      const ausNacht = await fragen({
        question: FRAGE,
        fragekontext: { werk: "Werk Nord", schicht: "Nachtschicht" },
      });
      const n = ausNacht.json();
      expect(n.result.sources).toEqual([nacht]);
      expect(n.result.answer).toContain("80 Grad");
      expect(n.geltung.quellen).toEqual([{ id: nacht, passung: "eigene_schicht", geltung: NACHT }]);
    } finally {
      await app.close();
    }
  });

  it("F3 · ohne Kontext keine Auskunft; der Word-Weg lässt ihn liegen; ungültig ist 400", async () => {
    const { app, validiert, fragen } = await bestand();
    try {
      await validiert(
        "Presse anfahren",
        "Beim Anfahren der Presse wird das Werkzeug auf 60 Grad vorgewärmt.",
        FRUEH,
      );
      const ohne = await fragen({ question: FRAGE });
      expect(ohne.statusCode, ohne.body).toBe(200);
      expect("geltung" in ohne.json()).toBe(false);

      const leer = await fragen({ question: FRAGE, fragekontext: { werk: " " } });
      expect(leer.statusCode, leer.body).toBe(200);
      expect("geltung" in leer.json()).toBe(false);

      const word = await fragen({
        question: FRAGE,
        mode: "retrieval-only",
        fragekontext: { schicht: "Frühschicht" },
      });
      expect(word.statusCode, word.body).toBe(200);
      expect("geltung" in word.json()).toBe(false);

      const kaputt = await fragen({ question: FRAGE, fragekontext: { schicht: "x".repeat(81) } });
      expect(kaputt.statusCode).toBe(400);
    } finally {
      await app.close();
    }
  });
});
