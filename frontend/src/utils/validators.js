export const isRequired = (value) => String(value || '').trim().length > 0;

export const isEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());

export const isUniversityEmail = (value) => String(value || '').toLowerCase().endsWith('@uog.edu.et');
