// @vitest-environment jsdom
// ================================================================================================
// JOB 1132 · D1 — DER IMPORT-DEEP-LINK TRENNT UNBEKANNT, VERBOTEN UND EHRLICHE LEERE QUELLE.
// ================================================================================================
//
// HERKUNFT: JOB 931 D1 (`RUECKGABE-PRO-JOB-931-D1-CONFLUENCE-VERSCHACHTELUNG.md`) und BEN4s
// Pruefluecke 1 (`BEN4-PRUEFUNG-JOB-931-D1.md:12`): „konkreter UI-Test fuer T8: Ort
// `apps/web/src/lib/importSelectView`; Fall Kind mit `sourcePath` auf nicht importierten
// Elternteil; erwartet aktuell leerer Ordnerknoten ohne Fehlermeldung."
//
// JOB 931 §3 T8 und §4 B2 im Wortlaut: ein Kind, dessen Elternseite ausserhalb der Importmenge
// liegt, erzeugt einen Ordnerknoten `KW Fremdeltern` OHNE eigene Zeile — sichtbar, aber ohne
// Warnung, ohne `failed`, ohne Zaehler. B2: „Der leere Ordner bekommt eine Stimme."
//
// DIESER DURCHGANG BAUT DIE DATENSEITE DIESER STIMME und bewacht die vier Zustaende der Route.
//
// ZWEI TEILE, beide am echten Produktpfad:
//   A · `apps/web/src/lib/importSelectView.ts` — welcher Ordner ist nach einer Seite benannt, die
//       gar nicht in dieser Auswahl steckt? Plus gemountet: was der Baum daraus heute zeigt.
//   B · `services/app/src/routes/import-run-routes.ts` — unbekannte Kennung, fehlendes Recht,
//       leere Quelle und leere Items sind VIER Zustaende, ueber die echte HTTP-Grenze gemessen
//       (`app.inject`, kein Socket).
//
// WAS DIESER TEST NICHT TUT: Er legt keine Confluence-Seite an und ruft keine externe Anwendung.
// Die Wireformen entstehen aus der echten Komposition (`buildApp`/`buildServices`) und einem
// echten Lauf ueber die echte Startroute.
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import type { ImportPreviewEntry } from "../../apps/web/src/api/types";
import { ImportPreviewTree } from "../../apps/web/src/components/ImportPreviewTree";
import {
  type PreviewRow,
  folderTree,
  groupCheckboxState,
  ordnerOhneEigeneZeile,
} from "../../apps/web/src/lib/importSelectView";
import { buildApp, buildServices } from "../../services/app/src/build-app";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// ------------------------------------------------------------------------------------------------
// Teil A · Der Ordnerbaum
// ------------------------------------------------------------------------------------------------

const RAUM = "KWTEST";

function seite(title: string, sourcePath?: string[]): ImportPreviewEntry {
  return {
    title,
    hasImage: false,
    themes: [],
    sourceScope: RAUM,
    ...(sourcePath ? { sourcePath } : {}),
  };
}

function zeilen(entries: readonly ImportPreviewEntry[]): PreviewRow[] {
  return entries.map((entry, index) => ({ entry, index }));
}

describe("JOB 1132 · A1-A5 · ein nicht importierter Elternteil wird BENANNT, nicht aufgeloest", () => {
  it("A1 · die Waise aus JOB 931 T8: der Ordner traegt einen Titel, den keine Zeile hat", () => {
    // Genau der Fall T8: `KW Waise` haengt unter `KW Fremdeltern`, aber `KW Fremdeltern` ist
    // selbst nicht in der Auswahl. Heute entsteht dafuer ein Ordner wie jeder andere.
    const rows = zeilen([seite("KW Waise", ["KW Fremdeltern"])]);
    const befund = ordnerOhneEigeneZeile(rows);
    expect(befund).toHaveLength(1);
    expect(befund[0]?.segment).toBe("KW Fremdeltern");
    expect(befund[0]?.pfad, "der volle Pfad, Wurzel zuerst").toEqual([RAUM, "KW Fremdeltern"]);
    expect(befund[0]?.rows, "die Zeilen darunter sind echt — nur ihr Elternteil fehlt").toBe(1);
  });

  it("A2 · ist die Elternseite mitimportiert, gibt es NICHTS zu melden", () => {
    // T2 + T3 aus JOB 931: `KW Gruppe A` ist selbst eine Zeile der Auswahl.
    const rows = zeilen([seite("KW Gruppe A"), seite("KW Kind A1", ["KW Gruppe A"])]);
    expect(ordnerOhneEigeneZeile(rows)).toEqual([]);
  });

  it("A3 · die WURZEL ist ein Quell-Container, keine Seite — sie wird nie gemeldet", () => {
    // `sourceScope` ist der Confluence-Space. Ihn als „fehlende Elternseite" zu melden waere die
    // erfundene Aufloesung, die dieser Durchgang gerade verhindern soll.
    const rows = zeilen([seite("KW Flach")]);
    expect(ordnerOhneEigeneZeile(rows)).toEqual([]);
  });

  it("A4 · mehrere Ebenen: jede unbelegte Ebene wird einzeln benannt", () => {
    // T4-Form, aber beide Ahnen ausserhalb der Auswahl.
    const rows = zeilen([seite("KW Enkel", ["KW Gruppe A", "KW Kind A1"])]);
    const befund = ordnerOhneEigeneZeile(rows);
    expect(befund.map((o) => o.segment)).toEqual(["KW Gruppe A", "KW Kind A1"]);
    expect(befund.map((o) => o.pfad)).toEqual([
      [RAUM, "KW Gruppe A"],
      [RAUM, "KW Gruppe A", "KW Kind A1"],
    ]);
  });

  it("A5 · EHRLICHE GRENZE: gedeckt wird ueber den TITEL, nicht ueber die Id", () => {
    // JOB 931 L2: `sourcePath` besteht aus Titeln. Eine gleichnamige Seite aus einem ANDEREN Zweig
    // deckt den Ordner deshalb mit. Das ist kein Fehler dieser Funktion, sondern die Grenze des
    // heutigen Vertrags — sie wird hier festgehalten statt verschwiegen.
    const rows = zeilen([
      seite("KW Kind A1"), // gleicher Titel, anderer Zweig
      seite("KW Waise", ["KW Kind A1"]),
    ]);
    expect(ordnerOhneEigeneZeile(rows), "Titelgleichheit deckt — bis es Ids gibt").toEqual([]);
  });

  it("A6 · MESSBELEG: ein Eintrag OHNE Elternkette landet in der Wurzel, nicht in „Sonstiges“", () => {
    // JOB 931 V7. Dieser Fall behauptet nichts Neues — er bewacht, dass die bestehende Zusage
    // erhalten bleibt, waehrend die Datenseite darueber waechst.
    const rows = zeilen([seite("KW Flach"), seite("KW Kind A1", ["KW Gruppe A"])]);
    const baum = folderTree(rows);
    expect(baum).toHaveLength(1);
    expect(baum[0]?.value).toBe(RAUM);
    expect(
      baum[0]?.ownRows?.map((r) => r.entry.title),
      "die flache Seite haengt an der Wurzel",
    ).toEqual(["KW Flach"]);
    expect(baum[0]?.children?.map((c) => c.value)).toEqual(["KW Gruppe A"]);
  });
});

// ------------------------------------------------------------------------------------------------
// Teil A (gemountet) · Was der Baum daraus heute zeigt
// ------------------------------------------------------------------------------------------------

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

function mount(node: JSX.Element): void {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root.render(node);
  });
}

afterEach(() => {
  if (!root) {
    return;
  }
  act(() => {
    root.unmount();
  });
  container.remove();
});

describe("JOB 1132 · A7 · gemountet: der Ordner steht auf dem Schirm, seine Herkunft ist benannt", () => {
  it("A7 · Ordner und Kindzeile sind sichtbar; der Befund nennt genau diesen Ordner", () => {
    const rows = zeilen([seite("KW Waise", ["KW Fremdeltern"])]);
    const checked = rows.map(() => false);
    mount(
      createElement(ImportPreviewTree, {
        groups: folderTree(rows),
        isOpen: () => true,
        setOpen: () => undefined,
        checkStateOf: (r: readonly PreviewRow[]) => groupCheckboxState(checked, r),
        onToggleGroup: () => undefined,
        labelOf: (group: { value: string }) => group.value,
        countLabel: (n: number) => `${n}`,
        renderRow: ({ entry, index }: PreviewRow) =>
          createElement("li", { key: index }, entry.title),
      }),
    );
    const beschriftungen = [...container.querySelectorAll("summary span")].map((el) =>
      el.textContent?.trim(),
    );
    expect(beschriftungen, "Wurzel und Unterordner stehen da").toContain("KW Fremdeltern");
    expect(container.textContent, "die Kindzeile ist sichtbar").toContain("KW Waise");
    // Die Anzeige fuehrt den Ordner heute wie jeden anderen — die Datenseite weiss es besser.
    // Genau diese Luecke ist JOB 931 B2, und sie liegt in einer Datei, die dieser Durchgang
    // nicht schreiben darf (s. Rueckgabe).
    expect(ordnerOhneEigeneZeile(rows).map((o) => o.segment)).toEqual(["KW Fremdeltern"]);
  });
});

// ------------------------------------------------------------------------------------------------
// Teil B · Die vier Zustaende der Lauf-Route, ueber die echte HTTP-Grenze
// ------------------------------------------------------------------------------------------------

// Der Import-Schalter muss an sein, sonst ist die Route gar nicht registriert und der 403-Fall
// pruefte nur, dass es sie nicht gibt (Muster aus `w2a-import-run-routes-148.test.ts:47-56`).
//
// JOB 1132 D2 — MIT RUECKNAHME. Die D1-Fassung setzte den Schalter und nahm ihn NICHT zurueck.
// `process.env` ist Zustand des WORKER-PROZESSES, und Vitest faehrt mehrere Testdateien je Worker:
// jede Datei, die danach im selben Prozess laeuft, haette den Schalter geerbt, ohne ihn gesetzt zu
// haben. Das Bestandsmuster direkt nebenan macht es vollstaendig — D1 hatte es zitiert und nur zur
// Haelfte uebernommen. Der urspruengliche Wert wird gemerkt und in `afterAll` exakt
// wiederhergestellt (fehlte er, wird der Schluessel geloescht, nicht auf "" gesetzt).
const IMPORT_SCHALTER_VORHER = process.env.KLARWERK_CONFLUENCE_IMPORT;
beforeAll(() => {
  process.env.KLARWERK_CONFLUENCE_IMPORT = "1";
});
afterAll(() => {
  if (IMPORT_SCHALTER_VORHER === undefined) {
    // `Reflect.deleteProperty` statt `delete`: Die Biome-Ausnahme fuer `performance/noDelete`
    // gilt laut `biome.json:18` nur fuer `**/*.test.ts` — diese Datei ist `.tsx`. Der von Biome
    // vorgeschlagene Ersatz `= undefined` waere hier FALSCH: `process.env` wandelt jeden Wert in
    // eine Zeichenkette, der Schluessel truege danach das Literal "undefined" und gaelte als
    // gesetzt. Nur echtes Entfernen stellt „war nie da" wieder her.
    Reflect.deleteProperty(process.env, "KLARWERK_CONFLUENCE_IMPORT");
  } else {
    process.env.KLARWERK_CONFLUENCE_IMPORT = IMPORT_SCHALTER_VORHER;
  }
});

const ADMIN = { name: "Pedi", email: "pedi1132@example.com", password: "geheim-1234" };
const ERGEBNIS = (id: string) => `/api/admin/import/runs/${id}/result`;

async function appMitAdmin() {
  const app = buildApp(buildServices());
  await app.inject({ method: "POST", url: "/api/auth/register", payload: ADMIN });
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: ADMIN.email, password: ADMIN.password },
  });
  const token = (login.json() as { token: string }).token;
  expect(token, "der Bootstrap-Admin muss ein Token bekommen").not.toBe("");
  return { app, headers: { authorization: `Bearer ${token}` } };
}

describe("JOB 1132 · B1-B5 · unbekannt, verboten, leere Quelle und leere Items sind VIER Zustaende", () => {
  it("B1 · unbekannte Kennung → 404, und der Koerper spiegelt die Kennung NICHT zurueck", async () => {
    const { app, headers } = await appMitAdmin();
    const gesucht = "gibt-es-nicht-1132";
    const antwort = await app.inject({ method: "GET", url: ERGEBNIS(gesucht), headers });
    expect(antwort.statusCode).toBe(404);
    expect(antwort.json()).toEqual({ error: "NOT_FOUND", message: "Nicht gefunden." });
    // Entscheidung 2 im Routenkopf: die Fehlermeldung ist selbst keine Auskunft.
    expect(antwort.body, "die gesuchte Kennung darf nicht zurueckkommen").not.toContain(gesucht);
  });

  it("B2 · fehlendes Recht → 403, und zwar VOR jeder Objektaufloesung", async () => {
    const { app, headers } = await appMitAdmin();
    const angelegt = await app.inject({
      method: "POST",
      url: "/api/users",
      headers,
      payload: {
        name: "Bea",
        email: "bea1132@example.com",
        password: "geheim-1234",
        role: "experte",
      },
    });
    expect(angelegt.statusCode, "die zweite Identitaet muss anlegbar sein").toBe(201);
    const login = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "bea1132@example.com", password: "geheim-1234" },
    });
    const fremd = { authorization: `Bearer ${(login.json() as { token: string }).token}` };

    // DIESELBE, NICHT EXISTIERENDE Kennung wie in B1. Waere das Recht NACH dem Repo-Zugriff
    // geprueft, kaeme hier 404 — und die Antwort verriete, ob es den Lauf gibt.
    const antwort = await app.inject({
      method: "GET",
      url: ERGEBNIS("gibt-es-nicht-1132"),
      headers: fremd,
    });
    expect(antwort.statusCode).toBe(403);
    expect((antwort.json() as { error?: string }).error).toBe("FORBIDDEN");
  });

  it("B3 · leere Quelle → 200 mit `source: null`, nicht mit einem erfundenen Leer-Objekt", async () => {
    const { app, headers } = await appMitAdmin();
    const start = await app.inject({
      method: "POST",
      url: "/api/admin/import/confluence",
      headers,
      payload: {},
    });
    expect(start.statusCode, "der Lauf muss startbar sein").toBe(200);
    const importId = (start.json() as { importId: string }).importId;

    const antwort = await app.inject({ method: "GET", url: ERGEBNIS(importId), headers });
    expect(antwort.statusCode).toBe(200);
    const koerper = antwort.json() as Record<string, unknown>;
    expect(koerper.run, "der Lauf selbst ist da — er ist nicht „unbekannt“").toBeTruthy();
    expect((koerper.run as { importId?: string }).importId, "genau der adressierte Lauf").toBe(
      importId,
    );
    // Das Feld FEHLT nicht — es steht auf `null`. „Noch keine Quelle“ ist eine Aussage.
    expect(Object.hasOwn(koerper, "source"), "`source` wird immer gefuehrt").toBe(true);
    expect(koerper.source).toBeNull();
  });

  it("B4 · leere Items → 200 mit `items: []` — ein Array, nicht null und nicht fehlend", async () => {
    const { app, headers } = await appMitAdmin();
    const start = await app.inject({
      method: "POST",
      url: "/api/admin/import/confluence",
      headers,
      payload: {},
    });
    const importId = (start.json() as { importId: string }).importId;
    const koerper = (
      await app.inject({ method: "GET", url: ERGEBNIS(importId), headers })
    ).json() as Record<string, unknown>;
    expect(Array.isArray(koerper.items), "`items` ist immer ein Array").toBe(true);
    expect(koerper.items).toEqual([]);
  });

  it("B5 · die vier Zustaende sind paarweise unterscheidbar", async () => {
    const { app, headers } = await appMitAdmin();
    const start = await app.inject({
      method: "POST",
      url: "/api/admin/import/confluence",
      headers,
      payload: {},
    });
    const importId = (start.json() as { importId: string }).importId;

    const unbekannt = await app.inject({ method: "GET", url: ERGEBNIS("weg-1132"), headers });
    const vorhanden = await app.inject({ method: "GET", url: ERGEBNIS(importId), headers });
    const ohneToken = await app.inject({ method: "GET", url: ERGEBNIS(importId) });
    const gelesen = vorhanden.json() as Record<string, unknown>;

    // Vier Signale, vier verschiedene Werte — keiner ist aus einem anderen ableitbar.
    const signale = [
      unbekannt.statusCode, // 404 unbekannte Kennung
      ohneToken.statusCode, // 401/403 kein Recht
      vorhanden.statusCode, // 200 Lauf da
    ];
    expect(new Set(signale).size, "unbekannt, unberechtigt und vorhanden sind drei Codes").toBe(3);
    // Und innerhalb des 200 trennen `source` und `items` die beiden leeren Faelle voneinander.
    expect(gelesen.source).toBeNull();
    expect(gelesen.items).toEqual([]);
    expect(gelesen.source, "leere Quelle und leere Items sind NICHT derselbe Wert").not.toEqual(
      gelesen.items,
    );
  });
});
