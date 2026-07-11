<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Reservation;
use App\Models\ProductStock;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ReservationController extends Controller
{
    // ── customer endpoints ──

    public function index(Request $request)
    {
        $reservations = Reservation::with(['branch'])
            ->where('user_id', $request->user()->id)
            ->orderBy('created_at', 'desc')
            ->paginate(20);

        return response()->json($reservations);
    }

    public function show(Request $request, $id)
    {
        $reservation = Reservation::with(['branch'])
            ->where('user_id', $request->user()->id)
            ->findOrFail($id);

        return response()->json($reservation);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'branch_id' => 'required|exists:branches,id',
            'pickup_date' => 'required|date|after_or_equal:today',
            'items' => 'required|array|min:1',
            'items.*.product_id' => 'required|exists:products,id',
            'items.*.name' => 'required|string|max:255',
            'items.*.quantity' => 'required|numeric|min:0.01',
            'items.*.price' => 'required|numeric|min:0',
            'notes' => 'nullable|string|max:1000',
        ]);

        $user = $request->user();

        $subtotal = 0;
        foreach ($validated['items'] as $item) {
            $subtotal += $item['price'] * $item['quantity'];
        }

        $reservationNumber = 'RES-' . now()->format('Ymd') . '-' . strtoupper(substr(uniqid(), -6));

        $reservation = Reservation::create([
            'reservation_number' => $reservationNumber,
            'user_id' => $user->id,
            'branch_id' => $validated['branch_id'],
            'pickup_date' => $validated['pickup_date'],
            'status' => 'pending',
            'notes' => $validated['notes'] ?? null,
            'items' => $validated['items'],
            'subtotal' => $subtotal,
            'total' => $subtotal,
        ]);

        return response()->json(
            Reservation::with(['branch'])->find($reservation->id),
            201
        );
    }

    public function cancel(Request $request, $id)
    {
        $reservation = Reservation::where('user_id', $request->user()->id)->findOrFail($id);

        if (!in_array($reservation->status, ['pending', 'confirmed'])) {
            return response()->json(['message' => 'Reservation cannot be cancelled'], 400);
        }

        $reservation->update(['status' => 'cancelled']);

        return response()->json($reservation->fresh(['branch']));
    }

    // ── admin endpoints ──

    private const VALID_STATUSES = ['pending', 'confirmed', 'ready', 'picked_up', 'cancelled'];

    public function adminIndex(Request $request)
    {
        $validated = $request->validate([
            'branch_id' => 'nullable|exists:branches,id',
            'status' => 'nullable|string|in:' . implode(',', self::VALID_STATUSES),
            'date_from' => 'nullable|date',
            'date_to' => 'nullable|date|after_or_equal:date_from',
            'search' => 'nullable|string|max:100',
            'per_page' => 'nullable|integer|min:1|max:100',
        ]);

        $query = Reservation::with(['branch', 'user']);

        if ($request->filled('branch_id')) {
            $query->where('branch_id', $validated['branch_id']);
        }

        if ($request->filled('status')) {
            $query->where('status', $validated['status']);
        }

        if ($request->filled('date_from')) {
            $query->whereDate('pickup_date', '>=', $validated['date_from']);
        }

        if ($request->filled('date_to')) {
            $query->whereDate('pickup_date', '<=', $validated['date_to']);
        }

        if ($request->filled('search')) {
            $search = $validated['search'];
            $query->where(function ($q) use ($search) {
                $q->where('reservation_number', 'like', "%{$search}%")
                  ->orWhereHas('user', function ($uq) use ($search) {
                      $uq->where('firstname', 'like', "%{$search}%")
                         ->orWhere('lastname', 'like', "%{$search}%");
                  });
            });
        }

        $perPage = $validated['per_page'] ?? 15;
        $reservations = $query->orderBy('created_at', 'desc')->paginate($perPage);

        return response()->json($reservations);
    }

    public function adminShow($id)
    {
        $reservation = Reservation::with(['branch', 'user'])->findOrFail($id);
        return response()->json($reservation);
    }

    public function confirm($id)
    {
        $reservation = Reservation::findOrFail($id);

        if ($reservation->status !== 'pending') {
            return response()->json(['message' => 'Only pending reservations can be confirmed'], 400);
        }

        $reservation->update(['status' => 'confirmed']);

        return response()->json(Reservation::with(['branch', 'user'])->find($reservation->id));
    }

    public function markReady($id)
    {
        $reservation = Reservation::findOrFail($id);

        if ($reservation->status !== 'confirmed') {
            return response()->json(['message' => 'Only confirmed reservations can be marked ready'], 400);
        }

        $reservation->update(['status' => 'ready']);

        return response()->json(Reservation::with(['branch', 'user'])->find($reservation->id));
    }

    public function markPickedUp($id)
    {
        $reservation = Reservation::findOrFail($id);

        if ($reservation->status !== 'ready') {
            return response()->json(['message' => 'Only ready reservations can be marked picked up'], 400);
        }

        $reservation->update(['status' => 'picked_up']);

        return response()->json(Reservation::with(['branch', 'user'])->find($reservation->id));
    }

    public function adminCancel($id)
    {
        $reservation = Reservation::findOrFail($id);

        if (!in_array($reservation->status, ['pending', 'confirmed'])) {
            return response()->json(['message' => 'Reservation cannot be cancelled at this stage'], 400);
        }

        $reservation->update(['status' => 'cancelled']);

        return response()->json(Reservation::with(['branch', 'user'])->find($reservation->id));
    }
}
