const path = require('path');
const fs = require('fs');

// Ensure .env is loaded whether run from root or dist folder
const envPaths = [
  path.resolve(process.cwd(), '.env'),
  path.resolve(__dirname, '.env'),
  path.resolve(__dirname, '../.env'),
  path.resolve(process.cwd(), '../.env'),
];

for (const envPath of envPaths) {
  if (fs.existsSync(envPath)) {
    require('dotenv').config({ path: envPath });
    break;
  }
}

// Try finding database.js across possible working directories (root, dist, etc.)
const candidates = [
  path.resolve(__dirname, 'config/database.js'),
  path.resolve(__dirname, 'dist/config/database.js'),
  path.resolve(__dirname, '../config/database.js'),
  path.resolve(__dirname, '../dist/config/database.js'),
  path.resolve(process.cwd(), 'config/database.js'),
  path.resolve(process.cwd(), 'dist/config/database.js'),
];

let dbConfigPath = null;
for (const candidate of candidates) {
  if (fs.existsSync(candidate)) {
    dbConfigPath = candidate;
    break;
  }
}

if (!dbConfigPath) {
  console.error('Error: Could not locate database.js in any of the following paths:');
  candidates.forEach(c => console.error('  - ' + c));
  process.exit(1);
}

const { AppDataSource } = require(dbConfigPath);

async function runMigrations() {
  console.log('Database config found at:', dbConfigPath);
  console.log('Connecting to database...');

  if (!AppDataSource.isInitialized) {
    await AppDataSource.initialize();
  }
  console.log('Database connected successfully.');

  console.log('Running pending migrations...');
  const migrations = await AppDataSource.runMigrations();

  if (migrations.length === 0) {
    console.log('No pending migrations. Database schema is up to date.');
  } else {
    console.log(`Successfully executed ${migrations.length} migration(s):`);
    migrations.forEach(m => console.log(`  ✔ ${m.name}`));
  }

  await AppDataSource.destroy();
  console.log('Migration process completed.');
  process.exit(0);
}

runMigrations().catch(err => {
  console.error('Migration failed with error:', err);
  process.exit(1);
});
