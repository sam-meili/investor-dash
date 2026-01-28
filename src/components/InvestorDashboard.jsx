import React, { useState, useEffect } from "react";
import { Card, CardTitle, CardBody } from "@/catalyst/card";
import { Button } from "@/catalyst/button";
import { Text, Heading, Input, Field, Label } from "@/catalyst";
import { Dialog } from "@/catalyst/dialog";
import toast from "react-hot-toast";
import { format } from "date-fns";
import { v4 as uuidv4 } from "uuid";
import { EyeIcon } from "@heroicons/react/24/outline";
import {
  getKPIs,
  listCashPositions,
  createCashPosition,
  updateCashPosition,
  listMonthlyBurns,
  createMonthlyBurn,
  updateMonthlyBurn,
  listCustomers,
  getCustomer,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  getPipelineClient,
  createPipelineClient,
  updatePipelineClient,
  deletePipelineClient,
  createEmployeeCount,
  updateEmployeeCount,
  listQuarterGoals,
  createQuarterGoal,
  updateQuarterGoal,
  deleteQuarterGoal,
  createPipelineNote,
  updatePipelineNote,
  deletePipelineNote,
} from "@/services/api";

export default function InvestorDashboard({ isArtemisManagement = false }) {
  const [kpis, setKpis] = useState({
    cashPosition: 0,
    cashPositionDate: null,
    monthlyBurn: 0,
    monthlyBurnMonth: null,
    customerCount: 0,
    totalARR: 0,
    totalContractValue: 0,
    fullTimeEmployeeCount: 0,
    contractorCount: 0,
    customers: [],
    pipelineClients: [],
    pipelineNotes: [],
    pipelineMatrix: {
      smb: {
        initial_meeting: { count: 0, clients: [], totalValue: 0 },
        pilot_scoping: { count: 0, clients: [], totalValue: 0 },
        pilot: { count: 0, clients: [], totalValue: 0 },
        contracting: { count: 0, clients: [], totalValue: 0 },
      },
      mid_market: {
        initial_meeting: { count: 0, clients: [], totalValue: 0 },
        pilot_scoping: { count: 0, clients: [], totalValue: 0 },
        pilot: { count: 0, clients: [], totalValue: 0 },
        contracting: { count: 0, clients: [], totalValue: 0 },
      },
      large_cap: {
        initial_meeting: { count: 0, clients: [], totalValue: 0 },
        pilot_scoping: { count: 0, clients: [], totalValue: 0 },
        pilot: { count: 0, clients: [], totalValue: 0 },
        contracting: { count: 0, clients: [], totalValue: 0 },
      },
    },
  });
  const [isLoading, setIsLoading] = useState(true);
  const [editingField, setEditingField] = useState(null);
  const [editValues, setEditValues] = useState({});
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [showPipelineModal, setShowPipelineModal] = useState(false);
  const [showEmployeeModal, setShowEmployeeModal] = useState(false);
  const [showPipelineCellModal, setShowPipelineCellModal] = useState(false);
  const [showCustomerListModal, setShowCustomerListModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [editingPipeline, setEditingPipeline] = useState(null);
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [selectedPipelineCell, setSelectedPipelineCell] = useState(null);
  const [quarterGoals, setQuarterGoals] = useState([]);
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [editingGoal, setEditingGoal] = useState(null);
  const [editingPipelineNotes, setEditingPipelineNotes] = useState(false);
  const [tempPipelineNotes, setTempPipelineNotes] = useState([]);

  useEffect(() => {
    fetchKPIs();
    fetchQuarterGoals();
  }, []);

  const getCurrentQuarter = () => {
    const now = new Date();
    const quarter = Math.floor(now.getMonth() / 3) + 1;
    return { quarter, year: now.getFullYear() };
  };

  const fetchQuarterGoals = async () => {
    try {
      const { quarter, year } = getCurrentQuarter();
      const data = await listQuarterGoals(quarter, year);

      const sortedGoals = (data || [])
        .sort((a, b) => (a.order || 0) - (b.order || 0))
        .map((goal) => {
          // Calculate current value based on metric type
          let currentValue = goal.current_value || 0;
          // Always recalculate for auto-calculated metrics
          if (goal.metric_type === "ARR") {
            currentValue = kpis.totalARR || 0;
          } else if (goal.metric_type === "customers") {
            currentValue = kpis.customerCount || 0;
          } else if (goal.metric_type === "pipeline_value") {
            const totalPipelineValue = Object.values(
              kpis.pipelineMatrix || {}
            ).reduce(
              (sum, segment) =>
                sum +
                Object.values(segment || {}).reduce(
                  (segSum, stage) => segSum + (stage.totalValue || 0),
                  0
                ),
              0
            );
            currentValue = totalPipelineValue;
          }
          return { ...goal, currentValue };
        });

      setQuarterGoals(sortedGoals);
    } catch (error) {
      console.error("Error fetching quarter goals:", error);
    }
  };

  useEffect(() => {
    if (!isLoading && kpis.totalARR !== undefined) {
      fetchQuarterGoals();
    }
  }, [kpis.totalARR, kpis.customerCount, kpis.pipelineMatrix, isLoading]);

  const fetchKPIs = async () => {
    try {
      setIsLoading(true);
      const data = await getKPIs();
      if (data) {
        setKpis(data);
      }
    } catch (error) {
      console.error("Error fetching KPIs:", error);
      toast.error("Failed to load KPI data");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveCashPosition = async () => {
    try {
      const amount = parseFloat(editValues.cashPosition) || 0;
      const date =
        editValues.cashPositionDate || new Date().toISOString().split("T")[0];

      // Get all cash positions to find the latest
      const existing = await listCashPositions();
      const latest = existing?.sort(
        (a, b) => new Date(b.date) - new Date(a.date)
      )[0];

      if (
        latest &&
        new Date(latest.date).toISOString().split("T")[0] === date
      ) {
        // Update existing
        await updateCashPosition(latest.id, { amount, date });
      } else {
        // Create new
        await createCashPosition({
          id: uuidv4(),
          amount,
          date,
        });
      }

      toast.success("Cash position saved");
      setEditingField(null);
      fetchKPIs();
    } catch (error) {
      console.error("Error saving cash position:", error);
      toast.error("Failed to save cash position");
    }
  };

  const handleSaveMonthlyBurn = async () => {
    try {
      const amount = parseFloat(editValues.monthlyBurn) || 0;
      const month =
        editValues.monthlyBurnMonth || new Date().toISOString().split("T")[0];

      // Get all monthly burns to find the latest
      const existing = await listMonthlyBurns();
      const latest = existing?.sort(
        (a, b) => new Date(b.month) - new Date(a.month)
      )[0];

      if (
        latest &&
        new Date(latest.month).toISOString().split("T")[0] === month
      ) {
        // Update existing
        await updateMonthlyBurn(latest.id, { amount, month });
      } else {
        // Create new
        await createMonthlyBurn({
          id: uuidv4(),
          amount,
          month,
        });
      }

      toast.success("Monthly burn saved");
      setEditingField(null);
      fetchKPIs();
    } catch (error) {
      console.error("Error saving monthly burn:", error);
      toast.error("Failed to save monthly burn");
    }
  };

  const handleSaveCustomer = async () => {
    try {
      const customerData = {
        id: editingCustomer?.id || uuidv4(),
        name: editValues.customerName || "",
        is_pilot: editValues.isPilot || false,
        contract_value: parseFloat(editValues.contractValue) || 0,
        arr: parseFloat(editValues.arr) || 0,
        start_date: editValues.startDate || null,
        status: editValues.status || "",
      };

      if (editingCustomer) {
        await updateCustomer(editingCustomer.id, customerData);
        toast.success("Customer updated");
      } else {
        await createCustomer(customerData);
        toast.success("Customer added");
      }

      setShowCustomerModal(false);
      setEditingCustomer(null);
      setEditValues({});
      fetchKPIs();
    } catch (error) {
      console.error("Error saving customer:", error);
      toast.error("Failed to save customer");
    }
  };

  const handleSavePipelineClient = async () => {
    try {
      const pipelineData = {
        id: editingPipeline?.id || uuidv4(),
        name: editValues.pipelineName || "",
        segment: editValues.segment || "smb",
        stage: editValues.stage || "initial_meeting",
        estimated_contract_size:
          parseFloat(editValues.estimatedContractSize) || 0,
        engagement_start_date:
          editValues.engagementStartDate ||
          new Date().toISOString().split("T")[0],
        status: editValues.pipelineStatus || "",
        notes: editValues.pipelineNotes || "",
      };

      if (editingPipeline) {
        await updatePipelineClient(editingPipeline.id, pipelineData);
        toast.success("Pipeline client updated");
      } else {
        await createPipelineClient(pipelineData);
        toast.success("Pipeline client added");
      }

      setShowPipelineModal(false);
      setEditingPipeline(null);
      setEditValues({});
      fetchKPIs();
    } catch (error) {
      console.error("Error saving pipeline client:", error);
      toast.error("Failed to save pipeline client");
    }
  };

  const handleSaveEmployeeCount = async () => {
    try {
      const employeeData = {
        id: editingEmployee?.id || uuidv4(),
        count: parseInt(editValues.employeeCount) || 0,
        date: editValues.employeeDate || new Date().toISOString().split("T")[0],
        is_full_time:
          editValues.isFullTime !== undefined ? editValues.isFullTime : true,
      };

      if (editingEmployee) {
        await updateEmployeeCount(editingEmployee.id, employeeData);
        toast.success("Employee count updated");
      } else {
        await createEmployeeCount(employeeData);
        toast.success("Employee count added");
      }

      setShowEmployeeModal(false);
      setEditingEmployee(null);
      setEditValues({});
      fetchKPIs();
    } catch (error) {
      console.error("Error saving employee count:", error);
      toast.error("Failed to save employee count");
    }
  };

  const handleDeleteCustomer = async (id) => {
    if (!confirm("Are you sure you want to delete this customer?")) return;
    try {
      await deleteCustomer(id);
      toast.success("Customer deleted");
      fetchKPIs();
    } catch (error) {
      console.error("Error deleting customer:", error);
      toast.error("Failed to delete customer");
    }
  };

  const handleDeletePipeline = async (id) => {
    if (!confirm("Are you sure you want to delete this pipeline client?"))
      return;
    try {
      await deletePipelineClient(id);
      toast.success("Pipeline client deleted");
      fetchKPIs();
    } catch (error) {
      console.error("Error deleting pipeline client:", error);
      toast.error("Failed to delete pipeline client");
    }
  };

  const openCustomerModal = async (customer = null) => {
    if (customer && customer.id) {
      // Fetch full customer data if we only have partial data
      try {
        const data = await getCustomer(customer.id);
        if (data) {
          setEditingCustomer(data);
          setEditValues({
            customerName: data.name || "",
            isPilot: data.is_pilot || false,
            contractValue: data.contract_value || 0,
            arr: data.arr || 0,
            startDate: data.start_date || "",
            status: data.status || "",
          });
        } else {
          setEditingCustomer(customer);
          setEditValues({
            customerName: customer.name || "",
            isPilot: customer.is_pilot || false,
            contractValue: customer.contract_value || 0,
            arr: customer.arr || 0,
            startDate: customer.start_date || "",
            status: customer.status || "",
          });
        }
      } catch (error) {
        console.error("Error fetching customer:", error);
        setEditingCustomer(customer);
        setEditValues({
          customerName: customer.name || "",
          isPilot: customer.is_pilot || false,
          contractValue: customer.contract_value || 0,
          arr: customer.arr || 0,
          startDate: customer.start_date || "",
          status: customer.status || "",
        });
      }
    } else {
      setEditingCustomer(null);
      setEditValues({});
    }
    setShowCustomerModal(true);
  };

  const openPipelineModal = async (client = null) => {
    if (client && client.id) {
      // Fetch full pipeline client data if we only have partial data
      try {
        const data = await getPipelineClient(client.id);
        if (data) {
          setEditingPipeline(data);
          setEditValues({
            pipelineName: data.name || "",
            segment: data.segment || "smb",
            stage: data.stage || "initial_meeting",
            estimatedContractSize: data.estimated_contract_size || 0,
            engagementStartDate: data.engagement_start_date || "",
            pipelineStatus: data.status || "",
            pipelineNotes: data.notes || "",
          });
        } else {
          setEditingPipeline(client);
          setEditValues({
            pipelineName: client.name || "",
            segment: client.segment || "smb",
            stage: client.stage || "initial_meeting",
            estimatedContractSize: client.estimatedContractSize || 0,
            engagementStartDate: client.engagementStartDate || "",
            pipelineStatus: client.status || "",
            pipelineNotes: client.notes || "",
          });
        }
      } catch (error) {
        console.error("Error fetching pipeline client:", error);
        setEditingPipeline(client);
        setEditValues({
          pipelineName: client.name || "",
          segment: client.segment || "smb",
          stage: client.stage || "initial_meeting",
          estimatedContractSize: client.estimatedContractSize || 0,
          engagementStartDate: client.engagementStartDate || "",
          pipelineStatus: client.status || "",
          pipelineNotes: client.notes || "",
        });
      }
    } else {
      setEditingPipeline(null);
      setEditValues({ segment: "smb", stage: "initial_meeting" });
    }
    setShowPipelineModal(true);
  };

  const openPipelineCellModal = (segment, stage) => {
    setSelectedPipelineCell({ segment, stage });
    setShowPipelineCellModal(true);
  };

  const openEmployeeModal = (employee = null, isFullTime = true) => {
    setEditingEmployee(employee);
    if (employee) {
      setEditValues({
        employeeCount: employee.count,
        employeeDate: employee.date || "",
        isFullTime: employee.is_full_time,
      });
    } else {
      // Get latest count for this type if no employee provided
      const latestCount = isFullTime
        ? kpis.fullTimeEmployeeCount
        : kpis.contractorCount;
      setEditValues({
        isFullTime: isFullTime,
        employeeCount: latestCount || 0,
        employeeDate: format(new Date(), "yyyy-MM-dd"),
      });
    }
    setShowEmployeeModal(true);
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value || 0);
  };

  const formatNumber = (value) => {
    return new Intl.NumberFormat("en-US").format(value || 0);
  };

  const handleSaveGoal = async () => {
    try {
      const { quarter, year } = getCurrentQuarter();
      const goalData = {
        id: editingGoal?.id || uuidv4(),
        name: editValues.goalName || "",
        target_value: parseFloat(editValues.targetValue) || 0,
        current_value: parseFloat(editValues.currentValue) || 0,
        quarter,
        year,
        metric_type: editValues.metricType || "custom",
        order: parseInt(editValues.order) || 0,
      };

      if (editingGoal) {
        await updateQuarterGoal(editingGoal.id, goalData);
        toast.success("Goal updated");
      } else {
        await createQuarterGoal(goalData);
        toast.success("Goal added");
      }

      setShowGoalModal(false);
      setEditingGoal(null);
      setEditValues({});
      fetchQuarterGoals();
    } catch (error) {
      console.error("Error saving goal:", error);
      toast.error("Failed to save goal");
    }
  };

  const handleDeleteGoal = async (id) => {
    if (!confirm("Are you sure you want to delete this goal?")) return;
    try {
      await deleteQuarterGoal(id);
      toast.success("Goal deleted");
      fetchQuarterGoals();
    } catch (error) {
      console.error("Error deleting goal:", error);
      toast.error("Failed to delete goal");
    }
  };

  const openGoalModal = (goal = null) => {
    if (goal) {
      setEditingGoal(goal);
      setEditValues({
        goalName: goal.name || "",
        targetValue: goal.target_value || 0,
        currentValue: goal.currentValue || goal.current_value || 0,
        metricType: goal.metric_type || "custom",
        order: goal.order || 0,
      });
    } else {
      setEditingGoal(null);
      setEditValues({
        metricType: "custom",
        order: quarterGoals.length,
      });
    }
    setShowGoalModal(true);
  };

  const getQuarterLabel = () => {
    const { quarter, year } = getCurrentQuarter();
    return `Q${quarter} ${year}`;
  };

  const handleEditPipelineNotes = () => {
    setTempPipelineNotes(
      kpis.pipelineNotes?.map((note) => ({ ...note })) || []
    );
    setEditingPipelineNotes(true);
  };

  const handleCancelEditPipelineNotes = () => {
    setTempPipelineNotes([]);
    setEditingPipelineNotes(false);
  };

  const handleSavePipelineNotes = async () => {
    try {
      const currentNotes = kpis.pipelineNotes || [];
      const currentIds = new Set(currentNotes.map((n) => n.id));
      const tempIds = new Set(tempPipelineNotes.map((n) => n.id));

      // Delete removed notes
      for (const note of currentNotes) {
        if (!tempIds.has(note.id)) {
          await deletePipelineNote(note.id);
        }
      }

      // Create or update notes
      for (let i = 0; i < tempPipelineNotes.length; i++) {
        const note = tempPipelineNotes[i];
        const noteData = {
          id: note.id,
          content: note.content,
          order: i,
        };

        if (currentIds.has(note.id)) {
          // Update existing
          await updatePipelineNote(note.id, noteData);
        } else {
          // Create new
          await createPipelineNote(noteData);
        }
      }

      toast.success("Pipeline notes saved");
      setEditingPipelineNotes(false);
      setTempPipelineNotes([]);
      fetchKPIs();
    } catch (error) {
      console.error("Error saving pipeline notes:", error);
      toast.error("Failed to save pipeline notes");
    }
  };

  const handleAddPipelineNote = () => {
    setTempPipelineNotes([
      ...tempPipelineNotes,
      { id: uuidv4(), content: "", order: tempPipelineNotes.length },
    ]);
  };

  const handleUpdatePipelineNoteContent = (id, content) => {
    setTempPipelineNotes(
      tempPipelineNotes.map((note) =>
        note.id === id ? { ...note, content } : note
      )
    );
  };

  const handleDeletePipelineNoteTemp = (id) => {
    setTempPipelineNotes(tempPipelineNotes.filter((note) => note.id !== id));
  };

  if (isLoading) {
    return (
      <div className="h-svh flex justify-center items-center">
        <Text>Loading dashboard...</Text>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-zinc-50 dark:bg-zinc-900 p-6 lg:p-10">
      <div className="max-w-7xl mx-auto pb-12">
        {/* Header */}
        <div className="mb-8 flex justify-between items-center">
          <div>
            <Heading>Company Metrics Dashboard</Heading>
            <Text className="mt-2 text-zinc-500 dark:text-zinc-400">
              Key Performance Indicators
            </Text>
          </div>
        </div>

        {/* Quarter Goals Section - Full Width */}
        <Card className="mb-6 w-full !max-w-none" style={{ maxWidth: "100%" }}>
          <CardTitle className="flex justify-between items-center mb-4">
            <span>Current Quarter Goals ({getQuarterLabel()})</span>
            {isArtemisManagement && (
              <Button
                onClick={() => openGoalModal()}
                outline
                className="text-xs ml-4"
              >
                Add Goal
              </Button>
            )}
          </CardTitle>
          <CardBody>
            {quarterGoals.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {quarterGoals.map((goal) => {
                  const progress = Math.min(
                    (goal.currentValue / goal.target_value) * 100,
                    100
                  );
                  const isComplete = goal.currentValue >= goal.target_value;
                  return (
                    <div
                      key={goal.id}
                      className="p-4 bg-zinc-50 dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div className="font-semibold text-zinc-950 dark:text-white">
                          {goal.name}
                        </div>
                        {isArtemisManagement && (
                          <div className="flex gap-1">
                            <Button
                              onClick={() => openGoalModal(goal)}
                              outline
                              className="text-xs px-2 py-1"
                            >
                              Edit
                            </Button>
                            <Button
                              onClick={() => handleDeleteGoal(goal.id)}
                              outline
                              className="text-xs px-2 py-1 text-red-600"
                            >
                              Delete
                            </Button>
                          </div>
                        )}
                      </div>
                      <div className="mb-2">
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-zinc-600 dark:text-zinc-400">
                            {goal.metric_type === "ARR" ||
                            goal.metric_type === "pipeline_value"
                              ? formatCurrency(goal.currentValue)
                              : formatNumber(goal.currentValue)}
                          </span>
                          <span className="text-zinc-600 dark:text-zinc-400">
                            {goal.metric_type === "ARR" ||
                            goal.metric_type === "pipeline_value"
                              ? formatCurrency(goal.target_value)
                              : formatNumber(goal.target_value)}
                          </span>
                        </div>
                        <div className="w-full bg-zinc-200 dark:bg-zinc-700 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full transition-all ${
                              isComplete
                                ? "bg-green-500"
                                : progress >= 75
                                  ? "bg-teal-500"
                                  : progress >= 50
                                    ? "bg-yellow-500"
                                    : "bg-red-500"
                            }`}
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                      </div>
                      <div className="text-xs text-zinc-500 dark:text-zinc-400">
                        {progress.toFixed(1)}% complete
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <Text className="text-zinc-500 dark:text-zinc-400">
                No goals set for this quarter.
                {isArtemisManagement && " Click 'Add Goal' to create one."}
              </Text>
            )}
          </CardBody>
        </Card>

        {/* KPI Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6 auto-rows-min mt-6">
          {/* Cash Position */}
          <Card>
            <CardTitle className="flex justify-between items-center">
              <span>Cash Position</span>
              {isArtemisManagement && (
                <Button
                  onClick={() => {
                    setEditingField("cashPosition");
                    setEditValues({
                      cashPosition: kpis.cashPosition || 0,
                      cashPositionDate: kpis.cashPositionDate
                        ? format(new Date(kpis.cashPositionDate), "yyyy-MM-dd")
                        : format(new Date(), "yyyy-MM-dd"),
                    });
                  }}
                  outline
                  className="text-xs ml-4"
                >
                  {editingField === "cashPosition" ? "Cancel" : "Edit"}
                </Button>
              )}
            </CardTitle>
            <CardBody>
              {editingField === "cashPosition" && isArtemisManagement ? (
                <div className="space-y-4">
                  <Field>
                    <Label>Amount ($)</Label>
                    <Input
                      type="number"
                      value={editValues.cashPosition || 0}
                      onChange={(e) =>
                        setEditValues({
                          ...editValues,
                          cashPosition: e.target.value,
                        })
                      }
                    />
                  </Field>
                  <Field>
                    <Label>Date</Label>
                    <Input
                      type="date"
                      value={editValues.cashPositionDate}
                      onChange={(e) =>
                        setEditValues({
                          ...editValues,
                          cashPositionDate: e.target.value,
                        })
                      }
                    />
                  </Field>
                  <div className="flex gap-2">
                    <Button onClick={handleSaveCashPosition}>Save</Button>
                    <Button onClick={() => setEditingField(null)} outline>
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="text-3xl font-bold text-zinc-950 dark:text-white">
                    {formatCurrency(kpis.cashPosition)}
                  </div>
                  {kpis.cashPositionDate && (
                    <Text className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
                      As of{" "}
                      {format(new Date(kpis.cashPositionDate), "MMM d, yyyy")}
                    </Text>
                  )}
                </>
              )}
            </CardBody>
          </Card>

          {/* Monthly Gross Burn */}
          <Card>
            <CardTitle className="flex justify-between items-center">
              <span>Monthly Gross Burn</span>
              {isArtemisManagement && (
                <Button
                  onClick={() => {
                    setEditingField("monthlyBurn");
                    setEditValues({
                      monthlyBurn: kpis.monthlyBurn || 0,
                      monthlyBurnMonth: kpis.monthlyBurnMonth
                        ? format(new Date(kpis.monthlyBurnMonth), "yyyy-MM-dd")
                        : format(new Date(), "yyyy-MM-dd"),
                    });
                  }}
                  outline
                  className="text-xs ml-4"
                >
                  {editingField === "monthlyBurn" ? "Cancel" : "Edit"}
                </Button>
              )}
            </CardTitle>
            <CardBody>
              {editingField === "monthlyBurn" && isArtemisManagement ? (
                <div className="space-y-4">
                  <Field>
                    <Label>Amount ($)</Label>
                    <Input
                      type="number"
                      value={editValues.monthlyBurn || 0}
                      onChange={(e) =>
                        setEditValues({
                          ...editValues,
                          monthlyBurn: e.target.value,
                        })
                      }
                    />
                  </Field>
                  <Field>
                    <Label>Month</Label>
                    <Input
                      type="date"
                      value={editValues.monthlyBurnMonth}
                      onChange={(e) =>
                        setEditValues({
                          ...editValues,
                          monthlyBurnMonth: e.target.value,
                        })
                      }
                    />
                  </Field>
                  <div className="flex gap-2">
                    <Button onClick={handleSaveMonthlyBurn}>Save</Button>
                    <Button onClick={() => setEditingField(null)} outline>
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="text-3xl font-bold text-zinc-950 dark:text-white">
                    {formatCurrency(kpis.monthlyBurn)}
                  </div>
                  {kpis.monthlyBurnMonth && (
                    <Text className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
                      {format(new Date(kpis.monthlyBurnMonth), "MMMM yyyy")}
                    </Text>
                  )}
                </>
              )}
            </CardBody>
          </Card>

          {/* Customers/Pilots */}
          <Card>
            <CardTitle className="flex justify-between items-center">
              <span>Customers/Pilots</span>
              <div className="flex gap-2">
                <Button
                  onClick={() => setShowCustomerListModal(true)}
                  outline
                  className="text-xs"
                >
                  <EyeIcon className="w-4 h-4 mr-1" />
                  View
                </Button>
                {isArtemisManagement && (
                  <Button
                    onClick={() => openCustomerModal()}
                    outline
                    className="text-xs"
                  >
                    Edit
                  </Button>
                )}
              </div>
            </CardTitle>
            <CardBody>
              <div className="text-3xl font-bold text-zinc-950 dark:text-white">
                {formatNumber(kpis.customerCount)}
              </div>
              <Text className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
                Active customers and pilots
              </Text>
            </CardBody>
          </Card>

          {/* ARR */}
          <Card>
            <CardTitle className="flex justify-between items-center">
              <span>ARR</span>
              <div className="flex gap-2">
                <Button
                  onClick={() => setShowCustomerListModal(true)}
                  outline
                  className="text-xs"
                >
                  <EyeIcon className="w-4 h-4 mr-1" />
                  View
                </Button>
                {isArtemisManagement && (
                  <Button
                    onClick={() => openCustomerModal()}
                    outline
                    className="text-xs"
                  >
                    Edit
                  </Button>
                )}
              </div>
            </CardTitle>
            <CardBody>
              <div className="text-2xl font-bold text-zinc-950 dark:text-white">
                {formatCurrency(kpis.totalARR)}
              </div>
              <Text className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
                Annual Recurring Revenue
              </Text>
            </CardBody>
          </Card>

          {/* Full Time Employees */}
          <Card>
            <CardTitle className="flex justify-between items-center">
              <span>Full Time Employees</span>
              {isArtemisManagement && (
                <Button
                  onClick={() => openEmployeeModal(null, true)}
                  outline
                  className="text-xs ml-4"
                >
                  Edit
                </Button>
              )}
            </CardTitle>
            <CardBody>
              <div className="text-3xl font-bold text-zinc-950 dark:text-white">
                {formatNumber(kpis.fullTimeEmployeeCount)}
              </div>
              <Text className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
                Full-time team members
              </Text>
            </CardBody>
          </Card>

          {/* Contractors */}
          <Card>
            <CardTitle className="flex justify-between items-center">
              <span>Contractors</span>
              {isArtemisManagement && (
                <Button
                  onClick={() => openEmployeeModal(null, false)}
                  outline
                  className="text-xs ml-4"
                >
                  Edit
                </Button>
              )}
            </CardTitle>
            <CardBody>
              <div className="text-3xl font-bold text-zinc-950 dark:text-white">
                {formatNumber(kpis.contractorCount)}
              </div>
              <Text className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
                Contract team members
              </Text>
            </CardBody>
          </Card>
        </div>

        {/* Pipeline Matrix - Full Width Bottom Row */}
        <Card className="mb-8 w-full !max-w-none" style={{ maxWidth: "100%" }}>
          <CardTitle className="flex justify-between items-center mb-4">
            <span>Sales Pipeline</span>
            {isArtemisManagement && (
              <Button
                onClick={() => openPipelineModal()}
                outline
                className="text-xs ml-4"
              >
                Edit
              </Button>
            )}
          </CardTitle>
          <CardBody>
            {/* Pipeline Notes Section */}
            <div className="mb-6 p-4 bg-zinc-50 dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700">
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-sm font-semibold text-zinc-950 dark:text-white">
                  Pipeline Notes
                </h3>
                {isArtemisManagement && (
                  <div className="flex gap-2">
                    {editingPipelineNotes ? (
                      <>
                        <Button
                          onClick={handleSavePipelineNotes}
                          className="text-xs"
                        >
                          Save
                        </Button>
                        <Button
                          onClick={handleCancelEditPipelineNotes}
                          outline
                          className="text-xs"
                        >
                          Cancel
                        </Button>
                      </>
                    ) : (
                      <Button
                        onClick={handleEditPipelineNotes}
                        outline
                        className="text-xs"
                      >
                        Edit Notes
                      </Button>
                    )}
                  </div>
                )}
              </div>
              {editingPipelineNotes ? (
                <div className="space-y-2">
                  {tempPipelineNotes.length > 0 ? (
                    tempPipelineNotes.map((note, index) => (
                      <div key={note.id} className="flex gap-2 items-start">
                        <span className="text-zinc-500 dark:text-zinc-400 mt-2">
                          •
                        </span>
                        <Input
                          value={note.content}
                          onChange={(e) =>
                            handleUpdatePipelineNoteContent(
                              note.id,
                              e.target.value
                            )
                          }
                          placeholder="Enter note..."
                          className="flex-1"
                        />
                        <Button
                          onClick={() => handleDeletePipelineNoteTemp(note.id)}
                          outline
                          className="text-xs text-red-600"
                        >
                          Delete
                        </Button>
                      </div>
                    ))
                  ) : (
                    <Text className="text-zinc-500 dark:text-zinc-400 text-sm">
                      No notes yet. Click "Add Note" to create one.
                    </Text>
                  )}
                  <Button
                    onClick={handleAddPipelineNote}
                    outline
                    className="text-xs mt-2"
                  >
                    Add Note
                  </Button>
                </div>
              ) : (
                <div>
                  {kpis.pipelineNotes?.length > 0 ? (
                    <ul className="space-y-1">
                      {kpis.pipelineNotes.map((note) => (
                        <li
                          key={note.id}
                          className="text-sm text-zinc-700 dark:text-zinc-300"
                        >
                          • {note.content}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <Text className="text-zinc-500 dark:text-zinc-400 text-sm">
                      No pipeline notes yet.
                      {isArtemisManagement &&
                        " Click 'Edit Notes' to add some."}
                    </Text>
                  )}
                </div>
              )}
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full border-collapse" style={{ tableLayout: "fixed" }}>
                <thead>
                  <tr>
                    <th className="p-3 text-left font-semibold text-zinc-950 dark:text-white border-b border-zinc-200 dark:border-zinc-700" style={{ width: "20%" }}>
                      Stage / Segment
                    </th>
                    <th className="p-3 text-center font-semibold text-zinc-950 dark:text-white border-b border-zinc-200 dark:border-zinc-700" style={{ width: "20%" }}>
                      SMB
                    </th>
                    <th className="p-3 text-center font-semibold text-zinc-950 dark:text-white border-b border-zinc-200 dark:border-zinc-700" style={{ width: "20%" }}>
                      Mid Market
                    </th>
                    <th className="p-3 text-center font-semibold text-zinc-950 dark:text-white border-b border-zinc-200 dark:border-zinc-700" style={{ width: "20%" }}>
                      Large Cap
                    </th>
                    <th className="p-3 text-center font-semibold text-zinc-950 dark:text-white border-b border-zinc-200 dark:border-zinc-700" style={{ width: "20%" }}>
                      Row Total
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { key: "initial_meeting", label: "Initial Meeting" },
                    { key: "pilot_scoping", label: "Pilot Scoping" },
                    { key: "pilot", label: "Pilot" },
                    { key: "contracting", label: "Contracting" },
                  ].map((stage) => {
                    // Calculate row total for this stage
                    const rowTotal = ["smb", "mid_market", "large_cap"].reduce(
                      (sum, segment) => {
                        const cellData = kpis.pipelineMatrix?.[segment]?.[
                          stage.key
                        ] || { totalValue: 0 };
                        return sum + (cellData.totalValue || 0);
                      },
                      0
                    );

                    return (
                      <tr
                        key={stage.key}
                        className="border-b border-zinc-100 dark:border-zinc-800"
                      >
                        <td className="p-3 font-medium text-zinc-950 dark:text-white">
                          {stage.label}
                        </td>
                        {["smb", "mid_market", "large_cap"].map((segment) => {
                          const cellData = kpis.pipelineMatrix?.[segment]?.[
                            stage.key
                          ] || {
                            count: 0,
                            clients: [],
                            totalValue: 0,
                          };
                          return (
                            <td
                              key={`${segment}-${stage.key}`}
                              className="p-3 text-center"
                            >
                              <button
                                onClick={() =>
                                  openPipelineCellModal(segment, stage.key)
                                }
                                className="w-full p-4 rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 hover:ring-2 hover:ring-teal-500/50 transition-all cursor-pointer"
                              >
                                <div className="text-2xl font-bold text-zinc-950 dark:text-white mb-1">
                                  {cellData.count || 0}
                                </div>
                                <div className="text-xs text-zinc-500 dark:text-zinc-400">
                                  {formatCurrency(cellData.totalValue || 0)}
                                </div>
                              </button>
                            </td>
                          );
                        })}
                        <td className="p-3 text-center bg-zinc-50 dark:bg-zinc-900">
                          <div className="p-4 rounded-lg">
                            <div className="text-sm font-semibold text-zinc-950 dark:text-white">
                              {formatCurrency(rowTotal)}
                            </div>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {/* Column Totals Row */}
                  <tr className="border-t-2 border-zinc-300 dark:border-zinc-600 bg-zinc-50 dark:bg-zinc-900">
                    <td className="p-3 font-semibold text-zinc-950 dark:text-white">
                      Column Total
                    </td>
                    {["smb", "mid_market", "large_cap"].map((segment) => {
                      const columnTotal = [
                        "initial_meeting",
                        "pilot_scoping",
                        "pilot",
                        "contracting",
                      ].reduce((sum, stageKey) => {
                        const cellData = kpis.pipelineMatrix?.[segment]?.[
                          stageKey
                        ] || { totalValue: 0 };
                        return sum + (cellData.totalValue || 0);
                      }, 0);

                      return (
                        <td key={segment} className="p-3 text-center">
                          <div className="p-4 rounded-lg">
                            <div className="text-sm font-semibold text-zinc-950 dark:text-white">
                              {formatCurrency(columnTotal)}
                            </div>
                          </div>
                        </td>
                      );
                    })}
                    <td className="p-3 text-center bg-zinc-100 dark:bg-zinc-800">
                      <div className="p-4 rounded-lg">
                        <div className="text-base font-bold text-zinc-950 dark:text-white">
                          {formatCurrency(
                            Object.values(kpis.pipelineMatrix || {}).reduce(
                              (sum, segment) =>
                                sum +
                                Object.values(segment || {}).reduce(
                                  (segSum, stage) =>
                                    segSum + (stage.totalValue || 0),
                                  0
                                ),
                              0
                            )
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </CardBody>
        </Card>

        {/* Modals */}
        {/* Goal Modal */}
        <Dialog open={showGoalModal} onClose={() => setShowGoalModal(false)}>
          <div className="p-6">
            <Heading className="mb-4">
              {editingGoal ? "Edit Goal" : "Add Goal"}
            </Heading>
            <div className="space-y-4">
              <Field>
                <Label>Goal Name</Label>
                <Input
                  value={editValues.goalName || ""}
                  onChange={(e) =>
                    setEditValues({ ...editValues, goalName: e.target.value })
                  }
                  placeholder="e.g., Reach $500K ARR"
                />
              </Field>
              <Field>
                <Label>Metric Type</Label>
                <select
                  value={editValues.metricType || "custom"}
                  onChange={(e) =>
                    setEditValues({ ...editValues, metricType: e.target.value })
                  }
                  className="w-full rounded-md border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900"
                >
                  <option value="ARR">ARR (Auto-calculated)</option>
                  <option value="customers">Customers (Auto-calculated)</option>
                  <option value="pipeline_value">
                    Pipeline Value (Auto-calculated)
                  </option>
                  <option value="custom">Custom (Manual)</option>
                </select>
              </Field>
              <Field>
                <Label>Target Value</Label>
                <Input
                  type="number"
                  value={editValues.targetValue || 0}
                  onChange={(e) =>
                    setEditValues({
                      ...editValues,
                      targetValue: e.target.value,
                    })
                  }
                />
              </Field>
              {editValues.metricType === "custom" && (
                <Field>
                  <Label>Current Value</Label>
                  <Input
                    type="number"
                    value={editValues.currentValue || 0}
                    onChange={(e) =>
                      setEditValues({
                        ...editValues,
                        currentValue: e.target.value,
                      })
                    }
                  />
                </Field>
              )}
              <Field>
                <Label>Order (for sorting)</Label>
                <Input
                  type="number"
                  value={editValues.order || 0}
                  onChange={(e) =>
                    setEditValues({ ...editValues, order: e.target.value })
                  }
                />
              </Field>
              <div className="flex gap-2 justify-end">
                <Button onClick={() => setShowGoalModal(false)} outline>
                  Cancel
                </Button>
                <Button onClick={handleSaveGoal}>Save</Button>
              </div>
            </div>
          </div>
        </Dialog>

        {/* Customer Modal */}
        <Dialog
          open={showCustomerModal}
          onClose={() => setShowCustomerModal(false)}
        >
          <div className="p-6">
            <Heading className="mb-4">
              {editingCustomer ? "Edit Customer" : "Add Customer"}
            </Heading>
            <div className="space-y-4">
              <Field>
                <Label>Name</Label>
                <Input
                  value={editValues.customerName || ""}
                  onChange={(e) =>
                    setEditValues({
                      ...editValues,
                      customerName: e.target.value,
                    })
                  }
                />
              </Field>
              <Field>
                <Label>
                  <input
                    type="checkbox"
                    checked={editValues.isPilot || false}
                    onChange={(e) =>
                      setEditValues({
                        ...editValues,
                        isPilot: e.target.checked,
                      })
                    }
                    className="mr-2"
                  />
                  Is Pilot
                </Label>
              </Field>
              <Field>
                <Label>Contract Value ($)</Label>
                <Input
                  type="number"
                  value={editValues.contractValue || 0}
                  onChange={(e) =>
                    setEditValues({
                      ...editValues,
                      contractValue: e.target.value,
                    })
                  }
                />
              </Field>
              <Field>
                <Label>ARR ($)</Label>
                <Input
                  type="number"
                  value={editValues.arr || 0}
                  onChange={(e) =>
                    setEditValues({ ...editValues, arr: e.target.value })
                  }
                />
              </Field>
              <Field>
                <Label>Start Date</Label>
                <Input
                  type="date"
                  value={editValues.startDate || ""}
                  onChange={(e) =>
                    setEditValues({ ...editValues, startDate: e.target.value })
                  }
                />
              </Field>
              <Field>
                <Label>Status</Label>
                <Input
                  value={editValues.status || ""}
                  onChange={(e) =>
                    setEditValues({ ...editValues, status: e.target.value })
                  }
                />
              </Field>
              <div className="flex gap-2 justify-end">
                <Button onClick={() => setShowCustomerModal(false)} outline>
                  Cancel
                </Button>
                <Button onClick={handleSaveCustomer}>Save</Button>
              </div>
            </div>
          </div>
        </Dialog>

        {/* Pipeline Modal */}
        <Dialog
          open={showPipelineModal}
          onClose={() => setShowPipelineModal(false)}
        >
          <div className="p-6">
            <Heading className="mb-4">
              {editingPipeline ? "Edit Pipeline Client" : "Add Pipeline Client"}
            </Heading>
            <div className="space-y-4">
              <Field>
                <Label>Name</Label>
                <Input
                  value={editValues.pipelineName || ""}
                  onChange={(e) =>
                    setEditValues({
                      ...editValues,
                      pipelineName: e.target.value,
                    })
                  }
                />
              </Field>
              <Field>
                <Label>Segment</Label>
                <select
                  value={editValues.segment || "smb"}
                  onChange={(e) =>
                    setEditValues({ ...editValues, segment: e.target.value })
                  }
                  className="w-full rounded-md border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900"
                >
                  <option value="smb">SMB</option>
                  <option value="mid_market">Mid Market</option>
                  <option value="large_cap">Large Cap</option>
                </select>
              </Field>
              <Field>
                <Label>Stage</Label>
                <select
                  value={editValues.stage || "initial_meeting"}
                  onChange={(e) =>
                    setEditValues({ ...editValues, stage: e.target.value })
                  }
                  className="w-full rounded-md border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900"
                >
                  <option value="initial_meeting">Initial Meeting</option>
                  <option value="pilot_scoping">Pilot Scoping</option>
                  <option value="pilot">Pilot</option>
                  <option value="contracting">Contracting</option>
                </select>
              </Field>
              <Field>
                <Label>Estimated Contract Size ($)</Label>
                <Input
                  type="number"
                  value={editValues.estimatedContractSize || 0}
                  onChange={(e) =>
                    setEditValues({
                      ...editValues,
                      estimatedContractSize: e.target.value,
                    })
                  }
                />
              </Field>
              <Field>
                <Label>Engagement Start Date</Label>
                <Input
                  type="date"
                  value={editValues.engagementStartDate || ""}
                  onChange={(e) =>
                    setEditValues({
                      ...editValues,
                      engagementStartDate: e.target.value,
                    })
                  }
                />
              </Field>
              <Field>
                <Label>Status</Label>
                <Input
                  value={editValues.pipelineStatus || ""}
                  onChange={(e) =>
                    setEditValues({
                      ...editValues,
                      pipelineStatus: e.target.value,
                    })
                  }
                />
              </Field>
              <Field>
                <Label>Notes</Label>
                <textarea
                  value={editValues.pipelineNotes || ""}
                  onChange={(e) =>
                    setEditValues({
                      ...editValues,
                      pipelineNotes: e.target.value,
                    })
                  }
                  className="w-full rounded-md border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900"
                  rows={3}
                />
              </Field>
              <div className="flex gap-2 justify-end">
                <Button onClick={() => setShowPipelineModal(false)} outline>
                  Cancel
                </Button>
                <Button onClick={handleSavePipelineClient}>Save</Button>
              </div>
            </div>
          </div>
        </Dialog>

        {/* Employee Count Modal */}
        <Dialog
          open={showEmployeeModal}
          onClose={() => setShowEmployeeModal(false)}
        >
          <div className="p-6">
            <Heading className="mb-4">
              {editingEmployee
                ? `Edit ${editValues.isFullTime !== false ? "Full-Time" : "Contractor"} Employee Count`
                : `Add ${editValues.isFullTime !== false ? "Full-Time" : "Contractor"} Employee Count`}
            </Heading>
            <div className="space-y-4">
              <Field>
                <Label>Count</Label>
                <Input
                  type="number"
                  value={editValues.employeeCount || 0}
                  onChange={(e) =>
                    setEditValues({
                      ...editValues,
                      employeeCount: e.target.value,
                    })
                  }
                />
              </Field>
              <Field>
                <Label>Date</Label>
                <Input
                  type="date"
                  value={editValues.employeeDate || ""}
                  onChange={(e) =>
                    setEditValues({
                      ...editValues,
                      employeeDate: e.target.value,
                    })
                  }
                />
              </Field>
              <Field>
                <Label>
                  <input
                    type="checkbox"
                    checked={
                      editValues.isFullTime !== undefined
                        ? editValues.isFullTime
                        : true
                    }
                    onChange={(e) =>
                      setEditValues({
                        ...editValues,
                        isFullTime: e.target.checked,
                      })
                    }
                    className="mr-2"
                  />
                  Full Time (unchecked = Contractor)
                </Label>
              </Field>
              <div className="flex gap-2 justify-end">
                <Button onClick={() => setShowEmployeeModal(false)} outline>
                  Cancel
                </Button>
                <Button onClick={handleSaveEmployeeCount}>Save</Button>
              </div>
            </div>
          </div>
        </Dialog>

        {/* Pipeline Cell Modal - Shows companies in a specific segment/stage */}
        <Dialog
          open={showPipelineCellModal}
          onClose={() => setShowPipelineCellModal(false)}
        >
          <div className="p-6 max-w-2xl">
            <Heading className="mb-4">
              {selectedPipelineCell && (
                <>
                  {selectedPipelineCell.segment === "smb"
                    ? "SMB"
                    : selectedPipelineCell.segment === "mid_market"
                      ? "Mid Market"
                      : "Large Cap"}{" "}
                  -{" "}
                  {selectedPipelineCell.stage === "initial_meeting"
                    ? "Initial Meeting"
                    : selectedPipelineCell.stage === "pilot_scoping"
                      ? "Pilot Scoping"
                      : selectedPipelineCell.stage === "pilot"
                        ? "Pilot"
                        : "Contracting"}
                </>
              )}
            </Heading>
            {selectedPipelineCell && (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {(() => {
                  const cellData = kpis.pipelineMatrix?.[
                    selectedPipelineCell.segment
                  ]?.[selectedPipelineCell.stage] || {
                    count: 0,
                    clients: [],
                    totalValue: 0,
                  };

                  if (cellData.clients.length === 0) {
                    return (
                      <Text className="text-zinc-500">
                        No companies in this stage
                      </Text>
                    );
                  }

                  return cellData.clients.map((client) => (
                    <div
                      key={client.id}
                      className="p-4 bg-zinc-100 dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div className="font-semibold text-zinc-950 dark:text-white text-lg">
                          {client.name}
                        </div>
                        {isArtemisManagement && (
                          <div className="flex gap-2">
                            <Button
                              onClick={() => {
                                setShowPipelineCellModal(false);
                                openPipelineModal(client);
                              }}
                              outline
                              className="text-xs"
                            >
                              Edit
                            </Button>
                            <Button
                              onClick={() => {
                                handleDeletePipeline(client.id);
                                setShowPipelineCellModal(false);
                              }}
                              outline
                              className="text-xs text-red-600"
                            >
                              Delete
                            </Button>
                          </div>
                        )}
                      </div>
                      <div className="space-y-1">
                        <div className="text-sm text-zinc-600 dark:text-zinc-400">
                          <span className="font-medium">
                            Est. Contract Value:
                          </span>{" "}
                          {formatCurrency(client.estimatedContractSize || 0)}
                        </div>
                        <div className="text-sm text-zinc-600 dark:text-zinc-400">
                          <span className="font-medium">
                            Days Since Engagement:
                          </span>{" "}
                          {client.daysSinceEngagement}
                        </div>
                        {client.status && (
                          <div className="text-sm text-zinc-600 dark:text-zinc-400">
                            <span className="font-medium">Status:</span>{" "}
                            {client.status}
                          </div>
                        )}
                        {client.notes && (
                          <div className="text-sm text-zinc-600 dark:text-zinc-400 mt-2">
                            <span className="font-medium">Notes:</span>{" "}
                            {client.notes}
                          </div>
                        )}
                      </div>
                    </div>
                  ));
                })()}
              </div>
            )}
            <div className="mt-6 flex justify-end">
              <Button onClick={() => setShowPipelineCellModal(false)}>
                Close
              </Button>
            </div>
          </div>
        </Dialog>

        {/* Customer List Modal */}
        <Dialog
          open={showCustomerListModal}
          onClose={() => setShowCustomerListModal(false)}
        >
          <div className="p-6 max-w-3xl">
            <Heading className="mb-4">Customers & Pilots</Heading>
            <div className="space-y-3 max-h-96 overflow-y-auto mb-4">
              {kpis.customers?.length > 0 ? (
                kpis.customers.map((customer) => (
                  <div
                    key={customer.id}
                    className="p-4 bg-zinc-100 dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <div className="font-semibold text-zinc-950 dark:text-white text-lg">
                          {customer.name}
                          {customer.is_pilot && (
                            <span className="ml-2 text-xs text-teal-600 dark:text-teal-400">
                              (Pilot)
                            </span>
                          )}
                        </div>
                      </div>
                      {isArtemisManagement && (
                        <div className="flex gap-2">
                          <Button
                            onClick={() => {
                              setShowCustomerListModal(false);
                              openCustomerModal(customer);
                            }}
                            outline
                            className="text-xs"
                          >
                            Edit
                          </Button>
                          <Button
                            onClick={() => {
                              handleDeleteCustomer(customer.id);
                            }}
                            outline
                            className="text-xs text-red-600"
                          >
                            Delete
                          </Button>
                        </div>
                      )}
                    </div>
                    <div className="space-y-1">
                      <div className="text-sm text-zinc-600 dark:text-zinc-400">
                        <span className="font-medium">ARR:</span>{" "}
                        {formatCurrency(customer.arr || 0)}
                      </div>
                      {customer.start_date && (
                        <div className="text-sm text-zinc-600 dark:text-zinc-400">
                          <span className="font-medium">Start Date:</span>{" "}
                          {format(new Date(customer.start_date), "MMM d, yyyy")}
                        </div>
                      )}
                      {customer.status && (
                        <div className="text-sm text-zinc-600 dark:text-zinc-400">
                          <span className="font-medium">Status:</span>{" "}
                          {customer.status}
                        </div>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <Text className="text-zinc-500">No customers added yet</Text>
              )}
            </div>
            <div className="flex justify-between items-center pt-4 border-t border-zinc-200 dark:border-zinc-700">
              <div>
                <Text className="text-sm text-zinc-600 dark:text-zinc-400">
                  Total ARR: {formatCurrency(kpis.totalARR || 0)}
                </Text>
              </div>
              <div className="flex gap-2">
                {isArtemisManagement && (
                  <Button
                    onClick={() => {
                      setShowCustomerListModal(false);
                      openCustomerModal();
                    }}
                    outline
                  >
                    Add Customer
                  </Button>
                )}
                <Button onClick={() => setShowCustomerListModal(false)}>
                  Close
                </Button>
              </div>
            </div>
          </div>
        </Dialog>
      </div>
    </div>
  );
}
