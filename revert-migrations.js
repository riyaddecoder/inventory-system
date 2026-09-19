const path = require('path');
const fs = require('fs');

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

async function revertMigration() {
  console.log('Database config found at:', dbConfigPath);
  console.log('Connecting to database...');

  if (!AppDataSource.isInitialized) {
    await AppDataSource.initialize();
  }
  console.log('Database connected successfully.');

  console.log('Reverting last migration...');
  await AppDataSource.undoLastMigration();
  console.log('Successfully reverted last migration.');

  await AppDataSource.destroy();
  process.exit(0);
}

revertMigration().catch(err => {
  console.error('Migration revert failed:', err);
  process.exit(1);
});
