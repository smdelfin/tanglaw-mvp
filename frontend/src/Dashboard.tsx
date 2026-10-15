import React, { useState, useEffect, useCallback } from 'react';
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

// Telemetry interfaces
interface InferenceEvent {
  request_id: string;
  timestamp: number;
  endpoint: string;
  model: string;
  ttft_ms: number;
  total_latency_ms: number;
  itl_ms: number;
  tokens_per_sec: number;
  prompt_tokens: number;
  completion_tokens: number;
  cached_tokens: number;
  cache_hit: boolean;
  prefix_hash: string;
  status: string;
}

interface TelemetrySummary {
  total_requests: number;
  avg_ttft_ms: number;
  p95_ttft_ms: number;
  avg_tokens_per_sec: number;
  avg_itl_ms: number;
  cache_hit_rate_pct: number;
  token_savings_pct: number;
  total_prompt_tokens: number;
  total_cached_tokens: number;
  total_completion_tokens: number;
  slo_compliance_pct: number;
  recent_events: InferenceEvent[];
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
    'text-field': ['get', 'name'],
    'text-size': 14,
    'text-anchor': 'center',
    'text-justify': 'center'
  },
  paint: {
    'text-color': '#1f2937',
    'text-halo-color': '#ffffff',
    'text-halo-width': 2
  }
};

// Built-in Vertex AI & Cloud Run Inference Telemetry Component
const InferenceTelemetryPanel: React.FC<{
  apiBaseUrl: string;
  refreshTrigger: number;
}> = ({ apiBaseUrl, refreshTrigger }) => {
  const [metrics, setMetrics] = useState<TelemetrySummary | null>(null);
  const [isOpen, setIsOpen] = useState<boolean>(true);
  const [isSimulating, setIsSimulating] = useState<boolean>(false);

  const fetchMetrics = useCallback(async () => {
    try {
      const res = await fetch(`${apiBaseUrl.replace(/\/$/, '')}/api/telemetry/metrics`);
      if (res.ok) {
        const data: TelemetrySummary = await res.json();
        setMetrics(data);
      }
    } catch {
      // Ignore network errors while backend starts
    }
  }, [apiBaseUrl]);

  useEffect(() => {
    fetchMetrics();
    const interval = setInterval(fetchMetrics, 4000);
    return () => clearInterval(interval);
  }, [fetchMetrics, refreshTrigger]);

  const handleSimulateBurst = async () => {
    setIsSimulating(true);
    try {
      const res = await fetch(
        `${apiBaseUrl.replace(/\/$/, '')}/api/telemetry/simulate-burst`,
        { method: 'POST' }
      );
      if (res.ok) {
        const data: TelemetrySummary = await res.json();
        setMetrics(data);
      }
    } finally {
      setIsSimulating(false);
    }
  };

  const ttftHealthy = (metrics?.avg_ttft_ms ?? 0) <= 800;

  return (
    <div className="bg-slate-900 border border-slate-700/80 rounded-xl shadow-lg text-slate-100 overflow-hidden">
      <div className="flex flex-wrap items-center justify-between px-4 py-2.5 bg-slate-800/90 border-b border-slate-700/80">
        <div className="flex items-center gap-2.5">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
          </span>
          <span className="text-xs font-bold uppercase tracking-wider text-slate-200">
            Vertex AI & Cloud Run Inference Telemetry
          </span>
          <span className="text-[11px] px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-mono">
            gemini-2.5-flash • Prefix KV-Cache
          </span>
        </div>

        <div className="flex items-center gap-2 mt-1 sm:mt-0">
          <button
            type="button"
            onClick={handleSimulateBurst}
            disabled={isSimulating}
            className="text-xs px-2.5 py-1 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 font-medium transition cursor-pointer"
          >
            {isSimulating ? 'Running Burst...' : '⚡ Test Prefix Cache Burst'}
          </button>
          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            className="text-xs px-2 py-1 rounded bg-slate-700 hover:bg-slate-600 text-slate-300 transition cursor-pointer"
          >
            {isOpen ? 'Hide' : 'Expand'}
          </button>
        </div>
      </div>

      {isOpen && (
        <div className="p-4 space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="bg-slate-800/60 border border-slate-700/60 rounded-lg p-3">
              <div className="flex justify-between items-center text-xs text-slate-400">
                <span>Time-to-First-Token (TTFT)</span>
                <span
                  className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                    ttftHealthy
                      ? 'bg-emerald-500/20 text-emerald-300'
                      : 'bg-rose-500/20 text-rose-300'
                  }`}
                >
                  {ttftHealthy ? 'SLO OK' : 'HIGH LOAD'}
                </span>
              </div>
              <div className="text-2xl font-bold font-mono text-white mt-1">
                {metrics?.avg_ttft_ms ?? 0}{' '}
                <span className="text-xs font-normal text-slate-400">ms</span>
              </div>
              <div className="text-[11px] text-slate-400 mt-1 font-mono">
                P95: {metrics?.p95_ttft_ms ?? 0} ms • SLO: {metrics?.slo_compliance_pct ?? 100}%
              </div>
            </div>

            <div className="bg-slate-800/60 border border-slate-700/60 rounded-lg p-3">
              <div className="flex justify-between items-center text-xs text-slate-400">
                <span>Decode Throughput</span>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-sky-500/20 text-sky-300">
                  STREAMING
                </span>
              </div>
              <div className="text-2xl font-bold font-mono text-sky-400 mt-1">
                {metrics?.avg_tokens_per_sec ?? 0}{' '}
                <span className="text-xs font-normal text-slate-400">tok/s</span>
              </div>
              <div className="text-[11px] text-slate-400 mt-1 font-mono">
                ITL: {metrics?.avg_itl_ms ?? 0} ms/tok • Out: {metrics?.total_completion_tokens ?? 0} toks
              </div>
            </div>

            <div className="bg-slate-800/60 border border-slate-700/60 rounded-lg p-3">
              <div className="flex justify-between items-center text-xs text-slate-400">
                <span>Prefix Cache Hit Rate</span>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300">
                  KV REUSE
                </span>
              </div>
              <div className="text-2xl font-bold font-mono text-emerald-400 mt-1">
                {metrics?.cache_hit_rate_pct ?? 0}%
              </div>
              <div className="text-[11px] text-slate-400 mt-1 font-mono">
                Reqs: {metrics?.total_requests ?? 0} • Cached: {metrics?.total_cached_tokens ?? 0} toks
              </div>
            </div>

            <div className="bg-slate-800/60 border border-slate-700/60 rounded-lg p-3">
              <div className="flex justify-between items-center text-xs text-slate-400">
                <span>Prefill Compute Saved</span>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300">
                  FINOPS
                </span>
              </div>
              <div className="text-2xl font-bold font-mono text-amber-300 mt-1">
                {metrics?.token_savings_pct ?? 0}%
              </div>
              <div className="text-[11px] text-slate-400 mt-1 font-mono">
                Saved {metrics?.total_cached_tokens ?? 0} / {metrics?.total_prompt_tokens ?? 0} prompt toks
              </div>
            </div>
          </div>

          {metrics && metrics.recent_events.length > 0 && (
            <div className="overflow-x-auto border border-slate-800 rounded-lg">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-slate-800/80 text-slate-400 uppercase text-[10px]">
                  <tr>
                    <th className="py-2 px-3">Req ID</th>
                    <th className="py-2 px-3">Prefix Hash</th>
                    <th className="py-2 px-3">Cache Status</th>
                    <th className="py-2 px-3">TTFT</th>
                    <th className="py-2 px-3">Speed</th>
                    <th className="py-2 px-3">Tokens (Cached/In/Out)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70">
                  {metrics.recent_events.slice(0, 5).map((ev) => (
                    <tr key={ev.request_id} className="hover:bg-slate-800/40">
                      <td className="py-1.5 px-3 text-slate-300">{ev.request_id}</td>
                      <td className="py-1.5 px-3 text-indigo-300">#{ev.prefix_hash}</td>
                      <td className="py-1.5 px-3">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            ev.cache_hit
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                              : 'bg-slate-700 text-slate-300'
                          }`}
                        >
                          {ev.cache_hit ? '⚡ KV CACHE HIT' : 'COLD PREFILL'}
                        </span>
                      </td>
                      <td className="py-1.5 px-3 font-bold text-white">{ev.ttft_ms} ms</td>
                      <td className="py-1.5 px-3 text-sky-300">{ev.tokens_per_sec} tok/s</td>
                      <td className="py-1.5 px-3 text-slate-400">
                        {ev.cached_tokens} / {ev.prompt_tokens} / {ev.completion_tokens}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default function Dashboard() {
  const [plan, setPlan] = useState<ActionPlan | null>(null);
  const [loading, setLoading] = useState(false);
  const [telemetryRefresh, setTelemetryRefresh] = useState(0);

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
              name: "Fiberglass Rescue Boat",
              barangay_psgc_code: "Diocese HQ",
              kind: "boat",
              quantity: 2
            },
            {
              asset_id: "AST-VOL-01",
              name: "Youth Ministry Volunteers",
              barangay_psgc_code: "Diocese HQ",
              kind: "volunteer",
              quantity: 25
            }
          ]
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      setPlan({
        document_id: data.id,
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
            item_type: a.instruction || "Assigned Assets",
            quantity: a.quantity || 0, 
            destination_hall: a.barangay_psgc_code 
          }))
      });
    } catch (error) {
      console.error("Error generating plan:", error);
    } finally {
      setLoading(false);
      setTelemetryRefresh((prev) => prev + 1);
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
      <header className="mb-6 flex justify-between items-center border-b pb-4">
        <h1 className="text-3xl font-bold text-blue-900">Tanglaw | Church Coordinator Dashboard</h1>
        <button 
          onClick={handleGeneratePlan} 
          disabled={loading}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md shadow"
        >
          {loading ? "Drafting Plan..." : "Run AI Agent (Generate Draft)"}
        </button>
      </header>

      {/* Live Vertex AI & Cloud Run Inference Telemetry Bar */}
      <div className="mb-8">
        <InferenceTelemetryPanel
          apiBaseUrl={API_BASE_URL}
          refreshTrigger={telemetryRefresh}
        />
      </div>

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