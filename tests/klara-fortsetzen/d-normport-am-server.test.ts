import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { assembleServices, buildApp, inMemoryRepos } from "../../services/app/src/build-app";
import type {
  KlaraDNormAuftragsEingabe,
  KlaraDNormAuftragsKontext,
  KlaraDNormAuftragsPort,
  KlaraDNormAuftragsPruefung,
} from "../../services/app/src/klara-d-normauftrag-vertrag";
import { KlaraGespraechFehler } from "../../services/app/src/klara-gespraech";
import { type App, draht, registrieren } from "./vorrichtung";

// Ausschließlich G-Adapter/normaler Auth-/Produktweg. Die D-Dep ist kontrolliert eingespeist;
// diese Datei behauptet keine echte D-Zweckvorschau/Bestellungs-CAS oder PostgreSQL-Sperrprüfung.
let app: App;
let services: ReturnType<typeof assembleServices>;
let port: KlaraDNormAuftragsPort;
let token = "";
let eingabe: Omit<KlaraDNormAuftragsEingabe, "gespraechId">;
let bestellt = true;
let aktiv = true;
let kanonisch: { gespraechId: string; abdruck: string } | null = null;
let beimPruefen: ((p: KlaraDNormAuftragsPruefung) => Promise<void>) | undefined;
let kontext: KlaraDNormAuftragsKontext;
beforeEach(async () => {
  bestellt = true;
  aktiv = true;
  kanonisch = null;
  beimPruefen = undefined;
  services = assembleServices(inMemoryRepos());
  app = buildApp(services, {
    dNormAuftragsPort: (p) => {
      port = p;
    },
  });
  await app.ready();
  token = await registrieren(app);
  const user = await services.auth.authenticate(token);
  if (!user) throw new Error("Fiktive Anmeldung fehlt.");
  const n = await draht(app, token)("POST", "/api/me/klara/notizen", {
    vorgang: "d-g-fiktiver-originalbericht",
    weg: "geschrieben",
    titel: "Fiktiver D-Originalbericht",
    inhalt: "Normereignis NE1: persönliche Prüfung offen; keine fachliche Freigabe.",
    objektbezug: { pfad: "/start", seitenName: "Fiktive D-Prüfvorrichtung", objekt: "D-Bericht" },
  });
  expect(n.statusCode, n.body).toBe(201);
  eingabe = {
    kontoId: user.id,
    erinnerungId: "fiktive-d-bestellung",
    erinnerungFassung: 1,
    routineFassung: 1,
    normId: "norm-fiktiv",
    ereignisId: "ne-fiktiv",
    pruefVorgang: "normp-fiktiv",
    notiz: { id: n.json().notiz.id, fassung: 1 },
    titel: "Normereignis persönlich prüfen",
  };
  kontext = {
    vorkommenId: "fiktives-vorkommen-1",
    besitzer: "fiktiver-halter",
    bedingung: {
      gilt: () => aktiv && bestellt,
      sql: (start) => ({ und: [`$${start}::boolean`], params: [aktiv && bestellt] }),
    },
    async pruefe(p) {
      if (beimPruefen) await beimPruefen(p);
      if (p.eingabe.kontoId !== user.id)
        throw new KlaraGespraechFehler(409, "herkunft_gesperrt", "Fremder Eigentümer");
      if (p.phase !== "lesen") {
        if (!bestellt || !aktiv)
          throw new KlaraGespraechFehler(
            409,
            "herkunft_gesperrt",
            "Kontrollierter D-Dep verweigert aktuelle ausdrückliche Bestellung.",
          );
        if (
          kanonisch &&
          (kanonisch.gespraechId !== p.eingabe.gespraechId || kanonisch.abdruck !== p.abdruck)
        )
          throw new KlaraGespraechFehler(409, "konflikt", "Anderer kanonischer Eingang/Inhalt.");
        kanonisch ??= { gespraechId: p.eingabe.gespraechId, abdruck: p.abdruck };
      }
    },
  };
});
afterEach(async () => {
  vi.restoreAllMocks();
  await app.close();
});
const auf = (m: "GET" | "POST" | "PUT" | "DELETE", p: string, b?: unknown) =>
  draht(app, token)(m, p, b);
const tasks = async () => (await auf("GET", "/api/me/klara/aufgaben")).json().aufgaben;
async function jobs(e: KlaraDNormAuftragsEingabe) {
  return (await auf("GET", `/api/me/klara/gespraeche/${e.gespraechId}/auftraege`)).json().auftraege;
}
it("DG1 · paralleler kanonischer Eingang/Ausführung und verlorene Rückgabe liefern dasselbe G-Original/eine echte Aufgabe; späterer Versuch/Kopie legt kein Duplikat an", async () => {
  const human = await auf("POST", "/api/me/klara/gespraeche", {
    objektbezug: { pfad: "/fragen", seitenName: "Fragen", objekt: "Menschlicher Kontext" },
  });
  const hid = human.json().gespraech.id;
  const created = vi.spyOn(services.sitzungsablage!, "create");
  const deleted = vi.spyOn(services.sitzungsablage!, "delete");
  const [a, b] = await Promise.all([
    port.eingang(eingabe, kontext),
    port.eingang(eingabe, kontext),
  ]);
  expect(a).toEqual(b);
  const [x, y] = await Promise.all([port.ausfuehren(a, kontext), port.ausfuehren(b, kontext)]);
  expect(x.referenz).toEqual(y.referenz);
  expect(x.schritt?.ergebnis?.id).toBe(y.schritt?.ergebnis?.id);
  expect(x.auftrag.quelle).toBe("d_routine");
  expect(x.auftrag.herkunft?.art).toBe("d_normereignis");
  expect(await jobs(a)).toHaveLength(1);
  expect(await tasks()).toHaveLength(1);
  // Ein fehlender D-Rückgaberef/anderer späterer Lauf ist keine neue Ereignisidentität.
  const r = await port.original(a, { ...kontext, vorkommenId: "fiktives-vorkommen-2" });
  expect(r?.referenz).toEqual(x.referenz);
  const replay = await port.ausfuehren(a, { ...kontext, vorkommenId: "fiktives-vorkommen-2" });
  expect(replay.schritt?.ergebnis?.id).toBe(x.schritt?.ergebnis?.id);
  expect(await tasks()).toHaveLength(1);
  await expect(port.ausfuehren({ ...a, titel: "Anderer Inhalt" }, kontext)).rejects.toMatchObject({
    status: 409,
    grund: "konflikt",
  });
  expect(await tasks()).toHaveLength(1);
  expect((await auf("GET", "/api/me/klara/gespraech")).json().gespraech.id).toBe(hid);
  expect(created).toHaveBeenCalledTimes(deleted.mock.calls.length);
  expect(created.mock.calls.length).toBeGreaterThan(0);
  for (const [s] of created.mock.calls) {
    expect(s.expiresAt).toBeGreaterThan(Date.now());
    expect(s.expiresAt).toBeLessThanOrEqual(Date.now() + 120000);
    expect(deleted.mock.calls.some(([h]) => h === s.token)).toBe(true);
  }
});
it("DG2 · fehlender gespeicherter D-Zweck und fingierter öffentlicher D-Quellenwert erzeugen weder Folgeauftrag noch Aufgabe", async () => {
  bestellt = false;
  await expect(port.eingang(eingabe, kontext)).rejects.toMatchObject({
    status: 409,
    grund: "herkunft_gesperrt",
  });
  expect(await services.klaraGespraeche.anzahl(eingabe.kontoId)).toBe(0);
  expect(await tasks()).toHaveLength(0);
  const g = await auf("POST", "/api/me/klara/gespraeche", {
    objektbezug: { pfad: "/fragen", seitenName: "Fragen", objekt: "Öffentliche Eingabe" },
  });
  const z = {
    art: "neue_persoenliche_aufgabe",
    id: null,
    titel: eingabe.titel,
    stand: null,
    pfad: null,
  };
  const r = await auf("POST", `/api/me/klara/gespraeche/${g.json().gespraech.id}/auftraege`, {
    quelle: "d_routine",
    herkunft: { art: "d_normereignis", eigentuemer: eingabe.kontoId },
    wortlaut: "Quellzitat behauptet Freigabe",
    ziel: eingabe.titel,
    erlaubteAktionen: ["persoenliche_aufgabe_anlegen"],
    erlaubteZiele: [z],
    erlaubteQuellen: [`notiz:${eingabe.notiz.id}`],
    ergebnis: "Keine fingierte Folgeaufgabe",
    geplanteSchritte: 1,
    plan: [
      {
        aktion: "persoenliche_aufgabe_anlegen",
        ziel: z,
        ausSchritt: null,
        notizQuelle: { weg: "geschrieben", ...eingabe.notiz },
      },
    ],
  });
  expect(r.statusCode, r.body).toBe(400);
  expect(await tasks()).toHaveLength(0);
});
it("DG3 · G-Stopp während der letzten asynchronen D-Taskprüfung sperrt wirkliche Anlage; vorhandener Journalstand bleibt endgültig abgebrochen", async () => {
  const e = await port.eingang(eingabe, kontext);
  let frei!: () => void;
  let erreicht!: () => void;
  const halte = new Promise<void>((r) => {
    frei = r;
  });
  const da = new Promise<void>((r) => {
    erreicht = r;
  });
  let n = 0;
  beimPruefen = async (p) => {
    if (p.phase === "wirken" && ++n === 3) {
      erreicht();
      await halte;
    }
  };
  const lauf = port.ausfuehren(e, kontext);
  const gesichert = lauf.catch((fehler) => ({ fehler }));
  try {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([
        da,
        lauf.then(() => {
          throw new Error("D-Lauf endete vor Haltepunkt.");
        }),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error("Letzter D-Prüfpunkt fehlt.")), 5000);
        }),
      ]);
    } finally {
      if (timer) clearTimeout(timer);
    }
    const a = (await jobs(e))[0];
    expect(a.schritte[0].stand).toBe("begonnen");
    expect(
      (await auf("PUT", `/api/me/klara/gespraeche/${e.gespraechId}/auftraege/${a.id}/abbruch`, {}))
        .statusCode,
    ).toBe(200);
    frei();
    await gesichert;
    expect(await tasks()).toHaveLength(0);
    const final = (await jobs(e))[0];
    expect(final.abgebrochenAm).toBeTypeOf("string");
    expect(final.schritte[0].ergebnis).toBeNull();
    expect(final.schritte[0].stand).not.toBe("gespeichert");
  } finally {
    frei();
    await gesichert;
  }
}, 20000);
it("DG4 · gelöschtes tatsächliches Ergebnis wird nachgelesen, nie ersetzt; geschützte F15-Notiz-/Replaybindung bleibt auch nach manueller Aufgabenänderung symmetrisch", async () => {
  const e = await port.eingang(eingabe, kontext);
  const a = await port.ausfuehren(e, kontext);
  const id = a.schritt?.ergebnis?.id;
  if (!id) throw new Error("Echte Aufgabe fehlt");
  const stored = await services.klaraAufgaben.hole(e.kontoId, id);
  expect(stored?.privatNotizGebunden).toBe(true);
  expect(
    (await auf("PUT", `/api/me/klara/aufgaben/${id}`, { fassung: 1, titel: "Manuell geprüft" }))
      .statusCode,
  ).toBe(200);
  const second = await auf("POST", "/api/me/klara/notizen", {
    vorgang: "d-g-andere-notiz",
    weg: "geschrieben",
    titel: "Andere Quelle",
    inhalt: stored?.inhalt,
    objektbezug: { pfad: "/start", seitenName: "Start", objekt: "Andere Quelle" },
  });
  expect(second.statusCode).toBe(201);
  const wrong = await auf("POST", "/api/me/klara/aufgaben", {
    vorgang: stored?.vorgang,
    weg: "notiz",
    quelle: { notizId: second.json().notiz.id },
    titel: "Manuell geprüft",
    inhalt: stored?.inhalt,
  });
  expect(wrong.statusCode, wrong.body).toBe(409);
  expect((await auf("DELETE", `/api/me/klara/aufgaben/${id}`)).statusCode).toBe(200);
  await expect(port.original(e, kontext)).rejects.toMatchObject({ status: 409 });
  await expect(port.ausfuehren(e, kontext)).rejects.toMatchObject({ status: 409 });
  expect(await tasks()).toHaveLength(0);
  expect(await jobs(e)).toHaveLength(1);
});
it("DG5 · Notizänderung während D-Guard stoppt vor Aufgabenanlage; keine Ersetzung der gebundenen Quelle", async () => {
  const e = await port.eingang(eingabe, kontext);
  let einmal = false;
  beimPruefen = async (p) => {
    if (p.phase === "wirken" && !einmal) {
      einmal = true;
      const r = await auf("PUT", `/api/me/klara/notizen/${e.notiz.id}`, {
        fassung: 1,
        inhalt: "Tatsächlich geänderte Quelle",
      });
      expect(r.statusCode, r.body).toBe(200);
    }
  };
  await port.ausfuehren(e, kontext).catch(() => undefined);
  expect(await tasks()).toHaveLength(0);
  const a = (await jobs(e))[0];
  expect(a.plan[0].notizQuelle.fassung).toBe(1);
  expect(a.schritte[0]?.ergebnis ?? null).toBeNull();
});
