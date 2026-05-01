import React from 'react';

/**
 * Date Divider Component for Message Grouping
 * Shows date labels between messages from different days
 */
export default function DateDivider({ label, date }) {
  return (
    <div className="flex items-center justify-center my-4 -mx-4">
      <div className="flex items-center gap-2 px-4">
        <div className="h-px bg-gray-300 flex-1 min-w-[20px]"></div>
        <span className="text-xs font-medium text-gray-500 bg-white px-2 py-1 rounded-full">
          {label}
        </span>
        <div className="h-px bg-gray-300 flex-1 min-w-[20px]"></div>
      </div>
    </div>
  );
}

/**
 * Compact Date Divider for tight spaces
 */
export function CompactDateDivider({ label }) {
  return (
    <div className="flex items-center justify-center my-3">
      <span className="text-xs font-medium text-gray-400 bg-gray-50 px-3 py-1 rounded-full border">
        {label}
      </span>
    </div>
  );
}

/**
 * Modern Date Divider with better styling
 */
export function ModernDateDivider({ label, date }) {
  return (
    <div className="relative flex items-center justify-center py-3">
      <div className="absolute inset-0 flex items-center">
        <div className="w-full border-t border-gray-200"></div>
      </div>
      <div className="relative flex items-center justify-center">
        <span className="bg-white px-4 text-xs font-semibold text-gray-600 uppercase tracking-wide">
          {label}
        </span>
      </div>
    </div>
  );
}

/**
 * Date Divider with timestamp
 */
export function DateDividerWithTimestamp({ label, date, showFullDate = false }) {
  const formattedDate = showFullDate 
    ? new Date(date).toLocaleDateString('en-US', { 
        weekday: 'long', 
        month: 'long', 
        day: 'numeric', 
        year: 'numeric' 
      })
    : label;

  return (
    <div className="flex flex-col items-center my-4">
      <div className="flex items-center gap-2 px-4 w-full max-w-md">
        <div className="h-px bg-gray-300 flex-1"></div>
        <span className="text-xs font-medium text-gray-500 bg-white px-3 py-1 rounded-full shadow-sm">
          {formattedDate}
        </span>
        <div className="h-px bg-gray-300 flex-1"></div>
      </div>
      {showFullDate && (
        <span className="text-[10px] text-gray-400 mt-1">
          {new Date(date).toLocaleDateString('en-US', { 
            weekday: 'short' 
          })}
        </span>
      )}
    </div>
  );
}
