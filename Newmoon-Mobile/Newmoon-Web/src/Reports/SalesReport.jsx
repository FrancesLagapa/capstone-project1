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
  Divider,
  Radio,
} from "antd";
import {
  DollarOutlined,
  ShoppingOutlined,
  RiseOutlined,
  FallOutlined,
  DownloadOutlined,
  FileTextOutlined,
  BarChartOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import { api } from "../config/api";

// ✅ Replace this with your actual auth hook / context
import { useAuth } from "../hooks/useAuth"; // e.g., returns { user, isAdmin }

const { Text, Title } = Typography;
const { RangePicker } = DatePicker;

const SalesReport = () => {
  // ---------- Authentication ----------
  const { user, isAdmin } = useAuth();
  const userBranchId = user?.branch_id || null; // adjust field name as needed

  // ---------- State ----------
  const [loading, setLoading] = useState(false);
  const [salesData, setSalesData] = useState([]);
  const [summary, setSummary] = useState(null);
  const [dateRange, setDateRange] = useState([
    dayjs().startOf("month"),
    dayjs().endOf("month"),
  ]);
  const [groupBy, setGroupBy] = useState("daily");
  const [selectedBranch, setSelectedBranch] = useState(null); // default to all branches
  const [branches, setBranches] = useState([]);
  const [viewMode, setViewMode] = useState('branches'); // 'branches' or 'report'
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 15,
    total: 0,
  });

  // ---------- Fetch report ----------
  const fetchSalesReport = async (page = 1) => {
    setLoading(true);
    try {
      // Build params – always enforce branch for non‑admins
      const params = {
        start_date: dateRange[0].format("YYYY-MM-DD"),
        end_date: dateRange[1].format("YYYY-MM-DD"),
        group_by: groupBy,
        page: page,
        per_page: pagination.pageSize,
      };

      if (selectedBranch) {
        // If a branch is selected, filter by that branch
        params.branch_id = selectedBranch;
      }
      // If selectedBranch is null, omit branch_id → get all branches

      const [salesRes, branchesRes] = await Promise.all([
        api.get("/reports/sales", { params }),
        api.get("/branches"),
      ]);

      // Set branches list (for the selector)
      setBranches(
        Array.isArray(branchesRes.data)
          ? branchesRes.data
          : branchesRes.data?.data || []
      );

      const data = salesRes.data || {};
      setSalesData(data.data || []);

      // Build summary
      let summaryData = data.summary || {};
      if (groupBy !== "detail" && summaryData.total_sales !== undefined) {
        const totalTransactions = summaryData.total_transactions || 0;
        const totalSales = summaryData.total_sales || 0;
        summaryData = {
          total_revenue: totalSales,
          total_transactions: totalTransactions,
          avg_transaction:
            totalTransactions > 0 ? totalSales / totalTransactions : 0,
          growth: null,
        };
      } else if (groupBy === "detail") {
        const totalSales = data.summary?.total_sales || 0;
        const totalTransactions = data.summary?.total_transactions || 0;
        summaryData = {
          total_revenue: totalSales,
          total_transactions: totalTransactions,
          avg_transaction:
            totalTransactions > 0 ? totalSales / totalTransactions : 0,
          growth: null,
        };
      } else {
        summaryData = {
          total_revenue: 0,
          total_transactions: 0,
          avg_transaction: 0,
          growth: null,
        };
      }
      setSummary(summaryData);

      // Pagination
      if (data.pagination) {
        setPagination({
          current: data.pagination.current_page,
          pageSize: data.pagination.per_page,
          total: data.pagination.total,
        });
      } else {
        setPagination({
          current: 1,
          pageSize: 15,
          total: data.data?.length || 0,
        });
      }
    } catch (err) {
      console.error("[SalesReport] Error:", err);
    } finally {
      setLoading(false);
    }
  };

  // ---------- Fetch branches on mount ----------
  useEffect(() => {
    const fetchBranches = async () => {
      try {
        const branchesRes = await api.get("/branches");
        setBranches(
          Array.isArray(branchesRes.data)
            ? branchesRes.data
            : branchesRes.data?.data || []
        );
      } catch (err) {
        console.error("[SalesReport] Error fetching branches:", err);
      }
    };
    fetchBranches();
  }, []);

  // ---------- Auto‑fetch when filters change (only in report mode) ----------
  useEffect(() => {
    if (viewMode === 'report' && selectedBranch) {
      fetchSalesReport(1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateRange, groupBy, selectedBranch, viewMode]);

  // ---------- Table pagination handler ----------
  const handleTableChange = (pagination) => {
    fetchSalesReport(pagination.current);
  };

  // ---------- Handle branch selection ----------
  const handleSelectBranch = (branch) => {
    setSelectedBranch(branch.id);
    setViewMode('report');
  };

  // ---------- Handle back to branches view ----------
  const handleBackToBranches = () => {
    setViewMode('branches');
    setSelectedBranch(null);
    setSalesData([]);
    setSummary(null);
  };

  // ---------- Export CSV ----------
  const handleExport = () => {
    if (groupBy === "detail") {
      const csvContent = [
        ["Date", "Invoice", "Customer", "Items", "Total", "Payment Method", "Branch"],
        ...salesData.map((row) => [
          dayjs(row.created_at).format("YYYY-MM-DD HH:mm"),
          row.invoice_number,
          row.customer_name,
          row.items_count,
          row.total,
          row.payment_method,
          row.branch_name,
        ]),
      ]
        .map((e) => e.join(","))
        .join("\n");

      const blob = new Blob([csvContent], { type: "text/csv" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `sales_report_${dayjs().format("YYYY-MM-DD")}.csv`;
      a.click();
    } else {
      const csvContent = [
        ["Period", "Transactions", "Total Sales", "Items Sold"],
        ...salesData.map((row) => [
          row.period,
          row.transaction_count,
          row.total_sales,
          row.total_items,
        ]),
      ]
        .map((e) => e.join(","))
        .join("\n");

      const blob = new Blob([csvContent], { type: "text/csv" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `sales_report_${dayjs().format("YYYY-MM-DD")}.csv`;
      a.click();
    }
  };

  // ---------- Table columns ----------
  const groupedColumns = [
    {
      title: "Period",
      dataIndex: "period",
      key: "period",
      render: (period) => <Text strong>{period}</Text>,
    },
    {
      title: "Transactions",
      dataIndex: "transaction_count",
      key: "transaction_count",
      align: "center",
    },
    {
      title: "Total Sales",
      dataIndex: "total_sales",
      key: "total_sales",
      render: (total) => (
        <Text strong style={{ color: "#52c41a" }}>
          ₱{Number(total).toLocaleString(undefined, {
            minimumFractionDigits: 2,
          })}
        </Text>
      ),
    },
    {
      title: "Items Sold",
      dataIndex: "total_items",
      key: "total_items",
      align: "center",
    },
    {
      title: "Avg / Transaction",
      key: "avg_transaction",
      render: (_, record) => {
        const avg =
          record.transaction_count > 0
            ? record.total_sales / record.transaction_count
            : 0;
        return `₱${avg.toFixed(2)}`;
      },
    },
  ];

  const detailColumns = [
    {
      title: "Date",
      dataIndex: "created_at",
      key: "created_at",
      sorter: (a, b) => dayjs(a.created_at).unix() - dayjs(b.created_at).unix(),
      render: (date) => dayjs(date).format("MMM DD, YYYY HH:mm"),
    },
    {
      title: "Invoice",
      dataIndex: "invoice_number",
      key: "invoice_number",
      render: (invoice) => <Text strong>{invoice}</Text>,
    },
    {
      title: "Customer",
      dataIndex: "customer_name",
      key: "customer_name",
    },
    {
      title: "Items",
      dataIndex: "items_count",
      key: "items_count",
      align: "center",
    },
    {
      title: "Total",
      dataIndex: "total",
      key: "total",
      sorter: (a, b) => a.total - b.total,
      render: (total) => (
        <Text strong style={{ color: "#52c41a" }}>
          ₱{Number(total).toLocaleString(undefined, {
            minimumFractionDigits: 2,
          })}
        </Text>
      ),
    },
    {
      title: "Payment",
      dataIndex: "payment_method",
      key: "payment_method",
      render: (method) => <Tag color="blue">{method}</Tag>,
    },
    {
      title: "Branch",
      dataIndex: "branch_name",
      key: "branch_name",
    },
  ];

  // ---------- Render ----------
  return (
    <div className="p-4 bg-gray-50 min-h-screen">
      <Row gutter={[16, 16]}>
        {/* Header */}
        <Col span={24}>
          <Card variant="borderless">
            <Row justify="space-between" align="middle">
              <Col>
                <Title level={4} style={{ margin: 0 }}>
                  <BarChartOutlined className="mr-2 text-blue-500" />
                  Sales Report
                </Title>
                <Text type="secondary">
                  {viewMode === 'branches' ? 'Select a branch to view sales report' : 'Detailed sales analysis and trends'}
                </Text>
              </Col>
              <Col>
                <Space>
                  {viewMode === 'report' && (
                    <Button onClick={handleBackToBranches}>
                      Back to Branches
                    </Button>
                  )}
                  <Button icon={<DownloadOutlined />} onClick={handleExport} disabled={viewMode !== 'report'}>
                    Export CSV
                  </Button>
                  <Button
                    type="primary"
                    icon={<FileTextOutlined />}
                    onClick={fetchSalesReport}
                    loading={loading}
                    disabled={viewMode !== 'report'}
                  >
                    Generate Report
                  </Button>
                </Space>
              </Col>
            </Row>
          </Card>
        </Col>

        {/* Branches View */}
        {viewMode === 'branches' && (
          <Col span={24}>
            <Card variant="borderless" title="All Branches">
              <Row gutter={[16, 16]}>
                {branches.map((branch) => (
                  <Col xs={24} sm={12} md={8} lg={6} key={branch.id}>
                    <Card
                      hoverable
                      style={{ height: '100%' }}
                      actions={[
                        <Button
                          type="primary"
                          icon={<FileTextOutlined />}
                          onClick={() => handleSelectBranch(branch)}
                        >
                          View Sales Report
                        </Button>
                      ]}
                    >
                      <Card.Meta
                        title={branch.name}
                        description={
                          <div>
                            <Text type="secondary">ID: {branch.id}</Text>
                          </div>
                        }
                      />
                    </Card>
                  </Col>
                ))}
              </Row>
            </Card>
          </Col>
        )}

        {/* Report View */}
        {viewMode === 'report' && (
          <>
            {/* Filters */}
            <Col span={24}>
              <Card variant="borderless" size="small">
                <Space wrap>
                  <Text strong>Date Range:</Text>
                  <RangePicker
                    value={dateRange}
                    onChange={setDateRange}
                    format="YYYY-MM-DD"
                    allowClear={false}
                  />
                  <Divider orientation="vertical" />
                  <Text strong>Group By:</Text>
                  <Radio.Group
                    value={groupBy}
                    onChange={(e) => setGroupBy(e.target.value)}
                  >
                    <Radio.Button value="daily">Daily</Radio.Button>
                    <Radio.Button value="weekly">Weekly</Radio.Button>
                    <Radio.Button value="monthly">Monthly</Radio.Button>
                    <Radio.Button value="detail">Detail</Radio.Button>
                  </Radio.Group>
                  <Divider orientation="vertical" />
                  <Text strong>Branch:</Text>
                  <Text strong>
                    {branches.find((b) => b.id === selectedBranch)?.name || 'Selected Branch'}
                  </Text>
                </Space>
              </Card>
            </Col>

        {/* Summary Stats */}
        {summary && (
          <>
            <Col xs={24} sm={12} md={6}>
              <Card variant="borderless">
                <Statistic
                  title="Total Revenue"
                  value={summary.total_revenue || 0}
                  prefix={<DollarOutlined />}
                  styles={{ content: { color: "#52c41a" } }}
                  formatter={(value) =>
                    `₱${Number(value).toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                    })}`
                  }
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Card variant="borderless">
                <Statistic
                  title="Total Transactions"
                  value={summary.total_transactions || 0}
                  prefix={<ShoppingOutlined />}
                  styles={{ content: { color: "#1890ff" } }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Card variant="borderless">
                <Statistic
                  title="Avg Transaction"
                  value={summary.avg_transaction || 0}
                  prefix={<DollarOutlined />}
                  styles={{ content: { color: "#722ed1" } }}
                  formatter={(value) => `₱${Number(value).toFixed(2)}`}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Card variant="borderless">
                <Statistic
                  title="Growth (vs previous)"
                  value={summary.growth !== null ? summary.growth : "N/A"}
                  prefix={
                    summary.growth !== null && summary.growth >= 0 ? (
                      <RiseOutlined />
                    ) : (
                      <FallOutlined />
                    )
                  }
                  styles={{
                    content: {
                      color:
                        summary.growth !== null && summary.growth >= 0
                          ? "#52c41a"
                          : "#ff4d4f",
                    },
                  }}
                  suffix={summary.growth !== null ? "%" : ""}
                />
              </Card>
            </Col>
          </>
        )}

        {/* Data Table */}
        <Col span={24}>
          <Card
            variant="borderless"
            title={
              groupBy === "detail"
                ? "Transaction Details"
                : `Sales by ${groupBy}`
            }
          >
            {groupBy === "detail" ? (
              <Table
                columns={detailColumns}
                dataSource={salesData}
                rowKey="id"
                loading={loading}
                pagination={pagination}
                onChange={handleTableChange}
                scroll={{ x: true }}
              />
            ) : (
              <Table
                columns={groupedColumns}
                dataSource={salesData}
                rowKey="period"
                loading={loading}
                pagination={false}
                scroll={{ x: true }}
              />
            )}
          </Card>
        </Col>
          </>
        )}
      </Row>
    </div>
  );
};

export default SalesReport;