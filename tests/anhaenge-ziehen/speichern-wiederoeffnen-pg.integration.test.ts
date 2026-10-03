// ================================================================================================
// ANHÄNGE ZIEHEN · K2 — GEZOGEN, REGULÄR GESPEICHERT, AUS POSTGRESQL WIEDERGEÖFFNET.
// ================================================================================================
//
// DER FEHLENDE BELEG (Ben, versuch-02): „zwei aus der Liste gezogene Bildvorkommen über den
// regulären Produktspeicherweg gespeichert und nach erneutem Öffnen mit ihren unterschiedlichen
// Ankern, Zuordnungen und Einfügepositionen wieder geladen". Die Bühne `buehne.tsx` ersetzt das
// Speichern durch `sanitizeHtml` + Neumontieren; das hier tut es nicht.
//
// DIE KETTE (Vorbild `tests/entwurf-datenerhalt/blatt-rundlauf-pg-im-browser.integration.test.ts`):
//     Chromium auf der gebauten App (`apps/web/dist`) → /erfassen → „Datei ▾" → „Formular
//     (Experten)" → Bild über das sichtbare Upload-Label → Bildpalette → dasselbe Bild zweimal mit
//     der echten Maus an zwei Textstellen gezogen → sichtbarer Knopf „Als Entwurf speichern" (samt
//     der Rückfrage, die das Produkt bei lokalen Bildern stellt) → echter Socket → Fastify →
//     PostgreSQL. Danach:
//       · SQL: `SELECT data FROM drafts WHERE id = $1` — der gespeicherte Rumpf.
//       · frische Seite `/erfassen?draft=<id>` → „Datei ▾" → „Formular": die Fläche holt den
//         Entwurf über ihren echten `GET /api/drafts/:id` (Capture.tsx, JOB 3414) — dessen Antwort
//         wird mitgelesen, und der Editor zeigt das Geladene.
//     An allen vier Stellen (Editor vorher · SQL · GET · Editor nachher) dieselbe Struktur: zwei
//     Hüllen, zwei verschiedene Anker, je figure/img/figcaption mit DEMSELBEN Anker, gleiche Quelle,
//     gleiche Textstelle davor und danach.
//
// KEINE ATTRAPPEN: kein API-/DB-Mock, kein Modellaufruf, keine Nachbearbeitung des DOM.
//
// FEHLT EINE VORAUSSETZUNG (KLARWERK_PG_TEST_URL, `apps/web/dist`, Chromium), SCHEITERT DIESE DATEI
// LAUT. Sie wird ausdrücklich aufgerufen; ein Überspringen zählte dort als „erfüllt".
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import i18n from "../../apps/web/src/i18n";
import { createPool, migrate } from "../../services/app/src/db";
import { guardedLocalPgTestUrl } from "../../services/db-tx";
import type { Kontext, Seite } from "../gast-nutzerweg/browserweg";
import {
  fn,
  mitFlaeche,
  profil,
  starteChromium,
  tippeMitTastatur,
  warte,
} from "../gast-nutzerweg/browserweg";
import { PASSWORT, type Strecke, ersteinrichtung, starteStrecke } from "../gast-nutzerweg/strecke";
import {
  type Verbindungszeile,
  alsBefund,
  warteAufVerbindungsende,
} from "../gast-nutzerweg/verbindungsende";
import {
  type BrowserMitVersion,
  type Verbindung,
  entwurfszeile,
  pgUrl,
  pgVersion,
  stelleFlaecheBereit,
  zerlege,
} from "../import-wiederoeffnen-nutzerweg/strecke";
import { FALL_RAHMEN_MS, wartebudget } from "../ux19-speichern-oeffnen-reload/ux19-buehne";

const KENNZEICHEN = "[KLARWERK] Anhänge ziehen K2 PG-Rundlauf";
const KONTO = "anhaenge-ziehen@k2.test";
const FENSTER = { width: 1280, height: 1000 };
const BILD_NAME = "pumpe.png";
// Ein gültiges 1×1-PNG — das Produkt rechnet es selbst in sein Vorschaubild um.
const BILD_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64",
);
const TITEL = `K2 Anhänge ziehen ${Date.now()}`;
// Leerzeilen vorweg: die Bildpalette schwebt über dem oberen Rand des Schreibfelds. Die Zielwörter
// stehen darunter, damit die Maus wirklich auf dem TEXT losgelassen wird (geprüft vor jedem Zug).
const LEERZEILEN = 10;
const TEXT = "Alpha Beta Gamma Delta";

// Die Playwright-Fähigkeiten, die diese Probe zusätzlich zur gemeinsamen Hülle braucht — der
// ZUGANG zu dem, was Playwright ohnehin kann (Vorbild `import-wiederoeffnen-nutzerweg/strecke.ts`).
interface Antwort {
  url(): string;
  status(): number;
  json(): Promise<unknown>;
  request(): { method(): string };
}
interface Dateiwahl {
  setFiles(datei: { name: string; mimeType: string; buffer: Buffer }): Promise<void>;
}
type Buehne = Seite & {
  mouse: {
    move(x: number, y: number, o?: Record<string, unknown>): Promise<void>;
    down(): Promise<void>;
    up(): Promise<void>;
    click(x: number, y: number): Promise<void>;
  };
  on(ereignis: "response", f: (a: Antwort) => void): void;
  waitForEvent(ereignis: "filechooser", o?: Record<string, unknown>): Promise<Dateiwahl>;
  waitForResponse(f: (a: Antwort) => boolean, o?: Record<string, unknown>): Promise<Antwort>;
  close(o?: Record<string, unknown>): Promise<void>;
};
interface Punkt {
  x: number;
  y: number;
}
interface Figur {
  huelleId: string | null;
  bildId: string | null;
  unterschriftId: string | null;
  src: string;
  davor: string;
  danach: string;
}

let adminPool: Pool | undefined;
let pool: Pool | undefined;
let browser: BrowserMitVersion | undefined;
let strecke: Strecke | undefined;
let kontext: Kontext | undefined;
let flaeche = "nicht hergestellt";
const wegwerfDb = `klarwerk_anhaenge_ziehen_test_${`${Date.now()}`.slice(-9)}`;
const t = i18n.getFixedT("de");

function brauche<T>(wert: T | undefined, was: string): T {
  if (wert === undefined) {
    throw new Error(`${KENNZEICHEN}: ${was} fehlt — der Aufbau ist nicht bis dahin gekommen.`);
  }
  return wert;
}

async function seiteAusfuehren<T>(seite: Buehne, quelle: string): Promise<T> {
  return seite.evaluate<T>(fn(`() => (${quelle})`));
}

async function warteBis(seite: Buehne, quelle: string, was: string): Promise<void> {
  await warte(seite, `() => (${quelle})`, was, undefined, wartebudget("aufFlaechensatzWarten"));
}

// Das Schreibfeld des Expertenformulars — genau EINES, sichtbar.
const FELD = `(() => {
  const name = ${JSON.stringify(t("editor.bodyLabel"))};
  const alle = [...document.querySelectorAll('[role="textbox"][contenteditable="true"]')]
    .filter((e) => e.getAttribute("aria-label") === name && e.offsetParent !== null);
  if (alle.length !== 1) { throw new Error("Schreibfelder sichtbar: " + alle.length); }
  return alle[0];
})()`;

// Die Lage eines Rumpfes, aus HTML gelesen — für Editor, SQL-Zeile und GET-Antwort DIESELBE
// Ablesung. Text davor/danach whitespace-normalisiert (gefragt ist die Stelle im Text, nicht die
// Absatzknoten, die ein Parser daraus macht).
const lageAus = (htmlAusdruck: string): string => `(() => {
  const d = document.createElement("div");
  d.innerHTML = ${htmlAusdruck};
  const norm = (s) => s.replace(/\\s+/g, " ").trim();
  const davor = (k) => { const r = document.createRange(); r.setStart(d, 0); r.setEndBefore(k); return norm(r.toString()); };
  const danach = (k) => { const r = document.createRange(); r.setStartAfter(k); r.setEnd(d, d.childNodes.length); return norm(r.toString()); };
  return [...d.querySelectorAll("figure")].map((f) => ({
    huelleId: f.getAttribute("data-image-id"),
    bildId: f.querySelector("img")?.getAttribute("data-image-id") ?? null,
    unterschriftId: f.querySelector("figcaption")?.getAttribute("data-image-id") ?? null,
    src: f.querySelector("img")?.getAttribute("src") ?? "",
    davor: davor(f),
    danach: danach(f),
  }));
})()`;

async function mitte(seite: Buehne, elementAusdruck: string): Promise<Punkt> {
  return seiteAusfuehren<Punkt>(
    seite,
    `(() => { const e = ${elementAusdruck}; e.scrollIntoView({ block: "center" });
      const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`,
  );
}

const knopfMitText = (wurzel: string, text: string): string => `(() => {
  const k = [...${wurzel}.querySelectorAll("button")].find((b) =>
    (b.textContent || "").replace(/\\s+/g, " ").trim() === ${JSON.stringify(text)} && !b.disabled && b.offsetParent !== null);
  if (!k) { throw new Error("Knopf fehlt: " + ${JSON.stringify(text)}); }
  return k;
})()`;

// Die Werkzeugleiste DIESES Editors: der nächste Vorfahr des Schreibfelds mit dem Bildknopf.
const BILDKNOPF = `(() => {
  const titel = ${JSON.stringify(t("editor.image"))};
  for (let e = ${FELD}.parentElement; e; e = e.parentElement) {
    const k = e.querySelector('button[title="' + titel + '"]');
    if (k) { return k; }
  }
  throw new Error("kein Bildknopf am Schreibfeld");
})()`;

/** Die linke Kante von `wort` im Schreibfeld — sichtbar und tatsächlich über dem Feld. */
async function vorWort(seite: Buehne, wort: string): Promise<Punkt> {
  return seiteAusfuehren<Punkt>(
    seite,
    `(() => {
      const feld = ${FELD};
      const gang = document.createTreeWalker(feld, NodeFilter.SHOW_TEXT);
      for (let k = gang.nextNode(); k; k = gang.nextNode()) {
        const i = k.data.indexOf(${JSON.stringify(wort)});
        if (i < 0) { continue; }
        const r = document.createRange(); r.setStart(k, i); r.setEnd(k, i + 1);
        const b = r.getBoundingClientRect();
        const p = { x: b.left + 1, y: b.top + b.height / 2 };
        if (p.y < 0 || p.y > innerHeight || !feld.contains(document.elementFromPoint(p.x, p.y))) {
          throw new Error("Ziel verdeckt oder ausserhalb des Fensters: " + ${JSON.stringify(wort)} + " " + JSON.stringify(p));
        }
        return p;
      }
      throw new Error("Wort nicht im Schreibfeld: " + ${JSON.stringify(wort)});
    })()`,
  );
}

async function zieheBildVor(seite: Buehne, wort: string): Promise<void> {
  const knopf = await mitte(seite, BILDKNOPF);
  await seite.mouse.click(knopf.x, knopf.y);
  const quelle = await mitte(seite, knopfMitText("document", BILD_NAME));
  const ziel = await vorWort(seite, wort);
  await seite.mouse.move(quelle.x, quelle.y);
  await seite.mouse.down();
  await seite.mouse.move(quelle.x + 6, quelle.y + 6, { steps: 3 });
  await seite.mouse.move(ziel.x, ziel.y, { steps: 12 });
  await seite.mouse.up();
}

async function zumFormular(seite: Buehne): Promise<void> {
  await seite.click('[data-testid="blatt-werkzeug-datei"]');
  await warteBis(
    seite,
    `!!document.querySelector('[data-testid="blatt-menue-datei"]')`,
    "das Dateimenü ist offen",
  );
  const formular = await mitte(
    seite,
    knopfMitText(
      `document.querySelector('[data-testid="blatt-menue-datei"]')`,
      t("erfassen.weg.formular"),
    ),
  );
  await seite.mouse.click(formular.x, formular.y);
  await warteBis(
    seite,
    `(() => { try { return !!${FELD}; } catch { return false; } })()`,
    "das Expertenformular mit Schreibfeld steht",
  );
}

const figurenzahl = (n: number): string =>
  `(() => { try { return ${FELD}.querySelectorAll("figure").length === ${n}; } catch { return false; } })()`;

// Der Inhalt eines Feldes namens `bodyHtml`, wo immer er in der gelesenen Struktur steht.
function rumpfAus(wert: unknown): string | null {
  if (wert && typeof wert === "object") {
    for (const [k, v] of Object.entries(wert as Record<string, unknown>)) {
      if (k === "bodyHtml" && typeof v === "string") {
        return v;
      }
      const tief = rumpfAus(v);
      if (tief !== null) {
        return tief;
      }
    }
  }
  return null;
}

// Für Meldungen: eine data:-Quelle ist zehntausende Zeichen lang. Verglichen wird sie trotzdem voll.
const kurz = (f: Omit<Figur, "huelleId">) => ({
  ...f,
  src: `${f.src.slice(0, 24)}…(${f.src.length})`,
});

function pruefeLage(lage: Figur[], wo: string, soll?: Figur[]): void {
  expect(lage.length, `${wo}: Zahl der Bildhüllen`).toBe(2);
  const [a, b] = lage as [Figur, Figur];
  for (const f of lage) {
    expect(f.bildId, `${wo}: Bild ohne Anker`).toBeTruthy();
    expect(f.unterschriftId, `${wo}: Unterschrift trägt nicht den Anker ihres Bildes`).toBe(
      f.bildId,
    );
    // Die Hülle DARF den Anker mittragen (Produktvertrag `editorFigures.ts`/Sanitizer) — dann denselben.
    expect(f.huelleId ?? f.bildId, `${wo}: Hülle mit fremdem Anker`).toBe(f.bildId);
    expect(f.src.startsWith("data:image/"), `${wo}: Quelle ist nicht das Listenbild`).toBe(true);
  }
  expect(a.bildId, `${wo}: beide Vorkommen teilen einen Anker`).not.toBe(b.bildId);
  expect(a.src === b.src, `${wo}: die zwei Vorkommen zeigen nicht dasselbe Bild`).toBe(true);
  expect([a.davor, b.davor, b.danach], `${wo}: Einfügestellen`).toEqual([
    "Alpha",
    "Alpha Beta Gamma",
    "Delta",
  ]);
  if (soll) {
    // Die Hülle trägt den Anker im Editor nicht zwingend mit, im Gespeicherten schon — oben geprüft.
    const ohneHuelle = (l: Figur[]) =>
      l.map((f) => ({
        bildId: f.bildId,
        unterschriftId: f.unterschriftId,
        src: f.src,
        davor: f.davor,
        danach: f.danach,
      }));
    expect(ohneHuelle(lage).map(kurz), `${wo}: weicht vom Stand vor dem Speichern ab`).toEqual(
      ohneHuelle(soll).map(kurz),
    );
    expect(
      lage.map((f) => f.src).join("|") === soll.map((f) => f.src).join("|"),
      `${wo}: Bildquellen weichen ab`,
    ).toBe(true);
  }
}

async function anmelden(roh: Seite): Promise<void> {
  const basis = brauche(strecke, "die Messstrecke").basis;
  await roh.goto(`${basis}/`, { waitUntil: "domcontentloaded" });
  await warte(roh, `() => !!document.querySelector("#auth-email")`, "die Anmeldemaske steht");
  await tippeMitTastatur(roh, "#auth-email", KONTO, "E-Mail");
  await tippeMitTastatur(roh, "#auth-password", PASSWORT, "Passwort");
  await roh.keyboard.press("Enter");
  await warte(roh, `() => !document.querySelector("#auth-email")`, "die Anmeldung trägt");
}

describe("Anhänge ziehen · K2 · gezogen → regulär gespeichert → aus PostgreSQL wiedergeöffnet", () => {
  beforeAll(async () => {
    const url = guardedLocalPgTestUrl();
    if (!url) {
      throw new Error(
        `${KENNZEICHEN}: keine gesicherte KLARWERK_PG_TEST_URL — diese Probe ist damit NICHT gemessen (und nicht etwa bestanden).`,
      );
    }
    const verbindung: Verbindung | undefined = zerlege(url);
    if (!verbindung) {
      throw new Error(`${KENNZEICHEN}: KLARWERK_PG_TEST_URL nennt keinen Rechnernamen.`);
    }
    await i18n.changeLanguage("de");
    adminPool = new Pool({ connectionString: url });
    await adminPool.query("SELECT 1");
    await adminPool.query(`CREATE DATABASE ${wegwerfDb}`);
    flaeche = stelleFlaecheBereit();
    browser = (await starteChromium()) as BrowserMitVersion;

    pool = createPool(pgUrl(verbindung, wegwerfDb));
    await migrate(pool);
    strecke = await starteStrecke({ pool, ...mitFlaeche() });
    await ersteinrichtung(strecke, KONTO);

    const p = await profil(browser, FENSTER);
    kontext = p.kontext;
    await anmelden(p.seite);
    await (p.seite as unknown as Buehne).close({ runBeforeUnload: false });
    process.stderr.write(
      `${KENNZEICHEN} BELEG · Chromium ${browser.version()} · Socket-Port ${new URL(strecke.basis).port} · PostgreSQL „${await pgVersion(pool)}" · dist ${flaeche}\n`,
    );
  }, 900_000);

  afterAll(async () => {
    await kontext?.close().catch(() => undefined);
    await browser?.close();
    await strecke?.schliessen().catch(() => undefined);
    await pool?.end().catch(() => undefined);
    let rest: Verbindungszeile[] = [];
    if (adminPool) {
      const befund = await warteAufVerbindungsende(adminPool, wegwerfDb);
      rest = befund.rest;
      await adminPool
        .query(`DROP DATABASE IF EXISTS ${wegwerfDb} WITH (FORCE)`)
        .catch(() => undefined);
      await adminPool.end();
    }
    expect(
      rest,
      `beim DROP DATABASE hingen noch Verbindungen an ${wegwerfDb}:\n  ${alsBefund(rest)}`,
    ).toEqual([]);
  }, 120_000);

  it(
    "K2 · zwei gezogene Vorkommen behalten Anker, Zuordnung und Stelle über Speichern (PostgreSQL) und Wiederöffnen",
    async () => {
      const db = brauche(pool, "der Verbindungspool");
      const basis = brauche(strecke, "die Messstrecke").basis;
      const seite = (await brauche(kontext, "die Sitzung").newPage()) as unknown as Buehne;
      let id = "";
      let vorher: Figur[] = [];
      try {
        await seite.goto(`${basis}/erfassen`, {
          waitUntil: "load",
          timeout: wartebudget("neuLadenAdresse"),
        });
        await zumFormular(seite);

        // Titel — ohne ihn bietet das Produkt kein Speichern an (`eintragSicherbar`).
        const titelfeld = await mitte(
          seite,
          `(() => { const l = [...document.querySelectorAll("label")].find((x) =>
            ((x.querySelector("span") || {}).textContent || "").trim() === ${JSON.stringify(t("capture.fTitle"))});
            const f = l && l.querySelector("input, textarea");
            if (!f) { throw new Error("Titelfeld fehlt"); } return f; })()`,
        );
        await seite.mouse.click(titelfeld.x, titelfeld.y);
        await seite.keyboard.type(TITEL);

        // Das Bild über das sichtbare Upload-Label — der Dateidialog des Browsers.
        const details = await mitte(seite, knopfMitText("document", t("capture.advanced.title")));
        await seite.mouse.click(details.x, details.y);
        await warteBis(
          seite,
          `!!document.querySelector('input[type="file"][accept="image/*"]')`,
          "Bildauswahl in erweiterten Details offen",
        );

        const label = await mitte(
          seite,
          `[...document.querySelectorAll("label")].find((l) => (l.textContent || "").trim().startsWith(${JSON.stringify(t("capture.imagesUpload"))}) && l.querySelector('input[type="file"][accept="image/*"]'))`,
        );
        const wahl = seite.waitForEvent("filechooser", {
          timeout: wartebudget("aufFlaechensatzWarten"),
        });
        await seite.mouse.click(label.x, label.y);
        await (await wahl).setFiles({ name: BILD_NAME, mimeType: "image/png", buffer: BILD_PNG });

        // Text ins Schreibfeld — getippt.
        const feld = await mitte(seite, FELD);
        await seite.mouse.click(feld.x, feld.y);
        for (let i = 0; i < LEERZEILEN; i += 1) {
          await seite.keyboard.press("Enter");
        }
        await seite.keyboard.type(TEXT);

        // Die Bildpalette führt das hochgeladene Bild — dann zweimal ziehen.
        await zieheBildVor(seite, "Beta");
        await warteBis(seite, figurenzahl(1), "das erste gezogene Bild steht im Schreibfeld");
        await zieheBildVor(seite, "Delta");
        await warteBis(seite, figurenzahl(2), "das zweite gezogene Bild steht im Schreibfeld");

        vorher = await seiteAusfuehren<Figur[]>(seite, lageAus(`${FELD}.innerHTML`));
        pruefeLage(vorher, "Editor vor dem Speichern");

        // Sichtbarer Speicherknopf; das Produkt fragt bei lokalen Bildern nach (Galerie wird
        // verworfen, der Rumpf mit seinen Bildern bleibt) — diese Rückfrage wird bestätigt.
        const gespeichert = seite.waitForResponse(
          (a) =>
            ["POST", "PUT"].includes(a.request().method()) &&
            /^\/api\/drafts(\/[^/]+)?$/.test(new URL(a.url()).pathname),
          { timeout: wartebudget("aufFlaechensatzWarten") },
        );
        const sichern = await mitte(seite, knopfMitText("document", t("capture.saveDraft")));
        await seite.mouse.click(sichern.x, sichern.y);
        const bestaetigen = await mitte(
          seite,
          knopfMitText("document", t("capture.saveLimit.confirm")),
        );
        await seite.mouse.click(bestaetigen.x, bestaetigen.y);
        const antwort = await gespeichert;
        expect(antwort.status(), "Speichern über den Socket").toBeLessThan(300);
        const gesichert = (await antwort.json()) as { id?: unknown };
        id = typeof gesichert.id === "string" ? gesichert.id : "";
        expect(
          id,
          `die Speicherantwort nennt keine Entwurfskennung: ${JSON.stringify(gesichert).slice(0, 300)}`,
        ).not.toBe("");
      } finally {
        await seite.close({ runBeforeUnload: false }).catch(() => undefined);
      }

      // Die Zeile in PostgreSQL.
      const zeile = await entwurfszeile(db, id);
      expect(zeile, `keine drafts-Zeile ${id}`).not.toBeNull();
      const rumpfSql = rumpfAus(JSON.parse(zeile as string));
      expect(rumpfSql, "die drafts-Zeile trägt keinen bodyHtml").not.toBeNull();

      // Wiederöffnen auf einer frischen Seite — der echte GET wird mitgelesen.
      const neu = (await brauche(kontext, "die Sitzung").newPage()) as unknown as Buehne;
      try {
        const geholt: Antwort[] = [];
        neu.on("response", (a) => {
          if (a.request().method() === "GET" && new URL(a.url()).pathname === `/api/drafts/${id}`) {
            geholt.push(a);
          }
        });
        await neu.goto(`${basis}/erfassen?draft=${encodeURIComponent(id)}`, {
          waitUntil: "load",
          timeout: wartebudget("neuLadenAdresse"),
        });
        await zumFormular(neu);
        await warteBis(neu, figurenzahl(2), "der wiedergeöffnete Entwurf zeigt beide Bildhüllen");

        const letzte = geholt.at(-1);
        expect(letzte, `kein GET /api/drafts/${id} beim Wiederöffnen`).toBeDefined();
        expect((letzte as Antwort).status()).toBe(200);
        const rumpfGet = rumpfAus(await (letzte as Antwort).json());
        expect(rumpfGet, "die GET-Antwort trägt keinen bodyHtml").not.toBeNull();

        const ausSql = await seiteAusfuehren<Figur[]>(neu, lageAus(JSON.stringify(rumpfSql)));
        const ausGet = await seiteAusfuehren<Figur[]>(neu, lageAus(JSON.stringify(rumpfGet)));
        const nachher = await seiteAusfuehren<Figur[]>(neu, lageAus(`${FELD}.innerHTML`));
        pruefeLage(ausSql, "drafts-Zeile (SQL)", vorher);
        pruefeLage(ausGet, "GET /api/drafts/:id", vorher);
        pruefeLage(nachher, "Editor nach dem Wiederöffnen", vorher);
        process.stderr.write(
          `${KENNZEICHEN} GRÜN · Entwurf ${id} · Anker ${vorher.map((f) => f.bildId).join(", ")}\n`,
        );
      } finally {
        await neu.close({ runBeforeUnload: false }).catch(() => undefined);
      }
    },
    FALL_RAHMEN_MS * 3,
  );
});
