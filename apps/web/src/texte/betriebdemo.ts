// ================================================================================================
// ADMIN-16 · DEMO UND TESTDATEN GETRENNT VON DER TÄGLICHEN VERWALTUNG — die Texte dieses Auftrags.
// ================================================================================================
//
// WOHER SIE KOMMEN: `produkt:20261009:admin-demo-diagnose`. Die Beispiel-/Demopakete und das
// Aufräumen von Testimporten standen als Kästen auf der produktiven Importseite. Sie wohnen jetzt in
// der Verwaltung unter „Vorführdaten", je hinter einer eigenen Karte (`pages/AdminDemoDetails.tsx`).
//
// WAS DIE SÄTZE NICHT BEHAUPTEN: dass das Aufräumen nur Testdaten träfe. Es betrifft den GESAMTEN
// Importbestand; Zeilenwert und Hilfe sagen das, bevor jemand die Vorschau lädt. Und wo etwas nicht
// verfügbar ist, steht der Grund und wer zuständig ist — kein Knopf, der ins Leere führt.
import type { Textmodul } from "./intern/pruefung";

export default {
  praefix: "betriebdemo.",
  legacySchluessel: [],
  de: {
    "betriebdemo.ziel.pakete": "Beispiel- und Demopakete",
    "betriebdemo.ziel.pakete.syn":
      "Demopakete, Beispielpakete, Beispieldaten, Advisor, demo packages, sample packages",
    "betriebdemo.ziel.testimporte": "Testdaten aus Importen",
    "betriebdemo.ziel.testimporte.syn":
      "Testdaten aufräumen, Import aufräumen, Import-Warteschlange leeren, test data, cleanup",
    "betriebdemo.wert.fiktiv": "erfundene Daten",
    "betriebdemo.wert.alleImporte": "betrifft alle Importe",
    "betriebdemo.hilfe.pakete.titel": "Beispiel- und Demopakete",
    "betriebdemo.hilfe.pakete.text":
      "Alle Inhalte dieser Pakete sind erfunden und an jedem Beitrag als Beispiel gekennzeichnet. Vor dem Laden nennt jede Karte Umfang und Bereiche. Zurücksetzen und Entfernen zeigen zuerst die Kennungen der betroffenen Objekte und wirken nur auf das gewählte Demopaket — eigene Beiträge und andere Pakete bleiben unverändert. Die kleinen Beispielpakete lassen sich nur laden; sie verschwinden mit „Demodaten entfernen“ in der Karte Demodaten. „Zurück“ führt nach Vorführdaten.",
    "betriebdemo.hilfe.testimporte.titel": "Testdaten aus Importen",
    "betriebdemo.hilfe.testimporte.text":
      "Das Aufräumen betrifft den gesamten Importbestand: jeden Eintrag der Import-Warteschlange und jeden aus Confluence oder Jira übernommenen Beitrag — nicht nur Testdaten. Die Vorschau nennt vorher die Zahlen und verändert nichts. Erst die Bestätigung leert die Warteschlange endgültig und legt die Beiträge in den Papierkorb, aus dem sie wiederherstellbar sind. Demodaten, Demopakete und selbst erstellte Beiträge bleiben unberührt. „Zurück“ führt nach Vorführdaten.",
    "betriebdemo.pakete.nichtAbrufbar":
      "Demopakete gerade nicht abrufbar — solange der Bestand unbekannt ist, wird kein Paket angeboten.",
    "betriebdemo.pakete.erneut": "Erneut versuchen",
    "betriebdemo.pakete.keine":
      "In dieser Installation ist kein Demopaket hinterlegt. Zuständig ist der Produktbetrieb, der die Demopakete ausliefert.",
    "betriebdemo.paketFehlt":
      "In dieser Installation nicht verfügbar — dieses Demopaket ist hier nicht hinterlegt. Zuständig ist der Produktbetrieb, der die Demopakete ausliefert.",
    "betriebdemo.konfliktHinweis":
      "Zum Ausprobieren gibt es das Beispielpaket „Widersprüchliche Aussagen“ in den Einstellungen unter Vorführdaten.",
  },
  en: {
    "betriebdemo.ziel.pakete": "Sample and demo packages",
    "betriebdemo.ziel.pakete.syn":
      "demo packages, sample packages, sample data, Advisor, Demopakete, Beispielpakete",
    "betriebdemo.ziel.testimporte": "Test data from imports",
    "betriebdemo.ziel.testimporte.syn":
      "clean up test data, clean up import, empty import queue, cleanup, Testdaten aufräumen",
    "betriebdemo.wert.fiktiv": "fictional data",
    "betriebdemo.wert.alleImporte": "affects all imports",
    "betriebdemo.hilfe.pakete.titel": "Sample and demo packages",
    "betriebdemo.hilfe.pakete.text":
      "All content in these packages is fictional and marked as a sample on every contribution. Before loading, each card states its scope and areas. Reset and remove first show the IDs of the affected objects and act only on the chosen demo package — your own contributions and other packages stay unchanged. The small sample packages can only be loaded; they disappear with “Remove demo data” in the Demo data card. “Back” returns to Demo and sample data.",
    "betriebdemo.hilfe.testimporte.titel": "Test data from imports",
    "betriebdemo.hilfe.testimporte.text":
      "The clean-up affects the entire import stock: every entry in the import queue and every contribution taken over from Confluence or Jira — not only test data. The preview states the figures first and changes nothing. Only the confirmation empties the queue for good and moves the contributions to the trash, from where they can be restored. Demo data, demo packages and contributions created by hand stay untouched. “Back” returns to Demo and sample data.",
    "betriebdemo.pakete.nichtAbrufbar":
      "Demo packages cannot be retrieved right now — while the stock is unknown, no package is offered.",
    "betriebdemo.pakete.erneut": "Try again",
    "betriebdemo.pakete.keine":
      "No demo package is installed here. The product operator who ships the demo packages is responsible.",
    "betriebdemo.paketFehlt":
      "Not available in this installation — this demo package is not installed here. The product operator who ships the demo packages is responsible.",
    "betriebdemo.konfliktHinweis":
      "To try it out, the sample package “Contradicting statements” is available in Settings under Demo and sample data.",
  },
  nl: {
    "betriebdemo.ziel.pakete": "Voorbeeld- en demopakketten",
    "betriebdemo.ziel.pakete.syn":
      "demopakketten, voorbeeldpakketten, voorbeeldgegevens, Advisor, demo packages, sample packages",
    "betriebdemo.ziel.testimporte": "Testgegevens uit imports",
    "betriebdemo.ziel.testimporte.syn":
      "testgegevens opruimen, import opruimen, importwachtrij legen, test data, cleanup",
    "betriebdemo.wert.fiktiv": "verzonnen gegevens",
    "betriebdemo.wert.alleImporte": "betreft alle imports",
    "betriebdemo.hilfe.pakete.titel": "Voorbeeld- en demopakketten",
    "betriebdemo.hilfe.pakete.text":
      "Alle inhoud van deze pakketten is verzonnen en bij elke bijdrage als voorbeeld gemarkeerd. Vóór het laden noemt elke kaart omvang en gebieden. Terugzetten en verwijderen tonen eerst de kenmerken van de betrokken objecten en werken alleen op het gekozen demopakket — eigen bijdragen en andere pakketten blijven ongewijzigd. De kleine voorbeeldpakketten kunnen alleen worden geladen; ze verdwijnen met „Demogegevens verwijderen” in de kaart Demogegevens. „Terug” leidt naar Demo- en voorbeeldgegevens.",
    "betriebdemo.hilfe.testimporte.titel": "Testgegevens uit imports",
    "betriebdemo.hilfe.testimporte.text":
      "Het opruimen betreft de volledige importvoorraad: elke regel in de importwachtrij en elke uit Confluence of Jira overgenomen bijdrage — niet alleen testgegevens. Het voorbeeld noemt eerst de aantallen en verandert niets. Pas de bevestiging leegt de wachtrij definitief en verplaatst de bijdragen naar de prullenbak, waaruit ze herstelbaar zijn. Demogegevens, demopakketten en zelf gemaakte bijdragen blijven onaangeroerd. „Terug” leidt naar Demo- en voorbeeldgegevens.",
    "betriebdemo.pakete.nichtAbrufbar":
      "Demopakketten zijn nu niet op te halen — zolang de voorraad onbekend is, wordt geen pakket aangeboden.",
    "betriebdemo.pakete.erneut": "Opnieuw proberen",
    "betriebdemo.pakete.keine":
      "In deze installatie is geen demopakket aanwezig. Verantwoordelijk is het productbeheer dat de demopakketten levert.",
    "betriebdemo.paketFehlt":
      "Niet beschikbaar in deze installatie — dit demopakket is hier niet aanwezig. Verantwoordelijk is het productbeheer dat de demopakketten levert.",
    "betriebdemo.konfliktHinweis":
      "Om het uit te proberen staat het voorbeeldpakket „Tegenstrijdige uitspraken” in de instellingen onder Demo- en voorbeeldgegevens.",
  },
} satisfies Textmodul;
