import { Routes, Route, Navigate } from "react-router-dom";

// Layout
import Layout from "./Layout/Layout.jsx";

// Admin
import Dashboard from "./Admin/Dashboard.jsx";
import BranchDetails from "./Admin/BranchDetails.jsx";
import Login from "./Admin/Login.jsx";
import Attendance from "./Admin/AttendanceSheet.jsx";
import ProductList from "./Admin/ProductList.jsx";
import StaffList from "./Admin/Staff.jsx";
import BranchAssignments from "./Admin/BranchAssignments.jsx";
import EmployeeTracker from "./Admin/EmployeeTracker.jsx";
import BranchMap from "./Admin/BranchMap.jsx";
import RequestAdmin from "./Admin/RequestAdmin.jsx";
import PullOutAdmin from "./Admin/PullOutAdmin.jsx";

// Reports

import SalesReport from "./Reports/SalesReport.jsx";
import InventoryReport from "./Reports/InventoryReport.jsx";
import AttendanceReport from "./Reports/AttendanceReport.jsx";
import PayrollReport from "./Reports/PayrollReport.jsx";
import BranchReport from "./Reports/BranchReport.jsx";
import PullOutReport from "./Reports/PullOutReport.jsx";

// Auth
import ProtectedRoute from "./ProtectedRoute.jsx";
import Payroll from "./Admin/Payroll.jsx";


function App() {
  return (
    <Routes>
      {/* Default route - redirect to login */}
      <Route path="/" element={<Navigate to="/login" replace />} />

      {/* Public */}
      <Route path="/login" element={<Login />} />

      {/* Protected */}
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <Layout>
              <Dashboard />
            </Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/branch/:id"
        element={
          <ProtectedRoute>
            <Layout>
              <BranchDetails />
            </Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/branch-map"
        element={
          <ProtectedRoute>
            <Layout>
              <BranchMap />
            </Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/attendance"
        element={
          <ProtectedRoute>
            <Layout>
              <Attendance />
            </Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/payroll"
        element={
          <ProtectedRoute>
            <Layout>
              <Payroll />
            </Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/inventory"
        element={
          <ProtectedRoute>
            <Layout>
              <ProductList />
            </Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/products"
        element={<Navigate to="/inventory" replace />}
      />

      <Route
        path="/staff"
        element={
          <ProtectedRoute>
            <Layout>
              <StaffList />
            </Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/staff-monitoring"
        element={
          <ProtectedRoute>
            <Layout>
              <EmployeeTracker />
            </Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/branch-assign"
        element={
          <ProtectedRoute>
            <Layout>
              <BranchAssignments />
            </Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/branch-assignments"
        element={<Navigate to="/branch-assign" replace />}
      />

      <Route
        path="/branch-supply"
        element={
          localStorage.getItem("role") === "admin" ? (
            <ProtectedRoute>
              <Layout>
                <RequestAdmin />
              </Layout>
            </ProtectedRoute>
          ) : (
            <Navigate to="/dashboard" replace />
          )
        }
      />

      <Route
        path="/request"
        element={<Navigate to="/branch-supply" replace />}
      />

      <Route
        path="/pullout-admin"
        element={
          localStorage.getItem("role") === "admin" ? (
            <ProtectedRoute>
              <Layout>
                <PullOutAdmin />
              </Layout>
            </ProtectedRoute>
          ) : (
            <Navigate to="/dashboard" replace />
          )
        }
      />

      <Route
        path="/pull-out-admin"
        element={
          localStorage.getItem("role") === "admin" ? (
            <ProtectedRoute>
              <Layout>
                <PullOutAdmin />
              </Layout>
            </ProtectedRoute>
          ) : (
            <Navigate to="/dashboard" replace />
          )
        }
      />

      <Route
        path="/branch-info"
        element={
          localStorage.getItem("role") === "admin" ? (
            <ProtectedRoute>
              <Layout>
                <div className="p-6">
                  <h1 className="text-2xl font-bold">Branch Information</h1>
                  <p className="text-gray-500 mt-2">This page is under development</p>
                </div>
              </Layout>
            </ProtectedRoute>
          ) : (
            <Navigate to="/dashboard" replace />
          )
        }
      />

      <Route
        path="/reports/sales"
        element={
          localStorage.getItem("role") === "admin" ? (
            <ProtectedRoute>
              <Layout>
                <SalesReport />
              </Layout>
            </ProtectedRoute>
          ) : (
            <Navigate to="/dashboard" replace />
          )
        }
      />

      <Route
        path="/reports/inventory"
        element={
          localStorage.getItem("role") === "admin" ? (
            <ProtectedRoute>
              <Layout>
                <InventoryReport />
              </Layout>
            </ProtectedRoute>
          ) : (
            <Navigate to="/dashboard" replace />
          )
        }
      />

      <Route
        path="/reports/attendance"
        element={
          localStorage.getItem("role") === "admin" ? (
            <ProtectedRoute>
              <Layout>
                <AttendanceReport />
              </Layout>
            </ProtectedRoute>
          ) : (
            <Navigate to="/dashboard" replace />
          )
        }
      />

      <Route
        path="/reports/payroll"
        element={
          localStorage.getItem("role") === "admin" ? (
            <ProtectedRoute>
              <Layout>
                <PayrollReport />
              </Layout>
            </ProtectedRoute>
          ) : (
            <Navigate to="/dashboard" replace />
          )
        }
      />

      <Route
        path="/reports/branch"
        element={
          localStorage.getItem("role") === "admin" ? (
            <ProtectedRoute>
              <Layout>
                <BranchReport />
              </Layout>
            </ProtectedRoute>
          ) : (
            <Navigate to="/dashboard" replace />
          )
        }
      />

      <Route
        path="/reports/pullout"
        element={
          localStorage.getItem("role") === "admin" ? (
            <ProtectedRoute>
              <Layout>
                <PullOutReport />
              </Layout>
            </ProtectedRoute>
          ) : (
            <Navigate to="/dashboard" replace />
          )
        }
      />

      <Route
        path="/employee-tracker"
        element={
          localStorage.getItem("role") === "admin" ? (
            <ProtectedRoute>
              <Layout>
                <EmployeeTracker />
              </Layout>
            </ProtectedRoute>
          ) : (
            <Navigate to="/dashboard" replace />
          )
        }
      />
    </Routes>
  );
}

export default App;