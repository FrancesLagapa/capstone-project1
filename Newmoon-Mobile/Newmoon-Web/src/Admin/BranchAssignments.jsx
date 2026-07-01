import { useCallback, useEffect, useState } from "react";
import { Tag, Modal, message, Avatar, Button, Switch, Tooltip } from "antd";
import {
  UserOutlined,
  PlusOutlined,
  DeleteOutlined,
  EditOutlined,
  BankOutlined,
  TeamOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import { api } from "../config/api";
import { getCache, setCache, invalidateCache } from "../utils/cache";

function BranchAssignments() {
  const [staff, setStaff] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);

  // Add modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [form, setForm] = useState({
    user_id: "",
    branch_id: "",
    position: "Staff",
    daily_rate: 500,
  });

  // Edit modal state
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingAssignment, setEditingAssignment] = useState(null);
  const [editForm, setEditForm] = useState({
    user_id: "",
    branch_id: "",
    position: "Staff",
    daily_rate: 500,
  });

  // Load all data (staff, assignments, branches)
  const loadData = useCallback(async (forceRefresh = false) => {
    setLoading(true);
    try {
      const cachedStaff = forceRefresh ? null : getCache("staff");
      const cachedAssignments = forceRefresh ? null : getCache("branchAssignments");
      const cachedBranches = forceRefresh ? null : getCache("branches");

      if (cachedStaff && cachedAssignments && cachedBranches) {
        setStaff(Array.isArray(cachedStaff) ? cachedStaff : []);
        setAssignments(Array.isArray(cachedAssignments) ? cachedAssignments : []);
        setBranches(Array.isArray(cachedBranches) ? cachedBranches : []);
        setLoading(false);
        return;
      }

      const [staffRes, assignmentsRes, branchesRes] = await Promise.all([
        api.get("/staff?paginate=false"),
        api.get("/staff-assignments?paginate=false"), // get all assignments
        api.get("/branches"),
      ]);

      const staffRows = staffRes.data?.data || (Array.isArray(staffRes.data) ? staffRes.data : []);
      const assignmentRows = assignmentsRes.data?.data || (Array.isArray(assignmentsRes.data) ? assignmentsRes.data : []);
      const branchRows = branchesRes.data?.data || [];

      setStaff(staffRows);
      setAssignments(assignmentRows);
      setBranches(branchRows);

      setCache("staff", staffRows);
      setCache("branchAssignments", assignmentRows);
      setCache("branches", branchRows);
    } catch (error) {
      console.error("Load data error:", error);
      message.error("Failed to load data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Build a combined list: each staff with their latest/active assignment
  const staffWithAssignment = staff.map((s) => {
    // Prefer active assignment, otherwise any assignment
    const assignment =
      assignments.find((a) => a.user_id === s.id && a.is_active) ||
      assignments.find((a) => a.user_id === s.id);
    return {
      ...s,
      assignment: assignment || null,
      branch: assignment?.branch || null,
      position: assignment?.position || "Unassigned",
      daily_rate: assignment?.daily_rate || 0,
      is_active: assignment?.is_active ?? false,
    };
  });

  // Statistics
  const totalStaff = staff.length;
  const assignedCount = staffWithAssignment.filter((s) => s.assignment).length;
  const unassignedCount = totalStaff - assignedCount;
  const totalBranches = branches.length;

  // Add assignment
  const addAssignment = async () => {
    if (!form.user_id || !form.branch_id) {
      message.error("Please select both a staff member and a branch");
      return;
    }

    try {
      const payload = {
        user_id: Number(form.user_id),
        branch_id: Number(form.branch_id),
        position: form.position || "Staff",
        daily_rate: form.daily_rate ? Number(form.daily_rate) : 500,
        is_active: true,
      };

      await api.post("/staff-assignments", payload);

      setForm({
        user_id: "",
        branch_id: "",
        position: "Staff",
        daily_rate: 500,
      });
      setShowAddModal(false);

      invalidateCache("branchAssignments");
      await loadData(true);
      message.success("Branch assignment added successfully");
    } catch (error) {
      console.error("Add assignment error:", error);
      const validationErrors = error?.response?.data?.errors;
      if (validationErrors) {
        const firstField = Object.keys(validationErrors)[0];
        const firstMessage = validationErrors[firstField]?.[0];
        message.error(firstMessage || "Failed to add branch assignment");
      } else {
        message.error(error?.response?.data?.message || "Failed to add branch assignment");
      }
    }
  };

  // Update assignment
  const updateAssignment = async () => {
    if (!editForm.user_id || !editForm.branch_id) {
      message.error("Please select both a staff member and a branch");
      return;
    }

    try {
      const payload = {
        user_id: Number(editForm.user_id),
        branch_id: Number(editForm.branch_id),
        position: editForm.position || "Staff",
        daily_rate: editForm.daily_rate ? Number(editForm.daily_rate) : 500,
      };

      await api.put(`/staff-assignments/${editingAssignment.id}`, payload);

      setShowEditModal(false);
      setEditingAssignment(null);
      setEditForm({
        user_id: "",
        branch_id: "",
        position: "Staff",
        daily_rate: 500,
      });

      invalidateCache("branchAssignments");
      await loadData(true);
      message.success("Branch assignment updated successfully");
    } catch (error) {
      console.error("Update assignment error:", error);
      const validationErrors = error?.response?.data?.errors;
      if (validationErrors) {
        const firstField = Object.keys(validationErrors)[0];
        const firstMessage = validationErrors[firstField]?.[0];
        message.error(firstMessage || "Failed to update branch assignment");
      } else {
        message.error(error?.response?.data?.message || "Failed to update branch assignment");
      }
    }
  };

  // Delete assignment
  const deleteAssignment = async (assignment) => {
    Modal.confirm({
      title: "Delete Branch Assignment",
      content: (
        <div>
          <p className="text-gray-700 mb-2">
            Are you sure you want to remove this branch assignment?
          </p>
          <p className="text-sm text-gray-500">
            Staff:{" "}
            <span className="font-semibold">
              {assignment.user?.firstname} {assignment.user?.lastname}
            </span>
          </p>
          <p className="text-sm text-gray-500">
            Branch: <span className="font-semibold">{assignment.branch?.name}</span>
          </p>
        </div>
      ),
      okText: "Delete",
      okButtonProps: { danger: true },
      cancelText: "Cancel",
      onOk: async () => {
        try {
          await api.delete(`/staff-assignments/${assignment.id}`);
          invalidateCache("branchAssignments");
          await loadData(true);
          message.success("Branch assignment deleted successfully");
        } catch (error) {
          console.error("Delete assignment error:", error);
          message.error(error?.response?.data?.message || "Failed to delete branch assignment");
        }
      },
    });
  };

  // Toggle active status
  const toggleAssignmentActive = async (assignment) => {
    const nextActive = !assignment.is_active;
    Modal.confirm({
      title: nextActive ? "Activate branch assignment" : "Deactivate branch assignment",
      content: (
        <div>
          <p className="text-gray-700 mb-2">
            {nextActive
              ? "This staff member will be assigned to this branch."
              : "This staff member will no longer be assigned to this branch."}
          </p>
          <p className="text-sm text-gray-500">
            Staff:{" "}
            <span className="font-semibold">
              {assignment.user?.firstname} {assignment.user?.lastname}
            </span>
          </p>
          <p className="text-sm text-gray-500">
            Branch: <span className="font-semibold">{assignment.branch?.name}</span>
          </p>
        </div>
      ),
      okText: nextActive ? "Activate" : "Deactivate",
      okButtonProps: { danger: !nextActive },
      cancelText: "Cancel",
      onOk: async () => {
        try {
          await api.put(`/staff-assignments/${assignment.id}`, { is_active: nextActive });
          invalidateCache("branchAssignments");
          await loadData(true);
          message.success(nextActive ? "Assignment activated." : "Assignment deactivated.");
        } catch (error) {
          console.error("Toggle assignment error:", error);
          message.error(error?.response?.data?.message || "Failed to update assignment status.");
        }
      },
    });
  };

  // Open edit modal
  const openEditModal = (assignment) => {
    setEditingAssignment(assignment);
    setEditForm({
      user_id: assignment.user_id || "",
      branch_id: assignment.branch_id || "",
      position: assignment.position || "Staff",
      daily_rate: assignment.daily_rate || 500,
    });
    // Ensure staff list is fresh
    invalidateCache("staff");
    loadData(true);
    setShowEditModal(true);
  };

  // Open add modal with optional pre-selected staff
  const openAddModal = (preSelectedUserId = "") => {
    setForm({
      user_id: preSelectedUserId,
      branch_id: "",
      position: "Staff",
      daily_rate: 500,
    });
    setShowAddModal(true);
  };

  return (
    <div className="h-screen flex flex-col bg-gray-50 overflow-hidden">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 shadow-sm flex-shrink-0">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-800">Branch Assignments</h1>
              <p className="text-gray-500 mt-1">Manage staff branch assignments</p>
            </div>
            <div className="flex gap-3">
              <Button icon={<ReloadOutlined />} onClick={() => loadData(true)}>
                Refresh
              </Button>
              <button
                onClick={() => openAddModal()}
                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
              >
                <PlusOutlined />
                Add Assignment
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-7xl mx-auto px-6 py-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide">Total Staff</p>
                  <p className="text-2xl font-bold text-gray-800">{totalStaff}</p>
                </div>
                <div className="bg-blue-100 rounded-full p-3">
                  <TeamOutlined className="text-xl text-blue-600" />
                </div>
              </div>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide">Assigned</p>
                  <p className="text-2xl font-bold text-green-600">{assignedCount}</p>
                </div>
                <div className="bg-green-100 rounded-full p-3">
                  <BankOutlined className="text-xl text-green-600" />
                </div>
              </div>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide">Unassigned</p>
                  <p className="text-2xl font-bold text-orange-600">{unassignedCount}</p>
                </div>
                <div className="bg-orange-100 rounded-full p-3">
                  <UserOutlined className="text-xl text-orange-600" />
                </div>
              </div>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide">Total Branches</p>
                  <p className="text-2xl font-bold text-purple-600">{totalBranches}</p>
                </div>
                <div className="bg-purple-100 rounded-full p-3">
                  <BankOutlined className="text-xl text-purple-600" />
                </div>
              </div>
            </div>
          </div>

          {/* Staff Table with Assignment Status */}
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="bg-gray-50 border-b border-gray-200 px-6 py-3">
              <div className="flex items-center gap-2">
                <TeamOutlined className="text-blue-600" />
                <span className="font-semibold text-gray-700">Staff Directory</span>
                <Tag color="blue" className="ml-2">
                  {totalStaff} {totalStaff === 1 ? "Member" : "Members"}
                </Tag>
              </div>
            </div>

            {loading ? (
              <div className="flex justify-center py-20">
                <div className="relative">
                  <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-blue-500"></div>
                </div>
              </div>
            ) : staffWithAssignment.length === 0 ? (
              <div className="p-12 text-center">
                <UserOutlined className="text-6xl text-gray-300 mb-4" />
                <p className="text-gray-500 text-lg mb-2">No staff members found</p>
                <p className="text-gray-400">Add staff members from the Staff Management page</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        NO.
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        STAFF
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        BRANCH
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        POSITION
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        DAILY RATE
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        STATUS
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        ACTION
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {staffWithAssignment.map((s, idx) => (
                      <tr key={s.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 text-gray-500">{idx + 1}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <Avatar icon={<UserOutlined />} className="bg-blue-500" size="default" />
                            <div>
                              <div className="font-medium text-gray-800">
                                {s.firstname} {s.lastname}
                              </div>
                              <div className="text-xs text-gray-400">{s.username}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {s.assignment ? (
                            <Tag color="green">{s.branch?.name || "N/A"}</Tag>
                          ) : (
                            <Tag color="default">Not Assigned</Tag>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-gray-700">{s.position || "—"}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-gray-700">₱{s.daily_rate || 0}</span>
                        </td>
                        <td className="px-4 py-3">
                          {s.assignment ? (
                            s.is_active ? (
                              <Tag color="green">Active</Tag>
                            ) : (
                              <Tag color="red">Inactive</Tag>
                            )
                          ) : (
                            <Tag color="orange">Unassigned</Tag>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            {s.assignment ? (
                              <>
                                <Tooltip title={s.is_active ? "Deactivate" : "Activate"}>
                                  <Switch
                                    checked={s.is_active}
                                    onChange={() => toggleAssignmentActive(s.assignment)}
                                  />
                                </Tooltip>
                                <button
                                  onClick={() => openEditModal(s.assignment)}
                                  className="text-blue-500 hover:text-blue-700"
                                  title="Edit Assignment"
                                >
                                  <EditOutlined />
                                </button>
                                <button
                                  onClick={() => deleteAssignment(s.assignment)}
                                  className="text-red-500 hover:text-red-700"
                                  title="Delete Assignment"
                                >
                                  <DeleteOutlined />
                                </button>
                              </>
                            ) : (
                              <button
                                onClick={() => openAddModal(s.id)}
                                className="text-green-600 hover:text-green-800 flex items-center gap-1"
                                title="Assign to Branch"
                              >
                                <PlusOutlined /> Assign
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="mt-6 text-center text-xs text-gray-400 border-t border-gray-200 pt-4">
            <p>Branch Assignments | New Moon Lechon Manok and Liempo</p>
          </div>
        </div>
      </div>

      {/* Add Assignment Modal */}
      <Modal
        title={
          <div className="flex items-center gap-2">
            <PlusOutlined className="text-blue-600" />
            <span>Add Branch Assignment</span>
          </div>
        }
        open={showAddModal}
        onCancel={() => {
          setShowAddModal(false);
          setForm({
            user_id: "",
            branch_id: "",
            position: "Staff",
            daily_rate: 500,
          });
        }}
        footer={[
          <button
            key="cancel"
            onClick={() => {
              setShowAddModal(false);
              setForm({
                user_id: "",
                branch_id: "",
                position: "Staff",
                daily_rate: 500,
              });
            }}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>,
          <button
            key="submit"
            onClick={addAssignment}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors ml-2"
          >
            Add Assignment
          </button>,
        ]}
        width={600}
      >
        <div className="space-y-4 py-2">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Staff Member <span className="text-red-500">*</span>
            </label>
            <select
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
              value={form.user_id}
              onChange={(e) => setForm({ ...form, user_id: e.target.value })}
            >
              <option value="">Select Staff Member</option>
              {staff.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.firstname} {s.lastname} ({s.username})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Branch <span className="text-red-500">*</span>
            </label>
            <select
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
              value={form.branch_id}
              onChange={(e) => setForm({ ...form, branch_id: e.target.value })}
            >
              <option value="">Select Branch</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Position</label>
              <input
                type="text"
                placeholder="Enter position"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                value={form.position}
                onChange={(e) => setForm({ ...form, position: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Daily Rate</label>
              <input
                type="number"
                placeholder="Enter daily rate"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                value={form.daily_rate}
                onChange={(e) => setForm({ ...form, daily_rate: e.target.value })}
              />
            </div>
          </div>
        </div>
      </Modal>

      {/* Edit Assignment Modal */}
      <Modal
        title={
          <div className="flex items-center gap-2">
            <EditOutlined className="text-blue-600" />
            <span>Edit Branch Assignment</span>
          </div>
        }
        open={showEditModal}
        onCancel={() => {
          setShowEditModal(false);
          setEditingAssignment(null);
          setEditForm({
            user_id: "",
            branch_id: "",
            position: "Staff",
            daily_rate: 500,
          });
        }}
        footer={[
          <button
            key="cancel"
            onClick={() => {
              setShowEditModal(false);
              setEditingAssignment(null);
              setEditForm({
                user_id: "",
                branch_id: "",
                position: "Staff",
                daily_rate: 500,
              });
            }}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>,
          <button
            key="submit"
            onClick={updateAssignment}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors ml-2"
          >
            Update Assignment
          </button>,
        ]}
        width={600}
      >
        <div className="space-y-4 py-2">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Staff Member <span className="text-red-500">*</span>
            </label>
            <select
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
              value={editForm.user_id}
              onChange={(e) => setEditForm({ ...editForm, user_id: e.target.value })}
            >
              <option value="">Select Staff Member</option>
              {staff.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.firstname} {s.lastname} ({s.username})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Branch <span className="text-red-500">*</span>
            </label>
            <select
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
              value={editForm.branch_id}
              onChange={(e) => setEditForm({ ...editForm, branch_id: e.target.value })}
            >
              <option value="">Select Branch</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Position</label>
              <input
                type="text"
                placeholder="Enter position"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                value={editForm.position}
                onChange={(e) => setEditForm({ ...editForm, position: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Daily Rate</label>
              <input
                type="number"
                placeholder="Enter daily rate"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                value={editForm.daily_rate}
                onChange={(e) => setEditForm({ ...editForm, daily_rate: e.target.value })}
              />
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}

export default BranchAssignments;