import React, { useState, useEffect } from 'react';
import { messagingAPI } from '@/features/messaging/messagingAPI';
import SmartMediaHandler from './SmartMediaHandler';
import MessageActions from './MessageActions';
import { AnimatedMessageStatus } from './MessageStatus';
import { formatMessageTime, getUserTimeZone } from '@/utils/messageUtils';

/**
 * Custom Chat Bubble Component with Dynamic Styling
 * Integrates with user preferences for personalized chat experience
 */
export default function CustomChatBubble({ 
  message, 
  isMine, 
  onEdit, 
  onDelete, 
  onReply, 
  socket,
  userPreferences,
  showSenderInfo = false,
  isConsecutive = false,
  className = "" 
}) {
  const [localPreferences, setLocalPreferences] = useState(userPreferences);
  const [isHovered, setIsHovered] = useState(false);

  // Update local preferences when user preferences change
  useEffect(() => {
    setLocalPreferences(userPreferences);
  }, [userPreferences]);

  // Get dynamic styles based on user preferences
  const getBubbleStyles = () => {
    if (!localPreferences?.chatBubble) {
      // Default styles
      return isMine 
        ? 'bg-blue-600 text-white rounded-[18px] rounded-br-[4px]'
        : 'bg-[#F0F2F5] text-slate-800 rounded-[18px] rounded-bl-[4px]';
    }

    const bubbleType = isMine ? 'sentMessage' : 'receivedMessage';
    const styles = localPreferences.chatBubble[bubbleType];
    
    return {
      backgroundColor: styles.backgroundColor,
      color: styles.textColor,
      borderRadius: styles.borderRadius,
      padding: styles.padding,
      fontSize: localPreferences.messageDisplay?.fontSize === 'small' ? '14px' : 
                localPreferences.messageDisplay?.fontSize === 'large' ? '18px' : '16px'
    };
  };

  const bubbleStyles = getBubbleStyles();
  const userTimeZone = getUserTimeZone();
  const formattedTime = formatMessageTime(message.createdAt, userTimeZone);

  // CSS-in-JS for dynamic styling
  const dynamicStyles = {
    mainBubble: {
      backgroundColor: bubbleStyles.backgroundColor,
      color: bubbleStyles.color,
      borderRadius: bubbleStyles.borderRadius,
      padding: bubbleStyles.padding,
      fontSize: bubbleStyles.fontSize,
      transition: 'all 0.2s ease',
      maxWidth: '70%',
      wordWrap: 'break-word'
    },
    hoverEffect: {
      transform: isHovered ? 'translateY(-1px)' : 'translateY(0)',
      boxShadow: isHovered ? '0 4px 12px rgba(0,0,0,0.15)' : '0 2px 4px rgba(0,0,0,0.1)'
    }
  };

  const handleBubbleClick = () => {
    if (message.attachment?.url && message.attachment.mimeType?.startsWith('image/')) {
      window.open(message.attachment.url, '_blank');
    }
  };

  return (
    <div className={`flex ${isMine ? 'justify-end' : 'justify-start'} ${isConsecutive ? 'mt-1' : 'mt-2'}`}>
      <div 
        className="message-bubble cursor-pointer transition-all duration-200"
        style={{ ...dynamicStyles.mainBubble, ...dynamicStyles.hoverEffect }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onClick={handleBubbleClick}
      >
        {/* Reply Preview */}
        {message.replyPreview && (
          <div className="reply-preview mb-2 p-2 border-l-4 border-blue-500 bg-black/5 rounded">
            <div className="text-xs font-semibold mb-1" style={{ color: bubbleStyles.color }}>
              Replying to {message.replyPreview.senderName}
            </div>
            <div className="text-xs opacity-70 truncate">
              {message.replyPreview.attachmentType ? '📎 Attachment' : message.replyPreview.content}
            </div>
          </div>
        )}

        {/* Sender Info for Group Messages */}
        {showSenderInfo && !isMine && (
          <div className="text-[11px] font-semibold mb-1 opacity-80">
            {message.senderId?.fullName || message.senderId?.name || 'Unknown'}
          </div>
        )}

        {/* Smart Media Handler */}
        {message.attachment?.url && (
          <div className="mb-2">
            <SmartMediaHandler 
              attachment={message.attachment} 
              isMine={isMine}
            />
          </div>
        )}

        {/* Message Content with Actions */}
        <MessageActions
          message={message}
          isMine={isMine}
          onEdit={onEdit}
          onDelete={onDelete}
          onReply={onReply}
          socket={socket}
          className="message-content"
        />

        {/* Message Reactions */}
        {message.reactions && message.reactions.length > 0 && (
          <div className="reactions mt-2">
            {message.reactions.map((reaction, index) => (
              <span 
                key={index}
                className="inline-block px-2 py-1 bg-black/10 rounded-full text-xs mr-1"
                style={{ backgroundColor: 'rgba(255,255,255,0.2)' }}
              >
                {reaction.emoji}
              </span>
            ))}
          </div>
        )}

        {/* Message Status and Timestamp */}
        <div className={`flex items-center justify-end gap-1 mt-1 text-[10px] opacity-60`}>
          <span>{formattedTime}</span>
          {isMine && localPreferences?.messageDisplay?.showReadReceipts && (
            <AnimatedMessageStatus 
              status={message.status || (message.isRead ? 'read' : 'sent')} 
              isMine={isMine} 
              time={formattedTime}
            />
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Chat Bubble Style Customizer Component
 * Allows users to customize their chat bubble appearance
 */
export function ChatBubbleCustomizer({ userId, onPreferencesUpdate }) {
  const [preferences, setPreferences] = useState(null);
  const [activeTab, setActiveTab] = useState('sent');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    loadPreferences();
  }, []);

  const loadPreferences = async () => {
    try {
      const { data } = await messagingAPI.getUserPreferences();
      setPreferences(data);
    } catch (error) {
      console.error('Failed to load preferences:', error);
    }
  };

  const savePreferences = async (newPreferences) => {
    setIsSaving(true);
    try {
      const { data } = await messagingAPI.updateChatBubble({
        sentMessage: newPreferences.chatBubble.sentMessage,
        receivedMessage: newPreferences.chatBubble.receivedMessage
      });
      setPreferences(data);
      onPreferencesUpdate?.(data);
    } catch (error) {
      console.error('Failed to save preferences:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const updateBubbleStyle = (bubbleType, property, value) => {
    const updated = {
      ...preferences,
      chatBubble: {
        ...preferences.chatBubble,
        [bubbleType]: {
          ...preferences.chatBubble[bubbleType],
          [property]: value
        }
      }
    };
    setPreferences(updated);
    savePreferences(updated);
  };

  const presetColors = [
    { name: 'Blue', sent: '#2563eb', received: '#f0f2f5' },
    { name: 'Green', sent: '#16a34a', received: '#f0fdf4' },
    { name: 'Purple', sent: '#9333ea', received: '#faf5ff' },
    { name: 'Orange', sent: '#ea580c', received: '#fff7ed' },
    { name: 'Pink', sent: '#db2777', received: '#fdf2f8' },
    { name: 'Dark', sent: '#1f2937', received: '#374151' }
  ];

  if (!preferences) {
    return <div className="p-4">Loading preferences...</div>;
  }

  const currentBubble = preferences.chatBubble[activeTab === 'sent' ? 'sentMessage' : 'receivedMessage'];

  return (
    <div className="chat-bubble-customizer p-4 bg-white rounded-lg shadow-lg max-w-md">
      <h3 className="text-lg font-semibold mb-4">Customize Chat Bubbles</h3>
      
      {/* Tab Selection */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setActiveTab('sent')}
          className={`px-4 py-2 rounded ${activeTab === 'sent' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
        >
          Your Messages
        </button>
        <button
          onClick={() => setActiveTab('received')}
          className={`px-4 py-2 rounded ${activeTab === 'received' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
        >
          Their Messages
        </button>
      </div>

      {/* Color Presets */}
      <div className="mb-4">
        <label className="block text-sm font-medium mb-2">Color Presets</label>
        <div className="grid grid-cols-3 gap-2">
          {presetColors.map((preset) => (
            <button
              key={preset.name}
              onClick={() => {
                updateBubbleStyle(activeTab === 'sent' ? 'sentMessage' : 'receivedMessage', 'backgroundColor', preset[activeTab === 'sent' ? 'sent' : 'received']);
                updateBubbleStyle(activeTab === 'sent' ? 'sentMessage' : 'receivedMessage', 'textColor', activeTab === 'sent' ? '#ffffff' : '#1e293b');
              }}
              className="flex items-center gap-2 p-2 border rounded hover:bg-gray-50"
            >
              <div 
                className="w-4 h-4 rounded"
                style={{ backgroundColor: preset[activeTab === 'sent' ? 'sent' : 'received'] }}
              />
              <span className="text-xs">{preset.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Custom Color Picker */}
      <div className="mb-4">
        <label className="block text-sm font-medium mb-2">Background Color</label>
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={currentBubble.backgroundColor}
            onChange={(e) => updateBubbleStyle(activeTab === 'sent' ? 'sentMessage' : 'receivedMessage', 'backgroundColor', e.target.value)}
            className="w-12 h-12 border rounded cursor-pointer"
          />
          <input
            type="text"
            value={currentBubble.backgroundColor}
            onChange={(e) => updateBubbleStyle(activeTab === 'sent' ? 'sentMessage' : 'receivedMessage', 'backgroundColor', e.target.value)}
            className="flex-1 px-3 py-2 border rounded"
            placeholder="#2563eb"
          />
        </div>
      </div>

      {/* Text Color */}
      <div className="mb-4">
        <label className="block text-sm font-medium mb-2">Text Color</label>
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={currentBubble.textColor}
            onChange={(e) => updateBubbleStyle(activeTab === 'sent' ? 'sentMessage' : 'receivedMessage', 'textColor', e.target.value)}
            className="w-12 h-12 border rounded cursor-pointer"
          />
          <input
            type="text"
            value={currentBubble.textColor}
            onChange={(e) => updateBubbleStyle(activeTab === 'sent' ? 'sentMessage' : 'receivedMessage', 'textColor', e.target.value)}
            className="flex-1 px-3 py-2 border rounded"
            placeholder="#ffffff"
          />
        </div>
      </div>

      {/* Border Radius */}
      <div className="mb-4">
        <label className="block text-sm font-medium mb-2">Border Radius</label>
        <select
          value={currentBubble.borderRadius}
          onChange={(e) => updateBubbleStyle(activeTab === 'sent' ? 'sentMessage' : 'receivedMessage', 'borderRadius', e.target.value)}
          className="w-full px-3 py-2 border rounded"
        >
          <option value="4px">Square</option>
          <option value="8px">Rounded</option>
          <option value="18px">Bubble</option>
          <option value="24px">Very Rounded</option>
          <option value="50px">Pill</option>
        </select>
      </div>

      {/* Preview */}
      <div className="mb-4">
        <label className="block text-sm font-medium mb-2">Preview</label>
        <div className="space-y-2">
          <div className="flex justify-end">
            <div
              className="px-4 py-2 max-w-[70%]"
              style={{
                backgroundColor: preferences.chatBubble.sentMessage.backgroundColor,
                color: preferences.chatBubble.sentMessage.textColor,
                borderRadius: preferences.chatBubble.sentMessage.borderRadius
              }}
            >
              Your message preview
            </div>
          </div>
          <div className="flex justify-start">
            <div
              className="px-4 py-2 max-w-[70%]"
              style={{
                backgroundColor: preferences.chatBubble.receivedMessage.backgroundColor,
                color: preferences.chatBubble.receivedMessage.textColor,
                borderRadius: preferences.chatBubble.receivedMessage.borderRadius
              }}
            >
              Their message preview
            </div>
          </div>
        </div>
      </div>

      {/* Reset Button */}
      <button
        onClick={() => {
          messagingAPI.resetPreferences().then(loadPreferences);
        }}
        className="w-full px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors"
      >
        Reset to Defaults
      </button>
    </div>
  );
}
