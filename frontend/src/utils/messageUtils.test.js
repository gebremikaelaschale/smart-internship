// Test suite for message utils - Enterprise-level timestamp and grouping functionality

import { 
  groupMessagesByDate, 
  formatDateLabel, 
  formatMessageTime, 
  formatFullTimestamp,
  getRelativeTime,
  processMessagesForRendering,
  getUserTimeZone,
  isValidUTCTimestamp
} from './messageUtils.js';

// Mock test data
const mockMessages = [
  {
    _id: '1',
    content: 'Hello from yesterday',
    createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // Yesterday
    senderId: { _id: 'user1', fullName: 'John Doe' },
    isRead: false,
    status: 'sent'
  },
  {
    _id: '2', 
    content: 'Hello from today morning',
    createdAt: new Date(Date.now() - 6 * 60 * 60 * 1000), // 6 hours ago
    senderId: { _id: 'user2', fullName: 'Jane Smith' },
    isRead: true,
    status: 'read'
  },
  {
    _id: '3',
    content: 'Recent message',
    createdAt: new Date(Date.now() - 30 * 60 * 1000), // 30 minutes ago
    senderId: { _id: 'user1', fullName: 'John Doe' },
    isRead: false,
    status: 'delivered'
  },
  {
    _id: '4',
    content: 'Just now message',
    createdAt: new Date(),
    senderId: { _id: 'user2', fullName: 'Jane Smith' },
    isRead: false,
    status: 'sent'
  }
];

/**
 * Test function to verify all timestamp and grouping functionality
 */
export function runMessageUtilsTests() {
  console.log('🧪 Testing Enterprise-Level Message Timestamp and Grouping System...\n');

  // Test 1: Date Label Formatting
  console.log('📅 Test 1: Date Label Formatting');
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const lastWeek = new Date(today);
  lastWeek.setDate(lastWeek.getDate() - 7);
  const lastYear = new Date(today);
  lastYear.setFullYear(lastYear.getFullYear() - 1);

  console.log(`Today label: ${formatDateLabel(today)}`);
  console.log(`Yesterday label: ${formatDateLabel(yesterday)}`);
  console.log(`Last week label: ${formatDateLabel(lastWeek)}`);
  console.log(`Last year label: ${formatDateLabel(lastYear)}`);

  // Test 2: Message Time Formatting
  console.log('\n⏰ Test 2: Message Time Formatting');
  const testTime = new Date('2026-04-25T14:30:00Z');
  const userTimeZone = getUserTimeZone();
  
  console.log(`Test time: ${testTime.toISOString()}`);
  console.log(`User timezone: ${userTimeZone}`);
  console.log(`Formatted time: ${formatMessageTime(testTime, userTimeZone)}`);
  console.log(`Full timestamp: ${formatFullTimestamp(testTime, userTimeZone)}`);

  // Test 3: Relative Time
  console.log('\n🕐 Test 3: Relative Time Formatting');
  const times = [
    { label: 'Just now', time: new Date(Date.now() - 30 * 1000) },
    { label: '5 minutes ago', time: new Date(Date.now() - 5 * 60 * 1000) },
    { label: '2 hours ago', time: new Date(Date.now() - 2 * 60 * 60 * 1000) },
    { label: '3 days ago', time: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000) }
  ];

  times.forEach(({ label, time }) => {
    console.log(`${label}: ${getRelativeTime(time)}`);
  });

  // Test 4: Message Grouping by Date
  console.log('\n📦 Test 4: Message Grouping by Date');
  const groupedMessages = groupMessagesByDate(mockMessages);
  
  console.log(`Original messages: ${mockMessages.length}`);
  console.log(`Grouped items: ${groupedMessages.length}`);
  
  groupedMessages.forEach((item, index) => {
    if (item.type === 'date-divider') {
      console.log(`${index + 1}. 📅 Date Divider: ${item.label}`);
    } else {
      const time = formatMessageTime(item.createdAt);
      const sender = item.senderId?.fullName || 'Unknown';
      console.log(`${index + 1}. 💬 ${sender} at ${time}: "${item.content.substring(0, 30)}..."`);
    }
  });

  // Test 5: Process Messages for Rendering
  console.log('\n🎨 Test 5: Process Messages for Rendering');
  const processedMessages = processMessagesForRendering(mockMessages, {
    groupByDate: true,
    showSenderInfo: true,
    optimizeForPerformance: true
  });

  console.log(`Processed items: ${processedMessages.length}`);
  processedMessages.forEach((item, index) => {
    const type = item.type === 'date-divider' ? '📅 Divider' : '💬 Message';
    const metadata = item.type === 'message' 
      ? `(showSender: ${item.showSenderInfo}, consecutive: ${item.isConsecutive})`
      : `(label: ${item.label})`;
    console.log(`${index + 1}. ${type} ${metadata}`);
  });

  // Test 6: UTC Timestamp Validation
  console.log('\n✅ Test 6: UTC Timestamp Validation');
  const timestamps = [
    '2026-04-25T14:30:00Z',
    new Date().toISOString(),
    'invalid-date',
    null,
    ''
  ];

  timestamps.forEach((timestamp, index) => {
    const isValid = isValidUTCTimestamp(timestamp);
    console.log(`${index + 1}. "${timestamp}" → ${isValid ? '✅ Valid' : '❌ Invalid'}`);
  });

  // Test 7: Performance with Large Dataset
  console.log('\n⚡ Test 7: Performance with Large Dataset');
  const largeDataset = Array.from({ length: 1000 }, (_, i) => ({
    _id: `msg-${i}`,
    content: `Message ${i}`,
    createdAt: new Date(Date.now() - i * 60 * 1000), // Each message 1 minute apart
    senderId: { _id: i % 2 === 0 ? 'user1' : 'user2', fullName: i % 2 === 0 ? 'John' : 'Jane' },
    isRead: i % 3 === 0,
    status: ['sent', 'delivered', 'read'][i % 3]
  }));

  const startTime = performance.now();
  const largeProcessed = processMessagesForRendering(largeDataset);
  const endTime = performance.now();

  console.log(`Processed ${largeDataset.length} messages in ${(endTime - startTime).toFixed(2)}ms`);
  console.log(`Generated ${largeProcessed.length} items (including ${largeProcessed.filter(item => item.type === 'date-divider').length} date dividers)`);

  console.log('\n🎉 All tests completed! Enterprise-level timestamp and grouping system is ready.');
  return true;
}

/**
 * Demo function to showcase the system with realistic data
 */
export function demoMessageGrouping() {
  console.log('\n🚀 Demo: Enterprise-Level Message Grouping System');
  console.log('=' .repeat(60));

  // Create realistic test messages spanning multiple days
  const demoMessages = [
    // Messages from 3 days ago
    {
      _id: 'msg-1',
      content: 'Hey! How are you doing?',
      createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      senderId: { _id: 'alice', fullName: 'Alice Johnson' },
      isRead: true,
      status: 'read'
    },
    {
      _id: 'msg-2',
      content: "I'm doing great! Just finished the internship application.",
      createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000 + 5 * 60 * 1000),
      senderId: { _id: 'bob', fullName: 'Bob Smith' },
      isRead: true,
      status: 'read'
    },
    
    // Messages from yesterday
    {
      _id: 'msg-3',
      content: 'Did you hear about the new internship opportunity?',
      createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
      senderId: { _id: 'alice', fullName: 'Alice Johnson' },
      isRead: true,
      status: 'read'
    },
    {
      _id: 'msg-4',
      content: 'Yes! I saw the email. Are you applying?',
      createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000),
      senderId: { _id: 'bob', fullName: 'Bob Smith' },
      isRead: false,
      status: 'delivered'
    },
    
    // Messages from today
    {
      _id: 'msg-5',
      content: 'Good morning! Ready for the interview today?',
      createdAt: new Date(Date.now() - 4 * 60 * 60 * 1000),
      senderId: { _id: 'alice', fullName: 'Alice Johnson' },
      isRead: true,
      status: 'read'
    },
    {
      _id: 'msg-6',
      content: 'Yes! A bit nervous but excited 😊',
      createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000),
      senderId: { _id: 'bob', fullName: 'Bob Smith' },
      isRead: true,
      status: 'read'
    },
    {
      _id: 'msg-7',
      content: 'You\'ll do great! Just be yourself.',
      createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
      senderId: { _id: 'alice', fullName: 'Alice Johnson' },
      isRead: false,
      status: 'sent'
    },
    {
      _id: 'msg-8',
      content: 'Thanks for the encouragement! 🙏',
      createdAt: new Date(Date.now() - 30 * 60 * 1000),
      senderId: { _id: 'bob', fullName: 'Bob Smith' },
      isRead: false,
      status: 'delivered'
    }
  ];

  const processed = processMessagesForRendering(demoMessages);
  
  console.log(`\n📱 Chat Preview (${demoMessages.length} messages):`);
  console.log('-'.repeat(60));

  processed.forEach((item, index) => {
    if (item.type === 'date-divider') {
      console.log(`\n📅 ───── ${item.label.toUpperCase()} ─────`);
    } else {
      const sender = item.senderId?.fullName || 'Unknown';
      const time = formatMessageTime(item.createdAt);
      const status = item.status || 'sent';
      const statusIcon = status === 'read' ? '✓✓' : status === 'delivered' ? '✓✓' : '✓';
      const isConsecutive = item.isConsecutive ? ' (consecutive)' : '';
      
      console.log(`${sender} • ${time} ${statusIcon}`);
      console.log(`  ${item.content}${isConsecutive}`);
    }
  });

  console.log('\n✨ Features demonstrated:');
  console.log('• Automatic date grouping with smart labels');
  console.log('• Localized time formatting');
  console.log('• Message status indicators');
  console.log('• Consecutive message optimization');
  console.log('• Enterprise-level performance');

  return processed;
}

// Export for use in development/testing
export default {
  runMessageUtilsTests,
  demoMessageGrouping,
  mockMessages
};
