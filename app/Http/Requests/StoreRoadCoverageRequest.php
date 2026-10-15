
<?php

namespace App\Http\Requests;

use App\Models\Lgu;
use App\Models\RoadCoverage;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreRoadCoverageRequest extends FormRequest
{
    /**
     * Only users authorized by the RoadCoverage policy may create coverage.
     */
    public function authorize(): bool
    {
        return $this->user()?->can(
            'create',
            RoadCoverage::class
        ) ?? false;
    }

    /**
     * Get the validation rules for creating RoadCoverage.
     *
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        $lgu = new Lgu();

        return [
            'road_name' => [
                'required',
                'string',
                'max:255',
            ],

            'lgu_id' => [
                'required',
                'integer',
                Rule::exists(
                    $lgu->getTable(),
                    $lgu->getKeyName()
                ),
            ],

            'kilometers' => [
                'required',
                'numeric',
                'decimal:0,2',
                'min:0',
                'max:99999999.99',
            ],

            'pavement_type' => [
                'required',
                'string',
                'max:20',
                Rule::in([
                    'Concrete',
                    'Asphalt',
                    'Gravel',
                    'Earth',
                ]),
            ],

            'state_category' => [
                'required',
                'string',
                'max:20',
                Rule::in([
                    'Good',
                    'Fair',
                    'Bad',
                ]),
            ],

            'geojson' => [
                'required',
                'array',
            ],
        ];
    }
}
