<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Branch;
use App\Models\SalesTarget;
use Illuminate\Http\Request;

class SalesTargetController extends Controller
{
    public function index(Request $request)
    {
        $query = SalesTarget::with(['branch', 'user']);

        if ($request->filled('month')) {
            $query->where('month', $request->month);
        }
        if ($request->filled('branch_id')) {
            $query->where('branch_id', $request->branch_id);
        }
        if ($request->filled('user_id')) {
            $query->where('user_id', $request->user_id);
        }

        $targets = $query->orderBy('month', 'desc')->get();

        return response()->json(['data' => $targets]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'branch_id'       => 'nullable|exists:branches,id',
            'user_id'         => 'nullable|exists:users,id',
            'month'           => 'required|string|regex:/^\d{4}-\d{2}$/',
            'target_products' => 'required|integer|min:1',
        ]);

        if (empty($validated['branch_id']) && empty($validated['user_id'])) {
            return response()->json(['message' => 'At least one of branch_id or user_id is required.'], 422);
        }

        $existing = SalesTarget::where('month', $validated['month'])
            ->where('branch_id', $validated['branch_id'] ?? null)
            ->where('user_id', $validated['user_id'] ?? null)
            ->first();

        if ($existing) {
            $existing->update($validated);
            return response()->json(['data' => $existing->fresh()->load(['branch', 'user']), 'message' => 'Target updated.']);
        }

        $target = SalesTarget::create($validated);
        return response()->json(['data' => $target->load(['branch', 'user']), 'message' => 'Target created.'], 201);
    }

    public function bulkStore(Request $request)
    {
        $validated = $request->validate([
            'month'           => 'required|string|regex:/^\d{4}-\d{2}$/',
            'target_products' => 'required|integer|min:1',
        ]);

        $branches = Branch::where('is_active', true)->get();
        $created = 0;
        $updated = 0;

        foreach ($branches as $branch) {
            $existing = SalesTarget::where('month', $validated['month'])
                ->where('branch_id', $branch->id)
                ->whereNull('user_id')
                ->first();

            if ($existing) {
                $existing->update([
                    'target_products' => $validated['target_products'],
                ]);
                $updated++;
            } else {
                SalesTarget::create([
                    'branch_id'       => $branch->id,
                    'user_id'         => null,
                    'month'           => $validated['month'],
                    'target_products' => $validated['target_products'],
                ]);
                $created++;
            }
        }

        $targets = SalesTarget::with(['branch', 'user'])
            ->where('month', $validated['month'])
            ->whereNull('user_id')
            ->get();

        return response()->json([
            'data'    => $targets,
            'message' => "Done. {$created} created, {$updated} updated across {$branches->count()} branches.",
        ]);
    }

    public function update(Request $request, $id)
    {
        $target = SalesTarget::findOrFail($id);

        $validated = $request->validate([
            'branch_id'       => 'nullable|exists:branches,id',
            'user_id'         => 'nullable|exists:users,id',
            'month'           => 'required|string|regex:/^\d{4}-\d{2}$/',
            'target_products' => 'required|integer|min:1',
        ]);

        $target->update($validated);
        return response()->json(['data' => $target->fresh()->load(['branch', 'user']), 'message' => 'Target updated.']);
    }

    public function destroy($id)
    {
        $target = SalesTarget::findOrFail($id);
        $target->delete();
        return response()->json(['message' => 'Target deleted.']);
    }
}
