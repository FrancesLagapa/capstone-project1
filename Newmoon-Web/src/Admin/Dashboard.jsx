import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { 
  PlusOutlined, 
  ShopOutlined,
  StockOutlined,
  ProductOutlined,
  TeamOutlined, 
  EyeOutlined,
  ReloadOutlined
} from "@ant-design/icons";
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPesoSign } from '@fortawesome/free-solid-svg-icons';
import { api } from "../config/api";
import { getCache, setCache, invalidateCache } from "../utils/cache";

function Dashboard() {
  const navigate = useNavigate();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [branches, setBranches] = useState([]);
  const [products, setProducts] = useState([]);
  const [staff, setStaff] = useState([]);
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [formName, setFormName] = useState("");
  const [formCode, setFormCode] = useState("");
  const [formAddress, setFormAddress] = useState("");
  const [loadError, setLoadError] = useState("");

  // Update current time
  useEffect(() => {
    const updatePHTime = () => {
      const now = new Date();
      const utc = now.getTime() + now.getTimezoneOffset() * 60000;
      const phTime = new Date(utc + 8 * 60 * 60 * 1000);
      setCurrentTime(phTime);
    };

    updatePHTime();
    const timer = setInterval(updatePHTime, 1000);
    return () => clearInterval(timer);
  }, []);

  const loadDashboardData = useCallback(async (forceRefresh = false) => {
    setLoading(true);
    setLoadError("");
    
    try {
      // Try to get data from cache first
      const cachedBranches = forceRefresh ? null : getCache('branches');
      const cachedStaff = forceRefresh ? null : getCache('staff');
      const cachedSales = forceRefresh ? null : getCache('sales');
      const cachedProducts = forceRefresh ? null : getCache('products');

      // If all data is cached and valid, use it
      if (cachedBranches && cachedStaff && cachedSales && cachedProducts) {
        setBranches(cachedBranches);
        setStaff(cachedStaff);
        setSales(cachedSales);
        setProducts(cachedProducts);
        setLoading(false);
        return;
      }

      // Otherwise, fetch from backend
      const results = await Promise.allSettled([
        cachedBranches ? Promise.resolve({ data: cachedBranches }) : api.get("/branches"),
        cachedStaff ? Promise.resolve({ data: cachedStaff }) : api.get("/staff"),
        cachedSales ? Promise.resolve({ data: cachedSales }) : api.get("/sales"),
        cachedProducts ? Promise.resolve({ data: cachedProducts }) : api.get("/products"),
      ]);

      const labels = ["GET /branches", "GET /staff", "GET /sales", "GET /products"];
      const rejectedIdx = results.findIndex((r) => r.status === "rejected");
      if (rejectedIdx !== -1) {
        const reason = results[rejectedIdx].reason;
        const status = reason?.response?.status;
        const backendMessage =
          reason?.response?.data?.message ||
          reason?.response?.data?.error ||
          reason?.message;

        if (status === 401 || status === 419) {
          localStorage.removeItem("token");
          localStorage.removeItem("user");
          localStorage.removeItem("role");
          localStorage.removeItem("isLoggedIn");
          navigate("/");
          return;
        }

        throw new Error(
          `${labels[rejectedIdx]} failed` +
            (status ? ` (HTTP ${status})` : "") +
            (backendMessage ? `: ${backendMessage}` : "")
        );
      }

      const branchesRes = results[0].value;
      const staffRes = results[1].value;
      const salesRes = results[2].value;
      const productsRes = results[3].value;

      // Map staff with a convenient branch_id fallback (do not rely on this for counting)
      const staffRows = (staffRes.data?.data || []).map((s) => {
        const assignments = Array.isArray(s.branchAssignments)
          ? s.branchAssignments
          : Array.isArray(s.branch_assignments)
            ? s.branch_assignments
            : [];
        const branchId =
          assignments?.[0]?.branch_id || s.branch_id || s.branchId || null;
        return {
          ...s,
          branch_id: branchId,
        };
      });

      const branchesData = branchesRes.data?.data || [];
      const staffData = staffRows;
      const salesData = salesRes.data?.data || [];
      const productsData = productsRes.data?.data || [];

      setBranches(branchesData);
      setStaff(staffData);
      setSales(salesData);
      setProducts(productsData);

      // Cache the fetched data (5 minutes TTL)
      setCache('branches', branchesData);
      setCache('staff', staffData);
      setCache('sales', salesData);
      setCache('products', productsData);
    } catch (err) {
      const msg = err?.message || "Failed to load dashboard data from backend.";
      setLoadError(msg);
      alert(msg);
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  const handleOpen = () => setIsModalOpen(true);
  const handleClose = () => setIsModalOpen(false);

  /** API may send quantity as string; using + with strings concatenates ("93" + "96" → "9396"). */
  const parseQuantity = (value) => {
    if (value === null || value === undefined || value === "") return 0;
    const n = typeof value === "string" ? parseFloat(value.replace(/,/g, "")) : Number(value);
    return Number.isFinite(n) ? n : 0;
  };

  const getBranchProductsCount = (branchId) => {
    const target = String(branchId);
    const total = products.reduce((sum, product) => {
      if (!product.product_stocks) return sum;
      const stock = product.product_stocks.find((s) => String(s.branch_id) === target);
      return sum + parseQuantity(stock?.quantity);
    }, 0);
    return Math.round(total);
  };

  const getBranchProductCount = (branchId) => {
    const target = String(branchId);
    return products.filter((product) => {
      if (!product.product_stocks) return false;
      return product.product_stocks.some((s) => String(s.branch_id) === target);
    }).length;
  };

  const getBranchStaffCount = (branchId) => {
    const target = String(branchId);

    return staff.filter((s) => {
      // Prefer assignments from backend relation (supports multiple assignments)
      const assignments = Array.isArray(s.branchAssignments)
        ? s.branchAssignments
        : Array.isArray(s.branch_assignments)
          ? s.branch_assignments
          : [];
      if (assignments.length > 0) {
        return assignments.some((a) => {
          if (!a) return false;
          if (a.is_active === false) return false;
          return a.branch_id != null && String(a.branch_id) === target;
        });
      }

      // Fallback for older payloads or locally-mapped staff objects
      if (s.branch_id == null || s.branch_id === "") return false;
      return String(s.branch_id) === target;
    }).length;
  };

  const handleSubmit = async () => {
    if (!formName) {
      alert("Branch name is required");
      return;
    }

    if (!formCode) {
      alert("Branch code is required");
      return;
    }

    if (!formAddress) {
      alert("Branch address is required");
      return;
    }

    try {
      const { data } = await api.post("/branches", {
        name: formName,
        code: formCode,
        address: formAddress,
      });
      setBranches((prev) => [...prev, data]);
      setFormName("");
      setFormCode("");
      setFormAddress("");
      setIsModalOpen(false);
      
      // Invalidate cache to reflect the new branch
      invalidateCache('branches');
      
      alert("Branch created successfully!");
    } catch (err) {
      const msg = err?.response?.data?.message || "Failed to create branch";
      alert(msg);
    }
  };

  const totalSales = sales.reduce(
    (sum, sale) => sum + parseFloat(sale.total || 0),
    0
  );

  const formatCurrency = (amount) => {
    return `₱${amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
  };

  const reports = [
    { title: "Total Branches", value: branches.length, icon: <ShopOutlined className="text-xl text-blue-600" />, color: "blue" },
    { title: "Total Staff", value: staff.length, icon: <TeamOutlined className="text-xl text-purple-600" />, color: "purple" },
    { title: "Total Sales", value: formatCurrency(totalSales), icon: <FontAwesomeIcon icon={faPesoSign} className="text-xl text-red-600" />, color: "orange" },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 shadow-sm">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-800">Dashboard Overview</h1>
              <p className="text-gray-500 mt-1">Welcome back! Here's your business at a glance</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-500">Current Philippines Time</p>
              <p className="text-lg font-semibold">
                {currentTime.toLocaleTimeString('en-PH', { hour12: true, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </p>
              <p className="text-xs text-gray-400">
                {currentTime.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6">
        {loadError && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 mb-6">
            {loadError}
          </div>
        )}
        
        {/* Action Buttons */}
        <div className="flex justify-end gap-3 mb-6">
          <button 
            onClick={() => loadDashboardData(true)}
            className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-md text-gray-700 bg-white hover:bg-gray-50 transition-colors"
          >
            <ReloadOutlined />
            Refresh
          </button>
          <button 
            onClick={handleOpen}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-md text-white bg-green-600 hover:bg-green-700 transition-colors"
          >
            <PlusOutlined />
            Add Branch
          </button>
        </div>

        {/* Report Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {reports.map((report, index) => (
            <div
              key={index}
              className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-lg transition-shadow"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide">{report.title}</p>
                  {loading ? (
                    <div className="mt-2">
                      <div className="animate-pulse h-8 w-24 bg-gray-200 rounded"></div>
                    </div>
                  ) : (
                    <p className={`text-2xl font-bold text-${report.color}-600 mt-2`}>
                      {report.value}
                    </p>
                  )}
                </div>
                <div className={`bg-${report.color}-100 rounded-full p-3`}>
                  {report.icon}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Branch Locations Section */}
        <div className="mb-6">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h2 className="text-xl font-semibold text-gray-800">Branch Locations</h2>
              <p className="text-sm text-gray-500 mt-1">Manage and monitor each branch's performance</p>
            </div>
            <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-blue-100 text-blue-800">
              Total: {branches.length} branches
            </span>
          </div>
        </div>

        {/* Branches Grid */}
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
              <p className="text-gray-500 mt-4">Loading branches...</p>
            </div>
          </div>
        ) : branches.length === 0 ? (
          <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
            <ShopOutlined className="text-6xl text-gray-300 mb-4" />
            <p className="text-gray-500 text-lg mb-2">No branches yet</p>
            <p className="text-gray-400">Click the "Add Branch" button to get started</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {branches.map((branch) => (
              <div
                key={branch.id}
                className="bg-white rounded-lg border border-gray-200 overflow-hidden hover:shadow-lg transition-all duration-300 hover:-translate-y-1"
              >
                {/* Branch Header */}
                <div className="bg-gradient-to-r from-blue-500 to-blue-600 px-4 py-6">
                  <div className="flex justify-center">
                    <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center">
                      <ShopOutlined className="text-3xl text-white" />
                    </div>
                  </div>
                </div>

                {/* Branch Body */}
                <div className="p-4">
                  <h3 className="font-bold text-lg text-gray-800 text-center mb-3">
                    {branch.name}
                  </h3>

                  <div className="space-y-2 mb-4">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500 flex items-center gap-2">
                        <StockOutlined className="text-gray-400" />
                        Stock
                      </span>
                      <span className="font-semibold text-gray-800">
                        {getBranchProductsCount(branch.id)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500 flex items-center gap-2">
                        <TeamOutlined className="text-gray-400" />
                        Staff
                      </span>
                      <span className="font-semibold text-gray-800">
                        {getBranchStaffCount(branch.id)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500 flex items-center gap-2">
                        <ProductOutlined className="text-gray-400" />
                        Products
                      </span>
                      <span className="font-semibold text-gray-800">
                        {getBranchProductCount(branch.id)}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => navigate(`/branch/${branch.id}`)}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg transition-all duration-300 font-medium flex items-center justify-center gap-2"
                  >
                    <EyeOutlined />
                    View Sales Report
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Footer */}
        <div className="mt-8 text-center text-xs text-gray-400 border-t border-gray-200 pt-4">
          <p>Generated on {currentTime.toLocaleString()} | New Moon Lechon Manok and Liempo Dashboard</p>
        </div>
      </div>

      {/* Add Branch Modal - Tailwind Version */}
      {isModalOpen && (
  <div className="fixed inset-0 z-50 flex items-center justify-center">
    {/* Backdrop */}
    <div 
      className="absolute inset-0 backdrop-blur-sm animate-fadeIn"
      onClick={handleClose}
    />
    
    {/* Modal */}
    <div className="relative bg-white rounded-lg shadow-xl w-full max-w-md mx-4 animate-fadeInScale">
      {/* Close button with rotate animation */}
      <button
        onClick={handleClose}
        className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-all duration-200 hover:rotate-90 transform"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
      
      {/* Header */}
      <div className="p-6 pr-12">
        <div className="flex items-center gap-2">
          <PlusOutlined className="text-green-600 text-xl" />
          <span className="text-xl font-semibold text-gray-900">Add New Branch</span>
        </div>
      </div>
      
      {/* Body */}
      <div className="px-6 pb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Branch Name
        </label>
        <input
          type="text"
          placeholder="Enter branch name (e.g., 'Downtown Branch')"
          value={formName}
          onChange={(e) => setFormName(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all duration-200"
          autoFocus
        />
        
        <label className="block text-sm font-medium text-gray-700 mb-2 mt-4">
          Branch Code
        </label>
        <input
          type="text"
          placeholder="Enter branch code (e.g., MAIN)"
          value={formCode}
          onChange={(e) => setFormCode(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleSubmit()}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all duration-200"
        />

        <label className="block text-sm font-medium text-gray-700 mb-2 mt-4">
          Branch Address
        </label>
        <textarea
          placeholder="Enter branch address (e.g., 123 Main St, City)"
          value={formAddress}
          onChange={(e) => setFormAddress(e.target.value)}
          rows={2}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all duration-200 resize-none"
        />

        <p className="text-xs text-gray-500 mt-3">
          This information will be visible to all staff members and customers
        </p>
      </div>
      
      {/* Footer */}
      <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-lg">
        <button
          onClick={handleClose}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-all duration-200"
        >
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 transition-all duration-200 transform hover:scale-105 active:scale-95"
        >
          Create Branch
        </button>
      </div>
    </div>
  </div>
)}

    </div>
  );
}

export default Dashboard;