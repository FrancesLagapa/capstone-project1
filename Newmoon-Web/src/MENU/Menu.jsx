import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  DashboardOutlined,
  UnorderedListOutlined,
  TeamOutlined,
  UserOutlined,
  LogoutOutlined,
  ShoppingOutlined,
  CalendarOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  SettingOutlined,
  MoonOutlined,
  SunOutlined,
  DollarOutlined,
  FileTextOutlined,
  EnvironmentOutlined,
  BankOutlined,
  InfoCircleOutlined,
  TruckOutlined,
  EyeOutlined,
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
  
  // State to track which submenus are expanded (by key)
  const [expandedKeys, setExpandedKeys] = useState(["branch", "reports"]); // Branch Management and Report Management open by default

  // Get user info from localStorage
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const userRole = localStorage.getItem("role");

  // Load saved states from localStorage
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

  // Apply theme to document
  const applyTheme = (dark) => {
    if (dark) {
      document.documentElement.classList.add("dark");
      document.body.style.backgroundColor = "#111827";
    } else {
      document.documentElement.classList.remove("dark");
      document.body.style.backgroundColor = "#f9fafb";
    }
  };

  // Save collapsed state to localStorage when it changes
  const toggleCollapsed = () => {
    const newCollapsed = !collapsed;
    setCollapsed(newCollapsed);
    localStorage.setItem("sidebarCollapsed", JSON.stringify(newCollapsed));
  };

  // Toggle theme
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
    localStorage.removeItem("sidebarCollapsed");
    navigate("/", { replace: true });
    setLogoutModalVisible(false);
  };

  // ─── Menu Definition (matches the photos) ───
  const menuItems = [
    { 
      key: "/dashboard", 
      icon: <DashboardOutlined />, 
      label: "Dashboard",
      role: ["admin"]
    },
    { 
      key: "/inventory", 
      icon: <UnorderedListOutlined />, 
      label: "Inventory Management",
      role: ["admin"]
    },
    { 
      key: "/attendance", 
      icon: <CalendarOutlined />, 
      label: "Attendance",
      role: ["admin"]
    },
    { 
      key: "branch",   // this is a group, not a route
      icon: <BankOutlined />, 
      label: "Branch Management",
      role: ["admin"],
      children: [
        { 
          key: "/branch-map", 
          icon: <EnvironmentOutlined />, 
          label: "Pinpoint (Map)",
          role: ["admin"]
        },
        { 
          key: "/branch-info", 
          icon: <InfoCircleOutlined />, 
          label: "Branch Information",
          role: ["admin"]
        },
        { 
          key: "/branch-assign", 
          icon: <UserOutlined />, 
          label: "Branch Assign",
          role: ["admin"]
        },
        { 
          key: "/branch-supply", 
          icon: <FileTextOutlined />, 
          label: "Branch Supply And Cash Advance Request",
          role: ["admin"]
        },
        { 
          key: "/pullout-admin", 
          icon: <TruckOutlined />, 
          label: "PullOut Admin",
          role: ["admin"]
        },
      ]
    },
    { 
      key: "/staff", 
      icon: <FileTextOutlined />, 
      label: "Staff Management",
      role: ["admin"]
    },
    { 
      key: "/staff-monitoring", 
      icon: <EyeOutlined />, 
      label: "Staff Monitoring",
      role: ["admin"]
    },
    { 
      key: "/payroll", 
      icon: <DollarOutlined />, 
      label: "Payroll Management",
      role: ["admin"]
    },
    { 
      key: "reports",
      icon: <FileTextOutlined />, 
      label: "Report Management",
      role: ["admin"],
      children: [
        { 
          key: "/reports/sales", 
          icon: <DollarOutlined />, 
          label: "Sales Report",
          role: ["admin"]
        },
        { 
          key: "/reports/inventory", 
          icon: <UnorderedListOutlined />, 
          label: "Inventory Report",
          role: ["admin"]
        },
        { 
          key: "/reports/attendance", 
          icon: <CalendarOutlined />, 
          label: "Attendance Report",
          role: ["admin"]
        },
        { 
          key: "/reports/payroll", 
          icon: <DollarOutlined />, 
          label: "Payroll Report",
          role: ["admin"]
        },
        { 
          key: "/reports/branch", 
          icon: <BankOutlined />, 
          label: "Branch Report",
          role: ["admin"]
        },
        { 
          key: "/reports/pullout", 
          icon: <TruckOutlined />, 
          label: "Pull-Out Report",
          role: ["admin"]
        },
      ]
    },
  ];

  // Filter menu items based on user role (keep only admin items for now)
  const filteredMenuItems = menuItems.filter(item => 
    item.role.includes(userRole || "staff")
  );

  // Helper to check if a menu item (or its children) is active
  const isActive = (item) => {
    if (item.key === location.pathname) return true;
    if (item.children) {
      return item.children.some(child => child.key === location.pathname);
    }
    return false;
  };

  // Toggle submenu expansion
  const toggleExpand = (key) => {
    setExpandedKeys(prev => {
      const newKeys = prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key];
      localStorage.setItem("expandedKeys", JSON.stringify(newKeys));
      return newKeys;
    });
  };

  // ─── Render a single menu item (recursive for children) ───
  const renderMenuItem = (item, depth = 0) => {
    const hasChildren = item.children && item.children.length > 0;
    const isExpanded = expandedKeys.includes(item.key);
    const active = isActive(item);
    const paddingLeft = collapsed ? 0 : (depth * 16 + 12);

    // For parent items with children
    if (hasChildren) {
      return (
        <div key={item.key} className="mb-1">
          <button
            onClick={() => {
              if (!collapsed) {
                toggleExpand(item.key);
              } else {
                // When collapsed, clicking on a parent navigates to the first child? 
                // Or we can do nothing. We'll just toggle the expand state to show submenu? 
                // But submenu won't be visible when collapsed. So maybe just toggle expansion state 
                // but keep the parent button as a toggle only.
                toggleExpand(item.key);
              }
            }}
            className={`
              w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200
              ${collapsed ? "justify-center" : "justify-start"}
              ${active 
                ? isDarkMode 
                  ? "bg-blue-600 text-white" 
                  : "bg-blue-50 text-blue-600"
                : isDarkMode
                  ? "text-gray-300 hover:bg-gray-700 hover:text-white"
                  : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
              }
            `}
            style={{ paddingLeft: collapsed ? undefined : paddingLeft }}
            title={collapsed ? item.label : ""}
          >
            <span className="text-lg">{item.icon}</span>
            {!collapsed && (
              <>
                <span className="text-sm flex-1 text-left">{item.label}</span>
                <span className={`text-xs transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                  </svg>
                </span>
              </>
            )}
          </button>
          {!collapsed && (
            <div className={`overflow-hidden transition-all duration-300 ${isExpanded ? 'max-h-96' : 'max-h-0'}`}>
              <div className="ml-4 mt-1 space-y-1">
                {item.children.map(child => renderMenuItem(child, depth + 1))}
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
        onClick={() => navigate(item.key)}
        className={`
          w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200
          ${collapsed ? "justify-center" : "justify-start"}
          ${active 
            ? isDarkMode 
              ? "bg-blue-600 text-white" 
              : "bg-blue-50 text-blue-600"
            : isDarkMode
              ? "text-gray-300 hover:bg-gray-700 hover:text-white"
              : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
          }
        `}
        style={{ paddingLeft: collapsed ? undefined : paddingLeft }}
        title={collapsed ? item.label : ""}
      >
        <span className="text-lg">{item.icon}</span>
        {!collapsed && <span className="text-sm">{item.label}</span>}
      </button>
    );
  };

  // ─── Sidebar styling ───
  const sidebarClasses = isDarkMode
    ? "bg-gradient-to-b from-gray-900 to-gray-800 text-white"
    : "bg-gradient-to-b from-white to-gray-50 text-gray-800 border-r border-gray-200";

  const logoTextClasses = isDarkMode ? "text-white" : "text-gray-800";
  const logoSubtextClasses = isDarkMode ? "text-gray-400" : "text-gray-500";
  const borderClasses = isDarkMode ? "border-gray-700" : "border-gray-200";

  return (
    <>
      <aside 
        className={`${
          collapsed ? "w-20" : "w-64"
        } ${sidebarClasses} flex flex-col transition-all duration-300 ease-in-out shadow-xl overflow-hidden min-h-screen relative`}
      >
        {/* Toggle Button */}
        <button
          onClick={toggleCollapsed}
          className={`absolute -right-3 top-8 z-50 ${
            isDarkMode ? "bg-gray-700 hover:bg-gray-600" : "bg-white hover:bg-gray-100 border border-gray-200"
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
            } rounded-full flex items-center justify-center shadow-lg transition-all duration-300 overflow-hidden bg-gradient-to-r from-blue-500 to-indigo-600`}>
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
              <h3 className={`font-bold text-sm tracking-wide ${logoTextClasses}`}>NEW MOON</h3>
              <p className={`text-xs ${logoSubtextClasses}`}>LECHON MANOK</p>
            </div>
          )}
        </div>

        {/* User Info (when expanded) */}
        {!collapsed && user && (
          <div className={`px-4 py-4 border-b ${borderClasses} relative`}>
            <button
              onClick={() => setOpenDropdown(!openDropdown)}
              className="w-full flex items-center space-x-3 hover:bg-gray-100 dark:hover:bg-gray-700 p-2 rounded-lg transition-colors"
            >
              <div className="w-8 h-8 rounded-full bg-gradient-to-r from-blue-500 to-indigo-600 flex items-center justify-center text-white">
                <UserOutlined />
              </div>
              <div className="flex-1 min-w-0 text-left">
                <p className={`text-sm font-medium truncate ${isDarkMode ? "text-white" : "text-gray-800"}`}>
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
                <div className={`absolute left-4 right-4 top-full mt-2 rounded-lg shadow-lg z-50 ${
                  isDarkMode ? "bg-gray-800" : "bg-white border border-gray-200"
                }`}>
                  <button
                    onClick={() => {
                      setLogoutModalVisible(true);
                      setOpenDropdown(false);
                    }}
                    className={`w-full text-left px-4 py-2 text-sm transition-colors flex items-center gap-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg`}
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
        <div className="flex-1 mt-4 px-2 overflow-y-auto">
          <nav className="space-y-1">
            {filteredMenuItems.map(item => renderMenuItem(item))}
          </nav>
        </div>

        {/* Bottom Actions */}
        <div className={`border-t ${borderClasses} pt-4 pb-6 px-2 space-y-3`}>
          {/* Theme Toggle */}
          {!collapsed ? (
            <div className={`flex items-center justify-between px-3 py-2 rounded-lg ${isDarkMode ? "bg-gray-800" : "bg-gray-100"}`}>
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
              className={`w-full flex justify-center items-center p-2 rounded-lg transition-colors ${
                isDarkMode 
                  ? "text-yellow-400 hover:bg-gray-700" 
                  : "text-indigo-600 hover:bg-gray-100"
              }`}
              title={isDarkMode ? "Light Mode" : "Dark Mode"}
            >
              {isDarkMode ? <SunOutlined className="text-lg" /> : <MoonOutlined className="text-lg" />}
            </button>
          )}

          <div className={`h-px my-2 ${borderClasses}`} />
          
          {/* Logout Button */}
          {collapsed ? (
            <button
              onClick={() => setLogoutModalVisible(true)}
              className="w-full flex justify-center items-center p-2 rounded-lg text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
              title="Logout"
            >
              <LogoutOutlined className="text-lg" />
            </button>
          ) : (
            <button
              onClick={() => setLogoutModalVisible(true)}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-red-600 bg-red-500 hover:bg-red-200 dark:bg-red-900/20 dark:hover:bg-red-900/30 transition-colors shadow-sm"
            >
              <LogoutOutlined />
              <span>Logout</span>
            </button>
          )}
        </div>
      </aside>

      {/* Logout Confirmation Modal */}
      {logoutModalVisible && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div 
            className="absolute inset-0 backdrop-blur-sm transition-opacity duration-200"
            onClick={() => setLogoutModalVisible(false)}
          />
          <div className={`relative rounded-lg shadow-xl max-w-md w-full mx-4 ${
            isDarkMode ? "bg-gray-800" : "bg-white"
          }`}>
            <div className="p-6">
              <div className="flex items-center gap-2 mb-4">
                <LogoutOutlined className="text-red-500 text-xl" />
                <h3 className={`text-lg font-semibold ${isDarkMode ? "text-white" : "text-gray-900"}`}>
                  Confirm Logout
                </h3>
              </div>
              <p className={`${isDarkMode ? "text-gray-300" : "text-gray-700"}`}>
                Are you sure you want to logout?
              </p>
              <p className={`text-sm mt-2 ${isDarkMode ? "text-gray-400" : "text-gray-500"}`}>
                You will need to login again to access your account.
              </p>
              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => setLogoutModalVisible(false)}
                  className={`px-4 py-2 rounded-lg transition-colors ${
                    isDarkMode 
                      ? "bg-gray-700 hover:bg-gray-600 text-white" 
                      : "bg-gray-100 hover:bg-gray-200 text-gray-700"
                  }`}
                >
                  Cancel
                </button>
                <button
                  onClick={handleLogout}
                  className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white transition-colors"
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