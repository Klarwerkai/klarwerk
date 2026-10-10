// ================================================================================================
// VORLAGEN AM DRAHT — buildApp im Speicher, fiktive Konten (produkt:20261007:templates-default).
// ================================================================================================
//
// Isolierter Testbestand: jede Prüfung baut ihre eigene Anwendung; kein Konto, keine Rolle und kein
// Inhalt ist echt.
//
//   Ada    (admin)      — Kontoverwaltung: unternehmensweite Vorlagen, Verwaltung, Begriffspflege
//   Carla  (controller) — zuständig für beide Spaces, pflegt Space-Vorgaben
//   Erik   (experte)    — Mitglied „Instandhaltung“ (schreiben)
//   Mia    (experte)    — Mitglied „Instandhaltung“ (schreiben) — die zweite berechtigte Person
//   Fritz  (experte)    — kein Mitglied von „Instandhaltung“; schreibt im offenen „Labor“
//   Vera   (viewer)     — darf nur lesen
//
//   Space „Instandhaltung“ (nur Mitglieder) · Space „Labor“ (offen für alle)
//
// Zuordnung zu den Originalkriterien des Auftrags (AUFTRAG-B1.json):
//   K1 persönlicher Standard → neue Eingabe findet ihn vor (auch nach erneutem Lesen)
//   K3/K10 eigene Vorlage anlegen, im Space teilen (neue Fassung), zweite berechtigte Person wendet
//      sie an; Unberechtigte sehen sie nicht / dürfen nicht teilen
//   K4 unternehmensweite Struktur mit Pflichtfeldern ist für alle sichtbar, nur die Verwaltung ändert
//   K5/K10 Vorlagenänderung: Auswirkungen vorher, bestehender Beitrag behält Werte und Fassungsbezug
//   K7 Verwaltung: Nutzung je Space; Begriffspflege in einem Space ändert andere Spaces nicht
//   K8 Space-Pflichtangaben: Entwurf bleibt speicherbar, Einreichen wird serverseitig geprüft
//   K9 Vorrang Space-Vorgabe vor persönlichem Standard; ausgemusterter Standard → Ersatzwahl
//   K11 Umbenennen/Ausmustern zeigt Bestand, ändert nur den Geltungsbereich, entfernt nichts still
//   K12 freie Eingabe bleibt möglich; Unberechtigte ändern keine gemeinsam geltenden Strukturen
import { describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";

type App = ReturnType<typeof buildApp>;
type Kopf = { authorization: string };

// Fiktives Testkennwort des isolierten Speicherbestands — kein Zugang zu einem echten System.
const KENNWORT = "testkonto-123";

async function anmelden(app: App, email: string): Promise<Kopf> {
  const res = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email, password: KENNWORT },
  });
  expect(res.statusCode, `Anmeldung ${email}: ${res.body}`).toBe(200);
  return { authorization: `Bearer ${res.json().token}` };
}

async function buehne() {
  const app = buildApp(buildServices());
  const erst = await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Ada Admin", email: "ada@vorlagen.test", password: KENNWORT },
  });
  expect(erst.statusCode, erst.body).toBe(201);
  const admin = await anmelden(app, "ada@vorlagen.test");
  for (const [name, email, role] of [
    ["Carla Controller", "carla@vorlagen.test", "controller"],
    ["Erik Experte", "erik@vorlagen.test", "experte"],
    ["Mia Monteurin", "mia@vorlagen.test", "experte"],
    ["Fritz Fachmann", "fritz@vorlagen.test", "experte"],
    ["Vera Viewer", "vera@vorlagen.test", "viewer"],
  ] as const) {
    const res = await app.inject({
      method: "POST",
      url: "/api/users",
      headers: admin,
      payload: { name, email, password: KENNWORT, role },
    });
    expect(res.statusCode, `Konto ${email}: ${res.body}`).toBe(201);
  }
  const k = {
    admin,
    carla: await anmelden(app, "carla@vorlagen.test"),
    erik: await anmelden(app, "erik@vorlagen.test"),
    mia: await anmelden(app, "mia@vorlagen.test"),
    fritz: await anmelden(app, "fritz@vorlagen.test"),
    vera: await anmelden(app, "vera@vorlagen.test"),
  };
  const liste = await app.inject({ method: "GET", url: "/api/spaces/konten", headers: k.carla });
  expect(liste.statusCode, liste.body).toBe(200);
  const id = (name: string): string =>
    (liste.json().konten as { id: string; name: string }[]).find((x) => x.name === name)?.id ?? "";
  const ids = {
    carla: id("Carla Controller"),
    erik: id("Erik Experte"),
    mia: id("Mia Monteurin"),
    fritz: id("Fritz Fachmann"),
  };
  const space = async (
    name: string,
    zugang: "alle" | "mitglieder",
    mitglieder: string[],
    ansichten: { name: string; tag: string }[],
  ) => {
    const res = await app.inject({
      method: "POST",
      url: "/api/spaces",
      headers: k.carla,
      payload: {
        name,
        zweck: `${name}: fiktiver Arbeitsraum für den Vorlagentest.`,
        verantwortlich: ids.carla,
        zugang,
        mitglieder: mitglieder.map((nutzer) => ({ nutzer, recht: "schreiben" })),
        ansichten,
      },
    });
    expect(res.statusCode, res.body).toBe(201);
    return res.json().id as string;
  };
  // Die gespeicherte Ansicht filtert über den Tag „Dichtung“ — sie muss ein Umbenennen überleben.
  const instandhaltung = await space(
    "Instandhaltung",
    "mitglieder",
    [ids.erik, ids.mia],
    [{ name: "Dichtungen", tag: "Dichtung" }],
  );
  const labor = await space("Labor", "alle", [], [{ name: "Dichtungen Labor", tag: "Dichtung" }]);
  return { app, k, ids, instandhaltung, labor };
}

type Buehne = Awaited<ReturnType<typeof buehne>>;

function req(
  b: Buehne,
  kopf: Kopf,
  method: "GET" | "POST" | "PUT",
  url: string,
  payload?: unknown,
) {
  return b.app.inject({
    method,
    url,
    headers: kopf,
    ...(payload !== undefined ? { payload: payload as Record<string, unknown> } : {}),
  });
}

const KO = {
  confidentiality: "intern",
  type: "best_practice",
  statement: "Fiktive Aussage für den Vorlagentest.",
};

/** Ein Beitrag mit der Standardvorlage FAQ (beide Pflichtfelder gefüllt) — wahlweise in einem Space. */
async function faqBeitrag(
  b: Buehne,
  kopf: Kopf,
  titel: string,
  tags: string[],
  spaceId: string | null,
  category = "Allgemein",
) {
  return req(b, kopf, "POST", "/api/kos", {
    ...KO,
    title: titel,
    category,
    tags,
    bodyHtml: `<h2>FAQ</h2><h3>Frage</h3><p>${titel}?</p><h3>Antwort</h3><p>Fiktive Antwort.</p>`,
    vorlage: { id: "std-faq", version: 1, spaceId },
  });
}

describe("K1 · persönlicher Standard", () => {
  it("wird gewählt, bleibt nach erneutem Lesen und steht bei neuer Eingabe vorgewählt bereit", async () => {
    const b = await buehne();
    const vorher = await req(b, b.k.erik, "GET", "/api/vorlagen/start");
    expect(vorher.statusCode, vorher.body).toBe(200);
    expect(vorher.json().quelle).toBe("frei");

    const setzen = await req(b, b.k.erik, "PUT", "/api/vorlagen/standard", {
      vorlageId: "std-regel",
    });
    expect(setzen.statusCode, setzen.body).toBe(200);

    // Erneutes Lesen (wie nach einem Neuladen der Seite): der Standard steht beim Server.
    const liste = await req(b, b.k.erik, "GET", "/api/vorlagen");
    expect(liste.json().standardId).toBe("std-regel");
    const regel = (liste.json().vorlagen as { id: string; istStandard: boolean }[]).find(
      (v) => v.id === "std-regel",
    );
    expect(regel?.istStandard).toBe(true);

    const start = await req(b, b.k.erik, "GET", "/api/vorlagen/start");
    expect(start.json().quelle).toBe("persoenlich");
    expect(start.json().vorlage.id).toBe("std-regel");
    expect(start.json().vorlage.felder.map((f: { titel: string }) => f.titel)).toContain(
      "Die Regel",
    );

    // Der Standard ist persönlich: Mia findet ihn nicht vor.
    const mia = await req(b, b.k.mia, "GET", "/api/vorlagen/start");
    expect(mia.json().quelle).toBe("frei");
  });

  it("die sechs bestellten Standardvorlagen und die übernommenen Startstrukturen stehen bereit", async () => {
    const b = await buehne();
    const liste = await req(b, b.k.erik, "GET", "/api/vorlagen");
    const namen = (liste.json().vorlagen as { name: string; geltung: string }[])
      .filter((v) => v.geltung === "standard")
      .map((v) => v.name);
    for (const n of [
      "Regel",
      "Arbeitsanleitung",
      "Übergabe",
      "Projektentscheidung",
      "Besprechungsnotiz",
      "FAQ",
      "Störung beheben",
      "Sicherheitsrelevantes Wissen",
      "Checkliste",
      "Entscheidungshilfe",
    ]) {
      expect(namen).toContain(n);
    }
  });
});

describe("K3 · K10 · K12 — eigene Vorlage anlegen, im Space teilen, von zweiter Person anwenden", () => {
  it("teilen ist eine neue Fassung; Mia wendet sie an; Unbeteiligte sehen nichts", async () => {
    const b = await buehne();
    const anlegen = await req(b, b.k.erik, "POST", "/api/vorlagen", {
      name: "Pumpenwechsel",
      beschreibung: "Fiktive Vorlage.",
      geltung: "persoenlich",
      felder: [
        { titel: "Ausgangslage", hinweis: "Welche Pumpe? …", art: "absatz", pflicht: true },
        { titel: "Schritte", hinweis: "Schritt ergänzen …", art: "schritte", pflicht: true },
      ],
    });
    expect(anlegen.statusCode, anlegen.body).toBe(201);
    const v = anlegen.json() as { id: string; version: number; felder: { id: string }[] };
    expect(v.version).toBe(1);

    // Persönlich: Mia sieht sie nicht (404, nicht 403).
    expect((await req(b, b.k.mia, "GET", `/api/vorlagen/${v.id}`)).statusCode).toBe(404);

    const teilen = await req(b, b.k.erik, "PUT", `/api/vorlagen/${v.id}`, {
      version: 1,
      name: "Pumpenwechsel",
      beschreibung: "Fiktive Vorlage.",
      geltung: "space",
      spaceId: b.instandhaltung,
      felder: [
        { id: v.felder[0]?.id, titel: "Ausgangslage", hinweis: "Welche Pumpe? …", pflicht: true },
        {
          id: v.felder[1]?.id,
          titel: "Schritte",
          hinweis: "Schritt ergänzen …",
          art: "schritte",
          pflicht: true,
        },
      ],
    });
    expect(teilen.statusCode, teilen.body).toBe(200);
    expect(teilen.json().vorlage.version).toBe(2);
    expect(teilen.json().vorlage.vorgang).toBe("geteilt");

    // Mia (Mitglied) sieht und darf anwenden — aber nicht ändern (weder Eigentümerin noch zuständig).
    const miaListe = await req(b, b.k.mia, "GET", "/api/vorlagen");
    const geteilt = (
      miaListe.json().vorlagen as { id: string; darfAnwenden: boolean; darfBearbeiten: boolean }[]
    ).find((x) => x.id === v.id);
    expect(geteilt?.darfAnwenden).toBe(true);
    expect(geteilt?.darfBearbeiten).toBe(false);
    const miaAendert = await req(b, b.k.mia, "PUT", `/api/vorlagen/${v.id}`, {
      version: 2,
      name: "Übernommen",
      geltung: "space",
      spaceId: b.instandhaltung,
      felder: [{ titel: "X" }],
    });
    expect(miaAendert.statusCode).toBe(403);

    // Fritz ist kein Mitglied: 404; Vera darf gar keine Vorlage anlegen.
    expect((await req(b, b.k.fritz, "GET", `/api/vorlagen/${v.id}`)).statusCode).toBe(404);
    const vera = await req(b, b.k.vera, "POST", "/api/vorlagen", {
      name: "Nur lesen",
      felder: [{ titel: "A" }],
    });
    expect(vera.statusCode).toBe(403);

    // Mia wendet die geteilte Fassung an — fehlt ein Pflichtfeld, entsteht nichts (400).
    const unvollstaendig = await req(b, b.k.mia, "POST", "/api/kos", {
      ...KO,
      title: "Pumpe P-7 tauschen",
      category: "Allgemein",
      bodyHtml:
        "<h2>Pumpenwechsel</h2><h3>Ausgangslage</h3><p>Welche Pumpe? …</p><h3>Schritte</h3><ol><li>Absperren.</li></ol>",
      vorlage: { id: v.id, version: 2, spaceId: b.instandhaltung },
    });
    expect(unvollstaendig.statusCode, unvollstaendig.body).toBe(400);
    expect(unvollstaendig.json().error).toBe("PFLICHTANGABEN_FEHLEN");
    expect(unvollstaendig.json().befunde).toEqual([
      expect.objectContaining({ art: "vorlagenfeld", wert: "Ausgangslage" }),
    ]);

    const angewendet = await req(b, b.k.mia, "POST", "/api/kos", {
      ...KO,
      title: "Pumpe P-7 tauschen",
      category: "Allgemein",
      bodyHtml:
        "<h2>Pumpenwechsel</h2><h3>Ausgangslage</h3><p>P-7 leckt.</p><h3>Schritte</h3><ol><li>Absperren.</li></ol>",
      vorlage: { id: v.id, version: 2, spaceId: b.instandhaltung },
    });
    expect(angewendet.statusCode, angewendet.body).toBe(201);
    expect(angewendet.json().spaceId).toBe(b.instandhaltung);
    const nutzung = await req(b, b.k.mia, "GET", `/api/vorlagen/nutzung/${angewendet.json().id}`);
    expect(nutzung.json().nutzung).toEqual(
      expect.objectContaining({ vorlageId: v.id, version: 2, name: "Pumpenwechsel" }),
    );
    // Wer den Beitrag nicht sehen darf, erfährt auch über die Vorlage nichts.
    expect(
      (await req(b, b.k.fritz, "GET", `/api/vorlagen/nutzung/${angewendet.json().id}`)).statusCode,
    ).toBe(404);
  });

  it("Rechte: kein Teilen ohne Schreibrecht, unternehmensweit nur die Kontoverwaltung", async () => {
    const b = await buehne();
    const fritzTeilt = await req(b, b.k.fritz, "POST", "/api/vorlagen", {
      name: "Fremd",
      geltung: "space",
      spaceId: b.instandhaltung,
      felder: [{ titel: "A" }],
    });
    expect(fritzTeilt.statusCode).toBe(403);
    const erikUnternehmen = await req(b, b.k.erik, "POST", "/api/vorlagen", {
      name: "Für alle",
      geltung: "unternehmen",
      felder: [{ titel: "A" }],
    });
    expect(erikUnternehmen.statusCode).toBe(403);
    // Standardvorlagen ändert niemand — auch nicht die Kontoverwaltung.
    const std = await req(b, b.k.admin, "PUT", "/api/vorlagen/std-faq", {
      version: 1,
      name: "FAQ",
      felder: [{ titel: "Frage" }],
    });
    expect(std.statusCode).toBe(403);
  });
});

describe("K4 · unternehmensweite Struktur", () => {
  it("Pflichtfelder sind bei der Auswahl sichtbar; ändern darf nur die Verwaltung", async () => {
    const b = await buehne();
    const anlegen = await req(b, b.k.admin, "POST", "/api/vorlagen", {
      name: "Störmeldung (Werk)",
      geltung: "unternehmen",
      felder: [
        { titel: "Anlage", hinweis: "Anlagennummer …", pflicht: true },
        { titel: "Beobachtung", hinweis: "Was ist passiert? …", pflicht: false },
      ],
    });
    expect(anlegen.statusCode, anlegen.body).toBe(201);
    const id = anlegen.json().id as string;
    const erik = await req(b, b.k.erik, "GET", "/api/vorlagen");
    const sicht = (
      erik.json().vorlagen as {
        id: string;
        geltung: string;
        darfBearbeiten: boolean;
        felder: { titel: string; pflicht: boolean }[];
      }[]
    ).find((v) => v.id === id);
    expect(sicht?.geltung).toBe("unternehmen");
    expect(sicht?.darfBearbeiten).toBe(false);
    expect(sicht?.felder).toEqual([
      expect.objectContaining({ titel: "Anlage", pflicht: true }),
      expect.objectContaining({ titel: "Beobachtung", pflicht: false }),
    ]);
    const erikAendert = await req(b, b.k.erik, "PUT", `/api/vorlagen/${id}`, {
      version: 1,
      name: "Geändert",
      geltung: "unternehmen",
      felder: [{ titel: "Anlage" }],
    });
    expect(erikAendert.statusCode).toBe(403);
  });
});

describe("K8 · K9 · Space-Pflichtangaben und Vorrangregel", () => {
  it("Space-Vorgabe hat Vorrang; Entwurf bleibt speicherbar; Einreichen wird geprüft", async () => {
    const b = await buehne();
    // Nur die Spacezuständigen (oder die Kontoverwaltung) pflegen Vorgaben.
    const erikVorgabe = await req(
      b,
      b.k.erik,
      "PUT",
      `/api/vorlagen/space-vorgaben/${b.instandhaltung}`,
      {
        version: 0,
        verbindlicheVorlageId: "std-procedure",
      },
    );
    expect(erikVorgabe.statusCode).toBe(403);
    expect(
      (
        await req(b, b.k.fritz, "PUT", `/api/vorlagen/space-vorgaben/${b.instandhaltung}`, {
          version: 0,
        })
      ).statusCode,
    ).toBe(404);
    const vorgabe = await req(
      b,
      b.k.carla,
      "PUT",
      `/api/vorlagen/space-vorgaben/${b.instandhaltung}`,
      {
        version: 0,
        verbindlicheVorlageId: "std-procedure",
        kategorien: ["Instandhaltung"],
        pflichtKategorie: true,
        mindestensTags: 1,
        tags: ["Pumpe"],
        hinweis: "Fiktiver Hinweis: Anlagen immer mit Kennung.",
      },
    );
    expect(vorgabe.statusCode, vorgabe.body).toBe(200);
    // Zweiter Schreiber mit derselben gesehenen Fassung verliert.
    const parallel = await req(
      b,
      b.k.carla,
      "PUT",
      `/api/vorlagen/space-vorgaben/${b.instandhaltung}`,
      {
        version: 0,
        verbindlicheVorlageId: null,
      },
    );
    expect(parallel.statusCode).toBe(409);

    // Vorrang: Eriks persönlicher Standard tritt im Space zurück — und das wird gesagt.
    await req(b, b.k.erik, "PUT", "/api/vorlagen/standard", { vorlageId: "std-regel" });
    const start = await req(b, b.k.erik, "GET", `/api/vorlagen/start?spaceId=${b.instandhaltung}`);
    expect(start.statusCode, start.body).toBe(200);
    expect(start.json().quelle).toBe("space");
    expect(start.json().vorlage.id).toBe("std-procedure");
    expect(start.json().verdraengt).toEqual({ id: "std-regel", name: "Regel" });
    expect(start.json().vorgabe.mindestensTags).toBe(1);
    // Ohne Space gilt wieder der persönliche Standard.
    expect((await req(b, b.k.erik, "GET", "/api/vorlagen/start")).json().quelle).toBe(
      "persoenlich",
    );

    // Speichern bleibt frei: ein unvollständiger Entwurf mit Vorlagenbezug wird angenommen.
    const bezug = { id: "std-procedure", version: 1, spaceId: b.instandhaltung };
    const entwurf = await req(b, b.k.erik, "POST", "/api/drafts", {
      ...KO,
      title: "Lager der Pumpe P-3 schmieren",
      category: "Allgemein",
      tags: [],
      bodyHtml:
        "<h2>Arbeitsanleitung</h2><h3>Schritte</h3><ol><li>Ersten Schritt ergänzen …</li></ol>",
      vorlage: bezug,
    });
    expect(entwurf.statusCode, entwurf.body).toBe(201);
    const draftId = entwurf.json().id as string;
    // Neu gelesen: der Bezug ist am Entwurf gespeichert.
    const gelesen = await req(b, b.k.erik, "GET", `/api/drafts/${draftId}`);
    expect(gelesen.json().payload?.vorlage ?? gelesen.json().draft?.payload?.vorlage).toEqual(
      bezug,
    );

    const abgelehnt = await req(b, b.k.erik, "POST", `/api/drafts/${draftId}/promote`, {});
    expect(abgelehnt.statusCode, abgelehnt.body).toBe(400);
    expect(abgelehnt.json().error).toBe("PFLICHTANGABEN_FEHLEN");
    const arten = (abgelehnt.json().befunde as { art: string; wert: string }[]).map(
      (x) => `${x.art}:${x.wert}`,
    );
    expect(arten).toEqual(
      expect.arrayContaining([
        "vorlagenfeld:Schritte",
        "kategorie_nicht_erlaubt:Allgemein",
        "tags_fehlen:1",
      ]),
    );
    // Der Entwurf ist unverändert da — nichts ging verloren.
    expect((await req(b, b.k.erik, "GET", `/api/drafts/${draftId}`)).statusCode).toBe(200);

    const angenommen = await req(b, b.k.erik, "POST", `/api/drafts/${draftId}/promote`, {
      draftPayload: {
        category: "Instandhaltung",
        tags: ["Pumpe"],
        bodyHtml:
          "<h2>Arbeitsanleitung</h2><h3>Schritte</h3><ol><li>Pumpe P-3 absperren und Lager schmieren.</li></ol>",
      },
    });
    expect(angenommen.statusCode, angenommen.body).toBe(201);
    expect(angenommen.json().spaceId).toBe(b.instandhaltung);
    const nutzung = await req(b, b.k.erik, "GET", `/api/vorlagen/nutzung/${angenommen.json().id}`);
    expect(nutzung.json().nutzung).toEqual(
      expect.objectContaining({ vorlageId: "std-procedure", version: 1 }),
    );
  });

  it("die verbindliche Vorlage gilt auch bei freier Eingabe; ohne Space bleibt freie Eingabe frei", async () => {
    const b = await buehne();
    await req(b, b.k.carla, "PUT", `/api/vorlagen/space-vorgaben/${b.instandhaltung}`, {
      version: 0,
      verbindlicheVorlageId: "std-faq",
    });
    // Freie Eingabe ohne Space: keine Vorlage, keine Pflicht.
    const frei = await req(b, b.k.erik, "POST", "/api/kos", {
      ...KO,
      title: "Freier Gedanke ohne Struktur",
      category: "Allgemein",
      bodyHtml: "<p>Einfach notiert.</p>",
    });
    expect(frei.statusCode, frei.body).toBe(201);
    // Eine andere Vorlage im Space: die Pflichtfelder der verbindlichen gelten zusätzlich.
    const andere = await req(b, b.k.erik, "POST", "/api/kos", {
      ...KO,
      title: "Regel im Space",
      category: "Allgemein",
      bodyHtml:
        "<h2>Regel</h2><h3>Wofür gilt die Regel?</h3><p>Halle 2.</p><h3>Die Regel</h3><p>Helm tragen.</p>",
      vorlage: { id: "std-regel", version: 1, spaceId: b.instandhaltung },
    });
    expect(andere.statusCode, andere.body).toBe(400);
    expect((andere.json().befunde as { wert: string }[]).map((x) => x.wert)).toEqual(
      expect.arrayContaining(["Frage", "Antwort"]),
    );
  });

  it("ein ausgemusterter persönlicher Standard führt zur Ersatzwahl mit Grund", async () => {
    const b = await buehne();
    const eigene = await req(b, b.k.erik, "POST", "/api/vorlagen", {
      name: "Meine Notiz",
      felder: [{ titel: "Notiz" }],
    });
    const id = eigene.json().id as string;
    expect(
      (await req(b, b.k.erik, "PUT", "/api/vorlagen/standard", { vorlageId: id })).statusCode,
    ).toBe(200);
    const aus = await req(b, b.k.erik, "POST", `/api/vorlagen/${id}/ausmustern`, {
      version: 1,
      begruendung: "Ersetzt durch die Standardvorlage FAQ (fiktiv).",
    });
    expect(aus.statusCode, aus.body).toBe(200);
    const start = await req(b, b.k.erik, "GET", "/api/vorlagen/start");
    expect(start.json()).toEqual(
      expect.objectContaining({
        quelle: "frei",
        vorlage: null,
        ersatzFuer: { id, name: "Meine Notiz", grund: "ausgemustert" },
      }),
    );
    // Eine ausgemusterte Vorlage wird nicht wieder Standard.
    const wieder = await req(b, b.k.erik, "PUT", "/api/vorlagen/standard", { vorlageId: id });
    expect(wieder.statusCode).toBe(409);
  });
});

describe("K5 · K10 · Vorlagenänderung erhält bestehende Beiträge", () => {
  it("Auswirkungen vorher; der bestehende Beitrag behält Werte und Bezug auf seine Fassung", async () => {
    const b = await buehne();
    const anlegen = await req(b, b.k.erik, "POST", "/api/vorlagen", {
      name: "Schichtübergabe",
      geltung: "space",
      spaceId: b.instandhaltung,
      felder: [
        { id: "lage", titel: "Lage", hinweis: "Was läuft? …", pflicht: true },
        { id: "offen", titel: "Offen", hinweis: "Was ist offen? …", art: "liste" },
      ],
    });
    expect(anlegen.statusCode, anlegen.body).toBe(201);
    const id = anlegen.json().id as string;
    const beitrag = await req(b, b.k.erik, "POST", "/api/kos", {
      ...KO,
      title: "Übergabe Frühschicht",
      category: "Allgemein",
      bodyHtml:
        "<h2>Schichtübergabe</h2><h3>Lage</h3><p>Linie 4 steht.</p><h3>Offen</h3><ul><li>Ersatzteil bestellt.</li></ul>",
      vorlage: { id, version: 1, spaceId: b.instandhaltung },
    });
    expect(beitrag.statusCode, beitrag.body).toBe(201);
    const koId = beitrag.json().id as string;
    const bodyVorher = (await req(b, b.k.erik, "GET", `/api/kos/${koId}`)).json().bodyHtml;

    const neu = {
      name: "Schichtübergabe",
      geltung: "space",
      spaceId: b.instandhaltung,
      felder: [
        { id: "lage", titel: "Lage", hinweis: "Was läuft? …", pflicht: true },
        { id: "offen", titel: "Offene Punkte", hinweis: "Was ist offen? …", art: "liste" },
        { id: "sicherheit", titel: "Sicherheit", hinweis: "Gefahren? …", pflicht: true },
      ],
    };
    const vorschau = await req(b, b.k.carla, "POST", `/api/vorlagen/${id}/vorschau`, neu);
    expect(vorschau.statusCode, vorschau.body).toBe(200);
    expect(vorschau.json().nutzung).toEqual(
      expect.objectContaining({ gesamt: 1, jeVersion: [{ version: 1, anzahl: 1 }] }),
    );
    expect(vorschau.json().felder).toEqual(
      expect.objectContaining({
        neu: ["Sicherheit"],
        pflichtNeu: ["Sicherheit"],
        umbenannt: [{ vorher: "Offen", nachher: "Offene Punkte" }],
      }),
    );
    // Carla ist Spacezuständige und darf die geteilte Vorlage ändern.
    const aendern = await req(b, b.k.carla, "PUT", `/api/vorlagen/${id}`, { ...neu, version: 1 });
    expect(aendern.statusCode, aendern.body).toBe(200);
    expect(aendern.json().vorlage.version).toBe(2);
    // Ein zweiter Schreiber mit der alten Fassung verliert.
    const veraltet = await req(b, b.k.erik, "PUT", `/api/vorlagen/${id}`, { ...neu, version: 1 });
    expect(veraltet.statusCode).toBe(409);

    // Der bestehende Beitrag: Inhalt unverändert, Bezug auf Fassung 1 mit deren Struktur.
    expect((await req(b, b.k.erik, "GET", `/api/kos/${koId}`)).json().bodyHtml).toBe(bodyVorher);
    const nutzung = (await req(b, b.k.erik, "GET", `/api/vorlagen/nutzung/${koId}`)).json().nutzung;
    expect(nutzung).toEqual(expect.objectContaining({ version: 1, aktuelleVersion: 2 }));
    expect(nutzung.felder.map((f: { titel: string }) => f.titel)).toEqual(["Lage", "Offen"]);
    // Alle Fassungen bleiben lesbar.
    const fassungen = (await req(b, b.k.mia, "GET", `/api/vorlagen/${id}`)).json().fassungen;
    expect(fassungen.map((f: { version: number }) => f.version)).toEqual([1, 2]);
  });
});

describe("K7 · K11 · Verwaltung: Nutzungsumfang und Begriffspflege je Space", () => {
  it("Umbenennen in einem Space lässt andere Spaces unberührt; Ausmustern entfernt nichts", async () => {
    const b = await buehne();
    const inI = await faqBeitrag(b, b.k.erik, "Dichtung prüfen", ["Dichtung"], b.instandhaltung);
    expect(inI.statusCode, inI.body).toBe(201);
    const imLabor = await faqBeitrag(
      b,
      b.k.fritz,
      "Dichtung im Labor",
      ["Dichtung", "Altlast"],
      b.labor,
    );
    expect(imLabor.statusCode, imLabor.body).toBe(201);

    // Nur die Kontoverwaltung.
    expect((await req(b, b.k.erik, "GET", "/api/vorlagen/verwaltung")).statusCode).toBe(403);
    expect(
      (
        await req(b, b.k.carla, "POST", "/api/vorlagen/begriffe/vorschau", {
          art: "tag",
          vorgang: "ausmustern",
          name: "Altlast",
          begruendung: "fiktiv",
        })
      ).statusCode,
    ).toBe(403);

    const verwaltung = await req(b, b.k.admin, "GET", "/api/vorlagen/verwaltung");
    expect(verwaltung.statusCode, verwaltung.body).toBe(200);
    const faq = (verwaltung.json().vorlagen as { id: string; nutzung: { gesamt: number } }[]).find(
      (v) => v.id === "std-faq",
    );
    expect(faq?.nutzung.gesamt).toBe(2);
    // Der Beitrag im geschlossenen Space ist für die Verwaltung nicht einsehbar: nur als Zahl.
    expect(verwaltung.json().nichtEinsehbar).toBeGreaterThanOrEqual(1);
    const dichtung = (
      verwaltung.json().tags as { name: string; jeSpace: { name: string | null }[] }[]
    ).find((t) => t.name === "Dichtung");
    expect(dichtung?.jeSpace.map((s) => s.name)).toEqual(["Labor"]);

    const auftrag = {
      art: "tag",
      vorgang: "umbenennen",
      name: "Dichtung",
      ziel: "Dichtring",
      spaceId: b.instandhaltung,
      begruendung: "Einheitlicher Begriff im Space (fiktiv).",
    };
    const plan = await req(b, b.k.admin, "POST", "/api/vorlagen/begriffe/vorschau", auftrag);
    expect(plan.statusCode, plan.body).toBe(200);
    expect(plan.json().betroffen.map((z: { koId: string }) => z.koId)).toEqual([inI.json().id]);
    expect(plan.json().unberuehrt).toBe(1);
    // Nur die Ansicht im Geltungsbereich zieht mit; die des Labors bleibt draussen.
    expect(plan.json().ansichten).toEqual([
      expect.objectContaining({ spaceId: b.instandhaltung, ansicht: "Dichtungen" }),
    ]);
    // Ohne bestätigte Vorschau keine Ausführung.
    expect(
      (await req(b, b.k.admin, "POST", "/api/vorlagen/begriffe/ausfuehren", auftrag)).statusCode,
    ).toBe(400);
    const ausgefuehrt = await req(b, b.k.admin, "POST", "/api/vorlagen/begriffe/ausfuehren", {
      ...auftrag,
      grundlage: plan.json().grundlage,
    });
    expect(ausgefuehrt.statusCode, ausgefuehrt.body).toBe(200);
    expect(ausgefuehrt.json().geaendert).toBe(1);

    const iNachher = (await req(b, b.k.erik, "GET", `/api/kos/${inI.json().id}`)).json();
    expect(iNachher.tags).toContain("Dichtring");
    expect(iNachher.tags).not.toContain("Dichtung");
    const lNachher = (await req(b, b.k.fritz, "GET", `/api/kos/${imLabor.json().id}`)).json();
    expect(lNachher.tags).toContain("Dichtung");
    // Die Ansicht im Space folgt dem neuen Begriff (neue Spacefassung) und findet den Beitrag
    // weiter; die Ansicht im Labor ist unverändert.
    expect(ausgefuehrt.json().spaceAnsichtenGeaendert).toEqual([b.instandhaltung]);
    const spaceNachher = (await req(b, b.k.carla, "GET", `/api/spaces/${b.instandhaltung}`)).json();
    const ansicht = spaceNachher.space.ansichten[0] as { id: string; tag: string };
    expect(ansicht.tag).toBe("Dichtring");
    const inAnsicht = await req(
      b,
      b.k.erik,
      "GET",
      `/api/spaces/${b.instandhaltung}/artikel?ansicht=${ansicht.id}`,
    );
    expect(inAnsicht.json().artikel.map((x: { id: string }) => x.id)).toContain(inI.json().id);
    const laborNachher = (await req(b, b.k.fritz, "GET", `/api/spaces/${b.labor}`)).json();
    expect(laborNachher.space.ansichten[0].tag).toBe("Dichtung");

    // Neue Eingabe mit dem alten Begriff wird im Space darauf hingewiesen — im Labor nicht.
    const alt = await faqBeitrag(b, b.k.mia, "Noch eine Dichtung", ["Dichtung"], b.instandhaltung);
    expect(alt.statusCode).toBe(400);
    expect(alt.json().befunde).toEqual([
      expect.objectContaining({ art: "begriff_ersetzt", wert: "Dichtung" }),
    ]);
    const labor = await faqBeitrag(b, b.k.fritz, "Weitere Dichtung", ["Dichtung"], b.labor);
    expect(labor.statusCode, labor.body).toBe(201);

    // Ausmustern (überall): kein Beitrag verliert den Begriff; neue Eingaben werden hingewiesen.
    const ausAuftrag = {
      art: "tag",
      vorgang: "ausmustern",
      name: "Altlast",
      begruendung: "Wird nicht mehr gepflegt (fiktiv).",
    };
    const ausPlan = await req(b, b.k.admin, "POST", "/api/vorlagen/begriffe/vorschau", ausAuftrag);
    expect(ausPlan.json().betroffen).toHaveLength(1);
    const aus = await req(b, b.k.admin, "POST", "/api/vorlagen/begriffe/ausfuehren", {
      ...ausAuftrag,
      grundlage: ausPlan.json().grundlage,
    });
    expect(aus.statusCode, aus.body).toBe(200);
    expect(aus.json().geaendert).toBe(0);
    expect((await req(b, b.k.fritz, "GET", `/api/kos/${imLabor.json().id}`)).json().tags).toContain(
      "Altlast",
    );
    const neuAlt = await faqBeitrag(b, b.k.fritz, "Altlast erneut", ["Altlast"], b.labor);
    expect(neuAlt.json().befunde).toEqual([
      expect.objectContaining({ art: "begriff_ausgemustert", wert: "Altlast" }),
    ]);
  });
});
