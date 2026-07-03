// ══════════════════════════════════════════════════════════════
// Advanced Attendance & Payroll System - Technical Documentation
// ══════════════════════════════════════════════════════════════

/**
 * fillAdvancedSearchEmpList()
 * 
 * PURPOSE: Populates the advanced search employee dropdown with unique employee names
 * 
 * FUNCTION: 
 * - Reads all attendance records from the global `attendance` object
 * - Extracts unique employee IDs and names
 * - Populates the `atSearchEmp` dropdown without duplicates
 * - Preserves current selection if it exists
 * 
 * CALLED BY:
 * - Page load initialization
 * - renderAttendance() on each refresh
 * - Any time attendance data changes
 * 
 * DEPENDENCIES:
 * - Global `attendance` object (from Firebase)
 * - DOM element: `$('atSearchEmp')`
 * 
 * HTML ELEMENTS USED:
 * - <select id="atSearchEmp">
 * 
 * EXAMPLE:
 * fillAdvancedSearchEmpList();  // Populates dropdown
 */

/**
 * renderAdvancedAtSearch()
 * 
 * PURPOSE: Displays filtered attendance records and calculates totals
 * 
 * PROCESS:
 * 1. Gets filter values:
 *    - empId: selected employee ID from `atSearchEmp` dropdown
 *    - fromDate: start date from `atSearchFrom` input
 *    - toDate: end date from `atSearchTo` input
 * 
 * 2. Filters attendance records matching all criteria
 * 
 * 3. Calculates:
 *    - presentDays: count of records with checkIn
 *    - absentDays: count of records without checkIn
 *    - totalHours: sum of totalHours field
 * 
 * 4. Calculates salary impact (if employee data available):
 *    - daily_salary = employee.salary / 26
 *    - deductedSalary = absentDays × daily_salary
 *    - earnedSalary = employee.salary - deductedSalary
 * 
 * 5. Renders:
 *    - Attendance table in `atAdvancedTable`
 *    - Summary boxes in `atSummaryBox` showing:
 *      ✅ Attendance Days
 *      ❌ Absence Days
 *      ⏱️ Total Hours
 *      💰 Base Salary (if employee data available)
 *      ✂️ Absence Deduction (if employee data available)
 *      💵 Salary Due (if employee data available)
 * 
 * CALLED BY:
 * - onChange event for `atSearchEmp`, `atSearchFrom`, `atSearchTo`
 * - Automatically triggers when any filter changes
 * 
 * DEPENDENCIES:
 * - Global `attendance` object
 * - Global `emp` object
 * - Function: `fmt()` for number formatting
 * - Function: `empFinance()` for financial calculations
 * 
 * HTML ELEMENTS USED:
 * - <select id="atSearchEmp">
 * - <input id="atSearchFrom" type="date">
 * - <input id="atSearchTo" type="date">
 * - <div id="atAdvancedTable"> (display target)
 * - <div id="atSummaryBox"> (display target)
 * 
 * EXAMPLE:
 * // User selects employee and dates
 * // renderAdvancedAtSearch() is called automatically
 * // Results appear in atAdvancedTable and atSummaryBox
 */

/**
 * atResetAdvancedSearch()
 * 
 * PURPOSE: Clears all filters and results
 * 
 * FUNCTION:
 * - Clears `atSearchEmp` dropdown (sets to blank)
 * - Clears `atSearchFrom` date input
 * - Clears `atSearchTo` date input
 * - Clears results in `atAdvancedTable`
 * - Clears summary in `atSummaryBox`
 * 
 * CALLED BY:
 * - onClick event for "Reset" button
 * 
 * DEPENDENCIES:
 * - DOM elements: `$('atSearchEmp')`, `$('atSearchFrom')`, `$('atSearchTo')`
 * - DOM elements: `$('atAdvancedTable')`, `$('atSummaryBox')`
 * 
 * EXAMPLE:
 * atResetAdvancedSearch();  // Clears all filters
 */

/**
 * generateSalaryReport()
 * 
 * PURPOSE: Generates comprehensive salary report for selected employee and date range
 * 
 * PROCESS:
 * 1. Validates:
 *    - Employee is selected
 *    - Date range is specified
 * 
 * 2. Retrieves:
 *    - Employee data from `emp[empId]`
 *    - Attendance records for date range
 * 
 * 3. Calculates:
 *    - presentDays: days with check-in
 *    - absentDays: days without check-in
 *    - totalDays: presentDays + absentDays
 *    - totalHours: sum of work hours
 * 
 * 4. Financial calculations:
 *    - Calls `empFinance(empData)` to get:
 *      * grossSalary
 *      * totalDeductions
 *      * netSalary
 *    - Calculates:
 *      * dailySalary = netSalary / 26
 *      * deductedSalary = absentDays × dailySalary
 *      * finalSalary = netSalary - deductedSalary
 * 
 * 5. Generates HTML report with:
 *    - Header: Employee name, date range, generated date
 *    - Employee section: Name, ID, Job, Department
 *    - Attendance summary: Attendance days, absence days, total hours
 *    - Salary breakdown table:
 *      * Base salary
 *      * Allowances (house, transport, phone, etc.)
 *      * Gross salary
 *      * Deductions (absence, insurance, etc.)
 *      * Net salary
 *      * Absence deduction
 *      * Final salary due
 *    - Detailed attendance records: Date, check-in, check-out, hours, status
 *    - Print button
 * 
 * 6. Opens report in new window for printing/saving
 * 
 * CALLED BY:
 * - onClick event for "Generate Salary Report" button
 * 
 * DEPENDENCIES:
 * - Global `emp` object
 * - Global `attendance` object
 * - Function: `fmt()` for number formatting
 * - Function: `empFinance()` for financial data
 * - Function: `today()` for current date
 * - Function: `toast()` for notifications
 * 
 * HTML ELEMENTS USED:
 * - <select id="atSearchEmp">
 * - <input id="atSearchFrom" type="date">
 * - <input id="atSearchTo" type="date">
 * 
 * VALIDATIONS:
 * - empId must be selected (shows error toast if not)
 * - Date range must be specified (shows error toast if not)
 * 
 * EXAMPLE:
 * generateSalaryReport();
 * // Opens new window with formatted salary report
 */

// ══════════════════════════════════════════════════════════════
// DATA STRUCTURES
// ══════════════════════════════════════════════════════════════

/**
 * ATTENDANCE OBJECT STRUCTURE
 * 
 * attendance = {
 *   "firebase_key_1": {
 *     employeeId: "uid123",
 *     employeeName: "محمد علي",
 *     date: "2026-05-20",
 *     checkIn: "2026-05-20T07:30:00.000Z",
 *     checkOut: "2026-05-20T16:00:00.000Z",
 *     totalHours: 8.5
 *   },
 *   "firebase_key_2": {
 *     employeeId: "uid123",
 *     employeeName: "محمد علي",
 *     date: "2026-05-21",
 *     checkIn: "2026-05-21T07:30:00.000Z",
 *     checkOut: null,
 *     totalHours: null
 *   },
 *   ...
 * }
 */

/**
 * EMPLOYEE OBJECT STRUCTURE
 * 
 * emp = {
 *   "uid123": {
 *     name: "محمد علي",
 *     empId: "EMP001",
 *     job: "مهندس",
 *     dept: "التطوير",
 *     salary: "5000",
 *     houseAllow: "1000",
 *     transAllow: "500",
 *     phoneAllow: "200",
 *     socialEmp: "9.75",    // GOSI employee percentage
 *     socialComp: "21.5",   // GOSI company percentage
 *     ...financial fields...
 *   },
 *   ...
 * }
 */

// ══════════════════════════════════════════════════════════════
// CALCULATION FORMULAS
// ══════════════════════════════════════════════════════════════

/**
 * FORMULA 1: Daily Salary Rate
 * 
 * Daily Rate = Monthly Salary ÷ 26 (working days)
 * 
 * Example:
 * Monthly Salary: 5,000 SAR
 * Daily Rate: 5,000 ÷ 26 = 192.31 SAR/day
 */

/**
 * FORMULA 2: Absence Deduction
 * 
 * Absence Deduction = Absence Days × Daily Rate
 * 
 * Example:
 * Absence Days: 2
 * Daily Rate: 192.31 SAR
 * Absence Deduction: 2 × 192.31 = 384.62 SAR
 */

/**
 * FORMULA 3: Final Salary Due
 * 
 * Salary Due = Net Salary - Absence Deduction
 * 
 * Example:
 * Net Salary: 4,500 SAR
 * Absence Deduction: 384.62 SAR
 * Salary Due: 4,500 - 384.62 = 4,115.38 SAR
 */

// ══════════════════════════════════════════════════════════════
// EXAMPLE USAGE
// ══════════════════════════════════════════════════════════════

/**
 * SCENARIO 1: User selects employee and date range
 * 
 * Steps:
 * 1. User opens Attendance page
 * 2. fillAdvancedSearchEmpList() is called automatically
 * 3. Dropdown shows list of unique employees:
 *    - محمد علي (uid123)
 *    - فاطمة أحمد (uid456)
 *    - علي محمود (uid789)
 * 4. User selects "محمد علي"
 * 5. renderAdvancedAtSearch() is triggered
 * 6. System filters attendance for uid123
 * 7. Results show all attendance records for محمد علي
 * 8. Summary displays: 18 attendance days, 2 absence days, 152.5 hours
 * 9. Salary impact shows deduction for 2 absence days
 */

/**
 * SCENARIO 2: User generates salary report
 * 
 * Steps:
 * 1. User has selected employee and date range
 * 2. User clicks "Generate Salary Report"
 * 3. generateSalaryReport() validates data
 * 4. System opens new window with detailed report
 * 5. Report includes:
 *    - Employee: محمد علي
 *    - Period: 2026-05-01 to 2026-05-31
 *    - Attendance: 18 days
 *    - Absence: 2 days
 *    - Base Salary: 5,000 SAR
 *    - Gross Salary: 5,700 SAR
 *    - Deductions: 1,200 SAR
 *    - Net Salary: 4,500 SAR
 *    - Absence Deduction: 384.62 SAR
 *    - SALARY DUE: 4,115.38 SAR
 * 6. User can print or save report
 */

// ══════════════════════════════════════════════════════════════
// INTEGRATION POINTS
// ══════════════════════════════════════════════════════════════

/**
 * FIREBASE LISTENERS
 * 
 * The system relies on these Firebase real-time listeners:
 * - R.att: attendance records
 * - R.emp: employee records
 * 
 * When these change, the following functions should be called:
 * - fillAdvancedSearchEmpList()
 * - renderAttendance() (which internally calls fillAdvancedSearchEmpList)
 */

/**
 * PERMISSIONS
 * 
 * The attendance page checks:
 * - can('view_attendance'): View attendance records
 * - can('manage_attendance'): Admin functions
 * - curU.uid: Current user ID for personal records
 */

/**
 * HELPER FUNCTIONS USED
 * 
 * fmt(value) - Format numbers with 2 decimal places
 * today() - Get today's date in YYYY-MM-DD format
 * toast(msg, type, duration) - Show notification message
 * empFinance(employee) - Calculate complete financial data
 * $('elementId') - DOM element selector
 */
