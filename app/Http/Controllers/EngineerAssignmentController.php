<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Http\Controllers\Concerns\AuthorizesAndAuditsDirectory;
use App\Services\AccountIdentityResolver;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * EngineerLGU assignment administration endpoint.
 * Reuses the shared canonical administrator guard and audit writer.
 */
final class EngineerAssignmentController extends Controller
{
    use AuthorizesAndAuditsDirectory;

    public function setAssignment(Request $request, AccountIdentityResolver $resolver): RedirectResponse
    {
        $actor = $this->admin($request, $resolver);
        $v = $request->validate(['engineer_id' => ['required', 'integer', 'min:1'], 'lgu_id' => ['required', 'integer', 'min:1'], 'is_active' => ['required', 'boolean']]);
        DB::transaction(function () use ($actor, $v): void {
            DB::select('SELECT pg_advisory_xact_lock(1927710915)');
            $engineer = DB::table('jairoads_next.engineers')->where('id', $v['engineer_id'])->lockForUpdate()->first(['id', 'engineer_status']);
            if (! $engineer || (string) $engineer->engineer_status !== 'Active') {
                throw ValidationException::withMessages(['engineer_id' => 'Only active Engineers may be assigned.']);
            }
            if (! DB::table('jairoads_next.lgus')->where('id', $v['lgu_id'])->exists()) {
                throw ValidationException::withMessages(['lgu_id' => 'LGU does not exist.']);
            }
            $key = ['engineer_id' => (int) $v['engineer_id'], 'lgu_id' => (int) $v['lgu_id']];
            $existing = DB::table('jairoads_next.engineer_lgus')->where($key)->first(['is_active']);
            if ($existing && $existing->is_active === (bool) $v['is_active']) {
                return;
            }
            if ($existing) {
                DB::table('jairoads_next.engineer_lgus')->where($key)->update(['is_active' => (bool) $v['is_active']]);
            } else {
                DB::table('jairoads_next.engineer_lgus')->insert($key + ['is_active' => (bool) $v['is_active']]);
            }
            $this->audit($actor, $existing ? 'UPDATE' : 'CREATE', 'EngineerLGU', (int) $v['engineer_id'], 'Authorized administrator maintained an EngineerLGU assignment.', $key + ['is_active' => (bool) $v['is_active']], $existing ? $key + ['is_active' => $existing->is_active] : []);
        });

        return redirect()->route('jairoads.dd-phase3.show', ['section' => 'users'])->with('dd_phase3_status', 'Engineer assignment saved.');
    }
}
