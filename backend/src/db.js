const { Pool, types } = require('pg');

types.setTypeParser(1082, (value) => value);
types.setTypeParser(1114, (value) => value);

if (!process.env.SUPABASE_DB_URL) {
  throw new Error('SUPABASE_DB_URL must be set to the Supabase PostgreSQL connection string.');
}

const pgPool = new Pool({
  connectionString: process.env.SUPABASE_DB_URL,
  max: 10
});

function postgresSql(sql) {
  let parameterIndex = 0;
  return sql
    .replace(/`([^`]+)`/g, '"$1"')
    .replace(/\?/g, () => `$${++parameterIndex}`);
}

async function execute(client, sql, values = []) {
  let statement = postgresSql(sql);
  const isInsert = /^\s*INSERT\b/i.test(sql);
  if (isInsert && !/\bRETURNING\b/i.test(statement)) statement += ' RETURNING id';

  const result = await client.query(statement, values);
  if (/^\s*SELECT\b/i.test(sql)) return [result.rows];
  return [{
    affectedRows: result.rowCount,
    insertId: isInsert && result.rows.length ? result.rows[0].id : undefined
  }];
}

module.exports = {
  execute: (sql, values) => execute(pgPool, sql, values),
  query: (sql, values) => pgPool.query(sql, values),
  getConnection: async () => {
    const client = await pgPool.connect();
    return {
      execute: (sql, values) => execute(client, sql, values),
      beginTransaction: () => client.query('BEGIN'),
      commit: () => client.query('COMMIT'),
      rollback: () => client.query('ROLLBACK'),
      release: () => client.release()
    };
  },
  end: () => pgPool.end()
};
