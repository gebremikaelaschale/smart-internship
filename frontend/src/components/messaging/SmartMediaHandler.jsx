import React, { useState } from 'react';

/**
 * Smart Media Handler - Conditionally renders different media types
 * Images: Show preview directly in chat
 * Documents: Show document box with icon, filename, size, download
 * Videos: Show thumbnail with play button
 * Audio: Show audio player with waveform
 */
export default function SmartMediaHandler({ attachment, isMine = false, className = "" }) {
  if (!attachment || !attachment.url) return null;

  const mediaType = getMediaType(attachment.mimeType || attachment.type);
  const [imageError, setImageError] = useState(false);

  const renderImagePreview = () => {
    if (imageError) {
      return (
        <div className={`w-full h-48 bg-gray-100 rounded-lg flex items-center justify-center ${isMine ? 'bg-white/20' : 'bg-gray-100'}`}>
          <div className="text-center">
            <svg className="w-12 h-12 mx-auto mb-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <p className="text-sm text-gray-500">Image not available</p>
          </div>
        </div>
      );
    }

    return (
      <div className="relative group">
        <img
          src={attachment.thumbnailUrl || attachment.url}
          alt={attachment.name}
          className="w-full h-48 object-cover rounded-lg cursor-pointer transition-transform hover:scale-105"
          onError={() => setImageError(true)}
          onClick={() => window.open(attachment.url, '_blank')}
        />
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors rounded-lg flex items-center justify-center">
          <svg className="w-8 h-8 text-white opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
        </div>
        {attachment.dimensions && (
          <div className="absolute bottom-2 right-2 bg-black/50 text-white text-xs px-2 py-1 rounded">
            {attachment.dimensions.width} × {attachment.dimensions.height}
          </div>
        )}
      </div>
    );
  };

  const renderVideoPreview = () => {
    return (
      <div className="relative group">
        <div className="w-full h-48 bg-gray-900 rounded-lg overflow-hidden">
          {attachment.thumbnailUrl ? (
            <img
              src={attachment.thumbnailUrl}
              alt={attachment.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <svg className="w-16 h-16 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          )}
          <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
            <button
              onClick={() => window.open(attachment.url, '_blank')}
              className="w-12 h-12 bg-white/90 rounded-full flex items-center justify-center hover:bg-white transition-colors"
            >
              <svg className="w-6 h-6 text-gray-900 ml-1" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            </button>
          </div>
        </div>
        {attachment.duration && (
          <div className="absolute bottom-2 right-2 bg-black/50 text-white text-xs px-2 py-1 rounded">
            {formatDuration(attachment.duration)}
          </div>
        )}
      </div>
    );
  };

  const renderAudioPlayer = () => {
    return (
      <div className={`p-3 rounded-lg border ${isMine ? 'bg-white/10 border-white/20' : 'bg-gray-50 border-gray-200'}`}>
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isMine ? 'bg-white/20' : 'bg-blue-100 text-blue-600'}`}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
            </svg>
          </div>
          <div className="flex-1">
            <p className="font-medium text-sm truncate">{attachment.name}</p>
            {attachment.duration && (
              <p className="text-xs opacity-70">{formatDuration(attachment.duration)}</p>
            )}
          </div>
          <audio controls className="w-24 h-8">
            <source src={attachment.url} type={attachment.mimeType} />
            Your browser does not support the audio element.
          </audio>
        </div>
      </div>
    );
  };

  const renderDocumentBox = () => {
    return (
      <div className={`p-3 rounded-lg border flex items-center gap-3 ${isMine ? 'bg-white/10 border-white/20' : 'bg-white border-gray-200'}`}>
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${isMine ? 'bg-white/20' : getDocumentColor(attachment.type)}`}>
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm truncate">{attachment.name}</p>
          <p className="text-xs opacity-70">{formatFileSize(attachment.size)}</p>
        </div>
        <a
          href={attachment.url}
          download={attachment.name}
          className={`p-2 rounded-full hover:bg-black/5 transition ${isMine ? 'text-white' : 'text-blue-600'}`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
        </a>
      </div>
    );
  };

  const renderContent = () => {
    switch (mediaType) {
      case 'image':
        return renderImagePreview();
      case 'video':
        return renderVideoPreview();
      case 'audio':
        return renderAudioPlayer();
      case 'document':
        return renderDocumentBox();
      default:
        return renderDocumentBox(); // Fallback to document box
    }
  };

  return (
    <div className={`media-handler ${className}`}>
      {renderContent()}
    </div>
  );
}

// Helper functions
function getMediaType(mimeType) {
  if (!mimeType) return 'document';
  
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('audio/')) return 'audio';
  
  // Check by file extension
  const extension = mimeType.split('.').pop()?.toLowerCase();
  const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'];
  const videoExts = ['mp4', 'avi', 'mov', 'wmv', 'flv', 'webm'];
  const audioExts = ['mp3', 'wav', 'ogg', 'aac', 'flac', 'm4a'];
  
  if (imageExts.includes(extension)) return 'image';
  if (videoExts.includes(extension)) return 'video';
  if (audioExts.includes(extension)) return 'audio';
  
  return 'document';
}

function getDocumentColor(fileType) {
  const colors = {
    pdf: 'bg-red-100 text-red-600',
    doc: 'bg-blue-100 text-blue-600',
    docx: 'bg-blue-100 text-blue-600',
    xls: 'bg-green-100 text-green-600',
    xlsx: 'bg-green-100 text-green-600',
    ppt: 'bg-orange-100 text-orange-600',
    pptx: 'bg-orange-100 text-orange-600',
    txt: 'bg-gray-100 text-gray-600',
    zip: 'bg-purple-100 text-purple-600',
    rar: 'bg-purple-100 text-purple-600'
  };
  
  const extension = fileType.split('.').pop()?.toLowerCase();
  return colors[extension] || 'bg-gray-100 text-gray-600';
}

function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function formatDuration(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

// Compact version for tight spaces
export function CompactSmartMedia({ attachment, isMine = false }) {
  if (!attachment || !attachment.url) return null;

  return (
    <div className={`flex items-center gap-2 p-2 rounded ${isMine ? 'bg-white/10' : 'bg-gray-100'}`}>
      <div className={`w-6 h-6 rounded flex items-center justify-center ${isMine ? 'bg-white/20' : getDocumentColor(attachment.type)}`}>
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.414a6 6 0 108.486 8.486L20.5 13" />
        </svg>
      </div>
      <span className="text-xs truncate flex-1">{attachment.name}</span>
      <span className="text-xs opacity-60">{formatFileSize(attachment.size)}</span>
    </div>
  );
}
