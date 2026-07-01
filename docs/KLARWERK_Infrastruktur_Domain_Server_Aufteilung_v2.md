# KLARWERK Infrastruktur- und Domain-Aufteilung

**Dokumenttyp:** Wissensdatei / Architektur- und Betriebsdokumentation  
**Projekt:** KLARWERK  
**Stand:** 2026-06-29  
**Zweck:** Dokumentation der geplanten Aufteilung von öffentlicher Webseite, Produktinstanzen, Business Backend und Local-LLM-Infrastruktur.

---

## 1. Grundsatzentscheidung

KLARWERK wird in klar getrennte Betriebsbereiche aufgeteilt:

| Bereich | Domain / Subdomain | Zweck | Verantwortlicher Strang |
|---|---|---|---|
| Öffentliche Webseite | `klarwerk.ai`, `www.klarwerk.ai` | Marketing, Landingpage, Kontakt, Pitch, Demo-Anfrage | Website / Go-to-Market |
| Produkt / Kundenanwendung | `app.klarwerk.ai` | KLARWERK Knowledge OS, Demo, Kundeninstanzen | Team 1 |
| Business Backend / Ops | `ops.klarwerk.ai` | Kunden-, Pilot-, Lizenz-, Support- und Betriebsmetadaten | Team 3 |
| Local LLM / On-Prem AI | `ai.klarwerk.ai` / `llm.klarwerk.ai` reserviert; später kundenspezifisch | Lokale KI-Infrastruktur, Modelladapter, On-Prem-Optionen | Team 2 |

Die zentrale Regel lautet:

> **Marketing-Webseite, Produktinstanzen und Business Backend werden logisch und technisch getrennt.**

---

## 2. Öffentliche Webseite

### Domain

```text
klarwerk.ai
www.klarwerk.ai
```

### Hosting

Die öffentliche Business-/Marketing-Webseite darf initial bei **GoDaddy** laufen.

### Zweck

Die Webseite dient ausschließlich der öffentlichen Darstellung von KLARWERK:

- Landingpage
- Problem / Lösung
- Use Cases
- Kontakt / Demo-Anfrage
- Investor-/Pitch-Bereich
- später ggf. Blog / Updates

### Nicht-Zweck

Auf der GoDaddy-Webseite dürfen nicht liegen:

- Kundendaten
- Kundenlogins
- Knowledge Objects
- Kundendokumente
- Business Backend
- Ops-System
- interne Admin-Funktionen
- produktive KI-/LLM-Funktionen

### Begründung

GoDaddy ist für die öffentliche Webseite ausreichend, weil dort nur öffentliches Marketing liegt. Kritische Produkt- und Betriebsdaten werden nicht dort betrieben.

---

## 3. Produkt / Kundenanwendung

### Subdomain

```text
app.klarwerk.ai
```

### Zweck

`app.klarwerk.ai` ist für die eigentliche KLARWERK-Anwendung reserviert:

- Knowledge OS
- Capture
- Library
- Ask
- Validation
- Lifecycle / Revalidation
- Knowledge Objects
- Quellen / Evidenzen
- Kundenwissen

### Mögliche spätere Struktur

```text
app.klarwerk.ai
demo.app.klarwerk.ai
kunde-a.app.klarwerk.ai
kunde-b.app.klarwerk.ai
```

Für Enterprise-/On-Prem-Kunden ist auch eine kundeneigene Domain möglich:

```text
klarwerk.kunde.de
```

### Abgrenzung

Die Produktinstanz ist **nicht** die Marketing-Webseite und **nicht** das zentrale Ops-Backend.

---

## 4. Business Backend / Ops

### Subdomain

```text
ops.klarwerk.ai
```

### Verantwortlicher Strang

```text
Team 3 = Business Backend / Pilot Operations / Commercial Readiness
```

### Zweck

Das Business Backend verwaltet nur kommerzielle, operative und installationsbezogene Metadaten:

- Kunden-Metadaten
- Pilotstatus
- Lizenzstatus
- Instanzstatus
- Supportstatus
- Deployment-Informationen
- technische Ansprechpartner
- Commercial / Billing / Contract-Metadaten
- Go/No-Go / Readiness / Evidence / Risk / Decisions
- Betriebsnotizen ohne Kundengeheimnisse

### Strikt ausgeschlossene Daten

In `ops.klarwerk.ai` dürfen nicht gespeichert werden:

- Kundendokumente
- Knowledge Objects
- Produktionswissen
- Prompts mit Kundendaten
- Modellantworten
- Produktionslogs
- Secrets
- Tokens
- private Keys
- Zahlungsdaten
- vollständige Vertragstexte
- Modellartefakte
- Team-1-/Team-2-Daten ohne explizite Übergabe

### Grundsatz

> Das Business Backend weiß, **dass** ein Kunde, eine Instanz oder ein Pilot existiert.  
> Es speichert aber nicht das eigentliche Unternehmenswissen des Kunden.

---

## 5. Server-Aufteilung

Die Zielstruktur lautet:

| Server / Plattform | Zweck |
|---|---|
| GoDaddy | Öffentliche Webseite `klarwerk.ai` / `www.klarwerk.ai` |
| Separater Hetzner Cloud Server | `ops.klarwerk.ai` / Team 3 Business Backend |
| Separate Produktumgebung | `app.klarwerk.ai` / Team 1 Produktinstanz |
| Separate Local-LLM-Umgebung | Team 2 / Local LLM / On-Prem AI |

### Begründung für separaten Ops-Server

Ein separater Server für `ops.klarwerk.ai` ist sinnvoll, weil:

- klare technische Trennung
- geringeres Sicherheitsrisiko
- getrennte Backups
- getrennte Zugriffsrechte
- getrennte Deployments
- keine spätere komplizierte Entflechtung von Website, Demo und Business Backend
- bessere Erklärbarkeit gegenüber Kunden und Investoren

---

## 6. Hetzner-Ops-Server

### Servername

```text
klarwerk-ops-01
```

### Ziel-Domain

```text
ops.klarwerk.ai
```

### Zweck

```text
Business Backend / Pilot Operations / Customer Operations
```

### Aktueller Status

Zum aktuellen Stand wurde der Hetzner-Ops-Server vorbereitet:

- Server erstellt
- SSH funktioniert
- Updates ausgeführt
- Reboot erledigt
- Admin-User `klarwerk` wurde begonnen / eingerichtet
- Server-Härtung noch offen
- kein DNS gesetzt
- kein Docker installiert
- kein Deployment durchgeführt

### Geplante Härtung

Vor DNS-/Deployment-Freigabe müssen noch erfolgen:

- SSH absichern
- Root-Login deaktivieren
- Passwort-Login deaktivieren, sofern SSH-Key-only stabil läuft
- Firewall finalisieren
- Fail2ban installieren
- Backups prüfen / aktivieren
- Logging-Grundlage prüfen
- Zeitzone setzen
- nur danach: DNS `ops.klarwerk.ai` setzen

---

## 7. DNS-Zielstruktur

Die Domainstruktur soll wie folgt vorbereitet werden:

```text
klarwerk.ai        → GoDaddy Webseite
www.klarwerk.ai    → GoDaddy Webseite

app.klarwerk.ai    → Produkt-/Demo-/Kunden-App Server
ops.klarwerk.ai    → Hetzner Ops Server

ai.klarwerk.ai     → reserviert für Team 2 / interne KI-Tests / AI-Gateway, nicht öffentlich aktiv
llm.klarwerk.ai    → reserviert für Team 2 / Local-LLM-Infrastruktur, nicht öffentlich aktiv

api.klarwerk.ai    → reserviert
docs.klarwerk.ai   → reserviert
status.klarwerk.ai → reserviert
```

### Wichtig

DNS für `ops.klarwerk.ai` wird erst gesetzt, wenn der Hetzner-Ops-Server gehärtet ist.

### Team-2-Domains / interne KI

Für Team 2 werden eigene Subdomains reserviert, aber zunächst **nicht produktiv aktiviert**:

```text
ai.klarwerk.ai
llm.klarwerk.ai
```

Diese Subdomains sind nur als technische Reserve vorgesehen, zum Beispiel für:

- interne KI-/AI-Gateway-Tests
- Modelladapter-/LLM-Infrastruktur
- spätere nicht-öffentliche Team-2-Testumgebung
- mögliche Anbindung an Produktinstanzen nach expliziter Freigabe

Wichtig:

- `ai.klarwerk.ai` / `llm.klarwerk.ai` sind **nicht** die öffentliche Webseite.
- Sie sind **nicht** das Business Backend.
- Sie sind **nicht** die Source of Truth.
- Sie dürfen keine Kundendokumente, Knowledge Objects oder produktionssensiblen Inhalte verarbeiten, solange keine explizite Freigabe und Architekturentscheidung vorliegt.
- Für Kunden-On-Prem-Szenarien kann die KI später auch kundenspezifisch laufen, z. B. als lokaler AI Node beim Kunden oder unter einer kundeneigenen Domain.

---

## 8. Team-Zuordnung

### Team 1 — Produktkern / Knowledge OS

Team 1 verantwortet:

- KLARWERK Hauptanwendung
- Capture
- Library
- Ask
- Validation
- Lifecycle
- Knowledge Objects
- Quellen / Evidenzen
- Produkt-/Pilot-Workflow

Team 1 arbeitet im Produktrepo:

```text
Klarwerkai/klarwerk
```

### Team 2 — Local LLM / On-Prem AI

Team 2 verantwortet:

- lokale KI-Infrastruktur
- Modelladapter
- Local LLM
- On-Prem-Optionen
- Modell-/Memory-Watchlist
- keine produktiven Kundendaten

Team 2 arbeitet im Repo:

```text
Klarwerkai/klarwerk-local-llm
```

### Team 3 — Business Backend / Pilot Operations

Team 3 verantwortet:

- Business Backend
- Pilot Operations
- Commercial Readiness
- Customer / Tenant / Instance / License / Support Metadaten
- Readiness, Risk, Evidence, Decisions
- `ops.klarwerk.ai`

Team 3 arbeitet im Repo:

```text
Klarwerkai/klarwerk-business-backend
```

---

## 9. Wichtige Architekturregel

KLARWERK verfolgt ein Hybrid-Modell:

```text
klarwerk.ai
= öffentliche Webseite / Marketing

app.klarwerk.ai
= Produkt / Kundenanwendung / Knowledge OS

ops.klarwerk.ai
= zentrale Business-/Ops-Control-Plane

ai.klarwerk.ai / llm.klarwerk.ai
= reserviert für Team 2 / interne KI-Tests / AI-Gateway, nicht öffentlich aktiv

Team 2 / Local LLM
= separat, später optional je Kunde / Instanz integrierbar
```

Die zentrale Business-/Ops-Control-Plane speichert nur Metadaten. Das eigentliche Kundenwissen bleibt in der jeweiligen Produkt-/Kundeninstanz.

---

## 10. Begründung für Kunden und Investoren

Diese Struktur ist strategisch gut erklärbar:

> KLARWERK verwaltet Kundenwissen nicht zentral in der Ops-Ebene.  
> Die zentrale Ops-Ebene verwaltet nur Lizenz, Betrieb, Support, Pilotstatus und Metadaten.  
> Das Unternehmenswissen bleibt in der Kundeninstanz.

Das unterstützt:

- Vertrauen
- Datenschutz
- Enterprise-Fähigkeit
- On-Prem-Argumentation
- klare Sicherheitsarchitektur
- saubere spätere Skalierung

---

## 11. Aktuell empfohlene nächsten Schritte

### Kurzfristig

1. Team 1 weiter mit produktnahem Workflow-Slice.
2. Team 3 weiter mit First Paid Pilot Readiness / Decision Closure.
3. Ops-Server später härten.
4. Noch keine DNS-Umstellung für `ops.klarwerk.ai`.
5. Noch kein Docker / Deployment auf dem Ops-Server.

### Vor `ops.klarwerk.ai` Live-Schaltung

- SSH-Härtung abgeschlossen
- Root-Login deaktiviert
- Firewall aktiv
- Fail2ban aktiv
- Backups geprüft
- DNS gesetzt
- TLS eingerichtet
- minimaler Reverse Proxy vorbereitet
- erst danach Business-Backend-Deployment

---

## 12. Zusammenfassung

```text
klarwerk.ai
= GoDaddy / Marketing / öffentlich

app.klarwerk.ai
= Team 1 / Produkt / Kundenanwendung

ops.klarwerk.ai
= Team 3 / Business Backend / separater Hetzner Server

ai.klarwerk.ai / llm.klarwerk.ai
= Team 2 / reserviert für interne KI-/Local-LLM-Infrastruktur

Team 2
= Local LLM / On-Prem AI / separat, später optional kundenspezifisch
```

Die Entscheidung für getrennte Bereiche ist bewusst getroffen worden, um spätere Entflechtung zu vermeiden, Sicherheitsrisiken zu reduzieren und das System gegenüber Kunden und Investoren professionell erklären zu können.
