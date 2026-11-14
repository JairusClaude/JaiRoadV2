# Class demonstration starter for JaiROADS (Laravel 13 / PHP 8.3 / Vite).
# Nginx + PHP-FPM; no PHP development server exposed.
FROM node:22-bookworm AS node-runtime

FROM php:8.4-fpm-bookworm

RUN apt-get update && apt-get install -y --no-install-recommends \
        nginx ca-certificates unzip git \
        libpq-dev libzip-dev libicu-dev libonig-dev \
    && docker-php-ext-install -j"$(nproc)" pdo_pgsql mbstring bcmath intl zip opcache \
    && rm -rf /var/lib/apt/lists/* /etc/nginx/sites-enabled/default

COPY --from=composer:2 /usr/bin/composer /usr/local/bin/composer
COPY --from=node-runtime /usr/local/bin/node /usr/local/bin/node
COPY --from=node-runtime /usr/local/lib/node_modules /usr/local/lib/node_modules
RUN ln -s /usr/local/lib/node_modules/npm/bin/npm-cli.js /usr/local/bin/npm \
    && ln -s /usr/local/lib/node_modules/npm/bin/npx-cli.js /usr/local/bin/npx

WORKDIR /var/www/html
COPY . .

RUN mkdir -p storage/app storage/framework/cache/data storage/framework/sessions \
             storage/framework/views storage/logs bootstrap/cache \
    && composer install --no-dev --prefer-dist --no-interaction --optimize-autoloader \
    && npm ci \
    && npm run build \
    && rm -rf node_modules \
    && chown -R www-data:www-data storage bootstrap/cache \
    && chmod -R ug+rwX storage bootstrap/cache

COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY docker/uploads.ini /usr/local/etc/php/conf.d/jairoads-uploads.ini
COPY docker/entrypoint.sh /usr/local/bin/jairoads-entrypoint
ENTRYPOINT ["sh", "/usr/local/bin/jairoads-entrypoint"]
EXPOSE 10000
CMD ["sh", "-c", "php-fpm -D && exec nginx -g 'daemon off;'"]

