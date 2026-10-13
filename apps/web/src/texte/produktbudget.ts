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
      "Zeitraum offen: dieses Budget gibt nichts frei, bis die Verwaltung einen Zeitraum festlegt.",
    "produktbudget.vonVorgabe": "Vorgabe Peter 13.10.2026",
    "produktbudget.zuweisung.titel": "Zuweisungen je Konto",
    "produktbudget.zuweisung.keine":
      "Kein Konto mit eigener Zuweisung oder Belegung — für alle gilt der Gesamtbetrag.",
    "produktbudget.zuweisung.zeile":
      "{{konto}}: Zuweisung {{zuweisung}} · eigenes Unterlimit {{unterlimit}} · belegt {{belegt}}",
    "produktbudget.zuweisung.ohne": "keine (Gesamtbetrag)",
    "produktbudget.zuweisung.konto": "Konto",
    "produktbudget.zuweisung.betrag": "Zuweisung",
    "produktbudget.zuweisung.speichern": "Zuweisung speichern",
    "produktbudget.zuweisung.aufheben": "Zuweisung aufheben",
    "produktbudget.unterlimit.ohne": "keins",
    "produktbudget.eigen.titel": "Mein Budget für kostenpflichtige Aufrufe",
    "produktbudget.eigen.hinweis":
      "Dein Unterlimit gilt nur für dich und höchstens bis zur erlaubten Zuweisung. Gesamtbudget und Zuweisungen ändert die Verwaltung.",
    "produktbudget.eigen.kopf": "{{bereich}} · {{betrag}} · {{zeitraum}}",
    "produktbudget.eigen.zuweisung": "Erlaubte Zuweisung",
    "produktbudget.eigen.belegt": "Von mir belegt",
    "produktbudget.eigen.verbleibend": "Für mich verbleibend",
    "produktbudget.eigen.unterlimit": "Mein Unterlimit",
    "produktbudget.eigen.speichern": "Unterlimit speichern",
    "produktbudget.eigen.aufheben": "Unterlimit aufheben",
    "produktbudget.fehler.konto": "Dieses Konto gibt es nicht.",
    "produktbudget.fehler.zuweisung": "Die Zuweisung darf höchstens den Gesamtbetrag erreichen.",
    "produktbudget.fehler.unterlimit":
      "Das Unterlimit darf höchstens die erlaubte Zuweisung erreichen.",
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
      "Period open: this budget releases nothing until the administration sets a period.",
    "produktbudget.vonVorgabe": "Peter's instruction of 13 Oct 2026",
    "produktbudget.zuweisung.titel": "Allocations per account",
    "produktbudget.zuweisung.keine":
      "No account with its own allocation or usage — the total amount applies to everyone.",
    "produktbudget.zuweisung.zeile":
      "{{konto}}: allocation {{zuweisung}} · own sub-limit {{unterlimit}} · used {{belegt}}",
    "produktbudget.zuweisung.ohne": "none (total amount)",
    "produktbudget.zuweisung.konto": "Account",
    "produktbudget.zuweisung.betrag": "Allocation",
    "produktbudget.zuweisung.speichern": "Save allocation",
    "produktbudget.zuweisung.aufheben": "Remove allocation",
    "produktbudget.unterlimit.ohne": "none",
    "produktbudget.eigen.titel": "My budget for paid calls",
    "produktbudget.eigen.hinweis":
      "Your sub-limit applies only to you and at most up to the allowed allocation. The administration changes the total budget and allocations.",
    "produktbudget.eigen.kopf": "{{bereich}} · {{betrag}} · {{zeitraum}}",
    "produktbudget.eigen.zuweisung": "Allowed allocation",
    "produktbudget.eigen.belegt": "Used by me",
    "produktbudget.eigen.verbleibend": "Remaining for me",
    "produktbudget.eigen.unterlimit": "My sub-limit",
    "produktbudget.eigen.speichern": "Save sub-limit",
    "produktbudget.eigen.aufheben": "Remove sub-limit",
    "produktbudget.fehler.konto": "This account does not exist.",
    "produktbudget.fehler.zuweisung": "The allocation may at most reach the total amount.",
    "produktbudget.fehler.unterlimit": "The sub-limit may at most reach the allowed allocation.",
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
      "Periode open: dit budget geeft niets vrij totdat het beheer een periode vastlegt.",
    "produktbudget.vonVorgabe": "Opdracht Peter 13-10-2026",
    "produktbudget.zuweisung.titel": "Toewijzingen per account",
    "produktbudget.zuweisung.keine":
      "Geen account met eigen toewijzing of gebruik — voor iedereen geldt het totaalbedrag.",
    "produktbudget.zuweisung.zeile":
      "{{konto}}: toewijzing {{zuweisung}} · eigen sublimiet {{unterlimit}} · gebruikt {{belegt}}",
    "produktbudget.zuweisung.ohne": "geen (totaalbedrag)",
    "produktbudget.zuweisung.konto": "Account",
    "produktbudget.zuweisung.betrag": "Toewijzing",
    "produktbudget.zuweisung.speichern": "Toewijzing opslaan",
    "produktbudget.zuweisung.aufheben": "Toewijzing opheffen",
    "produktbudget.unterlimit.ohne": "geen",
    "produktbudget.eigen.titel": "Mijn budget voor betaalde aanroepen",
    "produktbudget.eigen.hinweis":
      "Je sublimiet geldt alleen voor jou en hoogstens tot de toegestane toewijzing. Het beheer wijzigt totaalbudget en toewijzingen.",
    "produktbudget.eigen.kopf": "{{bereich}} · {{betrag}} · {{zeitraum}}",
    "produktbudget.eigen.zuweisung": "Toegestane toewijzing",
    "produktbudget.eigen.belegt": "Door mij gebruikt",
    "produktbudget.eigen.verbleibend": "Voor mij resterend",
    "produktbudget.eigen.unterlimit": "Mijn sublimiet",
    "produktbudget.eigen.speichern": "Sublimiet opslaan",
    "produktbudget.eigen.aufheben": "Sublimiet opheffen",
    "produktbudget.fehler.konto": "Dit account bestaat niet.",
    "produktbudget.fehler.zuweisung": "De toewijzing mag hoogstens het totaalbedrag bereiken.",
    "produktbudget.fehler.unterlimit":
      "De sublimiet mag hoogstens de toegestane toewijzing bereiken.",
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
