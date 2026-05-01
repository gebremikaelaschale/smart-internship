import React, { useState, useEffect } from 'react';

/**
 * Message Selection Component
 * Allows users to select multiple messages for bulk operations
 */
export default function MessageSelection({ 
  messages, 
  selectedMessages, 
  setSelectedMessages, 
  onSelectAll, 
  onClearSelection, 
  onDeleteSelected,
  isSelectionMode,
  setIsSelectionMode,
  myId
}) {
  const [selectAll, setSelectAll] = useState(false);

  useEffect(() => {
    const selectableMessages = messages.filter(msg => String(msg.senderId) === String(myId));
    const allSelected = selectableMessages.length > 0 && selectedMessages.length === selectableMessages.length;
    setSelectAll(allSelected);
  }, [selectedMessages, messages]);

  const handleSelectAll = () => {
    console.log('Select All clicked, current state:', selectAll);
    if (selectAll) {
      onClearSelection();
      setSelectAll(false);
    } else {
      onSelectAll();
      setSelectAll(true);
    }
  };

  const handleDeleteSelected = async () => {
    console.log('Delete Selected clicked, messages:', selectedMessages.length);
    if (selectedMessages.length === 0) return;
    
    const confirmed = window.confirm(`Delete ${selectedMessages.length} message(s)? This action cannot be undone.`);
    if (!confirmed) return;

    try {
      await onDeleteSelected(selectedMessages);
      setIsSelectionMode(false);
      onClearSelection();
    } catch (error) {
      console.error('Failed to delete selected messages:', error);
    }
  };

  if (!isSelectionMode) return null;

  return (
    <div className="message-selection-toolbar fixed top-0 left-0 right-0 bg-blue-600 text-white p-3 shadow-lg z-50">
      <div className="max-w-4xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-4">
          <span className="font-semibold">
            {selectedMessages.length} message{selectedMessages.length !== 1 ? 's' : ''} selected
          </span>
          
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={selectAll}
              onChange={handleSelectAll}
              className="w-4 h-4 rounded"
            />
            <span className="text-sm">Select All</span>
          </label>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              console.log('Cancel button clicked');
              onClearSelection();
            }}
            className="px-4 py-2 bg-blue-500 hover:bg-blue-400 rounded-lg transition-colors text-sm font-medium cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-300"
          >
            Cancel
          </button>
          
          <button
            onClick={handleDeleteSelected}
            disabled={selectedMessages.length === 0}
            className={`px-4 py-2 rounded-lg transition-colors text-sm font-medium cursor-pointer focus:outline-none focus:ring-2 focus:ring-red-300 ${
              selectedMessages.length === 0 
                ? 'bg-gray-500 cursor-not-allowed opacity-50' 
                : 'bg-red-600 hover:bg-red-500 active:bg-red-700'
            }`}
          >
            Delete Selected
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Message Checkbox Component
 * Individual checkbox for each message
 */
export function MessageCheckbox({ 
  message, 
  isSelected, 
  onToggle, 
  isSelectionMode 
}) {
  if (!isSelectionMode) return null;

  return (
    <div className="absolute top-2 left-2 z-10">
      <input
        type="checkbox"
        checked={isSelected}
        onChange={() => onToggle(message._id)}
        className="w-4 h-4 rounded border-2 border-white shadow-md cursor-pointer"
      />
    </div>
  );
}

/**
 * Selection Mode Hook
 * Manages selection state and logic
 */
export function useMessageSelection() {
  const [selectedMessages, setSelectedMessages] = useState([]);
  const [isSelectionMode, setIsSelectionMode] = useState(false);

  const toggleMessageSelection = (messageId) => {
    setSelectedMessages(prev => {
      if (prev.includes(messageId)) {
        return prev.filter(id => id !== messageId);
      } else {
        return [...prev, messageId];
      }
    });
  };

  const selectAllMessages = (messages) => {
    const messageIds = messages.map(msg => String(msg._id));
    setSelectedMessages(messageIds);
  };

  const clearSelection = () => {
    setSelectedMessages([]);
  };

  const toggleSelectionMode = () => {
    if (isSelectionMode) {
      clearSelection();
    }
    setIsSelectionMode(!isSelectionMode);
  };

  const isMessageSelected = (messageId) => {
    return selectedMessages.includes(String(messageId));
  };

  return {
    selectedMessages,
    isSelectionMode,
    setIsSelectionMode,
    toggleMessageSelection,
    selectAllMessages,
    clearSelection,
    toggleSelectionMode,
    isMessageSelected
  };
}

/**
 * Enhanced Message Bubble with Selection Support
 */
export function SelectableMessageBubble({ 
  message, 
  isMine, 
  children, 
  isSelectionMode, 
  isSelected, 
  onToggleSelection 
}) {
  return (
    <div className={`relative ${isSelectionMode ? 'selectable-message' : ''}`}>
      {/* Selection Checkbox */}
      {isSelectionMode && (
        <div className="absolute top-2 left-2 z-10">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => onToggleSelection(message._id)}
            className="w-4 h-4 rounded border-2 border-white shadow-md cursor-pointer"
          />
        </div>
      )}
      
      {/* Visual feedback for selected message */}
      {isSelectionMode && isSelected && (
        <div className="absolute inset-0 bg-blue-100 opacity-20 rounded-lg pointer-events-none"></div>
      )}
      
      {/* Message Content */}
      <div className={`${isSelectionMode && isSelected ? 'ring-2 ring-blue-500 rounded-lg' : ''}`}>
        {children}
      </div>
    </div>
  );
}
