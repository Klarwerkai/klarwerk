// ================================================================================================
// produkt:20261013:produktbudget-anwender-admin — DIE TEXTE DER KARTE „PRODUKTBUDGETS".
// ================================================================================================
//
// Die Karte (`pages/AdminProduktbudget.tsx`) unter Verwaltung › KI. Peters Vorgaben vom 13.10.2026:
// 20 EUR für Perplexity im PoC (ersetzt die Empfehlung 30 USD/Monat), je 20 EUR für die Claude- und
// ChatGPT-Proben zu Nr. 32 — dort sind Aufteilung und Zeitraum noch offen.
import type { Textmodul } from "./intern/pruefung";

export default {
  praefix: "produktbudget.",
  legacySchluessel: [],
  de: {
    "produktbudget.titel": "Produktbudgets",
    "produktbudget.syn": "Budget Kosten Kostendeckel Perplexity Claude ChatGPT",
    "produktbudget.hilfe":
      "Hier stehen die Budgets, die Klarwerk für kostenpflichtige Aufrufe von Claude, ChatGPT und Perplexity einhält. Gebuchte und reservierte Kosten zählen gegen den Betrag; ist er erreicht oder der Zeitraum offen, startet kein kostenpflichtiger Aufruf. Andere Arbeit bleibt möglich.",
    "produktbudget.ehrlichkeit":
      "Eine Budgetänderung ist keine Aufladung beim Anbieter, keine Kontoumstellung und keine neue Tokenfreigabe. Bereits gebuchte Kosten bleiben stehen und sichtbar.",
    "produktbudget.bereich.perplexity-poc": "Perplexity · PoC",
    "produktbudget.bereich.nr32-claude": "Claude · Proben zu Nr. 32",
    "produktbudget.bereich.nr32-chatgpt": "ChatGPT · Proben zu Nr. 32",
    "produktbudget.geltung.perplexity-poc": "Perplexity-Recherche im PoC (BPA-12)",
    "produktbudget.geltung.nr32-claude": "Claude-Proben zu Nr. 32 (P03)",
    "produktbudget.geltung.nr32-chatgpt": "ChatGPT-Proben zu Nr. 32 (P03)",
    "produktbudget.anbieter.perplexity": "Perplexity",
    "produktbudget.anbieter.anthropic": "Claude (Anthropic)",
    "produktbudget.anbieter.openai": "ChatGPT (OpenAI)",
    "produktbudget.feld.anbieter": "Anbieter",
    "produktbudget.feld.geltung": "Geltungsbereich",
    "produktbudget.feld.betrag": "Betrag",
    "produktbudget.feld.waehrung": "Währung",
    "produktbudget.feld.zeitraum": "Zeitraum",
    "produktbudget.feld.verbraucht": "Verbraucht",
    "produktbudget.feld.reserviert": "Reserviert",
    "produktbudget.feld.verbleibend": "Verbleibend",
    "produktbudget.feld.ueberschritten": "Über dem Betrag",
    "produktbudget.feld.kostenweg": "Kostenpflichtige Aufrufe",
    "produktbudget.feld.stand": "Stand",
    "produktbudget.feld.grund": "Grund oder Beleg",
    "produktbudget.zeitraum.einmalig": "einmalig, ohne Erneuerung",
    "produktbudget.zeitraum.offen": "offen — noch nicht festgelegt",
    "produktbudget.kostenweg.offen": "möglich im Rahmen des Rests",
    "produktbudget.sperre.zeitraum_offen": "gesperrt — Zeitraum offen",
    "produktbudget.sperre.null_budget": "gesperrt — Betrag 0",
    "produktbudget.sperre.ausgeschoepft": "gesperrt — Budget ausgeschöpft",
    "produktbudget.stand.vorgabe": "Originalvorgabe vom 13.10.2026, unverändert",
    "produktbudget.stand.geaendert": "Fassung {{fassung}} · {{datum}} · Konto {{von}}",
    "produktbudget.abgeloest":
      "Ersetzt die frühere Empfehlung {{betrag}} pro Monat für diesen PoC.",
    "produktbudget.frageOffen":
      "Aufteilung und Zeitraum sind gefragt und noch nicht beantwortet. Bis dahin gibt dieses Budget nichts frei.",
    "produktbudget.speichern": "Speichern",
    "produktbudget.gespeichert": "Gespeichert.",
    "produktbudget.gespeichertWeitere":
      "Die gesendete Änderung ist gespeichert. Deine weitere Eingabe ist noch nicht gespeichert.",
    "produktbudget.unveraendert": "Keine Änderung — der Stand ist derselbe.",
    "produktbudget.konfliktUebernehmen": "Eingabe auf den neuen Stand beziehen",
    "produktbudget.verlaufZeile": "{{datum}} · Konto {{von}}: {{vorher}} → {{nachher}}",
    "produktbudget.fehler.bereich": "Diesen Budgetbereich gibt es nicht.",
    "produktbudget.fehler.betrag":
      "Bitte einen Betrag ab 0 mit höchstens zwei Nachkommastellen eingeben (höchstens 10000).",
    "produktbudget.fehler.waehrung": "Bitte EUR oder USD wählen.",
    "produktbudget.fehler.waehrung_gebunden":
      "Für dieses Budget sind schon Kosten gebucht. Die Währung bleibt an diese Buchungen gebunden.",
    "produktbudget.fehler.zeitraum": "Bitte einen Zeitraum wählen.",
    "produktbudget.fehler.grund":
      "Wer einen offenen Zeitraum festlegt, nennt den Beleg (höchstens 200 Zeichen, eine Zeile).",
    "produktbudget.fehler.aenderung":
      "Die Änderung ließ sich nicht zuordnen. Bitte erneut speichern.",
    "produktbudget.fehler.konflikt":
      "Dieses Budget wurde inzwischen geändert. Deine Eingabe ist erhalten; bitte den neuen Stand prüfen.",
    "produktbudget.fehler.unklar":
      "Ob gespeichert wurde, ist unklar. Deine Eingabe ist erhalten; erneutes Speichern wirkt höchstens einmal.",
  },
  en: {
    "produktbudget.titel": "Product budgets",
    "produktbudget.syn": "budget costs cost cap Perplexity Claude ChatGPT",
    "produktbudget.hilfe":
      "These are the budgets Klarwerk keeps for paid calls to Claude, ChatGPT and Perplexity. Booked and reserved costs count against the amount; once it is reached or the period is open, no paid call starts. Other work remains possible.",
    "produktbudget.ehrlichkeit":
      "Changing a budget is not a top-up with the provider, not an account switch and not a new token release. Costs already booked stay in place and visible.",
    "produktbudget.bereich.perplexity-poc": "Perplexity · PoC",
    "produktbudget.bereich.nr32-claude": "Claude · samples for no. 32",
    "produktbudget.bereich.nr32-chatgpt": "ChatGPT · samples for no. 32",
    "produktbudget.geltung.perplexity-poc": "Perplexity research in the PoC (BPA-12)",
    "produktbudget.geltung.nr32-claude": "Claude samples for no. 32 (P03)",
    "produktbudget.geltung.nr32-chatgpt": "ChatGPT samples for no. 32 (P03)",
    "produktbudget.anbieter.perplexity": "Perplexity",
    "produktbudget.anbieter.anthropic": "Claude (Anthropic)",
    "produktbudget.anbieter.openai": "ChatGPT (OpenAI)",
    "produktbudget.feld.anbieter": "Provider",
    "produktbudget.feld.geltung": "Scope",
    "produktbudget.feld.betrag": "Amount",
    "produktbudget.feld.waehrung": "Currency",
    "produktbudget.feld.zeitraum": "Period",
    "produktbudget.feld.verbraucht": "Spent",
    "produktbudget.feld.reserviert": "Reserved",
    "produktbudget.feld.verbleibend": "Remaining",
    "produktbudget.feld.ueberschritten": "Above the amount",
    "produktbudget.feld.kostenweg": "Paid calls",
    "produktbudget.feld.stand": "Status",
    "produktbudget.feld.grund": "Reason or evidence",
    "produktbudget.zeitraum.einmalig": "one-off, no renewal",
    "produktbudget.zeitraum.offen": "open — not yet set",
    "produktbudget.kostenweg.offen": "possible within the remainder",
    "produktbudget.sperre.zeitraum_offen": "blocked — period open",
    "produktbudget.sperre.null_budget": "blocked — amount 0",
    "produktbudget.sperre.ausgeschoepft": "blocked — budget used up",
    "produktbudget.stand.vorgabe": "Original instruction of 13 Oct 2026, unchanged",
    "produktbudget.stand.geaendert": "Version {{fassung}} · {{datum}} · account {{von}}",
    "produktbudget.abgeloest":
      "Replaces the earlier recommendation of {{betrag}} per month for this PoC.",
    "produktbudget.frageOffen":
      "Split and period have been asked about and are not yet answered. Until then this budget releases nothing.",
    "produktbudget.speichern": "Save",
    "produktbudget.gespeichert": "Saved.",
    "produktbudget.gespeichertWeitere":
      "The sent change is saved. Your further input is not saved yet.",
    "produktbudget.unveraendert": "No change — the status is the same.",
    "produktbudget.konfliktUebernehmen": "Apply my input to the new status",
    "produktbudget.verlaufZeile": "{{datum}} · account {{von}}: {{vorher}} → {{nachher}}",
    "produktbudget.fehler.bereich": "This budget area does not exist.",
    "produktbudget.fehler.betrag":
      "Please enter an amount from 0 with at most two decimals (at most 10000).",
    "produktbudget.fehler.waehrung": "Please choose EUR or USD.",
    "produktbudget.fehler.waehrung_gebunden":
      "Costs are already booked for this budget. The currency stays bound to these bookings.",
    "produktbudget.fehler.zeitraum": "Please choose a period.",
    "produktbudget.fehler.grund":
      "Whoever sets an open period names the evidence (at most 200 characters, one line).",
    "produktbudget.fehler.aenderung": "The change could not be matched. Please save again.",
    "produktbudget.fehler.konflikt":
      "This budget has changed in the meantime. Your input is kept; please check the new status.",
    "produktbudget.fehler.unklar":
      "It is unclear whether it was saved. Your input is kept; saving again takes effect at most once.",
  },
  nl: {
    "produktbudget.titel": "Productbudgetten",
    "produktbudget.syn": "budget kosten kostenplafond Perplexity Claude ChatGPT",
    "produktbudget.hilfe":
      "Hier staan de budgetten die Klarwerk aanhoudt voor betaalde aanroepen van Claude, ChatGPT en Perplexity. Geboekte en gereserveerde kosten tellen mee tegen het bedrag; is het bereikt of de periode open, dan start geen betaalde aanroep. Ander werk blijft mogelijk.",
    "produktbudget.ehrlichkeit":
      "Een budgetwijziging is geen opwaardering bij de aanbieder, geen accountwissel en geen nieuwe tokenvrijgave. Reeds geboekte kosten blijven staan en zichtbaar.",
    "produktbudget.bereich.perplexity-poc": "Perplexity · PoC",
    "produktbudget.bereich.nr32-claude": "Claude · proeven bij nr. 32",
    "produktbudget.bereich.nr32-chatgpt": "ChatGPT · proeven bij nr. 32",
    "produktbudget.geltung.perplexity-poc": "Perplexity-onderzoek in de PoC (BPA-12)",
    "produktbudget.geltung.nr32-claude": "Claude-proeven bij nr. 32 (P03)",
    "produktbudget.geltung.nr32-chatgpt": "ChatGPT-proeven bij nr. 32 (P03)",
    "produktbudget.anbieter.perplexity": "Perplexity",
    "produktbudget.anbieter.anthropic": "Claude (Anthropic)",
    "produktbudget.anbieter.openai": "ChatGPT (OpenAI)",
    "produktbudget.feld.anbieter": "Aanbieder",
    "produktbudget.feld.geltung": "Toepassingsgebied",
    "produktbudget.feld.betrag": "Bedrag",
    "produktbudget.feld.waehrung": "Valuta",
    "produktbudget.feld.zeitraum": "Periode",
    "produktbudget.feld.verbraucht": "Verbruikt",
    "produktbudget.feld.reserviert": "Gereserveerd",
    "produktbudget.feld.verbleibend": "Resterend",
    "produktbudget.feld.ueberschritten": "Boven het bedrag",
    "produktbudget.feld.kostenweg": "Betaalde aanroepen",
    "produktbudget.feld.stand": "Stand",
    "produktbudget.feld.grund": "Reden of bewijs",
    "produktbudget.zeitraum.einmalig": "eenmalig, zonder verlenging",
    "produktbudget.zeitraum.offen": "open — nog niet vastgelegd",
    "produktbudget.kostenweg.offen": "mogelijk binnen het restant",
    "produktbudget.sperre.zeitraum_offen": "geblokkeerd — periode open",
    "produktbudget.sperre.null_budget": "geblokkeerd — bedrag 0",
    "produktbudget.sperre.ausgeschoepft": "geblokkeerd — budget op",
    "produktbudget.stand.vorgabe": "Oorspronkelijke opdracht van 13-10-2026, ongewijzigd",
    "produktbudget.stand.geaendert": "Versie {{fassung}} · {{datum}} · account {{von}}",
    "produktbudget.abgeloest":
      "Vervangt de eerdere aanbeveling van {{betrag}} per maand voor deze PoC.",
    "produktbudget.frageOffen":
      "Verdeling en periode zijn gevraagd en nog niet beantwoord. Tot dan geeft dit budget niets vrij.",
    "produktbudget.speichern": "Opslaan",
    "produktbudget.gespeichert": "Opgeslagen.",
    "produktbudget.gespeichertWeitere":
      "De verzonden wijziging is opgeslagen. Je verdere invoer is nog niet opgeslagen.",
    "produktbudget.unveraendert": "Geen wijziging — de stand is dezelfde.",
    "produktbudget.konfliktUebernehmen": "Invoer op de nieuwe stand betrekken",
    "produktbudget.verlaufZeile": "{{datum}} · account {{von}}: {{vorher}} → {{nachher}}",
    "produktbudget.fehler.bereich": "Dit budgetgebied bestaat niet.",
    "produktbudget.fehler.betrag":
      "Voer een bedrag vanaf 0 in met hoogstens twee decimalen (hoogstens 10000).",
    "produktbudget.fehler.waehrung": "Kies EUR of USD.",
    "produktbudget.fehler.waehrung_gebunden":
      "Voor dit budget zijn al kosten geboekt. De valuta blijft aan deze boekingen gebonden.",
    "produktbudget.fehler.zeitraum": "Kies een periode.",
    "produktbudget.fehler.grund":
      "Wie een open periode vastlegt, noemt het bewijs (hoogstens 200 tekens, één regel).",
    "produktbudget.fehler.aenderung": "De wijziging kon niet worden herkend. Sla opnieuw op.",
    "produktbudget.fehler.konflikt":
      "Dit budget is intussen gewijzigd. Je invoer blijft behouden; controleer de nieuwe stand.",
    "produktbudget.fehler.unklar":
      "Onduidelijk is of er is opgeslagen. Je invoer blijft behouden; opnieuw opslaan werkt hoogstens één keer.",
  },
} satisfies Textmodul;
