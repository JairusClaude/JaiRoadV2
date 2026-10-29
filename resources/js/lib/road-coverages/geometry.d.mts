export type Point = [number, number];
export type RouteFeature = {
    type: 'Feature';
    properties: {
        jairoads_editor?: { version: number; manual: boolean[] };
        jairoads_mapping: {
            version: number;
            method: string;
            control_points: Point[];
            control_point_indices: number[];
        };
    };
    geometry: { type: 'LineString'; coordinates: Point[] };
};
export function coordinate(value: unknown): value is Point;
export function samePoint(a: unknown, b: unknown): boolean;
export function lineCoordinates(value: unknown): Point[] | null;
export function distanceKm(points: Point[]): number;
export function mappingData(
    value: unknown,
): { points: Point[]; legs: Point[][] } | null;
export function routeFeature(
    points: Point[],
    legs: Point[][],
): RouteFeature | null;
export function validateCoverage(
    data: {
        road_name: string;
        lgus_id: string | number;
        pavement_type: string;
        state_category: string;
        kilometers: string | number;
        geojson: object | null;
    },
    lgus: { id: number }[],
    existing?: { geojson: object | null } | null,
): Partial<
    Record<
        | 'road_name'
        | 'lgus_id'
        | 'pavement_type'
        | 'state_category'
        | 'kilometers'
        | 'geojson',
        string
    >
>;
