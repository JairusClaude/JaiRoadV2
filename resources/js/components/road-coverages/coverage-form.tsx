import { Head, router, useForm, usePage } from '@inertiajs/react';
import { ArrowLeft } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { ProjectWorkspace } from '@/components/maintenance-projects/project-workspace';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { editUrl, formReturn } from '@/lib/form-navigation';
import {
    distanceKm,
    lineCoordinates,
    validateCoverage,
} from '@/lib/road-coverages/geometry.mjs';
import type { RoadCoverageFormProps } from '@/types/road-coverages';
import { CoverageMapEditor } from './coverage-map-editor';
import { MunicipalitySelector } from './municipality-selector';
import '../../../css/road-coverage-form.css';

type Values = {
    road_name: string;
    lgus_id: string;
    pavement_type: string;
    state_category: string;
    kilometers: string;
    geojson: object | null;
    correction_reason: string;
};
export function CoverageForm({
    coverage,
    municipalities,
    referenceCoverages,
    canEdit,
    cancelUrl,
    mapServices,
    geometryToken,
}: RoadCoverageFormProps) {
    const page = usePage(),
        back = formReturn(page.url, cancelUrl, ['/road-coverages']);
    const title = coverage ? 'Edit Road Coverage' : 'Add Road Coverage';
    const enabled = page.props.previewOnly === true && canEdit;
    const form = useForm<Values>({
        road_name: coverage?.road_name ?? '',
        lgus_id: coverage ? String(coverage.lgus_id) : '',
        pavement_type: coverage?.pavement_type ?? '',
        state_category: coverage?.state_category ?? '',
        kilometers:
            coverage?.kilometers === null || !coverage
                ? ''
                : String(coverage.kilometers),
        geojson: coverage?.geojson ?? null,
        correction_reason: '',
    });
    const saving = useRef(false);
    const [mappingDirty, setMappingDirty] = useState(false);
    const [pending, setPending] = useState(false);
    const [geometryNotice, setGeometryNotice] = useState('');
    const [manualLength, setManualLength] = useState(
        coverage?.length_override ??
            (!!coverage &&
                !!lineCoordinates(coverage.geojson) &&
                Number(coverage.kilometers) !==
                    Number(
                        distanceKm(lineCoordinates(coverage.geojson)!).toFixed(
                            2,
                        ),
                    )),
    );
    const points = lineCoordinates(form.data.geojson),
        calculated = points ? distanceKm(points).toFixed(2) : null;
    const set = <K extends keyof Values>(key: K, value: Values[K]) => {
        form.setData((previous) => ({ ...previous, [key]: value }));
        form.clearErrors(key);
    };
    const error = (key: keyof Values) =>
        form.errors[key] && (
            <p className="jr-field-error" role="alert" id={`${key}-error`}>
                {form.errors[key]}
            </p>
        );
    const required = <span className="jr-required"> *</span>;
    const cancel = () => router.visit(back);
    useEffect(() => {
        const unload = (e: BeforeUnloadEvent) => {
            if ((form.isDirty || mappingDirty) && !saving.current) {
                e.preventDefault();
                e.returnValue = '';
            }
        };
        window.addEventListener('beforeunload', unload);
        const remove = router.on('before', (event) => {
            if (
                form.isDirty &&
                !saving.current &&
                !window.confirm('Discard unsaved road coverage changes?')
            ) {
                event.preventDefault();
            }
        });

        return () => {
            window.removeEventListener('beforeunload', unload);
            remove();
        };
    }, [form.isDirty, mappingDirty]);

    return (
        <>
            <Head title={title} />
            <ProjectWorkspace>
                <div className="jr-record-screen jr-coverage-form">
                    <button
                        className="jr-back"
                        type="button"
                        disabled={form.processing}
                        onClick={cancel}
                    >
                        <ArrowLeft className="size-4" />
                        Road Coverages
                    </button>
                    <div className="jr-page-head">
                        <div>
                            <h1>{title}</h1>
                            <p>
                                {coverage
                                    ? 'Update the road coverage information and its mapped alignment.'
                                    : 'Place three locations to generate and review one continuous road coverage.'}
                            </p>
                        </div>
                    </div>
                    <form
                        noValidate
                        onSubmit={(event) => {
                            event.preventDefault();

                            if (!enabled || saving.current || form.processing) {
                                return;
                            }

                            form.clearErrors();
                            const errors = validateCoverage(
                                form.data,
                                municipalities,
                                coverage,
                            );

                            if (
                                coverage &&
                                JSON.stringify(
                                    lineCoordinates(form.data.geojson),
                                ) !==
                                    JSON.stringify(
                                        lineCoordinates(coverage.geojson),
                                    ) &&
                                !form.data.correction_reason.trim()
                            ) {
                                form.setError(
                                    'correction_reason',
                                    'A correction reason is required.',
                                );

                                return;
                            }

                            if (pending) {
                                errors.geojson =
                                    'Finish or cancel the current mapping operation before saving.';
                            }

                            if (Object.keys(errors).length) {
                                const toggle =
                                    document.querySelector<HTMLButtonElement>(
                                        '.jr-map-section-toggle',
                                    );

                                if (
                                    toggle?.getAttribute('aria-expanded') ===
                                    'false'
                                ) {
                                    toggle.click();
                                }

                                const panel =
                                    document.querySelector<HTMLButtonElement>(
                                        '[aria-label="Expand mapping panel"]',
                                    );
                                panel?.click();
                                form.setError(errors);
                                document
                                    .getElementById(Object.keys(errors)[0])
                                    ?.focus();

                                return;
                            }

                            saving.current = true;
                            form.transform((data) => ({
                                ...data,
                                geometry_changed:
                                    !coverage ||
                                    JSON.stringify(data.geojson) !==
                                        JSON.stringify(coverage.geojson),
                                geometry_token: geometryToken,
                                length_override: manualLength,
                                ...(coverage &&
                                JSON.stringify(data.geojson) ===
                                    JSON.stringify(coverage.geojson)
                                    ? { geojson: undefined }
                                    : {}),
                            }));
                            form.submit(
                                coverage ? 'put' : 'post',
                                editUrl(
                                    coverage
                                        ? `/road-coverages/${coverage.id}`
                                        : '/road-coverages',
                                    back,
                                ),
                                {
                                    preserveScroll: true,
                                    onFinish: () => {
                                        saving.current = false;
                                    },
                                },
                            );
                        }}
                    >
                        <CoverageMapEditor
                            initial={coverage?.geojson ?? null}
                            referenceCoverages={referenceCoverages}
                            disabled={!enabled || form.processing}
                            services={mapServices}
                            editing={!!coverage}
                            onPending={setPending}
                            onWorkingDirty={setMappingDirty}
                            municipality={form.data.lgus_id}
                            municipalities={municipalities}
                            information={
                                <>
                                    <div className="jr-map-information-fields">
                                        <div className="jr-record-fields">
                                            <div className="jr-record-field">
                                                <Label htmlFor="road_name">
                                                    Road Coverage Name{required}
                                                </Label>
                                                <Input
                                                    id="road_name"
                                                    name="road_name"
                                                    placeholder="Enter road coverage name"
                                                    maxLength={255}
                                                    required
                                                    value={form.data.road_name}
                                                    disabled={
                                                        !enabled ||
                                                        form.processing
                                                    }
                                                    aria-invalid={
                                                        !!form.errors.road_name
                                                    }
                                                    aria-describedby={
                                                        form.errors.road_name
                                                            ? 'road_name-error'
                                                            : undefined
                                                    }
                                                    onChange={(e) =>
                                                        set(
                                                            'road_name',
                                                            e.target.value,
                                                        )
                                                    }
                                                />
                                                {error('road_name')}
                                            </div>
                                            <div className="jr-record-field">
                                                <Label htmlFor="lgus_id">
                                                    Municipality{required}
                                                </Label>
                                                <MunicipalitySelector
                                                    options={municipalities}
                                                    value={form.data.lgus_id}
                                                    disabled={
                                                        !enabled ||
                                                        form.processing
                                                    }
                                                    invalid={
                                                        !!form.errors.lgus_id
                                                    }
                                                    onChange={(value) =>
                                                        set('lgus_id', value)
                                                    }
                                                />
                                                {error('lgus_id')}
                                            </div>
                                        </div>
                                        <div className="jr-record-fields jr-coverage-attributes">
                                            {(
                                                [
                                                    {
                                                        key: 'pavement_type',
                                                        label: 'Pavement Type',
                                                        placeholder:
                                                            'Select pavement type',
                                                        options: [
                                                            'Concrete',
                                                            'Asphalt',
                                                            'Gravel',
                                                            'Earth',
                                                        ],
                                                    },
                                                    {
                                                        key: 'state_category',
                                                        label: 'Road Condition',
                                                        placeholder:
                                                            'Select road condition',
                                                        options: [
                                                            'Good',
                                                            'Fair',
                                                            'Bad',
                                                        ],
                                                    },
                                                ] as const
                                            ).map((field) => (
                                                <div
                                                    className="jr-record-field"
                                                    key={field.key}
                                                >
                                                    <Label htmlFor={field.key}>
                                                        {field.label}
                                                        {required}
                                                    </Label>
                                                    <Select
                                                        value={
                                                            form.data[field.key]
                                                        }
                                                        onValueChange={(
                                                            value,
                                                        ) =>
                                                            set(
                                                                field.key,
                                                                value,
                                                            )
                                                        }
                                                        disabled={
                                                            !enabled ||
                                                            form.processing
                                                        }
                                                    >
                                                        <SelectTrigger
                                                            id={field.key}
                                                            className="jr-record-select"
                                                            aria-required="true"
                                                            aria-invalid={
                                                                !!form.errors[
                                                                    field.key
                                                                ]
                                                            }
                                                            aria-describedby={
                                                                form.errors[
                                                                    field.key
                                                                ]
                                                                    ? `${field.key}-error`
                                                                    : undefined
                                                            }
                                                        >
                                                            <SelectValue
                                                                placeholder={
                                                                    field.placeholder
                                                                }
                                                            />
                                                        </SelectTrigger>
                                                        <SelectContent className="jr-theme jr-menu">
                                                            {field.options.map(
                                                                (option) => (
                                                                    <SelectItem
                                                                        value={
                                                                            option
                                                                        }
                                                                        key={
                                                                            option
                                                                        }
                                                                    >
                                                                        {option}
                                                                    </SelectItem>
                                                                ),
                                                            )}
                                                        </SelectContent>
                                                    </Select>
                                                    {error(field.key)}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </>
                            }
                            lengthFields={
                                <>
                                    <div className="jr-record-field">
                                        <Label htmlFor="kilometers">
                                            Recorded length (km){required}
                                        </Label>
                                        <Input
                                            id="kilometers"
                                            name="kilometers"
                                            type="number"
                                            min="0.01"
                                            max="99999999.99"
                                            step="0.01"
                                            placeholder="Calculated from completed route"
                                            required
                                            value={form.data.kilometers}
                                            disabled={
                                                !enabled || form.processing
                                            }
                                            aria-invalid={
                                                !!form.errors.kilometers
                                            }
                                            aria-describedby={`kilometers-hint${form.errors.kilometers ? ' kilometers-error' : ''}`}
                                            onChange={(e) => {
                                                set(
                                                    'kilometers',
                                                    e.target.value,
                                                );
                                                setManualLength(true);
                                            }}
                                        />
                                        <p
                                            className="jr-field-hint"
                                            id="kilometers-hint"
                                        >
                                            {calculated !== null
                                                ? `Calculated: ${calculated} km${manualLength ? ' · Manually adjusted' : ''}.`
                                                : 'Calculated when both trace legs are complete.'}{' '}
                                            You may adjust this value.
                                        </p>
                                        {calculated !== null && (
                                            <button
                                                type="button"
                                                className="jr-length-reset"
                                                disabled={
                                                    !enabled || form.processing
                                                }
                                                onClick={() => {
                                                    set(
                                                        'kilometers',
                                                        calculated,
                                                    );
                                                    setManualLength(false);
                                                }}
                                            >
                                                Use calculated length
                                            </button>
                                        )}
                                        {error('kilometers')}
                                    </div>
                                </>
                            }
                            onChange={(value) => {
                                const line = lineCoordinates(value);
                                form.setData((previous) => ({
                                    ...previous,
                                    geojson: value,
                                    ...(!manualLength && line
                                        ? {
                                              kilometers:
                                                  distanceKm(line).toFixed(2),
                                          }
                                        : {}),
                                }));
                                form.clearErrors('geojson');
                                setGeometryNotice(
                                    line
                                        ? ''
                                        : 'Complete both road portions before saving.',
                                );
                            }}
                        />
                        <div id="geojson" tabIndex={-1}>
                            {error('geojson')}
                        </div>
                        {geometryNotice && (
                            <p className="jr-field-hint" role="status">
                                {geometryNotice}
                            </p>
                        )}
                        {coverage &&
                            JSON.stringify(
                                lineCoordinates(form.data.geojson),
                            ) !==
                                JSON.stringify(
                                    lineCoordinates(coverage.geojson),
                                ) && (
                                <div
                                    className="jr-record-field"
                                    style={{ maxWidth: 480, marginTop: 12 }}
                                >
                                    <Label htmlFor="correction_reason">
                                        Correction reason
                                        <span className="jr-required"> *</span>
                                    </Label>
                                    <Input
                                        id="correction_reason"
                                        maxLength={255}
                                        value={form.data.correction_reason}
                                        onChange={(e) =>
                                            set(
                                                'correction_reason',
                                                e.target.value,
                                            )
                                        }
                                        placeholder="Why is this road alignment changing?"
                                    />
                                    {error('correction_reason')}
                                </div>
                            )}
                        <footer className="jr-form-footer jr-map-savebar">
                            <p>
                                {form.isDirty ? 'Unsaved changes · ' : ''}Local
                                preview · changes reset on restart.
                            </p>
                            <div className="flex gap-2">
                                <Button
                                    type="button"
                                    variant="outline"
                                    disabled={form.processing}
                                    onClick={cancel}
                                >
                                    Cancel
                                </Button>
                                <Button
                                    type="submit"
                                    className="jr-primary"
                                    disabled={!enabled || form.processing}
                                >
                                    {form.processing
                                        ? 'Saving…'
                                        : coverage
                                          ? 'Save Changes'
                                          : 'Save Road Coverage'}
                                </Button>
                            </div>
                        </footer>
                    </form>
                </div>
            </ProjectWorkspace>
        </>
    );
}
