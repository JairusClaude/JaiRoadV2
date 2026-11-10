<?php

return [
    // Auxiliary schema activation is a separate schema-owner deployment step.
    'enabled' => (bool) env('SECURITY_MONITORING_ENABLED', true),
    'online_seconds' => (int) env('SECURITY_ONLINE_SECONDS', 300),
    'touch_seconds' => 30,
    'failure_limit_per_hour' => 100,
    'failure_limit_per_network_hour' => 20,
    'cache_store' => env('SECURITY_MONITOR_CACHE_STORE', 'security_monitoring'),
    // Fail closed for presence if a complete bounded verification is impossible.
    'max_recent_sessions' => 1000,
    'max_session_files' => 10000,
];
