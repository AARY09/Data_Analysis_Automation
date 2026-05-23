export function parseInsights(insights) {
  if (!insights) return null;
  if (typeof insights === "object") return insights;
  try {
    return JSON.parse(insights);
  } catch {
    return {
      title: "Dataset Analysis Report",
      summary: String(insights),
      key_insights: [],
      anomalies: [],
      recommendations: [],
      statistics: {
        missing_values: [],
        numerical_summary: [],
        categorical_summary: [],
      },
    };
  }
}

function LevelBadge({ level, type = "importance" }) {
  const value = (level || "medium").toLowerCase();
  const label =
    type === "severity" ? "Severity" : type === "priority" ? "Priority" : "Importance";
  return (
    <span className={`badge badge-${value}`} title={label}>
      {value}
    </span>
  );
}

function ItemCard({ title, description, level, levelType }) {
  return (
    <article className="insight-card">
      <div className="insight-card-header">
        <h3>{title}</h3>
        {level ? <LevelBadge level={level} type={levelType} /> : null}
      </div>
      <p>{description}</p>
    </article>
  );
}

function StatTable({ title, columns, rows, emptyMessage }) {
  if (!rows?.length) {
    return (
      <div className="stat-block">
        <h4>{title}</h4>
        <p className="muted">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="stat-block">
      <h4>{title}</h4>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              {columns.map((col) => (
                <th key={col.key}>{col.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => (
              <tr key={idx}>
                {columns.map((col) => (
                  <td key={col.key}>{row[col.key] ?? "-"}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function InsightsReport({ insights }) {
  const report = parseInsights(insights);
  if (!report) {
    return <p>No insights available.</p>;
  }

  const stats = report.statistics || {};

  return (
    <div className="insights-report">
      <header className="report-header">
        <h2>{report.title || "Dataset Analysis Report"}</h2>
        {report.summary ? <p className="report-summary">{report.summary}</p> : null}
      </header>

      <section className="report-section">
        <h3>Key Insights</h3>
        {report.key_insights?.length ? (
          <div className="card-grid">
            {report.key_insights.map((item, idx) => (
              <ItemCard
                key={`${item.title}-${idx}`}
                title={item.title}
                description={item.description}
                level={item.importance}
                levelType="importance"
              />
            ))}
          </div>
        ) : (
          <p className="muted">No key insights identified.</p>
        )}
      </section>

      <section className="report-section">
        <h3>Anomalies</h3>
        {report.anomalies?.length ? (
          <div className="card-grid">
            {report.anomalies.map((item, idx) => (
              <article key={`${item.title}-${idx}`} className="insight-card anomaly-card">
                <div className="insight-card-header">
                  <h4>{item.title}</h4>
                  <LevelBadge level={item.severity} type="severity" />
                </div>
                <p>{item.description}</p>
              </article>
            ))}
          </div>
        ) : (
          <p className="muted">No anomalies detected.</p>
        )}
      </section>

      <section className="report-section">
        <h3>Recommendations</h3>
        {report.recommendations?.length ? (
          <div className="card-grid">
            {report.recommendations.map((item, idx) => (
              <ItemCard
                key={`${item.title}-${idx}`}
                title={item.title}
                description={item.description}
                level={item.priority}
                levelType="priority"
              />
            ))}
          </div>
        ) : (
          <p className="muted">No recommendations available.</p>
        )}
      </section>

      <section className="report-section">
        <h3>Statistics</h3>
        <StatTable
          title="Missing Values"
          columns={[
            { key: "column", label: "Column" },
            { key: "missing_percent", label: "Missing %" },
            { key: "unique_values", label: "Unique Values" },
          ]}
          rows={stats.missing_values || []}
          emptyMessage="No missing value issues found."
        />
        <StatTable
          title="Numerical Summary"
          columns={[
            { key: "column", label: "Column" },
            { key: "metric", label: "Metric" },
            { key: "value", label: "Value" },
          ]}
          rows={stats.numerical_summary || []}
          emptyMessage="No numerical summary available."
        />
        <StatTable
          title="Categorical Summary"
          columns={[
            { key: "column", label: "Column" },
            { key: "top_category", label: "Top Category" },
            { key: "count", label: "Count" },
          ]}
          rows={stats.categorical_summary || []}
          emptyMessage="No categorical summary available."
        />
      </section>
    </div>
  );
}
