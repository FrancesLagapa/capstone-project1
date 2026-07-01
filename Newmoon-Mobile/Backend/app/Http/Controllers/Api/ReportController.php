<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Attendance;
use App\Models\Product;
use App\Models\ProductStock;
use App\Models\PullOut;
use App\Models\PullOutItem;
use App\Models\Sale;
use App\Models\SaleItem;
use App\Models\StaffAssignment;
use App\Models\StaffDeduction;
use App\Models\StaffIncentive;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

class ReportController extends Controller
{
    /**
     * Sales Report
     * GET /api/reports/sales
     * Params: start_date, end_date, group_by (daily, weekly, monthly, detail), branch_id
     */
    public function sales(Request $request)
    {
        $validated = $request->validate([
            'start_date' => 'required|date',
            'end_date' => 'required|date',
            'group_by' => 'required|in:daily,weekly,monthly,detail',
            'branch_id' => 'nullable|exists:branches,id',
            'page' => 'nullable|integer|min:1',
            'per_page' => 'nullable|integer|min:1|max:100',
        ]);

        $perPage = $validated['per_page'] ?? 5;
        $page = $validated['page'] ?? 1;

        $query = Sale::with(['user', 'branch', 'items.product'])
            ->whereBetween('sale_date', [$validated['start_date'], $validated['end_date']]);

        if ($request->has('branch_id')) {
            $query->where('branch_id', $validated['branch_id']);
        }

        $groupBy = $validated['group_by'];

        if ($groupBy === 'detail') {
            $sales = $query->orderBy('sale_date', 'desc')->paginate($perPage, ['*'], 'page', $page);
            return response()->json([
                'data' => $sales->items(),
                'pagination' => [
                    'current_page' => $sales->currentPage(),
                    'last_page' => $sales->lastPage(),
                    'per_page' => $sales->perPage(),
                    'total' => $sales->total(),
                ],
                'summary' => [
                    'total_sales' => $sales->sum('total'),
                    'total_transactions' => $sales->total(),
                    'total_items_sold' => $sales->getCollection()->sum(function ($sale) {
                        return $sale->items->sum('quantity');
                    }),
                ],
            ]);
        }

        // Grouped reports
        $dateFormat = $groupBy === 'daily' ? '%Y-%m-%d' : 
                     ($groupBy === 'weekly' ? '%Y-%u' : '%Y-%m');

        $groupedData = DB::table('sales')
            ->select(
                DB::raw("DATE_FORMAT(sale_date, '$dateFormat') as period"),
                DB::raw('COUNT(*) as transaction_count'),
                DB::raw('SUM(total) as total_sales'),
                DB::raw('SUM(subtotal) as subtotal'),
                DB::raw('SUM(discount_amount) as discount_amount'),
                DB::raw('SUM(senior_discount) as senior_discount_count')
            )
            ->whereBetween('sale_date', [$validated['start_date'], $validated['end_date']])
            ->when($request->has('branch_id'), fn ($q) => $q->where('branch_id', $validated['branch_id']))
            ->groupBy(DB::raw("DATE_FORMAT(sale_date, '$dateFormat')"))
            ->orderBy('period')
            ->get();

        // Get items sold per period
        $itemsPerPeriod = DB::table('sale_items')
            ->join('sales', 'sale_items.sale_id', '=', 'sales.id')
            ->select(
                DB::raw("DATE_FORMAT(sales.sale_date, '$dateFormat') as period"),
                DB::raw('SUM(sale_items.quantity) as total_items')
            )
            ->whereBetween('sales.sale_date', [$validated['start_date'], $validated['end_date']])
            ->when($request->has('branch_id'), fn ($q) => $q->where('sales.branch_id', $validated['branch_id']))
            ->groupBy(DB::raw("DATE_FORMAT(sales.sale_date, '$dateFormat')"))
            ->get()
            ->keyBy('period');

        $result = $groupedData->map(function ($item) use ($itemsPerPeriod) {
            $itemsData = $itemsPerPeriod->get($item->period);
            return [
                'period' => $item->period,
                'transaction_count' => (int) $item->transaction_count,
                'total_sales' => (float) $item->total_sales,
                'subtotal' => (float) $item->subtotal,
                'discount_amount' => (float) $item->discount_amount,
                'senior_discount_count' => (int) $item->senior_discount_count,
                'total_items' => $itemsData ? (float) $itemsData->total_items : 0,
            ];
        });

        return response()->json([
            'data' => $result,
            'summary' => [
                'total_sales' => $groupedData->sum('total_sales'),
                'total_transactions' => $groupedData->sum('transaction_count'),
                'total_items_sold' => $itemsPerPeriod->sum('total_items'),
            ],
        ]);
    }

    /**
     * Inventory Report
     * GET /api/reports/inventory
     * Params: branch_id (optional)
     */
    public function inventory(Request $request)
{
    $validated = $request->validate([
        'branch_id' => 'nullable|exists:branches,id',
        'page'      => 'nullable|integer|min:1',
        'per_page'  => 'nullable|integer|min:1|max:100',
    ]);

    $perPage = $validated['per_page'] ?? 15;
    $page    = $validated['page'] ?? 1;

    $query = ProductStock::with(['product', 'branch'])
        ->whereHas('product', fn($q) => $q->where('is_active', true));

    if (!empty($validated['branch_id'])) {
        $query->where('branch_id', $validated['branch_id']);
    }

    // No category filter

    $stocks = $query->paginate($perPage, ['*'], 'page', $page);

    $data = [];
    $totalItems = 0;
    $totalValue = 0;
    $lowStockCount = 0;
    $outOfStockCount = 0;

    foreach ($stocks as $stock) {
        $product = $stock->product;
        $quantity = (float) $stock->quantity;
        $unitCost = (float) $product->price;
        $totalValueRow = $quantity * $unitCost;
        $minStock = (float) $stock->minimum_stock;

        if ($quantity <= 0) {
            $status = 'Out of Stock';
            $outOfStockCount++;
        } elseif ($quantity < $minStock) {
            $status = 'Low Stock';
            $lowStockCount++;
        } else {
            $status = 'In Stock';
        }

        $data[] = [
            'id'            => $stock->id,
            'product_id'    => $product->id,
            'name'          => $product->name,
            'sku'           => $product->sku ?? '',
            'category_name' => $product->category ?? 'Uncategorized',
            'branch_id'     => $stock->branch_id,
            'branch_name'   => $stock->branch->name ?? 'Unknown',
            'current_stock' => $quantity,
            'reorder_level' => $minStock,
            'unit_cost'     => $unitCost,
            'total_value'   => $totalValueRow,
            'status'        => $status,
            'is_low_stock'  => $status === 'Low Stock',
        ];

        $totalItems += $quantity;
        $totalValue += $totalValueRow;
    }

    return response()->json([
        'data' => $data,
        'pagination' => [
            'current_page' => $stocks->currentPage(),
            'last_page'    => $stocks->lastPage(),
            'per_page'     => $stocks->perPage(),
            'total'        => $stocks->total(),
        ],
        'summary' => [
            'total_items'       => $totalItems,
            'total_value'       => $totalValue,
            'low_stock_items'   => $lowStockCount,
            'out_of_stock_items'=> $outOfStockCount,
            'total_products'    => $stocks->total(),
        ],
    ]);
}

    /**
     * Attendance Report
     * GET /api/reports/attendance
     * Params: start_date, end_date, branch_id (optional)
     */
    public function attendance(Request $request)
{
    $validated = $request->validate([
        'start_date' => 'required|date',
        'end_date'   => 'required|date',
        'branch_id'  => 'nullable|exists:branches,id',
        'user_id'    => 'nullable|exists:users,id',
        'page'       => 'nullable|integer|min:1',
        'per_page'   => 'nullable|integer|min:1|max:100',
    ]);

    $perPage = $validated['per_page'] ?? 5;
    $page    = $validated['page'] ?? 1;

    // Eager load user, branch, and branchAssignments (correct relation name)
    $query = Attendance::with(['user', 'branch', 'user.branchAssignments'])
        ->whereBetween('date', [$validated['start_date'], $validated['end_date']]);

    if (!empty($validated['branch_id'])) {
        $query->where('branch_id', $validated['branch_id']);
    }
    if (!empty($validated['user_id'])) {
        $query->where('user_id', $validated['user_id']);
    }

    $attendance = $query->orderBy('date', 'desc')->paginate($perPage, ['*'], 'page', $page);

    // Transform each record
    $transformed = $attendance->items()->map(function ($record) {
        $user = $record->user;
        $name = $user ? ($user->firstname . ' ' . $user->lastname) : 'Unknown';
        // Get position from first active branch assignment
        $position = 'Staff';
        if ($user && $user->branchAssignments) {
            $assignment = $user->branchAssignments->first();
            if ($assignment) {
                $position = $assignment->position ?? 'Staff';
            }
        }
        return [
            'id'           => $record->id,
            'date'         => $record->date,
            'staff_name'   => $name,
            'position'     => $position,
            'time_in'      => $record->time_in,
            'time_out'     => $record->time_out,
            'duration'     => $record->hours_worked ?? 0,
            'status'       => $record->status ?? 'absent',
            'is_late'      => $record->is_late ?? false,
            'late_minutes' => $record->late_minutes ?? 0,
            'branch_name'  => $record->branch->name ?? 'N/A',
        ];
    });

    // Staff summary (group by user)
    $staffSummary = [];
    $grouped = $attendance->getCollection()->groupBy('user_id');
    foreach ($grouped as $userId => $records) {
        $first = $records->first();
        $user = $first->user;
        $name = $user ? ($user->firstname . ' ' . $user->lastname) : 'Unknown';
        $daysPresent = $records->filter(fn($r) => in_array($r->status, ['present', 'completed', 'completed_late']))->count();
        $daysLate = $records->filter(fn($r) => $r->is_late)->count();
        $daysAbsent = $records->filter(fn($r) => $r->status === 'absent')->count();
        $totalHours = $records->sum('hours_worked');
        $totalDays = $records->count();
        $rate = $totalDays > 0 ? round(($daysPresent / $totalDays) * 100, 2) : 0;
        $staffSummary[] = [
            'staff_id'        => $userId,
            'staff_name'      => $name,
            'days_present'    => $daysPresent,
            'days_late'       => $daysLate,
            'days_absent'     => $daysAbsent,
            'total_hours'     => $totalHours,
            'attendance_rate' => $rate,
        ];
    }

    // Overall summary
    $totalRecords = $attendance->total();
    $presentCount = $attendance->getCollection()->filter(fn($r) => in_array($r->status, ['present', 'completed', 'completed_late']))->count();
    $lateCount = $attendance->getCollection()->filter(fn($r) => $r->is_late)->count();
    $absentCount = $attendance->getCollection()->filter(fn($r) => $r->status === 'absent')->count();
    $totalHours = $attendance->getCollection()->sum('hours_worked');

    return response()->json([
        'data' => $transformed,
        'pagination' => [
            'current_page' => $attendance->currentPage(),
            'last_page'    => $attendance->lastPage(),
            'per_page'     => $attendance->perPage(),
            'total'        => $attendance->total(),
        ],
        'summary' => [
            'total_days'      => $totalRecords,
            'total_present'   => $presentCount,
            'total_late'      => $lateCount,
            'total_absent'    => $absentCount,
            'attendance_rate' => $totalRecords > 0 ? round(($presentCount / $totalRecords) * 100, 2) : 0,
            'staff_summary'   => $staffSummary,
        ],
    ]);
}

    /**
     * Payroll Report
     * GET /api/reports/payroll
     * Params: month (YYYY-MM), branch_id (optional)
     */
    public function payroll(Request $request)
    {
        $validated = $request->validate([
            'month' => ['required', 'regex:/^\d{4}-\d{2}$/'],
            'branch_id' => 'nullable|exists:branches,id',
            'page' => 'nullable|integer|min:1',
            'per_page' => 'nullable|integer|min:1|max:100',
        ]);

        $perPage = $validated['per_page'] ?? 5;
        $page = $validated['page'] ?? 1;

        $monthStr = $validated['month'];
        $start = Carbon::createFromFormat('Y-m', $monthStr)->startOfMonth()->toDateString();
        $end = Carbon::createFromFormat('Y-m', $monthStr)->endOfMonth()->toDateString();
        $monthNum = (int) Carbon::createFromFormat('Y-m', $monthStr)->month;
        $yearNum = (int) Carbon::createFromFormat('Y-m', $monthStr)->year;

        $query = Attendance::with(['user.branchAssignments', 'branch'])
            ->whereBetween('date', [$start, $end]);

        if ($request->has('branch_id')) {
            $query->where('branch_id', $validated['branch_id']);
        }

        $attendance = $query->get();

        // Bulk-load deductions & incentives for the month
        $userIds = $attendance->pluck('user_id')->unique()->filter()->values();
        $deductionsByUser = StaffDeduction::whereIn('user_id', $userIds)
            ->where('month', $monthNum)
            ->where('year', $yearNum)
            ->get()
            ->keyBy('user_id');

        $incentivesByUser = StaffIncentive::whereIn('user_id', $userIds)
            ->where('month', $monthNum)
            ->where('year', $yearNum)
            ->get()
            ->keyBy('user_id');

        // Group by user for payroll summary
        $payrollByUser = [];
        foreach ($attendance as $record) {
            $userId = $record->user_id;
            $assignment = $record->user->branchAssignments->first();
            $dailyRate = $assignment ? $assignment->daily_rate : 500;

            // Calculate hours worked
            if ($record->time_in && $record->time_out) {
                $timeIn = Carbon::parse($record->time_in);
                $timeOut = Carbon::parse($record->time_out);
                $hoursWorked = $timeIn->diffInHours($timeOut);
            } else {
                $hoursWorked = 0;
            }

            // Calculate earnings (12-hour workday: 9 AM to 9 PM)
            if ($hoursWorked <= 12) {
                $dailyEarnings = ($hoursWorked / 12) * $dailyRate;
            } else {
                $overtimeHours = $hoursWorked - 12;
                $overtimeRate = ($dailyRate / 12) * 1.25;
                $dailyEarnings = $dailyRate + ($overtimeHours * $overtimeRate);
            }

            // Get deductions and incentives for the month
            $deductions = $deductionsByUser->get($userId);
            $incentives = $incentivesByUser->get($userId);

            // Calculate daily deductions
            $dailyDeductions = 0;
            if ($deductions) {
                $dailyDeductions += ($deductions->sss / 22);
                $dailyDeductions += ($deductions->philhealth / 22);
                $dailyDeductions += ($deductions->pagibig / 22);
                $dailyDeductions += ($deductions->cash_advance / 22);
            }

            // Late deductions
            if ($record->is_late) {
                $dailyDeductions += $record->late_minutes * 5;
            }

            // Daily incentives
            $dailyIncentives = 0;
            if ($incentives && $incentives->perfect_attendance && !$record->is_late) {
                $dailyIncentives += 500 / 22;
            }

            $netPay = $dailyEarnings - $dailyDeductions + $dailyIncentives;

            if (!isset($payrollByUser[$userId])) {
                $payrollByUser[$userId] = [
                    'user_id' => $userId,
                    'staff_name' => $record->user->firstname . ' ' . $record->user->lastname,
                    'position' => $assignment ? $assignment->position : 'Staff',
                    'branch' => $record->branch->name ?? 'N/A',
                    'days_worked' => 0,
                    'total_hours' => 0,
                    'hourly_rate' => $dailyRate / 12,
                    'gross_pay' => 0,
                    'sss_deduction' => 0,
                    'philhealth_deduction' => 0,
                    'pagibig_deduction' => 0,
                    'cash_advance_deduction' => 0,
                    'late_deduction' => 0,
                    'incentives' => 0,
                    'total_deductions' => 0,
                    'net_pay' => 0,
                    'late_count' => 0,
                ];
            }

            $payrollByUser[$userId]['days_worked']++;
            $payrollByUser[$userId]['total_hours'] += $hoursWorked;
            $payrollByUser[$userId]['gross_pay'] += $dailyEarnings;
            
            if ($deductions) {
                $payrollByUser[$userId]['sss_deduction'] += ($deductions->sss / 22);
                $payrollByUser[$userId]['philhealth_deduction'] += ($deductions->philhealth / 22);
                $payrollByUser[$userId]['pagibig_deduction'] += ($deductions->pagibig / 22);
                $payrollByUser[$userId]['cash_advance_deduction'] += ($deductions->cash_advance / 22);
            }
            
            if ($record->is_late) {
                $payrollByUser[$userId]['late_deduction'] += ($record->late_minutes * 5);
                $payrollByUser[$userId]['late_count']++;
            }
            
            $payrollByUser[$userId]['incentives'] += $dailyIncentives;
            $payrollByUser[$userId]['total_deductions'] = $payrollByUser[$userId]['sss_deduction'] + 
                $payrollByUser[$userId]['philhealth_deduction'] + 
                $payrollByUser[$userId]['pagibig_deduction'] + 
                $payrollByUser[$userId]['cash_advance_deduction'] + 
                $payrollByUser[$userId]['late_deduction'];
            $payrollByUser[$userId]['net_pay'] += $netPay;
        }

        $totalPayroll = array_sum(array_column($payrollByUser, 'net_pay'));
        $payrollArray = array_values($payrollByUser);

        // Manual pagination for payroll array
        $offset = ($page - 1) * $perPage;
        $paginatedData = array_slice($payrollArray, $offset, $perPage);
        $total = count($payrollArray);
        $lastPage = (int) ceil($total / $perPage);

        return response()->json([
            'data' => $paginatedData,
            'pagination' => [
                'current_page' => $page,
                'last_page' => $lastPage,
                'per_page' => $perPage,
                'total' => $total,
            ],
            'summary' => [
                'total_staff' => count($payrollByUser),
                'total_payroll' => $totalPayroll,
                'total_hours' => array_sum(array_column($payrollByUser, 'total_hours')),
            ],
        ]);
    }

    /**
     * Branch Report
     * GET /api/reports/branches
     * Params: start_date, end_date (optional)
     */
    public function branches(Request $request)
    {
        $validated = $request->validate([
            'start_date' => 'nullable|date',
            'end_date' => 'nullable|date',
            'page' => 'nullable|integer|min:1',
            'per_page' => 'nullable|integer|min:1|max:100',
        ]);

        $perPage = $validated['per_page'] ?? 5;
        $page = $validated['page'] ?? 1;

        $branches = DB::table('branches')->get();

        $branchData = [];
        foreach ($branches as $branch) {
            $salesQuery = DB::table('sales')->where('branch_id', $branch->id);
            
            if ($request->has('start_date') && $request->has('end_date')) {
                $salesQuery->whereBetween('sale_date', [$validated['start_date'], $validated['end_date']]);
            }

            $totalSales = $salesQuery->sum('total');
            $transactionCount = $salesQuery->count();

            // Get staff count for this branch
            $staffCount = StaffAssignment::where('branch_id', $branch->id)
                ->where('is_active', true)
                ->count();

            // Get inventory count
            $inventoryCount = ProductStock::where('branch_id', $branch->id)
                ->where('quantity', '>', 0)
                ->count();

            $branchData[] = [
                'id' => $branch->id,
                'name' => $branch->name,
                'location' => $branch->location ?? 'N/A',
                'total_sales' => (float) $totalSales,
                'transaction_count' => $transactionCount,
                'staff_count' => $staffCount,
                'inventory_count' => $inventoryCount,
                'average_transaction' => $transactionCount > 0 ? (float) ($totalSales / $transactionCount) : 0,
            ];
        }

        // Sort by total sales descending
        usort($branchData, function ($a, $b) {
            return $b['total_sales'] <=> $a['total_sales'];
        });

        // Manual pagination for branch array
        $offset = ($page - 1) * $perPage;
        $paginatedData = array_slice($branchData, $offset, $perPage);
        $total = count($branchData);
        $lastPage = (int) ceil($total / $perPage);

        return response()->json([
            'data' => $paginatedData,
            'pagination' => [
                'current_page' => $page,
                'last_page' => $lastPage,
                'per_page' => $perPage,
                'total' => $total,
            ],
            'summary' => [
                'total_branches' => count($branchData),
                'total_sales' => array_sum(array_column($branchData, 'total_sales')),
                'total_transactions' => array_sum(array_column($branchData, 'transaction_count')),
            ],
        ]);
    }

    /**
     * Pull-Out Report
     * GET /api/reports/pull-out
     * Params: start_date, end_date, branch_id (optional), status (optional)
     */
    public function pullOut(Request $request)
    {
        $validated = $request->validate([
            'start_date' => 'nullable|date',
            'end_date' => 'nullable|date',
            'branch_id' => 'nullable|exists:branches,id',
            'status' => 'nullable|in:pending,approved,rejected',
            'page' => 'nullable|integer|min:1',
            'per_page' => 'nullable|integer|min:1|max:100',
        ]);

        $perPage = $validated['per_page'] ?? 5;
        $page = $validated['page'] ?? 1;

        $query = PullOut::with(['product', 'branch', 'user']);

        if ($request->has('start_date') && $request->has('end_date')) {
            $query->whereBetween('created_at', [$validated['start_date'], $validated['end_date']]);
        }

        if ($request->has('branch_id')) {
            $query->where('branch_id', $validated['branch_id']);
        }

        if ($request->has('status')) {
            $query->where('status', $validated['status']);
        }

        $pullOuts = $query->orderBy('created_at', 'desc')->paginate($perPage, ['*'], 'page', $page);

        $pendingCount = $pullOuts->getCollection()->where('status', 'pending')->count();
        $approvedCount = $pullOuts->getCollection()->where('status', 'approved')->count();
        $rejectedCount = $pullOuts->getCollection()->where('status', 'rejected')->count();

        $totalItems = $pullOuts->getCollection()->sum('quantity');

        // Transform data to include requested_by name
        $transformedData = $pullOuts->items()->map(function ($pullOut) {
            $productPrice = isset($pullOut->product) && $pullOut->product ? ($pullOut->product->price ?? 0) : 0;
            $userName = isset($pullOut->user) && $pullOut->user ? ($pullOut->user->firstname . ' ' . $pullOut->user->lastname) : 'Unknown';
            $branchName = isset($pullOut->branch) && $pullOut->branch ? $pullOut->branch->name : 'Unknown';
            
            return [
                'id' => $pullOut->id,
                'user_id' => $pullOut->user_id,
                'product_id' => $pullOut->product_id,
                'branch_id' => $pullOut->branch_id,
                'quantity' => $pullOut->quantity,
                'notes' => $pullOut->notes,
                'status' => $pullOut->status,
                'admin_notes' => $pullOut->admin_notes,
                'pulled_out_at' => $pullOut->pulled_out_at,
                'approved_at' => $pullOut->approved_at,
                'rejected_at' => $pullOut->rejected_at,
                'approved_by' => $pullOut->approved_by,
                'rejected_by' => $pullOut->rejected_by,
                'created_at' => $pullOut->created_at,
                'updated_at' => $pullOut->updated_at,
                'requested_by' => $userName,
                'source_branch' => $branchName,
                'destination_branch' => $branchName,
                'items_count' => $pullOut->quantity,
                'total_value' => $pullOut->quantity * $productPrice,
                'product' => $pullOut->product,
                'branch' => $pullOut->branch,
                'user' => $pullOut->user,
            ];
        });

        return response()->json([
            'data' => $transformedData,
            'pagination' => [
                'current_page' => $pullOuts->currentPage(),
                'last_page' => $pullOuts->lastPage(),
                'per_page' => $pullOuts->perPage(),
                'total' => $pullOuts->total(),
            ],
            'summary' => [
                'total_requests' => $pullOuts->total(),
                'pending_count' => $pendingCount,
                'approved_count' => $approvedCount,
                'rejected_count' => $rejectedCount,
                'total_items' => $totalItems,
            ],
        ]);
    }
}
