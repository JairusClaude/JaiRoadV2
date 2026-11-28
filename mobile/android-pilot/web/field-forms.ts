import {
    distanceKm,
    lineCoordinates,
} from '../../../resources/js/lib/road-coverages/geometry.mjs';
import type { Fields, Kind, Row, Vault } from './queue';

export type Tab = Kind | 'files';
export type Choices = [string, string][];
export const labels: Record<Tab, [string, string]> = {
    project: ['Maintenance Projects', 'project'],
    record: ['Maintenance Records', 'maintenance record'],
    road: ['Road Sections', 'road coverage'],
    monthly: ['Monthly Updates', 'monthly report'],
    files: ['Maintenance Documents', 'local attachment'],
};

export function titleFor(kind: Kind, row: Row | Fields) {
    return String(
        row.road_name ??
            row.project_title ??
            (kind === 'record'
                ? `${row.maintenance_year} · ${row.quarter}`
                : (row.update_month ?? 'Field change')),
    );
}

export function renderFields(
    target: HTMLElement,
    vault: Vault,
    tab: Tab,
    row?: Row,
) {
    const input = (
        name: string,
        label: string,
        options: {
            type?: string;
            choices?: Choices;
            required?: boolean;
            value?: unknown;
            max?: number;
            min?: number;
            step?: string;
            locked?: boolean;
        } = {},
    ) => {
        const wrapper = document.createElement('label');
        wrapper.textContent = label;
        let field: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

        if (options.choices) {
            field = document.createElement('select');

            for (const [key, title] of [['', 'Select…'], ...options.choices]) {
                field.add(new Option(title, key));
            }
        } else if (options.type === 'textarea') {
            field = document.createElement('textarea');
            field.rows = name === 'coordinates' ? 4 : 3;
        } else {
            field = document.createElement('input');
            field.type = options.type ?? 'text';

            if (options.type === 'number') {
                field.min = String(options.min ?? 0);
                field.step = options.step ?? '1';

                if (options.max !== undefined) {
                    field.max = String(options.max);
                }
            }

            if (options.type === 'file') {
                field.accept =
                    'image/jpeg,image/png,image/webp,.pdf,.docx,.xlsx,.pptx';
            }
        }

        field.name = name;
        field.required = options.required ?? true;

        if (
            !(field instanceof HTMLSelectElement) &&
            options.max &&
            options.type !== 'number'
        ) {
            field.maxLength = options.max;
        }

        if (!(field instanceof HTMLInputElement && field.type === 'file')) {
            field.value = String(options.value ?? row?.[name] ?? '');
        }

        if (options.locked) {
            field.setAttribute('aria-readonly', 'true');

            if (field instanceof HTMLSelectElement) {
                field.disabled = true;
                const saved = document.createElement('input');
                saved.type = 'hidden';
                saved.name = name;
                saved.value = field.value;
                wrapper.append(saved);
            } else {
                field.readOnly = true;
            }
        }

        wrapper.append(field);
        target.append(wrapper);
    };
    const list = (kind: 'road' | 'project' | 'record' | 'monthly'): Choices =>
        vault
            .rows(kind)
            .map((value) => [String(value.id), titleFor(kind, value)]);

    if (tab === 'road') {
        const storedGeometry =
            typeof row?.geojson === 'string'
                ? JSON.parse(row.geojson)
                : row?.geojson;
        const coordinates = lineCoordinates(storedGeometry);
        input('road_name', 'Road name', {
            max: 255,
            locked: Boolean(row?.version),
        });
        input('lgu_id', 'Municipality', {
            choices: vault.state.snapshot.municipalities.map(
                ({ id, municipality_name }) => [String(id), municipality_name],
            ),
            locked: Boolean(row?.version),
        });
        input('pavement_type', 'Pavement', {
            choices: ['Concrete', 'Asphalt', 'Gravel', 'Earth'].map((value) => [
                value,
                value,
            ]),
        });
        input('state_category', 'Road condition', {
            choices: ['Good', 'Fair', 'Bad'].map((value) => [value, value]),
        });
        input(
            'kilometers',
            'Length in kilometers (optional, calculates from coordinates)',
            { type: 'number', required: false, step: '0.01' },
        );

        if (row?.version && !coordinates) {
            const message = document.createElement('p');
            message.textContent =
                'The saved alignment is retained. Open the online map to change this alignment.';
            target.append(message);
        } else {
            input(
                'coordinates',
                'Coordinates in longitude, latitude order, one point per line',
                {
                    type: 'textarea',
                    required: !row,
                    value: coordinates
                        ?.map((point: number[]) => point.join(', '))
                        .join('\n'),
                },
            );
            const note = document.createElement('p');
            note.textContent =
                'Enter at least two points from GPS or field notes. An internet map is optional.';
            target.append(note);
        }

        if (row?.version) {
            input('correction_reason', 'Alignment correction reason', {
                type: 'textarea',
                required: false,
                max: 5000,
            });
        }
    } else if (tab === 'project') {
        input('project_title', 'Project title', { max: 255 });
        input('road_coverage_id', 'Road coverage', { choices: list('road') });
        input('description', 'Project description', {
            type: 'textarea',
            required: false,
            max: 10000,
        });
    } else if (tab === 'record') {
        input('project_id', 'Project', {
            choices: list('project'),
            locked: Boolean(row?.version),
        });
        input('maintenance_year', 'Year', {
            type: 'number',
            min: 1900,
            max: 2100,
            locked: Boolean(row?.version),
        });
        input('quarter', 'Quarter', {
            choices: ['Q1', 'Q2', 'Q3', 'Q4'].map((value) => [value, value]),
            locked: Boolean(row?.version),
        });
        input('start_date', 'Start date', { type: 'date' });
        input('estimated_duration_days', 'Estimated duration in days', {
            type: 'number',
            min: 1,
        });
        input('status', 'Status', {
            choices: [
                ['Ongoing', 'Ongoing'],
                ['Completed', 'Completed'],
            ],
        });
        input('complete_date', 'Completion date', {
            type: 'date',
            required: false,
        });
        input('description', 'Field documentation', {
            type: 'textarea',
            required: false,
            max: 10000,
        });
    } else if (tab === 'monthly') {
        input('maintenance_id', 'Maintenance record', {
            choices: list('record'),
        });
        input('update_month', 'Reporting month', { type: 'month' });
        input('progress_percentage', 'Progress (%)', {
            type: 'number',
            max: 100,
            step: '0.01',
        });
        input('summary_of_text_reports', 'Report notes', {
            type: 'textarea',
            required: false,
            max: 20000,
        });
    } else {
        input('maintenance_id', 'Maintenance record', {
            choices: list('record'),
        });
        input('monthly_update_id', 'Monthly update (required for photos)', {
            choices: vault
                .rows('monthly')
                .map((report) => [
                    String(report.id),
                    String(report.update_month) +
                        ' · ' +
                        (vault
                            .rows('record')
                            .find(
                                (r) =>
                                    String(r.id) ===
                                    String(report.maintenance_id),
                            )?.maintenance_year ?? 'Record'),
                ]),
            required: false,
        });
        input('document_title', 'Document title (optional)', {
            required: false,
            max: 255,
        });
        input('attachment', 'Photo or document (up to 20 MB)', {
            type: 'file',
        });
        input('description', 'Description', {
            type: 'textarea',
            required: false,
            max: 5000,
        });
    }
}

export function validateFields(kind: Kind, fields: Fields, row?: Row) {
    if (kind === 'road') {
        const lines = fields.coordinates?.trim();
        delete fields.coordinates;

        if (lines) {
            const points = lines
                .split(/\r?\n/)
                .filter(Boolean)
                .map((line) =>
                    line
                        .split(',')
                        .map((part) =>
                            part.trim() === '' ? NaN : Number(part.trim()),
                        ),
                );
            const geojson = { type: 'LineString', coordinates: points };

            if (!lineCoordinates(geojson) || distanceKm(points) === 0) {
                throw new Error(
                    'Enter two or more distinct, valid longitude and latitude points.',
                );
            }

            const prior =
                typeof row?.geojson === 'string'
                    ? JSON.parse(row.geojson)
                    : row?.geojson;
            const changed =
                JSON.stringify(lineCoordinates(prior)) !==
                JSON.stringify(points);

            if (row?.version && changed && !fields.correction_reason?.trim()) {
                throw new Error(
                    'Enter a reason for changing the road alignment.',
                );
            }

            if (!row?.version || changed) {
                fields.geojson = JSON.stringify(geojson);
            }

            fields.kilometers ||= distanceKm(points).toFixed(2);
        }

        if (fields.kilometers === '') {
            throw new Error(
                'Enter a road length or coordinates to calculate it.',
            );
        }
    }

    if (kind === 'record') {
        const [year, month] = fields.start_date.split('-').map(Number);

        if (
            fields.maintenance_year !== String(year) ||
            fields.quarter !== 'Q' + Math.ceil(month / 3)
        ) {
            throw new Error(
                'The start date must match the selected maintenance year and quarter.',
            );
        }

        if (
            (fields.status === 'Completed') !== Boolean(fields.complete_date) ||
            (fields.complete_date && fields.complete_date < fields.start_date)
        ) {
            throw new Error(
                'Completed records need a completion date on or after the start date. Leave it blank for ongoing records.',
            );
        }
    }
}
