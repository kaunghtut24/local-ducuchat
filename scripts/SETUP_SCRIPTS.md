# Setup Scripts Guide

Quick reference for automated setup scripts.

## 🚀 Quick Start

### Option 1: Interactive Setup (Recommended)
```bash
npm run setup
```
Cross-platform Node.js wizard that guides you through setup.

### Option 2: Bash Script (macOS/Linux)
```bash
chmod +x scripts/quick-start.sh
./scripts/quick-start.sh
```

### Option 3: PowerShell Script (Windows)
```powershell
.\scripts\quick-start.ps1
```

---

## 📋 What Gets Set Up

All scripts will:
1. ✅ Check prerequisites (Node.js, npm, PostgreSQL)
2. ✅ Install npm dependencies
3. ✅ Create `.env` from `.env.example`
4. ✅ Generate secure `NEXTAUTH_SECRET`
5. ✅ Set up database with Prisma
6. ✅ Optionally seed database

---

## 🔧 Script Details

### `setup.js` - Interactive Wizard
- **Platform**: All (Node.js)
- **Run**: `npm run setup`
- **Features**:
  - Step-by-step prompts
  - Colored terminal output
  - Automatic secret generation
  - Database setup wizard
  - Error handling

### `quick-start.sh` - Bash Script
- **Platform**: macOS, Linux, WSL
- **Run**: `./scripts/quick-start.sh`
- **Features**:
  - Fast automated setup
  - Minimal prompts
  - Prerequisite checking
  - Option to start dev server

### `quick-start.ps1` - PowerShell Script
- **Platform**: Windows
- **Run**: `.\scripts\quick-start.ps1`
- **Features**:
  - Native Windows experience
  - PowerShell colored output
  - Same functionality as bash version

---

## 🛠️ Manual Setup

If you prefer manual control:

```bash
# 1. Install dependencies
npm install

# 2. Create environment file
cp .env.example .env

# 3. Generate secret (choose one)
openssl rand -base64 32  # macOS/Linux
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"  # All platforms

# 4. Edit .env and set:
#    - DATABASE_URL
#    - NEXTAUTH_SECRET (paste generated secret)

# 5. Set up database
npx prisma generate
npx prisma db push

# 6. Start development
npm run dev
```

---

## ⚙️ Environment Variables

### Required
- `DATABASE_URL` - PostgreSQL connection string
- `NEXTAUTH_SECRET` - Session encryption key (min 32 chars)
- `NEXT_PUBLIC_APP_URL` - Application URL

### Optional (Add later)
- `OPENROUTER_API_KEY` - AI chat functionality
- `NEXT_PUBLIC_SUPABASE_URL` - File storage
- `INNGEST_EVENT_KEY` - Background jobs

See [SETUP_GUIDE.md](../SETUP_GUIDE.md) for complete list.

---

## 🐛 Troubleshooting

### Permission Denied (Bash)
```bash
chmod +x scripts/quick-start.sh
```

### PowerShell Execution Policy
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### Database Connection Error
- Ensure PostgreSQL is running
- Check `DATABASE_URL` format
- Verify database exists

### Prisma Client Error
```bash
npx prisma generate
```

---

## 📚 Next Steps

After setup:
1. Edit `.env` to add API keys
2. Run `npm run dev`
3. Open http://localhost:3000
4. Create your first account

---

## 🔗 Related Documentation

- [SETUP_GUIDE.md](../SETUP_GUIDE.md) - Detailed setup instructions
- [ENV_VARIABLES_MIGRATION.md](../ENV_VARIABLES_MIGRATION.md) - Environment variables reference
- [README.md](../README.md) - Full project documentation

---

**Need help?** Open an issue on GitHub

