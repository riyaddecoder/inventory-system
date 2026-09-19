#!/usr/bin/env bash
set -e

BASE_URL="${API_URL:-http://localhost:3000}"
PASS=0
FAIL=0

GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_test() {
  echo -e "\n${BLUE}[TEST] $1${NC}"
}

assert_status() {
  local expected="$1"
  local actual="$2"
  local desc="$3"
  if [ "$actual" -eq "$expected" ]; then
    echo -e "${GREEN}✔ PASS: $desc (HTTP $actual)${NC}"
    PASS=$((PASS + 1))
  else
    echo -e "${RED}✖ FAIL: $desc (Expected HTTP $expected, got $actual)${NC}"
    FAIL=$((FAIL + 1))
  fi
}

echo -e "${YELLOW}================================================================${NC}"
echo -e "${YELLOW}   E2E INTEGRATION TEST SUITE - REAL CURL REQUESTS              ${NC}"
echo -e "${YELLOW}   Target: $BASE_URL                                            ${NC}"
echo -e "${YELLOW}================================================================${NC}"

TIMESTAMP=$(date +%s)
ADMIN_EMAIL="admin_${TIMESTAMP}@example.com"
CUSTOMER_EMAIL="customer_${TIMESTAMP}@example.com"
PASSWORD="password123"

# 1. Health Check
log_test "1. Health Check /api and root endpoints (JSON format)"
RESP=$(curl -s -w "\n%{http_code}" "$BASE_URL/api")
STATUS=$(echo "$RESP" | tail -n1)
BODY=$(echo "$RESP" | sed '$d')
assert_status 200 "$STATUS" "GET /api endpoint responds"
MSG=$(echo "$BODY" | jq -r '.message' 2>/dev/null || echo "")
if [ "$MSG" == "API working" ]; then
  echo -e "${GREEN}✔ PASS: /api JSON body says '{\"message\":\"API working\"}'${NC}"
  PASS=$((PASS + 1))
else
  echo -e "${RED}✖ FAIL: Expected JSON message 'API working', got '$BODY'${NC}"
  FAIL=$((FAIL + 1))
fi

RESP_ROOT=$(curl -s -w "\n%{http_code}" "$BASE_URL/")
STATUS_ROOT=$(echo "$RESP_ROOT" | tail -n1)
BODY_ROOT=$(echo "$RESP_ROOT" | sed '$d')
assert_status 200 "$STATUS_ROOT" "GET / endpoint responds"
MSG_ROOT=$(echo "$BODY_ROOT" | jq -r '.message' 2>/dev/null || echo "")
if [ "$MSG_ROOT" == "API working" ]; then
  echo -e "${GREEN}✔ PASS: Root JSON body says '{\"message\":\"API working\"}'${NC}"
  PASS=$((PASS + 1))
else
  echo -e "${RED}✖ FAIL: Expected JSON message 'API working', got '$BODY_ROOT'${NC}"
  FAIL=$((FAIL + 1))
fi

# 2. Swagger Docs
log_test "2. OpenAPI / Swagger Documentation endpoint"
RESP=$(curl -s -w "\n%{http_code}" "$BASE_URL/api/docs/")
STATUS=$(echo "$RESP" | tail -n1)
assert_status 200 "$STATUS" "Swagger UI is served at /api/docs/"

# 3. Register Admin User
log_test "3. Register Admin User"
RESP=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"email\": \"$ADMIN_EMAIL\", \"password\": \"$PASSWORD\", \"role\": \"admin\"}")
STATUS=$(echo "$RESP" | tail -n1)
BODY=$(echo "$RESP" | sed '$d')
assert_status 201 "$STATUS" "Admin user registered"

# 4. Duplicate User Conflict
log_test "4. Duplicate User Registration Conflict (409)"
RESP=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"email\": \"$ADMIN_EMAIL\", \"password\": \"$PASSWORD\"}")
STATUS=$(echo "$RESP" | tail -n1)
BODY=$(echo "$RESP" | sed '$d')
assert_status 409 "$STATUS" "Duplicate registration returns 409 Conflict"

# 5. Register Customer User
log_test "5. Register Customer User"
RESP=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"email\": \"$CUSTOMER_EMAIL\", \"password\": \"$PASSWORD\", \"role\": \"customer\"}")
STATUS=$(echo "$RESP" | tail -n1)
assert_status 201 "$STATUS" "Customer user registered"

# 6. Login Admin
log_test "6. Login Admin and retrieve JWT"
RESP=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\": \"$ADMIN_EMAIL\", \"password\": \"$PASSWORD\"}")
STATUS=$(echo "$RESP" | tail -n1)
BODY=$(echo "$RESP" | sed '$d')
assert_status 200 "$STATUS" "Admin login successful"
ADMIN_TOKEN=$(echo "$BODY" | jq -r '.token')

# 7. Login Customer
log_test "7. Login Customer and retrieve JWT"
RESP=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\": \"$CUSTOMER_EMAIL\", \"password\": \"$PASSWORD\"}")
STATUS=$(echo "$RESP" | tail -n1)
BODY=$(echo "$RESP" | sed '$d')
assert_status 200 "$STATUS" "Customer login successful"
CUSTOMER_TOKEN=$(echo "$BODY" | jq -r '.token')

# 8. User Profile (Me)
log_test "8. Get authenticated profile (/api/users/me)"
RESP=$(curl -s -w "\n%{http_code}" "$BASE_URL/api/users/me" \
  -H "Authorization: Bearer $CUSTOMER_TOKEN")
STATUS=$(echo "$RESP" | tail -n1)
assert_status 200 "$STATUS" "Profile retrieved for customer"

# 9. Create Category
log_test "9. Admin creates Category"
RESP=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/categories" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"name\": \"Electronics_${TIMESTAMP}\", \"description\": \"Audio, Gadgets and Accessories\"}")
STATUS=$(echo "$RESP" | tail -n1)
BODY=$(echo "$RESP" | sed '$d')
assert_status 201 "$STATUS" "Category created"
CATEGORY_ID=$(echo "$BODY" | jq -r '.id')

# 10. List Categories
log_test "10. List Categories (Cached)"
RESP=$(curl -s -w "\n%{http_code}" "$BASE_URL/api/categories")
STATUS=$(echo "$RESP" | tail -n1)
assert_status 200 "$STATUS" "Categories list retrieved"

# 11. Create Products
log_test "11. Admin creates Products with initial stock"
RESP=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/products" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"name\": \"Noise Cancelling Headphones\", \"description\": \"Wireless over-ear headphones\", \"price\": 199.99, \"categoryId\": \"$CATEGORY_ID\", \"initialQuantity\": 50}")
STATUS=$(echo "$RESP" | tail -n1)
BODY=$(echo "$RESP" | sed '$d')
assert_status 201 "$STATUS" "Product 1 created with 50 stock"
PRODUCT_ID_1=$(echo "$BODY" | jq -r '.id')

RESP=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/products" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"name\": \"Mechanical Keyboard\", \"description\": \"RGB Gaming Keyboard with tactile switches\", \"price\": 89.99, \"categoryId\": \"$CATEGORY_ID\", \"initialQuantity\": 15}")
STATUS=$(echo "$RESP" | tail -n1)
BODY=$(echo "$RESP" | sed '$d')
assert_status 201 "$STATUS" "Product 2 created with 15 stock"
PRODUCT_ID_2=$(echo "$BODY" | jq -r '.id')

# 12. Search & Filter Products
log_test "12. Search Products by keyword ('Headphones')"
RESP=$(curl -s -w "\n%{http_code}" "$BASE_URL/api/products?q=Headphones")
STATUS=$(echo "$RESP" | tail -n1)
BODY=$(echo "$RESP" | sed '$d')
assert_status 200 "$STATUS" "Search products returns 200"
COUNT=$(echo "$BODY" | jq '.data | length')
if [ "$COUNT" -ge 1 ]; then
  echo -e "${GREEN}✔ PASS: Search found matching product(s) (count: $COUNT)${NC}"
  PASS=$((PASS + 1))
else
  echo -e "${RED}✖ FAIL: Search returned 0 products${NC}"
  FAIL=$((FAIL + 1))
fi

# 13. Check Inventory Availability
log_test "13. Check Stock Availability before order"
RESP=$(curl -s -w "\n%{http_code}" "$BASE_URL/api/inventory/$PRODUCT_ID_1")
STATUS=$(echo "$RESP" | tail -n1)
BODY=$(echo "$RESP" | sed '$d')
assert_status 200 "$STATUS" "Inventory availability retrieved"
STOCK_BEFORE=$(echo "$BODY" | jq -r '.availableQuantity')
echo -e "Available stock before checkout: $STOCK_BEFORE"

# 14. Create Order (Idempotent)
log_test "14. Customer creates order (buys 2 headphones)"
IDEMPOTENCY_KEY="order-key-${TIMESTAMP}"
RESP=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/orders" \
  -H "Authorization: Bearer $CUSTOMER_TOKEN" \
  -H "Idempotency-Key: $IDEMPOTENCY_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"items\": [{\"productId\": \"$PRODUCT_ID_1\", \"quantity\": 2}]}")
STATUS=$(echo "$RESP" | tail -n1)
BODY=$(echo "$RESP" | sed '$d')
assert_status 201 "$STATUS" "Order placed successfully"
ORDER_ID=$(echo "$BODY" | jq -r '.id')
ORDER_AMOUNT=$(echo "$BODY" | jq -r '.totalAmount')
echo -e "Order ID: $ORDER_ID, Total Amount: $ORDER_AMOUNT"

# 15. Idempotency Key Replay
log_test "15. Re-send order with same Idempotency-Key (Retry-Safety)"
RESP=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/orders" \
  -H "Authorization: Bearer $CUSTOMER_TOKEN" \
  -H "Idempotency-Key: $IDEMPOTENCY_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"items\": [{\"productId\": \"$PRODUCT_ID_1\", \"quantity\": 2}]}")
STATUS=$(echo "$RESP" | tail -n1)
BODY=$(echo "$RESP" | sed '$d')
assert_status 201 "$STATUS" "Replay returns original cached order"
REPLAY_ORDER_ID=$(echo "$BODY" | jq -r '.id')
if [ "$ORDER_ID" == "$REPLAY_ORDER_ID" ]; then
  echo -e "${GREEN}✔ PASS: Idempotency verified: replayed order ID matches original ($ORDER_ID)${NC}"
  PASS=$((PASS + 1))
else
  echo -e "${RED}✖ FAIL: Idempotent replay returned different order: $REPLAY_ORDER_ID${NC}"
  FAIL=$((FAIL + 1))
fi

# 16. Verify Stock Decrement
log_test "16. Verify Stock Decremented correctly"
RESP=$(curl -s -w "\n%{http_code}" "$BASE_URL/api/inventory/$PRODUCT_ID_1")
BODY=$(echo "$RESP" | sed '$d')
STOCK_AFTER=$(echo "$BODY" | jq -r '.availableQuantity')
echo -e "Stock after purchasing 2 items: $STOCK_AFTER (was $STOCK_BEFORE)"
if [ "$STOCK_AFTER" -eq "$((STOCK_BEFORE - 2))" ]; then
  echo -e "${GREEN}✔ PASS: Stock correctly reduced by 2${NC}"
  PASS=$((PASS + 1))
else
  echo -e "${RED}✖ FAIL: Expected stock $((STOCK_BEFORE - 2)), got $STOCK_AFTER${NC}"
  FAIL=$((FAIL + 1))
fi

# 17. Prevent Overselling
log_test "17. Prevent Overselling (Buy 9999 items)"
RESP=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/orders" \
  -H "Authorization: Bearer $CUSTOMER_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"items\": [{\"productId\": \"$PRODUCT_ID_1\", \"quantity\": 9999}]}")
STATUS=$(echo "$RESP" | tail -n1)
assert_status 409 "$STATUS" "Overselling prevented: returns 409 Conflict"

# 18. Cancel Order & Restore Stock
log_test "18. Cancel Order and verify Stock Restoration"
RESP=$(curl -s -w "\n%{http_code}" -X PATCH "$BASE_URL/api/orders/$ORDER_ID/cancel" \
  -H "Authorization: Bearer $CUSTOMER_TOKEN")
STATUS=$(echo "$RESP" | tail -n1)
assert_status 200 "$STATUS" "Order cancelled successfully"

RESP=$(curl -s -w "\n%{http_code}" "$BASE_URL/api/inventory/$PRODUCT_ID_1")
BODY=$(echo "$RESP" | sed '$d')
STOCK_RESTORED=$(echo "$BODY" | jq -r '.availableQuantity')
echo -e "Stock after cancellation: $STOCK_RESTORED"
if [ "$STOCK_RESTORED" -eq "$STOCK_BEFORE" ]; then
  echo -e "${GREEN}✔ PASS: Inventory fully restored back to $STOCK_BEFORE${NC}"
  PASS=$((PASS + 1))
else
  echo -e "${RED}✖ FAIL: Expected restored stock $STOCK_BEFORE, got $STOCK_RESTORED${NC}"
  FAIL=$((FAIL + 1))
fi

# 19. Cancel Already Cancelled Order (400)
log_test "19. Attempt to cancel already cancelled order"
RESP=$(curl -s -w "\n%{http_code}" -X PATCH "$BASE_URL/api/orders/$ORDER_ID/cancel" \
  -H "Authorization: Bearer $CUSTOMER_TOKEN")
STATUS=$(echo "$RESP" | tail -n1)
assert_status 400 "$STATUS" "Cancelling cancelled order returns 400 Bad Request"

# 20. Create a completed order for reporting
log_test "20. Create confirmed order for analytics"
RESP=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/orders" \
  -H "Authorization: Bearer $CUSTOMER_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"items\": [{\"productId\": \"$PRODUCT_ID_2\", \"quantity\": 3}]}")
STATUS=$(echo "$RESP" | tail -n1)
BODY=$(echo "$RESP" | sed '$d')
assert_status 201 "$STATUS" "Second order placed"
ORDER_2_ID=$(echo "$BODY" | jq -r '.id')

# 21. Admin Updates Order Status
log_test "21. Admin updates order status to 'shipped'"
RESP=$(curl -s -w "\n%{http_code}" -X PATCH "$BASE_URL/api/orders/$ORDER_2_ID/status" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status": "shipped"}')
STATUS=$(echo "$RESP" | tail -n1)
BODY=$(echo "$RESP" | sed '$d')
assert_status 200 "$STATUS" "Order status updated to shipped"
NEW_STATUS=$(echo "$BODY" | jq -r '.status')
if [ "$NEW_STATUS" == "shipped" ]; then
  echo -e "${GREEN}✔ PASS: Order status is verified as 'shipped'${NC}"
  PASS=$((PASS + 1))
else
  echo -e "${RED}✖ FAIL: Expected 'shipped', got '$NEW_STATUS'${NC}"
  FAIL=$((FAIL + 1))
fi

# 22. Reports & Analytics
log_test "22. Admin retrieves Sales & Revenue Report"
RESP=$(curl -s -w "\n%{http_code}" "$BASE_URL/api/reports/sales" \
  -H "Authorization: Bearer $ADMIN_TOKEN")
STATUS=$(echo "$RESP" | tail -n1)
BODY=$(echo "$RESP" | sed '$d')
assert_status 200 "$STATUS" "Sales report retrieved"
TOTAL_REVENUE=$(echo "$BODY" | jq -r '.totalRevenue')
echo -e "Total Revenue reported: \$${TOTAL_REVENUE}"

log_test "23. Admin retrieves Top Selling Products"
RESP=$(curl -s -w "\n%{http_code}" "$BASE_URL/api/reports/top-products" \
  -H "Authorization: Bearer $ADMIN_TOKEN")
STATUS=$(echo "$RESP" | tail -n1)
BODY=$(echo "$RESP" | sed '$d')
assert_status 200 "$STATUS" "Top selling products retrieved"

log_test "24. Admin retrieves Category Performance Report"
RESP=$(curl -s -w "\n%{http_code}" "$BASE_URL/api/reports/categories" \
  -H "Authorization: Bearer $ADMIN_TOKEN")
STATUS=$(echo "$RESP" | tail -n1)
BODY=$(echo "$RESP" | sed '$d')
assert_status 200 "$STATUS" "Category performance report retrieved"

log_test "25. Customer denied access to Reports (403 Forbidden)"
RESP=$(curl -s -w "\n%{http_code}" "$BASE_URL/api/reports/sales" \
  -H "Authorization: Bearer $CUSTOMER_TOKEN")
STATUS=$(echo "$RESP" | tail -n1)
assert_status 403 "$STATUS" "Customer role forbidden from reports"

# 26. Check Low Stock endpoint
log_test "26. Check Low Stock alerts"
RESP=$(curl -s -w "\n%{http_code}" "$BASE_URL/api/inventory/low-stock" \
  -H "Authorization: Bearer $ADMIN_TOKEN")
STATUS=$(echo "$RESP" | tail -n1)
assert_status 200 "$STATUS" "Low stock products query succeeds"

echo -e "\n${YELLOW}================================================================${NC}"
echo -e "${YELLOW}   E2E INTEGRATION TEST SUMMARY                                 ${NC}"
echo -e "${YELLOW}================================================================${NC}"
echo -e "${GREEN}PASSED: $PASS${NC}"
if [ "$FAIL" -gt 0 ]; then
  echo -e "${RED}FAILED: $FAIL${NC}"
  exit 1
else
  echo -e "${GREEN}ALL $PASS TESTS PASSED SUCCESSFULLY! 🚀${NC}"
  exit 0
fi
