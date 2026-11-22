# merged-system security hardening

These controls apply to the canonical JaiROADS Laravel workspace.

## Production and staging configuration

- `APP_ENV=production` (or `staging`) must **not** enable synthetic preview authentication.
- `JAIROADS_PREVIEW_MODE=false` is the default. A standalone isolated fixture-based preview requires **both** `APP_ENV=preview` and `JAIROADS_PREVIEW_MODE=true`. This must never be combined with production credentials, databases or public internet access.
- `TRUSTED_PROXIES` should contain only the actual reverse proxy IP addresses or CIDR ranges when behind a trusted load balancer. The default leaves forwarding headers untrusted. Do not use `*`. In multi-proxy deployments include the correct hop addresses.
- The canonical `dd-phase3/ui/*` mutation URLs now use Laravel's default CSRF protection. Inertia/axios writes send XSRF credentials automatically; custom `fetch` calls must forward the XSRF cookie using `X-XSRF-TOKEN`.

## Expected protections and checks

1. Spoofed `X-Preview-Mode` and port `8080` requests must not grant authentication in the normal app.
2. A genuine logged-in business mutation with the CSRF token must succeed after authorization; the same mutation without a CSRF token must return 419 in a real HTTP environment.
3. File uploads must have a validated MIME type and a filename extension that agrees with it. Mismatches must produce a validation error before contacting storage.
4. After setting proxy networks, inspect the resolved client IP and scheme behind the deployment ingress. Untrusted forwarding headers must not affect them.
5. `merged-system` pushes should trigger both the core test workflow and full system verification workflow.

## Regression commands (disposable test database only)

```sh
php artisan test --filter=PreviewSecurityTest
php vendor/bin/pest --configuration=phpunit.quarterly.xml --filter=UnifiedFrontendTest
php artisan route:list --except-vendor
composer audit --locked --no-interaction
```

Avoid running migrations or fixture setup against production. Verify the resulting GitHub Actions workflow logs before a release.
