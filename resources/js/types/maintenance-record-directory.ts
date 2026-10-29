import type {
    IntegrationStatus,
    Pagination,
    ProjectSummary,
} from './maintenance-projects';
import type { MaintenanceRecordDetail } from './maintenance-records';

// Directory projection of the existing record and its owning project.
export type RecordDirectoryRow = MaintenanceRecordDetail & {
    project: Pick<ProjectSummary, 'id' | 'project_title' | 'municipality'>;
};
export type RecordDirectoryFilters = {
    search: string;
    municipality: string;
    year: string;
    quarter: string;
    status: string;
    sort: 'newest' | 'oldest';
};
export type RecordDirectoryProps = {
    records: Omit<Pagination, 'data'> & { data: RecordDirectoryRow[] };
    municipalities: { value: string; label: string }[];
    years: number[];
    projects: Pick<ProjectSummary, 'id' | 'project_title' | 'municipality'>[];
    filters: RecordDirectoryFilters;
    integration: IntegrationStatus;
    canCreate: boolean;
};
