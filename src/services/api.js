// ============================================
// Secure API Service - All operations via Edge Functions
// ============================================
// This service replaces direct Supabase calls with secure
// Edge Function calls that include authentication and authorization.

const BASE_URL = import.meta.env.VITE_SUPABASE_URL;
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Store admin password in memory
let adminPassword = null;

/**
 * Initialize password from sessionStorage on page load
 */
function initPasswordFromSession() {
  if (typeof window !== 'undefined') {
    try {
      const authData = sessionStorage.getItem("investorAuth");
      if (authData) {
        const parsed = JSON.parse(authData);
        if (parsed.password) {
          adminPassword = parsed.password;
        }
      }
    } catch (e) {
      console.error("Error loading auth from session:", e);
    }
  }
}

// Auto-initialize on module load
initPasswordFromSession();

/**
 * Set the admin password for authenticated requests
 * Called after successful login
 */
export function setAdminPassword(password) {
  adminPassword = password;
}

/**
 * Clear the admin password (logout)
 */
export function clearAdminPassword() {
  adminPassword = null;
  if (typeof window !== 'undefined') {
    sessionStorage.removeItem("investorAuth");
  }
}

/**
 * Logout and clear all authentication data
 */
export function logout() {
  clearAdminPassword();
}

/**
 * Call an Edge Function
 * @param {string} functionName - Name of the Edge Function
 * @param {object} body - Request body
 * @param {boolean} requiresAuth - Whether this requires admin authentication
 */
async function callEdgeFunction(functionName, body = {}, requiresAuth = true) {
  const headers = {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${ANON_KEY}`,
    "apikey": ANON_KEY,
  };

  // Add admin password header for authenticated requests
  if (requiresAuth) {
    if (!adminPassword) {
      throw new Error("Authentication required. Please log in again.");
    }
    headers["x-admin-password"] = adminPassword;
  }

  const response = await fetch(`${BASE_URL}/functions/v1/${functionName}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    let error;
    try {
      error = await response.json();
    } catch (e) {
      throw new Error(`Request failed: ${response.status} ${response.statusText}`);
    }
    const errorMessage = error.error || error.message || "Request failed";
    throw new Error(errorMessage);
  }

  return await response.json();
}

// ============================================
// Authentication
// ============================================

/**
 * Authenticate with password
 * @param {string} password - The password to authenticate with
 */
export async function adminAuth(password) {
  const response = await fetch(`${BASE_URL}/functions/v1/admin-auth`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${ANON_KEY}`,
      "apikey": ANON_KEY,
    },
    body: JSON.stringify({ password }),
  });

  if (!response.ok) {
    let error;
    try {
      error = await response.json();
    } catch (e) {
      throw new Error(`Authentication failed: ${response.status} ${response.statusText}`);
    }
    const errorMessage = error.message || error.error || error.details || "Authentication failed";
    throw new Error(errorMessage);
  }

  const data = await response.json();
  
  // Store password for subsequent requests
  if (data.authenticated) {
    setAdminPassword(password);
  }
  
  return data;
}

// ============================================
// KPI Data
// ============================================

/**
 * Get aggregated KPI data
 */
export async function getKPIs() {
  return await callEdgeFunction("data-read", { operation: "getKPIs" }, true);
}

// ============================================
// Cash Position CRUD
// ============================================

export async function listCashPositions() {
  const result = await callEdgeFunction("data-read", { 
    operation: "list", 
    table: "cash_position" 
  }, true);
  return result.data;
}

export async function createCashPosition(cashPosition) {
  const result = await callEdgeFunction("data-write", { 
    operation: "create", 
    table: "cash_position",
    data: cashPosition
  }, true);
  return result.data;
}

export async function updateCashPosition(id, updates) {
  const result = await callEdgeFunction("data-write", { 
    operation: "update", 
    table: "cash_position",
    id,
    data: updates
  }, true);
  return result.data;
}

// ============================================
// Monthly Burn CRUD
// ============================================

export async function listMonthlyBurns() {
  const result = await callEdgeFunction("data-read", { 
    operation: "list", 
    table: "monthly_burn" 
  }, true);
  return result.data;
}

export async function createMonthlyBurn(monthlyBurn) {
  const result = await callEdgeFunction("data-write", { 
    operation: "create", 
    table: "monthly_burn",
    data: monthlyBurn
  }, true);
  return result.data;
}

export async function updateMonthlyBurn(id, updates) {
  const result = await callEdgeFunction("data-write", { 
    operation: "update", 
    table: "monthly_burn",
    id,
    data: updates
  }, true);
  return result.data;
}

// ============================================
// Customer CRUD
// ============================================

export async function listCustomers() {
  const result = await callEdgeFunction("data-read", { 
    operation: "list", 
    table: "customer" 
  }, true);
  return result.data;
}

export async function getCustomer(id) {
  const result = await callEdgeFunction("data-read", { 
    operation: "get", 
    table: "customer",
    id
  }, true);
  return result.data;
}

export async function createCustomer(customer) {
  const result = await callEdgeFunction("data-write", { 
    operation: "create", 
    table: "customer",
    data: customer
  }, true);
  return result.data;
}

export async function updateCustomer(id, updates) {
  const result = await callEdgeFunction("data-write", { 
    operation: "update", 
    table: "customer",
    id,
    data: updates
  }, true);
  return result.data;
}

export async function deleteCustomer(id) {
  await callEdgeFunction("data-write", { 
    operation: "delete", 
    table: "customer",
    id
  }, true);
}

// ============================================
// Pipeline Client CRUD
// ============================================

export async function listPipelineClients() {
  const result = await callEdgeFunction("data-read", { 
    operation: "list", 
    table: "pipeline_client" 
  }, true);
  return result.data;
}

export async function getPipelineClient(id) {
  const result = await callEdgeFunction("data-read", { 
    operation: "get", 
    table: "pipeline_client",
    id
  }, true);
  return result.data;
}

export async function createPipelineClient(pipelineClient) {
  const result = await callEdgeFunction("data-write", { 
    operation: "create", 
    table: "pipeline_client",
    data: pipelineClient
  }, true);
  return result.data;
}

export async function updatePipelineClient(id, updates) {
  const result = await callEdgeFunction("data-write", { 
    operation: "update", 
    table: "pipeline_client",
    id,
    data: updates
  }, true);
  return result.data;
}

export async function deletePipelineClient(id) {
  await callEdgeFunction("data-write", { 
    operation: "delete", 
    table: "pipeline_client",
    id
  }, true);
}

// ============================================
// Employee Count CRUD
// ============================================

export async function listEmployeeCounts() {
  const result = await callEdgeFunction("data-read", { 
    operation: "list", 
    table: "employee_count" 
  }, true);
  return result.data;
}

export async function createEmployeeCount(employeeCount) {
  const result = await callEdgeFunction("data-write", { 
    operation: "create", 
    table: "employee_count",
    data: employeeCount
  }, true);
  return result.data;
}

export async function updateEmployeeCount(id, updates) {
  const result = await callEdgeFunction("data-write", { 
    operation: "update", 
    table: "employee_count",
    id,
    data: updates
  }, true);
  return result.data;
}

// ============================================
// Quarter Goal CRUD
// ============================================

export async function listQuarterGoals(quarter, year) {
  const result = await callEdgeFunction("data-read", { 
    operation: "list", 
    table: "quarter_goal",
    filters: { quarter, year }
  }, true);
  return result.data;
}

export async function createQuarterGoal(goal) {
  const result = await callEdgeFunction("data-write", { 
    operation: "create", 
    table: "quarter_goal",
    data: goal
  }, true);
  return result.data;
}

export async function updateQuarterGoal(id, updates) {
  const result = await callEdgeFunction("data-write", { 
    operation: "update", 
    table: "quarter_goal",
    id,
    data: updates
  }, true);
  return result.data;
}

export async function deleteQuarterGoal(id) {
  await callEdgeFunction("data-write", { 
    operation: "delete", 
    table: "quarter_goal",
    id
  }, true);
}

