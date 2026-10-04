import type { Room } from '../types';

export function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function parseTime(stamp: string): number {
  const [m, s] = stamp.split(':').map(Number);
  return m * 60 + s;
}

export function formatPrice(value?: number): string {
  if (!value) return '';
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(value % 1_000_000 ? 2 : 0).replace(/\.?0+$/, '')}M`;
  return `$${Math.round(value / 1000)}K`;
}

export const ROOM_LABELS: Record<Room, string> = {
  exterior: 'Exterior', entry: 'Entry', living: 'Living', dining: 'Dining', kitchen: 'Kitchen',
  bedroom: 'Bedroom', bathroom: 'Bathroom', office: 'Office', basement: 'Basement', laundry: 'Laundry',
  garage: 'Garage', backyard: 'Backyard', view: 'View', amenity: 'Amenity', other: 'Other',
};

// Rooms are grouped into five zones so the timeline stays readable.
export type Zone = 'outdoor' | 'living' | 'kitchen' | 'private' | 'utility';

export const ROOM_ZONE: Record<Room, Zone> = {
  exterior: 'outdoor', backyard: 'outdoor', view: 'outdoor',
  entry: 'living', living: 'living', dining: 'living',
  kitchen: 'kitchen',
  bedroom: 'private', bathroom: 'private', office: 'private',
  basement: 'utility', laundry: 'utility', garage: 'utility', amenity: 'utility', other: 'utility',
};

export const ZONE_STYLE: Record<Zone, { label: string; bg: string; text: string }> = {
  outdoor: { label: 'Outdoor', bg: 'bg-olive', text: 'text-warmWhite' },
  living: { label: 'Living', bg: 'bg-sage', text: 'text-charcoal' },
  kitchen: { label: 'Kitchen', bg: 'bg-terracotta', text: 'text-warmWhite' },
  private: { label: 'Bed & bath', bg: 'bg-clay', text: 'text-charcoal' },
  utility: { label: 'Other', bg: 'bg-sand', text: 'text-charcoal' },
};

const STOP = new Set('a an and the with of in on for to at by or is are has have that this my i want looking show me'.split(' '));

export function queryTerms(q: string): string[] {
  return q.toLowerCase().split(/[^a-z0-9]+/).filter(t => t.length > 2 && !STOP.has(t));
}
