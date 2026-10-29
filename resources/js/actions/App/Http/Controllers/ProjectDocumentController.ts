import { queryParams, type RouteQueryOptions, type RouteDefinition, type RouteFormDefinition, applyUrlDefaults } from './../../../../wayfinder'
/**
* @see \App\Http\Controllers\ProjectDocumentController::index
* @see workspace/scratch/40cc43c72aeb/JaiRoadV2-Integration/app/Http/Controllers/ProjectDocumentController.php:16
* @route '/project-documents'
*/
export const index = (options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: index.url(options),
    method: 'get',
})

index.definition = {
    methods: ["get","head"],
    url: '/project-documents',
} satisfies RouteDefinition<["get","head"]>

/**
* @see \App\Http\Controllers\ProjectDocumentController::index
* @see workspace/scratch/40cc43c72aeb/JaiRoadV2-Integration/app/Http/Controllers/ProjectDocumentController.php:16
* @route '/project-documents'
*/
index.url = (options?: RouteQueryOptions) => {
    return index.definition.url + queryParams(options)
}

/**
* @see \App\Http\Controllers\ProjectDocumentController::index
* @see workspace/scratch/40cc43c72aeb/JaiRoadV2-Integration/app/Http/Controllers/ProjectDocumentController.php:16
* @route '/project-documents'
*/
index.get = (options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: index.url(options),
    method: 'get',
})

/**
* @see \App\Http\Controllers\ProjectDocumentController::index
* @see workspace/scratch/40cc43c72aeb/JaiRoadV2-Integration/app/Http/Controllers/ProjectDocumentController.php:16
* @route '/project-documents'
*/
index.head = (options?: RouteQueryOptions): RouteDefinition<'head'> => ({
    url: index.url(options),
    method: 'head',
})

/**
* @see \App\Http\Controllers\ProjectDocumentController::index
* @see workspace/scratch/40cc43c72aeb/JaiRoadV2-Integration/app/Http/Controllers/ProjectDocumentController.php:16
* @route '/project-documents'
*/
const indexForm = (options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
    action: index.url(options),
    method: 'get',
})

/**
* @see \App\Http\Controllers\ProjectDocumentController::index
* @see workspace/scratch/40cc43c72aeb/JaiRoadV2-Integration/app/Http/Controllers/ProjectDocumentController.php:16
* @route '/project-documents'
*/
indexForm.get = (options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
    action: index.url(options),
    method: 'get',
})

/**
* @see \App\Http\Controllers\ProjectDocumentController::index
* @see workspace/scratch/40cc43c72aeb/JaiRoadV2-Integration/app/Http/Controllers/ProjectDocumentController.php:16
* @route '/project-documents'
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
* @see \App\Http\Controllers\ProjectDocumentController::create
* @see workspace/scratch/40cc43c72aeb/JaiRoadV2-Integration/app/Http/Controllers/ProjectDocumentController.php:63
* @route '/project-documents/create'
*/
export const create = (options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: create.url(options),
    method: 'get',
})

create.definition = {
    methods: ["get","head"],
    url: '/project-documents/create',
} satisfies RouteDefinition<["get","head"]>

/**
* @see \App\Http\Controllers\ProjectDocumentController::create
* @see workspace/scratch/40cc43c72aeb/JaiRoadV2-Integration/app/Http/Controllers/ProjectDocumentController.php:63
* @route '/project-documents/create'
*/
create.url = (options?: RouteQueryOptions) => {
    return create.definition.url + queryParams(options)
}

/**
* @see \App\Http\Controllers\ProjectDocumentController::create
* @see workspace/scratch/40cc43c72aeb/JaiRoadV2-Integration/app/Http/Controllers/ProjectDocumentController.php:63
* @route '/project-documents/create'
*/
create.get = (options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: create.url(options),
    method: 'get',
})

/**
* @see \App\Http\Controllers\ProjectDocumentController::create
* @see workspace/scratch/40cc43c72aeb/JaiRoadV2-Integration/app/Http/Controllers/ProjectDocumentController.php:63
* @route '/project-documents/create'
*/
create.head = (options?: RouteQueryOptions): RouteDefinition<'head'> => ({
    url: create.url(options),
    method: 'head',
})

/**
* @see \App\Http\Controllers\ProjectDocumentController::create
* @see workspace/scratch/40cc43c72aeb/JaiRoadV2-Integration/app/Http/Controllers/ProjectDocumentController.php:63
* @route '/project-documents/create'
*/
const createForm = (options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
    action: create.url(options),
    method: 'get',
})

/**
* @see \App\Http\Controllers\ProjectDocumentController::create
* @see workspace/scratch/40cc43c72aeb/JaiRoadV2-Integration/app/Http/Controllers/ProjectDocumentController.php:63
* @route '/project-documents/create'
*/
createForm.get = (options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
    action: create.url(options),
    method: 'get',
})

/**
* @see \App\Http\Controllers\ProjectDocumentController::create
* @see workspace/scratch/40cc43c72aeb/JaiRoadV2-Integration/app/Http/Controllers/ProjectDocumentController.php:63
* @route '/project-documents/create'
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
* @see \App\Http\Controllers\ProjectDocumentController::store
* @see workspace/scratch/40cc43c72aeb/JaiRoadV2-Integration/app/Http/Controllers/ProjectDocumentController.php:68
* @route '/project-documents'
*/
export const store = (options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: store.url(options),
    method: 'post',
})

store.definition = {
    methods: ["post"],
    url: '/project-documents',
} satisfies RouteDefinition<["post"]>

/**
* @see \App\Http\Controllers\ProjectDocumentController::store
* @see workspace/scratch/40cc43c72aeb/JaiRoadV2-Integration/app/Http/Controllers/ProjectDocumentController.php:68
* @route '/project-documents'
*/
store.url = (options?: RouteQueryOptions) => {
    return store.definition.url + queryParams(options)
}

/**
* @see \App\Http\Controllers\ProjectDocumentController::store
* @see workspace/scratch/40cc43c72aeb/JaiRoadV2-Integration/app/Http/Controllers/ProjectDocumentController.php:68
* @route '/project-documents'
*/
store.post = (options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: store.url(options),
    method: 'post',
})

/**
* @see \App\Http\Controllers\ProjectDocumentController::store
* @see workspace/scratch/40cc43c72aeb/JaiRoadV2-Integration/app/Http/Controllers/ProjectDocumentController.php:68
* @route '/project-documents'
*/
const storeForm = (options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: store.url(options),
    method: 'post',
})

/**
* @see \App\Http\Controllers\ProjectDocumentController::store
* @see workspace/scratch/40cc43c72aeb/JaiRoadV2-Integration/app/Http/Controllers/ProjectDocumentController.php:68
* @route '/project-documents'
*/
storeForm.post = (options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: store.url(options),
    method: 'post',
})

store.form = storeForm

/**
* @see \App\Http\Controllers\ProjectDocumentController::show
* @see workspace/scratch/40cc43c72aeb/JaiRoadV2-Integration/app/Http/Controllers/ProjectDocumentController.php:80
* @route '/project-documents/{project_document}'
*/
export const show = (args: { project_document: string | number | { id: string | number } } | [project_document: string | number | { id: string | number } ] | string | number | { id: string | number }, options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: show.url(args, options),
    method: 'get',
})

show.definition = {
    methods: ["get","head"],
    url: '/project-documents/{project_document}',
} satisfies RouteDefinition<["get","head"]>

/**
* @see \App\Http\Controllers\ProjectDocumentController::show
* @see workspace/scratch/40cc43c72aeb/JaiRoadV2-Integration/app/Http/Controllers/ProjectDocumentController.php:80
* @route '/project-documents/{project_document}'
*/
show.url = (args: { project_document: string | number | { id: string | number } } | [project_document: string | number | { id: string | number } ] | string | number | { id: string | number }, options?: RouteQueryOptions) => {
    if (typeof args === 'string' || typeof args === 'number') {
        args = { project_document: args }
    }

    if (typeof args === 'object' && !Array.isArray(args) && 'id' in args) {
        args = { project_document: args.id }
    }

    if (Array.isArray(args)) {
        args = {
            project_document: args[0],
        }
    }

    args = applyUrlDefaults(args)

    const parsedArgs = {
        project_document: typeof args.project_document === 'object'
        ? args.project_document.id
        : args.project_document,
    }

    return show.definition.url
            .replace('{project_document}', parsedArgs.project_document.toString())
            .replace(/\/+$/, '') + queryParams(options)
}

/**
* @see \App\Http\Controllers\ProjectDocumentController::show
* @see workspace/scratch/40cc43c72aeb/JaiRoadV2-Integration/app/Http/Controllers/ProjectDocumentController.php:80
* @route '/project-documents/{project_document}'
*/
show.get = (args: { project_document: string | number | { id: string | number } } | [project_document: string | number | { id: string | number } ] | string | number | { id: string | number }, options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: show.url(args, options),
    method: 'get',
})

/**
* @see \App\Http\Controllers\ProjectDocumentController::show
* @see workspace/scratch/40cc43c72aeb/JaiRoadV2-Integration/app/Http/Controllers/ProjectDocumentController.php:80
* @route '/project-documents/{project_document}'
*/
show.head = (args: { project_document: string | number | { id: string | number } } | [project_document: string | number | { id: string | number } ] | string | number | { id: string | number }, options?: RouteQueryOptions): RouteDefinition<'head'> => ({
    url: show.url(args, options),
    method: 'head',
})

/**
* @see \App\Http\Controllers\ProjectDocumentController::show
* @see workspace/scratch/40cc43c72aeb/JaiRoadV2-Integration/app/Http/Controllers/ProjectDocumentController.php:80
* @route '/project-documents/{project_document}'
*/
const showForm = (args: { project_document: string | number | { id: string | number } } | [project_document: string | number | { id: string | number } ] | string | number | { id: string | number }, options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
    action: show.url(args, options),
    method: 'get',
})

/**
* @see \App\Http\Controllers\ProjectDocumentController::show
* @see workspace/scratch/40cc43c72aeb/JaiRoadV2-Integration/app/Http/Controllers/ProjectDocumentController.php:80
* @route '/project-documents/{project_document}'
*/
showForm.get = (args: { project_document: string | number | { id: string | number } } | [project_document: string | number | { id: string | number } ] | string | number | { id: string | number }, options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
    action: show.url(args, options),
    method: 'get',
})

/**
* @see \App\Http\Controllers\ProjectDocumentController::show
* @see workspace/scratch/40cc43c72aeb/JaiRoadV2-Integration/app/Http/Controllers/ProjectDocumentController.php:80
* @route '/project-documents/{project_document}'
*/
showForm.head = (args: { project_document: string | number | { id: string | number } } | [project_document: string | number | { id: string | number } ] | string | number | { id: string | number }, options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
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
* @see \App\Http\Controllers\ProjectDocumentController::edit
* @see workspace/scratch/40cc43c72aeb/JaiRoadV2-Integration/app/Http/Controllers/ProjectDocumentController.php:85
* @route '/project-documents/{project_document}/edit'
*/
export const edit = (args: { project_document: string | number | { id: string | number } } | [project_document: string | number | { id: string | number } ] | string | number | { id: string | number }, options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: edit.url(args, options),
    method: 'get',
})

edit.definition = {
    methods: ["get","head"],
    url: '/project-documents/{project_document}/edit',
} satisfies RouteDefinition<["get","head"]>

/**
* @see \App\Http\Controllers\ProjectDocumentController::edit
* @see workspace/scratch/40cc43c72aeb/JaiRoadV2-Integration/app/Http/Controllers/ProjectDocumentController.php:85
* @route '/project-documents/{project_document}/edit'
*/
edit.url = (args: { project_document: string | number | { id: string | number } } | [project_document: string | number | { id: string | number } ] | string | number | { id: string | number }, options?: RouteQueryOptions) => {
    if (typeof args === 'string' || typeof args === 'number') {
        args = { project_document: args }
    }

    if (typeof args === 'object' && !Array.isArray(args) && 'id' in args) {
        args = { project_document: args.id }
    }

    if (Array.isArray(args)) {
        args = {
            project_document: args[0],
        }
    }

    args = applyUrlDefaults(args)

    const parsedArgs = {
        project_document: typeof args.project_document === 'object'
        ? args.project_document.id
        : args.project_document,
    }

    return edit.definition.url
            .replace('{project_document}', parsedArgs.project_document.toString())
            .replace(/\/+$/, '') + queryParams(options)
}

/**
* @see \App\Http\Controllers\ProjectDocumentController::edit
* @see workspace/scratch/40cc43c72aeb/JaiRoadV2-Integration/app/Http/Controllers/ProjectDocumentController.php:85
* @route '/project-documents/{project_document}/edit'
*/
edit.get = (args: { project_document: string | number | { id: string | number } } | [project_document: string | number | { id: string | number } ] | string | number | { id: string | number }, options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: edit.url(args, options),
    method: 'get',
})

/**
* @see \App\Http\Controllers\ProjectDocumentController::edit
* @see workspace/scratch/40cc43c72aeb/JaiRoadV2-Integration/app/Http/Controllers/ProjectDocumentController.php:85
* @route '/project-documents/{project_document}/edit'
*/
edit.head = (args: { project_document: string | number | { id: string | number } } | [project_document: string | number | { id: string | number } ] | string | number | { id: string | number }, options?: RouteQueryOptions): RouteDefinition<'head'> => ({
    url: edit.url(args, options),
    method: 'head',
})

/**
* @see \App\Http\Controllers\ProjectDocumentController::edit
* @see workspace/scratch/40cc43c72aeb/JaiRoadV2-Integration/app/Http/Controllers/ProjectDocumentController.php:85
* @route '/project-documents/{project_document}/edit'
*/
const editForm = (args: { project_document: string | number | { id: string | number } } | [project_document: string | number | { id: string | number } ] | string | number | { id: string | number }, options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
    action: edit.url(args, options),
    method: 'get',
})

/**
* @see \App\Http\Controllers\ProjectDocumentController::edit
* @see workspace/scratch/40cc43c72aeb/JaiRoadV2-Integration/app/Http/Controllers/ProjectDocumentController.php:85
* @route '/project-documents/{project_document}/edit'
*/
editForm.get = (args: { project_document: string | number | { id: string | number } } | [project_document: string | number | { id: string | number } ] | string | number | { id: string | number }, options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
    action: edit.url(args, options),
    method: 'get',
})

/**
* @see \App\Http\Controllers\ProjectDocumentController::edit
* @see workspace/scratch/40cc43c72aeb/JaiRoadV2-Integration/app/Http/Controllers/ProjectDocumentController.php:85
* @route '/project-documents/{project_document}/edit'
*/
editForm.head = (args: { project_document: string | number | { id: string | number } } | [project_document: string | number | { id: string | number } ] | string | number | { id: string | number }, options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
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
* @see \App\Http\Controllers\ProjectDocumentController::update
* @see workspace/scratch/40cc43c72aeb/JaiRoadV2-Integration/app/Http/Controllers/ProjectDocumentController.php:90
* @route '/project-documents/{project_document}'
*/
export const update = (args: { project_document: string | number | { id: string | number } } | [project_document: string | number | { id: string | number } ] | string | number | { id: string | number }, options?: RouteQueryOptions): RouteDefinition<'put'> => ({
    url: update.url(args, options),
    method: 'put',
})

update.definition = {
    methods: ["put","patch"],
    url: '/project-documents/{project_document}',
} satisfies RouteDefinition<["put","patch"]>

/**
* @see \App\Http\Controllers\ProjectDocumentController::update
* @see workspace/scratch/40cc43c72aeb/JaiRoadV2-Integration/app/Http/Controllers/ProjectDocumentController.php:90
* @route '/project-documents/{project_document}'
*/
update.url = (args: { project_document: string | number | { id: string | number } } | [project_document: string | number | { id: string | number } ] | string | number | { id: string | number }, options?: RouteQueryOptions) => {
    if (typeof args === 'string' || typeof args === 'number') {
        args = { project_document: args }
    }

    if (typeof args === 'object' && !Array.isArray(args) && 'id' in args) {
        args = { project_document: args.id }
    }

    if (Array.isArray(args)) {
        args = {
            project_document: args[0],
        }
    }

    args = applyUrlDefaults(args)

    const parsedArgs = {
        project_document: typeof args.project_document === 'object'
        ? args.project_document.id
        : args.project_document,
    }

    return update.definition.url
            .replace('{project_document}', parsedArgs.project_document.toString())
            .replace(/\/+$/, '') + queryParams(options)
}

/**
* @see \App\Http\Controllers\ProjectDocumentController::update
* @see workspace/scratch/40cc43c72aeb/JaiRoadV2-Integration/app/Http/Controllers/ProjectDocumentController.php:90
* @route '/project-documents/{project_document}'
*/
update.put = (args: { project_document: string | number | { id: string | number } } | [project_document: string | number | { id: string | number } ] | string | number | { id: string | number }, options?: RouteQueryOptions): RouteDefinition<'put'> => ({
    url: update.url(args, options),
    method: 'put',
})

/**
* @see \App\Http\Controllers\ProjectDocumentController::update
* @see workspace/scratch/40cc43c72aeb/JaiRoadV2-Integration/app/Http/Controllers/ProjectDocumentController.php:90
* @route '/project-documents/{project_document}'
*/
update.patch = (args: { project_document: string | number | { id: string | number } } | [project_document: string | number | { id: string | number } ] | string | number | { id: string | number }, options?: RouteQueryOptions): RouteDefinition<'patch'> => ({
    url: update.url(args, options),
    method: 'patch',
})

/**
* @see \App\Http\Controllers\ProjectDocumentController::update
* @see workspace/scratch/40cc43c72aeb/JaiRoadV2-Integration/app/Http/Controllers/ProjectDocumentController.php:90
* @route '/project-documents/{project_document}'
*/
const updateForm = (args: { project_document: string | number | { id: string | number } } | [project_document: string | number | { id: string | number } ] | string | number | { id: string | number }, options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: update.url(args, {
        [options?.mergeQuery ? 'mergeQuery' : 'query']: {
            _method: 'PUT',
            ...(options?.query ?? options?.mergeQuery ?? {}),
        }
    }),
    method: 'post',
})

/**
* @see \App\Http\Controllers\ProjectDocumentController::update
* @see workspace/scratch/40cc43c72aeb/JaiRoadV2-Integration/app/Http/Controllers/ProjectDocumentController.php:90
* @route '/project-documents/{project_document}'
*/
updateForm.put = (args: { project_document: string | number | { id: string | number } } | [project_document: string | number | { id: string | number } ] | string | number | { id: string | number }, options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: update.url(args, {
        [options?.mergeQuery ? 'mergeQuery' : 'query']: {
            _method: 'PUT',
            ...(options?.query ?? options?.mergeQuery ?? {}),
        }
    }),
    method: 'post',
})

/**
* @see \App\Http\Controllers\ProjectDocumentController::update
* @see workspace/scratch/40cc43c72aeb/JaiRoadV2-Integration/app/Http/Controllers/ProjectDocumentController.php:90
* @route '/project-documents/{project_document}'
*/
updateForm.patch = (args: { project_document: string | number | { id: string | number } } | [project_document: string | number | { id: string | number } ] | string | number | { id: string | number }, options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
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
* @see \App\Http\Controllers\ProjectDocumentController::destroy
* @see workspace/scratch/40cc43c72aeb/JaiRoadV2-Integration/app/Http/Controllers/ProjectDocumentController.php:105
* @route '/project-documents/{project_document}'
*/
export const destroy = (args: { project_document: string | number | { id: string | number } } | [project_document: string | number | { id: string | number } ] | string | number | { id: string | number }, options?: RouteQueryOptions): RouteDefinition<'delete'> => ({
    url: destroy.url(args, options),
    method: 'delete',
})

destroy.definition = {
    methods: ["delete"],
    url: '/project-documents/{project_document}',
} satisfies RouteDefinition<["delete"]>

/**
* @see \App\Http\Controllers\ProjectDocumentController::destroy
* @see workspace/scratch/40cc43c72aeb/JaiRoadV2-Integration/app/Http/Controllers/ProjectDocumentController.php:105
* @route '/project-documents/{project_document}'
*/
destroy.url = (args: { project_document: string | number | { id: string | number } } | [project_document: string | number | { id: string | number } ] | string | number | { id: string | number }, options?: RouteQueryOptions) => {
    if (typeof args === 'string' || typeof args === 'number') {
        args = { project_document: args }
    }

    if (typeof args === 'object' && !Array.isArray(args) && 'id' in args) {
        args = { project_document: args.id }
    }

    if (Array.isArray(args)) {
        args = {
            project_document: args[0],
        }
    }

    args = applyUrlDefaults(args)

    const parsedArgs = {
        project_document: typeof args.project_document === 'object'
        ? args.project_document.id
        : args.project_document,
    }

    return destroy.definition.url
            .replace('{project_document}', parsedArgs.project_document.toString())
            .replace(/\/+$/, '') + queryParams(options)
}

/**
* @see \App\Http\Controllers\ProjectDocumentController::destroy
* @see workspace/scratch/40cc43c72aeb/JaiRoadV2-Integration/app/Http/Controllers/ProjectDocumentController.php:105
* @route '/project-documents/{project_document}'
*/
destroy.delete = (args: { project_document: string | number | { id: string | number } } | [project_document: string | number | { id: string | number } ] | string | number | { id: string | number }, options?: RouteQueryOptions): RouteDefinition<'delete'> => ({
    url: destroy.url(args, options),
    method: 'delete',
})

/**
* @see \App\Http\Controllers\ProjectDocumentController::destroy
* @see workspace/scratch/40cc43c72aeb/JaiRoadV2-Integration/app/Http/Controllers/ProjectDocumentController.php:105
* @route '/project-documents/{project_document}'
*/
const destroyForm = (args: { project_document: string | number | { id: string | number } } | [project_document: string | number | { id: string | number } ] | string | number | { id: string | number }, options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: destroy.url(args, {
        [options?.mergeQuery ? 'mergeQuery' : 'query']: {
            _method: 'DELETE',
            ...(options?.query ?? options?.mergeQuery ?? {}),
        }
    }),
    method: 'post',
})

/**
* @see \App\Http\Controllers\ProjectDocumentController::destroy
* @see workspace/scratch/40cc43c72aeb/JaiRoadV2-Integration/app/Http/Controllers/ProjectDocumentController.php:105
* @route '/project-documents/{project_document}'
*/
destroyForm.delete = (args: { project_document: string | number | { id: string | number } } | [project_document: string | number | { id: string | number } ] | string | number | { id: string | number }, options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: destroy.url(args, {
        [options?.mergeQuery ? 'mergeQuery' : 'query']: {
            _method: 'DELETE',
            ...(options?.query ?? options?.mergeQuery ?? {}),
        }
    }),
    method: 'post',
})

destroy.form = destroyForm

const ProjectDocumentController = { index, create, store, show, edit, update, destroy }

export default ProjectDocumentController