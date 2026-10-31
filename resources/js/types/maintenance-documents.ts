import type {
    MonthlyParentProject,
    MonthlyParentRecord,
} from './monthly-updates';
// Nine stored attributes. Related context and file availability are response projections.
export type MaintenanceDocument = {
    id: number;
    maintenance_id: number;
    document_title: string;
    description: string | null;
    file_name: string;
    file_path?: string;
    download_url?: string;
    can_edit?: boolean;
    uploaded_by: string;
    uploaded_at: string;
    updated_at: string;
};
export type DocumentSummary = MaintenanceDocument & {
    project: MonthlyParentProject;
    record: MonthlyParentRecord;
    available: boolean;
};
export type DocumentParents = {
    projects: MonthlyParentProject[];
    records: MonthlyParentRecord[];
    contextRecordId?: number;
    document?: DocumentSummary;
    cancelUrl: string;
    submitUrl: string;
};
export type DocumentFilters = {
    search: string;
    project: string;
    sort: 'newest' | 'oldest';
};
export type DocumentDirectoryProps = {
    documents: {
        data: DocumentSummary[];
        total: number;
        current_page: number;
        last_page: number;
        from: number | null;
        to: number | null;
    };
    projects: MonthlyParentProject[];
    filters: DocumentFilters;
};
