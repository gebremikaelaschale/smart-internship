/**
 * Application Status Mapping Utility
 * Maps database application statuses to stepper step indices
 */

export const APPLICATION_STEPS = {
  APPLIED: 0,
  SEEN: 1,
  SHORTLISTED: 2,
  INTERVIEW: 3,
  ACCEPTED: 4,  // Final step
  PLACED: 4,    // Final step
  REJECTED: -1,
  WITHDRAWN: -1,
  HOD_ASSIGNED: 4,  // Special case
  PENDING: 0
};

export const STEP_LABELS = [
  'APPLIED',
  'SEEN',
  'SHORTLISTED',
  'INTERVIEW',
  'ACCEPTED'
];

/**
 * Convert application status to step index
 * @param {string} status - The application status from database
 * @returns {number} - Step index (0-4), or -1 for rejected/withdrawn
 */
export function getStepIndex(status) {
  if (!status) return 0;
  
  const normalized = String(status).trim().toUpperCase();
  
  // Direct mapping for known statuses
  switch (normalized) {
    case 'PENDING':
      return APPLICATION_STEPS.PENDING;
    case 'APPLIED':
      return APPLICATION_STEPS.APPLIED;
    case 'SEEN':
      return APPLICATION_STEPS.SEEN;
    case 'SHORTLISTED':
      return APPLICATION_STEPS.SHORTLISTED;
    case 'INTERVIEW':
      return APPLICATION_STEPS.INTERVIEW;
    case 'ACCEPTED':
      return APPLICATION_STEPS.ACCEPTED;
    case 'PLACED':
      return APPLICATION_STEPS.PLACED;
    case 'HOD_ASSIGNED':
      return APPLICATION_STEPS.HOD_ASSIGNED;
    case 'REJECTED':
      return APPLICATION_STEPS.REJECTED;
    case 'WITHDRAWN':
      return APPLICATION_STEPS.WITHDRAWN;
    case 'OFFERED':
      // 'Offered' is essentially the same as 'Accepted' in our flow
      return APPLICATION_STEPS.ACCEPTED;
    default:
      return 0; // Default to APPLIED
  }
}

/**
 * Get the final label for the status
 * @param {string} status - The application status
 * @param {boolean} isUniversityPlacement - Whether this is a HOD assignment
 * @returns {string} - The label to display
 */
export function getFinalLabel(status, isUniversityPlacement = false) {
  if (!status) return 'PENDING';
  
  const normalized = String(status).trim().toUpperCase();
  
  if (normalized === 'REJECTED') return 'REJECTED';
  if (normalized === 'WITHDRAWN') return 'WITHDRAWN';
  if (isUniversityPlacement) return 'ASSIGNED BY HOD';
  if (normalized === 'PLACED') return 'PLACED';
  if (normalized === 'ACCEPTED') return 'ACCEPTED';
  if (normalized === 'HOD_ASSIGNED') return 'ASSIGNED BY HOD';
  
  return normalized;
}

/**
 * Determine if status is a final/terminal status
 * @param {string} status - The application status
 * @returns {boolean}
 */
export function isTerminalStatus(status) {
  if (!status) return false;
  const normalized = String(status).trim().toUpperCase();
  return ['ACCEPTED', 'PLACED', 'REJECTED', 'WITHDRAWN', 'HOD_ASSIGNED'].includes(normalized);
}

/**
 * Get color class for a status
 * @param {string} status - The application status
 * @returns {string} - Tailwind color class
 */
export function getStatusColor(status) {
  if (!status) return 'bg-slate-100 text-slate-600';
  
  const normalized = String(status).trim().toUpperCase();
  
  switch (normalized) {
    case 'ACCEPTED':
    case 'PLACED':
    case 'OFFERED':
      return 'bg-emerald-100 text-emerald-700';
    case 'REJECTED':
      return 'bg-rose-100 text-rose-700';
    case 'WITHDRAWN':
      return 'bg-slate-100 text-slate-600';
    case 'HOD_ASSIGNED':
      return 'bg-purple-100 text-purple-700';
    case 'SHORTLISTED':
      return 'bg-violet-100 text-violet-700';
    case 'INTERVIEW':
      return 'bg-indigo-100 text-indigo-700';
    case 'SEEN':
      return 'bg-sky-100 text-sky-700';
    case 'PENDING':
    case 'APPLIED':
    default:
      return 'bg-amber-100 text-amber-700';
  }
}
