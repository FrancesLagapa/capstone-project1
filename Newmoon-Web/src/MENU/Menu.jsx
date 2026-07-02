import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  DashboardOutlined,
  TeamOutlined,
  UserOutlined,
  LogoutOutlined,
  CalendarOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  MoonOutlined,
  PullRequestOutlined,
  SunOutlined,
  EnvironmentOutlined,
  BranchesOutlined,
  TruckOutlined,
  BoxPlotOutlined,
  TransactionOutlined,
  DatabaseOutlined,
  MoneyCollectOutlined,
  AuditOutlined,
} from "@ant-design/icons";
import logo from "../assets/logooos.jpg";

function MenuSidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [logoutModalVisible, setLogoutModalVisible] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [logoError, setLogoError] = useState(false);
  const [openDropdown, setOpenDropdown] = useState(false);
  const [expandedKeys, setExpandedKeys] = useState([
    "products", 
    "payroll", 
    "branch"
  ]);

  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const userRole = localStorage.getItem("role") || "admin";

  useEffect(() => {
    const savedCollapsed = localStorage.getItem("sidebarCollapsed");
    if (savedCollapsed !== null) {
      setCollapsed(JSON.parse(savedCollapsed));
    }
    
    const savedTheme = localStorage.getItem("theme");
    if (savedTheme !== null) {
      setIsDarkMode(savedTheme === "dark");
      applyTheme(savedTheme === "dark");
    }

    const savedExpandedKeys = localStorage.getItem("expandedKeys");
    if (savedExpandedKeys !== null) {
      setExpandedKeys(JSON.parse(savedExpandedKeys));
    }
  }, []);

  const applyTheme = (dark) => {
    if (dark) {
      document.documentElement.classList.add("dark");
      document.body.style.backgroundColor = "#0a0a1a";
    } else {
      document.documentElement.classList.remove("dark");
      document.body.style.backgroundColor = "#f0f2f5";
    }
  };

  const toggleCollapsed = () => {
    const newCollapsed = !collapsed;
    setCollapsed(newCollapsed);
    localStorage.setItem("sidebarCollapsed", JSON.stringify(newCollapsed));
  };

  const toggleTheme = () => {
    const newDarkMode = !isDarkMode;
    setIsDarkMode(newDarkMode);
    localStorage.setItem("theme", newDarkMode ? "dark" : "light");
    applyTheme(newDarkMode);
  };

  const handleLogout = () => {
    localStorage.removeItem("isLoggedIn");
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    localStorage.removeItem("role");
    navigate("/login", { replace: true });
    setLogoutModalVisible(false);
  };

  const toggleExpand = (key) => {
    setExpandedKeys(prev => {
      const newKeys = prev.includes(key) 
        ? prev.filter(k => k !== key) 
        : [...prev, key];
      localStorage.setItem("expandedKeys", JSON.stringify(newKeys));
      return newKeys;
    });
  };

  const isActive = (path) => {
    return location.pathname === path;
  };

  const isChildActive = (children) => {
    if (!children) return false;
    return children.some(child => child.path === location.pathname);
  };

  // ─── Updated Menu Structure ───
  const menuItems = [
    {
      key: "dashboard",
      icon: <DashboardOutlined />,
      label: "Dashboard",
      path: "/dashboard",
      role: ["admin"],
    },
    {
      key: "products",
      icon: <BoxPlotOutlined />,
      label: "Product & Inventory",
      role: ["admin"],
      children: [
        { 
          key: "products-stock", 
          icon: <DatabaseOutlined />, 
          label: "Products & Stock Levels",
          path: "/inventory",
          role: ["admin"]
        },
        { 
          key: "RequestAdmin", 
          icon: <TruckOutlined />, 
          label: "Request Supply & Cash Advance",
          path: "/RequestAdmin",
          role: ["admin"]
        },
        { 
          key: "pullout-admin", 
          icon: <PullRequestOutlined />, 
          label: "Pull-out Items",
          path: "/pullout-admin",
          role: ["admin"]
        },
      ]
    },
    {
      key: "sales",
      icon: <TransactionOutlined />,
      label: "Sales Transactions",
      path: "/sales",
      role: ["admin"],
      children: [
        { 
          key: "staff-monitoring", 
          icon: <TransactionOutlined />, 
          label: "Sales",
          path: "/staff-monitoring",
          role: ["admin"]
        },
      ]
    },
    {
      key: "customers",
      icon: <TeamOutlined />,
      label: "Customer Data",
      path: "/customers",
      role: ["admin"],
    },
    {
      key: "reservations",
      icon: <CalendarOutlined />,
      label: "Reservation Data",
      path: "/reservations",
      role: ["admin"],
    },
    {
      key: "staff",
      icon: <MoneyCollectOutlined />,
      label: "Staff Data",
      role: ["admin"],
      children: [
        {
      key: "staff",
      icon: <UserOutlined />,
      label: "Staff Management",
      path: "/staff",
      role: ["admin"]
        },
      ]
    },
    {
      key: "payroll",
      icon: <MoneyCollectOutlined />,
      label: "Payroll Data",
      role: ["admin"],
      children: [
        { 
          key: "payroll-info", 
          icon: <DatabaseOutlined />, 
          label: "Payroll Information",
          path: "/payroll",
          role: ["admin"]
        },
      ]
    },
    {
      key: "delivery",
      icon: <TruckOutlined />,
      label: "Delivery Data",
      path: "/delivery",
      role: ["admin"],
    },
    {
      key: "branch",
      icon: <BranchesOutlined />,
      label: "Branch Data",
      role: ["admin"],
      children: [
        { 
          key: "branch-map", 
          icon: <EnvironmentOutlined />, 
          label: "Branch Information",
          path: "/branch-map",
          role: ["admin"]
        },
        { 
          key: "staff-management", 
          icon: <UserOutlined />, 
          label: "Staff Management",
          path: "/staff",
          role: ["admin"]
        },
        { 
          key: "branch-assignments", 
          icon: <AuditOutlined />, 
          label: "Branch Assignments",
          path: "/branch-assign", // Changed to match the route
          role: ["admin"]
        },
      ]
    }
  ];

  // Filter menu items based on user role
  const filteredMenuItems = menuItems.filter(item => {
    if (!item.role) return true;
    return item.role.includes(userRole);
  });

  // Filter children based on user role
  const filterChildren = (children) => {
    if (!children) return [];
    return children.filter(child => {
      if (!child.role) return true;
      return child.role.includes(userRole);
    });
  };

  // ─── Render Menu ───
  const renderMenuItem = (item, depth = 0) => {
    const children = filterChildren(item.children);
    const hasChildren = children.length > 0;
    const isExpanded = expandedKeys.includes(item.key);
    const isItemActive = isChildActive(children) || (item.path && isActive(item.path));
    const paddingLeft = collapsed ? 0 : (depth * 16 + 12);

    if (hasChildren) {
      return (
        <div key={item.key} className="mb-1">
          <button
            onClick={() => toggleExpand(item.key)}
            className={`
              w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200
              ${collapsed ? "justify-center" : "justify-start"}
              ${isItemActive 
                ? isDarkMode 
                  ? "bg-blue-600/20 text-blue-400" 
                  : "bg-blue-50 text-blue-600"
                : isDarkMode
                  ? "text-gray-300 hover:bg-gray-700/50 hover:text-white"
                  : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
              }
              ${!collapsed && "group"}
            `}
            style={{ paddingLeft: collapsed ? undefined : paddingLeft }}
            title={collapsed ? item.label : ""}
          >
            <span className={`text-lg flex-shrink-0 ${isItemActive ? "text-blue-500" : ""}`}>
              {item.icon}
            </span>
            {!collapsed && (
              <>
                <span className="text-sm flex-1 text-left font-medium">{item.label}</span>
                <span className={`text-xs transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                  </svg>
                </span>
              </>
            )}
          </button>
          {!collapsed && (
            <div className={`overflow-hidden transition-all duration-300 ${isExpanded ? 'max-h-[2000px]' : 'max-h-0'}`}>
              <div className="ml-4 mt-1 space-y-0.5 border-l-2 border-gray-200 dark:border-gray-700/50 pl-3">
                {children.map(child => renderMenuItem(child, depth + 1))}
              </div>
            </div>
          )}
        </div>
      );
    }

    // Leaf item
    return (
      <button
        key={item.key}
        onClick={() => item.path && navigate(item.path)}
        className={`
          w-full flex items-center gap-3 px-3 py-2 rounded-xl transition-all duration-200
          ${collapsed ? "justify-center" : "justify-start"}
          ${item.path && isActive(item.path)
            ? isDarkMode 
              ? "bg-blue-600/30 text-blue-400" 
              : "bg-blue-100 text-blue-700"
            : isDarkMode
              ? "text-gray-400 hover:bg-gray-700/50 hover:text-white"
              : "text-gray-500 hover:bg-gray-100 hover:text-gray-900"
          }
        `}
        style={{ paddingLeft: collapsed ? undefined : paddingLeft }}
        title={collapsed ? item.label : ""}
      >
        <span className="text-base flex-shrink-0">{item.icon}</span>
        {!collapsed && <span className="text-sm">{item.label}</span>}
        {!collapsed && item.path && isActive(item.path) && (
          <span className="ml-auto w-1.5 h-8 rounded-full bg-blue-500"></span>
        )}
      </button>
    );
  };

  // ─── Sidebar Styles ───
  const sidebarClasses = isDarkMode
    ? "bg-gradient-to-b from-[#0a0a1a] to-[#141428] text-white"
    : "bg-gradient-to-b from-white to-gray-50 text-gray-800 border-r border-gray-200";

  const logoTextClasses = isDarkMode ? "text-white" : "text-gray-800";
  const logoSubtextClasses = isDarkMode ? "text-gray-400" : "text-gray-500";
  const borderClasses = isDarkMode ? "border-gray-700/50" : "border-gray-200";

  return (
    <>
      <aside 
        className={`${
          collapsed ? "w-20" : "w-72"
        } ${sidebarClasses} flex flex-col transition-all duration-300 ease-in-out shadow-2xl overflow-hidden min-h-screen relative`}
      >
        {/* Toggle Button */}
        <button
          onClick={toggleCollapsed}
          className={`absolute -right-3 top-8 z-50 ${
            isDarkMode ? "bg-gray-800 hover:bg-gray-700" : "bg-white hover:bg-gray-100 border border-gray-200"
          } rounded-full p-1.5 shadow-lg transition-all duration-200`}
        >
          {collapsed ? 
            <MenuUnfoldOutlined className={`text-sm ${isDarkMode ? "text-white" : "text-gray-700"}`} /> : 
            <MenuFoldOutlined className={`text-sm ${isDarkMode ? "text-white" : "text-gray-700"}`} />
          }
        </button>

        {/* Logo Section */}
        <div
          className={`flex flex-col items-center justify-center py-6 border-b ${borderClasses} cursor-pointer transition-all duration-300 ${
            collapsed ? "px-2" : "px-4"
          }`}
          onClick={() => navigate("/dashboard")}
        >
          <div className="relative">
            <div className={`${
              collapsed ? "w-12 h-12" : "w-16 h-16"
            } rounded-full flex items-center justify-center shadow-lg transition-all duration-300 overflow-hidden bg-gradient-to-br from-blue-500 to-purple-600`}>
              {!logoError ? (
                <img 
                  src={logo} 
                  alt="Lechon Manok Logo" 
                  className="w-full h-full object-cover rounded-full"
                  onError={() => setLogoError(true)}
                />
              ) : (
                <span className="text-white font-bold text-xl">NM</span>
              )}
            </div>
            <span className={`absolute bottom-0 right-0 block rounded-full ring-2 ring-white bg-green-500 ${
              collapsed ? 'w-3 h-3' : 'w-3.5 h-3.5'
            }`}>
              <span className="sr-only">Online</span>
            </span>
          </div>
          {!collapsed && (
            <div className="mt-3 text-center">
              <h3 className={`font-bold text-sm tracking-wider ${logoTextClasses}`}>NEW MOON</h3>
              <p className={`text-xs ${logoSubtextClasses}`}>LECHON MANOK</p>
            </div>
          )}
        </div>

        {/* User Info */}
        {!collapsed && user && (
          <div className={`px-4 py-4 border-b ${borderClasses} relative`}>
            <button
              onClick={() => setOpenDropdown(!openDropdown)}
              className="w-full flex items-center space-x-3 hover:bg-gray-100 dark:hover:bg-gray-700/50 p-2 rounded-xl transition-colors"
            >
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white shadow-lg">
                <UserOutlined className="text-lg" />
              </div>
              <div className="flex-1 min-w-0 text-left">
                <p className={`text-sm font-semibold truncate ${isDarkMode ? "text-white" : "text-gray-800"}`}>
                  {user.name || user.username || "User"}
                </p>
                <p className={`text-xs capitalize ${logoSubtextClasses}`}>
                  {userRole === "admin" ? "Administrator" : "Staff Member"}
                </p>
              </div>
            </button>
            
            {/* Dropdown Menu */}
            {openDropdown && (
              <>
                <div 
                  className="fixed inset-0 z-40" 
                  onClick={() => setOpenDropdown(false)}
                />
                <div className={`absolute left-4 right-4 top-full mt-2 rounded-xl shadow-2xl z-50 overflow-hidden ${
                  isDarkMode ? "bg-gray-800" : "bg-white border border-gray-200"
                }`}>
                  <button
                    onClick={() => {
                      setLogoutModalVisible(true);
                      setOpenDropdown(false);
                    }}
                    className={`w-full text-left px-4 py-3 text-sm transition-colors flex items-center gap-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20`}
                  >
                    <LogoutOutlined />
                    <span>Logout</span>
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* Menu Section */}
        <div className="flex-1 mt-4 px-3 overflow-y-auto">
          <nav className="space-y-0.5">
            {filteredMenuItems.map(item => renderMenuItem(item))}
          </nav>
        </div>

        {/* Bottom Actions */}
        <div className={`border-t ${borderClasses} pt-4 pb-6 px-3 space-y-3`}>
          {/* Theme Toggle */}
          {!collapsed ? (
            <div className={`flex items-center justify-between px-3 py-2 rounded-xl ${isDarkMode ? "bg-gray-800/50" : "bg-gray-100"}`}>
              <div className="flex items-center gap-2">
                {isDarkMode ? (
                  <MoonOutlined className="text-blue-400 text-sm" />
                ) : (
                  <SunOutlined className="text-orange-500 text-sm" />
                )}
                <span className={`text-xs ${isDarkMode ? "text-gray-300" : "text-gray-600"}`}>
                  {isDarkMode ? "Dark Mode" : "Light Mode"}
                </span>
              </div>
              <button
                onClick={toggleTheme}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                  isDarkMode ? "bg-blue-600" : "bg-gray-300"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    isDarkMode ? "translate-x-4" : "translate-x-1"
                  }`}
                />
              </button>
            </div>
          ) : (
            <button
              onClick={toggleTheme}
              className={`w-full flex justify-center items-center p-2 rounded-xl transition-colors ${
                isDarkMode 
                  ? "text-yellow-400 hover:bg-gray-700/50" 
                  : "text-indigo-600 hover:bg-gray-100"
              }`}
              title={isDarkMode ? "Light Mode" : "Dark Mode"}
            >
              {isDarkMode ? <SunOutlined className="text-lg" /> : <MoonOutlined className="text-lg" />}
            </button>
          )}

          <div className={`h-px ${borderClasses}`} />
          
          {/* Logout Button */}
          {collapsed ? (
            <button
              onClick={() => setLogoutModalVisible(true)}
              className="w-full flex justify-center items-center p-2 rounded-xl text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
              title="Logout"
            >
              <LogoutOutlined className="text-lg" />
            </button>
          ) : (
            <button
              onClick={() => setLogoutModalVisible(true)}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-red-500 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors shadow-sm"
            >
              <LogoutOutlined />
              <span className="font-medium">Logout</span>
            </button>
          )}
        </div>
      </aside>

      {/* Logout Confirmation Modal */}
      {logoutModalVisible && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div 
            className="absolute inset-0 backdrop-blur-sm bg-black/30 transition-opacity duration-200"
            onClick={() => setLogoutModalVisible(false)}
          />
          <div className={`relative rounded-2xl shadow-2xl max-w-md w-full mx-4 overflow-hidden ${
            isDarkMode ? "bg-gray-800" : "bg-white"
          }`}>
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center">
                  <LogoutOutlined className="text-red-500 text-2xl" />
                </div>
                <div>
                  <h3 className={`text-lg font-semibold ${isDarkMode ? "text-white" : "text-gray-900"}`}>
                    Confirm Logout
                  </h3>
                  <p className={`text-sm ${isDarkMode ? "text-gray-400" : "text-gray-500"}`}>
                    Are you sure you want to logout?
                  </p>
                </div>
              </div>
              <p className={`text-sm mt-2 ${isDarkMode ? "text-gray-300" : "text-gray-600"}`}>
                You will need to login again to access your account.
              </p>
              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => setLogoutModalVisible(false)}
                  className={`px-4 py-2 rounded-xl transition-colors ${
                    isDarkMode 
                      ? "bg-gray-700 hover:bg-gray-600 text-white" 
                      : "bg-gray-100 hover:bg-gray-200 text-gray-700"
                  }`}
                >
                  Cancel
                </button>
                <button
                  onClick={handleLogout}
                  className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white transition-colors shadow-lg"
                >
                  Yes, Logout
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default MenuSidebar;