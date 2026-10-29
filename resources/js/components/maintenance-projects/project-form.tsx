import { ArrowLeft, Map, Search } from 'lucide-react';
import { useState } from 'react';
import {
    IntegrationNotice,
    ProjectWorkspace,
} from '@/components/maintenance-projects/project-workspace';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import '../../../css/maintenance-project-create.css';
import type {
    CoverageChoice,
    IntegrationStatus,
    ProjectFormValues,
} from '@/types/maintenance-projects';

export type ProjectFormProps = {
    mode?: 'create' | 'edit';
    backLabel?: string;
    coverageLocked?: boolean;
    coverages: CoverageChoice[];
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
    const selected = coverages.find(
        (coverage) => String(coverage.id) === values.road_coverage_id,
    );
    const query = search.trim().toLocaleLowerCase();
    const matches = coverages.filter((coverage) =>
        create
            ? `${coverage.road_name} ${coverage.municipality ?? ''}`
                  .toLocaleLowerCase()
                  .includes(query)
            : coverage.road_name
                  .toLocaleLowerCase()
                  .includes(search.toLocaleLowerCase()),
    );
    const visible = create
        ? matches
              .filter((coverage) => showAssigned || !coverage.assigned)
              .sort((a, b) => Number(a.assigned) - Number(b.assigned))
        : matches;
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
                                onChange={(event) =>
                                    setSearch(event.target.value)
                                }
                                disabled={!integration.ready}
                            />
                        </div>
                        {create ? (
                            <div className="jr-coverage-info">
                                <p className="jr-field-hint" role="status">
                                    {
                                        matches.filter(
                                            (coverage) => !coverage.assigned,
                                        ).length
                                    }{' '}
                                    available · {matches.length} total coverages
                                </p>
                                <label className="jr-show-assigned">
                                    <input
                                        type="checkbox"
                                        role="switch"
                                        checked={showAssigned}
                                        onChange={(event) =>
                                            setShowAssigned(
                                                event.target.checked,
                                            )
                                        }
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
                            {visible.length === 0 && (
                                <div className="jr-empty">
                                    <p>
                                        {!integration.ready
                                            ? 'Road coverages will appear when integration is available.'
                                            : search
                                              ? create && !showAssigned
                                                  ? 'No available coverages match your search. Turn on Show assigned to include unavailable entries.'
                                                  : 'No coverages match your search.'
                                              : 'No road coverages are available to this account.'}
                                    </p>
                                </div>
                            )}
                        </div>
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
                            <h3>Map preview</h3>
                            <div
                                className="jr-map-placeholder"
                                aria-live="polite"
                            >
                                <Map className="size-12" aria-hidden="true" />
                                <strong>
                                    {selected
                                        ? 'Map preview unavailable'
                                        : 'Select a road coverage'}
                                </strong>
                                <span>
                                    {selected
                                        ? 'A map preview is not available for this coverage yet.'
                                        : 'Choose an available coverage from the list to preview its location.'}
                                </span>
                                {selected && (
                                    <Button
                                        type="button"
                                        variant="outline"
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
                        </div>
                    ) : (
                        <div>
                            <p className="jr-field-hint mb-3">
                                Map preview · placeholder
                            </p>
                            <div className="jr-map-placeholder">
                                <Map className="size-12" />
                                <strong>RoadCoverage map preview</strong>
                                <span>
                                    Stored geometry will appear here when map
                                    integration is ready.
                                </span>
                            </div>
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
                                {selected && !coverageLocked && (
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() =>
                                            onChange({
                                                ...values,
                                                road_coverage_id: '',
                                            })
                                        }
                                    >
                                        Clear
                                    </Button>
                                )}
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
                                className="mt-2"
                                value={selected?.municipality ?? ''}
                                readOnly
                                aria-describedby={
                                    create ? 'municipality-hint' : undefined
                                }
                                placeholder="From selected RoadCoverage"
                            />
                            <p
                                className="jr-field-hint mt-2"
                                id={create ? 'municipality-hint' : undefined}
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
