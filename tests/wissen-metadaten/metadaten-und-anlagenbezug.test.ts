// ================================================================================================
// aufnahme:20260922:gesamt-wissen-metadaten — WISSENSARTEN, METADATEN, KANONISCHER ANLAGENBEZUG.
// ================================================================================================
//
// WAS DIESE DATEI MISST. Die Lücken, die der Abgleich am Bestand gefunden hat, und genau die
// Zusagen, an denen die Originalkriterien hängen — über die ECHTEN Routen (`app.inject` gegen die
// in-process gebaute Anwendung, wie die übrigen Routentests):
//
//   1. Metadaten beim Erfassen (R-0056, R-1690, R-2101, FR-CAP-08): Fachgebiet, Aussageart,
//      Kategorie, Schlagwörter, Anlage und nötige Prüfungen werden am Entwurf gesetzt und stehen
//      nach dem Einreichen am gespeicherten Wissensobjekt. Bis hierher fiel das Fachgebiet auf
//      diesem Weg weg — `toKoInput` zählte es nicht auf, und der Entwurf kannte es nicht.
//   2. Standard 3 nötige Prüfungen ohne Angabe; 0 und 6 werden abgewiesen.
//   3. Tatsache oder Handlungsanweisung (R-0086) als eigene, optionale Angabe.
//   4. Das Fachgebiet ist nachträglich änderbar und entfernbar (R-0034, R-0465) und trägt am
//      direkten Anlageweg dieselbe Längengrenze wie an der Aktion `domain`.
//   5. Der kanonische Anlagenbezug (R-0082) und die Absicherung gegen Fehlkopplung (R-0477): die
//      Lebenszyklus-Kopplung nimmt nur noch sichtbare, existierende Objekte und eine nicht leere,
//      normalisierte Kennung; eine Kennung hängt an mehreren Objekten.
//   6. Anlage, Fachgebiet und Wissensart als Bibliotheksachsen (`libraryFilterValues`), gelesen
//      allein aus den Feldern am Objekt.
//
// DIE GEGENPROBE STEHT NEBEN JEDER ABWEISUNG — sonst belegte ein Fall nur, dass die Route
// überhaupt nichts annimmt.
import { describe, expect, it } from "vitest";
import type { KnowledgeObject as WebKo } from "../../apps/web/src/api/types";
import {
  anlagenAlsEingabe,
  anlagenAusEingabe,
  anlagenMatrix,
} from "../../apps/web/src/lib/anlagen";
import { libraryFilterValues } from "../../apps/web/src/lib/libraryFacets";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import { validateDraftPayloadShape } from "../../services/capture/src/draft-payload-schema";
import { KNOWLEDGE_TYPES, KO_AUSSAGEARTEN, anlagenVon } from "../../services/knowledge-object";

type App = ReturnType<typeof buildApp>;
type Auth = { authorization: string };

// Das geschützte Leerzeichen, das jede Einfügung aus Word oder Excel mitbringt (s. asset.ts).
const NBSP = String.fromCharCode(0xa0);

async function login(app: App, email: string, password: string): Promise<Auth> {
  const res = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email, password },
  });
  if (res.statusCode !== 200) {
    throw new Error(`Anmeldung ${email} fehlgeschlagen: ${res.statusCode} ${res.body}`);
  }
  return { authorization: `Bearer ${res.json().token}` };
}

async function setup(marke: string) {
  const app = buildApp(buildServices());
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Admin", email: `admin@${marke}.test`, password: "geheim12345" },
  });
  const admin = await login(app, `admin@${marke}.test`, "geheim12345");
  for (const email of [`autor@${marke}.test`, `fremd@${marke}.test`]) {
    const res = await app.inject({
      method: "POST",
      url: "/api/users",
      headers: admin,
      payload: { name: email, email, password: "geheim12345", role: "experte" },
    });
    if (res.statusCode !== 201) {
      throw new Error(`Konto ${email} nicht angelegt: ${res.statusCode} ${res.body}`);
    }
  }
  const autor = await login(app, `autor@${marke}.test`, "geheim12345");
  const fremd = await login(app, `fremd@${marke}.test`, "geheim12345");
  return { app, admin, autor, fremd };
}

const GRUNDLAGE = {
  title: "Dosierpumpe bei Druckabfall entlüften",
  statement: "Fällt der Druck an DP-4 unter 2 bar, zuerst entlüften, dann die Membran prüfen.",
  type: "technik",
  category: "Instandhaltung",
  confidentiality: "intern",
};

async function legeAn(app: App, wer: Auth, extra: Record<string, unknown> = {}): Promise<string> {
  const res = await app.inject({
    method: "POST",
    url: "/api/kos",
    headers: wer,
    payload: { ...GRUNDLAGE, ...extra },
  });
  expect(res.statusCode, res.body).toBe(201);
  return res.json().id as string;
}

async function lies(app: App, wer: Auth, id: string) {
  const res = await app.inject({ method: "GET", url: `/api/kos/${id}`, headers: wer });
  expect(res.statusCode, res.body).toBe(200);
  return res.json();
}

async function anzahlObjekte(app: App, wer: Auth): Promise<number> {
  const res = await app.inject({ method: "GET", url: "/api/kos", headers: wer });
  expect(res.statusCode, res.body).toBe(200);
  return (res.json() as unknown[]).length;
}

async function kopplungenVon(app: App, wer: Auth, koId: string): Promise<unknown> {
  const res = await app.inject({
    method: "GET",
    url: `/api/lifecycle/couplings/${koId}`,
    headers: wer,
  });
  expect(res.statusCode, res.body).toBe(200);
  return res.json();
}

async function koppele(app: App, wer: Auth, assetRef: unknown, koId: unknown) {
  return app.inject({
    method: "POST",
    url: "/api/lifecycle/couple",
    headers: wer,
    payload: { assetRef, koId },
  });
}

describe("Metadaten beim Erfassen (R-0056, R-1690, R-2101, FR-CAP-08)", () => {
  it("alle Erfassungsmetadaten stehen nach dem Einreichen am gespeicherten Objekt", async () => {
    const { app, autor } = await setup("wm1");
    const entwurf = await app.inject({
      method: "POST",
      url: "/api/drafts",
      headers: autor,
      payload: {
        ...GRUNDLAGE,
        domain: "  Verfahrenstechnik  ",
        aussageart: "handlungsanweisung",
        tags: ["Pumpe", "Druck"],
        asset: ` Linie L4 /${NBSP}Dosierstation DP-4 `,
        neededValidations: 4,
      },
    });
    expect(entwurf.statusCode, entwurf.body).toBe(201);
    const eingereicht = await app.inject({
      method: "POST",
      url: `/api/drafts/${entwurf.json().id}/promote`,
      headers: autor,
    });
    expect(eingereicht.statusCode, eingereicht.body).toBe(201);

    // Gelesen über den Hauptleseweg — der gespeicherte Stand, nicht die Antwort des Schreibens.
    const ko = await lies(app, autor, eingereicht.json().id as string);
    expect(ko.domain).toBe("Verfahrenstechnik");
    expect(ko.aussageart).toBe("handlungsanweisung");
    expect(ko.category).toBe("Instandhaltung");
    expect(ko.tags).toEqual(["Pumpe", "Druck"]);
    expect(ko.asset).toBe("Linie L4 / Dosierstation DP-4");
    expect(ko.neededValidations).toBe(4);
    expect(ko.type).toBe("technik");
    // FR-KO-01: die übrigen Pflichtfelder des Datenmodells sind am persistierten Objekt da.
    expect(ko.version).toBe(1);
    expect(Array.isArray(ko.history)).toBe(true);
    expect(typeof ko.originalAuthor).toBe("string");
    expect(Array.isArray(ko.assignments)).toBe(true);
    expect(Array.isArray(ko.conditions)).toBe(true);
    expect(Array.isArray(ko.measures)).toBe(true);
  });

  it("ein am Entwurf geleertes Fachgebiet kommt nicht zurück (Merge-Leerwert)", async () => {
    const { app, autor } = await setup("wm2");
    const entwurf = await app.inject({
      method: "POST",
      url: "/api/drafts",
      headers: autor,
      payload: { ...GRUNDLAGE, domain: "Qualität" },
    });
    expect(entwurf.statusCode, entwurf.body).toBe(201);
    const id = entwurf.json().id as string;
    const geleert = await app.inject({
      method: "PUT",
      url: `/api/drafts/${id}`,
      headers: autor,
      payload: { domain: "" },
    });
    expect(geleert.statusCode, geleert.body).toBe(200);
    const eingereicht = await app.inject({
      method: "POST",
      url: `/api/drafts/${id}/promote`,
      headers: autor,
    });
    expect(eingereicht.statusCode, eingereicht.body).toBe(201);
    const ko = await lies(app, autor, eingereicht.json().id as string);
    // Ein leeres Fachgebiet ist keins — kein leerer Text im Bestand.
    expect(ko.domain).toBeUndefined();
  });

  it("Fachgebiet und Aussageart, die kein Text sind, weist schon die Entwurfsgestalt ab", () => {
    expect(validateDraftPayloadShape({ domain: 7 }).ok).toBe(false);
    expect(validateDraftPayloadShape({ aussageart: 1 }).ok).toBe(false);
    // Gegenprobe: Text ist zulässig.
    expect(validateDraftPayloadShape({ domain: "Qualität" }).ok).toBe(true);
    expect(validateDraftPayloadShape({ aussageart: "tatsache" }).ok).toBe(true);
  });

  it("ohne Angabe gilt Standard 3; 0 und 6 werden abgewiesen, 1 und 5 angenommen", async () => {
    const { app, autor } = await setup("wm3");
    const ohne = await lies(app, autor, await legeAn(app, autor));
    expect(ohne.neededValidations).toBe(3);
    for (const falsch of [0, 6]) {
      const res = await app.inject({
        method: "POST",
        url: "/api/kos",
        headers: autor,
        payload: { ...GRUNDLAGE, neededValidations: falsch },
      });
      expect(res.statusCode, `neededValidations ${falsch}: ${res.body}`).toBe(400);
    }
    for (const gut of [1, 5]) {
      const ko = await lies(app, autor, await legeAn(app, autor, { neededValidations: gut }));
      expect(ko.neededValidations).toBe(gut);
    }
  });
});

describe("Tatsache oder Handlungsanweisung (R-0086)", () => {
  it("beide Arten werden gespeichert; ohne Angabe kein Feld; Unbekanntes ist ein 400", async () => {
    const { app, autor } = await setup("wm10");
    expect([...KO_AUSSAGEARTEN]).toEqual(["tatsache", "handlungsanweisung"]);
    for (const art of KO_AUSSAGEARTEN) {
      const ko = await lies(app, autor, await legeAn(app, autor, { aussageart: art }));
      expect(ko.aussageart).toBe(art);
    }
    // Nicht angegeben heißt: kein Feld, nichts abgeleitet.
    const ohne = await lies(app, autor, await legeAn(app, autor));
    expect("aussageart" in ohne).toBe(false);
    const falsch = await app.inject({
      method: "POST",
      url: "/api/kos",
      headers: autor,
      payload: { ...GRUNDLAGE, aussageart: "meinung" },
    });
    expect(falsch.statusCode, falsch.body).toBe(400);
  });
});

describe("Fachgebiet nachträglich und am direkten Anlageweg (R-0034, R-0465)", () => {
  it("setzen, ändern, entfernen — gelesen über den Hauptleseweg", async () => {
    const { app, autor } = await setup("wm4");
    const id = await legeAn(app, autor, { domain: "Instandhaltung" });
    expect((await lies(app, autor, id)).domain).toBe("Instandhaltung");

    const geaendert = await app.inject({
      method: "PUT",
      url: `/api/kos/${id}`,
      headers: autor,
      payload: { action: "domain", domain: "Qualität" },
    });
    expect(geaendert.statusCode, geaendert.body).toBe(200);
    expect((await lies(app, autor, id)).domain).toBe("Qualität");

    const entfernt = await app.inject({
      method: "PUT",
      url: `/api/kos/${id}`,
      headers: autor,
      payload: { action: "domain", domain: "" },
    });
    expect(entfernt.statusCode, entfernt.body).toBe(200);
    expect((await lies(app, autor, id)).domain).toBeUndefined();
  });

  it("ein überlanges Fachgebiet ist beim Anlegen ein 400 — ohne dass ein Objekt entsteht", async () => {
    const { app, autor } = await setup("wm5");
    const vorher = await anzahlObjekte(app, autor);
    const res = await app.inject({
      method: "POST",
      url: "/api/kos",
      headers: autor,
      payload: { ...GRUNDLAGE, domain: "x".repeat(121) },
    });
    expect(res.statusCode, res.body).toBe(400);
    expect(await anzahlObjekte(app, autor)).toBe(vorher);
    // Gegenprobe: genau an der Grenze wird angelegt.
    const ko = await lies(app, autor, await legeAn(app, autor, { domain: "y".repeat(120) }));
    expect(ko.domain).toBe("y".repeat(120));
  });
});

describe("Kanonischer Anlagenbezug und Absicherung gegen Fehlkopplung (R-0082, R-0477)", () => {
  it("eine Kennung hängt an mehreren Objekten, in der Normalform des Objektfelds", async () => {
    const { app, admin, autor } = await setup("wm6");
    const a = await legeAn(app, autor, { asset: "DP-4" });
    const b = await legeAn(app, autor, { asset: "DP-4" });
    for (const id of [a, b]) {
      const res = await koppele(app, autor, `  DP-4${NBSP} `, id);
      expect(res.statusCode, res.body).toBe(204);
    }
    for (const id of [a, b]) {
      const ko = await lies(app, autor, id);
      // Kopplung und kanonisches Feld meinen dieselbe Anlage.
      expect(await kopplungenVon(app, autor, id)).toEqual([ko.asset]);
    }
    // Eine Anlagenänderung trifft beide Objekte, an denen die Kennung hängt (`ko.validate`).
    const meldung = await app.inject({
      method: "POST",
      url: "/api/lifecycle/asset-changed",
      headers: admin,
      payload: { assetRef: "DP-4" },
    });
    expect(meldung.statusCode, meldung.body).toBe(200);
    expect([...(meldung.json() as string[])].sort()).toEqual([a, b].sort());
  });

  it("an eine Kennung, die es nicht gibt, wird nicht gekoppelt — 404", async () => {
    const { app, autor } = await setup("wm7");
    const res = await koppele(app, autor, "DP-4", "ko-gibt-es-nicht-0000");
    expect(res.statusCode, res.body).toBe(404);
  });

  it("an ein Objekt, das der Aufrufer nicht sehen darf, wird nicht gekoppelt — 404", async () => {
    const { app, autor, fremd } = await setup("wm8");
    const geheim = await legeAn(app, autor);
    const stufe = await app.inject({
      method: "PUT",
      url: `/api/kos/${geheim}`,
      headers: autor,
      payload: { action: "confidentiality", level: "vertraulich" },
    });
    expect(stufe.statusCode, stufe.body).toBe(200);
    const unsichtbar = await koppele(app, fremd, "DP-4", geheim);
    const gibtEsNicht = await koppele(app, fremd, "DP-4", "ko-gibt-es-nicht-0000");
    expect(unsichtbar.statusCode, unsichtbar.body).toBe(404);
    // Keine Existenzauskunft über die Meldung.
    expect(unsichtbar.body).toBe(gibtEsNicht.body);
    // Die abgewiesene Kopplung steht nicht im Bestand.
    expect(await kopplungenVon(app, autor, geheim)).toEqual([]);
    // Gegenprobe: der Autor selbst darf an sein vertrauliches Objekt koppeln.
    expect((await koppele(app, autor, "DP-4", geheim)).statusCode).toBe(204);
  });

  it("eine leere oder fehlende Anlagenkennung ist ein 400", async () => {
    const { app, autor } = await setup("wm9");
    const id = await legeAn(app, autor);
    for (const leer of ["", "   ", NBSP, undefined, 7]) {
      const res = await koppele(app, autor, leer, id);
      expect(res.statusCode, `assetRef ${JSON.stringify(leer)}: ${res.body}`).toBe(400);
    }
    const ohneKo = await koppele(app, autor, "DP-4", undefined);
    expect(ohneKo.statusCode, ohneKo.body).toBe(400);
    expect(await kopplungenVon(app, autor, id)).toEqual([]);
  });
});

// Ein Objekt ohne `assets`-Schlüssel — so liegt Altbestand von vor der Anlagenliste vor.
function ohneAnlagenliste(ko: WebKo): WebKo {
  const { assets: _liste, ...rest } = ko;
  return rest;
}

async function revidiere(app: App, wer: Auth, id: string, changes: Record<string, unknown>) {
  const res = await app.inject({
    method: "PUT",
    url: `/api/kos/${id}`,
    headers: wer,
    payload: { action: "revise", changes },
  });
  expect(res.statusCode, res.body).toBe(200);
  return lies(app, wer, id);
}

describe("Mehrere Anlagen kanonisch am Wissensobjekt (R-0082)", () => {
  it("ein Objekt trägt mehrere Anlagen, eine Anlage hängt an mehreren Objekten", async () => {
    const { app, autor } = await setup("wm11");
    const a = await legeAn(app, autor, { assets: [" DP-4 ", "FB-2", "DP-4"] });
    const b = await legeAn(app, autor, { assets: ["DP-4"] });
    const koA = await lies(app, autor, a);
    // Normalform, ohne Doppelte, in Erfassungsreihenfolge; `asset` spiegelt die erste.
    expect(koA.assets).toEqual(["DP-4", "FB-2"]);
    expect(koA.asset).toBe("DP-4");
    const koB = await lies(app, autor, b);
    // Eine einzige Anlage wird wie bisher nur in `asset` gespeichert.
    expect(koB.asset).toBe("DP-4");
    expect("assets" in koB).toBe(false);
    // n:m — DP-4 hängt an beiden, A hängt an zwei Anlagen.
    expect(anlagenVon(koA)).toEqual(["DP-4", "FB-2"]);
    expect(anlagenVon(koB)).toEqual(["DP-4"]);
  });

  it("die Einzelangabe behält ihre Gestalt; Altbestand liest sich aus `asset`", async () => {
    const { app, autor } = await setup("wm12");
    const ko = await lies(app, autor, await legeAn(app, autor, { asset: "DP-4" }));
    expect(ko.asset).toBe("DP-4");
    expect("assets" in ko).toBe(false);
    expect(anlagenVon(ko)).toEqual(["DP-4"]);
    // Altbestand ohne `assets` (vor dieser Regel gespeichert): die Einzelzuordnung gilt weiter.
    expect(anlagenVon({ asset: "DP-4" })).toEqual(["DP-4"]);
    expect(anlagenVon({ asset: null })).toEqual([]);
  });

  it("Ändern: die Liste ersetzen, die erste Anlage setzen, alle entfernen", async () => {
    const { app, autor } = await setup("wm13");
    const id = await legeAn(app, autor, { assets: ["DP-4", "FB-2"] });

    const ersetzt = await revidiere(app, autor, id, { assets: ["FB-2", "PR-7"] });
    expect(ersetzt.assets).toEqual(["FB-2", "PR-7"]);
    expect(ersetzt.asset).toBe("FB-2");

    // Der Einzelweg (JOB 593 D9) setzt nur die erste Anlage; die übrigen bleiben.
    const erste = await revidiere(app, autor, id, { asset: "DP-9" });
    expect(erste.assets).toEqual(["DP-9", "PR-7"]);
    expect(erste.asset).toBe("DP-9");

    // Gegenprobe: eine Änderung ohne Anlagenangabe lässt die Liste stehen.
    const ohne = await revidiere(app, autor, id, { title: "Neuer Titel" });
    expect(ohne.assets).toEqual(["DP-9", "PR-7"]);

    const leer = await revidiere(app, autor, id, { assets: [] });
    expect(leer.asset).toBeNull();
    expect("assets" in leer).toBe(false);
  });
});

describe("Eine ungültige Anlagenliste wird abgewiesen, nicht als Löschung gelesen (R-0082)", () => {
  it("Änderung mit Nichtliste oder ungültigem Eintrag: 400, die Anlagen bleiben", async () => {
    const { app, autor } = await setup("wm16");
    const id = await legeAn(app, autor, { assets: ["DP-4", "FB-2"] });
    for (const falsch of ["DP-4", 7, { a: 1 }, [7], ["DP-4", "  "], ["DP-4", null]]) {
      const res = await app.inject({
        method: "PUT",
        url: `/api/kos/${id}`,
        headers: autor,
        payload: { action: "revise", changes: { assets: falsch } },
      });
      expect(res.statusCode, `assets ${JSON.stringify(falsch)}: ${res.body}`).toBe(400);
      const ko = await lies(app, autor, id);
      expect(ko.assets, `nach ${JSON.stringify(falsch)}`).toEqual(["DP-4", "FB-2"]);
      expect(ko.version, "es entstand keine neue Fassung").toBe(1);
    }
  });

  it("ausdrücklich erlaubte Löschwerte bleiben: null und die leere Liste", async () => {
    const { app, autor } = await setup("wm17");
    const mitNull = await legeAn(app, autor, { assets: ["DP-4", "FB-2"] });
    const geleertNull = await revidiere(app, autor, mitNull, { assets: null });
    expect(geleertNull.asset).toBeNull();
    expect("assets" in geleertNull).toBe(false);
    const mitLeer = await legeAn(app, autor, { assets: ["DP-4", "FB-2"] });
    const geleert = await revidiere(app, autor, mitLeer, { assets: [] });
    expect(geleert.asset).toBeNull();
  });

  it("auch beim Anlegen: Nichtliste oder leerer Eintrag ist ein 400, kein Objekt entsteht", async () => {
    const { app, autor } = await setup("wm18");
    const vorher = await anzahlObjekte(app, autor);
    for (const falsch of ["DP-4", ["DP-4", ""]]) {
      const res = await app.inject({
        method: "POST",
        url: "/api/kos",
        headers: autor,
        payload: { ...GRUNDLAGE, assets: falsch },
      });
      expect(res.statusCode, `assets ${JSON.stringify(falsch)}: ${res.body}`).toBe(400);
    }
    expect(await anzahlObjekte(app, autor)).toBe(vorher);
  });

  it("eine Kennung mit Semikolon übersteht die Bearbeitungsdarstellung unverändert", () => {
    const liste = ["Linie;Station", "A\\B", "Ende\\", "DP-4"];
    expect(anlagenAusEingabe(anlagenAlsEingabe(liste))).toEqual(liste);
    expect(anlagenAusEingabe(anlagenAlsEingabe(["Linie;Station"]))).toEqual(["Linie;Station"]);
    // Ein unmaskiertes Semikolon trennt weiterhin, ein maskiertes nicht.
    expect(anlagenAusEingabe("Linie\\;Station; DP-4")).toEqual(["Linie;Station", "DP-4"]);
    expect(anlagenAusEingabe("DP-4;FB-2")).toEqual(["DP-4", "FB-2"]);
  });
});

describe("Re-Validierungstermin bei der Erstellung (R-1690)", () => {
  it("über Entwurf und Einreichen am Objekt gespeichert, samt mehrerer Anlagen", async () => {
    const { app, autor } = await setup("wm14");
    const entwurf = await app.inject({
      method: "POST",
      url: "/api/drafts",
      headers: autor,
      payload: { ...GRUNDLAGE, assets: ["DP-4", "FB-2"], revalidierungAm: "2027-03-31" },
    });
    expect(entwurf.statusCode, entwurf.body).toBe(201);
    const eingereicht = await app.inject({
      method: "POST",
      url: `/api/drafts/${entwurf.json().id}/promote`,
      headers: autor,
    });
    expect(eingereicht.statusCode, eingereicht.body).toBe(201);
    const ko = await lies(app, autor, eingereicht.json().id as string);
    expect(ko.revalidierungAm).toBe("2027-03-31");
    expect(ko.assets).toEqual(["DP-4", "FB-2"]);
    expect(ko.asset).toBe("DP-4");
  });

  it("direkt angelegt: gültiger Tag gespeichert, ohne Angabe kein Feld, Ungültiges ein 400", async () => {
    const { app, autor } = await setup("wm15");
    const mit = await lies(app, autor, await legeAn(app, autor, { revalidierungAm: "2026-12-01" }));
    expect(mit.revalidierungAm).toBe("2026-12-01");
    const ohne = await lies(app, autor, await legeAn(app, autor));
    expect("revalidierungAm" in ohne).toBe(false);
    for (const falsch of ["2026-02-30", "01.12.2026", "morgen"]) {
      const res = await app.inject({
        method: "POST",
        url: "/api/kos",
        headers: autor,
        payload: { ...GRUNDLAGE, revalidierungAm: falsch },
      });
      expect(res.statusCode, `revalidierungAm ${falsch}: ${res.body}`).toBe(400);
    }
  });

  it("Termin und Anlagenliste, die keine passende Gestalt haben, weist der Entwurf ab", () => {
    expect(validateDraftPayloadShape({ revalidierungAm: 20270331 }).ok).toBe(false);
    expect(validateDraftPayloadShape({ assets: "DP-4" }).ok).toBe(false);
    const passend = validateDraftPayloadShape({ assets: ["DP-4"], revalidierungAm: "2027-03-31" });
    expect(passend.ok).toBe(true);
  });
});

describe("Bibliotheksachsen aus den Feldern am Objekt (R-0034, R-0042, R-0477)", () => {
  const JETZT = Date.parse("2026-10-08T00:00:00.000Z");
  const basis = {
    id: "k1",
    title: "Titel",
    statement: "Aussage",
    conditions: [],
    measures: [],
    type: "negativwissen",
    category: "Instandhaltung",
    tags: [],
    confidence: 0,
    trust: 0,
    status: "offen",
    version: 1,
    originalAuthor: "u1",
    author: "u1",
    neededValidations: 3,
    assignments: [],
    asset: " DP-4 ",
    domain: "Verfahrenstechnik",
    createdAt: "2026-10-01T00:00:00.000Z",
    history: [],
    comments: [],
    attachments: [],
    sources: [],
  } as unknown as WebKo;

  it("Anlage, Fachgebiet und Wissensart stehen als eigene Achsen — ohne Ableitung", () => {
    const werte = libraryFilterValues(basis, JETZT);
    expect(werte.asset).toEqual(["DP-4"]);
    expect(werte.domain).toEqual(["Verfahrenstechnik"]);
    expect(werte.type).toEqual(["negativwissen"]);
    // Gegenprobe: ohne Angabe am Objekt bleiben beide Achsen leer — nichts aus der Kategorie.
    const { domain: _fachgebiet, ...ohneFachgebiet } = basis;
    const ohne = libraryFilterValues({ ...ohneFachgebiet, asset: null }, JETZT);
    expect(ohne.asset).toEqual([]);
    expect(ohne.domain).toEqual([]);
  });

  it("ein Objekt mit mehreren Anlagen steht in der Facette unter jeder davon", () => {
    const mehrere = { ...basis, asset: "DP-4", assets: ["DP-4", "FB-2"] };
    expect(libraryFilterValues(mehrere, JETZT).asset).toEqual(["DP-4", "FB-2"]);
  });

  it("die Matrix ordnet Anlagen und Objekte n:m zu — nur aus den übergebenen Objekten", () => {
    const kos = [
      { ...basis, id: "k1", title: "Pumpe", assets: ["DP-4", "FB-2"] },
      { ...basis, id: "k2", title: "Membran", assets: ["DP-4"] },
      { ...basis, id: "k3", title: "Ohne Anlage", asset: null, assets: [] },
      // Altbestand: nur `asset`, keine Liste.
      { ...ohneAnlagenliste(basis), id: "k4", title: "Alt", asset: "PR-7" },
    ];
    const matrix = anlagenMatrix(kos, (ko) => ko);
    expect(matrix.anlagen).toEqual(["DP-4", "FB-2", "PR-7"]);
    expect(matrix.zeilen.map((z) => z.eintrag.id)).toEqual(["k1", "k2", "k4"]);
    expect(matrix.anzahlJeAnlage.get("DP-4")).toBe(2);
    expect([...(matrix.zeilen[0]?.anlagen ?? [])]).toEqual(["DP-4", "FB-2"]);
  });

  it("es gibt genau die fünf Wissensarten des Originals", () => {
    expect([...KNOWLEDGE_TYPES]).toEqual([
      "bauchgefuehl",
      "best_practice",
      "lernkurve",
      "technik",
      "negativwissen",
    ]);
  });
});
