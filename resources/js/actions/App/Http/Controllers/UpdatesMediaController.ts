import { queryParams, type RouteQueryOptions, type RouteDefinition, type RouteFormDefinition, applyUrlDefaults } from './../../../../wayfinder'
/**
* @see \App\Http\Controllers\UpdatesMediaController::index
* @see workspace/scratch/40cc43c72aeb/JaiRoadV2-Integration/app/Http/Controllers/UpdatesMediaController.php:16
* @route '/updates-media'
*/
export const index = (options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: index.url(options),
    method: 'get',
})

index.definition = {
    methods: ["get","head"],
    url: '/updates-media',
} satisfies RouteDefinition<["get","head"]>

/**
* @see \App\Http\Controllers\UpdatesMediaController::index
* @see workspace/scratch/40cc43c72aeb/JaiRoadV2-Integration/app/Http/Controllers/UpdatesMediaController.php:16
* @route '/updates-media'
*/
index.url = (options?: RouteQueryOptions) => {
    return index.definition.url + queryParams(options)
}

/**
* @see \App\Http\Controllers\UpdatesMediaController::index
* @see workspace/scratch/40cc43c72aeb/JaiRoadV2-Integration/app/Http/Controllers/UpdatesMediaController.php:16
* @route '/updates-media'
*/
index.get = (options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: index.url(options),
    method: 'get',
})

/**
* @see \App\Http\Controllers\UpdatesMediaController::index
* @see workspace/scratch/40cc43c72aeb/JaiRoadV2-Integration/app/Http/Controllers/UpdatesMediaController.php:16
* @route '/updates-media'
*/
index.head = (options?: RouteQueryOptions): RouteDefinition<'head'> => ({
    url: index.url(options),
    method: 'head',
})

/**
* @see \App\Http\Controllers\UpdatesMediaController::index
* @see workspace/scratch/40cc43c72aeb/JaiRoadV2-Integration/app/Http/Controllers/UpdatesMediaController.php:16
* @route '/updates-media'
*/
const indexForm = (options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
    action: index.url(options),
    method: 'get',
})

/**
* @see \App\Http\Controllers\UpdatesMediaController::index
* @see workspace/scratch/40cc43c72aeb/JaiRoadV2-Integration/app/Http/Controllers/UpdatesMediaController.php:16
* @route '/updates-media'
*/
indexForm.get = (options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
    action: index.url(options),
    method: 'get',
})

/**
* @see \App\Http\Controllers\UpdatesMediaController::index
* @see workspace/scratch/40cc43c72aeb/JaiRoadV2-Integration/app/Http/Controllers/UpdatesMediaController.php:16
* @route '/updates-media'
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
* @see \App\Http\Controllers\UpdatesMediaController::create
* @see workspace/scratch/40cc43c72aeb/JaiRoadV2-Integration/app/Http/Controllers/UpdatesMediaController.php:61
* @route '/updates-media/create'
*/
export const create = (options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: create.url(options),
    method: 'get',
})

create.definition = {
    methods: ["get","head"],
    url: '/updates-media/create',
} satisfies RouteDefinition<["get","head"]>

/**
* @see \App\Http\Controllers\UpdatesMediaController::create
* @see workspace/scratch/40cc43c72aeb/JaiRoadV2-Integration/app/Http/Controllers/UpdatesMediaController.php:61
* @route '/updates-media/create'
*/
create.url = (options?: RouteQueryOptions) => {
    return create.definition.url + queryParams(options)
}

/**
* @see \App\Http\Controllers\UpdatesMediaController::create
* @see workspace/scratch/40cc43c72aeb/JaiRoadV2-Integration/app/Http/Controllers/UpdatesMediaController.php:61
* @route '/updates-media/create'
*/
create.get = (options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: create.url(options),
    method: 'get',
})

/**
* @see \App\Http\Controllers\UpdatesMediaController::create
* @see workspace/scratch/40cc43c72aeb/JaiRoadV2-Integration/app/Http/Controllers/UpdatesMediaController.php:61
* @route '/updates-media/create'
*/
create.head = (options?: RouteQueryOptions): RouteDefinition<'head'> => ({
    url: create.url(options),
    method: 'head',
})

/**
* @see \App\Http\Controllers\UpdatesMediaController::create
* @see workspace/scratch/40cc43c72aeb/JaiRoadV2-Integration/app/Http/Controllers/UpdatesMediaController.php:61
* @route '/updates-media/create'
*/
const createForm = (options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
    action: create.url(options),
    method: 'get',
})

/**
* @see \App\Http\Controllers\UpdatesMediaController::create
* @see workspace/scratch/40cc43c72aeb/JaiRoadV2-Integration/app/Http/Controllers/UpdatesMediaController.php:61
* @route '/updates-media/create'
*/
createForm.get = (options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
    action: create.url(options),
    method: 'get',
})

/**
* @see \App\Http\Controllers\UpdatesMediaController::create
* @see workspace/scratch/40cc43c72aeb/JaiRoadV2-Integration/app/Http/Controllers/UpdatesMediaController.php:61
* @route '/updates-media/create'
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
* @see \App\Http\Controllers\UpdatesMediaController::store
* @see workspace/scratch/40cc43c72aeb/JaiRoadV2-Integration/app/Http/Controllers/UpdatesMediaController.php:66
* @route '/updates-media'
*/
export const store = (options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: store.url(options),
    method: 'post',
})

store.definition = {
    methods: ["post"],
    url: '/updates-media',
} satisfies RouteDefinition<["post"]>

/**
* @see \App\Http\Controllers\UpdatesMediaController::store
* @see workspace/scratch/40cc43c72aeb/JaiRoadV2-Integration/app/Http/Controllers/UpdatesMediaController.php:66
* @route '/updates-media'
*/
store.url = (options?: RouteQueryOptions) => {
    return store.definition.url + queryParams(options)
}

/**
* @see \App\Http\Controllers\UpdatesMediaController::store
* @see workspace/scratch/40cc43c72aeb/JaiRoadV2-Integration/app/Http/Controllers/UpdatesMediaController.php:66
* @route '/updates-media'
*/
store.post = (options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: store.url(options),
    method: 'post',
})

/**
* @see \App\Http\Controllers\UpdatesMediaController::store
* @see workspace/scratch/40cc43c72aeb/JaiRoadV2-Integration/app/Http/Controllers/UpdatesMediaController.php:66
* @route '/updates-media'
*/
const storeForm = (options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: store.url(options),
    method: 'post',
})

/**
* @see \App\Http\Controllers\UpdatesMediaController::store
* @see workspace/scratch/40cc43c72aeb/JaiRoadV2-Integration/app/Http/Controllers/UpdatesMediaController.php:66
* @route '/updates-media'
*/
storeForm.post = (options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: store.url(options),
    method: 'post',
})

store.form = storeForm

/**
* @see \App\Http\Controllers\UpdatesMediaController::show
* @see workspace/scratch/40cc43c72aeb/JaiRoadV2-Integration/app/Http/Controllers/UpdatesMediaController.php:75
* @route '/updates-media/{updates_medium}'
*/
export const show = (args: { updates_medium: string | number } | [updates_medium: string | number ] | string | number, options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: show.url(args, options),
    method: 'get',
})

show.definition = {
    methods: ["get","head"],
    url: '/updates-media/{updates_medium}',
} satisfies RouteDefinition<["get","head"]>

/**
* @see \App\Http\Controllers\UpdatesMediaController::show
* @see workspace/scratch/40cc43c72aeb/JaiRoadV2-Integration/app/Http/Controllers/UpdatesMediaController.php:75
* @route '/updates-media/{updates_medium}'
*/
show.url = (args: { updates_medium: string | number } | [updates_medium: string | number ] | string | number, options?: RouteQueryOptions) => {
    if (typeof args === 'string' || typeof args === 'number') {
        args = { updates_medium: args }
    }

    if (Array.isArray(args)) {
        args = {
            updates_medium: args[0],
        }
    }

    args = applyUrlDefaults(args)

    const parsedArgs = {
        updates_medium: args.updates_medium,
    }

    return show.definition.url
            .replace('{updates_medium}', parsedArgs.updates_medium.toString())
            .replace(/\/+$/, '') + queryParams(options)
}

/**
* @see \App\Http\Controllers\UpdatesMediaController::show
* @see workspace/scratch/40cc43c72aeb/JaiRoadV2-Integration/app/Http/Controllers/UpdatesMediaController.php:75
* @route '/updates-media/{updates_medium}'
*/
show.get = (args: { updates_medium: string | number } | [updates_medium: string | number ] | string | number, options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: show.url(args, options),
    method: 'get',
})

/**
* @see \App\Http\Controllers\UpdatesMediaController::show
* @see workspace/scratch/40cc43c72aeb/JaiRoadV2-Integration/app/Http/Controllers/UpdatesMediaController.php:75
* @route '/updates-media/{updates_medium}'
*/
show.head = (args: { updates_medium: string | number } | [updates_medium: string | number ] | string | number, options?: RouteQueryOptions): RouteDefinition<'head'> => ({
    url: show.url(args, options),
    method: 'head',
})

/**
* @see \App\Http\Controllers\UpdatesMediaController::show
* @see workspace/scratch/40cc43c72aeb/JaiRoadV2-Integration/app/Http/Controllers/UpdatesMediaController.php:75
* @route '/updates-media/{updates_medium}'
*/
const showForm = (args: { updates_medium: string | number } | [updates_medium: string | number ] | string | number, options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
    action: show.url(args, options),
    method: 'get',
})

/**
* @see \App\Http\Controllers\UpdatesMediaController::show
* @see workspace/scratch/40cc43c72aeb/JaiRoadV2-Integration/app/Http/Controllers/UpdatesMediaController.php:75
* @route '/updates-media/{updates_medium}'
*/
showForm.get = (args: { updates_medium: string | number } | [updates_medium: string | number ] | string | number, options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
    action: show.url(args, options),
    method: 'get',
})

/**
* @see \App\Http\Controllers\UpdatesMediaController::show
* @see workspace/scratch/40cc43c72aeb/JaiRoadV2-Integration/app/Http/Controllers/UpdatesMediaController.php:75
* @route '/updates-media/{updates_medium}'
*/
showForm.head = (args: { updates_medium: string | number } | [updates_medium: string | number ] | string | number, options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
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
* @see \App\Http\Controllers\UpdatesMediaController::edit
* @see workspace/scratch/40cc43c72aeb/JaiRoadV2-Integration/app/Http/Controllers/UpdatesMediaController.php:80
* @route '/updates-media/{updates_medium}/edit'
*/
export const edit = (args: { updates_medium: string | number } | [updates_medium: string | number ] | string | number, options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: edit.url(args, options),
    method: 'get',
})

edit.definition = {
    methods: ["get","head"],
    url: '/updates-media/{updates_medium}/edit',
} satisfies RouteDefinition<["get","head"]>

/**
* @see \App\Http\Controllers\UpdatesMediaController::edit
* @see workspace/scratch/40cc43c72aeb/JaiRoadV2-Integration/app/Http/Controllers/UpdatesMediaController.php:80
* @route '/updates-media/{updates_medium}/edit'
*/
edit.url = (args: { updates_medium: string | number } | [updates_medium: string | number ] | string | number, options?: RouteQueryOptions) => {
    if (typeof args === 'string' || typeof args === 'number') {
        args = { updates_medium: args }
    }

    if (Array.isArray(args)) {
        args = {
            updates_medium: args[0],
        }
    }

    args = applyUrlDefaults(args)

    const parsedArgs = {
        updates_medium: args.updates_medium,
    }

    return edit.definition.url
            .replace('{updates_medium}', parsedArgs.updates_medium.toString())
            .replace(/\/+$/, '') + queryParams(options)
}

/**
* @see \App\Http\Controllers\UpdatesMediaController::edit
* @see workspace/scratch/40cc43c72aeb/JaiRoadV2-Integration/app/Http/Controllers/UpdatesMediaController.php:80
* @route '/updates-media/{updates_medium}/edit'
*/
edit.get = (args: { updates_medium: string | number } | [updates_medium: string | number ] | string | number, options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: edit.url(args, options),
    method: 'get',
})

/**
* @see \App\Http\Controllers\UpdatesMediaController::edit
* @see workspace/scratch/40cc43c72aeb/JaiRoadV2-Integration/app/Http/Controllers/UpdatesMediaController.php:80
* @route '/updates-media/{updates_medium}/edit'
*/
edit.head = (args: { updates_medium: string | number } | [updates_medium: string | number ] | string | number, options?: RouteQueryOptions): RouteDefinition<'head'> => ({
    url: edit.url(args, options),
    method: 'head',
})

/**
* @see \App\Http\Controllers\UpdatesMediaController::edit
* @see workspace/scratch/40cc43c72aeb/JaiRoadV2-Integration/app/Http/Controllers/UpdatesMediaController.php:80
* @route '/updates-media/{updates_medium}/edit'
*/
const editForm = (args: { updates_medium: string | number } | [updates_medium: string | number ] | string | number, options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
    action: edit.url(args, options),
    method: 'get',
})

/**
* @see \App\Http\Controllers\UpdatesMediaController::edit
* @see workspace/scratch/40cc43c72aeb/JaiRoadV2-Integration/app/Http/Controllers/UpdatesMediaController.php:80
* @route '/updates-media/{updates_medium}/edit'
*/
editForm.get = (args: { updates_medium: string | number } | [updates_medium: string | number ] | string | number, options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
    action: edit.url(args, options),
    method: 'get',
})

/**
* @see \App\Http\Controllers\UpdatesMediaController::edit
* @see workspace/scratch/40cc43c72aeb/JaiRoadV2-Integration/app/Http/Controllers/UpdatesMediaController.php:80
* @route '/updates-media/{updates_medium}/edit'
*/
editForm.head = (args: { updates_medium: string | number } | [updates_medium: string | number ] | string | number, options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
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
* @see \App\Http\Controllers\UpdatesMediaController::update
* @see workspace/scratch/40cc43c72aeb/JaiRoadV2-Integration/app/Http/Controllers/UpdatesMediaController.php:85
* @route '/updates-media/{updates_medium}'
*/
export const update = (args: { updates_medium: string | number } | [updates_medium: string | number ] | string | number, options?: RouteQueryOptions): RouteDefinition<'put'> => ({
    url: update.url(args, options),
    method: 'put',
})

update.definition = {
    methods: ["put","patch"],
    url: '/updates-media/{updates_medium}',
} satisfies RouteDefinition<["put","patch"]>

/**
* @see \App\Http\Controllers\UpdatesMediaController::update
* @see workspace/scratch/40cc43c72aeb/JaiRoadV2-Integration/app/Http/Controllers/UpdatesMediaController.php:85
* @route '/updates-media/{updates_medium}'
*/
update.url = (args: { updates_medium: string | number } | [updates_medium: string | number ] | string | number, options?: RouteQueryOptions) => {
    if (typeof args === 'string' || typeof args === 'number') {
        args = { updates_medium: args }
    }

    if (Array.isArray(args)) {
        args = {
            updates_medium: args[0],
        }
    }

    args = applyUrlDefaults(args)

    const parsedArgs = {
        updates_medium: args.updates_medium,
    }

    return update.definition.url
            .replace('{updates_medium}', parsedArgs.updates_medium.toString())
            .replace(/\/+$/, '') + queryParams(options)
}

/**
* @see \App\Http\Controllers\UpdatesMediaController::update
* @see workspace/scratch/40cc43c72aeb/JaiRoadV2-Integration/app/Http/Controllers/UpdatesMediaController.php:85
* @route '/updates-media/{updates_medium}'
*/
update.put = (args: { updates_medium: string | number } | [updates_medium: string | number ] | string | number, options?: RouteQueryOptions): RouteDefinition<'put'> => ({
    url: update.url(args, options),
    method: 'put',
})

/**
* @see \App\Http\Controllers\UpdatesMediaController::update
* @see workspace/scratch/40cc43c72aeb/JaiRoadV2-Integration/app/Http/Controllers/UpdatesMediaController.php:85
* @route '/updates-media/{updates_medium}'
*/
update.patch = (args: { updates_medium: string | number } | [updates_medium: string | number ] | string | number, options?: RouteQueryOptions): RouteDefinition<'patch'> => ({
    url: update.url(args, options),
    method: 'patch',
})

/**
* @see \App\Http\Controllers\UpdatesMediaController::update
* @see workspace/scratch/40cc43c72aeb/JaiRoadV2-Integration/app/Http/Controllers/UpdatesMediaController.php:85
* @route '/updates-media/{updates_medium}'
*/
const updateForm = (args: { updates_medium: string | number } | [updates_medium: string | number ] | string | number, options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: update.url(args, {
        [options?.mergeQuery ? 'mergeQuery' : 'query']: {
            _method: 'PUT',
            ...(options?.query ?? options?.mergeQuery ?? {}),
        }
    }),
    method: 'post',
})

/**
* @see \App\Http\Controllers\UpdatesMediaController::update
* @see workspace/scratch/40cc43c72aeb/JaiRoadV2-Integration/app/Http/Controllers/UpdatesMediaController.php:85
* @route '/updates-media/{updates_medium}'
*/
updateForm.put = (args: { updates_medium: string | number } | [updates_medium: string | number ] | string | number, options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: update.url(args, {
        [options?.mergeQuery ? 'mergeQuery' : 'query']: {
            _method: 'PUT',
            ...(options?.query ?? options?.mergeQuery ?? {}),
        }
    }),
    method: 'post',
})

/**
* @see \App\Http\Controllers\UpdatesMediaController::update
* @see workspace/scratch/40cc43c72aeb/JaiRoadV2-Integration/app/Http/Controllers/UpdatesMediaController.php:85
* @route '/updates-media/{updates_medium}'
*/
updateForm.patch = (args: { updates_medium: string | number } | [updates_medium: string | number ] | string | number, options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
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
* @see \App\Http\Controllers\UpdatesMediaController::destroy
* @see workspace/scratch/40cc43c72aeb/JaiRoadV2-Integration/app/Http/Controllers/UpdatesMediaController.php:97
* @route '/updates-media/{updates_medium}'
*/
export const destroy = (args: { updates_medium: string | number } | [updates_medium: string | number ] | string | number, options?: RouteQueryOptions): RouteDefinition<'delete'> => ({
    url: destroy.url(args, options),
    method: 'delete',
})

destroy.definition = {
    methods: ["delete"],
    url: '/updates-media/{updates_medium}',
} satisfies RouteDefinition<["delete"]>

/**
* @see \App\Http\Controllers\UpdatesMediaController::destroy
* @see workspace/scratch/40cc43c72aeb/JaiRoadV2-Integration/app/Http/Controllers/UpdatesMediaController.php:97
* @route '/updates-media/{updates_medium}'
*/
destroy.url = (args: { updates_medium: string | number } | [updates_medium: string | number ] | string | number, options?: RouteQueryOptions) => {
    if (typeof args === 'string' || typeof args === 'number') {
        args = { updates_medium: args }
    }

    if (Array.isArray(args)) {
        args = {
            updates_medium: args[0],
        }
    }

    args = applyUrlDefaults(args)

    const parsedArgs = {
        updates_medium: args.updates_medium,
    }

    return destroy.definition.url
            .replace('{updates_medium}', parsedArgs.updates_medium.toString())
            .replace(/\/+$/, '') + queryParams(options)
}

/**
* @see \App\Http\Controllers\UpdatesMediaController::destroy
* @see workspace/scratch/40cc43c72aeb/JaiRoadV2-Integration/app/Http/Controllers/UpdatesMediaController.php:97
* @route '/updates-media/{updates_medium}'
*/
destroy.delete = (args: { updates_medium: string | number } | [updates_medium: string | number ] | string | number, options?: RouteQueryOptions): RouteDefinition<'delete'> => ({
    url: destroy.url(args, options),
    method: 'delete',
})

/**
* @see \App\Http\Controllers\UpdatesMediaController::destroy
* @see workspace/scratch/40cc43c72aeb/JaiRoadV2-Integration/app/Http/Controllers/UpdatesMediaController.php:97
* @route '/updates-media/{updates_medium}'
*/
const destroyForm = (args: { updates_medium: string | number } | [updates_medium: string | number ] | string | number, options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: destroy.url(args, {
        [options?.mergeQuery ? 'mergeQuery' : 'query']: {
            _method: 'DELETE',
            ...(options?.query ?? options?.mergeQuery ?? {}),
        }
    }),
    method: 'post',
})

/**
* @see \App\Http\Controllers\UpdatesMediaController::destroy
* @see workspace/scratch/40cc43c72aeb/JaiRoadV2-Integration/app/Http/Controllers/UpdatesMediaController.php:97
* @route '/updates-media/{updates_medium}'
*/
destroyForm.delete = (args: { updates_medium: string | number } | [updates_medium: string | number ] | string | number, options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: destroy.url(args, {
        [options?.mergeQuery ? 'mergeQuery' : 'query']: {
            _method: 'DELETE',
            ...(options?.query ?? options?.mergeQuery ?? {}),
        }
    }),
    method: 'post',
})

destroy.form = destroyForm

const UpdatesMediaController = { index, create, store, show, edit, update, destroy }

export default UpdatesMediaController