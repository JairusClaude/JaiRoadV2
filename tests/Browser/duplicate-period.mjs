import assert from 'node:assert/strict';

// Called from the real Fortify/browser suite against its disposable PostgreSQL.
export async function verifyDuplicatePeriod({
    engineer,
    admin,
    ui,
    project,
    period,
    record,
    choose,
    csrfPost,
    props,
}) {
    const create = `${ui}/maintenance-projects/${project.id}/records/create`;
    const endpoint = `/dd-phase3/ui/maintenance-projects/${project.id}/records`;
    const description = 'Preserve this unsaved description';
    const fill = async (quarter, date) => {
        await engineer.getByLabel(/^Maintenance Year/).fill('2026');
        await choose(engineer, /^Quarter/, quarter);
        await choose(engineer, /^Managing Engineer/, 'Test Engineer');
        await engineer.getByLabel(/^Start Date/).fill(date);
        await engineer.getByLabel(/^Estimated Duration/).fill('17');
        await engineer.getByLabel(/^Description/).fill(description);
    };
    const preserved = async () => {
        assert.equal(
            await engineer.getByLabel(/^Maintenance Year/).inputValue(),
            '2026',
        );
        assert.equal(
            await engineer.getByLabel(/^Estimated Duration/).inputValue(),
            '17',
        );
        assert.equal(
            await engineer.getByLabel(/^Description/).inputValue(),
            description,
        );
        assert.match(
            await engineer.getByLabel(/^Managing Engineer/).innerText(),
            /Test Engineer/,
        );
    };
    const assertWarning = async (quarter) => {
        const panel = engineer.getByRole('dialog', {
            name: 'Maintenance period already occupied',
        });
        await panel.waitFor();
        assert.match(
            await panel.innerText(),
            new RegExp(`${project.project_title}.*`, 's'),
        );
        assert.match(await panel.innerText(), /2026/);
        assert.match(await panel.innerText(), new RegExp(quarter));
        assert.match(await panel.innerText(), /Only one MaintenanceRecord/);

        return panel;
    };

    await engineer.goto(create);
    await fill('Q2 (unavailable)', '2026-04-01');
    let submissions = 0;
    const countRequest = (request) => {
        if (
            request.method() === 'POST' &&
            new URL(request.url()).pathname === endpoint
        ) {
            submissions++;
        }
    };
    engineer.on('request', countRequest);
    await engineer
        .getByRole('button', { name: 'Save Record', exact: true })
        .click();
    let panel = await assertWarning('Q2');
    assert.equal(submissions, 0, 'A known occupied period must not be posted');
    assert.equal(
        await panel
            .getByRole('link', { name: 'View Existing Record' })
            .getAttribute('href'),
        `${endpoint}/${record.id}`,
    );
    await panel
        .getByRole('button', { name: 'Close', exact: true })
        .last()
        .click();
    await preserved();
    assert.match(await engineer.getByLabel(/^Quarter/).innerText(), /Q2/);

    // Every unoccupied quarter stays selectable; no paired-quarter restriction.
    await engineer.getByLabel(/^Maintenance Year/).fill('2027');
    await engineer.getByLabel(/^Quarter/).click();
    assert.deepEqual(await engineer.getByRole('option').allTextContents(), [
        'Q1',
        'Q2',
        'Q3',
        'Q4',
    ]);
    await engineer.keyboard.press('Escape');

    // Load Q1 as available, then let a second authorized session occupy it.
    await engineer.goto(`${ui}/maintenance-records/create`);
    await engineer.getByLabel(/^Maintenance Project/).click();
    await engineer
        .getByRole('option')
        .filter({ hasText: project.project_title })
        .click();
    await fill('Q1', '2026-01-01');
    const winner = await csrfPost(admin, endpoint, {
        ...period,
        quarter: 'Q1',
        start_date: '2026-01-01',
    });
    assert.equal(winner.status, 200, winner.body);
    await engineer
        .getByRole('button', { name: 'Save Record', exact: true })
        .click();
    panel = await assertWarning('Q1');
    assert.equal(
        submissions,
        1,
        'Stale form must reach the authoritative server check',
    );
    const link = await panel
        .getByRole('link', { name: 'View Existing Record' })
        .getAttribute('href');
    assert.match(link, new RegExp(`${endpoint}/\\d+$`));
    await panel
        .getByRole('button', { name: 'Choose Another Quarter', exact: true })
        .click();
    await panel.waitFor({ state: 'hidden' });
    await engineer.waitForFunction(
        () => document.activeElement?.id === 'quarter',
    );
    await preserved();
    assert.match(
        await engineer.getByLabel(/^Maintenance Project/).innerText(),
        /Unified browser project/,
    );
    assert.match(await engineer.getByLabel(/^Status/).innerText(), /Ongoing/);
    assert.equal(
        await engineer.getByLabel(/^Start Date/).inputValue(),
        '2026-01-01',
    );
    assert.match(
        await engineer.getByLabel(/^Quarter/).innerText(),
        /Select quarter/,
    );
    assert.equal(
        await engineer
            .getByLabel(/^Quarter/)
            .evaluate((el) => el === document.activeElement),
        true,
    );
    await choose(engineer, /^Quarter/, 'Q3');
    await engineer.getByLabel(/^Start Date/).fill('2026-07-01');
    await engineer
        .getByRole('button', { name: 'Save Record', exact: true })
        .click();
    await engineer.waitForURL(`${ui}/maintenance-projects/${project.id}`);
    const history = await props(
        engineer,
        `/maintenance-projects/${project.id}`,
    );
    assert.deepEqual(history.records.map((item) => item.quarter).sort(), [
        'Q1',
        'Q2',
        'Q3',
    ]);
    engineer.off('request', countRequest);
    console.log(
        'PASS: occupied-quarter labels; client and stale-server duplicate panels; authorized detail links; Close and Choose Another Quarter preserve inputs; all four unoccupied quarters remain available.',
    );
}
