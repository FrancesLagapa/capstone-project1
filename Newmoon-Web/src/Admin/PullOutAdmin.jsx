import { useState } from "react";
import { Card, Table, Button, Modal, Form, Input, message, Tag, Row, Col, Statistic, Space, Select, Tooltip } from "antd";
import { 
  ReloadOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  CheckOutlined,
  CloseOutlined,
  DeleteOutlined
} from "@ant-design/icons";
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from "../config/api";
const { Option } = Select;

const { TextArea } = Input;

function PullOutAdmin() {
  const [statusFilter, setStatusFilter] = useState("all");
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [selectedPullOut, setSelectedPullOut] = useState(null);
  const [approveForm] = Form.useForm();
  const [rejectForm] = Form.useForm();
  const queryClient = useQueryClient();

  // Fetch all pull-outs
  const { data: pullOutsData, isLoading: pullOutsLoading, refetch: refetchPullOuts } = useQuery({
    queryKey: ['pullOutsAll'],
    queryFn: () => api.get("/pull-outs/getall"),
  });

  const pullOuts = pullOutsData?.data?.data || [];

  // Filter pull-outs based on status
  const filteredPullOuts = statusFilter === "all" 
    ? pullOuts
    : pullOuts.filter((p) => p.status === statusFilter);

  // Approve mutation
  const approveMutation = useMutation({
    mutationFn: ({ id, adminNotes }) => 
      api.post(`/pull-outs/${id}/approve`, { admin_notes: adminNotes }),
    onSuccess: () => {
      message.success("Pull-out approved successfully");
      setShowApproveModal(false);
      approveForm.resetFields();
      setSelectedPullOut(null);
      queryClient.invalidateQueries({ queryKey: ['pullOutsAll'] });
    },
    onError: (error) => {
      message.error(error.response?.data?.message || "Failed to approve pull-out");
    },
  });

  // Reject mutation
  const rejectMutation = useMutation({
    mutationFn: ({ id, adminNotes }) => 
      api.post(`/pull-outs/${id}/reject`, { admin_notes: adminNotes }),
    onSuccess: () => {
      message.success("Pull-out rejected successfully");
      setShowRejectModal(false);
      rejectForm.resetFields();
      setSelectedPullOut(null);
      queryClient.invalidateQueries({ queryKey: ['pullOutsAll'] });
    },
    onError: (error) => {
      message.error(error.response?.data?.message || "Failed to reject pull-out");
    },
  });

  const handleApprove = (values) => {
    approveMutation.mutate({
      id: selectedPullOut.id,
      adminNotes: values.admin_notes || null,
    });
  };

  const handleReject = (values) => {
    rejectMutation.mutate({
      id: selectedPullOut.id,
      adminNotes: values.admin_notes || null,
    });
  };

  const getStatusTag = (status) => {
    const statusConfig = {
      pending: { color: "orange", icon: <ClockCircleOutlined />, text: "Pending" },
      approved: { color: "green", icon: <CheckCircleOutlined />, text: "Approved" },
      rejected: { color: "red", icon: <CloseCircleOutlined />, text: "Rejected" },
    };
    const config = statusConfig[status] || statusConfig.pending;
    return (
      <Tag color={config.color} icon={config.icon}>
        {config.text}
      </Tag>
    );
  };

  const formatDate = (dateString) => {
    if (!dateString) return "-";
    return new Date(dateString).toLocaleDateString("en-PH", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const columns = [
    {
      title: "Staff",
      key: "staff",
      render: (_, record) => (
        <div>
          <div className="font-semibold">
            {record.user?.firstname} {record.user?.lastname}
          </div>
          <div className="text-gray-500 text-xs">ID: {record.user?.id}</div>
        </div>
      ),
    },
    {
      title: "Product",
      key: "product",
      render: (_, record) => (
        <div>
          <div className="font-semibold">{record.product?.name}</div>
          <div className="text-gray-500 text-xs">SKU: {record.product?.sku}</div>
        </div>
      ),
    },
    {
      title: "Branch",
      key: "branch",
      render: (_, record) => (
        <div className="font-semibold">{record.branch?.name}</div>
      ),
    },
    {
      title: "Quantity",
      dataIndex: "quantity",
      key: "quantity",
      render: (quantity) => (
        <span className="font-semibold">{quantity}</span>
      ),
    },
    {
      title: "Notes",
      dataIndex: "notes",
      key: "notes",
      render: (notes) => notes || <span className="text-gray-400">-</span>,
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      render: (status) => getStatusTag(status),
    },
    {
      title: "Pulled Out At",
      dataIndex: "pulled_out_at",
      key: "pulled_out_at",
      render: (date) => formatDate(date),
    },
    {
      title: "Processed At",
      key: "processed_date",
      render: (_, record) => {
        if (record.status === "approved" && record.approved_at) {
          return <span className="text-green-600">{formatDate(record.approved_at)}</span>;
        }
        if (record.status === "rejected" && record.rejected_at) {
          return <span className="text-red-600">{formatDate(record.rejected_at)}</span>;
        }
        return <span className="text-gray-400">-</span>;
      },
    },
    {
      title: "Admin Notes",
      dataIndex: "admin_notes",
      key: "admin_notes",
      render: (notes) => notes || <span className="text-gray-400">-</span>,
    },
    {
      title: "Actions",
      key: "actions",
      render: (_, record) => (
        <Space>
          {record.status === "pending" && (
            <>
              <Tooltip title="Approve">
                <Button
                  type="primary"
                  size="small"
                  icon={<CheckOutlined />}
                  onClick={() => {
                    setSelectedPullOut(record);
                    setShowApproveModal(true);
                  }}
                >
                  Approve
                </Button>
              </Tooltip>
              <Tooltip title="Reject">
                <Button
                  danger
                  size="small"
                  icon={<CloseOutlined />}
                  onClick={() => {
                    setSelectedPullOut(record);
                    setShowRejectModal(true);
                  }}
                >
                  Reject
                </Button>
              </Tooltip>
            </>
          )}
          {record.status !== "pending" && (
            <span className="text-gray-400 text-sm">No actions</span>
          )}
        </Space>
      ),
    },
  ];

  // Statistics
  const statistics = {
    total: pullOuts.length,
    pending: pullOuts.filter((p) => p.status === "pending").length,
    approved: pullOuts.filter((p) => p.status === "approved").length,
    rejected: pullOuts.filter((p) => p.status === "rejected").length,
    totalQuantity: pullOuts
      .filter((p) => p.status === "approved")
      .reduce((sum, p) => sum + Number(p.quantity), 0),
  };

  const handleRefresh = () => {
    refetchPullOuts();
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800 mb-2">Pull-Out Management</h1>
        <p className="text-gray-600">Approve or reject product pull-out requests</p>
      </div>

      {/* Statistics Cards */}
      <Row gutter={16} className="mb-6">
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Total Pull-Outs"
              value={statistics.total}
              styles={{ content: { color: "#1890ff" } }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Pending"
              value={statistics.pending}
              styles={{ content: { color: "#faad14" } }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Approved"
              value={statistics.approved}
              styles={{ content: { color: "#3f8600" } }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Total Quantity"
              value={statistics.totalQuantity}
              precision={2}
              styles={{ content: { color: "#3f8600" } }}
            />
          </Card>
        </Col>
      </Row>

      {/* Filter Bar */}
      <Card className="mb-6">
        <Space>
          <span className="text-gray-600">Filter by status:</span>
          <Select
            value={statusFilter}
            onChange={setStatusFilter}
            style={{ width: 150 }}
          >
            <Select.Option value="all">All</Select.Option>
            <Select.Option value="pending">Pending</Select.Option>
            <Select.Option value="approved">Approved</Select.Option>
            <Select.Option value="rejected">Rejected</Select.Option>
          </Select>
          <Button
            icon={<ReloadOutlined />}
            onClick={handleRefresh}
            loading={pullOutsLoading}
          >
            Refresh
          </Button>
        </Space>
      </Card>

      {/* Pull-Outs Table */}
      <Card
        title="All Pull-Outs"
        extra={<span className="text-gray-500">{filteredPullOuts.length} pull-out(s)</span>}
      >
        <Table
          columns={columns}
          dataSource={filteredPullOuts}
          rowKey="id"
          loading={pullOutsLoading}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showTotal: (total) => `Total ${total} pull-outs`,
          }}
          locale={{
            emptyText: (
              <div className="py-8 text-center">
                <DeleteOutlined className="text-4xl text-gray-300 mb-2" />
                <p className="text-gray-500">No pull-outs found</p>
              </div>
            ),
          }}
        />
      </Card>

      {/* Approve Modal */}
      <Modal
        title="Approve Pull-Out"
        open={showApproveModal}
        onCancel={() => {
          setShowApproveModal(false);
          approveForm.resetFields();
          setSelectedPullOut(null);
        }}
        footer={null}
        destroyOnHidden
      >
        {selectedPullOut && (
          <div className="mb-4 p-4 rounded-lg bg-green-50">
            <div className="font-semibold">
              {selectedPullOut.user?.firstname} {selectedPullOut.user?.lastname}
            </div>
            <div className="text-lg font-bold text-green-600">
              {selectedPullOut.product?.name}
            </div>
            <div className="text-gray-600 text-sm">
              Quantity: {selectedPullOut.quantity}
            </div>
            <div className="text-gray-600 text-sm">
              Branch: {selectedPullOut.branch?.name}
            </div>
            {selectedPullOut.notes && (
              <div className="text-gray-600 text-sm mt-1">
                Notes: {selectedPullOut.notes}
              </div>
            )}
          </div>
        )}
        <Form
          form={approveForm}
          layout="vertical"
          onFinish={handleApprove}
          initialValues={{ admin_notes: "" }}
        >
          <Form.Item
            label="Admin Notes (Optional)"
            name="admin_notes"
            rules={[
              { max: 500, message: "Notes cannot exceed 500 characters" },
            ]}
          >
            <TextArea
              rows={4}
              placeholder="Add any notes for this approval"
              maxLength={500}
              showCount
              disabled={approveMutation.isPending}
            />
          </Form.Item>

          <Form.Item className="mb-0">
            <Space className="w-full justify-end">
              <Button
                onClick={() => {
                  setShowApproveModal(false);
                  approveForm.resetFields();
                  setSelectedPullOut(null);
                }}
                disabled={approveMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                type="primary"
                htmlType="submit"
                loading={approveMutation.isPending}
                icon={<CheckOutlined />}
              >
                Approve Pull-Out
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* Reject Modal */}
      <Modal
        title="Reject Pull-Out"
        open={showRejectModal}
        onCancel={() => {
          setShowRejectModal(false);
          rejectForm.resetFields();
          setSelectedPullOut(null);
        }}
        footer={null}
        destroyOnHidden
      >
        {selectedPullOut && (
          <div className="mb-4 p-4 bg-red-50 rounded-lg">
            <div className="font-semibold">
              {selectedPullOut.user?.firstname} {selectedPullOut.user?.lastname}
            </div>
            <div className="text-lg font-bold text-red-600">
              {selectedPullOut.product?.name}
            </div>
            <div className="text-gray-600 text-sm">
              Quantity: {selectedPullOut.quantity}
            </div>
            <div className="text-gray-600 text-sm">
              Branch: {selectedPullOut.branch?.name}
            </div>
            {selectedPullOut.notes && (
              <div className="text-gray-600 text-sm mt-1">
                Notes: {selectedPullOut.notes}
              </div>
            )}
          </div>
        )}
        <Form
          form={rejectForm}
          layout="vertical"
          onFinish={handleReject}
          initialValues={{ admin_notes: "" }}
        >
          <Form.Item
            label="Rejection Reason (Optional)"
            name="admin_notes"
            rules={[
              { max: 500, message: "Reason cannot exceed 500 characters" },
            ]}
          >
            <TextArea
              rows={4}
              placeholder="Provide a reason for rejection"
              maxLength={500}
              showCount
              disabled={rejectMutation.isPending}
            />
          </Form.Item>

          <Form.Item className="mb-0">
            <Space className="w-full justify-end">
              <Button
                onClick={() => {
                  setShowRejectModal(false);
                  rejectForm.resetFields();
                  setSelectedPullOut(null);
                }}
                disabled={rejectMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                danger
                htmlType="submit"
                loading={rejectMutation.isPending}
                icon={<CloseOutlined />}
              >
                Reject Pull-Out
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

export default PullOutAdmin;
