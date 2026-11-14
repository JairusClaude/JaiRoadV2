import { CoverageForm } from '@/components/road-coverages/coverage-form';
import type { RoadCoverageFormProps } from '@/types/road-coverages';
export default function Edit(props: RoadCoverageFormProps) {
    return <CoverageForm key={props.coverage?.id} {...props} />;
}
