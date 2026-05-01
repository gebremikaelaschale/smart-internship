import React, { useState, useRef, useEffect } from 'react';
import { messagingAPI } from '@/features/messaging/messagingAPI';
import { formatMessageTime, getUserTimeZone } from '@/utils/messageUtils';

/**
 * Complete Message Actions Handler
 * Manages Reply, Edit, Delete functionality with real-time updates
 */
export default function MessageActionsHandler({ 
  messages, 
  setMessages, 
  socket, 
  selectedContact,
  myId 
}) {
  const [editingMessage, setEditingMessage] = useState(null);
  const [replyingTo, setReplyingTo] = useState(null);
  const [editContent, setEditContent] = useState('');
  const textareaRef = useRef(null);

  // Handle socket events for real-time updates
  useEffect(() => {
    if (!socket) return;

    // Handle hard delete - completely remove message
    socket.on('message:hard-deleted', (data) => {
      setMessages(prev => prev.filter(msg => String(msg._id) !== String(data.messageId)));
    });

    // Handle message edit - update message content and add edited flag
    socket.on('message:edited', (data) => {
      setMessages(prev => prev.map(msg => 
        String(msg._id) === String(data.messageId) 
          ? { 
              ...msg, 
              content: data.newContent, 
              isEdited: true, 
              editedAt: data.editedAt 
            }
          : msg
      ));
    });

    // Handle message reply - update reply preview
    socket.on('message:replied', (data) => {
      // This could be used to show typing indicators or other reply-related UI
      console.log('Message replied:', data);
    });

    return () => {
      socket.off('message:hard-deleted');
      socket.off('message:edited');
      socket.off('message:replied');
    };
  }, [socket, setMessages]);

  // Handle Reply Action
  const handleReply = (message) => {
    setReplyingTo({
      _id: message._id,
      content: message.content,
      senderName: message.senderId?.fullName || message.senderId?.name || 'Unknown',
      createdAt: message.createdAt
    });
    
    // Focus on input field
    setTimeout(() => {
      const inputElement = document.querySelector('textarea[placeholder*="Type"]');
      if (inputElement) {
        inputElement.focus();
      }
    }, 100);
  };

  // Handle Edit Action
  const handleEdit = (message) => {
    setEditingMessage(message);
    setEditContent(message.content);
    setReplyingTo(null); // Clear reply when editing
    
    // Focus on edit textarea
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.select();
      }
    }, 100);
  };

  // Handle Delete Action (Hard Delete)
  const handleDelete = async (message) => {
    try {
      // Call API with hard delete parameter
      await messagingAPI.deleteMessage(message._id, true);
      
      // Emit socket event for real-time deletion
      if (socket) {
        socket.emit('message:hard-delete', {
          messageId: message._id,
          roomId: message.roomId,
          toUserId: message.receiverId
        });
      }
      
      // Remove from local state immediately
      setMessages(prev => prev.filter(msg => String(msg._id) !== String(message._id)));
    } catch (error) {
      console.error('Failed to delete message:', error);
    }
  };

  // Save Edit
  const saveEdit = async () => {
    if (!editingMessage || !editContent.trim()) return;

    try {
      const { data } = await messagingAPI.editMessage(editingMessage._id, { 
        content: editContent.trim() 
      });
      
      // Update local state
      setMessages(prev => prev.map(msg => 
        String(msg._id) === String(editingMessage._id) 
          ? { 
              ...msg, 
              content: data.content, 
              isEdited: true, 
              editedAt: data.editedAt 
            }
          : msg
      ));
      
      // Emit socket event
      if (socket) {
        socket.emit('message:edit', {
          messageId: editingMessage._id,
          content: editContent.trim(),
          roomId: editingMessage.roomId,
          toUserId: editingMessage.receiverId
        });
      }
      
      // Clear edit state
      setEditingMessage(null);
      setEditContent('');
    } catch (error) {
      console.error('Failed to edit message:', error);
    }
  };

  // Cancel Edit
  const cancelEdit = () => {
    setEditingMessage(null);
    setEditContent('');
  };

  // Send Reply Message
  const sendReply = async (content, attachment = null) => {
    if (!replyingTo || !content.trim()) return;

    try {
      const payload = {
        receiverId: selectedContact._id,
        content: content.trim(),
        messageType: 'text',
        replyTo: replyingTo._id,
        attachment: attachment || undefined
      };

      const { data } = await messagingAPI.sendMessage(payload);
      
      // Add to messages
      setMessages(prev => [...prev, data]);
      
      // Emit socket event
      if (socket) {
        socket.emit('message:reply', {
          messageId: data._id,
          replyTo: replyingTo._id,
          roomId: data.roomId,
          toUserId: selectedContact._id
        });
      }
      
      // Clear reply state
      setReplyingTo(null);
    } catch (error) {
      console.error('Failed to send reply:', error);
    }
  };

  // Handle keyboard shortcuts
  const handleEditKeyPress = (e) => {
    if (e.key === 'Escape') {
      cancelEdit();
    } else if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      saveEdit();
    }
  };

  return {
    // State
    editingMessage,
    replyingTo,
    editContent,
    setEditContent,
    
    // Actions
    handleReply,
    handleEdit,
    handleDelete,
    saveEdit,
    cancelEdit,
    sendReply,
    
    // Refs
    textareaRef,
    
    // Keyboard handler
    handleEditKeyPress,
    
    // Clear functions
    clearReply: () => setReplyingTo(null),
    clearEdit: () => {
      setEditingMessage(null);
      setEditContent('');
    }
  };
}

/**
 * Reply Preview Component
 */
export function ReplyPreview({ replyingTo, onCancel }) {
  if (!replyingTo) return null;

  const userTimeZone = getUserTimeZone();
  const formattedTime = formatMessageTime(replyingTo.createdAt, userTimeZone);

  return (
    <div className="reply-preview border-l-4 border-blue-500 pl-3 py-2 mb-2 bg-gray-50 rounded">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-semibold text-blue-600">
          Replying to {replyingTo.senderName}
        </span>
        <button
          onClick={onCancel}
          className="text-gray-400 hover:text-gray-600 transition-colors p-1"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      <div className="text-sm text-gray-600 truncate">
        {replyingTo.content}
      </div>
      <div className="text-xs text-gray-400 mt-1">
        {formattedTime}
      </div>
    </div>
  );
}

/**
 * Edit Mode Component
 */
export function EditMode({ editingMessage, editContent, setEditContent, onSave, onCancel, textareaRef, onKeyPress }) {
  if (!editingMessage) return null;

  return (
    <div className="edit-mode p-3 bg-yellow-50 border border-yellow-200 rounded-lg mb-2">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-yellow-700">
          Editing message
        </span>
        <div className="flex gap-2">
          <button
            onClick={onSave}
            className="px-3 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700 transition-colors"
          >
            Save
          </button>
          <button
            onClick={onCancel}
            className="px-3 py-1 bg-gray-600 text-white text-xs rounded hover:bg-gray-700 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
      <textarea
        ref={textareaRef}
        value={editContent}
        onChange={(e) => setEditContent(e.target.value)}
        onKeyDown={onKeyPress}
        className="w-full p-2 border border-yellow-300 rounded resize-none focus:outline-none focus:ring-2 focus:ring-yellow-500"
        rows={3}
        placeholder="Edit your message..."
      />
    </div>
  );
}

/**
 * Enhanced Message Bubble with Actions Integration
 */
export function EnhancedMessageBubble({ 
  message, 
  isMine, 
  onReply, 
  onEdit, 
  onDelete,
  socket,
  children 
}) {
  const [showActions, setShowActions] = useState(false);
  const bubbleRef = useRef(null);

  const handleContextMenu = (e) => {
    e.preventDefault();
    // Show custom context menu instead of default
    const rect = bubbleRef.current.getBoundingClientRect();
    const x = e.clientX;
    const y = e.clientY;
    
    // This would integrate with TelegramContextMenu component
    console.log('Show context menu at:', { x, y, message });
  };

  return (
    <div
      ref={bubbleRef}
      onContextMenu={handleContextMenu}
      className={`message-bubble-wrapper ${isMine ? 'sent' : 'received'}`}
    >
      {children}
      
      {/* Edit indicator */}
      {message.isEdited && (
        <span className="text-xs opacity-60 ml-1">(edited)</span>
      )}
    </div>
  );
}
