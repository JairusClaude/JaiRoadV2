# Workspace URL migration

The canonical Laravel prefix is `/workspace`. Every former `/dd-phase3` registration keeps its suffix, method, and controller. Page routes retain `/workspace/ui` and operation routes retain `/workspace/ops`. Generate named links through `jairoads.workspace.*` and `jairoads.ui.*`. The separate `/dd-superadmin-landing` route retains its existing URL and name.

[`routes/workspace-compatibility.php`](../routes/workspace-compatibility.php) registers temporary, unnamed aliases for the migrated endpoints. These use the canonical route constraints, middleware, and throttle buckets. The original controller authorizes page reads before a temporary 302 to the matching canonical URL, with the original query string. JSON and private downloads use the existing handler and response directly. Old mutation requests use the same handler once, keeping the original method, body, authentication, CSRF protection, validation, and audit behavior. An old relative `return_to` value is translated before the controller checks its own destination allowlist.

Route caching supports both namespaces. Wayfinder generates only canonical links for these routes. Active clients should use `/workspace` for page URLs, form submissions, API requests, and private download links.

Retire the aliases under a separate approved change after reviewing access logs for old path use, updating callers or bookmarks that still depend on them, and confirming their owners have completed the transition. Remove the compatibility include and route file, rebuild the route cache and client assets, and verify old requests no longer match while the canonical routes and role checks still pass. Review whether any newly added workspace routes need an old alias before expanding this transition surface.
