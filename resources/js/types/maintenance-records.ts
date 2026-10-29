import type { DependentCounts } from './maintenance-projects';

export type EngineerOption = {
    id: number;
    first_name: string;
    middle_name?: string | null;
    last_name: string;
};

// Extends the existing Project Details summary without assuming richer Laravel
// props are available before the record endpoint is integrated.
export type MaintenanceRecordSummary = {
    edit_url?: string | null;
    delete_url?: string | null;
    deletion_counts?: DependentCounts;
    id: number;
    year: number;
    quarter: string;
    status: string;
    engineers_id?: number;
    managing_engineer?: EngineerOption | null;
    start_date?: string | null;
    details_url?: string | null;
};

export type MaintenanceRecordValues = {
    maintenance_year: string;
    quarter: string;
    engineers_id: string;
    status: string;
    start_date: string;
    estimated_duration_days: string;
    complete_date: string;
    description: string;
};

export type RecordErrors = Partial<
    Record<keyof MaintenanceRecordValues, string>
>;

export type MaintenanceRecordDetail = MaintenanceRecordSummary & {
    project_id: number;
    estimated_duration_days: number;
    complete_date: string | null;
    description: string | null;
    created_by: string | null;
    created_at: string | null;
    updated_at: string | null;
};
