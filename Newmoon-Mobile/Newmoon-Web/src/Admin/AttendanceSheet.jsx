// AttendanceView.js
import React, { useEffect, useState } from "react";
import {
  SearchOutlined,
  PrinterOutlined,
  EditOutlined,
  UserOutlined,
  ReloadOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import { api } from "../config/api";

function AttendanceView() {
  const [attendanceData, setAttendanceData] = useState([]);
  const [selectedDate, setSelectedDate] = useState(dayjs().format("YYYY-MM-DD"));
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

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

  // Load attendance data
  const loadAttendanceData = async () => {
    setIsLoading(true);
    try {
      const response = await api.get("/attendance", {
        params: { date: selectedDate },
      });
      // ✅ Extract the actual records from the paginated response
      const records = response.data?.data ?? [];
      setAttendanceData(records);
    } catch (error) {
      console.error("Error loading attendance:", error);
      alert("Failed to load attendance data. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAttendanceData();
  }, [selectedDate]);

  // Safety check: ensure attendanceData is an array before filtering
  const filteredData = Array.isArray(attendanceData)
    ? attendanceData.filter((item) => {
        const firstName = item.user?.firstname || "";
        const lastName = item.user?.lastname || "";
        const fullName = `${firstName} ${lastName}`.trim();
        return fullName.toLowerCase().includes(searchTerm.toLowerCase());
      })
    : [];

  const formatTime = (time) => {
    if (!time) return "-";
    try {
      // Check if time is in HH:MM:SS format
      if (/^\d{2}:\d{2}:\d{2}$/.test(time)) {
        const [hours, minutes] = time.split(':');
        const hour = parseInt(hours, 10);
        const ampm = hour >= 12 ? 'PM' : 'AM';
        const hour12 = hour % 12 || 12;
        return `${hour12}:${minutes} ${ampm}`;
      }
      // Try parsing as a full date
      const date = new Date(time);
      if (isNaN(date.getTime())) {
        return time;
      }
      return date.toLocaleTimeString("en-PH", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      });
    } catch {
      return time;
    }
  };

  const getStatusBadge = (status) => {
    const normalizedStatus = String(status).toLowerCase().trim();
    
    if (normalizedStatus === "present" || 
        normalizedStatus === "completed" || 
        normalizedStatus === "completed_late") {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
          <CheckCircleOutlined className="text-xs" /> 
          {normalizedStatus === "completed_late" ? "Completed (Late)" : "Present"}
        </span>
      );
    } else if (normalizedStatus === "late") {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
          <ClockCircleOutlined className="text-xs" /> Late
        </span>
      );
    } else if (normalizedStatus === "absent") {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-600">
          <CloseCircleOutlined className="text-xs" /> Absent
        </span>
      );
    } else {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
          <CloseCircleOutlined className="text-xs" /> 
          {status || "Unknown"}
        </span>
      );
    }
  };

  const getStatusStats = (data) => {
    let present = 0;
    let late = 0;
    let absent = 0;

    data.forEach(item => {
      const status = String(item.status).toLowerCase().trim();
      if (status === "present" || status === "completed" || status === "completed_late") {
        present++;
      } else if (status === "late") {
        late++;
      } else if (status === "absent") {
        absent++;
      }
    });

    return { present, late, absent };
  };

  const totalStaff = filteredData.length;
  const stats = getStatusStats(filteredData);
  const presentStaff = stats.present;
  const lateStaff = stats.late;
  const absentStaff = stats.absent;

  return (
    <div className="bg-gray-50" style={{ minHeight: "100vh" }}>
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Attendance</h1>
            <p className="text-gray-500 mt-1">Daily staff attendance tracking</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-500">Current Time</p>
            <p className="text-lg font-semibold">
              {currentTime.toLocaleTimeString("en-PH", {
                hour12: true,
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              })}
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <p className="text-xs text-gray-500 uppercase tracking-wide">Total Staff</p>
            <p className="text-2xl font-bold text-gray-800">{totalStaff}</p>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <p className="text-xs text-gray-500 uppercase tracking-wide">Present</p>
            <p className="text-2xl font-bold text-green-600">{presentStaff}</p>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <p className="text-xs text-gray-500 uppercase tracking-wide">Late</p>
            <p className="text-2xl font-bold text-yellow-600">{lateStaff}</p>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <p className="text-xs text-gray-500 uppercase tracking-wide">Absent</p>
            <p className="text-2xl font-bold text-red-600">{absentStaff}</p>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
          <div className="flex flex-wrap gap-4 items-center justify-between">
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
              <div>
                <label className="text-xs text-gray-500 block mb-1">Select Date</label>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Search Staff</label>
                <div className="flex items-center border border-gray-300 rounded-md px-3 py-2">
                  <SearchOutlined className="text-gray-400 text-sm mr-2" />
                  <input
                    type="text"
                    placeholder="Enter name..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="text-sm outline-none w-48"
                  />
                </div>
              </div>
            </div>
            <button
              onClick={loadAttendanceData}
              className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-md text-gray-700 bg-white hover:bg-gray-50 transition-colors"
            >
              <ReloadOutlined />
              Refresh
            </button>
          </div>
        </div>

        {/* Attendance Table */}
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Staff Name
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Branch
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Time In
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Time Out
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Hours Worked
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Daily Rate
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {isLoading ? (
                  <tr>
                    <td colSpan={7} className="text-center py-12">
                      <div className="flex justify-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                      </div>
                      <p className="text-gray-500 mt-2 text-sm">Loading attendance...</p>
                    </td>
                  </tr>
                ) : filteredData.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-12 text-gray-500">
                      No attendance records found for this date.
                    </td>
                  </tr>
                ) : (
                  filteredData.map((record, idx) => (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 text-xs font-semibold">
                            {record.user?.firstname?.charAt(0) || "?"}
                          </div>
                          <span className="font-medium text-gray-800">
                            {record.user?.firstname && record.user?.lastname
                              ? `${record.user.firstname} ${record.user.lastname}`
                              : record.user?.firstname || record.user?.lastname || "Unknown Staff"}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-600">{record.branch?.name || "N/A"}</td>
                      <td className="px-4 py-3 text-center font-mono">{formatTime(record.time_in)}</td>
                      <td className="px-4 py-3 text-center font-mono">{formatTime(record.time_out)}</td>
                      <td className="px-4 py-3 text-center">{getStatusBadge(record.status)}</td>
                      <td className="px-4 py-3 text-center">
                        {record.hours_worked ? `${record.hours_worked}h` : "-"}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-green-600">
                        ₱{record.daily_rate?.toFixed(2) || "0.00"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 text-center text-xs text-gray-400 border-t border-gray-200 pt-4">
          <p>Generated on {currentTime.toLocaleString()} | New Moon Lechon Manok and Liempo</p>
        </div>
      </div>
    </div>
  );
}

export default AttendanceView;