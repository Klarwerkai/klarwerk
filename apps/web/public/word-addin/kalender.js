// ================================================================================================
// KLARA · MEIN KALENDER IN WORD — DER BLOCK KW-KALENDER, ALS EIGENE DATEI (AW-16).
// ================================================================================================
//
// produkt:20261010:klara-eigener-kalender: „Klaras Kalender in Klarwerk und dieselbe berechtigte
// Sicht in der Office-Begleitung." Dieser Block zeigt im Word-Seitenfenster DIESELBE Sicht wie die
// Seite `/kalender`: dieselbe Route (`GET /api/me/kalender`), dieselbe Sitzung des Fensters,
// dieselben Einträge mit derselben Kennung (`event_id`), dieselben heutigen Rechte — der Server
// entscheidet, was diese Person sieht, das Fenster rechnet nichts davon selbst aus.
//
// NUR LESEN: Anlegen, Ändern und die Aktionen bleiben auf der Seite in Klarwerk (Verweis „In Klarwerk
// öffnen"). Das Fenster löst nichts aus.
//
// BAUFORM wie `begriffe.js`: klassisches ES5-Skript ohne Transpilation, direkt im KOPF von
// `taskpane.html`. Biome prüft diese Datei mit einem genau auf sie begrenzten ES5-Override:
// var und Stringverkettung bleiben ES5; function sowie dynamisches this/arguments erhalten die
// beiden Wrapper. Die führende use-strict-Direktive gehört zum klassischen Skript. Deshalb sind
// nur noVar, useTemplate, useArrowFunction, noArguments und noRedundantUseStrict hier ausgeschaltet.
// Es schliesst sich erst bei `DOMContentLoaded` an und nutzt die
// Globalen des Fensters (`lang`, `signedIn`, `officeUsable`, `bestandRuheSichtbar`,
// `bestandSitzung`, `bestandZeichnen`, `setLang`, `checkSession`). Fehlen sie, bleibt der Block
// verborgen. Der Block ist zugeklappt; abgerufen wird erst, wenn die Person ihn öffnet.
//
// DATENFLUSS: genau ein Abruf, `GET /api/me/kalender?bereich=…` derselben Klarwerk-Instanz (gleicher
// Ursprung). Aus dem Word-Dokument wird nichts gelesen und nichts geschrieben.
"use strict";

var KALENDER_TEXTE = {
  de: {
    kopf: "Mein Kalender",
    persoenlich: "Persönlich",
    team: "Team",
    zone: "Lokale Zeitzone: {zone}",
    laedt: "Wird geladen …",
    fehler: "Der Kalender ist gerade nicht erreichbar.",
    anmeldung: "Bitte erneut anmelden.",
    leer: "Keine Einträge in den nächsten 14 Tagen.",
    ganztaegig: "ganztägig",
    geschuetzt: "Geschützter Eintrag",
    unzugeordnet: "unzugeordnet",
    art_termin: "Termin",
    art_frist: "Frist",
    art_aufgabe: "Aufgabe",
    status_offen: "offen",
    status_erledigt: "erledigt",
    status_abgesagt: "abgesagt",
    herkunft_eigen: "selbst angelegt",
    herkunft_wissensobjekt: "aus einem Wissensobjekt",
    herkunft_information: "Aus Information erkannt",
    fristart_ablauf: "Ablauf",
    fristart_kuendigungsfenster: "Kündigungsfenster",
    fristart_vertragsende: "Vertragsende",
    fristart_automatische_verlaengerung: "Automatische Verlängerung",
    fristart_erneuerung: "Erneuerung",
    fristart_pruefung: "Prüftermin",
    fristart_normankuendigung: "Normankündigung",
    fristart_wartung: "Wartungstermin",
    fristart_anleitungspflege: "Anleitungspflege",
    fristart_einarbeitung: "Einarbeitung",
    fristart_expertenuebergabe: "Expertenübergabe",
    friststand_manuell: "Manuell festgelegt",
    friststand_erkannt: "Eindeutig erkannt",
    friststand_klaerung: "Klärung nötig · Termin nicht verlässlich",
    friststand_verworfen: "Verworfen",
    friststand_nicht_verlaesslich: "Quelle zurückgezogen · Termin nicht verlässlich",
    friststand_historisch: "Vergangene Frist",
    friststand_erledigt: "Als erledigt gekennzeichnet",

    herkunft_vorhanden: "aus dem vorhandenen Kalender",
    eintrag: "Kalendereintrag",
    kennung: "Kennung (event_id): {id}",
    auftrag: "Auszuführender Auftrag",
    auftragKennung: "Auftrag (task_id): {id}",
    auftragNichtAufgeloest: "im Ausführungsnachweis nicht auffindbar",
    keinAuftrag: "Kein Auftrag. Dieser Termin löst nichts aus.",
    ergebnis: "Tatsächliches Ergebnis",
    lauf: "Lauf (run_id) {id}: {status}",
    keinLauf: "Kein Lauf: hier ist nichts ausgeführt worden.",
    nichtNachgewiesen: "Stand nicht nachgewiesen",
    erinnerung:
      "Erinnerung zugestellt. Eine Verlängerung oder Erledigung der Frist ist damit nicht belegt.",
    berichtGespeichert: "Bericht gespeichert; vorhandene Ergebnisse bleiben erhalten.",
    laufAbgeschlossen: "Lauf abgeschlossen.",
    laufFehlgeschlagen: "Lauf fehlgeschlagen.",
    lauf_geplant: "geplant",
    lauf_laeuft: "läuft",
    lauf_abgeschlossen: "abgeschlossen",
    lauf_fehlgeschlagen: "fehlgeschlagen",
    lauf_abgesagt: "abgesagt",
    lauf_abgebrochen: "abgebrochen",
    oeffnen: "In Klarwerk öffnen",
    schliessen: "Schließen",
  },
  en: {
    kopf: "My calendar",
    persoenlich: "Personal",
    team: "Team",
    zone: "Local time zone: {zone}",
    laedt: "Loading …",
    fehler: "The calendar cannot be reached right now.",
    anmeldung: "Please sign in again.",
    leer: "No entries in the next 14 days.",
    ganztaegig: "all day",
    geschuetzt: "Protected entry",
    unzugeordnet: "unassigned",
    art_termin: "Appointment",
    art_frist: "Deadline",
    art_aufgabe: "Task",
    status_offen: "open",
    status_erledigt: "done",
    status_abgesagt: "cancelled",
    herkunft_eigen: "created yourself",
    herkunft_wissensobjekt: "from a knowledge object",
    herkunft_information: "Detected from information",
    fristart_ablauf: "Expiry",
    fristart_kuendigungsfenster: "Cancellation window",
    fristart_vertragsende: "Contract end",
    fristart_automatische_verlaengerung: "Automatic renewal",
    fristart_erneuerung: "Renewal",
    fristart_pruefung: "Review date",
    fristart_normankuendigung: "Standard announcement",
    fristart_wartung: "Maintenance date",
    fristart_anleitungspflege: "Instruction review",
    fristart_einarbeitung: "Onboarding",
    fristart_expertenuebergabe: "Expert handover",
    friststand_manuell: "Set manually",
    friststand_erkannt: "Clearly detected",
    friststand_klaerung: "Clarification needed · unreliable date",
    friststand_verworfen: "Discarded",
    friststand_nicht_verlaesslich: "Source withdrawn · unreliable date",
    friststand_historisch: "Past deadline",
    friststand_erledigt: "Marked completed",

    herkunft_vorhanden: "from the existing calendar",
    eintrag: "Calendar entry",
    kennung: "Identifier (event_id): {id}",
    auftrag: "Task to be carried out",
    auftragKennung: "Task (task_id): {id}",
    auftragNichtAufgeloest: "not found in the execution record",
    keinAuftrag: "No task. This appointment triggers nothing.",
    ergebnis: "Actual result",
    lauf: "Run (run_id) {id}: {status}",
    keinLauf: "No run: nothing has been carried out here.",
    nichtNachgewiesen: "status not proven",
    erinnerung: "Reminder delivered. This does not show that the deadline was renewed or met.",
    berichtGespeichert: "Report saved; existing results are retained.",
    laufAbgeschlossen: "Run completed.",
    laufFehlgeschlagen: "Run failed.",
    lauf_geplant: "planned",
    lauf_laeuft: "running",
    lauf_abgeschlossen: "completed",
    lauf_fehlgeschlagen: "failed",
    lauf_abgesagt: "cancelled",
    lauf_abgebrochen: "aborted",
    oeffnen: "Open in Klarwerk",
    schliessen: "Close",
  },
  nl: {
    kopf: "Mijn agenda",
    persoenlich: "Persoonlijk",
    team: "Team",
    zone: "Lokale tijdzone: {zone}",
    laedt: "Wordt geladen …",
    fehler: "De agenda is nu niet bereikbaar.",
    anmeldung: "Meld je opnieuw aan.",
    leer: "Geen items in de komende 14 dagen.",
    ganztaegig: "hele dag",
    geschuetzt: "Beschermd item",
    unzugeordnet: "niet toegewezen",
    art_termin: "Afspraak",
    art_frist: "Termijn",
    art_aufgabe: "Taak",
    status_offen: "open",
    status_erledigt: "afgerond",
    status_abgesagt: "geannuleerd",
    herkunft_eigen: "zelf aangemaakt",
    herkunft_wissensobjekt: "uit een kennisobject",
    herkunft_information: "Uit informatie herkend",
    fristart_ablauf: "Vervaldatum",
    fristart_kuendigungsfenster: "Opzegtermijn",
    fristart_vertragsende: "Contracteinde",
    fristart_automatische_verlaengerung: "Automatische verlenging",
    fristart_erneuerung: "Hernieuwing",
    fristart_pruefung: "Controledatum",
    fristart_normankuendigung: "Normaankondiging",
    fristart_wartung: "Onderhoudsdatum",
    fristart_anleitungspflege: "Onderhoud van instructies",
    fristart_einarbeitung: "Inwerken",
    fristart_expertenuebergabe: "Overdracht door deskundige",
    friststand_manuell: "Handmatig vastgesteld",
    friststand_erkannt: "Duidelijk herkend",
    friststand_klaerung: "Verduidelijking nodig · onbetrouwbare datum",
    friststand_verworfen: "Verworpen",
    friststand_nicht_verlaesslich: "Bron ingetrokken · onbetrouwbare datum",
    friststand_historisch: "Verstreken termijn",
    friststand_erledigt: "Gemarkeerd als afgerond",

    herkunft_vorhanden: "uit de bestaande agenda",
    eintrag: "Agenda-item",
    kennung: "Kenmerk (event_id): {id}",
    auftrag: "Uit te voeren opdracht",
    auftragKennung: "Opdracht (task_id): {id}",
    auftragNichtAufgeloest: "niet gevonden in het uitvoeringsbewijs",
    keinAuftrag: "Geen opdracht. Deze afspraak start niets.",
    ergebnis: "Werkelijk resultaat",
    lauf: "Run (run_id) {id}: {status}",
    keinLauf: "Geen run: hier is niets uitgevoerd.",
    nichtNachgewiesen: "stand niet aangetoond",
    erinnerung:
      "Herinnering bezorgd. Een verlenging of afronding van de termijn is daarmee niet aangetoond.",
    berichtGespeichert: "Rapport opgeslagen; bestaande resultaten blijven behouden.",
    laufAbgeschlossen: "Run afgerond.",
    laufFehlgeschlagen: "Run mislukt.",
    lauf_geplant: "gepland",
    lauf_laeuft: "loopt",
    lauf_abgeschlossen: "afgerond",
    lauf_fehlgeschlagen: "mislukt",
    lauf_abgesagt: "geannuleerd",
    lauf_abgebrochen: "afgebroken",
    oeffnen: "Openen in Klarwerk",
    schliessen: "Sluiten",
  },
};

// Wie viele Tage ab heute die Liste zeigt.
var KALENDER_TAGE = 14;

var kalenderLage = "zu"; // zu | laden | bereit | fehler
var kalenderGrund = "";
var kalenderBereich = "persoenlich";
var kalenderStand = null; // { sitzung, bereich, ansicht }
var kalenderGewaehlt = null; // event_id der geöffneten Einzelansicht
var kalenderLauf = 0;

function kalenderT(schluessel, werte) {
  var tabelle = KALENDER_TEXTE[typeof lang === "string" && KALENDER_TEXTE[lang] ? lang : "de"];
  var satz = tabelle[schluessel] || KALENDER_TEXTE.de[schluessel] || schluessel;
  if (werte) {
    for (var name in werte) {
      if (Object.prototype.hasOwnProperty.call(werte, name)) {
        satz = satz.split("{" + name + "}").join(String(werte[name]));
      }
    }
  }
  return satz;
}

function kalenderSprache() {
  return typeof lang === "string" && KALENDER_TEXTE[lang] ? lang : "de";
}

function kalenderSitzung() {
  return typeof bestandSitzung === "undefined" ? null : bestandSitzung;
}

/** Dieselbe Sichtbarkeit wie die anderen Blöcke der Ruhe: angemeldet, in Word, in der Ruhe. */
function kalenderSichtbar() {
  var angemeldet = typeof signedIn !== "undefined" && Boolean(signedIn);
  var ruhe = typeof bestandRuheSichtbar === "function" ? bestandRuheSichtbar() : false;
  var office = typeof officeUsable === "function" && Boolean(officeUsable());
  return angemeldet && ruhe && office;
}

function kalenderKnoten(tag, klasse, text) {
  var el = document.createElement(tag);
  if (klasse) {
    el.className = klasse;
  }
  if (text !== undefined) {
    el.textContent = text;
  }
  return el;
}

// --- Zeit: dieselben Regeln wie `apps/web/src/lib/kalenderZeit.ts` ------------------------
// Eine ganztägige Frist ist ein Datum und wird nie verschoben; ein Termin mit Uhrzeit steht in
// der lokalen Zeitzone dieses Fensters.

function kalenderZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch (e) {
    return "UTC";
  }
}

function kalenderTagVon(datum, zone) {
  var teile = new Intl.DateTimeFormat("en-CA", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(datum);
  var wert = function (typ) {
    var i;
    for (i = 0; i < teile.length; i += 1) {
      if (teile[i].type === typ) {
        return teile[i].value;
      }
    }
    return "";
  };
  return wert("year") + "-" + wert("month") + "-" + wert("day");
}

function kalenderVerschiebe(tag, tage) {
  var t = tag.split("-");
  var d = new Date(Date.UTC(Number(t[0]), Number(t[1]) - 1, Number(t[2])));
  d.setUTCDate(d.getUTCDate() + tage);
  return d.toISOString().slice(0, 10);
}

/** Der erste Kalendertag, an dem ein Eintrag in `zone` steht, und sein letzter. */
function kalenderSpanne(e, zone) {
  var erster = e.ganztaegig ? e.beginn : kalenderTagVon(new Date(e.beginn), zone);
  var letzter = e.ende ? (e.ganztaegig ? e.ende : kalenderTagVon(new Date(e.ende), zone)) : erster;
  return { erster: erster, letzter: letzter };
}

function kalenderUhrzeit(iso, zone) {
  return new Intl.DateTimeFormat(kalenderSprache(), {
    timeZone: zone,
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

function kalenderTagLesbar(tag) {
  var t = tag.split("-");
  return new Intl.DateTimeFormat(kalenderSprache(), {
    timeZone: "UTC",
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
  }).format(new Date(Date.UTC(Number(t[0]), Number(t[1]) - 1, Number(t[2]))));
}

// --- Abruf --------------------------------------------------------------------------------

function kalenderLaden() {
  if (!kalenderSichtbar()) {
    return;
  }
  kalenderLauf += 1;
  var lauf = kalenderLauf;
  var sitzung = kalenderSitzung();
  var bereich = kalenderBereich;
  kalenderLage = "laden";
  kalenderGrund = "";
  kalenderZeichnen();
  var fehler = function (grund) {
    if (lauf !== kalenderLauf) {
      return;
    }
    kalenderLage = "fehler";
    kalenderGrund = grund;
    kalenderStand = null;
    kalenderZeichnen();
  };
  fetch("/api/me/kalender?bereich=" + encodeURIComponent(bereich), { credentials: "include" })
    .then(
      function (res) {
        var status;
        if (lauf !== kalenderLauf) {
          return null;
        }
        if (!res || !res.ok) {
          status = res && typeof res.status === "number" ? res.status : 0;
          fehler(status === 401 ? "anmeldung" : "fehler");
          if (status === 401 && typeof checkSession === "function") {
            checkSession();
          }
          return null;
        }
        return res.json().then(function (ansicht) {
          if (lauf !== kalenderLauf) {
            return;
          }
          if (!ansicht || !Array.isArray(ansicht.eintraege)) {
            fehler("fehler");
            return;
          }
          kalenderStand = { sitzung: sitzung, bereich: bereich, ansicht: ansicht };
          kalenderLage = "bereit";
          kalenderZeichnen();
        });
      },
      function () {
        fehler("fehler");
      }
    )
    .catch(function () {
      fehler("fehler");
    });
}

// --- Zeichnen -----------------------------------------------------------------------------

/** Die Einträge der nächsten Tage — mit derselben Sichtwahl wie die Seite in Klarwerk. */
function kalenderZeilen(ansicht) {
  var i;
  var e;
  var s;
  var j;
  var x;
  var sx;
  var zone = kalenderZone();
  var heute = kalenderTagVon(new Date(), zone);
  var bis = kalenderVerschiebe(heute, KALENDER_TAGE - 1);
  var modus = ansicht.sichtmodus;
  var zeilen = [];
  for (i = 0; i < ansicht.eintraege.length; i += 1) {
    e = ansicht.eintraege[i];
    // Im Modus „vorhanden" bleiben interne Fristen und zeitgesteuerte Einträge sichtbar.
    if (modus === "vorhanden" && !(e.art === "frist" || e.lauf || e.serie)) {
      continue;
    }
    s = kalenderSpanne(e, zone);
    if (s.letzter < heute || s.erster > bis) {
      continue;
    }
    zeilen.push({ tag: s.erster < heute ? heute : s.erster, eintrag: e, extern: null });
  }
  var termine =
    modus !== "eigen" && ansicht.vorhandenerKalender && ansicht.vorhandenerKalender.termine
      ? ansicht.vorhandenerKalender.termine
      : [];
  for (j = 0; j < termine.length; j += 1) {
    x = termine[j];
    sx = kalenderSpanne(x, zone);
    if (sx.letzter < heute || sx.erster > bis) {
      continue;
    }
    zeilen.push({ tag: sx.erster < heute ? heute : sx.erster, eintrag: null, extern: x });
  }
  zeilen.sort(function (a, b) {
    var pa = a.eintrag || a.extern;
    var pb = b.eintrag || b.extern;
    if (a.tag !== b.tag) {
      return a.tag < b.tag ? -1 : 1;
    }
    if (pa.ganztaegig !== pb.ganztaegig) {
      return pa.ganztaegig ? -1 : 1;
    }
    return pa.beginn < pb.beginn ? -1 : pa.beginn > pb.beginn ? 1 : 0;
  });
  return zeilen;
}

function kalenderZeitText(p, zone) {
  return p.ganztaegig ? kalenderT("ganztaegig") : kalenderUhrzeit(p.beginn, zone);
}

function kalenderZeile(z) {
  var zone = kalenderZone();
  var li = kalenderKnoten("li", "kalender-zeile");
  li.style.margin = "4px 0";
  if (z.extern) {
    li.setAttribute("data-extern-id", z.extern.id);
    li.appendChild(
      kalenderKnoten(
        "div",
        "",
        kalenderTagLesbar(z.tag) + " · " + kalenderZeitText(z.extern, zone) + " · " + z.extern.titel
      )
    );
    li.appendChild(kalenderKnoten("div", "muted", kalenderT("herkunft_vorhanden")));
    return li;
  }
  var e = z.eintrag;
  var knopf = kalenderKnoten("button", "ghost kalender-eintrag");
  knopf.type = "button";
  knopf.setAttribute("data-event-id", e.id);
  knopf.setAttribute("aria-pressed", kalenderGewaehlt === e.id ? "true" : "false");
  knopf.style.display = "block";
  knopf.style.width = "100%";
  knopf.style.textAlign = "left";
  knopf.appendChild(
    kalenderKnoten(
      "span",
      "",
      kalenderTagLesbar(z.tag) +
        " · " +
        kalenderZeitText(e, zone) +
        " · " +
        (e.geschuetzt ? kalenderT("geschuetzt") : e.titel)
    )
  );
  var meta = [
    kalenderT("art_" + e.art),
    kalenderT("status_" + e.status),
    kalenderT("herkunft_" + e.herkunft.art),
  ];
  if (e.erkennung && !e.geschuetzt) {
    meta.push(
      kalenderT("fristart_".concat(e.erkennung.art)),
      kalenderT(
        e.erkennung.manuell && e.erkennung.stand === "erkannt"
          ? "friststand_manuell"
          : "friststand_".concat(e.erkennung.stand)
      )
    );
  }
  if (!e.zugeordnet) {
    meta.push(kalenderT("unzugeordnet"));
  }
  var metaZeile = kalenderKnoten("span", "muted", meta.join(" · "));
  metaZeile.style.display = "block";
  knopf.appendChild(metaZeile);
  // Der Klick läuft über die EINE Bindung an `#kalender-inhalt` (kalenderKlick).
  li.appendChild(knopf);
  return li;
}

/** Eintrag, Auftrag und Ergebnis — drei getrennt beschriftete Abschnitte wie in Klarwerk. */
function kalenderDetail(e) {
  var art;
  var zeile;
  var kasten = kalenderKnoten("div", "kalender-detail");
  kasten.setAttribute("data-event-id", e.id);
  kasten.style.margin = "6px 0";
  kasten.appendChild(kalenderKnoten("strong", "", kalenderT("eintrag")));
  kasten.appendChild(
    kalenderKnoten("div", "kalender-detail-id", kalenderT("kennung", { id: e.id }))
  );
  kasten.appendChild(kalenderKnoten("strong", "", kalenderT("auftrag")));
  var auftrag;
  if (!e.auftrag) {
    auftrag = kalenderT("keinAuftrag");
  } else {
    auftrag =
      kalenderT("auftragKennung", { id: e.auftrag.taskId }) +
      (e.auftrag.titel ? " · " + e.auftrag.titel : "") +
      (e.auftrag.aufgeloest ? "" : " · " + kalenderT("auftragNichtAufgeloest"));
  }
  kasten.appendChild(kalenderKnoten("div", "kalender-detail-auftrag muted", auftrag));
  kasten.appendChild(kalenderKnoten("strong", "", kalenderT("ergebnis")));
  var ergebnis;
  if (!e.lauf) {
    ergebnis = kalenderT("keinLauf");
  } else {
    ergebnis = kalenderT("lauf", {
      id: e.lauf.runId,
      status: e.lauf.status ? kalenderT("lauf_" + e.lauf.status) : kalenderT("nichtNachgewiesen"),
    });
  }
  kasten.appendChild(kalenderKnoten("div", "kalender-detail-lauf muted", ergebnis));
  if (e.ergebnis) {
    art =
      e.ergebnis.art === "erinnerung_zugestellt"
        ? "erinnerung"
        : e.ergebnis.art === "bericht_gespeichert"
          ? "berichtGespeichert"
          : e.ergebnis.art === "lauf_abgeschlossen"
            ? "laufAbgeschlossen"
            : "laufFehlgeschlagen";
    zeile = kalenderKnoten("div", "kalender-detail-ergebnis", kalenderT(art));
    zeile.setAttribute("data-ergebnis", e.ergebnis.art);
    kasten.appendChild(zeile);
  }
  var link = kalenderKnoten("a", "", kalenderT("oeffnen"));
  link.href = "/kalender";
  link.target = "_blank";
  link.rel = "noopener";
  kasten.appendChild(link);
  return kasten;
}

function kalenderZeichnen() {
  var b;
  var k;
  var i;
  var block = document.getElementById("kalender-block");
  var kopf = document.getElementById("kalender-kopf");
  var inhalt = document.getElementById("kalender-inhalt");
  if (!block || !kopf || !inhalt) {
    return;
  }
  // Was eine andere oder keine Sitzung geladen hat, sieht diese nie.
  if (kalenderStand && kalenderStand.sitzung !== kalenderSitzung()) {
    kalenderStand = null;
    kalenderGewaehlt = null;
    kalenderLage = "zu";
  }
  var sichtbar = kalenderSichtbar();
  block.className = sichtbar ? "" : "hidden";
  kopf.textContent = kalenderT("kopf");
  while (inhalt.firstChild) {
    inhalt.removeChild(inhalt.firstChild);
  }
  // Zugeklappt trägt der Block nur seine Überschrift — gezeichnet wird erst beim Aufklappen.
  if (!sichtbar || !block.open) {
    return;
  }

  var wahl = kalenderKnoten("div", "kalender-bereich");
  var bereiche = ["persoenlich", "team"];
  for (b = 0; b < bereiche.length; b += 1) {
    k = kalenderKnoten("button", "ghost", kalenderT(bereiche[b]));
    k.type = "button";
    k.setAttribute("data-bereich", bereiche[b]);
    k.setAttribute("aria-pressed", kalenderBereich === bereiche[b] ? "true" : "false");
    wahl.appendChild(k);
  }
  inhalt.appendChild(wahl);
  inhalt.appendChild(
    kalenderKnoten("p", "muted kalender-zone", kalenderT("zone", { zone: kalenderZone() }))
  );

  var stand = kalenderKnoten("p", "muted kalender-stand");
  stand.setAttribute("aria-live", "polite");
  inhalt.appendChild(stand);
  if (kalenderLage === "laden") {
    stand.textContent = kalenderT("laedt");
    return;
  }
  if (kalenderLage === "fehler") {
    stand.textContent = kalenderT(kalenderGrund || "fehler");
    return;
  }
  if (!kalenderStand) {
    return;
  }

  var zeilen = kalenderZeilen(kalenderStand.ansicht);
  if (zeilen.length === 0) {
    stand.textContent = kalenderT("leer");
  }
  var liste = kalenderKnoten("ul", "kalender-liste");
  liste.style.listStyle = "none";
  liste.style.padding = "0";
  var gewaehlt = null;
  for (i = 0; i < zeilen.length; i += 1) {
    liste.appendChild(kalenderZeile(zeilen[i]));
    if (zeilen[i].eintrag && zeilen[i].eintrag.id === kalenderGewaehlt) {
      gewaehlt = zeilen[i].eintrag;
    }
  }
  inhalt.appendChild(liste);
  if (gewaehlt) {
    inhalt.appendChild(kalenderDetail(gewaehlt));
  }
}

/**
 * Die EINE Klickbindung des Blocks (Ereignisdelegation): Bereichswahl und Einträge zeichnen sich
 * bei jedem Neuzeichnen neu, eine Bindung je Knopf hinge sonst an der Zahl der Zeichenläufe.
 * Ohne `Element.closest` — das Fenster läuft auch in älteren Office-Hosts (ES5).
 */
function kalenderKlick(ereignis) {
  var bereich;
  var id;
  var inhalt = document.getElementById("kalender-inhalt");
  var el = ereignis.target;
  while (el && el !== inhalt && el.nodeType === 1) {
    bereich = el.getAttribute("data-bereich");
    if (bereich) {
      if (kalenderBereich !== bereich) {
        kalenderBereich = bereich;
        kalenderGewaehlt = null;
        kalenderLaden();
      }
      return;
    }
    if (/(^| )kalender-eintrag( |$)/.test(el.className || "")) {
      id = el.getAttribute("data-event-id");
      kalenderGewaehlt = kalenderGewaehlt === id ? null : id;
      kalenderZeichnen();
      return;
    }
    el = el.parentNode;
  }
}

var kalenderWarOffen = false;

function kalenderAnschliessen() {
  var kalenderBestandZeichnen;
  var kalenderSetLang;
  var block = document.getElementById("kalender-block");
  var inhalt = document.getElementById("kalender-inhalt");
  if (!block || !inhalt) {
    return;
  }
  inhalt.addEventListener("click", kalenderKlick);
  // Abgerufen wird erst, wenn die Person den Block aufklappt — und genau einmal je Aufklappen,
  // auch wenn ein Host `toggle` doppelt meldet.
  // AW16-K07 (Ben nacharbeit-6): JEDES Aufklappen fragt den Server neu — mit den HEUTIGEN Rechten.
  // Ein früher geladener Stand wird beim Zuklappen verworfen und nie wieder ausgegeben; nach einem
  // Teamaustritt oder Quellrechteentzug zeigt das Fenster bis zur neuen Antwort nur „Wird geladen".
  block.addEventListener("toggle", function () {
    if (block.open === kalenderWarOffen) {
      return;
    }
    kalenderWarOffen = block.open;
    kalenderStand = null;
    kalenderGewaehlt = null;
    if (block.open) {
      kalenderLaden();
    } else {
      kalenderLauf += 1; // eine noch laufende Antwort gilt nicht mehr
      kalenderLage = "zu";
      kalenderZeichnen();
    }
  });
  if (typeof bestandZeichnen === "function") {
    kalenderBestandZeichnen = bestandZeichnen;
    bestandZeichnen = function () {
      kalenderBestandZeichnen.apply(this, arguments);
      kalenderZeichnen();
    };
  }
  if (typeof setLang === "function") {
    kalenderSetLang = setLang;
    setLang = function () {
      kalenderSetLang.apply(this, arguments);
      kalenderZeichnen();
    };
  }
  kalenderZeichnen();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", kalenderAnschliessen);
} else {
  kalenderAnschliessen();
}
