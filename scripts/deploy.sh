#!/bin/bash
set -e

echo "🚀 Starting deployment process..."

# Check if we're in the right environment
if [[ -z "$DATABASE_URL" ]]; then
    echo "❌ DATABASE_URL is not set"
    exit 1
fi

echo "📊 Environment: ${NODE_ENV:-development}"
echo "🗄️ Database URL: ${DATABASE_URL:0:20}..."

# Generate Prisma client
echo "🔧 Generating Prisma client..."
npx prisma generate

# Run database migrations
echo "🗄️ Running database migrations..."
npx prisma migrate deploy

# Seed the database if needed (only in staging/development)
if [[ "$NODE_ENV" != "production" ]] && [[ "$SEED_DATABASE" == "true" ]]; then
    echo "🌱 Seeding database..."
    npx prisma db seed
fi

echo "✅ Deployment preparation complete!"