export type IntegrationStatus = { ready: boolean; message: string | null };
export type ProjectSummary = {
    id: number;
    project_title: string;
    description: string | null;
    road_coverage_id: number | null;
    road_name: string | null;
    municipality: string | null;
    created_by: string | null;
    created_at: string | null;
    updated_at: string | null;
    maintenance_records_count: number;
    can_edit: boolean;
    can_delete: boolean;
};
export type ProjectFilters = {
    search: string;
    municipality: string | number;
    sort: 'newest' | 'oldest';
};
export type Pagination = {
    data: ProjectSummary[];
    total: number;
    from: number | null;
    to: number | null;
    current_page: number;
    last_page: number;
    links: { url: string | null; label: string; active: boolean }[];
};
export type CoverageChoice = {
    id: number;
    road_name: string;
    municipality: string | null;
    kilometers: string;
    assigned: boolean;
    geojson: unknown | null;
};
export type ProjectFormValues = {
    road_coverage_id: string;
    project_title: string;
    description: string;
};
