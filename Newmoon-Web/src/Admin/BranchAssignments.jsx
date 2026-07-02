import { useState } from "react";
import { Tag, Modal, message, Avatar, Button, Switch, Tooltip } from "antd";
import {
  UserOutlined,
  PlusOutlined,
  DeleteOutlined,
  EditOutlined,
  BankOutlined,
  TeamOutlined,
  ReloadOutlined,
  CarOutlined,
} from "@ant-design/icons";
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from "../config/api";

// API functions - fetch staff and riders from assignments
const fetchStaff = async () => {
  const response = await api.get("/staff?paginate=false");
  if (response.data?.data) {
    return Array.isArray(response.data.data) ? response.data.data : [];
  }
  return Array.isArray(response.data) ? response.data : [];
};

const fetchAssignments = async () => {
  const response = await api.get("/staff-assignments?paginate=false");
  if (response.data?.data) {
    return Array.isArray(response.data.data) ? response.data.data : [];
  }
  return Array.isArray(response.data) ? response.data : [];
};

const fetchBranches = async () => {
  const response = await api.get("/branches");
  return response.data?.data || (Array.isArray(response.data) ? response.data : []);
};

const createAssignment = async (data) => {
  const response = await api.post("/staff-assignments", data);
  return response.data;
};

const updateAssignment = async ({ id, data }) => {
  const response = await api.put(`/staff-assignments/${id}`, data);
  return response.data;
};

const deleteAssignment = async (id) => {
  const response = await api.delete(`/staff-assignments/${id}`);
  return response.data;
};

const toggleAssignmentStatus = async ({ id, is_active }) => {
  const response = await api.put(`/staff-assignments/${id}`, { is_active });
  return response.data;
};

function BranchAssignments() {
  const queryClient = useQueryClient();

  // State for modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingAssignment, setEditingAssignment] = useState(null);
  const [form, setForm] = useState({
    user_id: "",
    branch_id: "",
    position: "",
    daily_rate: "",
  });
  const [editForm, setEditForm] = useState({
    user_id: "",
    branch_id: "",
    position: "",
    daily_rate: "",
  });

  // React Query - Fetch all data
  const { 
    data: staff = [], 
    isLoading: staffLoading,
    refetch: refetchStaff 
  } = useQuery({
    queryKey: ['staff'],
    queryFn: fetchStaff,
    staleTime: 5 * 60 * 1000,
  });

  const { 
    data: assignments = [], 
    isLoading: assignmentsLoading,
    refetch: refetchAssignments 
  } = useQuery({
    queryKey: ['assignments'],
    queryFn: fetchAssignments,
    staleTime: 5 * 60 * 1000,
  });

  const { 
    data: branches = [], 
    isLoading: branchesLoading,
    refetch: refetchBranches 
  } = useQuery({
    queryKey: ['branches'],
    queryFn: fetchBranches,
    staleTime: 5 * 60 * 1000,
  });

  const loading = staffLoading || assignmentsLoading || branchesLoading;

  // Separate staff and riders from the staff list
  const staffOnly = staff.filter(user => user.role === 'staff');
  const riders = staff.filter(user => user.role === 'delivery_rider');

  // Combine staff and riders into one list
  const allUsers = [...staffOnly, ...riders];

  // Build combined list with assignments
  const usersWithAssignment = allUsers.map((user) => {
    const assignment = assignments.find((a) => a.user_id === user.id && a.is_active) ||
                       assignments.find((a) => a.user_id === user.id);
    return {
      ...user,
      assignment: assignment || null,
      branch: assignment?.branch || null,
      position: assignment?.position || "Unassigned",
      daily_rate: assignment?.daily_rate || 0,
      is_active: assignment?.is_active ?? false,
    };
  });

  // Statistics
  const totalStaff = staffOnly.length;
  const totalRiders = riders.length;
  const totalUsers = allUsers.length;
  const assignedCount = usersWithAssignment.filter((u) => u.assignment).length;
  const unassignedCount = totalUsers - assignedCount;
  const totalBranches = branches.length;

  // Mutations
  const addMutation = useMutation({
    mutationFn: createAssignment,
    onSuccess: () => {
      message.success("Branch assignment added successfully");
      setShowAddModal(false);
      setForm({
        user_id: "",
        branch_id: "",
        position: "",
        daily_rate: "",
      });
      queryClient.invalidateQueries({ queryKey: ['assignments'] });
      queryClient.invalidateQueries({ queryKey: ['staff'] });
    },
    onError: (error) => {
      console.error("Add assignment error:", error);
      const validationErrors = error?.response?.data?.errors;
      if (validationErrors) {
        const firstField = Object.keys(validationErrors)[0];
        const firstMessage = validationErrors[firstField]?.[0];
        message.error(firstMessage || "Failed to add branch assignment");
      } else {
        message.error(error?.response?.data?.message || "Failed to add branch assignment");
      }
    },
  });

  const updateMutation = useMutation({
    mutationFn: updateAssignment,
    onSuccess: () => {
      message.success("Branch assignment updated successfully");
      setShowEditModal(false);
      setEditingAssignment(null);
      setEditForm({
        user_id: "",
        branch_id: "",
        position: "",
        daily_rate: "",
      });
      queryClient.invalidateQueries({ queryKey: ['assignments'] });
      queryClient.invalidateQueries({ queryKey: ['staff'] });
    },
    onError: (error) => {
      console.error("Update assignment error:", error);
      const validationErrors = error?.response?.data?.errors;
      if (validationErrors) {
        const firstField = Object.keys(validationErrors)[0];
        const firstMessage = validationErrors[firstField]?.[0];
        message.error(firstMessage || "Failed to update branch assignment");
      } else {
        message.error(error?.response?.data?.message || "Failed to update branch assignment");
      }
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteAssignment,
    onSuccess: () => {
      message.success("Branch assignment deleted successfully");
      queryClient.invalidateQueries({ queryKey: ['assignments'] });
      queryClient.invalidateQueries({ queryKey: ['staff'] });
    },
    onError: (error) => {
      console.error("Delete assignment error:", error);
      message.error(error?.response?.data?.message || "Failed to delete branch assignment");
    },
  });

  const toggleMutation = useMutation({
    mutationFn: toggleAssignmentStatus,
    onSuccess: (data, variables) => {
      message.success(variables.is_active ? "Assignment activated." : "Assignment deactivated.");
      queryClient.invalidateQueries({ queryKey: ['assignments'] });
      queryClient.invalidateQueries({ queryKey: ['staff'] });
    },
    onError: (error) => {
      console.error("Toggle assignment error:", error);
      message.error(error?.response?.data?.message || "Failed to update assignment status.");
    },
  });

  const handleAddAssignment = async () => {
    if (!form.user_id || !form.branch_id) {
      message.error("Please select both a user and a branch");
      return;
    }

    // Get the selected user to determine role
    const selectedUser = allUsers.find(u => u.id === Number(form.user_id));
    const defaultPosition = selectedUser?.role === 'delivery_rider' ? 'Delivery Rider' : 'Staff';
    const defaultRate = selectedUser?.role === 'delivery_rider' ? 400 : 500;

    const payload = {
      user_id: Number(form.user_id),
      branch_id: Number(form.branch_id),
      position: form.position || defaultPosition,
      daily_rate: form.daily_rate ? Number(form.daily_rate) : defaultRate,
      is_active: true,
    };

    await addMutation.mutateAsync(payload);
  };

  const handleUpdateAssignment = async () => {
    if (!editForm.user_id || !editForm.branch_id) {
      message.error("Please select both a user and a branch");
      return;
    }

    // Get the selected user to determine role
    const selectedUser = allUsers.find(u => u.id === Number(editForm.user_id));
    const defaultPosition = selectedUser?.role === 'delivery_rider' ? 'Delivery Rider' : 'Staff';
    const defaultRate = selectedUser?.role === 'delivery_rider' ? 400 : 500;

    const payload = {
      id: editingAssignment.id,
      data: {
        user_id: Number(editForm.user_id),
        branch_id: Number(editForm.branch_id),
        position: editForm.position || defaultPosition,
        daily_rate: editForm.daily_rate ? Number(editForm.daily_rate) : defaultRate,
      },
    };

    await updateMutation.mutateAsync(payload);
  };

  const handleDeleteAssignment = (assignment) => {
    Modal.confirm({
      title: "Delete Branch Assignment",
      content: (
        <div>
          <p className="text-gray-700 mb-2">
            Are you sure you want to remove this branch assignment?
          </p>
          <p className="text-sm text-gray-500">
            User:{" "}
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
        await deleteMutation.mutateAsync(assignment.id);
      },
    });
  };

  const handleToggleAssignment = (assignment) => {
    const nextActive = !assignment.is_active;
    Modal.confirm({
      title: nextActive ? "Activate branch assignment" : "Deactivate branch assignment",
      content: (
        <div>
          <p className="text-gray-700 mb-2">
            {nextActive
              ? "This user will be assigned to this branch."
              : "This user will no longer be assigned to this branch."}
          </p>
          <p className="text-sm text-gray-500">
            User:{" "}
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
        await toggleMutation.mutateAsync({ id: assignment.id, is_active: nextActive });
      },
    });
  };

  const openEditModal = (assignment) => {
    setEditingAssignment(assignment);
    setEditForm({
      user_id: assignment.user_id || "",
      branch_id: assignment.branch_id || "",
      position: assignment.position || "",
      daily_rate: assignment.daily_rate || "",
    });
    setShowEditModal(true);
  };

  const openAddModal = (preSelectedUserId = "") => {
    setForm({
      user_id: preSelectedUserId,
      branch_id: "",
      position: "",
      daily_rate: "",
    });
    setShowAddModal(true);
  };

  const refreshAll = () => {
    queryClient.invalidateQueries({ queryKey: ['staff'] });
    queryClient.invalidateQueries({ queryKey: ['assignments'] });
    queryClient.invalidateQueries({ queryKey: ['branches'] });
  };

  return (
    <div className="h-screen flex flex-col bg-gray-50 overflow-hidden">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 shadow-sm flex-shrink-0">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-800">Branch Assignments</h1>
              <p className="text-gray-500 mt-1">Manage staff and rider branch assignments</p>
            </div>
            <div className="flex gap-3">
              <Button 
                icon={<ReloadOutlined />} 
                onClick={refreshAll}
                loading={loading}
              >
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
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide">Total Staff</p>
                  <p className="text-2xl font-bold text-blue-600">{totalStaff}</p>
                </div>
                <div className="bg-blue-100 rounded-full p-3">
                  <TeamOutlined className="text-xl text-blue-600" />
                </div>
              </div>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide">Total Riders</p>
                  <p className="text-2xl font-bold text-orange-600">{totalRiders}</p>
                </div>
                <div className="bg-orange-100 rounded-full p-3">
                  <CarOutlined className="text-xl text-orange-600" />
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
                  <p className="text-2xl font-bold text-red-600">{unassignedCount}</p>
                </div>
                <div className="bg-red-100 rounded-full p-3">
                  <UserOutlined className="text-xl text-red-600" />
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

          {/* Users Table with Assignment Status */}
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="bg-gray-50 border-b border-gray-200 px-6 py-3">
              <div className="flex items-center gap-2">
                <TeamOutlined className="text-blue-600" />
                <span className="font-semibold text-gray-700">Staff & Riders Directory</span>
                <Tag color="blue" className="ml-2">
                  {totalUsers} {totalUsers === 1 ? "Member" : "Members"}
                </Tag>
              </div>
            </div>

            {loading ? (
              <div className="flex justify-center py-20">
                <div className="relative">
                  <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-blue-500"></div>
                </div>
              </div>
            ) : usersWithAssignment.length === 0 ? (
              <div className="p-12 text-center">
                <UserOutlined className="text-6xl text-gray-300 mb-4" />
                <p className="text-gray-500 text-lg mb-2">No staff or riders found</p>
                <p className="text-gray-400">Add users from the User Management page</p>
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
                        USER
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        TYPE
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
                    {usersWithAssignment.map((u, idx) => (
                      <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 text-gray-500">{idx + 1}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <Avatar icon={<UserOutlined />} className="bg-blue-500" size="default" />
                            <div>
                              <div className="font-medium text-gray-800">
                                {u.firstname} {u.lastname}
                              </div>
                              <div className="text-xs text-gray-400">{u.username}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {u.role === 'delivery_rider' ? (
                            <Tag color="orange" icon={<CarOutlined />}>Rider</Tag>
                          ) : (
                            <Tag color="blue" icon={<TeamOutlined />}>Staff</Tag>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {u.assignment ? (
                            <Tag color="green">{u.branch?.name || "N/A"}</Tag>
                          ) : (
                            <Tag color="default">Not Assigned</Tag>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-gray-700">{u.position || "—"}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-gray-700">₱{u.daily_rate || 0}</span>
                        </td>
                        <td className="px-4 py-3">
                          {u.assignment ? (
                            u.is_active ? (
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
                            {u.assignment ? (
                              <>
                                <Tooltip title={u.is_active ? "Deactivate" : "Activate"}>
                                  <Switch
                                    checked={u.is_active}
                                    onChange={() => handleToggleAssignment(u.assignment)}
                                    loading={toggleMutation.isPending}
                                  />
                                </Tooltip>
                                <button
                                  onClick={() => openEditModal(u.assignment)}
                                  className="text-blue-500 hover:text-blue-700"
                                  title="Edit Assignment"
                                >
                                  <EditOutlined />
                                </button>
                                <button
                                  onClick={() => handleDeleteAssignment(u.assignment)}
                                  className="text-red-500 hover:text-red-700"
                                  title="Delete Assignment"
                                >
                                  <DeleteOutlined />
                                </button>
                              </>
                            ) : (
                              <button
                                onClick={() => openAddModal(u.id)}
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
            position: "",
            daily_rate: "",
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
                position: "",
                daily_rate: "",
              });
            }}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>,
          <button
            key="submit"
            onClick={handleAddAssignment}
            disabled={addMutation.isPending}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors ml-2 disabled:opacity-50"
          >
            {addMutation.isPending ? "Adding..." : "Add Assignment"}
          </button>,
        ]}
        width={600}
      >
        <div className="space-y-4 py-2">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              User <span className="text-red-500">*</span>
            </label>
            <select
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
              value={form.user_id}
              onChange={(e) => {
                const userId = e.target.value;
                const selectedUser = allUsers.find(u => u.id === Number(userId));
                setForm({ 
                  ...form, 
                  user_id: userId,
                  position: selectedUser?.role === 'delivery_rider' ? 'Delivery Rider' : 'Staff',
                  daily_rate: selectedUser?.role === 'delivery_rider' ? 400 : 500,
                });
              }}
            >
              <option value="">Select User</option>
              {allUsers.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.firstname} {u.lastname} ({u.username}) - {u.role === 'delivery_rider' ? 'Rider' : 'Staff'}
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
            position: "",
            daily_rate: "",
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
                position: "",
                daily_rate: "",
              });
            }}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>,
          <button
            key="submit"
            onClick={handleUpdateAssignment}
            disabled={updateMutation.isPending}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors ml-2 disabled:opacity-50"
          >
            {updateMutation.isPending ? "Updating..." : "Update Assignment"}
          </button>,
        ]}
        width={600}
      >
        <div className="space-y-4 py-2">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              User <span className="text-red-500">*</span>
            </label>
            <select
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
              value={editForm.user_id}
              onChange={(e) => {
                const userId = e.target.value;
                const selectedUser = allUsers.find(u => u.id === Number(userId));
                setEditForm({ 
                  ...editForm, 
                  user_id: userId,
                  position: selectedUser?.role === 'delivery_rider' ? 'Delivery Rider' : 'Staff',
                  daily_rate: selectedUser?.role === 'delivery_rider' ? 400 : 500,
                });
              }}
            >
              <option value="">Select User</option>
              {allUsers.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.firstname} {u.lastname} ({u.username}) - {u.role === 'delivery_rider' ? 'Rider' : 'Staff'}
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