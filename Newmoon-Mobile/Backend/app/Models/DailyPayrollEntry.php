<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class DailyPayrollEntry extends Model
{
    use HasFactory;

    protected $fillable = [
        'payroll_period_id',
        'user_id',
        'branch_id',
        'work_date',
        'is_day_off',
        'daily_rate',
        'hours_worked',
        'daily_earnings',
        'cash_advance_amount',
        'has_cash_advance',
        'cash_advance_reason',
        'daily_deductions',
        'daily_net_pay',
        'notes',
    ];

    protected $casts = [
        'work_date' => 'date',
        'daily_rate' => 'decimal:2',
        'hours_worked' => 'decimal:2',
        'daily_earnings' => 'decimal:2',
        'cash_advance_amount' => 'decimal:2',
        'daily_deductions' => 'decimal:2',
        'daily_net_pay' => 'decimal:2',
        'is_day_off' => 'boolean',
        'has_cash_advance' => 'boolean',
    ];

    public function payrollPeriod()
    {
        return $this->belongsTo(PayrollPeriod::class);
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function branch()
    {
        return $this->belongsTo(Branch::class);
    }

    public function calculateDailyPay()
    {
        if ($this->is_day_off) {
            $this->daily_earnings = 0;
            $this->daily_net_pay = 0;
            return;
        }

        // Calculate daily earnings based on hours worked
        if ($this->hours_worked <= 8) {
            $this->daily_earnings = ($this->hours_worked / 8) * $this->daily_rate;
        } else {
            $overtimeHours = $this->hours_worked - 8;
            $overtimeRate = ($this->daily_rate / 8) * 1.25;
            $this->daily_earnings = $this->daily_rate + ($overtimeHours * $overtimeRate);
        }

        // Calculate net pay after deductions and cash advance
        $this->daily_net_pay = $this->daily_earnings - $this->daily_deductions - $this->cash_advance_amount;
    }
}
