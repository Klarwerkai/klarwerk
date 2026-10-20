import { afterEach, beforeEach, expect, it } from "vitest";
import { assembleServices, buildApp, inMemoryRepos } from "../../services/app/src/build-app";
import { type App, draht, registrieren } from "./vorrichtung";
let app: App;
let token = "";
beforeEach(async () => {
  app = buildApp(assembleServices(inMemoryRepos()));
  await app.ready();
  token = await registrieren(app);
});
afterEach(async () => {
  await app.close();
});
it("K-GF15 · F15-Korrektur erhält Originale; G/F08 ersetzt keine gebundene Quelle, verwechselt keinen Stempel und legt je bewusst gebundener Quelle nur einen echten Artikel an", async () => {
  const auf = draht(app, token);
  const imported = await auf("POST", "/api/me/klara/besprechungen/import", {
    titel: "Fiktives F15/G-Kompositionsoriginal",
    meetingId: "g-f15-f08-komposition",
    berechtigt: true,
    text: "Beschluss: Nur im Stillstand prüfen.\nAufgabe: Lizenz prüfen.",
  });
  expect(imported.statusCode, imported.body).toBe(200);
  const n = imported.json().notiz;
  const g = await auf("POST", "/api/me/klara/gespraeche", {
    objektbezug: { pfad: "/fragen", seitenName: "Fragen", objekt: "Fiktive F15/F08 Komposition" },
  });
  expect(g.statusCode).toBe(201);
  const basis = `/api/me/klara/gespraeche/${g.json().gespraech.id}/auftraege`;
  const ziel = {
    art: "artikel",
    confidentiality: "intern",
    type: "technik",
    category: "Komposition",
    conditions: ["Stillstand"],
  };
  async function binde(notiz: { id: string; fassung: number; titel: string }) {
    const v = await auf("POST", `/api/me/klara/notizen/${notiz.id}/wissen/vorschau`, {
      fassung: notiz.fassung,
      ziel,
    });
    expect(v.statusCode, v.body).toBe(200);
    const z = {
      art: "neuer_wissensbeitrag",
      id: null,
      titel: notiz.titel,
      stand: null,
      pfad: null,
    };
    const r = await auf("POST", basis, {
      quelle: "getippt",
      wortlaut: "Bewusst das aktuelle private Besprechungsoriginal als Wissen übernehmen",
      ziel: "F15/F08 Kompositionscaller",
      erlaubteAktionen: ["wissen_uebernehmen"],
      erlaubteZiele: [z],
      erlaubteQuellen: [`notiz:${notiz.id}`],
      ergebnis: "Ein tatsächlicher fachlich offener Beitrag",
      geplanteSchritte: 1,
      plan: [
        {
          aktion: "wissen_uebernehmen",
          ziel: z,
          ausSchritt: null,
          wissen: {
            notizId: notiz.id,
            fassung: notiz.fassung,
            ziel,
            stempel: v.json().stempel,
            bewusst: true,
          },
        },
      ],
    });
    expect(r.statusCode, r.body).toBe(201);
    return r.json().auftrag;
  }
  const originalGet = (await auf("GET", `/api/me/klara/notizen/${n.id}`)).body;
  const alt = await binde(n);
  const corrected = await auf("POST", `/api/me/klara/besprechungen/${n.id}/korrektur`, {
    fassung: n.fassung,
    segmentId: "zeile-1",
    text: "Beschluss: Nur im bestätigten Stillstand prüfen.",
  });
  expect(corrected.statusCode, corrected.body).toBe(200);
  const aktuelleNotiz = corrected.json().notiz;
  expect(aktuelleNotiz.id).not.toBe(n.id);
  expect((await auf("GET", `/api/me/klara/notizen/${n.id}`)).body).toBe(originalGet);
  expect(aktuelleNotiz.wissensHerkunft.besprechung.transkriptFassung).toBe(2);
  const verwechselt = await auf("POST", basis, {
    quelle: alt.quelle,
    wortlaut: alt.wortlaut,
    ziel: alt.ziel,
    erlaubteAktionen: alt.erlaubteAktionen,
    erlaubteZiele: alt.erlaubteZiele,
    erlaubteQuellen: [`notiz:${aktuelleNotiz.id}`],
    ergebnis: alt.ergebnis,
    geplanteSchritte: 1,
    plan: alt.plan.map((p: { wissen: { notizId: string; fassung: number } }) => ({
      ...p,
      wissen: { ...p.wissen, notizId: aktuelleNotiz.id, fassung: aktuelleNotiz.fassung },
    })),
  });
  expect(verwechselt.statusCode, verwechselt.body).toBe(409);
  expect(verwechselt.json().grund).toBe("quelle_geaendert");
  expect((await auf("GET", "/api/kos")).json()).toHaveLength(0);
  const altesErgebnis = await auf(
    "POST",
    `${basis}/${alt.id}/schritte/komposition-alt/ausfuehrung`,
    { nr: 1, auftragFassung: 1 },
  );
  expect(altesErgebnis.statusCode, altesErgebnis.body).toBe(200);
  const alterArtikel = (
    await auf("GET", `/api/kos/${altesErgebnis.json().schritt.ergebnis.id}`)
  ).json();
  for (const zeile of n.inhalt.split("\n")) expect(alterArtikel.bodyHtml).toContain(zeile);
  expect(alterArtikel.bodyHtml).not.toContain("bestätigten Stillstand");
  const neu = await binde(aktuelleNotiz);
  const r = await auf("POST", `${basis}/${neu.id}/schritte/komposition-neu/ausfuehrung`, {
    nr: 1,
    auftragFassung: 1,
  });
  expect(r.statusCode, r.body).toBe(200);
  const s = r.json().schritt;
  expect(s.stand).toBe("gespeichert");
  const article = (await auf("GET", `/api/kos/${s.ergebnis.id}`)).json();
  for (const zeile of aktuelleNotiz.inhalt.split("\n")) expect(article.bodyHtml).toContain(zeile);
  expect(article.bodyHtml).toContain(aktuelleNotiz.id);
  expect(article.id).not.toBe(alterArtikel.id);
  expect(article.status).toBe("offen");
  expect(article.createOperation.actor).toBe(neu.verantwortlich);
  const repeated = await auf("POST", `${basis}/${neu.id}/schritte/komposition-neu/ausfuehrung`, {
    nr: 1,
    auftragFassung: 1,
  });
  expect(repeated.json().wiederholt).toBe(true);
  expect(repeated.json().schritt.ergebnis.id).toBe(article.id);
  expect((await auf("GET", "/api/kos")).json()).toHaveLength(2);
  expect((await auf("GET", `/api/me/klara/notizen/${aktuelleNotiz.id}`)).json().notiz.fassung).toBe(
    aktuelleNotiz.fassung,
  );
});
