// Enterprise-level timestamp and message grouping utilities

/**
 * Groups messages by date and adds date dividers
 * @param {Array} messages - Array of message objects
 * @returns {Array} - Array with date dividers and grouped messages
 */
export function groupMessagesByDate(messages) {
  if (!Array.isArray(messages) || messages.length === 0) {
    return [];
  }

  const grouped = [];
  let lastDate = null;

  messages.forEach((message, index) => {
    const messageDate = new Date(message.createdAt);
    const currentDate = messageDate.toDateString();
    
    // Add date divider if this is the first message or date changed
    if (lastDate !== currentDate) {
      grouped.push({
        type: 'date-divider',
        date: messageDate,
        label: formatDateLabel(messageDate),
        key: `date-${messageDate.getTime()}`
      });
      lastDate = currentDate;
    }

    // Add the message with grouping metadata
    grouped.push({
      ...message,
      type: 'message',
      showDate: index === 0 || lastDate !== new Date(messages[index - 1]?.createdAt).toDateString(),
      showSenderInfo: shouldShowSenderInfo(messages, index),
      isConsecutive: isConsecutiveMessage(messages, index),
      key: message._id || `msg-${index}`
    });
  });

  return grouped;
}

/**
 * Formats date label for date dividers
 * @param {Date} date - The date to format
 * @returns {string} - Formatted date label
 */
export function formatDateLabel(date) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  
  const messageDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  
  if (messageDate.getTime() === today.getTime()) {
    return 'Today';
  } else if (messageDate.getTime() === yesterday.getTime()) {
    return 'Yesterday';
  } else if (isThisWeek(date)) {
    return date.toLocaleDateString('en-US', { weekday: 'long' });
  } else if (isThisYear(date)) {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } else {
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    });
  }
}

/**
 * Formats message time for display in chat bubbles
 * @param {Date|string} timestamp - UTC timestamp from database
 * @param {string} [timeZone] - User's timezone (auto-detected if not provided)
 * @returns {string} - Formatted time (e.g., "12:30 PM")
 */
export function formatMessageTime(timestamp, timeZone) {
  const date = new Date(timestamp);
  
  // Use Intl.DateTimeFormat for proper localization
  const options = {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone
  };
  
  return new Intl.DateTimeFormat('en-US', options).format(date);
}

/**
 * Formats full timestamp for message details
 * @param {Date|string} timestamp - UTC timestamp from database
 * @param {string} [timeZone] - User's timezone
 * @returns {string} - Full formatted timestamp
 */
export function formatFullTimestamp(timestamp, timeZone) {
  const date = new Date(timestamp);
  
  const options = {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone
  };
  
  return new Intl.DateTimeFormat('en-US', options).format(date);
}

/**
 * Gets relative time for message timestamps (e.g., "2 hours ago")
 * @param {Date|string} timestamp - UTC timestamp from database
 * @returns {string} - Relative time string
 */
export function getRelativeTime(timestamp) {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  
  if (diffMins < 1) {
    return 'Just now';
  } else if (diffMins < 60) {
    return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
  } else if (diffHours < 24) {
    return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  } else if (diffDays < 7) {
    return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  } else {
    return formatDateLabel(date);
  }
}

/**
 * Checks if date is within the current week
 * @param {Date} date - Date to check
 * @returns {boolean} - True if date is this week
 */
function isThisWeek(date) {
  const now = new Date();
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  startOfWeek.setHours(0, 0, 0, 0);
  
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6);
  endOfWeek.setHours(23, 59, 59, 999);
  
  return date >= startOfWeek && date <= endOfWeek;
}

/**
 * Checks if date is within the current year
 * @param {Date} date - Date to check
 * @returns {boolean} - True if date is this year
 */
function isThisYear(date) {
  return date.getFullYear() === new Date().getFullYear();
}

/**
 * Determines if sender info should be shown for a message
 * @param {Array} messages - All messages
 * @param {number} index - Current message index
 * @returns {boolean} - True if sender info should be shown
 */
function shouldShowSenderInfo(messages, index) {
  if (index === 0) return true;
  
  const current = messages[index];
  const previous = messages[index - 1];
  
  // Show sender info if different sender or more than 5 minutes apart
  const differentSender = String(current.senderId?._id || current.senderId) !== 
                         String(previous.senderId?._id || previous.senderId);
  
  const timeDiff = new Date(current.createdAt) - new Date(previous.createdAt);
  const moreThan5Mins = timeDiff > 5 * 60 * 1000;
  
  return differentSender || moreThan5Mins;
}

/**
 * Checks if message is consecutive (for UI optimization)
 * @param {Array} messages - All messages
 * @param {number} index - Current message index
 * @returns {boolean} - True if message is consecutive
 */
function isConsecutiveMessage(messages, index) {
  if (index === 0) return false;
  
  const current = messages[index];
  const previous = messages[index - 1];
  
  const sameSender = String(current.senderId?._id || current.senderId) === 
                    String(previous.senderId?._id || previous.senderId);
  
  const timeDiff = new Date(current.createdAt) - new Date(previous.createdAt);
  const within2Mins = timeDiff <= 2 * 60 * 1000;
  
  return sameSender && within2Mins;
}

/**
 * Creates date divider component data
 * @param {Date} date - Date for the divider
 * @returns {Object} - Date divider object
 */
export function createDateDivider(date) {
  return {
    type: 'date-divider',
    date: new Date(date),
    label: formatDateLabel(date),
    key: `date-${new Date(date).getTime()}`
  };
}

/**
 * Processes messages for optimal rendering performance
 * @param {Array} messages - Raw messages array
 * @param {Object} options - Processing options
 * @returns {Array} - Processed messages ready for rendering
 */
export function processMessagesForRendering(messages, options = {}) {
  const {
    groupByDate = true,
    showSenderInfo = true,
    optimizeForPerformance = true
  } = options;
  
  if (!groupByDate) {
    return messages.map((msg, index) => ({
      ...msg,
      showSenderInfo: showSenderInfo && shouldShowSenderInfo(messages, index),
      isConsecutive: isConsecutiveMessage(messages, index),
      key: msg._id || `msg-${index}`
    }));
  }
  
  return groupMessagesByDate(messages);
}

/**
 * Gets user's timezone with fallback
 * @returns {string} - User's timezone identifier
 */
export function getUserTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch (e) {
    return 'UTC'; // Fallback to UTC
  }
}

/**
 * Validates if timestamp is valid UTC
 * @param {Date|string} timestamp - Timestamp to validate
 * @returns {boolean} - True if valid
 */
export function isValidUTCTimestamp(timestamp) {
  const date = new Date(timestamp);
  return !isNaN(date.getTime()) && date.toISOString().includes('T');
}
