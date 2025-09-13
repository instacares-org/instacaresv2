#!/bin/bash

# Get CSRF token
CSRF_RESPONSE=$(curl -sk https://instacares.net/api/auth/csrf -c cookies.txt)
CSRF_TOKEN=$(echo $CSRF_RESPONSE | grep -o '"csrfToken":"[^"]*' | cut -d'"' -f4)

echo "CSRF Token: $CSRF_TOKEN"

# Try to login using NextAuth credentials provider
LOGIN_RESPONSE=$(curl -sk https://instacares.net/api/auth/callback/credentials \
  -X POST \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -b cookies.txt \
  -c cookies.txt \
  -d "{\"email\":\"admin@instacares.net\",\"password\":\"admin123\",\"csrfToken\":\"$CSRF_TOKEN\"}" \
  -w "\nHTTP Status: %{http_code}\n")

echo "Login Response: $LOGIN_RESPONSE"

# Check session
SESSION_RESPONSE=$(curl -sk https://instacares.net/api/auth/session \
  -H "Accept: application/json" \
  -b cookies.txt)

echo "Session Response: $SESSION_RESPONSE"
