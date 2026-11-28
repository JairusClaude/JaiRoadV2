import type { Vault } from './queue';
import { loadWorkspace, RequestError } from './queue';
import './style.css';

const el = <T extends HTMLElement>(id: string) =>
    document.getElementById(id) as T;
const message = el('message');
const form = el<HTMLFormElement>('report');
const sync = el<HTMLButtonElement>('sync');
const cache = el<HTMLButtonElement>('cache');
let vault: Vault;
let offline = false;
let busy = false;

function render() {
    el('offline-mode').hidden = !offline && navigator.onLine;
    el('online-dashboard').hidden = offline || !navigator.onLine;

    const { snapshot, entries } = vault;
    el('workspace-title').textContent = snapshot.role + ' workspace';
    el('scope').textContent = snapshot.truncated
        ? 'Showing the latest 100 cached records.'
        : 'Cached records: ' + snapshot.records.length;
    form.hidden = snapshot.role !== 'Engineer' || !snapshot.canSync;
    form.querySelector('button')!.disabled =
        busy || snapshot.records.length === 0;
    el<HTMLButtonElement>('lock').disabled = busy;
    cache.disabled = busy || !navigator.onLine;
    sync.hidden = snapshot.role !== 'Engineer';
    sync.disabled = busy || !navigator.onLine;
    const selector = form.querySelector('select')!;
    const prior = selector.value;
    selector.replaceChildren(
        ...snapshot.records.map(
            (record) =>
                new Option(
                    record.project + ' · ' + record.year + ' ' + record.quarter,
                    record.id,
                ),
        ),
    );

    if (snapshot.records.some(({ id }) => id === prior)) {
        selector.value = prior;
    }

    const cached = snapshot.records.map((record) => {
        const li = document.createElement('li');
        li.textContent =
            record.project +
            ' · ' +
            record.year +
            ' ' +
            record.quarter +
            ' · ' +
            record.municipality +
            ' · ' +
            record.status;

        return li;
    });
    el('record-list').replaceChildren(...cached);
    el('empty').hidden = entries.length !== 0;

    const states = {
        pending: 'Saved on device',
        checking: 'Checking server receipt',
        review: 'Needs review',
        synced: 'Synced',
    };
    el('entries').replaceChildren(
        ...entries.map(({ queue, status, reportId }, index) => {
            const item = document.createElement('li');
            const record = snapshot.records.find(
                ({ id }) => id === queue.report.maintenance_id,
            );
            const title = document.createElement('strong');
            title.textContent =
                (record?.project ?? 'Record ' + queue.report.maintenance_id) +
                ' · ' +
                queue.report.update_month;
            const state = document.createElement('p');
            state.textContent =
                states[status] + ' · ' + queue.report.progress_percentage + '%';
            item.append(title, state);

            if (queue.report.summary_of_text_reports) {
                const details = document.createElement('details');
                const summary = document.createElement('summary');
                summary.textContent = 'Report notes';
                const notes = document.createElement('p');
                notes.textContent = queue.report.summary_of_text_reports;
                details.append(summary, notes);
                item.append(details);
            }

            if (status === 'review') {
                const explanation = document.createElement('p');
                explanation.textContent =
                    'Check the reporting period or assignment in JaiROADS. The report remains on this device.';
                item.append(explanation);
            }

            if (reportId && !offline && navigator.onLine) {
                const link = document.createElement('a');
                link.href = '/workspace/ui/monthly-updates/' + reportId;
                link.textContent = 'Open saved report';
                item.append(link);
            }

            if (status !== 'checking') {
                const remove = document.createElement('button');
                remove.type = 'button';
                remove.className = 'secondary';
                remove.textContent = 'Remove local copy';
                remove.disabled = busy;
                remove.addEventListener('click', () => {
                    if (confirm('Remove this report from this phone?')) {
                        void run(() => vault.remove(index));
                    }
                });
                item.append(remove);
            }

            return item;
        }),
    );
}

async function run(task: () => Promise<void>) {
    if (busy) {
        return;
    }

    busy = true;
    message.textContent = '';
    render();

    try {
        await task();
    } catch (error) {
        message.textContent =
            error instanceof RequestError && [401, 419].includes(error.status)
                ? 'Lock the workspace and sign in online to sync your saved reports.'
                : error instanceof Error && !(error instanceof TypeError)
                  ? error.message
                  : 'The staging server is unreachable. Saved reports remain on this phone.';
    } finally {
        busy = false;
        render();
    }
}

async function syncReports() {
    if (
        busy ||
        !navigator.onLine ||
        !vault.entries.some(({ status }) =>
            ['pending', 'checking'].includes(status),
        )
    ) {
        return;
    }

    await run(async () => {
        message.textContent = 'Syncing reports…';
        await vault.sync(render);
        offline = false;
        message.textContent = vault.entries.some(
            ({ status }) => status === 'checking',
        )
            ? 'A server receipt is still pending. Check again after reconnecting.'
            : 'Sync check complete.';
    });
}

el('lock').addEventListener('click', () => {
    location.reload();
});
cache.addEventListener('click', () => {
    void run(async () => {
        await vault.update(await loadWorkspace());
        offline = false;
        message.textContent = 'Authorized records updated.';
    });
});
sync.addEventListener('click', () => void syncReports());
form.addEventListener('submit', (event) => {
    event.preventDefault();
    const values = new FormData(form);
    const record = vault.snapshot.records.find(
        ({ id }) => id === values.get('record'),
    );

    if (!record || values.get('consent') !== 'on') {
        return;
    }

    void run(async () => {
        await vault.save({
            project_id: record.projectId,
            maintenance_id: record.id,
            update_month: String(values.get('month')),
            progress_percentage: String(values.get('progress')),
            summary_of_text_reports: String(values.get('summary') ?? ''),
        });
        form.reset();
        message.textContent = 'Report saved on this phone.';
    }).then(syncReports);
});

window.addEventListener('online', () => {
    render();

    if (
        vault.entries.some(
            ({ status }) => status === 'pending' || status === 'checking',
        )
    ) {
        void syncReports();
    } else {
        void run(async () => {
            await vault.update(await loadWorkspace());
            offline = false;
        });
    }
});
window.addEventListener('offline', () => {
    offline = true;
    render();
});

export function openFieldReports(workspace: Vault, offlineSignIn: boolean) {
    vault = workspace;
    offline = offlineSignIn;
    history.replaceState(null, '', '#field-reports');
    el('sign-in-screen').hidden = true;
    document.body.classList.add('field-reports-open');
    const fieldReports = el('field-reports');
    fieldReports.hidden = false;
    render();
    fieldReports.focus({ preventScroll: true });

    if (!offlineSignIn) {
        void syncReports();
    }
}
