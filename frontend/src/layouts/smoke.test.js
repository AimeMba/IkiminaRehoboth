import React from "react";
import { createRoot } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { MemoryRouter } from "react-router-dom";

import AnnualClosingPage from "./annual-closing";
import ProfitRequestsPage from "./profit-requests";
import {
  fetchAnnualClosings,
  fetchCurrentUser,
  fetchMemberOptions,
  fetchMemberProfitPayouts,
  fetchMemberProfits,
  fetchMyMemberProfitSummary,
  fetchMyProfitRequests,
  fetchProfitRequests,
} from "services/api";

global.IS_REACT_ACT_ENVIRONMENT = true;

jest.mock("i18n", () => ({
  useLanguage: () => ({ t: (key) => key }),
}));

jest.mock("services/api", () => ({
  fetchAnnualClosings: jest.fn(),
  fetchCurrentUser: jest.fn(),
  fetchMemberOptions: jest.fn(),
  fetchMemberProfitPayouts: jest.fn(),
  fetchMemberProfits: jest.fn(),
  fetchMyMemberProfitSummary: jest.fn(),
  fetchMyProfitRequests: jest.fn(),
  fetchProfitRequests: jest.fn(),
  createAnnualClosing: jest.fn(),
  exportAnnualClosingPdf: jest.fn(),
  exportProfitPayoutsPdf: jest.fn(),
  createMemberProfitBulkPayout: jest.fn(),
  createProfitRequest: jest.fn(),
  createMyProfitRequest: jest.fn(),
  exportProfitRequestsPdf: jest.fn(),
  reviewProfitRequest: jest.fn(),
}));

jest.mock("components/MDBox", () => ({
  __esModule: true,
  default: ({ children }) => <div>{children}</div>,
}));

jest.mock("components/MDTypography", () => ({
  __esModule: true,
  default: ({ children }) => <div>{children}</div>,
}));

jest.mock("components/MDButton", () => ({
  __esModule: true,
  default: ({ children, disabled, form, onClick, type }) => (
    <button type={type || "button"} onClick={onClick} disabled={disabled} form={form}>
      {children}
    </button>
  ),
}));

jest.mock("components/HintButton", () => ({
  __esModule: true,
  default: ({ children, disabled, onClick }) => (
    <button type="button" onClick={onClick} disabled={disabled}>
      {children}
    </button>
  ),
}));

jest.mock("components/MDSnackbar", () => ({
  __esModule: true,
  default: ({ content }) => <div>{content || null}</div>,
}));

jest.mock("components/AppIcon", () => ({
  __esModule: true,
  default: ({ children }) => <span>{children}</span>,
}));

jest.mock("components/ContextBanner", () => ({
  __esModule: true,
  default: ({ title, content }) => (
    <div>
      {title}
      {content}
    </div>
  ),
}));

jest.mock("examples/LayoutContainers/DashboardLayout", () => ({
  __esModule: true,
  default: ({ children }) => <div>{children}</div>,
}));

jest.mock("examples/Navbars/DashboardNavbar", () => ({
  __esModule: true,
  default: () => <div>navbar</div>,
}));

jest.mock("examples/Footer", () => ({
  __esModule: true,
  default: () => <div>footer</div>,
}));

jest.mock("examples/Tables/DataTable", () => ({
  __esModule: true,
  default: ({ table }) => <div>rows:{table?.rows?.length || 0}</div>,
}));

const flushEffects = async (times = 3) => {
  for (let index = 0; index < times; index += 1) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }
};

const renderPage = async (element) => {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  await act(async () => {
    root.render(<MemoryRouter>{element}</MemoryRouter>);
  });

  await flushEffects();

  return { container, root };
};

describe("frontend smoke tests", () => {
  let mountedRoot = null;
  let mountedContainer = null;

  beforeAll(() => {
    window.matchMedia =
      window.matchMedia ||
      (() => ({
        matches: false,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      }));
  });

  beforeEach(() => {
    jest.clearAllMocks();
    fetchAnnualClosings.mockResolvedValue([]);
    fetchCurrentUser.mockResolvedValue({ role: "FINANCE", effective_role: "FINANCE" });
    fetchMemberOptions.mockResolvedValue([]);
    fetchMemberProfitPayouts.mockResolvedValue([]);
    fetchMemberProfits.mockResolvedValue([]);
    fetchMyMemberProfitSummary.mockResolvedValue({});
    fetchMyProfitRequests.mockResolvedValue([]);
    fetchProfitRequests.mockResolvedValue([]);
  });

  afterEach(async () => {
    if (mountedRoot) {
      await act(async () => {
        mountedRoot.unmount();
      });
    }
    if (mountedContainer) {
      mountedContainer.remove();
    }
    mountedRoot = null;
    mountedContainer = null;
  });

  it("keeps annual closing page usable when member options fail", async () => {
    fetchMemberOptions.mockRejectedValue(new Error("member options failed"));

    const rendered = await renderPage(<AnnualClosingPage />);
    mountedRoot = rendered.root;
    mountedContainer = rendered.container;

    expect(fetchCurrentUser).toHaveBeenCalled();
    expect(fetchMemberOptions).toHaveBeenCalled();
    expect(fetchAnnualClosings).toHaveBeenCalled();
    expect(rendered.container.textContent).toContain("annualCloseNow");
  });

  it("does not send a request mode filter by default on profit requests", async () => {
    fetchCurrentUser.mockResolvedValue({ role: "ADMIN", effective_role: "ADMIN" });

    const rendered = await renderPage(<ProfitRequestsPage />);
    mountedRoot = rendered.root;
    mountedContainer = rendered.container;

    expect(fetchProfitRequests).toHaveBeenCalled();
    const firstParams = fetchProfitRequests.mock.calls[0][0] || {};
    expect(firstParams.request_mode).toBeUndefined();
    expect(rendered.container.textContent).toContain("profitRequests");
  });
});
