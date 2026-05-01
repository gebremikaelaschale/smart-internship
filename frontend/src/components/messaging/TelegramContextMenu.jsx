import React, { useState, useRef, useEffect } from 'react';

/**
 * Telegram-style Context Menu Component
 * Appears on message click/right-click with Reply, Edit, Delete options
 */
export default function TelegramContextMenu({ 
  message, 
  isMine, 
  position, 
  onClose, 
  onReply, 
  onEdit, 
  onDelete,
  socket 
}) {
  const [isVisible, setIsVisible] = useState(false);
  const menuRef = useRef(null);
  const [animatingOut, setAnimatingOut] = useState(false);

  useEffect(() => {
    if (position) {
      setIsVisible(true);
      setAnimatingOut(false);
    }
  }, [position]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        handleClose();
      }
    };

    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        handleClose();
      }
    };

    if (isVisible) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isVisible]);

  const handleClose = () => {
    setAnimatingOut(true);
    setTimeout(() => {
      setIsVisible(false);
      onClose?.();
    }, 150);
  };

  const handleAction = (action) => {
    switch (action) {
      case 'reply':
        onReply?.(message);
        break;
      case 'edit':
        onEdit?.(message);
        break;
      case 'delete':
        onDelete?.(message);
        break;
    }
    handleClose();
  };

  if (!isVisible || !position) return null;

  const menuStyle = {
    position: 'absolute',
    left: `${position.x}px`,
    top: `${position.y}px`,
    zIndex: 1000,
  };

  // Adjust position if menu goes off screen
  const adjustedPosition = { ...position };
  if (position.x + 200 > window.innerWidth) {
    adjustedPosition.x = window.innerWidth - 210;
  }
  if (position.y + 150 > window.innerHeight) {
    adjustedPosition.y = window.innerHeight - 160;
  }

  return (
    <div
      ref={menuRef}
      className={`telegram-context-menu bg-white rounded-lg shadow-xl border border-gray-200 py-1 min-w-[160px] ${
        animatingOut ? 'animate-fade-out' : 'animate-fade-in'
      }`}
      style={{
        position: 'fixed',
        left: `${adjustedPosition.x}px`,
        top: `${adjustedPosition.y}px`,
        zIndex: 1000,
      }}
    >
      {/* Reply Option - Always available */}
      <button
        onClick={() => handleAction('reply')}
        className="w-full px-4 py-2 text-left hover:bg-gray-50 transition-colors flex items-center gap-3 text-sm"
      >
        <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
        </svg>
        <span>Reply</span>
      </button>

      {/* Edit Option - Only for sender's messages and not deleted */}
      {isMine && !message.deletedForEveryone && (
        <button
          onClick={() => handleAction('edit')}
          className="w-full px-4 py-2 text-left hover:bg-gray-50 transition-colors flex items-center gap-3 text-sm"
        >
          <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
          <span>Edit</span>
        </button>
      )}

      {/* Delete Option - Only for sender's messages */}
      {isMine && (
        <button
          onClick={() => handleAction('delete')}
          className="w-full px-4 py-2 text-left hover:bg-red-50 text-red-600 transition-colors flex items-center gap-3 text-sm"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
          <span>Delete</span>
        </button>
      )}

      {/* Divider */}
      <div className="border-t border-gray-100 my-1"></div>

      {/* Copy Option - Always available */}
      <button
        onClick={() => {
          navigator.clipboard.writeText(message.content);
          handleClose();
        }}
        className="w-full px-4 py-2 text-left hover:bg-gray-50 transition-colors flex items-center gap-3 text-sm"
      >
        <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
        <span>Copy</span>
      </button>
    </div>
  );
}

/**
 * Hook for managing context menu state
 */
export function useTelegramContextMenu() {
  const [contextMenu, setContextMenu] = useState({
    isVisible: false,
    message: null,
    position: null,
  });

  const showContextMenu = (message, event) => {
    event.preventDefault();
    
    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX || rect.left + rect.width / 2;
    const y = event.clientY || rect.top;
    
    setContextMenu({
      isVisible: true,
      message,
      position: { x, y },
    });
  };

  const hideContextMenu = () => {
    setContextMenu({
      isVisible: false,
      message: null,
      position: null,
    });
  };

  return {
    contextMenu,
    showContextMenu,
    hideContextMenu,
  };
}

/**
 * Enhanced Message Bubble with Context Menu Integration
 */
export function MessageBubbleWithContextMenu({ 
  message, 
  isMine, 
  onReply, 
  onEdit, 
  onDelete, 
  socket,
  children 
}) {
  const { contextMenu, showContextMenu, hideContextMenu } = useTelegramContextMenu();
  const bubbleRef = useRef(null);

  const handleMessageClick = (event) => {
    // Only show context menu on right-click or long press
    if (event.type === 'contextmenu' || event.type === 'touchstart') {
      showContextMenu(message, event);
    }
  };

  return (
    <>
      <div
        ref={bubbleRef}
        onContextMenu={handleMessageClick}
        onTouchStart={(e) => {
          // Long press for mobile
          const timer = setTimeout(() => {
            handleMessageClick(e);
          }, 500);
          e.currentTarget.dataset.longPressTimer = timer;
        }}
        onTouchEnd={(e) => {
          clearTimeout(e.currentTarget.dataset.longPressTimer);
        }}
        className="cursor-context-menu"
      >
        {children}
      </div>

      {contextMenu.isVisible && contextMenu.message?._id === message._id && (
        <TelegramContextMenu
          message={contextMenu.message}
          isMine={isMine}
          position={contextMenu.position}
          onClose={hideContextMenu}
          onReply={onReply}
          onEdit={onEdit}
          onDelete={onDelete}
          socket={socket}
        />
      )}
    </>
  );
}

// Add CSS animations
const style = document.createElement('style');
style.textContent = `
  @keyframes fade-in {
    from {
      opacity: 0;
      transform: scale(0.95);
    }
    to {
      opacity: 1;
      transform: scale(1);
    }
  }

  @keyframes fade-out {
    from {
      opacity: 1;
      transform: scale(1);
    }
    to {
      opacity: 0;
      transform: scale(0.95);
    }
  }

  .animate-fade-in {
    animation: fade-in 0.15s ease-out;
  }

  .animate-fade-out {
    animation: fade-out 0.15s ease-out;
  }

  .cursor-context-menu {
    position: relative;
  }
`;

if (!document.head.querySelector('style[data-telegram-context-menu]')) {
  style.setAttribute('data-telegram-context-menu', 'true');
  document.head.appendChild(style);
}
