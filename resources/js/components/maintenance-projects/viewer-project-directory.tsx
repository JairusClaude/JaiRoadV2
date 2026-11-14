import { Link, router } from '@inertiajs/react';
import { ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { useState } from 'react';
import type { FormEvent } from 'react';
import type { DirectoryProps } from '@/components/maintenance-projects/project-directory';
import { workspaceHref } from '@/lib/workspace-navigation';

/**
 * JaiROADS FINAL Data Dictionary: Viewer is read-only for MaintenanceProject.
 * No Add Project, selection mode, mutation action menu, or deletion dialog.
 * The existing Laravel policy remains authoritative for mutation endpoints.
 */
type Props = Omit<DirectoryProps, 'onFilters' | 'onNavigate' | 'onDelete'>;

const control =
    'min-h-10 rounded-xl border border-[#DEE6F0] bg-white px-3.5 py-2.5 text-sm text-[#304764] outline-none focus-visible:ring-2 focus-visible:ring-[#A36542]';

export default function ViewerProjectDirectory({
    projects,
    filters,
    municipalities,
}: Props) {
    const [search, setSearch] = useState(filters.search ?? '');
    const municipality = String(filters.municipality ?? '');
    const sort = filters.sort ?? 'newest';

    const navigate = (next: {
        search: string;
        municipality: string;
        sort: string;
        page?: number;
    }) => {
        router.get(workspaceHref('/maintenance-projects'), next, {
            preserveState: false,
            preserveScroll: true,
            replace: true,
        });
    };

    const submitSearch = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        navigate({ search: search.trim(), municipality, sort });
    };

    const page = Number(projects.current_page || 1);
    const lastPage = Number(projects.last_page || 1);
    const total = Number(projects.total || 0);

    return (
        <section
            className="mx-auto w-full rounded-3xl border border-[#E4E9F0] bg-white px-5 py-7 shadow-sm sm:px-8 sm:py-8"
            aria-labelledby="viewer-projects-heading"
        >
            <header className="mb-6">
                <h1
                    id="viewer-projects-heading"
                    className="text-[26px] font-semibold tracking-tight text-[#16243A]"
                >
                    Maintenance Projects
                </h1>
                <p className="mt-1 text-sm text-[#70839D]">
                    Browse road maintenance projects. Read-only access.
                </p>
            </header>

            <form onSubmit={submitSearch} role="search" className="space-y-3">
                <div className="flex items-center gap-2 rounded-xl border border-[#DEE6F0] px-3.5 focus-within:ring-2 focus-within:ring-[#F1DED0]">
                    <Search
                        aria-hidden="true"
                        className="size-4 shrink-0 text-[#93A4B8]"
                    />
                    <input
                        aria-label="Search project titles"
                        className="h-11 w-full min-w-0 bg-transparent text-sm text-[#263B55] outline-none placeholder:text-[#93A4B8]"
                        placeholder="Search project titles..."
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                    />
                    <button
                        type="submit"
                        className="text-xs font-semibold text-[#97502B] hover:underline"
                    >
                        Search
                    </button>
                </div>
                <div className="flex flex-wrap gap-2.5">
                    <label>
                        <span className="sr-only">Municipality filter</span>
                        <select
                            className={control}
                            value={municipality}
                            onChange={(event) =>
                                navigate({
                                    search: search.trim(),
                                    municipality: event.target.value,
                                    sort,
                                })
                            }
                        >
                            <option value="">All Municipalities</option>
                            {municipalities.map((item) => (
                                <option key={item.id} value={String(item.id)}>
                                    {item.municipality_name}
                                </option>
                            ))}
                        </select>
                    </label>
                    <label>
                        <span className="sr-only">Project order</span>
                        <select
                            className={control}
                            value={sort}
                            onChange={(event) =>
                                navigate({
                                    search: search.trim(),
                                    municipality,
                                    sort: event.target.value,
                                })
                            }
                        >
                            <option value="newest">Newest first</option>
                            <option value="oldest">Oldest first</option>
                        </select>
                    </label>
                </div>
            </form>

            <div className="mt-6 mb-3 flex items-center justify-between gap-3 text-sm text-[#596F8D]">
                <span>
                    {total} {total === 1 ? 'project' : 'projects'} found
                </span>
                <span className="text-xs">Read-only access</span>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full min-w-[490px] border-collapse text-left text-sm">
                    <thead>
                        <tr className="bg-[#F2F4F8] text-xs font-semibold tracking-wide text-[#6E829D] uppercase">
                            <th scope="col" className="rounded-l-xl px-4 py-3">
                                Project
                            </th>
                            <th scope="col" className="rounded-r-xl px-4 py-3">
                                Municipality
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {projects.data.map((project) => (
                            <tr
                                key={project.id}
                                className="border-b border-[#E8EDF4] hover:bg-[#FAFBFD]"
                            >
                                <td className="px-4 py-4">
                                    <Link
                                        href={workspaceHref(
                                            `/maintenance-projects/${project.id}`,
                                        )}
                                        className="font-semibold text-[#15283F] hover:text-[#97502B] hover:underline focus-visible:underline"
                                    >
                                        {project.project_title}
                                    </Link>
                                    <div className="mt-1 text-xs text-[#8BA0BC]">
                                        Project ID: {project.id}
                                    </div>
                                </td>
                                <td className="px-4 py-4 text-[#546C8B]">
                                    {project.municipality || 'Not available'}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {projects.data.length === 0 && (
                    <div className="px-4 py-12 text-center text-sm text-[#697F9D]">
                        No projects match the current filters.
                    </div>
                )}
            </div>

            <footer className="mt-5 flex flex-wrap items-center justify-between gap-3 text-sm text-[#6D819D]">
                <span>
                    {total
                        ? `Showing ${projects.from ?? 0}–${projects.to ?? 0} of ${total} projects`
                        : 'Showing 0 projects'}{' '}
                    · Read-only access
                </span>
                <div
                    className="flex items-center gap-2"
                    aria-label="Project pagination"
                >
                    <button
                        type="button"
                        disabled={page <= 1}
                        aria-label="Previous projects page"
                        className={`${control} disabled:cursor-not-allowed disabled:opacity-40`}
                        onClick={() =>
                            navigate({
                                search: search.trim(),
                                municipality,
                                sort,
                                page: page - 1,
                            })
                        }
                    >
                        <ChevronLeft className="size-4" />
                    </button>
                    <span className="rounded-lg bg-[#FFF1E7] px-3 py-2 font-medium text-[#93512D]">
                        {page}
                    </span>
                    <button
                        type="button"
                        disabled={page >= lastPage}
                        aria-label="Next projects page"
                        className={`${control} disabled:cursor-not-allowed disabled:opacity-40`}
                        onClick={() =>
                            navigate({
                                search: search.trim(),
                                municipality,
                                sort,
                                page: page + 1,
                            })
                        }
                    >
                        <ChevronRight className="size-4" />
                    </button>
                </div>
            </footer>
        </section>
    );
}
