import React, { useState, useEffect } from 'react';

// Interfaces matching the FastAPI/Firestore schema
interface Alert {
  barangay: string;
  message_taglish: string;
}

interface PrePosition {
  item_type: string;
  quantity: number;
  destination_hall: string;
}

interface ActionPlan {
  document_id?: string;
  storm_name: string;
  scenario_notes: string;
  alerts: Alert[];
  pre_positions: PrePosition[];
  status: string;
}

export default function Dashboard() {
  const [plan, setPlan] = useState<ActionPlan | null>(null);
  const [loading, setLoading] = useState(false);

  // Trigger Gemini AI Agent generation
  const handleGeneratePlan = async () => {
    setLoading(true);
    try {
      const response = await fetch('https://your-cloud-run-url/api/generate-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storm_id: "STORM_KRISTINE_01",
          storm_name: "Kristine",
          high_risk_barangays: ["Barangay San Jose", "Barangay San Roque", "Barangay Rosario"],
          available_assets: { boats: 5, food_packs: 500 },
          what_if_scenario: "Landfall +80 km south" // What-if scenario feature[cite: 1]
        })
      });
      const data = await response.json();
      setPlan(data.plan);
    } catch (error) {
      console.error("Error generating plan:", error);
    }
    setLoading(false);
  };

  // Human approval gate feature[cite: 1]
  const handleApprove = () => {
    // In production, this updates Firestore status to 'approved' and triggers FCM alerts[cite: 1]
    alert("Plan Approved! FCM alerts dispatched to Parish Leaders.");
    if (plan) setPlan({ ...plan, status: 'approved' });
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8 font-sans">
      <header className="mb-8 flex justify-between items-center border-b pb-4">
        <h1 className="text-3xl font-bold text-blue-900">Tanglaw | Coordinator Dashboard</h1>
        <button 
          onClick={handleGeneratePlan} 
          disabled={loading}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md shadow"
        >
          {loading ? "Drafting Plan..." : "Run AI Agent (Generate Draft)"}
        </button>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Risk Map Placeholder[cite: 1] */}
        <div className="lg:col-span-1 bg-white p-6 rounded-lg shadow border">
          <h2 className="text-xl font-semibold mb-4">Barangay Risk Map</h2>
          <div className="h-64 bg-gray-200 rounded flex items-center justify-center border-dashed border-2 border-gray-400">
            <span className="text-gray-500">MapLibre GL Map Rendered Here</span>
          </div>
          <div className="mt-4">
            <h3 className="font-semibold text-gray-700">What-if Scenario:</h3>
            <p className="text-sm text-gray-600 bg-yellow-100 p-2 rounded mt-1 border border-yellow-200">
              Landfall +80 km south
            </p>
          </div>
        </div>

        {/* Draft Action Plan & Approval Gate[cite: 1] */}
        <div className="lg:col-span-2 bg-white p-6 rounded-lg shadow border">
          <h2 className="text-xl font-semibold mb-4 border-b pb-2">Draft Action Plan</h2>
          
          {!plan ? (
            <p className="text-gray-500 italic">No active draft. Run the AI agent to generate an anticipatory plan up to 72 hours before landfall.</p>
          ) : (
            <div>
              <div className="mb-6">
                <h3 className="text-lg font-bold text-gray-800 mb-2">1. Pre-positioning Assets</h3>
                <ul className="list-disc pl-5 space-y-1">
                  {plan.pre_positions.map((pos, idx) => (
                    <li key={idx} className="text-gray-700">
                      Stage <span className="font-bold">{pos.quantity} {pos.item_type}</span> at <span className="font-bold text-blue-600">{pos.destination_hall}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="mb-6">
                <h3 className="text-lg font-bold text-gray-800 mb-2">2. Parish Alerts</h3>
                <ul className="space-y-3">
                  {plan.alerts.map((alert, idx) => (
                    <li key={idx} className="bg-blue-50 p-3 rounded border border-blue-100">
                      <p className="font-semibold text-sm text-blue-800">{alert.barangay}</p>
                      <p className="text-gray-700 mt-1 italic">"{alert.message_taglish}"</p>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="mt-8 flex justify-end">
                {plan.status === 'draft' ? (
                  <button 
                    onClick={handleApprove}
                    className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg shadow font-semibold text-lg"
                  >
                    Approve and Send Alerts
                  </button>
                ) : (
                  <span className="text-green-600 font-bold text-lg bg-green-50 px-4 py-2 rounded-lg border border-green-200">
                    Plan Approved & Dispatched ✓
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}