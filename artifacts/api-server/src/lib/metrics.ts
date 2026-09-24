type RouteMetric = {
  requests: number;
  errors: number;
  totalLatencyMs: number;
  slowRequests: number;
};

const startedAt = new Date();
const routes = new Map<string, RouteMetric>();
const MAX_ROUTE_KEYS = 500;

function routeKey(method: string, route: string, statusCode: number): string {
  return `${method} ${route} ${statusCode}`;
}

export function recordRequest(
  method: string,
  route: string,
  statusCode: number,
  latencyMs: number,
): void {
  const key = routeKey(method, route, statusCode);
  let metric = routes.get(key);
  if (!metric) {
    if (routes.size >= MAX_ROUTE_KEYS) return;
    metric = { requests: 0, errors: 0, totalLatencyMs: 0, slowRequests: 0 };
    routes.set(key, metric);
  }

  metric.requests += 1;
  metric.errors += statusCode >= 500 ? 1 : 0;
  metric.totalLatencyMs += latencyMs;
  metric.slowRequests += latencyMs >= 1_000 ? 1 : 0;
}

export function getMetricsSnapshot() {
  return {
    startedAt: startedAt.toISOString(),
    uptimeSeconds: Math.floor((Date.now() - startedAt.getTime()) / 1_000),
    routes: [...routes.entries()].map(([route, metric]) => ({
      route,
      ...metric,
      averageLatencyMs: metric.requests
        ? Math.round(metric.totalLatencyMs / metric.requests)
        : 0,
    })),
  };
}

export function getPrometheusMetrics(): string {
  const lines = [
    "# HELP evenum_http_requests_total Total HTTP responses by route and status.",
    "# TYPE evenum_http_requests_total counter",
    "# HELP evenum_http_request_latency_ms_total Accumulated HTTP response latency.",
    "# TYPE evenum_http_request_latency_ms_total counter",
    "# HELP evenum_http_slow_requests_total HTTP responses taking at least one second.",
    "# TYPE evenum_http_slow_requests_total counter",
  ];

  for (const [route, metric] of routes) {
    const [method, path, status] = route.split(" ");
    const labels = `method="${method}",route="${path}",status="${status}"`;
    lines.push(`evenum_http_requests_total{${labels}} ${metric.requests}`);
    lines.push(`evenum_http_request_latency_ms_total{${labels}} ${metric.totalLatencyMs}`);
    lines.push(`evenum_http_slow_requests_total{${labels}} ${metric.slowRequests}`);
  }

  return `${lines.join("\n")}\n`;
}