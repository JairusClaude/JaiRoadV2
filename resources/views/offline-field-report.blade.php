<!doctype html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; form-action 'none'; base-uri 'none'">
    <title>JaiROADS offline field report</title>
    <style>
        * { box-sizing: border-box; }
        body { margin: 0; background: #f5f5f4; color: #292524; font: 16px/1.5 system-ui, sans-serif; }
        main { max-width: 640px; margin: 24px auto; padding: 24px; background: white; border: 1px solid #d6d3d1; border-radius: 12px; }
        label { display: block; margin: 14px 0; }
        input, textarea { display: block; width: 100%; font: inherit; padding: 10px; border: 1px solid #78716c; border-radius: 6px; }
        button { padding: 12px 20px; background: #843b12; color: white; border: 0; border-radius: 6px; cursor: pointer; font: inherit; }
        button:disabled { opacity: .5; cursor: default; }
        p { overflow-wrap: anywhere; }
        h1 { line-height: 1.2; }
        @media (max-width: 640px) { main { margin: 10px; padding: 16px; } }
    </style>
</head>
<body>
<main>
    <h1>JaiROADS offline field report</h1>
    <p>Use IDs from an authorized maintenance record. Save an encrypted draft, then import it in the signed-in monthly update form to review and submit it.</p>
    <form id="report" autocomplete="off">
        <label>Project ID<input name="project_id" inputmode="numeric" pattern="[1-9][0-9]*" maxlength="18" required></label>
        <label>Maintenance record ID<input name="maintenance_id" inputmode="numeric" pattern="[1-9][0-9]*" maxlength="18" required></label>
        <label>Reporting month<input name="update_month" type="month" required></label>
        <label>Progress percentage<input name="progress_percentage" type="number" min="0" max="100" step="0.01" required></label>
        <label>Progress summary<textarea name="summary_of_text_reports" rows="6" aria-describedby="summary-limit"></textarea></label>
        <p id="summary-limit">Up to 20,000 characters.</p>
        <label>Draft passphrase (12–256 characters)<input id="passphrase" type="password" autocomplete="new-password" minlength="12" maxlength="256" required></label>
        <p>Use a separate passphrase and keep it apart from the draft. Photos and attachments stay on your device.</p>
        <button id="save" type="submit" disabled>Download encrypted draft</button>
        <label for="restore">Restore an encrypted draft and replace the current fields</label>
        <input id="restore" type="file" accept=".json,application/json" disabled>
        <p id="status" role="status"></p>
        <noscript>Enable JavaScript to use draft encryption.</noscript>
    </form>
</main>
<script type="module">
{{-- Inline the same reviewed codec used by the signed-in form so the downloaded editor has no network dependencies. --}}
{!! file_get_contents(resource_path('js/lib/encrypted-field-draft.mjs')) !!}

const form = document.getElementById('report');
const password = document.getElementById('passphrase');
const save = document.getElementById('save');
const restore = document.getElementById('restore');
const status = document.getElementById('status');
const fields = ['project_id', 'maintenance_id', 'update_month', 'progress_percentage', 'summary_of_text_reports'];
const canEncrypt = Boolean(globalThis.crypto?.subtle);

function setBusy(busy) {
    save.disabled = restore.disabled = busy || !canEncrypt;
}

setBusy(false);
if (!canEncrypt) {
    status.textContent = 'This browser does not support encryption here. Open the saved editor in a browser with Web Crypto support.';
}

async function withPassphrase(action) {
    const passphrase = password.value;
    password.value = '';
    setBusy(true);

    try {
        await action(passphrase);
    } catch (error) {
        status.textContent = error instanceof Error ? error.message : 'The draft could not be processed.';
    } finally {
        setBusy(false);
    }
}

form.addEventListener('submit', async (event) => {
    event.preventDefault();

    if (!form.reportValidity() || save.disabled) {
        return;
    }

    const values = new FormData(form);
    const draft = { version: 1 };

    for (const field of fields) {
        draft[field] = String(values.get(field) ?? '');
    }

    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(draft.update_month) || draft.update_month.startsWith('0000')) {
        status.textContent = 'Enter a valid reporting month.';
        return;
    }

    await withPassphrase(async (passphrase) => {
        validateDraftSummary(draft.summary_of_text_reports);
        const data = await encryptDraft(draft, passphrase);
        const url = URL.createObjectURL(new Blob([JSON.stringify(data)], { type: 'application/json' }));
        const link = document.createElement('a');
        link.href = url;
        link.download = 'jairoads-encrypted-draft.json';
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        status.textContent = 'Encrypted draft downloaded.';
    });
});

restore.addEventListener('change', async () => {
    const file = restore.files?.[0];
    restore.value = '';

    if (!file || restore.disabled) {
        return;
    }

    await withPassphrase(async (passphrase) => {
        if (file.size > maxDraftFileBytes) {
            throw new Error('Draft exceeds the 192 KiB size limit.');
        }

        const draft = await decryptDraft(JSON.parse(await file.text()), passphrase);

        if (draft?.version !== 1 || fields.some((field) => typeof draft[field] !== 'string')) {
            throw new Error('Invalid report draft.');
        }

        validateDraftSummary(draft.summary_of_text_reports);

        for (const field of fields) {
            form.elements.namedItem(field).value = draft[field];
        }

        status.textContent = 'Draft restored. Review each field before saving.';
    });
});
</script>
</body>
</html>
