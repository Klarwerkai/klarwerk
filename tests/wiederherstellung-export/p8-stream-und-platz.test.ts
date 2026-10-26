import { createHash } from "node:crypto";
import type { ReadStream } from "node:fs";
import { access } from "node:fs/promises";
import { PassThrough, Readable } from "node:stream";
import { finished } from "node:stream/promises";
import { setImmediate as spaeter } from "node:timers/promises";
import Fastify, { type FastifyReply } from "fastify";
import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { makeGuards } from "../../services/app/src/http";
import { libraryRoutes } from "../../services/app/src/routes/library-routes";
import {
  type WissenspaketAuftrag,
  type WissenspaketQuellen,
  baueWissenspaket,
  baueWissenspaketStream,
} from "../../services/app/src/wissenspaket";
import {
  AuthService,
  InMemorySessionRepo,
  InMemoryUserRepo,
  authRoutes,
} from "../../services/auth";
import { InMemoryKoRepo, type KnowledgeObject, KoService } from "../../services/knowledge-object";
import { LibraryService } from "../../services/library-analytics";
import { decodeDataUrl } from "../../services/object-store";

const datum = "2026-10-01T00:00:00Z";
function bestand() {
  const bytes = Buffer.alloc(1024 * 1024);
  for (let i = 0; i < bytes.length; i += 4)
    bytes.writeUInt32LE((Math.imul(i, 2654435761) ^ (i >>> 7)) >>> 0, i);
  const ko: KnowledgeObject = {
    id: "ko",
    title: "Wissen",
    statement: "S",
    bodyHtml: "<p>Inhalt</p>",
    conditions: [],
    measures: [],
    type: "best_practice",
    category: "c",
    tags: [],
    confidence: 3,
    trust: 80,
    status: "validiert",
    version: 1,
    originalAuthor: "u",
    author: "u",
    neededValidations: 1,
    assignments: [],
    confidentiality: "intern",
    asset: null,
    createdAt: datum,
    history: [],
    comments: [],
    sources: [],
    attachments: [
      {
        id: "a",
        name: "original.bin",
        mime: "application/octet-stream",
        objectId: "obj",
        author: "u",
        at: datum,
      },
    ],
  };
  const quellen: WissenspaketQuellen = {
    beitrag: async () => ko,
    fassungen: async () => [
      { koId: ko.id, version: 1, at: datum, author: "u", note: "", snapshot: ko },
    ],
    objekt: async () => ({
      ref: {
        id: "obj",
        name: "original.bin",
        mime: "application/octet-stream",
        kind: "binary",
        size: bytes.length,
        createdAt: datum,
        confidentiality: "intern",
      },
      data: `data:application/octet-stream;base64,${bytes.toString("base64")}`,
    }),
    beziehungen: async () => ({ koId: ko.id, kanten: [], total: 0 }),
    personen: async () => new Map([["u", "Ute"]]),
    spaces: async () => new Map(),
    produkt: { version: "test", commit: "test" },
  };
  const auftrag: WissenspaketAuftrag = {
    betrachter: { id: "u", role: "admin" },
    betrachterName: "Ute",
    vertraulichErlaubt: true,
    beitraege: [ko],
    auswahl: undefined,
    jetzt: new Date(datum),
  };
  return { quellen, auftrag, bytes };
}

function versprechen<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

async function httpAufbau() {
  const auth = new AuthService({
    users: new InMemoryUserRepo(),
    sessions: new InMemorySessionRepo(),
  });
  const anna = await auth.register({
    name: "Anna",
    email: "anna@beleg.test",
    password: "beleg-passwort",
  });
  const bert = await auth.register({
    name: "Bert",
    email: "bert@beleg.test",
    password: "beleg-passwort",
  });
  await auth.approveUser(bert.id, anna.id);
  const library = new LibraryService({ koService: new KoService({ repo: new InMemoryKoRepo() }) });
  const q = bestand().quellen;
  let fehler = false;
  q.personen = async () => {
    if (fehler) {
      fehler = false;
      throw new Error("synthetischer Ausfall");
    }
    return new Map();
  };
  const app = Fastify();
  await app.register(authRoutes(auth));
  await app.register(libraryRoutes(library, makeGuards(auth), undefined, undefined, q));
  type Halt = {
    tor: PassThrough;
    quelle: Readable;
    antwort: FastifyReply["raw"];
    beendet: Promise<void>;
  };
  let wartet: ReturnType<typeof versprechen<Halt>> | undefined;
  app.addHook("onSend", async (request, reply, payload) => {
    if (wartet && request.url.includes("format=paket") && reply.statusCode === 200) {
      expect(payload).toBeInstanceOf(Readable);
      const quelle = payload as Readable;
      const tor = new PassThrough();
      const beendet = finished(quelle, { cleanup: true });
      void beendet.catch(() => {});
      quelle.pipe(tor, { end: false });
      const ziel = wartet;
      wartet = undefined;
      ziel.resolve({ tor, quelle, antwort: reply.raw, beendet });
      return tor;
    }
    return payload;
  });
  const login = async (email: string) => {
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email, password: "beleg-passwort" },
    });
    expect(res.statusCode).toBe(200);
    return { authorization: `Bearer ${res.json().token}` };
  };
  const a1 = await login("anna@beleg.test");
  const a2 = await login("anna@beleg.test");
  const b = await login("bert@beleg.test");
  const laden = (headers = a1, ip = "10.0.0.1") =>
    app.inject({
      method: "GET",
      url: "/api/library/export?format=paket",
      headers,
      remoteAddress: ip,
    });
  return {
    app,
    a1,
    a2,
    b,
    laden,
    fehler: () => {
      fehler = true;
    },
    halte: () => {
      wartet = versprechen<Halt>();
      return wartet.promise;
    },
  };
}

describe("P8 · ein gemeinsamer Paketkern, echte Ströme und eigener Dateilebenszyklus", () => {
  it.each(
    [
      "data:x;base64,YQ==",
      "data:x;base64,Y Q_-\\n!",
      "data:x;base64,YQ==ignoriert",
      "d\u0161ta:x;base64,YQ==",
      "data:m\u012cime;base64,YQ==",
      "data:x;bas\u016564,YQ==",
      "data:x;base64,Y\u0101Q==",
      "data:x;base64,Y\ud841Q==",
      "data:x;base64,Y\uff21Q==",
      "data:x;base64,Y\ud83d\ude00Q==",
      "data:x;base64,_-YQ=\u012bgarbage",
      "data:x;base64,",
      "data:x;charset=utf-8;base64,YQ==",
      "unlesbar",
      `data:x;base64,${"/".repeat(65_535)}AAA==`,
    ].map((daten, fall) => [fall, daten] as const),
  )(
    "stückweise Daten-URL bleibt zum bestehenden Decoder kompatibel · Fall %i",
    async (_fall, daten) => {
      const k = bestand();
      const original = k.quellen.objekt;
      k.quellen.objekt = async (id) => {
        const objekt = await original(id);
        return objekt ? { ...objekt, data: daten } : undefined;
      };
      const erwartet = decodeDataUrl(daten);
      const p = await baueWissenspaket(k.auftrag, k.quellen);
      if (erwartet) {
        const zip = await JSZip.loadAsync(p.zip, { checkCRC32: true });
        const a = p.manifest.beitraege[0]?.anhaenge[0];
        expect(a).toBeDefined();
        expect(await zip.file(a?.datei ?? "")?.async("nodebuffer")).toEqual(erwartet.bytes);
      } else {
        expect(p.manifest.umfang.anhaenge).toBe(0);
        expect(p.manifest.beitraege[0]?.anhaengeAusgelassen).toHaveLength(1);
      }
    },
  );

  it("Buffer und Stream enthalten denselben vollständigen Bestand mit ehrlichen Größen und SHA", async () => {
    const k = bestand();
    const buffer = await baueWissenspaket(k.auftrag, k.quellen);
    expect(Buffer.isBuffer(buffer.zip)).toBe(true);
    const paket = await baueWissenspaketStream(k.auftrag, k.quellen);
    const datei = (paket.strom as ReadStream).path;
    await access(datei);
    expect(paket.strom.readableFlowing).not.toBe(true);
    const stuecke: Buffer[] = [];
    for await (const chunk of paket.strom) {
      stuecke.push(Buffer.from(chunk));
      expect(paket.strom.readableLength).toBeLessThanOrEqual(paket.strom.readableHighWaterMark);
      await spaeter(); // langsamer Abnehmer; der ReadStream bleibt in seinem Pufferrahmen
    }
    await paket.abgeschlossen;
    await expect(access(datei)).rejects.toMatchObject({ code: "ENOENT" });
    expect(paket.manifest).toEqual(buffer.manifest);
    const alt = await JSZip.loadAsync(buffer.zip);
    const neu = await JSZip.loadAsync(Buffer.concat(stuecke));
    for (const d of paket.manifest.dateien) {
      const bytes = await neu.file(d.datei)?.async("nodebuffer");
      expect(bytes?.length).toBe(d.bytes);
      expect(
        createHash("sha256")
          .update(bytes ?? "")
          .digest("hex"),
      ).toBe(d.sha256);
      expect(bytes).toEqual(await alt.file(d.datei)?.async("nodebuffer"));
    }
    const anhang = paket.manifest.beitraege[0]?.anhaenge[0];
    expect(anhang).toBeDefined();
    expect(await neu.file(anhang?.datei ?? "")?.async("nodebuffer")).toEqual(k.bytes);
    expect(paket.manifest.umfang.anhaenge).toBe(1);
    expect(paket.manifest.beitraege[0]?.anhaengeAusgelassen).toEqual([]);
  });

  it("ein abgebrochener Paketstrom räumt seine eigenen Dateien auf", async () => {
    const k = bestand();
    const controller = new AbortController();
    const p = await baueWissenspaketStream(k.auftrag, k.quellen, controller.signal);
    const datei = (p.strom as ReadStream).path;
    await access(datei);
    controller.abort();
    await expect(p.abgeschlossen).rejects.toBeDefined();
    await expect(access(datei)).rejects.toMatchObject({ code: "ENOENT" });
  });
});

describe("P8 · Downloadplatz je authentischem Konto bis zum Ende der HTTP-Antwort", () => {
  it.each([false, true])(
    "andere Sitzung/IP bleibt gesperrt, anderes Konto frei; Abbruch=%s",
    async (abbruch) => {
      const k = await httpAufbau();
      const halten = k.halte();
      const erster = k.laden().then(
        (res) => ({ res }),
        (error: unknown) => ({ error }),
      );
      let tor: PassThrough | undefined;
      try {
        const h = await halten;
        tor = h.tor;
        await h.beendet; // Quelldatei ist ausgelesen; die echte Antwort bleibt ausdrücklich offen.
        const gesperrt = await k.laden(k.a2, "10.0.0.2");
        expect(gesperrt.statusCode).toBe(429);
        expect(gesperrt.headers["retry-after"]).toBe("1");
        const fremd = await k.laden(k.b);
        expect(fremd.statusCode).toBe(200);
        expect((await JSZip.loadAsync(fremd.rawPayload)).file("MANIFEST.json")).not.toBeNull();
        if (abbruch) h.antwort.destroy();
        else h.tor.end();
        const resultat = await erster;
        if (abbruch) expect("error" in resultat).toBe(true);
        else expect("res" in resultat && resultat.res.statusCode).toBe(200);
        await spaeter();
        const erneut = await k.laden(k.a2);
        expect(erneut.statusCode).toBe(200);
        expect((await JSZip.loadAsync(erneut.rawPayload)).file("MANIFEST.json")).not.toBeNull();
      } finally {
        tor?.destroy();
        await k.app.close();
      }
    },
  );

  it("ein Fehler beim Paketbau gibt den Platz frei und der nächste Abruf gelingt", async () => {
    const k = await httpAufbau();
    try {
      k.fehler();
      const ausfall = await k.laden();
      expect(ausfall.statusCode).toBe(500);
      expect(ausfall.json()).toEqual({ error: "INTERNAL", message: "Unerwarteter Fehler." });
      const erneut = await k.laden(k.a2);
      expect(erneut.statusCode).toBe(200);
      expect((await JSZip.loadAsync(erneut.rawPayload)).file("MANIFEST.json")).not.toBeNull();
    } finally {
      await k.app.close();
    }
  });
});
