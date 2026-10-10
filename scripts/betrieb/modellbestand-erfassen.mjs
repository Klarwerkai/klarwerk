#!/usr/bin/env node
// ==================================================================================================
// AW-12 (aufnahme:20260922:gesamt-kundenbetrieb) — WELCHE MODELLE LAUFEN WIRKLICH, IN WELCHER FASSUNG,
// UNTER WELCHER LIZENZ?
// ==================================================================================================
//
// Ein Name wie `qwen3:32b` ist ein Tag; er kann morgen auf andere Gewichte zeigen. Belegt ist eine
// Fassung erst mit dem Digest, den der laufende Modellserver selbst meldet. Dieses Werkzeug fragt den
// INTERNEN Ollama-Server (nur Loopback oder ausdrücklich freigegebene Herkunft, keine Weiterleitung)
// und schreibt einen Bestand:
//   · Laufzeit: `GET /api/version`
//   · je verlangtes Modell: Digest, Größe, Familie, Parametergröße, Quantisierung (`GET /api/tags`)
//     und der Lizenztext, den das Gewicht selbst mitbringt — als SHA-256 und erste Zeile
//     (`POST /api/show`); fehlt er, steht `lizenz: null` da, nie eine geratene Lizenz
//   · eine echte Einbettungsprobe am Embedding-Modell (`POST /api/embed`): Länge = verlangte Dimension
//
// Aufruf: node scripts/betrieb/modellbestand-erfassen.mjs <basis> --sprachmodell <name>
//           --embedding <name> --dim <n> [--erlaubt <origin>]
//   <basis> z. B. http://127.0.0.1:11434 (Ollama-Wurzel, NICHT …/v1)
// Exit 0 Bestand vollständig · 1 Modell fehlt, Probe falsch oder Server nicht erreichbar · 2 Aufruf falsch
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";

export function istInterneHerkunft(basis, erlaubt) {
  let url;
  try {
    url = new URL(basis);
  } catch {
    return false;
  }
  const host = url.hostname.toLowerCase();
  if (host === "localhost" || host === "::1" || host === "[::1]" || /^127(\.\d{1,3}){3}$/.test(host)) {
    return true;
  }
  if (typeof erlaubt !== "string" || erlaubt.length === 0) return false;
  try {
    return new URL(erlaubt).origin === url.origin;
  } catch {
    return false;
  }
}

async function frage(fetchImpl, url, rumpf) {
  const antwort = await fetchImpl(url, {
    method: rumpf === undefined ? "GET" : "POST",
    headers: rumpf === undefined ? {} : { "content-type": "application/json" },
    ...(rumpf === undefined ? {} : { body: JSON.stringify(rumpf) }),
    redirect: "error",
    signal: AbortSignal.timeout(60_000),
  });
  if (!antwort.ok) throw new Error(`${url}: HTTP ${antwort.status}`);
  return antwort.json();
}

/** Erfasst den Bestand. Wirft nie; Fehler stehen in `fehler`. */
export async function erfasseModellbestand({ basis, sprachmodell, embedding, dim, fetchImpl = fetch }) {
  const wurzel = basis.replace(/\/+$/, "");
  const fehler = [];
  const bestand = {
    erfasstAm: new Date().toISOString(),
    server: new URL(wurzel).origin,
    laufzeit: { art: "ollama", version: null },
    modelle: [],
    embeddingProbe: null,
    fehler,
  };
  try {
    const version = await frage(fetchImpl, `${wurzel}/api/version`);
    bestand.laufzeit.version = typeof version?.version === "string" ? version.version : null;
  } catch (f) {
    fehler.push(`Laufzeit nicht erreichbar: ${f instanceof Error ? f.message : f}`);
    return bestand;
  }
  let vorhanden = [];
  try {
    const tags = await frage(fetchImpl, `${wurzel}/api/tags`);
    vorhanden = Array.isArray(tags?.models) ? tags.models : [];
  } catch (f) {
    fehler.push(`Modellliste nicht lesbar: ${f instanceof Error ? f.message : f}`);
  }
  for (const [rolle, name] of [
    ["sprachmodell", sprachmodell],
    ["embedding", embedding],
  ]) {
    const treffer = vorhanden.find((m) => m?.name === name || m?.model === name);
    if (!treffer) {
      fehler.push(`${rolle} „${name}" ist auf dem Server nicht vorhanden`);
      bestand.modelle.push({ rolle, name, vorhanden: false });
      continue;
    }
    let lizenz = null;
    try {
      const info = await frage(fetchImpl, `${wurzel}/api/show`, { model: name });
      const text = typeof info?.license === "string" ? info.license.trim() : "";
      if (text) {
        lizenz = {
          sha256: createHash("sha256").update(text, "utf8").digest("hex"),
          ersteZeile: text.split("\n")[0].trim().slice(0, 200),
        };
      }
    } catch (f) {
      fehler.push(`Lizenzangabe zu „${name}" nicht lesbar: ${f instanceof Error ? f.message : f}`);
    }
    if (lizenz === null) fehler.push(`„${name}" bringt keinen Lizenztext mit`);
    bestand.modelle.push({
      rolle,
      name,
      vorhanden: true,
      digest: treffer.digest ?? null,
      groesse: treffer.size ?? null,
      familie: treffer.details?.family ?? null,
      parameter: treffer.details?.parameter_size ?? null,
      quantisierung: treffer.details?.quantization_level ?? null,
      lizenz,
    });
  }
  if (bestand.modelle.some((m) => m.rolle === "embedding" && m.vorhanden)) {
    try {
      const probe = await frage(fetchImpl, `${wurzel}/api/embed`, {
        model: embedding,
        input: ["Probe des internen Embedding-Wegs"],
      });
      const laenge = Array.isArray(probe?.embeddings?.[0]) ? probe.embeddings[0].length : null;
      bestand.embeddingProbe = { erwartet: dim, geliefert: laenge, gleich: laenge === dim };
      if (laenge !== dim) fehler.push(`Embedding-Dimension ${laenge} statt ${dim}`);
    } catch (f) {
      fehler.push(`Einbettungsprobe gescheitert: ${f instanceof Error ? f.message : f}`);
    }
  }
  return bestand;
}

const direktAufgerufen =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

if (direktAufgerufen) {
  const args = process.argv.slice(2);
  const wert = (name) => {
    const i = args.indexOf(name);
    return i >= 0 ? args[i + 1] : undefined;
  };
  const basis = args[0];
  const sprachmodell = wert("--sprachmodell");
  const embedding = wert("--embedding");
  const dim = Number(wert("--dim"));
  const erlaubt = wert("--erlaubt");
  if (!basis || basis.startsWith("--") || !sprachmodell || !embedding || !Number.isInteger(dim) || dim <= 0) {
    process.stderr.write(
      "Aufruf: modellbestand-erfassen.mjs <basis> --sprachmodell <name> --embedding <name> --dim <n> [--erlaubt <origin>]\n",
    );
    process.exit(2);
  }
  if (!istInterneHerkunft(basis, erlaubt)) {
    process.stderr.write(
      `Abbruch: ${basis} ist keine interne Adresse (Loopback oder --erlaubt). Es wurde nichts abgefragt.\n`,
    );
    process.exit(2);
  }
  const bestand = await erfasseModellbestand({ basis, sprachmodell, embedding, dim });
  process.stdout.write(`${JSON.stringify(bestand, null, 2)}\n`);
  process.exit(bestand.fehler.length === 0 ? 0 : 1);
}
