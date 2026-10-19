/**
 * Simplified approximate provincial outline for display and map navigation only.
 * Davao de Oro was formerly called Compostela Valley (PH-COM).
 * Source: https://gist.github.com/carmoreira/6a716561cfbdd8106a92515017df2943
 * Renaming: Republic Act No. 11297 (2019).
 * NOT suitable for official land, engineering, jurisdiction or cadastral checks.
 * Keep province-level business rules on the server and use validated GIS data there.
 */
export const DAVAO_DE_ORO_RING: number[][] = [[126.1629,8],[126.1473,7.9711],[126.2468,7.6447],[126.2901,7.4455],[126.2957,7.2707],[125.9523,7.0951],[125.9424,7.0743],[125.884,7.1257],[125.8925,7.1656],[125.8378,7.2535],[125.8319,7.362],[125.8342,7.4614],[125.9194,7.5426],[125.9382,7.6467],[125.9032,7.6908],[125.9443,7.7596],[125.9199,7.8262],[125.8669,7.7667],[125.8009,7.6549],[125.7685,7.7267],[125.7034,7.7826],[125.6752,7.9982],[125.9808,7.9982],[126.0457,7.935],[126.1629,8]];
export const DAVAO_DE_ORO_CENTER: [number, number] = [125.98, 7.5];
export const DAVAO_DE_ORO_BOUNDS: [[number, number], [number, number]] = [
    [125.6752, 7.0743],
    [126.2957, 8.0],
];

export const DAVAO_DE_ORO_POLYGON = {
    type: 'Feature' as const,
    properties: { name: 'Davao de Oro', referenceOnly: true },
    geometry: { type: 'Polygon' as const, coordinates: [DAVAO_DE_ORO_RING] },
};

// Outside mask: the province polygon is a hole in a translucent worldwide fill.
export const DAVAO_DE_ORO_OUTSIDE_MASK = {
    type: 'Feature' as const,
    properties: { name: 'Outside Davao de Oro' },
    geometry: {
        type: 'Polygon' as const,
        coordinates: [
            [[-179.99, -85], [179.99, -85], [179.99, 85], [-179.99, 85], [-179.99, -85]],
            [...DAVAO_DE_ORO_RING].reverse(),
        ],
    },
};

// Ray-casting test limits map center to the actual outline, not just its bbox.
export function insideDavaoDeOro(lng: number, lat: number): boolean {
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) return false;
    if (lng < 125.6752 || lng > 126.2957 || lat < 7.0743 || lat > 8.0) return false;
    let inside = false;
    for (let i = 0, j = DAVAO_DE_ORO_RING.length - 1; i < DAVAO_DE_ORO_RING.length; j = i++) {
        const a = DAVAO_DE_ORO_RING[i];
        const b = DAVAO_DE_ORO_RING[j];
        if ((a[1] > lat) !== (b[1] > lat) && lng < ((b[0] - a[0]) * (lat - a[1])) / (b[1] - a[1]) + a[0]) {
            inside = !inside;
        }
    }
    return inside;
}
