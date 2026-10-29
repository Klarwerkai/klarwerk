import { afterEach, describe, expect, it, vi } from "vitest";
import { GesamtanweisungDienst } from "../../services/knowledge-object/src/gesamtanweisung-service";
import type { AnweisungLesestand } from "../../services/knowledge-object/src/gesamtanweisung-types";
import { mussGelingen } from "../gast-nutzerweg/strecke";
import { type Welt, welt } from "./pruefstand";

let w: Welt | undefined;
afterEach(async () => { vi.restoreAllMocks(); await w?.schliessen(); w = undefined; });

async function start() { w = await welt(); return w; }

describe("KO15/M12 · gelöschte GA-Quellen am authentifizierten HTTP-Endpunkt", () => {
  for (const purge of [false, true]) it(`${purge ? "Endlöschung" : "Papierkorb"}: Kopf und sichtbare Reihenfolge, volle Bindungen/Historie und CAS`, async () => {
    const x = await start();
    const vorher = await x.bestand();
    await x.entfernen(purge);
    const url = `/api/gesamtanweisungen/${x.kanonisch.id}`;
    const lesen = mussGelingen("GET nach Verlust", await x.admin.sende("GET", url));
    x.ohneSpur(lesen.text);
    expect((lesen.json as AnweisungLesestand).unvollstaendig).toBe(true);
    const kopf = mussGelingen("Kopf trotz Verlust", await x.admin.sende("PUT", url, { version: x.kanonisch.version, titel: "GA weiter bearbeitet" }));
    x.ohneSpur(kopf.text);
    const k = kopf.json as AnweisungLesestand;
    expect(k).toMatchObject({ titel: "GA weiter bearbeitet", version: x.kanonisch.version + 1, stand: "entwurf", unvollstaendig: true, verborgeneBausteine: 2 });
    expect(k.bausteine.map((b) => b.id)).toEqual([x.kanonisch.bausteine[0]!.id, x.kanonisch.bausteine[2]!.id]);
    expect((await x.bestand()).anweisung?.bausteine).toEqual(x.kanonisch.bausteine);
    const visible = [...k.bausteine].reverse().map((b) => b.id);
    const ordnen = mussGelingen("sichtbare Plätze tauschen", await x.admin.sende("PUT", `${url}/reihenfolge`, { version: k.version, reihenfolge: visible }));
    x.ohneSpur(ordnen.text);
    const o = ordnen.json as AnweisungLesestand;
    expect(o).toMatchObject({ version: k.version + 1, unvollstaendig: true, verborgeneBausteine: 2, stand: "entwurf" });
    expect(o.bausteine.map((b) => b.id)).toEqual(visible);
    const nachher = await x.bestand();
    const [a, b, c, d] = x.kanonisch.bausteine;
    expect(nachher.anweisung?.bausteine).toEqual([{ ...c, position: 0 }, b, { ...a, position: 2 }, d]);
    expect(nachher.historie.slice(0, vorher.historie.length)).toEqual(vorher.historie);
    expect(nachher.historie).toHaveLength(vorher.historie.length + 2);
    expect(nachher.historie.at(-1)?.bausteine.map(({ inhalt: _inhalt, voraussetzung, ...rest }) => ({ ...rest, voraussetzung: voraussetzung ?? undefined }))).toEqual(nachher.anweisung?.bausteine);
    const readback = mussGelingen("GET nach Schreiben", await x.admin.sende("GET", url));
    x.ohneSpur(readback.text);
    expect(readback.json).toMatchObject({ titel: k.titel, version: o.version, bausteine: o.bausteine, unvollstaendig: true });
    for (const [pfad, payload] of [[url, { version: k.version, titel: "veraltet" }], [`${url}/reihenfolge`, { version: k.version, reihenfolge: visible }]] as const) {
      const konflikt = await x.admin.sende("PUT", pfad, payload);
      expect(konflikt.status).toBe(409); x.ohneSpur(konflikt.text);
      expect(await x.bestand()).toEqual(nachher);
    }
    for (const folge of [[], [visible[0], visible[0]], [...visible, b!.id], [visible[0], "fremder-baustein"]]) {
      const abgelehnt = await x.admin.sende("PUT", `${url}/reihenfolge`, { version: o.version, reihenfolge: folge });
      expect(abgelehnt.status).toBe(400); x.ohneSpur(abgelehnt.text);
      expect(await x.bestand()).toEqual(nachher);
    }
    const vorlegen = await x.admin.sende("POST", `${url}/vorlegen`, { version: o.version });
    expect(vorlegen.status).toBe(403); x.ohneSpur(vorlegen.text);
    expect(await x.bestand()).toEqual(nachher);
  });

  it("lebende vertrauliche und später entzogene Quellrechte bleiben neutral 403 ohne Zustandseffekt", async () => {
    const x = await start(); const url = `/api/gesamtanweisungen/${x.kanonisch.id}`;
    const vorher = await x.bestand();
    for (const sitzung of [x.experte, x.admin]) {
      if (sitzung === x.admin) {
        // Aktuelle Quellrechte durch den echten KO-Dienst entziehen; alte Snapshots bleiben offen.
        await x.services.ko.setQuellrechte(x.quellen[1]!.koId, { quelle: "confluence", stufe: "intern", leser: ["anderer-leser"], version: 1 }, x.nutzer.id);
      }
      for (const [pfad, payload] of [[url, { version: x.kanonisch.version, titel: "verboten" }], [`${url}/reihenfolge`, { version: x.kanonisch.version, reihenfolge: [] }]] as const) {
        const antwort = await sitzung.sende("PUT", pfad, payload);
        expect(antwort.status).toBe(403); x.ohneSpur(antwort.text);
        expect(antwort.json).toEqual({ error: "FORBIDDEN", message: "Teile dieser Anweisung sind für Sie nicht zugänglich." });
        expect(await x.bestand()).toEqual(vorher);
      }
      const get = mussGelingen("GET verdeckt", await sitzung.sende("GET", url));
      expect(get.text).not.toContain(x.quellen[1]!.koId);
    }
  });

  it("echte aktuelle Leseausfälle sind keine Löschung: beide Schreibtüren bleiben geschlossen", async () => {
    const x = await start(); const url = `/api/gesamtanweisungen/${x.kanonisch.id}`; const vorher = await x.bestand();
    const originalGet = x.services.ko.get.bind(x.services.ko);
    const originalVersions = x.services.ko.versionsOf.bind(x.services.ko);
    const ausfaelle = [
      { method: "get", starte: () => vi.spyOn(x.services.ko, "get").mockImplementation(async (id) => {
        if (id === x.quellen[1]!.koId) throw new Error("aktueller Quellenabruf gescheitert");
        return originalGet(id);
      }) },
      { method: "versionsOf", starte: () => vi.spyOn(x.services.ko, "versionsOf").mockImplementation(async (id) => {
        if (id === x.quellen[1]!.koId) throw new Error("Fassungsabruf gescheitert");
        return originalVersions(id);
      }) },
    ];
    for (const { method, starte } of ausfaelle) {
      const spy = starte();
      for (const pfad of [url, `${url}/reihenfolge`]) {
        const antwort = await x.admin.sende("PUT", pfad, { version: x.kanonisch.version, titel: "nicht schreiben", reihenfolge: [] });
        expect(antwort.status).toBe(403); x.ohneSpur(antwort.text);
        expect(await x.bestand()).toEqual(vorher);
      }
      const get = mussGelingen("GET bleibt ehrlich", await x.admin.sende("GET", url));
      expect((get.json as AnweisungLesestand).aenderungspruefung.ergebnis).toBe("fehlgeschlagen");
      if (method === "get") expect(get.text).not.toContain(x.quellen[1]!.koId);
      spy.mockRestore();
    }
  });

  it("fehlendes Rechteprädikat erlaubt auch bei ausschließlich fehlenden Quellen keine Änderung", async () => {
    const x = await start();
    for (const quelle of x.quellen) mussGelingen("alle Quellen in Papierkorb", await x.admin.sende("DELETE", `/api/kos/${quelle.koId}`), 204);
    const vorher = await x.bestand();
    const dienst = new GesamtanweisungDienst({ repo: x.services.anweisungen, ko: x.services.ko, jetzt: () => new Date().toISOString(), kennung: () => "nicht-benutzt" });
    await expect(dienst.kopfAendern(x.kanonisch.id, x.kanonisch.version, { titel: "darf nicht" }, undefined)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(dienst.reihenfolgeSetzen(x.kanonisch.id, x.kanonisch.version, [], undefined)).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(await x.bestand()).toEqual(vorher);
    // Mit tatsächlicher Rechteentscheidung ist selbst der ganz verwaiste Kopf bearbeitbar.
    const kopf = mussGelingen("ganz verwaister Kopf", await x.admin.sende("PUT", `/api/gesamtanweisungen/${x.kanonisch.id}`, { version: x.kanonisch.version, titel: "Kopf ohne Quellen" }));
    expect(kopf.json).toMatchObject({ bausteine: [], unvollstaendig: true, verborgeneBausteine: 4 });
    for (const b of x.kanonisch.bausteine) expect(kopf.text).not.toContain(b.koId);
    const ordnen = mussGelingen("leere sichtbare Reihenfolge erhält alle Bindungen", await x.admin.sende("PUT", `/api/gesamtanweisungen/${x.kanonisch.id}/reihenfolge`, { version: (kopf.json as AnweisungLesestand).version, reihenfolge: [] }));
    expect(ordnen.json).toMatchObject({ bausteine: [], unvollstaendig: true, verborgeneBausteine: 4 });
    expect((await x.bestand()).anweisung?.bausteine).toEqual(x.kanonisch.bausteine);
  });

  it("vorgelegte Anweisung mit danach gelöschter Grundlage wird nicht entschieden", async () => {
    const x = await start(); const url = `/api/gesamtanweisungen/${x.kanonisch.id}`;
    const vorgelegt = mussGelingen("vollständig vorlegen", await x.admin.sende("POST", `${url}/vorlegen`, { version: x.kanonisch.version })).json as { version: number };
    await x.entfernen(true); const vorher = await x.bestand();
    const entscheidung = await x.admin.sende("POST", `${url}/entscheiden`, { version: vorgelegt.version, entscheidung: "angenommen" });
    expect(entscheidung.status).toBe(403); x.ohneSpur(entscheidung.text);
    expect(await x.bestand()).toEqual(vorher);
  });
  it("fehlende gebundene Fassung erlaubt weder Vorlage noch Entscheidung trotz lebendem KO", async () => {
    const x = await start(); const url = `/api/gesamtanweisungen/${x.kanonisch.id}`;
    const original = x.services.ko.versionsOf.bind(x.services.ko);
    const ausfall = () => vi.spyOn(x.services.ko, "versionsOf").mockImplementation((id) => id === x.quellen[1]!.koId ? Promise.resolve([]) : original(id));
    const vorher = await x.bestand();
    const spy = ausfall();
    const vorlegen = await x.admin.sende("POST", `${url}/vorlegen`, { version: x.kanonisch.version });
    expect(vorlegen.status).toBe(403);
    expect(await x.bestand()).toEqual(vorher);
    spy.mockRestore();
    const vollstaendig = mussGelingen("mit belegter Grundlage vorlegen", await x.admin.sende("POST", `${url}/vorlegen`, { version: x.kanonisch.version })).json as { version: number };
    ausfall(); const vorEntscheidung = await x.bestand();
    const antwort = await x.admin.sende("POST", `${url}/entscheiden`, { version: vollstaendig.version, entscheidung: "angenommen" });
    expect(antwort.status).toBe(403);
    expect(await x.bestand()).toEqual(vorEntscheidung);
  });

  it("Schreibantwort prüft aktuelle Rechte erneut und benutzt keine vorher gelesene Freigabe", async () => {
    const x = await start(); const url = `/api/gesamtanweisungen/${x.kanonisch.id}`;
    const original = x.services.anweisungen.schreiben.bind(x.services.anweisungen);
    vi.spyOn(x.services.anweisungen, "schreiben").mockImplementation(async (...args) => {
      await x.services.ko.setQuellrechte(x.quellen[1]!.koId, { stufe: "vertraulich", leser: ["anderer-leser"], version: 1 }, x.nutzer.id);
      return original(...args);
    });
    const antwort = mussGelingen("Kopf mit inzwischen entzogenem Quellrecht", await x.admin.sende("PUT", url, { version: x.kanonisch.version, titel: "Gespeicherter Kopf" }));
    for (const spur of [x.quellen[1]!.koId, x.kanonisch.bausteine[1]!.id, "Nachweis-1", "Bedingung-1", "Geheim B"]) expect(antwort.text).not.toContain(spur);
    expect(antwort.json).toMatchObject({ titel: "Gespeicherter Kopf", unvollstaendig: true, verborgeneBausteine: 1 });
    expect((await x.bestand()).anweisung?.bausteine).toEqual(x.kanonisch.bausteine);
    expect((mussGelingen("GET nach Rechtewechsel", await x.admin.sende("GET", url)).json as AnweisungLesestand).bausteine).toEqual((antwort.json as AnweisungLesestand).bausteine);
  });

});
