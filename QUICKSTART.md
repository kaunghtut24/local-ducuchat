# ⚡ Quick Start - Get Running in 5 Minutes

## Prerequisites

- Node.js 18+ ([Download](https://nodejs.org/))
- PostgreSQL 14+ ([Download](https://www.postgresql.org/download/))

## 🚀 One-Command Setup

```bash
npm run setup
```

That's it! The interactive wizard will guide you through everything.

---

## 📝 Step-by-Step (Manual)

### 1. Clone & Install
```bash
git clone https://github.com/kaunghtut24/local-ducuchat.git
cd local-ducuchat
npm install
```

### 2. Configure Environment
```bash
# Copy template
cp .env.example .env

# Generate secret
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

# Edit .env and set:
# - DATABASE_URL="postgresql://user:password@localhost:5432/document_chat_db"
# - NEXTAUTH_SECRET="<paste generated secret>"
```

### 3. Set Up Database
```bash
npx prisma generate
npx prisma db push
```

### 4. Run
```bash
npm run dev
```

Open **http://localhost:3000** 🎉

---

## 🎯 Platform-Specific Setup

### macOS/Linux
```bash
./scripts/quick-start.sh
```

### Windows (PowerShell)
```powershell
.\scripts\quick-start.ps1
```

---

## ✅ Verify Setup

After running, you should see:
- ✓ App running at http://localhost:3000
- ✓ Can access sign-up page
- ✓ Database tables created (check with `npm run db:studio`)

---

## 🔑 Add API Keys (Optional)

Edit `.env` to enable features:

```bash
# AI Chat (choose one)
OPENROUTER_API_KEY="sk-or-v1-..."        # 100+ models
OPENAI_API_KEY="sk-..."                  # OpenAI only
ANTHROPIC_API_KEY="sk-ant-..."           # Claude only

# File Storage
NEXT_PUBLIC_SUPABASE_URL="https://..."
NEXT_PUBLIC_SUPABASE_ANON_KEY="..."

# Background Jobs
INNGEST_EVENT_KEY="..."
INNGEST_SIGNING_KEY="..."
```

Restart after adding keys: `npm run dev`

---

## 🆘 Troubleshooting

### Database Connection Error
```bash
# Check PostgreSQL is running
pg_isready

# Create database if needed
createdb document_chat_db
```

### Port 3000 Already in Use
```bash
# Kill process on port 3000
npx kill-port 3000

# Or use different port
PORT=3001 npm run dev
```

### Prisma Client Error
```bash
npx prisma generate
```

---

## 📚 Next Steps

1. **Create Account** - Sign up at http://localhost:3000/sign-up
2. **Upload Document** - Test document processing
3. **Try AI Chat** - Ask questions about documents
4. **Explore Features** - Check out the dashboard

---

## 📖 Full Documentation

- [SETUP_GUIDE.md](./SETUP_GUIDE.md) - Detailed setup guide
- [README.md](./README.md) - Complete documentation
- [ENV_VARIABLES_MIGRATION.md](./ENV_VARIABLES_MIGRATION.md) - Environment variables

---

## 💡 Useful Commands

```bash
npm run dev          # Start development server
npm run db:studio    # Open database GUI
npm run build        # Build for production
npm run lint         # Run linter
npm run type-check   # Check TypeScript
```

---

**Happy coding! 🎉**

Need help? [Open an issue](https://github.com/kaunghtut24/local-ducuchat/issues)

