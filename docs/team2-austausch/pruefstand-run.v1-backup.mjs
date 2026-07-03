#!/usr/bin/env node
/* KLARWERK Prüfstand-Runner (KLLM-56) — fährt die Testfälle gegen ein Ziel:
 *   node scripts/pruefstand-run.mjs anthropic            → Referenzlauf (Messlatte)
 *   node scripts/pruefstand-run.mjs http://localhost:8123/v1   → lokaler vLLM-Server
 * Schreibt data/pruefstand-ergebnisse.json (Historie) + reports/pruefstand-latest.md.
 * Keine Abhängigkeiten; Keys NUR aus Env/Schlüsselbund; keine Kundendaten (Fälle sind erfunden).
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { execSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const ZIEL = process.argv[2] || "anthropic";

const SYSTEM = {
  structure: "Du strukturierst deutsches Erfahrungswissen. Antworte NUR mit JSON: {\"titel\":\"…\",\"aussage\":\"…\",\"bedingungen\":[…],\"massnahmen\":[…]}. Erfinde NICHTS, was nicht im Text steht.",
  extract: "Extrahiere Wissenspunkte aus dem Dokument. Antworte NUR mit JSON: {\"punkte\":[{\"titel\":\"…\",\"belegstelle\":\"wörtliches Zitat aus dem Dokument\"}]}. Wenn das Dokument kein verwertbares Fachwissen enthält, antworte {\"punkte\":[]}. Erfinde NICHTS.",
  answer: "Beantworte die Frage NUR aus dem mitgelieferten gesicherten Wissen und nenne die KO-Kennung als Quelle. Wenn das Wissen die Frage nicht beantwortet, sage ehrlich: 'Dazu liegt kein gesichertes Wissen vor.' Erfinde NICHTS.",
  interview: "Du führst ein Wissens-Interview. Stelle GENAU EINE gezielte, aufbauende Nachfrage zum Thema (nach Grenzwerten, Ausnahmen, Gründen, Verantwortlichkeiten). Keine Generik-Floskeln.",
  assist: "Formuliere den Text klar und professionell auf Deutsch um. Behalte ALLE Fakten exakt bei, füge NICHTS hinzu, lasse nichts Wichtiges weg. Antworte nur mit dem umformulierten Text.",
  select: "Wähle aus den Kandidaten die für die Frage relevanten. Antworte nur mit den KO-Kennungen oder mit 'keiner passt'.",
};

function keychain(svc, acc) {
  try { return execSync(`/usr/bin/security find-generic-password -s "${svc}" -a "${acc}" -w`, { stdio: ["ignore", "pipe", "ignore"] }).toString().trim(); }
  catch { return ""; }
}

async function frageAnthropic(system, user) {
  const key = process.env.ANTHROPIC_API_KEY || keychain("KLARWERK-PMO-Anthropic", "team1") || keychain("KLARWERK-App-Anthropic", "team1");
  if (!key) throw new Error("Kein Anthropic-Key (Env/Schlüsselbund).");
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: 1024, system, messages: [{ role: "user", content: user }] }),
  });
  if (!r.ok) throw new Error("Anthropic HTTP " + r.status);
  const d = await r.json();
  return { text: d.content?.[0]?.text ?? "", modell: "claude-sonnet-4-6" };
}

async function frageOpenAi(base, system, user) {
  const models = await fetch(base + "/models").then((r) => r.json());
  const modell = models.data?.[0]?.id || "unbekannt";
  const r = await fetch(base + "/chat/completions", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ model: modell, max_tokens: 1024, messages: [{ role: "system", content: system }, { role: "user", content: user }] }),
  });
  if (!r.ok) throw new Error("LLM HTTP " + r.status);
  const d = await r.json();
  return { text: d.choices?.[0]?.message?.content ?? "", modell };
}

const norm = (s) => s.toLowerCase().replace(/\s+/g, " ");
function bewerte(fall, text) {
  const c = fall.checks; const t = norm(text); const gruende = []; let ok = 0, gesamt = 0;
  const check = (bed, grund) => { gesamt++; if (bed) ok++; else gruende.push(grund); };
  if (c.json) { let j = null; try { j = JSON.parse(text.replace(/```json|```/g, "").trim()); } catch {} check(!!j, "kein gültiges JSON"); }
  for (const w of c.enthaelt || []) check(t.includes(norm(w)), `fehlt: "${w}"`);
  for (const w of c.enthaeltNicht || []) check(!t.includes(norm(w)), `erfunden/falsch: "${w}"`);
  if (c.enthaeltEines) check(c.enthaeltEines.some((w) => t.includes(norm(w))), "kein gezieltes Nachbohren erkennbar");
  if (c.istFrage) check(text.includes("?"), "keine Frage gestellt");
  if (c.belegstelleImText) {
    let beleg = ""; try { beleg = (JSON.parse(text.replace(/```json|```/g, "").trim()).punkte?.[0]?.belegstelle) || ""; } catch {}
    check(beleg.length > 5 && norm(fall.eingabe).includes(norm(beleg)), "Belegstelle nicht wörtlich im Dokument (G-2!)");
  }
  if (c.ehrlichLeer) check(/\[\]|keiner passt|kein verwertbar|keine punkte|nichts gefunden|enthält kein/i.test(text), "hat nicht ehrlich 'nichts' geantwortet");
  if (c.ehrlichUnwissend) check(/kein gesichertes wissen|weiß (es )?nicht|liegt nicht vor|wissenslücke|kann .*nicht beantwort/i.test(text), "hat nicht ehrlich Unwissen zugegeben");
  const punkte = gesamt === 0 ? 0 : ok === gesamt ? 2 : ok >= gesamt / 2 ? 1 : 0;
  return { punkte, ok, gesamt, gruende };
}

const daten = JSON.parse(readFileSync(join(ROOT, "data/pruefstand-testfaelle.json"), "utf8"));
const frage = ZIEL === "anthropic" ? (s, u) => frageAnthropic(s, u) : (s, u) => frageOpenAi(ZIEL.replace(/\/$/, ""), s, u);

console.log(`Prüfstand ${daten.version} · Ziel: ${ZIEL} · ${daten.faelle.length} Fälle`);
const ergebnisse = []; let modell = "?";
for (const fall of daten.faelle) {
  const t0 = Date.now();
  let antwort = "", fehler = "";
  try { const r = await frage(SYSTEM[fall.task], fall.eingabe); antwort = r.text; modell = r.modell; }
  catch (e) { fehler = String(e.message || e); }
  const sek = Math.round((Date.now() - t0) / 100) / 10;
  const b = fehler ? { punkte: 0, ok: 0, gesamt: 1, gruende: [fehler] } : bewerte(fall, antwort);
  ergebnisse.push({ id: fall.id, task: fall.task, titel: fall.titel, punkte: b.punkte, checksOk: `${b.ok}/${b.gesamt}`, sekunden: sek, gruende: b.gruende, antwort: antwort.slice(0, 600) });
  console.log(`  ${b.punkte === 2 ? "✓" : b.punkte === 1 ? "~" : "✗"} ${fall.id} ${fall.titel} → ${b.punkte}P (${b.ok}/${b.gesamt}, ${sek}s)${b.gruende.length ? " — " + b.gruende.join("; ") : ""}`);
}
const summe = ergebnisse.reduce((a, e) => a + e.punkte, 0);
const maxp = daten.faelle.length * 2;
const oSek = Math.round(ergebnisse.reduce((a, e) => a + e.sekunden, 0) / ergebnisse.length * 10) / 10;
console.log(`\nERGEBNIS: ${summe}/${maxp} Punkte · Ø ${oSek}s/Antwort · Modell: ${modell}`);

const pfad = join(ROOT, "data/pruefstand-ergebnisse.json");
const hist = existsSync(pfad) ? JSON.parse(readFileSync(pfad, "utf8")) : { laeufe: [] };
hist.laeufe.push({ zeit: new Date().toISOString(), ziel: ZIEL, modell, summe, max: maxp, oSekunden: oSek, faelle: ergebnisse });
writeFileSync(pfad, JSON.stringify(hist, null, 1));
mkdirSync(join(ROOT, "reports"), { recursive: true });
const md = [`# Prüfstand — letzter Lauf ${new Date().toLocaleString("de-DE")}`, ``,
  `Ziel: **${ZIEL}** · Modell: **${modell}** · **${summe}/${maxp} Punkte** · Ø ${oSek}s`, ``,
  `| Fall | Aufgabe | Punkte | Checks | Sek | Anmerkung |`, `|---|---|---|---|---|---|`,
  ...ergebnisse.map((e) => `| ${e.id} | ${e.task} | ${e.punkte} | ${e.checksOk} | ${e.sekunden} | ${e.gruende.join("; ") || "—"} |`)].join("\n");
writeFileSync(join(ROOT, "reports/pruefstand-latest.md"), md);
console.log("Gespeichert: data/pruefstand-ergebnisse.json + reports/pruefstand-latest.md");
