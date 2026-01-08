#!/bin/bash
# Set up Transiter with NYC Subway data

set -e

TRANSITER_URL="${TRANSITER_URL:-http://localhost:8080}"

echo "Waiting for Transiter to be ready..."
until curl -s "$TRANSITER_URL/systems" > /dev/null 2>&1; do
  sleep 2
  echo "  Still waiting..."
done

echo "Transiter is ready!"

# Check if NYC subway is already installed
if curl -s "$TRANSITER_URL/systems/us-ny-subway" | grep -q '"id":"us-ny-subway"'; then
  echo "NYC Subway system already installed"
else
  echo "Installing NYC Subway system..."
  curl -X PUT "$TRANSITER_URL/systems/us-ny-subway?yaml_url=https://raw.githubusercontent.com/jamespfennell/transiter-ny/main/us-ny-subway.yaml"
  echo ""
  echo "NYC Subway installation initiated. This may take a few minutes..."

  # Wait for installation to complete
  sleep 10
  while true; do
    STATUS=$(curl -s "$TRANSITER_URL/systems/us-ny-subway" | grep -o '"status":"[^"]*"' | cut -d'"' -f4)
    if [ "$STATUS" = "ACTIVE" ]; then
      echo "NYC Subway system is now active!"
      break
    elif [ "$STATUS" = "INSTALL_FAILED" ]; then
      echo "Installation failed!"
      exit 1
    else
      echo "  Status: $STATUS - waiting..."
      sleep 5
    fi
  done
fi

echo ""
echo "Testing API..."
curl -s "$TRANSITER_URL/systems/us-ny-subway/routes?limit=3" | head -c 500
echo ""
echo ""
echo "Setup complete! Transiter is running at $TRANSITER_URL"
