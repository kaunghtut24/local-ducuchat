#!/usr/bin/env node

/**
 * Setup Script for Document Chat System
 * Automates the initial setup process
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const crypto = require('crypto');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Colors for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  red: '\x1b[31m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function execCommand(command, description) {
  log(`\n${description}...`, 'cyan');
  try {
    execSync(command, { stdio: 'inherit' });
    log(`✓ ${description} completed`, 'green');
    return true;
  } catch (error) {
    log(`✗ ${description} failed`, 'red');
    return false;
  }
}

function generateSecret(length = 32) {
  return crypto.randomBytes(length).toString('base64');
}

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

async function checkPrerequisites() {
  log('\n🔍 Checking prerequisites...', 'bright');
  
  const checks = [
    { cmd: 'node --version', name: 'Node.js' },
    { cmd: 'npm --version', name: 'npm' },
    { cmd: 'psql --version', name: 'PostgreSQL', optional: true }
  ];

  for (const check of checks) {
    try {
      const version = execSync(check.cmd, { encoding: 'utf8' }).trim();
      log(`✓ ${check.name}: ${version}`, 'green');
    } catch (error) {
      if (check.optional) {
        log(`⚠ ${check.name}: Not found (optional)`, 'yellow');
      } else {
        log(`✗ ${check.name}: Not found (required)`, 'red');
        return false;
      }
    }
  }
  
  return true;
}

async function setupEnvironment() {
  log('\n⚙️  Setting up environment variables...', 'bright');
  
  const envPath = path.join(process.cwd(), '.env');
  const envExamplePath = path.join(process.cwd(), '.env.example');
  
  if (fs.existsSync(envPath)) {
    const overwrite = await question('📝 .env file already exists. Overwrite? (y/N): ');
    if (overwrite.toLowerCase() !== 'y') {
      log('Skipping environment setup', 'yellow');
      return;
    }
  }
  
  if (!fs.existsSync(envExamplePath)) {
    log('✗ .env.example not found', 'red');
    return;
  }
  
  // Copy .env.example to .env
  fs.copyFileSync(envExamplePath, envPath);
  log('✓ Created .env from .env.example', 'green');
  
  // Read .env content
  let envContent = fs.readFileSync(envPath, 'utf8');
  
  // Generate NEXTAUTH_SECRET
  const secret = generateSecret(32);
  envContent = envContent.replace(
    /NEXTAUTH_SECRET=".*"/,
    `NEXTAUTH_SECRET="${secret}"`
  );
  
  log('\n📋 Please provide the following information:', 'bright');
  
  // Ask for database URL
  const dbUrl = await question('Database URL (press Enter for default): ');
  if (dbUrl.trim()) {
    envContent = envContent.replace(
      /DATABASE_URL=".*"/,
      `DATABASE_URL="${dbUrl}"`
    );
  }
  
  // Save updated .env
  fs.writeFileSync(envPath, envContent);
  
  log('\n✓ Environment variables configured', 'green');
  log(`✓ Generated NEXTAUTH_SECRET: ${secret.substring(0, 20)}...`, 'green');
  log('\n💡 You can edit .env file to add API keys for:', 'yellow');
  log('   - OpenRouter (AI chat)', 'yellow');
  log('   - Supabase (file storage)', 'yellow');
  log('   - Inngest (background jobs)', 'yellow');
}

async function setupDatabase() {
  log('\n🗄️  Setting up database...', 'bright');
  
  const setupDb = await question('Do you want to set up the database now? (Y/n): ');
  if (setupDb.toLowerCase() === 'n') {
    log('Skipping database setup', 'yellow');
    return;
  }
  
  // Generate Prisma client
  execCommand('npx prisma generate', 'Generating Prisma client');
  
  // Push schema to database
  const pushSuccess = execCommand('npx prisma db push', 'Pushing schema to database');
  
  if (pushSuccess) {
    const seed = await question('Do you want to seed the database with sample data? (y/N): ');
    if (seed.toLowerCase() === 'y') {
      execCommand('npm run db:seed', 'Seeding database');
    }
  }
}

async function installDependencies() {
  log('\n📦 Installing dependencies...', 'bright');
  
  const install = await question('Do you want to install npm dependencies? (Y/n): ');
  if (install.toLowerCase() === 'n') {
    log('Skipping dependency installation', 'yellow');
    return;
  }
  
  execCommand('npm install', 'Installing dependencies');
}

async function main() {
  log('\n╔════════════════════════════════════════════╗', 'bright');
  log('║   Document Chat System - Setup Wizard     ║', 'bright');
  log('╚════════════════════════════════════════════╝', 'bright');
  
  // Check prerequisites
  const prereqsOk = await checkPrerequisites();
  if (!prereqsOk) {
    log('\n❌ Prerequisites check failed. Please install required software.', 'red');
    process.exit(1);
  }
  
  // Install dependencies
  await installDependencies();
  
  // Setup environment
  await setupEnvironment();
  
  // Setup database
  await setupDatabase();
  
  // Final instructions
  log('\n╔════════════════════════════════════════════╗', 'green');
  log('║          ✅ Setup Complete!                ║', 'green');
  log('╚════════════════════════════════════════════╝', 'green');
  
  log('\n🚀 Next steps:', 'bright');
  log('   1. Edit .env file to add your API keys', 'cyan');
  log('   2. Run: npm run dev', 'cyan');
  log('   3. Open: http://localhost:3000', 'cyan');
  
  log('\n📚 Useful commands:', 'bright');
  log('   npm run dev          - Start development server', 'yellow');
  log('   npm run db:studio    - Open database GUI', 'yellow');
  log('   npx inngest-cli dev  - Start background jobs', 'yellow');
  
  log('\n💡 For more information, see SETUP_GUIDE.md\n', 'blue');
  
  rl.close();
}

// Run the setup
main().catch(error => {
  log(`\n❌ Setup failed: ${error.message}`, 'red');
  process.exit(1);
});

