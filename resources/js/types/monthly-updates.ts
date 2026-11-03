export type MonthlyUpdateFilters = {
    search: string;
    project: string;
    // Directory query only: reporting year derived from update_month.
    year: string;
    sort: 'newest' | 'oldest' | 'modified';
};

export type MonthlyUpdateSummary = {
    can_edit?: boolean;
    id: number;
    maintenance_id: number;
    // Canonical YYYY-MM reporting month, independent of record.year.
    update_month: string;
    progress_percentage: number;
    summary_of_text_reports: string | null;
    // Display username; the stored creator ID is server-controlled.
    created_by: string;
    created_at: string;
    updated_at: string;
    project: { id: number; project_title: string };
    record: { id: number; year: number; quarter: string };
    media_count: number;
};

export type MonthlyUpdatePage = {
    data: MonthlyUpdateSummary[];
    total: number;
    current_page: number;
    last_page: number;
    from: number | null;
    to: number | null;
};

export type MonthlyParentProject = {
    id: number;
    project_title: string;
    municipality: string | null;
};
export type MonthlyParentRecord = {
    id: number;
    project_id: number;
    year: number;
    quarter: string;
};
export type MonthlyUpdateValues = {
    project_id: string;
    maintenance_id: string;
    update_month: string;
    progress_percentage: string;
    summary_of_text_reports: string;
    attachments: File[];
    removed_media_ids: number[];
};
export type MonthlyUpdateErrors = Partial<
    Record<keyof MonthlyUpdateValues, string>
>;
export type MonthlyCreateProps = {
    projects: MonthlyParentProject[];
    records: MonthlyParentRecord[];
    existingUpdates: {
        id?: number;
        maintenance_id: number;
        update_month: string;
    }[];
    contextRecordId?: number;
    update?: MonthlyUpdateSummary;
    media?: MonthlyMedia[];
    submitUrl?: string;
    cancelUrl: string;
};

export type MonthlyMedia = {
    id: number;
    file_name: string;
    // Read-only presentation alias of canonical Media.file_type.
    mime_type: string | null;
    size: number | null;
    preview_url: string | null;
    available: boolean;
};
export type MonthlyDetailProps = {
    update: MonthlyUpdateSummary;
    media: MonthlyMedia[];
    backUrl: string;
    backLabel: string;
    directoryUrl: string;
};
