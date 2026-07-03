#!/bin/bash
# Quick Verification Script for Attendance Features
# This script checks if all required functions and elements exist

echo "🔍 Verifying Attendance & Payroll System Implementation..."
echo ""

FILE="public/index.html"

# Check 1: Verify HTML elements exist
echo "✓ Checking HTML elements..."
echo "  - atSearchEmp dropdown:"
grep -q "id=\"atSearchEmp\"" "$FILE" && echo "    ✅ Found" || echo "    ❌ Missing"

echo "  - atSearchFrom date input:"
grep -q "id=\"atSearchFrom\"" "$FILE" && echo "    ✅ Found" || echo "    ❌ Missing"

echo "  - atSearchTo date input:"
grep -q "id=\"atSearchTo\"" "$FILE" && echo "    ✅ Found" || echo "    ❌ Missing"

echo "  - atSummaryBox container:"
grep -q "id=\"atSummaryBox\"" "$FILE" && echo "    ✅ Found" || echo "    ❌ Missing"

echo "  - atAdvancedTable container:"
grep -q "id=\"atAdvancedTable\"" "$FILE" && echo "    ✅ Found" || echo "    ❌ Missing"

echo ""

# Check 2: Verify JavaScript functions exist
echo "✓ Checking JavaScript functions..."
echo "  - fillAdvancedSearchEmpList():"
grep -q "window.fillAdvancedSearchEmpList" "$FILE" && echo "    ✅ Found" || echo "    ❌ Missing"

echo "  - renderAdvancedAtSearch():"
grep -q "window.renderAdvancedAtSearch" "$FILE" && echo "    ✅ Found" || echo "    ❌ Missing"

echo "  - atResetAdvancedSearch():"
grep -q "window.atResetAdvancedSearch" "$FILE" && echo "    ✅ Found" || echo "    ❌ Missing"

echo "  - generateSalaryReport():"
grep -q "window.generateSalaryReport" "$FILE" && echo "    ✅ Found" || echo "    ❌ Missing"

echo ""

# Check 3: Verify integration points
echo "✓ Checking integration..."
echo "  - fillAdvancedSearchEmpList() called in page init:"
grep -q "fillAdvancedSearchEmpList()" "$FILE" && echo "    ✅ Found" || echo "    ❌ Missing"

echo "  - fillAdvancedSearchEmpList() called in renderAttendance():"
grep -A5 "function renderAttendance" "$FILE" | grep -q "fillAdvancedSearchEmpList" && echo "    ✅ Found" || echo "    ❌ Missing"

echo ""

# Check 4: File statistics
echo "✓ File statistics..."
echo "  - Total lines: $(wc -l < "$FILE")"
FUNC_COUNT=$(grep -c "window.fill\|window.render\|window.at\|window.generate" "$FILE")
echo "  - New functions defined: $FUNC_COUNT"

echo ""
echo "✅ Verification complete!"
echo ""
echo "📋 Documentation created:"
echo "   - UPDATES.md (Arabic summary)"
echo "   - ATTENDANCE_FEATURES.md (English features)"
echo "   - ATTENDANCE_API.md (Technical documentation)"
