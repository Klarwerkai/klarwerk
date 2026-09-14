import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { assembleServices, buildApp, inMemoryRepos } from "../../services/app/src/build-app";
import type { Role } from "../../services/auth";
import type { CreateKoInput, KoSichtbarkeitstrim } from "../../services/knowledge-object";
import { ROLE_PERMISSIONS, can } from "../../services/rbac";

const apps: ReturnType<typeof buildApp>[] = [];

afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

async function setup() {
  const repos = inMemoryRepos();
  const services = assembleServices(repos);
  const app = buildApp(services);
  apps.push(app);
  const credentials = { email: "admin@categories.test", password: "secret123" };
  const registered = await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { ...credentials, name: "Admin" },
  });
  expect(registered.statusCode, registered.body).toBe(201);
  const login = await app.inject({ method: "POST", url: "/api/auth/login", payload: credentials });
  expect(login.statusCode, login.body).toBe(200);
  const admin = { authorization: `Bearer ${login.json().token}` };

  async function user(name: string, role: Role) {
    const credentials = { email: `${name}@categories.test`, password: "secret123" };
    const created = await app.inject({
      method: "POST",
      url: "/api/users",
      headers: admin,
      payload: { ...credentials, name, role },
    });
    expect(created.statusCode, created.body).toBe(201);
    const login = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: credentials,
    });
    expect(login.statusCode, login.body).toBe(200);
    return { id: created.json().id as string, authorization: `Bearer ${login.json().token}` };
  }

  const create = (category: string, extra: Partial<CreateKoInput> = {}) =>
    services.ko.create({
      title: "Wissensobjekt",
      statement: "Ein belegter Bestandseintrag.",
      type: "best_practice",
      category,
      author: login.json().user.id as string,
      confidentiality: "intern",
      ...extra,
    });
  const categories = (headers: Record<string, string> = admin) =>
    app.inject({ method: "GET", url: "/api/categories", headers });
  return { app, repos, services, admin, user, create, categories };
}

// ------------------------------------------------------------------------------------------------
// F10-F12 · DIE ZWEITE HÄLFTE DER NAHT — VOM AUFRUF DER DATENQUELLE AUS GEMESSEN.
//
// `GET /api/categories` beantwortet die Sichtbarkeitsfrage an EINER Naht aus ZWEI Hälften
// (category-routes.ts:26): `sqlSichtbarkeitFuer(user)` reist als Prädikat in die DATENQUELLE,
// `sichtbareFuer(user, …)` filtert danach in Node nach. F1-F9 messen ausschliesslich die Wirkung —
// und die ist unter `InMemoryKoRepo` schon von der Node-Hälfte allein erfüllt. Wer die erste Hälfte
// aus :26 streicht, bekommt deshalb weder einen Typfehler (der Trim ist optional, repo.ts:193) noch
// einen roten Lauf; unbewacht ist sie ab dem Tag, an dem die Datenquelle einen Deckel, einen Cursor
// oder eine Folgeseite bekommt, denn dann filtert Node auf einer schon beschnittenen Menge.
// Deshalb messen F10 und F11 nicht die Antwort, sondern das ARGUMENT, mit dem die Route ihre
// Datenquelle fragt. Die Diagnose nennt immer die Anrufstelle und das TATSÄCHLICH angekommene
// Argument, damit der Verstellende den Ort liest statt ihn zu suchen.
// ------------------------------------------------------------------------------------------------

const ANRUFSTELLE = "services/app/src/routes/category-routes.ts:26";
const SAMMLER_PFAD = "tests/security/mega74-lesewege-sammler.test.ts";

/** Was kam WIRKLICH als zweites Argument an der Datenquelle an? (Diagnose, nie Erwartung.) */
function angekommen(arg: unknown): string {
  if (arg === undefined) {
    return "undefined — die Route hat gar kein zweites Argument übergeben";
  }
  if (arg === null || typeof arg !== "object") {
    return `${typeof arg}: ${String(arg)}`;
  }
  const params = (arg as { params?: unknown }).params;
  return `Objekt mit Schlüsseln [${Object.keys(arg).join(", ")}], params=${JSON.stringify(params)}`;
}

function meldung(erwartet: string, arg: unknown): string {
  return `${ANRUFSTELLE} — erwartet: ${erwartet}. Angekommen ist: ${angekommen(arg)}.`;
}

/**
 * Trägername und Platzhalterindex sind Teil der Signatur `sql(spaltenTraeger, abPlatzhalter)`
 * (sichtbarkeit.ts:170-176). Deshalb wird sie mit ZWEI verschiedenen Paaren befragt: ein fest
 * verdrahtetes Prädikat, das Träger oder Platzhalter ignoriert, fiele sonst nicht auf.
 */
const PROBEAUFRUFE = [
  ["kos", 1],
  ["ko_liste", 7],
] as const;

/**
 * Der GANZE Vertrag `SqlSichtbarkeitstrim`, gemessen am tatsächlich an der Datenquelle
 * angekommenen Argument — eine Stelle, von F10 und F12 gemeinsam benutzt. Die Regel selbst wird
 * hier nicht nachgebaut: befragt werden ihre drei Glieder, die Rollenregel kommt aus `can`.
 * Rückgabe sind die Mängel im Klartext, je Vertragsglied; leere Listen heissen „belegt".
 */
function trimBefund(
  trim: KoSichtbarkeitstrim | undefined,
  erwarteteParams: readonly unknown[],
): { sql: string[]; params: string[]; trifftZu: string[] } {
  const befund: { sql: string[]; params: string[]; trifftZu: string[] } = {
    sql: [],
    params: [],
    trifftZu: [],
  };
  if (typeof trim?.sql !== "function") {
    befund.sql.push(`sql() fehlt oder ist keine Funktion — angekommen ist ${angekommen(trim)}`);
  } else {
    for (const [traeger, ab] of PROBEAUFRUFE) {
      const geliefert: unknown = trim.sql(traeger, ab);
      if (typeof geliefert !== "string" || geliefert.trim() === "") {
        befund.sql.push(
          `sql("${traeger}", ${ab}) lieferte keine Zeichenkette, sondern ${angekommen(geliefert)}`,
        );
        continue;
      }
      const einzeilig = geliefert.replace(/\s+/g, " ");
      // Der Papierkorb wird als GANZE Bedingung verlangt, nicht als blosser Spaltenname: ein
      // Prädikat, das `deleted_at_key IS NOT NULL` fragte, nennt die Spalte ebenfalls.
      for (const teil of [
        `${traeger}.deleted_at_key IS NULL`,
        `${traeger}.confidentiality_key`,
        `${traeger}.author_key`,
        `$${ab}`,
        `$${ab + 1}`,
      ]) {
        if (!einzeilig.includes(teil)) {
          befund.sql.push(
            `sql("${traeger}", ${ab}) nennt »${teil}« nicht. Geliefert wurde: ${einzeilig}`,
          );
        }
      }
    }
  }
  if (JSON.stringify(trim?.params) !== JSON.stringify(erwarteteParams)) {
    befund.params.push(
      `params sind nicht die genau zwei Werte des Fragenden ${JSON.stringify(erwarteteParams)}, sondern ${JSON.stringify(trim?.params)}`,
    );
  }
  if (typeof trim?.trifftZu !== "function") {
    befund.trifftZu.push(
      `trifftZu() fehlt oder ist keine Funktion — angekommen ist ${angekommen(trim)}`,
    );
  }
  return befund;
}

const vertragBelegt = (befund: ReturnType<typeof trimBefund>): boolean =>
  befund.sql.length === 0 && befund.params.length === 0 && befund.trifftZu.length === 0;

/**
 * Der Eintrag des Lesewege-Sammlers zu einer Route, aus der Sammlerdatei GELESEN.
 *
 * Über die Datei und nicht über einen Import, weil `REGISTER` in
 * `tests/security/mega74-lesewege-sammler.test.ts` bewusst nicht exportiert ist (dort steht ein
 * Testmodul, kein Vertragsmodul) — und weil `tests/security/**` kein Zielpfad dieses Auftrags ist:
 * gelesen wird sie, angefasst nicht.
 */
function sammlerEintrag(route: string): { urteil: string; grund: string; zeile: number } {
  const quelle = readFileSync(
    new URL("../security/mega74-lesewege-sammler.test.ts", import.meta.url),
    "utf8",
  );
  const zeilen = quelle.split("\n");
  const start = zeilen.findIndex((z) => z.trimStart().startsWith(`"${route}": {`));
  expect(start, `${SAMMLER_PFAD}: kein Eintrag "${route}" gefunden`).toBeGreaterThanOrEqual(0);
  const ende = zeilen.findIndex((z, i) => i > start && z.trimStart().startsWith("},"));
  expect(
    ende,
    `${SAMMLER_PFAD}:${start + 1}: der Eintrag "${route}" ist nicht abgeschlossen`,
  ).toBeGreaterThan(start);
  const block = zeilen.slice(start, ende + 1).join(" ");
  const urteil = /urteil:\s*"([^"]+)"/.exec(block)?.[1];
  const grund = /grund:\s*"((?:[^"\\]|\\.)*)"/.exec(block)?.[1];
  expect(
    typeof urteil === "string" && typeof grund === "string",
    `${SAMMLER_PFAD}:${start + 1}: Urteil und Grund von "${route}" sind nicht lesbar. Gefunden: ${block}`,
  ).toBe(true);
  return { urteil: urteil ?? "", grund: grund ?? "", zeile: start + 1 };
}

/** Die Form, in der der Sammler-Satz seine Reihenfolge behauptet: „… erst nach A + B." */
const SATZFORM = /^JOB \d+ — (?<gegenstand>.+?) erst nach (?<haelften>[^.]+)\.$/;

/** WOVON der Satz spricht — und welche Messung dieses Testes das jeweils deckt. */
const GEGENSTAND_WORTE = new Map<string, "kategorien" | "zaehler">([
  ["Kategorien", "kategorien"],
  ["Zähler", "zaehler"],
]);
/** WORAUF er die Auskunft stützt. */
const HAELFTEN_WORTE = new Map<string, "sql" | "node">([
  ["sqlSichtbarkeitFuer", "sql"],
  ["sichtbareFuer", "node"],
]);

/**
 * Ein Satzteil in seine benannten Glieder zerlegt. Was das Vokabular nicht kennt, kommt als
 * `unbekannt` zurück — ein Gegenstand oder eine Hälfte, die dieser Test nicht misst, darf nicht
 * still als gedeckt durchgehen.
 */
function zerlege<K extends string>(
  text: string,
  trenner: string,
  vokabular: ReadonlyMap<string, K>,
): { genannt: Set<K>; unbekannt: string[] } {
  const genannt = new Set<K>();
  const unbekannt: string[] = [];
  for (const wort of text.split(trenner).map((w) => w.trim())) {
    if (wort === "") {
      continue;
    }
    const schluessel = vokabular.get(wort);
    if (schluessel === undefined) {
      unbekannt.push(wort);
    } else {
      genannt.add(schluessel);
    }
  }
  return { genannt, unbekannt };
}

describe("K2b · Kategorien am echten Anwendungsdraht", () => {
  it("F1 die Route existiert und antwortet vollständig, eindeutig und nach Namen sortiert", async () => {
    const { create, categories } = await setup();
    // Absichtlich B zuerst und ungleiche Zähler: weder Einfügereihenfolge noch count aufsteigend.
    await create("B");
    await create("A");
    await create("A");
    const response = await categories();
    expect(response.statusCode).toBe(200);
    expect(response.headers["cache-control"]).toBe("private, no-store");
    expect(response.json()).toEqual({
      categories: [
        { name: "A", count: 2 },
        { name: "B", count: 1 },
      ],
    });
  });

  it("F2 Sichtbarkeit ist echt: derselbe Bestand ergibt je Anwender andere Bereiche und Zähler", async () => {
    const { create, user, categories } = await setup();
    const a = await user("a", "experte");
    const b = await user("b", "experte");
    await create("Gemeinsam");
    await create("Gemeinsam", { author: a.id, confidentiality: "vertraulich" });
    await create("Nur A", { author: a.id, confidentiality: "streng_vertraulich" });
    await create("Nur B", { author: b.id, confidentiality: "vertraulich" });
    const responseA = await categories(a);
    const responseB = await categories(b);
    const responseAdmin = await categories();
    expect([responseA.statusCode, responseB.statusCode, responseAdmin.statusCode]).toEqual([
      200, 200, 200,
    ]);
    expect(responseA.json()).toEqual({
      categories: [
        { name: "Gemeinsam", count: 2 },
        { name: "Nur A", count: 1 },
      ],
    });
    expect(responseB.json()).toEqual({
      categories: [
        { name: "Gemeinsam", count: 1 },
        { name: "Nur B", count: 1 },
      ],
    });
    expect(responseAdmin.json()).toEqual({
      categories: [
        { name: "Gemeinsam", count: 2 },
        { name: "Nur A", count: 1 },
        { name: "Nur B", count: 1 },
      ],
    });
  });

  it("F3 ohne gültige Anmeldung kein Bestandsabzug, wie bei der Bibliothekssuche", async () => {
    const { app, create, categories } = await setup();
    await create("Bestandsgeheimnis");
    const neighbor = await app.inject({ method: "GET", url: "/api/library/search" });
    expect(neighbor.statusCode).toBe(401);
    for (const headers of [{}, { authorization: "Bearer ungueltig" }]) {
      const response = await categories(headers);
      expect(response.statusCode).toBe(neighbor.statusCode);
      expect(response.json()).toEqual(neighbor.json());
      expect(response.json()).toEqual({ error: "UNAUTHENTICATED", message: "Nicht angemeldet." });
    }
  });

  it("F4 ohne Kategorie erfindet nichts: fehlend, leer, Weißraum und null bleiben ohne Eintrag", async () => {
    const { create, repos, services, categories } = await setup();
    await create("A");
    await create("");
    await create("   ");
    await create("\t\n\u00a0");
    // Altbestand an der echten Ablage: das heutige Schreibmodell verlangt einen String.
    const missing = await create("Altbestand");
    Reflect.deleteProperty(missing, "category");
    await repos.koRepo.update(missing);
    const nullable = await create("Altbestand null");
    Reflect.set(nullable, "category", null);
    await repos.koRepo.update(nullable);
    const response = await categories();
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ categories: [{ name: "A", count: 1 }] });
    const sum = response
      .json<{ categories: { count: number }[] }>()
      .categories.reduce((n, c) => n + c.count, 0);
    expect(sum).toBeLessThan((await services.ko.list()).length);
  });

  it("F5 leerer Bestand ist eine ehrliche leere Liste", async () => {
    const { categories } = await setup();
    const response = await categories();
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ categories: [] });
  });

  it("F6 gültige Anmeldung ohne Leserecht liefert leer und liest keinen Bestand", async () => {
    const { user, create, repos, categories } = await setup();
    const viewer = await user("leser", "viewer");
    await create("A");
    const read = vi.spyOn(repos.koRepo, "listForSearch");
    // Alle heutigen Rollen haben ko.read. Entzug an der echten Matrix prüft den sonst
    // unerreichbaren Pflichtfall, ohne Authentifizierung oder Guard zu ersetzen.
    const previous = ROLE_PERMISSIONS.viewer;
    ROLE_PERMISSIONS.viewer = [];
    try {
      const response = await categories(viewer);
      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ categories: [] });
      expect(read).not.toHaveBeenCalled();
    } finally {
      ROLE_PERMISSIONS.viewer = previous;
    }
  });

  it("F7 Abruffehler ist ein benannter Fehler statt einer falschen leeren Liste", async () => {
    const { create, repos, categories } = await setup();
    await create("A");
    vi.spyOn(repos.koRepo, "listForSearch").mockRejectedValueOnce(
      new Error("Interne Ablagedetails"),
    );
    const response = await categories();
    expect(response.statusCode).toBe(500);
    expect(response.json()).toEqual({ error: "INTERNAL", message: "Unerwarteter Fehler." });
    const recovered = await categories();
    expect(recovered.statusCode).toBe(200);
    expect(recovered.json()).toEqual({ categories: [{ name: "A", count: 1 }] });
  });

  it("F8 Namen bleiben exakt und die Reihenfolge ist gebietsunabhängig", async () => {
    const { create, categories } = await setup();
    for (const name of ["ä", "a", "Z", "A", " A ", "__proto__"]) {
      await create(name);
    }
    expect((await categories()).json()).toEqual({
      categories: [
        { name: " A ", count: 1 },
        { name: "A", count: 1 },
        { name: "Z", count: 1 },
        { name: "__proto__", count: 1 },
        { name: "a", count: 1 },
        { name: "ä", count: 1 },
      ],
    });
  });

  it("F9 der nächste Abruf sieht Änderungen, Papierkorb und Sichtbarkeitsentzug", async () => {
    const { create, user, services, categories } = await setup();
    const viewer = await user("leser", "viewer");
    const ko = await create("A");
    expect((await categories(viewer)).json()).toEqual({ categories: [{ name: "A", count: 1 }] });
    await services.ko.updateCategory(ko.id, "B");
    expect((await categories(viewer)).json()).toEqual({ categories: [{ name: "B", count: 1 }] });
    await services.ko.setConfidentiality(ko.id, "vertraulich", ko.author);
    expect((await categories(viewer)).json()).toEqual({ categories: [] });
    expect((await categories()).json()).toEqual({ categories: [{ name: "B", count: 1 }] });
    await services.ko.delete(ko.id, ko.author);
    expect((await categories()).json()).toEqual({ categories: [] });
  });

  // Zwei Anmeldungen, jede EINZELN gemessen: so geht „irgendein Trim kam an" nicht durch, denn
  // `params` unterscheidet sich zwischen beiden Rollen in beiden Werten.
  it.each([{ rolle: "controller" as Role }, { rolle: "experte" as Role }])(
    "F10 der SQL-Trim erreicht die Datenquelle — ganzer Vertrag, Anmeldung $rolle",
    async ({ rolle }) => {
      const { user, create, repos, categories } = await setup();
      const frager = await user(`f10-${rolle}`, rolle);
      await create("Bereich A");
      // Spion OHNE Ersatz: die echte Ablage antwortet weiter, die Antwort wird mitgeprüft.
      const read = vi.spyOn(repos.koRepo, "listForSearch");
      const response = await categories(frager);

      expect(
        read.mock.calls.length,
        `${ANRUFSTELLE} — erwartet: genau ein Abruf der Datenquelle. Gezählt: ${read.mock.calls.length}. Ein nie erfolgter Aufruf belegt nichts.`,
      ).toBe(1);
      const trim: KoSichtbarkeitstrim | undefined = read.mock.calls[0]?.[1];
      // `can` ist die eine Quelle der Rollenregel — hier wird sie benutzt, nicht abgeschrieben.
      const erwartet = [can(rolle, "ko.validate"), frager.id];
      const befund = trimBefund(trim, erwartet);

      // (a) das Prädikat selbst: eine Zeichenkette, die den Papierkorb als GANZE Bedingung
      // (`<traeger>.deleted_at_key IS NULL`) sowie Stufe und Autor der lebenden Zeile nennt — und
      // die den übergebenen Träger und Platzhalterindex wirklich benutzt.
      expect(
        befund.sql,
        meldung(
          "sql() als Prädikat über deleted_at_key IS NULL, confidentiality_key, author_key",
          trim,
        ),
      ).toEqual([]);

      // (b) die Werte des FRAGENDEN, nicht irgendeines Betrachters.
      expect(
        befund.params,
        meldung(`genau zwei Werte des Fragenden: ${JSON.stringify(erwartet)}`, trim),
      ).toEqual([]);

      // (c) die Entscheidung für Adapter ohne SQL.
      expect(befund.trifftZu, meldung("trifftZu als Funktion", trim)).toEqual([]);

      expect(response.statusCode, response.body).toBe(200);
      expect(response.json()).toEqual({ categories: [{ name: "Bereich A", count: 1 }] });
    },
  );

  it("F11 jeder Abruf trägt die Sicht SEINES Fragenden — kein einmal erhobener, wiederverwendeter Trim", async () => {
    const { user, create, repos, categories } = await setup();
    const controller = await user("f11-controller", "controller");
    const experte = await user("f11-experte", "experte");
    await create("Bereich A");
    const read = vi.spyOn(repos.koRepo, "listForSearch");

    const ersteAntwort = await categories(controller);
    const zweiteAntwort = await categories(experte);
    expect([ersteAntwort.statusCode, zweiteAntwort.statusCode], ersteAntwort.body).toEqual([
      200, 200,
    ]);
    expect(
      read.mock.calls.length,
      `${ANRUFSTELLE} — erwartet: zwei Abrufe der Datenquelle, einer je Anmeldung. Gezählt: ${read.mock.calls.length}.`,
    ).toBe(2);

    const ersterTrim: KoSichtbarkeitstrim | undefined = read.mock.calls[0]?.[1];
    const zweiterTrim: KoSichtbarkeitstrim | undefined = read.mock.calls[1]?.[1];
    const ersteErwartung = [can("controller", "ko.validate"), controller.id];
    const zweiteErwartung = [can("experte", "ko.validate"), experte.id];
    expect(
      ersterTrim?.params,
      meldung(`für den ersten Fragenden ${JSON.stringify(ersteErwartung)}`, ersterTrim),
    ).toEqual(ersteErwartung);
    expect(
      zweiterTrim?.params,
      meldung(`für den zweiten Fragenden ${JSON.stringify(zweiteErwartung)}`, zweiterTrim),
    ).toEqual(zweiteErwartung);
    // Der zweite Abruf darf nicht den Trim des ersten weiterbenutzen.
    expect(
      zweiterTrim?.params,
      `${ANRUFSTELLE} — erwartet: der zweite Abruf erhebt den Trim NEU für seinen Fragenden. Angekommen ist zweimal dasselbe: ${angekommen(zweiterTrim)}.`,
    ).not.toEqual(ersterTrim?.params);
  });

  it("F12 der Satz des Lesewege-Sammlers über diese Route ist von der Messung gedeckt", async () => {
    const eintrag = sammlerEintrag("GET /api/categories");
    const fundstelle = `${SAMMLER_PFAD}:${eintrag.zeile}`;
    expect(
      eintrag.urteil,
      `${fundstelle} — erwartet: das Urteil PRAEDIKAT, das diese Messung deckt. Gefunden: ${eintrag.urteil}.`,
    ).toBe("PRAEDIKAT");

    // Die GANZE Aussage lesen, nicht nach Stichworten suchen: Form, GEGENSTAND und Hälften. Ein
    // Satz über einen anderen Gegenstand ist von dieser Messung nicht gedeckt, auch wenn er
    // dieselben zwei Hälften nennt.
    const form = SATZFORM.exec(eintrag.grund);
    expect(
      form?.groups?.haelften,
      `${fundstelle} — erwartet: ein Satz der Form "JOB <nr> — <Gegenstand> erst nach <A> + <B>.". Gefunden: "${eintrag.grund}".`,
    ).toBeTypeOf("string");
    const gegenstand = zerlege(form?.groups?.gegenstand ?? "", " und ", GEGENSTAND_WORTE);
    const haelften = zerlege(form?.groups?.haelften ?? "", "+", HAELFTEN_WORTE);
    expect(
      gegenstand.unbekannt,
      `${fundstelle} — die Aussage spricht über ${JSON.stringify(gegenstand.unbekannt)}; dieser Test misst ausschliesslich die Bereichsnamen ("Kategorien") und ihre Zahlen ("Zähler") dieser Route und kann davon nichts decken. Ganzer Satz: "${eintrag.grund}".`,
    ).toEqual([]);
    expect(
      haelften.unbekannt,
      `${fundstelle} — die Aussage nennt als Hälfte ${JSON.stringify(haelften.unbekannt)}; dieser Test kennt nur sqlSichtbarkeitFuer und sichtbareFuer und kann den Zusatz nicht decken. Ganzer Satz: "${eintrag.grund}".`,
    ).toEqual([]);
    const behauptet = {
      kategorien: gegenstand.genannt.has("kategorien"),
      zaehler: gegenstand.genannt.has("zaehler"),
      sql: haelften.genannt.has("sql"),
      node: haelften.genannt.has("node"),
    };

    const { user, create, repos, categories } = await setup();
    const fremder = await user("f12-fremder", "experte");
    const frager = await user("f12-frager", "experte");
    // ZWEI Zeilen tragen "Gemeinsam", eine davon fremd und vertraulich: damit trennt sich der
    // Zähler (1 statt 2) vom blossen Vorkommen des Namens. "Nur Fremd" fehlt dem Fragenden ganz.
    const angelegt = [
      "Gemeinsam · intern",
      "Gemeinsam · fremd+vertraulich",
      "Nur Fremd · fremd+vertraulich",
    ];
    await create("Gemeinsam");
    await create("Gemeinsam", { author: fremder.id, confidentiality: "vertraulich" });
    await create("Nur Fremd", { author: fremder.id, confidentiality: "vertraulich" });
    const sichtbareAntwort = [{ name: "Gemeinsam", count: 1 }];
    const bereiche = (antwort: { json: <T>() => T }) =>
      (antwort.json<{ categories?: { name: string; count: number }[] }>().categories ?? []).map(
        (c) => ({ name: c.name, count: c.count }),
      );

    const echt = repos.koRepo.listForSearch.bind(repos.koRepo);
    const read = vi.spyOn(repos.koRepo, "listForSearch");

    // Erster Abruf: unverändert. Er belegt die SQL-Hälfte am tatsächlichen Aufrufargument und
    // zeigt am Ergebnis, wovon der Satz spricht — Bereichsnamen UND Zahlen.
    const mitNaht = await categories(frager);
    expect(mitNaht.statusCode, mitNaht.body).toBe(200);
    const abrufeMitNaht = read.mock.calls.length;
    const trim: KoSichtbarkeitstrim | undefined = read.mock.calls[0]?.[1];
    const befund = trimBefund(trim, [can("experte", "ko.validate"), frager.id]);
    const mitNahtListe = bereiche(mitNaht);

    // Zweiter Abruf: die Datenquelle IGNORIERT den Trim — genau der Zustand, den ein späterer
    // Deckel, Cursor oder ein trimloser Adapter herstellt. Was jetzt noch stimmt, verdankt die
    // Route allein der Node-Hälfte; eine leere Antwort belegt sie NICHT.
    read.mockImplementation((filter) => echt(filter));
    const ohneQuellentrim = await categories(frager);
    const ohneQuellentrimListe = bereiche(ohneQuellentrim);

    const gemessen = {
      kategorien: JSON.stringify(mitNahtListe.map((c) => c.name)) === JSON.stringify(["Gemeinsam"]),
      zaehler: mitNahtListe.find((c) => c.name === "Gemeinsam")?.count === 1,
      sql: abrufeMitNaht === 1 && vertragBelegt(befund),
      node:
        ohneQuellentrim.statusCode === 200 &&
        JSON.stringify(ohneQuellentrimListe) === JSON.stringify(sichtbareAntwort),
    };
    const belege = {
      kategorien: `die Route nannte die Bereiche ${JSON.stringify(mitNahtListe.map((c) => c.name))}; angelegt waren ${JSON.stringify(angelegt)}`,
      zaehler: `der Zähler zu "Gemeinsam" war ${JSON.stringify(mitNahtListe.find((c) => c.name === "Gemeinsam")?.count)}, erwartet 1 von 2 angelegten Zeilen dieses Namens`,
      sql:
        abrufeMitNaht === 1
          ? `angekommen ist ${angekommen(trim)}${vertragBelegt(befund) ? "" : ` — Mängel: ${JSON.stringify([...befund.sql, ...befund.params, ...befund.trifftZu])}`}`
          : `die Datenquelle wurde ${abrufeMitNaht}× abgerufen statt genau einmal`,
      node: `ohne Trim an der Datenquelle antwortete die Route mit ${ohneQuellentrim.statusCode} ${JSON.stringify(ohneQuellentrimListe)}, erwartet 200 ${JSON.stringify(sichtbareAntwort)}`,
    };
    expect(
      gemessen,
      `${fundstelle} behauptet für GET /api/categories: "${eintrag.grund}". Gemessen an ${ANRUFSTELLE} — ${(
        Object.keys(gemessen) as (keyof typeof gemessen)[]
      )
        .map((k) => `${k}: behauptet=${behauptet[k]}, gemessen=${gemessen[k]} (${belege[k]})`)
        .join(" · ")}.`,
    ).toEqual(behauptet);
  });
});
