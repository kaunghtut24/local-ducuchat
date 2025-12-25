#!/bin/bash

# Quick Start Script for Document Chat System
# This script automates the setup process for Unix-like systems (macOS, Linux)

set -e  # Exit on error

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Functions
print_header() {
    echo -e "${BLUE}╔════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║   Document Chat System - Quick Start      ║${NC}"
    echo -e "${BLUE}╚════════════════════════════════════════════╝${NC}"
    echo ""
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_info() {
    echo -e "${CYAN}ℹ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

# Check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Generate random secret
generate_secret() {
    openssl rand -base64 32 2>/dev/null || node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
}

# Main setup
main() {
    print_header
    
    # Check prerequisites
    echo -e "${CYAN}🔍 Checking prerequisites...${NC}"
    
    if ! command_exists node; then
        print_error "Node.js is not installed. Please install Node.js 18+ from https://nodejs.org/"
        exit 1
    fi
    print_success "Node.js $(node --version)"
    
    if ! command_exists npm; then
        print_error "npm is not installed"
        exit 1
    fi
    print_success "npm $(npm --version)"
    
    if ! command_exists psql; then
        print_warning "PostgreSQL not found. You'll need to install it separately."
    else
        print_success "PostgreSQL $(psql --version | awk '{print $3}')"
    fi
    
    echo ""
    
    # Install dependencies
    echo -e "${CYAN}📦 Installing dependencies...${NC}"
    npm install
    print_success "Dependencies installed"
    echo ""
    
    # Setup environment
    echo -e "${CYAN}⚙️  Setting up environment...${NC}"
    
    if [ -f .env ]; then
        print_warning ".env file already exists"
        read -p "Do you want to overwrite it? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            print_info "Skipping .env setup"
        else
            cp .env.example .env
            print_success "Created .env from template"
        fi
    else
        cp .env.example .env
        print_success "Created .env from template"
    fi
    
    # Generate NEXTAUTH_SECRET
    if [ -f .env ]; then
        SECRET=$(generate_secret)
        if [[ "$OSTYPE" == "darwin"* ]]; then
            # macOS
            sed -i '' "s|NEXTAUTH_SECRET=\".*\"|NEXTAUTH_SECRET=\"$SECRET\"|" .env
        else
            # Linux
            sed -i "s|NEXTAUTH_SECRET=\".*\"|NEXTAUTH_SECRET=\"$SECRET\"|" .env
        fi
        print_success "Generated NEXTAUTH_SECRET"
    fi
    
    echo ""
    
    # Database setup
    echo -e "${CYAN}🗄️  Setting up database...${NC}"
    
    read -p "Do you want to set up the database now? (Y/n): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Nn]$ ]]; then
        # Generate Prisma client
        npx prisma generate
        print_success "Generated Prisma client"
        
        # Push schema
        npx prisma db push
        print_success "Database schema created"
        
        # Optional seed
        read -p "Do you want to seed the database? (y/N): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            npm run db:seed 2>/dev/null || print_warning "Seed script not available"
        fi
    else
        print_info "Skipping database setup"
    fi
    
    echo ""
    
    # Success message
    echo -e "${GREEN}╔════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║          ✅ Setup Complete!                ║${NC}"
    echo -e "${GREEN}╚════════════════════════════════════════════╝${NC}"
    echo ""
    
    echo -e "${CYAN}🚀 Next steps:${NC}"
    echo "   1. Edit .env file to add your API keys"
    echo "   2. Run: npm run dev"
    echo "   3. Open: http://localhost:3000"
    echo ""
    
    echo -e "${CYAN}📚 Useful commands:${NC}"
    echo "   npm run dev          - Start development server"
    echo "   npm run db:studio    - Open database GUI"
    echo "   npx inngest-cli dev  - Start background jobs"
    echo ""
    
    echo -e "${BLUE}💡 For more information, see SETUP_GUIDE.md${NC}"
    echo ""
    
    # Ask to start dev server
    read -p "Do you want to start the development server now? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo -e "${CYAN}🚀 Starting development server...${NC}"
        npm run dev
    fi
}

# Run main function
main

