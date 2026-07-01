<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class PayrollPeriod extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'start_date',
        'end_date',
        'gross_salary',
        'total_deductions',
        'total_cash_advances',
        'net_salary',
        'balance_due',
        'status',
        'notes',
    ];

    protected $casts = [
        'start_date' => 'date',
        'end_date' => 'date',
        'gross_salary' => 'decimal:2',
        'total_deductions' => 'decimal:2',
        'total_cash_advances' => 'decimal:2',
        'net_salary' => 'decimal:2',
        'balance_due' => 'decimal:2',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function dailyEntries()
    {
        return $this->hasMany(DailyPayrollEntry::class);
    }

    public function getDaysWorkedAttribute()
    {
        return $this->dailyEntries()->where('is_day_off', false)->count();
    }

    public function getDaysOffAttribute()
    {
        return $this->dailyEntries()->where('is_day_off', true)->count();
    }

    public function calculateTotals()
    {
        $this->gross_salary = $this->dailyEntries()->sum('daily_earnings');
        $this->total_cash_advances = $this->dailyEntries()->sum('cash_advance_amount');
        $this->total_deductions = $this->dailyEntries()->sum('daily_deductions');
        $this->net_salary = $this->gross_salary - $this->total_deductions - $this->total_cash_advances;
        $this->balance_due = $this->total_cash_advances - ($this->total_deductions + $this->net_salary);
        $this->save();
    }
}
