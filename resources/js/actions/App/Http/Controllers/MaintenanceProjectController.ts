import { queryParams, type RouteQueryOptions, type RouteDefinition, type RouteFormDefinition, applyUrlDefaults } from './../../../../wayfinder'
/**
* @see \App\Http\Controllers\MaintenanceProjectController::bulkDestroy
* @see workspace/scratch/40cc43c72aeb/JaiRoadV2-Integration/app/Http/Controllers/MaintenanceProjectController.php:124
* @route '/maintenance-projects/bulk'
*/
export const bulkDestroy = (options?: RouteQueryOptions): RouteDefinition<'delete'> => ({
    url: bulkDestroy.url(options),
    method: 'delete',
})

bulkDestroy.definition = {
    methods: ["delete"],
    url: '/maintenance-projects/bulk',
} satisfies RouteDefinition<["delete"]>

/**
* @see \App\Http\Controllers\MaintenanceProjectController::bulkDestroy
* @see workspace/scratch/40cc43c72aeb/JaiRoadV2-Integration/app/Http/Controllers/MaintenanceProjectController.php:124
* @route '/maintenance-projects/bulk'
*/
bulkDestroy.url = (options?: RouteQueryOptions) => {
    return bulkDestroy.definition.url + queryParams(options)
}

/**
* @see \App\Http\Controllers\MaintenanceProjectController::bulkDestroy
* @see workspace/scratch/40cc43c72aeb/JaiRoadV2-Integration/app/Http/Controllers/MaintenanceProjectController.php:124
* @route '/maintenance-projects/bulk'
*/
bulkDestroy.delete = (options?: RouteQueryOptions): RouteDefinition<'delete'> => ({
    url: bulkDestroy.url(options),
    method: 'delete',
})

/**
* @see \App\Http\Controllers\MaintenanceProjectController::bulkDestroy
* @see workspace/scratch/40cc43c72aeb/JaiRoadV2-Integration/app/Http/Controllers/MaintenanceProjectController.php:124
* @route '/maintenance-projects/bulk'
*/
const bulkDestroyForm = (options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: bulkDestroy.url({
        [options?.mergeQuery ? 'mergeQuery' : 'query']: {
            _method: 'DELETE',
            ...(options?.query ?? options?.mergeQuery ?? {}),
        }
    }),
    method: 'post',
})

/**
* @see \App\Http\Controllers\MaintenanceProjectController::bulkDestroy
* @see workspace/scratch/40cc43c72aeb/JaiRoadV2-Integration/app/Http/Controllers/MaintenanceProjectController.php:124
* @route '/maintenance-projects/bulk'
*/
bulkDestroyForm.delete = (options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: bulkDestroy.url({
        [options?.mergeQuery ? 'mergeQuery' : 'query']: {
            _method: 'DELETE',
            ...(options?.query ?? options?.mergeQuery ?? {}),
        }
    }),
    method: 'post',
})

bulkDestroy.form = bulkDestroyForm

/**
* @see \App\Http\Controllers\MaintenanceProjectController::index
* @see workspace/scratch/40cc43c72aeb/JaiRoadV2-Integration/app/Http/Controllers/MaintenanceProjectController.php:25
* @route '/maintenance-projects'
*/
export const index = (options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: index.url(options),
    method: 'get',
})

index.definition = {
    methods: ["get","head"],
    url: '/maintenance-projects',
} satisfies RouteDefinition<["get","head"]>

/**
* @see \App\Http\Controllers\MaintenanceProjectController::index
* @see workspace/scratch/40cc43c72aeb/JaiRoadV2-Integration/app/Http/Controllers/MaintenanceProjectController.php:25
* @route '/maintenance-projects'
*/
index.url = (options?: RouteQueryOptions) => {
    return index.definition.url + queryParams(options)
}

/**
* @see \App\Http\Controllers\MaintenanceProjectController::index
* @see workspace/scratch/40cc43c72aeb/JaiRoadV2-Integration/app/Http/Controllers/MaintenanceProjectController.php:25
* @route '/maintenance-projects'
*/
index.get = (options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: index.url(options),
    method: 'get',
})

/**
* @see \App\Http\Controllers\MaintenanceProjectController::index
* @see workspace/scratch/40cc43c72aeb/JaiRoadV2-Integration/app/Http/Controllers/MaintenanceProjectController.php:25
* @route '/maintenance-projects'
*/
index.head = (options?: RouteQueryOptions): RouteDefinition<'head'> => ({
    url: index.url(options),
    method: 'head',
})

/**
* @see \App\Http\Controllers\MaintenanceProjectController::index
* @see workspace/scratch/40cc43c72aeb/JaiRoadV2-Integration/app/Http/Controllers/MaintenanceProjectController.php:25
* @route '/maintenance-projects'
*/
const indexForm = (options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
    action: index.url(options),
    method: 'get',
})

/**
* @see \App\Http\Controllers\MaintenanceProjectController::index
* @see workspace/scratch/40cc43c72aeb/JaiRoadV2-Integration/app/Http/Controllers/MaintenanceProjectController.php:25
* @route '/maintenance-projects'
*/
indexForm.get = (options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
    action: index.url(options),
    method: 'get',
})

/**
* @see \App\Http\Controllers\MaintenanceProjectController::index
* @see workspace/scratch/40cc43c72aeb/JaiRoadV2-Integration/app/Http/Controllers/MaintenanceProjectController.php:25
* @route '/maintenance-projects'
*/
indexForm.head = (options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
    action: index.url({
        [options?.mergeQuery ? 'mergeQuery' : 'query']: {
            _method: 'HEAD',
            ...(options?.query ?? options?.mergeQuery ?? {}),
        }
    }),
    method: 'get',
})

index.form = indexForm

/**
* @see \App\Http\Controllers\MaintenanceProjectController::create
* @see workspace/scratch/40cc43c72aeb/JaiRoadV2-Integration/app/Http/Controllers/MaintenanceProjectController.php:67
* @route '/maintenance-projects/create'
*/
export const create = (options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: create.url(options),
    method: 'get',
})

create.definition = {
    methods: ["get","head"],
    url: '/maintenance-projects/create',
} satisfies RouteDefinition<["get","head"]>

/**
* @see \App\Http\Controllers\MaintenanceProjectController::create
* @see workspace/scratch/40cc43c72aeb/JaiRoadV2-Integration/app/Http/Controllers/MaintenanceProjectController.php:67
* @route '/maintenance-projects/create'
*/
create.url = (options?: RouteQueryOptions) => {
    return create.definition.url + queryParams(options)
}

/**
* @see \App\Http\Controllers\MaintenanceProjectController::create
* @see workspace/scratch/40cc43c72aeb/JaiRoadV2-Integration/app/Http/Controllers/MaintenanceProjectController.php:67
* @route '/maintenance-projects/create'
*/
create.get = (options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: create.url(options),
    method: 'get',
})

/**
* @see \App\Http\Controllers\MaintenanceProjectController::create
* @see workspace/scratch/40cc43c72aeb/JaiRoadV2-Integration/app/Http/Controllers/MaintenanceProjectController.php:67
* @route '/maintenance-projects/create'
*/
create.head = (options?: RouteQueryOptions): RouteDefinition<'head'> => ({
    url: create.url(options),
    method: 'head',
})

/**
* @see \App\Http\Controllers\MaintenanceProjectController::create
* @see workspace/scratch/40cc43c72aeb/JaiRoadV2-Integration/app/Http/Controllers/MaintenanceProjectController.php:67
* @route '/maintenance-projects/create'
*/
const createForm = (options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
    action: create.url(options),
    method: 'get',
})

/**
* @see \App\Http\Controllers\MaintenanceProjectController::create
* @see workspace/scratch/40cc43c72aeb/JaiRoadV2-Integration/app/Http/Controllers/MaintenanceProjectController.php:67
* @route '/maintenance-projects/create'
*/
createForm.get = (options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
    action: create.url(options),
    method: 'get',
})

/**
* @see \App\Http\Controllers\MaintenanceProjectController::create
* @see workspace/scratch/40cc43c72aeb/JaiRoadV2-Integration/app/Http/Controllers/MaintenanceProjectController.php:67
* @route '/maintenance-projects/create'
*/
createForm.head = (options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
    action: create.url({
        [options?.mergeQuery ? 'mergeQuery' : 'query']: {
            _method: 'HEAD',
            ...(options?.query ?? options?.mergeQuery ?? {}),
        }
    }),
    method: 'get',
})

create.form = createForm

/**
* @see \App\Http\Controllers\MaintenanceProjectController::store
* @see workspace/scratch/40cc43c72aeb/JaiRoadV2-Integration/app/Http/Controllers/MaintenanceProjectController.php:77
* @route '/maintenance-projects'
*/
export const store = (options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: store.url(options),
    method: 'post',
})

store.definition = {
    methods: ["post"],
    url: '/maintenance-projects',
} satisfies RouteDefinition<["post"]>

/**
* @see \App\Http\Controllers\MaintenanceProjectController::store
* @see workspace/scratch/40cc43c72aeb/JaiRoadV2-Integration/app/Http/Controllers/MaintenanceProjectController.php:77
* @route '/maintenance-projects'
*/
store.url = (options?: RouteQueryOptions) => {
    return store.definition.url + queryParams(options)
}

/**
* @see \App\Http\Controllers\MaintenanceProjectController::store
* @see workspace/scratch/40cc43c72aeb/JaiRoadV2-Integration/app/Http/Controllers/MaintenanceProjectController.php:77
* @route '/maintenance-projects'
*/
store.post = (options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: store.url(options),
    method: 'post',
})

/**
* @see \App\Http\Controllers\MaintenanceProjectController::store
* @see workspace/scratch/40cc43c72aeb/JaiRoadV2-Integration/app/Http/Controllers/MaintenanceProjectController.php:77
* @route '/maintenance-projects'
*/
const storeForm = (options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: store.url(options),
    method: 'post',
})

/**
* @see \App\Http\Controllers\MaintenanceProjectController::store
* @see workspace/scratch/40cc43c72aeb/JaiRoadV2-Integration/app/Http/Controllers/MaintenanceProjectController.php:77
* @route '/maintenance-projects'
*/
storeForm.post = (options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: store.url(options),
    method: 'post',
})

store.form = storeForm

/**
* @see \App\Http\Controllers\MaintenanceProjectController::show
* @see workspace/scratch/40cc43c72aeb/JaiRoadV2-Integration/app/Http/Controllers/MaintenanceProjectController.php:84
* @route '/maintenance-projects/{maintenance_project}'
*/
export const show = (args: { maintenance_project: string | number | { id: string | number } } | [maintenance_project: string | number | { id: string | number } ] | string | number | { id: string | number }, options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: show.url(args, options),
    method: 'get',
})

show.definition = {
    methods: ["get","head"],
    url: '/maintenance-projects/{maintenance_project}',
} satisfies RouteDefinition<["get","head"]>

/**
* @see \App\Http\Controllers\MaintenanceProjectController::show
* @see workspace/scratch/40cc43c72aeb/JaiRoadV2-Integration/app/Http/Controllers/MaintenanceProjectController.php:84
* @route '/maintenance-projects/{maintenance_project}'
*/
show.url = (args: { maintenance_project: string | number | { id: string | number } } | [maintenance_project: string | number | { id: string | number } ] | string | number | { id: string | number }, options?: RouteQueryOptions) => {
    if (typeof args === 'string' || typeof args === 'number') {
        args = { maintenance_project: args }
    }

    if (typeof args === 'object' && !Array.isArray(args) && 'id' in args) {
        args = { maintenance_project: args.id }
    }

    if (Array.isArray(args)) {
        args = {
            maintenance_project: args[0],
        }
    }

    args = applyUrlDefaults(args)

    const parsedArgs = {
        maintenance_project: typeof args.maintenance_project === 'object'
        ? args.maintenance_project.id
        : args.maintenance_project,
    }

    return show.definition.url
            .replace('{maintenance_project}', parsedArgs.maintenance_project.toString())
            .replace(/\/+$/, '') + queryParams(options)
}

/**
* @see \App\Http\Controllers\MaintenanceProjectController::show
* @see workspace/scratch/40cc43c72aeb/JaiRoadV2-Integration/app/Http/Controllers/MaintenanceProjectController.php:84
* @route '/maintenance-projects/{maintenance_project}'
*/
show.get = (args: { maintenance_project: string | number | { id: string | number } } | [maintenance_project: string | number | { id: string | number } ] | string | number | { id: string | number }, options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: show.url(args, options),
    method: 'get',
})

/**
* @see \App\Http\Controllers\MaintenanceProjectController::show
* @see workspace/scratch/40cc43c72aeb/JaiRoadV2-Integration/app/Http/Controllers/MaintenanceProjectController.php:84
* @route '/maintenance-projects/{maintenance_project}'
*/
show.head = (args: { maintenance_project: string | number | { id: string | number } } | [maintenance_project: string | number | { id: string | number } ] | string | number | { id: string | number }, options?: RouteQueryOptions): RouteDefinition<'head'> => ({
    url: show.url(args, options),
    method: 'head',
})

/**
* @see \App\Http\Controllers\MaintenanceProjectController::show
* @see workspace/scratch/40cc43c72aeb/JaiRoadV2-Integration/app/Http/Controllers/MaintenanceProjectController.php:84
* @route '/maintenance-projects/{maintenance_project}'
*/
const showForm = (args: { maintenance_project: string | number | { id: string | number } } | [maintenance_project: string | number | { id: string | number } ] | string | number | { id: string | number }, options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
    action: show.url(args, options),
    method: 'get',
})

/**
* @see \App\Http\Controllers\MaintenanceProjectController::show
* @see workspace/scratch/40cc43c72aeb/JaiRoadV2-Integration/app/Http/Controllers/MaintenanceProjectController.php:84
* @route '/maintenance-projects/{maintenance_project}'
*/
showForm.get = (args: { maintenance_project: string | number | { id: string | number } } | [maintenance_project: string | number | { id: string | number } ] | string | number | { id: string | number }, options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
    action: show.url(args, options),
    method: 'get',
})

/**
* @see \App\Http\Controllers\MaintenanceProjectController::show
* @see workspace/scratch/40cc43c72aeb/JaiRoadV2-Integration/app/Http/Controllers/MaintenanceProjectController.php:84
* @route '/maintenance-projects/{maintenance_project}'
*/
showForm.head = (args: { maintenance_project: string | number | { id: string | number } } | [maintenance_project: string | number | { id: string | number } ] | string | number | { id: string | number }, options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
    action: show.url(args, {
        [options?.mergeQuery ? 'mergeQuery' : 'query']: {
            _method: 'HEAD',
            ...(options?.query ?? options?.mergeQuery ?? {}),
        }
    }),
    method: 'get',
})

show.form = showForm

/**
* @see \App\Http\Controllers\MaintenanceProjectController::edit
* @see workspace/scratch/40cc43c72aeb/JaiRoadV2-Integration/app/Http/Controllers/MaintenanceProjectController.php:97
* @route '/maintenance-projects/{maintenance_project}/edit'
*/
export const edit = (args: { maintenance_project: string | number | { id: string | number } } | [maintenance_project: string | number | { id: string | number } ] | string | number | { id: string | number }, options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: edit.url(args, options),
    method: 'get',
})

edit.definition = {
    methods: ["get","head"],
    url: '/maintenance-projects/{maintenance_project}/edit',
} satisfies RouteDefinition<["get","head"]>

/**
* @see \App\Http\Controllers\MaintenanceProjectController::edit
* @see workspace/scratch/40cc43c72aeb/JaiRoadV2-Integration/app/Http/Controllers/MaintenanceProjectController.php:97
* @route '/maintenance-projects/{maintenance_project}/edit'
*/
edit.url = (args: { maintenance_project: string | number | { id: string | number } } | [maintenance_project: string | number | { id: string | number } ] | string | number | { id: string | number }, options?: RouteQueryOptions) => {
    if (typeof args === 'string' || typeof args === 'number') {
        args = { maintenance_project: args }
    }

    if (typeof args === 'object' && !Array.isArray(args) && 'id' in args) {
        args = { maintenance_project: args.id }
    }

    if (Array.isArray(args)) {
        args = {
            maintenance_project: args[0],
        }
    }

    args = applyUrlDefaults(args)

    const parsedArgs = {
        maintenance_project: typeof args.maintenance_project === 'object'
        ? args.maintenance_project.id
        : args.maintenance_project,
    }

    return edit.definition.url
            .replace('{maintenance_project}', parsedArgs.maintenance_project.toString())
            .replace(/\/+$/, '') + queryParams(options)
}

/**
* @see \App\Http\Controllers\MaintenanceProjectController::edit
* @see workspace/scratch/40cc43c72aeb/JaiRoadV2-Integration/app/Http/Controllers/MaintenanceProjectController.php:97
* @route '/maintenance-projects/{maintenance_project}/edit'
*/
edit.get = (args: { maintenance_project: string | number | { id: string | number } } | [maintenance_project: string | number | { id: string | number } ] | string | number | { id: string | number }, options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: edit.url(args, options),
    method: 'get',
})

/**
* @see \App\Http\Controllers\MaintenanceProjectController::edit
* @see workspace/scratch/40cc43c72aeb/JaiRoadV2-Integration/app/Http/Controllers/MaintenanceProjectController.php:97
* @route '/maintenance-projects/{maintenance_project}/edit'
*/
edit.head = (args: { maintenance_project: string | number | { id: string | number } } | [maintenance_project: string | number | { id: string | number } ] | string | number | { id: string | number }, options?: RouteQueryOptions): RouteDefinition<'head'> => ({
    url: edit.url(args, options),
    method: 'head',
})

/**
* @see \App\Http\Controllers\MaintenanceProjectController::edit
* @see workspace/scratch/40cc43c72aeb/JaiRoadV2-Integration/app/Http/Controllers/MaintenanceProjectController.php:97
* @route '/maintenance-projects/{maintenance_project}/edit'
*/
const editForm = (args: { maintenance_project: string | number | { id: string | number } } | [maintenance_project: string | number | { id: string | number } ] | string | number | { id: string | number }, options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
    action: edit.url(args, options),
    method: 'get',
})

/**
* @see \App\Http\Controllers\MaintenanceProjectController::edit
* @see workspace/scratch/40cc43c72aeb/JaiRoadV2-Integration/app/Http/Controllers/MaintenanceProjectController.php:97
* @route '/maintenance-projects/{maintenance_project}/edit'
*/
editForm.get = (args: { maintenance_project: string | number | { id: string | number } } | [maintenance_project: string | number | { id: string | number } ] | string | number | { id: string | number }, options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
    action: edit.url(args, options),
    method: 'get',
})

/**
* @see \App\Http\Controllers\MaintenanceProjectController::edit
* @see workspace/scratch/40cc43c72aeb/JaiRoadV2-Integration/app/Http/Controllers/MaintenanceProjectController.php:97
* @route '/maintenance-projects/{maintenance_project}/edit'
*/
editForm.head = (args: { maintenance_project: string | number | { id: string | number } } | [maintenance_project: string | number | { id: string | number } ] | string | number | { id: string | number }, options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
    action: edit.url(args, {
        [options?.mergeQuery ? 'mergeQuery' : 'query']: {
            _method: 'HEAD',
            ...(options?.query ?? options?.mergeQuery ?? {}),
        }
    }),
    method: 'get',
})

edit.form = editForm

/**
* @see \App\Http\Controllers\MaintenanceProjectController::update
* @see workspace/scratch/40cc43c72aeb/JaiRoadV2-Integration/app/Http/Controllers/MaintenanceProjectController.php:109
* @route '/maintenance-projects/{maintenance_project}'
*/
export const update = (args: { maintenance_project: string | number | { id: string | number } } | [maintenance_project: string | number | { id: string | number } ] | string | number | { id: string | number }, options?: RouteQueryOptions): RouteDefinition<'put'> => ({
    url: update.url(args, options),
    method: 'put',
})

update.definition = {
    methods: ["put","patch"],
    url: '/maintenance-projects/{maintenance_project}',
} satisfies RouteDefinition<["put","patch"]>

/**
* @see \App\Http\Controllers\MaintenanceProjectController::update
* @see workspace/scratch/40cc43c72aeb/JaiRoadV2-Integration/app/Http/Controllers/MaintenanceProjectController.php:109
* @route '/maintenance-projects/{maintenance_project}'
*/
update.url = (args: { maintenance_project: string | number | { id: string | number } } | [maintenance_project: string | number | { id: string | number } ] | string | number | { id: string | number }, options?: RouteQueryOptions) => {
    if (typeof args === 'string' || typeof args === 'number') {
        args = { maintenance_project: args }
    }

    if (typeof args === 'object' && !Array.isArray(args) && 'id' in args) {
        args = { maintenance_project: args.id }
    }

    if (Array.isArray(args)) {
        args = {
            maintenance_project: args[0],
        }
    }

    args = applyUrlDefaults(args)

    const parsedArgs = {
        maintenance_project: typeof args.maintenance_project === 'object'
        ? args.maintenance_project.id
        : args.maintenance_project,
    }

    return update.definition.url
            .replace('{maintenance_project}', parsedArgs.maintenance_project.toString())
            .replace(/\/+$/, '') + queryParams(options)
}

/**
* @see \App\Http\Controllers\MaintenanceProjectController::update
* @see workspace/scratch/40cc43c72aeb/JaiRoadV2-Integration/app/Http/Controllers/MaintenanceProjectController.php:109
* @route '/maintenance-projects/{maintenance_project}'
*/
update.put = (args: { maintenance_project: string | number | { id: string | number } } | [maintenance_project: string | number | { id: string | number } ] | string | number | { id: string | number }, options?: RouteQueryOptions): RouteDefinition<'put'> => ({
    url: update.url(args, options),
    method: 'put',
})

/**
* @see \App\Http\Controllers\MaintenanceProjectController::update
* @see workspace/scratch/40cc43c72aeb/JaiRoadV2-Integration/app/Http/Controllers/MaintenanceProjectController.php:109
* @route '/maintenance-projects/{maintenance_project}'
*/
update.patch = (args: { maintenance_project: string | number | { id: string | number } } | [maintenance_project: string | number | { id: string | number } ] | string | number | { id: string | number }, options?: RouteQueryOptions): RouteDefinition<'patch'> => ({
    url: update.url(args, options),
    method: 'patch',
})

/**
* @see \App\Http\Controllers\MaintenanceProjectController::update
* @see workspace/scratch/40cc43c72aeb/JaiRoadV2-Integration/app/Http/Controllers/MaintenanceProjectController.php:109
* @route '/maintenance-projects/{maintenance_project}'
*/
const updateForm = (args: { maintenance_project: string | number | { id: string | number } } | [maintenance_project: string | number | { id: string | number } ] | string | number | { id: string | number }, options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: update.url(args, {
        [options?.mergeQuery ? 'mergeQuery' : 'query']: {
            _method: 'PUT',
            ...(options?.query ?? options?.mergeQuery ?? {}),
        }
    }),
    method: 'post',
})

/**
* @see \App\Http\Controllers\MaintenanceProjectController::update
* @see workspace/scratch/40cc43c72aeb/JaiRoadV2-Integration/app/Http/Controllers/MaintenanceProjectController.php:109
* @route '/maintenance-projects/{maintenance_project}'
*/
updateForm.put = (args: { maintenance_project: string | number | { id: string | number } } | [maintenance_project: string | number | { id: string | number } ] | string | number | { id: string | number }, options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: update.url(args, {
        [options?.mergeQuery ? 'mergeQuery' : 'query']: {
            _method: 'PUT',
            ...(options?.query ?? options?.mergeQuery ?? {}),
        }
    }),
    method: 'post',
})

/**
* @see \App\Http\Controllers\MaintenanceProjectController::update
* @see workspace/scratch/40cc43c72aeb/JaiRoadV2-Integration/app/Http/Controllers/MaintenanceProjectController.php:109
* @route '/maintenance-projects/{maintenance_project}'
*/
updateForm.patch = (args: { maintenance_project: string | number | { id: string | number } } | [maintenance_project: string | number | { id: string | number } ] | string | number | { id: string | number }, options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: update.url(args, {
        [options?.mergeQuery ? 'mergeQuery' : 'query']: {
            _method: 'PATCH',
            ...(options?.query ?? options?.mergeQuery ?? {}),
        }
    }),
    method: 'post',
})

update.form = updateForm

/**
* @see \App\Http\Controllers\MaintenanceProjectController::destroy
* @see workspace/scratch/40cc43c72aeb/JaiRoadV2-Integration/app/Http/Controllers/MaintenanceProjectController.php:116
* @route '/maintenance-projects/{maintenance_project}'
*/
export const destroy = (args: { maintenance_project: string | number | { id: string | number } } | [maintenance_project: string | number | { id: string | number } ] | string | number | { id: string | number }, options?: RouteQueryOptions): RouteDefinition<'delete'> => ({
    url: destroy.url(args, options),
    method: 'delete',
})

destroy.definition = {
    methods: ["delete"],
    url: '/maintenance-projects/{maintenance_project}',
} satisfies RouteDefinition<["delete"]>

/**
* @see \App\Http\Controllers\MaintenanceProjectController::destroy
* @see workspace/scratch/40cc43c72aeb/JaiRoadV2-Integration/app/Http/Controllers/MaintenanceProjectController.php:116
* @route '/maintenance-projects/{maintenance_project}'
*/
destroy.url = (args: { maintenance_project: string | number | { id: string | number } } | [maintenance_project: string | number | { id: string | number } ] | string | number | { id: string | number }, options?: RouteQueryOptions) => {
    if (typeof args === 'string' || typeof args === 'number') {
        args = { maintenance_project: args }
    }

    if (typeof args === 'object' && !Array.isArray(args) && 'id' in args) {
        args = { maintenance_project: args.id }
    }

    if (Array.isArray(args)) {
        args = {
            maintenance_project: args[0],
        }
    }

    args = applyUrlDefaults(args)

    const parsedArgs = {
        maintenance_project: typeof args.maintenance_project === 'object'
        ? args.maintenance_project.id
        : args.maintenance_project,
    }

    return destroy.definition.url
            .replace('{maintenance_project}', parsedArgs.maintenance_project.toString())
            .replace(/\/+$/, '') + queryParams(options)
}

/**
* @see \App\Http\Controllers\MaintenanceProjectController::destroy
* @see workspace/scratch/40cc43c72aeb/JaiRoadV2-Integration/app/Http/Controllers/MaintenanceProjectController.php:116
* @route '/maintenance-projects/{maintenance_project}'
*/
destroy.delete = (args: { maintenance_project: string | number | { id: string | number } } | [maintenance_project: string | number | { id: string | number } ] | string | number | { id: string | number }, options?: RouteQueryOptions): RouteDefinition<'delete'> => ({
    url: destroy.url(args, options),
    method: 'delete',
})

/**
* @see \App\Http\Controllers\MaintenanceProjectController::destroy
* @see workspace/scratch/40cc43c72aeb/JaiRoadV2-Integration/app/Http/Controllers/MaintenanceProjectController.php:116
* @route '/maintenance-projects/{maintenance_project}'
*/
const destroyForm = (args: { maintenance_project: string | number | { id: string | number } } | [maintenance_project: string | number | { id: string | number } ] | string | number | { id: string | number }, options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: destroy.url(args, {
        [options?.mergeQuery ? 'mergeQuery' : 'query']: {
            _method: 'DELETE',
            ...(options?.query ?? options?.mergeQuery ?? {}),
        }
    }),
    method: 'post',
})

/**
* @see \App\Http\Controllers\MaintenanceProjectController::destroy
* @see workspace/scratch/40cc43c72aeb/JaiRoadV2-Integration/app/Http/Controllers/MaintenanceProjectController.php:116
* @route '/maintenance-projects/{maintenance_project}'
*/
destroyForm.delete = (args: { maintenance_project: string | number | { id: string | number } } | [maintenance_project: string | number | { id: string | number } ] | string | number | { id: string | number }, options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: destroy.url(args, {
        [options?.mergeQuery ? 'mergeQuery' : 'query']: {
            _method: 'DELETE',
            ...(options?.query ?? options?.mergeQuery ?? {}),
        }
    }),
    method: 'post',
})

destroy.form = destroyForm

const MaintenanceProjectController = { bulkDestroy, index, create, store, show, edit, update, destroy }

export default MaintenanceProjectController