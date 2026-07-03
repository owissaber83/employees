# Advanced Attendance & Payroll Report System

## Overview
This update adds comprehensive attendance search and payroll calculation features to the HR management system.

## New Features

### 1. Advanced Attendance Search Card
- **Date Range Search**: Search attendance records between two dates (not limited to a single date)
- **Unique Employee List**: Each employee appears only once in the dropdown, regardless of attendance frequency
- **Multi-Record Display**: View all attendance/departure records for a selected employee in a date range

### 2. Results Display
The search results table shows:
- Employee Name
- Date
- Check-in Time
- Check-out Time
- Hours Worked
- Status (Attended/Absent)

### 3. Attendance Summary
Displays consolidated metrics:
- ✅ **Attendance Days**: Number of days employee checked in
- ❌ **Absence Days**: Number of days employee was absent
- 📊 **Total Days**: Total days in selected range
- ⏱️ **Total Hours**: Sum of all working hours

### 4. Salary Calculation
When employee data is available, shows:
- 💰 **Base Salary**: Monthly salary
- ✂️ **Absence Deduction**: Calculated as (Absence Days × Daily Rate)
- 💵 **Salary Due**: Net Salary - Absence Deduction

### 5. Comprehensive Salary Report
The "Generate Salary Report" button creates a detailed report including:
- Employee information (Name, ID, Position, Department)
- Attendance summary
- Detailed payroll breakdown:
  - Base salary
  - Allowances & bonuses
  - Deductions (absence, insurance, etc.)
  - Net salary
  - **Final salary due after absence deduction**
- Printable format with professional styling

## New Functions

### `fillAdvancedSearchEmpList()`
Populates the employee dropdown without duplicates.
- Called automatically when page loads
- Called when attendance data updates

### `renderAdvancedAtSearch()`
Displays search results with calculations.
- Shows attendance records for selected employee and date range
- Calculates totals and salary impact
- Updates automatically on filter changes

### `atResetAdvancedSearch()`
Clears all filters and results.

### `generateSalaryReport()`
Generates detailed payroll report.
- Opens in new window
- Includes all financial calculations
- Includes print button

## Calculation Formulas

### Daily Salary Rate
```
Daily Rate = Monthly Salary ÷ 26 working days
```

### Absence Deduction
```
Absence Deduction = Absence Days × Daily Rate
```

### Final Salary Due
```
Salary Due = Net Salary - Absence Deduction
```

## Usage

1. Navigate to **Attendance & Departure** page
2. Find the new **"Advanced Attendance Search"** card
3. Select:
   - Employee from dropdown
   - From Date (optional)
   - To Date (optional)
4. View results immediately
5. Click **"Generate Salary Report"** for detailed payroll report
6. Click **"Reset"** to clear filters

## File Changes

**Modified**: `/Users/redasaber/Desktop/app/public/index.html`

### Additions:
- New HTML card with search controls
- Result display containers
- 4 new JavaScript functions
- Integration with existing `empFinance()` function

## Technical Details

- Uses existing Firebase real-time listeners
- Leverages `empFinance()` for comprehensive payroll calculations
- Compatible with existing authentication and permissions
- Responsive design matching application theme
- Print-friendly report formatting

## Benefits

- 🎯 **Accuracy**: Automatic calculations reduce errors
- 📊 **Transparency**: Detailed reporting of attendance impact on salary
- ⏱️ **Efficiency**: Automated instead of manual calculations
- 🔍 **Visibility**: Easy access to employee attendance history
- 🖨️ **Documentation**: Printable reports for records

---

**Version**: 1.0  
**Date**: 2026-05-20  
**Status**: ✅ Production Ready
