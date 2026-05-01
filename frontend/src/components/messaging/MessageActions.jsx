import React, { useState, useRef } from 'react';
import { messagingAPI } from '@/features/messaging/messagingAPI';

/**
 * Message Actions Component - Edit, Delete, Reply functionality
 * Provides context menu and action handlers for messages
 */
export default function MessageActions({ 
  message, 
  isMine, 
  onEdit, 
  onDelete, 
  onReply, 
  socket,
  className = "" 
}) {
  const [showActions, setShowActions] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(message.content);
  const [isDeleting, setIsDeleting] = useState(false);
  const actionsRef = useRef(null);

  // Close actions when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (event) => {
      if (actionsRef.current && !actionsRef.current.contains(event.target)) {
        setShowActions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleEdit = async () => {
    if (!editContent.trim() || editContent === message.content) {
      setIsEditing(false);
      return;
    }

    try {
      const { data } = await messagingAPI.editMessage(message._id, { content: editContent.trim() });
      onEdit?.(data);
      setIsEditing(false);
      setShowActions(false);
      
      // Emit socket event for real-time update
      if (socket) {
        socket.emit('message:edit', {
          messageId: message._id,
          content: editContent.trim(),
          roomId: message.roomId,
          toUserId: message.receiverId
        });
      }
    } catch (error) {
      console.error('Failed to edit message:', error);
      // Revert to original content
      setEditContent(message.content);
      setIsEditing(false);
    }
  };

  const handleDelete = async () => {
    if (isDeleting) return;
    
    setIsDeleting(true);
    try {
      const { data } = await messagingAPI.deleteMessage(message._id, true);
      onDelete?.(data);
      setShowActions(false);
      
      // Emit socket event for real-time update
      if (socket) {
        socket.emit('message:delete', {
          messageId: message._id,
          roomId: message.roomId,
          toUserId: message.receiverId,
          forEveryone: true
        });
      }
    } catch (error) {
      console.error('Failed to delete message:', error);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleReply = () => {
    onReply?.(message);
    setShowActions(false);
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Escape') {
      setEditContent(message.content);
      setIsEditing(false);
    } else if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleEdit();
    }
  };

  if (message.deletedForEveryone) {
    return (
      <div className={`italic opacity-60 text-sm ${className}`}>
        This message was deleted
      </div>
    );
  }

  if (isEditing) {
    return (
      <div className={`edit-mode ${className}`}>
        <textarea
          value={editContent}
          onChange={(e) => setEditContent(e.target.value)}
          onKeyDown={handleKeyPress}
          className="w-full p-2 border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
          rows={3}
          autoFocus
        />
        <div className="flex gap-2 mt-2">
          <button
            onClick={handleEdit}
            className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
          >
            Save
          </button>
          <button
            onClick={() => {
              setEditContent(message.content);
              setIsEditing(false);
            }}
            className="px-3 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`message-actions relative ${className}`} ref={actionsRef}>
      <div className="flex items-center gap-2">
        {/* Message content with edit indicator */}
        <div className="flex-1">
          {message.content}
          {message.editedAt && (
            <span className="text-xs opacity-60 ml-1">(edited)</span>
          )}
        </div>
        
        {/* Actions button for sent messages */}
        {isMine && (
          <button
            onClick={() => setShowActions(!showActions)}
            className={`p-1 rounded-full hover:bg-black/10 transition-colors ${showActions ? 'bg-black/10' : ''}`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
            </svg>
          </button>
        )}
      </div>

      {/* Actions dropdown */}
      {showActions && (
        <div className="absolute top-full right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 min-w-[150px]">
          <button
            onClick={handleReply}
            className="w-full px-4 py-2 text-left hover:bg-gray-50 transition-colors flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
            </svg>
            Reply
          </button>
          
          {isMine && (
            <>
              <button
                onClick={() => setIsEditing(true)}
                className="w-full px-4 py-2 text-left hover:bg-gray-50 transition-colors flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Edit
              </button>
              
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="w-full px-4 py-2 text-left hover:bg-red-50 text-red-600 transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                {isDeleting ? 'Deleting...' : 'Delete'}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Reply Preview Component - Shows quoted message above reply
 */
export function ReplyPreview({ replyTo, onCancel }) {
  if (!replyTo) return null;

  return (
    <div className="reply-preview border-l-4 border-blue-500 pl-3 py-2 mb-2 bg-gray-50 rounded">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-semibold text-blue-600">
          Replying to {replyTo.senderName}
        </span>
        {onCancel && (
          <button
            onClick={onCancel}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
      <div className="text-sm text-gray-600 truncate">
        {replyTo.attachmentType ? (
          <span className="italic">📎 Attachment</span>
        ) : (
          replyTo.content
        )}
      </div>
    </div>
  );
}

/**
 * Typing Indicator Component
 */
export function TypingIndicator({ users = [] }) {
  if (users.length === 0) return null;

  const getTypingText = () => {
    if (users.length === 1) {
      return `${users[0].name} is typing...`;
    } else if (users.length === 2) {
      return `${users[0].name} and ${users[1].name} are typing...`;
    } else {
      return `${users.length} people are typing...`;
    }
  };

  return (
    <div className="flex items-center gap-2 px-4 py-2 text-sm text-gray-500 italic">
      <div className="flex gap-1">
        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
      </div>
      <span>{getTypingText()}</span>
    </div>
  );
}

/**
 * Message Reactions Component
 */
export function MessageReactions({ message, onReactionAdd, onReactionRemove }) {
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  
  const reactions = message.reactions || [];
  const groupedReactions = reactions.reduce((acc, reaction) => {
    const emoji = reaction.emoji;
    if (!acc[emoji]) {
      acc[emoji] = { count: 0, users: [] };
    }
    acc[emoji].count++;
    acc[emoji].users.push(reaction.userId);
    return acc;
  }, {});

  const commonEmojis = ['👍', '❤️', '😂', '😮', '😢', '👏', '🎉', '🔥'];

  const handleReaction = async (emoji) => {
    try {
      const existingReaction = reactions.find(r => r.emoji === emoji);
      
      if (existingReaction) {
        await messagingAPI.removeReaction(message._id, emoji);
        onReactionRemove?.(message._id, emoji);
      } else {
        await messagingAPI.reactMessage(message._id, { emoji });
        onReactionAdd?.(message._id, emoji);
      }
      setShowEmojiPicker(false);
    } catch (error) {
      console.error('Failed to add reaction:', error);
    }
  };

  return (
    <div className="message-reactions flex items-center gap-1 mt-2">
      {Object.entries(groupedReactions).map(([emoji, data]) => (
        <button
          key={emoji}
          onClick={() => handleReaction(emoji)}
          className="flex items-center gap-1 px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded-full transition-colors text-sm"
        >
          <span>{emoji}</span>
          <span className="text-xs">{data.count}</span>
        </button>
      ))}
      
      <button
        onClick={() => setShowEmojiPicker(!showEmojiPicker)}
        className="w-6 h-6 flex items-center justify-center bg-gray-100 hover:bg-gray-200 rounded-full transition-colors"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
        </svg>
      </button>

      {showEmojiPicker && (
        <div className="absolute bottom-full mb-2 bg-white border border-gray-200 rounded-lg shadow-lg p-2 grid grid-cols-4 gap-1 z-50">
          {commonEmojis.map(emoji => (
            <button
              key={emoji}
              onClick={() => handleReaction(emoji)}
              className="w-8 h-8 hover:bg-gray-100 rounded flex items-center justify-center text-lg"
            >
              {emoji}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
