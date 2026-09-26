// ================================================================================================
// AUFNAHME 20260922 · MOBILE ABWEISUNG, REST AUS JOB 4354 R3 — MEHRERE VORGÄNGE, EN/NL, 390 PX.
// ================================================================================================
//
// Der Grundvertrag (JOB 4354) ist abgeschlossen und bleibt unberührt: EIN abgewiesener Vorgang,
// deutsch, sein Grund steht am Eintrag und ist ertastbar
// (`abweisungsgrund-tastatur-pg-im-browser.integration.test.ts`, T1/T2). Offen waren drei Dinge,
// die diese Datei getrennt davon misst — im echten Chromium, an der gebauten Fläche, gegen eine
// echte PostgreSQL:
//
//   (1) MEHRERE abgewiesene Vorgänge zeigen JEWEILS IHREN EIGENEN gespeicherten Grund — in EN und NL.
//   (2) Bei 390 px stehen Meldung (Titel, Marke, Grund) und Aktion VOLLSTÄNDIG da und sind mit
//       echten Tab-Anschlägen erreichbar.
//   (3) Neuladen und erneuter Versuch vertauschen weder Vorgang noch Grund; der ERFOLGREICH
//       nachgesendete Vorgang bleibt dem richtigen Konto und Titel zugeordnet.
//
// ZWEI VERSCHIEDENE GRÜNDE, BEIDE ECHT. Wären beide Abweisungen derselbe Satz, bliebe eine
// Vertauschung der Gründe unsichtbar — gemessen würde dann nur die Zahl. Deshalb:
//   · Vorgang R (Anlage) läuft in den Kontoriegel: `expectedOwner` wird auf dem Draht auf B
//     verstellt (dieselbe Bauform wie der Grundvertrag) → 409 `DRAFT_OWNER_MISMATCH`.
//   · Vorgang P (Aktualisierung) zielt auf einen Entwurf, der inzwischen WIRKLICH weg ist (die Zeile
//     wird in der Datenbank gelöscht, während das Gerät offline ist) → 404 `DRAFT_NOT_FOUND`.
// Beide Sätze kommen aus dem VORHANDENEN Katalog (`services/auth/src/meldungen.ts`) in der Sprache
// der Sitzung. Am Server ist nichts gestellt; der Satz, der am Eintrag steht, ist der des Servers.
//
// Der dritte Vorgang Q geht durch. Er ist der Beleg für „der Erfolg bleibt zugeordnet": genau eine
// Zeile, Titel Q, Urheber A — vor und nach Neuladen und erneutem Versuch.
//
// PRÜFGRENZE, LAUT GEMELDET (Lehre 12.09., JOB 3668): Ohne echte PostgreSQL wird der Grund SICHTBAR
// auf stderr gemeldet und übersprungen.
import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import i18n from "../../apps/web/src/i18n";
import { MELDUNGEN } from "../../services/auth/src/meldungen";
import {
  type Kontext,
  SCHMAL,
  type Seite,
  fn,
  profil,
  tippeMitTastatur,
  warte,
} from "../gast-nutzerweg/browserweg";
import { PASSWORT } from "../gast-nutzerweg/strecke";
import { SCHLUESSEL, mussSichtbarSein } from "./offlineweg";
import {
  A_MAIL,
  type Pruefstand,
  type Welt,
  inFrischerDatenbank,
  pruefstandAbbauen,
  pruefstandAufbauen,
} from "./pruefstand";

const JOB = "[KLARWERK] Aufnahme 20260922 mobile-abweisung-rest";

type Sprache = "en" | "nl";

/** Absichtlich LANG: an 390 px muss auch ein ausführlicher Titel ganz dastehen. */
const TITEL_R = "Pressure relief valve on line 3 opens too late at nominal load (R)";
const TITEL_P = "Pump seal on station 7 leaking (P)";
const TITEL_Q = "Gauge on boiler 2 recalibrated (Q)";
const TEXT = "Unterwegs erfasst, ohne Netz.";

const GRUND = '[data-testid="mob-queue-grund"]';
const KOPFZEILE = '[data-testid="mob-warteschlange"] button';
const WARTESCHLANGE = '[data-testid="mob-warteschlange"]';

interface WeicheMitRumpf {
  request(): { method(): string; url(): string; postData(): string | null };
  continue(optionen?: { postData?: string }): Promise<void>;
}
interface KontextMitWeiche extends Kontext {
  route(muster: string, behandler: (weiche: WeicheMitRumpf) => Promise<void>): Promise<void>;
}

interface Vorgang {
  id: string;
  kind: string;
  status: string;
  title: string;
  error: string | null;
  draftId?: string | null;
}

/** Was die Fläche an EINER Meldung zeigt — gelesen am gerenderten Dokument. */
interface Zeile {
  op: string;
  text: string;
  aria: string;
  titel: string;
  marke: string;
}

/** Was an 390 px über ein Element feststeht. */
interface Lage {
  da: boolean;
  links: number;
  rechts: number;
  fensterBreite: number;
  abgeschnitten: string;
}

/** Die Zähler auf dem Draht — der Beleg, dass Neuladen und Knopf WIRKLICH neu gesendet haben. */
interface Draht {
  anlagen: number;
  aktualisierungen: number;
}

const BESTAND = `(s) => { try { return JSON.parse(localStorage.getItem(s) || "[]"); } catch (e) { return []; } }`;

const ZEILEN = `(sel) => Array.prototype.map.call(document.querySelectorAll(sel), (el) => {
  const li = el.closest("li");
  const kopf = li ? li.querySelector("div") : null;
  const spans = kopf ? kopf.querySelectorAll("span") : [];
  const norm = (t) => String(t || "").replace(/\\s+/g, " ").trim();
  return {
    op: el.getAttribute("data-op") || "",
    text: norm(el.innerText),
    aria: el.getAttribute("aria-label") || "",
    titel: spans[0] ? norm(spans[0].innerText) : "",
    marke: spans[1] ? norm(spans[1].innerText) : "",
  };
})`;

// VOLLSTÄNDIG heisst: in der Fensterbreite, nicht in sich abgeschnitten (Auslassung, verborgener
// Überlauf) und von keinem Vorfahren mit begrenztem Überlauf beschnitten. Das Element wird vorher
// in den sichtbaren Bereich geholt — gemessen wird, ob man es SEHEN KANN, nicht ob es gerade oben
// steht.
const LAGE = `(sel) => {
  const el = document.querySelector(sel);
  if (!el) { return { da: false, links: 0, rechts: 0, fensterBreite: window.innerWidth, abgeschnitten: "kein Element" }; }
  el.scrollIntoView({ block: "center", inline: "nearest" });
  const r = el.getBoundingClientRect();
  const s = getComputedStyle(el);
  let abgeschnitten = "";
  if (el.scrollWidth > el.clientWidth + 1 && s.overflowX !== "visible") {
    abgeschnitten = "in sich waagrecht beschnitten (" + el.scrollWidth + " > " + el.clientWidth + ", overflow-x " + s.overflowX + ", text-overflow " + s.textOverflow + ")";
  } else if (el.scrollHeight > el.clientHeight + 1 && s.overflowY !== "visible") {
    abgeschnitten = "in sich senkrecht beschnitten (" + el.scrollHeight + " > " + el.clientHeight + ")";
  } else {
    for (let v = el.parentElement; v && v !== document.body; v = v.parentElement) {
      const vs = getComputedStyle(v);
      if (vs.overflowX === "visible" && vs.overflowY === "visible") { continue; }
      const vr = v.getBoundingClientRect();
      if (r.left < vr.left - 1 || r.right > vr.right + 1 || r.top < vr.top - 1 || r.bottom > vr.bottom + 1) {
        abgeschnitten = "vom Vorfahren <" + v.tagName.toLowerCase() + "> beschnitten";
        break;
      }
    }
  }
  if (!abgeschnitten && (r.top < 0 || r.bottom > window.innerHeight)) {
    abgeschnitten = "auch nach dem Hineinholen nicht ganz im Fenster (" + Math.round(r.top) + "–" + Math.round(r.bottom) + " von " + window.innerHeight + ")";
  }
  return { da: true, links: r.left, rechts: r.right, fensterBreite: window.innerWidth, abgeschnitten };
}`;

const AKTIV_OP = `() => {
  const a = document.activeElement;
  if (!a) { return { op: null, testid: null, oben: 0, unten: 0 }; }
  const r = a.getBoundingClientRect();
  return { op: a.getAttribute("data-op"), testid: a.getAttribute("data-testid"), oben: r.top, unten: r.bottom };
}`;

function normal(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

async function bestand(seite: Seite): Promise<Vorgang[]> {
  return seite.evaluate<Vorgang[]>(fn(BESTAND), SCHLUESSEL);
}

async function beideAbgewiesen(seite: Seite, was: string, frist = 60_000): Promise<void> {
  await warte(
    seite,
    `([s, g]) => {
      let q = [];
      try { q = JSON.parse(localStorage.getItem(s) || "[]"); } catch (e) { return false; }
      const knopf = document.querySelector(${JSON.stringify(KOPFZEILE)});
      return q.length === 2 && q.every((o) => o.status === "failed" && !!o.error)
        && document.querySelectorAll(g).length === 2 && !!knopf && !knopf.disabled;
    }`,
    was,
    [SCHLUESSEL, GRUND],
    frist,
  );
}

/** Beide Vorgänge sind seit `vorher` WIRKLICH erneut hinausgegangen — gezählt auf dem Draht. */
async function neuGesendet(draht: Draht, vorher: Draht, was: string): Promise<void> {
  const ende = Date.now() + 60_000;
  while (
    Date.now() < ende &&
    (draht.anlagen <= vorher.anlagen || draht.aktualisierungen <= vorher.aktualisierungen)
  ) {
    await new Promise((fertig) => setTimeout(fertig, 100));
  }
  expect(draht.anlagen, `${was}: R wurde nicht erneut gesendet`).toBeGreaterThan(vorher.anlagen);
  expect(draht.aktualisierungen, `${was}: P wurde nicht erneut gesendet`).toBeGreaterThan(
    vorher.aktualisierungen,
  );
}

// ------------------------------------------------------------------------------------------------
// DER TAB-WEG IM TAKT EINES MENSCHEN — und warum `tabBisZu` allein hier nicht trägt.
// ------------------------------------------------------------------------------------------------
//
// GEMESSEN in Prüflauf pa-1790440661-dc6de05c (und derselbe Befund an JOB 4354 T2 in
// pa-1790434825-2407df39): Läuft die Tabulatorfolge über das Dokumentende hinaus, verlässt der Fokus
// die Seite und kehrt beim nächsten Anschlag zurück — das Fenster bekommt `focus`, und
// `useOfflineQueue` startet dafür einen Nachsendelauf (`onFocus → syncNow`). Solange er läuft, ist
// der Sendeknopf gesperrt (`disabled={queue.syncing …}`) und damit keine Fokusstation; die
// abgewiesenen Einträge stehen kurz auf `pending`, ihre Meldungen sind ausgehängt. `tabBisZu` drückt
// schneller, als ein Lauf dauert: jeder Umlauf löst den nächsten Lauf aus und trifft den Knopf
// wieder gesperrt — 150 Anschläge ohne Treffer.
//
// Hier wird deshalb nach JEDEM Anschlag gewartet, bis kein Lauf mehr unterwegs ist — so, wie ein
// Mensch nach einem Anschlag hinsieht. Wie oft das Fenster dabei `focus` bekam und wie viele Läufe
// das auslöste, wird gezählt und gemeldet, nicht verschwiegen.
async function tabImTakt(
  seite: Seite,
  draht: Draht,
  selektor: string,
  hoechstens: number,
  vonVorn: boolean,
): Promise<{ schritte: number; fensterFokus: number; laeufe: number }> {
  const zaehler = "() => window.__kwFensterFokus || 0";
  const vorher = { f: await seite.evaluate<number>(fn(zaehler)), l: draht.anlagen };
  if (vonVorn) {
    await seite.evaluate<boolean>(
      fn("() => { const a = document.activeElement; if (a && a.blur) { a.blur(); } return true; }"),
    );
  }
  const treffer = "(sel) => { const a = document.activeElement; return !!a && a.matches(sel); }";
  for (let schritte = 1; schritte <= hoechstens; schritte += 1) {
    await seite.keyboard.press("Tab");
    await warte(
      seite,
      `([s, k]) => {
        let q = [];
        try { q = JSON.parse(localStorage.getItem(s) || "[]"); } catch (e) { return false; }
        const knopf = document.querySelector(k);
        return q.every((o) => o.status !== "pending") && !!knopf && !knopf.disabled;
      }`,
      "nach dem Tab-Anschlag ist kein Nachsendelauf mehr unterwegs",
      [SCHLUESSEL, KOPFZEILE],
    );
    if (await seite.evaluate<boolean>(fn(treffer), selektor)) {
      const fensterFokus = (await seite.evaluate<number>(fn(zaehler))) - vorher.f;
      return { schritte, fensterFokus, laeufe: draht.anlagen - vorher.l };
    }
  }
  throw new Error(
    `${JOB}: „${selektor}" war in ${hoechstens} Tab-Anschlägen (im Takt, ohne laufenden Nachsendelauf) nicht erreichbar.`,
  );
}

async function vollstaendig(seite: Seite, selektor: string, was: string): Promise<void> {
  const lage = await seite.evaluate<Lage>(fn(LAGE), selektor);
  expect(lage.da, `${was}: nicht vorhanden (${selektor})`).toBe(true);
  expect(lage.fensterBreite, "das Profil misst nicht an 390 px").toBe(SCHMAL.width);
  expect(lage.abgeschnitten, `${was} ist bei 390 px nicht vollständig sichtbar`).toBe("");
  expect(lage.links, `${was} beginnt links ausserhalb des Fensters`).toBeGreaterThanOrEqual(0);
  expect(lage.rechts, `${was} ragt rechts über 390 px hinaus`).toBeLessThanOrEqual(SCHMAL.width);
}

// ------------------------------------------------------------------------------------------------
// DIE ABNAHME — dieselbe nach der Abweisung, nach dem Neuladen und nach dem erneuten Versuch.
// ------------------------------------------------------------------------------------------------
interface Erwartung {
  sprache: Sprache;
  rId: string;
  pId: string;
  pEntwurf: string;
}

async function abnahme(seite: Seite, draht: Draht, e: Erwartung, station: string): Promise<void> {
  const tL = i18n.getFixedT(e.sprache);
  const satzR = MELDUNGEN.DRAFT_OWNER_MISMATCH[e.sprache];
  const satzP = MELDUNGEN.DRAFT_NOT_FOUND[e.sprache];
  expect(
    satzR,
    "die beiden Gründe sind gleich — dann misst dieser Fall keine Vertauschung",
  ).not.toBe(satzP);

  // (a) GESPEICHERT — jeder Vorgang trägt SEINEN Grund, unter SEINER Kennung.
  const liste = await bestand(seite);
  expect(
    liste.map((o) => o.id).sort(),
    `${station}: andere Vorgänge in der Warteschlange als abgewiesen wurden`,
  ).toEqual([e.rId, e.pId].sort());
  const r = liste.find((o) => o.id === e.rId) as Vorgang;
  const p = liste.find((o) => o.id === e.pId) as Vorgang;
  expect([r.kind, r.title, r.status, r.error], `${station}: Vorgang R`).toEqual([
    "draft.create",
    TITEL_R,
    "failed",
    satzR,
  ]);
  expect([p.kind, p.title, p.draftId, p.status, p.error], `${station}: Vorgang P`).toEqual([
    "draft.update",
    TITEL_P,
    e.pEntwurf,
    "failed",
    satzP,
  ]);

  // (b) GEZEIGT — jede Meldung steht am Eintrag IHRES Vorgangs, in der Reihenfolge der Schlange.
  const zeilen = await seite.evaluate<Zeile[]>(fn(ZEILEN), GRUND);
  expect(
    zeilen.map((z) => z.op),
    `${station}: Meldungen fehlen, sind doppelt oder stehen in anderer Reihenfolge als die Vorgänge`,
  ).toEqual(liste.map((o) => o.id));
  for (const z of zeilen) {
    const vorgang = liste.find((o) => o.id === z.op) as Vorgang;
    const was = `${station}: Meldung an „${vorgang.title}"`;
    expect(z.text, `${was} trägt nicht den gespeicherten Grund dieses Vorgangs`).toBe(
      normal(String(vorgang.error)),
    );
    expect(z.titel, `${was} steht nicht unter dem Titel dieses Vorgangs`).toBe(vorgang.title);
    expect(z.marke, `${was}: die Marke ist nicht die ${e.sprache}-Fehlermarke`).toBe(
      normal(tL("mob.status.failed")),
    );
    expect(z.aria, `${was}: der Name ordnet sie nicht diesem Vorgang zu`).toBe(
      `${tL("mob.vorgang.grund", { titel: vorgang.title })}: ${vorgang.error}`,
    );
    const eigen = `${GRUND}[data-op="${z.op}"]`;
    await mussSichtbarSein(seite, eigen, normal(String(vorgang.error)), was);
    // (c) VOLLSTÄNDIG BEI 390 PX — der Grund UND der Titel, der sagt, wozu er gehört.
    await vollstaendig(seite, eigen, `${was} (Grund)`);
    await seite.evaluate<boolean>(
      fn(
        `(sel) => { const el = document.querySelector(sel); const t = el && el.closest("li").querySelector("div > span"); if (t) { t.setAttribute("data-kw-titel", "1"); } return !!t; }`,
      ),
      eigen,
    );
    await vollstaendig(seite, '[data-kw-titel="1"]', `${was} (Titel)`);
    await seite.evaluate<boolean>(
      fn(
        `() => { const t = document.querySelector('[data-kw-titel="1"]'); if (t) { t.removeAttribute("data-kw-titel"); } return true; }`,
      ),
    );
  }
  await vollstaendig(seite, KOPFZEILE, `${station}: der Knopf „${tL("mob.syncNow")}"`);
  const karte = await seite.evaluate<string>(
    fn(`(sel) => { const k = document.querySelector(sel); return k ? k.innerText : ""; }`),
    WARTESCHLANGE,
  );
  expect(
    karte,
    `${station}: der erfolgreiche Vorgang Q steht noch in der Warteschlange`,
  ).not.toContain(TITEL_Q);

  // (d) PER TASTATUR — echte Tab-Anschläge: bis zum Knopf, dann Meldung für Meldung, jede im Blick.
  const weg = await tabImTakt(seite, draht, KOPFZEILE, 150, true);
  process.stderr.write(
    `${JOB} ${station} · ${weg.schritte} Tab-Anschläge bis zum Knopf · dabei ${weg.fensterFokus}× Fenster-focus, ${weg.laeufe} Nachsendeläufe ausgelöst\n`,
  );
  for (const z of zeilen) {
    const { schritte } = await tabImTakt(seite, draht, GRUND, 5, false);
    const aktiv = await seite.evaluate<{ op: string | null; oben: number; unten: number }>(
      fn(AKTIV_OP),
    );
    expect(
      aktiv.op,
      `${station}: die Tabulatorfolge trifft nicht die Meldung von „${liste.find((o) => o.id === z.op)?.title}"`,
    ).toBe(z.op);
    expect(schritte, `${station}: zwischen den Meldungen liegen unerwartete Stationen`).toBe(1);
    expect(
      aktiv.oben >= 0 && aktiv.unten <= SCHMAL.height,
      `${station}: die fokussierte Meldung liegt ausserhalb des Fensters (${aktiv.oben}–${aktiv.unten})`,
    ).toBe(true);
  }
}

// ------------------------------------------------------------------------------------------------
// DER WEG BIS ZU ZWEI VERSCHIEDENEN ABWEISUNGEN
// ------------------------------------------------------------------------------------------------
async function erfasse(
  seite: Seite,
  sprache: Sprache,
  titel: string,
  anzahl: number,
): Promise<void> {
  const tL = i18n.getFixedT(sprache);
  await tippeMitTastatur(
    seite,
    `input[placeholder="${tL("mob.formTitle")}"]`,
    titel,
    "Kernaussage",
  );
  await tippeMitTastatur(seite, '[data-testid="mob-statement"]', TEXT, "Text");
  await seite.click(`button:has-text("${tL("mob.save")}")`);
  await warte(
    seite,
    `([s, n]) => { try { return JSON.parse(localStorage.getItem(s) || "[]").length === n; } catch (e) { return false; } }`,
    `„${titel}" liegt in der Warteschlange`,
    [SCHLUESSEL, anzahl],
  );
}

async function entwuerfe(pool: Pool): Promise<Array<{ id: string; wer: string; titel: string }>> {
  const res = await pool.query<{ id: string; wer: string; titel: string }>(
    "SELECT id, data->>'originalAuthor' AS wer, data->'payload'->>'title' AS titel FROM drafts ORDER BY id",
  );
  return res.rows;
}

async function erfolgBleibtZugeordnet(welt: Welt, station: string): Promise<void> {
  const zeilen = await entwuerfe(welt.pool);
  expect(
    zeilen.map((z) => [z.titel, z.wer]),
    `${station}: am Server liegt nicht genau der erfolgreiche Vorgang Q, von A`,
  ).toEqual([[TITEL_Q, welt.aId]]);
}

async function mehrsprachigerWeg(welt: Welt, sprache: Sprache): Promise<void> {
  const tL = i18n.getFixedT(sprache);
  const { kontext: roh, seite } = await profil(welt.browser, SCHMAL, sprache);
  const kontext = roh as KontextMitWeiche;
  const basis = welt.strecke.basis;
  const draht: Draht = { anlagen: 0, aktualisierungen: 0 };
  // Zählt, wie oft das FENSTER selbst `focus` bekommt (nicht ein Element darin) — der Anlass, zu dem
  // `useOfflineQueue` einen Nachsendelauf startet.
  await kontext.addInitScript(
    `window.__kwFensterFokus = 0; window.addEventListener("focus", (e) => { if (e.target === window) { window.__kwFensterFokus += 1; } }, true);`,
  );

  try {
    // Genau EIN Feld wird verstellt, und nur an Vorgang R: seine Voraussetzung nennt B.
    await kontext.route("**/api/drafts**", async (weiche) => {
      const anfrage = weiche.request();
      const pfad = new URL(anfrage.url()).pathname;
      if (anfrage.method() === "PUT" && pfad.startsWith("/api/drafts/")) {
        draht.aktualisierungen += 1;
      }
      if (anfrage.method() !== "POST" || pfad !== "/api/drafts") {
        await weiche.continue();
        return;
      }
      draht.anlagen += 1;
      const rumpf = JSON.parse(anfrage.postData() ?? "{}") as Record<string, unknown>;
      if (rumpf.title !== TITEL_R) {
        await weiche.continue();
        return;
      }
      await weiche.continue({ postData: JSON.stringify({ ...rumpf, expectedOwner: welt.bId }) });
    });

    await seite.goto(`${basis}/`, { waitUntil: "domcontentloaded" });
    await warte(seite, `() => !!document.querySelector("#auth-email")`, "die Anmeldemaske für A");
    await tippeMitTastatur(seite, "#auth-email", A_MAIL, "E-Mail (A)");
    await tippeMitTastatur(seite, "#auth-password", PASSWORT, "Passwort (A)");
    await seite.keyboard.press("Enter");
    await warte(
      seite,
      `() => !document.querySelector("#auth-email")`,
      "die Anmeldung von A",
      undefined,
      45_000,
    );
    await seite.goto(`${basis}/mobile`, { waitUntil: "domcontentloaded" });
    await warte(
      seite,
      `(p) => !!document.querySelector('input[placeholder="' + p + '"]') && !!document.querySelector('[data-testid="mob-statement"]')`,
      `die Erfassungsfläche in ${sprache}`,
      tL("mob.formTitle"),
      45_000,
    );

    // 1. Offline drei Vorgänge erfassen: R (wird abgewiesen), P und Q (gehen durch).
    await kontext.setOffline(true);
    await warte(
      seite,
      "() => navigator.onLine === false",
      "die Fläche merkt die fehlende Verbindung",
    );
    await erfasse(seite, sprache, TITEL_R, 1);
    await erfasse(seite, sprache, TITEL_P, 2);
    await erfasse(seite, sprache, TITEL_Q, 3);
    const rId = (await bestand(seite)).find((o) => o.title === TITEL_R)?.id as string;
    expect(rId, "Vorgang R hat keine Kennung").toBeTruthy();

    await kontext.setOffline(false);
    await warte(
      seite,
      `(s) => { try { const q = JSON.parse(localStorage.getItem(s) || "[]"); return q.length === 1 && q[0].status === "failed" && !!q[0].error; } catch (e) { return false; } }`,
      "R ist abgewiesen, P und Q sind angekommen",
      SCHLUESSEL,
      60_000,
    );
    const nachErstemLauf = await entwuerfe(welt.pool);
    expect(nachErstemLauf.map((z) => z.titel).sort()).toEqual([TITEL_P, TITEL_Q].sort());
    const pEntwurf = nachErstemLauf.find((z) => z.titel === TITEL_P)?.id as string;

    // 2. P fortsetzen (online, frischer Stand), offline ändern, offline speichern.
    await warte(
      seite,
      "(t) => Array.prototype.some.call(document.querySelectorAll('li'), (li) => li.innerText.indexOf(t) >= 0 && !!li.querySelector('button[title]'))",
      "P steht in der Entwurfsliste",
      TITEL_P,
      45_000,
    );
    await seite.click(`li:has-text("${TITEL_P}") button[title="${tL("mob.resume")}"]`);
    await warte(
      seite,
      `([p, t]) => { const f = document.querySelector('input[placeholder="' + p + '"]'); return !!f && f.value === t; }`,
      "P steht im Formular",
      [tL("mob.formTitle"), TITEL_P],
    );
    await kontext.setOffline(true);
    await warte(seite, "() => navigator.onLine === false", "offline für die Änderung an P");
    await tippeMitTastatur(seite, '[data-testid="mob-statement"]', " Nachtrag.", "Text (P)");
    await seite.click(`button:has-text("${tL("mob.update")}")`);
    await warte(
      seite,
      `([s, d]) => { try { const q = JSON.parse(localStorage.getItem(s) || "[]"); return q.length === 2 && q.some((o) => o.kind === "draft.update" && o.draftId === d && o.status === "queued"); } catch (e) { return false; } }`,
      "die Änderung an P liegt in der Warteschlange",
      [SCHLUESSEL, pEntwurf],
    );
    const pId = (await bestand(seite)).find((o) => o.kind === "draft.update")?.id as string;

    // 3. Während das Gerät offline ist, verschwindet P am Server — wirklich, nicht auf dem Draht.
    const weg = await welt.pool.query("DELETE FROM drafts WHERE id = $1", [pEntwurf]);
    expect(weg.rowCount, "P liess sich am Server nicht entfernen").toBe(1);

    // 4. Verbindung zurück: R und P werden abgewiesen, jeder mit seinem eigenen Grund.
    await kontext.setOffline(false);
    await beideAbgewiesen(seite, "R und P sind abgewiesen und beide Gründe stehen am Eintrag");
    const erwartung: Erwartung = { sprache, rId, pId, pEntwurf };
    await abnahme(seite, draht, erwartung, `${sprache} · nach der Abweisung`);
    await erfolgBleibtZugeordnet(welt, `${sprache} · nach der Abweisung`);

    // 5. NEULADEN — der Aufbau-Anlauf sendet beide erneut; nichts darf vertauscht ankommen.
    // Erst der Draht, dann der Bestand: die alten Gründe liegen nach dem Neuladen sofort wieder
    // da — ohne diese Reihenfolge prüfte die Abnahme den Stand VOR dem neuen Lauf.
    const vorNeuladen = { ...draht };
    await seite.reload({ waitUntil: "domcontentloaded" });
    await neuGesendet(draht, vorNeuladen, "nach dem Neuladen");
    await beideAbgewiesen(seite, "nach dem Neuladen sind R und P erneut abgewiesen");
    await abnahme(seite, draht, erwartung, `${sprache} · nach dem Neuladen`);
    await erfolgBleibtZugeordnet(welt, `${sprache} · nach dem Neuladen`);

    // 6. ERNEUTER VERSUCH — per Tastatur am Knopf der Warteschlange. Der Zählerstand wird erst
    // NACH dem Weg zum Knopf genommen: ein Lauf, den der Weg selbst auslöst (Fenster-`focus`), ist
    // kein Beleg für den Knopf.
    await tabImTakt(seite, draht, KOPFZEILE, 150, true);
    const vorVersuch = { ...draht };
    await seite.keyboard.press("Enter");
    await neuGesendet(draht, vorVersuch, "nach Enter am Knopf");
    await beideAbgewiesen(seite, "nach dem erneuten Versuch sind R und P erneut abgewiesen");
    await abnahme(seite, draht, erwartung, `${sprache} · nach dem erneuten Versuch`);
    await erfolgBleibtZugeordnet(welt, `${sprache} · nach dem erneuten Versuch`);

    process.stderr.write(
      `${JOB} ${sprache} · zwei Gründe getrennt gehalten über Abweisung, Neuladen und erneuten Versuch · Draht: ${draht.anlagen} Anlagen, ${draht.aktualisierungen} Aktualisierungen\n`,
    );
  } finally {
    await kontext.close().catch(() => undefined);
  }
}

describe("Aufnahme 20260922 · mehrere mobile Abweisungen in EN/NL bei 390 px", () => {
  let stand: Pruefstand | undefined;

  beforeAll(async () => {
    stand = await pruefstandAufbauen("M1");
  }, 900_000);

  afterAll(async () => {
    await pruefstandAbbauen(stand);
  }, 120_000);

  for (const sprache of ["en", "nl"] as const) {
    it(`M-${sprache} — zwei Vorgänge, zwei eigene Gründe, vollständig und ertastbar, stabil über Neuladen und erneuten Versuch`, async (ctx) => {
      if (!stand?.verfuegbar) {
        ctx.skip();
        return;
      }
      const pruefstand = stand;
      process.stderr.write(`${JOB} M-${sprache} läuft · Fläche: ${pruefstand.flaeche}\n`);
      await inFrischerDatenbank(pruefstand, `M${sprache}`, (welt) =>
        mehrsprachigerWeg(welt, sprache),
      );
    }, 900_000);
  }
});
