import React, { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import useAuth from '@/hooks/useAuth';
import { Link } from 'react-router-dom';
import { messagingAPI } from '../messagingAPI';
import { io } from 'socket.io-client';
import Button from '@/components/ui/Button';
import DateDivider from '@/components/messaging/DateDivider';
import MessageSelection, { SelectableMessageBubble, useMessageSelection } from '@/components/messaging/MessageSelection';
import { 
  groupMessagesByDate, 
  formatMessageTime, 
  formatFullTimestamp,
  getUserTimeZone,
  processMessagesForRendering
} from '@/utils/messageUtils';

const sortContacts = (contacts) => {
  return [...(contacts || [])].sort((a, b) => {
    const aUnread = Number(a?.unreadCount || 0);
    const bUnread = Number(b?.unreadCount || 0);
    if (bUnread !== aUnread) return bUnread - aUnread;

    const aTime = new Date(a?.lastMessage?.createdAt || 0).getTime();
    const bTime = new Date(b?.lastMessage?.createdAt || 0).getTime();
    if (bTime !== aTime) return bTime - aTime;

    const aName = getContactDisplayName(a).toLowerCase();
    const bName = getContactDisplayName(b).toLowerCase();
    return aName.localeCompare(bName);
  });
};

// Telegram-style Avatar Component
const Avatar = ({ name, avatarUrl, size = 'w-10 h-10' }) => {
  const [imgError, setImgError] = useState(false);
  const initials = (name || '?').charAt(0).toUpperCase();

  // Reset error state when URL changes
  useEffect(() => {
    setImgError(false);
  }, [avatarUrl]);

  // Size mapping
  const sizeMap = {
    'w-10 h-10': 'w-10 h-10',
    'lg': 'w-20 h-20',
    'md': 'w-12 h-12',
    'sm': 'w-8 h-8'
  };
  const actualSize = sizeMap[size] || size;

  // Color mapping based on name length for Telegram-like variety
  const colors = ['bg-blue-500', 'bg-emerald-500', 'bg-purple-500', 'bg-amber-500', 'bg-rose-500', 'bg-cyan-600'];
  const bgColor = colors[(name?.length || 0) % colors.length];

  if (avatarUrl && !imgError) {
    return (
      <img
        src={avatarUrl}
        alt={name}
        onError={() => setImgError(true)}
        className={`${actualSize} rounded-full object-cover border border-slate-100 shadow-sm shrink-0`}
      />
    );
  }

  return (
    <div className={`${actualSize} rounded-full ${bgColor} flex items-center justify-center text-white font-bold text-sm shrink-0 shadow-sm border border-white/20`}>
      {initials}
    </div>
  );
};

// Telegram-style Custom Modal for Deletion
const DeleteMessageModal = ({ isOpen, onConfirm, onCancel, message, contactName }) => {
  const [deleteForEveryone, setDeleteForEveryone] = useState(true);
  
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[320px] overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="p-5">
          <h3 className="text-[17px] font-semibold text-slate-900 mb-2">Delete message?</h3>
          <p className="text-[15px] text-slate-600 mb-6 leading-relaxed">
            Do you want to delete this message?
          </p>
          
          <label className="flex items-center gap-3 cursor-pointer group mb-8 select-none">
            <div className="relative flex items-center justify-center">
              <input 
                type="checkbox" 
                className="peer appearance-none w-5 h-5 border-2 border-slate-300 rounded-[4px] checked:bg-blue-500 checked:border-blue-500 transition-all cursor-pointer"
                checked={deleteForEveryone}
                onChange={(e) => setDeleteForEveryone(e.target.checked)}
              />
              <svg className="absolute w-3.5 h-3.5 text-white opacity-0 peer-checked:opacity-100 transition-opacity pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <span className="text-[14px] text-slate-700 font-medium group-hover:text-slate-900 transition-colors">
              Also delete for {contactName || 'the other user'}
            </span>
          </label>

          <div className="flex justify-end gap-2">
            <button
              onClick={onCancel}
              className="px-4 py-2 text-[14px] font-semibold text-blue-500 hover:bg-blue-50 rounded-lg transition-colors uppercase tracking-wide"
            >
              Cancel
            </button>
            <button
              onClick={() => onConfirm(message._id, deleteForEveryone)}
              className="px-4 py-2 text-[14px] font-semibold text-rose-500 hover:bg-rose-50 rounded-lg transition-colors uppercase tracking-wide"
            >
              Delete
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Helper Functions for File Attachments
const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const getFileIcon = (filename) => {
  const extension = filename.split('.').pop().toLowerCase();
  
  switch (extension) {
    case 'pdf':
      return (
        <svg className="w-6 h-6 text-red-500" fill="currentColor" viewBox="0 0 24 24">
          <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z" />
        </svg>
      );
    case 'doc':
    case 'docx':
      return (
        <svg className="w-6 h-6 text-blue-500" fill="currentColor" viewBox="0 0 24 24">
          <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20M10,19H12V17H10V19M10,16H12V14H10V16M10,13H12V11H10V13M10,10H12V8H10V10Z" />
        </svg>
      );
    case 'xls':
    case 'xlsx':
      return (
        <svg className="w-6 h-6 text-green-500" fill="currentColor" viewBox="0 0 24 24">
          <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20M8,12H16V14H8V12M8,16H16V18H8V16Z" />
        </svg>
      );
    case 'jpg':
    case 'jpeg':
    case 'png':
    case 'gif':
    case 'bmp':
    case 'svg':
      return (
        <svg className="w-6 h-6 text-purple-500" fill="currentColor" viewBox="0 0 24 24">
          <path d="M8.5,13.5L11,16.5L14.5,12L19,18H5M21,19V5C21,3.89 20.1,3 19,3H5A2,2 0 0,0 3,5V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19Z" />
        </svg>
      );
    case 'txt':
      return (
        <svg className="w-6 h-6 text-gray-500" fill="currentColor" viewBox="0 0 24 24">
          <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20M8,12H16V14H8V12M8,16H13V18H8V16Z" />
        </svg>
      );
    default:
      return (
        <svg className="w-6 h-6 text-gray-500" fill="currentColor" viewBox="0 0 24 24">
          <path d="M13,9V3.5L18.5,9M6,2C4.89,2 4,2.89 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2H6Z" />
        </svg>
      );
  }
};

const isImageFile = (filename) => {
  const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg', 'webp'];
  const extension = filename.split('.').pop().toLowerCase();
  return imageExtensions.includes(extension);
};

const handlePreviewImage = (attachment) => {
  const imageUrl = attachment.url || attachment.data;
  if (!imageUrl) {
    console.warn('No image URL available for preview');
    return;
  }
  
  // Open image in new tab for better preview
  const win = window.open();
  win.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Image Preview - ${attachment.filename || 'Image'}</title>
        <style>
          body { margin: 0; padding: 20px; display: flex; justify-content: center; align-items: center; min-height: 100vh; background: #f5f5f5; }
          img { max-width: 100%; max-height: 90vh; object-fit: contain; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
        </style>
      </head>
      <body>
        <img src="${imageUrl}" alt="${attachment.filename || 'Image'}" />
      </body>
    </html>
  `);
};

const handleOpenFile = (attachment) => {
  const fileUrl = attachment.url;
  const filename = attachment.filename || attachment.originalname;
  
  if (!fileUrl) {
    console.warn('No file URL available for opening');
    return;
  }
  
  // For documents, try to open in new tab
  if (filename) {
    const extension = filename.split('.').pop().toLowerCase();
    
    // For PDFs and other viewable documents, open in new tab
    if (['pdf', 'txt', 'json', 'xml', 'csv'].includes(extension)) {
      window.open(fileUrl, '_blank');
    } else {
      // For other file types, fallback to download
      handleDownloadFile(attachment);
    }
  } else {
    // Fallback to download if no filename
    handleDownloadFile(attachment);
  }
};

const handleDownloadFile = async (attachment) => {
  try {
    const fileUrl = attachment.url;
    const filename = attachment.filename || attachment.originalname || 'download';
    
    if (!fileUrl) {
      console.warn('No file URL available for download');
      return;
    }
    
    // Try to fetch the file first to ensure it's accessible
    const response = await fetch(fileUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch file: ${response.statusText}`);
    }
    
    // Get the blob data
    const blob = await response.blob();
    
    // Create download link
    const link = document.createElement('a');
    link.href = window.URL.createObjectURL(blob);
    link.download = filename;
    link.style.display = 'none';
    
    // Trigger download
    document.body.appendChild(link);
    link.click();
    
    // Cleanup
    document.body.removeChild(link);
    window.URL.revokeObjectURL(link.href);
    
    console.log(`Downloaded: ${filename}`);
  } catch (error) {
    console.error('Download failed:', error);
    
    // Fallback: try direct link download
    const link = document.createElement('a');
    link.href = attachment.url;
    link.download = attachment.filename || attachment.originalname || 'download';
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
};

const ROLE_BADGE_STYLES = {
  student: 'bg-sky-50 text-sky-700 border-sky-200',
  hod: 'bg-violet-50 text-violet-700 border-violet-200',
  dean: 'bg-amber-50 text-amber-700 border-amber-200',
  admin: 'bg-slate-900 text-white border-slate-900',
  employer: 'bg-emerald-50 text-emerald-700 border-emerald-200'
};

const getRoleBadgeLabel = (role) => {
  const normalized = String(role || '').trim().toLowerCase();
  if (normalized === 'student') return 'STUDENT';
  if (normalized === 'hod' || normalized === 'deptadmin') return 'HOD';
  if (normalized === 'dean' || normalized === 'collegeadmin') return 'DEAN';
  if (normalized === 'admin' || normalized === 'superadmin' || normalized === 'super_admin') return 'ADMIN';
  if (normalized === 'employer' || normalized === 'industry partner') return 'PARTNER';
  return String(role || 'USER').toUpperCase();
};

const getRoleBadgeClass = (role) => ROLE_BADGE_STYLES[String(role || '').trim().toLowerCase()] || 'bg-slate-50 text-slate-700 border-slate-200';

const getContactDisplayName = (contact) => String(
  contact?.displayName
  || contact?.fullName
  || contact?.name
  || contact?.companyName
  || contact?.email
  || 'Unknown'
).trim();

const getContactSecondaryLabel = (contact) => {
  const role = String(contact?.role || '').trim().toLowerCase();
  if (role === 'employer' || role === 'industry partner') {
    return String(contact?.representativeName || contact?.focalPersonName || contact?.email || '').trim();
  }
  return String(contact?.department || contact?.college || contact?.email || '').trim();
};

const ContactListItem = React.memo(function ContactListItem({
  contact,
  isSelected,
  isDisabled,
  onSelect,
  formatAvatar,
  onlineStatus,
  myId,
  getRoleBadgeClass,
  getRoleBadgeLabel,
  formatTime
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(contact)}
      disabled={isDisabled}
      className={`w-full text-left p-4 transition-colors flex items-center gap-3 ${
        isDisabled ? 'cursor-not-allowed opacity-70' : 'cursor-pointer hover:bg-white'
      } ${isSelected ? 'bg-white border-l-4 border-l-blue-600 shadow-sm' : 'hover:bg-white/80'}`}
    >
      <div className="relative">
        <Avatar
          name={getContactDisplayName(contact)}
          avatarUrl={formatAvatar(contact.avatar)}
        />
        <div
          className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white ${
            (onlineStatus[String(contact._id)]?.isOnline ?? contact.isOnline)
              ? 'bg-green-500'
              : 'bg-gray-400'
          }`}
          title={(onlineStatus[String(contact._id)]?.isOnline ?? contact.isOnline) ? 'Online' : 'Offline'}
        />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="font-semibold text-sm text-slate-900 truncate">{getContactDisplayName(contact)}</div>
            {getContactSecondaryLabel(contact) && (
              <div className="text-[11px] text-slate-500 truncate mt-0.5">{getContactSecondaryLabel(contact)}</div>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {contact.lastMessage && (
              <span className="text-[10px] text-slate-400">
                {formatTime(contact.lastMessage.createdAt)}
              </span>
            )}
            {Number(contact.unreadCount || 0) > 0 && (
              <span className="inline-flex min-w-[18px] h-5 items-center justify-center rounded-full bg-red-500 border border-white px-1.5 text-[10px] font-semibold text-white shadow-sm">
                {contact.unreadCount > 9 ? '9+' : contact.unreadCount}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1.5 mt-1">
          <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em] ${getRoleBadgeClass(contact.role)}`}>
            {getRoleBadgeLabel(contact.role)}
          </span>
        </div>
        {contact.lastMessage && (() => {
          const msg = contact.lastMessage;
          const content = String(msg.content || '').toLowerCase();
          const isDeleted = msg.deletedForEveryone || content.includes('message was deleted') || content === 'deleted';
          if (isDeleted) return null;

          return (
            <div className="text-xs text-slate-400 truncate mt-1">
              {String(msg.senderId) === String(myId) ? 'You: ' : ''}
              {msg.content}
            </div>
          );
        })()}
      </div>
    </button>
  );
});

// Telegram-style Message Bubble Component with Enhanced Timestamping, Context Menu, and Selection
const MessageBubble = ({ message, isMine, showSenderInfo = false, isConsecutive = false, messageSelection, socket, setReplyingTo, textareaRef, setContextMenu }) => {
  const messageStatus = message.status || (message.isRead ? 'read' : 'sent');
  const userTimeZone = getUserTimeZone();
  const formattedTime = formatMessageTime(message.createdAt, userTimeZone);
  const fullTimestamp = formatFullTimestamp(message.createdAt, userTimeZone);
  
  // Adjust styling for consecutive messages
  const bubbleStyles = isConsecutive 
    ? `${isMine ? 'rounded-tr-[4px]' : 'rounded-tl-[4px]'}`
    : `${isMine ? 'rounded-[18px] rounded-br-[4px]' : 'rounded-[18px] rounded-bl-[4px]'}`;
  
  const isSelected = messageSelection?.isMessageSelected(message._id);
  
  return (
    <SelectableMessageBubble
      message={message}
      isMine={isMine}
      isSelectionMode={messageSelection?.isSelectionMode}
      isSelected={isSelected}
      onToggleSelection={messageSelection?.toggleMessageSelection}
    >
      <div 
        className={`message-bubble-wrapper ${isMine ? 'sent' : 'received'} cursor-pointer`}
        onContextMenu={(e) => {
          e.preventDefault();
          
          setContextMenu({
            x: e.pageX,
            y: e.pageY,
            messageId: message._id,
            isMine: isMine,
            message: message
          });
        }}
      >
        {/* Message Content */}
        <div className={`${bubbleStyles} ${isMine ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-900'} px-4 py-2 max-w-xs lg:max-w-md shadow-sm relative group`}>
          <>
          {/* Quoted Message (Reply) - Telegram/WhatsApp Style */}
          {(message.replyTo || message.replyPreview) && (
            <div 
              className={`mb-3 p-2 rounded-t-lg border-l-4 ${
                isMine 
                  ? 'bg-blue-700/30 border-blue-400' 
                  : 'bg-gray-200/70 border-gray-400'
              }`}
            >
              <div className={`text-xs font-semibold mb-1 ${
                isMine ? 'text-blue-200' : 'text-gray-600'
              }`}>
                {message.replyTo?.senderName || message.replyPreview?.senderName || message.senderId?.displayName || message.senderId?.fullName || message.senderId?.name || 'Unknown'}
              </div>
              <div className={`text-xs truncate ${
                isMine ? 'text-blue-100 opacity-80' : 'text-gray-600 opacity-80'
              }`}>
                {message.replyTo?.content || message.replyPreview?.content || 
                 (message.replyPreview?.attachmentType ? '📎 Attachment' : 'No content')}
              </div>
            </div>
          )}
          
          {/* Show sender info for group messages or when appropriate */}
          {showSenderInfo && !isMine && (
            <div className="text-[11px] font-semibold text-blue-600 mb-1 opacity-80">
              {message.senderId?.displayName || message.senderId?.fullName || message.senderId?.name || 'Unknown'}
            </div>
          )}
          
          {/* Message Text and File Extraction wrapper */}
          {(() => {
            const isLegacyFile = (!message.attachment?.url && !message.attachments?.length && message.content && message.content.startsWith('Sent a file:'));
            const legacyFilename = isLegacyFile ? message.content.replace('Sent a file:', '').trim() : null;
            const attachmentsToRender = [
              ...(message.attachments || []),
              ...(message.attachment?.url ? [message.attachment] : []),
              ...(isLegacyFile ? [{ name: legacyFilename, size: 0, url: '' }] : [])
            ].filter(Boolean);

            return (
              <>
                {/* Message Text */}
                {message.content && !isLegacyFile && !(message.messageType === 'file' && message.content.startsWith('Sent a file:')) && (
                  <div className="text-sm break-words">
                    {message.content}
                  </div>
                )}
                
                {/* Enhanced File Attachments with Real Preview */}
                {attachmentsToRender.length > 0 ? (
                  <div className="mt-2 space-y-2">
                    {attachmentsToRender.map((attachment, index) => {
                      console.log('Rendering attachment:', attachment);
                      const filename = attachment.filename || attachment.originalname || attachment.name || 'Unknown file';
                      const fileSize = attachment.size ? formatFileSize(attachment.size) : 'Unknown size';
                      const fileIcon = getFileIcon(filename);
                      const isImage = isImageFile(filename);
                      const fileUrl = attachment.url || attachment.data;
                      
                      return (
                        <div 
                          key={index} 
                          className={`rounded-lg border transition-all hover:shadow-md ${
                            isMine 
                              ? 'bg-blue-50 border-blue-200 hover:bg-blue-100' 
                              : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                          }`}
                        >
                          {/* Image Preview - Display inline for images */}
                          {isImage && (
                            <div className="relative">
                              {fileUrl ? (
                                <img 
                                  src={fileUrl} 
                                  alt={filename}
                                  className="w-full max-h-64 object-cover rounded-t-lg cursor-pointer"
                                  onClick={() => handlePreviewImage(attachment)}
                                  loading="lazy"
                                />
                              ) : (
                                <div className="w-full h-32 bg-gray-200 flex items-center justify-center rounded-t-lg">
                                  <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                  </svg>
                                </div>
                              )}
                              <div className="absolute top-2 right-2 bg-black/50 text-white px-2 py-1 rounded text-xs">
                                Image
                              </div>
                            </div>
                          )}
                          
                          {/* File Info and Actions */}
                          <div className={`p-3 ${isImage ? 'border-t' : ''}`}>
                            <div className="flex items-center gap-3">
                              {/* File Icon */}
                              <div className={`p-2 rounded-lg flex-shrink-0 ${isMine ? 'bg-blue-100' : 'bg-gray-200'}`}>
                                {fileIcon}
                              </div>
                              
                              {/* File Info */}
                              <div className="flex-1 min-w-0">
                                <div className={`text-sm font-medium truncate ${
                                  isMine ? 'text-blue-900' : 'text-gray-900'
                                }`}>
                                  {filename}
                                </div>
                                <div className={`text-xs ${
                                  isMine ? 'text-blue-600' : 'text-gray-500'
                                }`}>
                                  {fileSize}
                                </div>
                              </div>
                              
                              {/* Action Buttons */}
                              <div className="flex gap-2 flex-shrink-0">
                                {/* Preview/Open Button */}
                                <button
                                  onClick={() => fileUrl ? (isImage ? handlePreviewImage(attachment) : handleOpenFile(attachment)) : null}
                                  className={`p-2 rounded-lg transition-colors ${
                                    isMine 
                                      ? 'bg-blue-200 hover:bg-blue-300 text-blue-700' 
                                      : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                                  } ${!fileUrl ? 'opacity-50 cursor-not-allowed' : ''}`}
                                  title={!fileUrl ? "File not available" : (isImage ? "Preview" : "Open")}
                                  disabled={!fileUrl}
                                >
                                  {isImage ? (
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                    </svg>
                                  ) : (
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                    </svg>
                                  )}
                                </button>
                                
                                {/* Download Button */}
                                <button
                                  onClick={() => fileUrl ? handleDownloadFile(attachment) : null}
                                  className={`p-2 rounded-lg transition-colors ${
                                    isMine 
                                      ? 'bg-blue-200 hover:bg-blue-300 text-blue-700' 
                                      : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                                  } ${!fileUrl ? 'opacity-50 cursor-not-allowed' : ''}`}
                                  title={!fileUrl ? "File not available" : "Download"}
                                  disabled={!fileUrl}
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                  </svg>
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : null}
              </>
            )
          })()}
          </>
        </div>
        
        {/* Timestamp and Read Receipt */}
        <div className={`flex items-center justify-end gap-1 mt-1 text-[10.5px] font-medium ${isMine ? 'text-gray-500' : 'text-gray-500'}`}>
          <span className="hover:text-gray-700 transition-colors cursor-default" title={fullTimestamp}>
            {formattedTime}
          </span>
          {isMine && (
            <div className="flex items-center gap-1">
              {messageStatus === 'read' && (
                <div className="flex items-center" title="Read">
                  <svg className="w-3.5 h-3.5 text-cyan-500 drop-shadow-sm" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  <svg className="w-3.5 h-3.5 text-cyan-500 drop-shadow-sm -ml-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              )}
              {messageStatus === 'delivered' && (
                <div className="flex items-center" title="Delivered">
                  <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  <svg className="w-3.5 h-3.5 text-gray-400 -ml-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              )}
              {messageStatus === 'sent' && (
                <div className="flex items-center" title="Sent">
                  <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              )}
            </div>
          )}
          {/* Edit indicator inside timestamp row for better alignment */}
          {message.isEdited && (
            <span className={`italic font-semibold ml-1 ${isMine ? 'text-blue-500' : 'text-gray-600'}`}>
              (edited)
            </span>
          )}
        </div>
      </div>
    </SelectableMessageBubble>
  );
};

export default function Messages() {
  const auth = useAuth();
  const [contacts, setContacts] = useState([]);
  const [selectedContactId, setSelectedContactId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [processedMessages, setProcessedMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [draft, setDraft] = useState('');
  const [attachment, setAttachment] = useState(null);
  const [showInfo, setShowInfo] = useState(false);
  const [replyingTo, setReplyingTo] = useState(null);
  const [editingMessage, setEditingMessage] = useState(null);
  const [editContent, setEditContent] = useState('');
  const [onlineStatus, setOnlineStatus] = useState({});
  const [contactSearchQuery, setContactSearchQuery] = useState('');
  const [contactSearchResults, setContactSearchResults] = useState([]);
  const [messageSearchQuery, setMessageSearchQuery] = useState('');
  const [messageSearchResults, setMessageSearchResults] = useState([]);
  const [typingUsers, setTypingUsers] = useState(new Set());
  const [showSearch, setShowSearch] = useState(false);
  const [contextMenu, setContextMenu] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  
  const [socket, setSocket] = useState(null);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const textareaRef = useRef(null);
  const refreshContactsRef = useRef(() => {});
  const selectedContactIdRef = useRef(null);
  const myId = auth?.user?.id || auth?.user?._id;
  const sortedContacts = useMemo(() => sortContacts(contacts), [contacts]);
  const selectedContact = useMemo(() => (
    sortedContacts.find(contact => String(contact._id) === String(selectedContactId)) || null
  ), [sortedContacts, selectedContactId]);
  
  // Message selection handler
  const messageSelection = useMessageSelection();

  // Handle bulk delete
  const handleBulkDelete = async (selectedMessageIds) => {
    try {
      const { data } = await messagingAPI.bulkDeleteMessages(selectedMessageIds);
      
      // Remove deleted messages from local state
      setMessages(prev => prev.filter(msg => !selectedMessageIds.includes(String(msg._id))));
      
      // Emit socket events for real-time updates
      if (socket) {
        selectedMessageIds.forEach(messageId => {
          socket.emit('message:hard-delete', {
            messageId,
            roomId: null, // Will be determined from message
            toUserId: selectedContact._id
          });
        });
      }
    } catch (error) {
      console.error('Failed to bulk delete messages:', error);
    }
  };

  // Process messages for rendering with date dividers
  useEffect(() => {
    // COMPLETELY ERASE: Robust filtering for any variation of deleted messages
    const cleanMessages = messages.filter(msg => {
      if (!msg) return false;
      const content = String(msg.content || '').toLowerCase();
      const isDeletedText = content.includes('message was deleted') || content === 'deleted';
      return !msg.deletedForEveryone && !isDeletedText;
    });

    const processed = processMessagesForRendering(cleanMessages, {
      groupByDate: true,
      showSenderInfo: false, // For direct messages, sender info not needed
      optimizeForPerformance: true
    });
    setProcessedMessages(processed);
  }, [messages]);

  // Auto-expand textarea
  const handleInput = () => {
    const tx = textareaRef.current;
    if (!tx) return;
    tx.style.height = 'auto';
    tx.style.height = `${Math.min(tx.scrollHeight, 120)}px`; // Max height ~120px
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    console.log('File selected:', file);
    
    // For now, use base64 to ensure it works
    const reader = new FileReader();
    reader.onload = () => {
      const attachmentData = {
        name: file.name,
        type: file.type,
        size: file.size,
        url: reader.result, // Base64 data URL
        filename: file.name,
        originalname: file.name
      };
      
      console.log('Attachment data prepared:', attachmentData);
      setAttachment(attachmentData);
    };
    
    reader.onerror = (error) => {
      console.error('FileReader error:', error);
    };
    
    reader.readAsDataURL(file);
  };

  // Format avatar URL (handles Base64, full URLs, and relative paths)
  const formatAvatar = (url) => {
    if (!url) return null;
    if (url.startsWith('data:') || url.startsWith('http')) return url;
    const apiBase = import.meta.env.VITE_API_BASE_URL || '';
    const origin = apiBase.startsWith('http') ? new URL(apiBase).origin : window.location.origin;
    return `${origin}/${url.replace(/^\//, '')}`;
  };

  // Format timestamp like WhatsApp/Telegram
  const formatTime = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now - date;
    const oneMinute = 60 * 1000;
    const oneHour = 60 * oneMinute;
    const oneDay = 24 * oneHour;

    if (diff < oneMinute) {
      return 'just now';
    } else if (diff < oneHour) {
      const minutes = Math.floor(diff / oneMinute);
      return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`;
    } else if (diff < oneDay && now.getDate() === date.getDate()) {
      const hours = Math.floor(diff / oneHour);
      return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
    } else if (diff < oneDay * 2) {
      return `Yesterday at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    } else if (diff < oneDay * 7) {
      return `${date.toLocaleDateString([], { weekday: 'short' })} at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    }
    return date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
  };

  // Typing indicator handlers
  const typingTimeoutRef = useRef(null);
  const handleTypingStart = () => {
    if (socket && selectedContact && draft.trim()) {
      socket.emit('user:typing', {
        userId: myId,
        receiverId: selectedContact._id
      });
      
      // Clear existing timeout
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      
      // Stop typing after 3 seconds of inactivity
      typingTimeoutRef.current = setTimeout(() => {
        socket.emit('user:stop-typing', {
          userId: myId,
          receiverId: selectedContact._id
        });
      }, 3000);
    }
  };

  const handleTypingStop = () => {
    if (socket && selectedContact) {
      socket.emit('user:stop-typing', {
        userId: myId,
        receiverId: selectedContact._id
      });
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    }
  };

  // Contact Search functionality (for left sidebar)
  const handleContactSearch = (query) => {
    setContactSearchQuery(query);
    
    if (!query.trim()) {
      setContactSearchResults([]);
      return;
    }

    const filtered = contacts.filter(contact => 
      getContactDisplayName(contact).toLowerCase().includes(query.toLowerCase()) ||
      String(contact.representativeName || contact.focalPersonName || '').toLowerCase().includes(query.toLowerCase()) ||
      (contact.email && contact.email.toLowerCase().includes(query.toLowerCase()))
    );
    
    setContactSearchResults(filtered);
  };

  const handleSelectContact = useCallback((contact) => {
    const nextId = String(contact?._id || '');
    const prevId = String(selectedContactIdRef.current || '');
    if (!nextId || prevId === nextId || isChatLoading) return;

    setIsChatLoading(true);
    setSelectedContactId(nextId);
    setContacts(prev => sortContacts(prev.map(c => (
      String(c._id) === String(contact._id)
        ? { ...c, unreadCount: 0 }
        : c
    ))));

    if (Number(contact.unreadCount || 0) > 0) {
      messagingAPI.markConversationAsRead({ otherUserId: contact._id }).catch(() => {});
    }
  }, [isChatLoading]);

  useEffect(() => {
    selectedContactIdRef.current = selectedContactId;
  }, [selectedContactId]);

  // Message Search functionality (for chat header)
  useEffect(() => {
    if (!messageSearchQuery.trim()) {
      setMessageSearchResults([]);
      return;
    }

    const filtered = messages.filter(msg => 
      !msg.deletedForEveryone && 
      msg.content && 
      msg.content !== 'This message was deleted.' &&
      msg.content !== 'This message was deleted' &&
      msg.content.toLowerCase().includes(messageSearchQuery.toLowerCase())
    );
    
    setMessageSearchResults(filtered);
  }, [messageSearchQuery, messages]);

  // Build socket URL
  const getSocketUrl = () => {
    const apiBase = import.meta.env.VITE_API_BASE_URL || '/api';
    return apiBase.startsWith('http') ? new URL(apiBase).origin : window.location.origin;
  };

  useEffect(() => {
    if (!auth?.token) return;
    const s = io(getSocketUrl(), { transports: ['websocket'], auth: { token: auth.token } });
    setSocket(s);
    
    // Listen for new messages
    s.on('message:new', (msg) => {
      const senderId = String(msg.senderId?._id || msg.senderId);
      const receiverId = String(msg.receiverId?._id || msg.receiverId);
      const otherId = senderId === String(myId) ? receiverId : senderId;
      const isIncoming = senderId !== String(myId);

      if (selectedContactIdRef.current && String(otherId) === String(selectedContactIdRef.current)) {
        setMessages(prev => [...prev, msg]);
        setContacts(prev => sortContacts(prev.map(contact => {
          if (String(contact._id) !== String(otherId)) return contact;
          return {
            ...contact,
            unreadCount: 0,
            lastMessage: {
              content: msg.content,
              createdAt: msg.createdAt,
              senderId: senderId
            }
          };
        })));

        // Auto-mark as delivered when received
        if (isIncoming) {
          messagingAPI.markMessageDelivered(msg._id);
        }

        return;
      }

      setContacts(prev => sortContacts(prev.map(contact => {
        if (String(contact._id) !== String(otherId)) return contact;
        return {
          ...contact,
          unreadCount: Number(contact.unreadCount || 0) + (isIncoming ? 1 : 0),
          lastMessage: {
            content: msg.content,
            createdAt: msg.createdAt,
            senderId: senderId
          }
        };
      })));
    });

    // Listen for message seen events
    s.on('message:seen', (data) => {
      if (selectedContactIdRef.current && String(data.byUserId) === String(selectedContactIdRef.current)) {
        setMessages(prev => prev.map(m => ({ ...m, isRead: true, status: 'read' })));
      }
    });

    // Listen for message delivered events
    s.on('message:delivered', (data) => {
      setMessages(prev => prev.map(m => 
        String(m._id) === String(data.messageId) 
          ? { ...m, status: 'delivered', deliveredAt: data.deliveredAt }
          : m
      ));
    });

    // Listen for message read events
    s.on('message:read', (data) => {
      setMessages(prev => prev.map(m => 
        String(m._id) === String(data.messageId) 
          ? { ...m, status: 'read', readAt: data.readAt, isRead: true }
          : m
      ));
    });

    // Listen for batch read events
    s.on('message:batch-read', (data) => {
      setMessages(prev => prev.map(m => 
        data.messageIds.includes(String(m._id)) 
          ? { ...m, status: 'read', readAt: data.readAt, isRead: true }
          : m
      ));
    });

    // Listen for presence updates
    s.on('presence:update', (data) => {
      setOnlineStatus(prev => ({
        ...prev,
        [String(data.userId)]: { isOnline: data.online, lastSeen: data.lastSeen }
      }));
    });

    // Listen for typing indicators
    s.on('user:typing', (data) => {
      if (selectedContactIdRef.current && String(data.userId) === String(selectedContactIdRef.current)) {
        setTypingUsers(prev => new Set(prev).add(String(data.userId)));
      }
    });

    // Listen for stop typing
    s.on('user:stop-typing', (data) => {
      setTypingUsers(prev => {
        const newSet = new Set(prev);
        newSet.delete(String(data.userId));
        return newSet;
      });
    });

    // Listen for deleted messages (Complete Removal)
    s.on('message:deleted', (data) => {
      setMessages(prev => prev.filter(m => String(m._id) !== String(data.messageId || data.id)));
    });

    // Listen for edited messages
    s.on('message:edited', (data) => {
      console.log('Real-time: Message edited event received:', data);
      setMessages(prev => prev.map(m => 
        String(m._id) === String(data._id || data.messageId) 
          ? { ...m, ...data, isEdited: true }
          : m
      ));
    });

    // Listen for hard deleted messages (Complete Removal)
    s.on('message:hard-deleted', (data) => {
      setMessages(prev => prev.filter(m => String(m._id) !== String(data.messageId || data.id)));
    });

    s.on('contacts:refresh', () => {
      refreshContactsRef.current?.();
    });

    s.on('notification:new', (notification) => {
      if (String(auth?.user?.role || '').toLowerCase() === 'employer' && String(notification?.receiverRole || '').toLowerCase() === 'employer') {
        refreshContactsRef.current?.();
      }
    });

    // Emit user online status
    s.emit('user:online', { userId: myId });

    return () => {
      s.emit('user:offline', { userId: myId });
      s.disconnect();
    };
  }, [auth?.token, myId]);

  const loadData = useCallback(async (query = '') => {
    try {
      const { data } = await messagingAPI.getContacts({ search: query });
      const sorted = sortContacts(data);
      setContacts(sorted);
      
      // Seed onlineStatus from API data — only if we don't already have a live socket value
      setOnlineStatus(prev => {
        const merged = { ...prev };
        sorted.forEach(u => {
          const id = String(u._id);
          // Only seed if we have no live socket data for this user yet
          if (!merged[id]) {
            merged[id] = {
              isOnline: Boolean(u.isOnline),
              lastSeen: u.lastSeen || null
            };
          }
        });
        return merged;
      });
      
      const activeId = String(selectedContactIdRef.current || '');
      if (!activeId && sorted.length > 0) {
        setSelectedContactId(String(sorted[0]._id));
      } else if (activeId) {
        const exists = sorted.some(c => String(c._id) === activeId);
        if (!exists) {
          setSelectedContactId(sorted[0] ? String(sorted[0]._id) : null);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshContactsRef.current = () => loadData(contactSearchQuery);
  }, [loadData, contactSearchQuery]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    const refreshContacts = () => loadData(contactSearchQuery);
    const interval = window.setInterval(refreshContacts, 15000);
    window.addEventListener('focus', refreshContacts);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', refreshContacts);
    };
  }, [loadData, contactSearchQuery]);

  // Poll online status every 10 seconds (reliable fallback that doesn't depend on sockets)
  useEffect(() => {
    const pollOnlineStatus = async () => {
      try {
        const ids = contacts.map(c => String(c._id));
        if (!ids.length) return;
        const { data } = await messagingAPI.getOnlineStatus(ids);
        setOnlineStatus(prev => {
          const updated = { ...prev };
          Object.entries(data).forEach(([id, status]) => {
            updated[id] = status;
          });
          return updated;
        });
      } catch (_) {}
    };

    if (contacts.length > 0) {
      pollOnlineStatus(); // run immediately when contacts load
      const interval = setInterval(pollOnlineStatus, 10000);
      return () => clearInterval(interval);
    }
  }, [contacts]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      loadData(contactSearchQuery);
    }, 400);
    return () => clearTimeout(timer);
  }, [contactSearchQuery, loadData]);

  // Add tracking ref to prevent duplicate fetches for the same ID
  const lastFetchedContactIdRef = useRef(null);

  useEffect(() => {
    if (!selectedContactId) return;
    // Prevent re-fetching if we are already showing this chat
    if (lastFetchedContactIdRef.current === selectedContactId && !isChatLoading) {
      return;
    }
    
    lastFetchedContactIdRef.current = selectedContactId;
    
    let isMounted = true;
    const fetchHistory = async () => {
      try {
        const { data } = await messagingAPI.getDirectHistory(selectedContactId);
        if (isMounted) {
          setMessages(data);
          
          // Mark unread messages as read using batch API
          const unreadMessageIds = data
            .filter(msg => String(msg.senderId?._id || msg.senderId) !== String(myId) && !msg.isRead)
            .map(msg => String(msg._id));
          
          if (unreadMessageIds.length > 0) {
            await messagingAPI.markMessagesRead(unreadMessageIds, null, selectedContactId);
            setContacts(prev => sortContacts(prev.map(contact => String(contact._id) === String(selectedContactId) ? { ...contact, unreadCount: 0 } : contact)));
          }
        }
      } catch (err) { 
        console.error(err); 
      } finally {
        if (isMounted) setIsChatLoading(false);
      }
    };
    fetchHistory();
    
    return () => {
      isMounted = false;
    };
  }, [selectedContactId, myId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!draft.trim() && !attachment) return;
    if (!selectedContact) return;

    try {
      if (editingMessage) {
        console.log('Sending edit request for message:', editingMessage._id);
        const { data } = await messagingAPI.editMessage(editingMessage._id, { content: draft.trim() });
        
        // Update locally immediately for snappy feel
        setMessages(prev => prev.map(m => 
          String(m._id) === String(editingMessage._id) 
            ? { ...m, content: draft.trim(), isEdited: true, editedAt: new Date() }
            : m
        ));
        
        setEditingMessage(null);
        setDraft('');
        return;
      }

      const payload = {
        receiverId: selectedContact._id,
        content: draft.trim() || (attachment ? `Sent a file: ${attachment.filename || attachment.name}` : ''),
        messageType: 'text',
        attachment: attachment ? {
          name: attachment.filename || attachment.name,
          type: attachment.type,
          size: attachment.size,
          url: attachment.url
        } : undefined,
        replyTo: replyingTo?._id || undefined
      };
      
      console.log('Sending message with payload:', payload);
      
      const { data } = await messagingAPI.sendMessage(payload);
      setMessages(prev => [...prev, data]);
      
      // Clear form and reply state
      setDraft('');
      setAttachment(null);
      setReplyingTo(null);
      
      if (textareaRef.current) textareaRef.current.style.height = 'auto';
    } catch (err) { console.error(err); }
  };

  const handleCopyText = (text) => {
    if (!text) return;
    navigator.clipboard.writeText(text).catch(err => console.error('Copy failed:', err));
    setContextMenu(null);
  };

  const handleSaveImage = (url, filename) => {
    if (!url) return;
    const link = document.createElement('a');
    link.href = url;
    link.download = filename || 'download';
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setContextMenu(null);
  };

  const handleDeleteMessage = async (messageId, forEveryone) => {
    console.log('Attempting to erase message:', messageId, 'forEveryone:', forEveryone);
    try {
      await messagingAPI.deleteMessage(messageId, forEveryone);
      console.log('Message erased successfully from backend');
      
      // Immediately remove locally for responsive feel
      setMessages(prev => prev.filter(m => String(m._id) !== String(messageId)));
      setDeleteTarget(null);
    } catch (err) {
      console.error('Erase failed:', err);
    }
  };

  const handleEditStart = (msg) => {
    setEditingMessage(msg);
    setDraft(msg.content);
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  };

  if (loading) return <div className="p-8 text-center">Loading Messages...</div>;

  return (
    <div className="flex h-[calc(100vh-80px)] overflow-hidden min-h-0 bg-white border border-slate-200 rounded-xl shadow-sm relative">
      {/* Selection Toolbar */}
      <MessageSelection
        messages={messages} // Include all messages for proper selection counting
        selectedMessages={messageSelection?.selectedMessages}
        setSelectedMessages={messageSelection?.setSelectedMessages}
        onSelectAll={() => messageSelection?.selectAllMessages(messages.filter(msg => String(msg.senderId) === String(myId)))}
        onClearSelection={messageSelection?.clearSelection}
        onDeleteSelected={handleBulkDelete}
        isSelectionMode={messageSelection?.isSelectionMode}
        setIsSelectionMode={messageSelection?.setIsSelectionMode}
        myId={myId}
      />

      {/* Contact Sidebar */}
      <div className="w-[30%] max-w-[380px] min-w-[280px] border-r border-slate-100 flex flex-col bg-slate-50/30 h-full">
        <div className="p-5 border-b border-slate-100 bg-white flex-shrink-0">
          <h2 className="font-bold text-slate-800 text-lg">Inbox</h2>
          <div className="mt-3 relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </span>
            <input 
              type="text"
              placeholder="Search contacts..."
              className="w-full pl-9 pr-4 py-2 bg-slate-100 border-none rounded-xl text-xs focus:ring-2 focus:ring-blue-500 outline-none transition-all"
              value={contactSearchQuery}
              onChange={(e) => setContactSearchQuery(e.target.value)}
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto bg-slate-50/30">
          {contacts.length > 0 ? (
            <div className="divide-y divide-slate-100">
              {contacts.map(c => (
                <ContactListItem
                  key={c._id}
                  contact={c}
                  isSelected={selectedContactId === String(c._id)}
                  isDisabled={isChatLoading}
                  onSelect={handleSelectContact}
                  formatAvatar={formatAvatar}
                  onlineStatus={onlineStatus}
                  myId={myId}
                  getRoleBadgeClass={getRoleBadgeClass}
                  getRoleBadgeLabel={getRoleBadgeLabel}
                  formatTime={formatTime}
                />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full p-8">
              <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                </svg>
              </div>
              <p className="text-xs text-slate-400 text-center">No contacts found</p>
            </div>
          )}
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex overflow-hidden min-w-0 min-h-0">
        <div className="flex-1 flex flex-col bg-white h-full">
          {selectedContact ? (
            <>
              <div className="p-4 border-b border-slate-100 bg-white flex-shrink-0">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <Avatar 
                      name={getContactDisplayName(selectedContact)} 
                      avatarUrl={formatAvatar(selectedContact.avatar)} 
                    />
                    <div>
                      <div className="font-semibold text-slate-900">{getContactDisplayName(selectedContact)}</div>
                      {getContactSecondaryLabel(selectedContact) && (
                        <div className="text-xs text-slate-500 mt-0.5">{getContactSecondaryLabel(selectedContact)}</div>
                      )}
                      <div className={`text-xs ${(onlineStatus[String(selectedContact._id)]?.isOnline ?? selectedContact.isOnline) ? 'text-green-600' : 'text-gray-500'}`}>
                        {(onlineStatus[String(selectedContact._id)]?.isOnline ?? selectedContact.isOnline) 
                          ? '🟢 Online' 
                          : (onlineStatus[String(selectedContact._id)]?.lastSeen ?? selectedContact.lastSeen) 
                            ? `Last seen at ${formatTime(onlineStatus[String(selectedContact._id)]?.lastSeen ?? selectedContact.lastSeen)}`
                            : 'Offline'
                        }
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => setShowSearch(!showSearch)}
                      className={`p-2 rounded-lg transition-all ${showSearch ? 'bg-blue-50 text-blue-600' : 'text-slate-400 hover:bg-slate-50 hover:text-slate-600'}`}
                      title="Search Chat"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                    </button>
                    {['student', 'employer'].includes(String(auth?.user?.role).toLowerCase()) && (
                      <Link 
                        to={String(auth?.user?.role).toLowerCase() === 'student' ? '/student/logbook' : '/employer/logbooks'}
                        className="p-2 rounded-lg text-slate-400 hover:bg-slate-50 hover:text-slate-600 flex items-center gap-2 text-xs font-medium border border-transparent hover:border-slate-100"
                        title="Manage Logbooks"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                        </svg>
                        <span className="hidden sm:inline">Logbook</span>
                      </Link>
                    )}
                    <button 
                      onClick={() => setShowInfo(!showInfo)}
                      className={`p-2 rounded-lg transition-all ${showInfo ? 'bg-blue-50 text-blue-600' : 'text-slate-400 hover:bg-slate-50 hover:text-slate-600'}`}
                      title="Contact Info"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </button>
                  </div>
                </div>
                
                {/* Search Input */}
                {showSearch && (
                  <div className="relative">
                    <input
                      type="text"
                      autoFocus
                      placeholder="Search messages..."
                      value={messageSearchQuery}
                      onChange={(e) => setMessageSearchQuery(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    />
                    <svg className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                )}
              </div>

              <div className="flex-1 overflow-y-auto p-6 bg-slate-50/10 min-h-0">

              {isChatLoading ? (
                <div className="flex-1 flex flex-col items-center justify-center h-full min-h-[300px]">
                  <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                  <p className="mt-4 text-sm text-slate-500 font-medium animate-pulse">Loading conversation...</p>
                </div>
              ) : (
                <>
                  {/* Typing Indicator */}
                  {typingUsers.has(String(selectedContact?._id)) && (
                    <div className="flex items-center gap-2 px-4 py-2 text-sm text-gray-500 italic">
                      <div className="flex gap-1">
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                      </div>
                      {getContactDisplayName(selectedContact) || 'Someone'} is typing...
                    </div>
                  )}
                  
                  {(messageSearchQuery ? messageSearchResults.map(msg => ({ type: 'message', key: msg._id, message: msg })) : processedMessages).map((item) => {
                    if (item.type === 'date-divider') {
                      return <DateDivider key={item.key} label={item.label} date={item.date} />;
                    }
                    
                    const msg = item.message || item;
                    const isMine = String(msg.senderId?._id || msg.senderId) === String(myId);
                    return (
                      <div key={item.key} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                        <MessageBubble 
                          message={msg} 
                          isMine={isMine} 
                          showSenderInfo={item.showSenderInfo}
                          isConsecutive={item.isConsecutive}
                          messageSelection={messageSelection}
                          socket={socket}
                          setReplyingTo={setReplyingTo}
                          textareaRef={textareaRef}
                          setContextMenu={setContextMenu}
                        />
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </>
              )}
            </div>

            {/* Message Input Area */}
            <div className="p-4 bg-white border-t border-slate-100">
              {/* Telegram-style Reply Preview Bar */}
              {replyingTo && (
                <div className="flex items-center gap-3 mb-3 animate-in slide-in-from-bottom-2 duration-200">
                  <div className="w-1 self-stretch bg-blue-500 rounded-full"></div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-semibold text-blue-500 flex items-center gap-1.5">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" /></svg>
                      Reply to {replyingTo.senderName}
                    </div>
                    <div className="text-[12px] text-slate-500 truncate leading-relaxed">
                      {replyingTo.content}
                    </div>
                  </div>
                  <button 
                    onClick={() => setReplyingTo(null)}
                    className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-all"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              )}

              {/* Edit Mode Banner */}
              {editingMessage && (
                <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-center justify-between animate-in slide-in-from-bottom-2 duration-300">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-100 rounded shadow-sm text-blue-600">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-blue-600 uppercase tracking-wider">Editing Message</div>
                      <div className="text-sm text-slate-600 truncate max-w-[250px] lg:max-w-[400px]">
                        {editingMessage.content}
                      </div>
                    </div>
                  </div>
                  <button 
                    onClick={() => {
                      setEditingMessage(null);
                      setDraft('');
                    }}
                    className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    title="Cancel Edit"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              )}
              {attachment && (
                <div className="mb-3 p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-white rounded shadow-sm">
                      <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                      </svg>
                    </div>
                    <div className="text-sm font-medium text-slate-700 truncate max-w-[200px]">
                      {attachment.filename || attachment.name}
                    </div>
                  </div>
                  <button 
                    onClick={() => setAttachment(null)}
                    className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              )}
              <form onSubmit={handleSend} className="flex items-end gap-2">
                <div className="flex-1 bg-slate-50 border border-slate-200 rounded-xl flex items-end p-1 focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-500 transition-all">
                  <button 
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="p-2 text-slate-400 hover:text-blue-500 transition-colors flex-shrink-0"
                    title="Attach file"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                    </svg>
                  </button>
                  <input 
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <textarea
                    ref={textareaRef}
                    value={draft}
                    onChange={(e) => {
                      setDraft(e.target.value);
                      handleInput();
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSend(e);
                      }
                      handleTypingStart();
                    }}
                    onKeyUp={handleTypingStop}
                    placeholder="Type a message..."
                    className="flex-1 max-h-32 min-h-[44px] bg-transparent border-none focus:ring-0 resize-none py-3 px-2 text-sm outline-none"
                    rows="1"
                  />
                </div>
                <button 
                  type="submit"
                  disabled={!draft.trim() && !attachment}
                  className={`p-3 ${editingMessage ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-blue-600 hover:bg-blue-700'} disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl shadow-sm hover:shadow transition-all flex-shrink-0`}
                  title={editingMessage ? 'Save Changes' : 'Send Message'}
                >
                  {editingMessage ? (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5 transform rotate-90 translate-x-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                  )}
                </button>
              </form>
            </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-slate-400 text-sm italic">
              Select a contact to start messaging
            </div>
          )}

          {/* Contact Info Sidebar */}
          {selectedContact && showInfo && (
            <div className="w-[300px] border-l border-slate-100 bg-white flex flex-col animate-in slide-in-from-right-4 duration-300 flex-shrink-0">
              <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                <h3 className="font-bold text-slate-900">User Info</h3>
                <button 
                  onClick={() => setShowInfo(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-all"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-6 flex flex-col items-center text-center">
                <div className="mb-4">
                  <Avatar 
                    name={getContactDisplayName(selectedContact)} 
                    avatarUrl={formatAvatar(selectedContact.avatar)} 
                    size="w-24 h-24"
                  />
                </div>
                
                <h2 className="text-xl font-bold text-slate-900 mb-1">
                  {getContactDisplayName(selectedContact)}
                </h2>
                {getContactSecondaryLabel(selectedContact) && (
                  <div className="text-sm text-slate-500 mb-2">{getContactSecondaryLabel(selectedContact)}</div>
                )}
                <div className={`px-3 py-1 text-[10px] font-bold rounded-full uppercase tracking-widest mb-4 border ${getRoleBadgeClass(selectedContact.role)}`}>
                  {getRoleBadgeLabel(selectedContact.role)}
                </div>

                <div className="w-full space-y-6 text-left mt-4">
                  <div className="flex items-start gap-4">
                    <div className="p-2 bg-slate-50 rounded-lg text-slate-400">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002-2z" /></svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[11px] text-slate-400 font-medium uppercase tracking-wider mb-0.5">Email</div>
                      <div className="text-sm text-slate-700 truncate">{selectedContact.email || 'N/A'}</div>
                    </div>
                  </div>

                  {(selectedContact.department || selectedContact.college) && (
                    <div className="flex items-start gap-4">
                      <div className="p-2 bg-slate-50 rounded-lg text-slate-400">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[11px] text-slate-400 font-medium uppercase tracking-wider mb-0.5">Organization</div>
                        <div className="text-sm text-slate-700">
                          {selectedContact.department && <div className="font-medium">{selectedContact.department}</div>}
                          {selectedContact.college && <div className="text-xs text-slate-500 mt-0.5">{selectedContact.college}</div>}
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="flex items-start gap-4">
                    <div className="p-2 bg-slate-50 rounded-lg text-slate-400">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[11px] text-slate-400 font-medium uppercase tracking-wider mb-0.5">Status</div>
                      <div className="text-sm">
                        {(onlineStatus[String(selectedContact._id)]?.isOnline ?? selectedContact.isOnline) 
                          ? <span className="text-green-600 font-semibold">Online</span> 
                          : <span className="text-slate-500">Offline</span>
                        }
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Custom Context Menu */}
          {contextMenu && (
            <div 
              className="fixed z-[9999] bg-white border border-slate-200 rounded-xl shadow-2xl py-1.5 min-w-[180px] animate-in fade-in zoom-in duration-200 backdrop-blur-sm bg-white/95"
              style={{ 
                left: Math.min(contextMenu.x, window.innerWidth - 200), 
                top: Math.min(contextMenu.y, window.innerHeight - 250) 
              }}
              onMouseLeave={() => setContextMenu(null)}
            >
              {/* Common Reply Action */}
              <button 
                onClick={() => {
                  setReplyingTo({ 
                    _id: contextMenu.messageId, 
                    content: contextMenu.message.content, 
                    senderName: contextMenu.message.senderId?.displayName || contextMenu.message.senderId?.fullName || contextMenu.message.senderId?.name || 'Unknown' 
                  });
                  setContextMenu(null);
                  if (textareaRef.current) textareaRef.current.focus();
                }}
                className="w-full text-left px-4 py-2.5 text-xs hover:bg-slate-100 flex items-center gap-3 transition-colors text-slate-700 font-medium"
              >
                <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" /></svg>
                Reply
              </button>

              {/* Type-Specific Actions: TEXT */}
              {!contextMenu.message.attachment && (
                <button 
                  onClick={() => handleCopyText(contextMenu.message.content)}
                  className="w-full text-left px-4 py-2.5 text-xs hover:bg-slate-100 flex items-center gap-3 transition-colors text-slate-700 font-medium"
                >
                  <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" /></svg>
                  Copy Text
                </button>
              )}

              {/* Type-Specific Actions: IMAGE */}
              {contextMenu.message.attachment && contextMenu.message.attachment.type?.startsWith('image/') && (
                <>
                  <button 
                    onClick={() => handleSaveImage(contextMenu.message.attachment.url, contextMenu.message.attachment.name)}
                    className="w-full text-left px-4 py-2.5 text-xs hover:bg-slate-100 flex items-center gap-3 transition-colors text-slate-700 font-medium"
                  >
                    <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                    Save Image
                  </button>
                  <button 
                    onClick={() => handleCopyText(contextMenu.message.attachment.url)}
                    className="w-full text-left px-4 py-2.5 text-xs hover:bg-slate-100 flex items-center gap-3 transition-colors text-slate-700 font-medium"
                  >
                    <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                    Copy Photo Link
                  </button>
                </>
              )}

              {/* Edit Action (Only mine) */}
              {contextMenu.isMine && (
                <button 
                  onClick={() => {
                    handleEditStart(contextMenu.message);
                    setContextMenu(null);
                  }}
                  className="w-full text-left px-4 py-2.5 text-xs hover:bg-slate-100 flex items-center gap-3 transition-colors text-slate-700 font-medium"
                >
                  <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                  Edit Message
                </button>
              )}

              {/* Delete Action (Always) */}
              <button 
                onClick={() => {
                  setDeleteTarget(contextMenu.message);
                  setContextMenu(null);
                }}
                className="w-full text-left px-4 py-2.5 text-xs text-red-600 hover:bg-red-50 flex items-center gap-3 transition-colors font-medium"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                Delete Message
              </button>

              <div className="border-t border-slate-100 my-1"></div>
              <button 
                onClick={() => setContextMenu(null)}
                className="w-full text-left px-4 py-2 text-[10px] text-slate-400 hover:text-slate-600"
              >
                Cancel
              </button>
            </div>
          )}

          {/* Delete Confirmation Modal */}
          <DeleteMessageModal
            isOpen={!!deleteTarget}
            message={deleteTarget}
            contactName={selectedContact?.fullName || selectedContact?.name}
            onConfirm={handleDeleteMessage}
            onCancel={() => setDeleteTarget(null)}
          />
        </div>
      </div>
    </div>
  );
}
