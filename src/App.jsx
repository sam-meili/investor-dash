import React from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import InvestorPasswordGate from "./components/InvestorPasswordGate";
import InvestorDashboard from "./components/InvestorDashboard";

export default function App() {
  return (
    <>
      <Toaster position="top-center" />
      <BrowserRouter>
        <Routes>
          <Route
            path="/"
            element={
              <InvestorPasswordGate>
                <InvestorDashboard />
              </InvestorPasswordGate>
            }
          />
        </Routes>
      </BrowserRouter>
    </>
  );
}

