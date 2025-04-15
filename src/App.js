import React from "react";
import { BrowserRouter as Router, Route, Routes, Navigate } from "react-router-dom";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Saveface from "./pages/Saveface";
import Scanface from "./pages/Scanface";
import StudentDashboard from "./pages/StudentDashboard";
import "bootstrap/dist/css/bootstrap.min.css";
import "./App.css";
import AttendanceHistory from "./pages/AttendanceHistory";
import ProtectedRoute from "./components/ProtectedRoute";
import { AuthProvider } from "./context/AuthContext";
import Navbar from "./components/Navbar";
import AdminDashboard from "./pages/AdminDashboard";
import TeacherDashboard from "./pages/TeacherDashboard";
import ClassDetail from "./pages/ClassDetail";
import CheckInPage from "./pages/CheckInPage";
import SavefaceTeacher from "./pages/SavefaceTeacher";
import VerifyfaceTeacher from "./pages/VerifyfaceTeacher";
import ClassHistoryList from "./pages/ClassHistoryList";
import ClassHistoryDetail from "./pages/ClassHistoryDetail";
import ManageListPage from "./pages/ManageListPage";
import NewRegister from "./pages/NewRegister";

function App() {
  return (
    <AuthProvider>
      <Router>
        <Navbar />
        <Routes>
          <Route path="/" element={<Navigate to="/login" />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/new-register" element={<NewRegister />} />
          <Route path="/save-face" element={
              <ProtectedRoute role="student"><Saveface /></ProtectedRoute>
          } />
          <Route path="/scan-face/:classId" element={
              <ProtectedRoute role="student"><Scanface /></ProtectedRoute>
          } />
          <Route path="/student-dashboard" element={
              <ProtectedRoute role="student"><StudentDashboard /></ProtectedRoute>
          } />
          <Route path="/attendance-history" element={
              <ProtectedRoute><AttendanceHistory /></ProtectedRoute>
          } />
          <Route path="/admin-dashboard" element={
              <ProtectedRoute role="admin"><AdminDashboard /></ProtectedRoute>
          } />
          <Route path="/teacher-dashboard" element={
              <ProtectedRoute role="teacher"><TeacherDashboard /></ProtectedRoute>
          } />
          <Route path="/class-detail/:id" element={
              <ProtectedRoute role="teacher"><ClassDetail /></ProtectedRoute>
          } />
          <Route path="/class/:id/checkin" element={
              <ProtectedRoute role="student"><CheckInPage /></ProtectedRoute>
          } />
          <Route path="/save-face-teacher" element={
              <ProtectedRoute role="teacher"><SavefaceTeacher /></ProtectedRoute>
          } />
          <Route path="/verifyface-teacher/:classId" element={
              <ProtectedRoute ><VerifyfaceTeacher /></ProtectedRoute>
          } />
          <Route path="/class-historylist" element={
              <ProtectedRoute role="teacher"><ClassHistoryList /></ProtectedRoute>
          } />
          <Route path="/class-historydetail/:classId" element={
              <ProtectedRoute role="teacher"><ClassHistoryDetail /></ProtectedRoute>
          } />
          <Route path="/manage-list" element={
              <ProtectedRoute role="admin"><ManageListPage /></ProtectedRoute>
          } />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
