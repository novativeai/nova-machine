#!/bin/bash

# Read the secret from .env.local
SECRET=$(grep ADMIN_SETUP_SECRET .env.local | cut -d= -f2)

# Call the API
curl -X POST http://localhost:3000/api/admin/setup \
  -H "Content-Type: application/json" \
  -d "{\"email\": \"novativeai@gmail.com\", \"secret\": \"$SECRET\"}"

echo ""
echo "Done! Check the response above."
