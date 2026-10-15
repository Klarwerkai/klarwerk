// ================================================================================================
// PETER-20261011-P13 · LAGEBILD UND WISSENSKAPITAL — Texte der Kapitalsicht (Geldwert, Reifegrad)
// und der Ergänzungen an den Wissenskennzahlen (Kontext, Quellenstand, Messart, Zuständigkeit).
// ================================================================================================
//
// Die Regeln stehen in `lib/lagebild.ts`. Die Texte sagen, was die Zahl trägt — und nicht mehr:
// kein Geldwert ohne gemessene Fälle, keine Agentenprüfung als Alltagsnutzen, keine Ersparnis als
// Umsatz.
import type { Textmodul } from "./intern/pruefung";

export default {
  praefix: "lagebild.",
  legacySchluessel: [],
  de: {
    "lagebild.geld.regel":
      "Ein Geldwert entsteht nur aus gemessenen Fällen: Fallzahl × gemessene Zeitdifferenz × vereinbarter Kostensatz, abzüglich zusätzlicher Pflege-, Betriebs- und Prüfkosten. Keine Bewertung aus Objektzahl, Textmenge oder KI-Schätzung; keine Vorgabewerte.",
    "lagebild.geld.messart": "Messart",
    "lagebild.geld.messart.waehlen": "Bitte wählen",
    "lagebild.geld.messart.agent": "Agentenprüfung mit fiktiven Testdaten",
    "lagebild.geld.messart.mensch": "Echte Anwender mit echten Aufgaben",
    "lagebild.geld.kostensatz": "Vereinbarter Kostensatz (€ pro Stunde)",
    "lagebild.geld.zusatzkosten": "Zusätzliche Pflege-, Betriebs- und Prüfkosten (€)",
    "lagebild.geld.faelle": "Gemessene Fälle",
    "lagebild.geld.fall.id": "Fallkennung",
    "lagebild.geld.fall.ohne": "Minuten ohne Klarwerk",
    "lagebild.geld.fall.mit": "Minuten mit Klarwerk",
    "lagebild.geld.fall.vergleichbar": "Ergebnisqualität vergleichbar",
    "lagebild.geld.fall.entfernen": "Fall {{nummer}} entfernen",
    "lagebild.geld.fall.hinzufuegen": "Fall hinzufügen",
    "lagebild.geld.kein": "Kein Geldwert",
    "lagebild.geld.messartFehlt": "Wählen Sie, wie gemessen wurde.",
    "lagebild.geld.grund.keine_faelle": "Es ist noch kein gemessener Fall eingetragen.",
    "lagebild.geld.grund.messart_gemischt":
      "Agentenprüfung und echte Nutzung werden nicht zusammengerechnet.",
    "lagebild.geld.grund.ungueltige_messung":
      "Jeder Fall braucht gemessene Minuten ohne und mit Klarwerk (0 oder mehr).",
    "lagebild.geld.grund.qualitaet_nicht_vergleichbar":
      "Mindestens ein Fall hat keine vergleichbare Ergebnisqualität — dann gibt es keinen Wert, auch nicht aus den übrigen Fällen.",
    "lagebild.geld.grund.kostensatz_fehlt": "Der Kostensatz ist nicht vereinbart.",
    "lagebild.geld.grund.zusatzkosten_fehlt":
      "Die zusätzlichen Kosten fehlen. Tragen Sie 0 ein, wenn keine angefallen sind.",
    "lagebild.geld.netto": "Netto",
    "lagebild.geld.formel":
      "{{fallzahl}} Fälle · {{minuten}} Minuten Differenz × {{satz}} pro Stunde = {{brutto}} − Zusatzkosten {{zusatz}} (beides im Zeitraum {{von}} bis {{bis}})",
    "lagebild.geld.zusatzImZeitraum":
      "Im Messzeitraum {{von}} bis {{bis}} — derselbe wie die Fälle.",
    "lagebild.geld.rahmenTitel": "Wofür die Messung gilt",
    "lagebild.geld.rahmen.von": "Messzeitraum von",
    "lagebild.geld.rahmen.bis": "Messzeitraum bis",
    "lagebild.geld.rahmen.kontext": "Arbeitskontext (Arbeitsweg oder Bereich)",
    "lagebild.geld.rahmen.quelle": "Messquelle",
    "lagebild.geld.rahmen.quellenStand": "Stand der Messquelle",
    "lagebild.geld.gilt":
      "Gilt für {{kontext}} im Zeitraum {{von}} bis {{bis}} · Quelle: {{quelle}}, Stand {{quellenStand}}",
    "lagebild.geld.grund.widerspruch_fallkennung":
      "Klärbedarf: Einträge mit derselben Fallkennung widersprechen sich. Bis zur eindeutigen Zuordnung entsteht kein Betrag.",
    "lagebild.geld.klaerbedarf": "Betroffene Fallkennungen: {{kennungen}}",
    "lagebild.geld.grund.angaben_fehlen":
      "Ohne Messzeitraum, Arbeitskontext und Messquelle mit Stand ist kein Betrag belegt.",
    "lagebild.geld.fehlend": "Es fehlt: {{angaben}}",
    "lagebild.geld.grund.messzeitraum_ungueltig":
      "Der Messzeitraum ist ungültig: Beginn nach dem Ende oder Ende in der Zukunft.",
    "lagebild.geld.grund.quellenstand_ungueltig":
      "Der Stand der Messquelle muss den ganzen Zeitraum abdecken (nicht vor dessen Ende) und darf nicht in der Zukunft liegen.",
    "lagebild.geld.mehraufwand_one":
      "{{count}} Fall kostete mit Klarwerk mehr Zeit — er bleibt negativ in der Rechnung.",
    "lagebild.geld.mehraufwand_other":
      "{{count}} Fälle kosteten mit Klarwerk mehr Zeit — sie bleiben negativ in der Rechnung.",
    "lagebild.geld.doppelt": "{{anzahl}} identisch wiederholte Einträge nicht doppelt gezählt.",
    "lagebild.geld.simulation":
      "Agentenprüfung mit fiktiven Testdaten: eine Simulation — kein realer Kapitalwert und kein Nachweis von Alltagsnutzen.",
    "lagebild.geld.echt":
      "Gemessen mit echten Anwendern. Gilt nur für diese Fälle; keine Hochrechnung.",
    "lagebild.geld.keinUmsatz": "Eine Ersparnis ist kein zusätzlicher Umsatz und keine Liquidität.",
    "lagebild.geld.version": "Rechenregel {{version}}",
    "lagebild.reife.regel":
      "Reifegrade werden je Arbeitsweg vergeben, nicht für die ganze Firma. Eine Stufe gilt erst, wenn jeder ihrer Nachweise belegt ist und alle Stufen darunter gelten.",
    "lagebild.reife.stufe": "Stufe",
    "lagebild.reife.nachweis": "Erforderlicher Nachweis",
    "lagebild.reife.stufe.erfasst": "Erfasst",
    "lagebild.reife.stufe.geordnet": "Geordnet",
    "lagebild.reife.stufe.fachlich_bestaetigt": "Fachlich bestätigt",
    "lagebild.reife.stufe.technisch_geprueft": "Technisch geprüft",
    "lagebild.reife.stufe.alltag_belegt": "Im echten Alltag belegt",
    "lagebild.reife.text.erfasst": "Ursprung, Version, Verantwortlichkeit und Einstufung vorhanden",
    "lagebild.reife.text.geordnet": "Kontext, Verknüpfung und Rechte nachvollziehbar",
    "lagebild.reife.text.fachlich_bestaetigt":
      "Passende fachliche Befugnis, Entscheidung und Geltung belegt",
    "lagebild.reife.text.technisch_geprueft":
      "Vollständiger Arbeitsweg mit Positiv- und Negativfällen bestanden — Agentenprüfung genügt",
    "lagebild.reife.text.alltag_belegt":
      "Reale Anwender und Aufgaben, Gesamtaufwand und Ergebnis gemessen — nur mit echten Anwendern",
    "lagebild.reife.keineBelege":
      "Für keinen Arbeitsweg sind hier Belege hinterlegt. Deshalb steht kein Reifegrad da — auch kein firmenweiter.",
    "lagebild.wkz.kontext": "Kontext",
    "lagebild.wkz.kontext.alle": "Alle Spaces, deren Inhalte Sie lesen dürfen",
    "lagebild.wkz.kontext.space": "Space {{name}}",
    "lagebild.wkz.kontext.team": "Team {{name}}",
    "lagebild.wkz.quellenstand": "Quellenstand",
    "lagebild.wkz.quelle.ok": "Quelle vollständig abgerufen",
    "lagebild.wkz.quelle.teilweise": "Nicht alle Quellen abrufbar",
    "lagebild.wkz.quelle.fehler": "Quelle nicht abrufbar",
    "lagebild.wkz.messart": "Messart",
    "lagebild.wkz.messart.bestand": "Momentaufnahme der offenen Vorgänge — keine Nutzungsmessung.",
    "lagebild.wkz.messart.nutzung":
      "Protokoll aller Konten. Agentenprüfungen und echte Nutzung sind darin nicht unterschieden — kein Nachweis von Alltagsnutzen.",
    "lagebild.wkz.aeltester": "Ältester offener Fall seit {{datum}}",
    "lagebild.wkz.zustaendig": "Zuständig: {{namen}}",
    "lagebild.wkz.zustaendig.niemand": "Keine Zuständigkeit hinterlegt",
    "lagebild.wkz.zustaendig.unbekannt": "Konto nicht mehr vorhanden",
    "lagebild.wkz.zustaendig.art.pruefer": "Prüfung",
    "lagebild.wkz.zustaendig.art.verantwortlich": "verantwortlich",
    "lagebild.wkz.zustaendig.art.autor-ersatz": "Autor als Ersatz",
    "lagebild.wkz.zustaendig.art.zugewiesen": "zugewiesen",
  },
  en: {
    "lagebild.geld.regel":
      "A monetary value comes only from measured cases: number of cases × measured time difference × agreed cost rate, minus additional upkeep, operating and review costs. No valuation from object count, text volume or AI estimate; no default values.",
    "lagebild.geld.messart": "Type of measurement",
    "lagebild.geld.messart.waehlen": "Please choose",
    "lagebild.geld.messart.agent": "Agent test with fictitious test data",
    "lagebild.geld.messart.mensch": "Real users with real tasks",
    "lagebild.geld.kostensatz": "Agreed cost rate (€ per hour)",
    "lagebild.geld.zusatzkosten": "Additional upkeep, operating and review costs (€)",
    "lagebild.geld.faelle": "Measured cases",
    "lagebild.geld.fall.id": "Case ID",
    "lagebild.geld.fall.ohne": "Minutes without Klarwerk",
    "lagebild.geld.fall.mit": "Minutes with Klarwerk",
    "lagebild.geld.fall.vergleichbar": "Result quality comparable",
    "lagebild.geld.fall.entfernen": "Remove case {{nummer}}",
    "lagebild.geld.fall.hinzufuegen": "Add case",
    "lagebild.geld.kein": "No monetary value",
    "lagebild.geld.messartFehlt": "Choose how the cases were measured.",
    "lagebild.geld.grund.keine_faelle": "No measured case has been entered yet.",
    "lagebild.geld.grund.messart_gemischt": "Agent tests and real use are never added together.",
    "lagebild.geld.grund.ungueltige_messung":
      "Each case needs measured minutes without and with Klarwerk (0 or more).",
    "lagebild.geld.grund.qualitaet_nicht_vergleichbar":
      "At least one case has no comparable result quality — then there is no value, not even from the other cases.",
    "lagebild.geld.grund.kostensatz_fehlt": "The cost rate has not been agreed.",
    "lagebild.geld.grund.zusatzkosten_fehlt":
      "The additional costs are missing. Enter 0 if there were none.",
    "lagebild.geld.netto": "Net",
    "lagebild.geld.formel":
      "{{fallzahl}} cases · {{minuten}} minutes difference × {{satz}} per hour = {{brutto}} − additional costs {{zusatz}} (both for {{von}} to {{bis}})",
    "lagebild.geld.zusatzImZeitraum":
      "For the measurement period {{von}} to {{bis}} — the same as the cases.",
    "lagebild.geld.rahmenTitel": "What the measurement applies to",
    "lagebild.geld.rahmen.von": "Measurement period from",
    "lagebild.geld.rahmen.bis": "Measurement period to",
    "lagebild.geld.rahmen.kontext": "Work context (work path or area)",
    "lagebild.geld.rahmen.quelle": "Measurement source",
    "lagebild.geld.rahmen.quellenStand": "Status date of the source",
    "lagebild.geld.gilt":
      "Applies to {{kontext}} for {{von}} to {{bis}} · Source: {{quelle}}, as of {{quellenStand}}",
    "lagebild.geld.grund.widerspruch_fallkennung":
      "Needs clarification: entries with the same case ID contradict each other. No amount until they are resolved.",
    "lagebild.geld.klaerbedarf": "Affected case IDs: {{kennungen}}",
    "lagebild.geld.grund.angaben_fehlen":
      "Without measurement period, work context and measurement source with status, no amount is evidenced.",
    "lagebild.geld.fehlend": "Missing: {{angaben}}",
    "lagebild.geld.grund.messzeitraum_ungueltig":
      "The measurement period is invalid: start after end, or end in the future.",
    "lagebild.geld.grund.quellenstand_ungueltig":
      "The source status must cover the whole period (not before its end) and must not be in the future.",
    "lagebild.geld.mehraufwand_one":
      "{{count}} case took longer with Klarwerk — it stays negative in the calculation.",
    "lagebild.geld.mehraufwand_other":
      "{{count}} cases took longer with Klarwerk — they stay negative in the calculation.",
    "lagebild.geld.doppelt": "{{anzahl}} identically repeated entries not counted twice.",
    "lagebild.geld.simulation":
      "Agent test with fictitious test data: a simulation — not a real capital value and no proof of everyday benefit.",
    "lagebild.geld.echt":
      "Measured with real users. Applies to these cases only; no extrapolation.",
    "lagebild.geld.keinUmsatz": "A saving is not additional revenue and not liquidity.",
    "lagebild.geld.version": "Calculation rule {{version}}",
    "lagebild.reife.regel":
      "Maturity levels are awarded per work path, not for the whole company. A level only counts once every one of its proofs is evidenced and all levels below it count.",
    "lagebild.reife.stufe": "Level",
    "lagebild.reife.nachweis": "Required proof",
    "lagebild.reife.stufe.erfasst": "Captured",
    "lagebild.reife.stufe.geordnet": "Organised",
    "lagebild.reife.stufe.fachlich_bestaetigt": "Confirmed by experts",
    "lagebild.reife.stufe.technisch_geprueft": "Technically tested",
    "lagebild.reife.stufe.alltag_belegt": "Proven in real everyday use",
    "lagebild.reife.text.erfasst": "Origin, version, responsibility and classification present",
    "lagebild.reife.text.geordnet": "Context, links and permissions traceable",
    "lagebild.reife.text.fachlich_bestaetigt":
      "Matching expert authority, decision and validity evidenced",
    "lagebild.reife.text.technisch_geprueft":
      "Complete work path passed with positive and negative cases — an agent test is sufficient",
    "lagebild.reife.text.alltag_belegt":
      "Real users and tasks, total effort and result measured — real users only",
    "lagebild.reife.keineBelege":
      "No evidence is recorded here for any work path. That is why no maturity level is shown — not even a company-wide one.",
    "lagebild.wkz.kontext": "Context",
    "lagebild.wkz.kontext.alle": "All spaces whose content you may read",
    "lagebild.wkz.kontext.space": "Space {{name}}",
    "lagebild.wkz.kontext.team": "Team {{name}}",
    "lagebild.wkz.quellenstand": "Source status",
    "lagebild.wkz.quelle.ok": "Source fully retrieved",
    "lagebild.wkz.quelle.teilweise": "Not all sources retrievable",
    "lagebild.wkz.quelle.fehler": "Source not retrievable",
    "lagebild.wkz.messart": "Type of measurement",
    "lagebild.wkz.messart.bestand": "Snapshot of open cases — not a usage measurement.",
    "lagebild.wkz.messart.nutzung":
      "Log of all accounts. Agent tests and real use are not distinguished in it — no proof of everyday benefit.",
    "lagebild.wkz.aeltester": "Oldest open case since {{datum}}",
    "lagebild.wkz.zustaendig": "Responsible: {{namen}}",
    "lagebild.wkz.zustaendig.niemand": "No responsibility recorded",
    "lagebild.wkz.zustaendig.unbekannt": "Account no longer exists",
    "lagebild.wkz.zustaendig.art.pruefer": "review",
    "lagebild.wkz.zustaendig.art.verantwortlich": "responsible",
    "lagebild.wkz.zustaendig.art.autor-ersatz": "author as fallback",
    "lagebild.wkz.zustaendig.art.zugewiesen": "assigned",
  },
  nl: {
    "lagebild.geld.regel":
      "Een geldwaarde ontstaat alleen uit gemeten gevallen: aantal gevallen × gemeten tijdsverschil × afgesproken kostentarief, min extra onderhouds-, beheer- en controlekosten. Geen waardering op basis van aantal objecten, hoeveelheid tekst of AI-schatting; geen standaardwaarden.",
    "lagebild.geld.messart": "Soort meting",
    "lagebild.geld.messart.waehlen": "Maak een keuze",
    "lagebild.geld.messart.agent": "Agenttest met fictieve testgegevens",
    "lagebild.geld.messart.mensch": "Echte gebruikers met echte taken",
    "lagebild.geld.kostensatz": "Afgesproken kostentarief (€ per uur)",
    "lagebild.geld.zusatzkosten": "Extra onderhouds-, beheer- en controlekosten (€)",
    "lagebild.geld.faelle": "Gemeten gevallen",
    "lagebild.geld.fall.id": "Kenmerk van het geval",
    "lagebild.geld.fall.ohne": "Minuten zonder Klarwerk",
    "lagebild.geld.fall.mit": "Minuten met Klarwerk",
    "lagebild.geld.fall.vergleichbar": "Kwaliteit van het resultaat vergelijkbaar",
    "lagebild.geld.fall.entfernen": "Geval {{nummer}} verwijderen",
    "lagebild.geld.fall.hinzufuegen": "Geval toevoegen",
    "lagebild.geld.kein": "Geen geldwaarde",
    "lagebild.geld.messartFehlt": "Kies hoe er gemeten is.",
    "lagebild.geld.grund.keine_faelle": "Er is nog geen gemeten geval ingevoerd.",
    "lagebild.geld.grund.messart_gemischt":
      "Agenttests en echt gebruik worden nooit bij elkaar opgeteld.",
    "lagebild.geld.grund.ungueltige_messung":
      "Elk geval heeft gemeten minuten zonder en met Klarwerk nodig (0 of meer).",
    "lagebild.geld.grund.qualitaet_nicht_vergleichbar":
      "Minstens één geval heeft geen vergelijkbare resultaatkwaliteit — dan is er geen waarde, ook niet uit de overige gevallen.",
    "lagebild.geld.grund.kostensatz_fehlt": "Het kostentarief is niet afgesproken.",
    "lagebild.geld.grund.zusatzkosten_fehlt":
      "De extra kosten ontbreken. Vul 0 in als er geen waren.",
    "lagebild.geld.netto": "Netto",
    "lagebild.geld.formel":
      "{{fallzahl}} gevallen · {{minuten}} minuten verschil × {{satz}} per uur = {{brutto}} − extra kosten {{zusatz}} (beide in de periode {{von}} tot {{bis}})",
    "lagebild.geld.zusatzImZeitraum":
      "In de meetperiode {{von}} tot {{bis}} — dezelfde als die van de gevallen.",
    "lagebild.geld.rahmenTitel": "Waarvoor de meting geldt",
    "lagebild.geld.rahmen.von": "Meetperiode vanaf",
    "lagebild.geld.rahmen.bis": "Meetperiode tot",
    "lagebild.geld.rahmen.kontext": "Werkcontext (werkwijze of gebied)",
    "lagebild.geld.rahmen.quelle": "Meetbron",
    "lagebild.geld.rahmen.quellenStand": "Stand van de meetbron",
    "lagebild.geld.gilt":
      "Geldt voor {{kontext}} in de periode {{von}} tot {{bis}} · Bron: {{quelle}}, stand {{quellenStand}}",
    "lagebild.geld.grund.widerspruch_fallkennung":
      "Verduidelijking nodig: invoer met hetzelfde kenmerk spreekt elkaar tegen. Tot de toewijzing eenduidig is, ontstaat er geen bedrag.",
    "lagebild.geld.klaerbedarf": "Betrokken kenmerken: {{kennungen}}",
    "lagebild.geld.grund.angaben_fehlen":
      "Zonder meetperiode, werkcontext en meetbron met stand is geen bedrag onderbouwd.",
    "lagebild.geld.fehlend": "Ontbreekt: {{angaben}}",
    "lagebild.geld.grund.messzeitraum_ungueltig":
      "De meetperiode is ongeldig: begin na het einde of einde in de toekomst.",
    "lagebild.geld.grund.quellenstand_ungueltig":
      "De stand van de meetbron moet de hele periode dekken (niet vóór het einde) en mag niet in de toekomst liggen.",
    "lagebild.geld.mehraufwand_one":
      "{{count}} geval kostte met Klarwerk meer tijd — het blijft negatief in de berekening.",
    "lagebild.geld.mehraufwand_other":
      "{{count}} gevallen kostten met Klarwerk meer tijd — ze blijven negatief in de berekening.",
    "lagebild.geld.doppelt": "{{anzahl}} identiek herhaalde invoer niet dubbel geteld.",
    "lagebild.geld.simulation":
      "Agenttest met fictieve testgegevens: een simulatie — geen echte kapitaalwaarde en geen bewijs van dagelijks nut.",
    "lagebild.geld.echt":
      "Gemeten met echte gebruikers. Geldt alleen voor deze gevallen; geen extrapolatie.",
    "lagebild.geld.keinUmsatz": "Een besparing is geen extra omzet en geen liquiditeit.",
    "lagebild.geld.version": "Rekenregel {{version}}",
    "lagebild.reife.regel":
      "Volwassenheidsniveaus worden per werkwijze toegekend, niet voor het hele bedrijf. Een niveau telt pas als elk bewijs ervan is aangetoond en alle niveaus eronder tellen.",
    "lagebild.reife.stufe": "Niveau",
    "lagebild.reife.nachweis": "Vereist bewijs",
    "lagebild.reife.stufe.erfasst": "Vastgelegd",
    "lagebild.reife.stufe.geordnet": "Geordend",
    "lagebild.reife.stufe.fachlich_bestaetigt": "Inhoudelijk bevestigd",
    "lagebild.reife.stufe.technisch_geprueft": "Technisch getest",
    "lagebild.reife.stufe.alltag_belegt": "Aangetoond in de echte praktijk",
    "lagebild.reife.text.erfasst":
      "Herkomst, versie, verantwoordelijkheid en classificatie aanwezig",
    "lagebild.reife.text.geordnet": "Context, koppelingen en rechten navolgbaar",
    "lagebild.reife.text.fachlich_bestaetigt":
      "Passende inhoudelijke bevoegdheid, beslissing en geldigheid aangetoond",
    "lagebild.reife.text.technisch_geprueft":
      "Volledige werkwijze met positieve en negatieve gevallen doorstaan — een agenttest volstaat",
    "lagebild.reife.text.alltag_belegt":
      "Echte gebruikers en taken, totale inspanning en resultaat gemeten — alleen met echte gebruikers",
    "lagebild.reife.keineBelege":
      "Voor geen enkele werkwijze is hier bewijs vastgelegd. Daarom staat er geen volwassenheidsniveau — ook geen bedrijfsbreed.",
    "lagebild.wkz.kontext": "Context",
    "lagebild.wkz.kontext.alle": "Alle spaces waarvan u de inhoud mag lezen",
    "lagebild.wkz.kontext.space": "Space {{name}}",
    "lagebild.wkz.kontext.team": "Team {{name}}",
    "lagebild.wkz.quellenstand": "Stand van de bronnen",
    "lagebild.wkz.quelle.ok": "Bron volledig opgehaald",
    "lagebild.wkz.quelle.teilweise": "Niet alle bronnen opvraagbaar",
    "lagebild.wkz.quelle.fehler": "Bron niet opvraagbaar",
    "lagebild.wkz.messart": "Soort meting",
    "lagebild.wkz.messart.bestand": "Momentopname van open zaken — geen gebruiksmeting.",
    "lagebild.wkz.messart.nutzung":
      "Logboek van alle accounts. Agenttests en echt gebruik worden daarin niet onderscheiden — geen bewijs van dagelijks nut.",
    "lagebild.wkz.aeltester": "Oudste open geval sinds {{datum}}",
    "lagebild.wkz.zustaendig": "Verantwoordelijk: {{namen}}",
    "lagebild.wkz.zustaendig.niemand": "Geen verantwoordelijke vastgelegd",
    "lagebild.wkz.zustaendig.unbekannt": "Account bestaat niet meer",
    "lagebild.wkz.zustaendig.art.pruefer": "controle",
    "lagebild.wkz.zustaendig.art.verantwortlich": "verantwoordelijk",
    "lagebild.wkz.zustaendig.art.autor-ersatz": "auteur als vervanger",
    "lagebild.wkz.zustaendig.art.zugewiesen": "toegewezen",
  },
} satisfies Textmodul;
