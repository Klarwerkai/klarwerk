// ================================================================================================
// R-0908 / R-0988 · FACHWÖRTER IN DER OBERFLÄCHE — ÜBERSETZT ODER IM ERSTEN AUFTRETEN ERKLÄRT.
// ================================================================================================
//
// R-0908 nennt die Wörter, die ein Fachmann liebt und eine Erstnutzerin bremst: „Reasoner",
// „Knowledge Object" (auf den Flächen als „KO"/„KOs"), „Output Factory", „Bus-Faktor" … Dieses
// Modul trägt die Ersatztexte für jede sichtbare Stelle, die diese Wörter noch zeigte:
//
//   · Vertraulichkeitshilfe beim Erfassen     (vorher `conf.help`, „Output Factory/Export")
//   · Hilfetext der Demodaten-Karte           (vorher `adm.seedHint`, „KOs", „KI-Reasoner")
//   · Stufe 2: KI-Läufe und KI-Einstellung     (vorher `mrun.title`, `mrun.empty`, `rcfg.title`)
//   · Stufe 2: QM-Hinweise                     (vorher `kos.hintsTitle`, `kos.hint.*` —
//                                               „Reasoner", „ModelRun", „KOs", „Evidence")
//   · Stufe 2: Beleg- und Herkunftsverzeichnis (vorher `evx.*`, `prov.*` — „KO", „Evidence")
//   · Stufe 2: Belegfrische                    (vorher `evFresh.title|subtitle|empty`)
//   · Stufe 2: Ergebnis einer Fundannahme      (vorher `ext.finding.acceptedKo`, „KO erzeugt")
//   · Stufe 2: Startklarheit                   (vorher `readiness.title`, „Knowledge-OS Readiness")
//   · Start: Hilfe zu den vier Kacheln         (vorher `shelp.cycle.title`, „Knowledge-OS-Kreis")
//   · Analytics: Überschrift der Gesundheitskarte (vorher `health.title`, „Knowledge Health")
//   · Risiko und Priorisierung: „Bus-Faktor 1" (vorher `risk.horizon.busFactorOne`,
//                                               `mgmt.prio.filter|flag.busFactorOne`) — das Wort
//                                               bleibt als Suchwort stehen, aber mit Erklärung.
//
// WARUM NEUE SCHLÜSSEL STATT GEÄNDERTER WERTE: die alten Werte stehen im Grundbestand
// (`woerterbuch/`), den Umzugsnachweis und Byte-Abgleich festhalten
// (`tests/i18n-textmodule/bestand-unveraendert.test.ts`,
// `tests/i18n-woerterbuch/aufteilung-unveraendert.test.ts`). Gelesen werden sie von keiner Fläche
// mehr; dass die Fachwörter nicht zurückkehren, hält
// `tests/sprache-begriffe/fachbegriffe-k1.test.ts`.
//
// „Evidence"/„evidence" bleibt im ENGLISCHEN stehen — dort ist es das gewöhnliche Wort.
import type { Textmodul } from "./intern/pruefung";

export default {
  praefix: "fachwort.",
  legacySchluessel: [],
  de: {
    "fachwort.vertraulichkeit.hilfe":
      "Wie vertraulich ist dieses Wissen? Öffentlich-intern ist der Standard (keine Einschränkung). Vertraulich und Streng vertraulich markieren sensibles Wissen: solche Objekte werden nie in externe Kontexte gegeben (Auswertungen/Export). Die Stufe ist ab dem Erfassen setzbar und später jederzeit änderbar — jede Änderung wird im Audit-Log festgehalten. Hinweis: Diese Kennzeichnung schränkt (noch) nicht ein, WER das Objekt sieht.",
    "fachwort.demodaten.hinweis":
      "Lädt einen kleinen, echten Demo-Bestand (Wissensobjekte, Validierung, Lücke, Konflikt, Duplikat, Anhang) — auch neben vorhandenen Daten. Dein echter Bestand bleibt unberührt und wird nie überschrieben. Über „Demodaten entfernen“ gezielt wieder entfernbar. (Konflikt- und Duplikat-Befunde erscheinen nur, wenn ein KI-Modell aktiv ist.)",
    "fachwort.kiLaeufe.titel": "KI-Läufe (zuletzt)",
    "fachwort.kiLaeufe.leer": "Noch keine KI-Läufe protokolliert.",
    "fachwort.kiEinstellung.titel": "KI-Einstellung",
    "fachwort.qm.titel": "Hinweise zur Wissensqualität (QM)",
    "fachwort.qm.modelrun-errors.titel": "Fehlgeschlagene KI-Aufrufe ({{n}})",
    "fachwort.qm.modelrun-errors.text": "KI-Aufrufe mit Fehlerstatus — Protokoll prüfen.",
    "fachwort.qm.modelrun-fallbacks.titel": "KI-Läufe im Ersatzmodus ({{n}})",
    "fachwort.qm.modelrun-fallbacks.text":
      "Läufe nutzten den festen Ersatzablauf statt eines KI-Modells.",
    "fachwort.qm.reasoner-demo.titel": "KI im Vorführ- oder Ersatzmodus",
    "fachwort.qm.reasoner-demo.text":
      "Kein echtes KI-Modell eingerichtet — Antworten folgen festen Regeln.",
    "fachwort.qm.provenance-no-evidence.titel": "Wissensobjekte ohne Belegeintrag ({{n}})",
    "fachwort.qm.provenance-no-evidence.text":
      "Quellen oder Anhänge sind vorhanden, aber nicht als Beleg eingetragen.",
    "fachwort.qm.evidence-outdated.titel": "Belege veraltet ({{n}})",
    "fachwort.qm.evidence-outdated.text":
      "Die aktuelle Fassung des Wissensobjekts hat keinen Beleg — belegt sind nur ältere Fassungen.",
    "fachwort.qm.evidence-missing.titel": "Belege fehlen ({{n}})",
    "fachwort.qm.evidence-missing.text":
      "Quellen oder Anhänge am Objekt sind vorhanden, aber für keine Fassung als Beleg eingetragen.",
    "fachwort.qm.provenance-lineage.titel": "Übergabe oder mehrere Fassungen ({{n}})",
    "fachwort.qm.provenance-lineage.text":
      "Wissensobjekte, die an eine andere Person übergeben wurden oder mehrere Fassungen haben.",
    "fachwort.qm.evidence-empty.titel": "Noch keine Belege eingetragen",
    "fachwort.qm.evidence-empty.text":
      "Bisher wurden keine Quellen oder Anhänge als Beleg erfasst.",
    "fachwort.qm.health-detection-unproven.titel": "Wissensqualität nicht belegt ({{n}})",
    "fachwort.qm.health-detection-unproven.text":
      "Die Konflikterkennung ist nicht vollständig belegt. Der angezeigte Wert ist deshalb der ungünstigste mögliche, kein gemessener Grad — solange das so ist, lässt sich weder Entwarnung noch Alarm ehrlich geben.",
    "fachwort.qm.health-critical.titel": "Wissensqualität kritisch ({{n}})",
    "fachwort.qm.health-critical.text": "Der Gesamtwert liegt im kritischen Bereich.",
    "fachwort.qm.health-mittel.titel": "Wissensqualität mittel ({{n}})",
    "fachwort.qm.health-mittel.text": "Der Gesamtwert liegt im mittleren Bereich.",
    "fachwort.qm.all-clear.titel": "Keine Auffälligkeiten",
    "fachwort.qm.all-clear.text": "Die geladenen Kennzahlen zeigen keine Warnungen.",
    "fachwort.belegIndex.titel": "Belegverzeichnis (QM)",
    "fachwort.belegIndex.leer": "Noch keine Belege eingetragen.",
    "fachwort.belegIndex.objekt": "Wissensobjekt {{id}}",
    "fachwort.herkunft.titel": "Herkunftsverzeichnis (QM)",
    "fachwort.herkunft.gesamt": "Wissensobjekte: {{n}}",
    "fachwort.herkunft.mitBeleg": "mit Beleg: {{n}}",
    "fachwort.herkunft.ohneBeleg": "ohne Beleg: {{n}}",
    "fachwort.herkunft.markeOhneBeleg": "kein Beleg",
    "fachwort.herkunft.zaehler":
      "Quellen {{sources}} · Anhänge {{attachments}} · Belege {{evidence}}",
    "fachwort.belegFrische.titel": "Aktualität der Belege (QM)",
    "fachwort.belegFrische.untertitel": "Wissensobjekte, deren aktuelle Fassung keinen Beleg hat.",
    "fachwort.belegFrische.leer": "Keine Wissensobjekte mit veralteten oder fehlenden Belegen.",
    "fachwort.fund.angelegt": "Wissensobjekt angelegt",
    "fachwort.einzelperson.risiko": "Nur eine Person kennt das (Bus-Faktor 1)",
    "fachwort.einzelperson.filter": "Nur eine Person (Bus-Faktor 1)",
    "fachwort.einzelperson.markierung": "nur eine Person",
    "fachwort.bereitschaft.titel": "Startklarheit des Wissenssystems",
    "fachwort.kreis.titel": "Der Wissenskreis",
    "fachwort.gesundheit.titel": "Zustand der Wissensbasis",
  },
  en: {
    "fachwort.vertraulichkeit.hilfe":
      "How confidential is this knowledge? “Public-internal” is the default (no restriction). “Confidential” and “Strictly confidential” mark sensitive knowledge: such objects are never sent into external contexts (reports/export). The level can be set while capturing and changed anytime afterwards — every change is recorded in the audit log. Note: this label does not (yet) restrict WHO can see the object.",
    "fachwort.demodaten.hinweis":
      "Loads a small, real demo set (knowledge objects, validation, gap, conflict, duplicate, attachment) — also alongside existing data. Your real content stays untouched and is never overwritten. Removable on demand via “Remove demo data”. (Conflict and duplicate findings only appear when an AI model is active.)",
    "fachwort.kiLaeufe.titel": "AI runs (recent)",
    "fachwort.kiLaeufe.leer": "No AI runs recorded yet.",
    "fachwort.kiEinstellung.titel": "AI configuration",
    "fachwort.qm.titel": "Knowledge quality notes (QA)",
    "fachwort.qm.modelrun-errors.titel": "Failed AI calls ({{n}})",
    "fachwort.qm.modelrun-errors.text": "AI calls with error status — review the log.",
    "fachwort.qm.modelrun-fallbacks.titel": "AI runs in backup mode ({{n}})",
    "fachwort.qm.modelrun-fallbacks.text":
      "Runs used the fixed backup procedure instead of an AI model.",
    "fachwort.qm.reasoner-demo.titel": "AI in demo or backup mode",
    "fachwort.qm.reasoner-demo.text": "No real AI model set up — answers follow fixed rules.",
    "fachwort.qm.provenance-no-evidence.titel":
      "Knowledge objects without an evidence entry ({{n}})",
    "fachwort.qm.provenance-no-evidence.text":
      "Sources or attachments are present but not recorded as evidence.",
    "fachwort.qm.evidence-outdated.titel": "Evidence outdated ({{n}})",
    "fachwort.qm.evidence-outdated.text":
      "The current version of the knowledge object has no evidence — only older versions are backed.",
    "fachwort.qm.evidence-missing.titel": "Evidence missing ({{n}})",
    "fachwort.qm.evidence-missing.text":
      "Sources or object attachments are present but recorded as evidence for no version.",
    "fachwort.qm.provenance-lineage.titel": "Hand-over or multiple versions ({{n}})",
    "fachwort.qm.provenance-lineage.text":
      "Knowledge objects handed over to another person or with multiple versions.",
    "fachwort.qm.evidence-empty.titel": "No evidence recorded yet",
    "fachwort.qm.evidence-empty.text":
      "No sources or attachments have been recorded as evidence yet.",
    "fachwort.qm.health-detection-unproven.titel": "Knowledge quality not established ({{n}})",
    "fachwort.qm.health-detection-unproven.text":
      "Conflict detection is not fully evidenced. The value shown is therefore the worst possible one, not a measured grade — while that holds, neither an all-clear nor an alarm can be given honestly.",
    "fachwort.qm.health-critical.titel": "Knowledge quality critical ({{n}})",
    "fachwort.qm.health-critical.text": "The overall value is in the critical band.",
    "fachwort.qm.health-mittel.titel": "Knowledge quality medium ({{n}})",
    "fachwort.qm.health-mittel.text": "The overall value is in the medium band.",
    "fachwort.qm.all-clear.titel": "No issues",
    "fachwort.qm.all-clear.text": "The loaded figures show no warnings.",
    "fachwort.belegIndex.titel": "Evidence index (QA)",
    "fachwort.belegIndex.leer": "No evidence recorded yet.",
    "fachwort.belegIndex.objekt": "Knowledge object {{id}}",
    "fachwort.herkunft.titel": "Provenance index (QA)",
    "fachwort.herkunft.gesamt": "Knowledge objects: {{n}}",
    "fachwort.herkunft.mitBeleg": "with evidence: {{n}}",
    "fachwort.herkunft.ohneBeleg": "without evidence: {{n}}",
    "fachwort.herkunft.markeOhneBeleg": "no evidence",
    "fachwort.herkunft.zaehler":
      "Sources {{sources}} · Attachments {{attachments}} · Evidence {{evidence}}",
    "fachwort.belegFrische.titel": "Evidence freshness (QA)",
    "fachwort.belegFrische.untertitel": "Knowledge objects whose current version has no evidence.",
    "fachwort.belegFrische.leer": "No knowledge objects with outdated or missing evidence.",
    "fachwort.fund.angelegt": "Knowledge object created",
    "fachwort.einzelperson.risiko": "Only one person knows this (bus factor 1)",
    "fachwort.einzelperson.filter": "Only one person (bus factor 1)",
    "fachwort.einzelperson.markierung": "only one person",
    "fachwort.bereitschaft.titel": "Knowledge system readiness",
    "fachwort.kreis.titel": "The knowledge cycle",
    "fachwort.gesundheit.titel": "State of the knowledge base",
  },
  nl: {
    "fachwort.vertraulichkeit.hilfe":
      "Hoe vertrouwelijk is deze kennis? Openbaar-intern is de standaard (geen beperking). Vertrouwelijk en Streng vertrouwelijk markeren gevoelige kennis: zulke objecten worden nooit in externe contexten gegeven (rapportages/export). Het niveau kun je vanaf het vastleggen instellen en later altijd wijzigen — elke wijziging wordt in het audit-log vastgelegd. Let op: deze markering beperkt (nog) niet WIE het object ziet.",
    "fachwort.demodaten.hinweis":
      "Laadt een kleine, echte demovoorraad (kennisobjecten, validatie, hiaat, conflict, duplicaat, bijlage) — ook naast bestaande gegevens. Je echte bestand blijft onaangeroerd en wordt nooit overschreven. Gericht te verwijderen via „Demogegevens verwijderen“. (Conflict- en duplicaatbevindingen verschijnen alleen als er een AI-model actief is.)",
    "fachwort.kiLaeufe.titel": "AI-runs (laatste)",
    "fachwort.kiLaeufe.leer": "Nog geen AI-runs geprotocolleerd.",
    "fachwort.kiEinstellung.titel": "AI-configuratie",
    "fachwort.qm.titel": "Aandachtspunten kenniskwaliteit (QM)",
    "fachwort.qm.modelrun-errors.titel": "Mislukte AI-aanroepen ({{n}})",
    "fachwort.qm.modelrun-errors.text": "AI-aanroepen met foutstatus — protocol controleren.",
    "fachwort.qm.modelrun-fallbacks.titel": "AI-runs in reservemodus ({{n}})",
    "fachwort.qm.modelrun-fallbacks.text":
      "Runs gebruikten de vaste reserveprocedure in plaats van een AI-model.",
    "fachwort.qm.reasoner-demo.titel": "AI in demo- of reservemodus",
    "fachwort.qm.reasoner-demo.text":
      "Geen echt AI-model ingericht — antwoorden volgen vaste regels.",
    "fachwort.qm.provenance-no-evidence.titel": "Kennisobjecten zonder bewijsregistratie ({{n}})",
    "fachwort.qm.provenance-no-evidence.text":
      "Bronnen of bijlagen zijn aanwezig, maar niet als bewijs geregistreerd.",
    "fachwort.qm.evidence-outdated.titel": "Bewijs verouderd ({{n}})",
    "fachwort.qm.evidence-outdated.text":
      "De huidige versie van het kennisobject heeft geen bewijs — alleen oudere versies zijn onderbouwd.",
    "fachwort.qm.evidence-missing.titel": "Bewijs ontbreekt ({{n}})",
    "fachwort.qm.evidence-missing.text":
      "Bronnen of objectbijlagen zijn aanwezig, maar voor geen enkele versie als bewijs geregistreerd.",
    "fachwort.qm.provenance-lineage.titel": "Overdracht of meerdere versies ({{n}})",
    "fachwort.qm.provenance-lineage.text":
      "Kennisobjecten die aan een andere persoon zijn overgedragen of meerdere versies hebben.",
    "fachwort.qm.evidence-empty.titel": "Nog geen bewijs geregistreerd",
    "fachwort.qm.evidence-empty.text":
      "Er zijn nog geen bronnen of bijlagen als bewijs vastgelegd.",
    "fachwort.qm.health-detection-unproven.titel": "Kenniskwaliteit niet aangetoond ({{n}})",
    "fachwort.qm.health-detection-unproven.text":
      "De conflictdetectie is niet volledig aangetoond. De getoonde waarde is daarom de ongunstigst mogelijke, geen gemeten graad — zolang dat zo is, valt noch een sein-veilig noch een alarm eerlijk te geven.",
    "fachwort.qm.health-critical.titel": "Kenniskwaliteit kritiek ({{n}})",
    "fachwort.qm.health-critical.text": "De totaalwaarde ligt in het kritieke bereik.",
    "fachwort.qm.health-mittel.titel": "Kenniskwaliteit gemiddeld ({{n}})",
    "fachwort.qm.health-mittel.text": "De totaalwaarde ligt in het gemiddelde bereik.",
    "fachwort.qm.all-clear.titel": "Geen bijzonderheden",
    "fachwort.qm.all-clear.text": "De geladen kengetallen tonen geen waarschuwingen.",
    "fachwort.belegIndex.titel": "Bewijsindex (QM)",
    "fachwort.belegIndex.leer": "Nog geen bewijs geregistreerd.",
    "fachwort.belegIndex.objekt": "Kennisobject {{id}}",
    "fachwort.herkunft.titel": "Herkomstindex (QM)",
    "fachwort.herkunft.gesamt": "Kennisobjecten: {{n}}",
    "fachwort.herkunft.mitBeleg": "met bewijs: {{n}}",
    "fachwort.herkunft.ohneBeleg": "zonder bewijs: {{n}}",
    "fachwort.herkunft.markeOhneBeleg": "geen bewijs",
    "fachwort.herkunft.zaehler":
      "Bronnen {{sources}} · Bijlagen {{attachments}} · Bewijs {{evidence}}",
    "fachwort.belegFrische.titel": "Actualiteit van bewijs (QM)",
    "fachwort.belegFrische.untertitel":
      "Kennisobjecten waarvan de huidige versie geen bewijs heeft.",
    "fachwort.belegFrische.leer": "Geen kennisobjecten met verouderd of ontbrekend bewijs.",
    "fachwort.fund.angelegt": "Kennisobject aangemaakt",
    "fachwort.einzelperson.risiko": "Slechts één persoon weet dit (busfactor 1)",
    "fachwort.einzelperson.filter": "Slechts één persoon (busfactor 1)",
    "fachwort.einzelperson.markierung": "slechts één persoon",
    "fachwort.bereitschaft.titel": "Startklaarheid van het kennissysteem",
    "fachwort.kreis.titel": "De kenniscyclus",
    "fachwort.gesundheit.titel": "Staat van de kennisbank",
  },
} satisfies Textmodul;
