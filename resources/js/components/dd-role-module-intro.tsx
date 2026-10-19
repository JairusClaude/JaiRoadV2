import { Link } from "@inertiajs/react";
import { Eye, HardHat, LockKeyhole, ShieldCheck, ShieldHalf, UserRoundCog } from "lucide-react";

type Role = "SuperAdmin" | "Admin" | "Engineer" | "Viewer";
type Module = "projects" | "updates" | "documents" | "roads" | "lgus";

const detail: Record<Module, { title: string; object: string; prerequisite: string }> = {
  projects: {
    title: "Maintenance projects",
    object: "MaintenanceProject and linked MaintenanceRecord",
    prerequisite: "A project needs an unused RoadCoverage. Each maintenance record belongs to an existing project.",
  },
  updates: {
    title: "Monthly reporting",
    object: "MonthlyUpdate and supporting Media",
    prerequisite: "An existing MaintenanceRecord is required. Engineer updates are restricted to records they currently manage.",
  },
  documents: {
    title: "Formal documents",
    object: "MaintenanceDocument linked to MaintenanceRecord",
    prerequisite: "A MaintenanceRecord and configured private file storage are required for uploads.",
  },
  roads: {
    title: "Road inventory",
    object: "RoadCoverage and LGU",
    prerequisite: "New RoadCoverage.CreatedBy must be a real active Engineer, including when the acting account is SuperAdmin.",
  },
  lgus: {
    title: "Municipality directory",
    object: "LGU master data",
    prerequisite: "Referenced LGUs cannot be removed while related records or assignments remain.",
  },
};

const roles: Record<Role, { title: string; subtitle: string; icon: typeof ShieldCheck; badge: string; panel: string }> = {
  SuperAdmin: {
    title: "System oversight",
    subtitle: "Review and manage approved operations across JaiROADS; system governance remains in the Command Center.",
    icon: ShieldCheck,
    badge: "System-wide oversight",
    panel: "border-amber-300/20 bg-[#111c33] text-white",
  },
  Admin: {
    title: "Operations management",
    subtitle: "Coordinate daily records and authorized administrative tasks using the operational workspace.",
    icon: UserRoundCog,
    badge: "Administrative operations",
    panel: "border-[#ecdcc7] bg-[#fffaf2] text-[#15253b]",
  },
  Engineer: {
    title: "My assigned work",
    subtitle: "Operational changes are limited to your active municipalities and, where required, your own managed records.",
    icon: HardHat,
    badge: "Assigned work only",
    panel: "border-sky-200 bg-[#f1f7fd] text-[#183652]",
  },
  Viewer: {
    title: "Read-only workspace",
    subtitle: "Explore approved maintenance information. Creating, changing and deleting records is not permitted.",
    icon: Eye,
    badge: "Read only",
    panel: "border-slate-200 bg-[#f8fafc] text-[#263750]",
  },
};

/** Presentation only. Every DD write endpoint still performs its own authorization. */
export function DdRoleModuleIntro({
  role,
  module,
  hasAssignment = false,
  engineerLinked = false,
}: {
  role: Role;
  module: Module;
  hasAssignment?: boolean;
  engineerLinked?: boolean;
}) {
  const style = roles[role];
  const meta = detail[module];
  const Icon = style.icon;
  const privileged = role === "SuperAdmin";
  const canChange = privileged || role === "Admin" || (role === "Engineer" && hasAssignment);
  return (
    <section className={`mb-5 rounded-2xl border px-4 py-4 sm:px-5 ${style.panel}`} aria-label={`${role} access for ${meta.title}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${privileged ? "bg-white/10 text-amber-200" : "bg-white text-[#935025]"}`}>
            <Icon className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <div className={`text-[11px] font-bold uppercase tracking-[.16em] ${privileged ? "text-amber-300" : "text-[#9b582b]"}`}>{style.badge}</div>
            <h2 className="mt-1 text-base font-bold">{style.title} · {meta.title}</h2>
            <p className={`mt-1 text-xs leading-5 ${privileged ? "text-slate-300" : "text-slate-600"}`}>{style.subtitle}</p>
          </div>
        </div>
        <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold ${privileged ? "border-white/20 bg-white/10 text-white" : "border-slate-200 bg-white text-slate-700"}`}>
          {canChange ? <ShieldHalf className="h-3.5 w-3.5" /> : <LockKeyhole className="h-3.5 w-3.5" />}
          {canChange ? "Authorized operations" : "Viewing access"}
        </div>
      </div>
      <div className={`mt-3 flex flex-wrap items-center justify-between gap-3 border-t pt-3 text-xs ${privileged ? "border-white/15 text-slate-300" : "border-slate-200 text-slate-600"}`}>
        <span><strong className={privileged ? "text-slate-100" : "text-slate-800"}>Source:</strong> {meta.object}. {meta.prerequisite}</span>
        {role === "SuperAdmin" && <Link href="/dd-superadmin-landing" className="shrink-0 font-semibold text-amber-300 hover:underline">Command Center →</Link>}
        {role === "Engineer" && !hasAssignment && <span className="font-semibold text-amber-800">No active LGU assignment — writes disabled</span>}
        {module === "roads" && canChange && !engineerLinked && <span className="font-semibold text-amber-700">Road creation needs a linked Engineer identity</span>}
      </div>
    </section>
  );
}
