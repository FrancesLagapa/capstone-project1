import React, { useState } from "react";
import { 
  Tag, Modal, message, Avatar, Button, Tooltip, 
  Input, Select, Pagination, Card, Space, Typography, 
  Badge, Empty, Skeleton, Form, Row, Col, Switch
} from "antd";
import { 
  UserOutlined,
  PlusOutlined,
  DeleteOutlined,
  EditOutlined,
  TeamOutlined,
  KeyOutlined,
  ReloadOutlined,
  SearchOutlined,
  MailOutlined,
  PhoneOutlined,
  HomeOutlined,
  IdcardOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined
} from "@ant-design/icons";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../config/api";

const { Title, Text } = Typography;
const { Option } = Select;

function Staff() {
  const queryClient = useQueryClient();

  // State Management
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingStaff, setEditingStaff] = useState(null);

  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const [positionFilter, setPositionFilter] = useState(null);
  const PAGE_SIZE = 5;

  const [form, setForm] = useState({
    username: "",
    password: "",
    firstname: "",
    lastname: "",
    middlename: "",
    address: "",
    position: "Staff",
    email: "",
    phone: "",
  });

  const [editForm, setEditForm] = useState({
    username: "",
    password: "",
    firstname: "",
    lastname: "",
    middlename: "",
    address: "",
    position: "Staff",
    email: "",
    phone: "",
    is_active: true,
  });

  // =========================
  // FETCH STAFF
  // =========================
  const fetchStaff = async ({ queryKey }) => {
    const [_, page, search, position] = queryKey;

    const params = new URLSearchParams();
    params.append("paginate", "true");
    params.append("per_page", PAGE_SIZE);
    params.append("page", page);

    if (search) params.append("search", search);
    
    // Add position filter - convert to role filter
    if (position) {
      if (position === "Rider") {
        params.append("role", "delivery_rider");
      } else if (position === "Staff") {
        params.append("role", "staff");
      }
    }

    const res = await api.get(`/staff?${params.toString()}`);
    return res.data;
  };

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["staff", currentPage, searchTerm, positionFilter],
    queryFn: fetchStaff,
    keepPreviousData: true,
  });

  // =========================
  // POSITION HELPER
  // =========================
  const getPosition = (staff) => {
    if (staff.role === "delivery_rider") return "Rider";
    return "Staff";
  };

  const getPositionColor = (position) => {
    if (position === "Rider") return "orange";
    return "blue";
  };

  const getPositionIcon = (position) => {
    if (position === "Rider") return "🏍️";
    return "👤";
  };

  // =========================
  // GET FULL NAME
  // =========================
  const getFullName = (staff) => {
    let name = staff.firstname || "";
    if (staff.middlename) {
      name += ` ${staff.middlename.charAt(0).toUpperCase()}.`;
    }
    if (staff.lastname) {
      name += ` ${staff.lastname}`;
    }
    return name.trim();
  };

  // =========================
  // ADD STAFF
  // =========================
  const addMutation = useMutation({
    mutationFn: (payload) => api.post("/staff", payload),
    onSuccess: () => {
      queryClient.invalidateQueries(["staff"]);
      message.success({
        content: "Staff member added successfully!",
        icon: <CheckCircleOutlined style={{ color: '#52c41a' }} />
      });
      setShowAddModal(false);
      resetForm();
    },
    onError: (err) => {
      const errorMessage = err?.response?.data?.message || "Error adding staff member";
      message.error(errorMessage);
    }
  });

  const handleAdd = async () => {
    // Validate required fields
    if (!form.username || !form.firstname || !form.lastname) {
      return message.warning("Please fill in all required fields");
    }

    // Prepare payload
    const payload = {
      username: form.username,
      password: form.password || "default123",
      firstname: form.firstname,
      lastname: form.lastname,
      middlename: form.middlename || null,
      address: form.address || null,
      email: form.email || null,
      position: form.position,
    };

    await addMutation.mutateAsync(payload);
  };

  // =========================
  // UPDATE STAFF
  // =========================
  const updateMutation = useMutation({
    mutationFn: ({ id, payload }) => api.put(`/staff/${id}`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries(["staff"]);
      message.success({
        content: "Staff member updated successfully!",
        icon: <CheckCircleOutlined style={{ color: '#52c41a' }} />
      });
      setShowEditModal(false);
    },
    onError: (err) => {
      const errorMessage = err?.response?.data?.message || "Error updating staff member";
      message.error(errorMessage);
    }
  });

  const handleUpdate = async () => {
    // Validate required fields
    if (!editForm.firstname || !editForm.lastname) {
      return message.warning("Please fill in all required fields");
    }

    const payload = {
      firstname: editForm.firstname,
      lastname: editForm.lastname,
      middlename: editForm.middlename || null,
      address: editForm.address || null,
      email: editForm.email || null,
      position: editForm.position,
      is_active: editForm.is_active,
    };

    // Only include password if it's been changed
    if (editForm.password && editForm.password.trim() !== "") {
      payload.password = editForm.password;
    }

    await updateMutation.mutateAsync({
      id: editingStaff.id,
      payload: payload,
    });
  };

  // =========================
  // DELETE STAFF
  // =========================
  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/staff/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries(["staff"]);
      message.success({
        content: "Staff member deleted successfully",
        icon: <CheckCircleOutlined style={{ color: '#52c41a' }} />
      });
      setShowDeleteModal(false);
    },
    onError: (err) => {
      const errorData = err?.response?.data;
      if (errorData?.code === 'STAFF_DELETE_CONSTRAINT') {
        message.error(
          errorData.message || "Cannot delete staff with existing records. Consider disabling instead."
        );
        setShowDeleteModal(false);
      } else {
        message.error(errorData?.message || "Error deleting staff member");
      }
    }
  });

  // =========================
  // HELPERS
  // =========================
  const resetForm = () => {
    setForm({
      username: "",
      password: "",
      firstname: "",
      lastname: "",
      middlename: "",
      address: "",
      position: "Staff",
      email: "",
      phone: "",
    });
  };

  const openEdit = (s) => {
    setEditingStaff(s);
    const position = getPosition(s);
    
    setEditForm({
      username: s.username || "",
      password: "",
      firstname: s.firstname || "",
      lastname: s.lastname || "",
      middlename: s.middlename || "",
      address: s.address || "",
      position: position,
      email: s.email || "",
      phone: s.phone || "",
      is_active: s.is_active !== undefined ? s.is_active : true,
    });
    setShowEditModal(true);
  };

  // Clear position filter
  const clearPositionFilter = () => {
    setPositionFilter(null);
  };

  const staffList = data?.data || [];
  const total = data?.total || 0;

  // =========================
  // RENDER STAFF CARD
  // =========================
  const renderStaffCard = (staff, index) => {
    const position = getPosition(staff);
    const positionColor = getPositionColor(position);
    const fullName = getFullName(staff);
    
    // Get initials for avatar
    let initials = staff.firstname?.[0] || '';
    if (staff.middlename) {
      initials += staff.middlename?.[0] || '';
    }
    initials += staff.lastname?.[0] || '';

    return (
      <Card 
        key={staff.id}
        className="hover:shadow-lg transition-shadow duration-300"
        styles={{
          body: { padding: '16px' }
        }}
      >
        <div className="flex items-start justify-between">
          <div className="flex items-start space-x-4">
            <Avatar 
              size={56} 
              style={{ 
                backgroundColor: position === "Rider" ? '#faad14' : '#1890ff'
              }}
            >
              {initials || <UserOutlined />}
            </Avatar>
            
            <div className="flex-1">
              <div className="flex items-center flex-wrap gap-2">
                <Text strong className="text-lg">
                  {fullName}
                </Text>
                <Badge 
                  color={staff.is_active ? "green" : "red"} 
                  text={staff.is_active ? "Active" : "Inactive"}
                />
                <Tag color={positionColor} className="flex items-center">
                  <span className="mr-1">{getPositionIcon(position)}</span>
                  {position}
                </Tag>
              </div>
              
              <div className="flex items-center gap-3 mt-1">
                <Text type="secondary" className="text-sm">
                  <IdcardOutlined className="mr-1" />
                  {staff.username}
                </Text>
              </div>

              <div className="flex flex-wrap gap-3 mt-2">
                {staff.email && (
                  <Text type="secondary" className="text-sm">
                    <MailOutlined className="mr-1" />
                    {staff.email}
                  </Text>
                )}
                {staff.phone && (
                  <Text type="secondary" className="text-sm">
                    <PhoneOutlined className="mr-1" />
                    {staff.phone}
                  </Text>
                )}
                {staff.address && (
                  <Text type="secondary" className="text-sm">
                    <HomeOutlined className="mr-1" />
                    {staff.address}
                  </Text>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-2 flex-shrink-0">
            <Tooltip title="Edit Staff">
              <Button 
                type="primary" 
                icon={<EditOutlined />} 
                onClick={() => openEdit(staff)}
                size="small"
              />
            </Tooltip>
            <Tooltip title={staff.is_active ? "Delete Staff" : "Remove Staff"}>
              <Button 
                danger 
                icon={<DeleteOutlined />} 
                onClick={() => {
                  setSelectedStaff(staff);
                  setShowDeleteModal(true);
                }}
                size="small"
              />
            </Tooltip>
          </div>
        </div>
      </Card>
    );
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      {/* HEADER */}
      <Card className="mb-6 shadow-sm">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center space-y-4 md:space-y-0">
          <div className="flex items-center space-x-4">
            <div className="bg-blue-100 p-3 rounded-lg">
              <TeamOutlined className="text-blue-600 text-2xl" />
            </div>
            <div>
              <Title level={4} className="m-0">
                Staff Management
              </Title>
              <Text type="secondary">
                Manage your staff members and riders
              </Text>
            </div>
          </div>
          
          <Space>
            <Button 
              icon={<ReloadOutlined />} 
              onClick={refetch}
              loading={isLoading}
            >
              Refresh
            </Button>
            <Button 
              type="primary" 
              icon={<PlusOutlined />} 
              onClick={() => setShowAddModal(true)}
              className="bg-blue-600 hover:bg-blue-700"
            >
              Add Staff
            </Button>
          </Space>
        </div>
      </Card>

      {/* SEARCH */}
      <Card className="mb-6 shadow-sm">
        <div className="flex flex-col md:flex-row gap-4">
          <Input
            placeholder="Search by name, username, or email..."
            prefix={<SearchOutlined className="text-gray-400" />}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1"
            size="large"
            allowClear
          />
          <Select
            placeholder="Filter by position"
            className="w-full md:w-48"
            size="large"
            allowClear
            value={positionFilter}
            onChange={(value) => setPositionFilter(value)}
          >
            <Option value="Staff">👤 Staff</Option>
            <Option value="Rider">🏍️ Rider</Option>
          </Select>
          {positionFilter && (
            <Button 
              onClick={clearPositionFilter}
              size="large"
            >
              Clear Filter
            </Button>
          )}
        </div>
      </Card>

      {/* STAFF LIST */}
      <div className="space-y-4">
        {isLoading ? (
          <Card>
            <Skeleton active paragraph={{ rows: 3 }} />
          </Card>
        ) : staffList.length === 0 ? (
          <Card>
            <Empty 
              description="No staff members found"
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            >
              <Button type="primary" onClick={() => setShowAddModal(true)}>
                Add Staff Member
              </Button>
            </Empty>
          </Card>
        ) : (
          <>
            {staffList.map((staff, index) => renderStaffCard(staff, index))}
          </>
        )}
      </div>

      {/* PAGINATION */}
      {total > 0 && (
        <Card className="mt-6 shadow-sm">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-2">
            <Text type="secondary" className="text-sm">
              Showing {(currentPage - 1) * PAGE_SIZE + 1} to {Math.min(currentPage * PAGE_SIZE, total)} of {total} staff members
            </Text>
            <Pagination
              current={currentPage}
              total={total}
              pageSize={PAGE_SIZE}
              onChange={setCurrentPage}
              showSizeChanger={false}
              showQuickJumper
            />
          </div>
        </Card>
      )}

      {/* ADD MODAL */}
      <Modal
        title={
          <div className="flex items-center space-x-2">
            <PlusOutlined className="text-blue-600" />
            <span>Add Staff Member</span>
          </div>
        }
        open={showAddModal}
        onCancel={() => {
          setShowAddModal(false);
          resetForm();
        }}
        onOk={handleAdd}
        width={600}
        confirmLoading={addMutation.isPending}
        okText="Add Staff"
        cancelText="Cancel"
      >
        <Form layout="vertical">
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item 
                label="First Name" 
                required
                validateStatus={!form.firstname ? 'error' : ''}
                help={!form.firstname ? 'First name is required' : ''}
              >
                <Input
                  placeholder="First name"
                  value={form.firstname}
                  onChange={e => setForm({...form, firstname: e.target.value})}
                />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="Middle Name">
                <Input
                  placeholder="Middle name"
                  value={form.middlename}
                  onChange={e => setForm({...form, middlename: e.target.value})}
                />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item 
                label="Last Name" 
                required
                validateStatus={!form.lastname ? 'error' : ''}
                help={!form.lastname ? 'Last name is required' : ''}
              >
                <Input
                  placeholder="Last name"
                  value={form.lastname}
                  onChange={e => setForm({...form, lastname: e.target.value})}
                />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item 
                label="Username" 
                required
                validateStatus={!form.username ? 'error' : ''}
                help={!form.username ? 'Username is required' : ''}
              >
                <Input
                  placeholder="Enter username"
                  value={form.username}
                  onChange={e => setForm({...form, username: e.target.value})}
                  prefix={<IdcardOutlined className="text-gray-400" />}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="Password">
                <Input.Password
                  placeholder="Enter password (default: default123)"
                  value={form.password}
                  onChange={e => setForm({...form, password: e.target.value})}
                  prefix={<KeyOutlined className="text-gray-400" />}
                />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="Email">
                <Input
                  placeholder="Enter email"
                  value={form.email}
                  onChange={e => setForm({...form, email: e.target.value})}
                  prefix={<MailOutlined className="text-gray-400" />}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="Phone">
                <Input
                  placeholder="Enter phone number"
                  value={form.phone}
                  onChange={e => setForm({...form, phone: e.target.value})}
                  prefix={<PhoneOutlined className="text-gray-400" />}
                />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item label="Address">
            <Input
              placeholder="Enter address"
              value={form.address}
              onChange={e => setForm({...form, address: e.target.value})}
              prefix={<HomeOutlined className="text-gray-400" />}
            />
          </Form.Item>

          <Form.Item label="Position" required>
            <Select
              value={form.position}
              onChange={(v) => setForm({...form, position: v})}
              size="large"
            >
              <Option value="Staff">
                <UserOutlined className="mr-2" /> Staff
              </Option>
              <Option value="Rider">
                🏍️ Rider
              </Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>

      {/* EDIT MODAL */}
      <Modal
        title={
          <div className="flex items-center space-x-2">
            <EditOutlined className="text-blue-600" />
            <span>Edit Staff Member</span>
          </div>
        }
        open={showEditModal}
        onCancel={() => setShowEditModal(false)}
        onOk={handleUpdate}
        width={600}
        confirmLoading={updateMutation.isPending}
        okText="Update Staff"
        cancelText="Cancel"
      >
        <Form layout="vertical">
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item 
                label="First Name" 
                required
                validateStatus={!editForm.firstname ? 'error' : ''}
                help={!editForm.firstname ? 'First name is required' : ''}
              >
                <Input
                  placeholder="First name"
                  value={editForm.firstname}
                  onChange={e => setEditForm({...editForm, firstname: e.target.value})}
                />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="Middle Name">
                <Input
                  placeholder="Middle name"
                  value={editForm.middlename}
                  onChange={e => setEditForm({...editForm, middlename: e.target.value})}
                />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item 
                label="Last Name" 
                required
                validateStatus={!editForm.lastname ? 'error' : ''}
                help={!editForm.lastname ? 'Last name is required' : ''}
              >
                <Input
                  placeholder="Last name"
                  value={editForm.lastname}
                  onChange={e => setEditForm({...editForm, lastname: e.target.value})}
                />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="Username">
                <Input
                  value={editForm.username}
                  prefix={<IdcardOutlined className="text-gray-400" />}
                  disabled
                />
                <Text type="secondary" className="text-xs">Username cannot be changed</Text>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="New Password">
                <Input.Password
                  placeholder="Enter new password (leave blank to keep current)"
                  value={editForm.password}
                  onChange={e => setEditForm({...editForm, password: e.target.value})}
                  prefix={<KeyOutlined className="text-gray-400" />}
                />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="Email">
                <Input
                  placeholder="Enter email"
                  value={editForm.email}
                  onChange={e => setEditForm({...editForm, email: e.target.value})}
                  prefix={<MailOutlined className="text-gray-400" />}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="Phone">
                <Input
                  placeholder="Enter phone number"
                  value={editForm.phone}
                  onChange={e => setEditForm({...editForm, phone: e.target.value})}
                  prefix={<PhoneOutlined className="text-gray-400" />}
                />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item label="Address">
            <Input
              placeholder="Enter address"
              value={editForm.address}
              onChange={e => setEditForm({...editForm, address: e.target.value})}
              prefix={<HomeOutlined className="text-gray-400" />}
            />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="Position" required>
                <Select
                  value={editForm.position}
                  onChange={(v) => setEditForm({...editForm, position: v})}
                  size="large"
                >
                  <Option value="Staff">
                    <UserOutlined className="mr-2" /> Staff
                  </Option>
                  <Option value="Rider">
                    🏍️ Rider
                  </Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="Status">
                <Switch
                  checked={editForm.is_active}
                  onChange={(checked) => setEditForm({...editForm, is_active: checked})}
                  checkedChildren="Active"
                  unCheckedChildren="Inactive"
                />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>

      {/* DELETE MODAL */}
      <Modal
        title={
          <div className="flex items-center space-x-2 text-red-600">
            <DeleteOutlined />
            <span>Confirm Delete</span>
          </div>
        }
        open={showDeleteModal}
        onOk={() => deleteMutation.mutate(selectedStaff?.id)}
        onCancel={() => setShowDeleteModal(false)}
        okText={selectedStaff?.is_active ? "Delete" : "Remove"}
        cancelText="Cancel"
        okButtonProps={{ danger: true, loading: deleteMutation.isPending }}
        width={420}
      >
        <div className="py-4">
          <div className="flex items-center justify-center mb-4">
            <div className="bg-red-50 p-4 rounded-full">
              <DeleteOutlined className="text-red-600 text-3xl" />
            </div>
          </div>
          <div className="text-center">
            <Text strong className="text-lg">
              Are you sure you want to {selectedStaff?.is_active ? "delete" : "remove"} this staff member?
            </Text>
            {selectedStaff && (
              <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                <Text>
                  <UserOutlined className="mr-2" />
                  {getFullName(selectedStaff)}
                </Text>
                <br />
                <Text type="secondary" className="text-sm">
                  <IdcardOutlined className="mr-2" />
                  {selectedStaff.username}
                </Text>
                <br />
                <Text type="secondary" className="text-sm">
                  <Tag color={getPositionColor(getPosition(selectedStaff))}>
                    {getPosition(selectedStaff)}
                  </Tag>
                </Text>
              </div>
            )}
            {selectedStaff?.is_active ? (
              <Text type="warning" className="block mt-3 text-sm">
                This action cannot be undone. Consider disabling the staff instead.
              </Text>
            ) : (
              <Text type="warning" className="block mt-3 text-sm">
                This staff member is already inactive. This will permanently remove them.
              </Text>
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
}

export default Staff;