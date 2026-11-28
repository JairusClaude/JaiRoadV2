import type { Point } from './geometry.mjs';
type NamedPlace = { name: string; point: Point };
type Network = {
    points: Point[];
    neighbors: [number, number][][];
    places: NamedPlace[];
};
export function buildNetwork(data: unknown): Network;
export function findPlaces(graph: Network, query: string): NamedPlace[];
export function alignment(
    graph: Network,
    a: Point,
    b: Point,
    signal?: AbortSignal,
): Promise<Point[] | null>;
export function offlinePlaceSearch(query: string): Promise<NamedPlace[]>;
export function offlineAlignment(
    a: Point,
    b: Point,
    signal?: AbortSignal,
): Promise<Point[] | null>;
