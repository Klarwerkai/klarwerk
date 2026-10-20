#!/usr/bin/env node
// ================================================================================================
// tools/tor-bericht.mjs — liest den einen Prüfvertrag (tools/pruefvertrag.json) für alle Prüfwege.
// ================================================================================================
//
// aufnahme:20260922:gesamt-prueftor-einheitlich. Drei Aufrufe:
//
//   --stufen      je Zeile „<name> <art>“ in Laufreihenfolge (art: sperrend | meldend). Daraus bildet
//                 tools/pruefstufen.sh den Plan; eine Stufe, die nicht im Vertrag steht, bricht ab.
//   --ausserhalb  was das Tor NICHT fährt: die Wege ausserhalb (anderer CI-Job, Ship-Vorbedingung)
//                 und die benannten Ausnahmefälle aus `nicht_im_tor`. Bis hierher stand die
//                 Fallliste in tools/check von Hand als „alle vier“, während der Mengen-Pin
//                 (tests/smoke/tor-ausnahme.test.ts) acht führte. Jetzt lesen beide dieselbe Datei.
//   --einbau <datei>
//                 der heutige Einbau-/Auslieferungsweg gegen denselben Vertrag. Er fährt je Auftrag
//                 eine Prüfauswahl statt des Gesamttors; seine Prüfliste (das `checks.json` mit
//                 Befehl und Exitcode oder das `PLAN.json` mit `checks: [[name, befehl]]`) wird über
//                 `einbau.regeln` jeder Vertragsstufe zugeordnet — voll, nur Auswahl, NICHT
//                 ausgeführt/erreicht oder UNBEKANNT (nur geplant, oder ein zusammengesetzter Lauf
//                 ohne Stufenbericht im Protokoll `<name>.log` neben der Liste) —, Wege ausserhalb
//                 werden benannt. Ein Befehl ohne Regel ist Code 1:
//                 eine dritte, unbeschriebene Pipeline wird sichtbar statt mitgezählt.
//
// KLARWERK_PRUEFVERTRAG zeigt auf einen anderen Vertrag — nur für die Gegenfälle in
// tests/tor-vertrag/pruefvertrag.test.ts. Fail-closed: ein unlesbarer oder leerer Vertrag endet mit
// Code 2, nie mit einem leeren Plan, der jedes Tor grün liesse.

import { readFileSync } from "node:fs";
import { basename, dirname, isAbsolute, join } from "node:path";
import { fileURLToPath } from "node:url";

const WURZEL = join(dirname(fileURLToPath(import.meta.url)), "..");
const pfad = process.env.KLARWERK_PRUEFVERTRAG || join(WURZEL, "tools", "pruefvertrag.json");
const ARTEN = new Set(["sperrend", "meldend"]);

function abbruch(meldung) {
  console.error(`✖ Prüfvertrag: ${meldung}`);
  console.error(`  Datei: ${pfad}`);
  process.exit(2);
}

let vertrag;
try {
  vertrag = JSON.parse(readFileSync(pfad, "utf8"));
} catch (err) {
  abbruch(`nicht lesbar (${String(err)})`);
}

const stufen = Array.isArray(vertrag.stufen) ? vertrag.stufen.map((s) => s?.name) : [];
if (stufen.length === 0 || stufen.some((n) => typeof n !== "string" || !/^[a-z0-9-]+$/.test(n))) {
  abbruch("keine Stufen oder ein Stufenname ausserhalb [a-z0-9-]");
}
if (new Set(stufen).size !== stufen.length) {
  abbruch("ein Stufenname steht doppelt");
}
const arten = vertrag.stufen.map((s) => s.art ?? "sperrend");
if (arten.some((a) => !ARTEN.has(a))) {
  abbruch("eine Stufenart ist weder „sperrend“ noch „meldend“");
}

// Fail-closed: eine Einbauregel auf eine Browserstufe ohne Projektzuordnung (`engines`) zählte jeden
// Exitcode wieder für jede Engine.
for (const regel of vertrag.einbau?.regeln ?? []) {
  for (const s of (regel.stufen ?? []).filter((x) => x.startsWith("ui-smoke-"))) {
    const liste = regel.engines?.[s];
    if (!Array.isArray(liste) || liste.length === 0) {
      abbruch(`Einbauregel „${regel.befehl}“: Browserstufe ${s} ohne Projekte unter „engines“`);
    }
  }
}

const STARTER = new Set(["bash", "sh", "node", "npx", "env"]);

/** Programm und Argumente eines gefahrenen Befehls, ohne Starter (`bash`, `node`, `npx`, ENV=…). */
function zerlege(befehl) {
  const t = [...befehl];
  while (t.length > 0 && (/^\w+=/.test(t[0]) || STARTER.has(t[0]))) {
    t.shift();
  }
  if (t.length === 0) {
    return { schluessel: "", rest: [] };
  }
  if (basename(t[0]) === "npm" && t[1] === "run") {
    const rest = t.slice(2);
    while (rest.length > 0 && rest[0].startsWith("--")) {
      rest.shift();
    }
    const skript = rest.shift() ?? "";
    return { schluessel: `npm run ${skript}`, rest: rest.filter((a) => a !== "--") };
  }
  let programm = t[0].replace(/^\.\//, "");
  if (programm.includes("node_modules/.bin/")) {
    programm = basename(programm);
  }
  return { schluessel: programm, rest: t.slice(1) };
}

/** Die ausgewählten Ziele (Dateien, Specs) — alles, was weder Schalter noch Unterbefehl ist. */
const MIT_WERT = new Set(["--config", "-c", "--project", "--grep", "--outputFile"]);
const UNTERBEFEHLE = new Set(["run", "check", "test", "list"]);

function ziele(rest) {
  const out = [];
  let i = 0;
  while (i < rest.length) {
    const a = rest[i];
    if (MIT_WERT.has(a)) {
      i += 2;
      continue;
    }
    if (!a.startsWith("-") && !UNTERBEFEHLE.has(a)) {
      out.push(a);
    }
    i += 1;
  }
  return out;
}

function mitConfig(regel, rest) {
  return !regel.config || rest.includes(regel.config) || rest.includes(`--config=${regel.config}`);
}

function regelFuer(zerlegt) {
  return (vertrag.einbau?.regeln ?? []).find(
    (r) => r.befehl === zerlegt.schluessel && mitConfig(r, zerlegt.rest),
  );
}

function eintrag(c) {
  if (Array.isArray(c)) {
    return { name: c[0], befehl: c[1] };
  }
  return { name: c?.name, befehl: c?.command, exit: c?.exit, log: c?.log, bericht: c?.bericht };
}

// ------------------------------------------------------------------------------------------------
// PLAN IST NICHT LAUF (Bens Befund zu nacharbeit-3). Ein Eintrag ohne Exitcode (PLAN.json) ist nur
// geplant: sein Ausführungsumfang ist UNBEKANNT. Ein zusammengesetzter Weg (tools/check) deckt nur
// die Stufen, die sein eigener Stufenbericht als erreicht ausweist — ein Abbruch bei architecture
// heisst: alles danach NICHT erreicht. Ohne Stufenbericht im Protokoll bleibt der Umfang unbekannt.
// ------------------------------------------------------------------------------------------------

const ANSI = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, "g");

/** Felder des Prüftor-Berichts (tools/pruefstufen.sh); `bestanden` ist die Form vor dem Messstatus. */
const BERICHTSFELDER = {
  gemessen: { erreicht: true, text: "gemessen" },
  bestanden: { erreicht: true, text: "gelaufen, Messstatus in diesem Bericht nicht erhoben" },
  "nicht gemessen": { erreicht: true, text: "gelaufen, nicht gemessen" },
  "nur Auswahl": { erreicht: true, text: "nur Auswahl" },
  "nur meldend": { erreicht: true, text: "meldend" },
  "nicht erreicht": { erreicht: false, text: "NICHT erreicht" },
};

/** Der letzte Prüftor-Bericht im Protokoll eines zusammengesetzten Laufs, je Stufe; sonst null. */
function stufenbericht(pfad) {
  let text;
  try {
    text = readFileSync(pfad, "utf8").replace(ANSI, "");
  } catch {
    return null;
  }
  const anfang = text.lastIndexOf("── Prüftor-Bericht");
  if (anfang === -1) {
    return null;
  }
  const status = new Map();
  let gruenAlle = false;
  for (const zeile of text.slice(anfang).split("\n")) {
    const m = /^\s{2}(\S.*?)\s+: (.*)$/.exec(zeile);
    if (!m) {
      continue;
    }
    const [, feld, wert] = m;
    if (feld === "Ergebnis") {
      const rot = /ROT in Stufe „([a-z0-9-]+)“ \(Code (\d+)\)/.exec(wert);
      if (rot && stufen.includes(rot[1])) {
        status.set(rot[1], { erreicht: true, text: `ROT (Code ${rot[2]})` });
      }
      gruenAlle = /^grün — alle \d+ Stufen/.test(wert);
      continue;
    }
    const art = BERICHTSFELDER[feld];
    if (!art) {
      continue;
    }
    for (const [, name, grund] of wert.matchAll(/([a-z0-9-]+)(?: \(([^)]*)\))?/g)) {
      if (stufen.includes(name) && !status.has(name)) {
        const text = grund ? `${art.text} (${grund})` : art.text;
        status.set(name, { erreicht: art.erreicht, text });
      }
    }
  }
  if (gruenAlle) {
    for (const s of stufen.filter((x) => !status.has(x))) {
      status.set(s, { erreicht: true, text: BERICHTSFELDER.bestanden.text });
    }
  }
  return status;
}

function logPfad(e, datei) {
  if (e.log) {
    return isAbsolute(e.log) ? e.log : join(dirname(datei), e.log);
  }
  return join(dirname(datei), `${e.name}.log`);
}

/** Ein zusammengesetzter Weg: je Stufe der tatsächlich nachgewiesene Stand, sonst „unbekannt“. */
function zusammengesetzt(e, datei, quelle, je) {
  const bericht = e.exit === undefined ? null : stufenbericht(logPfad(e, datei));
  const fehlt = bericht ? "nicht im Stufenbericht" : "kein Stufenbericht";
  for (const s of stufen) {
    const st = bericht?.get(s);
    if (st) {
      je.get(s)?.push({ erreicht: st.erreicht, text: `${st.text} — ${quelle}` });
    } else {
      je.get(s)?.push({ erreicht: null, text: `Ausführung unbekannt (${fehlt}) — ${quelle}` });
    }
  }
}

function liesEinbau(datei) {
  let roh;
  try {
    roh = JSON.parse(readFileSync(datei, "utf8"));
  } catch (err) {
    abbruch(`Prüfliste des Einbauwegs nicht lesbar: ${datei} (${String(err)})`);
  }
  const eintraege = (Array.isArray(roh) ? roh : (roh?.checks ?? [])).map(eintrag);
  if (eintraege.length === 0 || eintraege.some((e) => !Array.isArray(e.befehl))) {
    abbruch(`Prüfliste ohne Befehle oder in unbekannter Form: ${datei}`);
  }
  return eintraege;
}

// ------------------------------------------------------------------------------------------------
// ENGINE IST NICHT BEFEHL (Bens Befund zu nacharbeit-49). `smoke:ui:gate:drei` deckt laut Regel drei
// Engines — aber ein Lauf mit `--project=chromium-zustand` fährt nur Chromium. Bis hierher zählte
// jeder Exitcode alle drei als gefahren. Jetzt gilt je Browserstufe (Regelfeld `engines`: Stufe →
// Playwright-Projekte):
//   · nicht ausgewählt (`--project` nennt keines ihrer Projekte) → nicht ausgeführt;
//   · ohne Exitcode → unbekannt (geplant);
//   · ohne lesbaren Laufbericht (`<name>.json`, Playwright-JSON, oder `bericht` am Eintrag) →
//     unbekannt, nie gefahren;
//   · im Laufbericht kein Fall dieser Projekte mit einem anderen Ergebnis als „skipped“ → nicht
//     ausgeführt (leer oder nicht gestartet);
//   · sonst gefahren, mit Projekten und Zahl der gelaufenen und bestandenen Fälle.
// Setup-Projekte gehören zu keiner Engine und zählen nie.
// ------------------------------------------------------------------------------------------------

/** Die ausgewählten Projekte (`--project=x` oder `--project x`); leer heisst: keine Einschränkung. */
function projekte(rest) {
  const out = [];
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    if (a === "--project" && i + 1 < rest.length) {
      out.push(rest[i + 1]);
      i++;
    } else if (a.startsWith("--project=")) {
      out.push(a.slice("--project=".length));
    }
  }
  return out;
}

function laufberichtPfad(e, datei) {
  if (e.bericht) {
    return isAbsolute(e.bericht) ? e.bericht : join(dirname(datei), e.bericht);
  }
  return join(dirname(datei), `${e.name}.json`);
}

/** Alle Fälle eines Playwright-JSON-Berichts mit Projekt und Ergebnissen; null, wenn unlesbar. */
function playwrightFaelle(pfad) {
  let roh;
  try {
    roh = JSON.parse(readFileSync(pfad, "utf8"));
  } catch {
    return null;
  }
  if (!roh || !Array.isArray(roh.suites)) {
    return null;
  }
  const faelle = [];
  const gehe = (suite) => {
    for (const spec of suite?.specs ?? []) {
      for (const t of spec?.tests ?? []) {
        faelle.push({
          projekt: t?.projectName,
          ergebnisse: (t?.results ?? []).map((r) => r?.status),
        });
      }
    }
    for (const unter of suite?.suites ?? []) {
      gehe(unter);
    }
  };
  for (const s of roh.suites) {
    gehe(s);
  }
  return faelle;
}

function engineStufen(e, datei, regel, zerlegt, umfang, quelle, je) {
  const gewaehlt = projekte(zerlegt.rest);
  const pfadBericht = laufberichtPfad(e, datei);
  let faelle;
  for (const s of regel.stufen) {
    const zulaessig = regel.engines[s] ?? [];
    const auswahl =
      gewaehlt.length === 0 ? zulaessig : zulaessig.filter((p) => gewaehlt.includes(p));
    if (auswahl.length === 0) {
      const text = `nicht ausgewählt (--project ${gewaehlt.join(", ") || "—"}) — ${quelle}`;
      je.get(s)?.push({ erreicht: false, text });
      continue;
    }
    if (e.exit === undefined) {
      je.get(s)?.push({ erreicht: null, text: `${umfang} — ${quelle}` });
      continue;
    }
    if (faelle === undefined) {
      faelle = playwrightFaelle(pfadBericht);
    }
    if (faelle === null) {
      const text = `${umfang}, kein lesbarer Laufbericht (${basename(pfadBericht)}) — ${quelle}`;
      je.get(s)?.push({ erreicht: null, text });
      continue;
    }
    const gelaufen = faelle.filter(
      (f) => auswahl.includes(f.projekt) && f.ergebnisse.some((x) => x && x !== "skipped"),
    );
    if (gelaufen.length === 0) {
      const text = `${umfang}, im Laufbericht kein gelaufener Fall für ${auswahl.join("/")} — ${quelle}`;
      je.get(s)?.push({ erreicht: false, text });
      continue;
    }
    const bestanden = gelaufen.filter((f) => f.ergebnisse.at(-1) === "passed").length;
    const namen = [...new Set(gelaufen.map((f) => f.projekt))].join("/");
    const text = `${umfang}, ${namen}: ${gelaufen.length} gelaufen, ${bestanden} bestanden — ${quelle}`;
    je.get(s)?.push({ erreicht: true, text });
  }
}

function umfangText(regel, z) {
  if (regel.umfang === "voll") {
    return "voll";
  }
  const anzahl = `${z.length} ${z.length === 1 ? "Ziel" : "Ziele"}`;
  const auszug = `${z.slice(0, 3).join(", ")}${z.length > 3 ? ", …" : ""}`;
  return auszug ? `nur Auswahl (${anzahl}: ${auszug})` : `nur Auswahl (${anzahl})`;
}

function einbau(datei) {
  const je = new Map(stufen.map((s) => [s, []]));
  const ausserhalb = [];
  const unzuordenbar = [];
  for (const e of liesEinbau(datei)) {
    const zerlegt = zerlege(e.befehl);
    const regel = regelFuer(zerlegt);
    const nachweis = e.exit === undefined ? "geplant, kein Laufnachweis" : `Exit ${e.exit}`;
    const quelle = `Prüfung „${e.name}“, ${nachweis}`;
    if (!regel) {
      unzuordenbar.push(`„${e.name}“: ${e.befehl.join(" ")}`);
      continue;
    }
    const umfang = umfangText(regel, ziele(zerlegt.rest));
    if (regel.ausserhalb) {
      ausserhalb.push(`${regel.ausserhalb}: ${umfang} — ${quelle}`);
      continue;
    }
    if (regel.stufen.includes("*")) {
      zusammengesetzt(e, datei, quelle, je);
      continue;
    }
    if (regel.engines) {
      engineStufen(e, datei, regel, zerlegt, umfang, quelle, je);
      continue;
    }
    for (const s of regel.stufen) {
      const erreicht = e.exit === undefined ? null : true;
      je.get(s)?.push({ erreicht, text: `${umfang} — ${quelle}` });
    }
  }
  console.log("── Einbau-/Auslieferungsweg gegen tools/pruefvertrag.json ──");
  console.log(`  Prüfliste: ${datei}`);
  let gefahren = 0;
  let unbekannt = 0;
  for (const s of stufen) {
    const laeufe = je.get(s) ?? [];
    const texte = laeufe.map((l) => l.text).join(" · ");
    if (laeufe.some((l) => l.erreicht === true)) {
      gefahren++;
      console.log(`  ▶ ${s.padEnd(24)} ${texte}`);
    } else if (laeufe.some((l) => l.erreicht === null)) {
      unbekannt++;
      console.log(`  ? ${s.padEnd(24)} ${texte}`);
    } else if (laeufe.length > 0) {
      console.log(`  ✗ ${s.padEnd(24)} ${texte}`);
    } else {
      console.log(`  ✗ ${s.padEnd(24)} NICHT ausgeführt`);
    }
  }
  const nicht = stufen.length - gefahren - unbekannt;
  const bilanz = `${gefahren} von ${stufen.length} Vertragsstufen nachweislich gefahren`;
  const rest = `${nicht} nicht, ${unbekannt} unbekannt (geplant oder ohne Laufnachweis)`;
  console.log(`  ${bilanz}, ${rest}.`);
  for (const a of ausserhalb) {
    console.log(`  ⓘ ausserhalb des Tors: ${a}`);
  }
  if (vertrag.einbau?.abweichung) {
    console.log(`  Begründete Abweichung: ${vertrag.einbau.abweichung}`);
  }
  if (unzuordenbar.length > 0) {
    console.log("  ✖ nicht im Vertrag beschrieben (eigene Pipeline ohne Regel):");
    for (const u of unzuordenbar) {
      console.log(`    · ${u}`);
    }
    process.exit(1);
  }
}

const modus = process.argv[2];
if (modus === "--stufen") {
  console.log(stufen.map((s, i) => `${s} ${arten[i]}`).join("\n"));
} else if (modus === "--einbau") {
  const datei = process.argv[3];
  if (!datei) {
    abbruch("--einbau braucht die Prüfliste des Einbauwegs");
  }
  einbau(datei);
} else if (modus === "--ausserhalb") {
  console.log("  ⓘ NICHT von diesem Tor gefahren (tools/pruefvertrag.json):");
  for (const weg of vertrag.ausserhalb ?? []) {
    console.log(`    · ${weg.weg}: ${weg.befehl} — ${weg.grund}`);
  }
  if (vertrag.nicht_im_tor) {
    const liste = isAbsolute(vertrag.nicht_im_tor)
      ? vertrag.nicht_im_tor
      : join(WURZEL, vertrag.nicht_im_tor);
    let faelle;
    try {
      faelle = JSON.parse(readFileSync(liste, "utf8"));
    } catch (err) {
      abbruch(`Ausnahmeliste nicht lesbar: ${liste} (${String(err)})`);
    }
    console.log(
      `    · ${faelle.length} benannte @modell-Fälle (brauchen ein aktives Modell, das das Tor nicht hat):`,
    );
    for (const fall of faelle) {
      console.log(`        ${fall.file} › ${fall.title}`);
    }
    console.log(
      `      Menge gepinnt in tests/smoke/tor-ausnahme.test.ts gegen ${vertrag.nicht_im_tor}.`,
    );
  }
} else {
  abbruch(`unbekannter Aufruf „${modus ?? ""}" (erwartet --stufen, --ausserhalb oder --einbau)`);
}
