<?php

declare(strict_types=1);

namespace App\Support;

use Illuminate\Database\Query\Builder;
use Illuminate\Http\Request;
use Illuminate\Pagination\LengthAwarePaginator;

final class BoundedDirectoryPage
{
    /**
     * Resolve the requested page before executing the data query. Reuse Laravel's
     * pagination count so a stale bookmark never triggers an enormous SQL OFFSET.
     *
     * @param  list<string>  $columns
     * @return LengthAwarePaginator<int, \stdClass>
     */
    public static function paginate(Builder $query, Request $request, int $perPage, array $columns = ['*'], string $pageName = 'page'): LengthAwarePaginator
    {
        $raw = $request->query($pageName);
        $requested = is_string($raw) && ctype_digit($raw) ? max(1, (int) $raw) : 1;
        $total = $query->getCountForPagination();
        $last = max(1, (int) ceil($total / $perPage));

        return $query->paginate($perPage, $columns, $pageName, min($requested, $last), $total)->withQueryString();
    }
}
