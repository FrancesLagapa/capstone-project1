<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\StaffAssignment;
use Illuminate\Http\Request;

class StaffAssignmentController extends Controller
{
    public function index(Request $request)
    {
        $query = StaffAssignment::with(['user', 'branch']);

        if ($request->filled('user_id')) {
            $query->where('user_id', $request->user_id);
        }

        if ($request->filled('branch_id')) {
            $query->where('branch_id', $request->branch_id);
        }

        if ($request->has('is_active')) {
            $query->where('is_active', filter_var($request->is_active, FILTER_VALIDATE_BOOLEAN));
        }

        $paginate = !$request->has('paginate') || $request->paginate !== 'false';
        $perPage = $request->has('per_page') ? (int)$request->per_page : 5;

        if ($paginate) {
            return response()->json($query->latest()->paginate($perPage));
        }

        return response()->json($query->latest()->get());
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'user_id'    => 'required|exists:users,id',
            'branch_id'  => 'required|exists:branches,id',
            'position'   => 'nullable|string|max:255',
            'daily_rate' => 'nullable|numeric|min:0',
            'is_active'  => 'sometimes|boolean',
        ]);

        // Deactivate any existing active assignment for this user (reassignment)
        StaffAssignment::where('user_id', $validated['user_id'])
            ->where('is_active', true)
            ->update(['is_active' => false]);

        $assignment = StaffAssignment::create([
            'user_id'    => $validated['user_id'],
            'branch_id'  => $validated['branch_id'],
            'position'   => $validated['position'] ?? 'Staff',
            'daily_rate' => $validated['daily_rate'] ?? 500.00,
            'is_active'  => $validated['is_active'] ?? true,
        ]);

        return response()->json($assignment->load(['user', 'branch']), 201);
    }

    public function show($id)
    {
        $assignment = StaffAssignment::with(['user', 'branch'])->find($id);
        if (!$assignment) {
            return response()->json(['message' => 'Assignment not found.'], 404);
        }
        return response()->json($assignment);
    }

    public function update(Request $request, $id)
    {
        $assignment = StaffAssignment::find($id);
        if (!$assignment) {
            return response()->json(['message' => 'Assignment not found.'], 404);
        }

        $validated = $request->validate([
            'user_id'    => 'sometimes|exists:users,id',
            'branch_id'  => 'sometimes|exists:branches,id',
            'position'   => 'nullable|string|max:255',
            'daily_rate' => 'nullable|numeric|min:0',
            'is_active'  => 'sometimes|boolean',
        ]);

        // If activating this assignment, deactivate any other active ones for the same user
        if (isset($validated['is_active']) && $validated['is_active']) {
            StaffAssignment::where('user_id', $validated['user_id'] ?? $assignment->user_id)
                ->where('is_active', true)
                ->where('id', '!=', $id)
                ->update(['is_active' => false]);
        }

        $assignment->update($validated);

        return response()->json($assignment->load(['user', 'branch']));
    }

    public function destroy($id)
    {
        $assignment = StaffAssignment::find($id);
        if (!$assignment) {
            return response()->json(['message' => 'Assignment not found.'], 404);
        }

        $assignment->delete();

        return response()->json(['message' => 'Assignment deleted successfully.']);
    }

    public function getUserAssignment($userId)
    {
        $assignment = StaffAssignment::with('branch')
            ->where('user_id', $userId)
            ->where('is_active', true)
            ->latest()
            ->first();

        if (!$assignment) {
            return response()->json([
                'message' => 'No active branch assignment found for this staff member.',
            ], 404);
        }

        return response()->json($assignment);
    }
}