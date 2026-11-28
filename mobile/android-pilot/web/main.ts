import {
    availability,
    hasOfflineData,
    loadWorkspace,
    RequestError,
    Vault,
} from './queue';
import './style.css';

const el = <T extends HTMLElement>(id: string) =>
    document.getElementById(id) as T;
const message = el('message');
const connection = el('connection');
const unlock = el<HTMLFormElement>('unlock');
const form = el<HTMLFormElement>('report');
const signIn = el<HTMLButtonElement>('sign-in');
const sync = el<HTMLButtonElement>('sync');
const cache = el<HTMLButtonElement>('cache');
let vault: Vault | null = null;
let busy = false;

function render() {
    connection.textContent = navigator.onLine
        ? 'Network available'
        : 'Offline · saved data stays on this phone';
    signIn.disabled = busy;
    el('setup').hidden = vault !== null;
    el('workspace').hidden = vault === null;
    unlock.querySelector('button')!.disabled = busy;
    el('setup-title').textContent = hasOfflineData()
        ? 'Unlock offline access'
        : 'Prepare for fieldwork';
    el('unlock-button').textContent = hasOfflineData()
        ? 'Unlock'
        : 'Save offline workspace';

    if (!vault) {
        return;
    }

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

            if (reportId) {
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
                    if (
                        vault &&
                        confirm('Remove this report from this phone?')
                    ) {
                        void run(() => vault!.remove(index));
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
                ? 'Sign in to staging again. Reports are still saved on this phone.'
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
        !vault ||
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
        await vault!.sync(render);
        message.textContent = vault!.entries.some(
            ({ status }) => status === 'checking',
        )
            ? 'A server receipt is still pending. Check again after reconnecting.'
            : 'Sync check complete.';
    });
}

unlock.addEventListener('submit', (event) => {
    event.preventDefault();
    const passphrase = String(new FormData(unlock).get('passphrase') ?? '');
    unlock.reset();
    void run(async () => {
        if (hasOfflineData()) {
            vault = await Vault.open(passphrase);
        } else {
            if (!(await availability())) {
                throw new Error(
                    'The Android pilot is unavailable on this staging server.',
                );
            }

            vault = await Vault.create(await loadWorkspace(), passphrase);
        }
    }).then(syncReports);
});
signIn.addEventListener('click', () => {
    location.assign('./sign-in.html');
});
el('lock').addEventListener('click', () => {
    location.reload();
});
cache.addEventListener('click', () => {
    void run(async () => {
        await vault!.update(await loadWorkspace());
        message.textContent = 'Authorized records updated.';
    });
});
sync.addEventListener('click', () => void syncReports());
form.addEventListener('submit', (event) => {
    event.preventDefault();
    const values = new FormData(form);
    const record = vault?.snapshot.records.find(
        ({ id }) => id === values.get('record'),
    );

    if (!record || values.get('consent') !== 'on') {
        return;
    }

    void run(async () => {
        await vault!.save({
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
    void syncReports();
});
window.addEventListener('offline', () => {
    render();
});
render();
