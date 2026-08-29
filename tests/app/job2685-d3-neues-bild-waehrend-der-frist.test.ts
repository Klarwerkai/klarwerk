// ================================================================================================
// JOB 2685 D3 (Review R2-30) — EIN NEUES BILD WÄHREND DER FRIST: der Schreibstand, an der echten App.
// ================================================================================================
//
// BEN an D2: „Ein während der Frist neu angehängter Träger fehlt im gemerkten Kandidatensatz." Der
// Kandidaten-Speicher trägt jetzt je Eintrag den SCHREIBSTAND der Ablage (`anhangSchreibstand`,
// services/knowledge-object/src/repo.ts): jede Repo-Schreibmethode, die einen Träger erzeugen oder
// entfernen kann, erhöht ihn; die Abrufstelle verwirft einen gemerkten Eintrag, sobald er sich
// geändert hat. Hier läuft die ECHTE App (Routen → Speicher → Dienst → Ablage) mit echten Konten.
//
//   A · DIE ABLAGEN erhöhen den Stand — Speicher und Pg, jede Schreibmethode einzeln, kein Lesen.
//   B · DIE APP: Bild gemerkt (Träger vertraulich → Bert 404); Anna hängt es WÄHREND der Frist an ein
//       zweites, internes Objekt → Bert sieht es beim nächsten Abruf. Über jeden Schreibweg, den
//       die Oberfläche hat: neues Objekt mit Bild im Fließtext, `attach`, `revise`.
//   C · KALIBRIERUNG: ein Schreiben ohne Träger kostet nur eine Suche — kein Urteil ändert sich.
import { describe, expect, it, vi } from "vitest";
import {
  type AppRepos,
  assembleServices,
  buildApp,
  inMemoryRepos,
} from "../../services/app/src/build-app";
import { klassifiziereStufe } from "../../services/app/src/migrationsbeleg";
import {
  InMemoryEvidenceRepo,
  InMemoryKoRepo,
  InMemoryKoVersionRepo,
  type KnowledgeObject,
  PgEvidenceRepo,
  PgKoRepo,
  PgKoVersionRepo,
  Schreibstand,
} from "../../services/knowledge-object";
import {
  KO_SCHEMA,
  KO_SCHREIBSTAND_ERHOEHEN_SQL,
  KO_SCHREIBSTAND_LESEN_SQL,
  KO_SCHREIBSTAND_TABELLE_DDL,
} from "../../services/knowledge-object/src/repo-pg";

type App = ReturnType<typeof buildApp>;
type Auth = { authorization: string };

const PNG_DATA_URL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

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

async function konten(app: App, marke: string): Promise<{ anna: Auth; bert: Auth }> {
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Anna", email: `anna@${marke}.test`, password: "geheim12345" },
  });
  const anna = await login(app, `anna@${marke}.test`, "geheim12345");
  const res = await app.inject({
    method: "POST",
    url: "/api/users",
    headers: anna,
    payload: { name: "Bert", email: `bert@${marke}.test`, password: "geheim12345", role: "viewer" },
  });
  if (res.statusCode !== 201) {
    throw new Error(`Konto bert nicht angelegt: ${res.statusCode} ${res.body}`);
  }
  return { anna, bert: await login(app, `bert@${marke}.test`, "geheim12345") };
}

async function upload(app: App, wer: Auth): Promise<string> {
  const res = await app.inject({
    method: "POST",
    url: "/api/objects",
    headers: wer,
    payload: {
      name: "schritt.png",
      mime: "image/png",
      data: PNG_DATA_URL,
      kind: "image",
      purpose: "attachment",
    },
  });
  expect(res.statusCode, res.body).toBe(201);
  return res.json().id as string;
}

async function objekt(
  app: App,
  wer: Auth,
  bodyHtml: string,
  confidentiality?: "vertraulich",
): Promise<string> {
  const created = await app.inject({
    method: "POST",
    url: "/api/kos",
    headers: wer,
    payload: {
      title: "Wartung der Presse",
      statement: "Ein Objekt mit Bild.",
      type: "best_practice",
      category: "Instandhaltung",
      bodyHtml,
      ...(confidentiality ? { confidentiality } : {}),
    },
  });
  expect(created.statusCode, created.body).toBe(201);
  const id = created.json().id as string;
  if (confidentiality) {
    // Die Stufe wird über die Aktion gesetzt — der Erzeugungspfad kennt sie nicht zwingend.
    const stufe = await app.inject({
      method: "PUT",
      url: `/api/kos/${id}`,
      headers: wer,
      payload: { action: "confidentiality", level: confidentiality },
    });
    expect(stufe.statusCode, stufe.body).toBe(200);
  }
  return id;
}

function stellvertreterFuer(
  repos: AppRepos,
): (objectIds: readonly string[]) => Promise<KnowledgeObject[]> {
  return async (objectIds) =>
    (await repos.koRepo.list({})).filter((k) =>
      objectIds.some(
        (objectId) =>
          (k.attachments ?? []).some((a) => a.objectId === objectId) ||
          (typeof k.bodyHtml === "string" && k.bodyHtml.includes(objectId)),
      ),
    );
}

async function raw(app: App, wer: Auth, objectId: string) {
  return app.inject({ method: "GET", url: `/api/objects/${objectId}/raw`, headers: wer });
}

/** Ein Pool-Ersatz für die Pg-Ablagen: jede Query „trifft" (rowCount 1) — oder keine (rowCount 0).
 * D5: mit `connect()` für `withPgTx` — je Transaktion ein Client, dessen Statements als Folge
 * (BEGIN … COMMIT/ROLLBACK) festgehalten werden. */
function poolErsatz(rowCount: number) {
  const queries: string[] = [];
  const folgen: string[][] = [];
  const antwort = (sql: string) => {
    queries.push(sql);
    if (sql === KO_SCHREIBSTAND_LESEN_SQL) {
      return { rows: [{ stand: "7" }], rowCount: 1 };
    }
    if (/^(BEGIN|COMMIT|ROLLBACK)$/.test(sql)) {
      return { rows: [], rowCount: null };
    }
    return { rows: [], rowCount };
  };
  const pool = {
    query: async (sql: string) => antwort(sql),
    connect: async () => {
      const folge: string[] = [];
      folgen.push(folge);
      return {
        query: async (sql: string) => {
          folge.push(sql);
          return antwort(sql);
        },
        release: () => undefined,
      };
    },
  };
  return {
    pool: pool as unknown as ConstructorParameters<typeof PgKoRepo>[0],
    queries,
    transaktionen: () => folgen,
  };
}

const KO = {
  id: "ko-x",
  title: "t",
  statement: "s",
  type: "best_practice",
  category: "c",
  author: "u-anna",
  version: 1,
  attachments: [],
} as unknown as KnowledgeObject;

describe("JOB 2685 D3/D4 · A · die Ablagen erhöhen den Schreibstand — jede Schreibmethode, kein Lesen; D4: der Stand gehört dem BESTAND, nicht dem Prozess", () => {
  it("Speicher-Ablagen: die drei Ablagen EINES Bestands teilen den Stand; KO anlegen/ändern/löschen, Version anhängen/entfernen, Nachweis anhängen — je +1; Lesen 0", async () => {
    const bestand = new Schreibstand();
    const kos = new InMemoryKoRepo(bestand);
    const versionen = new InMemoryKoVersionRepo(bestand);
    const belege = new InMemoryEvidenceRepo(bestand);
    const stand = async () => Number(await kos.anhangSchreibstand());
    const s0 = await stand();
    await kos.insert(KO);
    expect(await stand()).toBe(s0 + 1);
    await kos.findById("ko-x");
    await kos.list({});
    expect(await stand()).toBe(s0 + 1); // Lesen erhöht nichts
    await kos.update({ ...(await kos.findById("ko-x")) } as KnowledgeObject);
    expect(await stand()).toBe(s0 + 2);
    await versionen.append({
      koId: "ko-x",
      version: 1,
      snapshot: KO,
      at: "x",
      author: "u",
      note: "",
    });
    expect(await stand()).toBe(s0 + 3); // die Versions-Ablage schreibt in DENSELBEN Stand
    await versionen.append({
      koId: "ko-x",
      version: 1,
      snapshot: KO,
      at: "x",
      author: "u",
      note: "",
    });
    expect(await stand()).toBe(s0 + 3); // vorhandene Version: nicht geschrieben
    await versionen.remove("ko-x", 1);
    expect(await stand()).toBe(s0 + 4);
    await belege.append({
      id: "e-1",
      koId: "ko-x",
      koVersion: 1,
      kind: "attachment",
      objectId: "obj-1",
      createdBy: "u",
      createdAt: "2026-08-29T00:00:00.000Z",
    } as never);
    expect(await stand()).toBe(s0 + 5); // die Nachweis-Ablage ebenso
    await kos.delete("ko-x");
    expect(await stand()).toBe(s0 + 6);
    await expect(kos.delete("ko-x")).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(await stand()).toBe(s0 + 6); // fehlgeschlagenes Schreiben: nicht erhöht
    // D4: ein ZWEITER Bestand hat seinen eigenen Stand — zwei Datenbanken teilen nichts.
    const anderer = new InMemoryKoRepo(new Schreibstand());
    expect(await anderer.anhangSchreibstand()).toBe("0");
  });

  it("Pg-Ablagen (D5): dieselben Methoden erhöhen die Zeile `ko_schreibstand` in DERSELBEN Transaktion wie das Schreiben — vor dem Commit; ein Schreiben ohne Treffer (STALE_WRITE, NOT_FOUND) rollt beides zurück", async () => {
    const trifft = poolErsatz(1);
    const kos = new PgKoRepo(trifft.pool);
    const versionen = new PgKoVersionRepo(trifft.pool);
    const belege = new PgEvidenceRepo(trifft.pool);
    await kos.insert(KO);
    await kos.update(KO);
    await kos.delete("ko-x");
    await versionen.append({
      koId: "ko-x",
      version: 1,
      snapshot: KO,
      at: "x",
      author: "u",
      note: "",
    });
    await versionen.remove("ko-x", 1);
    await belege.append({
      id: "e-1",
      koId: "ko-x",
      koVersion: 1,
      kind: "attachment",
      objectId: "obj-1",
      createdBy: "u",
      createdAt: "2026-08-29T00:00:00.000Z",
    } as never);
    // Sechs Transaktionen: BEGIN · Schreiben · Stand · COMMIT — der Stand steht IM Klammerpaar.
    const folgen = trifft.transaktionen();
    expect(folgen).toHaveLength(6);
    for (const f of folgen) {
      expect(f[0]).toBe("BEGIN");
      expect(/^\s*(INSERT|UPDATE kos|DELETE)/.test(f[1] ?? "")).toBe(true);
      expect(f[2]).toBe(KO_SCHREIBSTAND_ERHOEHEN_SQL);
      expect(f[3]).toBe("COMMIT");
    }
    expect(await kos.anhangSchreibstand()).toBe("7"); // der Pool-Ersatz antwortet auf die Standlesung mit "7"

    const trifftNicht = poolErsatz(0);
    const leer = new PgKoRepo(trifftNicht.pool);
    await expect(leer.update(KO)).rejects.toMatchObject({ code: "STALE_WRITE" });
    await expect(leer.delete("ko-x")).rejects.toMatchObject({ code: "NOT_FOUND" });
    // Kein Treffer → kein Stand-UPDATE, und die Transaktion endet mit ROLLBACK.
    expect(trifftNicht.queries.filter((q) => q === KO_SCHREIBSTAND_ERHOEHEN_SQL)).toHaveLength(0);
    expect(trifftNicht.queries.filter((q) => q === "ROLLBACK")).toHaveLength(2);
  });

  it("die DDL (D5): die Ein-Zeilen-Tabelle steht additiv in KO_SCHEMA mit Startwert 0; Erhöhen ist ein UPDATE in der Transaktion, Lesen eine Zeile per Primärschlüssel — und KO_SCHEMA bleibt ADDITIV", () => {
    expect(KO_SCHEMA).toContain(KO_SCHREIBSTAND_TABELLE_DDL);
    expect(KO_SCHREIBSTAND_TABELLE_DDL).toContain("CREATE TABLE IF NOT EXISTS ko_schreibstand");
    expect(KO_SCHREIBSTAND_TABELLE_DDL).toContain("VALUES (1, 0) ON CONFLICT (id) DO NOTHING");
    expect(KO_SCHREIBSTAND_ERHOEHEN_SQL).toBe(
      "UPDATE ko_schreibstand SET stand = stand + 1 WHERE id = 1",
    );
    expect(KO_SCHREIBSTAND_LESEN_SQL).toBe(
      "SELECT stand::text AS stand FROM ko_schreibstand WHERE id = 1",
    );
    expect(KO_SCHEMA).not.toMatch(/SEQUENCE|nextval/);
    expect(klassifiziereStufe(KO_SCHEMA)).toBe("ADDITIV");
  });
});

describe("JOB 2685 D3 · B · an der echten App: das Bild ist gemerkt, ein zweites Objekt hängt es WÄHREND der Frist an — Bert sieht es beim nächsten Abruf", () => {
  async function aufbau(marke: string) {
    const repos = inMemoryRepos();
    const suche = vi.fn(stellvertreterFuer(repos));
    repos.koRepo.listAnhangTraegerFuer = suche;
    const app = buildApp(assembleServices(repos));
    const { anna, bert } = await konten(app, marke);
    const bild = await upload(app, anna);
    // Der einzige Träger ist VERTRAULICH: Bert bekommt das Bild nicht — und der Speicher merkt sich
    // den Kandidaten (eine nicht-leere Menge wird gemerkt).
    const geheim = await objekt(
      app,
      anna,
      `<p><img src="/api/objects/${bild}/raw"></p>`,
      "vertraulich",
    );
    suche.mockClear();
    const zu = await raw(app, bert, bild);
    expect(zu.statusCode).toBe(404);
    expect(suche).toHaveBeenCalledTimes(1);
    // Aus dem Speicher, keine neue Suche — der Eintrag steht.
    expect((await raw(app, bert, bild)).statusCode).toBe(404);
    expect(suche).toHaveBeenCalledTimes(1);
    return { app, anna, bert, bild, geheim, suche };
  }

  it("Schreibweg 1 — ein NEUES internes Objekt nennt das Bild im Fließtext: sofort 200, über eine neue Suche", async () => {
    const { app, anna, bert, bild, suche } = await aufbau("d3w1");
    await objekt(app, anna, `<p><img src="/api/objects/${bild}/raw"></p>`);
    const auf = await raw(app, bert, bild);
    expect(auf.statusCode, auf.body).toBe(200);
    // Der vertrauliche Träger bleibt Mitträger: `vertraulich` bleibt, also `no-store` (mega76).
    expect(auf.headers["cache-control"]).toBe("no-store");
    expect(suche).toHaveBeenCalledTimes(2);
    expect(suche.mock.calls[1]?.[0]).toEqual([bild]);
  });

  it("Schreibweg 2 — `attach` an ein bestehendes internes Objekt: sofort 200", async () => {
    const { app, anna, bert, bild, suche } = await aufbau("d3w2");
    const offen = await objekt(app, anna, "<p>noch ohne Bild</p>");
    // Auch dieses Anlegen war ein Schreiben — der nächste Abruf sucht neu, findet aber nur den
    // vertraulichen Träger: weiterhin 404, und der neue Eintrag wird wieder gemerkt.
    expect((await raw(app, bert, bild)).statusCode).toBe(404);
    expect(suche).toHaveBeenCalledTimes(2);
    const angehaengt = await app.inject({
      method: "PUT",
      url: `/api/kos/${offen}`,
      headers: anna,
      payload: {
        action: "attach",
        attachment: { name: "schritt.png", mime: "image/png", objectId: bild },
      },
    });
    expect(angehaengt.statusCode, angehaengt.body).toBe(200);
    const auf = await raw(app, bert, bild);
    expect(auf.statusCode, auf.body).toBe(200);
    expect(suche).toHaveBeenCalledTimes(3);
  });

  it("Schreibweg 3 — `revise` setzt das Bild in den Fließtext eines bestehenden internen Objekts: sofort 200", async () => {
    const { app, anna, bert, bild, suche } = await aufbau("d3w3");
    const offen = await objekt(app, anna, "<p>noch ohne Bild</p>");
    expect((await raw(app, bert, bild)).statusCode).toBe(404);
    expect(suche).toHaveBeenCalledTimes(2);
    const ueberarbeitet = await app.inject({
      method: "PUT",
      url: `/api/kos/${offen}`,
      headers: anna,
      payload: {
        action: "revise",
        changes: { bodyHtml: `<p>Jetzt mit Bild: <img src="/api/objects/${bild}/raw"></p>` },
      },
    });
    expect(ueberarbeitet.statusCode, ueberarbeitet.body).toBe(200);
    const auf = await raw(app, bert, bild);
    expect(auf.statusCode, auf.body).toBe(200);
    expect(suche).toHaveBeenCalledTimes(3);
  });

  it("und der Entzug bleibt sofort (D2): wird das neue Objekt wieder vertraulich, ist das Bild beim nächsten Abruf weg — ohne neue Suche nötig, aber mit neuem Stand gesucht", async () => {
    const { app, anna, bert, bild } = await aufbau("d3w4");
    const neu = await objekt(app, anna, `<p><img src="/api/objects/${bild}/raw"></p>`);
    expect((await raw(app, bert, bild)).statusCode).toBe(200);
    const stufe = await app.inject({
      method: "PUT",
      url: `/api/kos/${neu}`,
      headers: anna,
      payload: { action: "confidentiality", level: "vertraulich" },
    });
    expect(stufe.statusCode, stufe.body).toBe(200);
    const weg = await raw(app, bert, bild);
    expect(weg.statusCode).toBe(404);
    expect(weg.headers["cache-control"]).toBe("no-store");
  });
});

describe("JOB 2685 D3 · C · Kalibrierung: ein Schreiben ohne Träger kostet eine Suche, kein Urteil", () => {
  it("nach einem fremden Schreiben suchen die zehn Bilder einer Seite einmal neu (zwei Suchen) — Hochladende und Fremder sehen, was sie sahen", async () => {
    const repos = inMemoryRepos();
    const suche = vi.fn(stellvertreterFuer(repos));
    repos.koRepo.listAnhangTraegerFuer = suche;
    const app = buildApp(assembleServices(repos));
    const { anna, bert } = await konten(app, "d3c");
    const bilder: string[] = [];
    for (let i = 0; i < 10; i++) {
      bilder.push(await upload(app, anna));
    }
    await objekt(
      app,
      anna,
      bilder.map((id) => `<p><img src="/api/objects/${id}/raw"></p>`).join(""),
    );
    suche.mockClear();
    for (const id of bilder) {
      expect((await raw(app, bert, id)).statusCode).toBe(200);
    }
    expect(suche).toHaveBeenCalledTimes(2);
    // Ein Objekt ohne Bild entsteht — die Ablage schreibt, der Speicher weiß es.
    await objekt(app, anna, "<p>ohne Bild</p>");
    for (const id of bilder) {
      expect((await raw(app, bert, id)).statusCode).toBe(200);
      expect((await raw(app, anna, id)).statusCode).toBe(200);
    }
    // Der Preis: die Seite wurde EINMAL neu gesucht (Bild 1, Geschwister) — nicht zehnmal.
    expect(suche).toHaveBeenCalledTimes(4);
  });
});
