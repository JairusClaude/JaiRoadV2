import { queryParams, type RouteQueryOptions, type RouteDefinition, type RouteFormDefinition, applyUrlDefaults } from './../../wayfinder'
/**
* @see \App\Http\Controllers\EngineerController::index
* @see workspace/scratch/40cc43c72aeb/JaiRoadV2-Integration/app/Http/Controllers/EngineerController.php:16
* @route '/engineers'
*/
export const index = (options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: index.url(options),
    method: 'get',
})

index.definition = {
    methods: ["get","head"],
    url: '/engineers',
} satisfies RouteDefinition<["get","head"]>

/**
* @see \App\Http\Controllers\EngineerController::index
* @see workspace/scratch/40cc43c72aeb/JaiRoadV2-Integration/app/Http/Controllers/EngineerController.php:16
* @route '/engineers'
*/
index.url = (options?: RouteQueryOptions) => {
    return index.definition.url + queryParams(options)
}

/**
* @see \App\Http\Controllers\EngineerController::index
* @see workspace/scratch/40cc43c72aeb/JaiRoadV2-Integration/app/Http/Controllers/EngineerController.php:16
* @route '/engineers'
*/
index.get = (options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: index.url(options),
    method: 'get',
})

/**
* @see \App\Http\Controllers\EngineerController::index
* @see workspace/scratch/40cc43c72aeb/JaiRoadV2-Integration/app/Http/Controllers/EngineerController.php:16
* @route '/engineers'
*/
index.head = (options?: RouteQueryOptions): RouteDefinition<'head'> => ({
    url: index.url(options),
    method: 'head',
})

/**
* @see \App\Http\Controllers\EngineerController::index
* @see workspace/scratch/40cc43c72aeb/JaiRoadV2-Integration/app/Http/Controllers/EngineerController.php:16
* @route '/engineers'
*/
const indexForm = (options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
    action: index.url(options),
    method: 'get',
})

/**
* @see \App\Http\Controllers\EngineerController::index
* @see workspace/scratch/40cc43c72aeb/JaiRoadV2-Integration/app/Http/Controllers/EngineerController.php:16
* @route '/engineers'
*/
indexForm.get = (options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
    action: index.url(options),
    method: 'get',
})

/**
* @see \App\Http\Controllers\EngineerController::index
* @see workspace/scratch/40cc43c72aeb/JaiRoadV2-Integration/app/Http/Controllers/EngineerController.php:16
* @route '/engineers'
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
* @see \App\Http\Controllers\EngineerController::create
* @see workspace/scratch/40cc43c72aeb/JaiRoadV2-Integration/app/Http/Controllers/EngineerController.php:69
* @route '/engineers/create'
*/
export const create = (options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: create.url(options),
    method: 'get',
})

create.definition = {
    methods: ["get","head"],
    url: '/engineers/create',
} satisfies RouteDefinition<["get","head"]>

/**
* @see \App\Http\Controllers\EngineerController::create
* @see workspace/scratch/40cc43c72aeb/JaiRoadV2-Integration/app/Http/Controllers/EngineerController.php:69
* @route '/engineers/create'
*/
create.url = (options?: RouteQueryOptions) => {
    return create.definition.url + queryParams(options)
}

/**
* @see \App\Http\Controllers\EngineerController::create
* @see workspace/scratch/40cc43c72aeb/JaiRoadV2-Integration/app/Http/Controllers/EngineerController.php:69
* @route '/engineers/create'
*/
create.get = (options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: create.url(options),
    method: 'get',
})

/**
* @see \App\Http\Controllers\EngineerController::create
* @see workspace/scratch/40cc43c72aeb/JaiRoadV2-Integration/app/Http/Controllers/EngineerController.php:69
* @route '/engineers/create'
*/
create.head = (options?: RouteQueryOptions): RouteDefinition<'head'> => ({
    url: create.url(options),
    method: 'head',
})

/**
* @see \App\Http\Controllers\EngineerController::create
* @see workspace/scratch/40cc43c72aeb/JaiRoadV2-Integration/app/Http/Controllers/EngineerController.php:69
* @route '/engineers/create'
*/
const createForm = (options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
    action: create.url(options),
    method: 'get',
})

/**
* @see \App\Http\Controllers\EngineerController::create
* @see workspace/scratch/40cc43c72aeb/JaiRoadV2-Integration/app/Http/Controllers/EngineerController.php:69
* @route '/engineers/create'
*/
createForm.get = (options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
    action: create.url(options),
    method: 'get',
})

/**
* @see \App\Http\Controllers\EngineerController::create
* @see workspace/scratch/40cc43c72aeb/JaiRoadV2-Integration/app/Http/Controllers/EngineerController.php:69
* @route '/engineers/create'
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
* @see \App\Http\Controllers\EngineerController::store
* @see workspace/scratch/40cc43c72aeb/JaiRoadV2-Integration/app/Http/Controllers/EngineerController.php:74
* @route '/engineers'
*/
export const store = (options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: store.url(options),
    method: 'post',
})

store.definition = {
    methods: ["post"],
    url: '/engineers',
} satisfies RouteDefinition<["post"]>

/**
* @see \App\Http\Controllers\EngineerController::store
* @see workspace/scratch/40cc43c72aeb/JaiRoadV2-Integration/app/Http/Controllers/EngineerController.php:74
* @route '/engineers'
*/
store.url = (options?: RouteQueryOptions) => {
    return store.definition.url + queryParams(options)
}

/**
* @see \App\Http\Controllers\EngineerController::store
* @see workspace/scratch/40cc43c72aeb/JaiRoadV2-Integration/app/Http/Controllers/EngineerController.php:74
* @route '/engineers'
*/
store.post = (options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: store.url(options),
    method: 'post',
})

/**
* @see \App\Http\Controllers\EngineerController::store
* @see workspace/scratch/40cc43c72aeb/JaiRoadV2-Integration/app/Http/Controllers/EngineerController.php:74
* @route '/engineers'
*/
const storeForm = (options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: store.url(options),
    method: 'post',
})

/**
* @see \App\Http\Controllers\EngineerController::store
* @see workspace/scratch/40cc43c72aeb/JaiRoadV2-Integration/app/Http/Controllers/EngineerController.php:74
* @route '/engineers'
*/
storeForm.post = (options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: store.url(options),
    method: 'post',
})

store.form = storeForm

/**
* @see \App\Http\Controllers\EngineerController::show
* @see workspace/scratch/40cc43c72aeb/JaiRoadV2-Integration/app/Http/Controllers/EngineerController.php:82
* @route '/engineers/{engineer}'
*/
export const show = (args: { engineer: string | number | { id: string | number } } | [engineer: string | number | { id: string | number } ] | string | number | { id: string | number }, options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: show.url(args, options),
    method: 'get',
})

show.definition = {
    methods: ["get","head"],
    url: '/engineers/{engineer}',
} satisfies RouteDefinition<["get","head"]>

/**
* @see \App\Http\Controllers\EngineerController::show
* @see workspace/scratch/40cc43c72aeb/JaiRoadV2-Integration/app/Http/Controllers/EngineerController.php:82
* @route '/engineers/{engineer}'
*/
show.url = (args: { engineer: string | number | { id: string | number } } | [engineer: string | number | { id: string | number } ] | string | number | { id: string | number }, options?: RouteQueryOptions) => {
    if (typeof args === 'string' || typeof args === 'number') {
        args = { engineer: args }
    }

    if (typeof args === 'object' && !Array.isArray(args) && 'id' in args) {
        args = { engineer: args.id }
    }

    if (Array.isArray(args)) {
        args = {
            engineer: args[0],
        }
    }

    args = applyUrlDefaults(args)

    const parsedArgs = {
        engineer: typeof args.engineer === 'object'
        ? args.engineer.id
        : args.engineer,
    }

    return show.definition.url
            .replace('{engineer}', parsedArgs.engineer.toString())
            .replace(/\/+$/, '') + queryParams(options)
}

/**
* @see \App\Http\Controllers\EngineerController::show
* @see workspace/scratch/40cc43c72aeb/JaiRoadV2-Integration/app/Http/Controllers/EngineerController.php:82
* @route '/engineers/{engineer}'
*/
show.get = (args: { engineer: string | number | { id: string | number } } | [engineer: string | number | { id: string | number } ] | string | number | { id: string | number }, options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: show.url(args, options),
    method: 'get',
})

/**
* @see \App\Http\Controllers\EngineerController::show
* @see workspace/scratch/40cc43c72aeb/JaiRoadV2-Integration/app/Http/Controllers/EngineerController.php:82
* @route '/engineers/{engineer}'
*/
show.head = (args: { engineer: string | number | { id: string | number } } | [engineer: string | number | { id: string | number } ] | string | number | { id: string | number }, options?: RouteQueryOptions): RouteDefinition<'head'> => ({
    url: show.url(args, options),
    method: 'head',
})

/**
* @see \App\Http\Controllers\EngineerController::show
* @see workspace/scratch/40cc43c72aeb/JaiRoadV2-Integration/app/Http/Controllers/EngineerController.php:82
* @route '/engineers/{engineer}'
*/
const showForm = (args: { engineer: string | number | { id: string | number } } | [engineer: string | number | { id: string | number } ] | string | number | { id: string | number }, options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
    action: show.url(args, options),
    method: 'get',
})

/**
* @see \App\Http\Controllers\EngineerController::show
* @see workspace/scratch/40cc43c72aeb/JaiRoadV2-Integration/app/Http/Controllers/EngineerController.php:82
* @route '/engineers/{engineer}'
*/
showForm.get = (args: { engineer: string | number | { id: string | number } } | [engineer: string | number | { id: string | number } ] | string | number | { id: string | number }, options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
    action: show.url(args, options),
    method: 'get',
})

/**
* @see \App\Http\Controllers\EngineerController::show
* @see workspace/scratch/40cc43c72aeb/JaiRoadV2-Integration/app/Http/Controllers/EngineerController.php:82
* @route '/engineers/{engineer}'
*/
showForm.head = (args: { engineer: string | number | { id: string | number } } | [engineer: string | number | { id: string | number } ] | string | number | { id: string | number }, options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
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
* @see \App\Http\Controllers\EngineerController::edit
* @see workspace/scratch/40cc43c72aeb/JaiRoadV2-Integration/app/Http/Controllers/EngineerController.php:87
* @route '/engineers/{engineer}/edit'
*/
export const edit = (args: { engineer: string | number | { id: string | number } } | [engineer: string | number | { id: string | number } ] | string | number | { id: string | number }, options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: edit.url(args, options),
    method: 'get',
})

edit.definition = {
    methods: ["get","head"],
    url: '/engineers/{engineer}/edit',
} satisfies RouteDefinition<["get","head"]>

/**
* @see \App\Http\Controllers\EngineerController::edit
* @see workspace/scratch/40cc43c72aeb/JaiRoadV2-Integration/app/Http/Controllers/EngineerController.php:87
* @route '/engineers/{engineer}/edit'
*/
edit.url = (args: { engineer: string | number | { id: string | number } } | [engineer: string | number | { id: string | number } ] | string | number | { id: string | number }, options?: RouteQueryOptions) => {
    if (typeof args === 'string' || typeof args === 'number') {
        args = { engineer: args }
    }

    if (typeof args === 'object' && !Array.isArray(args) && 'id' in args) {
        args = { engineer: args.id }
    }

    if (Array.isArray(args)) {
        args = {
            engineer: args[0],
        }
    }

    args = applyUrlDefaults(args)

    const parsedArgs = {
        engineer: typeof args.engineer === 'object'
        ? args.engineer.id
        : args.engineer,
    }

    return edit.definition.url
            .replace('{engineer}', parsedArgs.engineer.toString())
            .replace(/\/+$/, '') + queryParams(options)
}

/**
* @see \App\Http\Controllers\EngineerController::edit
* @see workspace/scratch/40cc43c72aeb/JaiRoadV2-Integration/app/Http/Controllers/EngineerController.php:87
* @route '/engineers/{engineer}/edit'
*/
edit.get = (args: { engineer: string | number | { id: string | number } } | [engineer: string | number | { id: string | number } ] | string | number | { id: string | number }, options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: edit.url(args, options),
    method: 'get',
})

/**
* @see \App\Http\Controllers\EngineerController::edit
* @see workspace/scratch/40cc43c72aeb/JaiRoadV2-Integration/app/Http/Controllers/EngineerController.php:87
* @route '/engineers/{engineer}/edit'
*/
edit.head = (args: { engineer: string | number | { id: string | number } } | [engineer: string | number | { id: string | number } ] | string | number | { id: string | number }, options?: RouteQueryOptions): RouteDefinition<'head'> => ({
    url: edit.url(args, options),
    method: 'head',
})

/**
* @see \App\Http\Controllers\EngineerController::edit
* @see workspace/scratch/40cc43c72aeb/JaiRoadV2-Integration/app/Http/Controllers/EngineerController.php:87
* @route '/engineers/{engineer}/edit'
*/
const editForm = (args: { engineer: string | number | { id: string | number } } | [engineer: string | number | { id: string | number } ] | string | number | { id: string | number }, options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
    action: edit.url(args, options),
    method: 'get',
})

/**
* @see \App\Http\Controllers\EngineerController::edit
* @see workspace/scratch/40cc43c72aeb/JaiRoadV2-Integration/app/Http/Controllers/EngineerController.php:87
* @route '/engineers/{engineer}/edit'
*/
editForm.get = (args: { engineer: string | number | { id: string | number } } | [engineer: string | number | { id: string | number } ] | string | number | { id: string | number }, options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
    action: edit.url(args, options),
    method: 'get',
})

/**
* @see \App\Http\Controllers\EngineerController::edit
* @see workspace/scratch/40cc43c72aeb/JaiRoadV2-Integration/app/Http/Controllers/EngineerController.php:87
* @route '/engineers/{engineer}/edit'
*/
editForm.head = (args: { engineer: string | number | { id: string | number } } | [engineer: string | number | { id: string | number } ] | string | number | { id: string | number }, options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
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
* @see \App\Http\Controllers\EngineerController::update
* @see workspace/scratch/40cc43c72aeb/JaiRoadV2-Integration/app/Http/Controllers/EngineerController.php:92
* @route '/engineers/{engineer}'
*/
export const update = (args: { engineer: string | number | { id: string | number } } | [engineer: string | number | { id: string | number } ] | string | number | { id: string | number }, options?: RouteQueryOptions): RouteDefinition<'put'> => ({
    url: update.url(args, options),
    method: 'put',
})

update.definition = {
    methods: ["put","patch"],
    url: '/engineers/{engineer}',
} satisfies RouteDefinition<["put","patch"]>

/**
* @see \App\Http\Controllers\EngineerController::update
* @see workspace/scratch/40cc43c72aeb/JaiRoadV2-Integration/app/Http/Controllers/EngineerController.php:92
* @route '/engineers/{engineer}'
*/
update.url = (args: { engineer: string | number | { id: string | number } } | [engineer: string | number | { id: string | number } ] | string | number | { id: string | number }, options?: RouteQueryOptions) => {
    if (typeof args === 'string' || typeof args === 'number') {
        args = { engineer: args }
    }

    if (typeof args === 'object' && !Array.isArray(args) && 'id' in args) {
        args = { engineer: args.id }
    }

    if (Array.isArray(args)) {
        args = {
            engineer: args[0],
        }
    }

    args = applyUrlDefaults(args)

    const parsedArgs = {
        engineer: typeof args.engineer === 'object'
        ? args.engineer.id
        : args.engineer,
    }

    return update.definition.url
            .replace('{engineer}', parsedArgs.engineer.toString())
            .replace(/\/+$/, '') + queryParams(options)
}

/**
* @see \App\Http\Controllers\EngineerController::update
* @see workspace/scratch/40cc43c72aeb/JaiRoadV2-Integration/app/Http/Controllers/EngineerController.php:92
* @route '/engineers/{engineer}'
*/
update.put = (args: { engineer: string | number | { id: string | number } } | [engineer: string | number | { id: string | number } ] | string | number | { id: string | number }, options?: RouteQueryOptions): RouteDefinition<'put'> => ({
    url: update.url(args, options),
    method: 'put',
})

/**
* @see \App\Http\Controllers\EngineerController::update
* @see workspace/scratch/40cc43c72aeb/JaiRoadV2-Integration/app/Http/Controllers/EngineerController.php:92
* @route '/engineers/{engineer}'
*/
update.patch = (args: { engineer: string | number | { id: string | number } } | [engineer: string | number | { id: string | number } ] | string | number | { id: string | number }, options?: RouteQueryOptions): RouteDefinition<'patch'> => ({
    url: update.url(args, options),
    method: 'patch',
})

/**
* @see \App\Http\Controllers\EngineerController::update
* @see workspace/scratch/40cc43c72aeb/JaiRoadV2-Integration/app/Http/Controllers/EngineerController.php:92
* @route '/engineers/{engineer}'
*/
const updateForm = (args: { engineer: string | number | { id: string | number } } | [engineer: string | number | { id: string | number } ] | string | number | { id: string | number }, options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: update.url(args, {
        [options?.mergeQuery ? 'mergeQuery' : 'query']: {
            _method: 'PUT',
            ...(options?.query ?? options?.mergeQuery ?? {}),
        }
    }),
    method: 'post',
})

/**
* @see \App\Http\Controllers\EngineerController::update
* @see workspace/scratch/40cc43c72aeb/JaiRoadV2-Integration/app/Http/Controllers/EngineerController.php:92
* @route '/engineers/{engineer}'
*/
updateForm.put = (args: { engineer: string | number | { id: string | number } } | [engineer: string | number | { id: string | number } ] | string | number | { id: string | number }, options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: update.url(args, {
        [options?.mergeQuery ? 'mergeQuery' : 'query']: {
            _method: 'PUT',
            ...(options?.query ?? options?.mergeQuery ?? {}),
        }
    }),
    method: 'post',
})

/**
* @see \App\Http\Controllers\EngineerController::update
* @see workspace/scratch/40cc43c72aeb/JaiRoadV2-Integration/app/Http/Controllers/EngineerController.php:92
* @route '/engineers/{engineer}'
*/
updateForm.patch = (args: { engineer: string | number | { id: string | number } } | [engineer: string | number | { id: string | number } ] | string | number | { id: string | number }, options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
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
* @see \App\Http\Controllers\EngineerController::destroy
* @see workspace/scratch/40cc43c72aeb/JaiRoadV2-Integration/app/Http/Controllers/EngineerController.php:102
* @route '/engineers/{engineer}'
*/
export const destroy = (args: { engineer: string | number | { id: string | number } } | [engineer: string | number | { id: string | number } ] | string | number | { id: string | number }, options?: RouteQueryOptions): RouteDefinition<'delete'> => ({
    url: destroy.url(args, options),
    method: 'delete',
})

destroy.definition = {
    methods: ["delete"],
    url: '/engineers/{engineer}',
} satisfies RouteDefinition<["delete"]>

/**
* @see \App\Http\Controllers\EngineerController::destroy
* @see workspace/scratch/40cc43c72aeb/JaiRoadV2-Integration/app/Http/Controllers/EngineerController.php:102
* @route '/engineers/{engineer}'
*/
destroy.url = (args: { engineer: string | number | { id: string | number } } | [engineer: string | number | { id: string | number } ] | string | number | { id: string | number }, options?: RouteQueryOptions) => {
    if (typeof args === 'string' || typeof args === 'number') {
        args = { engineer: args }
    }

    if (typeof args === 'object' && !Array.isArray(args) && 'id' in args) {
        args = { engineer: args.id }
    }

    if (Array.isArray(args)) {
        args = {
            engineer: args[0],
        }
    }

    args = applyUrlDefaults(args)

    const parsedArgs = {
        engineer: typeof args.engineer === 'object'
        ? args.engineer.id
        : args.engineer,
    }

    return destroy.definition.url
            .replace('{engineer}', parsedArgs.engineer.toString())
            .replace(/\/+$/, '') + queryParams(options)
}

/**
* @see \App\Http\Controllers\EngineerController::destroy
* @see workspace/scratch/40cc43c72aeb/JaiRoadV2-Integration/app/Http/Controllers/EngineerController.php:102
* @route '/engineers/{engineer}'
*/
destroy.delete = (args: { engineer: string | number | { id: string | number } } | [engineer: string | number | { id: string | number } ] | string | number | { id: string | number }, options?: RouteQueryOptions): RouteDefinition<'delete'> => ({
    url: destroy.url(args, options),
    method: 'delete',
})

/**
* @see \App\Http\Controllers\EngineerController::destroy
* @see workspace/scratch/40cc43c72aeb/JaiRoadV2-Integration/app/Http/Controllers/EngineerController.php:102
* @route '/engineers/{engineer}'
*/
const destroyForm = (args: { engineer: string | number | { id: string | number } } | [engineer: string | number | { id: string | number } ] | string | number | { id: string | number }, options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: destroy.url(args, {
        [options?.mergeQuery ? 'mergeQuery' : 'query']: {
            _method: 'DELETE',
            ...(options?.query ?? options?.mergeQuery ?? {}),
        }
    }),
    method: 'post',
})

/**
* @see \App\Http\Controllers\EngineerController::destroy
* @see workspace/scratch/40cc43c72aeb/JaiRoadV2-Integration/app/Http/Controllers/EngineerController.php:102
* @route '/engineers/{engineer}'
*/
destroyForm.delete = (args: { engineer: string | number | { id: string | number } } | [engineer: string | number | { id: string | number } ] | string | number | { id: string | number }, options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: destroy.url(args, {
        [options?.mergeQuery ? 'mergeQuery' : 'query']: {
            _method: 'DELETE',
            ...(options?.query ?? options?.mergeQuery ?? {}),
        }
    }),
    method: 'post',
})

destroy.form = destroyForm

const engineers = {
    index: Object.assign(index, index),
    create: Object.assign(create, create),
    store: Object.assign(store, store),
    show: Object.assign(show, show),
    edit: Object.assign(edit, edit),
    update: Object.assign(update, update),
    destroy: Object.assign(destroy, destroy),
}

export default engineers