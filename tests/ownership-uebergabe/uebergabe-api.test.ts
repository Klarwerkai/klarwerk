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
import { responsibleOf } from "../../services/knowledge-object";

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
    const original = b.services.ko.setOwnership.bind(b.services.ko);
    const spion = vi.spyOn(b.services.ko, "setOwnership");
    spion.mockImplementation(async (id, wert, actor) => {
      if (id === b.ko.a3) {
        throw new Error("Ablage nicht erreichbar (Testfall)");
      }
      return original(id, wert, actor);
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
