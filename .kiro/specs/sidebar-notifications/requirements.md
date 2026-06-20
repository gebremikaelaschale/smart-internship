# Requirements Document

## Introduction

This feature adds a **Notifications** navigation item to the sidebar of every dashboard in the Smart Internship platform — Student, Industry Partner (Employer), HOD, Dean, and SuperAdmin. The item displays a live unread-count badge that stays in sync with the Top Navbar bell icon, both sourced from the shared `NotificationContext`. Clicking the sidebar item or the navbar bell navigates to the `/notifications` page, which presents a master-detail view. When a notification is opened, its `isRead` status is updated in the database and the badge count decreases immediately without a page refresh.

## Glossary

- **Notification_Context**: The React context (`NotificationContext`) that holds the canonical list of notifications, the `unreadCount`, and mutation helpers (`markNotificationRead`, `markAllNotificationsRead`, `deleteNotification`) for the authenticated user.
- **Sidebar**: The collapsible left-hand navigation panel rendered by `StudentSidebar`, `EmployerSidebar`, `AdminSidebar`, `GovernanceSidebar` (Dean), and `GovernanceSidebar` (HOD).
- **Navbar**: The top header bar rendered by the shared `Navbar` component, which already contains a bell-icon link to `/notifications`.
- **Unread_Badge**: The red numeric indicator displayed on the Notifications sidebar item and the Navbar bell icon when `unreadCount > 0`.
- **Notifications_Page**: The `/notifications` route rendered by `NotificationsPage`, which shows a master-detail layout — an inbox list on the left and a full message panel on the right.
- **Mark_As_Read**: The action of setting a notification's `isRead` field to `true` in the database via `PUT /notification/read/:id`, accompanied by an immediate optimistic decrement of `unreadCount` in the Notification_Context.

---

## Requirements

### Requirement 1: Sidebar Notifications Item — All Dashboards

**User Story:** As any authenticated user (Student, Industry Partner, HOD, Dean, or SuperAdmin), I want a Notifications item in my sidebar, so that I can access my notifications from any dashboard without hunting for the navbar bell.

#### Acceptance Criteria

1. THE `StudentSidebar` SHALL render a navigation item labeled **"Notifications"** that links to `/notifications`.
2. THE `EmployerSidebar` SHALL render a navigation item labeled **"Notifications"** that links to `/notifications`.
3. THE `AdminSidebar` SHALL render a navigation item labeled **"Notifications"** that links to `/notifications`.
4. THE `GovernanceSidebar` (Dean role) SHALL render a navigation item labeled **"Notifications"** that links to `/notifications`.
5. THE `GovernanceSidebar` (HOD role) SHALL render a navigation item labeled **"Notifications"** that links to `/notifications`.
6. THE Notifications sidebar item SHALL use a bell-shaped SVG icon that matches the `h-4 w-4` sizing and `stroke="currentColor" strokeWidth="1.8"` style convention used by all other sidebar icons.
7. THE Notifications sidebar item SHALL be visible regardless of the user's role or verification status (it SHALL NOT be locked or hidden for unverified students).

---

### Requirement 2: Unread Badge on the Sidebar Item

**User Story:** As any authenticated user, I want the Notifications sidebar item to show a red badge with the unread count, so that I can see at a glance whether I have new notifications without opening the page.

#### Acceptance Criteria

1. WHEN `Notification_Context.unreadCount` is greater than zero, THE Sidebar SHALL display an `Unread_Badge` on the Notifications item showing the numeric count.
2. WHEN `Notification_Context.unreadCount` is zero, THE Sidebar SHALL NOT display an `Unread_Badge` on the Notifications item.
3. THE `Unread_Badge` count on the Notifications sidebar item SHALL always equal `Notification_Context.unreadCount` (invariant: sidebar badge count === context unread count).
4. THE `Unread_Badge` count on the Notifications sidebar item SHALL always equal the badge count shown on the Navbar bell icon (invariant: sidebar badge count === navbar badge count), because both read from the same `Notification_Context`.
5. WHEN `Notification_Context.unreadCount` exceeds 99, THE `Unread_Badge` SHALL display "99+" instead of the raw number.
6. THE `Unread_Badge` SHALL use a red background color (consistent with the existing `bg-rose-600` badge on the Navbar bell icon).

---

### Requirement 3: Navigation to the Notifications Page

**User Story:** As any authenticated user, I want clicking the Notifications sidebar item or the Navbar bell icon to take me to the `/notifications` page, so that I can read my full notification inbox.

#### Acceptance Criteria

1. WHEN a user clicks the Notifications sidebar item, THE Sidebar SHALL navigate the user to `/notifications`.
2. WHEN a user clicks the bell icon in the Navbar, THE Navbar SHALL navigate the user to `/notifications`.
3. THE `/notifications` page SHALL render the `NotificationsPage` component, which displays a master-detail layout: an inbox list panel on the left and a full notification detail panel on the right.
4. THE `/notifications` route SHALL be accessible to all authenticated roles (Student, Employer, HOD, Dean, SuperAdmin) without a role-specific layout wrapper, consistent with the current routing configuration.

---

### Requirement 4: Mark-as-Read State Sync

**User Story:** As any authenticated user, I want the unread badge to disappear or decrease immediately when I read a notification, so that the badge always reflects my true unread count without requiring a page refresh.

#### Acceptance Criteria

1. WHEN a user opens a notification on the Notifications_Page, THE `Notification_Context` SHALL call `PUT /notification/read/:id` to update `isRead` to `true` in the database.
2. WHEN `markNotificationRead` is called for a previously unread notification, THE `Notification_Context` SHALL immediately decrement `unreadCount` by 1 (optimistic update) before the API response is received.
3. THE `unreadCount` in `Notification_Context` SHALL equal the count of notifications in the context list where `isRead === false` (invariant: `unreadCount === notifications.filter(n => !n.isRead).length`).
4. WHEN `markAllNotificationsRead` is called, THE `Notification_Context` SHALL immediately set `unreadCount` to 0 and mark all notifications in the local list as `isRead: true`.
5. IF the `PUT /notification/read/:id` API call fails, THEN THE `Notification_Context` SHALL retain the optimistic UI state so the user experience remains responsive.
6. WHEN `unreadCount` reaches 0 after marking notifications as read, THE `Unread_Badge` SHALL disappear from both the Sidebar Notifications item and the Navbar bell icon without a page refresh.
