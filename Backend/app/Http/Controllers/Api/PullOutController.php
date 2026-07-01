<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\PullOut;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class PullOutController extends Controller
{
    /**
     * Get pull-outs for the authenticated user
     */
    public function index(Request $request)
    {
        $user = $request->user();
        
        $pullOuts = PullOut::where('user_id', $user->id)
            ->with(['user', 'product', 'branch', 'approver', 'rejecter'])
            ->orderBy('pulled_out_at', 'desc')
            ->paginate(5);

        return response()->json($pullOuts);
    }

    /**
     * Get all pull-outs (for admin)
     */
    public function getall(Request $request)
    {
        $query = PullOut::with(['user', 'product', 'branch', 'approver', 'rejecter'])
            ->orderBy('pulled_out_at', 'desc');

        if ($request->has('branch_id')) {
            $query->where('branch_id', $request->branch_id);
        }

        $pullOuts = $query->paginate(5);

        return response()->json($pullOuts);
    }

    /**
     * Store a new pull-out (pending approval)
     */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'product_id' => 'required|exists:products,id',
            'quantity' => 'required|numeric|min:0.01',
            'notes' => 'nullable|string|max:1000',
        ]);

        try {
            $user = $request->user();
            
            // Get the user's active staff assignment branch
            $staffAssignment = \App\Models\StaffAssignment::where('user_id', $user->id)
                ->where('is_active', true)
                ->first();

            if (!$staffAssignment) {
                return response()->json(['message' => 'No active branch assignment found for user'], 400);
            }

            // Create pull-out record with pending status
            $pullOut = PullOut::create([
                'user_id' => $user->id,
                'product_id' => $validated['product_id'],
                'branch_id' => $staffAssignment->branch_id,
                'quantity' => $validated['quantity'],
                'notes' => $validated['notes'] ?? null,
                'status' => 'pending',
                'pulled_out_at' => now(),
            ]);

            return response()->json($pullOut->load(['user', 'product', 'branch']), 201);
        } catch (\Exception $e) {
            return response()->json(['message' => 'Failed to create pull-out', 'error' => $e->getMessage()], 500);
        }
    }

    /**
     * Get a specific pull-out
     */
    public function show($id)
    {
        try {
            $pullOut = PullOut::with(['user', 'product', 'branch', 'approver', 'rejecter'])
                ->findOrFail($id);

            return response()->json($pullOut);
        } catch (\Exception $e) {
            return response()->json(['message' => 'Pull-out not found'], 404);
        }
    }

    /**
     * Get pull-out statistics for a user
     */
    public function statistics(Request $request)
    {
        $user = $request->user();

        $stats = [
            'total_pulled_out' => PullOut::where('user_id', $user->id)->count(),
            'total_quantity' => PullOut::where('user_id', $user->id)->sum('quantity'),
        ];

        return response()->json($stats);
    }

    /**
     * Approve a pull-out (admin only)
     */
    public function approve(Request $request, $id)
    {
        $admin = $request->user();

        try {
            $pullOut = PullOut::findOrFail($id);

            if ($pullOut->status !== 'pending') {
                return response()->json(['message' => 'Pull-out can only be approved if pending'], 400);
            }

            DB::beginTransaction();
            
            $pullOut->update([
                'status' => 'approved',
                'approved_at' => now(),
                'approved_by' => $admin->id,
                'admin_notes' => $request->admin_notes ?? null,
            ]);

            DB::commit();

            return response()->json($pullOut->load(['user', 'product', 'branch', 'approver', 'rejecter']));
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['message' => 'Failed to approve pull-out', 'error' => $e->getMessage()], 500);
        }
    }

    /**
     * Reject a pull-out (admin only)
     */
    public function reject(Request $request, $id)
    {
        $admin = $request->user();

        try {
            $pullOut = PullOut::findOrFail($id);

            if ($pullOut->status !== 'pending') {
                return response()->json(['message' => 'Pull-out can only be rejected if pending'], 400);
            }

            $pullOut->update([
                'status' => 'rejected',
                'rejected_at' => now(),
                'rejected_by' => $admin->id,
                'admin_notes' => $request->admin_notes ?? null,
            ]);

            return response()->json($pullOut->load(['user', 'product', 'branch', 'approver', 'rejecter']));
        } catch (\Exception $e) {
            return response()->json(['message' => 'Failed to reject pull-out', 'error' => $e->getMessage()], 500);
        }
    }
}
