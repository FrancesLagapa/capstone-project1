<?php

namespace App\Console\Commands;

use App\Models\Reservation;
use Illuminate\Console\Command;

class ExpireReadyReservations extends Command
{
    protected $signature = 'reservations:expire-pickups';
    protected $description = 'Cancel ready reservations not picked up by 8PM on their pickup date';

    public function handle()
    {
        $now = now();
        $today = $now->toDateString();
        $cancelled = 0;

        // Cancel from past dates
        $cancelled += Reservation::where('status', 'ready')
            ->whereDate('pickup_date', '<', $today)
            ->update(['status' => 'cancelled']);

        // Cancel from today if past 8PM
        if ((int) $now->format('H') >= 20) {
            $cancelled += Reservation::where('status', 'ready')
                ->whereDate('pickup_date', '=', $today)
                ->update(['status' => 'cancelled']);
        }

        if ($cancelled > 0) {
            $this->info("Cancelled {$cancelled} expired reservation(s).");
        } else {
            $this->info('No expired reservations found.');
        }

        return 0;
    }
}
