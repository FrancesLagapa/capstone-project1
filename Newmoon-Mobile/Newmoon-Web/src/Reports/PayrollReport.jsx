import React, { useState, useEffect } from "react";
import {
  Card,
  Row,
  Col,
  Table,
  DatePicker,
  Select,
  Button,
  Space,
  Typography,
  Statistic,
  Tag,
  Tooltip,
  Modal,
  Descriptions,
} from "antd";
import {
  DollarOutlined,
  UserOutlined,
  ClockCircleOutlined,
  CalculatorOutlined,
  DownloadOutlined,
  FileTextOutlined,
  WalletOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import { api } from "../config/api";

const { Text, Title } = Typography;
const { RangePicker } = DatePicker;

const PayrollReport = () => {
  const [loading, setLoading] = useState(false);
  const [payrollData, setPayrollData] = useState([]);
  const [summary, setSummary] = useState(null);
  const [staffList, setStaffList] = useState([]);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 15, total: 0 });
  const [selectedStaff, setSelectedStaff] = useState(null);
  const [dateRange, setDateRange] = useState([dayjs().startOf("month"), dayjs().endOf("month")]);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [selectedPayroll, setSelectedPayroll] = useState(null);

  const fetchPayrollReport = async (page = 1) => {
    setLoading(true);
    try {
      const [payrollRes, staffRes] = await Promise.all([
        api.get("/reports/payroll", {
          params: {
            month: dateRange[0].format("YYYY-MM"),
            page: page,
            per_page: pagination.pageSize,
          },
        }),
        api.get("/staff"),
      ]);

      setStaffList(Array.isArray(staffRes.data) ? staffRes.data : []);
      const data = payrollRes.data || {};
      
      setPayrollData(data.data || []);
      setSummary(data.summary || null);
      if (data.pagination) {
        setPagination({
          current: data.pagination.current_page,
          pageSize: data.pagination.per_page,
          total: data.pagination.total,
        });
      }
    } catch (err) {
      console.error("[PayrollReport] Error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPayrollReport(1);
  }, [dateRange, selectedStaff]);

  const handleTableChange = (pagination) => {
    fetchPayrollReport(pagination.current);
  };

  const handleExport = () => {
    const csvContent = [
      ["Staff", "Position", "Hours Worked", "Hourly Rate", "Gross Pay", "SSS", "PhilHealth", "Pag-IBIG", "Tax", "Total Deductions", "Net Pay"],
      ...payrollData.map(row => [
        row.staff_name,
        row.position,
        row.hours_worked,
        row.hourly_rate,
        row.gross_pay,
        row.sss_deduction,
        row.philhealth_deduction,
        row.pagibig_deduction,
        row.tax_deduction,
        row.total_deductions,
        row.net_pay,
      ]),
    ].map(e => e.join(",")).join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `payroll_report_${dayjs().format("YYYY-MM-DD")}.csv`;
    a.click();
  };

  const showDetailModal = (record) => {
    setSelectedPayroll(record);
    setDetailModalVisible(true);
  };

  const columns = [
    {
      title: "Staff",
      dataIndex: "staff_name",
      key: "staff_name",
      sorter: (a, b) => a.staff_name.localeCompare(b.staff_name),
      render: (name, record) => (
        <div>
          <Text strong>{name}</Text>
          <br />
          <Text type="secondary" style={{ fontSize: 12 }}>{record.position}</Text>
        </div>
      ),
    },
    {
      title: "Hours Worked",
      dataIndex: "hours_worked",
      key: "hours_worked",
      sorter: (a, b) => a.hours_worked - b.hours_worked,
      render: (hours) => hours !== null && hours !== undefined ? `${hours.toFixed(1)} hrs` : "-",
    },
    {
      title: "Hourly Rate",
      dataIndex: "hourly_rate",
      key: "hourly_rate",
      render: (rate) => rate !== null && rate !== undefined ? `₱${Number(rate).toFixed(2)}` : "-",
    },
    {
      title: "Gross Pay",
      dataIndex: "gross_pay",
      key: "gross_pay",
      sorter: (a, b) => a.gross_pay - b.gross_pay,
      render: (amount) => (
        <Text strong style={{ color: "#1890ff" }}>
          ₱{Number(amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
        </Text>
      ),
    },
    {
      title: "Deductions",
      dataIndex: "total_deductions",
      key: "total_deductions",
      sorter: (a, b) => a.total_deductions - b.total_deductions,
      render: (amount) => (
        <Text type="danger">
          -₱{Number(amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
        </Text>
      ),
    },
    {
      title: "Net Pay",
      dataIndex: "net_pay",
      key: "net_pay",
      sorter: (a, b) => a.net_pay - b.net_pay,
      render: (amount) => (
        <Text strong style={{ color: "#52c41a", fontSize: 16 }}>
          ₱{Number(amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
        </Text>
      ),
    },
    {
      title: "Actions",
      key: "actions",
      render: (_, record) => (
        <Button type="link" onClick={() => showDetailModal(record)}>
          View Details
        </Button>
      ),
    },
  ];

  return (
    <div className="p-4 bg-gray-50 min-h-screen">
      <Row gutter={[16, 16]}>
        {/* Header */}
        <Col span={24}>
          <Card variant="borderless">
            <Row justify="space-between" align="middle">
              <Col>
                <Title level={4} style={{ margin: 0 }}>
                  <CalculatorOutlined className="mr-2 text-blue-500" />
                  Payroll Report
                </Title>
                <Text type="secondary">Hours worked, deductions, and net pay calculations</Text>
              </Col>
              <Col>
                <Space>
                  <Button icon={<DownloadOutlined />} onClick={handleExport}>
                    Export CSV
                  </Button>
                  <Button type="primary" icon={<FileTextOutlined />} onClick={fetchPayrollReport} loading={loading}>
                    Generate Report
                  </Button>
                </Space>
              </Col>
            </Row>
          </Card>
        </Col>

        {/* Filters */}
        <Col span={24}>
          <Card variant="borderless" size="small">
            <Space wrap>
              <Text strong>Pay Period:</Text>
              <RangePicker
                value={dateRange}
                onChange={setDateRange}
                format="YYYY-MM-DD"
                allowClear={false}
              />
              <Text strong>Staff:</Text>
              <Select
                style={{ width: 200 }}
                placeholder="All Staff"
                allowClear
                value={selectedStaff}
                onChange={setSelectedStaff}
              >
                {Array.isArray(staffList) && staffList.map((staff) => (
                  <Select.Option key={staff.id} value={staff.id}>
                    {staff.firstname} {staff.lastname}
                  </Select.Option>
                ))}
              </Select>
            </Space>
          </Card>
        </Col>

        {/* Summary Stats */}
        {summary && (
          <>
            <Col xs={24} sm={12} md={6}>
              <Card variant="borderless">
                <Statistic
                  title="Total Gross Pay"
                  value={summary.total_gross_pay}
                  prefix={<DollarOutlined />}
                  styles={{ content: { color: "#1890ff" } }}
                  formatter={(value) => `₱${Number(value).toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Card variant="borderless">
                <Statistic
                  title="Total Deductions"
                  value={summary.total_deductions}
                  prefix={<WalletOutlined />}
                  styles={{ content: { color: "#ff4d4f" } }}
                  formatter={(value) => `₱${Number(value).toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Card variant="borderless">
                <Statistic
                  title="Total Net Pay"
                  value={summary.total_net_pay}
                  prefix={<WalletOutlined />}
                  styles={{ content: { color: "#52c41a" } }}
                  formatter={(value) => `₱${Number(value).toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Card variant="borderless">
                <Statistic
                  title="Total Hours"
                  value={summary.total_hours}
                  prefix={<ClockCircleOutlined />}
                  styles={{ content: { color: "#722ed1" } }}
                  suffix="hrs"
                  formatter={(value) => value !== null && value !== undefined ? Number(value).toFixed(1) : "0"}
                />
              </Card>
            </Col>
          </>
        )}

        {/* Payroll Table */}
        <Col span={24}>
          <Card variant="borderless" title="Payroll Details">
            <Table
              columns={columns}
              dataSource={payrollData}
              rowKey="user_id"
              loading={loading}
              pagination={pagination}
              onChange={handleTableChange}
              scroll={{ x: true }}
            />
          </Card>
        </Col>
      </Row>

      {/* Detail Modal */}
      <Modal
        title="Payroll Details"
        open={detailModalVisible}
        onCancel={() => setDetailModalVisible(false)}
        footer={null}
        width={600}
      >
        {selectedPayroll && (
          <Descriptions bordered column={1}>
            <Descriptions.Item label="Staff">{selectedPayroll.staff_name}</Descriptions.Item>
            <Descriptions.Item label="Position">{selectedPayroll.position}</Descriptions.Item>
            <Descriptions.Item label="Hours Worked">{selectedPayroll.hours_worked !== null && selectedPayroll.hours_worked !== undefined ? `${selectedPayroll.hours_worked.toFixed(1)} hrs` : "-"}</Descriptions.Item>
            <Descriptions.Item label="Hourly Rate">{selectedPayroll.hourly_rate !== null && selectedPayroll.hourly_rate !== undefined ? `₱${Number(selectedPayroll.hourly_rate).toFixed(2)}` : "-"}</Descriptions.Item>
            <Descriptions.Item label="Gross Pay">₱{Number(selectedPayroll.gross_pay).toLocaleString(undefined, { minimumFractionDigits: 2 })}</Descriptions.Item>
            <Descriptions.Item label="SSS Deduction">₱{Number(selectedPayroll.sss_deduction).toLocaleString(undefined, { minimumFractionDigits: 2 })}</Descriptions.Item>
            <Descriptions.Item label="PhilHealth Deduction">₱{Number(selectedPayroll.philhealth_deduction).toLocaleString(undefined, { minimumFractionDigits: 2 })}</Descriptions.Item>
            <Descriptions.Item label="Pag-IBIG Deduction">₱{Number(selectedPayroll.pagibig_deduction).toLocaleString(undefined, { minimumFractionDigits: 2 })}</Descriptions.Item>
            <Descriptions.Item label="Tax Deduction">₱{Number(selectedPayroll.tax_deduction).toLocaleString(undefined, { minimumFractionDigits: 2 })}</Descriptions.Item>
            <Descriptions.Item label="Total Deductions">₱{Number(selectedPayroll.total_deductions).toLocaleString(undefined, { minimumFractionDigits: 2 })}</Descriptions.Item>
            <Descriptions.Item label="Net Pay">
              <Text strong style={{ color: "#52c41a", fontSize: 18 }}>
                ₱{Number(selectedPayroll.net_pay).toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </Text>
            </Descriptions.Item>
          </Descriptions>
        )}
      </Modal>
    </div>
  );
};

export default PayrollReport;
