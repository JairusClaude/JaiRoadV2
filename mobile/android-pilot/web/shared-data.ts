import type { Page } from '@inertiajs/core';
import type { Fields, Kind, Row, Vault, FileReference } from './queue';
import { attachmentMime } from './queue';

const BASE = '/workspace/ui';
const localBase = 8_000_000_000_000_000;
const integration = { ready: true, message: null };
const text = (value: unknown) => value === null || value === undefined ? '' : String(value);
const same = (a: unknown, b: unknown) => String(a) === String(b);
const number = (value: unknown) => Number(value) || 0;
const date = (value: unknown) => typeof value === 'string' ? value : null;
const geo = (value: unknown) => {
    if (typeof value !== 'string') return value ?? null;
    try { return JSON.parse(value); } catch { return null; }
};

/** Numeric presentation IDs for unsynced UUID entities. Never send these to Laravel. */
export function presentationId(value: unknown): number {
    const raw = text(value);
    if (/^\d+$/.test(raw)) return Number(raw);
    if (!/^[0-9a-f-]{36}$/i.test(raw)) throw new Error('Invalid local entity.');
    return localBase + parseInt(raw.replace(/-/g, '').slice(0, 12), 16);
}
export const isLocalId = (value: unknown) => Number(value) >= localBase;
export function rawId(vault: Vault, id: unknown): string {
    if (!isLocalId(id)) return text(id);
    const keys = new Set([...vault.state.pending.map((r) => r.entity), ...Object.keys(vault.state.confirmed), ...vault.state.attachments.map((a) => a.id)]);
    const matches = [...keys].filter((key) => presentationId(key) === Number(id));
    if (matches.length !== 1) throw new Error('This local item is unavailable or ambiguous.');
    const key = matches[0];
    return vault.state.confirmed[key] ? String(vault.state.confirmed[key].id) : key;
}
export function relatedId(vault: Vault, id: unknown) {
    const raw = text(id);
    if (!raw) return 0;
    return presentationId(vault.state.confirmed[raw]?.id ?? raw);
}
export function cachedRow(vault: Vault, kind: Kind, id: unknown) {
    const raw = rawId(vault, id);
    return vault.rows(kind).find((row) => same(row.id, raw));
}

export function projectData(vault: Vault, dashboard: Page) {
    const snapshot = vault.state.snapshot;
    const dashboardProps = dashboard.props as Record<string, any>;
    const authUser = dashboardProps.auth?.user ?? {};
    const identity = dashboardProps.engineer;
    const canWrite = snapshot.canWrite && Boolean(snapshot.engineerId ?? identity?.id);
    const engineer = snapshot.engineerId ?? identity?.id ?? null;
    const municipality = (id: unknown) => snapshot.municipalities.find((entry) => same(entry.id, id));
    const rawProjects = vault.rows('project');
    const rawRecords = vault.rows('record');
    const rawRoads = vault.rows('road');
    const projectForRoad = (id: unknown) => rawProjects.find((r) => same(relatedId(vault, r.road_coverage_id), relatedId(vault, id)));
    const rows = rawRoads.map((r) => {
        const project = projectForRoad(r.id);
        const lgu = municipality(r.lgu_id);
        return {
            id: presentationId(r.id), road_name: text(r.road_name), lgus_id: number(r.lgu_id),
            lgu: { id: number(r.lgu_id), municipality_name: lgu?.municipality_name ?? 'Unavailable' },
            kilometers: r.kilometers ?? null, pavement_type: r.pavement_type, state_category: r.state_category,
            geojson: geo(r.geojson), created_by: number(r.created_by ?? engineer), created_at: date(r.created_at), updated_at: date(r.updated_at),
            has_projects: Boolean(project || r.linked_project_id), project_title: project ? text(project.project_title) : null,
            linked_project_id: project ? presentationId(project.id) : number(r.linked_project_id),
        };
    });
    const projects = rawProjects.map((r) => {
        const roadId = relatedId(vault, r.road_coverage_id);
        const road = rows.find((entry) => entry.id === roadId);
        return {
            id: presentationId(r.id), project_title: text(r.project_title), description: text(r.description) || null,
            road_coverage_id: roadId, road_name: road?.road_name ?? null, municipality: road?.lgu.municipality_name ?? null,
            created_by: text(r.creator_name) || text(authUser.name) || null, created_at: date(r.created_at), updated_at: date(r.updated_at),
            maintenance_records_count: rawRecords.filter((entry) => relatedId(vault, entry.project_id) === presentationId(r.id)).length,
            can_edit: canWrite, can_delete: false, geojson: road?.geojson ?? null,
        };
    });
    const projectChoice = (id: unknown) => projects.find((entry) => entry.id === relatedId(vault, id));
    const engineerOption = engineer ? { id: engineer, first_name: text(identity?.name ?? authUser.name), last_name: '' } : null;
    const records = rawRecords.flatMap((r) => {
        const project = projectChoice(r.project_id);
        if (!project) return [];
        const id = presentationId(r.id);
        const managing = r.managing_engineer_id === null ? null : number(r.managing_engineer_id ?? engineer) || null;
        const details_url = BASE + '/maintenance-projects/' + project.id + '/records/' + id;
        return [{
            id, project_id: project.id, year: number(r.maintenance_year), quarter: text(r.quarter), status: text(r.status),
            engineers_id: managing, managing_engineer: managing ? { id: managing, first_name: text(r.first_name ?? identity?.name), last_name: text(r.last_name) } : null,
            start_date: text(r.start_date), estimated_duration_days: number(r.estimated_duration_days), complete_date: text(r.complete_date) || null,
            description: text(r.description) || null, created_by: text(r.creator_name) || text(authUser.name) || null,
            created_at: date(r.created_at), updated_at: date(r.updated_at), details_url,
            edit_url: canWrite && managing === engineer ? details_url + '/edit' : null, delete_url: null, can_delete: false,
            project: { id: project.id, project_title: project.project_title, municipality: project.municipality },
        }];
    });
    const recordFor = (id: unknown) => records.find((r) => r.id === relatedId(vault, id));
    const sources = snapshot.files ?? [];
    const attachments = vault.state.attachments;
    const localFile = (file: FileReference) => vault.fileData(file);
    const fileRows = sources.flatMap((file) => {
        const record = recordFor(file.record);
        if (!record || file.kind !== 'document') return [];
        return [{
            id: file.id, maintenance_id: record.id, document_title: file.title || file.name, description: file.description ?? null,
            file_name: file.name, download_url: '/workspace/files/document/' + file.id,
            delete_url: null, can_edit: false, uploaded_by: file.uploader || '', uploaded_at: file.uploadedAt || file.version,
            updated_at: file.version, project: record.project, record: { id: record.id, project_id: record.project_id, year: record.year, quarter: record.quarter },
            available: Boolean(localFile(file)),
        }];
    });
    for (const item of attachments) {
        if (item.kind === 'media') continue;
        const record = recordFor(item.record);
        if (!record) continue;
        const id = item.receipt?.id ?? presentationId(item.id);
        const existing = fileRows.find((file) => file.id === id);
        if (existing) { existing.available = true; continue; }
        fileRows.push({
            id, maintenance_id: record.id, document_title: item.title || item.name, description: item.description,
            file_name: item.name, download_url: '/workspace/files/document/' + id,
            delete_url: null, can_edit: false, uploaded_by: text(authUser.name), uploaded_at: '', updated_at: '',
            project: record.project, record: { id: record.id, project_id: record.project_id, year: record.year, quarter: record.quarter }, available: true,
        });
    }
    function mediaFor(id: number) {
        const files = sources.filter((file) => file.kind === 'media' && same(file.parent, id)).map((file) => ({
            id: file.id, file_name: file.name, mime_type: file.mime || attachmentMime(file.name), size: null,
            preview_url: localFile(file) ?? null, available: Boolean(localFile(file)), delete_url: null,
        }));
        for (const item of attachments.filter((file) => file.kind === 'media' && relatedId(vault, file.parent) === id)) {
            const fileId = item.receipt?.id ?? presentationId(item.id);
            const existing = files.find((file) => file.id === fileId);
            if (existing) { existing.preview_url = item.data; existing.available = true; continue; }
            files.push({ id: fileId, file_name: item.name, mime_type: attachmentMime(item.name), size: null, preview_url: item.data, available: true, delete_url: null });
        }
        return files;
    }
    const updates = vault.rows('monthly').flatMap((r) => {
        const record = recordFor(r.maintenance_id);
        if (!record) return [];
        const id = presentationId(r.id);
        const files = mediaFor(id);
        return [{
            id, maintenance_id: record.id, update_month: text(r.update_month).slice(0, 7),
            progress_percentage: number(r.progress_percentage), summary_of_text_reports: text(r.summary_of_text_reports) || null,
            created_by: text(r.creator_name) || '', created_at: date(r.created_at), updated_at: date(r.updated_at),
            project: record.project, record: { id: record.id, year: record.year, quarter: record.quarter },
            media_count: files.length, photo_count: files.length, video_count: 0, other_count: 0, can_edit: false,
        }];
    });
    const mapRows = rows.map((r) => ({ id: r.id, road_name: r.road_name, municipality: r.lgu.municipality_name,
        assigned: r.has_projects, state_category: r.state_category, geojson: r.geojson }));
    const coverages = (project?: number) => rows.map((r) => ({
        id: r.id, road_name: r.road_name, municipality: r.lgu.municipality_name, kilometers: text(r.kilometers),
        assigned: r.has_projects && r.linked_project_id !== project, assigned_project_title: r.project_title, geojson: r.geojson,
    }));
    const parents = (fixedId?: number) => {
        const ownRecords = records.filter((r) => Boolean(r.edit_url) && (!fixedId || r.id === fixedId));
        return { projects: projects.filter((p) => ownRecords.some((r) => r.project_id === p.id)),
            records: ownRecords, contextRecordId: fixedId || null, canWrite };
    };
    return { canWrite, engineer, engineerOption, roads: rows, projects, records, updates, documents: fileRows, mediaFor, mapRows, coverages, parents };
}

const paginate = <T>(items: T[], url: URL) => {
    const last_page = Math.max(1, Math.ceil(items.length / 12));
    const current_page = Math.min(last_page, Math.max(1, Number(url.searchParams.get('page')) || 1));
    const start = (current_page - 1) * 12;
    const data = items.slice(start, start + 12);
    return { data, total: items.length, from: data.length ? start + 1 : null, to: data.length ? start + data.length : null, current_page, last_page, links: [] };
};
const defaultFilter = (url: URL, names: string[], extra: Record<string, string> = {}) =>
    Object.fromEntries([...names.map((name) => [name, url.searchParams.get(name) || (name === 'search' ? '' : name === 'sort' ? 'newest' : 'all')]), ...Object.entries(extra)]);
const match = (filter: unknown, value: unknown) => !filter || filter === 'all' || String(filter).toLowerCase() === String(value).toLowerCase();
const queryMatch = (filter: string, ...values: unknown[]) => values.map(text).join(' ').toLowerCase().includes(filter.toLowerCase());
const sorted = <T extends { id: number }>(rows: T[], order: unknown) => rows.slice().sort((a, b) => order === 'oldest' ? a.id - b.id : b.id - a.id);
const pathFor = (url: URL) => url.pathname.replace(/^\/workspace\/ui/, '').replace(/\/$/, '');
export function offlinePage(vault: Vault, dashboard: Page, url: URL, status = ''): Page | null {
    const d = projectData(vault, dashboard);
    const snapshot = vault.state.snapshot;
    const baseProps = { auth: dashboard.props.auth, name: dashboard.props.name, sidebarOpen: dashboard.props.sidebarOpen,
        canonicalFrontend: true, jairoadsIdentity: { role: snapshot.role.toLowerCase() }, canWrite: d.canWrite,
        errors: {}, status, offlineSnapshot: true };
    const page = (component: string, props: Record<string, unknown>) => ({
        component, props: { ...baseProps, ...props }, url: url.pathname + url.search, version: dashboard.version,
        clearHistory: false, encryptHistory: true,
    } as Page);
    const path = pathFor(url);
    const bits = path.split('/').filter(Boolean);
    const [section, first, nested, fourth, fifth] = bits;
    const entity = (id: string | undefined) => id ? Number(id) : 0;
    const lookup = <T extends {id:number}>(rows: T[], id: string | undefined) => rows.find((r) => r.id === entity(id) || same(rawId(vault, id), r.id));
    if (path === '/dashboard' || path === '/workspace/dashboard') {
        return page('RoleDashboard/Canonical', { ...dashboard.props, ...baseProps, status: '' });
    }
    if (section === 'maintenance-projects') {
        if (!first) {
            const filters = defaultFilter(url, ['search','municipality','sort']);
            const rows = d.projects.filter((r) => queryMatch(filters.search, r.project_title) &&
                match(filters.municipality, d.roads.find((road) => road.id === r.road_coverage_id)?.lgus_id));
            return page('MaintenanceProjects/Index', { projects: paginate(sorted(rows, filters.sort), url), municipalities: snapshot.municipalities,
                filters, integration, canCreate: d.canWrite, canBulkDelete: false });
        }
        const project = first === 'create' ? undefined : lookup(d.projects, first);
        if (first === 'create' || (nested === 'edit' && project)) {
            if (!d.canWrite) return null;
            const coverages = d.coverages(project?.id);
            return page('MaintenanceProjects/' + (project ? 'Edit' : 'Create'), { project, coverages,
                selectedCoverage: coverages.find((r) => r.id === project?.road_coverage_id) ?? null, integration });
        }
        if (!project) return null;
        const records = d.records.filter((r) => r.project_id === project.id);
        if (nested === 'records') {
            const record = fourth === 'create' ? undefined : lookup(records, fourth);
            if (fourth === 'create' || fifth === 'edit') {
                if (!d.canWrite || (fifth === 'edit' && !record?.edit_url)) return null;
                return page('MaintenanceProjects/Records/' + (record ? 'Edit' : 'Create'), { project, record, records, engineers: d.engineerOption ? [d.engineerOption] : [],
                    submitUrl: BASE + '/maintenance-projects/' + project.id + '/records' + (record ? '/' + record.id : ''),
                    cancelUrl: BASE + '/maintenance-projects/' + project.id + (record ? '/records/' + record.id : ''), canWrite: d.canWrite });
            }
            if (!record) return null;
            const documents = d.documents.filter((r) => r.maintenance_id === record.id);
            const updates = d.updates.filter((r) => r.maintenance_id === record.id);
            const checkpoints = [25,50,75,100].map((n) => updates.filter((r) => r.progress_percentage >= n).map((r) => r.update_month).sort()[0] ?? null);
            return page('MaintenanceProjects/Records/Show', { project, record, documents, updates,
                checkpointMonths: checkpoints, canWrite: Boolean(record.edit_url), canReassign: false, canUnassign: false, managerChoices: [],
                monthlyUpdateCreateUrl: record.edit_url ? BASE + '/monthly-updates/create?maintenance_id=' + record.id : null,
                milestones: null, milestonesWritable: false });
        }
        return page('MaintenanceProjects/Show', { project, records, recordCreateUrl: d.canWrite ? BASE + '/maintenance-projects/' + project.id + '/records/create' : null });
    }
    if (section === 'maintenance-records') {
        if (first === 'create') {
            if (!d.canWrite) return null;
            return page('MaintenanceProjects/Records/Create', { projects: d.projects, records: d.records, engineers: d.engineerOption ? [d.engineerOption] : [],
                canWrite: d.canWrite, cancelUrl: BASE + '/maintenance-records' });
        }
        if (first) return null;
        const filters = defaultFilter(url, ['search','municipality','year','quarter','status','sort']);
        const rows = d.records.filter((r) => queryMatch(filters.search, r.project.project_title, r.project.municipality, r.id) &&
            match(filters.municipality, d.roads.find((road) => road.id === d.projects.find((p) => p.id === r.project_id)?.road_coverage_id)?.lgus_id) &&
            match(filters.year,r.year) && match(filters.quarter,r.quarter) && match(filters.status,r.status));
        return page('MaintenanceRecords/Index', { records: paginate(sorted(rows,filters.sort),url), projects: d.projects,
            municipalities: snapshot.municipalities.map((m) => ({value:String(m.id),label:m.municipality_name})),
            years:[...new Set(d.records.map((r)=>r.year))].sort((a,b)=>b-a), filters, integration, canCreate:d.canWrite, canDelete:false, canBulkDelete:false,
            totalProjects:d.projects.length,totalRecords:d.records.length,completedRoads:d.records.filter(r=>r.status==='Completed').length,ongoingRoads:d.records.filter(r=>r.status==='Ongoing').length });
    }
    if (section === 'road-coverages') {
        if (!first) {
            const filters = defaultFilter(url,['search','municipality','condition','pavement','sort']);
            const rows = d.roads.filter(r=>queryMatch(filters.search,r.road_name)&&match(filters.municipality,r.lgus_id)&&match(filters.condition,r.state_category)&&match(filters.pavement,r.pavement_type));
            return page('RoadCoverages/Index',{coverages:paginate(sorted(rows,filters.sort),url),municipalities:snapshot.municipalities,filters,
                canEdit:d.canWrite,canDelete:false,totalCoverages:d.roads.length,linkedProjects:d.roads.filter(r=>r.has_projects).length,
                totalLengthKm:d.roads.reduce((sum,r)=>sum+number(r.kilometers),0),mapCoverages:d.mapRows,mapDeferred:false,mapNextCursor:null});
        }
        const coverage=first==='create'?undefined:lookup(d.roads,first);
        if(first==='create'||nested==='edit') {
            if(!d.canWrite||(nested==='edit'&&!coverage)) return null;
            return page('RoadCoverages/'+(coverage?'Edit':'Create'),{coverage,municipalities:snapshot.municipalities,referenceCoverages:d.roads,
                canEdit:d.canWrite,cancelUrl:BASE+'/road-coverages'+(coverage?'/'+coverage.id:'')});
        }
        if(!coverage)return null;
        return page('RoadCoverages/Show',{coverage,associatedProject:d.projects.find(p=>p.id===coverage.linked_project_id)??null,createdByName:null,canEdit:d.canWrite,
            canChangeMunicipality:false,canDelete:false,backUrl:BASE+'/road-coverages',municipalities:snapshot.municipalities});
    }
    if(section==='monthly-updates') {
        if(!first) {
            const filters=defaultFilter(url,['search','project','year','sort']);
            const rows=d.updates.filter(r=>queryMatch(filters.search,r.project.project_title,r.update_month,r.summary_of_text_reports)&&match(filters.project,r.project.id)&&match(filters.year,r.update_month.slice(0,4)));
            return page('MonthlyUpdates/Index',{updates:paginate(sorted(rows,filters.sort),url),projects:d.projects,years:[...new Set(d.updates.map(r=>Number(r.update_month.slice(0,4))))],filters,totalReports:d.updates.length});
        }
        if(first==='create') {
            if(!d.canWrite)return null;
            const fixed=Number(url.searchParams.get('maintenance_id')||url.searchParams.get('record')||0);
            return page('MonthlyUpdates/Create',{...d.parents(fixed||undefined),existingUpdates:d.updates,submitUrl:BASE+'/monthly-updates',cancelUrl:BASE+'/monthly-updates'});
        }
        const update=lookup(d.updates,first);
        if(!update||nested)return null;
        return page('MonthlyUpdates/Show',{update,media:d.mediaFor(update.id),backUrl:BASE+'/monthly-updates',backLabel:'Monthly Updates',directoryUrl:BASE+'/monthly-updates',canUploadMedia:d.canWrite});
    }
    if(section==='maintenance-documents') {
        if(!first) {
            const filters=defaultFilter(url,['search','project','sort']);
            const rows=d.documents.filter(r=>queryMatch(filters.search,r.document_title,r.file_name)&&match(filters.project,r.project.id));
            return page('MaintenanceDocuments/Index',{documents:paginate(sorted(rows,filters.sort),url),projects:d.projects,filters});
        }
        if(first==='create') {
            if(!d.canWrite)return null;
            const fixed=Number(url.searchParams.get('maintenance_id')||url.searchParams.get('record')||0);
            return page('MaintenanceDocuments/Form',{...d.parents(fixed||undefined),submitUrl:BASE+'/maintenance-documents',cancelUrl:BASE+'/maintenance-documents'});
        }
        const document=lookup(d.documents,first);
        if(!document||nested)return null;
        return page('MaintenanceDocuments/Show',{document,canWrite:d.canWrite});
    }
    return null;
}

export function offlineResource(vault: Vault, dashboard: Page, url: URL): unknown | undefined {
    const d=projectData(vault,dashboard);
    const path=url.pathname;
    const choicesPage = <T>(rows:T[], size:number, key='page') => {
        const last_page=Math.max(1,Math.ceil(rows.length/size));
        const page=Math.max(1,Math.min(last_page,Math.floor(Number(url.searchParams.get(key))||1)));
        return {data:rows.slice((page-1)*size,page*size),page,last_page};
    };
    if(path==='/workspace/dashboard/map-roads'||path===BASE+'/map/road-index') {
        const before=Number(url.searchParams.get('before')||0);
        const rows=d.mapRows.filter(r=>r.geojson&&(!before||r.id<before)&&queryMatch(url.searchParams.get('search')||'',r.road_name)&&
            match(url.searchParams.get('municipality'),d.roads.find(road=>road.id===r.id)?.lgus_id)&&match(url.searchParams.get('condition'),r.state_category)&&
            match(url.searchParams.get('pavement'),d.roads.find(road=>road.id===r.id)?.pavement_type)).sort((a,b)=>b.id-a.id);
        const data=rows.slice(0,100);
        return {data,next_cursor:rows.length>100?data[data.length-1].id:null};
    }
    if(path===BASE+'/map/roads') {
        const after=Number(url.searchParams.get('after')||0);
        const rows=d.roads.filter(r=>r.geojson&&r.id>after&&match(url.searchParams.get('lgu_id'),r.lgus_id)&&queryMatch(url.searchParams.get('q')||'',r.road_name)).sort((a,b)=>a.id-b.id);
        const data=rows.slice(0,100);
        return {data,next_cursor:rows.length>100?data[data.length-1].id:null};
    }
    if(path===BASE+'/project-road-choices') {
        const rows=d.coverages(Number(url.searchParams.get('project')||0)||undefined).filter(r=>queryMatch(url.searchParams.get('search')||'',r.road_name,r.municipality));
        const available=rows.filter(r=>!r.assigned).length;
        const visible=rows.filter(r=>url.searchParams.get('show_assigned')==='1'||!r.assigned).map(r=>({...r,geojson:null})).sort((a,b)=>a.road_name.localeCompare(b.road_name));
        return {...choicesPage(visible,30),available,assigned:rows.length-available};
    }
    if(path===BASE+'/project-filter-choices') return choicesPage(d.projects.filter(r=>queryMatch(url.searchParams.get('search')||'',r.project_title,r.municipality)).sort((a,b)=>a.project_title.localeCompare(b.project_title)),30);
    if(path===BASE+'/record-period-choices') return {data:d.records.filter(r=>same(r.project_id,url.searchParams.get('project'))&&same(r.year,url.searchParams.get('year')))};
    if(path===BASE+'/monthly-updates/form-choices') {
        const own=d.parents();
        const projectId=Number(url.searchParams.get('project')||0);
        if(!projectId)return choicesPage(own.projects.filter(r=>queryMatch(url.searchParams.get('search')||'',r.project_title,r.municipality)),20);
        const project=own.projects.find(r=>r.id===projectId);
        if(!project)return undefined;
        const records=own.records.filter(r=>r.project_id===projectId).sort((a,b)=>b.year-a.year||b.quarter.localeCompare(a.quarter));
        const page=choicesPage(records,25,'record_page');
        const selectedRecordId=Number(url.searchParams.get('record')||0)||null;
        const selected=records.find(r=>r.id===selectedRecordId);
        if(selectedRecordId&&!selected)return undefined;
        const choices=page.data.slice();
        if(selected&&!choices.some(r=>r.id===selected.id))choices.push(selected);
        const years:Record<string,number>={};
        for(const update of d.updates.filter(r=>r.maintenance_id===selectedRecordId)){
            const [year,month]=update.update_month.split('-');const num=Number(month);
            if(num>=1&&num<=12)years[year]=(years[year]??0)|(1<<(num-1));
        }
        return {project,records:choices,recordPage:page.page,recordHasMore:page.page<page.last_page,selectedRecordId,existingUpdates:[],
            occupiedMonths:selectedRecordId?{recordId:selectedRecordId,years}:null};
    }
    const geom=path.match(/\/project-road-choices\/(\d+)\/geometry$/);
    if(geom) return {geojson:d.roads.find(r=>r.id===Number(geom[1]))?.geojson??null};
    if(path===BASE+'/record-search') {
        const q=url.searchParams.get('q')??'';
        const options=[
            ...d.projects.map(r=>({kind:'Project',label:r.project_title,href:BASE+'/maintenance-projects/'+r.id})),
            ...d.roads.map(r=>({kind:'Road',label:r.road_name,href:BASE+'/road-coverages/'+r.id})),
            ...d.records.map(r=>({kind:'Maintenance record',label:r.project.project_title+' — '+r.quarter+' '+r.year,href:r.details_url})),
            ...d.documents.map(r=>({kind:'Document',label:r.document_title,href:BASE+'/maintenance-documents/'+r.id})),
            ...d.updates.map(r=>({kind:'Monthly update',label:r.project.project_title+' — '+r.update_month,href:BASE+'/monthly-updates/'+r.id})),
        ];
        return {results:options.filter(r=>q.length>=2&&queryMatch(q,r.label)).slice(0,20)};
    }
    return undefined;
}

export function findFile(vault: Vault, kind: 'document'|'media', id: number) {
    const local=vault.state.attachments.find(r=>(r.kind??'document')===kind&&(r.receipt?.id===id||presentationId(r.id)===id));
    if(local)return {name:local.name,data:local.data};
    const ref=vault.state.snapshot.files?.find(r=>r.kind===kind&&r.id===id);
    return ref ? {name:ref.name,data:vault.fileData(ref),ref} : undefined;
}
export function fieldsFrom(data: Record<string, unknown>, names: string[]): Fields {
    return Object.fromEntries(names.filter(key=>data[key]!==undefined).map(key=>[key,text(data[key])]));
}
