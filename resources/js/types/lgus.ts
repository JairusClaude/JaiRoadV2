export type LguValues = {
    municipality_name: string;
    province: string;
    region: string;
    mayor_first_name: string;
    mayor_middle_name: string;
    mayor_last_name: string;
};
export type Lgu = LguValues & { id: number };
export type LguFilters = {
    search: string;
    province: string;
    region: string;
    sort: 'asc' | 'desc';
};
export type LguPage = {
    data: LguSummary[];
    total: number;
    current_page: number;
    last_page: number;
    from: number | null;
    to: number | null;
};

// Related rows are read-only response projections, not additional LGU attributes.
export type LguRoadCoverage = {
    id: number;
    road_name: string;
    kilometers: string | number | null;
    pavement_type: string | null;
    state_category: string | null;
};
export type LguEngineerAssignment = {
    engineer_id: number;
    full_name: string;
    rank: string | null;
    assignment_is_active: boolean | null;
};
export type LguDetailProps = {
    lgu: LguSummary;
    roadCoverages: LguRoadCoverage[];
    assignedEngineers: LguEngineerAssignment[];
    relationshipDataAvailable: {
        roadCoverages: boolean;
        engineerAssignments: boolean;
    };
    directoryUrl: string;
    message?: string;
    lguPermissions: LguPermissions;
    lguReviewNotice?: string;
};

export type LguDeletionCheck = {
    available: boolean;
    road_coverages: number;
    engineer_assignments: number;
};
export type LguSummary = Lgu & { deletion_check: LguDeletionCheck };
export type LguPermissions = { can_edit: boolean; can_delete: boolean };
