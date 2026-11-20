require('dotenv').config();

const bcrypt = require('bcryptjs');
const db = require('../src/db');

async function main() {
  const name = process.env.SEED_ADMIN_NAME;
  const username = process.env.SEED_ADMIN_USERNAME;
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (!name || !username || !password || password.length < 12) {
    throw new Error('Set SEED_ADMIN_NAME, SEED_ADMIN_USERNAME, and a SEED_ADMIN_PASSWORD of at least 12 characters.');
  }

  const existing = await db.execute(db.client.from('user').select('id').eq('username', username).maybeSingle());
  if (existing) {
    throw new Error(`The user "${username}" already exists; no account was changed.`);
  }

  const passwordHash = await bcrypt.hash(password, 12);
  await db.execute(db.client.from('user').insert({
    name,
    username,
    password_hash: passwordHash,
    role: 'Admin'
  }).select('id').single());
  console.log(`Administrator "${username}" created. Change the initial password after signing in.`);
}

main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
