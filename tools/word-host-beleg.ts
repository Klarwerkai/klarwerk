// ================================================================================================
// WORD-HOST-BELEG — DER NACHWEIS DER REALHOST-ABNAHME, PRÜFBAR STATT ERZÄHLT.
// ================================================================================================
//
// Aufnahme `aufnahme:20260922:word-echter-arbeitsweg`, Ergänzung 4 (Pedi, 28.09.2026) mit
// Entscheidung `entscheidung:756b7d22`: eine bestehende Klarwerk-Anleitung wird in Word geöffnet,
// geändert und als NEUE FASSUNG DESSELBEN Wissensobjekts zurückgegeben. Die Abnahme gilt
// ausschließlich für Word Web unter Chrome, ein Dokument aus SharePoint/OneDrive des Testmandanten
// `klarwerktest4711` und ein Klarwerk-Konto der Rolle `admin` (Direktfreigabe).
//
// DIESES WERKZEUG NIMMT KEINE ABNAHME VOR. Es liest den Beleg, den ein Mensch nach der Bedienung im
// echten Host ablegt, und sagt, ob er VOLLSTÄNDIG, EINDEUTIG und GEHEIMNISFREI ist — Objektkennung,
// Ausgangsfassung, neue Fassung, Status, Host, Datei, Testzeit, `/health.version` und
// `/health.commit` derselben Bereitstellung. Ob die Bildschirmfotos zeigen, was der Beleg sagt,
// beurteilt die Prüfung (Ben), nicht diese Datei. Kein Netz, kein Schreiben, keine Anmeldung.
//
// Ablauf und Felder: `docs/operations/word-host-gesamtweg.md`.
// Aufruf: `node tools/word-host-beleg.ts <beleg.json>` — Code 1, sobald ein Befund besteht.

import { readFileSync } from "node:fs";

/** Der Mandant aus Entscheidung 756b7d22 — die beiden zulässigen SharePoint-Hosts. */
export const TESTMANDANT = "klarwerktest4711";
export const ZULAESSIGE_DOKUMENT_HOSTS: readonly string[] = [
  `${TESTMANDANT}-my.sharepoint.com`,
  `${TESTMANDANT}.sharepoint.com`,
];

/** Der Status, den eine Direktfreigabe (`revise-release`) am Objekt hinterlässt. */
export const STATUS_FREIGEGEBEN = "validiert";

/** Was diese Abnahme ausdrücklich NICHT belegt — steht in jedem Urteil, auch im bestandenen. */
export const NICHT_ABGEDECKT: readonly string[] = [
  "Word für Mac (getrennter Nachweis)",
  "Vorschlagsweg ohne Admin-Recht (Einreichen und Zweitprüfung)",
];

export const GILT_FUER = `Word Web unter Chrome · SharePoint/OneDrive ${TESTMANDANT} · Rolle admin`;

/** Jedes Pflichtfeld des Belegs — die Anleitung nennt genau diese (Test hält beide gleich). */
export const BELEG_PFLICHTFELDER: readonly string[] = [
  "host.anwendung",
  "host.browser",
  "host.browserVersion",
  "testzeit",
  "dokumentUrl",
  "bereitstellung.healthVersion",
  "bereitstellung.healthCommit",
  "bereitstellung.liefercommit",
  "konto.rolle",
  "rueckgabe.objektId",
  "rueckgabe.ausgangsfassung",
  "rueckgabe.neueFassung",
  "rueckgabe.objektIdNachRueckgabe",
  "rueckgabe.statusNachRueckgabe",
  "rueckgabe.bisherigeFassungAbrufbar",
  "rueckgabe.neueFassungWiederGeoeffnet",
  "rueckgabe.neueObjekteDurchRueckgabe",
  "nachweise",
];

export interface BelegBefund {
  feld: string;
  /** fehlt = nicht angegeben · ungueltig = widerspricht der Regel · offen = Nachweis steht aus */
  lage: "fehlt" | "ungueltig" | "offen";
  text: string;
}

export interface BelegUrteil {
  /** Formal vollständig und geheimnisfrei — KEINE Aussage über die Bildschirmfotos. */
  vollstaendig: boolean;
  befunde: BelegBefund[];
  giltFuer: string;
  nichtAbgedeckt: readonly string[];
}

/** Schlüssel, deren Inhalt in keinem Beleg stehen darf (Anmeldedaten, Sitzungen, Schlüssel). */
const GEHEIME_SCHLUESSEL =
  /pass(wort|word)?|token|cookie|secret|geheim|session|sitzung|authorization|bearer|credential|kennwort|api[-_]?key/i;

/** Werte, die nach Anmeldedaten aussehen, egal unter welchem Schlüssel. */
const GEHEIME_WERTE: readonly RegExp[] = [
  /\bbearer\s+\S+/i,
  /\beyJ[\w-]{8,}\.[\w-]{8,}\./,
  /(?:^|[;\s])[\w.-]*sess[\w.-]*=\S+/i,
];

/** Adressparameter, die Zugriff gewähren (Gastlink-Schlüssel, Signaturen, Anmeldecodes). */
const GEHEIME_URL_PARAMETER: readonly string[] = [
  "tempauth",
  "access_token",
  "token",
  "sig",
  "code",
  "authkey",
  "e",
];

const ISO_MIT_ZONE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})$/;

function feld(beleg: unknown, pfad: string): unknown {
  let stand: unknown = beleg;
  for (const teil of pfad.split(".")) {
    if (stand === null || typeof stand !== "object" || Array.isArray(stand)) {
      return undefined;
    }
    stand = (stand as Record<string, unknown>)[teil];
  }
  return stand;
}

function text(wert: unknown): string | null {
  return typeof wert === "string" && wert.trim().length > 0 ? wert.trim() : null;
}

function ganzzahl(wert: unknown): number | null {
  return typeof wert === "number" && Number.isInteger(wert) && wert >= 1 ? wert : null;
}

function geheimnisseSuchen(wert: unknown, pfad: string, befunde: BelegBefund[]): void {
  if (typeof wert === "string") {
    if (GEHEIME_WERTE.some((muster) => muster.test(wert))) {
      befunde.push({
        feld: pfad,
        lage: "ungueltig",
        text: "sieht nach Anmeldedaten aus (Token/Sitzung) — gehört nicht in den Beleg",
      });
    }
    return;
  }
  if (Array.isArray(wert)) {
    for (let i = 0; i < wert.length; i += 1) {
      geheimnisseSuchen(wert[i], `${pfad}[${i}]`, befunde);
    }
    return;
  }
  if (wert !== null && typeof wert === "object") {
    for (const [schluessel, inhalt] of Object.entries(wert)) {
      const unter = pfad ? `${pfad}.${schluessel}` : schluessel;
      if (GEHEIME_SCHLUESSEL.test(schluessel)) {
        befunde.push({
          feld: unter,
          lage: "ungueltig",
          text: "Anmeldedaten, Sitzungen und Schlüssel gehören nicht in den Beleg",
        });
        continue;
      }
      geheimnisseSuchen(inhalt, unter, befunde);
    }
  }
}

function pruefeHost(beleg: unknown, befunde: BelegBefund[]): void {
  const anwendung = text(feld(beleg, "host.anwendung"));
  if (anwendung === null) {
    befunde.push({ feld: "host.anwendung", lage: "fehlt", text: "Word-Host nicht angegeben" });
  } else if (anwendung !== "Word Web") {
    befunde.push({
      feld: "host.anwendung",
      lage: "ungueltig",
      text: `„${anwendung}" — diese Abnahme gilt ausschließlich für Word Web; Word für Mac ist ein getrennter Nachweis`,
    });
  }
  const browser = text(feld(beleg, "host.browser"));
  if (browser === null) {
    befunde.push({ feld: "host.browser", lage: "fehlt", text: "Browser nicht angegeben" });
  } else if (browser !== "Chrome") {
    befunde.push({
      feld: "host.browser",
      lage: "ungueltig",
      text: `„${browser}" — die Abnahme gilt ausschließlich unter Chrome`,
    });
  }
  const version = text(feld(beleg, "host.browserVersion"));
  if (version === null) {
    befunde.push({ feld: "host.browserVersion", lage: "fehlt", text: "Chrome-Version fehlt" });
  } else if (!/^\d+(?:\.\d+){1,3}$/.test(version)) {
    befunde.push({
      feld: "host.browserVersion",
      lage: "ungueltig",
      text: `„${version}" ist keine Chrome-Versionsnummer (z. B. 141.0.7390.66)`,
    });
  }
}

function pruefeTestzeit(beleg: unknown, befunde: BelegBefund[]): void {
  const zeit = text(feld(beleg, "testzeit"));
  if (zeit === null) {
    befunde.push({ feld: "testzeit", lage: "fehlt", text: "Testzeit fehlt" });
  } else if (!ISO_MIT_ZONE.test(zeit) || Number.isNaN(Date.parse(zeit))) {
    befunde.push({
      feld: "testzeit",
      lage: "ungueltig",
      text: `„${zeit}" — Datum und Uhrzeit mit Zeitzone (ISO 8601, z. B. 2026-10-06T10:15:00+02:00)`,
    });
  }
}

function pruefeDokument(beleg: unknown, befunde: BelegBefund[]): void {
  const adresse = text(feld(beleg, "dokumentUrl"));
  if (adresse === null) {
    befunde.push({ feld: "dokumentUrl", lage: "fehlt", text: "Adresse des Dokuments fehlt" });
    return;
  }
  let url: URL;
  try {
    url = new URL(adresse);
  } catch {
    befunde.push({ feld: "dokumentUrl", lage: "ungueltig", text: "keine lesbare Adresse" });
    return;
  }
  if (
    url.protocol !== "https:" ||
    url.port !== "" ||
    url.username !== "" ||
    url.password !== "" ||
    !ZULAESSIGE_DOKUMENT_HOSTS.includes(url.hostname)
  ) {
    befunde.push({
      feld: "dokumentUrl",
      lage: "ungueltig",
      text: `Das Dokument muss aus SharePoint/OneDrive des Testmandanten stammen (https://${ZULAESSIGE_DOKUMENT_HOSTS.join(" oder https://")})`,
    });
  }
  for (const name of url.searchParams.keys()) {
    if (GEHEIME_URL_PARAMETER.includes(name.toLowerCase())) {
      befunde.push({
        feld: "dokumentUrl",
        lage: "ungueltig",
        text: `Parameter „${name}" gewährt Zugriff — die Adresse ohne Freigabe-/Anmeldeschlüssel eintragen`,
      });
    }
  }
}

function pruefeBereitstellung(beleg: unknown, befunde: BelegBefund[]): void {
  const version = text(feld(beleg, "bereitstellung.healthVersion"));
  if (version === null || version === "unbekannt") {
    befunde.push({
      feld: "bereitstellung.healthVersion",
      lage: "fehlt",
      text: "/health.version derselben Bereitstellung fehlt",
    });
  }
  const liefercommit = text(feld(beleg, "bereitstellung.liefercommit"));
  if (liefercommit === null) {
    befunde.push({
      feld: "bereitstellung.liefercommit",
      lage: "fehlt",
      text: "vollständiger Liefercommit (40 Zeichen) fehlt",
    });
  } else if (!/^[0-9a-f]{40}$/.test(liefercommit)) {
    befunde.push({
      feld: "bereitstellung.liefercommit",
      lage: "ungueltig",
      text: "der Liefercommit muss vollständig sein (40 Hexzeichen, klein)",
    });
  }
  const commit = text(feld(beleg, "bereitstellung.healthCommit"));
  if (commit === null || commit === "unbekannt") {
    befunde.push({
      feld: "bereitstellung.healthCommit",
      lage: "offen",
      text: "Herkunft offen: /health.commit fehlt oder ist „unbekannt“ — keine belegte Abnahme dieser Fassung",
    });
  } else if (!/^[0-9a-f]{7,40}$/.test(commit)) {
    befunde.push({
      feld: "bereitstellung.healthCommit",
      lage: "ungueltig",
      text: `„${commit}" ist keine Commitkennung`,
    });
  } else if (liefercommit !== null && !liefercommit.startsWith(commit)) {
    befunde.push({
      feld: "bereitstellung.healthCommit",
      lage: "ungueltig",
      text: "/health.commit ist nicht der Liefercommit — der Test lief gegen eine andere Fassung",
    });
  }
}

function pruefeKonto(beleg: unknown, befunde: BelegBefund[]): void {
  const rolle = text(feld(beleg, "konto.rolle"));
  if (rolle === null) {
    befunde.push({ feld: "konto.rolle", lage: "fehlt", text: "Klarwerk-Rolle fehlt" });
  } else if (rolle !== "admin") {
    befunde.push({
      feld: "konto.rolle",
      lage: "ungueltig",
      text: `„${rolle}" — diese Abnahme gilt ausschließlich mit der Rolle admin (Direktfreigabe)`,
    });
  }
}

function pruefeRueckgabe(beleg: unknown, befunde: BelegBefund[]): void {
  const objekt = text(feld(beleg, "rueckgabe.objektId"));
  if (objekt === null) {
    befunde.push({ feld: "rueckgabe.objektId", lage: "fehlt", text: "Objektkennung fehlt" });
  }
  const nachher = text(feld(beleg, "rueckgabe.objektIdNachRueckgabe"));
  if (nachher === null) {
    befunde.push({
      feld: "rueckgabe.objektIdNachRueckgabe",
      lage: "fehlt",
      text: "Objektkennung nach der Rückgabe fehlt",
    });
  } else if (objekt !== null && nachher !== objekt) {
    befunde.push({
      feld: "rueckgabe.objektIdNachRueckgabe",
      lage: "ungueltig",
      text: "die Rückgabe trägt eine andere Objektkennung — das wäre eine Dublette, nicht dieselbe Anleitung",
    });
  }
  const von = ganzzahl(feld(beleg, "rueckgabe.ausgangsfassung"));
  const zu = ganzzahl(feld(beleg, "rueckgabe.neueFassung"));
  if (von === null) {
    befunde.push({
      feld: "rueckgabe.ausgangsfassung",
      lage: "fehlt",
      text: "Ausgangsfassung fehlt (ganze Zahl ≥ 1)",
    });
  }
  if (zu === null) {
    befunde.push({
      feld: "rueckgabe.neueFassung",
      lage: "fehlt",
      text: "neue Fassung fehlt (ganze Zahl ≥ 1)",
    });
  }
  if (von !== null && zu !== null && zu <= von) {
    befunde.push({
      feld: "rueckgabe.neueFassung",
      lage: "ungueltig",
      text: `Fassung ${zu} ist nicht neuer als die Ausgangsfassung ${von}`,
    });
  }
  const status = text(feld(beleg, "rueckgabe.statusNachRueckgabe"));
  if (status === null) {
    befunde.push({
      feld: "rueckgabe.statusNachRueckgabe",
      lage: "fehlt",
      text: "Status des Objekts nach der Rückgabe fehlt",
    });
  } else if (status !== STATUS_FREIGEGEBEN) {
    befunde.push({
      feld: "rueckgabe.statusNachRueckgabe",
      lage: "ungueltig",
      text: `„${status}" — die Direktfreigabe durch admin hinterlässt „${STATUS_FREIGEGEBEN}"`,
    });
  }
  const pflichtJa: Array<[string, string]> = [
    ["rueckgabe.bisherigeFassungAbrufbar", "die bisherige Fassung ist weiter abrufbar"],
    ["rueckgabe.neueFassungWiederGeoeffnet", "die neue Fassung wurde wieder geöffnet"],
  ];
  for (const [pfad, aussage] of pflichtJa) {
    const wert = feld(beleg, pfad);
    if (typeof wert !== "boolean") {
      befunde.push({ feld: pfad, lage: "fehlt", text: `nicht festgehalten, ob ${aussage}` });
    } else if (!wert) {
      befunde.push({ feld: pfad, lage: "ungueltig", text: `nicht erfüllt: ${aussage}` });
    }
  }
  const neu = feld(beleg, "rueckgabe.neueObjekteDurchRueckgabe");
  if (typeof neu !== "number" || !Number.isInteger(neu) || neu < 0) {
    befunde.push({
      feld: "rueckgabe.neueObjekteDurchRueckgabe",
      lage: "fehlt",
      text: "nicht gezählt, wie viele neue Objekte die Rückgabe angelegt hat",
    });
  } else if (neu !== 0) {
    befunde.push({
      feld: "rueckgabe.neueObjekteDurchRueckgabe",
      lage: "ungueltig",
      text: `${neu} neue Objekte — die Rückgabe darf keine unverbundene Dublette anlegen`,
    });
  }
}

function pruefeNachweise(beleg: unknown, befunde: BelegBefund[]): void {
  const liste = feld(beleg, "nachweise");
  const dateien = Array.isArray(liste) ? liste.map(text) : [];
  if (dateien.length === 0) {
    befunde.push({
      feld: "nachweise",
      lage: "fehlt",
      text: "keine Bildschirmfotos/Konsolenauszüge genannt — ohne sie ist nichts zu sehen",
    });
    return;
  }
  for (let i = 0; i < dateien.length; i += 1) {
    const datei = dateien[i];
    if (datei === null || datei === undefined || datei.includes("://") || datei.includes("..")) {
      befunde.push({
        feld: `nachweise[${i}]`,
        lage: "ungueltig",
        text: "Dateiname der abgelegten Aufnahme erwartet (keine Adresse, kein Pfad nach oben)",
      });
    }
  }
}

/** Das Urteil über einen Beleg. Fail-closed: was fehlt, ist ein Befund, nie ein stilles Ja. */
export function pruefeWordHostBeleg(beleg: unknown): BelegUrteil {
  const befunde: BelegBefund[] = [];
  if (beleg === null || typeof beleg !== "object" || Array.isArray(beleg)) {
    befunde.push({ feld: "", lage: "fehlt", text: "kein Belegobjekt" });
  } else {
    pruefeHost(beleg, befunde);
    pruefeTestzeit(beleg, befunde);
    pruefeDokument(beleg, befunde);
    pruefeBereitstellung(beleg, befunde);
    pruefeKonto(beleg, befunde);
    pruefeRueckgabe(beleg, befunde);
    pruefeNachweise(beleg, befunde);
    geheimnisseSuchen(beleg, "", befunde);
  }
  return {
    vollstaendig: befunde.length === 0,
    befunde,
    giltFuer: GILT_FUER,
    nichtAbgedeckt: NICHT_ABGEDECKT,
  };
}

// Direktaufruf — beim Import aus dem Test passiert hier nichts.
if (process.argv[1]?.endsWith("word-host-beleg.ts")) {
  const datei = process.argv[2];
  if (!datei) {
    console.error("Aufruf: node tools/word-host-beleg.ts <beleg.json>");
    process.exit(2);
  }
  const urteil = pruefeWordHostBeleg(JSON.parse(readFileSync(datei, "utf8")));
  console.log(`Gilt für: ${urteil.giltFuer}`);
  console.log(`Nicht abgedeckt: ${urteil.nichtAbgedeckt.join("; ")}`);
  if (!urteil.vollstaendig) {
    console.error(`✖ Beleg unvollständig (${urteil.befunde.length} Befund(e)):`);
    for (const b of urteil.befunde) {
      console.error(`   [${b.lage}] ${b.feld || "(Beleg)"}: ${b.text}`);
    }
    process.exit(1);
  }
  console.log("✓ Beleg vollständig und geheimnisfrei — die Bildschirmfotos prüft die Abnahme.");
}
