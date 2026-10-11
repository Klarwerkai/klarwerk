// ================================================================================================
// KI-LAGE (R-0599, R-0600, R-0702) — Betriebsort, Datenfluss, Herkunft und offene Prüfungen.
// ================================================================================================
//
// Diese Texte ersetzen in der Anzeige die frühere DSGVO-Ja/Nein-Aussage (`topbar.kiDsgvo*`,
// `topbar.ki*Hint`, `reasoner.taskInfo.dsgvo*`). Die alten Schlüssel bleiben im Wörterbuch stehen,
// weil der Terminologie-Vertrag (PRO 375) sie byteweise sperrt; gezeigt werden sie nicht mehr.
//
// JEDER SATZ SAGT NUR, WAS DER SERVER WEISS. Der Server des Betreibers ist eine frei gesetzte
// Adresse — sein Ort steht deshalb ausdrücklich als „nicht hinterlegt und nicht geprüft" da, nicht
// als Zusage. Auftragsverarbeitung, Unterauftragnehmer und Trainingsausschluss sind in keiner
// Installation hinterlegt; sie stehen als offene Prüfung da und werden nicht bejaht oder verneint.
import type { Textmodul } from "./intern/pruefung";

export default {
  praefix: "kilage.",
  legacySchluessel: [],
  de: {
    "kilage.kopf.hinweisExtern":
      "Betriebsort: Rechenzentrum des Cloud-Anbieters. Datenfluss: Inhalte einer KI-Aufgabe gehen an diesen Anbieter. Details je Aufgabe: Verwaltung → KI.",
    "kilage.kopf.hinweisServer":
      "Betriebsort: der KI-Server, den der Betreiber eingerichtet hat — wo er steht, ist in Klarwerk nicht hinterlegt und nicht geprüft. Datenfluss: Inhalte einer KI-Aufgabe gehen an diesen Server.",
    "kilage.kopf.hinweisBeide":
      "Gemischter Betrieb: einige Aufgaben schicken Inhalte an den Cloud-Anbieter, andere an den KI-Server des Betreibers. Details je Aufgabe: Verwaltung → KI.",
    "kilage.kopf.offenePruefungen":
      "Offene Prüfungen: Auftragsverarbeitung, Unterauftragnehmer und Trainingsausschluss sind in dieser Installation nicht hinterlegt.",
    "kilage.herkunft.behauptet": "Herkunft: {{land}} (Angabe des Anbieters, nicht geprüft)",
    "kilage.herkunft.geprueft": "Herkunft: {{land}} (geprüft)",
    "kilage.herkunft.unbekannt": "Herkunft unbekannt",
    "kilage.aktion.extern": "Inhalte gehen an den Cloud-Anbieter",
    "kilage.aktion.externText":
      "Beim Klick werden die Inhalte dieser Aufgabe an den externen Anbieter gesendet. Auftragsverarbeitung, Unterauftragnehmer und Trainingsausschluss sind in dieser Installation nicht hinterlegt.",
    "kilage.aktion.server": "Inhalte gehen an den KI-Server des Betreibers",
    "kilage.aktion.serverText":
      "Diese Aufgabe läuft über das Modell auf dem KI-Server, den der Betreiber eingerichtet hat.",
    "kilage.aktion.serverOffen":
      "Beim Klick werden die Inhalte an diesen Server gesendet. Wo er betrieben wird, ist in Klarwerk nicht hinterlegt und nicht geprüft.",
    "kilage.aktion.keiner": "Kein Versand an eine KI",
    "kilage.aktion.keinerText":
      "Diese Aufgabe läuft rein regelbasiert in Klarwerk; die Inhalte gehen an kein KI-Modell.",
    "kilage.zeile.extern": "KI: extern · {{anbieter}}",
    "kilage.zeile.externOhneName": "KI: extern",
    "kilage.zeile.intern": "KI: Server des Betreibers",
    "kilage.zeile.keine": "Keine KI · regelbasiert",
    "kilage.zeile.unbekannt": "KI-Lage unbekannt",
    "kilage.verfuegbarkeit.erreichbar": "antwortet",
    "kilage.verfuegbarkeit.ungeprueft": "Erreichbarkeit noch nicht bestätigt",
    "kilage.verfuegbarkeit.zuletztGescheitert": "zuletzt nicht erreichbar",
    "kilage.verfuegbarkeit.unerreichbar":
      "Diese KI hat beim letzten Versuch nicht geantwortet. Die nächste Frage geht trotzdem zuerst wieder an sie; erst wenn sie erneut nicht antwortet, wird ein anderer Weg genommen.",
    "kilage.karte.titel": "Betreiber und Wissensstand des Modells",
    "kilage.karte.betreiber": "Betreiber",
    "kilage.karte.betreiberServer": "Server des Betreibers dieser Installation",
    "kilage.karte.modell": "Modell",
    "kilage.karte.verfuegbarkeit": "Erreichbarkeit",
    "kilage.karte.modellUnbekannt": "nicht gemeldet",
    "kilage.karte.herkunft": "Herkunft",
    "kilage.karte.wissensstand": "Wissensstand",
    "kilage.karte.wissensstandBelegt":
      "{{stand}} (vom Hersteller veröffentlichter Wissensstand; Quelle: {{quelle}}, abgerufen am {{abgerufen}})",
    "kilage.karte.wissensstandUnbekannt":
      "unbekannt — für dieses Modell ist kein vom Hersteller veröffentlichter Wissensstand hinterlegt",
    "kilage.karte.quellenbedarf":
      "Fehlende Quelle: die Herstellerangabe zum veröffentlichten Wissensstand („knowledge cutoff“) von „{{modell}}“ (Modellkarte oder Dokumentation des Anbieters, mit Fundstelle und Abrufdatum).",
    "kilage.karte.keinModell":
      "Gerade arbeitet kein KI-Modell — Antworten entstehen regelbasiert aus geprüftem Wissen. Einen Wissensstand, der veralten könnte, gibt es deshalb nicht.",
    "kilage.karte.hinweis":
      "Der Wissensstand ist der Zeitpunkt, bis zu dem der Hersteller das Wissen des Modells als verlässlich angibt — nicht unbedingt das Ende seiner Trainingsdaten. Aktuelles kommt ausschliesslich aus dem geprüften Wissen dieser Installation.",
  },
  en: {
    "kilage.kopf.hinweisExtern":
      "Where it runs: the cloud provider's data centre. Data flow: the content of an AI task goes to this provider. Details per task: Administration → AI.",
    "kilage.kopf.hinweisServer":
      "Where it runs: the AI server the operator has set up — its location is not recorded in Klarwerk and has not been checked. Data flow: the content of an AI task goes to this server.",
    "kilage.kopf.hinweisBeide":
      "Mixed operation: some tasks send content to the cloud provider, others to the operator's AI server. Details per task: Administration → AI.",
    "kilage.kopf.offenePruefungen":
      "Open checks: data processing agreement, sub-processors and training exclusion are not recorded for this installation.",
    "kilage.herkunft.behauptet": "Origin: {{land}} (stated by the provider, not checked)",
    "kilage.herkunft.geprueft": "Origin: {{land}} (checked)",
    "kilage.herkunft.unbekannt": "Origin unknown",
    "kilage.aktion.extern": "Content goes to the cloud provider",
    "kilage.aktion.externText":
      "When you click, the content of this task is sent to the external provider. Data processing agreement, sub-processors and training exclusion are not recorded for this installation.",
    "kilage.aktion.server": "Content goes to the operator's AI server",
    "kilage.aktion.serverText":
      "This task runs on the model on the AI server the operator has set up.",
    "kilage.aktion.serverOffen":
      "When you click, the content is sent to this server. Where it is operated is not recorded in Klarwerk and has not been checked.",
    "kilage.aktion.keiner": "Nothing is sent to an AI",
    "kilage.aktion.keinerText":
      "This task runs purely rule-based in Klarwerk; the content goes to no AI model.",
    "kilage.zeile.extern": "AI: external · {{anbieter}}",
    "kilage.zeile.externOhneName": "AI: external",
    "kilage.zeile.intern": "AI: operator's server",
    "kilage.zeile.keine": "No AI · rule-based",
    "kilage.zeile.unbekannt": "AI status unknown",
    "kilage.verfuegbarkeit.erreichbar": "responding",
    "kilage.verfuegbarkeit.ungeprueft": "availability not yet confirmed",
    "kilage.verfuegbarkeit.zuletztGescheitert": "last attempt failed",
    "kilage.verfuegbarkeit.unerreichbar":
      "This AI did not respond on the last attempt. The next question still goes to it first; only if it fails to respond again is another route taken.",
    "kilage.karte.titel": "Operator and knowledge cut-off of the model",
    "kilage.karte.betreiber": "Operator",
    "kilage.karte.betreiberServer": "The AI server of this installation's operator",
    "kilage.karte.modell": "Model",
    "kilage.karte.verfuegbarkeit": "Availability",
    "kilage.karte.modellUnbekannt": "not reported",
    "kilage.karte.herkunft": "Origin",
    "kilage.karte.wissensstand": "Knowledge cut-off",
    "kilage.karte.wissensstandBelegt":
      "{{stand}} (knowledge cut-off published by the vendor; source: {{quelle}}, retrieved {{abgerufen}})",
    "kilage.karte.wissensstandUnbekannt":
      "unknown — no knowledge cut-off published by the vendor is recorded for this model",
    "kilage.karte.quellenbedarf":
      "Missing source: the vendor's published knowledge cut-off for “{{modell}}” (model card or vendor documentation, with location and retrieval date).",
    "kilage.karte.keinModell":
      "No AI model is working right now — answers are produced rule-based from validated knowledge. There is therefore no knowledge cut-off that could be outdated.",
    "kilage.karte.hinweis":
      "The knowledge cut-off is the date up to which the vendor states the model's knowledge is reliable — not necessarily the end of its training data. Anything current comes solely from the validated knowledge of this installation.",
  },
  nl: {
    "kilage.kopf.hinweisExtern":
      "Locatie: het datacenter van de cloudaanbieder. Gegevensstroom: de inhoud van een AI-taak gaat naar deze aanbieder. Details per taak: Beheer → AI.",
    "kilage.kopf.hinweisServer":
      "Locatie: de AI-server die de beheerder heeft ingericht — waar die staat, is in Klarwerk niet vastgelegd en niet gecontroleerd. Gegevensstroom: de inhoud van een AI-taak gaat naar deze server.",
    "kilage.kopf.hinweisBeide":
      "Gemengd gebruik: sommige taken sturen inhoud naar de cloudaanbieder, andere naar de AI-server van de beheerder. Details per taak: Beheer → AI.",
    "kilage.kopf.offenePruefungen":
      "Open controles: verwerkersovereenkomst, subverwerkers en uitsluiting van training zijn voor deze installatie niet vastgelegd.",
    "kilage.herkunft.behauptet": "Herkomst: {{land}} (opgave van de aanbieder, niet gecontroleerd)",
    "kilage.herkunft.geprueft": "Herkomst: {{land}} (gecontroleerd)",
    "kilage.herkunft.unbekannt": "Herkomst onbekend",
    "kilage.aktion.extern": "Inhoud gaat naar de cloudaanbieder",
    "kilage.aktion.externText":
      "Bij het klikken wordt de inhoud van deze taak naar de externe aanbieder gestuurd. Verwerkersovereenkomst, subverwerkers en uitsluiting van training zijn voor deze installatie niet vastgelegd.",
    "kilage.aktion.server": "Inhoud gaat naar de AI-server van de beheerder",
    "kilage.aktion.serverText":
      "Deze taak draait op het model op de AI-server die de beheerder heeft ingericht.",
    "kilage.aktion.serverOffen":
      "Bij het klikken wordt de inhoud naar deze server gestuurd. Waar die draait, is in Klarwerk niet vastgelegd en niet gecontroleerd.",
    "kilage.aktion.keiner": "Niets gaat naar een AI",
    "kilage.aktion.keinerText":
      "Deze taak draait puur op regels in Klarwerk; de inhoud gaat naar geen enkel AI-model.",
    "kilage.zeile.extern": "AI: extern · {{anbieter}}",
    "kilage.zeile.externOhneName": "AI: extern",
    "kilage.zeile.intern": "AI: server van de beheerder",
    "kilage.zeile.keine": "Geen AI · op regels gebaseerd",
    "kilage.zeile.unbekannt": "AI-status onbekend",
    "kilage.verfuegbarkeit.erreichbar": "reageert",
    "kilage.verfuegbarkeit.ungeprueft": "bereikbaarheid nog niet bevestigd",
    "kilage.verfuegbarkeit.zuletztGescheitert": "laatste poging mislukt",
    "kilage.verfuegbarkeit.unerreichbar":
      "Deze AI heeft bij de laatste poging niet gereageerd. De volgende vraag gaat toch eerst weer naar haar; pas als ze opnieuw niet reageert, wordt een andere weg genomen.",
    "kilage.karte.titel": "Beheerder en kennisstand van het model",
    "kilage.karte.betreiber": "Beheerder",
    "kilage.karte.betreiberServer": "De AI-server van de beheerder van deze installatie",
    "kilage.karte.modell": "Model",
    "kilage.karte.verfuegbarkeit": "Bereikbaarheid",
    "kilage.karte.modellUnbekannt": "niet gemeld",
    "kilage.karte.herkunft": "Herkomst",
    "kilage.karte.wissensstand": "Kennisstand",
    "kilage.karte.wissensstandBelegt":
      "{{stand}} (door de fabrikant gepubliceerde kennisstand; bron: {{quelle}}, geraadpleegd op {{abgerufen}})",
    "kilage.karte.wissensstandUnbekannt":
      "onbekend — voor dit model is geen door de fabrikant gepubliceerde kennisstand vastgelegd",
    "kilage.karte.quellenbedarf":
      "Ontbrekende bron: de opgave van de fabrikant over de gepubliceerde kennisstand („knowledge cutoff”) van „{{modell}}” (modelkaart of documentatie van de aanbieder, met vindplaats en datum van raadpleging).",
    "kilage.karte.keinModell":
      "Er werkt op dit moment geen AI-model — antwoorden ontstaan op basis van regels uit gecontroleerde kennis. Er is daarom geen kennisstand die verouderd kan zijn.",
    "kilage.karte.hinweis":
      "De kennisstand is het moment tot waarop de fabrikant de kennis van het model als betrouwbaar opgeeft — niet noodzakelijk het einde van zijn trainingsgegevens. Actuele informatie komt uitsluitend uit de gecontroleerde kennis van deze installatie.",
  },
} satisfies Textmodul;
