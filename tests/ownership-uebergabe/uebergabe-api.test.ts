// ================================================================================================
// HAUPTVERANTWORTUNG ÜBERGEBEN · DER DRAHT — einzeln, gesammelt, verteilt, Teilfehler, Deaktivierung.
// ================================================================================================
//
// Gemessen an der ECHTEN App (`buildApp`, Speicherablage). Alle Konten und Inhalte sind erfundene
// Testdaten dieses Falls:
//
//   Ada    (admin)      — Kontoverwaltung, führt die Übergaben aus
//   Paula  (experte)    — verlässt das Team; Autorin von fünf Beiträgen (einer davon vertraulich)
//   Nora   (experte)    — Nachfolgerin 1 (sieht Vertrauliches NICHT)
//   Otto   (controller) — Nachfolger 2 (sieht Vertrauliches)
//   Vera   (viewer)     — darf kein Wissen bearbeiten, ist also keine zulässige Nachfolgerin
//   Gerd   (experte)    — Zugang abgelaufen (kurzfristig gesperrt)
//
// Ordnung zu den Originalkriterien (AUFTRAG-B1.json):
//   K1 · Einzelübertragung und Sammelübertragung mit Aufteilung auf zwei Nachfolger.
//   K2 · Vorschau mit Beiträgen, Zielpersonen und Anzahl; nur zulässige aktive Verantwortliche.
//   K3 · Teilweises Scheitern sichtbar (207, jede offene Zeile) und wiederaufnehmbar.
//   K4 · Danach aktive Hauptverantwortung; Autorschaft, Mitwirkung und Historie erhalten.
//   K5 · Deaktivierung und Löschen ohne ungeklärten Bestand; Abbruch und Wiederholung.
//   K6 · Keine Neufreigabe, keine stille Rechteerweiterung.
import { describe, expect, it, vi } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import type { SpaceFassung } from "../../services/app/src/spaces";
import {
  NachfolgeSiehtBeitragNicht,
  verantwortungBeiAnlage,
} from "../../services/app/src/verantwortung";
import { InMemoryNachfolgeRepo } from "../../services/app/src/verantwortung-nachfolge";
import type { PublicUser } from "../../services/auth";
import { type KnowledgeObject, responsibleOf } from "../../services/knowledge-object";

type App = ReturnType<typeof buildApp>;
type Kopf = { authorization: string };

const KENNWORT = "geheim12345";

interface Zeile {
  koId: string;
  titel: string | null;
  an: string;
  anName: string | null;
}
interface Abgelehnt extends Zeile {
  grund: string;
  text: string;
}
interface Ergebnis {
  von: { id: string; zugang: string };
  uebertragen: Zeile[];
  bereitsErledigt: Zeile[];
  abgelehnt: Abgelehnt[];
  fehlgeschlagen: Abgelehnt[];
  vollstaendig: boolean;
  verbleibt: number;
  gruppen: { an: { id: string; name: string | null }; anzahl: number }[];
}
interface Vorschau {
  gesamt: number;
  bereit: number;
  gruppen: {
    an: { id: string; name: string | null };
    anzahl: number;
    beitraege: { koId: string; titel: string | null }[];
  }[];
  abgelehnt: Abgelehnt[];
  bereitsErledigt: Zeile[];
  verbleibt: number;
}

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
  const services = buildServices();
  const app = buildApp(services);
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Ada Admin", email: "ada@uebergabe.test", password: KENNWORT },
  });
  const admin = await anmelden(app, "ada@uebergabe.test");
  const konten = [
    ["Paula Abgang", "paula@uebergabe.test", "experte"],
    ["Nora Nachfolge", "nora@uebergabe.test", "experte"],
    ["Otto Controller", "otto@uebergabe.test", "controller"],
    ["Vera Viewer", "vera@uebergabe.test", "viewer"],
    ["Gerd Gesperrt", "gerd@uebergabe.test", "experte"],
  ] as const;
  for (const [name, email, role] of konten) {
    const res = await app.inject({
      method: "POST",
      url: "/api/users",
      headers: admin,
      payload: { name, email, password: KENNWORT, role },
    });
    expect(res.statusCode, `Konto ${email}: ${res.body}`).toBe(201);
  }
  const liste = await app.inject({ method: "GET", url: "/api/users", headers: admin });
  const id = (name: string): string => {
    const konto = (liste.json() as { id: string; name: string }[]).find((k) => k.name === name);
    expect(konto, `Konto ${name}`).toBeDefined();
    return konto?.id ?? "";
  };
  const ids = {
    ada: id("Ada Admin"),
    paula: id("Paula Abgang"),
    nora: id("Nora Nachfolge"),
    otto: id("Otto Controller"),
    vera: id("Vera Viewer"),
    gerd: id("Gerd Gesperrt"),
  };
  const k = {
    admin,
    paula: await anmelden(app, "paula@uebergabe.test"),
    nora: await anmelden(app, "nora@uebergabe.test"),
    gerd: await anmelden(app, "gerd@uebergabe.test"),
  };

  const anlegen = async (kopf: Kopf, titel: string, stufe = "intern"): Promise<string> => {
    const res = await app.inject({
      method: "POST",
      url: "/api/kos",
      headers: kopf,
      payload: {
        confidentiality: stufe,
        title: titel,
        statement: `${titel}: wird vor jeder Schicht am Prüfplatz kontrolliert.`,
        type: "best_practice",
        category: "Prüfmittel",
      },
    });
    expect(res.statusCode, res.body).toBe(201);
    return res.json().id as string;
  };
  const ko = {
    a1: await anlegen(k.paula, "Drehmomentschlüssel Linie 1"),
    a2: await anlegen(k.paula, "Messschieber Linie 2"),
    a3: await anlegen(k.paula, "Lehrring Werkstatt"),
    a4: await anlegen(k.paula, "Prüfstift Wareneingang"),
    v1: await anlegen(k.paula, "Kalibrierlabor Zugang", "vertraulich"),
    g1: await anlegen(k.gerd, "Härteprüfung Charge"),
  };
  // A1 ist freigegeben — die Freigabe darf die Übergabe überdauern (K6), der Validierende steht
  // danach als Mitwirkung am Objekt (K4).
  await services.validation.adminValidate(ko.a1, ids.ada);
  // Gerd ist kurzfristig gesperrt: Zugang abgelaufen.
  await services.auth.setAccessExpiry(ids.gerd, "2026-01-01T00:00:00.000Z", ids.ada);
  return { app, services, k, ids, ko };
}

type Buehne = Awaited<ReturnType<typeof buehne>>;

function post(b: Buehne, url: string, payload: unknown, kopf: Kopf = b.k.admin) {
  return b.app.inject({ method: "POST", url, headers: kopf, payload: payload as object });
}

async function verantwortlich(b: Buehne, koId: string): Promise<string> {
  const ko = await b.services.ko.get(koId);
  expect(ko, koId).toBeDefined();
  return ko ? responsibleOf(ko) : "";
}

function aufteilung(b: Buehne) {
  return [
    { koId: b.ko.a1, an: b.ids.nora },
    { koId: b.ko.a2, an: b.ids.nora },
    { koId: b.ko.a3, an: b.ids.otto },
    { koId: b.ko.a4, an: b.ids.otto },
    { koId: b.ko.v1, an: b.ids.otto },
  ];
}

describe("K2 · Bestand und Vorschau", () => {
  it("der Bestand nennt jeden Beitrag und nur zulässige aktive Nachfolger", async () => {
    const b = await buehne();
    const res = await b.app.inject({
      method: "GET",
      url: `/api/verantwortung/person/${b.ids.paula}`,
      headers: b.k.admin,
    });
    expect(res.statusCode, res.body).toBe(200);
    const bestand = res.json() as {
      person: { zugang: string };
      anzahl: number;
      beitraege: { koId: string; titel: string | null; autor: { id: string } }[];
      ziele: { id: string }[];
      vertretung: { id: string }[];
    };
    expect(bestand.person.zugang).toBe("aktiv");
    expect(bestand.anzahl).toBe(5);
    expect(bestand.beitraege.map((z) => z.koId).sort()).toEqual(
      [b.ko.a1, b.ko.a2, b.ko.a3, b.ko.a4, b.ko.v1].sort(),
    );
    const ziele = bestand.ziele.map((z) => z.id);
    expect(ziele).toEqual(expect.arrayContaining([b.ids.nora, b.ids.otto, b.ids.ada]));
    // Nicht wählbar: die Person selbst, ein Betrachter, ein abgelaufener Zugang.
    expect(ziele).not.toContain(b.ids.paula);
    expect(ziele).not.toContain(b.ids.vera);
    expect(ziele).not.toContain(b.ids.gerd);
    // Ein Experte ohne Kontoverwaltung kommt an den Bestand gar nicht heran.
    const fremd = await b.app.inject({
      method: "GET",
      url: `/api/verantwortung/person/${b.ids.paula}`,
      headers: b.k.nora,
    });
    expect(fremd.statusCode).toBe(403);
  });

  it("die Vorschau zeigt je Nachfolger Anzahl und Beiträge — und schreibt nichts", async () => {
    const b = await buehne();
    const res = await post(b, "/api/verantwortung/vorschau", {
      von: b.ids.paula,
      zuteilung: aufteilung(b),
    });
    expect(res.statusCode, res.body).toBe(200);
    const v = res.json() as Vorschau;
    expect(v.gesamt).toBe(5);
    expect(v.bereit).toBe(5);
    expect(v.abgelehnt).toEqual([]);
    expect(v.verbleibt).toBe(0);
    const je = Object.fromEntries(v.gruppen.map((g) => [g.an.name, g.anzahl]));
    expect(je).toEqual({ "Nora Nachfolge": 2, "Otto Controller": 3 });
    const nora = v.gruppen.find((g) => g.an.id === b.ids.nora);
    expect(nora?.beitraege.map((z) => z.titel).sort()).toEqual([
      "Drehmomentschlüssel Linie 1",
      "Messschieber Linie 2",
    ]);
    // Nichts geschehen.
    for (const koId of Object.values(b.ko).filter((id) => id !== b.ko.g1)) {
      expect(await verantwortlich(b, koId)).toBe(b.ids.paula);
    }
  });

  it("unzulässige Ziele werden je Zeile mit Grund abgelehnt", async () => {
    const b = await buehne();
    const res = await post(b, "/api/verantwortung/vorschau", {
      von: b.ids.paula,
      zuteilung: [
        { koId: b.ko.a1, an: b.ids.vera },
        { koId: b.ko.a2, an: b.ids.gerd },
        { koId: b.ko.a3, an: b.ids.paula },
        { koId: b.ko.a4, an: "konto-gibt-es-nicht" },
        { koId: b.ko.v1, an: b.ids.nora },
      ],
    });
    expect(res.statusCode, res.body).toBe(200);
    const v = res.json() as Vorschau;
    const gruende = Object.fromEntries(v.abgelehnt.map((z) => [z.koId, z.grund]));
    expect(gruende).toEqual({
      [b.ko.a1]: "ZIEL_OHNE_SCHREIBRECHT",
      [b.ko.a2]: "ZIEL_NICHT_AKTIV",
      [b.ko.a3]: "ZIEL_IST_PERSON",
      [b.ko.a4]: "ZIEL_UNBEKANNT",
      [b.ko.v1]: "ZIEL_SIEHT_BEITRAG_NICHT",
    });
    expect(v.bereit).toBe(0);
    expect(v.abgelehnt.every((z) => z.text.length > 0)).toBe(true);
  });

  it("ein Beitrag mit zwei verschiedenen Nachfolgern ist ein Eingabefehler", async () => {
    const b = await buehne();
    const res = await post(b, "/api/verantwortung/vorschau", {
      von: b.ids.paula,
      zuteilung: [
        { koId: b.ko.a1, an: b.ids.nora },
        { koId: b.ko.a1, an: b.ids.otto },
      ],
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe("ZUTEILUNG_UNGUELTIG");
  });
});

describe("K1/K4/K6 · Übergabe", () => {
  it("Einzelübertragung: ein Beitrag an einen Nachfolger", async () => {
    const b = await buehne();
    const res = await post(b, "/api/verantwortung/uebergabe", {
      von: b.ids.paula,
      zuteilung: [{ koId: b.ko.a2, an: b.ids.nora }],
    });
    expect(res.statusCode, res.body).toBe(200);
    const e = res.json() as Ergebnis;
    expect(e.vollstaendig).toBe(true);
    expect(e.uebertragen.map((z) => z.koId)).toEqual([b.ko.a2]);
    expect(e.verbleibt).toBe(4);
    expect(await verantwortlich(b, b.ko.a2)).toBe(b.ids.nora);
    expect(await verantwortlich(b, b.ko.a1)).toBe(b.ids.paula);
  });

  it("Sammelübertragung auf zwei Nachfolger — Autorschaft, Mitwirkung, Freigabe und Historie bleiben", async () => {
    const b = await buehne();
    const vorher = new Map<string, Awaited<ReturnType<typeof b.services.ko.get>>>();
    for (const { koId } of aufteilung(b)) {
      vorher.set(koId, await b.services.ko.get(koId));
    }
    const res = await post(b, "/api/verantwortung/uebergabe", {
      von: b.ids.paula,
      zuteilung: aufteilung(b),
    });
    expect(res.statusCode, res.body).toBe(200);
    const e = res.json() as Ergebnis;
    expect(e.vollstaendig).toBe(true);
    expect(e.uebertragen).toHaveLength(5);
    expect(e.verbleibt).toBe(0);
    expect(Object.fromEntries(e.gruppen.map((g) => [g.an.id, g.anzahl]))).toEqual({
      [b.ids.nora]: 2,
      [b.ids.otto]: 3,
    });

    for (const { koId, an } of aufteilung(b)) {
      const alt = vorher.get(koId);
      const neu = await b.services.ko.get(koId);
      expect(neu?.ownership?.owner, koId).toBe(an);
      // Autorschaft
      expect(neu?.author).toBe(b.ids.paula);
      expect(neu?.originalAuthor).toBe(alt?.originalAuthor);
      // Freigabe und Fassung (K6: keine Neufreigabe, keine neue Fassung)
      expect(neu?.status).toBe(alt?.status);
      expect(neu?.version).toBe(alt?.version);
      expect(neu?.validationDecisionRef).toEqual(alt?.validationDecisionRef);
      // Historie und Mitwirkung
      expect(neu?.history.length).toBe(alt?.history.length);
      expect(neu?.ownership?.validators ?? []).toEqual(alt?.ownership?.validators ?? []);
      expect(neu?.ownership?.reviewers ?? []).toEqual(alt?.ownership?.reviewers ?? []);
    }
    const a1 = await b.services.ko.get(b.ko.a1);
    expect(a1?.status).toBe("validiert");
    expect(a1?.ownership?.validators).toContain(b.ids.ada);

    // Je Beitrag ein Beleg mit dem vorherigen Stand, dazu die Zusammenfassung des Vorgangs.
    const protokoll = await b.services.audit.list();
    const belege = protokoll.filter((x) => x.action === "ko.ownership");
    expect(belege.map((x) => x.target).sort()).toEqual(
      aufteilung(b)
        .map((z) => z.koId)
        .sort(),
    );
    const zusammenfassung = protokoll.filter((x) => x.action === "verantwortung.uebergabe");
    expect(zusammenfassung).toHaveLength(1);
    expect(zusammenfassung[0]?.target).toBe(b.ids.paula);
    expect(zusammenfassung[0]?.actor).toBe(b.ids.ada);
  });

  it("K6: eine Übergabe öffnet keinen Zugang — Nora sieht den vertraulichen Beitrag weiterhin nicht", async () => {
    const b = await buehne();
    const vorher = await b.app.inject({
      method: "GET",
      url: `/api/kos/${b.ko.v1}`,
      headers: b.k.nora,
    });
    expect(vorher.statusCode).toBe(404);
    const res = await post(b, "/api/verantwortung/uebergabe", {
      von: b.ids.paula,
      zuteilung: [{ koId: b.ko.v1, an: b.ids.nora }],
    });
    expect(res.statusCode, res.body).toBe(207);
    const e = res.json() as Ergebnis;
    expect(e.vollstaendig).toBe(false);
    expect(e.abgelehnt.map((z) => z.grund)).toEqual(["ZIEL_SIEHT_BEITRAG_NICHT"]);
    expect(await verantwortlich(b, b.ko.v1)).toBe(b.ids.paula);
    const nachher = await b.app.inject({
      method: "GET",
      url: `/api/kos/${b.ko.v1}`,
      headers: b.k.nora,
    });
    expect(nachher.statusCode).toBe(404);
  });
});

describe("K3 · Teilweises Scheitern und Wiederaufnahme", () => {
  it("ein gescheiterter Beitrag steht als offen da; dieselbe Zuteilung holt genau ihn nach", async () => {
    const b = await buehne();
    // Nacharbeit 4: der Schreibweg der Übergabe ist `uebertrageVerantwortung` (vergleichend, gesperrt).
    const original = b.services.ko.uebertrageVerantwortung.bind(b.services.ko);
    const spion = vi.spyOn(b.services.ko, "uebertrageVerantwortung");
    spion.mockImplementation(async (id, erwartet, nachfolger, actor) => {
      if (id === b.ko.a3) {
        throw new Error("Ablage nicht erreichbar (Testfall)");
      }
      return original(id, erwartet, nachfolger, actor);
    });
    const plan = aufteilung(b).filter((z) => z.koId !== b.ko.v1);
    const eingabe = { von: b.ids.paula, zuteilung: plan };
    const erster = await post(b, "/api/verantwortung/uebergabe", eingabe);
    spion.mockRestore();

    expect(erster.statusCode, erster.body).toBe(207);
    const e1 = erster.json() as Ergebnis;
    expect(e1.vollstaendig).toBe(false);
    expect(e1.uebertragen.map((z) => z.koId).sort()).toEqual([b.ko.a1, b.ko.a2, b.ko.a4].sort());
    expect(e1.fehlgeschlagen.map((z) => [z.koId, z.grund])).toEqual([[b.ko.a3, "SCHREIBFEHLER"]]);
    expect(e1.fehlgeschlagen[0]?.text).toContain("erneut übertragen");
    // A3 und der nicht zugeteilte V1 liegen noch bei Paula — beides wird gezählt.
    expect(e1.verbleibt).toBe(2);
    expect(await verantwortlich(b, b.ko.a3)).toBe(b.ids.paula);

    const zweiter = await post(b, "/api/verantwortung/uebergabe", eingabe);
    expect(zweiter.statusCode, zweiter.body).toBe(200);
    const e2 = zweiter.json() as Ergebnis;
    expect(e2.vollstaendig).toBe(true);
    expect(e2.uebertragen.map((z) => z.koId)).toEqual([b.ko.a3]);
    expect(e2.bereitsErledigt.map((z) => z.koId).sort()).toEqual(
      [b.ko.a1, b.ko.a2, b.ko.a4].sort(),
    );
    expect(await verantwortlich(b, b.ko.a3)).toBe(b.ids.otto);
    // Nichts doppelt geschrieben: genau ein Beleg je Beitrag.
    const belege = (await b.services.audit.list()).filter((x) => x.action === "ko.ownership");
    expect(belege.filter((x) => x.target === b.ko.a1)).toHaveLength(1);
    expect(belege.filter((x) => x.target === b.ko.a3)).toHaveLength(1);
  });

  it("eine zwischenzeitlich anders vergebene Verantwortung wird nicht überschrieben", async () => {
    const b = await buehne();
    await b.services.ko.setOwnership(b.ko.a1, { owner: b.ids.otto }, b.ids.ada);
    const res = await post(b, "/api/verantwortung/uebergabe", {
      von: b.ids.paula,
      zuteilung: [{ koId: b.ko.a1, an: b.ids.nora }],
    });
    expect(res.statusCode).toBe(207);
    expect((res.json() as Ergebnis).abgelehnt.map((z) => z.grund)).toEqual([
      "NICHT_MEHR_BEI_PERSON",
    ]);
    expect(await verantwortlich(b, b.ko.a1)).toBe(b.ids.otto);
  });
});

describe("K5 · Deaktivierung und Löschen ohne ungeklärten Bestand", () => {
  it("Abbruch, Teilübergabe und Wiederholung — deaktiviert wird erst ohne Restbestand", async () => {
    const b = await buehne();
    // Ohne Übergabe: abgewiesen, das Konto bleibt aktiv.
    const ohne = await post(b, "/api/verantwortung/deaktivierung", { person: b.ids.paula });
    expect(ohne.statusCode, ohne.body).toBe(409);
    expect(ohne.json()).toMatchObject({ error: "BESTAND_OFFEN", verbleibt: 5 });
    await anmelden(b.app, "paula@uebergabe.test");

    // Löschen ist ebenso gesperrt — auf beiden Löschwegen.
    for (const url of [`/api/users/${b.ids.paula}`, `/api/auth/users/${b.ids.paula}`]) {
      const loeschen = await b.app.inject({ method: "DELETE", url, headers: b.k.admin });
      expect(loeschen.statusCode, `${url}: ${loeschen.body}`).toBe(409);
      expect(loeschen.json().error).toBe("BESTAND_OFFEN");
    }

    // Abbruch nach der Vorschau: es ist nichts geschehen.
    await post(b, "/api/verantwortung/vorschau", { von: b.ids.paula, zuteilung: aufteilung(b) });
    expect(await verantwortlich(b, b.ko.a1)).toBe(b.ids.paula);

    // Teilübergabe (drei von fünf): übergeben wird, deaktiviert nicht.
    const teil = await post(b, "/api/verantwortung/deaktivierung", {
      person: b.ids.paula,
      zuteilung: aufteilung(b).slice(0, 3),
    });
    expect(teil.statusCode, teil.body).toBe(409);
    expect(teil.json().verbleibt).toBe(2);
    expect((teil.json().uebergabe as Ergebnis).uebertragen).toHaveLength(3);
    await anmelden(b.app, "paula@uebergabe.test");

    // Wiederholung mit der vollständigen Zuteilung: Rest übergeben, dann deaktiviert.
    const voll = await post(b, "/api/verantwortung/deaktivierung", {
      person: b.ids.paula,
      zuteilung: aufteilung(b),
    });
    expect(voll.statusCode, voll.body).toBe(200);
    const v = voll.json() as {
      konto: { zugang: string };
      bereitsInaktiv: boolean;
      uebergabe: Ergebnis;
    };
    expect(v.konto.zugang).toBe("abgelaufen");
    expect(v.bereitsInaktiv).toBe(false);
    expect(v.uebergabe.bereitsErledigt).toHaveLength(3);
    expect(v.uebergabe.uebertragen).toHaveLength(2);
    const login = await b.app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "paula@uebergabe.test", password: KENNWORT },
    });
    expect(login.statusCode).toBe(403);
    // Die alte Sitzung trägt ebenfalls nicht mehr.
    const alt = await b.app.inject({ method: "GET", url: "/api/auth/me", headers: b.k.paula });
    expect(alt.statusCode).toBe(401);

    // Noch einmal: kein Fehler, kein zweiter Vermerk.
    const nochmal = await post(b, "/api/verantwortung/deaktivierung", { person: b.ids.paula });
    expect(nochmal.statusCode).toBe(200);
    expect(nochmal.json().bereitsInaktiv).toBe(true);

    // Nun darf das Konto auch gelöscht werden — es bleibt nichts ungeklärt.
    const loeschen = await b.app.inject({
      method: "DELETE",
      url: `/api/users/${b.ids.paula}`,
      headers: b.k.admin,
    });
    expect(loeschen.statusCode, loeschen.body).toBe(204);
    for (const { koId, an } of aufteilung(b)) {
      expect(await verantwortlich(b, koId)).toBe(an);
    }
  });

  it("das eigene Konto wird hier nicht deaktiviert", async () => {
    const b = await buehne();
    const res = await post(b, "/api/verantwortung/deaktivierung", { person: b.ids.ada });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe("SELBST");
  });
});

describe("K4/K5 · Bestand ohne aktive Verantwortung und Vertretung", () => {
  it("gesperrte und gelöschte Konten erscheinen mit Anzahl und Vertretung — nach der Übergabe nicht mehr", async () => {
    const b = await buehne();
    // Ein Altfall: ein Konto, das am Löschschutz vorbei (Dienst) entfernt wurde, trägt noch einen Beitrag.
    const dora = await b.app.inject({
      method: "POST",
      url: "/api/users",
      headers: b.k.admin,
      payload: {
        name: "Dora Damals",
        email: "dora@uebergabe.test",
        password: KENNWORT,
        role: "experte",
      },
    });
    expect(dora.statusCode, dora.body).toBe(201);
    const doraId = dora.json().id as string;
    const doraKo = await b.app.inject({
      method: "POST",
      url: "/api/kos",
      headers: await anmelden(b.app, "dora@uebergabe.test"),
      payload: {
        confidentiality: "intern",
        title: "Altbestand Sichtprüfung",
        statement: "Altbestand Sichtprüfung: einmal je Woche.",
        type: "best_practice",
        category: "Prüfmittel",
      },
    });
    expect(doraKo.statusCode, doraKo.body).toBe(201);
    const d1 = doraKo.json().id as string;
    await b.services.auth.deleteUser(doraId, b.ids.ada);

    const ungeklaert = async () => {
      const res = await b.app.inject({
        method: "GET",
        url: "/api/verantwortung/ungeklaert",
        headers: b.k.admin,
      });
      expect(res.statusCode, res.body).toBe(200);
      return res.json() as {
        personen: { id: string; name: string | null; zugang: string; anzahl: number }[];
        vertretung: { id: string }[];
      };
    };
    const vorher = await ungeklaert();
    expect(vorher.personen).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: b.ids.gerd, zugang: "abgelaufen", anzahl: 1 }),
        expect.objectContaining({ id: doraId, zugang: "geloescht", name: null, anzahl: 1 }),
      ]),
    );
    expect(vorher.personen.map((p) => p.id)).not.toContain(b.ids.paula);
    // Vertretung nach dem Rollenmodell: aktive Konten mit `ko.validate`.
    expect(vorher.vertretung.map((p) => p.id).sort()).toEqual([b.ids.ada, b.ids.otto].sort());

    const gerd = await b.app.inject({
      method: "GET",
      url: `/api/verantwortung/person/${b.ids.gerd}`,
      headers: b.k.admin,
    });
    expect(gerd.json().person.zugang).toBe("abgelaufen");
    expect(gerd.json().vertretung.map((p: { id: string }) => p.id)).toContain(b.ids.otto);

    for (const [von, koId] of [
      [b.ids.gerd, b.ko.g1],
      [doraId, d1],
    ] as const) {
      const res = await post(b, "/api/verantwortung/uebergabe", {
        von,
        zuteilung: [{ koId, an: b.ids.nora }],
      });
      expect(res.statusCode, res.body).toBe(200);
      expect(await verantwortlich(b, koId)).toBe(b.ids.nora);
    }
    const nachher = await ungeklaert();
    const offen = nachher.personen.map((p) => p.id);
    expect(offen).not.toContain(b.ids.gerd);
    expect(offen).not.toContain(doraId);
    // Jeder Beitrag dieses Falls hat danach eine aktive Hauptverantwortung.
    const unsere = new Set([...Object.values(b.ko), d1]);
    const ohne = (await b.services.ko.list({})).filter(
      (ko) => unsere.has(ko.id) && offen.includes(responsibleOf(ko)),
    );
    expect(ohne).toEqual([]);
  });
});

// ================================================================================================
// NACHARBEIT 2 — Bens vier Befunde, je eine Gegenprobe am Draht.
// ================================================================================================

const KUENFTIG = "2099-12-31T23:59:59.000Z";

async function bestandVon(b: Buehne, person: string) {
  const res = await b.app.inject({
    method: "GET",
    url: `/api/verantwortung/person/${person}`,
    headers: b.k.admin,
  });
  expect(res.statusCode, res.body).toBe(200);
  return res.json() as {
    person: { zugang: string };
    anzahl: number;
    beitraege: { koId: string; imPapierkorb: boolean; zulaessig: string[] }[];
    ziele: { id: string }[];
  };
}

describe("Nacharbeit 2 · K5 — die Befristung ist ein Kontoende und braucht eine Übergabe", () => {
  it("eine Befristung über die Kontobearbeitung wird bei offenem Bestand abgewiesen, danach nicht", async () => {
    const b = await buehne();
    const befristen = () =>
      b.app.inject({
        method: "PUT",
        url: `/api/users/${b.ids.paula}`,
        headers: b.k.admin,
        payload: { accessExpiresAt: KUENFTIG },
      });
    const abgewiesen = await befristen();
    expect(abgewiesen.statusCode, abgewiesen.body).toBe(409);
    expect(abgewiesen.json()).toMatchObject({ error: "BESTAND_OFFEN", verbleibt: 5 });
    const liste = await b.app.inject({ method: "GET", url: "/api/users", headers: b.k.admin });
    const paula = (liste.json() as { id: string; accessExpiresAt?: string }[]).find(
      (k) => k.id === b.ids.paula,
    );
    expect(paula?.accessExpiresAt, "es wurde nichts befristet").toBeUndefined();
    // Andere Kontoänderungen bleiben frei: die Rolle lässt sich weiter ändern.
    const rolle = await b.app.inject({
      method: "PUT",
      url: `/api/users/${b.ids.paula}`,
      headers: b.k.admin,
      payload: { role: "experte" },
    });
    expect(rolle.statusCode, rolle.body).toBe(200);

    const uebergabe = await post(b, "/api/verantwortung/uebergabe", {
      von: b.ids.paula,
      zuteilung: aufteilung(b),
    });
    expect(uebergabe.statusCode, uebergabe.body).toBe(200);
    const gesetzt = await befristen();
    expect(gesetzt.statusCode, gesetzt.body).toBe(200);
    expect(gesetzt.json().accessExpiresAt).toBe(KUENFTIG);
  });

  it("ein befristetes Konto ist kein Nachfolger, und sein eigener Bestand gilt schon vor dem Ablauf als ungeklärt", async () => {
    const b = await buehne();
    // Nora schreibt einen Beitrag und wird danach befristet — am Hook vorbei über den Dienst, so wie
    // es ein Bestand von VOR dieser Nacharbeit wäre.
    const n1 = await b.app.inject({
      method: "POST",
      url: "/api/kos",
      headers: b.k.nora,
      payload: {
        confidentiality: "intern",
        title: "Noras Prüfanweisung",
        statement: "Noras Prüfanweisung: täglich.",
        type: "best_practice",
        category: "Prüfmittel",
      },
    });
    expect(n1.statusCode, n1.body).toBe(201);
    await b.services.auth.setAccessExpiry(b.ids.nora, KUENFTIG, b.ids.ada);

    const bestand = await bestandVon(b, b.ids.paula);
    expect(bestand.ziele.map((z) => z.id)).not.toContain(b.ids.nora);
    for (const zeile of bestand.beitraege) {
      expect(zeile.zulaessig).not.toContain(b.ids.nora);
    }
    const v = await post(b, "/api/verantwortung/vorschau", {
      von: b.ids.paula,
      zuteilung: [{ koId: b.ko.a1, an: b.ids.nora }],
    });
    expect((v.json() as Vorschau).abgelehnt.map((z) => z.grund)).toEqual(["ZIEL_BEFRISTET"]);

    const ungeklaert = await b.app.inject({
      method: "GET",
      url: "/api/verantwortung/ungeklaert",
      headers: b.k.admin,
    });
    expect(ungeklaert.json().personen).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: b.ids.nora, zugang: "befristet", anzahl: 1 }),
      ]),
    );
  });
});

describe("Nacharbeit 2 · K2 — Nachfolger je Beitrag und Paket", () => {
  it("der Bestand nennt je Beitrag die zulässigen Nachfolger; wer einen Beitrag nicht sehen darf, fehlt dort", async () => {
    const b = await buehne();
    const bestand = await bestandVon(b, b.ids.paula);
    const zulaessig = (koId: string) =>
      bestand.beitraege.find((z) => z.koId === koId)?.zulaessig ?? [];
    // Der vertrauliche Beitrag: Otto (controller) ja, Nora (experte, nicht Autorin) nein.
    expect(zulaessig(b.ko.v1)).toContain(b.ids.otto);
    expect(zulaessig(b.ko.v1)).not.toContain(b.ids.nora);
    // Ein interner Beitrag: beide.
    expect(zulaessig(b.ko.a1)).toEqual(expect.arrayContaining([b.ids.nora, b.ids.otto]));
    // Nie die Person selbst, nie ein Viewer, nie ein abgelaufenes Konto.
    for (const zeile of bestand.beitraege) {
      expect(zeile.zulaessig).not.toContain(b.ids.paula);
      expect(zeile.zulaessig).not.toContain(b.ids.vera);
      expect(zeile.zulaessig).not.toContain(b.ids.gerd);
    }
  });
});

describe("Nacharbeit 2 · K3/K4 — ein inzwischen inaktiver Nachfolger ist bei Wiederholung nicht erledigt", () => {
  it("Wiederholung nach Ablauf des Nachfolgers meldet unvollständig; der Beitrag wird als ungeklärt neu zugeteilt", async () => {
    const b = await buehne();
    const plan = { von: b.ids.paula, zuteilung: [{ koId: b.ko.a2, an: b.ids.nora }] };
    const erster = await post(b, "/api/verantwortung/uebergabe", plan);
    expect(erster.statusCode, erster.body).toBe(200);
    // Noras Zugang läuft ab (Dienstweg = tatsächlicher Fristablauf, am Hook vorbei).
    await b.services.auth.setAccessExpiry(b.ids.nora, "2026-01-02T00:00:00.000Z", b.ids.ada);

    const wiederholung = await post(b, "/api/verantwortung/uebergabe", plan);
    expect(wiederholung.statusCode, wiederholung.body).toBe(207);
    const e = wiederholung.json() as Ergebnis;
    expect(e.vollstaendig).toBe(false);
    expect(e.bereitsErledigt).toEqual([]);
    expect(e.abgelehnt.map((z) => [z.koId, z.grund])).toEqual([[b.ko.a2, "ZIEL_NICHT_AKTIV"]]);
    // Nichts geschrieben: genau ein Beleg für A2.
    const belege = (await b.services.audit.list()).filter(
      (x) => x.action === "ko.ownership" && x.target === b.ko.a2,
    );
    expect(belege).toHaveLength(1);

    const ungeklaert = await b.app.inject({
      method: "GET",
      url: "/api/verantwortung/ungeklaert",
      headers: b.k.admin,
    });
    expect(ungeklaert.json().personen).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: b.ids.nora, zugang: "abgelaufen", anzahl: 1 }),
      ]),
    );
    const neu = await post(b, "/api/verantwortung/uebergabe", {
      von: b.ids.nora,
      zuteilung: [{ koId: b.ko.a2, an: b.ids.otto }],
    });
    expect(neu.statusCode, neu.body).toBe(200);
    expect(await verantwortlich(b, b.ko.a2)).toBe(b.ids.otto);
  });
});

describe("Nacharbeit 2 · K5 — wiederherstellbarer Bestand im Papierkorb", () => {
  it("Papierkorb zählt zum Bestand, sperrt das Löschen und wird mit übergeben; nach Wiederherstellung trägt der Nachfolger", async () => {
    const b = await buehne();
    await b.services.ko.delete(b.ko.a4, b.ids.ada);
    expect(await b.services.ko.get(b.ko.a4), "A4 liegt im Papierkorb").toBeUndefined();

    const bestand = await bestandVon(b, b.ids.paula);
    expect(bestand.anzahl).toBe(5);
    expect(bestand.beitraege.find((z) => z.koId === b.ko.a4)?.imPapierkorb).toBe(true);

    // Alle LEBENDEN Beiträge übergeben — es bleibt nur der Papierkorb.
    const lebend = aufteilung(b).filter((z) => z.koId !== b.ko.a4);
    const teil = await post(b, "/api/verantwortung/uebergabe", {
      von: b.ids.paula,
      zuteilung: lebend,
    });
    expect(teil.statusCode, teil.body).toBe(200);
    expect((teil.json() as Ergebnis).verbleibt).toBe(1);
    const loeschen = await b.app.inject({
      method: "DELETE",
      url: `/api/users/${b.ids.paula}`,
      headers: b.k.admin,
    });
    expect(loeschen.statusCode, loeschen.body).toBe(409);
    expect(loeschen.json()).toMatchObject({ error: "BESTAND_OFFEN", verbleibt: 1 });

    const rest = await post(b, "/api/verantwortung/uebergabe", {
      von: b.ids.paula,
      zuteilung: [{ koId: b.ko.a4, an: b.ids.otto }],
    });
    expect(rest.statusCode, rest.body).toBe(200);
    const beleg = (await b.services.audit.list()).find(
      (x) => x.action === "ko.ownership" && x.target === b.ko.a4,
    );
    expect(beleg?.payload).toMatchObject({ owner: b.ids.otto, imPapierkorb: true });

    const jetzt = await b.app.inject({
      method: "DELETE",
      url: `/api/users/${b.ids.paula}`,
      headers: b.k.admin,
    });
    expect(jetzt.statusCode, jetzt.body).toBe(204);

    await b.services.ko.restore(b.ko.a4, b.ids.ada);
    const zurueck = await b.services.ko.get(b.ko.a4);
    expect(zurueck?.ownership?.owner).toBe(b.ids.otto);
    expect(zurueck?.author, "die Autorschaft bleibt").toBe(b.ids.paula);
  });
});

// ================================================================================================
// NACHARBEIT 4 — Bens zwei Befunde, je eine Gegenprobe am Draht.
// ================================================================================================

describe("Nacharbeit 4 · K3/K4 — überlappende Übergaben und zwischenzeitliche Mitwirkung", () => {
  it("eine Übergabe, deren Vorabstand überholt ist, überschreibt die gewonnene nicht und meldet die Zeile offen", async () => {
    const b = await buehne();
    // Genau zwischen dem Laden des Bestands und dem Schreiben gewinnt eine andere Übergabe (A1 → Otto).
    const original = b.services.ko.listEinschliesslichPapierkorb.bind(b.services.ko);
    vi.spyOn(b.services.ko, "listEinschliesslichPapierkorb").mockImplementationOnce(async () => {
      const veraltet = await original();
      const gewonnen = await b.services.ko.uebertrageVerantwortung(
        b.ko.a1,
        b.ids.paula,
        b.ids.otto,
        b.ids.ada,
      );
      expect(gewonnen).toBe("uebertragen");
      return veraltet;
    });
    const res = await post(b, "/api/verantwortung/uebergabe", {
      von: b.ids.paula,
      zuteilung: [{ koId: b.ko.a1, an: b.ids.nora }],
    });
    expect(res.statusCode, res.body).toBe(207);
    const e = res.json() as Ergebnis;
    expect(e.uebertragen).toEqual([]);
    expect(e.abgelehnt.map((z) => [z.koId, z.grund])).toEqual([[b.ko.a1, "NICHT_MEHR_BEI_PERSON"]]);
    expect(await verantwortlich(b, b.ko.a1), "die gewonnene Übergabe bleibt").toBe(b.ids.otto);
    const belege = (await b.services.audit.list()).filter(
      (x) => x.action === "ko.ownership" && x.target === b.ko.a1,
    );
    expect(belege).toHaveLength(1);
  });

  it("zwei gleichzeitige Übergaben desselben Beitrags: genau eine meldet Erfolg, und sie gilt", async () => {
    const b = await buehne();
    const [an1, an2] = await Promise.all([
      post(b, "/api/verantwortung/uebergabe", {
        von: b.ids.paula,
        zuteilung: [{ koId: b.ko.a2, an: b.ids.nora }],
      }),
      post(b, "/api/verantwortung/uebergabe", {
        von: b.ids.paula,
        zuteilung: [{ koId: b.ko.a2, an: b.ids.otto }],
      }),
    ]);
    const ergebnisse = [an1.json() as Ergebnis, an2.json() as Ergebnis];
    const gewinner = ergebnisse.flatMap((e) => e.uebertragen);
    expect(gewinner).toHaveLength(1);
    expect(ergebnisse.flatMap((e) => e.abgelehnt).map((z) => z.grund)).toEqual([
      "NICHT_MEHR_BEI_PERSON",
    ]);
    expect(await verantwortlich(b, b.ko.a2)).toBe(gewinner[0]?.an);
  });

  it("zwischenzeitlich ergänzte Prüfende bleiben erhalten — ersetzt wird nur der Owner", async () => {
    const b = await buehne();
    const original = b.services.ko.listEinschliesslichPapierkorb.bind(b.services.ko);
    vi.spyOn(b.services.ko, "listEinschliesslichPapierkorb").mockImplementationOnce(async () => {
      const veraltet = await original();
      // Nach dem Laden, vor dem Schreiben: Otto wird Prüfer von A1.
      await b.services.ko.recordOwnershipRole(b.ko.a1, "reviewers", [b.ids.otto], b.ids.ada);
      return veraltet;
    });
    const res = await post(b, "/api/verantwortung/uebergabe", {
      von: b.ids.paula,
      zuteilung: [{ koId: b.ko.a1, an: b.ids.nora }],
    });
    expect(res.statusCode, res.body).toBe(200);
    const a1 = await b.services.ko.get(b.ko.a1);
    expect(a1?.ownership?.owner).toBe(b.ids.nora);
    expect(a1?.ownership?.reviewers).toContain(b.ids.otto);
    expect(a1?.ownership?.validators).toContain(b.ids.ada);
  });
});

describe("Nacharbeit 4 · K5 — Beiträge, die nach gesetzter Befristung entstehen", () => {
  async function kontoMit(b: Buehne, name: string, email: string): Promise<string> {
    const res = await b.app.inject({
      method: "POST",
      url: "/api/users",
      headers: b.k.admin,
      payload: { name, email, password: KENNWORT, role: "experte" },
    });
    expect(res.statusCode, res.body).toBe(201);
    return res.json().id as string;
  }

  function anlegenAls(b: Buehne, kopf: Kopf, titel: string) {
    return b.app.inject({
      method: "POST",
      url: "/api/kos",
      headers: kopf,
      payload: {
        confidentiality: "intern",
        title: titel,
        statement: `${titel}: monatlich.`,
        type: "best_practice",
        category: "Prüfmittel",
      },
    });
  }

  function befristen(b: Buehne, konto: string, payload: Record<string, unknown>) {
    return b.app.inject({
      method: "PUT",
      url: `/api/users/${konto}`,
      headers: b.k.admin,
      payload,
    });
  }

  it("befristen, Beitrag erstellen, Frist ablaufen lassen — der Beitrag behält eine aktive Hauptverantwortung", async () => {
    const b = await buehne();
    const bea = await kontoMit(b, "Bea Befristet", "bea@uebergabe.test");
    const beaKopf = await anmelden(b.app, "bea@uebergabe.test");

    const gesetzt = await befristen(b, bea, { accessExpiresAt: KUENFTIG });
    expect(gesetzt.statusCode, gesetzt.body).toBe(200);
    const stand = await b.app.inject({
      method: "GET",
      url: `/api/verantwortung/person/${bea}`,
      headers: b.k.admin,
    });
    const nachfolge = stand.json().nachfolgeBeiBefristung as { id: string } | null;
    expect(nachfolge?.id, "ohne Angabe: die befristende Verwaltung").toBe(b.ids.ada);

    // Das Bearbeitungsrecht bleibt: Bea legt weiter an — die Verantwortung trägt die Nachfolge.
    const neu = await anlegenAls(b, beaKopf, "Beas Messanweisung");
    expect(neu.statusCode, neu.body).toBe(201);
    const koId = neu.json().id as string;
    const ko = await b.services.ko.get(koId);
    expect(ko?.author, "die Autorschaft bleibt bei Bea").toBe(bea);
    expect(ko?.ownership?.owner).toBe(b.ids.ada);
    const lesen = await b.app.inject({ method: "GET", url: `/api/kos/${koId}`, headers: beaKopf });
    expect(lesen.statusCode).toBe(200);

    // Die Frist läuft ab (Dienstweg = der tatsächliche Ablauf, ohne Kontoroute).
    await b.services.auth.setAccessExpiry(bea, "2026-01-02T00:00:00.000Z", b.ids.ada);
    const anmeldung = await b.app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "bea@uebergabe.test", password: KENNWORT },
    });
    expect(anmeldung.statusCode).toBe(403);
    expect(await verantwortlich(b, koId)).toBe(b.ids.ada);
    const ungeklaert = await b.app.inject({
      method: "GET",
      url: "/api/verantwortung/ungeklaert",
      headers: b.k.admin,
    });
    const offen = (ungeklaert.json().personen as { id: string }[]).map((p) => p.id);
    expect(offen).not.toContain(bea);
    expect(offen).not.toContain(b.ids.ada);
  });

  it("eine ausdrücklich benannte Nachfolge gilt; eine unzulässige wird abgewiesen; ohne Befristung entfällt sie", async () => {
    const b = await buehne();
    const cleo = await kontoMit(b, "Cleo Befristet", "cleo@uebergabe.test");
    const cleoKopf = await anmelden(b.app, "cleo@uebergabe.test");

    const unzulaessig = await befristen(b, cleo, {
      accessExpiresAt: KUENFTIG,
      verantwortungNachfolge: b.ids.vera,
    });
    expect(unzulaessig.statusCode, unzulaessig.body).toBe(400);
    expect(unzulaessig.json().error).toBe("NACHFOLGE_UNZULAESSIG");
    const liste = await b.app.inject({ method: "GET", url: "/api/users", headers: b.k.admin });
    const vorher = (liste.json() as { id: string; accessExpiresAt?: string }[]).find(
      (k) => k.id === cleo,
    );
    expect(vorher?.accessExpiresAt, "es wurde nichts befristet").toBeUndefined();

    const mitOtto = await befristen(b, cleo, {
      accessExpiresAt: KUENFTIG,
      verantwortungNachfolge: b.ids.otto,
    });
    expect(mitOtto.statusCode, mitOtto.body).toBe(200);
    const k1 = await anlegenAls(b, cleoKopf, "Cleos Prüfplan");
    expect(k1.statusCode, k1.body).toBe(201);
    expect((await b.services.ko.get(k1.json().id as string))?.ownership?.owner).toBe(b.ids.otto);

    const unbefristet = await befristen(b, cleo, { accessExpiresAt: null });
    expect(unbefristet.statusCode, unbefristet.body).toBe(200);
    const k2 = await anlegenAls(b, cleoKopf, "Cleos zweiter Prüfplan");
    expect(k2.statusCode, k2.body).toBe(201);
    const ohne = await b.services.ko.get(k2.json().id as string);
    expect(ohne?.ownership?.owner, "unbefristet trägt Cleo selbst").toBeUndefined();
    expect(await verantwortlich(b, k2.json().id as string)).toBe(cleo);
  });

  it("ein befristetes Konto ohne benannte Nachfolge (Altbestand) legt nichts an, das ohne Verantwortung bliebe", async () => {
    const b = await buehne();
    // Befristet am Kontoweg vorbei — so, wie es ein Bestand von vor dieser Nacharbeit wäre.
    await b.services.auth.setAccessExpiry(b.ids.nora, KUENFTIG, b.ids.ada);
    const res = await anlegenAls(b, b.k.nora, "Noras neue Anweisung");
    expect(res.statusCode, res.body).toBe(400);
    expect(res.json().error).toBe("NACHFOLGE_FEHLT");
    // Die Kontoverwaltung speichert die Befristung erneut — jetzt mit Nachfolge — und es geht.
    const erneut = await befristen(b, b.ids.nora, { accessExpiresAt: KUENFTIG });
    expect(erneut.statusCode, erneut.body).toBe(200);
    const danach = await anlegenAls(b, b.k.nora, "Noras neue Anweisung");
    expect(danach.statusCode, danach.body).toBe(201);
    const neu = await b.services.ko.get(danach.json().id as string);
    expect(neu?.ownership?.owner).toBe(b.ids.ada);
  });
});

// ================================================================================================
// NACHARBEIT 6 — die Nachfolge bei Anlage prüft das Leserecht am KONKRETEN Beitrag.
// ================================================================================================

describe("Nacharbeit 6 · K5/K6 — Nachfolge bei Anlage: Vertraulichkeit und Space", () => {
  it("eine Nachfolge, die einen vertraulichen Beitrag nicht lesen darf, wird nicht Owner — die Anlage nennt den Grund", async () => {
    const b = await buehne();
    const anlegen = await b.app.inject({
      method: "POST",
      url: "/api/users",
      headers: b.k.admin,
      payload: {
        name: "Bea Befristet",
        email: "bea6@uebergabe.test",
        password: KENNWORT,
        role: "experte",
      },
    });
    expect(anlegen.statusCode, anlegen.body).toBe(201);
    const bea = anlegen.json().id as string;
    const beaKopf = await anmelden(b.app, "bea6@uebergabe.test");
    // Nachfolge: Nora (Expertin) — sie sieht Vertrauliches fremder Autoren NICHT.
    const gesetzt = await b.app.inject({
      method: "PUT",
      url: `/api/users/${bea}`,
      headers: b.k.admin,
      payload: { accessExpiresAt: KUENFTIG, verantwortungNachfolge: b.ids.nora },
    });
    expect(gesetzt.statusCode, gesetzt.body).toBe(200);

    const neuAls = (stufe: string, titel: string) =>
      b.app.inject({
        method: "POST",
        url: "/api/kos",
        headers: beaKopf,
        payload: {
          confidentiality: stufe,
          title: titel,
          statement: `${titel}: nur für das Labor.`,
          type: "best_practice",
          category: "Prüfmittel",
        },
      });
    const vorher = (await b.services.ko.list({})).length;
    const geheim = await neuAls("vertraulich", "Beas Laborzugang");
    expect(geheim.statusCode, geheim.body).toBe(400);
    expect(geheim.json().error).toBe("NACHFOLGE_SIEHT_BEITRAG_NICHT");
    expect((await b.services.ko.list({})).length, "es ist nichts entstanden").toBe(vorher);

    // Derselbe Weg mit einem internen Beitrag: Nora darf lesen und wird Owner.
    const intern = await neuAls("intern", "Beas Messanweisung");
    expect(intern.statusCode, intern.body).toBe(201);
    const ko = await b.services.ko.get(intern.json().id as string);
    expect(ko?.ownership?.owner).toBe(b.ids.nora);
    expect(ko?.author).toBe(bea);

    // Mit einer Nachfolge, die Vertrauliches lesen darf (Otto, Controller), gelingt auch der
    // vertrauliche Beitrag — ohne dass Nora dadurch Zugang bekommt.
    const umgestellt = await b.app.inject({
      method: "PUT",
      url: `/api/users/${bea}`,
      headers: b.k.admin,
      payload: { accessExpiresAt: KUENFTIG, verantwortungNachfolge: b.ids.otto },
    });
    expect(umgestellt.statusCode, umgestellt.body).toBe(200);
    const zweiter = await neuAls("vertraulich", "Beas Laborzugang");
    expect(zweiter.statusCode, zweiter.body).toBe(201);
    const zweitesKo = zweiter.json().id as string;
    expect((await b.services.ko.get(zweitesKo))?.ownership?.owner).toBe(b.ids.otto);
    const nora = await b.app.inject({
      method: "GET",
      url: `/api/kos/${zweitesKo}`,
      headers: b.k.nora,
    });
    expect(nora.statusCode, "keine Rechteerweiterung").toBe(404);
  });

  it("der Lieferant prüft den führenden Space des Beitrags: ohne Leserecht im Space keine Nachfolge", async () => {
    // Am Lieferanten selbst, weil kein Anlageweg einen Space mitgibt (er entsteht nur über den
    // Spacewechsel mit Rechtevorschau). Die Regel ist dieselbe `darfSehen`-Prüfung wie bei jeder
    // Übergabe; hier wird sie mit einem geschlossenen Space vorgelegt.
    const jetzt = Date.parse("2026-10-08T12:00:00.000Z");
    const konten: Record<string, PublicUser> = {
      bea: {
        id: "bea",
        name: "Bea",
        email: "bea@lieferant.test",
        role: "experte",
        approved: true,
        createdAt: "2026-01-01T00:00:00.000Z",
        accessExpiresAt: "2099-12-31T23:59:59.000Z",
      },
      nora: {
        id: "nora",
        name: "Nora",
        email: "nora@lieferant.test",
        role: "experte",
        approved: true,
        createdAt: "2026-01-01T00:00:00.000Z",
      },
    };
    const raum = (mitglieder: SpaceFassung["mitglieder"]): SpaceFassung => ({
      id: "werkstatt",
      version: 1,
      name: "Werkstatt",
      zweck: "Geschlossener Arbeitsraum.",
      verantwortlich: "bea",
      zugang: "mitglieder",
      mitglieder,
      ansichten: [],
      angelegtVon: "bea",
      angelegtAm: "2026-01-01T00:00:00.000Z",
      geaendertVon: "bea",
      geaendertAm: "2026-01-01T00:00:00.000Z",
    });
    const nachfolge = new InMemoryNachfolgeRepo();
    await nachfolge.setze({
      konto: "bea",
      nachfolger: "nora",
      gesetztVon: "ada",
      gesetztAm: "2026-10-08T00:00:00.000Z",
    });
    const beitrag = {
      id: "k1",
      author: "bea",
      confidentiality: "intern",
      spaceId: "werkstatt",
    } as unknown as KnowledgeObject;
    const lieferant = (mitglieder: SpaceFassung["mitglieder"]) =>
      verantwortungBeiAnlage(
        async (id) => konten[id],
        nachfolge,
        async () => [raum(mitglieder)],
        () => jetzt,
      );

    await expect(lieferant([])(beitrag)).rejects.toBeInstanceOf(NachfolgeSiehtBeitragNicht);
    await expect(lieferant([{ nutzer: "nora", recht: "lesen" }])(beitrag)).resolves.toBe("nora");
    // Ohne Space genügt das allgemeine Leserecht.
    const ohneSpace = { ...beitrag, spaceId: undefined } as unknown as KnowledgeObject;
    await expect(lieferant([])(ohneSpace)).resolves.toBe("nora");
  });
});
