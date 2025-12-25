#!/bin/bash

# Start Observability Stack (Prometheus + Grafana)
# This script starts the monitoring infrastructure for the Document Chat System

set -e

echo "🔍 Starting Observability Stack..."
echo ""

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
  echo "❌ Docker is not running. Please start Docker and try again."
  exit 1
fi

# Create necessary directories
echo "📁 Creating directories..."
mkdir -p observability/prometheus
mkdir -p observability/grafana/provisioning/datasources
mkdir -p observability/grafana/provisioning/dashboards
mkdir -p observability/grafana/dashboards

# Start the observability stack
echo "🚀 Starting Prometheus + Grafana..."
docker-compose -f docker-compose.observability.yml up -d

# Wait for services to be ready
echo "⏳ Waiting for services to start..."
sleep 5

# Check if services are running
echo ""
echo "✅ Checking service status..."
docker-compose -f docker-compose.observability.yml ps

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Observability Stack Started Successfully!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📊 Access Points:"
echo "  • Grafana:     http://localhost:3001 (admin/admin)"
echo "  • Prometheus:  http://localhost:9090"
echo "  • cAdvisor:    http://localhost:8080"
echo "  • Metrics API: http://localhost:3000/api/metrics"
echo ""
echo "📚 Documentation: observability/README.md"
echo ""
echo "🛑 To stop: docker-compose -f docker-compose.observability.yml down"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

