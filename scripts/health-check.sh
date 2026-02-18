#!/bin/bash

# Health Check Script for InstaCares
# This script checks if the application is running correctly

set -e

BASE_URL=${1:-"http://localhost:3000"}
echo "🏥 Running health check for: $BASE_URL"

# Function to check HTTP endpoint
check_endpoint() {
    local url=$1
    local expected_status=${2:-200}
    
    echo "Checking: $url"
    
    response=$(curl -s -o /dev/null -w "%{http_code}" "$url" || echo "000")
    
    if [ "$response" = "$expected_status" ]; then
        echo "✅ $url - OK ($response)"
        return 0
    else
        echo "❌ $url - FAILED (Expected: $expected_status, Got: $response)"
        return 1
    fi
}

# Function to check database connectivity
check_database() {
    echo "Checking database connectivity..."
    
    if command -v npx &> /dev/null; then
        if npx prisma db push --accept-data-loss --preview-feature &> /dev/null; then
            echo "✅ Database - Connected and schema is up to date"
            return 0
        else
            echo "❌ Database - Connection or schema issues"
            return 1
        fi
    else
        echo "⚠️ Database - Cannot check (npx not available)"
        return 0
    fi
}

# Function to check PM2 process
check_pm2() {
    echo "Checking PM2 process..."
    
    if command -v pm2 &> /dev/null; then
        if pm2 list | grep -q "instacares.*online"; then
            echo "✅ PM2 - InstaCares is running"
            return 0
        else
            echo "❌ PM2 - InstaCares is not running"
            return 1
        fi
    else
        echo "⚠️ PM2 - Not available (development mode?)"
        return 0
    fi
}

# Main health checks
echo "🚀 Starting InstaCares health check..."
echo "=================================="

failed_checks=0

# Check main application endpoint
check_endpoint "$BASE_URL" || ((failed_checks++))

# Check API health endpoint
check_endpoint "$BASE_URL/api/health" 200 || ((failed_checks++))

# Check admin endpoint (should redirect or return 200/401)
check_endpoint "$BASE_URL/admin" || check_endpoint "$BASE_URL/admin" 401 || check_endpoint "$BASE_URL/admin" 302 || ((failed_checks++))

# Check database
check_database || ((failed_checks++))

# Check PM2 (if in production)
if [ "$NODE_ENV" = "production" ]; then
    check_pm2 || ((failed_checks++))
fi

# Summary
echo "=================================="
if [ $failed_checks -eq 0 ]; then
    echo "🎉 All health checks passed!"
    exit 0
else
    echo "❌ $failed_checks health check(s) failed!"
    exit 1
fi