#!/usr/bin/env node
// ==================================================================================================
// R-0781 · R-0851 · R-0861 (aufnahme:20260922:gesamt-kundenbetrieb) — WELCHE FASSUNG LÄUFT WO,
// ÜBER WELCHEN KANAL, UND STIMMT DAS?
// ==================================================================================================
//
// Das INVENTAR (eine JSON-Datei beim Betreiber, Muster: `instanzen.beispiel.json` daneben) hält fest:
//   · `kanaele`   je Freigabekanal die ERWARTETE Fassung (`version`, optional `commit`),
//   · `instanzen` je Anlage Kennung, Firma, Betriebsmodell, Adresse und Kanal.
// Die Kennung ist innerhalb des Inventars eindeutig, ebenso die Adresse (eine Firma je Instanz).
//
// Der ABGLEICH fragt jede Instanz unter ihrer Adresse (`GET <adresse>/health`) und vergleicht:
//   · `version` (und `commit`, wenn der Kanal einen nennt) gegen die Erwartung ihres Kanals,
//   · `instanz` — die Adresse, unter der sich die Instanz selbst kennt (`instanzAdresse()` in
//     `services/app/src/build-app.ts`) — gegen die Adresse im Inventar. So fällt auf, wenn unter
//     einer Adresse eine andere Anlage antwortet. Meldet eine ältere Fassung das Feld noch nicht,
//     steht die Identität als `nicht_gemeldet` da; die Anlage ist dann `identitaet_ungeklaert`,
//     nicht `gleich`, und der Abgleich endet mit Exit 1.
// Und je Kanal (R-0781): fahren Anlagen desselben Kanals unterschiedliche Fassungen, ist der Kanal
// AUSEINANDERGELAUFEN — die Anlagen auf einem anderen Stand als erwartet sind benannt.
//
// Es wird nur gelesen. Nichts wird an einer Instanz geändert, kein Geheimnis wird gebraucht.
//
// Aufruf: node scripts/betrieb/instanzabgleich.mjs <inventar.json> [--json]
// Exit 0 alle Anlagen gleich (Fassung UND Identität bestätigt) · 1 mindestens eine Abweichung, nicht
// erreichbar oder Identität ungeklärt · 2 Inventar ungültig
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

export const MODELLE = ["cloud", "kundeninstanz", "private-ai", "insel"];
const COMMIT_RE = /^[0-9a-f]{7,40}$/i;

/** Prüft das Inventar und liefert die Liste der Fehler (leer = gültig). */
export function pruefeInventar(inventar) {
  const fehler = [];
  if (!inventar || typeof inventar !== "object") return ["Inventar ist kein JSON-Objekt."];
  const kanaele = inventar.kanaele;
  if (!kanaele || typeof kanaele !== "object" || Object.keys(kanaele).length === 0) {
    fehler.push("`kanaele` fehlt oder ist leer.");
  } else {
    for (const [name, soll] of Object.entries(kanaele)) {
      if (typeof soll?.version !== "string" || !soll.version.trim()) {
        fehler.push(`Kanal „${name}": \`version\` fehlt.`);
      }
      if (soll?.commit !== undefined && !COMMIT_RE.test(String(soll.commit))) {
        fehler.push(`Kanal „${name}": \`commit\` ist kein Git-Objektname.`);
      }
    }
  }
  if (!Array.isArray(inventar.instanzen) || inventar.instanzen.length === 0) {
    fehler.push("`instanzen` fehlt oder ist leer.");
    return fehler;
  }
  const kennungen = new Set();
  const adressen = new Set();
  for (const [i, instanz] of inventar.instanzen.entries()) {
    const ort = `Instanz ${i + 1}${instanz?.kennung ? ` („${instanz.kennung}")` : ""}`;
    for (const feld of ["kennung", "firma", "modell", "adresse", "kanal"]) {
      if (typeof instanz?.[feld] !== "string" || !instanz[feld].trim()) {
        fehler.push(`${ort}: \`${feld}\` fehlt.`);
      }
    }
    if (typeof instanz?.kennung === "string") {
      if (kennungen.has(instanz.kennung)) fehler.push(`${ort}: Kennung doppelt.`);
      kennungen.add(instanz.kennung);
    }
    if (typeof instanz?.modell === "string" && !MODELLE.includes(instanz.modell)) {
      fehler.push(`${ort}: Modell „${instanz.modell}" unbekannt (erlaubt: ${MODELLE.join(", ")}).`);
    }
    const kanalListe = kanaele && typeof kanaele === "object" ? kanaele : {};
    if (typeof instanz?.kanal === "string" && !Object.hasOwn(kanalListe, instanz.kanal)) {
      fehler.push(`${ort}: Kanal „${instanz.kanal}" steht nicht unter \`kanaele\`.`);
    }
    if (typeof instanz?.adresse === "string") {
      const origin = herkunft(instanz.adresse);
      if (origin === null) {
        fehler.push(`${ort}: Adresse ist keine http(s)-Adresse.`);
      } else {
        if (adressen.has(origin)) fehler.push(`${ort}: Adresse doppelt — eine Firma je Instanz.`);
        adressen.add(origin);
      }
    }
  }
  return fehler;
}

function herkunft(adresse) {
  try {
    const url = new URL(adresse);
    return url.protocol === "http:" || url.protocol === "https:" ? url.origin : null;
  } catch {
    return null;
  }
}

/** Fragt eine Instanz und vergleicht sie mit der Erwartung ihres Kanals. Wirft nie. */
export async function gleicheInstanzAb(instanz, soll, { fetchImpl = fetch, zeitMs = 5000 } = {}) {
  const origin = herkunft(instanz.adresse);
  const basis = {
    kennung: instanz.kennung,
    firma: instanz.firma,
    modell: instanz.modell,
    kanal: instanz.kanal,
    adresse: origin,
    erwartet: { version: soll.version, commit: soll.commit ?? null },
  };
  let rumpf;
  try {
    const antwort = await fetchImpl(`${origin}/health`, { signal: AbortSignal.timeout(zeitMs) });
    if (!antwort.ok) throw new Error(`HTTP ${antwort.status}`);
    rumpf = await antwort.json();
  } catch (fehler) {
    const grund = fehler instanceof Error ? fehler.message : String(fehler);
    return {
      ...basis,
      laufend: null,
      identitaet: "unbekannt",
      ergebnis: "nicht_erreichbar",
      abweichungen: [grund],
    };
  }
  const laufend = {
    status: typeof rumpf?.status === "string" ? rumpf.status : null,
    version: typeof rumpf?.version === "string" ? rumpf.version : null,
    commit: typeof rumpf?.commit === "string" ? rumpf.commit : null,
    instanz: typeof rumpf?.instanz === "string" ? rumpf.instanz : null,
  };
  const abweichungen = [];
  if (laufend.status !== "ok") abweichungen.push(`status ${laufend.status ?? "fehlt"}`);
  if (laufend.version !== soll.version) {
    abweichungen.push(`version: erwartet ${soll.version}, laufend ${laufend.version ?? "fehlt"}`);
  }
  if (soll.commit && laufend.commit !== soll.commit) {
    abweichungen.push(`commit: erwartet ${soll.commit}, laufend ${laufend.commit ?? "fehlt"}`);
  }
  let identitaet;
  if (laufend.instanz === null || laufend.instanz === "unbekannt") {
    identitaet = "nicht_gemeldet";
  } else if (laufend.instanz === origin) {
    identitaet = "bestaetigt";
  } else {
    identitaet = "abweichend";
    abweichungen.push(`instanz: erreicht unter ${origin}, meldet sich als ${laufend.instanz}`);
  }
  // R-0851 verlangt eine NACHWEISBARE Identität. Passt die Fassung, meldet die Instanz aber keine
  // Identität, ist der Abgleich nicht bestanden: Ergebnis `identitaet_ungeklaert`, kein „gleich".
  let ergebnis = "gleich";
  if (abweichungen.length > 0) ergebnis = "abweichend";
  else if (identitaet !== "bestaetigt") ergebnis = "identitaet_ungeklaert";
  return { ...basis, laufend, identitaet, ergebnis, abweichungen };
}

/** Der ganze Abgleich: je Instanz das Ergebnis, je Kanal die Drift. */
export async function gleicheInventarAb(inventar, optionen = {}) {
  const fehler = pruefeInventar(inventar);
  if (fehler.length > 0) return { gueltig: false, fehler };
  const anlagen = await Promise.all(
    inventar.instanzen.map((instanz) =>
      gleicheInstanzAb(instanz, inventar.kanaele[instanz.kanal], optionen),
    ),
  );
  const kanaele = Object.entries(inventar.kanaele).map(([name, soll]) => {
    const imKanal = anlagen.filter((a) => a.kanal === name);
    const fassungen = [
      ...new Set(imKanal.map((a) => a.laufend?.version).filter((v) => typeof v === "string")),
    ].sort();
    return {
      kanal: name,
      erwartet: { version: soll.version, commit: soll.commit ?? null },
      anlagen: imKanal.length,
      laufendeFassungen: fassungen,
      auseinandergelaufen: fassungen.length > 1,
      // Nicht auf Stand: abweichende Fassung oder keine Auskunft. Eine nur ungeklärte Identität ist
      // keine Drift und steht gesondert unter `identitaetUngeklaert`.
      nichtAufStand: imKanal
        .filter((a) => a.ergebnis === "abweichend" || a.ergebnis === "nicht_erreichbar")
        .map((a) => a.kennung),
      identitaetUngeklaert: imKanal
        .filter((a) => a.ergebnis === "identitaet_ungeklaert")
        .map((a) => a.kennung),
    };
  });
  return {
    gueltig: true,
    anlagen,
    kanaele,
    zusammenfassung: {
      gleich: anlagen.filter((a) => a.ergebnis === "gleich").length,
      abweichend: anlagen.filter((a) => a.ergebnis === "abweichend").length,
      nichtErreichbar: anlagen.filter((a) => a.ergebnis === "nicht_erreichbar").length,
      identitaetUngeklaert: anlagen.filter((a) => a.ergebnis === "identitaet_ungeklaert").length,
      auseinandergelaufeneKanaele: kanaele.filter((k) => k.auseinandergelaufen).map((k) => k.kanal),
    },
  };
}

/** Die Übersicht als Text — eine Zeile je Anlage, danach die Kanäle. */
export function alsText(bericht) {
  if (!bericht.gueltig) return `INVENTAR UNGÜLTIG\n${bericht.fehler.map((f) => `  - ${f}`).join("\n")}\n`;
  const zeilen = ["Kennung | Firma | Modell | Kanal | erwartet | laufend | Identität | Ergebnis"];
  for (const a of bericht.anlagen) {
    zeilen.push(
      [
        a.kennung,
        a.firma,
        a.modell,
        a.kanal,
        a.erwartet.version,
        a.laufend?.version ?? "—",
        a.identitaet,
        a.ergebnis + (a.abweichungen.length ? ` (${a.abweichungen.join("; ")})` : ""),
      ].join(" | "),
    );
  }
  zeilen.push("");
  for (const k of bericht.kanaele) {
    const lage = k.auseinandergelaufen ? "AUSEINANDERGELAUFEN" : "einheitlich";
    const ungeklaert = k.identitaetUngeklaert.length
      ? `, Identität ungeklärt: ${k.identitaetUngeklaert.join(", ")}`
      : "";
    const rest =
      (k.nichtAufStand.length ? `, nicht auf Stand: ${k.nichtAufStand.join(", ")}` : "") + ungeklaert;
    zeilen.push(
      `Kanal ${k.kanal}: erwartet ${k.erwartet.version}, ${k.anlagen} Anlage(n), ${lage} [${k.laufendeFassungen.join(", ")}]${rest}`,
    );
  }
  return `${zeilen.join("\n")}\n`;
}

/**
 * Exitcode zum Bericht: 0 nur, wenn JEDE Anlage `gleich` ist (Fassung und Identität bestätigt);
 * 1 bei Abweichung, nicht erreichbar oder ungeklärter Identität; 2 Inventar ungültig.
 */
export function exitcode(bericht) {
  if (!bericht.gueltig) return 2;
  return bericht.anlagen.every((a) => a.ergebnis === "gleich") ? 0 : 1;
}

const direktAufgerufen =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

if (direktAufgerufen) {
  const argumente = process.argv.slice(2);
  const alsJson = argumente.includes("--json");
  const pfad = argumente.find((a) => a !== "--json");
  if (!pfad) {
    process.stderr.write("Aufruf: instanzabgleich.mjs <inventar.json> [--json]\n");
    process.exit(2);
  }
  let inventar;
  try {
    inventar = JSON.parse(readFileSync(pfad, "utf8"));
  } catch (fehler) {
    process.stderr.write(`Inventar nicht lesbar: ${fehler instanceof Error ? fehler.message : fehler}\n`);
    process.exit(2);
  }
  const bericht = await gleicheInventarAb(inventar);
  process.stdout.write(alsJson ? `${JSON.stringify(bericht, null, 2)}\n` : alsText(bericht));
  process.exit(exitcode(bericht));
}
