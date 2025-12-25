#!/bin/bash

# Stop Observability Stack (Prometheus + Grafana)

set -e

echo "🛑 Stopping Observability Stack..."
echo ""

docker-compose -f docker-compose.observability.yml down

echo ""
echo "✅ Observability Stack Stopped"
echo ""
echo "💡 To preserve data, volumes were not removed."
echo "   To remove all data: docker-compose -f docker-compose.observability.yml down -v"

