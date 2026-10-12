import React, { useState } from 'react';
import Map, { Source, Layer } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import { barangayGeoJSON } from './data/barangays.geojson';

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

// Define base URL
const API_BASE_URL =
  (import.meta as any).env?.VITE_API_BASE_URL ||
  'https://tanglaw-api-1082115072795.asia-southeast3.run.app';

// Data-driven styling for the MapLibre polygons
const riskLayerStyle: any = {
  id: 'barangay-risk-layer',
  type: 'fill',
  paint: {
    'fill-color': [
      'match',
      ['get', 'risk_level'],
      'severe', '#ef4444',
      'high', '#f97316',
      'moderate', '#facc15',
      'low', '#86efac',
      '#cccccc'
    ],
    'fill-opacity': 0.6,
    'fill-outline-color': '#ffffff'
  }
};

const labelLayerStyle: any = {
  id: 'barangay-labels',
  type: 'symbol',
  layout: {
    'text-field': ['get', 'name'], // Reads the 'name' property from your GeoJSON
    'text-size': 14,
    'text-anchor': 'center',
    'text-justify': 'center'
  },
  paint: {
    'text-color': '#1f2937', // Dark gray text
    'text-halo-color': '#ffffff', // White outline for readability over colors
    'text-halo-width': 2
  }
};

export default function Dashboard() {
  const [plan, setPlan] = useState<ActionPlan | null>(null);
  const [loading, setLoading] = useState(false);

  const handleGeneratePlan = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/plans`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storm_name: "Kristine",
          forecast_valid_at: new Date().toISOString(),
          hours_to_landfall: 48,
          scenario: "baseline",
          barangays: [
            {
              psgc_code: "Barangay San Roque",
              name: "Barangay San Roque",
              flood_probability: 0.86,
              risk_level: "severe",
              population: 2000,
              vulnerable_people: 420,
              evidence_ids: ["EVID-001"]
            }
          ],
          // Add sample diocesan assets for Gemini to allocate
          assets: [
            {
              asset_id: "AST-FOOD-01",
              name: "Family Food Packs",
              barangay_psgc_code: "Diocese HQ",
              kind: "food_pack",
              quantity: 500
            },
            {
              asset_id: "AST-BOAT-01",
              name: "Fiberglass Rescue Boat", // Removed stray quote
              barangay_psgc_code: "Diocese HQ",
              kind: "boat",
              quantity: 2
            },
            {
              asset_id: "AST-VOL-01",
              name: "Youth Ministry Volunteers",
              barangay_psgc_code: "Diocese HQ",
              kind: "volunteer",
              quantity: 25 // Removed stray quote
            }
          ]
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      setPlan({
        document_id: data.id, // Capture the Firestore ID
        storm_name: data.storm_name || "Kristine",
        scenario_notes: data.summary || "",
        status: data.status || "draft",
        alerts: (data.alert_drafts || []).map((msg: string) => ({ 
          barangay: "Targeted Barangays", 
          message_taglish: msg 
        })),
        pre_positions: (data.actions || [])
          .filter((a: any) => a.action_type === 'pre_position')
          .map((a: any) => ({
            item_type: a.instruction || "Assigned Assets", // Use Gemini's text
            quantity: a.quantity || 0, 
            destination_hall: a.barangay_psgc_code 
          }))
      });
    } catch (error) {
      console.error("Error generating plan:", error);
    } finally {
      setLoading(false);
    }
  };

const handleApprove = async () => {
    if (!plan?.document_id) return;
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/plans/${plan.document_id}/approve`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approved_by: "Sherwin Delfin" })
      });
      
      if (response.ok) {
        alert("Plan Approved! Status saved to Firestore.");
        setPlan({ ...plan, status: 'approved' });
      }
    } catch (error) {
      console.error("Approval failed:", error);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8 font-sans">
      <header className="mb-8 flex justify-between items-center border-b pb-4">
        <h1 className="text-3xl font-bold text-blue-900">Tanglaw | Church Coordinator Dashboard</h1>
        <button 
          onClick={handleGeneratePlan} 
          disabled={loading}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md shadow"
        >
          {loading ? "Drafting Plan..." : "Run AI Agent (Generate Draft)"}
        </button>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Live MapLibre Risk Map */}
        <div className="lg:col-span-1 bg-white p-6 rounded-lg shadow border">
          <h2 className="text-xl font-semibold mb-4">Barangay Risk Map</h2>
          
          <div className="h-96 rounded-lg overflow-hidden border border-gray-300 shadow-inner relative">
            <Map
              initialViewState={{
                longitude: 121.100,
                latitude: 14.580,
                zoom: 13.5
              }}
              mapStyle="https://basemaps.cartocdn.com/gl/positron-gl-style/style.json"
              interactive={true}
            >
              <Source id="barangays" type="geojson" data={barangayGeoJSON}>
                <Layer {...riskLayerStyle} />
                <Layer {...labelLayerStyle} />
              </Source>
            </Map>
          </div>

          <div className="mt-4">
            <h3 className="font-semibold text-gray-700">What-if Scenario:</h3>
            <p className="text-sm text-gray-600 bg-yellow-100 p-2 rounded mt-1 border border-yellow-200">
              Landfall +80 km south
            </p>
          </div>
        </div>

        {/* Draft Action Plan & Approval Gate */}
        <div className="lg:col-span-2 bg-white p-6 rounded-lg shadow border">
          <div className="flex flex-wrap items-center justify-between border-b pb-2 mb-4 gap-2">
            <div>
              <h2 className="text-xl font-semibold text-gray-800">Draft Action Plan</h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Anticipatory intervention window: <strong className="text-gray-700">T-48h to T-72h before landfall</strong>
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs bg-blue-100 text-blue-800 font-semibold px-2.5 py-1 rounded-full border border-blue-200 shadow-sm">
                Forecast Horizon: 48h to Landfall
              </span>
              <span className="text-xs bg-amber-100 text-amber-800 font-semibold px-2.5 py-1 rounded-full border border-amber-200 shadow-sm">
                Mode: Anticipatory Staging
              </span>
            </div>
          </div>
          
          {!plan ? (
            <p className="text-gray-500 italic">No active draft. Run the AI agent to generate an anticipatory plan up to 72 hours before landfall.</p>
          ) : (
            <div>
              <div className="mb-6">
                <h3 className="text-lg font-bold text-gray-800 mb-2">1. Pre-positioning Assets</h3>
                <ul className="list-disc pl-5 space-y-3 mt-2">
                  {plan.pre_positions.map((pos, idx) => (
                    <li key={idx} className="text-gray-700 leading-snug">
                      <span className="font-bold">{pos.quantity}x</span> {pos.item_type}
                      <br /><span className="text-sm font-semibold text-blue-600">Destination: {pos.destination_hall}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="mb-6">
                <h3 className="text-lg font-bold text-gray-800 mb-2">2. Church Alerts</h3>
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