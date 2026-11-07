# sensor-api

REST API za nadzor baterija putem IoT uređaja, izrađen u sklopu završnog rada.
Arduino/ESP uređaji šalju očitanja senzora (napon, struja, temperatura) preko HTTP-a
uz svoj API ključ, a web sučelje [battery-dashboard]
ih prikazuje korisniku. Korisnici se prijavljuju i dobivaju JWT token.

## Tehnologije

- **Okruženje:** Node.js
- **Framework:** Express 5
- **Baza podataka:** PostgreSQL (paket `pg`)
- **Autentikacija:** JWT (`jsonwebtoken`), hashiranje lozinki (`bcrypt`)
- **Ostalo:** `cors`

## Pokretanje

Potreban je Node.js 20.12+ (koristi se `process.loadEnvFile()`) i pokrenut PostgreSQL.

```bash
npm install
cp .env.example .env   # zatim upiši lozinku baze i JWT ključ
npm start
# Server se pokreće na http://localhost:3000
```

Za dodavanje korisnika u tablicu `users` potreban je bcrypt hash lozinke:

```bash
node hashPassword.js <lozinka>
```

### Spajanje Arduino/ESP uređaja (ngrok)

Uređaj ne može pristupiti `localhost` adresi računala, pa se server izlaže
preko [ngroka](https://ngrok.com/):

```bash
ngrok http 3000
```

ngrok ispiše javnu HTTPS adresu koju treba upisati u kod uređaja.
**Dok ngrok radi, server je javno dostupan**
(vidi [Ograničenja](#ograničenja)).

## API rute

| Metoda | Ruta | Opis |
|--------|------|------|
| GET | `/api/readings` | Dohvaća zadnjih 100 očitanja, poredanih od najstarijeg prema najnovijem |
| GET | `/api/devices` | Dohvaća sve registrirane uređaje |
| POST | `/api/readings` | Uređaj šalje novo očitanje; ako je `api_key` nov, uređaj se automatski registrira |
| POST | `/api/auth/login` | Prijava korisnika – vraća JWT (vrijedi 7 dana) |

### POST /api/readings – tijelo zahtjeva

```json
{
  "api_key": "abc123",
  "voltage": 12.4,
  "current": 0.8,
  "temperature": 25.3,
  "recorded_at": "2026-06-13T10:00:00Z"
}
```

`recorded_at` nije obavezan; ako se ne pošalje, koristi se trenutno vrijeme.

### POST /api/auth/login – tijelo zahtjeva

```json
{
  "email": "korisnik@example.com",
  "password": "lozinka"
}
```

## Tablice u bazi

### devices
| Stupac | Tip | Napomena |
|--------|-----|----------|
| id | serial PK | |
| name | text | Generira se automatski kao `Device-<prvih 6 znakova api_key>` |
| serial_number | text | Prvih 8 znakova api_key |
| api_key_hash | text | Ovdje se sprema cijeli api_key (vidi [Ograničenja](#ograničenja)) |
| is_active | boolean | |
| created_at | timestamp | |

### battery_readings
| Stupac | Tip | Napomena |
|--------|-----|----------|
| id | serial PK | |
| device_id | FK → devices.id | |
| voltage | numeric | |
| current | numeric | |
| temperature | numeric | |
| recorded_at | timestamp | Šalje uređaj ili se postavlja na trenutno vrijeme |
| created_at | timestamp | |

### users
| Stupac | Tip | Napomena |
|--------|-----|----------|
| id | serial PK | |
| email | text | |
| password_hash | text | bcrypt hash |
| full_name | text | |

## Ostale datoteke

- `hashPassword.js` – pomoćna skripta koja generira bcrypt hash lozinke za unos korisnika u tablicu `users` (lozinka se predaje kao argument).
- `.env.example` – predložak za `.env` datoteku s postavkama (lozinke se ne spremaju u repozitorij).

## Ograničenja

Projekt je namijenjen lokalnom radu i demonstraciji u sklopu završnog rada.
Svjesno su izostavljene neke stvari koje bi bile potrebne za komercijaalnu upotrebu:

- **GET rute nisu zaštićene na serveru.** Frontend šalje JWT token, ali ga server
  ne provjerava, pa `/api/readings` i `/api/devices` vraćaju podatke svakome tko
  može pristupiti serveru. 
- **API ključevi spremaju se u čistom tekstu.** 
  `api_key_hash`, ključ nije hashiran, `/api/devices` ga vraća u odgovoru.
- **Uređaji se registriraju automatski.** Svaki nepoznati `api_key` stvara novi
  uređaj.
- **Nema validacije ulaznih podataka** kod slanja očitanja.
