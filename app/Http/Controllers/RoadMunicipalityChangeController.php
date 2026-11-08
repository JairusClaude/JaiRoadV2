<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Models\User;
use App\Services\AccountIdentityResolver;
use App\Services\RoadMunicipalityChange;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

/**
 * Canonical municipality-change endpoints for RoadCoverage.
 * Authorization/audit helpers remain inherited during the incremental split.
 * The RoadMunicipalityChange service and confirmation semantics are unchanged.
 */
final class RoadMunicipalityChangeController extends OperationsController
{
    public function previewRoadMunicipality(Request $request, AccountIdentityResolver $resolver, RoadMunicipalityChange $changes, int $id): JsonResponse
    {
        $this->writer($this->actor($request, $resolver));
        $data = $request->validate(['lgu_id' => ['required', 'integer', 'min:1']]);
        $login = $request->user();
        abort_unless($login instanceof User, 403);

        return response()->json($changes->preview($login, $id, (int) $data['lgu_id']))
            ->header('Cache-Control', 'no-store, private');
    }

    public function confirmRoadMunicipality(Request $request, AccountIdentityResolver $resolver, RoadMunicipalityChange $changes, int $id): RedirectResponse
    {
        $this->writer($this->actor($request, $resolver));
        $data = $request->validate(['confirmation_token' => ['required', 'string', 'max:20000']]);
        $login = $request->user();
        abort_unless($login instanceof User, 403);
        $impact = $changes->confirm($login, $id, $data['confirmation_token'], function (array $actor, array $impact) use ($id): void {
            $affected = ['project_ids' => array_column($impact['projects'], 'id'), 'maintenance_record_ids' => $impact['maintenance_record_ids']];
            $this->audit($actor, 'UPDATE', 'RoadCoverage', $id,
                'RoadCoverage #'.$id.' municipality changed from '.$impact['previous']['municipality'].' to '.$impact['proposed']['municipality'].' by authorized '.$actor['role'].' DD-UserAccount#'.$actor['account_id'].'.',
                $impact['proposed'] + $affected, $impact['previous'] + $affected);
        });

        $message = 'Municipality changed from '.$impact['previous']['municipality'].' to '.$impact['proposed']['municipality'].'. Road geometry and maintenance history were preserved.';
        $details = '/dd-phase3/ui/road-coverages/'.$id;
        if ($request->input('return_to') === $details) {
            return redirect($details)->with('dd_operations_status', $message);
        }

        return $this->done('roads', $message);
    }
}
