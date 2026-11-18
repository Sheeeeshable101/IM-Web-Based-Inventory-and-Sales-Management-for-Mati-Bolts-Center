require('dotenv').config();

const bcrypt = require('bcryptjs');
const pool = require('../src/db');

async function main() {
  const name = process.env.SEED_ADMIN_NAME;
  const username = process.env.SEED_ADMIN_USERNAME;
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (!name || !username || !password || password.length < 12) {
    throw new Error('Set SEED_ADMIN_NAME, SEED_ADMIN_USERNAME, and a SEED_ADMIN_PASSWORD of at least 12 characters.');
  }

  const [existing] = await pool.execute('SELECT id FROM `user` WHERE username = ?', [username]);
  if (existing.length) {
    throw new Error(`The user "${username}" already exists; no account was changed.`);
  }

  const passwordHash = await bcrypt.hash(password, 12);
  await pool.execute(
    'INSERT INTO `user` (name, username, password_hash, role) VALUES (?, ?, ?, ?)',
    [name, username, passwordHash, 'Admin']
  );
  console.log(`Administrator "${username}" created. Change the initial password after signing in.`);
}

main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
