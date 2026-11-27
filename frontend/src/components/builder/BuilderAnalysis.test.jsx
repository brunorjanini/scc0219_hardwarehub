// "Análise com IA" panel: hidden unless the backend enables it; one request
// per click; results become stale when the build changes; suggestions can
// be applied to the Builder.
import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import seed from "../../seed.json";
import { routes } from "../../routes";
import { renderWithRouter } from "../../test/renderWithRouter";
import { installProductStore } from "../../test/productStore";
import { axeViolations } from "../../test/axe";
import { ApiError } from "../../api/http";
import { analyzeBuild, getBuildAnalysisStatus } from "../../api/builds";
import { BUILDER_STORAGE_KEY } from "../../utils/builder";
import BuilderAnalysis from "./BuilderAnalysis";

vi.mock("../../api/builds", async (importOriginal) => ({
  ...(await importOriginal()),
  getBuildAnalysisStatus: vi.fn(),
  analyzeBuild: vi.fn(),
}));
vi.mock("../../api/products", async (importOriginal) => ({
  ...(await importOriginal()),
  listProducts: vi.fn(),
  getProduct: vi.fn(),
  createProduct: vi.fn(),
  updateProduct: vi.fn(),
  deleteProduct: vi.fn(),
}));
vi.mock("../../api/carts", () => ({ getCartByUser: vi.fn(), createCart: vi.fn(), saveCartItems: vi.fn() }));

// Intel Core i5-14600K (LGA1700) on an AM5 board
const SELECTION = { cpu: "4", motherboard: "5" };

const RESULT = {
  status: "error",
  issues: [{ id: "socket", level: "error", slots: ["cpu", "motherboard"], message: "Soquete incompatível." }],
  analysis: {
    summary: "O processador Intel não encaixa na placa-mãe AM5.",
    issues: [{ slot: "cpu", explanation: "O soquete do processador é diferente do da placa-mãe." }],
    suggestions: [
      { slot: "cpu", productId: "2", name: "AMD Ryzen 5 7600", price: 1199.9, reason: "É AM5 e mais barato." },
    ],
  },
  model: "claude-opus-5-5",
};

function renderPanel(selection = SELECTION, onUse = vi.fn()) {
  const view = render(<BuilderAnalysis selection={selection} onUse={onUse} />);
  return { ...view, onUse };
}

describe("BuilderAnalysis", () => {
  it("stays hidden when the server has the feature off", async () => {
    getBuildAnalysisStatus.mockResolvedValue({ enabled: false });
    const { container } = renderPanel();
    await waitFor(() => expect(getBuildAnalysisStatus).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  it("stays hidden when the API has no such route (json-server)", async () => {
    getBuildAnalysisStatus.mockRejectedValue(new ApiError("Erro na requisição (404)", 404));
    const { container } = renderPanel();
    await waitFor(() => expect(getBuildAnalysisStatus).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  it("asks for a part before analyzing", async () => {
    getBuildAnalysisStatus.mockResolvedValue({ enabled: true });
    renderPanel({});
    const button = await screen.findByRole("button", { name: "Analisar com IA" });
    expect(button).toBeDisabled();
    expect(button).toHaveAccessibleDescription("Escolha pelo menos uma peça para analisar.");
  });

  it("analyzes on click and shows the explanation and suggestions", async () => {
    getBuildAnalysisStatus.mockResolvedValue({ enabled: true });
    let resolve;
    analyzeBuild.mockImplementation(() => new Promise((r) => (resolve = r)));
    const user = userEvent.setup();
    const { onUse } = renderPanel();

    await user.click(await screen.findByRole("button", { name: "Analisar com IA" }));
    expect(analyzeBuild).toHaveBeenCalledWith(SELECTION);
    expect(screen.getByRole("button", { name: "Analisando..." })).toBeDisabled();

    resolve(RESULT);
    expect(await screen.findByText("O processador Intel não encaixa na placa-mãe AM5.")).toBeInTheDocument();
    expect(screen.getByText("O soquete do processador é diferente do da placa-mãe.").closest("li")).toHaveTextContent(
      "Processador:",
    );
    expect(screen.getByText(/AMD Ryzen 5 7600 \(R\$\s1\.199,90\)/)).toBeInTheDocument();
    expect(screen.getByText(/Gerado por IA \(claude-opus-5-5\)/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Usar AMD Ryzen 5 7600 em Processador" }));
    expect(onUse).toHaveBeenCalledWith("cpu", "2");
    expect(analyzeBuild).toHaveBeenCalledTimes(1);
    // Only the panel: rendered alone, the test document has no <title>
    expect(await axeViolations(screen.getByRole("region", { name: "Análise com IA" }))).toEqual([]);
  });

  it("marks the result as outdated when the build changes", async () => {
    getBuildAnalysisStatus.mockResolvedValue({ enabled: true });
    analyzeBuild.mockResolvedValue(RESULT);
    const user = userEvent.setup();
    const { rerender, onUse } = renderPanel();
    await user.click(await screen.findByRole("button", { name: "Analisar com IA" }));
    await screen.findByText(RESULT.analysis.summary);
    expect(screen.queryByText(/A montagem mudou/)).not.toBeInTheDocument();

    rerender(<BuilderAnalysis selection={{ ...SELECTION, cpu: "2" }} onUse={onUse} />);
    expect(screen.getByText(/A montagem mudou depois desta análise/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Usar AMD Ryzen 5 7600 em Processador" })).toHaveTextContent("Em uso");
    expect(screen.getByRole("button", { name: "Analisar de novo" })).toBeEnabled();
  });

  it.each([
    [new ApiError("Erro na requisição (503)", 503), "A análise com IA não está disponível neste servidor."],
    [new ApiError("Erro na requisição (502)", 502), "Não foi possível gerar a análise agora. Tente de novo em instantes."],
  ])("explains request errors (%s)", async (error, message) => {
    getBuildAnalysisStatus.mockResolvedValue({ enabled: true });
    analyzeBuild.mockRejectedValue(error);
    const user = userEvent.setup();
    renderPanel();
    await user.click(await screen.findByRole("button", { name: "Analisar com IA" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(message);
  });
});

describe("Builder page with the AI analysis", () => {
  it("swaps a part when a suggestion is used", async () => {
    getBuildAnalysisStatus.mockResolvedValue({ enabled: true });
    analyzeBuild.mockResolvedValue(RESULT);
    localStorage.setItem(BUILDER_STORAGE_KEY, JSON.stringify(SELECTION));
    installProductStore(seed.products);
    const user = userEvent.setup();
    renderWithRouter(routes, { path: "/monte-seu-pc" });

    const panel = await screen.findByRole("region", { name: "Análise com IA" });
    await user.click(within(panel).getByRole("button", { name: "Analisar com IA" }));
    await user.click(await within(panel).findByRole("button", { name: "Usar AMD Ryzen 5 7600 em Processador" }));

    const cpuSlot = screen.getByRole("heading", { level: 2, name: "Processador" }).closest("li");
    expect(cpuSlot).toHaveTextContent("AMD Ryzen 5 7600");
    expect(document.querySelector(".builder-status")).not.toHaveTextContent("incompatíveis");
    expect(JSON.parse(localStorage.getItem(BUILDER_STORAGE_KEY))).toMatchObject({ cpu: "2", motherboard: "5" });
  });
});
