<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Http\Controllers\Concerns\AuthorizesAndAuditsDirectory;
use App\Services\AccountIdentityResolver;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Engineer directory profile creation endpoint.
 * Reuses the shared canonical administrator guard and audit writer.
 */
final class EngineerDirectoryController extends Controller
{
    use AuthorizesAndAuditsDirectory;

    public function createEngineer(Request $request, AccountIdentityResolver $resolver): RedirectResponse
    {
        $actor = $this->admin($request, $resolver);
        // ContactNo is REQUIRED on new forms pending the DD nullability conflict;
        // this satisfies both competing tab definitions without changing DDL.
        $v = $request->validate([
            'first_name' => ['required', 'string', 'max:100'],
            'middle_name' => ['nullable', 'string', 'max:100'],
            'last_name' => ['required', 'string', 'max:100'],
            'contact_no' => ['required', 'string', 'max:30'],
            'rank' => ['required', 'string', 'max:100'],
        ]);
        $v['engineer_status'] = 'Active';
        DB::transaction(function () use ($actor, $v): void {
            $id = (int) DB::table('jairoads_next.engineers')->insertGetId($v);
            $this->audit($actor, 'CREATE', 'Engineer', $id, 'Authorized administrator created an Engineer.', ['engineer_id' => $id, 'engineer_status' => 'Active']);
        });

        return redirect()->route('jairoads.dd-phase3.show', ['section' => 'users'])->with('dd_phase3_status', 'Engineer profile created.');
    }
}
