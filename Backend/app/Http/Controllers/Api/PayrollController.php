<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Attendance;
use App\Models\DailyPayrollEntry;
use App\Models\PayrollPeriod;
use App\Models\StaffAssignment;
use App\Models\StaffDeduction;
use App\Models\StaffIncentive;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;

class PayrollController extends Controller
{
    /**
     * Get daily payroll report
     */
    public function getPayroll(Request $request)
    {
        $validated = $request->validate([
            'date' => 'required|date',
            'branch_id' => 'nullable|exists:branches,id',
        ]);

        $query = Attendance::with(['user.branchAssignments', 'branch'])
            ->whereDate('date', $validated['date']);

        if ($request->has('branch_id')) {
            $query->where('branch_id', $validated['branch_id']);
        }

        $attendance = $query->get();

        $payroll = [];

        // Bulk-load deductions & incentives for the month (avoid N+1 inside loop).
        $month = Carbon::parse($validated['date'])->month;
        $year = Carbon::parse($validated['date'])->year;
        $userIds = $attendance->pluck('user_id')->unique()->filter()->values();

        $deductionsByUser = StaffDeduction::whereIn('user_id', $userIds)
            ->where('month', $month)
            ->where('year', $year)
            ->get()
            ->keyBy('user_id');

        $incentivesByUser = StaffIncentive::whereIn('user_id', $userIds)
            ->where('month', $month)
            ->where('year', $year)
            ->get()
            ->keyBy('user_id');

        foreach ($attendance as $record) {
            $assignment = $record->user->branchAssignments->first();
            $dailyRate = $assignment ? $assignment->daily_rate : 500;

            // Calculate hours worked
            if ($record->time_in && $record->time_out) {
                $timeIn = \Carbon\Carbon::parse($record->time_in);
                $timeOut = \Carbon\Carbon::parse($record->time_out);
                $hoursWorked = $timeIn->diffInHours($timeOut);
            } else {
                $hoursWorked = 0;
            }

            // Calculate earnings (8-hour workday)
            if ($hoursWorked <= 8) {
                $dailyEarnings = ($hoursWorked / 8) * $dailyRate;
            } else {
                $overtimeHours = $hoursWorked - 8;
                $overtimeRate = ($dailyRate / 8) * 1.25;
                $dailyEarnings = $dailyRate + ($overtimeHours * $overtimeRate);
            }

            // Get deductions for the month
            $deductions = $deductionsByUser->get($record->user_id);
            $incentives = $incentivesByUser->get($record->user_id);

            // Calculate daily deductions and incentives
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

            $dailyIncentives = 0;
            if ($incentives && $incentives->perfect_attendance && !$record->is_late) {
                $dailyIncentives += 500 / 22;
            }

            $netPay = $dailyEarnings - $dailyDeductions + $dailyIncentives;

            $payroll[] = [
                'attendance_id' => $record->id,
                'user_id' => $record->user_id,
                'user' => [
                    'id' => $record->user->id,
                    'firstname' => $record->user->firstname,
                    'lastname' => $record->user->lastname,
                ],
                'staff_name' => $record->user->firstname . ' ' . $record->user->lastname,
                'branch' => $record->branch,
                'branch_id' => $record->branch_id,
                'time_in' => $record->time_in,
                'time_out' => $record->time_out,
                'hours_worked' => $hoursWorked,
                'daily_rate' => $dailyRate,
                'daily_earnings' => $dailyEarnings,
                'deductions' => $dailyDeductions,
                'incentives' => $dailyIncentives,
                'net_pay' => $netPay,
                'is_late' => $record->is_late,
                'late_minutes' => $record->late_minutes,
            ];
        }

        return response()->json($payroll);
    }

    /**
     * Monthly payroll report endpoint to avoid "one request per day".
     * Params:
     *  - month: YYYY-MM
     *  - branch_id: optional
     */
    public function getPayrollMonthly(Request $request)
    {
        $validated = $request->validate([
            'month' => ['required', 'regex:/^\d{4}-\d{2}$/'],
            'branch_id' => 'nullable|exists:branches,id',
        ]);

        $monthStr = $validated['month'];
        $start = Carbon::createFromFormat('Y-m', $monthStr)->startOfMonth()->toDateString();
        $end = Carbon::createFromFormat('Y-m', $monthStr)->endOfMonth()->toDateString();
        $monthNum = (int) Carbon::createFromFormat('Y-m', $monthStr)->month;
        $yearNum = (int) Carbon::createFromFormat('Y-m', $monthStr)->year;

        $query = Attendance::with(['user.branchAssignments', 'branch'])
            ->whereDate('date', '>=', $start)
            ->whereDate('date', '<=', $end);

        if ($request->filled('branch_id')) {
            $query->where('branch_id', $validated['branch_id']);
        }

        $attendance = $query->get();

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

        $payroll = [];
        foreach ($attendance as $record) {
            $assignment = $record->user->branchAssignments->first();
            $dailyRate = $assignment ? $assignment->daily_rate : 500;

            // Calculate hours worked (keep same logic as daily endpoint to avoid behavior changes)
            if ($record->time_in && $record->time_out) {
                $timeIn = Carbon::parse($record->time_in);
                $timeOut = Carbon::parse($record->time_out);
                $hoursWorked = $timeIn->diffInHours($timeOut);
            } else {
                $hoursWorked = 0;
            }

            // Calculate earnings (8-hour workday)
            if ($hoursWorked <= 8) {
                $dailyEarnings = ($hoursWorked / 8) * $dailyRate;
            } else {
                $overtimeHours = $hoursWorked - 8;
                $overtimeRate = ($dailyRate / 8) * 1.25;
                $dailyEarnings = $dailyRate + ($overtimeHours * $overtimeRate);
            }

            $deductions = $deductionsByUser->get($record->user_id);
            $incentives = $incentivesByUser->get($record->user_id);

            // Calculate daily deductions and incentives
            $dailyDeductions = 0;
            if ($deductions) {
                $dailyDeductions += ($deductions->sss / 22);
                $dailyDeductions += ($deductions->philhealth / 22);
                $dailyDeductions += ($deductions->pagibig / 22);
                $dailyDeductions += ($deductions->cash_advance / 22);
            }

            if ($record->is_late) {
                $dailyDeductions += $record->late_minutes * 5;
            }

            $dailyIncentives = 0;
            if ($incentives && $incentives->perfect_attendance && !$record->is_late) {
                $dailyIncentives += 500 / 22;
            }

            $netPay = $dailyEarnings - $dailyDeductions + $dailyIncentives;

            $payroll[] = [
                'attendance_id' => $record->id,
                'user_id' => $record->user_id,
                'user' => [
                    'id' => $record->user->id,
                    'firstname' => $record->user->firstname,
                    'lastname' => $record->user->lastname,
                ],
                'staff_name' => $record->user->firstname . ' ' . $record->user->lastname,
                'branch' => $record->branch,
                'branch_id' => $record->branch_id,
                'date' => $record->date,
                'time_in' => $record->time_in,
                'time_out' => $record->time_out,
                'hours_worked' => $hoursWorked,
                'daily_rate' => $dailyRate,
                'daily_earnings' => $dailyEarnings,
                'deductions' => $dailyDeductions,
                'incentives' => $dailyIncentives,
                'net_pay' => $netPay,
                'is_late' => $record->is_late,
                'late_minutes' => $record->late_minutes,
            ];
        }

        return response()->json($payroll);
    }
}
