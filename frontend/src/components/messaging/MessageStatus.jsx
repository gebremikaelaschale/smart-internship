import React from 'react';

// WhatsApp-style message status component with checkmarks
export default function MessageStatus({ status, isMine, time, className = "" }) {
  if (!isMine) return null;

  const getStatusIcon = () => {
    switch (status) {
      case 'sent':
        return (
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
        );
      
      case 'delivered':
        return (
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12"></polyline>
            <polyline points="24 6 13 17 8 12" style={{ transform: 'translateX(-4px)' }}></polyline>
          </svg>
        );
      
      case 'read':
        return (
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="#53BDEB" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12"></polyline>
            <polyline points="24 6 13 17 8 12" style={{ transform: 'translateX(-4px)' }}></polyline>
          </svg>
        );
      
      default:
        return (
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
        );
    }
  };

  return (
    <div className={`flex items-center justify-end gap-1 opacity-60 font-medium ${className}`}>
      <span className="text-[10px]">{time}</span>
      <span className="flex">
        {getStatusIcon()}
      </span>
    </div>
  );
}

// Message status with animation for real-time updates
export function AnimatedMessageStatus({ status, isMine, time, className = "" }) {
  const [currentStatus, setCurrentStatus] = React.useState(status);
  const [isAnimating, setIsAnimating] = React.useState(false);

  React.useEffect(() => {
    if (status !== currentStatus) {
      setIsAnimating(true);
      setCurrentStatus(status);
      setTimeout(() => setIsAnimating(false), 300);
    }
  }, [status, currentStatus]);

  if (!isMine) return null;

  const getStatusIcon = () => {
    const animationClass = isAnimating ? 'animate-pulse' : '';
    
    switch (currentStatus) {
      case 'sent':
        return (
          <svg className={`w-3.5 h-3.5 ${animationClass}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
        );
      
      case 'delivered':
        return (
          <svg className={`w-3.5 h-3.5 ${animationClass}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12"></polyline>
            <polyline points="24 6 13 17 8 12" style={{ transform: 'translateX(-4px)' }}></polyline>
          </svg>
        );
      
      case 'read':
        return (
          <svg className={`w-3.5 h-3.5 ${animationClass}`} viewBox="0 0 24 24" fill="none" stroke="#53BDEB" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12"></polyline>
            <polyline points="24 6 13 17 8 12" style={{ transform: 'translateX(-4px)' }}></polyline>
          </svg>
        );
      
      default:
        return (
          <svg className={`w-3.5 h-3.5 ${animationClass}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
        );
    }
  };

  return (
    <div className={`flex items-center justify-end gap-1 opacity-60 font-medium ${className}`}>
      <span className="text-[10px]">{time}</span>
      <span className={`flex ${isAnimating ? 'scale-110' : ''} transition-transform duration-300`}>
        {getStatusIcon()}
      </span>
    </div>
  );
}

// Compact message status for small spaces
export function CompactMessageStatus({ status, isMine, className = "" }) {
  if (!isMine) return null;

  const getStatusIcon = () => {
    switch (status) {
      case 'sent':
        return '✓';
      case 'delivered':
        return '✓✓';
      case 'read':
        return <span className="text-blue-400">✓✓</span>;
      default:
        return '✓';
    }
  };

  return (
    <span className={`text-[10px] opacity-60 ${className}`}>
      {getStatusIcon()}
    </span>
  );
}

// Message status with tooltip
export function MessageStatusWithTooltip({ status, isMine, time, className = "" }) {
  if (!isMine) return null;

  const getStatusText = () => {
    switch (status) {
      case 'sent':
        return 'Sent';
      case 'delivered':
        return 'Delivered';
      case 'read':
        return 'Read';
      default:
        return 'Sending...';
    }
  };

  const getStatusIcon = () => {
    switch (status) {
      case 'sent':
        return (
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
        );
      
      case 'delivered':
        return (
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12"></polyline>
            <polyline points="24 6 13 17 8 12" style={{ transform: 'translateX(-4px)' }}></polyline>
          </svg>
        );
      
      case 'read':
        return (
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="#53BDEB" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12"></polyline>
            <polyline points="24 6 13 17 8 12" style={{ transform: 'translateX(-4px)' }}></polyline>
          </svg>
        );
      
      default:
        return (
          <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 12a9 9 0 11-6.219-8.56"></path>
          </svg>
        );
    }
  };

  return (
    <div className={`group relative flex items-center justify-end gap-1 opacity-60 font-medium ${className}`}>
      <span className="text-[10px]">{time}</span>
      <span className="flex cursor-help" title={getStatusText()}>
        {getStatusIcon()}
      </span>
    </div>
  );
}
