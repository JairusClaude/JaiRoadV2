<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Http\Controllers\Concerns\AuthorizesAndAuditsDirectory;
use App\Services\AccountIdentityResolver;
use App\Services\AuditValues;
use Illuminate\Database\QueryException;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * LGU create, update and delete endpoints.
 * Retains the shared canonical administrator guard and audit helper.
 */
final class LguDirectoryController extends Controller
{
    use AuthorizesAndAuditsDirectory;

    public function createLgu(Request $request, AccountIdentityResolver $resolver): RedirectResponse
    {
        $actor = $this->admin($request, $resolver);
        $v = $request->validate([
            'municipality_name' => ['required', 'string', 'max:100'],
            'province' => ['required', 'string', 'max:100'],
            'region' => ['required', 'string', 'max:100'],
            'mayor_first_name' => ['required', 'string', 'max:100'],
            'mayor_middle_name' => ['nullable', 'string', 'max:100'],
            'mayor_last_name' => ['required', 'string', 'max:100'],
        ]);
        DB::transaction(function () use ($actor, $v): void {
            $id = (int) DB::table('jairoads_next.lgus')->insertGetId($v);
            $this->audit($actor, 'CREATE', 'LGU', $id, 'Authorized administrator created an LGU.', ['lgu_id' => $id]);
        });

        return redirect()->route('jairoads.dd-phase3.show', ['section' => 'lgus'])->with('dd_phase3_status', 'Municipality created.');
    }

    /**
     * Admin/SuperAdmin LGU maintenance only. Dependent RoadCoverage and
     * EngineerLGU rows are protected by the approved restrictive foreign keys.
     */
    public function updateLgu(Request $request, AccountIdentityResolver $resolver, int $id): RedirectResponse
    {
        $actor = $this->admin($request, $resolver);
        $v = $request->validate([
            'municipality_name' => ['required', 'string', 'max:100'],
            'province' => ['required', 'string', 'max:100'],
            'region' => ['required', 'string', 'max:100'],
            'mayor_first_name' => ['required', 'string', 'max:100'],
            'mayor_middle_name' => ['nullable', 'string', 'max:100'],
            'mayor_last_name' => ['required', 'string', 'max:100'],
        ]);
        DB::transaction(function () use ($actor, $id, $v): void {
            $row = DB::table('jairoads_next.lgus')->where('id', $id)->lockForUpdate()->first();
            abort_unless($row !== null, 404);
            if (app(AuditValues::class)->changes('LGU', (array) $row, array_replace((array) $row, $v)) === [[], []]) {
                return;
            }
            DB::table('jairoads_next.lgus')->where('id', $id)->update($v);
            $this->audit($actor, 'UPDATE', 'LGU', $id, 'Authorized administrator updated an LGU.', app(AuditValues::class)->persisted('LGU', $id), (array) $row);
        });

        return redirect()->route('jairoads.dd-phase3.show', ['section' => 'lgus'])->with('dd_phase3_status', 'Municipality updated.');
    }

    public function deleteLgu(Request $request, AccountIdentityResolver $resolver, int $id): RedirectResponse
    {
        $actor = $this->admin($request, $resolver);
        DB::transaction(function () use ($actor, $id): void {
            $row = DB::table('jairoads_next.lgus')->where('id', $id)->lockForUpdate()->first();
            abort_unless($row !== null, 404);
            try {
                DB::table('jairoads_next.lgus')->where('id', $id)->delete();
            } catch (QueryException $e) {
                if ((string) $e->getCode() !== '23503' && ($e->errorInfo[0] ?? '') !== '23503') {
                    throw $e;
                }
                throw ValidationException::withMessages([
                    'delete' => 'The LGU is referenced by road coverage or engineer assignments. Retain the LGU until those dependencies are explicitly handled.',
                ]);
            }
            $this->audit($actor, 'DELETE', 'LGU', $id, 'Authorized administrator deleted an unreferenced LGU.', [], (array) $row);
        });

        return redirect()->route('jairoads.dd-phase3.show', ['section' => 'lgus'])->with('dd_phase3_status', 'Municipality deleted.');
    }
}
