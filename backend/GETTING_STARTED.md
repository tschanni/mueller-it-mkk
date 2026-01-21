# 🚀 Mueller IT Backend - Quick Start Guide

## 📋 Voraussetzungen

- **Node.js** (v18 oder höher)
- **MongoDB** lokal installiert und laufend

---

## ⚡ Schnellstart (5 Schritte)

### 1️⃣ Dependencies installieren
```bash
cd backend
npm install
```

### 2️⃣ MongoDB starten
```bash
# Windows (falls MongoDB als Service läuft):
net start MongoDB

# Oder manuell:
mongod
```

### 3️⃣ Umgebungsvariablen konfigurieren
Erstelle eine `.env` Datei im `backend/` Ordner:

```bash
# Die .env.example kopieren und anpassen
cp .env.example .env
```

**Wichtig**: Ändere die JWT-Secrets in der `.env`:
```env
JWT_SECRET=dein-super-geheimer-key-hier-eintragen
JWT_REFRESH_SECRET=noch-ein-anderer-geheimer-key
```

### 4️⃣ Admin-Konto erstellen
```bash
npm run create-admin
```

Folge den Anweisungen und erstelle deinen Admin-Account:
- Username
- E-Mail
- Passwort (min. 8 Zeichen)
- Firmenname (optional)

### 5️⃣ Server starten
```bash
npm run start:dev
```

✅ **Backend läuft jetzt!**

---

## 🌐 Swagger API Dokumentation aufrufen

Nach dem Server-Start:

1. Öffne deinen Browser
2. Gehe zu: **http://localhost:3000/api**
3. Du siehst die vollständige API-Dokumentation

### 🔐 In Swagger mit Admin anmelden:

1. Klicke oben rechts auf **"Authorize"** 🔓
2. Gehe zu **POST /auth/login**
3. Klicke auf **"Try it out"**
4. Trage deine Admin-Daten ein:
   ```json
   {
     "usernameOrEmail": "dein-admin-username",
     "password": "dein-passwort"
   }
   ```
5. Klicke **"Execute"**
6. Kopiere den `accessToken` aus der Response
7. Klicke erneut auf **"Authorize"** 🔓
8. Füge den Token ein: `Bearer dein-access-token-hier`
9. Klicke **"Authorize"**

✅ **Du bist jetzt als Admin angemeldet und kannst alle Endpoints testen!**

---

## 📁 Profilbilder hochladen

### Via Swagger:
1. Als User einloggen (siehe oben)
2. Gehe zu **POST /users/profile/image**
3. Klicke **"Try it out"**
4. Wähle eine Bilddatei (max. 5MB)
5. Klicke **"Execute"**

### Via Code (Frontend):
```typescript
const formData = new FormData();
formData.append('file', file);

fetch('http://localhost:3000/users/profile/image', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${accessToken}`
  },
  body: formData
});
```

Bilder werden gespeichert unter:
- **Ordner**: `/backend/uploads/`
- **URL**: `http://localhost:3000/uploads/profile-xxxxx.jpg`

---

## 🎯 Wichtige Endpoints

### 🔑 Authentication
- `POST /auth/register` - Neuen User registrieren
- `POST /auth/login` - Anmelden (User/Admin)
- `POST /auth/refresh` - Access Token erneuern
- `POST /auth/logout` - Abmelden

### 👤 Users
- `GET /users/profile` - Eigenes Profil
- `POST /users/profile/image` - Profilbild hochladen
- `DELETE /users/profile/image` - Profilbild löschen

### 🎫 Tickets
- `POST /tickets` - Neues Ticket erstellen
- `GET /tickets` - Eigene Tickets
- `GET /tickets/:id` - Ticket mit Nachrichten
- `POST /tickets/:id/messages` - Nachricht senden
- `PATCH /tickets/:id/status` - Status ändern

### 👨‍💼 Admin (nur für Admins)
- `GET /admin/tickets` - Alle Tickets
- `GET /admin/tickets/:id` - Ticket-Details
- `POST /admin/tickets/:id/messages` - Als Admin antworten
- `PATCH /admin/tickets/:id/status` - Status ändern

---

## 🛠️ Weitere Befehle

```bash
# Produktionsbuild erstellen
npm run build

# Server in Produktion starten
npm run start:prod

# Tests ausführen
npm run test

# Linting
npm run lint
```

---

## 🔒 Sicherheit

Das Backend nutzt:
- ✅ **argon2** für Passwort-Hashing
- ✅ **JWT** für Authentication
- ✅ **Rate Limiting** (10 Requests/Minute)
- ✅ **Helmet** für HTTP-Security-Headers
- ✅ **CORS** konfigurierbar
- ✅ **Input Validation** (class-validator)

---

## 🐛 Troubleshooting

### MongoDB Connection Error
```
Error: connect ECONNREFUSED 127.0.0.1:27017
```
**Lösung**: Stelle sicher, dass MongoDB läuft
```bash
net start MongoDB
```

### Port 3000 bereits belegt
**Lösung**: Ändere den Port in der `.env`:
```env
PORT=4000
```

### Admin erstellen schlägt fehl
**Lösung**: MongoDB muss laufen, bevor du `npm run create-admin` ausführst

---

## 📞 Support

Bei Fragen oder Problemen:
- Prüfe die [Architektur-Dokumentation](ARCHITECTURE.md)
- Siehe [UML-Diagramme](docs/)

---

**Viel Erfolg! 🎉**
