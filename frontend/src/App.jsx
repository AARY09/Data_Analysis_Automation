import { useMemo, useState } from "react";
import { jsPDF } from "jspdf";
import Papa from "papaparse";
import InsightsReport, { parseInsights } from "./components/InsightsReport";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

const TABS = ["Analysis", "Data Cleaning", "Insights", "Charts"];
const COLORS = ["#6C63FF", "#22C55E", "#F97316", "#06B6D4", "#EC4899", "#FACC15"];

function parseCsv(csvText, previewRows = 40) {
  const parsed = Papa.parse(csvText, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: true,
  });

  if (parsed.errors.length) {
    return { fullData: [], sampleData: [] };
  }

  const fullData = parsed.data || [];
  return {
    fullData,
    sampleData: fullData.slice(0, previewRows),
  };
}

function buildCategoricalData(dataset, column) {
  const counts = {};
  dataset.forEach((row) => {
    const key = row[column] || "Unknown";
    counts[key] = (counts[key] || 0) + 1;
  });

  return Object.entries(counts)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);
}

function buildNumericBins(dataset, column, bins = 8) {
  const nums = dataset
    .map((row) => Number(row[column]))
    .filter((value) => Number.isFinite(value));
  if (!nums.length) return [];

  const min = Math.min(...nums);
  const max = Math.max(...nums);
  if (min === max) return [{ name: `${min}`, value: nums.length }];

  const width = (max - min) / bins;
  const buckets = new Array(bins).fill(0).map((_, i) => ({
    start: min + i * width,
    end: i === bins - 1 ? max : min + (i + 1) * width,
    value: 0,
  }));

  nums.forEach((num) => {
    const idx = Math.min(Math.floor((num - min) / width), bins - 1);
    buckets[idx].value += 1;
  });

  return buckets.map((bucket) => ({
    name: `${bucket.start.toFixed(1)}-${bucket.end.toFixed(1)}`,
    value: bucket.value,
  }));
}

function downloadFile(content, fileName, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

function addWrappedText(doc, text, x, y, maxWidth, lineHeight = 6) {
  const lines = doc.splitTextToSize(text, maxWidth);
  lines.forEach((line) => {
    if (y > 280) {
      doc.addPage();
      y = 20;
    }
    doc.text(line, x, y);
    y += lineHeight;
  });
  return y;
}

function applyCleaningToData(data, cleaningLog) {
  if (!data.length || !cleaningLog.length) return data;
  let cleaned = [...data];

  cleaningLog.forEach((item) => {
    const { column, action } = item;
    if (!column || !action) return;

    if (action === "drop") {
      cleaned = cleaned.map((row) => {
        const copy = { ...row };
        delete copy[column];
        return copy;
      });
      return;
    }

    const values = cleaned.map((row) => row[column]).filter((v) => v !== null && v !== undefined && v !== "");
    if (!values.length) return;

    const numericValues = values.map(Number).filter((n) => Number.isFinite(n));
    let fillValue = "";

    if (action === "fill_mean" && numericValues.length) {
      fillValue = numericValues.reduce((a, b) => a + b, 0) / numericValues.length;
    } else if (action === "fill_median" && numericValues.length) {
      const sorted = [...numericValues].sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      fillValue = sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
    } else if (action === "fill_mode") {
      const counts = {};
      values.forEach((v) => {
        counts[v] = (counts[v] || 0) + 1;
      });
      fillValue = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "";
    } else {
      return;
    }

    cleaned = cleaned.map((row) => {
      if (row[column] === null || row[column] === undefined || row[column] === "") {
        return { ...row, [column]: fillValue };
      }
      return row;
    });
  });

  return cleaned;
}

function App() {
  const [file, setFile] = useState(null);
  const [sampleData, setSampleData] = useState([]);
  const [fullData, setFullData] = useState([]);
  const [result, setResult] = useState(null);
  const [activeTab, setActiveTab] = useState("Analysis");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [followUpMode, setFollowUpMode] = useState("chart");
  const [selectedColumn, setSelectedColumn] = useState("");
  const [followUpRequest, setFollowUpRequest] = useState("");
  const [followUpResult, setFollowUpResult] = useState(null);

  const schema = result?.schema || {};
  const cleaningLog = result?.cleaning_log || [];
  const backendCharts = result?.charts || [];
  const insightsReport = useMemo(() => parseInsights(result?.insights), [result?.insights]);
  const cleanedData = useMemo(() => applyCleaningToData(fullData, cleaningLog), [fullData, cleaningLog]);

  const chartData = useMemo(() => {
    if (!schema.columns?.length || !sampleData.length) return null;

    const categoricalColumn = schema.columns.find(
      (col) => schema.dtypes?.[col] && !schema.dtypes[col].includes("int") && !schema.dtypes[col].includes("float")
    );

    if (!categoricalColumn) return null;

    return {
      column: categoricalColumn,
      values: buildCategoricalData(sampleData, categoricalColumn),
    };
  }, [schema, sampleData]);

  const handleFileChange = async (selectedFile) => {
    setFile(selectedFile);
    setResult(null);
    setError("");
    setActiveTab("Analysis");

    if (!selectedFile) {
      setSampleData([]);
      setFullData([]);
      return;
    }

    const text = await selectedFile.text();
    const parsed = parseCsv(text);
    setSampleData(parsed.sampleData);
    setFullData(parsed.fullData);
  };

  const analyzeFile = async () => {
    if (!file) return;

    setLoading(true);
    setError("");

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch(`${API_URL}/run-agent`, {
        method: "POST",
        body: formData,
      });

      const payload = await response.json();
      if (!response.ok || payload.status !== "success") {
        throw new Error(payload.error || `Request failed with status ${response.status}`);
      }

      setResult(payload);
      setSelectedColumn(payload?.schema?.columns?.[0] || "");
      setFollowUpResult(null);
      setFollowUpRequest("");
    } catch (err) {
      setError(err.message || "Unable to analyze the file.");
    } finally {
      setLoading(false);
    }
  };

  const runFollowUp = () => {
    if (!selectedColumn || !sampleData.length) return;

    const dtype = schema.dtypes?.[selectedColumn] || "";
    const isNumeric = dtype.includes("int") || dtype.includes("float");

    if (followUpMode === "chart") {
      const values = isNumeric
        ? buildNumericBins(sampleData, selectedColumn)
        : buildCategoricalData(sampleData, selectedColumn);
      setFollowUpResult({
        mode: "chart",
        title: isNumeric
          ? `Distribution of ${selectedColumn}`
          : `Top categories in ${selectedColumn}`,
        values,
        isNumeric,
      });
      return;
    }

    const missing = schema.missing_percent?.[selectedColumn] ?? 0;
    const unique = schema.unique_counts?.[selectedColumn] ?? 0;
    let message = `${selectedColumn} has ${missing}% missing values and ${unique} unique values.`;
    if (isNumeric) {
      const numeric = sampleData
        .map((row) => Number(row[selectedColumn]))
        .filter((v) => Number.isFinite(v));
      if (numeric.length) {
        const avg = numeric.reduce((a, b) => a + b, 0) / numeric.length;
        message += ` Average value in sampled rows is ${avg.toFixed(2)}.`;
      }
    } else {
      const top = buildCategoricalData(sampleData, selectedColumn)[0];
      if (top) message += ` Most frequent category is "${top.name}" (${top.value} rows in sample).`;
    }
    if (followUpRequest.trim()) {
      message += ` Follow-up focus: ${followUpRequest.trim()}.`;
    }
    setFollowUpResult({ mode: "insight", title: `Focused insight for ${selectedColumn}`, message });
  };

  const downloadCleanedCsv = () => {
    if (!cleanedData.length) return;
    const csv = Papa.unparse(cleanedData);
    const base = (file?.name || "dataset").replace(/\.csv$/i, "");
    downloadFile(csv, `${base}_cleaned.csv`, "text/csv;charset=utf-8;");
  };

  const downloadReport = () => {
    if (!result) return;
    const report = {
      fileName: file?.name || "unknown.csv",
      generatedAt: new Date().toLocaleString(),
      schema: result.schema || {},
      cleaningLog: result.cleaning_log || [],
      insights: result.insights || "",
      chartsGenerated: (result.charts || []).map((chart, idx) => ({
        id: idx + 1,
        type: chart.type || "unknown",
      })),
      followUp: followUpResult || null,
    };

    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const maxWidth = 170;
    let y = 18;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.text("Automated Data Analysis Report", 20, y);
    y += 10;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    y = addWrappedText(doc, `File: ${report.fileName}`, 20, y, maxWidth);
    y = addWrappedText(doc, `Generated: ${report.generatedAt}`, 20, y, maxWidth);
    y += 2;

    doc.setFont("helvetica", "bold");
    y = addWrappedText(doc, "Dataset Summary", 20, y, maxWidth);
    doc.setFont("helvetica", "normal");
    const shape = report.schema.shape || {};
    y = addWrappedText(doc, `Rows: ${shape.rows ?? "-"} | Columns: ${shape.cols ?? "-"}`, 20, y, maxWidth);
    y += 2;

    doc.setFont("helvetica", "bold");
    y = addWrappedText(doc, "Schema Details", 20, y, maxWidth);
    doc.setFont("helvetica", "normal");
    (report.schema.columns || []).forEach((col) => {
      const dtype = report.schema.dtypes?.[col] ?? "-";
      const missing = report.schema.missing_percent?.[col] ?? 0;
      const unique = report.schema.unique_counts?.[col] ?? 0;
      y = addWrappedText(doc, `${col}: type=${dtype}, missing=${missing}%, unique=${unique}`, 20, y, maxWidth);
    });
    y += 2;

    doc.setFont("helvetica", "bold");
    y = addWrappedText(doc, "Cleaning Actions", 20, y, maxWidth);
    doc.setFont("helvetica", "normal");
    if (report.cleaningLog.length) {
      report.cleaningLog.forEach((item, idx) => {
        y = addWrappedText(
          doc,
          `${idx + 1}. Column "${item.column}" -> ${item.action}. Reason: ${item.reason || "No reason provided"}`,
          20,
          y,
          maxWidth
        );
      });
    } else {
      y = addWrappedText(doc, "No cleaning actions were required.", 20, y, maxWidth);
    }
    y += 2;

    const insightsPdf = parseInsights(report.insights);
    doc.setFont("helvetica", "bold");
    y = addWrappedText(doc, insightsPdf?.title || "Insights", 20, y, maxWidth);
    doc.setFont("helvetica", "normal");
    y = addWrappedText(doc, insightsPdf?.summary || "No summary available.", 20, y, maxWidth);
    (insightsPdf?.key_insights || []).forEach((item, idx) => {
      y = addWrappedText(
        doc,
        `Insight ${idx + 1} [${item.importance || "medium"}]: ${item.title} - ${item.description}`,
        20,
        y,
        maxWidth
      );
    });
    (insightsPdf?.anomalies || []).forEach((item, idx) => {
      y = addWrappedText(
        doc,
        `Anomaly ${idx + 1} [${item.severity || "medium"}]: ${item.title} - ${item.description}`,
        20,
        y,
        maxWidth
      );
    });
    (insightsPdf?.recommendations || []).forEach((item, idx) => {
      y = addWrappedText(
        doc,
        `Recommendation ${idx + 1} [${item.priority || "medium"}]: ${item.title} - ${item.description}`,
        20,
        y,
        maxWidth
      );
    });
    y += 2;

    doc.setFont("helvetica", "bold");
    y = addWrappedText(doc, "Charts Generated", 20, y, maxWidth);
    doc.setFont("helvetica", "normal");
    if (report.chartsGenerated.length) {
      report.chartsGenerated.forEach((chart) => {
        y = addWrappedText(doc, `- ${chart.id}. ${chart.type}`, 20, y, maxWidth);
      });
    } else {
      y = addWrappedText(doc, "No backend charts generated.", 20, y, maxWidth);
    }
    y += 2;

    doc.setFont("helvetica", "bold");
    y = addWrappedText(doc, "Follow-up Result", 20, y, maxWidth);
    doc.setFont("helvetica", "normal");
    if (report.followUp) {
      if (report.followUp.mode === "insight") {
        y = addWrappedText(doc, `${report.followUp.title}: ${report.followUp.message}`, 20, y, maxWidth);
      } else {
        y = addWrappedText(doc, `${report.followUp.title} (${report.followUp.values?.length || 0} data points)`, 20, y, maxWidth);
      }
    } else {
      y = addWrappedText(doc, "No follow-up result generated.", 20, y, maxWidth);
    }

    const base = (file?.name || "analysis-report").replace(/\.csv$/i, "");
    doc.save(`${base}_analysis_report.pdf`);
  };

  return (
    <div className="page">
      <header className="hero">
        <h1>Automated Data Analysis</h1>
        <p>Upload a CSV file, run AI analysis, and explore results in structured tabs.</p>
      </header>

      <section className="card upload-card">
        <div className="upload-controls">
          <label className="file-label">
            <input
              type="file"
              accept=".csv"
              onChange={(e) => handleFileChange(e.target.files?.[0])}
            />
            <span>{file ? file.name : "Choose CSV file"}</span>
          </label>
          <button onClick={analyzeFile} disabled={!file || loading}>
            {loading ? "Analyzing..." : "Run Analysis"}
          </button>
          <button onClick={downloadCleanedCsv} disabled={!result || !cleanedData.length}>
            Download Cleaned CSV
          </button>
          <button onClick={downloadReport} disabled={!result}>
            Download Full Report (PDF)
          </button>
        </div>
        {error && <p className="error">{error}</p>}
      </section>

      {result && (
        <section className="card">
          <div className="tabs">
            {TABS.map((tab) => (
              <button
                key={tab}
                className={`tab ${activeTab === tab ? "active" : ""}`}
                onClick={() => setActiveTab(tab)}
              >
                {tab}
              </button>
            ))}
          </div>

          {activeTab === "Analysis" && (
            <div className="tab-content">
              <h2>Dataset Overview</h2>
              <div className="stats-grid">
                <div className="stat">
                  <span>Rows</span>
                  <strong>{schema.shape?.rows ?? "-"}</strong>
                </div>
                <div className="stat">
                  <span>Columns</span>
                  <strong>{schema.shape?.cols ?? "-"}</strong>
                </div>
                <div className="stat">
                  <span>Sample Rows Loaded</span>
                  <strong>{sampleData.length}</strong>
                </div>
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Column</th>
                      <th>Data Type</th>
                      <th>Missing %</th>
                      <th>Unique Values</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(schema.columns || []).map((col) => (
                      <tr key={col}>
                        <td>{col}</td>
                        <td>{schema.dtypes?.[col] ?? "-"}</td>
                        <td>{schema.missing_percent?.[col] ?? 0}</td>
                        <td>{schema.unique_counts?.[col] ?? 0}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === "Data Cleaning" && (
            <div className="tab-content">
              <h2>Cleaning Actions</h2>
              {cleaningLog.length ? (
                <div className="timeline">
                  {cleaningLog.map((item, index) => (
                    <article key={`${item.column}-${index}`} className="timeline-item">
                      <h3>{item.column}</h3>
                      <p><strong>Action:</strong> {item.action}</p>
                      <p><strong>Reason:</strong> {item.reason || "No reason provided"}</p>
                    </article>
                  ))}
                </div>
              ) : (
                <p>No cleaning actions were required.</p>
              )}
            </div>
          )}

          {activeTab === "Insights" && (
            <div className="tab-content">
              <InsightsReport insights={insightsReport || result?.insights} />
            </div>
          )}

          {activeTab === "Charts" && (
            <div className="tab-content">
              <h2>Visual Insights</h2>
              <div className="chart-grid">
                {chartData?.values?.length ? (
                  <div className="chart-card">
                    <h3>Top Categories in {chartData.column}</h3>
                    <ResponsiveContainer width="100%" height={320}>
                      <BarChart data={chartData.values}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                        <XAxis dataKey="name" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                          {chartData.values.map((entry, idx) => (
                            <Cell key={entry.name} fill={COLORS[idx % COLORS.length]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : null}

                {chartData?.values?.length ? (
                  <div className="chart-card">
                    <h3>Category Distribution</h3>
                    <ResponsiveContainer width="100%" height={320}>
                      <PieChart>
                        <Pie
                          data={chartData.values}
                          dataKey="value"
                          nameKey="name"
                          outerRadius={110}
                          label
                        >
                          {chartData.values.map((entry, idx) => (
                            <Cell key={entry.name} fill={COLORS[idx % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <p>Upload a dataset with at least one categorical column to generate interactive charts.</p>
                )}
              </div>

              {backendCharts.length > 0 && (
                <>
                  <h3 className="generated-title">Backend Generated Charts</h3>
                  <div className="image-grid">
                    {backendCharts.map((chart, index) => (
                      <article className="image-card" key={`${chart.type}-${index}`}>
                        <h4>{chart.type?.toUpperCase() || `Chart ${index + 1}`}</h4>
                        <img src={`data:image/png;base64,${chart.image}`} alt={chart.type || "Generated chart"} />
                      </article>
                    ))}
                  </div>
                </>
              )}

              <div className="follow-up card-soft">
                <h3>Follow-up Question</h3>
                <p>Ask for a chart or focused insight from a specific column.</p>
                <div className="follow-controls">
                  <select value={followUpMode} onChange={(e) => setFollowUpMode(e.target.value)}>
                    <option value="chart">Need chart on this column</option>
                    <option value="insight">Need specific insight</option>
                  </select>
                  <select value={selectedColumn} onChange={(e) => setSelectedColumn(e.target.value)}>
                    {(schema.columns || []).map((col) => (
                      <option key={col} value={col}>
                        {col}
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    value={followUpRequest}
                    onChange={(e) => setFollowUpRequest(e.target.value)}
                    placeholder="Optional: add specific question context"
                  />
                  <button onClick={runFollowUp} disabled={!selectedColumn}>
                    Generate Follow-up
                  </button>
                </div>

                {followUpResult?.mode === "chart" && (
                  <div className="chart-card follow-result">
                    <h4>{followUpResult.title}</h4>
                    <ResponsiveContainer width="100%" height={280}>
                      <BarChart data={followUpResult.values}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                        <XAxis dataKey="name" />
                        <YAxis />
                        <Tooltip />
                        <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                          {(followUpResult.values || []).map((entry, idx) => (
                            <Cell key={`${entry.name}-${idx}`} fill={COLORS[idx % COLORS.length]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                    {followUpResult.isNumeric && (
                      <ResponsiveContainer width="100%" height={220}>
                        <LineChart data={followUpResult.values}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                          <XAxis dataKey="name" />
                          <YAxis />
                          <Tooltip />
                          <Line type="monotone" dataKey="value" stroke="#4f46e5" strokeWidth={3} />
                        </LineChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                )}

                {followUpResult?.mode === "insight" && (
                  <div className="follow-result insight-section">
                    <h4>{followUpResult.title}</h4>
                    <p>{followUpResult.message}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
}

export default App;
