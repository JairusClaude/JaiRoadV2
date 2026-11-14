<?php

declare(strict_types=1);

return [
    // Public map providers receive location coordinates/search terms, never account credentials.
    'routing' => env('JAIROADS_MAP_ROUTING_URL', 'https://router.project-osrm.org/route/v1/driving'),
    'geocoding' => env('JAIROADS_MAP_GEOCODING_URL', 'https://photon.komoot.io/api'),
];
