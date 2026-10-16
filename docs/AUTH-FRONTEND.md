# Windows-98-Anmeldung und eigenes Kontaktprofil

Stand 16.10.2026; Backend-Vertrag aus
`03030cce4409eec9a347998feeea71062affd5fb`.
Siehe [Kompatibilitaetspruefung und Risiken](CENTRAL-USER-MODEL.md),
[API-Vertrag](AUTH_API_CONTRACT.md),
[Migrationsplan und Profilvertrag](USER_MODEL_MIGRATION.md) und
[Browser-Abnahme](BROWSER-ACCEPTANCE.md).

## Konfiguration und Architektur

React 19, TypeScript 4.9, CRA, 98.css; bestehender WindowManager und Desktop.
Credentialed Fetch statt eines neuen Auth-SDKs; keine neuen Abhaengigkeiten.
Produktion: `https://api.mueller-it-mkk.de/games/api/v1/auth`.
Unter npm start auf localhost: `http://localhost:3001/api/v1/auth`.
Abweichende Basis ueber `REACT_APP_AUTH_API_BASE_URL` setzen und neu bauen.
Profilbasis wird durch Entfernen des abschliessenden `/auth` abgeleitet;
kein zweites Login oder separates Sessioncookie. HTTP nur lokal in Entwicklung.
Ungueltige Konfiguration deaktiviert die Anbindung.

## Verhalten

- Registrierung: Benutzername als `name`, E-Mail, Passwort (12-128 Zeichen),
  lokale Passwortbestaetigung. Name 1-64 Zeichen, ohne Leer-/Steuerzeichen
  oder spitze Klammern; unveraenderte Schreibweise, keine Eindeutigkeit.
  POST-Erfolg verweist immer auf den Posteingang, behauptet keine Session.
- Login: nur E-Mail/Passwort mit rememberMe oder Discord. Nach Login Cookie-
  Session separat pruefen, keine Tokens aus dem Login-Body uebernehmen.
- Anzeige aus `user.name`; stabile Benutzer-ID im Konto. Name nicht editierbar.
  Keine Profilbild-Aenderung: Backend sperrt saemtliche update-user-Aufrufe.
- Sechs optionale Kontakte nur im eigenen angemeldeten, verifizierten Konto.
  Lesen, Bearbeiten, Speichern, Feldvalidierung und Wiederholen nach Fehlern.
  Leere Werte werden durch null geloescht; weitere Backend-Kontakte unberuehrt.
- Discord-Verknuepfung nur explizit bei bestaetigter E-Mail; letzte Loginmethode
  nicht entfernbar, erneute Anmeldung bei unfrischer Session moeglich.
- Registrierung, Verifikationsmail und Reset geben keine Kontoexistenz preis.
  SMTP-503 gibt einen Hinweis auf ein moeglicherweise bereits angelegtes Konto.
- Rueckkehrpfade: `/auth/verified`, `/auth/error`, `/auth/callback`,
  `/reset-password`, `/settings/accounts`. Statische Einstiegspunkte erstellt
  der postbuild-Schritt. Querydaten werden aus der URL entfernt, Reset-Token
  nur temporaer im Speicher. Verifikation ist kein automatischer Login.
- Klassische Erfolgs-, Warn-, Fehler- und Hinweisfenster; keine Browser-Alerts.

## Sessions und Fehler

Beim Start/Reload get-session, ebenso bei Fokus und alle 60 Sekunden sichtbar.
Session-Ende durch 200 null, explizites SESSION_EXPIRED, HTTP 401 auf geschuetzten
Anfragen oder bekannte Ablaufzeit. Netzwerk, 429 und 5xx beenden eine noch
nicht abgelaufene Session nicht. Login-401 bleibt ein Zugangsdatenfehler.
403, Validierung, Rate-Limit und Serverfehler erhalten sichere eigene Meldungen.
Keine ungeprueften Servernachrichten oder Provider-/SMTP-Details anzeigen.
Timeouts: Session/Profile lesen 10s, schreibende Aktionen 15s. Nach Fehlern
erneute Versuche moeglich; Retry-After wird respektiert.

Auth und Profil verwenden credentials include, no-store und redirect error.
Keine Bearer-Tokens, keine Speicherung von Session/Kontaktprofil im Browser-
Storage. OEffentliche Gameserver-Anfragen bleiben credentials omit und vom
Auth-Status unabhaengig. Backend setzt/erneuert HttpOnly-Cookies; das Frontend
liest keine Cookie-Werte. Die Rollenanzeige ist keine Autorisierung.

## Validierung

`npx.cmd tsc --noEmit`

`node node_modules/react-scripts/bin/react-scripts.js test --watchAll=false --runInBand`

`npm.cmd run build`

Browser-Abnahme und produktive Infrastruktur separat pruefen. Ein Build allein
veroeffentlicht nichts; weder deploy noch Push sind Teil dieser Arbeit.
