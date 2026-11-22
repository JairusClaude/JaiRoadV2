import '../../../css/jairoads-account-type-badges.css';

const labels: Record<string, string> = {
    superadmin: 'SuperAdmin',
    admin: 'Admin',
    engineer: 'Engineer',
    viewer: 'Viewer',
};

export default function AccountTypeBadge({ role }: { role: string }) {
    const label = labels[role.toLowerCase()] ?? role;

    return (
        <span className="um-role" data-role={label}>
            {label}
        </span>
    );
}
