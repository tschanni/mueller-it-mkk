# Auth API contract

Ergaenzend: [Privater Profilvertrag und Migrationsplan](USER_MODEL_MIGRATION.md).

Verbindlicher Integrationsvertrag für das separate React-Frontend. Stand: 16.10.2026.
Die Identität gehört zur gesamten Webseite **Müller IT MKK**. Der bestehende
`/games/api/v1/auth`-Pfad bleibt als kompatibler technischer Mount bestehen;
es gibt keinen zweiten Benutzerbestand und keine parallele Authentifizierung.
Implementiert mit Better Auth **1.7.10**, Prisma **6.19.0**, SQLite und NestJS **11** auf Express **5**. Die Anwendung verwendet nun ESM (`type: module`, TypeScript NodeNext); Node **22.13.0** wurde lokal geprüft. Node-Bereich des Projekts: >=22.13 <25. Keine zusätzliche Datenbank und kein Identity Provider erforderlich.

## Basis und HTTP-Konventionen

Produktion: `https://api.mueller-it-mkk.de/games/api/v1/auth`.
Hierfür `BETTER_AUTH_URL=https://api.mueller-it-mkk.de` und `URL_PATH_PREFIX=/games` setzen. Better Auth erhält den vollständigen `basePath` separat. Pfade unten sind relativ zur Auth-Basis. Die alten `/auth/login` und `/auth/me` sowie Benutzer-Bearer-JWTs entfallen.

JSON-Anfragen: `Content-Type: application/json`, Browser immer `credentials: 'include'`. Für schreibende Anfragen mit Session muss `Origin` einer konfigurierten Trusted Origin entsprechen; Browser setzen diesen Header selbst. Kein eigener CSRF-Token: Better Auth übernimmt Origin-, Fetch-Metadata-, OAuth-State- und Redirect-Prüfungen. Diese Prüfungen sind auch im Testmodus ausdrücklich aktiviert. Keine Wildcard-Origins. Auth-Antworten dürfen nicht gecacht werden (`Cache-Control: no-store`). Die offiziellen Bibliotheks-Endpunkte werden über `toNodeHandler` vor dem Express-JSON-Parser eingebunden, außerhalb von Nest-Controllern und Swagger. Nest-DTOs verändern ihre Request-Bodys nicht.

## Tatsächlich freigegebene Endpunkte

| Methode | Pfad                       | JSON-Body / Query                                                                                                                                                                                           | Erfolg                                                                                                                                     |
| ------- | -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| POST    | `/sign-up/email`           | `{ "name": "alex_1", "email": "alex@example.com", "password": "mindestens-12-Zeichen", "callbackURL": "https://www.mueller-it-mkk.de/auth/verified" }`                                                      | 200 `{ "token": null, "user": User }`; Verifikationsmail, noch keine Session                                                               |
| POST    | `/sign-in/email`           | `{ "email": "alex@example.com", "password": "…", "rememberMe": true }`; optional `callbackURL`                                                                                                              | 200 `{ "redirect": false, "token": "…", "user": User }`; bei `callbackURL` zusätzlich `url`, `redirect: true`, Location-Header             |
| POST    | `/sign-in/social`          | `{ "provider": "discord", "callbackURL": "https://www.mueller-it-mkk.de/auth/callback", "errorCallbackURL": "https://www.mueller-it-mkk.de/auth/error" }`; optional `newUserCallbackURL`, `disableRedirect` | 200 `{ "url": "https://discord.com/…", "redirect": true }`; Location-Header, OAuth-State-Cookie                                            |
| POST    | `/sign-out`                | `{}` mit Session-Cookie                                                                                                                                                                                     | 200 `{ "success": true }`; Datenbank-Session gelöscht, Cookie gelöscht                                                                     |
| GET     | `/get-session`             | kein Body                                                                                                                                                                                                   | 200 `{ "session": Session, "user": User }` oder **200 `null`**                                                                             |
| POST    | `/request-password-reset`  | `{ "email": "alex@example.com", "redirectTo": "https://www.mueller-it-mkk.de/reset-password" }`                                                                                                             | 200 `{ "status": true, "message": "If this email exists in our system, check your email for the reset link" }`, auch für unbekannte E-Mail |
| GET     | `/reset-password/:token`   | `?callbackURL=<URL-kodierte Frontend-Resetseite>`; bereits im Mail-Link enthalten                                                                                                                           | 302 zur Frontend-Resetseite mit `?token=…` oder `?error=INVALID_TOKEN`                                                                     |
| POST    | `/reset-password`          | `{ "token": "…", "newPassword": "neues-langes-Passwort" }`                                                                                                                                                  | 200 `{ "status": true }`; einmaliger Token verbraucht, alle bisherigen Sessions widerrufen                                                 |
| POST    | `/send-verification-email` | `{ "email": "alex@example.com", "callbackURL": "https://www.mueller-it-mkk.de/auth/verified" }`                                                                                                             | 200 `{ "status": true }`                                                                                                                   |
| GET     | `/verify-email`            | `?token=…&callbackURL=…` aus Mail                                                                                                                                                                           | 302 zur erlaubten Callback-URL, bei Fehler ggf. `?error=…`; ohne Callback kann die Bibliothek JSON zurückgeben                             |
| GET     | `/callback/discord`        | Discord setzt `code` und `state`, ggf. `error`                                                                                                                                                              | 302 zum erlaubten Frontend-Callback oder Fehlerziel; bei Erfolg Session-Cookie                                                             |
| POST    | `/link-social`             | `{ "provider": "discord", "callbackURL": "https://www.mueller-it-mkk.de/settings/accounts" }` mit Session                                                                                                   | 200 `{ "url": "https://discord.com/…", "redirect": true }`                                                                                 |
| GET     | `/list-accounts`           | Session-Cookie                                                                                                                                                                                              | 200 Array mit `id`, `providerId`, `accountId`, `userId`, `createdAt`, `updatedAt`, `scopes: string[]`; keine Passwörter oder OAuth-Tokens  |
| POST    | `/unlink-account`          | `{ "accountId": "<id aus list-accounts>" }` mit frischer Session                                                                                                                                            | 200 `{ "status": true }`; letztes Anmeldekonto kann nicht entfernt werden                                                                  |
| POST    | `/update-user`             | beliebiger Body                                                                                                                                                                                             | 400 `USER_UPDATE_DISABLED`                                                                                                                 |

Alle anderen Auth-Pfade und Methodenkombinationen werden serverseitig mit 404 abgewiesen. Insbesondere keine öffentlichen Provider-Token-APIs, kein Username-Login und keine eigenen JWT-Endpunkte. OPTIONS wird von CORS beantwortet.

`name` ist der verpflichtende Benutzername: 1-64 Zeichen, keine Leerzeichen, Steuerzeichen oder spitzen Klammern. Gross-/Kleinschreibung bleibt erhalten. Doppelte Namen sind erlaubt. Keine Felder `username` oder `displayUsername`. Keine Namensaenderung und kein Username-Login. Registrierung: name, email, password (12-128 Zeichen); role gewaehrt keine Rechte. Identitaet und Verknuepfungen verwenden IDs. Discord verwendet bei Anlage profile.username statt global_name. Lokale Namen werden beim Verknuepfen nicht ueberschrieben.

## Standard-Rückleitungen und Link-Laufzeiten

Die erste Origin in `CORS_ORIGINS` ist die primäre Webseite, in Produktion
`https://www.mueller-it-mkk.de`. Für ausgelassene Redirect-Felder ergänzt der
Backend-Hook diese Standardwerte; ausdrücklich gesendete URLs prüft weiterhin
Better Auth gegen seine Trusted Origins:

| Aufruf                            | Optionales Feld    | Standard unter der primären Origin |
| --------------------------------- | ------------------ | ---------------------------------- |
| Registrierung / Verifikationsmail | `callbackURL`      | `/auth/verified`                   |
| Reset-Anforderung                 | `redirectTo`       | `/reset-password`                  |
| Discord-Login                     | `callbackURL`      | `/auth/callback`                   |
| Discord-Verknüpfung               | `callbackURL`      | `/settings/accounts`               |
| Discord-Login / Verknüpfung       | `errorCallbackURL` | `/auth/error`                      |

Das Frontend muss diese Seiten bereitstellen. Der OAuth-Callback auf der API
ist davon getrennt: **`https://api.mueller-it-mkk.de/games/api/v1/auth/callback/discord`**.
Er entspricht exakt der vom Betreiber registrierten URI. Die bekannte
Discord-Client-ID ist `1560384435231391840`; der tatsächliche Wert wird wie das
Secret ausschließlich aus der Serverumgebung gelesen. Keine Client-ID ist im
Provider-Code hinterlegt. Lokale Callback-URIs müssen separat in Discord
registriert werden; deren Existenz wird hier nicht vorausgesetzt.

Verifikationslinks gelten **3600 Sekunden**, Passwortreset-Links **900 Sekunden**.
Better Auth erzeugt und prüft die Tokens. Reset-Tokens werden bei Benutzung
verbraucht; abgelaufene Tokens werden abgewiesen. Eine E-Mail-Verifikation ist
kein automatischer Login; danach erneut anmelden.

Discord fordert ausschließlich `identify` und `email` an. Zusätzliche Scopes
und nicht leere `additionalParams` werden mit 400 `OAUTH_OPTIONS_NOT_ALLOWED`
abgewiesen. Für neue Discord-Identitäten ist ebenfalls eine verifizierte
E-Mail erforderlich: Bei ungeprüfter Provider-E-Mail wird kein Login-Cookie
ausgestellt, eine Verifikationsmail verschickt und mit `email_not_verified`
zurückgeleitet. Konto/Providerkonto können dabei bereits angelegt sein.
Nach erfolgreicher lokaler Verifikation kann der Benutzer Discord erneut
aufrufen. Diese Prüfung nutzt Better Auths offizielle Provider-Option.

## User, Session und Rollen

Beispiel für GET `/get-session` (optionale Felder können null sein oder fehlen):

```json
{
  "user": {
    "id": "…",
    "name": "Alex",
    "email": "alex@example.com",
    "emailVerified": true,
    "image": null,
    "role": "USER",
    "createdAt": "2026-10-15T10:00:00.000Z",
    "updatedAt": "2026-10-15T10:00:00.000Z"
  },
  "session": {
    "id": "…",
    "token": "…",
    "userId": "…",
    "expiresAt": "2026-10-22T10:00:00.000Z",
    "createdAt": "2026-10-15T10:00:00.000Z",
    "updatedAt": "2026-10-15T10:00:00.000Z",
    "ipAddress": "…",
    "userAgent": "…"
  }
}
```

Better Auth liefert in seinen Standardantworten auch Session-Tokens. Sie sind sensible Zugangsdaten: nicht loggen, nicht in localStorage/sessionStorage speichern und nicht als eigene Bearer-Authentifizierung verwenden. Das Frontend verwendet ausschließlich die Browser-Cookies. Passwortfelder, bisherige `passwordHash`-Werte und Provider-Tokens werden nicht an das Frontend ausgegeben.

Neue Benutzer erhalten `USER`, auch über Discord und unabhängig von eingesendeten
Rollen oder Provider-Profilfeldern. Discord-only-Benutzer verwenden ebenfalls `name`; nach dem ersten Login über `/update-user` einen eindeutigen Namen wählen.
Die plattformweiten Rollen sind `USER`, `MAINTAINER` und `ADMIN`. Rollenanzeigen
im Frontend dienen ausschließlich der Darstellung. Der globale `SessionGuard`
prüft Session, bestehendes Konto und bestätigte E-Mail; `PermissionsGuard`
und `RolesGuard` prüfen die aktuelle Datenbankrolle bei jedem Aufruf. Neue
Verwaltungsrouten erhalten passende `@RequirePermissions(...)` oder
`@ManageService(...)` und niemals `@Public()`/`@AgentRoute()`. Klassen- und
Methodenberechtigungen werden gemeinsam verlangt. Schreibende geschützte
Nest-Endpunkte verlangen eine exakt erlaubte Origin. Agent-Schlüssel bleiben
separat; öffentliche Gameserver-REST- und SSE-Routen bleiben ohne Anmeldung erreichbar.

## Plattform-RBAC und Vorbereitung des Admin-Bereichs

Die folgende Matrix ist zentral in `src/authorization/permissions.ts` hinterlegt.
ADMIN besitzt alle dort definierten Berechtigungen; MAINTAINER hat ausdrücklich
keine Benutzer-, Rollen- oder globale Sicherheitsverwaltung.

| Berechtigung                                         | USER | MAINTAINER                | ADMIN |
| ---------------------------------------------------- | ---- | ------------------------- | ----- |
| `profile:read`, `profile:update` (eigenes Profil)    | ja   | ja                        | ja    |
| `services:use` (bereits freigegebene Dienste)        | ja   | ja                        | ja    |
| `content:manage` (technische Inhalte)                | nein | ja                        | ja    |
| `services:manage`                                    | nein | nur explizite Service-IDs | alle  |
| `users:read`, `users:roles:write`, `security:manage` | nein | nein                      | ja    |

`MAINTAINER_MANAGED_SERVICES` enthält exakte, komma-separierte Service-IDs;
leer bedeutet keine freigegebene Dienstverwaltung. Die Liste gilt für alle
MAINTAINER dieser Installation und erlaubt keine Wildcards. Künftige
Dienstverwaltungsrouten verwenden `@ManageService('serviceId')` und lesen die
Service-ID aus dem gleichnamigen Routenparameter. Eine unbeschränkte
`services:manage`-Route wird für MAINTAINER abgewiesen. ADMIN benötigt keine
Service-Liste. Service-IDs sind plattformweite IDs, nicht automatisch
Gameserver-Typen. Es werden hier keine neuen Gameserver-Steuerfunktionen freigegeben.

Die Profilberechtigungen erlauben nur das eigene Profil; Handler müssen
die eigene `req.user.id` verwenden. `services:use` ersetzt nicht die Prüfung,
ob der konkrete Dienst veröffentlicht/freigegeben ist. `content:manage` ist
für technische Inhalte, nicht für globale Sicherheitseinstellungen gedacht.
Die bisherigen `@Roles(...)`-Dekoratoren bleiben möglich; ADMIN erfüllt dabei
alle Rollenlisten, andere Rollen müssen ausdrücklich enthalten sein.

### Zusätzliche Nest-Endpunkte

Basis hierfür ist **`https://api.mueller-it-mkk.de/games/api/v1`**, nicht die
Better-Auth-Basis mit zusätzlichem `/auth`. Keine zweite Session oder Anmeldung.
Browser verwenden dieselben Cookies und `credentials: 'include'`.

| Methode | Pfad                           | Zugriff / Request                                           | Response                                                                                                 |
| ------- | ------------------------------ | ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| GET     | `/account/permissions`         | jeder angemeldete, verifizierte Benutzer                    | 200 `{ userId, role, permissions: string[], serviceManagement: { all: boolean, serviceIds: string[] } }` |
| GET     | `/admin/users?page=1&limit=25` | ADMIN, `users:read`; page 1–1000000, limit 1–100            | 200 `{ items: AdminUser[], total, page, limit }`                                                         |
| POST    | `/admin/users/:userId/role`    | ADMIN, `users:roles:write`; JSON `{ "role": "MAINTAINER" }` | 200 `{ "user": AdminUser }`                                                                              |

`AdminUser` enthält nur `id`, `name`, `email`, `role`,
`emailVerified`, `createdAt`. Keine Credentials, Hashes oder Sessions.
Sortierung der Übersicht: createdAt absteigend, bei Gleichstand id aufsteigend.
Rollenwerte sind exakt `USER`, `MAINTAINER`, `ADMIN`, jeweils ein Wert, keine Liste.
Unbekannte Felder/Rollen und ungültige Pagination liefern 400. Alle drei
Antworten enthalten `Cache-Control: no-store`. Die regulären Nest-Rate-Limits gelten.

Nest-Fehler bleiben `{ "statusCode": number, "message": string }`:

- 401 `Invalid or expired session`: keine gültige Session oder Konto nicht verifiziert.
- 403 `Insufficient permissions`: Rolle/Berechtigung fehlt; `Trusted Origin required`
  für schreibende Requests ohne erlaubte Origin.
- 404 `User ID not found`: unbekanntes Ziel bei autorisierter Rollenänderung.
- 409 `Cannot remove the last active ADMIN`: letzter aktiver Admin würde herabgestuft.
- 409 `Verify the user email before granting ADMIN`: Zielkonto ist noch unbestätigt.
- 409 `Role change conflict; retry the request`: konkurrierender SQLite-Schreibzugriff.

„Aktiv“ bedeutet hier: Konto existiert, E-Mail bestätigt, Rolle ADMIN; nicht
„gerade eingeloggt“. Ein Ban-/Deaktivierungsmodell und Löschendpunkte werden
nicht eingeführt. Wird das später ergänzt, muss dieselbe Last-Admin-Invariante
auch für Sperren/Löschen gelten. Der letzte aktive Admin kann sich nicht selbst
herabstufen. Bei mehreren aktiven Admins ist eine eigene Herabstufung möglich.
Anforderung derselben Rolle ist ein unverändernder Erfolg. Rollenänderungen
werden mit Akteur-ID, Ziel-ID, alter/neuer Rolle, Quelle und Zeitpunkt als
`RoleChange` in derselben Transaktion gespeichert. Unverändernde Requests werden
nicht als Änderung protokolliert. Es werden keine Secrets ins Audit geschrieben.

Vor jeder Änderung erwirbt der Service eine SQLite-Schreibsperre und prüft
die Administratorberechtigung des Akteurs erneut innerhalb derselben Transaktion.
Damit kann weder eine parallele Herabstufung noch ein zweiter Request die
Last-Admin-Prüfung umgehen. Bestehende Sessions bleiben erhalten; ihre Rechte
richten sich bei der nächsten Anfrage nach der neuen Rolle, auch bei get-session.

Das spätere Windows-98-Frontend lädt nach get-session zusätzlich
`/account/permissions`, zeigt Navigation/Bedienelemente anhand dieser Antwort
und fragt die paginierte Benutzerübersicht nur als ADMIN ab. Vor jeder
Rollenänderung Ziel-ID und neue Rolle anzeigen, nach Erfolg Liste und eigene
Berechtigungen neu laden. 401/403/409 sinnvoll behandeln und einen 409-Konflikt
nicht unbesehen wiederholen. Diese Darstellung ersetzt niemals die Guards.
Keine Frontend-Dateien wurden implementiert oder verändert.

### Einmaliger Bootstrap des persönlichen Accounts

Zuerst regulär registrieren und E-Mail bestätigen. Die eindeutige ID aus
`get-session.user.id` auf einem vertrauenswürdigen Weg selbst prüfen. Nur ein
autorisierter Betreiber mit lokalem Shell-/Docker-Zugriff darf anschließend
`npm run admin:bootstrap -- <user-id>` bzw.
`node dist/cli.js admin <user-id>` ausführen. Benutzername und E-Mail werden
nicht zur Auswahl verwendet; keine öffentlichen Bootstrap-Endpunkte,
fest codierten Accounts oder automatischen E-Mail-Regeln.

Die Vergabe, das Audit und der dauerhafte Einmalmarker `RbacState` werden
gemeinsam transaktional gespeichert. Ungültige/fehlende IDs oder unbestätigte
Konten verbrauchen den Bootstrap nicht. Sobald er erfolgreich war oder bei der
Migration bereits irgendein ADMIN vorhanden ist (auch ein unbestätigter
Legacy-Admin), bleibt er dauerhaft geschlossen – selbst wenn später jemand
außerhalb der API alle Admins entfernt. Keine automatische Wiederöffnung.
Wiederherstellung bei ausgesperrten Admins erfordert einen separat geprüften
Betreiberprozess, nicht das Löschen des Markers. Hier wurde kein persönliches
Konto befördert; seine ID wurde nicht vorausgesetzt.

### Migration und Proxy-Zugriff für RBAC

`202610150002_platform_rbac` ist additiv: SQLite speichert die Rolle als TEXT;
für MAINTAINER muss keine User-Tabelle neu aufgebaut werden. Vorhandene
USER-/ADMIN-Werte, Benutzer, Credentials, Sessions und Gameserver-Daten bleiben
erhalten. Hinzu kommen nur `RbacState` und `RoleChange`. Frühere Migrationen
werden nicht verändert. Nach Schemaänderung Prisma Client neu generieren.

Die neuen Nest-Routen werden **nicht** durch die bestehende Auth-Allowlist
freigeschaltet. Für einen späteren Admin-Bereich müssen GET `/games/api/v1/account/permissions`,
GET `/games/api/v1/admin/users`, POST `/games/api/v1/admin/users/*/role` sowie
die dazugehörigen OPTIONS-Anfragen in einem separaten Infrastrukturauftrag
geprüft werden. Keine Wildcard für die gesamte API und keine aktuelle
Caddy-Änderung. Die Rollenprüfung gilt unabhängig vom Proxy.

## Cookies und Wiederherstellung

- Entwicklung: `better-auth.session_token`; Produktion: `__Secure-better-auth.session_token`.
- HttpOnly, Path `/`, SameSite=Lax; Produktion immer Secure. Keine Domain-Einstellung: Cookie bleibt **host-only auf api.mueller-it-mkk.de**. Browser senden es bei Fetch von `www.mueller-it-mkk.de` zur API mit `credentials: 'include'`, da beide HTTPS-Hosts same-site sind. JavaScript kann das Cookie nicht lesen. Keine Freigabe an alle Subdomains erforderlich.
- Standardsession 7 Tage, rollende Erneuerung frühestens nach 1 Tag; `rememberMe: false` erzeugt ein nicht dauerhaft gespeichertes Cookie und die kürzere Bibliotheks-Session. Keine separate Refresh-Token-API. Zusätzliche kurzlebige OAuth-State-Cookies verwaltet die Bibliothek.
- Beim App-Start und nach Reload GET `/get-session`; diesen Aufruf auch zur Cookie-Erneuerung nutzen. Der Nest-Guard allein transportiert keine neuen Cookies zum Client.
- Fehlende, abgelaufene, widerrufene oder ungültige Session: `/get-session` liefert 200 `null`, geschützte Nest-Routen 401. Dann lokalen Benutzerzustand löschen und Login anbieten. Rollenwechsel wirkt unmittelbar, da Cookie-Cache deaktiviert ist.
- Logout: POST `/sign-out` mit Credentials und anschließend Benutzerzustand/Query-Caches löschen; auf Erfolg warten. Auch das bisherige Cookie kann serverseitig nicht weiterverwendet werden. Bei Netzfehlern keinen erfolgreichen serverseitigen Logout behaupten.

## Discord-Ablauf und sichere Verknüpfung

1. POST `/sign-in/social` mit `provider: 'discord'` und absoluten erlaubten Callback-URLs, immer Credentials einschließen.
2. Aus der JSON-Antwort `window.location.assign(data.url)` ausführen. Die HTTP-Antwort ist 200 mit URL/Location; ein Fetch führt keine Top-Level-Navigation zum Provider aus.
3. Discord ruft **`https://api.mueller-it-mkk.de/games/api/v1/auth/callback/discord`** auf. Diese URL exakt im Discord Developer Portal registrieren. Client Secret nur im Backend.
4. Better Auth prüft State und Provideridentität, verarbeitet den Code und setzt das Session-Cookie. Anschließend 302 zur Frontendseite; dort `/get-session` laden.
5. OAuth-Fehler über `error` (ggf. `error_description`) im Fehler-Callback behandeln, Query nicht loggen oder als HTML rendern. Bei ungültigem State leitet die Bibliothek zur festen Fehlerseite `<erste CORS_ORIGIN>/auth/error` um; das Frontend muss diese Route bereitstellen. Das Frontend muss einen erneuten Login anbieten, wenn keine Session entstanden ist.

**Keine implizite Verknüpfung anhand gleicher E-Mail.** Bei bestehendem E-Mail-Konto zuerst dort anmelden, E-Mail bestätigen und dann `/link-social` aufrufen. Die lokale Session muss vorhanden und die E-Mail verifiziert sein. Better Auth verlangt beim Verknüpfen eine passende, verifizierte Provider-E-Mail; unterschiedliche E-Mails sind nicht erlaubt. Das letzte verbleibende Anmeldekonto darf nicht entkoppelt werden. `/unlink-account` benötigt eine frische Session (Bibliotheksstandard: 1 Tag); ggf. erneut anmelden. Provider-Tokens werden in SQLite mit Better Auth verschlüsselt. Discord-Konten ohne E-Mail können nicht registriert werden; es wird keine künstliche Provider-E-Mail erzeugt.

## Fehlervertrag

Better-Auth-Fehler normalerweise `{ "code": "…", "message": "…" }`; HTTP-Status prüfen, `code` für UI-Übersetzungen nutzen. Bibliotheksvalidierungsfehler können zusätzliche Details enthalten; unbekannte Codes mit generischem Fehlertext behandeln. Keine internen Fehlermeldungen, Request-Bodys oder vollständigen Callback-URLs protokollieren.

| HTTP | Code                                                            | Englischer Bibliothekstext / Bedeutung                                                             |
| ---- | --------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| 400  | `USERNAME_REQUIRED`                                             | `Username is required`                                                                             |
| 400  | `INVALID_USERNAME` / `USERNAME_TOO_SHORT` / `USERNAME_TOO_LONG` | `Username is invalid` / `Username is too short` / `Username is too long`                           |
| 400  | `USERNAME_IS_ALREADY_TAKEN`                                     | `Username is already taken. Please try another.`                                                   |
| 400  | `PASSWORD_TOO_SHORT` / `PASSWORD_TOO_LONG`                      | `Password too short` / `Password too long`                                                         |
| 400  | `INVALID_TOKEN` / `TOKEN_EXPIRED`                               | `Invalid token` / `Token expired`; Reset/Verifizierung erneut anfordern                            |
| 400  | `FIELD_NOT_ALLOWED`                                             | `Field not allowed to be set`, etwa Rollenänderung                                                 |
| 400  | `FAILED_TO_UNLINK_LAST_ACCOUNT`                                 | `You can't unlink your last account`                                                               |
| 401  | `INVALID_EMAIL_OR_PASSWORD`                                     | `Invalid email or password`                                                                        |
| 401  | `SESSION_EXPIRED` / `SESSION_NOT_FRESH`                         | Session fehlt/abgelaufen bzw. erneute Anmeldung erforderlich                                       |
| 403  | `EMAIL_NOT_VERIFIED`                                            | `Email not verified`                                                                               |
| 403  | `INVALID_ORIGIN` / `MISSING_OR_NULL_ORIGIN`                     | `Invalid origin` / `Missing or null Origin`                                                        |
| 403  | `INVALID_CALLBACK_URL` / `INVALID_REDIRECT_URL`                 | `Invalid callbackURL` / `Invalid redirectURL`                                                      |
| 404  | `PROVIDER_NOT_FOUND`                                            | `Provider not found`, Discord nicht konfiguriert                                                   |
| 422  | `FAILED_TO_CREATE_USER`                                         | `Failed to create user`                                                                            |
| 429  | ggf. kein `code`                                                | Rate-Limit; `X-Retry-After` (Sekunden) respektieren, keine automatische Login-Schleife             |
| 400  | `INVALID_JSON`                                                  | `Invalid JSON` (HTTP-Adapter)                                                                      |
| 413  | `PAYLOAD_TOO_LARGE`                                             | `Request body too large` (HTTP-Adapter)                                                            |
| 500  | `AUTH_FAILED`                                                   | `Authentication request failed` (unbekannte interne Fehler)                                        |
| 503  | `EMAIL_DELIVERY_FAILED`                                         | `Email delivery failed. Please try again later.`; SMTP nicht verfügbar, Auth-Zustand erneut prüfen |
| 400  | `OAUTH_OPTIONS_NOT_ALLOWED`                                     | `Custom OAuth permissions are not allowed`                                                         |

OAuth- und Mail-Link-Endpunkte melden Fehler teilweise als 302 mit Query-Parameter statt JSON. Andere Nest-Endpunkte behalten `{ "statusCode": 401, "message": "Invalid or expired session" }` bzw. 403 `Insufficient permissions` oder `Trusted Origin required`. `/get-session` ohne gültige Session ist **kein 401-Fehler**.

OAuth-Fehlerparameter enthalten u.a. `account_not_linked` (erst im bestehenden
Konto anmelden und explizit verknüpfen), `email_does_not_match` (abweichende
E-Mail), `unable_to_link_account` (etwa ungeprüfte Provider-E-Mail),
`account_already_linked_to_different_user`, `email_not_found` und
`email_not_verified`. Nie anhand eines Fehlers automatisch andere Konten
zusammenführen. Bei ungültigem/verbrauchtem State Login neu starten.
SMTP-503 ist kein Nachweis dafür, dass die Registrierung zurückgerollt wurde;
ein unbestätigtes Konto kann bereits bestehen. Nach Behebung erneut eine
Verifikationsmail anfordern. Die UI übersetzt Codes und gibt keine internen
SMTP-Details aus. Logs enthalten nur `auth_email_delivery_failed` und den
Mailtyp, keine Empfänger, Links oder Provider-/SMTP-Zugangsdaten.

Rate-Limits werden durch Better Auth in SQLite gespeichert: je IP und Pfad 5/Minute für Registrierung, E-Mail-Login und Social-Login, 3/Minute für Reset-Anforderung und Verifikationsmail; sonst 60/Minute, zusätzliche Bibliotheks-Spezialregeln bleiben aktiv. Nest-Throttling schützt weiter die normalen Controller. Ein interner IP-Header wird aus Express `req.ip` überschrieben; untrusted Clientwerte werden verworfen. Caddy/Playit müssen eine vertrauenswürdige Client-IP-Kette bereitstellen, sonst teilen sich Clients möglicherweise ein Limit.

## Frontend-Konfiguration und Entwicklung

Minimal ohne zusätzliche Client-Bibliothek:

```ts
const authBase = 'https://api.mueller-it-mkk.de/games/api/v1/auth';
const response = await fetch(`${authBase}/get-session`, {
  credentials: 'include',
  cache: 'no-store',
});
const current = await response.json(); // { session, user } | null
```

Optional offizieller `better-auth/react`-Client **1.7.10** mit `baseURL: 'https://api.mueller-it-mkk.de'`, `basePath: '/games/api/v1/auth'`, `fetchOptions: { credentials: 'include' }`. Der zusätzliche Rollenwert muss im Frontendtyp als `'USER' | 'MAINTAINER' | 'ADMIN'` ergänzt werden; keine Backend-Quelldateien ins separate Frontend importieren. Die oben dokumentierten HTTP-Bodys bleiben maßgeblich. E-Mail-Registrierung braucht den Benutzernamen in `name`. Plattform-Admin-Aufrufe erfolgen als normale credentialed Fetches gegen die Nest-Basis, nicht über einen Better-Auth-adminClient.

Lokaler Vorschlag, passend zur bisherigen Frontendadresse:

```dotenv
NODE_ENV=development
PORT=3001
URL_PATH_PREFIX=
BETTER_AUTH_URL=http://localhost:3001
CORS_ORIGINS=http://localhost:3000
# BETTER_AUTH_SECRET und DATABASE_URL aus .env.example konfigurieren
```

Frontend `http://localhost:3000`, lokale Auth-Basis `http://localhost:3001/api/v1/auth`, Discord-Callback **`http://localhost:3001/api/v1/auth/callback/discord`**. Backend und Frontend können auf demselben Rechner nicht beide Port 3000 verwenden. Der lokale Beispielwert wurde deshalb auf 3001 geändert; der produktive interne Port bleibt 3000. Konfigurationsstandard ohne PORT bleibt zur Kompatibilität 3000. Bei lokalem `/games`-Prefix auch die lokale Callback-URL entsprechend ergänzen. Vite auf 5173 nur nach expliziter Änderung von `CORS_ORIGINS` verwenden. Nicht `localhost` und `127.0.0.1` mischen. Lokales HTTP und die entfernte HTTPS-API sind cross-site; hierfür SameSite nicht abschwächen, sondern ein lokales Backend oder passende HTTPS-Entwicklungsdomains verwenden.

Für Registrierung/Reset ist auch lokal ein SMTP-Testpostfach nötig, z.B. ein bereits vorhandener lokaler SMTP-Dienst; das Projekt startet keinen zusätzlichen Container. Ohne SMTP sind diese Flows nicht nutzbar. Fehlgeschlagener Mailversand kann ein bereits angelegtes unbestätigtes Konto hinterlassen; nach Behebung `/send-verification-email` verwenden. Tests ersetzen nur den Mailtransport und prüfen die echten generierten Mail-Links.

Die E-Mails verwenden das zentrale Müller-IT-MKK-Branding und den festen Absender
`Müller IT MKK <support@mueller-it-mkk.de>`. `SMTP_FROM` wird nicht mehr verwendet.
Die Template-Architektur, Logo-Einbettung und lokale Vorschau ohne SMTP sind in
[AUTH_EMAIL_TEMPLATES.md](AUTH_EMAIL_TEMPLATES.md) dokumentiert.

Mailbox.org ist als Anbieter vorgesehen: `SMTP_HOST=smtp.mailbox.org`,
`SMTP_PORT=587`, `SMTP_SECURE=false` (STARTTLS). Der Betreiber hat STARTTLS,
Authentifizierung und die Absenderannahme bereits geprüft; das ist keine hier
durchgeführte Live-Zustellprüfung. Die vorhandenen geschützten Zugangsdaten
weiterverwenden. Bei 2FA ist nach Anbieterangabe ein Anwendungspasswort nötig.
Der Transport prüft TLS-Zertifikate, verlangt in Produktion TLS und begrenzt
Verbindungs-/Begrüßungszeit auf 10 Sekunden sowie Socket-Inaktivität auf 20
Sekunden. SMTP-Debug- und Protokoll-Logging sind deaktiviert.

## Konfiguration und Infrastruktur

| Variable                                     | Verwendung                                                                                                                                                                                              |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `BETTER_AUTH_SECRET`                         | Generierter Zufallswert mit mindestens 32 Zeichen, keine Platzhalter; stabil und geschützt aufbewahren; auch Schlüssel für Provider-Tokenverschlüsselung                                                |
| `BETTER_AUTH_URL`                            | Exakte API-Origin ohne Slash/Pfad; Produktion `https://api.mueller-it-mkk.de`                                                                                                                           |
| `URL_PATH_PREFIX`                            | Produktion `/games`, lokal optional leer; Proxy erhält diesen Pfad unverändert                                                                                                                          |
| `DATABASE_URL`                               | SQLite `file:…`, bestehende Datenbank beibehalten; relativer Pfad wird von Prisma relativ zum Schema aufgelöst                                                                                          |
| `CORS_ORIGINS`                               | Kommagetrennte exakte Frontend-Origins, zugleich Trusted Origins; erste Origin bestimmt die feste OAuth-Fehlerseite `/auth/error`; Produktion `https://www.mueller-it-mkk.de`, weitere nur ausdrücklich |
| `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET` | Beide setzen oder beide leer lassen; leer deaktiviert Discord; Secret niemals ins Frontend                                                                                                              |
| `SMTP_HOST`, `SMTP_PORT`                     | Mailserver, Port standardmäßig 587                                                                                                                                                                      |
| `SMTP_SECURE`                                | `false` für STARTTLS/587, `true` für implizites TLS/465; Produktion verlangt TLS                                                                                                                        |
| `SMTP_USER`, `SMTP_PASSWORD`                 | Beide setzen oder bei autorisiertem Relay beide leer lassen                                                                                                                                             |
| `NODE_ENV`, `PORT`                           | Produktion `production`, interner Port 3000                                                                                                                                                             |
| `TRUST_PROXY_HOPS`                           | Nur tatsächliche vertrauenswürdige HTTP-Hops zählen; bei direkt vorgeschaltetem Caddy in der Regel 1; Playit-Headerführung vor Ort prüfen                                                               |

Produktion startet nicht ohne HTTPS-Auth-Origin, HTTPS-Frontend-Origins, gültiges Secret und SMTP_HOST. Discord bleibt optional; für das beauftragte vollständige Produkt muss der Betreiber es konfigurieren. Keine Zugangsdaten werden mitgeliefert. `.env` ist ignoriert. DB/Backups enthalten sensible Sitzungsdaten und benötigen die bestehenden Dateirechte.

Vom Betreiber bestätigt: mailbox.org-STARTTLS, SMTP-Authentifizierung und
Absenderannahme; Discord-App und produktive Callback-Registrierung sind vorhanden.
Offen bleiben die Anwendung der geschützten Servervariablen auf den später
freigegebenen Quellstand, echte Zustellung/SPF/DKIM/DMARC und Browser-Abnahme,
die tatsächliche Compose-/Proxy-Erreichbarkeit samt vertrauenswürdiger IP-Kette,
Erreichbarkeit der benötigten Auth-Allowlist sowie Offline-Backup und Probe auf
einer Datenbankkopie. Eine lokale Discord-URI ist nur für lokale OAuth-Tests zu
registrieren. Fehlende Caddy-Freigaben benötigen einen separaten Auftrag;
hier wurde weder Caddy verändert noch deployt.

`AUTH_EMAIL_LOGO_URL` ist optional: eine öffentlich erreichbare HTTPS-URL des
Original-Logos, ohne Zugangsdaten oder Fragment. Wenn gesetzt, verwenden die
E-Mails diese URL ohne Anhang; das Backend lädt das Bild nicht herunter.
Ohne nachweislich veröffentlichte URL bleibt die Variable leer und das Original
wird per CID eingebettet. Es wurde keine Logo-URL veröffentlicht oder geraten.

Produktionsvorbereitung und Übergabe:
[Änderungsübersicht und vollständige Variablenliste](AUTH_PRODUCTION_READINESS.md),
[OpenClaw-Deployment-Anleitung](OPENCLAW_AUTH_DEPLOYMENT.md),
[Abnahme-Testplan](AUTH_TEST_PLAN.md). Keine Frontend-Dateien wurden geändert.

## Caddy-Allowlist: ausschließlich als manueller Änderungsvorschlag

Im Repository gibt es **keine ausführbare produktive Caddyfile**. README beschreibt ein generisches nginx-Beispiel; die Grafik `Game-Dashboard-API_ Caddy und Playit.gg.png` dokumentiert Playit → Caddy in LXC 104 → NestJS `192.168.178.94:3000` in LXC 103, mit gesperrtem Swagger. Eine exakte bestehende Caddy-Regel lässt sich daraus nicht rekonstruieren. Die folgenden Matcher zeigen die exakt benötigten zusätzlichen Pfade und Methoden; sie müssen nach ausdrücklicher Freigabe in die vorhandene Allowlist integriert werden, ohne öffentliche REST-/SSE-Matcher zu ersetzen.

```caddyfile
@authGet {
    method GET
    path /games/api/v1/auth/get-session /games/api/v1/auth/verify-email /games/api/v1/auth/callback/discord /games/api/v1/auth/list-accounts /games/api/v1/auth/reset-password/*
}
handle @authGet {
    reverse_proxy 192.168.178.94:3000
}
@authPost {
    method POST
    path /games/api/v1/auth/sign-up/email /games/api/v1/auth/sign-in/email /games/api/v1/auth/sign-in/social /games/api/v1/auth/sign-out /games/api/v1/auth/request-password-reset /games/api/v1/auth/reset-password /games/api/v1/auth/send-verification-email /games/api/v1/auth/link-social /games/api/v1/auth/unlink-account /games/api/v1/auth/update-user
}
handle @authPost {
    request_body {
        max_size 32KB
    }
    reverse_proxy 192.168.178.94:3000
}
@authOptions {
    method OPTIONS
    path /games/api/v1/auth/sign-up/email /games/api/v1/auth/sign-in/email /games/api/v1/auth/sign-in/social /games/api/v1/auth/sign-out /games/api/v1/auth/request-password-reset /games/api/v1/auth/reset-password /games/api/v1/auth/send-verification-email /games/api/v1/auth/link-social /games/api/v1/auth/unlink-account /games/api/v1/auth/update-user /games/api/v1/auth/get-session /games/api/v1/auth/list-accounts
}
handle @authOptions {
    reverse_proxy 192.168.178.94:3000
}
```

Matcher vor dem vorhandenen Default-Deny verwenden; `handle`, kein `handle_path`, damit `/games` erhalten bleibt. Querystrings von Verifikation/Reset/OAuth unverändert durchreichen. `Set-Cookie`, `Origin` und `Cookie` nicht entfernen, keine Auth-Caches, keine Access-Logs vollständiger Auth-URLs oder Cookie-/Authorization-Header. Body-Limit auch für chunked Requests am Proxy aktivieren. Keine pauschale `/games/api/v1/*`-Freigabe: Agent-, Health-, Swagger- und neue Admin-Pfade behalten ihre bisherigen Zugriffsregeln. Die bestehenden SSE-Einstellungen bleiben erhalten. Caddy-Konfiguration und Zertifikate wurden nicht verändert.

## Migration und Administratoren

Die frühere Auth-Migration `202610150001_better_auth` verändert keine Gameserver-, Snapshot-, Event-, Agent-, Metric- oder Player-Tabelle. `User` wird dabei innerhalb der Transaktion erweitert/neu aufgebaut; IDs, vorhandene Hashes und ADMIN bleiben erhalten. Die damalige Rolle MODERATOR wurde zu USER; diese bereits bestehende Migration wird nicht nachträglich geändert. Die neue Plattform-RBAC-Migration ergänzt MAINTAINER, weist aber niemandem automatisch diese Rolle zu. Legacy-Konten erhalten beim ursprünglichen Auth-Upgrade eine eindeutige nicht zustellbare `legacy-<hex(id)>@users.invalid`-Adresse, unbestätigt. Alte JWTs und alte Passwort-Logins werden nicht mehr akzeptiert. Vor einem Upgrade vom ursprünglichen JWT-Stand deshalb eine mögliche Anmeldeunterbrechung einplanen.

Bestehende Identitäten kontrolliert übernehmen: Betreiber prüft Eigentum, ordnet offline über eine geprüfte Prisma-Operation eine echte eindeutige E-Mail zu (`emailVerified` bleibt zunächst false), lässt die Person `/send-verification-email` und den Mail-Link benutzen und anschließend `/request-password-reset` ausführen. Better Auth legt dabei das Credential-Konto an und erzeugt seinen eigenen Hash. Keine automatische Hash-Konvertierung, kein Teilen/Übertragen der bisherigen Klartextpasswörter. Der alte Hash bleibt nur zur verlustfreien Migration gespeichert und wird nicht zur Anmeldung benutzt; nach bestätigter Übernahme kann der Betreiber ihn gezielt auf null setzen. Die Vergabe des ersten ADMIN erfolgt ausschließlich über den oben beschriebenen einmaligen Bootstrap anhand der eindeutigen Benutzer-ID. Der frühere username-basierte Befehl ist ersetzt; öffentliche Rollenvergabe ist ausgeschlossen.

Vor jeder Migration Offline-Backup erstellen und auf Kopie prüfen. Lokal `npm run db:generate`, `npm run db:migrate` (Prisma deploy); bestehender Container-Runner `node scripts/migrate.cjs` unterstützt diese einfache transaktionale Migration und überprüft Checksummen. Die Initialmigration wurde nicht verändert. Migrationstest prüft vorhandene Benutzer/Historie, wiederholten Runner-Start, Prisma migrate deploy, Schema-Diff und Fremdschlüssel. Weitere HTTP-Tests prüfen Registrierung, Verifikation, Login, Cookie-Wiederherstellung, Rollen, Ablauf, Logout, Reset, Origin/Redirect-Abweisung, Limits, Discord-State und Produktions-Cookieattribute sowie die bestehenden REST-/SSE-Funktionen. Ein echter Discord-Callback und SMTP-Zustellung erfordern die Infrastruktur und sind lokal nicht als Live-Test ausgeführt.

## Offizielle Referenzen

- [Express-Integration und ESM](https://better-auth.com/docs/integrations/express)
- [Prisma-Adapter, einschließlich Prisma 6](https://better-auth.com/docs/adapters/prisma)
- [E-Mail und Passwort](https://better-auth.com/docs/authentication/email-password)
- [Discord](https://better-auth.com/docs/authentication/discord)
- [Caddy-Body-Limit](https://caddyserver.com/docs/caddyfile/directives/request_body)
- [Konten und Verknüpfung](https://better-auth.com/docs/concepts/users-accounts)

Die installierten Bibliothekstypen und Endpunktdefinitionen für Version 1.7.10 wurden zusätzlich direkt geprüft; spätere Versionsupdates müssen diesen Vertrag und die Tests mit aktualisieren.
