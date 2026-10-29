export type RoadCoverage = {
    length_override?: boolean;
    id: number;
    road_name: string;
    lgus_id: number;
    kilometers: string | number | null;
    pavement_type: 'Concrete' | 'Asphalt' | 'Gravel' | 'Earth';
    state_category: 'Good' | 'Fair' | 'Bad';
    geojson: object | null;
    created_by: number;
    created_at: string;
    updated_at: string;
};
// Municipality is joined for this response, not stored on RoadCoverage.
export type RoadCoverageRow = RoadCoverage & {
    lgu: { id: number; municipality_name: string };
};
export type RoadCoverageFilters = {
    search: string;
    municipality: string;
    condition: string;
    pavement: string;
    sort: 'newest' | 'oldest' | 'name-asc' | 'name-desc';
};
export type RoadCoverageDirectoryProps = {
    canEdit: boolean;
    coverages: {
        data: RoadCoverageRow[];
        total: number;
        current_page: number;
        last_page: number;
        from: number | null;
        to: number | null;
    };
    municipalities: { id: number; municipality_name: string }[];
    filters: RoadCoverageFilters;
};

export type RoadCoverageFormProps = {
    mapServices?: { routing: string; geocoding: string };
    geometryToken?: string;
    coverage?: RoadCoverage;
    municipalities: { id: number; municipality_name: string }[];
    referenceCoverages: RoadCoverage[];
    canEdit: boolean;
    cancelUrl: string;
};
