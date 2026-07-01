import React, { useState, useEffect } from "react";
import {
  PlusOutlined,
  ShoppingOutlined,
  DeleteOutlined,
  BoxPlotOutlined,
  BranchesOutlined,
  SearchOutlined,
  ReloadOutlined
} from "@ant-design/icons";
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPesoSign } from '@fortawesome/free-solid-svg-icons';
import { api } from "../config/api";
import { getCache, setCache, invalidateCache } from "../utils/cache";

/**
 * Format a backend datetime string literally — no timezone conversion.
 */
function formatRestockedAtUtcClock(value) {
  if (value == null || value === "") return null;
  const s = String(value).trim();

  const match = s.match(/^(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2})(?::(\d{2}))?/);
  if (!match) {
    console.warn("[ProductList] invalid restocked_at", value);
    return null;
  }

  const [, year, month, day, hh, mm, ss = "00"] = match;
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const monthName = monthNames[parseInt(month, 10) - 1] || month;

  const hour24 = parseInt(hh, 10);
  const ampm = hour24 >= 12 ? "PM" : "AM";
  const hour12 = ((hour24 + 11) % 12) + 1;

  return `${monthName} ${parseInt(day, 10)}, ${year}, ${String(hour12).padStart(2, "0")}:${mm}:${ss} ${ampm}`;
}

function ProductList() {
  const [products, setProducts] = useState([]);
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isRestockModalVisible, setIsRestockModalVisible] = useState(false);
  const [isCreateModalVisible, setIsCreateModalVisible] = useState(false);
  const [isDeleteModalVisible, setIsDeleteModalVisible] = useState(false);
  const [isStatusModalVisible, setIsStatusModalVisible] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [selectedBranch, setSelectedBranch] = useState(null);
  const [stockQuantity, setStockQuantity] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [currentTime, setCurrentTime] = useState(new Date());
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [statusTarget, setStatusTarget] = useState(null);
  const [statusAction, setStatusAction] = useState(null);
  const [createForm, setCreateForm] = useState({
    name: "",
    price: "",
    branches: []
  });

  const loadData = async (forceRefresh = false) => {
    setLoading(true);
    try {
      const cachedProducts = forceRefresh ? null : getCache('products');
      const cachedBranches = forceRefresh ? null : getCache('branches');

      if (cachedProducts && cachedBranches) {
        setProducts(cachedProducts);
        setBranches(cachedBranches);
        setLoading(false);
        return;
      }

      const [productsRes, branchesRes] = await Promise.all([
        cachedProducts ? Promise.resolve({ data: cachedProducts }) : api.get("/products", { params: { include_inactive: true } }),
        cachedBranches ? Promise.resolve({ data: cachedBranches }) : api.get("/branches"),
      ]);

      const productsData = productsRes.data.data || [];
      const branchesData = branchesRes.data.data || [];

      setProducts(productsData);
      setBranches(branchesData);

      setCache('products', productsData);
      setCache('branches', branchesData);
    } catch (error) {
      console.error("Failed to load products:", error);
      alert("Failed to load products from backend.");
      setProducts([]);
      setBranches([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

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

  const handleCreateProduct = async () => {
    if (!createForm.name) {
      alert("Please enter product name");
      return;
    }
    if (!createForm.price || createForm.price <= 0) {
      alert("Please enter a valid product price");
      return;
    }
    if (!createForm.branches || createForm.branches.length === 0) {
      alert("Please select at least one branch");
      return;
    }

    try {
      const { data } = await api.post("/products", createForm);
      setProducts([data, ...products]);
      invalidateCache('products');
      alert(`${createForm.name} has been created successfully.`);
      setIsCreateModalVisible(false);
      setCreateForm({ name: "", price: "", branches: [] });
    } catch (error) {
      alert(error?.response?.data?.message || "Failed to create product");
    }
  };

  const handleRestock = async () => {
    if (!selectedProduct || !selectedBranch || !stockQuantity) {
      alert("Please fill in all fields");
      return;
    }

    const quantity = parseInt(stockQuantity, 10);
    if (isNaN(quantity) || quantity <= 0) {
      alert("Please enter a valid stock quantity");
      return;
    }

    try {
      await api.post(`/products/${selectedProduct.id}/restock`, {
        branch_id: selectedBranch,
        quantity,
      });
      alert(`Added ${quantity} units to ${selectedProduct.name}`);
      setIsRestockModalVisible(false);
      setSelectedProduct(null);
      setSelectedBranch(null);
      setStockQuantity("");
      invalidateCache('products');
      loadData();
    } catch (error) {
      alert("Failed to restock product");
    }
  };

  const handleDeleteProduct = () => {
    if (!deleteTarget) return;

    api.delete(`/products/${deleteTarget.id}`)
      .then(() => {
        setProducts(products.filter(p => p.id !== deleteTarget.id));
        invalidateCache('products');
        alert(`${deleteTarget.name} has been deleted`);
        setIsDeleteModalVisible(false);
        setDeleteTarget(null);
      })
      .catch((error) => {
        console.error("[PRODUCT] delete failed", error?.response?.data ?? error?.message ?? error);
        alert(error?.response?.data?.message || "Failed to delete product");
      });
  };

  const isProductActive = (value) => value === true || value === 1 || value === "1";

  const toggleProductActive = () => {
    if (!statusTarget) return;
    const nextActive = !isProductActive(statusTarget?.is_active);

    api.put(`/products/${statusTarget.id}`, { is_active: nextActive })
      .then(() => {
        invalidateCache("products");
        loadData(true);
        alert(nextActive ? "Product enabled." : "Product disabled.");
        setIsStatusModalVisible(false);
        setStatusTarget(null);
        setStatusAction(null);
      })
      .catch((error) => {
        console.error("[PRODUCT] toggle is_active failed", error?.response?.data ?? error?.message ?? error);
        alert(error?.response?.data?.message || "Failed to update product status");
      });
  };

  const getTotalStock = (product) => {
    if (!product.product_stocks) return 0;
    return product.product_stocks.reduce((sum, stock) => sum + (stock.received ? stock.quantity : 0), 0);
  };

  const filteredProducts = products.filter(product =>
    product.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getBranchProductStocks = () => {
    const branchMap = new Map();

    branches.forEach(branch => {
      branchMap.set(branch.id, {
        branch,
        stocks: []
      });
    });

    filteredProducts.forEach(product => {
      const perBranch = new Map();

      (product.product_stocks || []).forEach(stock => {
        if (!branchMap.has(stock.branch_id)) return;
        const key = `${stock.branch_id}:${product.id}`;
        const current = perBranch.get(key) || {
          id: key,
          branch_id: stock.branch_id,
          product,
          receivedQty: 0,
          pendingQty: 0,
          lastRestockedAt: null,
        };

        current.receivedQty = Number(stock.quantity || 0);
        if (stock.restocked_at) current.lastRestockedAt = stock.restocked_at;
        perBranch.set(key, current);
      });

      (product.ongoing_stocks || []).forEach(delivery => {
        if (!branchMap.has(delivery.branch_id)) return;
        const key = `${delivery.branch_id}:${product.id}`;
        const current = perBranch.get(key) || {
          id: key,
          branch_id: delivery.branch_id,
          product,
          receivedQty: 0,
          pendingQty: 0,
          lastRestockedAt: null,
        };

        const qty = Number(delivery.quantity || 0);
        if (!delivery.received_at) current.pendingQty += qty;

        if (delivery.restocked_at) {
          const prevMs = current.lastRestockedAt ? new Date(current.lastRestockedAt).getTime() : NaN;
          const nextMs = new Date(delivery.restocked_at).getTime();
          if (!Number.isNaN(nextMs) && (Number.isNaN(prevMs) || nextMs > prevMs)) {
            current.lastRestockedAt = delivery.restocked_at;
          }
        }

        perBranch.set(key, current);
      });

      perBranch.forEach(row => {
        if (branchMap.has(row.branch_id)) {
          branchMap.get(row.branch_id).stocks.push(row);
        }
      });
    });

    return Array.from(branchMap.values()).filter(bp =>
      searchTerm ? bp.stocks.length > 0 : true
    );
  };

  const branchProductStocks = getBranchProductStocks();

  const totalProducts = products.length;
  const parseProductPrice = (p) => {
    const n = Number(p?.price);
    return Number.isFinite(n) ? n : NaN;
  };
  const totalStockValue = products.reduce((sum, product) => {
    const price = parseProductPrice(product);
    const qty = getTotalStock(product);
    return sum + (Number.isFinite(price) ? qty * price : 0);
  }, 0);
  const validPrices = products.map(parseProductPrice).filter((n) => Number.isFinite(n));
  const avgPrice = validPrices.length > 0 ? validPrices.reduce((a, b) => a + b, 0) / validPrices.length : 0;

  const formatCurrency = (amount) => {
    return `₱${amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
  };

  return (
    <div className="h-screen flex flex-col bg-gray-50 overflow-hidden">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 shadow-sm flex-shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Products Management</h1>
            <p className="text-gray-500 mt-1">Manage your product inventory and stock levels across all branches</p>
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

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        <div className="max-w-7xl mx-auto px-6 py-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide">Total Products</p>
                  <p className="text-2xl font-bold text-gray-800">{totalProducts}</p>
                </div>
                <div className="bg-blue-100 rounded-full p-3">
                  <ShoppingOutlined className="text-xl text-blue-600" />
                </div>
              </div>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide">Total Stock Value</p>
                  <p className="text-2xl font-bold text-green-600">{formatCurrency(totalStockValue)}</p>
                </div>
                <div className="bg-green-100 rounded-full p-3">
                  <FontAwesomeIcon icon={faPesoSign} className="text-xl text-green-600" />
                </div>
              </div>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide">Average Price</p>
                  <p className="text-2xl font-bold text-orange-600">{formatCurrency(avgPrice)}</p>
                </div>
                <div className="bg-orange-100 rounded-full p-3">
                  <BoxPlotOutlined className="text-xl text-orange-600" />
                </div>
              </div>
            </div>
          </div>

          {/* Filters and Create Button */}
          <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
            <div className="flex flex-wrap gap-4 items-center justify-between">
              <div className="flex gap-4 items-center">
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Search Product</label>
                  <div className="flex items-center border border-gray-300 rounded-md px-3 py-1.5">
                    <SearchOutlined className="text-gray-400 text-sm mr-2" />
                    <input
                      type="text"
                      placeholder="Enter product name..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="text-sm outline-none w-48 bg-transparent"
                    />
                  </div>
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => loadData(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-md text-gray-700 bg-white hover:bg-gray-50 transition-colors"
                >
                  <ReloadOutlined />
                  Refresh
                </button>
                <button
                  onClick={() => setIsCreateModalVisible(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-md text-white bg-green-600 hover:bg-green-700 transition-colors"
                >
                  <PlusOutlined />
                  Create New Product
                </button>
              </div>
            </div>
          </div>

          {/* Branch-Based Products Grid */}
          {loading ? (
            <div className="flex justify-center py-20">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                <p className="text-gray-500 mt-4">Loading products...</p>
              </div>
            </div>
          ) : branchProductStocks.length === 0 ? (
            <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
              <ShoppingOutlined className="text-6xl text-gray-300 mb-4" />
              <p className="text-gray-500 text-lg mb-2">No products found</p>
              <p className="text-gray-400">Create your first product to get started</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6">
              {branchProductStocks.map((branchData) => {
                const { branch, stocks } = branchData;
                const totalBranchStock = stocks.reduce((sum, s) => sum + Number(s.receivedQty || 0), 0);
                const hasProducts = stocks.length > 0;

                return (
                  <div key={branch.id} className="bg-white rounded-lg border border-gray-200 overflow-hidden hover:shadow-lg transition-shadow">
                    {/* Branch Header */}
                    <div className="bg-gray-50 border-b border-gray-200 px-6 py-4">
                      <div className="flex justify-between items-start">
                        <div className="flex items-center gap-3">
                          <div className="bg-blue-100 rounded-full p-2">
                            <BranchesOutlined className="text-xl text-blue-600" />
                          </div>
                          <div>
                            <h3 className="text-lg font-semibold text-gray-800">{branch.name}</h3>
                            <p className="text-sm text-gray-500">{branch.address || 'No address set'}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-gray-500 uppercase tracking-wide">Total Stock</p>
                          <p className="text-2xl font-bold text-blue-600">{totalBranchStock}</p>
                          <p className="text-xs text-gray-400">units across {stocks.length} products</p>
                        </div>
                      </div>
                    </div>

                    {/* Branch Products Table */}
                    <div className="p-0">
                      {hasProducts ? (
                        <div className="overflow-x-auto">
                          <table className="w-full">
                            <thead className="bg-gray-50 border-b border-gray-200">
                              <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Product</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Price</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Stock Level</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ongoing</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Received</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Last Restocked</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                              {stocks.map((stock) => {
                                const receivedQty = Number(stock.receivedQty || 0);
                                const pendingQty = Number(stock.pendingQty || 0);
                                const isLowStock = receivedQty < 20;
                                const stockPercentage = Math.min((receivedQty / 100) * 100, 100);

                                return (
                                  <tr key={stock.id} className="hover:bg-gray-50 transition-colors">
                                    <td className="px-6 py-4">
                                      <div>
                                        <p className="font-medium text-gray-800">{stock.product.name}</p>
                                      </div>
                                    </td>
                                    <td className="px-6 py-4">
                                      <span className="text-green-600 font-semibold">
                                        {formatCurrency(stock.product.price)}
                                      </span>
                                    </td>
                                    <td className="px-6 py-4">
                                      <div className="flex items-center gap-3">
                                        <span className={`font-bold ${isLowStock ? 'text-red-600' : 'text-gray-800'}`}>
                                          {receivedQty}
                                        </span>
                                        <span className="text-xs text-gray-500">units</span>
                                      </div>
                                      <div className="w-32 mt-1">
                                        <div className="w-full bg-gray-200 rounded-full h-1.5">
                                          <div
                                            className={`h-1.5 rounded-full ${isLowStock ? 'bg-red-500' : 'bg-green-500'}`}
                                            style={{ width: `${stockPercentage}%` }}
                                          ></div>
                                        </div>
                                      </div>
                                    </td>
                                    <td className="px-6 py-4">
                                      {pendingQty > 0 ? (
                                        <div className="flex items-center gap-2">
                                          <div className="w-2 h-2 rounded-full bg-orange-500"></div>
                                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-800">
                                            {pendingQty} pending
                                          </span>
                                        </div>
                                      ) : (
                                        <span className="text-xs text-gray-400">—</span>
                                      )}
                                    </td>
                                    <td className="px-6 py-4">
                                      {isLowStock ? (
                                        <div className="flex items-center gap-2">
                                          <div className="w-2 h-2 rounded-full bg-red-500"></div>
                                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-800">
                                            Low Stock
                                          </span>
                                        </div>
                                      ) : (
                                        <div className="flex items-center gap-2">
                                          <div className="w-2 h-2 rounded-full bg-green-500"></div>
                                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                                            In Stock
                                          </span>
                                        </div>
                                      )}
                                    </td>
                                    <td className="px-6 py-4">
                                      {pendingQty > 0 ? (
                                        <div className="flex items-center gap-2">
                                          <div className="w-2 h-2 rounded-full bg-gray-400"></div>
                                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600">
                                            With Pending
                                          </span>
                                        </div>
                                      ) : (
                                        <div className="flex items-center gap-2">
                                          <div className="w-2 h-2 rounded-full bg-green-500"></div>
                                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                                            Received
                                          </span>
                                        </div>
                                      )}
                                    </td>
                                    <td className="px-6 py-4">
                                      {stock.lastRestockedAt ? (
                                        <div className="text-xs text-gray-600">
                                          {formatRestockedAtUtcClock(stock.lastRestockedAt)}
                                        </div>
                                      ) : (
                                        <span className="text-xs text-gray-400">Never restocked</span>
                                      )}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                      <div className="flex justify-end gap-1.5">
                                        <button
                                          onClick={() => {
                                            setSelectedProduct(stock.product);
                                            setSelectedBranch(branch.id);
                                            setIsRestockModalVisible(true);
                                          }}
                                          className="inline-flex items-center gap-0.5 px-2 py-0.5 text-xs border border-blue-500 text-blue-600 rounded hover:bg-blue-50 transition-colors"
                                        >
                                          <PlusOutlined className="text-[10px]" />
                                          RESTOCK
                                        </button>

                                        <button
                                          onClick={() => {
                                            setDeleteTarget(stock.product);
                                            setIsDeleteModalVisible(true);
                                          }}
                                          className="inline-flex items-center gap-0.5 px-2 py-0.5 text-xs border border-red-500 text-red-600 rounded hover:bg-red-50 transition-colors"
                                        >
                                          <DeleteOutlined className="text-[10px]" />
                                          DELETE
                                        </button>

                                        <button
                                          onClick={() => {
                                            setStatusTarget(stock.product);
                                            setStatusAction(!isProductActive(stock.product?.is_active));
                                            setIsStatusModalVisible(true);
                                          }}
                                          className={`
        relative inline-flex h-5 w-10 items-center rounded-full 
        transition-colors focus:outline-none
        ${isProductActive(stock.product?.is_active) ? 'bg-green-600' : 'bg-gray-300'}
      `}
                                        >
                                          <span
                                            className={`
          inline-block h-3.5 w-3.5 transform rounded-full bg-white 
          transition-transform
          ${isProductActive(stock.product?.is_active) ? 'translate-x-5' : 'translate-x-0.5'}
        `}
                                          />
                                        </button>
                                      </div>
                                    </td>

                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <div className="text-center py-12 text-gray-400">
                          <BoxPlotOutlined className="text-5xl mb-3" />
                          <p className="text-gray-500 mb-2">No products in this branch</p>
                          <p className="text-sm text-gray-400">Add stock to products to see them here</p>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Footer */}
          <div className="mt-6 text-center text-xs text-gray-400 border-t border-gray-200 pt-4">
            <p>Generated on {currentTime.toLocaleString()} | New Moon Inventory System</p>
          </div>
        </div>
      </div>

      {/* Create Product Modal */}
      {isCreateModalVisible && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 backdrop-blur-sm transition-opacity duration-200"
            onClick={() => {
              setIsCreateModalVisible(false);
              setCreateForm({ name: "", price: "", branches: [] });
            }}
          />
          <div className="relative bg-white rounded-lg shadow-xl w-full max-w-md mx-4 transform transition-all duration-300 scale-95 opacity-0 animate-modal-in">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Create New Product</h3>
              <button
                onClick={() => {
                  setIsCreateModalVisible(false);
                  setCreateForm({ name: "", price: "", branches: [] });
                }}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">Product Name</label>
              <input
                type="text"
                placeholder="Enter product name"
                value={createForm.name}
                onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />

              <label className="block text-sm font-medium text-gray-700 mb-2 mt-4">Price (₱)</label>
              <input
                type="number"
                placeholder="Enter price"
                value={createForm.price}
                onChange={(e) => setCreateForm({ ...createForm, price: parseFloat(e.target.value) })}
                min={0}
                step={10}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />

              <label className="block text-sm font-medium text-gray-700 mb-2 mt-4">Select Branches</label>
              <div className="space-y-2 max-h-48 overflow-y-auto border border-gray-300 rounded-md p-3">
                {branches.map((branch) => (
                  <label key={branch.id} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      value={branch.id}
                      checked={createForm.branches.includes(branch.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setCreateForm({ ...createForm, branches: [...createForm.branches, branch.id] });
                        } else {
                          setCreateForm({ ...createForm, branches: createForm.branches.filter(id => id !== branch.id) });
                        }
                      }}
                      className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                    />
                    <BranchesOutlined className="text-gray-400" />
                    <span className="text-sm text-gray-700">{branch.name}</span>
                  </label>
                ))}
              </div>

              <div className="bg-blue-50 p-3 rounded-lg mt-4">
                <p className="text-xs text-blue-800">
                  <strong>Note:</strong> Product will be created with 0 stock for selected branches.
                  You can add stock later using the "Restock" button.
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-3 p-4 border-t border-gray-200 bg-gray-50 rounded-b-lg">
              <button
                onClick={() => {
                  setIsCreateModalVisible(false);
                  setCreateForm({ name: "", price: "", branches: [] });
                }}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateProduct}
                className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700"
              >
                Create Product
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Restock Modal */}
      {isRestockModalVisible && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 backdrop-blur-sm transition-opacity duration-200"
            onClick={() => {
              setIsRestockModalVisible(false);
              setSelectedProduct(null);
              setSelectedBranch(null);
              setStockQuantity("");
            }}
          />
          <div className="relative bg-white rounded-lg shadow-xl w-full max-w-md mx-4 transform transition-all duration-300 scale-95 opacity-0 animate-modal-in">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Restock - {selectedProduct?.name || ""}</h3>
              <button
                onClick={() => {
                  setIsRestockModalVisible(false);
                  setSelectedProduct(null);
                  setSelectedBranch(null);
                  setStockQuantity("");
                }}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Select Branch</label>
                <select
                  value={selectedBranch || ""}
                  onChange={(e) => setSelectedBranch(parseInt(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                >
                  <option value="">Choose a branch</option>
                  {branches.map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {branch.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Stock Quantity (units)</label>
                <input
                  type="number"
                  placeholder="Enter stock quantity"
                  value={stockQuantity}
                  onChange={(e) => setStockQuantity(e.target.value)}
                  min={1}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                />
                <p className="text-xs text-gray-500 mt-1">Add stock units to this branch</p>
              </div>
            </div>

            <div className="flex justify-end gap-3 p-4 border-t border-gray-200 bg-gray-50 rounded-b-lg">
              <button
                onClick={() => {
                  setIsRestockModalVisible(false);
                  setSelectedProduct(null);
                  setSelectedBranch(null);
                  setStockQuantity("");
                }}
                className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleRestock}
                className="flex-1 px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700"
              >
                Add Stock
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {isDeleteModalVisible && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 backdrop-blur-sm transition-opacity duration-200"
            onClick={() => {
              setIsDeleteModalVisible(false);
              setDeleteTarget(null);
            }}
          />
          <div className="relative bg-white rounded-lg shadow-xl w-full max-w-md mx-4 transform transition-all duration-300 scale-95 opacity-0 animate-modal-in">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
                  <DeleteOutlined className="text-red-600 text-xl" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900">Delete Product</h3>
              </div>
              <p className="text-gray-700 mb-2">
                Are you sure you want to delete <strong className="text-red-600">"{deleteTarget?.name}"</strong>?
              </p>
              <p className="text-sm text-gray-500">This action cannot be undone.</p>
            </div>
            <div className="flex justify-end gap-3 p-4 border-t border-gray-200 bg-gray-50 rounded-b-lg">
              <button
                onClick={() => {
                  setIsDeleteModalVisible(false);
                  setDeleteTarget(null);
                }}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteProduct}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Status Toggle Confirmation Modal */}
      {isStatusModalVisible && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-opacity-20 backdrop-blur-sm transition-opacity duration-200"
            onClick={() => {
              setIsStatusModalVisible(false);
              setStatusTarget(null);
            }}
          />
          <div className="relative bg-white rounded-lg shadow-xl w-full max-w-md mx-4 transform transition-all duration-300 scale-95 opacity-0 animate-modal-in">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                {statusAction ? "Enable Product" : "Disable Product"}
              </h3>
              <p className="text-gray-700">
                {statusAction
                  ? `Enable "${statusTarget?.name}" so it appears in active product lists again?`
                  : `Disable "${statusTarget?.name}"? This will hide it from active lists but keep sales records.`}
              </p>
            </div>
            <div className="flex justify-end gap-3 p-4 border-t border-gray-200 bg-gray-50 rounded-b-lg">
              <button
                onClick={() => {
                  setIsStatusModalVisible(false);
                  setStatusTarget(null);
                }}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={toggleProductActive}
                className={`px-4 py-2 text-sm font-medium text-white rounded-md ${statusAction ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700"
                  }`}
              >
                {statusAction ? "Enable" : "Disable"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add CSS animations */}
      <style>{`
        @keyframes modalIn {
          0% {
            opacity: 0;
            transform: scale(0.95);
          }
          100% {
            opacity: 1;
            transform: scale(1);
          }
        }
        
        .animate-modal-in {
          animation: modalIn 0.2s ease-out forwards;
        }
      `}</style>
    </div>
  );
}

export default ProductList;