// ===========================================
// Wing Command v4 — Utility Functions
// ===========================================

import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { WingSpot, CountdownTime, AvailabilityStats, PopularCity } from './types';

export function cn(...inputs: ClassValue[]): string {
    return twMerge(clsx(inputs));
}

// ===========================================
// Super Bowl LX
// ===========================================

export const SUPER_BOWL_DATE = new Date('2026-02-08T18:30:00-05:00');

export function getCountdown(targetDate: Date = SUPER_BOWL_DATE): CountdownTime {
    const now = new Date();
    const diff = targetDate.getTime() - now.getTime();
    if (diff <= 0) {
        return { days: 0, hours: 0, minutes: 0, seconds: 0, isPast: true };
    }
    return {
        days: Math.floor(diff / (1000 * 60 * 60 * 24)),
        hours: Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
        minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
        seconds: Math.floor((diff % (1000 * 60)) / 1000),
        isPast: false,
    };
}

// ===========================================
// Validation
// ===========================================

export function isValidZipCode(zip: string): boolean {
    return /^\d{5}(-\d{4})?$/.test(zip.trim());
}

export function cleanZipCode(zip: string): string {
    return zip.trim().substring(0, 5);
}

// ===========================================
// Availability
// ===========================================

export function calculateAvailability(spots: WingSpot[]): AvailabilityStats {
    const total = spots.length;
    const green = spots.filter(s => s.status === 'green').length;
    const yellow = spots.filter(s => s.status === 'yellow').length;
    const red = spots.filter(s => s.status === 'red').length;
    const percentage = total > 0 ? Math.round((green / total) * 100) : 0;
    return { total, green, yellow, red, percentage };
}

// ===========================================
// Popular Cities
// ===========================================

export const POPULAR_CITIES: PopularCity[] = [
    { name: 'New York', state: 'NY', zip: '10001' },
    { name: 'Los Angeles', state: 'CA', zip: '90001' },
    { name: 'Chicago', state: 'IL', zip: '60601' },
    { name: 'Houston', state: 'TX', zip: '77001' },
    { name: 'Phoenix', state: 'AZ', zip: '85001' },
    { name: 'Philadelphia', state: 'PA', zip: '19101' },
    { name: 'San Antonio', state: 'TX', zip: '78201' },
    { name: 'San Diego', state: 'CA', zip: '92101' },
    { name: 'Dallas', state: 'TX', zip: '75201' },
    { name: 'San Jose', state: 'CA', zip: '95101' },
    { name: 'Austin', state: 'TX', zip: '78701' },
    { name: 'Jacksonville', state: 'FL', zip: '32099' },
    { name: 'Fort Worth', state: 'TX', zip: '76101' },
    { name: 'Columbus', state: 'OH', zip: '43085' },
    { name: 'Indianapolis', state: 'IN', zip: '46201' },
    { name: 'Charlotte', state: 'NC', zip: '28201' },
    { name: 'San Francisco', state: 'CA', zip: '94102' },
    { name: 'Seattle', state: 'WA', zip: '98101' },
    { name: 'Denver', state: 'CO', zip: '80201' },
    { name: 'Boston', state: 'MA', zip: '02101' },
    { name: 'Las Vegas', state: 'NV', zip: '89101' },
    { name: 'Miami', state: 'FL', zip: '33101' },
    { name: 'Atlanta', state: 'GA', zip: '30301' },
    { name: 'Kansas City', state: 'MO', zip: '64101' },
    { name: 'New Orleans', state: 'LA', zip: '70112' },
    { name: 'Tampa', state: 'FL', zip: '33601' },
    { name: 'Minneapolis', state: 'MN', zip: '55401' },
    { name: 'Glendale', state: 'AZ', zip: '85301' },
    { name: 'Inglewood', state: 'CA', zip: '90301' },
    { name: 'Arlington', state: 'TX', zip: '76010' },
];
