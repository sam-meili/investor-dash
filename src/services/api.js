import { supabase } from "@/lib/supabase";

// Admin auth function - must be called before any data access
export async function adminAuth(password) {
  const response = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-auth`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({ password }),
    }
  );

  if (!response.ok) {
    let error;
    try {
      error = await response.json();
    } catch (e) {
      // If response is not JSON, use status text
      throw new Error(`Authentication failed: ${response.status} ${response.statusText}`);
    }
    // Show the actual error message from Supabase
    const errorMessage = error.message || error.error || error.details || "Authentication failed";
    console.error("Supabase Edge Function error:", error);
    throw new Error(errorMessage);
  }

  const data = await response.json();
  return data;
}

// Get KPIs - aggregates data from all tables
export async function getKPIs() {
  const { data: cashPositions } = await supabase
    .from("cash_position")
    .select("*")
    .order("date", { ascending: false })
    .limit(1);

  const { data: monthlyBurns } = await supabase
    .from("monthly_burn")
    .select("*")
    .order("month", { ascending: false })
    .limit(1);

  const { data: customers } = await supabase.from("customer").select("*");

  const { data: employeeCounts } = await supabase
    .from("employee_count")
    .select("*")
    .order("date", { ascending: false });

  const { data: pipelineClients } = await supabase
    .from("pipeline_client")
    .select("*");

  const customerCount = customers?.length || 0;
  const totalARR =
    customers?.reduce((sum, customer) => sum + (customer.arr || 0), 0) || 0;
  const totalContractValue =
    customers?.reduce(
      (sum, customer) => sum + (customer.contract_value || 0),
      0
    ) || 0;

  const latestFullTimeCount =
    employeeCounts
      ?.filter((ec) => ec.is_full_time === true)
      .sort((a, b) => new Date(b.date) - new Date(a.date))[0]?.count || 0;
  const latestContractorCount =
    employeeCounts
      ?.filter((ec) => ec.is_full_time === false)
      .sort((a, b) => new Date(b.date) - new Date(a.date))[0]?.count || 0;

  // Format pipeline clients with days since engagement
  const formatPipelineClient = (p) => ({
    id: p.id,
    name: p.name,
    segment: p.segment,
    stage: p.stage || "initial_meeting",
    estimatedContractSize: p.estimated_contract_size || 0,
    engagementStartDate: p.engagement_start_date,
    status: p.status,
    notes: p.notes,
    daysSinceEngagement: p.engagement_start_date
      ? Math.floor(
          (new Date().getTime() - new Date(p.engagement_start_date).getTime()) /
            (1000 * 60 * 60 * 24)
        )
      : 0,
  });

  const formattedClients = (pipelineClients || []).map(formatPipelineClient);

  // Group pipeline by segment and stage
  const segments = ["smb", "mid_market", "large_cap"];
  const stages = ["initial_meeting", "pilot_scoping", "pilot", "contracting"];

  const pipelineMatrix = {};
  segments.forEach((segment) => {
    pipelineMatrix[segment] = {};
    stages.forEach((stage) => {
      const clients = formattedClients.filter(
        (p) => p.segment === segment && p.stage === stage
      );
      pipelineMatrix[segment][stage] = {
        count: clients.length,
        clients: clients,
        totalValue: clients.reduce(
          (sum, c) => sum + (c.estimatedContractSize || 0),
          0
        ),
      };
    });
  });

  return {
    cashPosition: cashPositions?.[0]?.amount || 0,
    cashPositionDate: cashPositions?.[0]?.date || null,
    monthlyBurn: monthlyBurns?.[0]?.amount || 0,
    monthlyBurnMonth: monthlyBurns?.[0]?.month || null,
    customerCount,
    totalARR,
    totalContractValue,
    fullTimeEmployeeCount: latestFullTimeCount,
    contractorCount: latestContractorCount,
    customers: (customers || []).map((c) => ({
      id: c.id,
      name: c.name,
      is_pilot: c.is_pilot,
      contract_value: c.contract_value || 0,
      arr: c.arr || 0,
      start_date: c.start_date,
      status: c.status,
    })),
    pipelineClients: formattedClients,
    pipelineMatrix: pipelineMatrix,
  };
}

// Cash Position CRUD
export async function listCashPositions() {
  const { data, error } = await supabase
    .from("cash_position")
    .select("*")
    .order("date", { ascending: false });
  if (error) throw error;
  return data;
}

export async function createCashPosition(cashPosition) {
  const { data, error } = await supabase
    .from("cash_position")
    .insert(cashPosition)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateCashPosition(id, updates) {
  const { data, error } = await supabase
    .from("cash_position")
    .update(updates)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// Monthly Burn CRUD
export async function listMonthlyBurns() {
  const { data, error } = await supabase
    .from("monthly_burn")
    .select("*")
    .order("month", { ascending: false });
  if (error) throw error;
  return data;
}

export async function createMonthlyBurn(monthlyBurn) {
  const { data, error } = await supabase
    .from("monthly_burn")
    .insert(monthlyBurn)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateMonthlyBurn(id, updates) {
  const { data, error } = await supabase
    .from("monthly_burn")
    .update(updates)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// Customer CRUD
export async function listCustomers() {
  const { data, error } = await supabase.from("customer").select("*");
  if (error) throw error;
  return data;
}

export async function getCustomer(id) {
  const { data, error } = await supabase
    .from("customer")
    .select("*")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data;
}

export async function createCustomer(customer) {
  const { data, error } = await supabase
    .from("customer")
    .insert(customer)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateCustomer(id, updates) {
  const { data, error } = await supabase
    .from("customer")
    .update(updates)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteCustomer(id) {
  const { error } = await supabase.from("customer").delete().eq("id", id);
  if (error) throw error;
}

// Pipeline Client CRUD
export async function listPipelineClients() {
  const { data, error } = await supabase.from("pipeline_client").select("*");
  if (error) throw error;
  return data;
}

export async function getPipelineClient(id) {
  const { data, error } = await supabase
    .from("pipeline_client")
    .select("*")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data;
}

export async function createPipelineClient(pipelineClient) {
  const { data, error } = await supabase
    .from("pipeline_client")
    .insert(pipelineClient)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updatePipelineClient(id, updates) {
  const { data, error } = await supabase
    .from("pipeline_client")
    .update(updates)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deletePipelineClient(id) {
  const { error } = await supabase
    .from("pipeline_client")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

// Employee Count CRUD
export async function listEmployeeCounts() {
  const { data, error } = await supabase
    .from("employee_count")
    .select("*")
    .order("date", { ascending: false });
  if (error) throw error;
  return data;
}

export async function createEmployeeCount(employeeCount) {
  const { data, error } = await supabase
    .from("employee_count")
    .insert(employeeCount)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateEmployeeCount(id, updates) {
  const { data, error } = await supabase
    .from("employee_count")
    .update(updates)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// Quarter Goal CRUD
export async function listQuarterGoals(quarter, year) {
  const { data, error } = await supabase
    .from("quarter_goal")
    .select("*")
    .eq("quarter", quarter)
    .eq("year", year)
    .order("order", { ascending: true });
  if (error) throw error;
  return data;
}

export async function createQuarterGoal(goal) {
  const { data, error } = await supabase
    .from("quarter_goal")
    .insert(goal)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateQuarterGoal(id, updates) {
  const { data, error } = await supabase
    .from("quarter_goal")
    .update(updates)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteQuarterGoal(id) {
  const { error } = await supabase
    .from("quarter_goal")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

