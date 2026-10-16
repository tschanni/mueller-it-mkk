# Zentrales Benutzermodell: Kompatibilitaet und Integration

Stand: 16.10.2026. Backend: `tschanni/Gameserver_Dashboard`, Branch `main`.
Gepruefter Commit: **03030cce4409eec9a347998feeea71062affd5fb**.
`git fetch origin main` hat den Remote-Tracking-Branch auf genau diesen SHA
aktualisiert; `git rev-parse 03030cc^{commit}` stimmt damit ueberein.
Die vorherigen lokalen Frontend-Aenderungen waren bereits eingecheckt;
der Arbeitsbaum war beim Beginn dieser Integration sauber.

[AUTH_API_CONTRACT.md](AUTH_API_CONTRACT.md) und
[USER_MODEL_MIGRATION.md](USER_MODEL_MIGRATION.md) sind unveraenderte Kopien
aus diesem Commit. Zusaetzlich wurden `src/auth/auth.service.ts`,
`src/profile/profile.module.ts`, `src/common/http.ts` und das Prisma-Schema
im selben Commit zur Pruefung von Validierung und Antwortformat gelesen.

## Kompatibilitaetspruefung vor der Integration

| Bereich | Befund und Umsetzung |
| --- | --- |
| Auth-Basis | Unveraendert `/games/api/v1/auth`, lokal `/api/v1/auth` |
| Registrierung | POST `/sign-up/email` mit `name`, `email`, `password`, `callbackURL`; keine Username-Plugin-Felder; Name unveraendert in Gross-/Kleinschreibung |
| Namen | 1 bis 64 Zeichen, keine Leer-/Steuerzeichen oder spitzen Klammern; doppelte Namen erlaubt; Identitaet ausschliesslich `user.id` |
| Login | E-Mail/Passwort oder Discord; bestehender Cookie-/Callback-Ablauf kompatibel |
| Profil | GET/POST `/games/api/v1/me/profile`, ausserhalb der Auth-Basis; gleiche Cookies; nur eigene verifizierte Session |
| Antworten | GET `{ profile: null }` oder `{ profile: Profile }`; POST 201 mit direktem `Profile` |
| Loeschen | POST ist Teilaktualisierung; leere Formularfelder werden explizit als `null` gesendet |
| Schreibschutz | `/update-user` ist vollstaendig deaktiviert, auch fuer Bilder. Namenseditor bleibt entfernt; Bildeditor wurde entfernt, bestehendes Bild bleibt sichtbar |
| Rollen | `MAINTAINER` wird als Rolle erhalten und angezeigt; unbekannte Rollen bleiben `USER`. Keine neue Verwaltungsoberflaeche oder Admin-API-Aufrufe |
| Fehler | Nest-400 enthaelt nur `Invalid request`, keine Feldfehler. Feldhinweise folgen den geprueften DTO-Regeln; Server-400 erzeugt eine allgemeine sichere Validierungsmeldung |

Vertragswiderspruch: Der Absatz zu Discord-only-Benutzern empfiehlt noch eine
Namenswahl ueber `/update-user`; auch die Fehlertabelle enthaelt einen alten
Username-Eindeutigkeitsfehler. Das widerspricht dem ausdruecklichen neuen
Namensmodell, der Endpunkttabelle, dem Migrationsplan und dem Backend-Hook
(`USER_UPDATE_DISABLED`). Es werden weder Namensaenderung noch Eindeutigkeits-
pruefung implementiert. Die Quellkopie bleibt fuer Nachvollziehbarkeit unveraendert.

## Profil und Datenschutz

Die sechs beauftragten Felder sind `firstName`, `lastName`, `street`,
`houseNumber`, `postalCode`, `city`. Die Laengen und Zeichenregeln entsprechen
dem DTO. PLZ ist immer Text, inklusive fuehrender Nullen und internationaler
Zeichen. Alle Felder koennen leer bleiben. `countryCode`, `phone`, `contactEmail`
werden weder angezeigt noch gesendet, daher bei Teilaktualisierung nicht geloescht.
Antworten werden auf sechs Kontaktfelder sowie `userId`/`updatedAt` reduziert.

Keine Benutzer-ID im Request-Body, kein Admin-Profilpfad. Das Backend waehlt die
Identitaet aus der Session. Das Frontend prueft die Antwort-ID zusaetzlich.
Profile sind nicht Teil der Session und werden nur im angemeldeten, verifizierten
Kontofenster geladen. Keine Speicherung in Local-/SessionStorage. Logout,
Sessionende, Kontowechsel und Schliessen entfernen den lokalen Formularzustand.
Abgebrochene/veraltete Antworten duerfen keine Daten oder Fehler in ein anderes
Konto uebertragen, auch nicht bei gleicher Namensanzeige.

GET-Timeout 10 Sekunden, Save-Timeout 15 Sekunden; ein fehlgeschlagenes Laden
sperrt das Speichern bis zum erfolgreichen erneuten Laden. Validierungs-,
Netzwerk- und Serverfehler erhalten den Entwurf. Erfolg wird erst nach validierter
Serverantwort angezeigt. Doppelte Submissions werden verhindert.

## Verbleibende Integrationsrisiken

- Kein Mischbetrieb mit altem Backend. Ob der gepruefte Commit produktiv laeuft,
  wurde nicht durch schreibende Produktionsanfragen getestet.
- Proxy muss GET/POST/OPTIONS fuer `/games/api/v1/me/profile` explizit erlauben;
  die Auth-Allowlist reicht nicht. Keine Proxy-Aenderung hier vorgenommen.
- CORS mit konkreter Frontend-Origin, Credentials und korrektem OPTIONS;
  Auth-/Profilantworten nicht cachen; Set-Cookie unveraendert weiterreichen.
  API-Cookie host-only, HttpOnly, Secure, SameSite=Lax. Nur same-site HTTPS-
  Subdomains bzw. ein passendes lokales Backend verwenden.
- Migration `202610160001_user_contact_profile` nach dem Migrationsplan separat
  freigeben, Backup/Restore und Altbestand pruefen. Kein DB-Zugriff oder Migration
  durch diese Frontend-Arbeit. Discord-only-Altname muss ggf. autorisiert
  abgeglichen werden; kein Erraten oder Frontend-Ueberschreiben.
- Echte SMTP-Zustellung, Discord-OAuth sowie Browser-Cookies/CORS sind noch
  manuell abzunehmen. SMTP-503 kann ein bereits angelegtes Konto hinterlassen;
  die UI verweist auf erneute Verifikationsmail.
- Kein ETag-/Versionskonfliktvertrag: gleichzeitige Bearbeitung in zwei Tabs
  kann zuletzt geschriebene Feldwerte uebernehmen. Bei verlorener Save-Antwort
  kann serverseitig bereits gespeichert worden sein; die UI behauptet keinen Erfolg.
- Frontend-Tests mit HTTP-/Adapter-Mocks belegen keine serverseitige Isolation;
  diese ist im Backend getestet und bei Browser-Abnahme erneut zu pruefen.

Keine Veroeffentlichung, kein Push, keine produktive Konfigurationsaenderung.
Der lokale Commit ist separat reviewbar. Main-Push loest die vorhandene
Deployment-Pipeline aus und benoetigt deshalb eine gesonderte Freigabe.
