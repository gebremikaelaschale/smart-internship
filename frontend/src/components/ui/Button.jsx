import React from 'react';

const variantClasses = {
  primary: 'bg-emerald-600 text-white hover:bg-emerald-700',
  secondary: 'bg-slate-100 text-slate-900 hover:bg-slate-200',
  outline: 'border border-slate-200 bg-white text-slate-900 hover:bg-slate-50'
};

const sizeClasses = {
  sm: 'px-3 py-2 text-sm',
  md: 'px-4 py-2.5 text-sm',
  lg: 'px-5 py-3 text-base'
};

export default function Button({ as: Component = 'button', variant = 'primary', size = 'md', className = '', type = 'button', children, ...props }) {
  const sharedClassName = `inline-flex items-center justify-center rounded-xl font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 ${variantClasses[variant] || variantClasses.primary} ${sizeClasses[size] || sizeClasses.md} ${className} disabled:cursor-not-allowed disabled:opacity-50`;

  if (typeof Component !== 'string' && Component !== React.Fragment) {
    return <Component className={sharedClassName} {...props}>{children}</Component>;
  }

  return (
    <button type={type} className={sharedClassName} {...props}>
      {children}
    </button>
  );
}
