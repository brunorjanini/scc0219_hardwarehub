import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { analyzeBuild, getBuildAnalysisStatus } from "../../api/builds";
import { categoryLabel } from "../../utils/categories";
import { formatPrice } from "../../utils/format";

// Messages for the request errors (ApiError.status)
function errorMessage(error) {
  if (error?.status === 503) return "A análise com IA não está disponível neste servidor.";
  if (error?.status === 0) return error.message;
  return "Não foi possível gerar a análise agora. Tente de novo em instantes.";
}

// Stable text of a build, to tell whether a result still matches it
const buildKey = (selection) =>
  Object.entries(selection)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([slot, id]) => `${slot}:${id}`)
    .join(",");

// "Análise com IA" panel of the PC Builder (phase 5 of docs/plano-mcp.md).
// Optional: it only shows when the backend says the feature is on (it needs
// an Anthropic API key), so with json-server or without a key the Builder
// looks exactly as before. The store's rules still decide compatibility;
// the AI only explains the problems and suggests parts chosen by the server.
// Each analysis is one paid API call, so it runs only on click.
export default function BuilderAnalysis({ selection, onUse }) {
  const [enabled, setEnabled] = useState(false);
  const [state, setState] = useState({ busy: false, error: "", result: null, key: "" });

  useEffect(() => {
    let active = true;
    getBuildAnalysisStatus()
      .then((status) => active && setEnabled(Boolean(status?.enabled)))
      .catch(() => active && setEnabled(false));
    return () => {
      active = false;
    };
  }, []);

  if (!enabled) return null;

  const key = buildKey(selection);
  const hasParts = key !== "";
  const { busy, error, result } = state;
  const stale = result && state.key !== key;

  async function analyze() {
    if (busy || !hasParts) return;
    setState({ busy: true, error: "", result: null, key });
    try {
      const data = await analyzeBuild(selection);
      setState({ busy: false, error: "", result: data, key });
    } catch (err) {
      setState({ busy: false, error: errorMessage(err), result: null, key });
    }
  }

  return (
    <section className="builder-analysis" aria-labelledby="builder-analysis-title">
      <div className="builder-analysis-header">
        <Sparkles aria-hidden="true" />
        <div>
          <h2 id="builder-analysis-title">Análise com IA</h2>
          <p>Uma explicação dos problemas da montagem e sugestões de troca. As regras acima continuam valendo.</p>
        </div>
      </div>

      <button
        type="button"
        className="link-button secondary"
        onClick={analyze}
        disabled={busy || !hasParts}
        aria-describedby={hasParts ? undefined : "builder-analysis-hint"}
      >
        {busy ? "Analisando..." : result ? "Analisar de novo" : "Analisar com IA"}
      </button>
      {!hasParts && (
        <p id="builder-analysis-hint" className="builder-analysis-note">
          Escolha pelo menos uma peça para analisar.
        </p>
      )}

      <div aria-live="polite" aria-busy={busy}>
        {error && (
          <p className="page-message error" role="alert">
            {error}
          </p>
        )}

        {result && (
          <div className="builder-analysis-result">
            {stale && (
              <p className="builder-analysis-note">A montagem mudou depois desta análise. Analise de novo para atualizar.</p>
            )}

            <p className="builder-analysis-summary">{result.analysis.summary}</p>

            {result.analysis.issues.length > 0 && (
              <>
                <h3>Problemas explicados</h3>
                <ul>
                  {result.analysis.issues.map((issue, i) => (
                    <li key={`${issue.slot}-${i}`}>
                      <strong>{categoryLabel(issue.slot)}:</strong> {issue.explanation}
                    </li>
                  ))}
                </ul>
              </>
            )}

            {result.analysis.suggestions.length > 0 && (
              <>
                <h3>Sugestões</h3>
                <ul className="builder-analysis-suggestions">
                  {result.analysis.suggestions.map((s) => (
                    <li key={s.slot}>
                      <p>
                        <strong>{categoryLabel(s.slot)}:</strong> {s.name} ({formatPrice(s.price)})
                      </p>
                      <p>{s.reason}</p>
                      <button
                        type="button"
                        className="link-button secondary"
                        onClick={() => onUse(s.slot, s.productId)}
                        disabled={selection[s.slot] === s.productId}
                        aria-label={`Usar ${s.name} em ${categoryLabel(s.slot)}`}
                      >
                        {selection[s.slot] === s.productId ? "Em uso" : "Usar esta peça"}
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}

            <p className="builder-analysis-note">Gerado por IA ({result.model}). Confira antes de comprar.</p>
          </div>
        )}
      </div>
    </section>
  );
}
