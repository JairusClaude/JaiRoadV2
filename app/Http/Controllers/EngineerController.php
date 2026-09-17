<?php

namespace App\Http\Controllers;

use App\Models\Engineer;
use App\Http\Requests\StoreEngineerRequest;
use App\Http\Requests\UpdateEngineerRequest;

class EngineerController extends Controller
{
    /**
     * Display a listing of the resource.
     */
    public function index()
    {
        //
    }

    /**
     * Show the form for creating a new resource.
     */
    public function create()
    {
        //
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(StoreEngineerRequest $request)
    {
        //
    }

    /**
     * Display the specified resource.
     */
    public function show(Engineer $engineer)
    {
        //
    }

    /**
     * Show the form for editing the specified resource.
     */
    public function edit(Engineer $engineer)
    {
        //
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(UpdateEngineerRequest $request, Engineer $engineer)
    {
        //
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(Engineer $engineer)
    {
        //
    }
}
