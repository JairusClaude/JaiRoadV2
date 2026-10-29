import { queryParams, type RouteQueryOptions, type RouteDefinition, type RouteFormDefinition, applyUrlDefaults } from './../../../../wayfinder'
/**
* @see \App\Http\Controllers\MonthlyUpdateController::index
* @see workspace/scratch/40cc43c72aeb/JaiRoadV2-Integration/app/Http/Controllers/MonthlyUpdateController.php:16
* @route '/monthly-updates'
*/
export const index = (options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: index.url(options),
    method: 'get',
})

index.definition = {
    methods: ["get","head"],
    url: '/monthly-updates',
} satisfies RouteDefinition<["get","head"]>

/**
* @see \App\Http\Controllers\MonthlyUpdateController::index
* @see workspace/scratch/40cc43c72aeb/JaiRoadV2-Integration/app/Http/Controllers/MonthlyUpdateController.php:16
* @route '/monthly-updates'
*/
index.url = (options?: RouteQueryOptions) => {
    return index.definition.url + queryParams(options)
}

/**
* @see \App\Http\Controllers\MonthlyUpdateController::index
* @see workspace/scratch/40cc43c72aeb/JaiRoadV2-Integration/app/Http/Controllers/MonthlyUpdateController.php:16
* @route '/monthly-updates'
*/
index.get = (options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: index.url(options),
    method: 'get',
})

/**
* @see \App\Http\Controllers\MonthlyUpdateController::index
* @see workspace/scratch/40cc43c72aeb/JaiRoadV2-Integration/app/Http/Controllers/MonthlyUpdateController.php:16
* @route '/monthly-updates'
*/
index.head = (options?: RouteQueryOptions): RouteDefinition<'head'> => ({
    url: index.url(options),
    method: 'head',
})

/**
* @see \App\Http\Controllers\MonthlyUpdateController::index
* @see workspace/scratch/40cc43c72aeb/JaiRoadV2-Integration/app/Http/Controllers/MonthlyUpdateController.php:16
* @route '/monthly-updates'
*/
const indexForm = (options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
    action: index.url(options),
    method: 'get',
})

/**
* @see \App\Http\Controllers\MonthlyUpdateController::index
* @see workspace/scratch/40cc43c72aeb/JaiRoadV2-Integration/app/Http/Controllers/MonthlyUpdateController.php:16
* @route '/monthly-updates'
*/
indexForm.get = (options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
    action: index.url(options),
    method: 'get',
})

/**
* @see \App\Http\Controllers\MonthlyUpdateController::index
* @see workspace/scratch/40cc43c72aeb/JaiRoadV2-Integration/app/Http/Controllers/MonthlyUpdateController.php:16
* @route '/monthly-updates'
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
* @see \App\Http\Controllers\MonthlyUpdateController::create
* @see workspace/scratch/40cc43c72aeb/JaiRoadV2-Integration/app/Http/Controllers/MonthlyUpdateController.php:61
* @route '/monthly-updates/create'
*/
export const create = (options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: create.url(options),
    method: 'get',
})

create.definition = {
    methods: ["get","head"],
    url: '/monthly-updates/create',
} satisfies RouteDefinition<["get","head"]>

/**
* @see \App\Http\Controllers\MonthlyUpdateController::create
* @see workspace/scratch/40cc43c72aeb/JaiRoadV2-Integration/app/Http/Controllers/MonthlyUpdateController.php:61
* @route '/monthly-updates/create'
*/
create.url = (options?: RouteQueryOptions) => {
    return create.definition.url + queryParams(options)
}

/**
* @see \App\Http\Controllers\MonthlyUpdateController::create
* @see workspace/scratch/40cc43c72aeb/JaiRoadV2-Integration/app/Http/Controllers/MonthlyUpdateController.php:61
* @route '/monthly-updates/create'
*/
create.get = (options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: create.url(options),
    method: 'get',
})

/**
* @see \App\Http\Controllers\MonthlyUpdateController::create
* @see workspace/scratch/40cc43c72aeb/JaiRoadV2-Integration/app/Http/Controllers/MonthlyUpdateController.php:61
* @route '/monthly-updates/create'
*/
create.head = (options?: RouteQueryOptions): RouteDefinition<'head'> => ({
    url: create.url(options),
    method: 'head',
})

/**
* @see \App\Http\Controllers\MonthlyUpdateController::create
* @see workspace/scratch/40cc43c72aeb/JaiRoadV2-Integration/app/Http/Controllers/MonthlyUpdateController.php:61
* @route '/monthly-updates/create'
*/
const createForm = (options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
    action: create.url(options),
    method: 'get',
})

/**
* @see \App\Http\Controllers\MonthlyUpdateController::create
* @see workspace/scratch/40cc43c72aeb/JaiRoadV2-Integration/app/Http/Controllers/MonthlyUpdateController.php:61
* @route '/monthly-updates/create'
*/
createForm.get = (options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
    action: create.url(options),
    method: 'get',
})

/**
* @see \App\Http\Controllers\MonthlyUpdateController::create
* @see workspace/scratch/40cc43c72aeb/JaiRoadV2-Integration/app/Http/Controllers/MonthlyUpdateController.php:61
* @route '/monthly-updates/create'
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
* @see \App\Http\Controllers\MonthlyUpdateController::store
* @see workspace/scratch/40cc43c72aeb/JaiRoadV2-Integration/app/Http/Controllers/MonthlyUpdateController.php:66
* @route '/monthly-updates'
*/
export const store = (options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: store.url(options),
    method: 'post',
})

store.definition = {
    methods: ["post"],
    url: '/monthly-updates',
} satisfies RouteDefinition<["post"]>

/**
* @see \App\Http\Controllers\MonthlyUpdateController::store
* @see workspace/scratch/40cc43c72aeb/JaiRoadV2-Integration/app/Http/Controllers/MonthlyUpdateController.php:66
* @route '/monthly-updates'
*/
store.url = (options?: RouteQueryOptions) => {
    return store.definition.url + queryParams(options)
}

/**
* @see \App\Http\Controllers\MonthlyUpdateController::store
* @see workspace/scratch/40cc43c72aeb/JaiRoadV2-Integration/app/Http/Controllers/MonthlyUpdateController.php:66
* @route '/monthly-updates'
*/
store.post = (options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: store.url(options),
    method: 'post',
})

/**
* @see \App\Http\Controllers\MonthlyUpdateController::store
* @see workspace/scratch/40cc43c72aeb/JaiRoadV2-Integration/app/Http/Controllers/MonthlyUpdateController.php:66
* @route '/monthly-updates'
*/
const storeForm = (options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: store.url(options),
    method: 'post',
})

/**
* @see \App\Http\Controllers\MonthlyUpdateController::store
* @see workspace/scratch/40cc43c72aeb/JaiRoadV2-Integration/app/Http/Controllers/MonthlyUpdateController.php:66
* @route '/monthly-updates'
*/
storeForm.post = (options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: store.url(options),
    method: 'post',
})

store.form = storeForm

/**
* @see \App\Http\Controllers\MonthlyUpdateController::show
* @see workspace/scratch/40cc43c72aeb/JaiRoadV2-Integration/app/Http/Controllers/MonthlyUpdateController.php:75
* @route '/monthly-updates/{monthly_update}'
*/
export const show = (args: { monthly_update: string | number | { id: string | number } } | [monthly_update: string | number | { id: string | number } ] | string | number | { id: string | number }, options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: show.url(args, options),
    method: 'get',
})

show.definition = {
    methods: ["get","head"],
    url: '/monthly-updates/{monthly_update}',
} satisfies RouteDefinition<["get","head"]>

/**
* @see \App\Http\Controllers\MonthlyUpdateController::show
* @see workspace/scratch/40cc43c72aeb/JaiRoadV2-Integration/app/Http/Controllers/MonthlyUpdateController.php:75
* @route '/monthly-updates/{monthly_update}'
*/
show.url = (args: { monthly_update: string | number | { id: string | number } } | [monthly_update: string | number | { id: string | number } ] | string | number | { id: string | number }, options?: RouteQueryOptions) => {
    if (typeof args === 'string' || typeof args === 'number') {
        args = { monthly_update: args }
    }

    if (typeof args === 'object' && !Array.isArray(args) && 'id' in args) {
        args = { monthly_update: args.id }
    }

    if (Array.isArray(args)) {
        args = {
            monthly_update: args[0],
        }
    }

    args = applyUrlDefaults(args)

    const parsedArgs = {
        monthly_update: typeof args.monthly_update === 'object'
        ? args.monthly_update.id
        : args.monthly_update,
    }

    return show.definition.url
            .replace('{monthly_update}', parsedArgs.monthly_update.toString())
            .replace(/\/+$/, '') + queryParams(options)
}

/**
* @see \App\Http\Controllers\MonthlyUpdateController::show
* @see workspace/scratch/40cc43c72aeb/JaiRoadV2-Integration/app/Http/Controllers/MonthlyUpdateController.php:75
* @route '/monthly-updates/{monthly_update}'
*/
show.get = (args: { monthly_update: string | number | { id: string | number } } | [monthly_update: string | number | { id: string | number } ] | string | number | { id: string | number }, options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: show.url(args, options),
    method: 'get',
})

/**
* @see \App\Http\Controllers\MonthlyUpdateController::show
* @see workspace/scratch/40cc43c72aeb/JaiRoadV2-Integration/app/Http/Controllers/MonthlyUpdateController.php:75
* @route '/monthly-updates/{monthly_update}'
*/
show.head = (args: { monthly_update: string | number | { id: string | number } } | [monthly_update: string | number | { id: string | number } ] | string | number | { id: string | number }, options?: RouteQueryOptions): RouteDefinition<'head'> => ({
    url: show.url(args, options),
    method: 'head',
})

/**
* @see \App\Http\Controllers\MonthlyUpdateController::show
* @see workspace/scratch/40cc43c72aeb/JaiRoadV2-Integration/app/Http/Controllers/MonthlyUpdateController.php:75
* @route '/monthly-updates/{monthly_update}'
*/
const showForm = (args: { monthly_update: string | number | { id: string | number } } | [monthly_update: string | number | { id: string | number } ] | string | number | { id: string | number }, options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
    action: show.url(args, options),
    method: 'get',
})

/**
* @see \App\Http\Controllers\MonthlyUpdateController::show
* @see workspace/scratch/40cc43c72aeb/JaiRoadV2-Integration/app/Http/Controllers/MonthlyUpdateController.php:75
* @route '/monthly-updates/{monthly_update}'
*/
showForm.get = (args: { monthly_update: string | number | { id: string | number } } | [monthly_update: string | number | { id: string | number } ] | string | number | { id: string | number }, options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
    action: show.url(args, options),
    method: 'get',
})

/**
* @see \App\Http\Controllers\MonthlyUpdateController::show
* @see workspace/scratch/40cc43c72aeb/JaiRoadV2-Integration/app/Http/Controllers/MonthlyUpdateController.php:75
* @route '/monthly-updates/{monthly_update}'
*/
showForm.head = (args: { monthly_update: string | number | { id: string | number } } | [monthly_update: string | number | { id: string | number } ] | string | number | { id: string | number }, options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
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
* @see \App\Http\Controllers\MonthlyUpdateController::edit
* @see workspace/scratch/40cc43c72aeb/JaiRoadV2-Integration/app/Http/Controllers/MonthlyUpdateController.php:80
* @route '/monthly-updates/{monthly_update}/edit'
*/
export const edit = (args: { monthly_update: string | number | { id: string | number } } | [monthly_update: string | number | { id: string | number } ] | string | number | { id: string | number }, options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: edit.url(args, options),
    method: 'get',
})

edit.definition = {
    methods: ["get","head"],
    url: '/monthly-updates/{monthly_update}/edit',
} satisfies RouteDefinition<["get","head"]>

/**
* @see \App\Http\Controllers\MonthlyUpdateController::edit
* @see workspace/scratch/40cc43c72aeb/JaiRoadV2-Integration/app/Http/Controllers/MonthlyUpdateController.php:80
* @route '/monthly-updates/{monthly_update}/edit'
*/
edit.url = (args: { monthly_update: string | number | { id: string | number } } | [monthly_update: string | number | { id: string | number } ] | string | number | { id: string | number }, options?: RouteQueryOptions) => {
    if (typeof args === 'string' || typeof args === 'number') {
        args = { monthly_update: args }
    }

    if (typeof args === 'object' && !Array.isArray(args) && 'id' in args) {
        args = { monthly_update: args.id }
    }

    if (Array.isArray(args)) {
        args = {
            monthly_update: args[0],
        }
    }

    args = applyUrlDefaults(args)

    const parsedArgs = {
        monthly_update: typeof args.monthly_update === 'object'
        ? args.monthly_update.id
        : args.monthly_update,
    }

    return edit.definition.url
            .replace('{monthly_update}', parsedArgs.monthly_update.toString())
            .replace(/\/+$/, '') + queryParams(options)
}

/**
* @see \App\Http\Controllers\MonthlyUpdateController::edit
* @see workspace/scratch/40cc43c72aeb/JaiRoadV2-Integration/app/Http/Controllers/MonthlyUpdateController.php:80
* @route '/monthly-updates/{monthly_update}/edit'
*/
edit.get = (args: { monthly_update: string | number | { id: string | number } } | [monthly_update: string | number | { id: string | number } ] | string | number | { id: string | number }, options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: edit.url(args, options),
    method: 'get',
})

/**
* @see \App\Http\Controllers\MonthlyUpdateController::edit
* @see workspace/scratch/40cc43c72aeb/JaiRoadV2-Integration/app/Http/Controllers/MonthlyUpdateController.php:80
* @route '/monthly-updates/{monthly_update}/edit'
*/
edit.head = (args: { monthly_update: string | number | { id: string | number } } | [monthly_update: string | number | { id: string | number } ] | string | number | { id: string | number }, options?: RouteQueryOptions): RouteDefinition<'head'> => ({
    url: edit.url(args, options),
    method: 'head',
})

/**
* @see \App\Http\Controllers\MonthlyUpdateController::edit
* @see workspace/scratch/40cc43c72aeb/JaiRoadV2-Integration/app/Http/Controllers/MonthlyUpdateController.php:80
* @route '/monthly-updates/{monthly_update}/edit'
*/
const editForm = (args: { monthly_update: string | number | { id: string | number } } | [monthly_update: string | number | { id: string | number } ] | string | number | { id: string | number }, options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
    action: edit.url(args, options),
    method: 'get',
})

/**
* @see \App\Http\Controllers\MonthlyUpdateController::edit
* @see workspace/scratch/40cc43c72aeb/JaiRoadV2-Integration/app/Http/Controllers/MonthlyUpdateController.php:80
* @route '/monthly-updates/{monthly_update}/edit'
*/
editForm.get = (args: { monthly_update: string | number | { id: string | number } } | [monthly_update: string | number | { id: string | number } ] | string | number | { id: string | number }, options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
    action: edit.url(args, options),
    method: 'get',
})

/**
* @see \App\Http\Controllers\MonthlyUpdateController::edit
* @see workspace/scratch/40cc43c72aeb/JaiRoadV2-Integration/app/Http/Controllers/MonthlyUpdateController.php:80
* @route '/monthly-updates/{monthly_update}/edit'
*/
editForm.head = (args: { monthly_update: string | number | { id: string | number } } | [monthly_update: string | number | { id: string | number } ] | string | number | { id: string | number }, options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
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
* @see \App\Http\Controllers\MonthlyUpdateController::update
* @see workspace/scratch/40cc43c72aeb/JaiRoadV2-Integration/app/Http/Controllers/MonthlyUpdateController.php:85
* @route '/monthly-updates/{monthly_update}'
*/
export const update = (args: { monthly_update: string | number | { id: string | number } } | [monthly_update: string | number | { id: string | number } ] | string | number | { id: string | number }, options?: RouteQueryOptions): RouteDefinition<'put'> => ({
    url: update.url(args, options),
    method: 'put',
})

update.definition = {
    methods: ["put","patch"],
    url: '/monthly-updates/{monthly_update}',
} satisfies RouteDefinition<["put","patch"]>

/**
* @see \App\Http\Controllers\MonthlyUpdateController::update
* @see workspace/scratch/40cc43c72aeb/JaiRoadV2-Integration/app/Http/Controllers/MonthlyUpdateController.php:85
* @route '/monthly-updates/{monthly_update}'
*/
update.url = (args: { monthly_update: string | number | { id: string | number } } | [monthly_update: string | number | { id: string | number } ] | string | number | { id: string | number }, options?: RouteQueryOptions) => {
    if (typeof args === 'string' || typeof args === 'number') {
        args = { monthly_update: args }
    }

    if (typeof args === 'object' && !Array.isArray(args) && 'id' in args) {
        args = { monthly_update: args.id }
    }

    if (Array.isArray(args)) {
        args = {
            monthly_update: args[0],
        }
    }

    args = applyUrlDefaults(args)

    const parsedArgs = {
        monthly_update: typeof args.monthly_update === 'object'
        ? args.monthly_update.id
        : args.monthly_update,
    }

    return update.definition.url
            .replace('{monthly_update}', parsedArgs.monthly_update.toString())
            .replace(/\/+$/, '') + queryParams(options)
}

/**
* @see \App\Http\Controllers\MonthlyUpdateController::update
* @see workspace/scratch/40cc43c72aeb/JaiRoadV2-Integration/app/Http/Controllers/MonthlyUpdateController.php:85
* @route '/monthly-updates/{monthly_update}'
*/
update.put = (args: { monthly_update: string | number | { id: string | number } } | [monthly_update: string | number | { id: string | number } ] | string | number | { id: string | number }, options?: RouteQueryOptions): RouteDefinition<'put'> => ({
    url: update.url(args, options),
    method: 'put',
})

/**
* @see \App\Http\Controllers\MonthlyUpdateController::update
* @see workspace/scratch/40cc43c72aeb/JaiRoadV2-Integration/app/Http/Controllers/MonthlyUpdateController.php:85
* @route '/monthly-updates/{monthly_update}'
*/
update.patch = (args: { monthly_update: string | number | { id: string | number } } | [monthly_update: string | number | { id: string | number } ] | string | number | { id: string | number }, options?: RouteQueryOptions): RouteDefinition<'patch'> => ({
    url: update.url(args, options),
    method: 'patch',
})

/**
* @see \App\Http\Controllers\MonthlyUpdateController::update
* @see workspace/scratch/40cc43c72aeb/JaiRoadV2-Integration/app/Http/Controllers/MonthlyUpdateController.php:85
* @route '/monthly-updates/{monthly_update}'
*/
const updateForm = (args: { monthly_update: string | number | { id: string | number } } | [monthly_update: string | number | { id: string | number } ] | string | number | { id: string | number }, options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: update.url(args, {
        [options?.mergeQuery ? 'mergeQuery' : 'query']: {
            _method: 'PUT',
            ...(options?.query ?? options?.mergeQuery ?? {}),
        }
    }),
    method: 'post',
})

/**
* @see \App\Http\Controllers\MonthlyUpdateController::update
* @see workspace/scratch/40cc43c72aeb/JaiRoadV2-Integration/app/Http/Controllers/MonthlyUpdateController.php:85
* @route '/monthly-updates/{monthly_update}'
*/
updateForm.put = (args: { monthly_update: string | number | { id: string | number } } | [monthly_update: string | number | { id: string | number } ] | string | number | { id: string | number }, options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: update.url(args, {
        [options?.mergeQuery ? 'mergeQuery' : 'query']: {
            _method: 'PUT',
            ...(options?.query ?? options?.mergeQuery ?? {}),
        }
    }),
    method: 'post',
})

/**
* @see \App\Http\Controllers\MonthlyUpdateController::update
* @see workspace/scratch/40cc43c72aeb/JaiRoadV2-Integration/app/Http/Controllers/MonthlyUpdateController.php:85
* @route '/monthly-updates/{monthly_update}'
*/
updateForm.patch = (args: { monthly_update: string | number | { id: string | number } } | [monthly_update: string | number | { id: string | number } ] | string | number | { id: string | number }, options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
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
* @see \App\Http\Controllers\MonthlyUpdateController::destroy
* @see workspace/scratch/40cc43c72aeb/JaiRoadV2-Integration/app/Http/Controllers/MonthlyUpdateController.php:98
* @route '/monthly-updates/{monthly_update}'
*/
export const destroy = (args: { monthly_update: string | number | { id: string | number } } | [monthly_update: string | number | { id: string | number } ] | string | number | { id: string | number }, options?: RouteQueryOptions): RouteDefinition<'delete'> => ({
    url: destroy.url(args, options),
    method: 'delete',
})

destroy.definition = {
    methods: ["delete"],
    url: '/monthly-updates/{monthly_update}',
} satisfies RouteDefinition<["delete"]>

/**
* @see \App\Http\Controllers\MonthlyUpdateController::destroy
* @see workspace/scratch/40cc43c72aeb/JaiRoadV2-Integration/app/Http/Controllers/MonthlyUpdateController.php:98
* @route '/monthly-updates/{monthly_update}'
*/
destroy.url = (args: { monthly_update: string | number | { id: string | number } } | [monthly_update: string | number | { id: string | number } ] | string | number | { id: string | number }, options?: RouteQueryOptions) => {
    if (typeof args === 'string' || typeof args === 'number') {
        args = { monthly_update: args }
    }

    if (typeof args === 'object' && !Array.isArray(args) && 'id' in args) {
        args = { monthly_update: args.id }
    }

    if (Array.isArray(args)) {
        args = {
            monthly_update: args[0],
        }
    }

    args = applyUrlDefaults(args)

    const parsedArgs = {
        monthly_update: typeof args.monthly_update === 'object'
        ? args.monthly_update.id
        : args.monthly_update,
    }

    return destroy.definition.url
            .replace('{monthly_update}', parsedArgs.monthly_update.toString())
            .replace(/\/+$/, '') + queryParams(options)
}

/**
* @see \App\Http\Controllers\MonthlyUpdateController::destroy
* @see workspace/scratch/40cc43c72aeb/JaiRoadV2-Integration/app/Http/Controllers/MonthlyUpdateController.php:98
* @route '/monthly-updates/{monthly_update}'
*/
destroy.delete = (args: { monthly_update: string | number | { id: string | number } } | [monthly_update: string | number | { id: string | number } ] | string | number | { id: string | number }, options?: RouteQueryOptions): RouteDefinition<'delete'> => ({
    url: destroy.url(args, options),
    method: 'delete',
})

/**
* @see \App\Http\Controllers\MonthlyUpdateController::destroy
* @see workspace/scratch/40cc43c72aeb/JaiRoadV2-Integration/app/Http/Controllers/MonthlyUpdateController.php:98
* @route '/monthly-updates/{monthly_update}'
*/
const destroyForm = (args: { monthly_update: string | number | { id: string | number } } | [monthly_update: string | number | { id: string | number } ] | string | number | { id: string | number }, options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: destroy.url(args, {
        [options?.mergeQuery ? 'mergeQuery' : 'query']: {
            _method: 'DELETE',
            ...(options?.query ?? options?.mergeQuery ?? {}),
        }
    }),
    method: 'post',
})

/**
* @see \App\Http\Controllers\MonthlyUpdateController::destroy
* @see workspace/scratch/40cc43c72aeb/JaiRoadV2-Integration/app/Http/Controllers/MonthlyUpdateController.php:98
* @route '/monthly-updates/{monthly_update}'
*/
destroyForm.delete = (args: { monthly_update: string | number | { id: string | number } } | [monthly_update: string | number | { id: string | number } ] | string | number | { id: string | number }, options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: destroy.url(args, {
        [options?.mergeQuery ? 'mergeQuery' : 'query']: {
            _method: 'DELETE',
            ...(options?.query ?? options?.mergeQuery ?? {}),
        }
    }),
    method: 'post',
})

destroy.form = destroyForm

const MonthlyUpdateController = { index, create, store, show, edit, update, destroy }

export default MonthlyUpdateController