import { useState } from "react";
import "./SellingChart.css";

/**
 * Builds "nice" Y-axis ticks (steps of 1, 2, 2.5 or 5 x 10^n)
 * and returns the ticks plus the top of the scale.
 */
function buildTicks(max, count = 5) {
  const rawStep = max / count;
  const exp = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const frac = rawStep / exp;
  const step =
    (frac <= 1 ? 1 : frac <= 2 ? 2 : frac <= 2.5 ? 2.5 : frac <= 5 ? 5 : 10) *
    exp;
  const top = Math.ceil(max / step) * step;

  const ticks = [];
  for (let v = 0; v <= top + 1e-9; v += step) ticks.push(v);
  return { ticks, top };
}

// Compact label for the axis: 2500 -> "2,5k"
const formatTick = (v) =>
  v >= 1000 ? `${String(v / 1000).replace(".", ",")}k` : String(v);

// Full currency label for the tooltip
const formatCurrency = (v) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/**
 * Props:
 *  - title: string, card title
 *  - data: array of { dia: string, valor: number, destaque?: boolean,
 *          descricao?: string (full day name, read by screen readers) }
 * The bars are only visual (hover tooltips); a hidden table carries the
 * same numbers for screen readers and keyboard users.
 */
export default function SellingChart({ title, data }) {
  const [hovered, setHovered] = useState(null);

  const hasData = Array.isArray(data) && data.length > 0;

  // Only compute the scale when there is something to plot
  const maxValue = hasData ? Math.max(...data.map((d) => d.valor)) : 0;
  const { ticks, top } = buildTicks(maxValue > 0 ? maxValue : 1);

  // Converts a value into a percentage of the chart height
  const toPercent = (v) => `${(v / top) * 100}%`;

  return (
    <div className="venda-chart">
      <div className="venda-chart__header">
        <h2 className="venda-chart__title">{title}</h2>
        <span className="venda-chart__badge">Receita</span>
      </div>

      {!hasData ? (
        // Empty state: message centered in the chart area
        <div className="venda-chart__empty">Não há dados para exibir.</div>
      ) : (
        <>
          <table className="visually-hidden">
            <caption>{title}</caption>
            <thead>
              <tr>
                <th scope="col">Dia</th>
                <th scope="col">Receita</th>
              </tr>
            </thead>
            <tbody>
              {data.map((d, i) => (
                <tr key={i}>
                  <th scope="row">{d.descricao ?? d.dia}</th>
                  <td>{formatCurrency(d.valor)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="venda-chart__plot" aria-hidden="true">
            {/* Y axis: tick labels */}
            <div className="venda-chart__y-axis">
              {ticks.map((t) => (
                <span
                  key={t}
                  className="venda-chart__y-label"
                  style={{ bottom: toPercent(t) }}
                >
                  {formatTick(t)}
                </span>
              ))}
            </div>

            <div className="venda-chart__area">
              {/* Grid lines (the zero line is solid) */}
              {ticks.map((t) => (
                <div
                  key={t}
                  className={
                    "venda-chart__grid" +
                    (t === 0 ? " venda-chart__grid--base" : "")
                  }
                  style={{ bottom: toPercent(t) }}
                />
              ))}

              {/* Bars */}
              <div className="venda-chart__bars">
                {data.map((d, i) => {
                  const isActive = hovered === i;
                  const isDimmed = hovered !== null && !isActive;

                  return (
                    <div
                      key={i}
                      className="venda-chart__column"
                      onMouseEnter={() => setHovered(i)}
                      onMouseLeave={() => setHovered(null)}
                    >
                      {isActive && (
                        <div
                          className="venda-chart__tooltip"
                          style={{
                            bottom: `calc(${toPercent(d.valor)} + 8px)`,
                          }}
                        >
                          {formatCurrency(d.valor)}
                        </div>
                      )}
                      <div
                        className={
                          "venda-chart__bar" +
                          (d.destaque ? " venda-chart__bar--highlight" : "") +
                          (isDimmed ? " venda-chart__bar--dimmed" : "")
                        }
                        style={{ height: toPercent(d.valor) }}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* X axis: category labels */}
          <div className="venda-chart__x-axis" aria-hidden="true">
            <div className="venda-chart__x-spacer" />
            <div className="venda-chart__x-labels">
              {data.map((d, i) => (
                <span key={i} className="venda-chart__x-label">
                  {d.dia}
                </span>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
