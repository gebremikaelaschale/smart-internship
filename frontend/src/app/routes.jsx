import React from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import Login from '@/features/auth/pages/Login.jsx';
import Register from '@/features/auth/pages/Register.jsx';
import ForgotPassword from '@/features/auth/pages/ForgotPassword.jsx';
import ProtectedRoute from '@/routes/ProtectedRoute';
import RoleRoute from '@/routes/RoleRoute';
import StudentLayout from '@/layouts/StudentLayout';
import EmployerLayout from '@/layouts/EmployerLayout';
import AdminLayout from '@/layouts/AdminLayout';
import GovernanceLayout from '@/layouts/GovernanceLayout';
import StudentDashboard from '@/features/student/pages/Dashboard';
import StudentProfile from '@/features/student/pages/Profile';
import StudentApplications from '@/features/student/pages/Applications';
import StudentInternships from '@/features/student/pages/Internships';
import StudentLogbook from '@/features/student/pages/Logbook';
import StudentSettings from '@/features/student/pages/Settings';
import Messages from '@/features/messaging/pages/Messages';
import EmployerDashboard from '@/features/employer/pages/Dashboard';
import EmployerProfile from '@/features/employer/pages/Profile';
import PostInternship from '@/features/employer/pages/PostInternship';
import MyPrograms from '@/features/employer/pages/MyPrograms';
import Activity from '@/features/employer/pages/Activity';
import Applicants from '@/features/employer/pages/Applicants';
import ActiveInterns from '@/features/employer/pages/ActiveInterns';
import EmployerLogbooks from '@/features/employer/pages/Logbooks';
import Evaluation from '@/features/employer/pages/Evaluation';
import Reports from '@/features/employer/pages/Reports';
import SuperAdminDashboard from '@/features/admin/pages/SuperAdminDashboard';
import CollegeDashboard from '@/features/admin/pages/CollegeDashboard';
import DepartmentDashboard from '@/features/admin/pages/DepartmentDashboard';
import DeanAnalytics from '@/features/admin/pages/DeanAnalytics';
import DeanRequestsApprovals from '@/features/admin/pages/DeanRequestsApprovals';
import DeanHodManagement from '@/features/admin/pages/DeanHodManagement';
import DeanSettings from '@/features/admin/pages/DeanSettings';
import Users from '@/features/admin/pages/Users';
import Students from '@/features/admin/pages/Students';
import Companies from '@/features/admin/pages/Companies';
import Internships from '@/features/admin/pages/Internships';
import Applications from '@/features/admin/pages/Applications';
import Colleges from '@/features/admin/pages/Colleges';
import Departments from '@/features/admin/pages/Departments';
import ReportsAdmin from '@/features/admin/pages/ReportsAdmin';
import Certificates from '@/features/admin/pages/Certificates';
import AnalyticsAdmin from '@/features/admin/pages/AnalyticsAdmin';
import EvaluationsAdmin from '@/features/admin/pages/EvaluationsAdmin';
import SettingsAdmin from '@/features/admin/pages/SettingsAdmin';

export default function AppRoutes() {
  return (
    <Routes>
            <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />

      <Route element={<ProtectedRoute />}>
        <Route path="/dean" element={<RoleRoute allowedRoles={['dean']}><GovernanceLayout title="Dean Portal" subtitle="College-wide oversight" /></RoleRoute>}>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<CollegeDashboard />} />
          <Route path="departments" element={<Departments />} />
          <Route path="hod-management" element={<DeanHodManagement />} />
          <Route path="students" element={<Students />} />
          <Route path="analytics" element={<DeanAnalytics />} />
          <Route path="requests" element={<DeanRequestsApprovals />} />
          <Route path="messages" element={<Messages />} />
          <Route path="settings" element={<DeanSettings />} />
        </Route>

        <Route path="/hod" element={<RoleRoute allowedRoles={['hod']}><GovernanceLayout title="HOD Portal" subtitle="Department-level oversight" /></RoleRoute>}>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<DepartmentDashboard />} />
          <Route path="students" element={<Students />} />
          <Route path="messages" element={<Messages />} />
        </Route>
      </Route>

      <Route element={<ProtectedRoute />}>
        <Route path="/student" element={<RoleRoute allowedRoles={['student']}><StudentLayout /></RoleRoute>}>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<StudentDashboard />} />
          <Route path="profile" element={<StudentProfile />} />
          <Route path="applications" element={<StudentApplications />} />
          <Route path="internships" element={<StudentInternships />} />
          <Route path="logbook" element={<StudentLogbook />} />
          <Route path="settings" element={<StudentSettings />} />
          <Route path="messages" element={<Messages />} />
        </Route>

        <Route path="/employer" element={<RoleRoute allowedRoles={['employer']}><EmployerLayout /></RoleRoute>}>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<EmployerDashboard />} />
          <Route path="profile" element={<EmployerProfile />} />
          <Route path="post-internship" element={<PostInternship />} />
          <Route path="edit-internship/:id" element={<PostInternship />} />
          <Route path="my-programs" element={<MyPrograms />} />
          <Route path="activity" element={<Activity />} />
          <Route path="applicants" element={<Applicants />} />
          <Route path="active-interns" element={<ActiveInterns />} />
          <Route path="logbooks" element={<EmployerLogbooks />} />
          <Route path="evaluation" element={<Evaluation />} />
          <Route path="reports" element={<Reports />} />
          <Route path="messages" element={<Messages />} />
        </Route>

        <Route path="/admin" element={<RoleRoute allowedRoles={['admin']}><AdminLayout /></RoleRoute>}>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<SuperAdminDashboard />} />
          <Route path="super-admin" element={<SuperAdminDashboard />} />
          <Route path="college" element={<CollegeDashboard />} />
          <Route path="department" element={<DepartmentDashboard />} />
          <Route path="users" element={<Users />} />
          <Route path="students" element={<Students />} />
          <Route path="companies" element={<Companies />} />
          <Route path="internships" element={<Internships />} />
          <Route path="applications" element={<Applications />} />
          <Route path="colleges" element={<Colleges />} />
          <Route path="departments" element={<Departments />} />
          <Route path="evaluations" element={<EvaluationsAdmin />} />
          <Route path="reports" element={<ReportsAdmin />} />
          <Route path="certificates" element={<Certificates />} />
          <Route path="analytics" element={<AnalyticsAdmin />} />
          <Route path="settings" element={<SettingsAdmin />} />
          <Route path="messages" element={<Messages />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
