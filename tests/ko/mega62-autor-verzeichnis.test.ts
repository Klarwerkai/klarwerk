// ================================================================================================
// AUFTRAG-mega62 BLOCK H — DER AUTORENNAME WIRD AUFGELÖST, UND WAS PASSIERT, WENN NICHT.
// ================================================================================================
//
// DER BEFUND (Register A22, Live-Screenshot vom 30.07.): An den Objekten stand „Autor: Unbekannte
// Person (…)". Zwei Hypothesen waren zu prüfen.
//
// HYPOTHESE 1 — `listUsers()` liefert die Demo-Nutzer nicht mit (etwa weil sie als wartend gelten):
// WIDERLEGT, dreifach. Weder Dienst noch Repo noch Route filtern nach Status
// (services/auth/src/service.ts listUsers → users.list() → map(toPublic);
// services/auth/src/repo-pg.ts `SELECT * FROM users ORDER BY created_at`, KEINE WHERE-Klausel;
// services/auth/src/routes.ts /api/directory mappt nur id+name). Und der Seed gibt die Konten
// ausdrücklich frei (services/app/src/seed-demo.ts, ensureDemoUser → approveUser). Beides zusammen
// heisst: selbst ein wartendes Konto stünde im Verzeichnis.
//
// HYPOTHESE 2 — ein früherer Purge hat den Autor gelöscht: NICHT REPRODUZIERBAR. Der Fall unten
// „das Verzeichnis kennt jeden Autor" fährt den echten Seed über die echten Dienste und findet
// KEINE verwaiste Autoren-Kennung. Damit ist die Hypothese nicht widerlegt (ein gewachsener
// Live-Bestand kann anders aussehen), aber sie erklärt den Befund nicht — und sie erklärt vor allem
// nicht, dass ALLE Objekte betroffen waren.
//
// WAS ES ERKLÄRT — der dritte Weg, und der ist beweisbar: `dir.data` ist `undefined`, wenn die
// Verzeichnis-Abfrage noch läuft ODER fehlgeschlagen ist. Die sechs Flächen schrieben
// `dir.data?.find(...)?.name` und bekamen dann `undefined` — woraufhin der Rückfall „Unbekannte
// Person" für JEDEN Autor auf JEDER Fläche gleichzeitig erschien. Ein Fehler wurde als Tatsache
// ausgegeben. Die Begründung im Volltext steht in apps/web/src/lib/koAuthor.ts.
//
// DER RÜCKFALL SELBST BLEIBT (mega51 F2) — er ist richtig und wird unten festgehalten.
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  AUTHOR_LOADING_KEY,
  AUTHOR_UNAVAILABLE_KEY,
  AUTHOR_UNKNOWN_KEY,
  makeAuthorNameResolver,
} from "../../apps/web/src/lib/koAuthor";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import { seedDemo } from "../../services/app/src/seed-demo";

const WURZEL = join(__dirname, "..", "..");

const TEXTE = {
  unknown: (ref: string) => `Unbekannte Person (${ref})`,
  loading: () => "Autorenname wird geladen",
  unavailable: () => "Autorenname nicht abrufbar",
};

/** Ein geladenes Verzeichnis — der Normalfall, kurz geschrieben. */
const GELADEN = (
  eintraege: { id: string; name: string }[],
): { data: { id: string; name: string }[]; isPending: false; isError: false } => ({
  data: eintraege,
  isPending: false,
  isError: false,
});

describe("mega62 H · der Name wird aufgelöst, wenn es einen gibt", () => {
  it("ein Objekt mit existierendem Autor zeigt dessen NAMEN", () => {
    const aufloesen = makeAuthorNameResolver(
      GELADEN([
        { id: "u-erik", name: "Erik Experte" },
        { id: "u-carla", name: "Carla Controller" },
      ]),
      TEXTE,
    );
    expect(aufloesen("u-erik")).toBe("Erik Experte");
    expect(aufloesen("u-carla")).toBe("Carla Controller");
  });

  it("RÜCKFALL: fehlt der Verzeichniseintrag WIRKLICH, bleibt die ehrliche Auskunft", () => {
    // Das ist mega51 F2 und bleibt genau so: keine rohe UUID, und zwei Unbekannte sehen nicht wie
    // einer aus. Der Rückfall ist richtig — er darf nur nicht für einen Ladefehler einstehen.
    const aufloesen = makeAuthorNameResolver(
      GELADEN([{ id: "u-erik", name: "Erik Experte" }]),
      TEXTE,
    );
    const a = aufloesen("83e361aa-0000-4000-8000-000000000001");
    const b = aufloesen("ffffffff-0000-4000-8000-000000000002");
    expect(a).toBe("Unbekannte Person (83e361)");
    expect(a).not.toBe(b); // zwei Unbekannte bleiben unterscheidbar
    expect(a).not.toContain("-"); // keine rohe Kennung
  });

  it("DER BEFUND: ohne Verzeichnis wird KEINE Aussage über die Person gemacht", () => {
    // Genau der Zustand aus dem Live-Screenshot. AUFTRAG-mega63 Block B: Hier stand bis mega62
    // EIN Fall für „läuft noch ODER fehlgeschlagen" — die Zusammenlegung, die ben beanstandet hat
    // (BERICHT-ben-sammel60-mega62.md, Abschnitt 3). Die beiden Zustände sind jetzt getrennt und
    // stehen einzeln in tests/ko/mega63-autor-drei-zustaende.test.ts; gemeinsam bleibt nur, was
    // beide WIRKLICH teilen: keiner von ihnen macht eine Aussage über die Person.
    for (const zustand of [
      { data: undefined, isPending: true, isError: false },
      { data: undefined, isPending: false, isError: true },
    ]) {
      const aufloesen = makeAuthorNameResolver(zustand, TEXTE);
      expect(aufloesen("83e361aa-0000-4000-8000-000000000001")).not.toContain("Unbekannte Person");
    }
  });

  it("ein LEERES Verzeichnis ist etwas anderes als KEIN Verzeichnis", () => {
    // Leer heisst: wir haben nachgesehen, da ist niemand. Das ist eine geprüfte Aussage.
    expect(makeAuthorNameResolver(GELADEN([]), TEXTE)("83e361aa")).toBe(
      "Unbekannte Person (83e361)",
    );
  });
});

describe("mega62 H · Hypothese 1 ist widerlegt, Hypothese 2 nicht reproduzierbar", () => {
  it("das Verzeichnis kennt JEDEN Autor des echten Demo-Bestands — keine verwaiste Kennung", async () => {
    const services = buildServices();
    const app = buildApp(services);
    // AUFTRAG-mega64 Block A: das Kennwort kommt aus dem Seed-ERGEBNIS, nicht mehr aus dem
    // Quelltext — der Seed erzeugt für jedes neu angelegte Konto ein Einmalkennwort.
    const geseedet = await seedDemo(services);
    const erikKennwort = geseedet.einmalkennwoerter.find(
      (z) => z.email === "erik@demo.klarwerk",
    )?.kennwort;

    const login = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "erik@demo.klarwerk", password: erikKennwort },
    });
    expect(login.statusCode).toBe(200);
    const headers = { authorization: `Bearer ${(login.json() as { token: string }).token}` };

    // Bewusst über die ECHTE Route, nicht über den Dienst: die Route ist das, was die Oberfläche
    // sieht — ein Filter oder ein Rechte-Riegel dort wäre genau Hypothese 1.
    const verzeichnis = await app.inject({ method: "GET", url: "/api/directory", headers });
    expect(verzeichnis.statusCode).toBe(200);
    const eintraege = verzeichnis.json() as { id: string; name: string }[];

    // Kalibrierung: das Verzeichnis ist nicht leer, und die Namen sind echt.
    expect(eintraege.length).toBeGreaterThanOrEqual(3);
    expect(eintraege.map((e) => e.name)).toContain("Erik Experte");
    expect(eintraege.map((e) => e.name)).toContain("Carla Controller");

    // Und JEDER Autor des Bestands ist auflösbar — der Zustand aus dem Screenshot entsteht hier
    // also nicht aus den Daten.
    const bekannt = new Set(eintraege.map((e) => e.id));
    const kos = await services.ko.list();
    expect(kos.length).toBeGreaterThan(0);
    const verwaist = kos.filter((k) => !bekannt.has(k.author)).map((k) => k.title);
    expect(verwaist, "verwaiste Autoren-Kennungen im Demo-Bestand").toEqual([]);

    // Und mit genau diesem Verzeichnis liefert die Auflösung echte Namen, keine Rückfälle.
    const aufloesen = makeAuthorNameResolver(GELADEN(eintraege), TEXTE);
    for (const ko of kos) {
      expect(aufloesen(ko.author)).not.toContain("Unbekannte Person");
    }
    await app.close();
  });

  it("die Verzeichnis-Route filtert NICHT nach Status — Hypothese 1, an der Quelle", () => {
    // Der Beleg als Sammler statt als Behauptung: weder Route noch Repo grenzen ein.
    const routen = readFileSync(join(WURZEL, "services/auth/src/routes.ts"), "utf8");
    const stelle = routen.indexOf('app.get("/api/directory"');
    expect(stelle).toBeGreaterThan(0);
    const block = routen.slice(stelle, stelle + 500);
    expect(block).toContain("service.listUsers()");
    expect(block).not.toContain("approved");
    expect(block).not.toContain("filter(");

    const repo = readFileSync(join(WURZEL, "services/auth/src/repo-pg.ts"), "utf8");
    expect(repo).toContain("SELECT * FROM users ORDER BY created_at");
  });
});

describe("mega62 H · die sechs Flächen benutzen den EINEN Weg", () => {
  it("keine Fläche löst Autorennamen mehr selbst auf", () => {
    // Die abgeschriebene Zeile war der Fehler — sechsmal dieselbe. Wer sie wieder einbaut, wird rot.
    const seiten = join(WURZEL, "apps", "web", "src", "pages");
    const treffer: string[] = [];
    for (const datei of readdirSync(seiten)) {
      if (!datei.endsWith(".tsx") || datei.includes(".test.")) {
        continue;
      }
      const inhalt = readFileSync(join(seiten, datei), "utf8").replace(/^\s*\/\/.*$/gm, "");
      if (/\bauthorDisplayName\s*\(/.test(inhalt)) {
        treffer.push(datei);
      }
    }
    expect(treffer, "diese Seiten lösen den Namen wieder selbst auf").toEqual([]);
  });

  it("die sechs Flächen hängen am Haken — namentlich, weil sie der Befund waren", () => {
    const seiten = join(WURZEL, "apps", "web", "src", "pages");
    for (const datei of [
      "Library.tsx",
      "KnowledgeDetail.tsx",
      "MyTasks.tsx",
      "Ask.tsx",
      "Risk.tsx",
      "Validation.tsx",
    ]) {
      const inhalt = readFileSync(join(seiten, datei), "utf8");
      expect(inhalt, `${datei} benutzt den Haken nicht`).toContain("useAuthorName()");
    }
  });

  it("jeder Zustand hat einen Schlüssel in allen drei Sprachen", () => {
    const i18n = readFileSync(join(WURZEL, "apps/web/src/i18n.ts"), "utf8");
    // AUFTRAG-mega63 Block B: aus zwei Schlüsseln werden drei — der vierte Fall ist der Name selbst.
    for (const schluessel of [AUTHOR_UNKNOWN_KEY, AUTHOR_LOADING_KEY, AUTHOR_UNAVAILABLE_KEY]) {
      const treffer = i18n.split("\n").filter((z) => z.includes(`"${schluessel}"`));
      expect(treffer.length, `${schluessel} fehlt in einer Sprache`).toBe(3);
    }
  });
});
