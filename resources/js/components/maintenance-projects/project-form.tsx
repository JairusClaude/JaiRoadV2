import { ArrowLeft, Map, Search } from 'lucide-react';
import { useEffect, useState } from 'react';
import {
    IntegrationNotice,
    ProjectWorkspace,
} from '@/components/maintenance-projects/project-workspace';
import { CoverageMapPreview } from '@/components/road-coverages/coverage-map-preview';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import '../../../css/maintenance-project-create.css';
import type {
    CoverageChoice,
    CoveragePagination,
    IntegrationStatus,
    ProjectFormValues,
} from '@/types/maintenance-projects';

export type ProjectFormProps = {
    mode?: 'create' | 'edit';
    backLabel?: string;
    coverageLocked?: boolean;
    coverages: CoverageChoice[];
    coveragePagination?: CoveragePagination;
    coverageChoiceUrl?: string;
    selectedCoverage?: CoverageChoice | null;
    projectId?: number;
    integration: IntegrationStatus;
    values: ProjectFormValues;
    errors: Partial<Record<keyof ProjectFormValues, string>>;
    processing: boolean;
    onChange: (values: ProjectFormValues) => void;
    onSave: () => void;
    onCancel: () => void;
};

export function ProjectForm({
    mode = 'create',
    backLabel,
    coverageLocked = false,
    coverages,
    coveragePagination,
    coverageChoiceUrl,
    selectedCoverage,
    projectId,
    integration,
    values,
    errors,
    processing,
    onChange,
    onSave,
    onCancel,
}: ProjectFormProps) {
    const create = mode === 'create';
    const [search, setSearch] = useState('');
    const [showAssigned, setShowAssigned] = useState(false);
    const [titleEdited, setTitleEdited] = useState(
        Boolean(values.project_title),
    );
    const [localErrors, setLocalErrors] = useState<ProjectFormProps['errors']>(
        {},
    );
    const [page, setPage] = useState(1);
    const [retry, setRetry] = useState(0);
    const [remembered, setRemembered] = useState<CoverageChoice | null>(null);
    const remote = Boolean(coverageChoiceUrl && coveragePagination);
    const query = search.trim();
    const key = JSON.stringify([query, showAssigned, page, retry]);
    const initial = !query && !showAssigned && page === 1 && retry === 0;
    const [result, setResult] = useState<{
        key: string;
        data?: CoverageChoice[];
        pagination?: CoveragePagination;
        error?: string;
    } | null>(null);

    useEffect(() => {
        if (!coverageChoiceUrl || !coveragePagination || initial) {
            return;
        }

        const controller = new AbortController();
        const deadline = window.setTimeout(() => {
            controller.abort();
            setResult({ key, error: 'Road choices timed out.' });
        }, 12_000);
        const timer = window.setTimeout(async () => {
            const params = new URLSearchParams({
                search: query,
                show_assigned: !create || showAssigned ? '1' : '0',
                page: String(page),
            });

            if (projectId) {
                params.set('project', String(projectId));
            }

            try {
                const url = `${coverageChoiceUrl}?${params}`;
                const response = await fetch(url, {
                    credentials: 'same-origin',
                    headers: { Accept: 'application/json' },
                    cache: 'no-store',
                    signal: controller.signal,
                });

                if (!response.ok) {
                    throw new Error('Road choices unavailable');
                }

                const data: CoveragePagination & { data: CoverageChoice[] } =
                    await response.json();

                if (!controller.signal.aborted) {
                    setResult({ key, data: data.data, pagination: data });
                }
            } catch {
                if (!controller.signal.aborted) {
                    setResult({ key, error: 'Unable to load road choices.' });
                }
            } finally {
                window.clearTimeout(deadline);
            }
        }, 200);

        return () => {
            window.clearTimeout(timer);
            window.clearTimeout(deadline);
            controller.abort();
        };
    }, [
        coverageChoiceUrl,
        coveragePagination,
        create,
        initial,
        key,
        page,
        projectId,
        query,
        showAssigned,
    ]);

    const current = result?.key === key ? result : null;
    const pagination = remote
        ? initial
            ? coveragePagination
            : current?.pagination
        : undefined;
    const rows = remote && !initial ? (current?.data ?? []) : coverages;
    const selected =
        rows.find(
            (coverage) => String(coverage.id) === values.road_coverage_id,
        ) ??
        [remembered, selectedCoverage, ...coverages].find(
            (coverage) => String(coverage?.id) === values.road_coverage_id,
        );
    const matches = remote
        ? rows
        : coverages.filter((coverage) =>
              `${coverage.road_name} ${coverage.municipality ?? ''}`
                  .toLocaleLowerCase()
                  .includes(query.toLocaleLowerCase()),
          );
    const visible = create
        ? matches
              .filter((coverage) => showAssigned || !coverage.assigned)
              .sort((a, b) => Number(a.assigned) - Number(b.assigned))
        : matches;
    const assignedCount =
        pagination?.assigned ??
        matches.filter((coverage) => coverage.assigned).length;
    const availableCount =
        pagination?.available ?? matches.length - assignedCount;
    const loading = remote && !initial && current === null;
    const empty = !loading && !current?.error && visible.length === 0;
    const selectedOffPage =
        selected && !visible.some((coverage) => coverage.id === selected.id);
    const error = (field: keyof ProjectFormValues) =>
        localErrors[field] ??
        (create &&
        field === 'road_coverage_id' &&
        selected?.assigned &&
        errors[field]
            ? `${errors[field]} Choose another available coverage.`
            : errors[field]);
    const choose = (coverage: CoverageChoice) => {
        if (coverage.assigned || coverageLocked) {
            return;
        }

        setLocalErrors({});
        setRemembered(coverage);
        onChange({
            ...values,
            road_coverage_id: String(coverage.id),
            project_title: titleEdited
                ? values.project_title
                : `Project Maintenance ${coverage.road_name}`,
        });
    };

    return (
        <ProjectWorkspace>
            <button className="jr-back" onClick={onCancel}>
                <ArrowLeft className="size-4" />
                {backLabel ??
                    (mode === 'edit'
                        ? 'Project Details'
                        : 'Maintenance Projects')}
            </button>
            <div className="jr-page-head">
                <div>
                    <h1>{mode === 'edit' ? 'Edit Project' : 'Add Project'}</h1>
                    <p>
                        {mode === 'edit'
                            ? 'Update project information and its linked road coverage.'
                            : 'Create a maintenance project for an existing road coverage.'}
                    </p>
                </div>
            </div>
            <IntegrationNotice integration={integration} />
            <form
                noValidate
                className={create ? 'jr-project-create' : undefined}
                aria-busy={processing}
                onSubmit={(event) => {
                    event.preventDefault();
                    const next: ProjectFormProps['errors'] = {};

                    if (!selected || selected.assigned) {
                        next.road_coverage_id =
                            selected?.assigned && create
                                ? 'This road coverage is no longer available. Choose another available coverage.'
                                : 'Select one available road coverage.';
                    }

                    if (!values.project_title.trim()) {
                        next.project_title = 'Enter a project title.';
                    } else if (values.project_title.length > 255) {
                        next.project_title = 'Use 255 characters or fewer.';
                    }

                    setLocalErrors(next);

                    if (
                        Object.keys(next).length === 0 &&
                        integration.ready &&
                        !processing
                    ) {
                        onSave();
                    }
                }}
            >
                <h2>
                    Road Coverage <span className="jr-required">*</span>
                </h2>
                <p className="jr-field-hint" id="coverage-help">
                    {coverageLocked
                        ? 'Road coverage is fixed because this project has maintenance history. You can still update the title and description.'
                        : create
                          ? 'Select exactly one available road coverage. Each coverage can be linked to only one maintenance project.'
                          : 'Select exactly one coverage. Already-assigned coverages are shown for reference and cannot be selected.'}
                </p>
                <div className="jr-coverage-layout">
                    <div>
                        <div className="jr-search">
                            <Search className="size-[18px]" />
                            <Input
                                type="search"
                                placeholder={
                                    create
                                        ? 'Search road coverage by name or municipality...'
                                        : 'Search RoadCoverage by name...'
                                }
                                aria-label={
                                    create
                                        ? 'Search road coverage by name or municipality'
                                        : 'Search RoadCoverage by name'
                                }
                                value={search}
                                onChange={(event) => {
                                    setSearch(event.target.value);
                                    setPage(1);
                                }}
                                disabled={!integration.ready}
                            />
                        </div>
                        {create ? (
                            <div className="jr-coverage-info">
                                <p className="jr-field-hint" role="status">
                                    {availableCount} available · {assignedCount}{' '}
                                    assigned · {availableCount + assignedCount}{' '}
                                    total coverages
                                </p>
                                <label className="jr-show-assigned">
                                    <input
                                        type="checkbox"
                                        role="switch"
                                        checked={showAssigned}
                                        onChange={(event) => {
                                            setShowAssigned(
                                                event.target.checked,
                                            );
                                            setPage(1);
                                        }}
                                        disabled={
                                            !integration.ready || processing
                                        }
                                    />
                                    <span>Show assigned</span>
                                </label>
                            </div>
                        ) : (
                            <p className="jr-field-hint my-3" role="status">
                                {visible.length} coverages ·{' '}
                                {
                                    visible.filter(
                                        (coverage) => !coverage.assigned,
                                    ).length
                                }{' '}
                                available
                            </p>
                        )}
                        {create && showAssigned && (
                            <p className="jr-field-hint mb-2" role="status">
                                {assignedCount === 0
                                    ? 'No assigned road coverages match the current list.'
                                    : 'Assigned roads are shown for reference only and cannot be selected for a new project.'}
                            </p>
                        )}
                        <div
                            className="jr-coverage-list"
                            role="group"
                            aria-label="Road coverage choices"
                            aria-describedby="coverage-help coverage-error"
                            aria-invalid={Boolean(error('road_coverage_id'))}
                        >
                            {visible.map((coverage) => (
                                <label
                                    key={coverage.id}
                                    className="jr-coverage-option"
                                    data-assigned={coverage.assigned}
                                    data-chosen={selected?.id === coverage.id}
                                >
                                    <input
                                        type="radio"
                                        name="road_coverage_id"
                                        checked={selected?.id === coverage.id}
                                        disabled={
                                            coverageLocked ||
                                            coverage.assigned ||
                                            !integration.ready ||
                                            processing
                                        }
                                        value={coverage.id}
                                        onChange={() => choose(coverage)}
                                    />
                                    <span className="min-w-0 flex-1">
                                        <strong>{coverage.road_name}</strong>
                                        <small>
                                            {coverage.municipality ??
                                                'Municipality unavailable'}{' '}
                                            · {coverage.kilometers} km
                                        </small>
                                        {coverage.assigned &&
                                            coverage.assigned_project_title && (
                                                <small>
                                                    Linked project:{' '}
                                                    {
                                                        coverage.assigned_project_title
                                                    }
                                                </small>
                                            )}
                                    </span>
                                    {(!create || coverage.assigned) && (
                                        <span className="jr-availability">
                                            {coverage.assigned
                                                ? 'Already assigned'
                                                : 'Available'}
                                        </span>
                                    )}
                                </label>
                            ))}
                            {loading && (
                                <p role="status">Loading road choices…</p>
                            )}
                            {current?.error && (
                                <div role="alert" className="p-3">
                                    {current.error}{' '}
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() =>
                                            setRetry((value) => value + 1)
                                        }
                                    >
                                        Retry
                                    </Button>
                                </div>
                            )}
                            {empty && (
                                <div className="jr-empty">
                                    <p>
                                        {!integration.ready
                                            ? 'Road coverages will appear when integration is available.'
                                            : search
                                              ? create && !showAssigned
                                                  ? 'No available coverages match your search. Turn on Show assigned to include unavailable entries.'
                                                  : 'No coverages match your search.'
                                              : create &&
                                                  !showAssigned &&
                                                  assignedCount > 0
                                                ? 'All road coverages are already assigned. Turn on Show assigned to view them.'
                                                : 'No road coverages are available to this account.'}
                                    </p>
                                </div>
                            )}
                        </div>
                        {selected && selectedOffPage && (
                            <p className="jr-field-hint mt-2" role="status">
                                {`Selected: ${selected.road_name} (outside this page).`}
                            </p>
                        )}
                        {pagination && pagination.last_page > 1 && (
                            <div className="mt-3 flex items-center justify-between gap-2">
                                <Button
                                    type="button"
                                    variant="outline"
                                    disabled={
                                        processing || pagination.page <= 1
                                    }
                                    onClick={() => setPage(pagination.page - 1)}
                                >
                                    Previous
                                </Button>
                                <span className="text-xs">
                                    Page {pagination.page} of{' '}
                                    {pagination.last_page}
                                </span>
                                <Button
                                    type="button"
                                    variant="outline"
                                    disabled={
                                        processing ||
                                        pagination.page >= pagination.last_page
                                    }
                                    onClick={() => setPage(pagination.page + 1)}
                                >
                                    Next
                                </Button>
                            </div>
                        )}
                        <p
                            className="jr-field-error"
                            id="coverage-error"
                            role="alert"
                        >
                            {error('road_coverage_id')}
                        </p>
                    </div>
                    {create ? (
                        <div className="jr-create-map">
                            <div className="flex items-center justify-between">
                                <h3>Map preview</h3>
                                {selected && (
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 text-xs text-muted-foreground hover:text-foreground"
                                        disabled={processing}
                                        onClick={() =>
                                            onChange({
                                                ...values,
                                                road_coverage_id: '',
                                            })
                                        }
                                    >
                                        Clear selection
                                    </Button>
                                )}
                            </div>
                            {selected ? (
                                <ProjectCoveragePreview
                                    key={selected.id}
                                    coverage={selected}
                                    choiceUrl={coverageChoiceUrl}
                                />
                            ) : (
                                <div
                                    className="jr-map-placeholder"
                                    aria-live="polite"
                                >
                                    <Map
                                        className="size-12"
                                        aria-hidden="true"
                                    />
                                    <strong>Select a road coverage</strong>
                                    <span>
                                        Choose an available coverage from the
                                        list to preview its location.
                                    </span>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="jr-create-map">
                            <div className="flex items-center justify-between">
                                <h3>Map preview</h3>
                                {selected && !coverageLocked && (
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 text-xs text-muted-foreground hover:text-foreground"
                                        disabled={processing}
                                        onClick={() =>
                                            onChange({
                                                ...values,
                                                road_coverage_id: '',
                                            })
                                        }
                                    >
                                        Clear selection
                                    </Button>
                                )}
                            </div>
                            {selected ? (
                                <ProjectCoveragePreview
                                    key={selected.id}
                                    coverage={selected}
                                    choiceUrl={coverageChoiceUrl}
                                />
                            ) : (
                                <div
                                    className="jr-map-placeholder"
                                    aria-live="polite"
                                >
                                    <Map
                                        className="size-12"
                                        aria-hidden="true"
                                    />
                                    <strong>RoadCoverage map preview</strong>
                                    <span>
                                        Select a road coverage from the list to
                                        preview its location.
                                    </span>
                                </div>
                            )}
                            <div
                                className="jr-coverage-summary"
                                aria-live="polite"
                            >
                                <div>
                                    <strong>
                                        {selected?.road_name ??
                                            'No RoadCoverage selected'}
                                    </strong>
                                    <p>
                                        {selected
                                            ? `${selected.municipality ?? 'Municipality unavailable'} · ${selected.kilometers} km`
                                            : 'Choose an available coverage from the list.'}
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
                <section className="jr-form-section">
                    <h2>Project Information</h2>
                    <div className="jr-field-grid">
                        <div>
                            <Label htmlFor="project-title">
                                Project Title{' '}
                                <span className="jr-required">*</span>
                            </Label>
                            <Input
                                id="project-title"
                                className="mt-2"
                                value={values.project_title}
                                placeholder="Select a coverage for a suggested title"
                                maxLength={255}
                                required
                                aria-invalid={Boolean(error('project_title'))}
                                aria-describedby="title-hint title-error"
                                disabled={processing}
                                onChange={(event) => {
                                    setTitleEdited(true);
                                    setLocalErrors((previous) => ({
                                        ...previous,
                                        project_title: undefined,
                                    }));
                                    onChange({
                                        ...values,
                                        project_title: event.target.value,
                                    });
                                }}
                            />
                            <div className="jr-title-hint">
                                <p className="jr-field-hint" id="title-hint">
                                    Suggested from RoadCoverage; you can edit
                                    it. Maximum 255 characters.
                                </p>
                                {selected && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setTitleEdited(false);
                                            onChange({
                                                ...values,
                                                project_title: `Project Maintenance ${selected.road_name}`,
                                            });
                                        }}
                                    >
                                        Use suggested title
                                    </button>
                                )}
                            </div>
                            <p
                                className="jr-field-error"
                                id="title-error"
                                role="alert"
                            >
                                {error('project_title')}
                            </p>
                        </div>
                        <div>
                            <Label htmlFor="project-municipality">
                                Municipality
                            </Label>
                            <Input
                                id="project-municipality"
                                className="mt-2 cursor-not-allowed !bg-slate-100 !text-slate-600 dark:!bg-slate-800 dark:!text-slate-300"
                                value={selected?.municipality ?? ''}
                                readOnly
                                tabIndex={-1}
                                aria-describedby="municipality-hint"
                                placeholder="From selected RoadCoverage"
                            />
                            <p
                                className="jr-field-hint mt-2"
                                id="municipality-hint"
                            >
                                Filled automatically from the linked LGU.
                            </p>
                        </div>
                    </div>
                    <div className="mt-5">
                        <Label htmlFor="project-description">
                            Description{' '}
                            <span className="jr-muted font-normal">
                                (optional)
                            </span>
                        </Label>
                        <textarea
                            id="project-description"
                            className="jr-textarea"
                            rows={3}
                            placeholder="Add any project context or notes..."
                            value={values.description}
                            disabled={processing}
                            onChange={(event) =>
                                onChange({
                                    ...values,
                                    description: event.target.value,
                                })
                            }
                        />
                        <p className="jr-field-error" role="alert">
                            {error('description')}
                        </p>
                    </div>
                </section>
                <footer className="jr-form-footer">
                    <p>
                        {integration.ready
                            ? 'The selected coverage can belong to only one project.'
                            : 'Saving is unavailable until account and database integration is approved.'}
                    </p>
                    <div className="flex gap-2">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={onCancel}
                            disabled={processing}
                        >
                            Cancel
                        </Button>
                        <Button
                            className="jr-primary"
                            type="submit"
                            disabled={processing || !integration.ready}
                        >
                            {processing
                                ? 'Saving…'
                                : mode === 'edit'
                                  ? 'Save Changes'
                                  : 'Save Project'}
                        </Button>
                    </div>
                </footer>
            </form>
        </ProjectWorkspace>
    );
}

function ProjectCoveragePreview({
    coverage,
    choiceUrl,
}: {
    coverage: CoverageChoice;
    choiceUrl?: string;
}) {
    const [geometry, setGeometry] = useState<{
        value?: unknown;
        failed?: boolean;
    } | null>(null);
    const [retry, setRetry] = useState(0);

    useEffect(() => {
        if (!choiceUrl) {
            return;
        }

        const controller = new AbortController();
        const deadline = window.setTimeout(() => {
            controller.abort();
            setGeometry({ failed: true });
        }, 12_000);

        fetch(`${choiceUrl}/${coverage.id}/geometry`, {
            credentials: 'same-origin',
            headers: { Accept: 'application/json' },
            cache: 'no-store',
            signal: controller.signal,
        })
            .then(async (response) => {
                if (!response.ok) {
                    throw new Error('Geometry unavailable');
                }

                const data = await response.json();

                if (!controller.signal.aborted) {
                    setGeometry({ value: data.geojson });
                }
            })
            .catch(() => {
                if (!controller.signal.aborted) {
                    setGeometry({ failed: true });
                }
            })
            .finally(() => window.clearTimeout(deadline));

        return () => {
            window.clearTimeout(deadline);
            controller.abort();
        };
    }, [choiceUrl, coverage.id, retry]);

    if (choiceUrl && (!geometry || geometry.failed)) {
        return (
            <div className="jr-map-placeholder" role="status">
                {geometry?.failed ? (
                    <>
                        <span>Map preview could not be loaded.</span>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => {
                                setGeometry(null);
                                setRetry((value) => value + 1);
                            }}
                        >
                            Retry map
                        </Button>
                    </>
                ) : (
                    'Loading map preview…'
                )}
            </div>
        );
    }

    return (
        <CoverageMapPreview
            geojson={choiceUrl ? geometry?.value : coverage.geojson}
        />
    );
}
