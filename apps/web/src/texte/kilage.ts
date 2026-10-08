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
  },
} satisfies Textmodul;
