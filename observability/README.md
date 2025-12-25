# Observability Stack - Prometheus + Grafana

This directory contains the observability infrastructure for the Document Chat System, providing comprehensive monitoring, metrics collection, and visualization.

## 🎯 Overview

The observability stack consists of:

- **Prometheus** - Time-series database for metrics collection
- **Grafana** - Visualization and dashboards
- **Node Exporter** - System-level metrics (CPU, memory, disk, network)
- **cAdvisor** - Container metrics (Docker)

## 🚀 Quick Start

### 1. Start the Observability Stack

```bash
# Start Prometheus + Grafana
docker-compose -f docker-compose.observability.yml up -d

# Check status
docker-compose -f docker-compose.observability.yml ps
```

### 2. Access the Dashboards

- **Grafana**: http://localhost:3001
  - Username: `admin`
  - Password: `admin`
  
- **Prometheus**: http://localhost:9090

- **cAdvisor**: http://localhost:8080

### 3. Start Your Application

```bash
npm run dev
```

The application will automatically expose metrics at `http://localhost:3000/api/metrics`

## 📊 Available Metrics

### AI Provider Metrics

- `document_chat_ai_requests_total` - Total AI requests by provider/model/status
- `document_chat_ai_request_duration_seconds` - AI request latency
- `document_chat_ai_tokens_total` - Token usage by provider/model
- `document_chat_ai_cost_total` - AI costs in USD
- `document_chat_ai_circuit_breaker_state` - Circuit breaker status

### Document Processing Metrics

- `document_chat_document_processing_total` - Documents processed
- `document_chat_document_processing_duration_seconds` - Processing time
- `document_chat_vectorization_total` - Vectorization operations

### Vector Search Metrics

- `document_chat_vector_search_total` - Vector search operations
- `document_chat_vector_search_duration_seconds` - Search latency
- `document_chat_vector_index_size` - Number of vectors in index

### Cache Metrics

- `document_chat_cache_operations_total` - Cache operations (get/set/delete)
- `document_chat_cache_hit_ratio` - Cache hit ratio (0-1)
- `document_chat_cache_operation_duration_seconds` - Cache operation latency

### Background Job Metrics

- `document_chat_background_jobs_total` - Background jobs by type/status
- `document_chat_background_job_duration_seconds` - Job execution time

### HTTP Metrics

- `document_chat_http_requests_total` - HTTP requests by method/route/status
- `document_chat_http_request_duration_seconds` - Request latency

### System Metrics (via Node Exporter)

- CPU usage, load average
- Memory usage, swap
- Disk I/O, filesystem usage
- Network traffic

## 📈 Pre-built Dashboards

### Document Chat System - Overview

Located at: `observability/grafana/dashboards/document-chat-overview.json`

Includes:
- AI request rate and latency
- Document processing throughput
- Vector search performance
- Cache hit ratios
- Background job status
- System resource usage

## 🔧 Configuration

### Prometheus Configuration

Edit `observability/prometheus/prometheus.yml` to:
- Adjust scrape intervals
- Add new scrape targets
- Configure alerting rules

### Grafana Configuration

- **Datasources**: `observability/grafana/provisioning/datasources/`
- **Dashboards**: `observability/grafana/provisioning/dashboards/`
- **Custom Dashboards**: `observability/grafana/dashboards/`

## 🚨 Alerting (Optional)

To enable alerting, uncomment the alertmanager section in `prometheus.yml` and create alert rules:

```yaml
# observability/prometheus/alerts/ai-alerts.yml
groups:
  - name: ai_alerts
    interval: 30s
    rules:
      - alert: HighAILatency
        expr: rate(document_chat_ai_request_duration_seconds_sum[5m]) / rate(document_chat_ai_request_duration_seconds_count[5m]) > 5
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High AI request latency detected"
          description: "AI requests are taking longer than 5 seconds on average"
```

## 🔍 Querying Metrics

### Example PromQL Queries

```promql
# AI request rate by provider
rate(document_chat_ai_requests_total[5m])

# Average AI latency
rate(document_chat_ai_request_duration_seconds_sum[5m]) / rate(document_chat_ai_request_duration_seconds_count[5m])

# Total AI cost per hour
increase(document_chat_ai_cost_total[1h])

# Cache hit ratio
document_chat_cache_hit_ratio

# Document processing success rate
rate(document_chat_document_processing_total{status="success"}[5m]) / rate(document_chat_document_processing_total[5m])
```

## 🛠️ Troubleshooting

### Metrics not appearing in Prometheus

1. Check if the app is running: `curl http://localhost:3000/api/metrics`
2. Verify Prometheus can reach the app: Check Prometheus targets at http://localhost:9090/targets
3. Check Docker network: `docker network inspect observability_observability`

### Grafana can't connect to Prometheus

1. Verify Prometheus is running: `docker ps | grep prometheus`
2. Check datasource configuration in Grafana
3. Restart Grafana: `docker-compose -f docker-compose.observability.yml restart grafana`

### High memory usage

Prometheus stores metrics in memory. To reduce usage:
- Decrease retention time in `prometheus.yml`
- Reduce scrape frequency
- Limit the number of time series

## 📚 Additional Resources

- [Prometheus Documentation](https://prometheus.io/docs/)
- [Grafana Documentation](https://grafana.com/docs/)
- [PromQL Basics](https://prometheus.io/docs/prometheus/latest/querying/basics/)
- [Grafana Dashboard Best Practices](https://grafana.com/docs/grafana/latest/best-practices/)

