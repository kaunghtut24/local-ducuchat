# 🚀 Setup Guide - Document Chat System

This guide will help you set up and run the Document Chat System locally in under 10 minutes.

## 📋 Prerequisites

Before you begin, make sure you have:

- **Node.js** 18.x or higher ([Download](https://nodejs.org/))
- **PostgreSQL** 14.x or higher ([Download](https://www.postgresql.org/download/))
- **Git** ([Download](https://git-scm.com/downloads))
- A code editor (VS Code recommended)

## 🎯 Quick Start (3 Steps)

### Step 1: Clone and Install

```bash
# Clone the repository
git clone https://github.com/kaunghtut24/local-ducuchat.git
cd local-ducuchat

# Install dependencies
npm install
```

### Step 2: Set Up Environment Variables

```bash
# Copy the example environment file
cp .env.example .env

# Open .env in your editor and configure (see below)
```

### Step 3: Initialize Database and Run

```bash
# Run the setup script (does everything automatically)
npm run setup

# Or manually:
npx prisma generate
npx prisma db push
npm run dev
```

Your app will be running at **http://localhost:3000** 🎉

---

## 🔧 Detailed Environment Configuration

### Required Variables (Minimum Setup)

Open `.env` and configure these **required** variables:

#### 1. Database Configuration
```bash
# Replace with your PostgreSQL connection string
DATABASE_URL="postgresql://username:password@localhost:5432/document_chat_db"
```

**How to get this:**
- Install PostgreSQL
- Create a database: `createdb document_chat_db`
- Format: `postgresql://[user]:[password]@[host]:[port]/[database]`

#### 2. Session Secret (Required for Authentication)
```bash
# Generate a secure random string (minimum 32 characters)
NEXTAUTH_SECRET="your-super-secret-key-min-32-characters-long"
```

**How to generate:**
```bash
# Option 1: Using OpenSSL
openssl rand -base64 32

# Option 2: Using Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

#### 3. Application URL
```bash
NEXT_PUBLIC_APP_URL="http://localhost:3000"
NEXTAUTH_URL="http://localhost:3000"
```

### Optional but Recommended Variables

#### AI Provider (Choose at least one)

**Option A: OpenRouter (Recommended - Access to 100+ models)**
```bash
OPENROUTER_API_KEY="sk-or-v1-your-api-key"
OPENROUTER_APP_NAME="Document-Chat-System"
OPENROUTER_SITE_URL="http://localhost:3000"
```
Get your key: https://openrouter.ai/keys

**Option B: OpenAI**
```bash
OPENAI_API_KEY="sk-your-openai-api-key"
```
Get your key: https://platform.openai.com/api-keys

**Option C: Anthropic (Claude)**
```bash
ANTHROPIC_API_KEY="sk-ant-your-anthropic-api-key"
```
Get your key: https://console.anthropic.com/settings/keys

#### File Storage (Supabase)
```bash
NEXT_PUBLIC_SUPABASE_URL="https://your-project.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="your-supabase-anon-key"
SUPABASE_SERVICE_ROLE_KEY="your-supabase-service-role-key"
```

**How to get Supabase credentials:**
1. Create account at https://supabase.com
2. Create a new project
3. Go to Settings → API
4. Copy URL and keys

#### Background Jobs (Inngest)
```bash
INNGEST_EVENT_KEY="your-inngest-event-key"
INNGEST_SIGNING_KEY="your-inngest-signing-key"
```

**How to get Inngest credentials:**
1. Create account at https://app.inngest.com
2. Create a new app
3. Go to Keys section
4. Copy Event Key and Signing Key

---

## 🗄️ Database Setup

### Option 1: Automatic Setup (Recommended)
```bash
npm run setup
```

### Option 2: Manual Setup
```bash
# Generate Prisma client
npx prisma generate

# Push schema to database (creates tables)
npx prisma db push

# (Optional) Seed database with sample data
npm run db:seed

# (Optional) Open Prisma Studio to view data
npm run db:studio
```

### PostgreSQL Installation

**macOS (using Homebrew):**
```bash
brew install postgresql@14
brew services start postgresql@14
createdb document_chat_db
```

**Ubuntu/Debian:**
```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql
sudo -u postgres createdb document_chat_db
```

**Windows:**
1. Download from https://www.postgresql.org/download/windows/
2. Run installer
3. Use pgAdmin to create database `document_chat_db`

---

## 🏃 Running the Application

### Development Mode
```bash
npm run dev
```
Opens at http://localhost:3000 with hot reload

### Production Build
```bash
npm run build
npm run start
```

### With Background Jobs (Inngest)
```bash
# Terminal 1: Start the app
npm run dev

# Terminal 2: Start Inngest dev server
npx inngest-cli dev
```
Inngest dashboard: http://localhost:8288

---

## 📦 Available Scripts

| Command | Description |
|---------|-------------|
| `npm run setup` | Complete setup (install + db + generate) |
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm run type-check` | TypeScript type checking |
| `npm run db:generate` | Generate Prisma client |
| `npm run db:push` | Push schema to database |
| `npm run db:migrate` | Create migration |
| `npm run db:studio` | Open Prisma Studio GUI |
| `npm run db:seed` | Seed database |
| `npm run db:reset` | Reset database (⚠️ deletes data) |

---

## ✅ Verification Checklist

After setup, verify everything works:

- [ ] App loads at http://localhost:3000
- [ ] Can create an account (sign up)
- [ ] Can sign in with created account
- [ ] Database connection works (check Prisma Studio)
- [ ] (Optional) AI chat works if API keys configured
- [ ] (Optional) File upload works if Supabase configured

---

## 🐛 Troubleshooting

### Database Connection Error
```
Error: Can't reach database server
```
**Solution:**
- Ensure PostgreSQL is running: `pg_isready`
- Check DATABASE_URL format
- Verify database exists: `psql -l`

### Prisma Client Error
```
Error: @prisma/client did not initialize yet
```
**Solution:**
```bash
npx prisma generate
```

### Port Already in Use
```
Error: Port 3000 is already in use
```
**Solution:**
```bash
# Kill process on port 3000
npx kill-port 3000

# Or use different port
PORT=3001 npm run dev
```

### Authentication Not Working
**Solution:**
- Ensure NEXTAUTH_SECRET is set (min 32 chars)
- Clear browser cookies
- Check database has User and Session tables

---

## 🔐 Security Notes

### For Development:
- ✅ Use `.env` file (already in `.gitignore`)
- ✅ Never commit API keys
- ✅ Use test/development keys only

### For Production:
- ⚠️ Generate new NEXTAUTH_SECRET
- ⚠️ Use production API keys
- ⚠️ Enable HTTPS
- ⚠️ Set secure environment variables in hosting platform

---

## 📚 Next Steps

Once your app is running:

1. **Create your first account** - Sign up at http://localhost:3000/sign-up
2. **Upload a document** - Test document processing
3. **Try AI chat** - Ask questions about your documents
4. **Explore features** - Check out the dashboard

For more details, see:
- [README.md](./README.md) - Full documentation
- [ENV_VARIABLES_MIGRATION.md](./ENV_VARIABLES_MIGRATION.md) - Environment variables guide
- [PHASE3_MIGRATION_GUIDE.md](./PHASE3_MIGRATION_GUIDE.md) - Lucia authentication details

---

## 💡 Tips

- **Use Prisma Studio** to view/edit database: `npm run db:studio`
- **Check logs** in terminal for errors
- **Use Redis** for better performance (optional)
- **Enable Inngest** for background document processing

---

## 🆘 Need Help?

- **Issues**: https://github.com/kaunghtut24/local-ducuchat/issues
- **Discussions**: https://github.com/kaunghtut24/local-ducuchat/discussions

Happy coding! 🎉

