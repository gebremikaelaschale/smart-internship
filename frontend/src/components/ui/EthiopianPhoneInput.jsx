import React from 'react';

const ETHIOPIAN_PHONE_REGEX = /^[79]\d{8}$/;

export function validateEthiopianPhone(digits) {
  if (!digits) return 'Please enter a valid Ethiopian phone number (e.g., 911... or 711...)';
  if (!ETHIOPIAN_PHONE_REGEX.test(digits)) return 'Please enter a valid Ethiopian phone number (e.g., 911... or 711...)';
  return '';
}

export default function EthiopianPhoneInput({ value = '', onChange, error = '' }) {
  const sanitizeDigits = (raw) => raw.toString().replace(/\D/g, '').slice(0, 9);
  const digits = sanitizeDigits(value);

  const handleChange = (event) => {
    const nextDigits = sanitizeDigits(event.target.value);
    onChange?.(nextDigits);
  };

  const handleKeyDown = (event) => {
    const allowedKeys = [
      'Backspace',
      'Delete',
      'ArrowLeft',
      'ArrowRight',
      'ArrowUp',
      'ArrowDown',
      'Home',
      'End',
      'Tab'
    ];

    if (allowedKeys.includes(event.key)) {
      return;
    }

    if (!/^[0-9]$/.test(event.key)) {
      event.preventDefault();
    }
  };

  const handlePaste = (event) => {
    const pasted = event.clipboardData.getData('text');
    if (!/^[0-9]+$/.test(pasted)) {
      event.preventDefault();
    }
  };

  return (
    <div className="w-full">
      <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Phone Number</label>
      <div className="relative">
        <div className="absolute inset-y-0 left-0 flex items-center px-3 py-2 bg-white border-r border-blue-200 rounded-l-lg pointer-events-none">
          <img
            src="https://flagcdn.com/w20/et.png"
            srcSet="https://flagcdn.com/w40/et.png 2x"
            width="20"
            alt="Ethiopia"
            className="mr-2 rounded-sm shadow-sm"
          />
          <span className="text-sm font-semibold text-gray-700">+251</span>
        </div>

        <input
          type="tel"
          inputMode="numeric"
          pattern="[0-9]*"
          value={digits}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          placeholder="911234567"
          className={`h-14 w-full rounded-[20px] border bg-[#f0f4fb] pl-32 pr-5 text-lg font-medium text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-300 focus:ring-4 focus:ring-blue-100 ${
            error ? 'border-red-300 focus:border-red-300 focus:ring-red-100' : 'border-slate-200'
          }`}
        />
      </div>
      {error ? (
        <p className="mt-2 text-sm text-red-600">{error}</p>
      ) : null}
    </div>
  );
}
