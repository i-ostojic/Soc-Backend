// skripta za hashiranje lozinki
// koristenje: node hashPassword.js <lozinka>

const bcrypt = require("bcrypt");

const password = process.argv[2];

if (!password) {
  console.error("Koristenje: node hashPassword.js <lozinka>");
  process.exit(1);
}

// odreduje kolicinu saltinga

const saltRounds = 10;

bcrypt.hash(password, saltRounds, (err, hash) => {
  if (err) throw err;
  console.log("Hash:", hash);
});
