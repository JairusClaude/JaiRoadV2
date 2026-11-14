import { CoverageForm } from '@/components/road-coverages/coverage-form';
import type { RoadCoverageFormProps } from '@/types/road-coverages';
export default function Create(props: RoadCoverageFormProps) {
    return <CoverageForm {...props} />;
}
