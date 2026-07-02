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
  Modal,
  Descriptions,
  Alert,
} from "antd";
import {
  DollarOutlined,
  ClockCircleOutlined,
  CalculatorOutlined,
  DownloadOutlined,
  FileTextOutlined,
  WalletOutlined,
  ExclamationCircleOutlined,
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
  const [pagination, setPagination] = useState({ 
    current: 1, 
    pageSize: 15, 
    total: 0 
  });
  const [selectedStaff, setSelectedStaff] = useState(null);
  const [dateRange, setDateRange] = useState([
    dayjs().startOf("month"), 
    dayjs().endOf("month")
  ]);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [selectedPayroll, setSelectedPayroll] = useState(null);
  const [hasErrors, setHasErrors] = useState(false);

  const fetchPayrollReport = async (page = 1) => {
    setLoading(true);
    setHasErrors(false);
    try {
      // ✅ Fix: Don't include selectedStaff in params if not needed yet
      const params = {
        month: dateRange[0].format("YYYY-MM"),
        page: page,
        per_page: pagination.pageSize,
      };

      // ✅ Add branch filter if needed (you might need to add branch_id filter)
      if (selectedStaff) {
        // If you have staff filtering, you might need to filter by staff_id
        // params.staff_id = selectedStaff;
      }

      const [payrollRes, staffRes] = await Promise.all([
        api.get("/reports/payroll", { params }),
        api.get("/staff"),
      ]);

      setStaffList(Array.isArray(staffRes.data) ? staffRes.data : []);
      const data = payrollRes.data || {};
      
      // ✅ Process and validate data
      const processedData = (data.data || []).map(record => ({
        ...record,
        gross_pay: Number(record.gross_pay) || 0,
        total_deductions: Number(record.total_deductions) || 0,
        net_pay: Number(record.net_pay) || 0,
        total_hours: Number(record.total_hours) || 0,
        hourly_rate: Number(record.hourly_rate) || 0,
        sss_deduction: Number(record.sss_deduction) || 0,
        philhealth_deduction: Number(record.philhealth_deduction) || 0,
        pagibig_deduction: Number(record.pagibig_deduction) || 0,
        tax_deduction: Number(record.tax_deduction) || 0,
        late_deduction: Number(record.late_deduction) || 0,
        cash_advance_deduction: Number(record.cash_advance_deduction) || 0,
        incentives: Number(record.incentives) || 0,
      }));

      // ✅ Check for data errors
      const errorRecords = processedData.filter(record => 
        record.net_pay < 0 || 
        record.total_deductions > record.gross_pay
      );
      
      if (errorRecords.length > 0) {
        setHasErrors(true);
        console.warn("[Payroll] Found negative net pay or invalid deductions:", errorRecords);
      }

      setPayrollData(processedData);
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
      
      // ✅ Show more detailed error
      if (err.response) {
        console.error("Response data:", err.response.data);
        console.error("Response status:", err.response.status);
        console.error("Response headers:", err.response.headers);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPayrollReport(1);
  }, [dateRange]); // ✅ Only re-fetch when date range changes

  // ✅ Add separate handler for staff filter
  const handleStaffChange = (value) => {
    setSelectedStaff(value);
    // If you implement staff filtering on backend, uncomment:
    // fetchPayrollReport(1);
  };

  const handleTableChange = (newPagination) => {
    fetchPayrollReport(newPagination.current);
  };

  const handleExport = () => {
    if (payrollData.length === 0) {
      return;
    }

    const headers = [
      "Staff", 
      "Position", 
      "Days Worked",
      "Hours Worked", 
      "Hourly Rate", 
      "Gross Pay", 
      "SSS", 
      "PhilHealth", 
      "Pag-IBIG", 
      "Cash Advance",
      "Late Deduction",
      "Tax", 
      "Incentives",
      "Total Deductions", 
      "Net Pay"
    ];

    const rows = payrollData.map(row => [
      row.staff_name || "Unknown",
      row.position || "N/A",
      row.days_worked || 0,
      (row.total_hours || 0).toFixed(1),
      (row.hourly_rate || 0).toFixed(2),
      (row.gross_pay || 0).toFixed(2),
      (row.sss_deduction || 0).toFixed(2),
      (row.philhealth_deduction || 0).toFixed(2),
      (row.pagibig_deduction || 0).toFixed(2),
      (row.cash_advance_deduction || 0).toFixed(2),
      (row.late_deduction || 0).toFixed(2),
      (row.tax_deduction || 0).toFixed(2),
      (row.incentives || 0).toFixed(2),
      (row.total_deductions || 0).toFixed(2),
      (row.net_pay || 0).toFixed(2),
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `payroll_report_${dayjs().format("YYYY-MM-DD")}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
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
      sorter: (a, b) => (a.staff_name || "").localeCompare(b.staff_name || ""),
      render: (name, record) => (
        <div>
          <Text strong>{name || "Unknown"}</Text>
          <br />
          <Text type="secondary" style={{ fontSize: 12 }}>{record.position || "N/A"}</Text>
        </div>
      ),
    },
    {
      title: "Days Worked",
      dataIndex: "days_worked",
      key: "days_worked",
      sorter: (a, b) => (a.days_worked || 0) - (b.days_worked || 0),
      render: (days) => days || 0,
    },
    {
      title: "Hours Worked",
      dataIndex: "total_hours",
      key: "total_hours",
      sorter: (a, b) => (a.total_hours || 0) - (b.total_hours || 0),
      render: (hours) => {
        const numHours = Number(hours) || 0;
        return `${numHours.toFixed(1)} hrs`;
      },
    },
    {
      title: "Hourly Rate",
      dataIndex: "hourly_rate",
      key: "hourly_rate",
      render: (rate) => {
        const numRate = Number(rate) || 0;
        return numRate > 0 ? `₱${numRate.toFixed(2)}` : "-";
      },
    },
    {
      title: "Gross Pay",
      dataIndex: "gross_pay",
      key: "gross_pay",
      sorter: (a, b) => (a.gross_pay || 0) - (b.gross_pay || 0),
      render: (amount) => {
        const numAmount = Number(amount) || 0;
        return (
          <Text strong style={{ color: "#1890ff" }}>
            ₱{numAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </Text>
        );
      },
    },
    {
      title: "Deductions",
      dataIndex: "total_deductions",
      key: "total_deductions",
      sorter: (a, b) => (a.total_deductions || 0) - (b.total_deductions || 0),
      render: (amount, record) => {
        const numAmount = Number(amount) || 0;
        const isError = numAmount > (record.gross_pay || 0);
        return (
          <Tag color={isError ? "red" : "orange"}>
            -₱{numAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            {isError && <ExclamationCircleOutlined style={{ marginLeft: 4 }} />}
          </Tag>
        );
      },
    },
    {
      title: "Net Pay",
      dataIndex: "net_pay",
      key: "net_pay",
      sorter: (a, b) => (a.net_pay || 0) - (b.net_pay || 0),
      render: (amount) => {
        const numAmount = Number(amount) || 0;
        let color = "#52c41a";
        let prefix = "";
        if (numAmount < 0) {
          color = "#ff4d4f";
          prefix = "-";
        } else if (numAmount === 0) {
          color = "#8c8c8c";
        }
        return (
          <Text strong style={{ color, fontSize: 16 }}>
            {prefix}₱{Math.abs(numAmount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </Text>
        );
      },
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
                  <Button 
                    icon={<DownloadOutlined />} 
                    onClick={handleExport}
                    disabled={payrollData.length === 0}
                  >
                    Export CSV
                  </Button>
                  <Button 
                    type="primary" 
                    icon={<FileTextOutlined />} 
                    onClick={() => fetchPayrollReport(1)} 
                    loading={loading}
                  >
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
                onChange={handleStaffChange}
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

        {/* Error Alert */}
        {hasErrors && (
          <Col span={24}>
            <Alert
              message="Data Validation Warning"
              description="Some payroll records have negative net pay or deductions exceeding gross pay. Please check your payroll calculation logic."
              type="warning"
              showIcon
              closable
            />
          </Col>
        )}

        {/* Summary Stats */}
        {summary && (
          <>
            <Col xs={24} sm={12} md={6}>
              <Card variant="borderless">
                <Statistic
                  title="Total Gross Pay"
                  value={summary.total_gross_pay || 0}
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
                  value={summary.total_deductions || 0}
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
                  value={summary.total_net_pay || 0}
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
                  value={summary.total_hours || 0}
                  prefix={<ClockCircleOutlined />}
                  styles={{ content: { color: "#722ed1" } }}
                  suffix="hrs"
                  formatter={(value) => Number(value).toFixed(1)}
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
            <Descriptions.Item label="Staff">{selectedPayroll.staff_name || "Unknown"}</Descriptions.Item>
            <Descriptions.Item label="Position">{selectedPayroll.position || "N/A"}</Descriptions.Item>
            <Descriptions.Item label="Days Worked">{selectedPayroll.days_worked || 0}</Descriptions.Item>
            <Descriptions.Item label="Hours Worked">
              {Number(selectedPayroll.total_hours || 0).toFixed(1)} hrs
            </Descriptions.Item>
            <Descriptions.Item label="Hourly Rate">
              {selectedPayroll.hourly_rate ? `₱${Number(selectedPayroll.hourly_rate).toFixed(2)}` : "-"}
            </Descriptions.Item>
            <Descriptions.Item label="Gross Pay">
              ₱{Number(selectedPayroll.gross_pay).toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </Descriptions.Item>
            <Descriptions.Item label="SSS Deduction">
              ₱{Number(selectedPayroll.sss_deduction || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </Descriptions.Item>
            <Descriptions.Item label="PhilHealth Deduction">
              ₱{Number(selectedPayroll.philhealth_deduction || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </Descriptions.Item>
            <Descriptions.Item label="Pag-IBIG Deduction">
              ₱{Number(selectedPayroll.pagibig_deduction || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </Descriptions.Item>
            <Descriptions.Item label="Cash Advance">
              ₱{Number(selectedPayroll.cash_advance_deduction || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </Descriptions.Item>
            <Descriptions.Item label="Late Deduction">
              ₱{Number(selectedPayroll.late_deduction || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </Descriptions.Item>
            <Descriptions.Item label="Tax Deduction">
              ₱{Number(selectedPayroll.tax_deduction || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </Descriptions.Item>
            <Descriptions.Item label="Incentives">
              ₱{Number(selectedPayroll.incentives || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </Descriptions.Item>
            <Descriptions.Item label="Total Deductions">
              ₱{Number(selectedPayroll.total_deductions).toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </Descriptions.Item>
            <Descriptions.Item label="Net Pay">
              <Text strong style={{ color: selectedPayroll.net_pay < 0 ? "#ff4d4f" : "#52c41a", fontSize: 18 }}>
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