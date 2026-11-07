//REQUIRE == IMPORT, ovo su importi

// ucitavanje varijabli iz .env datoteke 
process.loadEnvFile();

// import za express
const express = require("express");
// import za spajanje baze podataka
const { Pool } = require("pg");
const cors = require("cors");
// import algoritma za hasiranje lozinki
const bcrypt = require("bcrypt");
// import za JWT token koji se koristi za autentikaciju
const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error("JWT_SECRET nije postavljen u .env datoteci");
}

const app = express();
app.use(cors());
app.use(express.json());

// kreiran novi pool i spojena moja baza podataka
const pool = new Pool({
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  port: Number(process.env.DB_PORT) || 5432,
});

// GET metoda - dohvati zadnjih 100 očitanja
// unutarnji upit uzima 100 najnovijih (DESC), vanjski ih slaže od najstarijeg
// prema najnovijem (ASC) kako bi graf išao s lijeva na desno kroz vrijeme
app.get("/api/readings", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM (
         SELECT * FROM battery_readings ORDER BY created_at DESC LIMIT 100
       ) AS zadnja ORDER BY created_at ASC`,
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database error" });
  }
});

app.get("/api/devices", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM devices ORDER BY created_at ASC",
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database error" });
  }
});

// POST metoda - Arduino šalje novo očitanje / provjeravat ce se api_key
app.post("/api/readings", async (req, res) => {
  const { api_key, voltage, current, temperature, recorded_at } = req.body;

  try {
    console.log("Primljen zahtjev s api_key:", api_key);

    // Provjeri postoji li uređaj s tim API ključem
    const deviceResult = await pool.query(
      "SELECT * FROM devices WHERE api_key_hash = $1",
      [api_key],
    );

    console.log("Pronađeni uređaji:", deviceResult.rows.length);

    let device_id;
    // ako ne postoji, kreiraj ga
    if (deviceResult.rows.length === 0) {
      console.log("Kreiram novi uređaj...");
      const newDevice = await pool.query(
        "INSERT INTO devices (name, serial_number, api_key_hash, is_active) VALUES ($1, $2, $3, true) RETURNING *",
        [`Device-${api_key.slice(0, 6)}`, api_key.slice(0, 8), api_key],
      );
      console.log("Novi uređaj kreiran:", newDevice.rows[0]);
      device_id = newDevice.rows[0].id;
      // ako postoji
    } else {
      console.log("Uređaj već postoji, id:", deviceResult.rows[0].id);
      device_id = deviceResult.rows[0].id;
    }

    console.log("Upisujem očitanje s device_id:", device_id);

    const result = await pool.query(
      "INSERT INTO battery_readings (device_id, voltage, current, temperature, recorded_at) VALUES ($1, $2, $3, $4, $5) RETURNING *",
      [device_id, voltage, current, temperature, recorded_at || new Date()],
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database error" });
  }
});

// ENDPOINT ZA AUTENTIKACIJU - koristi se POST metoda

app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body;

  try {
    // pronadi usera po mailu u bazi podataka
    const result = await pool.query("SELECT * FROM users WHERE email =$1", [
      email,
    ]);

    // ako user ne postoji vrati 401

    if (result.rows.length === 0) {
      return res.status(401).json({ error: "User ne postoji" });
    }

    const user = result.rows[0];

    // provjeri lozinku -- da li se slaze s onom u bazi koja je hashirana

    const passwordMatch = await bcrypt.compare(password, user.password_hash);

    if (!passwordMatch) {
      return res.status(401).json({ error: "Pogresan email ili lozinka" });
    }

    // kreiraj JWT

    const token = jwt.sign({ userID: user.id, email: user.email }, JWT_SECRET, {
      expiresIn: "7d",
    });

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "server error" });
  }
});

const PORT = Number(process.env.PORT) || 3000;
app.listen(PORT, "0.0.0.0", () =>
  console.log(`Server radi na http://localhost:${PORT}`),
);

// kod iniciranja komunikacije ESP-a i servera pokrenuti ngrok u
// administratorskom CMD-u naredbom "ngrok http 3000"
