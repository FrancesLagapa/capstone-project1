// PayrollView.js
import React, { useEffect, useState } from "react";
import {
  SearchOutlined,
  PrinterOutlined,
  EditOutlined,
  ReloadOutlined,
  DownOutlined,
  RightOutlined,
  WalletOutlined,
  UserOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import { Avatar } from "antd";
import { api } from "../config/api";

const DAILY_RECORDS_PAGE_SIZE = 8;
const SSS_MONTHLY_RATE = 0.045;
const PHILHEALTH_MONTHLY_RATE = 0.025;
const PAGIBIG_MONTHLY_RATE = 0.02;

function roundMoney(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

function computeGovernmentDeductionsFromMonthlyGross(monthlyGross) {
  const g = Number(monthlyGross) || 0;
  return {
    sss: roundMoney(g * SSS_MONTHLY_RATE),
    philhealth: roundMoney(g * PHILHEALTH_MONTHLY_RATE),
    pagibig: roundMoney(g * PAGIBIG_MONTHLY_RATE),
  };
}

function formatCurrency(amount) {
  const num = Number(amount);
  if (isNaN(num)) return "₱0.00";
  return `₱${num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function PayrollView() {
  // Form state for filters
  const [filterForm, setFilterForm] = useState({
    selectedMonth: dayjs().format("YYYY-MM"),
    searchTerm: "",
  });

  // Form state for cash advance
  const [cashAdvanceForm, setCashAdvanceForm] = useState({
    amount: 0,
    date: dayjs().format("YYYY-MM-DD"),
    note: "",
  });

  // Form state for deductions
  const [deductionsForm, setDeductionsForm] = useState({
    sss: 0,
    philhealth: 0,
    pagibig: 0,
    cashAdvance: 0,
    perfectAttendance: false,
    commission: 0,
  });

  // Form state for print
  const [printForm, setPrintForm] = useState({
    printType: "all",
    selectedStaffForPrint: [],
  });

  // Other state
  const [attendanceData, setAttendanceData] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [selectedStaff, setSelectedStaff] = useState(null);
  const [showDeductionsModal, setShowDeductionsModal] = useState(false);
  const [showCashAdvanceModal, setShowCashAdvanceModal] = useState(false);
  const [deductions, setDeductions] = useState({});
  const [incentives, setIncentives] = useState({});
  const [salesIncentives, setSalesIncentives] = useState({});
  const [cashAdvances, setCashAdvances] = useState({});
  const [isPrintModalVisible, setIsPrintModalVisible] = useState(false);
  const [dailyRecordsPageByStaff, setDailyRecordsPageByStaff] = useState({});
  const [collapsedStaff, setCollapsedStaff] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("attendance_collapsed_staff")) || {};
    } catch {
      return {};
    }
  });

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

  const toNumber = (value, fallback = 0) => {
    if (value === null || value === undefined || value === "") return fallback;
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  };

  const hasSavedValues = (values = {}) =>
    Object.keys(values).length > 0 &&
    Object.values(values).some((v) => v !== 0 && v !== false && v !== null && v !== undefined);

  const extractTimeFromISO = (timeValue) => {
    if (!timeValue) return null;
    try {
      if (typeof timeValue === "string") {
        const raw = timeValue.trim();
        const dateTimeMatch = raw.match(/[T\s](\d{2}):(\d{2})(?::\d{2})?/);
        if (dateTimeMatch) {
          return {
            hours: parseInt(dateTimeMatch[1], 10),
            minutes: parseInt(dateTimeMatch[2], 10),
          };
        }
        const timeOnlyMatch = raw.match(/^(\d{2}):(\d{2})(?::\d{2})?$/);
        if (timeOnlyMatch) {
          return {
            hours: parseInt(timeOnlyMatch[1], 10),
            minutes: parseInt(timeOnlyMatch[2], 10),
          };
        }
      }
      const date = new Date(timeValue);
      if (!Number.isNaN(date.getTime())) {
        return { hours: date.getHours(), minutes: date.getMinutes() };
      }
      return null;
    } catch (error) {
      return null;
    }
  };

  const formatTimeForDisplay = (timeValue) => {
    if (!timeValue) return "-";
    const extracted = extractTimeFromISO(timeValue);
    if (!extracted) return "-";
    let { hours, minutes } = extracted;
    const ampm = hours >= 12 ? "PM" : "AM";
    hours = hours % 12;
    hours = hours ? hours : 12;
    const minutesStr = minutes.toString().padStart(2, "0");
    return `${hours}:${minutesStr} ${ampm}`;
  };

  const calculateHoursWorked = (timeInRaw, timeOutRaw) => {
    if (!timeInRaw || !timeOutRaw) return { hours: 0, minutes: 0, totalHours: 0, isValid: false };

    try {
      const timeIn = extractTimeFromISO(timeInRaw);
      const timeOut = extractTimeFromISO(timeOutRaw);

      if (!timeIn || !timeOut) {
        return { hours: 0, minutes: 0, totalHours: 0, isValid: false };
      }

      let inMinutes = timeIn.hours * 60 + timeIn.minutes;
      let outMinutes = timeOut.hours * 60 + timeOut.minutes;

      if (outMinutes < inMinutes) {
        outMinutes += 24 * 60;
      }

      const diffMinutes = outMinutes - inMinutes;
      const hours = Math.floor(diffMinutes / 60);
      const minutes = diffMinutes % 60;
      const totalHours = diffMinutes / 60;

      return { hours, minutes, totalHours, isValid: true };
    } catch (error) {
      return { hours: 0, minutes: 0, totalHours: 0, isValid: false };
    }
  };

  const calculateDailyEarnings = (record) => {
    const dailyRate = record.dailyRate || 0;
    const { totalHours, isValid } = calculateHoursWorked(record.time_in_raw, record.time_out_raw);

    if (!isValid || totalHours <= 0 || dailyRate <= 0) {
      return record.dailyEarningsApi ?? 0;
    }

    if (Math.abs(totalHours - 12) < 0.1) {
      return dailyRate;
    }

    let earnings = 0;
    if (totalHours <= 8) {
      earnings = (totalHours / 8) * dailyRate;
    } else {
      const overtimeHours = totalHours - 8;
      const overtimeRate = (dailyRate / 8) * 1.25;
      earnings = dailyRate + overtimeHours * overtimeRate;
    }

    return earnings;
  };

  const calculateDeductions = (userId, employeeMonthlySummary = null) => {
    if (!employeeMonthlySummary) return 0;

    const staffDeductions = deductions[userId] || {};

    if (!staffDeductions.deductionRecordExists) {
      return 0;
    }

    const monthlyGross = employeeMonthlySummary.totalGrossPay || 0;
    const gov = computeGovernmentDeductionsFromMonthlyGross(monthlyGross);

    return (
      gov.sss +
      gov.philhealth +
      gov.pagibig +
      (staffDeductions.cashAdvance || 0) +
      (staffDeductions.otherDeductions || 0)
    );
  };

  const calculateIncentives = (userId, record) => {
    const staffIncentives = incentives[userId] || {};

    let totalIncentives = 0;

    if (hasSavedValues(staffIncentives)) {
      if (staffIncentives.perfectAttendance && !record.isLate) {
        totalIncentives += 500 / 22;
      }

      if (staffIncentives.commission) {
        totalIncentives += staffIncentives.commission / 22;
      }
    }

    if (!hasSavedValues(staffIncentives) && record.incentivesApi !== null && record.incentivesApi !== undefined) {
      return record.incentivesApi;
    }

    return totalIncentives;
  };

  const getDailySalesIncentive = (userId, date) => {
    if (!userId || !date) return { dailyQuantity: 0, incentiveAmount: 0 };
    const userData = salesIncentives[String(userId)];
    if (!userData) return { dailyQuantity: 0, incentiveAmount: 0 };
    const dateData = userData[date];
    return {
      dailyQuantity: dateData?.daily_quantity || 0,
      incentiveAmount: dateData?.incentive_amount || 0,
    };
  };

  const getMonthlySalesIncentive = (userId) => {
    if (!userId) return { productsSold: 0, incentiveAmount: 0 };
    const userData = salesIncentives[String(userId)];
    if (!userData) return { productsSold: 0, incentiveAmount: 0 };

    let totalProductsSold = 0;
    let totalIncentive = 0;

    Object.values(userData).forEach((dayData) => {
      const dailyQty = dayData?.daily_quantity || 0;
      totalProductsSold += dailyQty;
      totalIncentive += Math.floor(dailyQty / 40) * 100;
    });

    return {
      productsSold: totalProductsSold,
      incentiveAmount: totalIncentive,
    };
  };

  const dailyRecordsStaffKey = (employee) =>
    employee.userId != null ? String(employee.userId) : `name:${employee.staffName}`;

  const isStaffCollapsed = (employee) => {
    const key = dailyRecordsStaffKey(employee);
    return !!collapsedStaff[key];
  };

  const toggleStaffCollapse = (employee) => {
    const key = dailyRecordsStaffKey(employee);
    setCollapsedStaff((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      localStorage.setItem("attendance_collapsed_staff", JSON.stringify(next));
      return next;
    });
  };

  const getDailyRecordsPage = (employee) => {
    const key = dailyRecordsStaffKey(employee);
    const total = employee.payrollRecords?.length ?? 0;
    const totalPages = Math.max(1, Math.ceil(total / DAILY_RECORDS_PAGE_SIZE));
    const stored = dailyRecordsPageByStaff[key] ?? 1;
    return Math.min(Math.max(1, stored), totalPages);
  };

  // Form handlers
  const handleFilterFormChange = (e) => {
    const { name, value } = e.target;
    setFilterForm(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleFilterFormSubmit = (e) => {
    e.preventDefault();
    loadAttendanceData(true);
  };

  const handleCashAdvanceFormChange = (e) => {
    const { name, value } = e.target;
    setCashAdvanceForm(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleCashAdvanceFormSubmit = async (e) => {
    e.preventDefault();
    const userId = selectedStaff?.userId;
    if (!userId) {
      alert("Unable to determine staff ID.");
      return;
    }

    if (!cashAdvanceForm.amount || cashAdvanceForm.amount <= 0) {
      alert("Please enter a valid cash advance amount.");
      return;
    }

    try {
      await api.post('/cash-advances', {
        user_id: userId,
        amount: cashAdvanceForm.amount,
        date: cashAdvanceForm.date,
        notes: cashAdvanceForm.note || "Cash advance request",
        status: 'approved', // Auto-approve for now
      });

      alert("Cash advance recorded successfully!");
      setShowCashAdvanceModal(false);
      setCashAdvanceForm({ amount: 0, date: dayjs().format("YYYY-MM-DD"), note: "" });
      await loadAttendanceData(true);
    } catch (error) {
      console.error("Error saving cash advance:", error);
      alert("Failed to save cash advance. Please try again.");
    }
  };

  const handleDeductionsFormChange = (e) => {
    const { name, value, type, checked } = e.target;
    setDeductionsForm(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : 
              type === 'number' ? parseFloat(value) || 0 : value
    }));
  };

  const handleDeductionsFormSubmit = async (e) => {
    e.preventDefault();
    const userId = selectedStaff?.userId;
    if (!userId) {
      alert("Unable to determine staff ID.");
      return;
    }

    const monthNum = parseInt(filterForm.selectedMonth.split("-")[1], 10);
    const yearNum = parseInt(filterForm.selectedMonth.split("-")[0], 10);
    const monthlyGross = selectedStaff?.monthlySummary?.totalGrossPay ?? 0;
    const gov = computeGovernmentDeductionsFromMonthlyGross(monthlyGross);

    try {
      await api.post(`/staff/${userId}/deductions`, {
        sss: gov.sss,
        philhealth: gov.philhealth,
        pagibig: gov.pagibig,
        cash_advance: deductionsForm.cashAdvance || 0,
        other_deductions: 0,
        month: monthNum,
        year: yearNum,
      });

      await api.post(`/staff/${userId}/incentives`, {
        perfect_attendance: deductionsForm.perfectAttendance || false,
        commission: deductionsForm.commission || 0,
        other_incentives: 0,
        month: monthNum,
        year: yearNum,
      });

      alert("Deductions and incentives saved successfully!");
      setShowDeductionsModal(false);
      await loadAttendanceData(true);
    } catch (error) {
      console.error("Error saving:", error);
      alert("Failed to save deductions and incentives.");
    }
  };

  const handlePrintFormChange = (e) => {
    const { name, value } = e.target;
    setPrintForm(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handlePrintFormSubmit = (e) => {
    e.preventDefault();
    let htmlContent = "";

    if (printForm.printType === "all") {
      htmlContent = generateCompletePayrollReport();
    } else {
      const selectedEmployees = filteredMonthlyPayroll.filter((emp) =>
        printForm.selectedStaffForPrint.includes(emp.staffName)
      );

      if (selectedEmployees.length === 0) {
        alert("Please select at least one staff member to print");
        return;
      }

      htmlContent = selectedEmployees.map((employee) => generatePayrollSlip(employee)).join("");
    }

    const printWindow = window.open("", "_blank");
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>${printForm.printType === "all" ? "Payroll Report" : "Payroll Slip"} - NEW MOON</title>
        <style>
          @media print {
            body { margin: 0; padding: 20px; }
            @page { size: portrait; margin: 1cm; }
          }
          body { font-family: 'Times New Roman', Arial, sans-serif; margin: 0; padding: 20px; }
          .footer { margin-top: 30px; text-align: center; font-size: 10px; color: #666; }
        </style>
      </head>
      <body>
        ${htmlContent}
        <div class="footer">
          <p>Generated on ${currentTime.toLocaleString()} | This is a computer-generated document</p>
        </div>
        <script>
          window.onload = function() { 
            window.print(); 
            setTimeout(function() { window.close(); }, 500);
          }
        <\/script>
      </body>
      </html>
    `);
    printWindow.document.close();
    setIsPrintModalVisible(false);
  };

  // Load attendance data
  async function loadAttendanceData(forceRefresh = true) {
    setIsLoading(true);
    try {
      let allAttendanceData = [];
      try {
        const { data } = await api.get("/payroll/monthly", {
          params: { month: filterForm.selectedMonth },
        });
        allAttendanceData = Array.isArray(data) ? data : [];
      } catch (error) {
        const [year, month] = filterForm.selectedMonth.split("-");
        const daysInMonth = dayjs(filterForm.selectedMonth).daysInMonth();
        const dailyResults = await Promise.all(
          Array.from({ length: daysInMonth }, (_, i) => i + 1).map(async (day) => {
            const dateStr = `${year}-${month.padStart(2, "0")}-${day.toString().padStart(2, "0")}`;
            try {
              const { data } = await api.get("/payroll/daily", { params: { date: dateStr } });
              if (!data || data.length === 0) return [];
              return data.map((record) => ({ ...record, date: record.date || dateStr }));
            } catch (err) {
              return [];
            }
          })
        );

        allAttendanceData = dailyResults.flat();
      }

      const mapped = (allAttendanceData || []).map((record, index) => {
        const [firstname, ...lastParts] = (record.staff_name || "").split(" ");
        const fallbackUser = {
          firstname: firstname || "",
          lastname: lastParts.join(" ") || "",
        };

        let branchName = "N/A";
        let branchId = null;

        if (record.branch) {
          if (typeof record.branch === "string") {
            branchName = record.branch;
          } else if (typeof record.branch === "object") {
            branchName = record.branch.name || "N/A";
            branchId = record.branch.id || null;
          }
        } else if (record.branch_name) {
          branchName = record.branch_name;
        }

        const finalBranchId = record.branch_id || branchId || record.branch?.id || null;

        const userId = record.user?.id || record.user_id || record.staff_id || record.id || null;

        return {
          id: record.attendance_id || index + 1,
          user: record.user || fallbackUser,
          userId: userId,
          branch: {
            name: branchName,
            id: finalBranchId,
          },
          branchId: finalBranchId,
          date: record.date,
          time_in_raw: record.time_in,
          time_out_raw: record.time_out,
          time_in: formatTimeForDisplay(record.time_in),
          time_out: formatTimeForDisplay(record.time_out),
          status: record.status,
          isLate: record.is_late,
          lateMinutes: record.late_minutes || 0,
          dailyRate: toNumber(record.daily_rate),
          dailyEarningsApi: toNumber(record.daily_earnings, null),
          deductionsApi: toNumber(record.deductions, null),
          incentivesApi: toNumber(record.incentives, null),
          netPayApi: toNumber(record.net_pay, null),
          hours_worked: toNumber(record.hours_worked),
        };
      });

      setAttendanceData(mapped);
      await loadDeductionsAndIncentives(mapped);
      await loadCashAdvances();
    } catch (error) {
      console.error("Error loading attendance:", error);
      setAttendanceData([]);
    } finally {
      setIsLoading(false);
    }
  }

  async function loadDeductionsAndIncentives(attendanceRecords) {
    const [year, month] = filterForm.selectedMonth.split("-");
    const monthNum = parseInt(month);
    const yearNum = parseInt(year);

    const newDeductions = {};
    const newIncentives = {};

    const uniqueStaff = [
      ...new Map(attendanceRecords.map((record) => [record.userId, record])).values(),
    ];

    for (const record of uniqueStaff) {
      if (!record.userId) continue;

      const userId = record.userId;

      try {
        const deductionsRes = await api.get(`/staff/${userId}/deductions/${monthNum}/${yearNum}`);
        newDeductions[userId] = {
          deductionRecordExists: deductionsRes.data.deduction_record_exists === true,
          sss: toNumber(deductionsRes.data.sss),
          philhealth: toNumber(deductionsRes.data.philhealth),
          pagibig: toNumber(deductionsRes.data.pagibig),
          cashAdvance: toNumber(deductionsRes.data.cash_advance),
          otherDeductions: toNumber(deductionsRes.data.other_deductions),
        };

        const incentivesRes = await api.get(`/staff/${userId}/incentives/${monthNum}/${yearNum}`);
        newIncentives[userId] = {
          perfectAttendance: incentivesRes.data.perfect_attendance || false,
          commission: incentivesRes.data.commission || 0,
          otherIncentives: incentivesRes.data.other_incentives || 0,
          chicken_sales_incentive: incentivesRes.data.chicken_sales_incentive || 0,
          chickens_sold: incentivesRes.data.chickens_sold || 0,
        };
      } catch (error) {
        newDeductions[userId] = {
          deductionRecordExists: false,
          sss: 0,
          philhealth: 0,
          pagibig: 0,
          cashAdvance: 0,
          otherDeductions: 0,
        };
        newIncentives[userId] = {
          perfectAttendance: false,
          commission: 0,
          otherIncentives: 0,
          chicken_sales_incentive: 0,
          chickens_sold: 0,
        };
      }
    }

    setDeductions(newDeductions);
    setIncentives(newIncentives);

    try {
      const salesRes = await api.get("/sales/product-incentives/daily", {
        params: { month: monthNum, year: yearNum },
      });
      setSalesIncentives(salesRes.data || {});
    } catch (error) {
      setSalesIncentives({});
    }
  }

  async function loadCashAdvances() {
    try {
      const [year, month] = filterForm.selectedMonth.split("-");
      const response = await api.get("/cash-advances", {
        params: { month: parseInt(month), year: parseInt(year) }
      });

      setCashAdvances(response.data || {});
    } catch (error) {
      console.error("Error loading cash advances:", error);
      setCashAdvances({});
    }
  }

  useEffect(() => {
    loadAttendanceData();
  }, [filterForm.selectedMonth]);

  useEffect(() => {
    setDailyRecordsPageByStaff({});
  }, [filterForm.selectedMonth]);

  useEffect(() => {
    if (!showDeductionsModal || !selectedStaff) return;
    const userId = selectedStaff.userId;
    const gross = selectedStaff.monthlySummary?.totalGrossPay ?? 0;
    const gov = computeGovernmentDeductionsFromMonthlyGross(gross);
    setDeductionsForm({
      sss: gov.sss,
      philhealth: gov.philhealth,
      pagibig: gov.pagibig,
      cashAdvance: deductions[userId]?.cashAdvance ?? 0,
      perfectAttendance: incentives[userId]?.perfectAttendance ?? false,
      commission: incentives[userId]?.commission ?? 0,
    });
  }, [showDeductionsModal, selectedStaff, deductions, incentives]);

  const calculateMonthlyPayroll = () => {
    const groupedByEmployee = attendanceData.reduce((acc, record) => {
      const userId = record.userId || record.user?.id || record.id;
      const staffName = `${record.user.firstname} ${record.user.lastname}`;
      if (!acc[userId]) {
        acc[userId] = {
          records: [],
          staffName,
          user: record.user,
          userId: userId,
          branch: record.branch,
          dailyRate: record.dailyRate || 0,
        };
      }
      acc[userId].records.push(record);
      return acc;
    }, {});

    return Object.values(groupedByEmployee).map((employee) => {
      let totalGrossPay = 0;
      let totalDeductionsAmt = 0;
      let totalIncentives = 0;
      let totalNetPayAmt = 0;
      let totalHoursWorked = 0;
      let daysPresent = 0;
      let daysLate = 0;
      let branchChanges = [];
      let currentBranch = null;

      const payrollRecords = employee.records.map((record) => {
        const dailyEarnings = calculateDailyEarnings(record);
        const incentivesAmt = calculateIncentives(employee.userId, record);
        const { totalHours, isValid } = calculateHoursWorked(record.time_in_raw, record.time_out_raw);

        totalGrossPay += dailyEarnings;
        totalIncentives += incentivesAmt;
        totalHoursWorked += totalHours || 0;
        daysPresent++;
        if (record.isLate) daysLate++;

        // Track branch changes
        if (record.branch?.name !== currentBranch) {
          currentBranch = record.branch?.name;
          branchChanges.push({
            date: record.date,
            branch: currentBranch,
          });
        }

        return {
          ...record,
          staffName: employee.staffName,
          dailyEarnings,
          incentivesAmt,
          netPay: dailyEarnings + incentivesAmt,
          hoursWorked: record.time_out_raw && isValid
            ? `${Math.floor(totalHours)}h ${Math.round((totalHours % 1) * 60)}m`
            : "-",
          totalHours: totalHours || 0,
        };
      });

      // Get cash advances for this employee
      const userCashAdvances = cashAdvances[employee.userId] || [];
      const approvedAdvances = userCashAdvances.filter(ca => ca.status === 'approved');
      const totalCashAdvance = approvedAdvances.reduce((sum, ca) => sum + Number(ca.amount), 0);

      const monthlySummaryData = {
        totalGrossPay,
        totalIncentives,
        totalHoursWorked,
        daysPresent,
        daysLate,
      };

      const monthlyDeductions = calculateDeductions(employee.userId, monthlySummaryData);
      const salesIncentive = getMonthlySalesIncentive(employee.userId);
      const totalIncentivesWithSales = totalIncentives + salesIncentive.incentiveAmount;
      
      // Calculate net pay after deductions including cash advances
      const totalDeductions = monthlyDeductions + totalCashAdvance;
      const monthlyNetPay = totalGrossPay - totalDeductions + totalIncentivesWithSales;

      const daysInMonth = dayjs(filterForm.selectedMonth).daysInMonth();
      const averageDailyEarnings = daysPresent > 0 ? totalGrossPay / daysPresent : 0;
      const projectedMonthlyGross = averageDailyEarnings * daysInMonth;

      const projectedMonthlySummaryData = {
        totalGrossPay: projectedMonthlyGross,
        totalIncentives: (totalIncentives / daysPresent) * daysInMonth,
      };
      const projectedMonthlyDeductions = calculateDeductions(employee.userId, projectedMonthlySummaryData);
      const projectedMonthlyIncentives = (totalIncentives / daysPresent) * daysInMonth;
      const projectedMonthlyNet = projectedMonthlyGross - projectedMonthlyDeductions + projectedMonthlyIncentives;

      return {
        ...employee,
        payrollRecords,
        branchChanges,
        cashAdvances: userCashAdvances,
        totalCashAdvance,
        remainingCashAdvance: totalCashAdvance,
        monthlySummary: {
          totalGrossPay,
          totalDeductions: totalDeductions,
          totalIncentives: totalIncentivesWithSales,
          totalNetPay: monthlyNetPay,
          totalHoursWorked,
          daysPresent,
          daysLate,
          salesIncentive: salesIncentive.incentiveAmount,
          productsSold: salesIncentive.productsSold,
          projectedMonthlyGross,
          projectedMonthlyDeductions,
          projectedMonthlyIncentives,
          projectedMonthlyNet,
          daysInMonth,
        },
      };
    });
  };

  const monthlyPayroll = calculateMonthlyPayroll();
  const filteredMonthlyPayroll = monthlyPayroll.filter((employee) => {
    const staffName = employee.staffName;
    return staffName.toLowerCase().includes(filterForm.searchTerm.toLowerCase());
  });

  const overallTotalGross = filteredMonthlyPayroll.reduce(
    (sum, emp) => sum + emp.monthlySummary.totalGrossPay,
    0
  );
  const overallTotalDeductions = filteredMonthlyPayroll.reduce(
    (sum, emp) => sum + emp.monthlySummary.totalDeductions,
    0
  );
  const overallTotalSalesIncentive = filteredMonthlyPayroll.reduce(
    (sum, emp) => sum + emp.monthlySummary.salesIncentive,
    0
  );
  const overallTotalNet = filteredMonthlyPayroll.reduce(
    (sum, emp) => sum + emp.monthlySummary.totalNetPay,
    0
  );
  const overallTotalProjected = filteredMonthlyPayroll.reduce(
    (sum, emp) => sum + emp.monthlySummary.projectedMonthlyNet,
    0
  );

  const generatePayrollSlip = (employee) => {
    const userId = employee.userId;
    const staffName = employee.staffName;
    const staffDeductions = deductions[userId] || {};
    const govDeductions = staffDeductions.deductionRecordExists
      ? computeGovernmentDeductionsFromMonthlyGross(employee.monthlySummary.totalGrossPay)
      : { sss: 0, philhealth: 0, pagibig: 0 };

    // Get only approved cash advances
    const approvedAdvances = (employee.cashAdvances || []).filter(ca => ca.status === 'approved');

    return `
      <div style="margin-bottom: 40px; page-break-after: always;">
        <div style="text-align: center; margin-bottom: 20px;">
          <div style="font-size: 16px; font-weight: bold;">NEW MOON</div>
          <div style="font-size: 12px; margin-top: 5px;">PAYROLL SLIP</div>
          <div style="font-size: 11px; margin-top: 3px; color: #666;">${dayjs(filterForm.selectedMonth).format("MMMM YYYY")}</div>
        </div>
        
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
          <tr>
            <td style="padding: 8px; border: 1px solid #ddd; width: 30%; background: #f5f5f5;">Employee Name:</td>
            <td style="padding: 8px; border: 1px solid #ddd;"><strong>${staffName}</strong></td>
          </tr>
          <tr>
            <td style="padding: 8px; border: 1px solid #ddd; background: #f5f5f5;">Daily Rate:</td>
            <td style="padding: 8px; border: 1px solid #ddd;">${formatCurrency(employee.dailyRate)}</td>
          </tr>
          <tr>
            <td style="padding: 8px; border: 1px solid #ddd; background: #f5f5f5;">Days Worked:</td>
            <td style="padding: 8px; border: 1px solid #ddd;">${employee.monthlySummary.daysPresent} days</td>
          </tr>
          <tr>
            <td style="padding: 8px; border: 1px solid #ddd; background: #f5f5f5;">Days Late:</td>
            <td style="padding: 8px; border: 1px solid #ddd;">${employee.monthlySummary.daysLate} days</td>
          </tr>
        </table>

        <h4 style="margin-top: 15px; margin-bottom: 10px; color: #333;">Branch Assignments</h4>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
          <thead>
            <tr style="background: #f5f5f5;">
              <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">Date</th>
              <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">Branch</th>
            </tr>
          </thead>
          <tbody>
            ${employee.branchChanges.map((change) => `
              <tr>
                <td style="padding: 8px; border: 1px solid #ddd;">${dayjs(change.date).format("MMM DD, YYYY")}</td>
                <td style="padding: 8px; border: 1px solid #ddd;">${change.branch || "N/A"}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>

        <h4 style="margin-top: 15px; margin-bottom: 10px; color: #333;">Cash Advances</h4>
        ${approvedAdvances.length > 0 ? `
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
            <thead>
              <tr style="background: #f5f5f5;">
                <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">Date</th>
                <th style="padding: 8px; border: 1px solid #ddd; text-align: right;">Amount</th>
                <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">Notes</th>
                <th style="padding: 8px; border: 1px solid #ddd; text-align: center;">Status</th>
              </tr>
            </thead>
            <tbody>
              ${approvedAdvances.map((ca) => `
                <tr>
                  <td style="padding: 8px; border: 1px solid #ddd;">${dayjs(ca.date).format("MMM DD, YYYY")}</td>
                  <td style="padding: 8px; border: 1px solid #ddd; text-align: right;">${formatCurrency(ca.amount)}</td>
                  <td style="padding: 8px; border: 1px solid #ddd;">${ca.notes || "Cash advance"}</td>
                  <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">
                    <span style="color: green;">${ca.status}</span>
                  </td>
                </tr>
              `).join("")}
            </tbody>
            <tfoot>
              <tr style="background: #fff3cd;">
                <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Total Cash Advance</td>
                <td style="padding: 8px; border: 1px solid #ddd; text-align: right; font-weight: bold;">${formatCurrency(employee.totalCashAdvance)}</td>
                <td style="padding: 8px; border: 1px solid #ddd;" colspan="2"></td>
              </tr>
            </tfoot>
          </table>
        ` : `
          <p style="color: #999; font-style: italic; margin-bottom: 20px;">No cash advances recorded</p>
        `}

        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
          <thead>
            <tr style="background: #f5f5f5;">
              <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">Earnings</th>
              <th style="padding: 8px; border: 1px solid #ddd; text-align: right;">Amount</th>
              <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">Deductions</th>
              <th style="padding: 8px; border: 1px solid #ddd; text-align: right;">Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style="padding: 8px; border: 1px solid #ddd;">Basic Pay (${employee.monthlySummary.daysPresent} days)</td>
              <td style="padding: 8px; border: 1px solid #ddd; text-align: right;">${formatCurrency(employee.monthlySummary.totalGrossPay)}</td>
              <td style="padding: 8px; border: 1px solid #ddd;">SSS (4.5%)</td>
              <td style="padding: 8px; border: 1px solid #ddd; text-align: right;">${formatCurrency(govDeductions.sss)}</td>
            </tr>
            <tr>
              <td style="padding: 8px; border: 1px solid #ddd;">Incentives</td>
              <td style="padding: 8px; border: 1px solid #ddd; text-align: right;">${formatCurrency(employee.monthlySummary.totalIncentives)}</td>
              <td style="padding: 8px; border: 1px solid #ddd;">PhilHealth (2.5%)</td>
              <td style="padding: 8px; border: 1px solid #ddd; text-align: right;">${formatCurrency(govDeductions.philhealth)}</td>
            </tr>
            ${employee.monthlySummary.salesIncentive > 0 ? `
              <tr>
                <td style="padding: 8px; border: 1px solid #ddd;">Sales Incentive (${employee.monthlySummary.productsSold} products)</td>
                <td style="padding: 8px; border: 1px solid #ddd; text-align: right;">${formatCurrency(employee.monthlySummary.salesIncentive)}</td>
                <td style="padding: 8px; border: 1px solid #ddd;">Pag-IBIG (2%)</td>
                <td style="padding: 8px; border: 1px solid #ddd; text-align: right;">${formatCurrency(govDeductions.pagibig)}</td>
              </tr>
            ` : ""}
            <tr>
              <td style="padding: 8px; border: 1px solid #ddd;"></td>
              <td style="padding: 8px; border: 1px solid #ddd;"></td>
              <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold; color: #dc3545;">Cash Advance</td>
              <td style="padding: 8px; border: 1px solid #ddd; text-align: right; font-weight: bold; color: #dc3545;">${formatCurrency(employee.totalCashAdvance)}</td>
            </tr>
          </tbody>
          <tfoot>
            <tr style="background: #e8f5e9;">
              <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">TOTAL EARNINGS</td>
              <td style="padding: 8px; border: 1px solid #ddd; text-align: right; font-weight: bold;">${formatCurrency(
                employee.monthlySummary.totalGrossPay + employee.monthlySummary.totalIncentives
              )}</td>
              <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">TOTAL DEDUCTIONS</td>
              <td style="padding: 8px; border: 1px solid #ddd; text-align: right; font-weight: bold;">${formatCurrency(
                employee.monthlySummary.totalDeductions
              )}</td>
            </tr>
            <tr style="background: #c8e6c9;">
              <td colspan="3" style="padding: 8px; border: 1px solid #ddd; font-weight: bold; text-align: center;">NET PAY</td>
              <td style="padding: 8px; border: 1px solid #ddd; text-align: right; font-weight: bold; font-size: 16px;">${formatCurrency(
                employee.monthlySummary.totalNetPay
              )}</td>
            </tr>
          </tfoot>
        </table>

        <div style="margin-top: 30px;">
          <table style="width: 100%;">
            <tr>
              <td style="text-align: center; width: 33%;">
                <hr style="width: 80%;" />
                <div style="font-size: 11px;">Employee Signature</div>
              </td>
              <td style="text-align: center; width: 33%;">
                <hr style="width: 80%;" />
                <div style="font-size: 11px;">Prepared by</div>
              </td>
              <td style="text-align: center; width: 33%;">
                <hr style="width: 80%;" />
                <div style="font-size: 11px;">Approved by</div>
              </td>
            </tr>
          </table>
        </div>
      </div>
    `;
  };

  const generateCompletePayrollReport = () => {
    return filteredMonthlyPayroll.map((employee) => generatePayrollSlip(employee)).join("");
  };

  return (
    <div className="bg-gray-50" style={{ minHeight: "calc(100vh - 64px)" }}>
      <div className="max-w-7xl mx-auto px-6 py-6">
        {/* Filter Form */}
        <form onSubmit={handleFilterFormSubmit} className="bg-white rounded-lg border border-gray-200 p-4 mb-6 shadow-sm">
          <div className="flex flex-wrap gap-4 items-center justify-between">
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
              <div>
                <label className="text-xs text-gray-500 block mb-1">Select Month</label>
                <input
                  type="month"
                  name="selectedMonth"
                  value={filterForm.selectedMonth}
                  onChange={handleFilterFormChange}
                  className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Search Staff</label>
                <div className="flex items-center border border-gray-300 rounded-md px-3 py-2">
                  <SearchOutlined className="text-gray-400 text-sm mr-2" />
                  <input
                    type="text"
                    name="searchTerm"
                    placeholder="Enter name..."
                    value={filterForm.searchTerm}
                    onChange={handleFilterFormChange}
                    className="text-sm outline-none w-48"
                  />
                </div>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                type="submit"
                className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-md text-gray-700 bg-white hover:bg-gray-50 transition-colors"
              >
                <ReloadOutlined />
                Refresh
              </button>
              <button
                type="button"
                onClick={() => setIsPrintModalVisible(true)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-md text-white bg-blue-600 hover:bg-blue-700 transition-colors"
              >
                <PrinterOutlined />
                Print Report
              </button>
            </div>
          </div>
        </form>

        {/* Payroll Table */}
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    STAFF
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    DAYS
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    GROSS PAY
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    CASH ADVANCE
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    DEDUCTIONS
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    NET PAY
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    ACTIONS
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
                      <p className="text-gray-500 mt-2 text-sm">Loading payroll...</p>
                    </td>
                  </tr>
                ) : filteredMonthlyPayroll.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-12 text-gray-500">
                      No payroll records found for this month.
                    </td>
                  </tr>
                ) : (
                  filteredMonthlyPayroll.map((employee) => (
                    <React.Fragment key={employee.userId}>
                      <tr className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => toggleStaffCollapse(employee)}
                              className="p-1 hover:bg-gray-100 rounded transition-colors"
                            >
                              {isStaffCollapsed(employee) ? (
                                <RightOutlined className="text-xs" />
                              ) : (
                                <DownOutlined className="text-xs" />
                              )}
                            </button>
                            <div>
                              <div className="flex items-center gap-2">
                                <Avatar size={28} icon={<UserOutlined />} style={{ backgroundColor: '#1677ff' }} />
                                <div className="font-medium text-gray-800">{employee.staffName}</div>
                              </div>
                              <div className="text-xs text-gray-500">
                                Daily Rate: {formatCurrency(employee.dailyRate)}
                              </div>
                              {employee.monthlySummary.productsSold > 0 && (
                                <div className={`text-xs font-medium mt-1 ${employee.monthlySummary.productsSold >= 40 ? 'text-green-600' : 'text-amber-600'}`}>
                                  {employee.monthlySummary.productsSold >= 40 ? '✅' : '📦'} {employee.monthlySummary.productsSold}{employee.monthlySummary.productsSold >= 40 ? ' pcs sold — ₱100 incentive' : '/40 pcs quota'}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            {employee.monthlySummary.daysPresent}
                          </span>
                          {employee.monthlySummary.daysLate > 0 && (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 ml-1">
                              {employee.monthlySummary.daysLate} late
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-green-600 font-medium text-right">
                          {formatCurrency(employee.monthlySummary.totalGrossPay)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {employee.totalCashAdvance > 0 ? (
                            <span className="text-orange-600 font-medium">
                              {formatCurrency(employee.totalCashAdvance)}
                            </span>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {employee.monthlySummary.totalDeductions > 0 ? (
                            <span className="text-red-600 font-medium">
                              {formatCurrency(employee.monthlySummary.totalDeductions)}
                            </span>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-blue-600 font-bold text-right">
                          {formatCurrency(employee.monthlySummary.totalNetPay)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedStaff(employee);
                                setShowCashAdvanceModal(true);
                              }}
                              className="bg-orange-600 hover:bg-orange-700 text-white text-xs font-medium px-3 py-1.5 rounded-md flex items-center gap-2 shadow-sm hover:shadow-md transition-all duration-200"
                            >
                              <WalletOutlined className="text-sm" />
                              Cash Adv
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedStaff(employee);
                                setShowDeductionsModal(true);
                              }}
                              className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium px-3 py-1.5 rounded-md flex items-center gap-2 shadow-sm hover:shadow-md transition-all duration-200"
                            >
                              <EditOutlined className="text-sm" />
                              Edit
                            </button>
                          </div>
                        </td>
                      </tr>

                      {/* Daily details */}
                      {!isStaffCollapsed(employee) && (() => {
                        const dailyPage = getDailyRecordsPage(employee);
                        const start = (dailyPage - 1) * DAILY_RECORDS_PAGE_SIZE;
                        const pageRecords = employee.payrollRecords.slice(
                          start,
                          start + DAILY_RECORDS_PAGE_SIZE
                        );
                        const staffKey = dailyRecordsStaffKey(employee);
                        return (
                          <>
                            {pageRecords.map((record, recordIdx) => (
                              <tr
                                key={`${employee.userId}-${start + recordIdx}`}
                                className="bg-gray-50 border-l-4 border-blue-200"
                              >
                                <td className="px-4 py-2 text-xs text-gray-600 pl-8">
                                  {dayjs(record.date).format("MMM DD")}
                                  <span className="block text-[10px] text-gray-400">
                                    {record.branch?.name || "N/A"}
                                  </span>
                                </td>
                                <td className="px-4 py-2 text-xs text-gray-600 text-center">
                                  {record.time_in} - {record.time_out}
                                </td>
                                <td className="px-4 py-2 text-xs text-green-600 text-right">
                                  {formatCurrency(record.dailyEarnings)}
                                </td>
                                <td className="px-4 py-2 text-xs text-orange-600 text-right">
                                  {/* Show daily cash advance if any */}
                                  {employee.cashAdvances?.find(ca => ca.date === record.date && ca.status === 'approved')?.amount ? 
                                    formatCurrency(employee.cashAdvances.find(ca => ca.date === record.date && ca.status === 'approved').amount) : 
                                    <span className="text-gray-400">—</span>
                                  }
                                </td>
                                <td className="px-4 py-2 text-xs text-gray-400 text-right">—</td>
                                <td className="px-4 py-2 text-xs text-blue-600 text-right">
                                  {formatCurrency(record.netPay)}
                                </td>
                                <td className="px-4 py-2 text-xs text-gray-400 text-center">Daily</td>
                              </tr>
                            ))}
                            {employee.payrollRecords.length > DAILY_RECORDS_PAGE_SIZE && (
                              <tr className="bg-gray-50 border-l-4 border-blue-200">
                                <td colSpan={7} className="px-4 py-3">
                                  <div className="flex justify-end items-center gap-2">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setDailyRecordsPageByStaff((prev) => ({
                                          ...prev,
                                          [staffKey]: Math.max(1, (prev[staffKey] || 1) - 1),
                                        }))
                                      }
                                      disabled={dailyPage === 1}
                                      className="px-3 py-1 text-sm border rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
                                    >
                                      Prev
                                    </button>
                                    <span className="text-sm text-gray-600">
                                      Page {dailyPage} of{" "}
                                      {Math.ceil(employee.payrollRecords.length / DAILY_RECORDS_PAGE_SIZE)}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setDailyRecordsPageByStaff((prev) => ({
                                          ...prev,
                                          [staffKey]: Math.min(
                                            Math.ceil(
                                              employee.payrollRecords.length / DAILY_RECORDS_PAGE_SIZE
                                            ),
                                            (prev[staffKey] || 1) + 1
                                          ),
                                        }))
                                      }
                                      disabled={
                                        dailyPage ===
                                        Math.ceil(
                                          employee.payrollRecords.length / DAILY_RECORDS_PAGE_SIZE
                                        )
                                      }
                                      className="px-3 py-1 text-sm border rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
                                    >
                                      Next
                                    </button>
                                    <span className="text-xs text-gray-400">
                                      Showing {((dailyPage - 1) * DAILY_RECORDS_PAGE_SIZE) + 1} -{" "}
                                      {Math.min(
                                        dailyPage * DAILY_RECORDS_PAGE_SIZE,
                                        employee.payrollRecords.length
                                      )}{" "}
                                      of {employee.payrollRecords.length}
                                    </span>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </>
                        );
                      })()}
                    </React.Fragment>
                  ))
                )}
              </tbody>
              {filteredMonthlyPayroll.length > 0 && (
                <tfoot className="bg-gray-50 border-t border-gray-200">
                  <tr>
                    <td colSpan={2} className="px-4 py-3 text-right font-semibold text-gray-700">
                      TOTAL:
                    </td>
                    <td className="px-4 py-3 font-semibold text-green-600 text-right">
                      {formatCurrency(overallTotalGross)}
                    </td>
                    <td className="px-4 py-3 font-semibold text-orange-600 text-right">
                      {formatCurrency(
                        filteredMonthlyPayroll.reduce((sum, emp) => sum + emp.totalCashAdvance, 0)
                      )}
                    </td>
                    <td className="px-4 py-3 font-semibold text-red-600 text-right">
                      {formatCurrency(overallTotalDeductions)}
                    </td>
                    <td className="px-4 py-3 font-semibold text-blue-600 text-right">
                      {formatCurrency(overallTotalNet)}
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>

        <div className="mt-6 text-center text-xs text-gray-400 border-t border-gray-200 pt-4">
          <p>Generated on {currentTime.toLocaleString()} | New Moon Lechon Manok and Liempo</p>
        </div>
      </div>

      {/* Cash Advance Modal */}
      {showCashAdvanceModal && selectedStaff && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black bg-opacity-50"
            onClick={() => setShowCashAdvanceModal(false)}
          />
          <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <form onSubmit={handleCashAdvanceFormSubmit} className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Cash Advance - {selectedStaff?.user?.firstname || ""} {selectedStaff?.user?.lastname || ""}
              </h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Daily Rate
                  </label>
                  <div className="text-lg font-semibold text-gray-900">
                    {formatCurrency(selectedStaff.dailyRate)}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Amount
                  </label>
                  <input
                    type="number"
                    name="amount"
                    step="0.01"
                    min="0"
                    value={cashAdvanceForm.amount}
                    onChange={handleCashAdvanceFormChange}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                    placeholder="Enter advance amount"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Enter the amount to advance (e.g., 500 for one day's pay)
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Date
                  </label>
                  <input
                    type="date"
                    name="date"
                    value={cashAdvanceForm.date}
                    onChange={handleCashAdvanceFormChange}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Notes (Optional)
                  </label>
                  <input
                    type="text"
                    name="note"
                    placeholder="Reason for cash advance"
                    value={cashAdvanceForm.note}
                    onChange={handleCashAdvanceFormChange}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Show current balance */}
                {selectedStaff.totalCashAdvance > 0 && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3">
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Current Cash Advance Balance:</span>
                      <span className="text-sm font-bold text-orange-600">
                        {formatCurrency(selectedStaff.totalCashAdvance)}
                      </span>
                    </div>
                    <div className="flex justify-between mt-1">
                      <span className="text-sm text-gray-600">New Balance:</span>
                      <span className="text-sm font-bold text-red-600">
                        {formatCurrency(selectedStaff.totalCashAdvance + (cashAdvanceForm.amount || 0))}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => {
                    setShowCashAdvanceModal(false);
                    setCashAdvanceForm({ amount: 0, date: dayjs().format("YYYY-MM-DD"), note: "" });
                  }}
                  className="px-4 py-2 rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-md bg-orange-600 text-white hover:bg-orange-700 transition-colors"
                >
                  Record Cash Advance
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Deductions Form Modal */}
      {showDeductionsModal && selectedStaff && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black bg-opacity-50"
            onClick={() => setShowDeductionsModal(false)}
          />
          <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
            <form onSubmit={handleDeductionsFormSubmit} className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Edit Deductions - {selectedStaff?.user?.firstname || ""} {selectedStaff?.user?.lastname || ""}
              </h3>

              <div className="bg-blue-50 border border-blue-200 rounded-md p-3 mb-4">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Gross Pay:</span>
                  <span className="text-sm font-semibold text-gray-900">
                    {formatCurrency(selectedStaff?.monthlySummary?.totalGrossPay ?? 0)}
                  </span>
                </div>
                <div className="flex justify-between mt-1">
                  <span className="text-sm text-gray-600">Cash Advance Balance:</span>
                  <span className="text-sm font-semibold text-orange-600">
                    {formatCurrency(selectedStaff.totalCashAdvance || 0)}
                  </span>
                </div>
              </div>

              <p className="text-xs text-gray-500 mb-4">
                SSS (4.5%), PhilHealth (2.5%), Pag-IBIG (2%) are auto-calculated.
              </p>

              <div className="border-t border-gray-200 my-4"></div>

              <div className="mb-4">
                <h4 className="text-sm font-medium text-gray-700 mb-3">Monthly Deductions</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">SSS (4.5%)</label>
                    <input
                      type="text"
                      value={formatCurrency(deductionsForm.sss)}
                      disabled
                      className="w-full border border-gray-300 rounded-md px-3 py-2 bg-gray-50 text-gray-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">PhilHealth (2.5%)</label>
                    <input
                      type="text"
                      value={formatCurrency(deductionsForm.philhealth)}
                      disabled
                      className="w-full border border-gray-300 rounded-md px-3 py-2 bg-gray-50 text-gray-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Pag-IBIG (2%)</label>
                    <input
                      type="text"
                      value={formatCurrency(deductionsForm.pagibig)}
                      disabled
                      className="w-full border border-gray-300 rounded-md px-3 py-2 bg-gray-50 text-gray-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Cash Advance</label>
                    <input
                      type="text"
                      value={formatCurrency(selectedStaff.totalCashAdvance || 0)}
                      disabled
                      className="w-full border border-gray-300 rounded-md px-3 py-2 bg-orange-50 text-orange-600 font-medium"
                    />
                  </div>
                </div>
              </div>

              <div className="border-t border-gray-200 my-4"></div>

              <div className="mb-4">
                <h4 className="text-sm font-medium text-gray-700 mb-3">Incentives</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Perfect Attendance</label>
                    <select
                      name="perfectAttendance"
                      value={deductionsForm.perfectAttendance ? "true" : "false"}
                      onChange={handleDeductionsFormChange}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="true">Yes</option>
                      <option value="false">No</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Commission (monthly)</label>
                    <input
                      type="number"
                      name="commission"
                      step="0.01"
                      value={deductionsForm.commission}
                      onChange={handleDeductionsFormChange}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowDeductionsModal(false)}
                  className="px-4 py-2 rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Print Modal */}
      {isPrintModalVisible && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black bg-opacity-50"
            onClick={() => {
              setIsPrintModalVisible(false);
              setPrintForm({ printType: "all", selectedStaffForPrint: [] });
            }}
          />
          <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <form onSubmit={handlePrintFormSubmit} className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Print Payroll Report</h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    Select Print Type:
                  </label>
                  <div className="space-y-2">
                    <label className="flex items-start gap-3">
                      <input
                        type="radio"
                        name="printType"
                        value="all"
                        checked={printForm.printType === "all"}
                        onChange={handlePrintFormChange}
                        className="mt-1"
                      />
                      <div>
                        <span className="font-medium">All Staff</span>
                        <p className="text-xs text-gray-500">
                          Print payroll slips for all staff members
                        </p>
                      </div>
                    </label>
                    <label className="flex items-start gap-3">
                      <input
                        type="radio"
                        name="printType"
                        value="individual"
                        checked={printForm.printType === "individual"}
                        onChange={handlePrintFormChange}
                        className="mt-1"
                      />
                      <div>
                        <span className="font-medium">Individual Staff</span>
                        <p className="text-xs text-gray-500">
                          Print payroll slips for selected staff only
                        </p>
                      </div>
                    </label>
                  </div>
                </div>

                {printForm.printType === "individual" && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Select Staff Members:
                    </label>
                    <select
                      multiple
                      name="selectedStaffForPrint"
                      value={printForm.selectedStaffForPrint}
                      onChange={(e) => {
                        const values = Array.from(e.target.selectedOptions, (option) => option.value);
                        setPrintForm(prev => ({
                          ...prev,
                          selectedStaffForPrint: values
                        }));
                      }}
                      className="w-full border border-gray-300 rounded-md p-2 h-32"
                    >
                      {filteredMonthlyPayroll.map((employee) => (
                        <option key={employee.staffName} value={employee.staffName}>
                          {employee.staffName} - {employee.dailyRate}/day
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-gray-500 mt-2">
                      Selected: {printForm.selectedStaffForPrint.length} staff member(s)
                    </p>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => {
                    setIsPrintModalVisible(false);
                    setPrintForm({ printType: "all", selectedStaffForPrint: [] });
                  }}
                  className="px-4 py-2 rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700 transition-colors flex items-center gap-2"
                >
                  <PrinterOutlined />
                  Print
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default PayrollView;