#!/bin/bash

# 🚀 Comprehensive Backend Deployment Fix Script
# This script fixes all the database and deployment issues causing 500 errors

set -e  # Exit on any error

echo "🔧 Starting Backend Deployment Fix..."
echo "======================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Step 1: Backup current files
echo -e "\n${BLUE}1️⃣ Creating backups...${NC}"
cp src/controllers/auth.controller.ts src/controllers/auth.controller.backup.ts
cp prisma/schema.prisma prisma/schema.backup.prisma
echo -e "${GREEN}✅ Backups created${NC}"

# Step 2: Update auth controller
echo -e "\n${BLUE}2️⃣ Updating auth controller for string IDs...${NC}"
cp src/controllers/auth.controller.fixed.ts src/controllers/auth.controller.ts
echo -e "${GREEN}✅ Auth controller updated${NC}"

# Step 3: Clean up unused files
echo -e "\n${BLUE}3️⃣ Removing unused Mongoose files...${NC}"
rm -f src/models/user.model.ts 2>/dev/null || true
echo -e "${GREEN}✅ Cleanup completed${NC}"

# Step 4: Update schema (done by fix-database-schema.js)
echo -e "\n${BLUE}4️⃣ Running database schema fix...${NC}"
node fix-database-schema.js

# Step 5: Check environment variables
echo -e "\n${BLUE}5️⃣ Checking environment variables...${NC}"
if [ -f .env ]; then
    echo -e "${GREEN}✅ .env file found${NC}"
    
    # Check for required variables
    if grep -q "DATABASE_URL" .env; then
        echo -e "${GREEN}✅ DATABASE_URL found${NC}"
    else
        echo -e "${RED}❌ DATABASE_URL missing in .env${NC}"
        echo "Please add: DATABASE_URL=your_postgresql_connection_string"
    fi
    
    if grep -q "JWT_SECRET" .env; then
        echo -e "${GREEN}✅ JWT_SECRET found${NC}"
    else
        echo -e "${RED}❌ JWT_SECRET missing in .env${NC}"
        echo "Please add: JWT_SECRET=your_secret_key_here"
    fi
else
    echo -e "${RED}❌ .env file not found${NC}"
    echo "Please create .env file with required environment variables"
fi

# Step 6: Install dependencies
echo -e "\n${BLUE}6️⃣ Installing dependencies...${NC}"
npm install
echo -e "${GREEN}✅ Dependencies installed${NC}"

# Step 7: Generate Prisma client
echo -e "\n${BLUE}7️⃣ Generating Prisma client...${NC}"
npx prisma generate
echo -e "${GREEN}✅ Prisma client generated${NC}"

# Step 8: Build the project
echo -e "\n${BLUE}8️⃣ Building the project...${NC}"
npm run build
echo -e "${GREEN}✅ Project built successfully${NC}"

echo -e "\n${GREEN}🎉 Backend fix completed successfully!${NC}"
echo "======================================="
echo -e "\n${YELLOW}📋 Next Steps for Deployment:${NC}"
echo "1. Deploy this updated code to your hosting platform"
echo "2. Set environment variables on your hosting platform:"
echo "   - DATABASE_URL (PostgreSQL connection string)"
echo "   - JWT_SECRET (strong secret key)"
echo "   - NODE_ENV=production"
echo "   - PORT (if required by your host)"
echo "3. Run database migration on production:"
echo "   npx prisma db push --force-reset"
echo "   OR"
echo "   npx prisma migrate deploy"
echo "4. Restart your deployed application"
echo ""
echo -e "${YELLOW}⚠️  Important Notes:${NC}"
echo "- The db push --force-reset will DELETE ALL existing data"
echo "- Make sure to backup your production database first"
echo "- Test locally before deploying to production"
echo ""
echo -e "${BLUE}🔍 Troubleshooting:${NC}"
echo "If you still get 500 errors after deployment:"
echo "1. Check your hosting platform's logs"
echo "2. Verify all environment variables are set correctly"
echo "3. Ensure your PostgreSQL database is accessible"
echo "4. Check that the database schema is up to date"
