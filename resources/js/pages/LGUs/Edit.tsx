import { LguForm } from '@/components/lgus/lgu-form';
import type { Lgu } from '@/types/lgus';
export default function Edit({ lgu }: { lgu: Lgu }) {
    return <LguForm key={lgu.id} lgu={lgu} />;
}
