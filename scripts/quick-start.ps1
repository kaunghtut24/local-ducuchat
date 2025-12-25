# Quick Start Script for Document Chat System (Windows PowerShell)
# Run this script to set up the application automatically

# Set error action preference
$ErrorActionPreference = "Stop"

# Colors
function Write-Success { Write-Host "✓ $args" -ForegroundColor Green }
function Write-Error { Write-Host "✗ $args" -ForegroundColor Red }
function Write-Info { Write-Host "ℹ $args" -ForegroundColor Cyan }
function Write-Warning { Write-Host "⚠ $args" -ForegroundColor Yellow }
function Write-Header { Write-Host $args -ForegroundColor Blue }

# Print header
function Print-Header {
    Write-Header "╔════════════════════════════════════════════╗"
    Write-Header "║   Document Chat System - Quick Start      ║"
    Write-Header "╚════════════════════════════════════════════╝"
    Write-Host ""
}

# Check if command exists
function Test-Command {
    param($Command)
    try {
        if (Get-Command $Command -ErrorAction Stop) {
            return $true
        }
    }
    catch {
        return $false
    }
}

# Generate random secret
function New-Secret {
    $bytes = New-Object byte[] 32
    [Security.Cryptography.RNGCryptoServiceProvider]::Create().GetBytes($bytes)
    return [Convert]::ToBase64String($bytes)
}

# Main setup function
function Start-Setup {
    Print-Header
    
    # Check prerequisites
    Write-Info "🔍 Checking prerequisites..."
    
    if (-not (Test-Command "node")) {
        Write-Error "Node.js is not installed. Please install Node.js 18+ from https://nodejs.org/"
        exit 1
    }
    $nodeVersion = node --version
    Write-Success "Node.js $nodeVersion"
    
    if (-not (Test-Command "npm")) {
        Write-Error "npm is not installed"
        exit 1
    }
    $npmVersion = npm --version
    Write-Success "npm $npmVersion"
    
    if (-not (Test-Command "psql")) {
        Write-Warning "PostgreSQL not found. You'll need to install it separately."
    }
    else {
        $pgVersion = (psql --version) -replace '.*?(\d+\.\d+).*', '$1'
        Write-Success "PostgreSQL $pgVersion"
    }
    
    Write-Host ""
    
    # Install dependencies
    Write-Info "📦 Installing dependencies..."
    try {
        npm install
        Write-Success "Dependencies installed"
    }
    catch {
        Write-Error "Failed to install dependencies"
        exit 1
    }
    
    Write-Host ""
    
    # Setup environment
    Write-Info "⚙️  Setting up environment..."
    
    if (Test-Path ".env") {
        Write-Warning ".env file already exists"
        $overwrite = Read-Host "Do you want to overwrite it? (y/N)"
        if ($overwrite -ne "y" -and $overwrite -ne "Y") {
            Write-Info "Skipping .env setup"
        }
        else {
            Copy-Item ".env.example" ".env" -Force
            Write-Success "Created .env from template"
        }
    }
    else {
        Copy-Item ".env.example" ".env"
        Write-Success "Created .env from template"
    }
    
    # Generate NEXTAUTH_SECRET
    if (Test-Path ".env") {
        $secret = New-Secret
        $envContent = Get-Content ".env" -Raw
        $envContent = $envContent -replace 'NEXTAUTH_SECRET=".*"', "NEXTAUTH_SECRET=`"$secret`""
        Set-Content ".env" $envContent
        Write-Success "Generated NEXTAUTH_SECRET"
    }
    
    Write-Host ""
    
    # Database setup
    Write-Info "🗄️  Setting up database..."
    
    $setupDb = Read-Host "Do you want to set up the database now? (Y/n)"
    if ($setupDb -ne "n" -and $setupDb -ne "N") {
        try {
            # Generate Prisma client
            Write-Info "Generating Prisma client..."
            npx prisma generate
            Write-Success "Generated Prisma client"
            
            # Push schema
            Write-Info "Creating database schema..."
            npx prisma db push
            Write-Success "Database schema created"
            
            # Optional seed
            $seed = Read-Host "Do you want to seed the database? (y/N)"
            if ($seed -eq "y" -or $seed -eq "Y") {
                try {
                    npm run db:seed
                    Write-Success "Database seeded"
                }
                catch {
                    Write-Warning "Seed script not available or failed"
                }
            }
        }
        catch {
            Write-Error "Database setup failed. Please check your DATABASE_URL in .env"
        }
    }
    else {
        Write-Info "Skipping database setup"
    }
    
    Write-Host ""
    
    # Success message
    Write-Host "╔════════════════════════════════════════════╗" -ForegroundColor Green
    Write-Host "║          ✅ Setup Complete!                ║" -ForegroundColor Green
    Write-Host "╚════════════════════════════════════════════╝" -ForegroundColor Green
    Write-Host ""
    
    Write-Info "🚀 Next steps:"
    Write-Host "   1. Edit .env file to add your API keys"
    Write-Host "   2. Run: npm run dev"
    Write-Host "   3. Open: http://localhost:3000"
    Write-Host ""
    
    Write-Info "📚 Useful commands:"
    Write-Host "   npm run dev          - Start development server"
    Write-Host "   npm run db:studio    - Open database GUI"
    Write-Host "   npx inngest-cli dev  - Start background jobs"
    Write-Host ""
    
    Write-Host "💡 For more information, see SETUP_GUIDE.md" -ForegroundColor Blue
    Write-Host ""
    
    # Ask to start dev server
    $startDev = Read-Host "Do you want to start the development server now? (y/N)"
    if ($startDev -eq "y" -or $startDev -eq "Y") {
        Write-Info "🚀 Starting development server..."
        npm run dev
    }
}

# Run the setup
try {
    Start-Setup
}
catch {
    Write-Error "Setup failed: $_"
    exit 1
}

