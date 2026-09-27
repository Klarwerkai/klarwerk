// ================================================================================================
// B3 — DER KUNDENBESTAND DES DRILLS: ueber die ECHTE Anwendung angelegt, spaeter Feld fuer Feld und
// Byte fuer Byte gegen jede Instanz verglichen, die ihn nach Sicherung, Wiederherstellung,
// Aktualisierung oder Rueckweg fuehren soll.
// ================================================================================================
//
// Aufruf (im Pruefwerkzeug-Container, siehe scripts/backup/compose-drill.sh):
//
//   node nutzlast.mjs anlegen    <basis-url> <bestand.json>
//   node nutzlast.mjs vergleichen <basis-url> <bestand.json> <ergebnis.json>
//
// Das Kennwort des Drill-Kontos kommt aus DRILL_LOGIN_PASSWORT, nie aus einem Argument, und es
// steht in keiner Ausgabe und in keiner Datei, die dieses Werkzeug schreibt.
//
// KEIN SQL: angelegt wird wie ein Betreiber es taete — Ersteinrichtung (oder Anmeldung, wenn die
// Instanz schon eingerichtet ist), Wissensobjekt, hochgeladene Datei, Anhang am Wissensobjekt.
// Gelesen wird ebenso: Wissensobjekt, Belegliste, Rohinhalt des Anhangs, Auditkette, /health.
//
// EXITCODES
//   0  anlegen: Bestand steht · vergleichen: alles gleich
//   1  vergleichen: BEFUND — mindestens ein Feld/Byte weicht ab oder fehlt
//   2  AUFBAUFEHLER — Aufruf falsch, Instanz nicht erreichbar, Anmeldung gescheitert, Route
//      antwortet unerwartet. Ausdruecklich KEIN Befund am Bestand.
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";

const [modus, basis, bestandsDatei, ergebnisDatei] = process.argv.slice(2);
const EMAIL = process.env.DRILL_LOGIN_EMAIL || "b3-drill@pruefplatz.test";
const PASSWORT = process.env.DRILL_LOGIN_PASSWORT || "";

class Aufbaufehler extends Error {}

function aufbau(text) {
  throw new Aufbaufehler(text);
}

// Deterministische Nutzlast mit Nullbytes und hohen Bytes — jede Umkodierung faellt auf.
function anhangsBytes() {
  return Buffer.concat(
    Array.from({ length: 16 }, (_, i) => createHash("sha256").update(`B3-DRILL-${i}`).digest()),
  );
}

function sha256(buf) {
  return createHash("sha256").update(buf).digest("hex");
}

async function rufe(pfad, { methode = "GET", token, json } = {}) {
  const kopf = {};
  if (token) kopf.authorization = `Bearer ${token}`;
  if (json !== undefined) kopf["content-type"] = "application/json";
  let antwort;
  try {
    antwort = await fetch(`${basis}${pfad}`, {
      method: methode,
      headers: kopf,
      body: json === undefined ? undefined : JSON.stringify(json),
    });
  } catch (fehler) {
    aufbau(`${methode} ${pfad}: Instanz nicht erreichbar (${fehler.message})`);
  }
  const roh = Buffer.from(await antwort.arrayBuffer());
  let daten;
  try {
    daten = JSON.parse(roh.toString("utf8"));
  } catch {
    daten = undefined;
  }
  return { status: antwort.status, roh, daten };
}

async function anmelden() {
  if (!PASSWORT) aufbau("DRILL_LOGIN_PASSWORT ist nicht gesetzt.");
  const login = await rufe("/api/auth/login", {
    methode: "POST",
    json: { email: EMAIL, password: PASSWORT },
  });
  if (login.status !== 200 || !login.daten?.token) {
    aufbau(`Anmeldung des Drill-Kontos ${EMAIL} endete mit HTTP ${login.status}.`);
  }
  return login.daten.token;
}

async function anlegen() {
  const status = await rufe("/api/auth/status");
  if (status.status !== 200) aufbau(`/api/auth/status antwortet mit ${status.status}.`);
  let token;
  let ersteinrichtung = false;
  if (status.daten?.needsSetup === true) {
    if (!PASSWORT) aufbau("DRILL_LOGIN_PASSWORT ist nicht gesetzt.");
    const setup = await rufe("/api/auth/setup", {
      methode: "POST",
      json: { name: "B3 Drill Administrator", email: EMAIL, password: PASSWORT },
    });
    if (setup.status !== 201 || !setup.daten?.token) {
      aufbau(`Ersteinrichtung endete mit HTTP ${setup.status}.`);
    }
    token = setup.daten.token;
    ersteinrichtung = true;
  } else {
    token = await anmelden();
  }

  const zeit = new Date().toISOString();
  const titel = `B3-Drill Kundenbestand ${zeit}`;
  const aussage = "Bei Überdruck Ventil X schließen — Prüfplatz B3, Sicherung und Wiederherstellung.";
  const ko = await rufe("/api/kos", {
    methode: "POST",
    token,
    json: {
      confidentiality: "intern",
      title: titel,
      statement: aussage,
      type: "best_practice",
      category: "Prüfplatz B3",
    },
  });
  if (ko.status !== 201 || !ko.daten?.id) aufbau(`POST /api/kos endete mit HTTP ${ko.status}.`);
  const koId = ko.daten.id;

  const bytes = anhangsBytes();
  const upload = await rufe("/api/objects", {
    methode: "POST",
    token,
    json: {
      name: "b3-pruefbericht.png",
      mime: "image/png",
      data: `data:image/png;base64,${bytes.toString("base64")}`,
    },
  });
  if (upload.status !== 201 || !upload.daten?.id) {
    aufbau(`POST /api/objects endete mit HTTP ${upload.status}.`);
  }
  const objektId = upload.daten.id;

  const anhang = await rufe(`/api/kos/${koId}`, {
    methode: "PUT",
    token,
    json: {
      action: "attach",
      attachment: { name: "b3-pruefbericht.png", mime: "image/png", objectId: objektId },
    },
  });
  if (anhang.status !== 200) aufbau(`Anhang binden endete mit HTTP ${anhang.status}.`);

  const belege = await rufe(`/api/kos/${koId}/evidence`, { token });
  const beleg = Array.isArray(belege.daten)
    ? belege.daten.find((e) => e && e.objectId === objektId)
    : undefined;
  if (belege.status !== 200 || !beleg?.id) {
    aufbau(`Die Belegliste von ${koId} fuehrt den eben gebundenen Anhang nicht.`);
  }

  const health = await rufe("/health");
  const bestand = {
    zeit,
    basis,
    email: EMAIL,
    ersteinrichtung,
    koId,
    titel,
    aussage,
    objektId,
    belegId: beleg.id,
    anhangBytes: bytes.length,
    anhangSha256: sha256(bytes),
    health: health.daten ?? null,
  };
  writeFileSync(bestandsDatei, `${JSON.stringify(bestand, null, 1)}\n`);
  console.log(
    `[nutzlast] Bestand angelegt: Wissensobjekt ${koId}, Anhang ${objektId} (${bytes.length} Bytes, sha256 ${bestand.anhangSha256}), Beleg ${beleg.id}${ersteinrichtung ? ", Konto per Ersteinrichtung" : ""}.`,
  );
  return 0;
}

async function vergleichen() {
  let bestand;
  try {
    bestand = JSON.parse(readFileSync(bestandsDatei, "utf8"));
  } catch {
    aufbau(`Bestandsdatei ${bestandsDatei} fehlt oder ist unlesbar (Schritt 'bestand' zuerst).`);
  }
  const token = await anmelden();
  const pruefungen = [];
  const pruefe = (name, erwartet, gemessen) => {
    pruefungen.push({ name, erwartet, gemessen, gleich: erwartet === gemessen });
  };

  const ko = await rufe(`/api/kos/${bestand.koId}`, { token });
  if (ko.status !== 200 && ko.status !== 404) aufbau(`GET /api/kos/<id> antwortet mit ${ko.status}.`);
  pruefe("wissensobjekt.vorhanden", true, ko.status === 200);
  pruefe("wissensobjekt.titel", bestand.titel, ko.daten?.title ?? null);
  pruefe("wissensobjekt.aussage", bestand.aussage, ko.daten?.statement ?? null);

  const belege = await rufe(`/api/kos/${bestand.koId}/evidence`, { token });
  if (belege.status !== 200 && belege.status !== 404) {
    aufbau(`GET /api/kos/<id>/evidence antwortet mit ${belege.status}.`);
  }
  const beleg = Array.isArray(belege.daten)
    ? belege.daten.find((e) => e && e.id === bestand.belegId)
    : undefined;
  pruefe("beleg.vorhanden", true, Boolean(beleg));
  pruefe("beleg.objectId", bestand.objektId, beleg?.objectId ?? null);

  const roh = await rufe(`/api/objects/${bestand.objektId}/raw`, { token });
  if (![200, 404, 415].includes(roh.status)) {
    aufbau(`GET /api/objects/<id>/raw antwortet mit ${roh.status}.`);
  }
  pruefe("anhang.status", 200, roh.status);
  pruefe("anhang.bytes", bestand.anhangBytes, roh.status === 200 ? roh.roh.length : 0);
  pruefe("anhang.sha256", bestand.anhangSha256, roh.status === 200 ? sha256(roh.roh) : null);

  const audit = await rufe("/api/audit/verify", { token });
  if (audit.status !== 200) aufbau(`GET /api/audit/verify antwortet mit ${audit.status}.`);
  pruefe("audit.linkageBreaks", 0, audit.daten?.linkageBreaks ?? null);
  pruefe("audit.unresolvedDeviations", 0, audit.daten?.unresolvedDeviations ?? null);
  pruefe("audit.uncheckedDeviations", 0, audit.daten?.uncheckedDeviations ?? null);

  const health = await rufe("/health");
  const abweichungen = pruefungen.filter((p) => !p.gleich);
  const ergebnis = {
    zeit: new Date().toISOString(),
    basis,
    ergebnis: abweichungen.length === 0 ? "gleich" : "abweichung",
    health: health.daten ?? null,
    pruefungen,
  };
  if (ergebnisDatei) writeFileSync(ergebnisDatei, `${JSON.stringify(ergebnis, null, 1)}\n`);
  for (const p of pruefungen) {
    console.log(
      `[nutzlast] ${p.gleich ? "gleich " : "ABWEICHUNG"} ${p.name}: erwartet ${JSON.stringify(p.erwartet)} gemessen ${JSON.stringify(p.gemessen)}`,
    );
  }
  console.log(
    `[nutzlast] /health: version=${health.daten?.version ?? "?"} commit=${health.daten?.commit ?? "?"}`,
  );
  if (abweichungen.length > 0) {
    console.log(`[nutzlast] BEFUND: ${abweichungen.length} Abweichung(en) gegen den Bestand.`);
    return 1;
  }
  console.log("[nutzlast] Bestand unveraendert lesbar — Wissensobjekt, Beleg, Anhang (Byte fuer Byte), Auditkette.");
  return 0;
}

try {
  if (!basis || !bestandsDatei) aufbau("Aufruf: nutzlast.mjs anlegen|vergleichen <basis-url> <bestand.json> [ergebnis.json]");
  let code;
  if (modus === "anlegen") code = await anlegen();
  else if (modus === "vergleichen") code = await vergleichen();
  else aufbau(`unbekannter Modus '${modus}'`);
  process.exit(code);
} catch (fehler) {
  if (fehler instanceof Aufbaufehler) {
    console.error(`[nutzlast] AUFBAUFEHLER (2): ${fehler.message} — kein Befund am Bestand.`);
    process.exit(2);
  }
  throw fehler;
}
