# Observability & Monitoring Guide

This guide covers the complete observability stack for the Document Chat System, including Prometheus metrics, Grafana dashboards, and monitoring best practices.

## 📊 Overview

The Document Chat System includes a production-ready observability stack that provides:

- **Real-time metrics** - Track AI operations, document processing, vector search, and system health
- **Historical analysis** - Analyze trends, identify bottlenecks, and optimize performance
- **Alerting** - Get notified of issues before they impact users
- **Cost tracking** - Monitor AI API costs and optimize spending
- **Performance monitoring** - Identify slow queries, high latency, and resource bottlenecks

## 🚀 Quick Start

### 1. Install Dependencies

```bash
npm install
```

This will install `prom-client` for Prometheus metrics export.

### 2. Start the Observability Stack

```bash
# Start Prometheus + Grafana
npm run observability:start

# Or manually with Docker Compose
docker-compose -f docker-compose.observability.yml up -d
```

### 3. Start Your Application

```bash
npm run dev
```

### 4. Access Dashboards

- **Grafana**: http://localhost:3001 (admin/admin)
- **Prometheus**: http://localhost:9090
- **Metrics API**: http://localhost:3000/api/metrics

## 📈 Available Metrics

### AI Provider Metrics

| Metric | Type | Description | Labels |
|--------|------|-------------|--------|
| `document_chat_ai_requests_total` | Counter | Total AI requests | provider, model, operation, status, organization_id |
| `document_chat_ai_request_duration_seconds` | Histogram | AI request latency | provider, model, operation, organization_id |
| `document_chat_ai_tokens_total` | Counter | Token usage | provider, model, token_type, organization_id |
| `document_chat_ai_cost_total` | Counter | AI costs in USD | provider, model, organization_id |
| `document_chat_ai_circuit_breaker_state` | Gauge | Circuit breaker state (0=closed, 1=open, 2=half-open) | provider |

### Document Processing Metrics

| Metric | Type | Description | Labels |
|--------|------|-------------|--------|
| `document_chat_document_processing_total` | Counter | Documents processed | status, document_type, organization_id |
| `document_chat_document_processing_duration_seconds` | Histogram | Processing time | document_type, organization_id |
| `document_chat_vectorization_total` | Counter | Vectorization operations | status, organization_id |

### Vector Search Metrics

| Metric | Type | Description | Labels |
|--------|------|-------------|--------|
| `document_chat_vector_search_total` | Counter | Vector searches | backend, status, organization_id |
| `document_chat_vector_search_duration_seconds` | Histogram | Search latency | backend, organization_id |
| `document_chat_vector_index_size` | Gauge | Vectors in index | backend, organization_id |

### Cache Metrics

| Metric | Type | Description | Labels |
|--------|------|-------------|--------|
| `document_chat_cache_operations_total` | Counter | Cache operations | operation, status, cache_type |
| `document_chat_cache_hit_ratio` | Gauge | Cache hit ratio (0-1) | cache_type |
| `document_chat_cache_operation_duration_seconds` | Histogram | Cache operation latency | operation, cache_type |

### Background Job Metrics

| Metric | Type | Description | Labels |
|--------|------|-------------|--------|
| `document_chat_background_jobs_total` | Counter | Background jobs | job_type, status, organization_id |
| `document_chat_background_job_duration_seconds` | Histogram | Job execution time | job_type, organization_id |

### HTTP Metrics

| Metric | Type | Description | Labels |
|--------|------|-------------|--------|
| `document_chat_http_requests_total` | Counter | HTTP requests | method, route, status_code |
| `document_chat_http_request_duration_seconds` | Histogram | Request latency | method, route |

## 🔍 Example Queries

### AI Performance

```promql
# AI request rate by provider
rate(document_chat_ai_requests_total[5m])

# Average AI latency
rate(document_chat_ai_request_duration_seconds_sum[5m]) / rate(document_chat_ai_request_duration_seconds_count[5m])

# AI error rate
rate(document_chat_ai_requests_total{status="error"}[5m]) / rate(document_chat_ai_requests_total[5m])

# Total AI cost per hour
increase(document_chat_ai_cost_total[1h])

# Token usage by provider
rate(document_chat_ai_tokens_total[5m])
```

### Document Processing

```promql
# Document processing throughput
rate(document_chat_document_processing_total{status="success"}[5m])

# Average processing time
rate(document_chat_document_processing_duration_seconds_sum[5m]) / rate(document_chat_document_processing_duration_seconds_count[5m])

# Processing success rate
rate(document_chat_document_processing_total{status="success"}[5m]) / rate(document_chat_document_processing_total[5m])
```

### Vector Search

```promql
# Vector search latency (p95)
histogram_quantile(0.95, rate(document_chat_vector_search_duration_seconds_bucket[5m]))

# Vector search rate
rate(document_chat_vector_search_total[5m])

# Index size by backend
document_chat_vector_index_size
```

### Cache Performance

```promql
# Cache hit ratio
document_chat_cache_hit_ratio

# Cache operation latency
rate(document_chat_cache_operation_duration_seconds_sum[5m]) / rate(document_chat_cache_operation_duration_seconds_count[5m])
```

## 🎨 Grafana Dashboards

### Pre-built Dashboard

The system includes a pre-built dashboard at `observability/grafana/dashboards/document-chat-overview.json` with:

- AI request rate and latency
- Document processing metrics
- Vector search performance
- Cache hit ratios
- Background job status
- System resource usage

### Creating Custom Dashboards

1. Open Grafana at http://localhost:3001
2. Click "+" → "Dashboard"
3. Add panels with PromQL queries
4. Save the dashboard
5. Export JSON to `observability/grafana/dashboards/` for version control

## 🚨 Alerting

### Setting Up Alerts

Create alert rules in `observability/prometheus/alerts/`:

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
          summary: "High AI request latency"
          description: "AI requests averaging >5s for 5 minutes"
```

## 📚 Additional Resources

- [Prometheus Documentation](https://prometheus.io/docs/)
- [Grafana Documentation](https://grafana.com/docs/)
- [PromQL Basics](https://prometheus.io/docs/prometheus/latest/querying/basics/)
- [Observability README](../observability/README.md)

