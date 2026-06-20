export const STUDENT_PROFILE_UPDATED_EVENT = 'student:profile-updated';
export const STUDENT_PROFILE_UPDATED_STORAGE_KEY = 'student.profile.updatedAt';
export const STUDENT_STATS_REFRESH_EVENT = 'student:stats-refresh';
export const STUDENT_STATS_REFRESH_STORAGE_KEY = 'student.stats.refreshAt';

export function notifyStudentProfileUpdated(detail = {}) {
  const payload = {
    updatedAt: Date.now(),
    ...detail
  };

  try {
    window.localStorage.setItem(STUDENT_PROFILE_UPDATED_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Ignore storage failures; the local event still updates the current tab.
  }

  window.dispatchEvent(new CustomEvent(STUDENT_PROFILE_UPDATED_EVENT, { detail: payload }));
}

export function notifyStudentStatsRefresh(detail = {}) {
  const payload = {
    refreshedAt: Date.now(),
    ...detail
  };

  try {
    window.localStorage.setItem(STUDENT_STATS_REFRESH_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Ignore storage failures; the local event still updates the current tab.
  }

  window.dispatchEvent(new CustomEvent(STUDENT_STATS_REFRESH_EVENT, { detail: payload }));
}