<?php

declare(strict_types=1);

namespace Tests\Quarterly;

use Illuminate\Support\Facades\DB;
use Inertia\Testing\AssertableInertia as Assert;

final class WorkspaceRouteCompatibilityTest extends PostgresTestCase
{
    public function test_page_aliases_preserve_query_parameters_and_flash(): void
    {
        $fixture = $this->fixture();
        $old = '/dd-phase3/ui/road-coverages/'.$fixture['road'];
        $current = '/workspace/ui/road-coverages/'.$fixture['road'];
        $query = '?view=map&filter=North%20Part&selected%5B%5D=1&selected%5B%5D=2';

        $this->call('HEAD', $old.$query)->assertRedirect($current.$query);
        $this->withSession(['dd_operations_status' => 'Road saved.'])
            ->get($old.$query)->assertRedirect($current.$query);
        $this->get($current.$query)->assertInertia(fn (Assert $page) => $page
            ->component('RoadCoverages/Show')
            ->where('status', 'Road saved.'));

        $this->get('/dd-phase3/ui/road-coverages/not-a-number')->assertNotFound();
        $this->get('/dd-phase3/not-a-section')->assertNotFound();
    }

    public function test_json_alias_dispatches_to_the_same_controller_without_redirect(): void
    {
        $this->actingAs($this->account());
        $old = $this->getJson('/dd-phase3/eligible-engineers?search=Test')->assertOk();
        $current = $this->getJson('/workspace/eligible-engineers?search=Test')->assertOk();
        $this->assertSame($current->json(), $old->json());
    }

    public function test_legacy_write_preserves_method_and_body_and_only_mutates_once(): void
    {
        $this->actingAs($this->account());
        $data = [
            'municipality_name' => 'Compatibility municipality',
            'province' => 'Test province',
            'region' => 'Test region',
            'mayor_first_name' => 'Test',
            'mayor_last_name' => 'Mayor',
        ];

        $this->post('/dd-phase3/lgus', $data)->assertRedirect('/workspace/lgus');
        $rows = DB::table('jairoads_next.lgus')->where('municipality_name', $data['municipality_name']);
        $this->assertSame(1, $rows->count());
        $id = $rows->value('id');
        $this->put('/dd-phase3/lgus/'.$id, array_replace($data, ['mayor_first_name' => 'Updated']))
            ->assertRedirect('/workspace/lgus');
        $this->assertSame('Updated', $rows->value('mayor_first_name'));
        $this->assertSame(2, DB::table('jairoads_next.audit_logs')->where('entity_type', 'LGU')
            ->where('entity_id', $id)->whereNull('recipient_user_id')->count());
    }

    public function test_both_namespaces_share_the_existing_write_throttle(): void
    {
        $this->actingAs($this->account());

        foreach (['dd-phase3', 'workspace', 'dd-phase3', 'workspace', 'dd-phase3'] as $prefix) {
            $this->postJson('/'.$prefix.'/accounts', [])->assertUnprocessable();
        }

        $this->postJson('/workspace/accounts', [])->assertTooManyRequests();
        $this->postJson('/dd-phase3/accounts', [])->assertTooManyRequests();
    }

    public function test_guest_and_ineligible_sessions_fail_closed_at_the_old_paths(): void
    {
        $this->getJson('/dd-phase3/users')->assertUnauthorized();
        $this->getJson('/dd-phase3/files/document/1')->assertUnauthorized();

        $this->actingAs($this->account('Viewer'));
        $this->getJson('/dd-phase3/users')->assertForbidden();
        $this->postJson('/dd-phase3/lgus', [])->assertForbidden();

        $this->actingAs($this->account('Admin', active: false));
        $this->getJson('/dd-phase3/dashboard')->assertForbidden();
    }
}
