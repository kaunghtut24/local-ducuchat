#!/usr/bin/env node

/**
 * Automated script to migrate Clerk references to Lucia
 * 
 * This script will:
 * 1. Find all files with Clerk imports
 * 2. Apply automated replacements where safe
 * 3. Report files that need manual review
 * 
 * Usage: node scripts/apply-lucia-migration.js [--dry-run]
 */

const fs = require('fs');
const path = require('path');

const DRY_RUN = process.argv.includes('--dry-run');

// Define safe automated replacements
const SAFE_REPLACEMENTS = [
  {
    name: 'Import statement',
    pattern: /import\s*{\s*auth\s*}\s*from\s*['"]@clerk\/nextjs\/server['"]/g,
    replacement: "import { validateRequest } from '@/lib/auth'"
  },
  {
    name: 'Import statement with currentUser',
    pattern: /import\s*{\s*auth,\s*currentUser\s*}\s*from\s*['"]@clerk\/nextjs\/server['"]/g,
    replacement: "import { validateRequest } from '@/lib/auth'"
  },
  {
    name: 'Import statement with currentUser (reversed)',
    pattern: /import\s*{\s*currentUser,\s*auth\s*}\s*from\s*['"]@clerk\/nextjs\/server['"]/g,
    replacement: "import { validateRequest } from '@/lib/auth'"
  },
];

// Patterns that require manual review
const MANUAL_REVIEW_PATTERNS = [
  /\bauth\(\)/,
  /\bcurrentUser\(\)/,
  /clerkId/,
  /userId\s*:/,
  /@clerk\/nextjs/,
];

// Directories to process
const DIRECTORIES = [
  './src/app/api/v1',
  './src/components',
  './src/lib',
];

// Files to skip
const SKIP_PATTERNS = [
  /\.bak$/,
  /\.backup$/,
  /node_modules/,
  /\.next/,
  /dist/,
  /build/,
];

let filesProcessed = 0;
let filesModified = 0;
let filesNeedingReview = [];

function shouldSkip(filePath) {
  return SKIP_PATTERNS.some(pattern => pattern.test(filePath));
}

function processFile(filePath) {
  if (shouldSkip(filePath)) {
    return;
  }

  if (!filePath.endsWith('.ts') && !filePath.endsWith('.tsx')) {
    return;
  }

  filesProcessed++;
  
  let content = fs.readFileSync(filePath, 'utf8');
  let originalContent = content;
  let modified = false;

  // Apply safe replacements
  for (const replacement of SAFE_REPLACEMENTS) {
    const matches = content.match(replacement.pattern);
    if (matches) {
      content = content.replace(replacement.pattern, replacement.replacement);
      modified = true;
      console.log(`  ✓ Applied: ${replacement.name}`);
    }
  }

  // Check if manual review is needed
  const needsReview = MANUAL_REVIEW_PATTERNS.some(pattern => pattern.test(content));
  
  if (needsReview) {
    filesNeedingReview.push(filePath);
  }

  // Write changes if not dry run
  if (modified && !DRY_RUN) {
    fs.writeFileSync(filePath, content, 'utf8');
    filesModified++;
    console.log(`✅ Modified: ${filePath}`);
  } else if (modified && DRY_RUN) {
    console.log(`🔍 Would modify: ${filePath}`);
  }

  if (needsReview) {
    console.log(`⚠️  Needs manual review: ${filePath}`);
  }
}

function processDirectory(dir) {
  if (!fs.existsSync(dir)) {
    console.warn(`⚠️  Directory not found: ${dir}`);
    return;
  }

  const files = fs.readdirSync(dir);

  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      processDirectory(filePath);
    } else {
      processFile(filePath);
    }
  }
}

console.log('🚀 Starting Clerk to Lucia migration...\n');
console.log(`Mode: ${DRY_RUN ? 'DRY RUN (no changes will be made)' : 'LIVE (files will be modified)'}\n`);

// Process all directories
for (const dir of DIRECTORIES) {
  console.log(`\n📁 Processing directory: ${dir}`);
  processDirectory(dir);
}

// Print summary
console.log('\n' + '='.repeat(60));
console.log('📊 Migration Summary');
console.log('='.repeat(60));
console.log(`Files processed: ${filesProcessed}`);
console.log(`Files modified: ${filesModified}`);
console.log(`Files needing manual review: ${filesNeedingReview.length}`);

if (filesNeedingReview.length > 0) {
  console.log('\n⚠️  Files requiring manual review:');
  filesNeedingReview.forEach((file, index) => {
    console.log(`${index + 1}. ${file}`);
  });
  
  console.log('\n📝 Manual review checklist for each file:');
  console.log('  1. Replace auth() with validateRequest()');
  console.log('  2. Replace { userId } with { user }');
  console.log('  3. Remove currentUser() calls (data in user object)');
  console.log('  4. Replace clerkId with user.id in queries');
  console.log('  5. Update response objects to use user.id');
}

if (DRY_RUN) {
  console.log('\n💡 Run without --dry-run to apply changes');
}

console.log('\n✅ Migration script complete!\n');

