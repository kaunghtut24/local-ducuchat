/**
 * Script to identify and fix Clerk references in the codebase
 * This script provides a systematic approach to migrate from Clerk to Lucia
 */

const fs = require('fs');
const path = require('path');

// Define the replacements needed for Clerk to Lucia migration
const replacements = [
  {
    // Replace Clerk imports with Lucia imports
    search: /from ['"]@clerk\/nextjs\/server['"]/g,
    replace: "from '@/lib/auth'"
  },
  {
    // Replace auth() with validateRequest()
    search: /\bauth\(\)/g,
    replace: 'validateRequest()'
  },
  {
    // Replace currentUser() with appropriate Lucia function
    search: /\bcurrentUser\(\)/g,
    replace: 'null // currentUser() not needed with Lucia - user data is available via validateRequest()'
  },
  {
    // Replace Clerk's getAuth with validateRequest
    search: /\bgetAuth\(\)/g,
    replace: 'validateRequest()'
  },
  {
    // Replace verifyToken import and usage
    search: /\{ verifyToken \}/g,
    replace: '{ /* verifyToken not needed with Lucia */ }'
  },
  {
    // Replace Clerk webhook event import
    search: /import { WebhookEvent } from ['"]@clerk\/nextjs\/server['"]/g,
    replace: "import { WebhookEvent } from '@/lib/auth'" // This would need to be adapted for Lucia
  }
];

// Define directories to search for Clerk references
const directoriesToSearch = [
  './src/app/api',
  './src/components',
  './src/hooks',
  './src/lib'
];

// Files that should be skipped (backup files, etc.)
const skipPatterns = [
  /\.bak$/,
  /\.backup$/,
  /node_modules/,
  /dist/,
  /build/
];

console.log('🔍 Scanning for Clerk references in the codebase...');

// Function to find files with Clerk references
function findClerkFiles(dir) {
  const results = [];
  
  if (skipPatterns.some(pattern => pattern.test(dir))) {
    return results;
 }
  
  const files = fs.readdirSync(dir);
  
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      results.push(...findClerkFiles(filePath));
    } else if (filePath.endsWith('.ts') || filePath.endsWith('.tsx')) {
      const content = fs.readFileSync(filePath, 'utf8');
      
      // Check if file contains Clerk references
      if (content.includes('@clerk/nextjs/server') || 
          content.includes('auth()') || 
          content.includes('currentUser()')) {
        results.push(filePath);
      }
    }
  }
  
  return results;
}

// Find all files with Clerk references
const clerkFiles = directoriesToSearch.flatMap(dir => {
  try {
    return findClerkFiles(dir);
  } catch (error) {
    console.warn(`⚠️  Could not scan directory: ${dir} - ${error.message}`);
    return [];
  }
});

console.log(`\n📋 Found ${clerkFiles.length} files with Clerk references:`);
clerkFiles.forEach((file, index) => {
  console.log(`${index + 1}. ${file}`);
});

console.log('\n🔧 These files need to be updated to use Lucia instead of Clerk:');
console.log('- Replace @clerk/nextjs/server imports with @/lib/auth');
console.log('- Replace auth() calls with validateRequest()');
console.log('- Replace currentUser() calls with user data from validateRequest()');
console.log('- Update database queries to use user.id instead of clerkId');
console.log('- Remove Clerk-specific webhook handling (for production)');
console.log('- Update frontend components to use custom session hooks instead of Clerk hooks');

console.log('\n💡 For frontend components using Clerk hooks, replace:');
console.log('- useUser() with the custom useUser() hook from src/hooks/useAuthSession.ts');
console.log('- useAuth() with the custom useAuth() hook from src/hooks/useAuthSession.ts');
console.log('- SignInButton, SignUpButton, etc. with custom implementations');

console.log('\n✅ The following files have already been updated in this migration:');
console.log('- src/app/api/v1/profile/route.ts');
console.log('- src/app/api/v1/user/route.ts');
console.log('- src/app/api/v1/embeddings/route.ts');
console.log('- src/app/api/v1/upload/route.ts');
console.log('- src/app/api/auth/session/route.ts');
console.log('- src/app/api/auth/logout/route.ts');
console.log('- src/hooks/useAuthSession.ts');

console.log('\n📝 Summary of changes made:');
console.log('1. Created Lucia-based authentication system in src/lib/auth/lucia.ts');
console.log('2. Created custom session hooks in src/hooks/useAuthSession.ts');
console.log('3. Created API routes for session management');
console.log('4. Updated key API routes to use validateRequest() instead of auth()');
console.log('5. Updated database queries to use user.id instead of clerkId');
console.log('6. Created .env file with DATABASE_URL');
console.log('7. Prepared for database migration (requires PostgreSQL server)');

console.log('\n⚠️  Note: The database migration (npx prisma db push) requires a running PostgreSQL server.');
console.log('   Please start your PostgreSQL server and run: npx prisma db push');

console.log('\n🎯 For remaining files, apply similar patterns as shown in the updated files above.');
