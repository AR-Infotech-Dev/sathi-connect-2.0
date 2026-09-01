const mappingReloadStorageKey = "sathi-connect:resume-mapping-after-pull";

const state = {
  config: null,
  orders: [],
  lotBills: [],
  tallyStatuses: {},
  tallyResults: {},
  tallyLogs: [],
  stockItems: [],
  itemMappings: {},
  partyLedgers: [],
  partyMappings: {},
  voucherTypes: [],
  godowns: [],
  commonGodownName: "",
  godownOverrides: {},
  ordersFilter: {
    search: "",
    tally: "all",
    mapping: "all"
  },
  grnLots: [],
  portalSalesEntries: [],
  portalSalesWarning: "",
  portalSelectedRows: {},
  recoveryAssistant: {
    bill: null,
    order: null,
    stage: "",
    purchaseCandidates: [],
    updatedPurchases: [],
    salesCandidates: [],
    updatedSales: []
  },
  salesRecovery: {
    candidatesByVoucher: {},
    loadingVoucher: "",
    updatingKey: "",
    expandedVoucher: "",
    view: "active",
    filters: {
      search: "",
      status: "all",
      qty: "all"
    }
  },
  activePortalSaleEntry: null,
  buyerEditorKey: "",
  activeMappingVoucherNumber: "",
  expandedPortalSale: "",
  expandedOrder: "",
  reports: {
    active: "purchase",
    expandedKey: "",
    addon: "",
    purchaseRows: [],
    salesRows: [],
    grnRows: [],
    rojmelRows: [],
    rojmelTotals: {},
    rojmelSections: [],
    rojmelCharts: {},
    rojmelSourceStats: {},
    batchExpiryRows: [],
    batchExpirySummary: {},
    batchExpiryGroups: [],
    batchExpiryBuckets: [],
    batchExpiryFilters: {
      type: "",
      company: "",
      godown: "",
      item: "",
      status: ""
    },
    batchExpirySort: {
      key: "expiry",
      direction: "asc"
    },
    advancedPack: null,
    advancedFilters: {
      search: "",
      status: "all",
      type: "all",
      qty: "all"
    },
    monthlyStockRows: [],
    addonRows: []
  },
  companyUdfs: null,
  licenceScopes: [],
  activeScopeClientId: "",
  tallySerialNumber: "",
  machineId: "",
  machineIdSource: "",
  errors: [],
  archive: [],
  preview: null,
  license: null,
  demo: {
    enabled: false,
    token: "",
    sampleCount: 0,
    seededAt: ""
  }
};

const titles = {
  dashboard: "Dashboard",
  orders: "SATHI to Tally",
  portalPush: "Tally to SATHI",
  salesRecovery: "Update Sales",
  reports: "Reports",
  reportSales: "Sales Report",
  reportPurchase: "Purchase Report",
  reportGrn: "GRN Report",
  reportBatchExpiry: "Batch Expiry Report",
  reportFarmerDealer: "Farmer / Dealer Sale Register",
  reportLotTrace: "Lot Traceability Report",
  reportLicenceStock: "Licence-wise Stock Report",
  reportExpiryRisk: "Expiry Risk Dashboard",
  formD: "Form D",
  lots: "Item Mapping",
  archive: "Archive",
  settings: "Settings",
  companyUdfs: "Tally Setup",
  license: "License",
  errors: "Issues"
};

const reportTabMap = {
  reportSales: "sales",
  reportPurchase: "purchase",
  reportGrn: "grn",
  reportBatchExpiry: "batchExpiry",
  reportFarmerDealer: "farmerDealer",
  reportLotTrace: "lotTrace",
  reportLicenceStock: "licenceStock",
  reportExpiryRisk: "expiryRisk"
};

const languageStorageKey = "sathiConnectLanguage";
const themeStorageKey = "sathiConnectTheme";
const licenceScopeStorageKey = "sathiConnectActiveLicence";
let currentLanguage = loadSavedLanguage();
let currentTheme = loadSavedTheme();
let apiProgressTimer = null;
let apiProgressShownAt = 0;
let activeApiRequests = 0;
let lastMappingFocusTarget = null;
applyTheme(currentTheme);

const mrText = {
  brandSubtitle: "SATHI ते Tally कामकाज",
  languageLabel: "भाषा",
  languageToggleOn: "English माहिती",
  languageToggleOff: "मराठी माहिती",
  navDashboard: "मुख्य स्क्रीन",
  navOrders: "SATHI to Tally",
  navPortalPush: "Tally to SATHI",
  navReports: "Reports",
  navFormD: "Form D",
  navLots: "Item Mapping",
  navArchive: "जुने Response",
  navSettings: "सेटिंग",
  navTallySetup: "Tally Setup",
  navIssues: "अडचणी",
  activeCompany: "चालू कंपनी",
  testTally: "Tally तपासा",
  developedBy: "Developed by",
  associatedWith: "In association with",
  eyebrow: "Integration control room",
  refresh: "Refresh",
  apiTools: "API Tools",
  dailyWork: "रोजचे काम",
  dailyTitle: "Tally voucher बनवण्यासाठी 3 steps",
  dailyText: "Lot details घ्या, item mapping एकदाच confirm करा, आणि selected Tally company मध्ये voucher push करा.",
  stepFetchTitle: "SATHI order घ्या",
  stepFetchText: "Pending order किंवा आधी received lot details fetch करा.",
  stepMapTitle: "Item mapping तपासा",
  stepMapText: "फक्त unmapped items वरच काम करावे लागेल.",
  stepPushTitle: "Tally मध्ये Push करा",
  stepPushText: "Duplicate तपासून voucher तयार करा.",
  metricSaathi: "SATHI API",
  metricOrders: "Orders",
  metricErrors: "Open Errors",
  metricErrorsHint: "Support साठी issue list",
  advancedApiTitle: "Advanced API Workbench",
  advancedApiText: "Specific SATHI API testing साठीच वापरा.",
  showTestingTools: "Testing tools दाखवा",
  runAction: "Action चालवा",
  apiAction: "API action",
  ownerCode: "Owner code",
  stateCode: "State code",
  voucherNumber: "Voucher number",
  locationCode: "Location code",
  availableVouchers: "Fetch झालेले voucher numbers",
  createOrderJson: "Create order JSON",
  pullSafety: "Pull lot details केल्यावर order pending मधून निघू शकते. Voucher number confirm करूनच वापरा. Response आधी local save होईल.",
  testingFlow: "Testing Flow",
  testStep1: "API action निवडा",
  testStep2: "गरज असल्यास voucher टाका",
  testStep3: "Request चालवा",
  testStep4: "Response तपासा",
  lastResponse: "Last response / error",
  signedPreviewTitle: "Signed request preview",
  signedPreviewText: "API test call पाठवण्याआधी endpoint, headers आणि final body edit करता येतील.",
  testingView: "Testing view",
  endpoint: "Endpoint",
  headers: "Headers",
  finalRequestBody: "Final request body",
  copy: "Copy",
  saathiStatusHelp: "सध्या selected API action test करताना ही note वापरा.",
  pushQueueTitle: "Tally बिल तयार करा",
  pushQueueText: "SATHI वरून आलेल्या lot साठी Tally purchase entry तयार करा.",
  clear: "काढून टाका",
  reviewMapping: "Mapping तपासा",
  checkTallyStatus: "Tally status तपासा",
  bulkPush: "सर्व Push करा",
  fetchOrders: "Orders Fetch करा",
  thVoucher: "Voucher No.",
  thParty: "Party",
  thAmount: "रक्कम",
  thItemMapping: "Mapping",
  thTally: "Tally",
  thAction: "Action",
  tallyLogsTitle: "Tally Operation Logs",
  tallyLogsText: "Tally check आणि push चा history support साठी इथे असतो.",
  showLogs: "Logs दाखवा",
  recentLogs: "Recent Logs",
  recentLogsText: "Support-ready Tally operation history.",
  clearLogs: "Logs Clear",
  refreshLogs: "Logs Refresh",
  noTallyLogs: "अजून Tally operation record नाही.",
  billNumber: "Bill Number",
  seller: "Seller",
  buyer: "Buyer",
  totalBill: "Total Bill",
  itemMappingTitle: "Item Mapping",
  itemMappingText: "SATHI item automatic तयार होईल. Existing Tally item फक्त reference म्हणून select करा.",
  saveShowQueue: "Save करून Push Queue दाखवा",
  fetchLotForMapping: "Item mapping साठी lot details fetch करा.",
  viewLotData: "Lot data पाहा",
  viewLotDataText: "Normal use मध्ये raw lot lines hide ठेवले आहेत.",
  showDetails: "Details दाखवा",
  thLot: "Lot Number",
  thCrop: "Crop",
  thVariety: "Variety",
  thClass: "Class",
  thPacking: "Packing",
  thBags: "Bags",
  thRate: "Rate",
  thExpiry: "Expiry",
  titleDashboard: "मुख्य स्क्रीन",
  titleOrders: "Tally Push",
  titlePortalPush: "Portal Push",
  titleFormD: "Form D",
  titleLots: "Item Mapping",
  titleArchive: "जुने Response",
  titleSettings: "सेटिंग",
  titleCompanyUdfs: "Tally Setup",
  titleErrors: "अडचणी",
  noDataLoaded: "Data load झालेला नाही",
  ready: "तयार",
  notChecked: "तपासलेले नाही",
  tallyStatusNotChecked: "Tally status तपासलेला नाही.",
  lastResponseEmpty: "या session मध्ये अजून request पाठवलेली नाही.",
  readyForMapping: "Mapping आणि Tally push साठी ready",
  noVouchers: "अजून voucher ready नाहीत.",
  lotMissing: "Lot नाही",
  partyToMap: "Party mapping बाकी",
  itemMappingRequired: "Item mapping बाकी",
  itemToMap: "item map करायचा आहे",
  itemsToMap: "items map करायचे आहेत",
  foundInTally: "Tally मध्ये आहे",
  verifiedInTally: "Tally मध्ये verified",
  pushedToTally: "Tally मध्ये push झाले",
  pendingForTally: "Tally साठी pending",
  checking: "तपासत आहे...",
  pushing: "Push करत आहे...",
  checkFailed: "तपासणी failed",
  pushWarning: "Push सूचना",
  status: "स्थिती",
  push: "Push करा",
  pullLot: "Lot घ्या",
  copied: "Copy",
  synced: "झाले",
  buyerPrefix: "Buyer",
  item: "item",
  items: "items",
  lotAsBatch: "Lot number Tally batch म्हणून जाईल",
  portalItem: "SATHI item",
  batch: "Batch",
  tallyItem: "Tally item",
  notMapped: "Mapping बाकी",
  pack: "Pack",
  bags: "Bags",
  rate: "Rate",
  expiry: "Expiry",
  reviewItemMapping: "Item mapping तपासा",
  noLotDetails: "या order साठी lot details उपलब्ध नाहीत.",
  noLotLoaded: "Lot response load झालेला नाही",
  billDate: "Bill date",
  mappingRequired: "mapping बाकी",
  mappingReady: "ready",
  useAs: "Use as",
  existingTallyItem: "Existing Tally item",
  newTallyItem: "New Tally item",
  tallyItemName: "Tally item name",
  newItemWillCreate: "नवीन item Tally मध्ये create होईल.",
  selectFromTallyList: "Tally item list मधून select करा.",
  apiPendingOrders: "Buyer code ने pending orders घ्या",
  apiPullLot: "Pull lot details - received mark होऊ शकते",
  apiFetchLot: "आधी received lot details fetch करा",
  apiCreateOrder: "SATHI order create करा"
  ,
  portalDailyWork: "Tally inward नंतर",
  portalTitle: "Tally bill वरून SATHI order तयार करा",
  portalText: "Tally मध्ये inward lot bill तयार झाल्यावर तोच lot SATHI portal ला push करण्यासाठी ही screen वापरा.",
  portalStep1: "1. Bill निवडा",
  portalStep1Hint: "Tally inward data मधून",
  portalStep2: "2. Lot confirm करा",
  portalStep2Hint: "Lot, class, pack, quantity",
  portalStep3: "3. SATHI ला Push करा",
  portalStep3Hint: "Create order API",
  portalFormTitle: "Portal Push Details",
  portalFormText: "इथे सोपी business names दिली आहेत. Technical request names API preview मध्ये दिसतील.",
  previewRequest: "Request Preview",
  sendToPortal: "Portal ला पाठवा",
  portalPartySection: "Party आणि licence details",
  portalBuyerLicense: "Buyer licence number",
  portalSellerLicense: "आपला seller licence number",
  portalStockLocation: "Stock location licence",
  portalOriginalOwner: "Original supplier licence",
  portalSellerRole: "Seller type",
  portalBuyerRole: "Buyer type",
  portalLotSection: "Lot details",
  portalLotNumber: "Lot number",
  portalCertification: "Certification class",
  portalPacking: "Packing size",
  portalQuantity: "Quantity",
  portalMoreFields: "More portal fields",
  portalMoreHint: "SATHI ने सांगितले तरच हे details भरा.",
  portalStateName: "State name",
  portalPan: "PAN number",
  portalGst: "GST number",
  portalPhone: "Phone number",
  portalPin: "Pin code",
  portalVillage: "Village",
  portalSubsidy: "Subsidy amount",
  portalQueueTitle: "Send Tally Bills to SATHI",
  portalQueueText: "Tally sales bills ready for SATHI order creation appear here.",
  portalQueueEmpty: "अजून Tally sales entries fetch केलेल्या नाहीत.",
  portalSalesVoucherType: "Sales voucher type",
  portalOriginalOwnerSource: "Original owner source",
  portalOriginalOwnerSourceText: "Lot trace / batch history"
};

const companyUdfDefinitions = [
  ["SATHI_API_KEY", "SATHI API signing key"],
  ["SATHI_CLIENT_ID", "SATHI client id / buyer code"],
  ["SATHI_CLIENT_SECRET", "SATHI client secret"],
  ["SATHI_OWNER_CODE", "Default owner code"],
  ["SATHI_LOCATION_CODE", "Default location code"],
  ["SATHI_STATE_CODE", "Default state code"],
  ["SATHI_BASE_URL", "SATHI API base URL"],
  ["SATHI_TALLY_VOUCHER_TYPE", "Purchase voucher type"],
  ["SATHI_TALLY_VOUCHER_TYPE_SALES", "Sales voucher type for portal push"],
  ["SATHI_TALLY_PURCHASE_LEDGER", "Purchase ledger"],
  ["SATHI_TALLY_PURCHASE_GODOWN", "Purchase godown"]
];

const sampleCreateOrder = {
  apiKey: "",
  keyHash: "",
  ts: 0,
  isRetailSell: "N",
  buyerCode: "LCSD0920222968WSH",
  ownerCode: "",
  buyerRole: "DEALER",
  sellerRole: "DEALER",
  discountType: null,
  discount: 0,
  stateCode: "27",
  blockCode: "",
  districtCode: "",
  stateName: "Maharashtra",
  blockName: "",
  districtName: "",
  villageName: "",
  phoneNumber: "",
  panNumber: "A",
  gstNumber: "A",
  villageCode: "",
  locationCode: "",
  pin: "",
  plotNo: "",
  isStateNotOnboarded: true,
  selfTransfer: "N",
  lotTypeStockDetails: [
    {
      certificationClass: "TLSEED",
      lotNum: "TL-LOT-2026-12",
      packingSize: "4",
      quantity: 1
    }
  ],
  buyerStateCode: "27",
  originalOwner: "",
  isTransfer: false,
  schemeId: "",
  schemeName: "",
  sector: "",
  tagNums: [],
  vehicleNumber: "",
  gender: "",
  subsidy: 0,
  category: "",
  isSubsidy: false
};

const samplePullLotResponse = {
  statusCode: 200,
  status: "Success",
  message: "Lot details fetched and updated successfully",
  data: [
    {
      totalBillPrice: "1760",
      discountType: null,
      discount: 0,
      billNumber: "BLCSD0120231810LTR1778310444381",
      billDate: "09-05-2026",
      sellerCode: "LCSD0120231810LTR",
      buyerCode: "LCSD0320220421NSH",
      sellerName: "OM FERTILIZERS UJANI",
      buyerName: "KRISHI VIKAS BEEJ BHANDAR",
      stateName: "Maharashtra",
      stateCode: "27",
      districtName: "LATUR",
      districtCode: "481",
      blockName: "AUSA",
      pin: "413520",
      villageName: "Ujani",
      plotNo: "",
      sellerUserType: "DEALER",
      lotData: [
        {
          lotNum: "MAR25-13-065-571",
          cropName: "BENGAL GRAM (GRAM/CHICK PEA/KABULI/CHANA)",
          cropCode: "A0302",
          varietyCode: "A0302001",
          varietyName: "VIJAY(PHULEG-81-1-1)",
          unitPrice: "1760",
          packingSize: "20",
          packingUnit: "kg",
          totalBags: 1,
          totalQty: 0.2,
          interStateMovement: false,
          certificationClass: "CERTIFIED I",
          season: "RABI (2024-25)",
          year: "2024-25",
          expiryDate: "19-05-2026",
          tax: {
            cropRegCode: null,
            hsnCode: 0,
            cgst: 0,
            sgst: 0,
            igst: 0
          }
        }
      ]
    }
  ]
};

document.addEventListener("DOMContentLoaded", async () => {
  bindNavigation();
  bindMappingFocusRepair();
  bindActions();
  try {
    await loadConfig();
    await loadDemoModeStatus();
    loadTallyXmlSample();
  } catch (error) {
    showToast(error.message || "Configuration load failed.");
    setText("tallyNote", error.message || "Configuration load failed.");
  }
  try {
    await loadLicenseStatus();
  } catch (error) {
    state.license = {
      activated: false,
      status: "license_error",
      message: error.message || "License status check failed."
    };
    renderLicenseState();
  }
  updateVoucherOptions();
  renderOrders();
  renderLotDetails();
  setDefaultReportPeriod();
  setDefaultFormDPeriod();
  renderReports();
  renderFormDReport();
  updateActionFields();
  applyLanguage();
  await startBackgroundStartup();
  await previewRequest().catch(() => { });
  await resumeMappingAfterReload();
});

function loadSavedLanguage() {
  try {
    return localStorage.getItem(languageStorageKey) === "mr" ? "mr" : "en";
  } catch {
    return "en";
  }
}

function loadSavedTheme() {
  try {
    return normalizeTheme(localStorage.getItem(themeStorageKey));
  } catch {
    return "green";
  }
}

function normalizeTheme(theme) {
  return theme === "blue" ? "blue" : "green";
}

function applyTheme(theme) {
  currentTheme = normalizeTheme(theme);
  document.body.dataset.theme = currentTheme;
  const select = document.getElementById("uiThemeSelect");
  if (select) select.value = currentTheme;
  try {
    localStorage.setItem(themeStorageKey, currentTheme);
  } catch {
    // Theme preference is optional until configuration is saved.
  }
}

function t(key, fallback) {
  if (currentLanguage !== "mr") return fallback;
  return mrText[key] || fallback;
}

function setLanguage(language) {
  currentLanguage = language === "mr" ? "mr" : "en";
  try {
    localStorage.setItem(languageStorageKey, currentLanguage);
  } catch {
    // Language preference is optional.
  }
  renderOrders();
  renderLotDetails();
  applyLanguage();
}

function applyLanguage() {
  document.documentElement.lang = currentLanguage === "mr" ? "mr" : "en";
  document.querySelectorAll("[data-i18n]").forEach((element) => {
    const key = element.dataset.i18n;
    if (!element.dataset.i18nEn) element.dataset.i18nEn = element.textContent;
    element.textContent = t(key, element.dataset.i18nEn || element.textContent);
  });
  updateLanguageToggle();
  updateApiActionLabels();
  translateDefaultText("saathiStatus", "Not checked", "notChecked");
  translateDefaultText("tallyStatus", "Not checked", "notChecked");
  translateDefaultText("saathiStatusHint", "Ready", "ready");
  translateDefaultText("orderStatusHint", "No data loaded", "noDataLoaded");
  translateDefaultText("tallyNote", "Tally status not checked.", "tallyStatusNotChecked");
  translateDefaultText("lastResponse", "No request sent in this session.", "lastResponseEmpty");

  const activeTab = document.querySelector(".tab-panel.active")?.id || "dashboard";
  updatePageTitle(activeTab);
}

function translateDefaultText(id, englishText, key) {
  const element = document.getElementById(id);
  if (!element) return;
  const translated = t(key, englishText);
  const knownValues = new Set([englishText, mrText[key]].filter(Boolean));
  if (knownValues.has(element.textContent.trim())) {
    element.textContent = translated;
  }
}

function updateLanguageToggle() {
  const button = document.getElementById("languageToggle");
  const label = document.getElementById("languageToggleText");
  if (!button || !label) return;
  const isMarathi = currentLanguage === "mr";
  button.classList.toggle("active", isMarathi);
  button.setAttribute("aria-pressed", String(isMarathi));
  label.textContent = isMarathi ? t("languageToggleOn", "English info") : "मराठी माहिती";
}

function updateApiActionLabels() {
  const labels = {
    pendingOrders: t("apiPendingOrders", "Get pending orders by buyer code"),
    pullLot: t("apiPullLot", "Pull lot details - marks received"),
    fetchLot: t("apiFetchLot", "Fetch already received lot details"),
    createOrder: t("apiCreateOrder", "Create SATHI order")
  };
  Object.entries(labels).forEach(([value, label]) => {
    const option = document.querySelector(`#apiAction option[value="${value}"]`);
    if (option) option.textContent = label;
    const button = document.querySelector(`.api-action-button[data-api-action="${value}"] strong`);
    if (button) button.textContent = label.replace(" by buyer code", "").replace(" - marks received", "");
  });
}

function updatePageTitle(tab) {
  const key = `title${tab.charAt(0).toUpperCase()}${tab.slice(1)}`;
  document.getElementById("pageTitle").textContent = t(key, titles[tab]);
}

async function startBackgroundStartup() {
  try {
    await Promise.allSettled([
      bootstrapTallyCompany(),
      loadErrors(),
      loadArchive(),
      loadTallyLogs(),
      loadItemMappings(),
      loadPartyMappings(),
      loadTallyGodowns({ silent: true })
    ]);
  } catch {
    // Individual startup calls already update their visible panels.
  }
}

async function loadDemoModeStatus() {
  const result = await api("/api/demo-mode/status");
  state.demo = { ...state.demo, ...(result.demo || {}), token: state.demo.token || "" };
  renderDemoModeStatus();
}

function renderDemoModeStatus() {
  const enabled = Boolean(state.demo?.enabled);
  document.body.dataset.portalMode = enabled ? "demo" : "live";
  document.getElementById("demoModeBadge")?.classList.toggle("hidden", !enabled);

  const stateLabel = document.getElementById("demoModeState");
  if (stateLabel) {
    stateLabel.textContent = enabled ? "Demo Mode Active" : "Live Mode";
    stateLabel.classList.toggle("active", enabled);
  }

  const toggle = document.getElementById("demoModeToggleBtn");
  if (toggle) {
    toggle.textContent = enabled ? "Disable Demo Mode" : "Enable Demo Mode";
    toggle.classList.toggle("danger-button", enabled);
  }

  const reset = document.getElementById("demoModeResetBtn");
  if (reset) reset.disabled = !enabled;

  const note = document.getElementById("demoModeNote");
  if (note) {
    note.textContent = enabled
      ? `${state.demo.sampleCount || 10} local demo orders are ready. Portal calls are simulated; Tally remains live.`
      : "Live portal calls are active. Demo Mode changes only SATHI portal fetch/pull/push responses.";
  }

  if (enabled) {
    setStatus("saathiStatus", "Demo ready", "success");
    setText("saathiStatusHint", "Local portal simulator active. Tally operations are live.");
  }
}

async function authenticateDemoControls() {
  const input = document.getElementById("demoModePassword");
  const password = input?.value || "";
  if (!password) throw new Error("Enter the Demo Mode password.");
  const result = await api("/api/demo-mode/authenticate", { method: "POST", body: { password } });
  state.demo.token = result.token || "";
  if (input) input.value = "";
  return state.demo.token;
}

async function toggleDemoMode() {
  const button = document.getElementById("demoModeToggleBtn");
  try {
    if (button) button.disabled = true;
    const token = await authenticateDemoControls();
    const enabled = !Boolean(state.demo.enabled);
    const result = await api("/api/demo-mode/toggle", {
      method: "POST",
      body: {
        token,
        enabled,
        companyName: selectedCompanyName(),
        scope: activeScopePayload()
      }
    });
    state.demo = { ...state.demo, ...(result.demo || {}), token };
    state.orders = [];
    state.lotBills = [];
    state.tallyStatuses = {};
    state.tallyResults = {};
    renderDemoModeStatus();
    await loadStoredSathiQueue({ silent: true }).catch(() => { });
    renderOrders();
    renderLotDetails();
    showToast(enabled ? "Demo Mode enabled." : "Live portal mode restored.");
  } catch (error) {
    showToast(error.message || "Demo Mode could not be changed.");
  } finally {
    if (button) button.disabled = false;
  }
}

async function resetDemoData() {
  const button = document.getElementById("demoModeResetBtn");
  try {
    if (button) button.disabled = true;
    const token = await authenticateDemoControls();
    const result = await api("/api/demo-mode/reset", {
      method: "POST",
      body: { token, companyName: selectedCompanyName(), scope: activeScopePayload() }
    });
    state.demo = { ...state.demo, ...(result.demo || {}), token };
    state.orders = [];
    state.lotBills = [];
    state.tallyStatuses = {};
    state.tallyResults = {};
    renderDemoModeStatus();
    await loadStoredSathiQueue({ silent: true }).catch(() => { });
    updateVoucherOptions();
    renderOrders();
    renderLotDetails();
    showToast("Demo data reset. Presentation can start again.");
  } catch (error) {
    showToast(error.message || "Demo data could not be reset.");
  } finally {
    if (button) button.disabled = !state.demo.enabled;
  }
}

function bindNavigation() {
  document.querySelectorAll(".nav-item[data-tab]").forEach((button) => {
    button.addEventListener("click", () => {
      if (button.dataset.reportNav) {
        state.reports.active = button.dataset.reportNav;
        state.reports.expandedKey = "";
      }
      switchTab(button.dataset.tab);
    });
  });

  document.getElementById("reportsNavToggle")?.addEventListener("click", () => {
    const group = document.getElementById("reportsNavGroup");
    const isOpen = !group?.classList.contains("open");
    group?.classList.toggle("open", isOpen);
    document.getElementById("reportsNavToggle")?.setAttribute("aria-expanded", String(isOpen));
  });

  document.getElementById("settingsNavToggle")?.addEventListener("click", () => {
    const group = document.getElementById("settingsNavGroup");
    const isOpen = !group?.classList.contains("open");
    group?.classList.toggle("open", isOpen);
    document.getElementById("settingsNavToggle")?.setAttribute("aria-expanded", String(isOpen));
  });

  document.querySelectorAll("[data-switch-tab]").forEach((button) => {
    button.addEventListener("click", () => switchTab(button.dataset.switchTab));
  });
}

function bindMappingFocusRepair() {
  const selector = ".mapping-review-input, .party-review-input";
  const remember = (input) => {
    if (input?.matches?.(selector)) lastMappingFocusTarget = input;
  };
  const repairFocus = (input) => {
    if (!input?.matches?.(selector) || input.disabled || input.readOnly) return;
    remember(input);
    const wasFocused = document.activeElement === input;
    window.setTimeout(() => {
      if (!input.isConnected || input.disabled || input.readOnly) return;
      if (document.activeElement !== input) input.focus({ preventScroll: true });
      if (!wasFocused && typeof input.setSelectionRange === "function") {
        const end = String(input.value || "").length;
        input.setSelectionRange(end, end);
      }
    }, 0);
    window.setTimeout(() => {
      if (input.isConnected && !input.disabled && !input.readOnly && document.activeElement !== input) {
        input.focus({ preventScroll: true });
      }
    }, 80);
  };

  ["pointerdown", "mousedown", "click"].forEach((eventName) => {
    document.addEventListener(eventName, (event) => {
      const input = event.target?.closest?.(selector)
        || event.target?.closest?.(".mapping-step-control")?.querySelector?.(selector);
      if (input) repairFocus(input);
    }, true);
  });

  document.addEventListener("focusin", (event) => remember(event.target), true);
  const recoverLastMappingFocus = () => {
    refreshMappingInteractivity({ focusFirst: false });
    const input = lastMappingFocusTarget;
    if (!input?.isConnected || input.disabled || input.readOnly) return;
    window.setTimeout(() => {
      if (input.isConnected && document.activeElement === document.body) input.focus({ preventScroll: true });
    }, 80);
  };
  window.addEventListener("focus", recoverLastMappingFocus);
  window.addEventListener("sathi-window-focus", recoverLastMappingFocus);
  window.addEventListener("pageshow", () => refreshMappingInteractivity({ focusFirst: false }));
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) refreshMappingInteractivity({ focusFirst: false });
  });
}

function refreshMappingInteractivity(options = {}) {
  const panel = document.getElementById("lots");
  if (!panel) return;
  const inputs = [...panel.querySelectorAll(".party-review-input, .mapping-review-input")];
  if (!inputs.length) return;
  inputs.forEach((input) => {
    if (input.disabled) return;
    input.readOnly = false;
    input.tabIndex = 0;
    input.style.pointerEvents = "auto";
    input.style.userSelect = "text";
    input.style.cursor = "text";
  });
  // Force a browser reflow; this fixes the stale-hitbox/focus state seen after dynamic mapping render.
  void panel.offsetHeight;
  if (options.focusFirst === false) return;
  const target = lastMappingFocusTarget?.isConnected && !lastMappingFocusTarget.disabled && !lastMappingFocusTarget.readOnly
    ? lastMappingFocusTarget
    : inputs.find((input) => !input.disabled && !input.readOnly && input.offsetParent !== null);
  if (!target) return;
  window.requestAnimationFrame(() => {
    if (!target.isConnected || target.disabled || target.readOnly) return;
    target.focus({ preventScroll: true });
  });
}

function wakeMappingInputs(options = {}) {
  const panel = document.getElementById("lots");
  if (!panel?.classList.contains("active")) return;
  refreshMappingInteractivity({ focusFirst: false });
  const selector = ".party-review-input:not(:disabled):not([readonly]), .mapping-review-input:not(:disabled):not([readonly])";
  const run = () => {
    refreshMappingInteractivity({ focusFirst: false });
    const input = panel.querySelector(selector);
    if (!input) return;
    lastMappingFocusTarget = input;
    if (options.focus === false) return;
    window.focus?.();
    input.focus({ preventScroll: true });
    if (typeof input.setSelectionRange === "function") {
      const end = String(input.value || "").length;
      input.setSelectionRange(end, end);
    }
  };
  window.requestAnimationFrame(run);
  window.setTimeout(run, 120);
  window.setTimeout(run, 360);
  window.setTimeout(() => refreshMappingInteractivity({ focusFirst: options.focus !== false }), 650);
}

function reloadIntoMapping(voucherNumber = "") {
  try {
    sessionStorage.setItem(mappingReloadStorageKey, JSON.stringify({
      voucherNumber: String(voucherNumber || "").trim(),
      createdAt: Date.now()
    }));
  } catch {
    switchTab("lots");
    wakeMappingInputs();
    return;
  }
  window.setTimeout(() => window.location.reload(), 120);
}

async function resumeMappingAfterReload() {
  let pending = null;
  try {
    const raw = sessionStorage.getItem(mappingReloadStorageKey);
    sessionStorage.removeItem(mappingReloadStorageKey);
    pending = raw ? JSON.parse(raw) : null;
  } catch {
    pending = null;
  }
  if (!pending || Date.now() - Number(pending.createdAt || 0) > 120000) return;
  state.activeMappingVoucherNumber = String(pending.voucherNumber || "").trim();
  await loadStoredSathiQueue({ silent: true }).catch(() => { });
  renderOrders();
  renderLotDetails();
  switchTab("lots");
  wakeMappingInputs();
}

function switchTab(tab) {
  if (tab === "reportRojmel") tab = "reportPurchase";
  if (reportTabMap[tab]) {
    state.reports.active = reportTabMap[tab];
    state.reports.expandedKey = "";
  }
  const actualTab = reportTabMap[tab] ? "reports" : tab;
  const panel = document.getElementById(actualTab);
  if (!panel) return;
  document.querySelectorAll(".nav-item").forEach((item) => item.classList.toggle("active", item.dataset.tab === tab));
  document.querySelectorAll(".tab-panel").forEach((panel) => panel.classList.remove("active"));
  panel.classList.add("active");
  updateSettingsNavState(tab);
  updateReportsNavState(tab);
  updatePageTitle(tab);
  if (actualTab === "lots") wakeMappingInputs();
  if (actualTab === "reports") renderReports();
  if (actualTab === "salesRecovery") renderSalesRecovery();
  if (tab === "formD") renderFormDReport();
}

function updateSettingsNavState(tab) {
  const settingsTabs = new Set(["settings", "lots", "companyUdfs", "license", "errors"]);
  const isSettingsTab = settingsTabs.has(tab);
  const group = document.getElementById("settingsNavGroup");
  const toggle = document.getElementById("settingsNavToggle");
  group?.classList.toggle("open", isSettingsTab || group.classList.contains("open"));
  toggle?.classList.toggle("active", isSettingsTab);
  toggle?.setAttribute("aria-expanded", String(Boolean(group?.classList.contains("open"))));
}

function updateReportsNavState(tab) {
  const isReportTab = ["reports", "reportSales", "reportPurchase", "reportGrn", "reportRojmel", "reportBatchExpiry", "reportFarmerDealer", "reportLotTrace", "reportLicenceStock", "reportExpiryRisk", "formD"].includes(tab);
  const group = document.getElementById("reportsNavGroup");
  const toggle = document.getElementById("reportsNavToggle");
  group?.classList.toggle("open", isReportTab || group.classList.contains("open"));
  toggle?.classList.toggle("active", isReportTab);
  toggle?.setAttribute("aria-expanded", String(Boolean(group?.classList.contains("open"))));
}

function bindActions() {
  document.getElementById("apiAction").addEventListener("change", () => {
    updateActionFields();
    previewRequest();
  });
  document.querySelectorAll(".api-action-button").forEach((button) => {
    button.addEventListener("click", () => {
      document.getElementById("apiAction").value = button.dataset.apiAction || "pendingOrders";
      updateActionFields();
      previewRequest();
    });
  });

  ["quickOwnerCode", "quickStateCode", "voucherNumber", "locationCode", "createOrderJson"].forEach((id) => {
    document.getElementById(id).addEventListener("input", debounce(previewRequest, 350));
  });

  document.getElementById("previewRequestBtn")?.addEventListener("click", previewRequest);
  document.getElementById("languageToggle").addEventListener("click", () => {
    setLanguage(currentLanguage === "mr" ? "en" : "mr");
  });
  document.getElementById("portalPreviewBtn").addEventListener("click", () => preparePortalCreateOrder({ send: false, openPreview: true }));
  document.getElementById("portalSendBtn").addEventListener("click", () => preparePortalCreateOrder({ send: true, openPreview: false }));
  document.getElementById("portalBulkSendBtn")?.addEventListener("click", bulkUploadPortalSales);
  document.getElementById("portalRefreshSalesBtn").addEventListener("click", loadPortalSalesEntries);
  document.getElementById("portalCheckTallyStatusBtn")?.addEventListener("click", () => loadPortalSalesEntries({ force: true }));
  document.getElementById("portalShowAllSales")?.addEventListener("change", () => renderPortalSalesEntries());
  document.getElementById("ordersShowAll")?.addEventListener("change", () => renderOrders());
  document.getElementById("ordersSearchInput")?.addEventListener("input", debounce((event) => {
    state.ordersFilter.search = event.target.value || "";
    renderOrders();
  }, 120));
  document.getElementById("ordersTallyFilter")?.addEventListener("change", (event) => {
    state.ordersFilter.tally = event.target.value || "all";
    renderOrders();
  });
  document.getElementById("ordersMappingFilter")?.addEventListener("change", (event) => {
    state.ordersFilter.mapping = event.target.value || "all";
    renderOrders();
  });
  document.getElementById("ordersFilterClearBtn")?.addEventListener("click", clearOrdersFilters);
  document.getElementById("portalPushForm")?.elements?.buyerRole?.addEventListener("change", (event) => {
    const form = document.getElementById("portalPushForm");
    if (form?.elements?.isRetailSell && event.target.value === "FARMER") {
      form.elements.isRetailSell.value = "Yes";
    }
  });
  document.getElementById("portalPushForm")?.elements?.isRetailSell?.addEventListener("change", (event) => {
    const form = document.getElementById("portalPushForm");
    if (form?.elements?.buyerRole && event.target.value === "Yes") {
      form.elements.buyerRole.value = "FARMER";
    }
  });
  document.getElementById("sendWorkbenchBtn").addEventListener("click", sendWorkbenchRequest);
  document.getElementById("sendWorkbenchTopBtn").addEventListener("click", () => {
    switchTab("dashboard");
    document.querySelector(".advanced-workbench")?.setAttribute("open", "");
    document.querySelector(".advanced-workbench")?.scrollIntoView({ behavior: "smooth", block: "start" });
  });
  document.getElementById("fetchOrdersTableBtn").addEventListener("click", () => {
    document.getElementById("apiAction").value = "pendingOrders";
    updateActionFields();
    sendWorkbenchRequest();
  });
  document.querySelectorAll("[data-action='quickFetchOrders']").forEach((button) => {
    button.addEventListener("click", () => {
      document.getElementById("apiAction").value = "pendingOrders";
      updateActionFields();
      document.querySelector(".advanced-workbench")?.setAttribute("open", "");
      document.querySelector(".advanced-workbench")?.scrollIntoView({ behavior: "smooth", block: "start" });
      document.getElementById("apiAction")?.focus();
      previewRequest();
    });
  });

  document.getElementById("testTallyBtn").addEventListener("click", testTally);
  document.getElementById("testTallySettingsBtn").addEventListener("click", testTally);
  document.getElementById("licenceScopeSelect")?.addEventListener("change", async (event) => {
    selectLicenceScope(event.target.value, { persist: true });
    await loadStoredSathiQueue({ silent: true });
    await previewRequest();
    await loadPortalSalesEntries({ silent: true });
  });
  document.getElementById("topLicenceScopeSelect")?.addEventListener("change", async (event) => {
    selectLicenceScope(event.target.value, { persist: true });
    await loadStoredSathiQueue({ silent: true });
    await previewRequest();
    await loadPortalSalesEntries({ silent: true });
  });
  document.getElementById("clearOrdersBtn").addEventListener("click", clearOrders);
  document.getElementById("reviewMappingsBtn").addEventListener("click", openItemMappingReview);
  document.getElementById("checkTallyBulkBtn").addEventListener("click", checkAllTallyStatuses);
  document.getElementById("pushBulkBtn").addEventListener("click", pushAllPendingToTally);
  document.getElementById("recoveryCloseBtn")?.addEventListener("click", closeRecoveryAssistant);
  document.getElementById("recoveryDialog")?.addEventListener("click", handleRecoveryAssistantClick);
  document.getElementById("refreshSalesRecoveryBtn")?.addEventListener("click", refreshSalesRecovery);
  document.getElementById("salesRecoveryViewTabs")?.addEventListener("click", handleSalesRecoveryViewClick);
  document.getElementById("salesRecoveryBody")?.addEventListener("click", handleSalesRecoveryClick);
  document.getElementById("salesRecoverySearchInput")?.addEventListener("input", debounce((event) => {
    state.salesRecovery.filters.search = event.target.value || "";
    renderSalesRecovery();
  }, 120));
  document.getElementById("salesRecoveryStatusFilter")?.addEventListener("change", (event) => {
    state.salesRecovery.filters.status = event.target.value || "all";
    renderSalesRecovery();
  });
  document.getElementById("salesRecoveryQtyFilter")?.addEventListener("change", (event) => {
    state.salesRecovery.filters.qty = event.target.value || "all";
    renderSalesRecovery();
  });
  document.getElementById("salesRecoveryFilterClearBtn")?.addEventListener("click", clearSalesRecoveryFilters);
  document.getElementById("orderCommonGodownInput")?.addEventListener("input", (event) => {
    state.commonGodownName = event.target.value.trim();
  });
  document.getElementById("saveItemMappingsBtn").addEventListener("click", saveLotMappingsAndContinue);
  document.getElementById("refreshTallyLogsBtn").addEventListener("click", loadTallyLogs);
  document.getElementById("clearTallyLogsBtn").addEventListener("click", clearTallyLogs);
  document.getElementById("fetchCompanyUdfsBtn").addEventListener("click", () => loadLicenceScopes({ silent: false }));
  document.getElementById("loadTallyXmlSampleBtn")?.addEventListener("click", () => loadTallyXmlSample({ force: true }));
  document.getElementById("sendTallyXmlBtn")?.addEventListener("click", sendTallyXmlRequest);
  document.getElementById("refreshErrorsBtn").addEventListener("click", loadErrors);
  document.getElementById("refreshErrorsPanelBtn").addEventListener("click", loadErrors);
  document.getElementById("clearErrorsBtn").addEventListener("click", clearErrors);
  document.getElementById("refreshLicenseBtn")?.addEventListener("click", async () => {
    await loadLicenseStatus();
    showToast("License status refreshed.");
  });
  document.getElementById("importLicensePanelBtn")?.addEventListener("click", () => activateLicenseFromFile("licensePanelFileInput"));
  document.getElementById("clearLicenseBtn")?.addEventListener("click", clearLicense);
  document.getElementById("showActivationRequestBtn")?.addEventListener("click", showActivationRequestForm);
  document.getElementById("cancelActivationRequestBtn")?.addEventListener("click", hideActivationRequestForm);
  document.getElementById("activationRequestForm")?.addEventListener("submit", sendActivationRequest);
  document.getElementById("closeTallyConnectionPopupBtn")?.addEventListener("click", hideTallyConnectionPopup);
  document.getElementById("popupTestTallyBtn")?.addEventListener("click", async () => {
    try {
      await testTally();
      hideTallyConnectionPopup();
      await loadLicenseStatus().catch(() => { });
    } catch {
      // testTally updates the popup/status on failure.
    }
  });
  document.getElementById("refreshActivationScopesBtn")?.addEventListener("click", () => loadLicenceScopes({ silent: false }));
  document.getElementById("refreshArchiveBtn").addEventListener("click", loadArchive);
  document.getElementById("clearArchiveBtn").addEventListener("click", clearArchive);
  document.getElementById("configForm").addEventListener("submit", saveConfig);
  document.getElementById("demoModeToggleBtn")?.addEventListener("click", toggleDemoMode);
  document.getElementById("demoModeResetBtn")?.addEventListener("click", resetDemoData);
  document.getElementById("demoModePassword")?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      toggleDemoMode();
    }
  });
  document.getElementById("uiThemeSelect")?.addEventListener("change", (event) => {
    applyTheme(event.target.value);
  });
  document.getElementById("refreshReportsBtn")?.addEventListener("click", loadActiveReport);
  document.getElementById("exportReportExcelBtn")?.addEventListener("click", () => exportActiveReport("excel"));
  document.getElementById("exportReportPdfBtn")?.addEventListener("click", () => exportActiveReport("pdf"));
  document.getElementById("refreshFormDBtn")?.addEventListener("click", loadFormDReport);
  document.querySelectorAll(".report-switch-button").forEach((button) => {
    button.addEventListener("click", () => {
      if (button.dataset.reportType === "rojmel") return;
      state.reports.active = button.dataset.reportType || "purchase";
      state.reports.expandedKey = "";
      renderReports();
      loadActiveReport();
    });
  });
  document.querySelectorAll("[data-report-addon]").forEach((button) => {
    button.addEventListener("click", () => {
      openReportAddon(button.dataset.reportAddon || "");
    });
  });

  document.getElementById("companySelect").addEventListener("change", async (event) => {
    const input = document.querySelector("[name=tallyCompanyName]");
    input.value = event.target.value;
    updateSidebarCompany(event.target.value, document.querySelector("[name=tallyUrl]").value);
    renderCompanyUdfs();
    await loadCompanySettings(event.target.value);
    await loadLicenceScopes({ silent: true });
    await loadTallyStockItems({ silent: true });
    await loadTallyLedgers({ silent: true });
    await loadTallyGodowns({ silent: true });
    await loadItemMappings();
    await loadPartyMappings();
    await loadStoredSathiQueue({ silent: true });
    renderOrders();
    renderLotDetails();
    await loadPortalSalesEntries({ silent: true });
  });

  document.getElementById("voucherNumberSelect")?.addEventListener("change", (event) => {
    if (!event.target.value) return;
    setValue("voucherNumber", event.target.value);
    previewRequest();
  });

  document.querySelectorAll(".copy-button").forEach((button) => {
    button.addEventListener("click", () => copyElementText(button.dataset.copy));
  });
}

function loadTallyXmlSample(options = {}) {
  const editor = document.getElementById("tallyXmlEditor");
  if (!editor || (!options.force && editor.value.trim())) return;
  const companyName = document.querySelector("[name=tallyCompanyName]")?.value
    || state.config?.tally?.companyName
    || "Sai Enterprises";
  editor.value = `<ENVELOPE>
  <HEADER>
    <VERSION>1</VERSION>
    <TALLYREQUEST>Export</TALLYREQUEST>
    <TYPE>Data</TYPE>
    <ID>UpdateSathiInSalesAPI</ID>
  </HEADER>
  <BODY>
    <DESC>
      <STATICVARIABLES>
        <SVCURRENTCOMPANY>${escapeHtml(companyName)}</SVCURRENTCOMPANY>
        <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
        <SATHIEXTCOMPANYNAME TYPE="String">${escapeHtml(companyName)}</SATHIEXTCOMPANYNAME>
        <SATHIEXTMASTERID TYPE="String">5337</SATHIEXTMASTERID>
        <SATHIEXTSTATUS TYPE="String">abc</SATHIEXTSTATUS>
        <SATHIEXTVCHNO TYPE="String">11223344</SATHIEXTVCHNO>
      </STATICVARIABLES>
    </DESC>
  </BODY>
</ENVELOPE>`;
}

async function sendTallyXmlRequest() {
  const editor = document.getElementById("tallyXmlEditor");
  const output = document.getElementById("tallyXmlResponse");
  const button = document.getElementById("sendTallyXmlBtn");
  const xml = editor?.value?.trim() || "";
  if (!xml) {
    showToast("Enter the Tally XML request.");
    editor?.focus();
    return;
  }

  button.disabled = true;
  output.textContent = "Sending XML request to Tally...";
  try {
    const result = await api("/api/tally/raw-xml", {
      method: "POST",
      body: {
        companyName: document.querySelector("[name=tallyCompanyName]")?.value || "",
        xml
      }
    });
    output.textContent = result.response || "(Tally returned an empty response.)";
    output.dataset.status = result.tallyOk ? "success" : "error";
    showToast(result.tallyOk ? "Tally XML request completed." : "Tally returned an XML error.");
  } catch (error) {
    output.textContent = error.response || error.error?.message || error.message || "Tally XML request failed.";
    output.dataset.status = "error";
    showToast(error.message || "Tally XML request failed.");
  } finally {
    button.disabled = false;
  }
}

async function loadConfig() {
  const result = await api("/api/config");
  state.config = result.config;

  const { saathi, tally } = state.config;
  applyTheme(state.config.ui?.theme || currentTheme);
  setValue("quickOwnerCode", saathi.ownerCode);
  setValue("quickStateCode", saathi.stateCode);
  setValue("locationCode", saathi.locationCode);
  setValue("createOrderJson", JSON.stringify(buildCreateOrderTemplate(saathi), null, 2));
  syncPortalCreateForm(buildCreateOrderTemplate(saathi));
  setDefaultPortalPeriod();

  const form = document.getElementById("configForm");
  form.uiTheme.value = currentTheme;
  form.saathiBaseUrl.value = saathi.baseUrl;
  form.saathiClientId.value = saathi.clientId;
  form.saathiClientSecretMode.value = saathi.clientSecretMode;
  form.saathiOwnerCode.value = saathi.ownerCode;
  form.saathiLocationCode.value = saathi.locationCode;
  form.saathiStateCode.value = saathi.stateCode;
  if (form.saathiApplicabilityDate) form.saathiApplicabilityDate.value = saathi.applicabilityDate || "";
  form.saathiTimeoutMs.value = saathi.timeoutMs;
  form.saathiRetryCount.value = saathi.retryCount;
  form.tallyUrl.value = tally.url;
  form.tallyCompanyName.value = tally.companyName;
  form.tallyTimeoutMs.value = tally.timeoutMs;
  form.tallyEntryType.value = tally.entryType || "regular";
  form.tallyVoucherTypeName.value = tally.voucherTypeName;
  form.tallySalesVoucherTypeName.value = tally.salesVoucherTypeName;
  form.tallyGrnVoucherTypeName.value = tally.grnVoucherTypeName || "";
  updateGrnVoucherTypeOptions();
  form.tallyPurchaseLedgerName.value = tally.purchaseLedgerName;
  form.tallyPartyMode.value = tally.partyMode;
  form.tallyStockItemMode.value = tally.stockItemMode;
  form.tallyQuantityMode.value = tally.quantityMode;
  form.tallyUnitName.value = tally.unitName;
  form.tallyGodownName.value = tally.godownName;
  form.tallyGstRegistrationName.value = tally.gstRegistrationName;
  form.tallyCompanyRegistrationType.value = tally.companyRegistrationType;
  form.tallyPartyRegistrationType.value = tally.partyRegistrationType;
  form.tallyCgstLedgerName.value = tally.cgstLedgerName;
  form.tallySgstLedgerName.value = tally.sgstLedgerName;
  form.tallyIgstLedgerName.value = tally.igstLedgerName;

  updateCompanyOptions(tally.companyName ? [tally.companyName] : [], tally.companyName);
  updateSidebarCompany(tally.companyName, tally.url);
  updatePortalSourceStrip();
  renderCompanyUdfs();
}

function buildCreateOrderTemplate(saathi = {}) {
  const scope = activeLicenceScope();
  const fields = scope?.fields || {};
  return {
    ...sampleCreateOrder,
    ownerCode: fields.ownerCode || scope?.clientId || saathi.ownerCode || saathi.clientId || sampleCreateOrder.ownerCode,
    locationCode: fields.locationCode || fields.ownerCode || scope?.clientId || saathi.locationCode || saathi.ownerCode || saathi.clientId || sampleCreateOrder.locationCode,
    stateCode: fields.stateCode || saathi.stateCode || sampleCreateOrder.stateCode,
    buyerStateCode: fields.stateCode || saathi.stateCode || sampleCreateOrder.buyerStateCode
  };
}

function syncPortalCreateForm(template = buildCreateOrderTemplate(state.config?.saathi || {})) {
  const form = document.getElementById("portalPushForm");
  if (!form) return;

  const bill = state.lotBills.filter(belongsToActiveLicence)[0] || {};
  const lot = (bill.lotData || [])[0] || {};
  const values = {
    ...template,
    originalOwner: bill.sellerCode || template.originalOwner || "",
    lotNum: lot.lotNum || template.lotTypeStockDetails?.[0]?.lotNum || "",
    certificationClass: lot.certificationClass || template.lotTypeStockDetails?.[0]?.certificationClass || "",
    packingSize: lot.packingSize || template.lotTypeStockDetails?.[0]?.packingSize || "",
    quantity: lot.totalQty ?? template.lotTypeStockDetails?.[0]?.quantity ?? "",
    stateCode: bill.stateCode || template.stateCode || "",
    stateName: bill.stateName || template.stateName || "",
    buyerStateCode: bill.stateCode || template.buyerStateCode || ""
  };

  Object.entries(values).forEach(([name, value]) => {
    if (form.elements[name]) form.elements[name].value = value ?? "";
  });
}

function portalCreateOrderPayload() {
  const form = document.getElementById("portalPushForm");
  const base = buildCreateOrderTemplate(state.config?.saathi || {});
  const value = (name) => form.elements[name]?.value?.trim() ?? "";
  const numberValue = (name, fallback = 0) => {
    const raw = value(name);
    if (raw === "") return fallback;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : fallback;
  };
  const numberFrom = (raw, fallback = 0) => {
    if (raw === "" || raw === undefined || raw === null) return fallback;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : fallback;
  };
  const lotDetail = {
    certificationClass: value("certificationClass"),
    lotNum: value("lotNum"),
    packingSize: value("packingSize"),
    quantity: numberValue("quantity", 0)
  };
  if (form.dataset.totalQty) lotDetail.totalQty = numberFrom(form.dataset.totalQty, 0);
  const activeSaleRows = state.activePortalSaleEntry ? selectedPortalItems(state.activePortalSaleEntry) : [];
  const scopedLotDetails = activeSaleRows.map((item) => {
    const trace = portalTraceForItem(state.activePortalSaleEntry, item) || {};
    const detail = {
      certificationClass: value("certificationClass"),
      lotNum: item.lotNum || "",
      packingSize: item.packingSize || trace.packingSize || value("packingSize"),
      quantity: Math.abs(Number(item.quantity || 0))
    };
    const totalQty = Number(item.quantityQtl || 0);
    if (Number.isFinite(totalQty) && totalQty > 0) detail.totalQty = totalQty;
    return detail;
  }).filter((item) => item.lotNum && item.quantity > 0);

  return {
    ...base,
    sourceVoucherNumber: form.dataset.sourceVoucherNumber || "",
    sourceVoucherKey: form.dataset.sourceVoucherKey || "",
    sourceRemoteId: form.dataset.sourceRemoteId || "",
    sourceMasterId: form.dataset.sourceMasterId || "",
    sourceReference: form.dataset.sourceReference || "",
    sourceVoucherDate: form.dataset.sourceVoucherDate || "",
    sourceVoucherTypeName: form.dataset.sourceVoucherTypeName || "",
    sourcePortalRows: state.activePortalSaleEntry ? portalSelectedRowPayload(state.activePortalSaleEntry) : [],
    isRetailSell: value("isRetailSell") || base.isRetailSell || "N",
    buyerCode: value("buyerCode"),
    ownerCode: value("ownerCode") || base.ownerCode,
    buyerRole: value("buyerRole") || "DEALER",
    sellerRole: value("sellerRole") || "DEALER",
    stateCode: value("stateCode") || base.stateCode,
    blockCode: value("blockCode"),
    districtCode: value("districtCode"),
    stateName: value("stateName") || "Maharashtra",
    blockName: value("blockName"),
    districtName: value("districtName"),
    villageName: value("villageName"),
    phoneNumber: value("phoneNumber"),
    panNumber: value("panNumber") || "A",
    gstNumber: value("gstNumber") || "A",
    villageCode: value("villageCode"),
    locationCode: value("locationCode") || base.locationCode,
    pin: value("pin"),
    plotNo: value("plotNo"),
    originalOwner: value("originalOwner"),
    subsidy: numberValue("subsidy", 0),
    lotTypeStockDetails: scopedLotDetails.length ? scopedLotDetails : [lotDetail],
    buyerStateCode: value("stateCode") || base.buyerStateCode || base.stateCode
  };
}

async function preparePortalCreateOrder({ send = false, openPreview = !send } = {}) {
  if (state.activePortalSaleEntry) fillPortalFormFromSale(state.activePortalSaleEntry);
  const payload = portalCreateOrderPayload();
  setValue("createOrderJson", JSON.stringify(payload, null, 2));
  document.getElementById("apiAction").value = "createOrder";
  updateActionFields();
  await previewRequest();
  if (openPreview) {
    switchTab("dashboard");
    document.querySelector(".advanced-workbench")?.setAttribute("open", "");
    document.querySelector(".request-preview-panel")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  if (send) return sendWorkbenchRequest();
  return true;
}

async function bootstrapTallyCompany() {
  const companyName = document.querySelector("[name=tallyCompanyName]")?.value || "";
  setStatus("tallyStatus", "Connecting...", "");
  setText("tallyNote", companyName ? "Auto connecting to saved Tally company." : "Auto detecting Tally company.");

  try {
    await testTally({ silent: true, keepSelectedCompany: true });
    await Promise.allSettled([
      loadTallyStockItems({ silent: true }),
      loadTallyLedgers({ silent: true }),
      loadItemMappings(),
      loadPartyMappings(),
      loadPortalSalesEntries({ silent: true })
    ]);
  } catch {
    // testTally and fetchCompanyUdfs already update visible status/logs.
  }
}

async function saveConfig(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const body = Object.fromEntries(new FormData(form).entries());
  const result = await api("/api/config", { method: "POST", body });

  state.config = result.config;
  applyTheme(result.config.ui?.theme || body.uiTheme || currentTheme);
  setValue("quickOwnerCode", result.config.saathi.ownerCode);
  setValue("quickStateCode", result.config.saathi.stateCode);
  setValue("locationCode", result.config.saathi.locationCode);
  updateSidebarCompany(result.config.tally.companyName, result.config.tally.url);
  updatePortalSourceStrip();
  showToast("Configuration saved locally.");
  await previewRequest();
}

async function persistCurrentConfig(message, options = {}) {
  const form = document.getElementById("configForm");
  const body = Object.fromEntries(new FormData(form).entries());
  const result = await api("/api/config", { method: "POST", body });

  state.config = result.config;
  applyTheme(result.config.ui?.theme || body.uiTheme || currentTheme);
  setValue("quickOwnerCode", result.config.saathi.ownerCode);
  setValue("quickStateCode", result.config.saathi.stateCode);
  setValue("locationCode", result.config.saathi.locationCode);
  updateSidebarCompany(result.config.tally.companyName, result.config.tally.url);
  updatePortalSourceStrip();
  if (!options.silent) showToast(message || "Configuration saved locally.");
}

async function loadCompanySettings(companyName) {
  if (!companyName) return;

  const result = await api(`/api/company-config?companyName=${encodeURIComponent(companyName)}`);
  const settings = result.settings || {};
  if (!Object.keys(settings).length) return;

  const form = document.getElementById("configForm");
  if (settings.saathiBaseUrl) form.saathiBaseUrl.value = settings.saathiBaseUrl;
  if (settings.saathiClientId) form.saathiClientId.value = settings.saathiClientId;
  if (settings.saathiClientSecretMode) form.saathiClientSecretMode.value = settings.saathiClientSecretMode;
  if (settings.saathiOwnerCode) form.saathiOwnerCode.value = settings.saathiOwnerCode;
  if (settings.saathiLocationCode) form.saathiLocationCode.value = settings.saathiLocationCode;
  if (settings.saathiStateCode) form.saathiStateCode.value = settings.saathiStateCode;
  if (settings.saathiApplicabilityDate && form.saathiApplicabilityDate) form.saathiApplicabilityDate.value = settings.saathiApplicabilityDate;
  if (settings.saathiTimeoutMs) form.saathiTimeoutMs.value = settings.saathiTimeoutMs;
  if (settings.saathiRetryCount) form.saathiRetryCount.value = settings.saathiRetryCount;
  if (settings.tallyVoucherTypeName) form.tallyVoucherTypeName.value = settings.tallyVoucherTypeName;
  if (settings.tallySalesVoucherTypeName) form.tallySalesVoucherTypeName.value = settings.tallySalesVoucherTypeName;
  if (settings.tallyGrnVoucherTypeName) {
    form.tallyGrnVoucherTypeName.value = settings.tallyGrnVoucherTypeName;
    updateGrnVoucherTypeOptions(settings.tallyGrnVoucherTypeName);
  }
  if (settings.tallyEntryType) form.tallyEntryType.value = settings.tallyEntryType;
  if (settings.tallyPurchaseLedgerName) form.tallyPurchaseLedgerName.value = settings.tallyPurchaseLedgerName;
  if (settings.tallyPartyMode) form.tallyPartyMode.value = settings.tallyPartyMode;
  if (settings.tallyStockItemMode) form.tallyStockItemMode.value = settings.tallyStockItemMode;
  if (settings.tallyQuantityMode) form.tallyQuantityMode.value = settings.tallyQuantityMode;
  if (settings.tallyUnitName) form.tallyUnitName.value = settings.tallyUnitName;
  if (settings.tallyGodownName) form.tallyGodownName.value = settings.tallyGodownName;
  if (settings.tallyGstRegistrationName) form.tallyGstRegistrationName.value = settings.tallyGstRegistrationName;
  if (settings.tallyCompanyRegistrationType) form.tallyCompanyRegistrationType.value = settings.tallyCompanyRegistrationType;
  if (settings.tallyPartyRegistrationType) form.tallyPartyRegistrationType.value = settings.tallyPartyRegistrationType;
  if (settings.tallyCgstLedgerName) form.tallyCgstLedgerName.value = settings.tallyCgstLedgerName;
  if (settings.tallySgstLedgerName) form.tallySgstLedgerName.value = settings.tallySgstLedgerName;
  if (settings.tallyIgstLedgerName) form.tallyIgstLedgerName.value = settings.tallyIgstLedgerName;
  setValue("quickOwnerCode", form.saathiOwnerCode.value);
  setValue("quickStateCode", form.saathiStateCode.value);
  setValue("locationCode", form.saathiLocationCode.value);
  ensureFormLicenceScope({ reason: "Company settings loaded." });
  updatePortalSourceStrip();
  showToast("Company-wise SATHI settings loaded.");
  await previewRequest();
}

function updatePortalSourceStrip() {
  const target = document.getElementById("portalSalesVoucherType");
  const partyTarget = document.getElementById("portalPartyLicenseValue");
  const form = document.getElementById("configForm");
  const scope = activeLicenceScope();
  if (!target || !form) return;
  target.textContent = scopeSalesVoucherTypeLabel(scope) || "Sales";
  if (partyTarget && partyTarget.textContent === "SATHI_TALLY_PARTY_LIC") {
    partyTarget.textContent = "From party master";
  }
}

function setDefaultPortalPeriod() {
  const today = new Date();
  const value = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const from = document.getElementById("portalDateFrom");
  const to = document.getElementById("portalDateTo");
  if (from && !from.value) from.value = value;
  if (to && !to.value) to.value = value;
}

async function previewRequest() {
  const action = document.getElementById("apiAction").value;
  if (action === "createOrder" && state.activePortalSaleEntry) {
    fillPortalFormFromSale(state.activePortalSaleEntry);
    setValue("createOrderJson", JSON.stringify(portalCreateOrderPayload(), null, 2));
  }

  try {
    const result = await api("/api/sathi/preview", {
      method: "POST",
      body: { action, payload: currentPayload(), scope: activeScopePayload() }
    });

    state.preview = result.preview;
    document.getElementById("requestUrl").textContent = `${result.preview.method} ${result.preview.url}`;
    document.getElementById("requestHeaders").value = JSON.stringify(result.preview.headers, null, 2);
    document.getElementById("requestBody").value = JSON.stringify(result.preview.body, null, 2);
    document.getElementById("fullRequestPreview").value = JSON.stringify({
      method: result.preview.method,
      url: result.preview.url,
      headers: result.preview.headers,
      body: result.preview.body
    }, null, 2);
  } catch (error) {
    document.getElementById("requestUrl").textContent = "Preview failed.";
    document.getElementById("requestHeaders").value = "{}";
    document.getElementById("requestBody").value = error.message;
    document.getElementById("fullRequestPreview").value = JSON.stringify({
      error: error.message
    }, null, 2);
  }
}

async function sendWorkbenchRequest() {
  const action = document.getElementById("apiAction").value;
  if (action === "createOrder") {
    if (state.activePortalSaleEntry) fillPortalFormFromSale(state.activePortalSaleEntry);
    setValue("createOrderJson", JSON.stringify(portalCreateOrderPayload(), null, 2));
  }
  if (action === "pullLot") {
    const ok = window.confirm("Pull lot details can mark this order as received and remove it from pending orders. Continue?");
    if (!ok) return;
  }

  try {
    setRequestBusy(true);
    setApiProgress({
      step: 0,
      percent: 12,
      title: "Preparing request",
      message: "Creating signed SATHI request for selected licence."
    });
    await previewRequest();
    if (state.license && !isLicenseActive() && !isEducationalAllowed()) {
      const licenseError = new Error(state.license.message || "License not activated.");
      licenseError.license = state.license;
      licenseError.isLicenseError = true;
      licenseError.status = state.license.status || "";
      throw licenseError;
    }
    setStatus("saathiStatus", "Calling...", "");
    document.getElementById("lastFetchNote").textContent = "Sending signed request to SATHI billing API.";
    document.getElementById("lastResponse").textContent = "Waiting for SATHI response...";
    setApiProgress({
      step: 1,
      percent: 34,
      title: "Sending request",
      message: "Request sent to SATHI billing API."
    });
    setApiProgress({
      step: 2,
      percent: 58,
      title: "Waiting for response",
      message: "SATHI server is processing the request."
    });

    const result = await api("/api/sathi/raw-call", {
      method: "POST",
      body: {
        action,
        requestHeaders: parseJsonEditor("requestHeaders"),
        requestBody: parseJsonEditor("requestBody"),
        scope: activeScopePayload()
      }
    });

    setApiProgress({
      step: 3,
      percent: 80,
      title: "Saving response",
      message: "Response received. Saving order and lot details locally."
    });
    document.getElementById("lastResponse").textContent = JSON.stringify({
      savedAs: result.saved?.id,
      response: result.raw
    }, null, 2);
    await loadArchive();
    setStatus("saathiStatus", "Success", "success");
    document.getElementById("saathiStatusHint").textContent = result.message || "SATHI returned a successful response.";
    document.getElementById("lastFetchNote").textContent = `Completed ${action} at ${formatDateTime(result.fetchedAt)}.`;

    if (action === "pendingOrders") {
      state.orders = (result.rows || []).map((row) => ({
        ...row,
        buyerCode: row.buyerCode || row.buyer_code || activeLicenceScope()?.clientId || ""
      })).filter(belongsToActiveLicence);
      await loadStoredSathiQueue({ silent: true });
      updateVoucherOptions();
      renderOrders();
      setApiProgress({
        step: 4,
        percent: 92,
        title: "Refreshing Tally status",
        message: "Checking whether fetched vouchers already exist in Tally."
      });
      await checkAllTallyStatuses().catch((error) => {
        setText("tallyStatusHint", error.message || "Tally status check skipped.");
      });
      switchTab("orders");
    }

    if (action === "pullLot" || action === "fetchLot") {
      state.lotBills = normalizeLotBills(result.raw).filter(belongsToActiveLicence);
      syncOrdersFromLotBills();
      await loadStoredSathiQueue({ silent: true });
      updateVoucherOptions();
      renderLotDetails();
      const firstBill = state.lotBills.filter(belongsToActiveLicence)[0];
      const mappingReady = firstBill && mappingStatusForBill(firstBill).label === t("ready", "Ready");
      if (mappingReady) switchTab("orders");
      else reloadIntoMapping(firstBill?.billNumber || firstBill?.voucherNumber || "");
    }

    if (action === "createOrder") {
      markActivePortalSaleSynced(result);
      renderPortalSalesEntries();
      await loadPortalSalesEntries({ silent: true }).catch((error) => {
        state.portalSalesWarning = `${error.message || "Could not refresh Tally sales entries."} SATHI upload was completed; showing local updated list.`;
        renderPortalSalesEntries();
      });
    }

    finishApiProgress(true, "SATHI request completed.");
    showToast("SATHI request completed.");
    return true;
  } catch (error) {
    const cleanMessage = extractApiMessage(error.message);
    finishApiProgress(false, cleanMessage);
    setStatus("saathiStatus", compactError(cleanMessage), "danger");
    document.getElementById("saathiStatusHint").textContent = cleanMessage;
    document.getElementById("lastFetchNote").textContent = error.message;
    document.getElementById("lastResponse").textContent = error.message;
    await loadErrors();
    showApiErrorToast(error, "SATHI request failed. Error Desk updated.");
    return false;
  } finally {
    setRequestBusy(false);
  }
}

function setRequestBusy(isBusy) {
  document.getElementById("sendWorkbenchBtn").disabled = isBusy;
  document.querySelectorAll(".api-action-button").forEach((button) => {
    button.disabled = isBusy;
  });
}

function markActivePortalSaleSynced(result = {}) {
  const active = state.activePortalSaleEntry;
  if (!active) return;
  const sathiVoucherNumber = extractSathiVoucherNumber(result.raw || result);
  const status = result.status || result.message || "Success";
  const selectedKeys = new Set(portalSelectedRowPayload(active).map((row) => row.rowKey));
  active.inventory = arrayOf(active.inventory).map((item) => selectedKeys.has(portalRowKey(item))
    ? {
        ...item,
        portalPushed: true,
        portalPushedValue: "Yes",
        portalOrderNo: sathiVoucherNumber || active.sathiVchNo || "",
        portalPushedAt: new Date().toISOString(),
        portalPushResult: status
      }
    : item);
  active.sathiStatus = portalSaleSynced(active) ? status : "Partial uploaded";
  active.sathiVchNo = portalSaleSynced(active) ? (sathiVoucherNumber || active.sathiVchNo || "") : active.sathiVchNo || "";
  state.portalSalesEntries = state.portalSalesEntries.map((entry) => (
    portalSaleKey(entry, "") === portalSaleKey(active, "") ? { ...active } : entry
  ));
  delete state.portalSelectedRows[portalSelectionKey(active)];
}

function extractSathiVoucherNumber(data = {}) {
  return data?.response?.data?.voucherNumber || data?.data?.voucherNumber || data?.voucherNumber || "";
}

function setApiProgress({ step = 0, percent = 0, title = "", message = "", error = false }) {
  window.clearTimeout(apiProgressTimer);
  const panel = document.getElementById("apiProgressPanel");
  const fill = document.getElementById("apiProgressFill");
  const percentText = document.getElementById("apiProgressPercent");
  if (!panel || !fill || !percentText) return;
  const clamped = Math.max(0, Math.min(100, Number(percent) || 0));
  const wasHidden = panel.classList.contains("hidden");
  panel.classList.remove("hidden");
  panel.classList.toggle("error", Boolean(error));
  if (wasHidden) {
    apiProgressShownAt = Date.now();
    panel.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }
  setText("apiProgressTitle", title);
  setText("apiProgressText", message);
  percentText.textContent = `${clamped}%`;
  fill.style.width = `${clamped}%`;
  document.querySelectorAll("[data-progress-step]").forEach((item) => {
    const index = Number(item.dataset.progressStep);
    item.classList.toggle("done", index < step || clamped >= 100);
    item.classList.toggle("active", index === step && clamped < 100);
  });
}

function finishApiProgress(success, message) {
  setApiProgress({
    step: 4,
    percent: 100,
    title: success ? "Request completed" : "Request failed",
    message,
    error: !success
  });
  const visibleFor = Date.now() - apiProgressShownAt;
  const minimumVisibleMs = success ? 4200 : 6200;
  const hideDelay = Math.max(success ? 2200 : 5200, minimumVisibleMs - visibleFor);
  apiProgressTimer = window.setTimeout(() => {
    document.getElementById("apiProgressPanel")?.classList.add("hidden");
  }, hideDelay);
}

async function testTally(options = {}) {
  setStatus("tallyStatus", "Checking...", "");
  setText("tallyNote", "Trying to connect to Tally XML interface.");

  try {
    const result = await api("/api/tally/test", { method: "POST", body: {} });
    let selectedCompany = document.querySelector("[name=tallyCompanyName]").value;
    if (!selectedCompany && result.companies.length) {
      selectedCompany = result.companies[0];
      document.querySelector("[name=tallyCompanyName]").value = selectedCompany;
    }
    setStatus("tallyStatus", "Connected", "success");
    state.tallySerialNumber = result.licenseSerialNumber || result.licenseInfo?.serialNumber || "";
    state.machineId = result.machineId || "";
    state.machineIdSource = normalizeMachineIdSource(state.tallySerialNumber);
    document.getElementById("tallyStatusHint").textContent = `${result.companies.length} compan${result.companies.length === 1 ? "y" : "ies"} detected.`;
    setText("tallyNote", "Tally connection is ready.");
    updateCompanyOptions(result.companies, selectedCompany);
    if (options.keepSelectedCompany && selectedCompany) {
      document.getElementById("companySelect").value = selectedCompany;
    }
    updateSidebarCompany(selectedCompany, document.querySelector("[name=tallyUrl]").value);
    await Promise.allSettled([
      loadLicenceScopes({ silent: true }),
      loadTallyStockItems({ silent: true }),
      loadTallyLedgers({ silent: true }),
      loadTallyGodowns({ silent: true }),
      loadItemMappings(),
      loadPartyMappings()
    ]);
    renderOrders();
    renderLotDetails();
    await loadTallyLogs().catch(() => { });
    if (!options.silent) showToast("Tally connection checked.");
  } catch (error) {
    setStatus("tallyStatus", compactError(error.message), "danger");
    document.getElementById("tallyStatusHint").textContent = error.message;
    setText("tallyNote", error.message);
    if (isTallyNotConnectedError(error)) showTallyConnectionPopup(error.message);
    await loadErrors();
    await loadTallyLogs();
    if (!options.silent) showToast("Tally check failed. Error Desk updated.");
    throw error;
  }
}

async function ensureTallyConnectedForAction() {
  try {
    await testTally({ silent: true, keepSelectedCompany: true });
  } catch (error) {
    if (isTallyNotConnectedError(error)) showTallyConnectionPopup(error.message);
    throw new Error(error.message || "Tally is not connected. Open Tally Prime and try again.");
  }
}

async function loadTallyLogs() {
  const result = await api("/api/tally/logs");
  state.tallyLogs = result.logs || [];
  renderTallyLogs();
}

async function clearTallyLogs() {
  const result = await api("/api/tally/logs", { method: "DELETE" });
  state.tallyLogs = result.logs || [];
  renderTallyLogs();
  showToast("Tally logs cleared.");
}

async function fetchCompanyUdfs(options = {}) {
  const form = document.getElementById("configForm");
  const companyName = form?.tallyCompanyName?.value || state.config?.tally?.companyName || "";
  if (!companyName) {
    if (!options.silent) showToast("Select a Tally company first.");
    renderCompanyUdfs();
    return;
  }

  try {
    const result = await api("/api/tally/company-udfs", {
      method: "POST",
      body: { companyName }
    });
    state.companyUdfs = {
      ...result,
      fetchedAt: new Date().toISOString()
    };
    renderCompanyUdfs();
    if (options.apply) {
      await applyCompanyUdfsToConfig({ silent: true, persist: Boolean(options.persist) });
    }
    if (!options.silent) showToast("Company UDF values fetched from Tally.");
  } catch (error) {
    state.companyUdfs = {
      companyName,
      error: error.message,
      fetchedAt: new Date().toISOString()
    };
    renderCompanyUdfs();
    await loadErrors();
    if (!options.silent) showToast("Company UDF fetch failed. Error Desk updated.");
  }
}

async function loadLicenceScopes(options = {}) {
  const companyName = selectedCompanyName();
  if (!companyName) {
    state.licenceScopes = [];
    state.activeScopeClientId = "";
    renderLicenceScopes();
    return;
  }
  ensureFormLicenceScope({ reason: "Using visible settings while Tally licence setup loads." });

  try {
    const result = await api("/api/tally/licence-scopes", {
      method: "POST",
      body: { companyName }
    });
    const tallyScopes = (result.licences || []).map((scope) => ({
      ...scope,
      clientId: scopeLicenceCode(scope)
    }));
    state.licenceScopes = tallyScopes.length ? tallyScopes : state.licenceScopes;
    const savedClientId = loadSavedLicenceScope(companyName);
    const preferred = state.licenceScopes.find((scope) => scopeLicenceCode(scope) === savedClientId) || state.licenceScopes[0] || null;
    selectLicenceScope(scopeLicenceCode(preferred) || "", { persist: false, silent: true });
    renderLicenceScopes(result.fallback ? result.message : "");
    await loadTallyVoucherTypes({ silent: true });
    await loadTallyLogs();
    await loadStoredSathiQueue({ silent: true });
    if (!options.silent) {
      showToast(result.fallback ? "Using saved SATHI licence configuration." : `${state.licenceScopes.length} licence scope(s) loaded from Tally voucher types.`);
    }
  } catch (error) {
    if (!state.licenceScopes.length) {
      state.licenceScopes = fallbackLicenceScopesFromConfig();
      selectLicenceScope(scopeLicenceCode(state.licenceScopes[0]) || "", { persist: false, silent: true });
    }
    renderLicenceScopes(state.licenceScopes.length ? "Tally response is slow. Using saved licence configuration." : "Connect Tally and refresh licence setup.");
    await loadTallyVoucherTypes({ silent: true });
    await loadErrors();
    await loadTallyLogs();
    if (!options.silent) showToast(state.licenceScopes.length ? "Using saved SATHI licence configuration." : "Licence setup needs refresh.");
  }
}

async function loadTallyVoucherTypes(options = {}) {
  const companyName = selectedCompanyName();
  if (!companyName) return;
  try {
    const result = await api("/api/tally/voucher-types", {
      method: "POST",
      body: { companyName }
    });
    state.voucherTypes = result.voucherTypes || [];
    updateGrnVoucherTypeOptions();
  } catch {
    updateGrnVoucherTypeOptions();
    if (!options.silent) showToast("Voucher type list could not be loaded.");
  }
}

function updateGrnVoucherTypeOptions(forcedValue = "") {
  const select = document.getElementById("tallyGrnVoucherTypeName");
  if (!select) return;
  const current = forcedValue || select.value || state.config?.tally?.grnVoucherTypeName || "Receipt Note";
  const suggested = (state.voucherTypes || []).filter(isGrnVoucherType);
  const source = suggested.length ? suggested : state.voucherTypes || [];
  const names = uniqueValues([
    current,
    "Receipt Note",
    "GRN",
    ...source.map((entry) => entry.name)
  ].filter(Boolean));

  select.innerHTML = names.map((name) => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`).join("");
  select.value = names.includes(current) ? current : names[0] || "";
}

function isGrnVoucherType(entry = {}) {
  const text = [
    entry.name,
    entry.parent,
    entry.typeOfVoucher,
    entry.basicVoucherTypeName
  ].join(" ").toLowerCase();
  return /receipt\s*note|goods\s*receipt|\bgrn\b|material\s*receipt/.test(text);
}

function ensureFormLicenceScope(options = {}) {
  const formScope = formLicenceScope();
  if (!formScope) return false;
  const code = scopeLicenceCode(formScope);
  const existingIndex = state.licenceScopes.findIndex((scope) => scopeLicenceCode(scope) === code);
  if (existingIndex >= 0) state.licenceScopes[existingIndex] = { ...state.licenceScopes[existingIndex], ...formScope };
  else state.licenceScopes = [formScope, ...state.licenceScopes];
  if (!state.activeScopeClientId || !activeLicenceScope()) state.activeScopeClientId = code;
  renderLicenceScopes(options.reason || "");
  applyActiveScopeToUi();
  return true;
}

function formLicenceScope() {
  const form = document.getElementById("configForm");
  if (!form) return null;
  const clientId = form.saathiClientId?.value?.trim() || form.saathiOwnerCode?.value?.trim() || form.saathiLocationCode?.value?.trim() || "";
  if (!clientId) return null;
  const fields = {
    apiKey: form.saathiApiKey?.value?.trim() || "",
    clientId,
    clientSecret: form.saathiClientSecret?.value?.trim() || "",
    ownerCode: form.saathiOwnerCode?.value?.trim() || clientId,
    locationCode: form.saathiLocationCode?.value?.trim() || form.saathiOwnerCode?.value?.trim() || clientId,
    stateCode: form.saathiStateCode?.value?.trim() || "27",
    applicabilityDate: form.saathiApplicabilityDate?.value || "",
    baseUrl: form.saathiBaseUrl?.value?.trim() || "",
    purchaseLedgerName: form.tallyPurchaseLedgerName?.value?.trim() || "",
    godownName: form.tallyGodownName?.value?.trim() || "",
    entryType: form.tallyEntryType?.value || "regular",
    raw: {
      SATHI_API_KEY: form.saathiApiKey?.value?.trim() || "",
      SATHI_CLIENT_ID: clientId,
      SATHI_CLIENT_SECRET: form.saathiClientSecret?.value?.trim() || "",
      SATHI_OWNER_CODE: form.saathiOwnerCode?.value?.trim() || clientId,
      SATHI_LOCATION_CODE: form.saathiLocationCode?.value?.trim() || form.saathiOwnerCode?.value?.trim() || clientId,
      SATHI_STATE_CODE: form.saathiStateCode?.value?.trim() || "27",
      SATHI_APPLICABILITY_DATE: form.saathiApplicabilityDate?.value || "",
      SATHI_BASE_URL: form.saathiBaseUrl?.value?.trim() || "",
      SATHI_TALLY_PURCHASE_LEDGER: form.tallyPurchaseLedgerName?.value?.trim() || "",
      SATHI_TALLY_PURCHASE_GODOWN: form.tallyGodownName?.value?.trim() || ""
    }
  };
  return {
    clientId,
    licenceType: "seed",
    isCottonLicence: false,
    purchaseVoucherTypeName: form.tallyVoucherTypeName?.value?.trim() || "Purchase",
    entryType: form.tallyEntryType?.value || "regular",
    salesVoucherTypeName: form.tallySalesVoucherTypeName?.value?.trim() || "",
    salesVoucherTypeNames: form.tallySalesVoucherTypeName?.value?.trim() ? [form.tallySalesVoucherTypeName.value.trim()] : [],
    grnVoucherTypeName: form.tallyGrnVoucherTypeName?.value?.trim() || "",
    grnVoucherTypeNames: form.tallyGrnVoucherTypeName?.value?.trim() ? [form.tallyGrnVoucherTypeName.value.trim()] : [],
    fields,
    fallback: true
  };
}

function fallbackLicenceScopesFromConfig() {
  const formScope = formLicenceScope();
  if (formScope) return [formScope];
  const saathi = state.config?.saathi || {};
  const tally = state.config?.tally || {};
  const clientId = saathi.clientId || saathi.ownerCode || "";
  if (!clientId) return [];
  return [{
    clientId,
    licenceType: "seed",
    isCottonLicence: false,
    purchaseVoucherTypeName: tally.voucherTypeName || "Purchase",
    entryType: tally.entryType || "regular",
    salesVoucherTypeName: tally.salesVoucherTypeName || "",
    salesVoucherTypeNames: tally.salesVoucherTypeName ? [tally.salesVoucherTypeName] : [],
    grnVoucherTypeName: tally.grnVoucherTypeName || "",
    grnVoucherTypeNames: tally.grnVoucherTypeName ? [tally.grnVoucherTypeName] : [],
    fields: {
      apiKey: saathi.apiKey || "",
      clientId,
      clientSecret: saathi.clientSecret || "",
      ownerCode: saathi.ownerCode || clientId,
      locationCode: saathi.locationCode || saathi.ownerCode || clientId,
      stateCode: saathi.stateCode || "",
      baseUrl: saathi.baseUrl || "",
      purchaseLedgerName: tally.purchaseLedgerName || "",
      godownName: tally.godownName || "",
      entryType: tally.entryType || "regular",
      raw: {}
    },
    fallback: true
  }];
}

function renderLicenceScopes(errorMessage = "") {
  const select = document.getElementById("licenceScopeSelect");
  const topSelect = document.getElementById("topLicenceScopeSelect");
  const note = document.getElementById("licenceScopeNote");
  if (!select || !note) return;

  if (errorMessage) {
    if (!state.licenceScopes.length) {
      select.innerHTML = '<option value="">Connect Tally first</option>';
      if (topSelect) topSelect.innerHTML = '<option value="">Connect Tally first</option>';
    }
    note.textContent = errorMessage;
    updatePortalSourceStrip();
    renderCompanyUdfs();
    renderActivationScopes();
    if (!state.licenceScopes.length) return;
  }

  if (!state.licenceScopes.length) {
    select.innerHTML = '<option value="">No SATHI licence UDF found</option>';
    if (topSelect) topSelect.innerHTML = '<option value="">No licence</option>';
    note.textContent = "Add SATHI_VCHTYPE=Yes on purchase/sales voucher types.";
    updatePortalSourceStrip();
    renderCompanyUdfs();
    renderActivationScopes();
    return;
  }

  const options = state.licenceScopes.map((scope, index) => {
    const value = scope.clientId || scope.fields?.clientId || scope.fields?.ownerCode || scope.purchaseVoucherTypeName || `scope-${index}`;
    return `<option value="${escapeHtml(value)}">${escapeHtml(scopeLicenceLabel(scope))}</option>`;
  }).join("");
  select.innerHTML = options;
  if (topSelect) topSelect.innerHTML = options;
  select.value = state.activeScopeClientId || scopeLicenceCode(state.licenceScopes[0]) || "";
  if (topSelect) topSelect.value = select.value;
  const active = activeLicenceScope();
  if (!errorMessage) {
    note.textContent = active
      ? `${active.purchaseVoucherTypeName || "Purchase"} -> ${scopeSalesVoucherTypeLabel(active) || "Sales not mapped"}`
      : "Select a licence.";
  }
  updatePortalSourceStrip();
  updateTopScopeBar();
  renderCompanyUdfs();
  renderActivationScopes();
}

function selectLicenceScope(clientId, options = {}) {
  const previousClientId = scopeLicenceCode(activeLicenceScope()) || state.activeScopeClientId || "";
  state.activeScopeClientId = clientId || "";
  const active = activeLicenceScope();
  if (active && options.persist) saveLicenceScopeSelection(selectedCompanyName(), scopeLicenceCode(active));
  const activeClientId = scopeLicenceCode(active);
  if (previousClientId && activeClientId && previousClientId !== activeClientId) {
    state.commonGodownName = "";
    state.godownOverrides = {};
  }
  applyActiveScopeToUi();
  if (previousClientId && activeClientId && previousClientId !== activeClientId) {
    keepOnlyActiveScopeRows();
  }
  renderLicenceScopes();
}

function applyActiveScopeToUi() {
  const scope = activeLicenceScope();
  if (!scope) return;
  const fields = scope.fields || {};
  const clientId = scopeLicenceCode(scope);
  const form = document.getElementById("configForm");
  setValue("quickOwnerCode", fields.ownerCode || clientId);
  setValue("quickStateCode", fields.stateCode || "");
  setValue("locationCode", fields.locationCode || fields.ownerCode || clientId);
  if (form) {
    if (fields.baseUrl) form.saathiBaseUrl.value = fields.baseUrl;
    if (fields.clientId || clientId) form.saathiClientId.value = fields.clientId || clientId;
    if (fields.ownerCode) form.saathiOwnerCode.value = fields.ownerCode;
    if (fields.locationCode) form.saathiLocationCode.value = fields.locationCode;
    if (fields.stateCode) form.saathiStateCode.value = fields.stateCode;
    if (scope.purchaseVoucherTypeName) form.tallyVoucherTypeName.value = scope.purchaseVoucherTypeName;
    if (scope.salesVoucherTypeName) form.tallySalesVoucherTypeName.value = scope.salesVoucherTypeName;
    if (scope.entryType || fields.entryType) form.tallyEntryType.value = scope.entryType || fields.entryType;
    if (fields.purchaseLedgerName) form.tallyPurchaseLedgerName.value = fields.purchaseLedgerName;
    if (fields.godownName) form.tallyGodownName.value = fields.godownName;
  }
  setValue("createOrderJson", JSON.stringify(buildCreateOrderTemplate(state.config?.saathi || {}), null, 2));
  syncCommonOrderGodown();
  syncPortalCreateForm();
  updatePortalSourceStrip();
  updateTopScopeBar();
}

function defaultOrderGodownName() {
  return activeLicenceScope()?.fields?.godownName
    || document.getElementById("configForm")?.tallyGodownName?.value?.trim()
    || "Main Location";
}

function syncCommonOrderGodown() {
  if (!state.commonGodownName) state.commonGodownName = defaultOrderGodownName();
  const input = document.getElementById("orderCommonGodownInput");
  if (input) input.value = state.commonGodownName;
}

function activeLicenceScope() {
  return state.licenceScopes.find((scope, index) => (
    [scope.clientId, scope.fields?.clientId, scope.fields?.ownerCode, scope.purchaseVoucherTypeName, `scope-${index}`].includes(state.activeScopeClientId)
  )) || state.licenceScopes[0] || null;
}

function scopeLicenceCode(scope = {}) {
  scope = scope || {};
  return scope.clientId || scope.fields?.clientId || scope.fields?.ownerCode || scope.fields?.locationCode || "";
}

function configuredSalesVoucherTypeName() {
  return document.getElementById("configForm")?.tallySalesVoucherTypeName?.value?.trim() || state.config?.tally?.salesVoucherTypeName || "";
}

function scopeSalesVoucherTypeName(scope = {}) {
  return scopeSalesVoucherTypeNames(scope)[0] || "";
}

function scopeSalesVoucherTypeNames(scope = {}) {
  if (Array.isArray(scope?.salesVoucherTypeNames) && scope.salesVoucherTypeNames.length) {
    return [...new Set(scope.salesVoucherTypeNames.map((name) => String(name || "").trim()).filter(Boolean))];
  }
  if (scope?.salesVoucherTypeName) return [scope.salesVoucherTypeName];
  const configured = scope?.fallback ? configuredSalesVoucherTypeName() : "";
  return configured ? [configured] : [];
}

function scopeSalesVoucherTypeLabel(scope = {}) {
  return scopeSalesVoucherTypeNames(scope).join(", ");
}

function scopeGrnVoucherTypeNames(scope = {}) {
  if (Array.isArray(scope?.grnVoucherTypeNames) && scope.grnVoucherTypeNames.length) {
    return [...new Set(scope.grnVoucherTypeNames.map((name) => String(name || "").trim()).filter(Boolean))];
  }
  if (scope?.grnVoucherTypeName) return [scope.grnVoucherTypeName];
  const configured = scope?.fallback ? document.getElementById("configForm")?.tallyGrnVoucherTypeName?.value?.trim() || state.config?.tally?.grnVoucherTypeName || "" : "";
  return configured ? [configured] : [];
}

function scopeLicenceLabel(scope = {}) {
  const code = scopeLicenceCode(scope);
  const vtype = scope.purchaseVoucherTypeName || "";
  const kind = scopeLicenceType(scope).toUpperCase();
  if (code && vtype) return `${kind} | ${code} (${vtype})`;
  return code || vtype || "Licence";
}

function scopeLicenceType(scope = {}) {
  const declared = String(scope?.licenceType || "").trim().toLowerCase();
  if (declared === "cotton" || declared === "seed") return declared;
  if (scope?.isCottonLicence) return "cotton";
  const fieldsType = voucherTypeLicenceType(scope?.fields || scope?.purchase?.fields || {});
  if (fieldsType) return fieldsType;
  return (scope?.sales || []).some((entry) => voucherTypeCottonFlag(entry?.fields))
    ? "cotton"
    : "seed";
}

function isTruthyTallyValue(value) {
  return ["YES", "Y", "TRUE", "1"].includes(String(value || "").trim().toUpperCase());
}

const SATHI_SEED_VOUCHER_TYPE_FLAG_NAMES = [
  "SATHI_VCHTYPESEED",
  "SATHI_VCHTYPESEEDS",
  "SATHI_VCHTYPESD",
  "SATHI_VCHTYPE"
];

const SATHI_COTTON_VOUCHER_TYPE_FLAG_NAMES = [
  "SATHI_VCHTYPECTN",
  "SATHI_VCHTYPECOTTON",
  "SATHI_VCHTYPECOT",
  "ISCottonSaleVTYP"
];

function voucherTypeFlag(fields = {}, names = []) {
  return names.some((name) => isTruthyTallyValue(fieldValue(fields, name)));
}

function voucherTypeCottonFlag(fields = {}) {
  return voucherTypeFlag(fields, SATHI_COTTON_VOUCHER_TYPE_FLAG_NAMES);
}

function voucherTypeSeedFlag(fields = {}) {
  return voucherTypeFlag(fields, SATHI_SEED_VOUCHER_TYPE_FLAG_NAMES);
}

function voucherTypeLicenceType(fields = {}) {
  if (voucherTypeCottonFlag(fields)) return "cotton";
  if (voucherTypeSeedFlag(fields)) return "seed";
  return "";
}

function activeBatchLicenceValues() {
  const scope = activeLicenceScope();
  return {
    sathiIsCotton: scopeLicenceType(scope) === "cotton",
    sathiCompanyLicenceNo: scopeLicenceCode(scope)
  };
}

function activeScopePayload() {
  const scope = activeLicenceScope();
  if (!scope) return null;
  return {
    companyName: selectedCompanyName(),
    clientId: scopeLicenceCode(scope),
    licenceType: scopeLicenceType(scope),
    isCottonLicence: scopeLicenceType(scope) === "cotton",
    purchaseVoucherTypeName: scope.purchaseVoucherTypeName,
    entryType: scope.entryType || scope.fields?.entryType || document.getElementById("configForm")?.tallyEntryType?.value || "regular",
    salesVoucherTypeName: scopeSalesVoucherTypeName(scope),
    salesVoucherTypeNames: scopeSalesVoucherTypeNames(scope),
    fields: scope.fields || {},
    sales: scope.sales || []
  };
}

function scopeSathiTxtFileLoc(scope = {}) {
  return firstNonEmpty([
    scope.sathiTxtFileLoc,
    fieldValue(scope.fields, "SathiTxtFileLoc"),
    fieldValue(scope.fields?.raw, "SathiTxtFileLoc"),
    ...(scope.sales || []).map((entry) => fieldValue(entry?.fields, "SathiTxtFileLoc")),
    ...(scope.sales || []).map((entry) => fieldValue(entry?.fields?.raw, "SathiTxtFileLoc"))
  ]);
}

function firstNonEmpty(values = []) {
  return values.map((value) => String(value || "").trim()).find(Boolean) || "";
}

function fieldValue(object = {}, key = "") {
  if (!object || typeof object !== "object") return "";
  const match = Object.keys(object).find((name) => name.toLowerCase() === String(key || "").toLowerCase());
  return match ? String(object[match] || "").trim() : "";
}

function loadSavedLicenceScope(companyName) {
  try {
    const saved = JSON.parse(localStorage.getItem(licenceScopeStorageKey) || "{}");
    return saved[companyName] || "";
  } catch {
    return "";
  }
}

function saveLicenceScopeSelection(companyName, clientId) {
  if (!companyName || !clientId) return;
  try {
    const saved = JSON.parse(localStorage.getItem(licenceScopeStorageKey) || "{}");
    saved[companyName] = clientId;
    localStorage.setItem(licenceScopeStorageKey, JSON.stringify(saved));
  } catch {
    // Licence selection is optional; app can fall back to the first scope.
  }
}

async function loadTallyStockItems(options = {}) {
  const form = document.getElementById("configForm");
  const companyName = form?.tallyCompanyName?.value || state.config?.tally?.companyName || "";
  if (!companyName) {
    state.stockItems = [];
    updateStockItemDatalist();
    return;
  }

  try {
    const result = await api("/api/tally/stock-items", {
      method: "POST",
      body: { companyName }
    });
    state.stockItems = result.items || [];
    updateStockItemDatalist();
    if (!options.silent) showToast(`${state.stockItems.length} Tally stock item(s) loaded.`);
  } catch (error) {
    state.stockItems = [];
    updateStockItemDatalist();
    await loadErrors();
    if (!options.silent) showToast("Tally stock item list could not be loaded.");
  }
}

async function loadTallyLedgers(options = {}) {
  const companyName = selectedCompanyName();
  if (!companyName) {
    state.partyLedgers = [];
    return;
  }

  try {
    const result = await api("/api/tally/ledgers", {
      method: "POST",
      body: { companyName }
    });
    state.partyLedgers = result.ledgers || [];
    if (!options.silent) showToast(`${state.partyLedgers.length} Tally ledger(s) loaded.`);
  } catch {
    state.partyLedgers = [];
    await loadErrors();
    if (!options.silent) showToast("Tally ledger list could not be loaded.");
  }
}

async function loadTallyGodowns(options = {}) {
  const companyName = selectedCompanyName();
  if (!companyName) {
    state.godowns = [];
    updateGodownDatalist();
    return;
  }

  try {
    const result = await api("/api/tally/godowns", {
      method: "POST",
      body: { companyName }
    });
    state.godowns = result.godowns || [];
    updateGodownDatalist();
    if (!options.silent) showToast(`${state.godowns.length} Tally godown(s) loaded.`);
  } catch {
    state.godowns = [];
    updateGodownDatalist();
    if (!options.silent) showToast("Tally godown list could not be loaded.");
  }
}

async function loadItemMappings() {
  const companyName = selectedCompanyName();
  if (!companyName) {
    state.itemMappings = {};
    return;
  }

  const result = await api(`/api/item-mappings?companyName=${encodeURIComponent(companyName)}`);
  state.itemMappings = result.mappings || {};
}

async function loadPartyMappings() {
  const companyName = selectedCompanyName();
  if (!companyName) {
    state.partyMappings = {};
    return;
  }

  const result = await api(`/api/party-mappings?companyName=${encodeURIComponent(companyName)}`);
  state.partyMappings = result.mappings || {};
}

async function loadStoredSathiQueue(options = {}) {
  const companyName = selectedCompanyName();
  const scope = activeScopePayload();
  if (!companyName || !scope?.clientId) return;

  try {
    const result = await api("/api/sathi/stored-queue", {
      method: "POST",
      body: { companyName, scope }
    });
    mergeStoredSathiQueue(result.queue || {});
    updateVoucherOptions();
    renderOrders();
    renderLotDetails();
    if (!options.silent) showToast("Saved SATHI orders loaded.");
  } catch {
    await loadErrors();
    if (!options.silent) showToast("Saved SATHI order queue could not be loaded.");
  }
}

async function markStoredSathiOrderStatus(voucherNumber, status, metadata = {}) {
  const companyName = selectedCompanyName();
  const scope = activeScopePayload();
  if (!companyName || !scope?.clientId || !voucherNumber || !status) return null;
  return api("/api/sathi/stored-queue/status", {
    method: "POST",
    body: { companyName, scope, voucherNumber, status, metadata }
  });
}

async function loadGrnLots(options = {}) {
  const companyName = selectedCompanyName();
  const scope = activeScopePayload();
  if (!companyName || !scope?.clientId) return;

  const voucherTypeNames = scope.grnVoucherTypeNames || [];
  const voucherTypeName = scope.grnVoucherTypeName || voucherTypeNames[0] || "";
  if (!voucherTypeName && !activeLicenceScope()?.fallback) {
    state.grnLots = [];
    renderOrders();
    if (!options.silent) showToast("No GRN voucher type is mapped for selected licence.");
    return;
  }

  try {
    const result = await api("/api/tally/grn-lots", {
      method: "POST",
      body: { companyName, scope, voucherTypeName, voucherTypeNames }
    });
    state.grnLots = result.rows || [];
    renderOrders();
    if (!options.silent) showToast(`${state.grnLots.length} GRN lot row(s) loaded.`);
  } catch (error) {
    if (Array.isArray(error.rows)) state.grnLots = error.rows;
    await loadErrors();
    renderOrders();
    if (!options.silent) showToast("GRN lot cache could not be refreshed.");
  }
}

function mergeStoredSathiQueue(queue = {}) {
  const fallbackLicence = activeLicenceScope()?.clientId || "";
  const storedOrders = arrayOf(queue.orders).map((order) => ({
    ...order,
    buyerCode: order.buyerCode || order.licenceCode || fallbackLicence
  })).filter((order) => order.voucherNumber).filter(belongsToActiveLicence);
  const storedBills = arrayOf(queue.lotBills).map((bill) => ({
    ...bill,
    buyerCode: bill.buyerCode || bill.licenceCode || fallbackLicence
  })).filter((bill) => bill.billNumber || bill.voucherNumber).filter(belongsToActiveLicence);

  state.orders = mergeByKey(state.orders, storedOrders, (order) => order.voucherNumber).filter(belongsToActiveLicence);
  state.lotBills = mergeByKey(state.lotBills, storedBills, (bill) => bill.billNumber || bill.voucherNumber).filter(belongsToActiveLicence);
}

function mergeByKey(existingRows = [], incomingRows = [], keyGetter) {
  const merged = new Map();
  for (const row of [...arrayOf(existingRows), ...arrayOf(incomingRows)]) {
    const key = keyGetter(row);
    if (!key) continue;
    merged.set(key, { ...(merged.get(key) || {}), ...row });
  }
  return [...merged.values()];
}

function arrayOf(value) {
  return Array.isArray(value) ? value : [];
}

async function saveItemMapping(key, mapping) {
  const companyName = selectedCompanyName();
  if (!companyName || !key) return;
  const result = await api("/api/item-mappings", {
    method: "POST",
    body: {
      companyName,
      mappings: {
        [key]: mapping
      }
    }
  });
  state.itemMappings = result.mappings || state.itemMappings;
}

async function applyCompanyUdfsToConfig(options = {}) {
  const mapped = state.companyUdfs?.mapped || {};
  if (!Object.keys(mapped).length) {
    if (!options.silent) showToast("Fetch company UDFs first.");
    return;
  }

  const form = document.getElementById("configForm");
  setFormValue(form, "saathiApiKey", mapped.saathiApiKey);
  setFormValue(form, "saathiClientId", mapped.saathiClientId);
  setFormValue(form, "saathiClientSecret", mapped.saathiClientSecret);
  setFormValue(form, "saathiOwnerCode", mapped.saathiOwnerCode);
  setFormValue(form, "saathiLocationCode", mapped.saathiLocationCode);
  setFormValue(form, "saathiStateCode", mapped.saathiStateCode);
  setFormValue(form, "saathiBaseUrl", mapped.saathiBaseUrl);
  setFormValue(form, "tallyVoucherTypeName", mapped.tallyVoucherTypeName);
  setFormValue(form, "tallySalesVoucherTypeName", mapped.tallySalesVoucherTypeName);
  setFormValue(form, "tallyPurchaseLedgerName", mapped.tallyPurchaseLedgerName);
  setValue("quickOwnerCode", form.saathiOwnerCode.value);
  setValue("quickStateCode", form.saathiStateCode.value);
  setValue("locationCode", form.saathiLocationCode.value);
  updatePortalSourceStrip();
  await previewRequest();

  if (options.persist) {
    await persistCurrentConfig("Tally company UDF values loaded and saved.", { silent: options.silent });
    return;
  }

  if (!options.silent) showToast("Tally UDF values applied to app config. Save configuration to persist.");
}

async function loadErrors() {
  const result = await api("/api/errors");
  state.errors = result.errors || [];
  renderErrors();
  const latestSathiError = state.errors.find((error) => error.source === "SATHI");
  if (latestSathiError) {
    const cleanMessage = extractApiMessage(latestSathiError.message);
    setStatus("saathiStatus", compactError(cleanMessage), "danger");
    document.getElementById("saathiStatusHint").textContent = cleanMessage;
  }
}

async function clearErrors() {
  const result = await api("/api/errors", { method: "DELETE" });
  state.errors = result.errors || [];
  renderErrors();
  showToast("Errors cleared.");
}

function currentPayload() {
  const action = document.getElementById("apiAction").value;

  if (action === "createOrder") {
    const raw = document.getElementById("createOrderJson").value.trim();
    if (!raw) return {};
    return JSON.parse(raw);
  }

  const payload = {
    ownerCode: document.getElementById("quickOwnerCode").value.trim(),
    stateCode: document.getElementById("quickStateCode").value.trim()
  };

  if (action === "pullLot" || action === "fetchLot") {
    payload.voucherNumber = document.getElementById("voucherNumber").value.trim();
    payload.locationCode = document.getElementById("locationCode").value.trim();
  }

  return payload;
}

function updateActionFields() {
  const action = document.getElementById("apiAction").value;
  document.querySelectorAll(".api-action-button").forEach((button) => {
    button.classList.toggle("active", button.dataset.apiAction === action);
  });
  document.querySelectorAll(".request-lot-fields").forEach((element) => {
    element.classList.toggle("hidden", !(action === "pullLot" || action === "fetchLot"));
  });
  document.querySelector(".create-order-json").classList.toggle("hidden", action !== "createOrder");
  document.getElementById("pullSafetyNote").classList.toggle("hidden", action !== "pullLot");
}

async function loadArchive() {
  const result = await api("/api/archive");
  state.archive = result.archive || [];
  renderArchive();
}

async function clearArchive() {
  const result = await api("/api/archive", { method: "DELETE" });
  state.archive = result.archive || [];
  renderArchive();
  showToast("Saved response archive cleared.");
}

function clearOrders() {
  state.orders = [];
  state.tallyStatuses = {};
  state.tallyResults = {};
  state.expandedOrder = "";
  updateVoucherOptions();
  renderOrders();
  document.getElementById("lastFetchNote").textContent = "Orders cleared from the current UI session.";
}

function activeLicenceCode() {
  return String(scopeLicenceCode(activeLicenceScope()) || "").trim().toUpperCase();
}

function belongsToActiveLicence(row = {}) {
  const activeCode = activeLicenceCode();
  if (!activeCode) return true;
  const candidates = [
    row.buyerCode,
    row.buyer_code,
    row.buyerLicence,
    row.buyerLicense,
    row.licenceCode,
    row.clientId,
    row.ownerCode,
    row.locationCode,
    row.orderBuyerCode,
    row.orderOwnerCode,
    row.bill?.buyerCode,
    row.bill?.ownerCode
  ].map((value) => String(value || "").trim().toUpperCase()).filter(Boolean);
  return candidates.includes(activeCode);
}

function keepOnlyActiveScopeRows() {
  state.orders = state.orders.filter(belongsToActiveLicence);
  state.lotBills = state.lotBills.filter(belongsToActiveLicence);
  state.tallyStatuses = Object.fromEntries(Object.entries(state.tallyStatuses).filter(([voucherNumber]) => (
    state.orders.some((order) => order.voucherNumber === voucherNumber)
  )));
  state.tallyResults = Object.fromEntries(Object.entries(state.tallyResults).filter(([voucherNumber]) => (
    state.orders.some((order) => order.voucherNumber === voucherNumber)
  )));
  state.expandedOrder = "";
  updateVoucherOptions();
  renderOrders();
  renderLotDetails();
}

function renderOrders() {
  syncCommonOrderGodown();
  const body = document.getElementById("ordersBody");
  const showAll = Boolean(document.getElementById("ordersShowAll")?.checked);
  const baseOrders = state.orders.filter(belongsToActiveLicence).filter((order) => showAll || !isOrderPushedToTally(order));
  const visibleOrders = baseOrders.filter(orderMatchesCurrentFilters);
  const pendingTallyOrders = visibleOrders.filter((order) => !isOrderPushedToTally(order));
  document.getElementById("orderCount").textContent = visibleOrders.length;
  document.getElementById("orderStatusHint").textContent = visibleOrders.length
    ? t("readyForMapping", "Ready for mapping and Tally push")
    : t("noDataLoaded", "No data loaded");
  updateDailyWorkQueue(pendingTallyOrders);

  if (!visibleOrders.length) {
    body.innerHTML = `<tr><td colspan="6" class="empty-cell">${escapeHtml(baseOrders.length ? "No orders match the selected filters." : t("noVouchers", "No vouchers ready yet."))}</td></tr>`;
    return;
  }

  body.innerHTML = visibleOrders.map((order, index) => {
    const bill = findBillForOrder(order);
    const tallyStatus = state.tallyStatuses[order.voucherNumber] || tallyStatusFromQueue(order) || "Pending for Tally";
    const mappingStatus = bill ? mappingStatusForBill(bill) : { label: t("lotMissing", "Lot missing"), className: "status-pill status-warn" };
    const grnStatus = bill ? grnStatusForBill(bill) : null;
    const pushDisabled = bill && ["Found in Tally", "Verified in Tally", "Partial in Tally", "Pushed to Tally", "Existing purchase updated", "Existing purchase updated but no sales found/updated"].includes(tallyStatus);
    const mainAction = bill
      ? {
        action: "push",
        label: pushDisabled ? t("synced", "Synced") : t("push", "Push"),
        className: pushDisabled ? "synced-mini" : "push-mini",
        disabled: pushDisabled
      }
      : {
        action: "pull-lot",
        label: t("pullLot", "Pull Lot"),
        className: "pull-lot-mini",
        disabled: false
      };
    const expanded = state.expandedOrder === order.voucherNumber;
    return `
    <tr class="order-main-row ${expanded ? "active-order" : ""}" data-order-index="${index}">
      <td>
        <div class="queue-voucher-cell">
          <div class="voucher-copy-row">
            <strong>${escapeHtml(order.voucherNumber || "")}</strong>
            <button class="voucher-copy-button" data-copy-voucher="${escapeHtml(order.voucherNumber || "")}" type="button" title="${escapeHtml(t("copy", "Copy"))}">${escapeHtml(t("copy", "Copy"))}</button>
          </div>
          <small>${escapeHtml(formatOrderDate(order.voucherDate))}</small>
          <small>${escapeHtml(`Vch type: ${activeLicenceScope()?.purchaseVoucherTypeName || document.getElementById("configForm")?.tallyVoucherTypeName?.value || "Purchase"}`)}</small>
        </div>
      </td>
      <td>
        <div class="queue-party-cell">
          <strong>${escapeHtml(order.sellerName || bill?.sellerName || "-")}</strong>
          <small>${escapeHtml(bill?.buyerName ? `${t("buyerPrefix", "Buyer")}: ${bill.buyerName}` : order.sellerCode || "")}</small>
          ${bill ? orderLineSummaryHtml(bill) : ""}
        </div>
      </td>
      <td class="amount order-amount-col"><strong>${escapeHtml(order.totalBillPrice || bill?.totalBillPrice || "0")}</strong></td>
      <td>
        <div class="queue-status-stack">
          <span class="${mappingStatus.className}">${escapeHtml(mappingStatus.label)}</span>
          ${grnStatus?.label ? `<span class="${grnStatus.className}">${escapeHtml(grnStatus.label)}</span>` : ""}
        </div>
      </td>
      <td><span class="${tallyStatusClass(tallyStatus)}">${escapeHtml(formatTallyStatus(tallyStatus))}</span></td>
      <td>
        <div class="row-actions">
          <button class="mini-button" data-action="check" data-order-index="${index}" type="button">${escapeHtml(t("status", "Status"))}</button>
          <button class="mini-button primary-mini ${mainAction.className}" data-action="${mainAction.action}" data-order-index="${index}" type="button" ${mainAction.disabled ? "disabled" : ""}>${escapeHtml(mainAction.label)}</button>
        </div>
      </td>
    </tr>
    <tr class="order-detail-row ${expanded ? "" : "hidden"}" id="orderDetail-${index}">
      <td colspan="6">${bill ? orderDetailHtml(bill) : `<div class="empty-state">${escapeHtml(t("noLotDetails", "No lot details available for this order."))}</div>`}</td>
    </tr>
  `;
  }).join("");

  document.querySelectorAll(".order-main-row").forEach((row) => {
    row.addEventListener("click", (event) => {
      if (event.target.closest("button")) return;
      const order = visibleOrders[Number(row.dataset.orderIndex)];
      state.expandedOrder = state.expandedOrder === order.voucherNumber ? "" : order.voucherNumber;
      renderOrders();
    });
  });

  document.querySelectorAll(".row-actions button").forEach((button) => {
    button.addEventListener("click", async () => {
      const order = visibleOrders[Number(button.dataset.orderIndex)];
      if (button.dataset.action === "check") await checkTallyStatus(order);
      if (button.dataset.action === "pull-lot") await pullLotForOrder(order);
      if (button.dataset.action === "push") await pushOrderToTally(order);
    });
  });

  document.querySelectorAll("[data-copy-voucher]").forEach((button) => {
    button.addEventListener("click", async (event) => {
      event.stopPropagation();
      await copyText(button.dataset.copyVoucher || "");
    });
  });

  document.querySelectorAll("[data-action='review-mapping']").forEach((button) => {
    button.addEventListener("click", () => openItemMappingReview(button.dataset.voucherNumber || ""));
  });

}

function clearOrdersFilters() {
  state.ordersFilter = { search: "", tally: "all", mapping: "all" };
  const search = document.getElementById("ordersSearchInput");
  const tally = document.getElementById("ordersTallyFilter");
  const mapping = document.getElementById("ordersMappingFilter");
  if (search) search.value = "";
  if (tally) tally.value = "all";
  if (mapping) mapping.value = "all";
  renderOrders();
}

function orderMatchesCurrentFilters(order = {}) {
  const bill = findBillForOrder(order);
  const tallyStatus = state.tallyStatuses[order.voucherNumber] || tallyStatusFromQueue(order) || "Pending for Tally";
  const mappingStatus = bill ? mappingStatusForBill(bill) : { label: t("lotMissing", "Lot missing"), className: "status-pill status-warn" };
  const filters = state.ordersFilter || {};
  if (!matchesSearchText(orderSearchText(order, bill, tallyStatus, mappingStatus), filters.search)) return false;
  if (!orderMatchesTallyFilter(tallyStatus, filters.tally)) return false;
  if (!orderMatchesMappingFilter(mappingStatus, filters.mapping)) return false;
  return true;
}

function orderSearchText(order = {}, bill = null, tallyStatus = "", mappingStatus = {}) {
  const lots = arrayOf(bill?.lotData).flatMap((lot) => [
    portalItemName(lot),
    resolveTallyItemForLot(lot),
    lot.lotNum,
    lot.salesBatchNo,
    lot.originalOwner,
    lot.packingSize,
    lot.totalBags,
    lot.totalQty
  ]);
  return [
    order.voucherNumber,
    order.voucherDate,
    order.sellerName,
    order.sellerCode,
    order.totalBillPrice,
    bill?.billNumber,
    bill?.sellerName,
    bill?.buyerName,
    bill?.sellerCode,
    bill?.buyerCode,
    bill?.totalBillPrice,
    tallyStatus,
    mappingStatus.label,
    scopeLicenceCode(activeLicenceScope()),
    ...lots
  ].filter(Boolean).join(" ");
}

function orderMatchesTallyFilter(status = "", filter = "all") {
  const text = normalizeText(status);
  if (!filter || filter === "all") return true;
  if (filter === "pending") return text.includes("pending");
  if (filter === "verified") return text.includes("verified") || text.includes("found");
  if (filter === "partial") return text.includes("partial");
  if (filter === "historical") return text.includes("existing purchase") || text.includes("historical");
  if (filter === "synced") return text.includes("pushed") || text.includes("synced");
  return true;
}

function orderMatchesMappingFilter(mappingStatus = {}, filter = "all") {
  if (!filter || filter === "all") return true;
  const text = normalizeText(mappingStatus.label);
  if (filter === "ready") return text.includes("ready");
  if (filter === "pending") return !text.includes("ready");
  return true;
}

function matchesSearchText(source = "", query = "") {
  const terms = normalizeText(query).split(/\s+/).filter(Boolean);
  if (!terms.length) return true;
  const haystack = normalizeText(source);
  const compactHaystack = haystack.replace(/\s+/g, "");
  return terms.every((term) => haystack.includes(term) || compactHaystack.includes(term.replace(/\s+/g, "")));
}

function orderLineSummaryHtml(bill = {}) {
  const lines = (bill.lotData || []).map((lot, index) => {
    const itemName = portalItemName(lot);
    const mappedItem = resolveTallyItemForLot(lot);
    const qty = formatOrderLineQty(lot);
    const rate = formatMoney(lot.unitPrice || 0);
    const amount = formatMoney(orderLotAmount(lot, bill));
    const mappedText = mappedItem ? `Mapped: ${mappedItem}` : "Mapping pending";
    return `
      <span class="queue-item-line ${mappedItem ? "mapped" : "unmapped"}">
        <b>${index + 1}. ${escapeHtml(itemName)}</b>
        <em>${escapeHtml(qty)} | Rate ${escapeHtml(rate)} | Amt ${escapeHtml(amount)} | ${escapeHtml(mappedText)}</em>
      </span>
    `;
  }).join("");

  return lines ? `<div class="queue-item-summary">${lines}</div>` : "";
}

function formatOrderLineQty(lot = {}) {
  const bags = Number(lot.totalBags || 0);
  const pack = formatPacking(lot);
  const qtyParts = [];
  if (Number.isFinite(bags) && bags > 0) qtyParts.push(`${formatBags(bags)} bag`);
  if (pack) qtyParts.push(pack);
  if (lot.totalQty !== undefined && lot.totalQty !== null && lot.totalQty !== "") {
    qtyParts.push(`Portal qty ${lot.totalQty}`);
  }
  return qtyParts.join(" / ") || "-";
}

function orderLotAmount(lot = {}, bill = {}) {
  const unitPrice = Number(lot.unitPrice || 0);
  const bags = Number(lot.totalBags || 0);
  if (Number.isFinite(unitPrice) && unitPrice > 0 && Number.isFinite(bags) && bags > 0) {
    return unitPrice * bags;
  }
  if (Number.isFinite(unitPrice) && unitPrice > 0) return unitPrice;
  const lots = Array.isArray(bill.lotData) ? bill.lotData : [];
  const billTotal = Number(bill.totalBillPrice || 0);
  return lots.length === 1 && Number.isFinite(billTotal) ? billTotal : 0;
}

function formatMoney(value) {
  const parsed = Number(value || 0);
  if (!Number.isFinite(parsed)) return "0";
  return Number.isInteger(parsed) ? String(parsed) : parsed.toFixed(2);
}

async function pullLotForOrder(order) {
  const voucherNumber = order?.voucherNumber || "";
  if (!voucherNumber) return;

  const ok = window.confirm(`Pull lot details for ${voucherNumber}? This can mark the order as received on SATHI.`);
  if (!ok) return;

  const payload = lotDetailsPayloadForOrder(order);
  state.tallyResults[voucherNumber] = {
    action: "pull-lot",
    status: "running",
    message: "Pulling lot details from SATHI..."
  };
  renderOrders();

  try {
    setApiProgress({
      step: 0,
      percent: 18,
      title: "Preparing pull lot",
      message: `Creating signed request for ${voucherNumber}.`
    });
    const previewResult = await api("/api/sathi/preview", {
      method: "POST",
      body: { action: "pullLot", payload, scope: activeScopePayload() }
    });
    setApiProgress({
      step: 1,
      percent: 45,
      title: "Sending pull lot",
      message: "Request sent to SATHI."
    });
    const result = await api("/api/sathi/raw-call", {
      method: "POST",
      body: {
        action: "pullLot",
        requestHeaders: previewResult.preview?.headers || {},
        requestBody: previewResult.preview?.body || payload,
        scope: activeScopePayload()
      }
    });
    setApiProgress({
      step: 3,
      percent: 82,
      title: "Saving lot details",
      message: "Lot details received and saved locally."
    });
    const pulledBills = normalizeLotBills(result.raw).map((bill) => ({
      ...bill,
      buyerCode: bill.buyerCode || order.buyerCode || activeLicenceScope()?.clientId || "",
      licenceCode: activeLicenceScope()?.clientId || order.buyerCode || ""
    })).filter(belongsToActiveLicence);
    state.lotBills = mergeByKey(state.lotBills.filter(belongsToActiveLicence), pulledBills, (bill) => bill.billNumber || bill.voucherNumber);
    state.activeMappingVoucherNumber = voucherNumber;
    syncOrdersFromLotBills();
    await loadStoredSathiQueue({ silent: true });
    updateVoucherOptions();
    renderOrders();
    renderLotDetails();
    finishApiProgress(true, "Lot details pulled successfully.");
    showToast(`Lot details pulled for ${voucherNumber}.`);
    const bill = findBillForOrder(order);
    if (bill && mappingStatusForBill(bill).label !== t("ready", "Ready")) {
      reloadIntoMapping(voucherNumber);
    }
  } catch (error) {
    const message = extractApiMessage(error.message);
    finishApiProgress(false, message);
    state.tallyResults[voucherNumber] = {
      action: "pull-lot",
      status: "failed",
      message
    };
    await loadErrors();
    renderOrders();
    showApiErrorToast(error, `Pull lot failed for ${voucherNumber}.`);
  }
}

function lotDetailsPayloadForOrder(order = {}) {
  const scope = activeLicenceScope();
  const fields = scope?.fields || {};
  return {
    ownerCode: fields.ownerCode || scopeLicenceCode(scope) || state.config?.saathi?.ownerCode || document.getElementById("quickOwnerCode")?.value?.trim() || order.buyerCode || "",
    stateCode: fields.stateCode || state.config?.saathi?.stateCode || document.getElementById("quickStateCode")?.value?.trim() || order.stateCode || "",
    voucherNumber: order.voucherNumber || "",
    locationCode: fields.locationCode || fields.ownerCode || scopeLicenceCode(scope) || state.config?.saathi?.locationCode || document.getElementById("locationCode")?.value?.trim() || order.buyerCode || ""
  };
}

function orderDetailHtml(bill) {
  const tallyResult = state.tallyResults[bill.billNumber] || latestTallyLogForVoucher(bill.billNumber);
  const lots = (bill.lotData || []).map((lot, index) => `
    <li class="simple-lot-line">
      <span class="simple-lot-index">${index + 1}</span>
      <div>
        <strong>${escapeHtml(portalItemName(lot))}</strong>
        <small>Lot: ${escapeHtml(lot.lotNum || "-")} | Qty: ${escapeHtml(formatBags(lot.totalBags || 0))} bag | Pack: ${escapeHtml(formatPacking(lot) || "-")}${lot.totalQty ? ` | Portal qty: ${escapeHtml(lot.totalQty)}` : ""}</small>
      </div>
    </li>
  `).join("");

  return `
    <div class="order-detail-card simple-order-detail">
      <ul class="simple-lot-list">${lots}</ul>
      <div class="detail-actions">
        <button class="secondary-button" data-action="review-mapping" data-voucher-number="${escapeHtml(bill.billNumber || bill.voucherNumber || "")}" type="button">${escapeHtml(t("reviewItemMapping", "Review item mapping"))}</button>
      </div>
      ${tallyResultHtml(tallyResult)}
    </div>
  `;
}

function mappingStatusForBill(bill) {
  const lots = uniqueMappingLots(bill?.lotData || []);
  if (!lots.length) return { label: t("lotMissing", "Lot missing"), className: "status-pill status-warn" };
  const missingItems = lots.filter((lot) => !resolveTallyItemForLot(lot)).length;
  if (missingItems) return { label: `${missingItems} ${t("itemMappingRequired", "item mapping required")}`, className: "status-pill status-warn" };
  const party = resolvePartyLedgerForBill(bill);
  if (!party.ledgerName) return { label: t("partyToMap", "Party to map"), className: "status-pill status-warn" };
  return { label: t("ready", "Ready"), className: "status-pill status-ok" };
}

function grnStatusForBill(bill = {}) {
  const lots = (bill.lotData || []).filter((lot) => lot.lotNum);
  if (!lots.length) return null;
  const balances = lots.map((lot) => grnBalanceForLot(lot, bill));
  const visibleBalances = balances.filter((balance) => balance.availableBags > 0);
  if (!visibleBalances.length) return null;
  const matched = visibleBalances.filter((balance) => balance.matchedRows && balance.availableBags > 0).length;
  const shortage = visibleBalances.reduce((total, balance) => total + balance.shortageBags, 0);
  const pending = visibleBalances.reduce((total, balance) => total + balance.pendingBags, 0);
  if (shortage > 0) return { label: `GRN short ${formatBags(shortage)} bag`, className: "status-pill status-danger" };
  if (matched && pending > 0) return { label: `GRN balance ${formatBags(pending)} bag`, className: "status-pill status-ok" };
  if (matched) return { label: "GRN matched", className: "status-pill status-ok" };
  return null;
}

function grnMatchesForLot(lot = {}, bill = null) {
  const wanted = String(lot.lotNum || "").trim().toUpperCase();
  if (!wanted) return [];
  if (!bill) return grnRowsForLot(wanted);
  return grnAllocationRowsForLot(wanted, bill)
    .filter((row) => row.pendingBags > 0 || isBillPushedToTally(bill));
}

function grnMatchesForBillPayload(bill = {}) {
  const matches = {};
  for (const lot of bill.lotData || []) {
    const lotNum = String(lot.lotNum || "").trim();
    if (!lotNum) continue;
    const rows = grnMatchesForLot(lot, bill).map((row) => ({
      grnVoucherNumber: row.grnVoucherNumber || "",
      grnVoucherType: row.grnVoucherType || "",
      grnDate: row.grnDate || "",
      partyName: row.partyName || "",
      lotNum: row.lotNum || lotNum,
      stockItemName: row.stockItemName || "",
      quantityText: row.quantityText || "",
      bags: grnRowBags(row),
      originalOwner: row.originalOwner || "",
      packingSize: row.packingSize || ""
    }));
    if (rows.length) matches[lotNum] = rows;
  }
  return matches;
}

function grnBalanceForLot(lot = {}, bill = null, matchRows = null) {
  const lotNum = String(lot.lotNum || "").trim();
  const allocationRows = matchRows
    ? matchRows.map((row) => ({
      ...row,
      grnBags: Number(row.grnBags ?? row.bags ?? grnRowBags(row)) || 0,
      usedBags: Number(row.usedBags ?? 0) || 0,
      pendingBags: Number(row.pendingBags ?? Math.max(0, grnRowBags(row) - Number(row.usedBags || 0))) || 0
    }))
    : grnAllocationRowsForLot(lotNum, bill);
  const grnBags = allocationRows.reduce((total, row) => total + row.grnBags, 0);
  const currentBags = sathiLotBags(lot);
  const usedBags = allocationRows.reduce((total, row) => total + row.usedBags, 0);
  const availableBags = allocationRows.reduce((total, row) => total + row.pendingBags, 0);
  const shortageBags = Math.max(0, currentBags - availableBags);
  return {
    lotNum,
    grnBags,
    usedBags,
    availableBags,
    currentBags,
    pendingBags: Math.max(0, availableBags - currentBags),
    shortageBags,
    matchedRows: allocationRows.length
  };
}

function grnBalanceForRow(row = {}) {
  const lotNum = String(row.lotNum || "").trim();
  const allocation = grnAllocationRowsForLot(lotNum).find((entry) => grnRowKey(entry) === grnRowKey(row));
  const grnBags = allocation?.grnBags ?? grnRowBags(row);
  const usedBags = allocation?.usedBags ?? 0;
  const pendingBags = allocation?.pendingBags ?? Math.max(0, grnBags - usedBags);
  return {
    lotNum,
    grnBags,
    usedBags,
    availableBags: pendingBags,
    pendingBags,
    shortageBags: Math.max(0, usedBags - grnBags),
    matchedRows: grnBags > 0 ? 1 : 0,
    reportMode: true
  };
}

function grnAllocationRowsForLot(lotNum = "", currentBill = null) {
  const rows = grnRowsForLot(lotNum);
  let used = usedSathiBagsForLot(lotNum, currentBill);
  return rows.map((row) => {
    const grnBags = grnRowBags(row);
    const usedBags = Math.min(Math.max(used, 0), grnBags);
    used -= usedBags;
    return {
      ...row,
      grnBags,
      usedBags,
      pendingBags: Math.max(0, grnBags - usedBags)
    };
  });
}

function grnRowKey(row = {}) {
  if (row.id) return `id:${row.id}`;
  return [
    row.grnVoucherNumber || row.voucherNumber || "",
    row.grnDate || row.date || "",
    row.lotNum || "",
    row.stockItemName || "",
    row.quantityText || row.quantity || "",
    row.amount || ""
  ].join("|").toUpperCase();
}

function grnRowsForLot(lotNum = "") {
  const wanted = String(lotNum || "").trim().toUpperCase();
  if (!wanted) return [];
  const rows = [...(state.grnLots || []), ...(state.reports.grnRows || [])];
  const seen = new Set();
  return rows.filter((row) => {
    if (String(row.lotNum || "").trim().toUpperCase() !== wanted) return false;
    const key = [
      row.grnVoucherNumber || "",
      row.grnDate || "",
      row.stockItemName || "",
      row.quantityText || row.quantity || ""
    ].join("|");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function allSathiLotsForLot(lotNum = "") {
  const wanted = String(lotNum || "").trim().toUpperCase();
  if (!wanted) return [];
  const rows = [];
  for (const bill of state.lotBills || []) {
    if (!belongsToActiveLicence(bill)) continue;
    for (const lot of bill.lotData || []) {
      if (String(lot.lotNum || "").trim().toUpperCase() === wanted) rows.push({ lot, bill });
    }
  }
  return rows;
}

function usedSathiBagsForLot(lotNum = "", currentBill = null) {
  const currentIndex = currentBill ? billQueueIndex(currentBill) : -1;
  return allSathiLotsForLot(lotNum).reduce((total, entry) => {
    const bill = entry.bill || {};
    if (currentBill && isSameBill(bill, currentBill)) return total;
    if (!isBillPushedToTally(bill)) {
      const entryIndex = billQueueIndex(bill);
      if (currentIndex < 0 || entryIndex < 0 || entryIndex >= currentIndex) return total;
    }
    return total + sathiLotBags(entry.lot);
  }, 0);
}

function billQueueIndex(targetBill = {}) {
  const targetNumber = targetBill.billNumber || targetBill.voucherNumber || "";
  if (!targetNumber) return -1;
  return (state.lotBills || []).findIndex((bill) => isSameBill(bill, targetBill) || bill.billNumber === targetNumber || bill.voucherNumber === targetNumber);
}

function grnRowBags(row = {}) {
  const quantity = Number(row.quantity || 0);
  if (Number.isFinite(quantity) && quantity > 0) return quantity;
  const textMatch = String(row.quantityText || "").match(/-?\d+(?:\.\d+)?/);
  if (textMatch) return Number(textMatch[0]);
  return 0;
}

function sathiLotBags(lot = {}) {
  const bags = Number(lot.totalBags || 0);
  if (Number.isFinite(bags) && bags > 0) return bags;
  return 0;
}

function isSameBill(left = {}, right = {}) {
  const leftNumber = left.billNumber || left.voucherNumber || "";
  const rightNumber = right.billNumber || right.voucherNumber || "";
  return leftNumber && rightNumber && leftNumber === rightNumber;
}

function isBillPushedToTally(bill = {}) {
  const voucherNumber = bill.billNumber || bill.voucherNumber || "";
  const status = state.tallyStatuses[voucherNumber] || "";
  const result = state.tallyResults[voucherNumber] || latestTallyLogForVoucher(voucherNumber) || {};
  const normalizedStatus = String(status || "").trim().toLowerCase();
  const normalizedResultStatus = String(result.status || "").trim().toLowerCase();
  const message = String(result.message || "").trim().toLowerCase();
  if (["verified in tally", "partial in tally"].includes(normalizedStatus)) return true;
  if (["verified", "partial", "pushed-and-verified", "pushed-partial", "skipped-existing", "partial-existing"].includes(normalizedResultStatus)) return true;
  if (result.verification?.exists || result.alreadyExists) return true;
  if (result.verification?.partial || result.partialExists) return true;
  if (message.includes("already exists in tally") || message.includes("imported and verified in tally")) return true;
  return false;
}

function isOrderPushedToTally(order = {}) {
  if (historicalPurchaseQueueStatus(order)) return true;
  const bill = findBillForOrder(order) || { billNumber: order.voucherNumber, voucherNumber: order.voucherNumber };
  return isBillPushedToTally(bill);
}

function tallyStatusFromQueue(order = {}) {
  const status = String(order.queueStatus || "").trim().toLowerCase();
  if (status === "existing-purchase-updated-no-sales") return "Existing purchase updated but no sales found/updated";
  if (status === "historical-updated" || status === "existing-purchase-updated") return "Existing purchase updated";
  if (status === "pushed-to-tally") return "Pushed to Tally";
  return "";
}

function historicalPurchaseQueueStatus(order = {}) {
  const status = String(order.queueStatus || "").trim().toLowerCase();
  return ["historical-updated", "existing-purchase-updated", "existing-purchase-updated-no-sales"].includes(status);
}

function tallyStatusFromVerification(result = {}) {
  if (result.exactMatch || result.exists) return "Verified in Tally";
  if (result.partial || result.partialExists || result.verification?.partial) return "Partial in Tally";
  if (result.voucherFound) return "Partial in Tally";
  return "Pending for Tally";
}

function grnBalanceStatusText(balance = {}) {
  if (!balance.matchedRows && !balance.grnBags) return "GRN not found";
  if (balance.reportMode && balance.usedBags <= 0) return "Not matched";
  if (balance.reportMode && balance.pendingBags > 0) return `Partial matched, ${formatBags(balance.pendingBags)} bag pending`;
  if (balance.reportMode) return "Matched";
  if (balance.availableBags <= 0) return "GRN already knocked off";
  if (balance.shortageBags > 0) return `Short by ${formatBags(balance.shortageBags)} bag`;
  if (balance.pendingBags > 0) return `Pending ${formatBags(balance.pendingBags)} bag`;
  return "Will fully knock off";
}

function grnBalanceStatusClass(balance = {}) {
  if (!balance.grnBags) return "status-pill status-danger";
  if (balance.reportMode && balance.pendingBags <= 0 && balance.usedBags > 0) return "status-pill status-ok";
  if (balance.reportMode && balance.usedBags > 0) return "status-pill status-warn";
  if (balance.reportMode) return "status-pill status-danger";
  if (balance.availableBags <= 0 || balance.shortageBags > 0) return "status-pill status-danger";
  if (balance.pendingBags > 0) return "status-pill status-warn";
  return "status-pill status-ok";
}

function firstBlockingGrnIssue(bill = {}) {
  for (const lot of bill.lotData || []) {
    const rows = grnRowsForLot(lot.lotNum || "");
    if (!rows.length) continue;
    const balance = grnBalanceForLot(lot, bill);
    if (balance.availableBags > 0 && balance.shortageBags > 0) {
      return `GRN quantity short for lot ${lot.lotNum}: required ${formatBags(balance.currentBags)} bag, available ${formatBags(balance.availableBags)} bag.`;
    }
  }
  return "";
}

function orderGodownForBill(bill = {}) {
  return state.commonGodownName
    || document.getElementById("orderCommonGodownInput")?.value?.trim()
    || defaultOrderGodownName();
}

function formatBags(value) {
  const number = Number(value || 0);
  if (!Number.isFinite(number)) return "0";
  return Number.isInteger(number) ? String(number) : String(Number(number.toFixed(4)));
}

function grnMatchHtmlForLot(lot = {}, bill = null) {
  const matches = grnMatchesForLot(lot, bill);
  const balance = grnBalanceForLot(lot, bill, matches);
  if (!matches.length) {
    return '<div><span>GRN Match</span><strong>Not available</strong><small>Either no GRN or already fully knocked off.</small></div>';
  }
  const matchHtml = matches.slice(0, 2).map((row) => `
    <div>
      <span>GRN Match</span>
      <strong>${escapeHtml(row.grnVoucherNumber || "-")}</strong>
      <small>${escapeHtml([row.grnDate, row.partyName, `${formatBags(grnRowBags(row))} bag`, row.packingSize ? `Pack ${row.packingSize}` : ""].filter(Boolean).join(" | "))}</small>
    </div>
  `).join("");
  return `${matchHtml}
    <div>
      <span>Qty Status</span>
      <strong>${escapeHtml(grnBalanceStatusText(balance))}</strong>
      <small>${escapeHtml(`GRN ${formatBags(balance.grnBags)} bag | Used ${formatBags(balance.usedBags)} bag | This bill ${formatBags(balance.currentBags)} bag | Pack ${lot.packingSize || "-"}`)}</small>
    </div>`;
}

function itemMappingInputHtml(lot) {
  const key = portalItemKey(lot);
  const portalName = portalItemName(lot);
  const mapped = resolveTallyItemForLot(lot);
  const matchClass = mapped ? " mapped" : "";

  return `
    <div class="item-map-cell">
      <label>Tally item</label>
      <input
        class="item-map-input${matchClass}"
        list="tallyStockItemsList"
        data-portal-key="${escapeHtml(key)}"
        data-portal-name="${escapeHtml(portalName)}"
        value="${escapeHtml(mapped)}"
        placeholder="Select Tally item"
      >
      <small>${escapeHtml(portalName)}</small>
    </div>
  `;
}

function itemMappingReviewHtml(lot, index) {
  const key = portalItemKey(lot);
  const portalName = portalItemName(lot);
  const stored = state.itemMappings[key] || state.itemMappings[portalName];
  const mapped = stored?.createNew ? "" : resolveTallyItemForLot(lot);
  const packingConversion = String(lot.packingSize || "").trim();
  const storedConversion = String(stored?.conversion || "").trim();
  const defaultConversion = packingConversion || storedConversion || "1";
  const conversion = !storedConversion || storedConversion === "1" ? defaultConversion : storedConversion;
  const detailClass = mapped ? "mapping-card-body compact-map-detail hidden" : "mapping-card-body";
  const detailHtml = `
        <div class="mapping-step">
          <span>SATHI stock</span>
          <strong>${escapeHtml(lot.lotNum || "-")}</strong>
          <small>${escapeHtml([lot.packingSize, lot.packingUnit, lot.totalBags ? `${lot.totalBags} bag` : ""].filter(Boolean).join(" | "))}</small>
        </div>
        <div class="mapping-step mapping-step-control">
          <span>${escapeHtml(t("portalItem", "Portal item"))}</span>
          <strong>${escapeHtml(portalName)}</strong>
          <small>This name is only used to identify the SATHI item.</small>
        </div>
        <div class="mapping-step mapping-step-control mapping-item-step">
          <label>${escapeHtml(t("mappedExistingItem", "Tally item for entry"))}</label>
          <input
            class="mapping-review-input${mapped ? " mapped" : ""}"
            data-portal-key="${escapeHtml(key)}"
            data-portal-name="${escapeHtml(portalName)}"
            data-packing-size="${escapeHtml(packingConversion)}"
            data-sathi-standard="true"
            value="${escapeHtml(mapped)}"
            placeholder="Required existing item"
            autocomplete="off"
          >
          <div class="stock-search-dropdown hidden" role="listbox"></div>
          <small>Purchase entry will use this existing Tally item. Primary unit must be Nos, Pcs, No, Nug or Qty.</small>
        </div>
        <div class="mapping-hidden-unit">
          <input class="mapping-base-unit" data-portal-key="${escapeHtml(key)}" value="Nos" type="hidden">
          <input class="mapping-additional-unit" data-portal-key="${escapeHtml(key)}" value="Kgs" type="hidden">
          <input class="mapping-conversion" data-portal-key="${escapeHtml(key)}" data-packing-size="${escapeHtml(packingConversion)}" value="${escapeHtml(conversion)}" type="hidden">
        </div>
  `;

  return `
    <article class="mapping-review-card ${mapped ? "compact-map-card" : ""} ready-map">
      <div class="mapping-card-head ${mapped ? "compact-map-head" : ""}">
        <span class="lot-map-number">${index + 1}</span>
        <div>
          <strong>${escapeHtml(portalName)}</strong>
          <small class="${mapped ? "compact-map-route" : ""}">${mapped
      ? `<b>Purchase entry item</b> ${escapeHtml(mapped)}`
      : escapeHtml([lot.cropName, lot.lotNum ? `Batch ${lot.lotNum}` : ""].filter(Boolean).join(" | "))}</small>
        </div>
        <span class="mapping-state ${mapped ? "ok" : "warn"}">${escapeHtml(mapped ? "Item selected" : "Item required")}</span>
        ${mapped ? `<button class="compact-map-toggle" type="button">Change</button>` : ""}
      </div>
      <div class="${detailClass}">
        ${detailHtml}
      </div>
    </article>
  `;
}

function findBillForOrder(order) {
  return state.lotBills.filter(belongsToActiveLicence).find((bill) => bill.billNumber === order.voucherNumber || bill.voucherNumber === order.voucherNumber);
}

function partyMappingKey(bill = {}) {
  return bill.sellerCode || bill.sellerName || "";
}

function portalPartyName(bill = {}) {
  return bill.sellerName || bill.sellerCode || "SATHI Seller";
}

function resolvePartyLedgerForBill(bill = {}) {
  const key = partyMappingKey(bill);
  const portalName = portalPartyName(bill);
  const stored = state.partyMappings[key] || state.partyMappings[portalName];
  const storedName = typeof stored === "string" ? stored : stored?.tallyLedgerName || stored?.ledgerName || "";
  if (storedName) {
    return {
      ledgerName: storedName,
      source: "mapped",
      label: "Mapped",
      className: "mapping-state ok"
    };
  }

  const exact = findLedgerByName(portalName);
  if (exact?.name) {
    return {
      ledgerName: exact.name,
      source: "exact",
      label: "Exact match",
      className: "mapping-state ok"
    };
  }

  return {
    ledgerName: "",
    source: "missing",
    label: "Party mapping required",
    className: "mapping-state warn"
  };
}

function findLedgerByName(name) {
  const key = normalizeText(name);
  if (!key) return null;
  return (state.partyLedgers || []).find((ledger) => (
    normalizeText(ledger.name) === key ||
    (ledger.aliases || []).some((alias) => normalizeText(alias) === key)
  )) || null;
}

function buildBillPartyMappings(bill = {}) {
  const resolved = resolvePartyLedgerForBill(bill);
  const key = partyMappingKey(bill);
  if (!key || !resolved.ledgerName) return {};
  return {
    [key]: {
      portalPartyName: portalPartyName(bill),
      portalPartyCode: bill.sellerCode || "",
      tallyLedgerName: resolved.ledgerName,
      source: resolved.source
    }
  };
}

async function checkTallyStatus(order) {
  state.tallyStatuses[order.voucherNumber] = "Checking...";
  renderOrders();

  try {
    const bill = findBillForOrder(order);
    const expectedRows = expectedTallyRowsForBill(bill || {});
    const result = await api("/api/tally/voucher-status", {
      method: "POST",
      body: {
        voucherNumber: order.voucherNumber,
        bill,
        itemMappings: bill ? buildBillItemMappings(bill) : {},
        expectedRows
      }
    });
    state.tallyStatuses[order.voucherNumber] = tallyStatusFromVerification(result);
    state.tallyResults[order.voucherNumber] = {
      action: "voucher-status",
      status: result.status || (result.exists ? "verified" : result.partial ? "partial" : "not-found"),
      message: result.message || (result.exists ? "SATHI voucher item/batch verified in Tally." : result.partial ? "SATHI voucher found, but item/batch missing." : "SATHI voucher UDF was not found in Tally export."),
      verification: result,
      rawPreview: result.rawPreview,
      log: result.log
    };
    await loadTallyLogs();
  } catch (error) {
    state.tallyStatuses[order.voucherNumber] = "Check failed";
    state.tallyResults[order.voucherNumber] = {
      action: "voucher-status",
      status: "failed",
      message: error.message
    };
    await loadTallyLogs();
    throw error;
  } finally {
    renderOrders();
  }
}

async function checkAllTallyStatuses() {
  for (const order of state.orders.filter(belongsToActiveLicence)) {
    try {
      await checkTallyStatus(order);
    } catch (error) {
      state.tallyStatuses[order.voucherNumber] = "Check failed";
      state.tallyResults[order.voucherNumber] = {
        action: "voucher-status",
        status: "failed",
        message: error.message
      };
    }
  }
  renderOrders();
}

async function pushOrderToTally(order, options = {}) {
  const bill = findBillForOrder(order);
  if (!bill) {
    showToast("Lot details missing. Pull lot details before Tally push.");
    return;
  }

  const itemMappings = buildBillItemMappings(bill);
  const missingItemMappings = uniqueMappingLots(bill.lotData || []).filter((lot) => !resolveTallyItemForLot(lot));
  if (missingItemMappings.length) {
    showToast("Map existing Tally item for GST/HSN before Tally push.");
    renderLotDetails();
    switchTab("lots");
    return;
  }
  const grnIssue = firstBlockingGrnIssue(bill);
  if (grnIssue) {
    showToast(grnIssue);
    state.tallyResults[order.voucherNumber] = {
      action: "grn-check",
      status: "failed",
      message: grnIssue
    };
    renderOrders();
    return;
  }
  const partyLedger = resolvePartyLedgerForBill(bill);
  if (!partyLedger.ledgerName) {
    showToast("Map seller party ledger before Tally push.");
    renderLotDetails();
    switchTab("lots");
    window.requestAnimationFrame(() => {
      document.getElementById("partyMappingReview")?.scrollIntoView({ block: "start", behavior: "smooth" });
    });
    return;
  }
  const partyLedgerMappings = buildBillPartyMappings(bill);

  if (!options.skipHistoricalCheck) {
    offerHistoricalRecovery(order, bill);
    return;
  }

  state.tallyStatuses[order.voucherNumber] = "Pushing...";
  renderOrders();

  try {
    const result = await api("/api/tally/push-voucher", {
      method: "POST",
      body: {
        bill,
        itemMappings,
        expectedRows: expectedTallyRowsForBill(bill),
        partyLedgerMappings,
        grnMatches: grnMatchesForBillPayload(bill),
        godownName: orderGodownForBill(bill),
        stockItems: state.stockItems || [],
        scope: activeScopePayload()
      }
    });
    state.tallyStatuses[order.voucherNumber] = (result.alreadyExists || result.partialExists)
      ? tallyStatusFromVerification(result.verification || result)
      : resolvePushStatus(result);
    state.tallyResults[order.voucherNumber] = {
      action: "push-voucher",
      status: state.tallyStatuses[order.voucherNumber],
      message: result.message || "Tally push completed.",
      importSummary: result.summary,
      masterResult: result.masterResult,
      lineErrors: result.lineErrors || [],
      verification: result.verification,
      log: result.log
    };
    setText("tallyNote", result.message || state.tallyStatuses[order.voucherNumber]);
    await loadTallyLogs();
  } catch (error) {
    state.tallyStatuses[order.voucherNumber] = "Push warning";
    state.tallyResults[order.voucherNumber] = {
      action: "push-voucher",
      status: "failed",
      message: error.message
    };
    setText("tallyNote", error.message);
    await loadTallyLogs();
    renderOrders();
    showApiErrorToast(error, `Tally push failed for ${order.voucherNumber}.`);
    return;
  }
  renderOrders();
  if (state.tallyStatuses[order.voucherNumber] === "Push warning") {
    showToast(state.tallyResults[order.voucherNumber]?.message || `Tally push warning for ${order.voucherNumber}.`);
    return;
  }
  showToast(`Tally push completed for ${order.voucherNumber}.`);
}

function updateDailyWorkQueue(orders = []) {
  const missingMapping = orders.filter((order) => {
    const bill = findBillForOrder(order);
    return !bill || !mappingStatusForBill(bill).className.includes("status-ok");
  }).length;
  const readyToPush = orders.filter((order) => {
    const bill = findBillForOrder(order);
    return bill && mappingStatusForBill(bill).className.includes("status-ok") && !firstBlockingGrnIssue(bill);
  }).length;
  const sathiTitle = document.getElementById("dailySathiActionTitle");
  const sathiText = document.getElementById("dailySathiActionText");
  const tallyTitle = document.getElementById("dailyTallyActionTitle");
  const tallyText = document.getElementById("dailyTallyActionText");
  if (sathiTitle) sathiTitle.textContent = readyToPush ? `${readyToPush} Tally bill ready` : "SATHI to Tally";
  if (sathiText) sathiText.textContent = missingMapping
    ? `${missingMapping} mapping/check pending`
    : (readyToPush ? "Open queue and push ready bills" : "Fetch orders or review queue");
  if (tallyTitle) tallyTitle.textContent = "Tally to SATHI";
  if (tallyText) tallyText.textContent = "Auto licence decision while sending sales";
}

async function pushAllPendingToTally() {
  await openBulkHistoricalRecovery();
}

function pendingOrdersForTallyPush() {
  return state.orders.filter((order) => {
    if (!belongsToActiveLicence(order)) return false;
    const status = state.tallyStatuses[order.voucherNumber] || "Pending for Tally";
    return !["Found in Tally", "Verified in Tally", "Partial in Tally", "Pushed to Tally", "Existing purchase updated", "Existing purchase updated but no sales found/updated"].includes(status);
  });
}

function offerHistoricalRecovery(order, bill) {
  state.recoveryAssistant = {
    bill,
    order,
    stage: "purchase-loading",
    autoMode: true,
    purchaseCandidates: [],
    updatedPurchases: [],
    salesCandidates: [],
    updatedSales: []
  };
  renderRecoveryAssistant();
  document.getElementById("recoveryDialog")?.classList.remove("hidden");
  window.setTimeout(() => loadHistoricalPurchaseCandidates({ auto: true }), 40);
}

async function openBulkHistoricalRecovery() {
  const orders = pendingOrdersForTallyPush();
  state.recoveryAssistant = {
    stage: "bulk-purchase-loading",
    bulkOrders: orders,
    bulkCandidates: [],
    updatedPurchases: []
  };
  renderRecoveryAssistant();
  document.getElementById("recoveryDialog")?.classList.remove("hidden");

  const candidates = [];
  for (const order of orders) {
    const bill = findBillForOrder(order);
    if (!bill) continue;
    const partyLedger = resolvePartyLedgerForBill(bill).ledgerName;
    const mappedItems = uniqueMappingLots(bill.lotData || []).map((lot) => resolveTallyItemForLot(lot)).filter(Boolean);
    if (!partyLedger || !mappedItems.length) continue;
    try {
      const result = await api("/api/tally/batch-correction/candidates", {
        method: "POST",
        body: {
          companyName: selectedCompanyName(),
          mode: "purchase",
          voucherTypeName: activeLicenceScope()?.purchaseVoucherTypeName || state.config?.tally?.voucherTypeName || "Purchase",
          partyLedgerName: partyLedger,
          stockItemNames: mappedItems,
          expectedQuantities: expectedQuantitiesForBill(bill),
          fromDate: sathiApplicabilityDate(),
          toDate: bill.billDate || ""
        }
      });
      for (const row of result.rows || []) {
        const lot = recoveryLotForItem(bill, row.stockItemName);
        if (lot) candidates.push({ ...row, lot, order, bill });
      }
    } catch {
      // Continue scanning other orders; support-ready errors are recorded by the API layer.
    }
  }

  state.recoveryAssistant.bulkCandidates = candidates.sort((a, b) => {
    if (a.quantityMatched !== b.quantityMatched) return a.quantityMatched ? -1 : 1;
    return String(a.order?.voucherNumber || "").localeCompare(String(b.order?.voucherNumber || ""));
  });
  state.recoveryAssistant.stage = "bulk-purchase-list";
  renderRecoveryAssistant();
}

function closeRecoveryAssistant() {
  document.getElementById("recoveryDialog")?.classList.add("hidden");
}

async function handleRecoveryAssistantClick(event) {
  const action = event.target.closest("[data-recovery-action]")?.dataset.recoveryAction;
  if (!action) return;
  if (action === "close") return closeRecoveryAssistant();
  if (action === "check-purchase") return loadHistoricalPurchaseCandidates({ auto: false });
  if (action === "create-new-purchase") {
    const { order } = state.recoveryAssistant;
    closeRecoveryAssistant();
    if (order) await pushOrderToTally(order, { skipHistoricalCheck: true });
    return;
  }
  if (action === "skip-purchase") {
    return closeRecoveryAssistant();
  }
  if (action === "update-purchase") return updateHistoricalPurchaseCandidate(Number(event.target.closest("[data-candidate-index]")?.dataset.candidateIndex));
  if (action === "update-bulk-purchase") return updateBulkHistoricalPurchaseCandidate(Number(event.target.closest("[data-bulk-candidate-index]")?.dataset.bulkCandidateIndex));
  if (action === "bulk-create-new-purchases") return createRemainingBulkPurchases();
  if (action === "check-sales") return loadHistoricalSalesCandidates({ auto: false });
  if (action === "skip-sales") {
    state.recoveryAssistant.stage = "done";
    return renderRecoveryAssistant();
  }
  if (action === "update-sales") return updateHistoricalSalesCandidate(Number(event.target.closest("[data-candidate-index]")?.dataset.candidateIndex));
  if (action === "toggle-sales-candidate") {
    const index = Number(event.target.closest("[data-candidate-index]")?.dataset.candidateIndex);
    const candidate = state.recoveryAssistant?.salesCandidates?.[index];
    if (candidate && !candidate.updated) candidate.selected = Boolean(event.target.checked);
    return renderRecoveryAssistant();
  }
  if (action === "update-selected-sales") return updateSelectedHistoricalSalesCandidates();
  if (action === "open-portal-sales") {
    closeRecoveryAssistant();
    switchTab("portalPush");
    await loadPortalSalesEntries({ silent: false });
  }
}

function renderRecoveryAssistant() {
  const assistant = state.recoveryAssistant;
  const title = document.getElementById("recoveryTitle");
  const text = document.getElementById("recoveryText");
  const body = document.getElementById("recoveryBody");
  const actions = document.getElementById("recoveryActions");
  if (!title || !text || !body || !actions) return;

  if (assistant.stage === "purchase-prompt") {
    title.textContent = "Was this purchase already entered in Tally?";
    text.textContent = "Check first to avoid creating a duplicate purchase voucher.";
    body.innerHTML = `<div class="recovery-empty">The app will search earlier vouchers for the mapped item. No entry will be changed until you select Update Batch / Lot.</div>`;
    actions.innerHTML = `
      <button class="secondary-button" data-recovery-action="create-new-purchase" type="button">No, create new Tally bill</button>
      <button class="primary-button" data-recovery-action="check-purchase" type="button">Yes, check earlier bills</button>`;
    return;
  }

  if (assistant.stage === "purchase-loading" || assistant.stage === "sales-loading") {
    title.textContent = assistant.stage === "purchase-loading" ? "Checking earlier purchase entries" : "Checking sales made with old batch";
    text.textContent = "Reading matching vouchers without changing them.";
    body.innerHTML = `<div class="recovery-empty">Please wait...</div>`;
    actions.innerHTML = "";
    return;
  }

  if (assistant.stage === "bulk-purchase-loading") {
    title.textContent = "Bulk historical check";
    text.textContent = "Checking all pending orders for same party, same item and matching quantity.";
    body.innerHTML = `<div class="recovery-empty">Please wait...</div>`;
    actions.innerHTML = "";
    return;
  }

  if (assistant.stage === "bulk-purchase-list") {
    title.textContent = "Bulk earlier purchase entries";
    text.textContent = "Detailed recommendation is shown below. Item matching ignores spaces like Tally item masters.";
    body.innerHTML = `${historicalRecoSummaryHtml(assistant.bulkCandidates || [], "purchase")}${bulkRecoveryCandidateRows(assistant.bulkCandidates || [])}`;
    actions.innerHTML = `
      <button class="secondary-button" data-recovery-action="close" type="button">Close</button>
      <button class="primary-button" data-recovery-action="bulk-create-new-purchases" type="button">Create new bills for remaining orders</button>`;
    return;
  }

  if (assistant.stage === "purchase-list") {
    title.textContent = "Earlier purchase entries";
    text.textContent = assistant.purchaseCandidates.length
      ? "Detailed recommendation is shown below. Item matching ignores spaces like Tally item masters."
      : "No earlier purchase entry matched. You can create a new Tally bill.";
    body.innerHTML = `${historicalRecoSummaryHtml(assistant.purchaseCandidates, "purchase")}${recoveryCandidateRows(assistant.purchaseCandidates, "purchase")}`;
    actions.innerHTML = `
      <button class="secondary-button" data-recovery-action="${assistant.updatedPurchases.length ? "skip-sales" : "create-new-purchase"}" type="button">${assistant.updatedPurchases.length ? "Finish" : "No correct row, create new bill"}</button>
      <button class="primary-button" data-recovery-action="check-sales" type="button" ${assistant.updatedPurchases.length ? "" : "disabled"}>Check sales using old batch</button>`;
    return;
  }

  if (assistant.stage === "sales-list") {
    title.textContent = "Sales made with the old batch";
    text.textContent = "These sales used the earlier batch number. Update the correct rows before portal upload.";
    body.innerHTML = `${historicalSalesInventoryWarningsHtml()}${historicalRecoSummaryHtml(assistant.salesCandidates, "sales")}${recoveryCandidateRows(assistant.salesCandidates, "sales")}`;
    const selectedCount = (assistant.salesCandidates || []).filter((row) => row.selected && !row.updated).length;
    actions.innerHTML = `
      <button class="secondary-button" data-recovery-action="skip-sales" type="button">Finish</button>
      <button class="primary-button" data-recovery-action="update-selected-sales" type="button" ${selectedCount ? "" : "disabled"}>Bulk update selected (${selectedCount})</button>
      <button class="primary-button" data-recovery-action="open-portal-sales" type="button" ${assistant.updatedSales.length ? "" : "disabled"}>Open corrected sales for SATHI</button>`;
    return;
  }

  title.textContent = "Historical entry check complete";
  text.textContent = assistant.autoNoSales
    ? "No old-batch sales were found for the updated purchase."
    : "Normal manual working remains unchanged.";
  body.innerHTML = `<div class="recovery-empty">${escapeHtml(assistant.autoNoSales ? "No sales correction is required right now." : "You can close this assistant now.")}</div>`;
  actions.innerHTML = `<button class="primary-button" data-recovery-action="close" type="button">Done</button>`;
}

function historicalRecoSummaryHtml(rows = [], mode = "purchase") {
  if (!rows.length) return "";
  const recos = rows.map((row) => historicalRecoForRow(row, mode));
  const strong = recos.filter((reco) => reco.level === "strong").length;
  const possible = recos.filter((reco) => reco.level === "possible").length;
  const weak = recos.filter((reco) => reco.level === "weak").length;
  const best = recos[0] || {};
  const title = mode === "sales" ? "Sales recovery recommendation" : "Historical purchase recommendation";
  const action = mode === "sales"
    ? "Update only selected rows after checking inventory warning."
    : best.level === "strong"
      ? "Use Update Batch / Lot on the Strong row."
      : best.level === "possible"
        ? "Review details before update; this is not a perfect match."
        : "Create new bill unless you manually confirm this weak match.";
  return `
    <section class="historical-reco-panel">
      <div>
        <span class="recovery-kicker">${escapeHtml(title)}</span>
        <strong>${escapeHtml(best.label || "No recommendation")}</strong>
        <small>${escapeHtml(action)}</small>
      </div>
      <div class="historical-reco-counts">
        <span class="status-pill status-ok">${strong} Strong</span>
        <span class="status-pill status-warn">${possible} Possible</span>
        <span class="status-pill">${weak} Weak</span>
      </div>
    </section>`;
}

function historicalRecoForRow(row = {}, mode = "purchase") {
  const reasons = ["Item matched (spaces ignored)"];
  const warnings = [];
  const partyMatched = row.partyMatch !== false;
  const qtyKnown = row.expectedQuantity !== null && row.expectedQuantity !== undefined && row.expectedQuantity !== "";
  const qtyMatched = qtyKnown ? Boolean(row.quantityMatched) : false;

  if (mode === "purchase") {
    reasons.push(partyMatched ? "Party matched" : "Party mismatch");
    if (qtyKnown) reasons.push(qtyMatched ? "Quantity matched" : `Quantity mismatch (${row.quantity || 0}/${row.expectedQuantity || 0})`);
    if (!partyMatched) warnings.push("Party is different from SATHI order.");
    if (qtyKnown && !qtyMatched) warnings.push("Quantity does not fully match inward order.");
    if (row.purchaseSathiFieldsPresent) warnings.push("Purchase SATHI UDFs already exist.");
    const level = partyMatched && qtyMatched ? "strong" : (partyMatched || qtyMatched) ? "possible" : "weak";
    return {
      level,
      label: level === "strong" ? "My Strong Suggestion" : level === "possible" ? "Possible Match" : "Weak Match",
      title: level === "strong" ? "This entry is an exact historical match" : level === "possible" ? "This entry needs manual review" : "Low-confidence historical row",
      reasons,
      warnings
    };
  }

  reasons.push("Old batch matched");
  if (row.salesSathiFieldsPresent) warnings.push("Sales SATHI UDFs already exist.");
  const control = historicalSalesInventoryControlForCandidate(row);
  if (control?.over) warnings.push(`Sales qty exceeds inward by ${formatBags(control.excessQty)} bag.`);
  return {
    level: control?.over ? "weak" : "possible",
    label: control?.over ? "Needs Inventory Review" : "Possible Sales Match",
    title: control?.over ? "Inventory warning before update" : "Old-batch sales row found",
    reasons,
    warnings
  };
}

function historicalRecoHtml(row = {}, mode = "purchase") {
  const reco = historicalRecoForRow(row, mode);
  return `
    <div class="historical-reco-card historical-reco-${escapeHtml(reco.level)}">
      <strong>${escapeHtml(reco.label)}</strong>
      <span>${escapeHtml(reco.title)}</span>
      <div class="historical-reco-chips">
        ${reco.reasons.map((reason) => `<small>${escapeHtml(reason)}</small>`).join("")}
        ${reco.warnings.map((warning) => `<small class="warn">${escapeHtml(warning)}</small>`).join("")}
      </div>
    </div>`;
}

function recoveryCandidateRows(rows = [], mode) {
  if (!rows.length) {
    const scan = state.recoveryAssistant?.lastCandidateScan || {};
    const scannedRows = Number(scan.scannedRows || 0);
    const voucherTypes = (scan.voucherTypeNames || []).filter(Boolean).join(", ");
    const details = scannedRows || voucherTypes
      ? `<small>Checked ${scannedRows} Tally row(s)${voucherTypes ? ` in: ${escapeHtml(voucherTypes)}` : ""}. If a purchase exists, check party name, mapped item name, date and empty batch UDFs.</small>`
      : "";
    return `<div class="recovery-empty">No matching voucher with empty SATHI batch fields was found.${details}</div>`;
  }
  return `<div class="recovery-list">${rows.map((row, index) => {
    const updated = Boolean(row.updated);
    const qtyLabel = row.expectedQuantity
      ? (row.quantityMatched ? "Qty matched" : `Qty mismatch: ${row.quantity || 0}/${row.expectedQuantity}`)
      : "";
    const exactMatch = mode === "purchase" && row.partyMatch && row.quantityMatched;
    return `
      <article class="recovery-row">
        ${historicalRecoHtml(row, mode)}
        ${exactMatch ? '<div class="recovery-strong-suggestion"><strong>My Strong Suggestion</strong><span>This entry is an exact match</span><small>Party Matched · Item Matched · Quantity Matched</small></div>' : ""}
        ${mode === "sales" ? `<label class="recovery-check"><input type="checkbox" data-recovery-action="toggle-sales-candidate" data-candidate-index="${index}" ${row.selected === false || updated ? "" : "checked"} ${updated ? "disabled" : ""}> Select</label>` : ""}
        <div><strong>${escapeHtml(row.voucherNumber || "-")}</strong><small>${escapeHtml(formatTallyDate(row.date) || row.date || "-")}</small></div>
        <div><strong>${escapeHtml(row.partyLedgerName || "-")}</strong><small>${escapeHtml(row.voucherTypeName || "-")}</small></div>
        <div><strong>${escapeHtml(row.stockItemName || "-")}</strong><small>Old batch: ${escapeHtml(row.batchName || "-")}</small></div>
        <div><strong>${escapeHtml(row.quantityText || "-")}</strong><small>Rate ${escapeHtml(row.rate || "-")} | Amount ${escapeHtml(row.amount || "-")}</small>${qtyLabel ? `<span class="${row.quantityMatched ? "status-pill status-ok" : "status-pill status-warn"}">${escapeHtml(qtyLabel)}</span>` : ""}</div>
        <button class="${updated ? "secondary-button" : "primary-button"}" data-recovery-action="update-${mode}" data-candidate-index="${index}" type="button" ${updated ? "disabled" : ""}>${updated ? "Updated" : "Update Batch / Lot"}</button>
      </article>`;
  }).join("")}</div>`;
}

function bulkRecoveryCandidateRows(rows = []) {
  if (!rows.length) return `<div class="recovery-empty">No same-party same-item earlier purchase entry was found for the pending orders.</div>`;
  return `<div class="recovery-list">${rows.map((row, index) => {
    const updated = Boolean(row.updated);
    const qtyLabel = row.expectedQuantity
      ? (row.quantityMatched ? "Best match" : `Qty mismatch: ${row.quantity || 0}/${row.expectedQuantity}`)
      : "";
    const exactMatch = row.partyMatch && row.quantityMatched;
    return `
      <article class="recovery-row">
        ${historicalRecoHtml(row, "purchase")}
        ${exactMatch ? '<div class="recovery-strong-suggestion"><strong>My Strong Suggestion</strong><span>This entry is an exact match</span><small>Party Matched · Item Matched · Quantity Matched</small></div>' : ""}
        <div><strong>${escapeHtml(row.order?.voucherNumber || "-")}</strong><small>SATHI order</small></div>
        <div><strong>${escapeHtml(row.voucherNumber || "-")}</strong><small>${escapeHtml(formatTallyDate(row.date) || row.date || "-")} | ${escapeHtml(row.voucherTypeName || "-")}</small></div>
        <div><strong>${escapeHtml(row.partyLedgerName || "-")}</strong><small>${escapeHtml(row.stockItemName || "-")}</small></div>
        <div><strong>${escapeHtml(row.quantityText || "-")}</strong><small>Old batch: ${escapeHtml(row.batchName || "-")}</small>${qtyLabel ? `<span class="${row.quantityMatched ? "status-pill status-ok" : "status-pill status-warn"}">${escapeHtml(qtyLabel)}</span>` : ""}</div>
        <button class="${updated ? "secondary-button" : "primary-button"}" data-recovery-action="update-bulk-purchase" data-bulk-candidate-index="${index}" type="button" ${updated ? "disabled" : ""}>${updated ? "Updated" : "Update Batch / Lot"}</button>
      </article>`;
  }).join("")}</div>`;
}

function expectedQuantitiesForBill(bill = {}) {
  return uniqueMappingLots(bill.lotData || []).map((lot) => ({
    stockItemName: resolveTallyItemForLot(lot),
    quantity: Number(lot.totalBags || 0)
  })).filter((row) => row.stockItemName && Number.isFinite(row.quantity) && row.quantity > 0);
}

async function loadHistoricalPurchaseCandidates(options = {}) {
  const assistant = state.recoveryAssistant;
  const bill = assistant.bill || {};
  const scope = activeLicenceScope() || {};
  const mappedItems = uniqueMappingLots(bill.lotData || []).map((lot) => resolveTallyItemForLot(lot)).filter(Boolean);
  assistant.stage = "purchase-loading";
  renderRecoveryAssistant();
  try {
    const result = await api("/api/tally/batch-correction/candidates", {
      method: "POST",
      body: {
        companyName: selectedCompanyName(),
        mode: "purchase",
        voucherTypeName: scope.purchaseVoucherTypeName || state.config?.tally?.voucherTypeName || "Purchase",
        partyLedgerName: resolvePartyLedgerForBill(bill).ledgerName,
        stockItemNames: mappedItems,
        expectedQuantities: expectedQuantitiesForBill(bill),
        fromDate: sathiApplicabilityDate(),
        toDate: bill.billDate || ""
      }
    });
    assistant.lastCandidateScan = {
      voucherTypeNames: result.voucherTypeNames || [],
      scannedRows: result.scannedRows || 0
    };
    assistant.purchaseCandidates = (result.rows || []).map((row) => ({
      ...row,
      lot: recoveryLotForItem(bill, row.stockItemName)
    })).filter((row) => row.lot);
    assistant.stage = "purchase-list";
    assistant.autoMode = Boolean(options.auto);
  } catch (error) {
    assistant.purchaseCandidates = [];
    assistant.stage = "purchase-list";
    showApiErrorToast(error, "Could not check earlier purchase bills.");
  }
  renderRecoveryAssistant();
}

function recoveryLotForItem(bill = {}, stockItemName = "") {
  const wanted = normalizeItemText(stockItemName);
  if (!wanted) return null;
  return (bill.lotData || []).find((lot) => {
    const candidates = [
      resolveTallyItemForLot(lot),
      portalItemName(lot),
      lot.varietyName,
      lot.cropName
    ].filter(Boolean).map(normalizeItemText);
    return candidates.includes(wanted);
  }) || null;
}

function historicalSalesStockItemNames(purchase = {}) {
  const lot = purchase.lot || {};
  return [...new Set([
    purchase.stockItemName,
    resolveTallyItemForLot(lot),
    portalItemName(lot),
    lot.varietyName,
    lot.cropName
  ].map((name) => String(name || "").trim()).filter(Boolean))];
}

function historicalPurchaseUpdateMetadata(candidate = {}, bill = {}, order = {}) {
  const lot = candidate.lot || recoveryLotForItem(bill, candidate.stockItemName) || {};
  const licenceType = scopeLicenceType(activeLicenceScope());
  return {
    orderVoucherNumber: order?.voucherNumber || bill?.billNumber || bill?.voucherNumber || "",
    purchaseVoucherNumber: candidate.voucherNumber || "",
    purchaseMasterId: candidate.masterId || "",
    purchaseAlterId: candidate.alterId || "",
    purchaseDate: candidate.date || "",
    purchasePartyLedgerName: candidate.partyLedgerName || "",
    stockItemName: candidate.stockItemName || resolveTallyItemForLot(lot) || "",
    stockItemNames: historicalSalesStockItemNames({ ...candidate, lot }),
    oldBatchName: candidate.batchName || "",
    newBatchName: lot.lotNum || candidate.newBatchName || "",
    originalOwner: bill?.sellerCode || candidate.originalOwner || "",
    packingSize: lot.packingSize || candidate.packingSize || "",
    quantity: Math.abs(Number(candidate.quantity || 0)),
    activeLicenceCode: scopeLicenceCode(activeLicenceScope()),
    licenceType,
    sathiIsCotton: licenceType === "cotton",
    salesVoucherTypeNames: scopeSalesVoucherTypeNames(activeLicenceScope())
  };
}

function applyHistoricalPurchaseMetadataToOrder(voucherNumber, metadata = {}) {
  const wanted = String(voucherNumber || "");
  state.orders = state.orders.map((order) => {
    if (String(order.voucherNumber || "") !== wanted) return order;
    return {
      ...order,
      queueStatus: metadata.queueStatus || "existing-purchase-updated-no-sales",
      historicalPurchaseUpdate: {
        ...(order.historicalPurchaseUpdate || {}),
        ...metadata,
        status: metadata.status || "existing-purchase-updated-no-sales",
        updatedAt: new Date().toISOString()
      }
    };
  });
}

async function updateHistoricalPurchaseCandidate(index) {
  const assistant = state.recoveryAssistant;
  const candidate = assistant.purchaseCandidates[index];
  if (!candidate || candidate.updated || !candidate.lot) return;
  const result = await api("/api/tally/batch-correction/update", {
    method: "POST",
    body: {
      companyName: selectedCompanyName(),
      bill: assistant.bill,
      itemMappings: buildBillItemMappings(assistant.bill || {}),
      change: {
        mode: "purchase",
        masterId: candidate.masterId,
        expectedAlterId: candidate.alterId,
        voucherNumber: candidate.voucherNumber,
        stockItemName: candidate.stockItemName,
        oldBatchName: candidate.batchName,
        newBatchName: candidate.lot.lotNum,
        originalOwner: assistant.bill?.sellerCode || "",
        packingSize: candidate.lot.packingSize || "",
        ...activeBatchLicenceValues(),
        sathiStatus: "Imported to Tally",
        sathiVchNo: assistant.bill?.billNumber || assistant.bill?.voucherNumber || ""
      }
    }
  });
  candidate.updated = Boolean(result.updated && result.verified !== false);
  if (candidate.updated) {
    assistant.updatedPurchases.push({ ...candidate });
    const voucherNumber = assistant.order?.voucherNumber || assistant.bill?.billNumber || "";
    if (voucherNumber) {
      const metadata = historicalPurchaseUpdateMetadata(candidate, assistant.bill, assistant.order);
      await markStoredSathiOrderStatus(voucherNumber, "existing-purchase-updated-no-sales", metadata).catch(() => { });
      applyHistoricalPurchaseMetadataToOrder(voucherNumber, { ...metadata, status: "existing-purchase-updated-no-sales", queueStatus: "existing-purchase-updated-no-sales" });
      state.tallyStatuses[voucherNumber] = "Existing purchase updated but no sales found/updated";
      state.tallyResults[voucherNumber] = {
        action: "historical-purchase-update",
        status: "updated",
        message: `Existing purchase ${candidate.voucherNumber} updated with SATHI lot ${candidate.lot.lotNum}.`,
        log: result.log
      };
      renderOrders();
    }
  }
  showToast(result.message || (candidate.updated ? "Purchase batch updated." : "Purchase batch update not confirmed."));
  if (candidate.updated) {
    renderRecoveryAssistant();
    await loadHistoricalSalesCandidates({ auto: true });
    return;
  }
  renderRecoveryAssistant();
}

async function updateBulkHistoricalPurchaseCandidate(index) {
  const assistant = state.recoveryAssistant;
  const candidate = assistant.bulkCandidates?.[index];
  if (!candidate || candidate.updated || !candidate.lot || !candidate.bill) return;
  const result = await api("/api/tally/batch-correction/update", {
    method: "POST",
    body: {
      companyName: selectedCompanyName(),
      bill: candidate.bill,
      itemMappings: buildBillItemMappings(candidate.bill || {}),
      change: {
        mode: "purchase",
        masterId: candidate.masterId,
        expectedAlterId: candidate.alterId,
        voucherNumber: candidate.voucherNumber,
        stockItemName: candidate.stockItemName,
        oldBatchName: candidate.batchName,
        newBatchName: candidate.lot.lotNum,
        originalOwner: candidate.bill?.sellerCode || "",
        packingSize: candidate.lot.packingSize || "",
        ...activeBatchLicenceValues(),
        sathiStatus: "Imported to Tally",
        sathiVchNo: candidate.bill?.billNumber || candidate.bill?.voucherNumber || ""
      }
    }
  });
  candidate.updated = Boolean(result.updated && result.verified !== false);
  if (candidate.updated) {
    assistant.updatedPurchases.push({ ...candidate });
    const voucherNumber = candidate.order?.voucherNumber || candidate.bill?.billNumber || "";
    if (voucherNumber) {
      const metadata = historicalPurchaseUpdateMetadata(candidate, candidate.bill, candidate.order);
      await markStoredSathiOrderStatus(voucherNumber, "existing-purchase-updated-no-sales", metadata).catch(() => { });
      applyHistoricalPurchaseMetadataToOrder(voucherNumber, { ...metadata, status: "existing-purchase-updated-no-sales", queueStatus: "existing-purchase-updated-no-sales" });
      state.tallyStatuses[voucherNumber] = "Existing purchase updated but no sales found/updated";
      state.tallyResults[voucherNumber] = {
        action: "historical-purchase-update",
        status: "updated",
        message: `Existing purchase ${candidate.voucherNumber} updated with SATHI lot ${candidate.lot.lotNum}.`,
        log: result.log
      };
      renderOrders();
    }
  }
  showToast(result.message || (candidate.updated ? "Purchase batch updated." : "Purchase batch update not confirmed."));
  renderRecoveryAssistant();
}

async function createRemainingBulkPurchases() {
  const assistant = state.recoveryAssistant || {};
  const updatedOrders = new Set((assistant.updatedPurchases || []).map((row) => row.order?.voucherNumber).filter(Boolean));
  closeRecoveryAssistant();
  for (const order of assistant.bulkOrders || pendingOrdersForTallyPush()) {
    if (updatedOrders.has(order.voucherNumber)) continue;
    const status = state.tallyStatuses[order.voucherNumber] || "Pending for Tally";
    if (["Found in Tally", "Verified in Tally", "Partial in Tally", "Pushed to Tally", "Existing purchase updated", "Existing purchase updated but no sales found/updated"].includes(status)) continue;
    await pushOrderToTally(order, { skipHistoricalCheck: true });
  }
}

async function loadHistoricalSalesCandidates(options = {}) {
  const assistant = state.recoveryAssistant;
  const scope = activeLicenceScope() || {};
  assistant.stage = "sales-loading";
  renderRecoveryAssistant();
  try {
    const groups = await Promise.all(assistant.updatedPurchases.map((purchase) => api("/api/tally/batch-correction/candidates", {
      method: "POST",
      body: {
        companyName: selectedCompanyName(),
        mode: "sales",
        voucherTypeNames: scopeSalesVoucherTypeNames(scope),
        stockItemNames: historicalSalesStockItemNames(purchase),
        oldBatchName: purchase.batchName,
        targetBatchName: purchase.lot?.lotNum || ""
      }
    }).then((result) => (result.rows || []).map((row) => ({
      ...row,
      sourcePurchase: purchase,
      existingTargetSalesQty: historicalQuantityMapValue(result.existingTargetQuantityByItem, row.stockItemName)
    })))));
    const seen = new Set();
    assistant.salesCandidates = groups.flat().filter((row) => {
      const key = `${row.masterId}::${row.stockItemName}::${row.batchName}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).map((row) => ({ ...row, selected: true }));
    if (options.auto && !assistant.salesCandidates.length) {
      assistant.autoNoSales = true;
      assistant.stage = "done";
    } else {
      assistant.autoNoSales = false;
      assistant.stage = "sales-list";
    }
  } catch (error) {
    assistant.salesCandidates = [];
    assistant.stage = options.auto ? "done" : "sales-list";
    assistant.autoNoSales = Boolean(options.auto);
    showApiErrorToast(error, "Could not check sales made with the old batch.");
  }
  renderRecoveryAssistant();
}

async function updateHistoricalSalesCandidate(index, options = {}) {
  const assistant = state.recoveryAssistant;
  const candidate = assistant.salesCandidates[index];
  const purchase = candidate?.sourcePurchase;
  if (!candidate || candidate.updated || !purchase?.lot) return;
  const control = historicalSalesInventoryControlForCandidate(candidate);
  if (control?.over && !options.inventoryWarningAcknowledged) {
    const accepted = window.confirm(historicalSalesInventoryWarningText(control));
    if (!accepted) return false;
  }
  const result = await api("/api/tally/batch-correction/update", {
    method: "POST",
    body: {
      companyName: selectedCompanyName(),
      change: {
        mode: "sales",
        masterId: candidate.masterId,
        expectedAlterId: candidate.alterId,
        voucherNumber: candidate.voucherNumber,
        stockItemName: candidate.stockItemName,
        oldBatchName: candidate.batchName,
        newBatchName: purchase.lot.lotNum,
        originalOwner: assistant.bill?.sellerCode || "",
        packingSize: purchase.lot.packingSize || "",
        sathiIsCotton: scopeLicenceType(activeLicenceScope()) === "cotton",
        sathiCompanyLicenceNo: scopeLicenceCode(activeLicenceScope()),
        ...salesBuyerUdfValuesForCandidate(candidate)
      }
    }
  });
  candidate.updated = salesBatchUpdateAccepted(result);
  candidate.updateStatus = candidate.updated ? "updated" : "failed";
  candidate.updateMessage = result.message || "";
  await persistHistoricalAssistantSalesAttempt(candidate, purchase, result).catch(() => { });
  if (candidate.updated) assistant.updatedSales.push({ ...candidate });
  if (!options.silent) {
    showToast(result.message || (candidate.updated ? "Sales batch updated." : "Sales batch update not confirmed."));
    renderRecoveryAssistant();
  }
  return candidate.updated;
}

function salesBatchUpdateAccepted(result = {}) {
  return Boolean(result.updated || result.verified || result.weakVerification || result.verification?.targetBatchFound);
}

async function persistHistoricalAssistantSalesAttempt(candidate = {}, purchase = {}, result = {}) {
  const assistant = state.recoveryAssistant || {};
  const voucherNumber = assistant.order?.voucherNumber || assistant.bill?.billNumber || assistant.bill?.voucherNumber || "";
  if (!voucherNumber) return null;
  const existingMeta = historicalPurchaseUpdateForOrder(salesRecoveryOrderByVoucher(voucherNumber));
  const meta = existingMeta?.oldBatchName
    ? existingMeta
    : historicalPurchaseUpdateMetadata(purchase, assistant.bill, assistant.order);
  if (!meta?.oldBatchName && !purchase?.batchName) return null;
  const accepted = salesBatchUpdateAccepted(result);
  const nextAttempt = {
    status: accepted ? "updated" : "failed",
    verified: accepted,
    weakVerification: Boolean(result.weakVerification),
    salesVoucherNumber: candidate.voucherNumber || "",
    salesMasterId: candidate.masterId || "",
    salesAlterId: result.verification?.alterId || candidate.alterId || "",
    salesDate: candidate.date || "",
    salesPartyLedgerName: candidate.partyLedgerName || "",
    salesVoucherTypeName: candidate.voucherTypeName || "",
    stockItemName: candidate.stockItemName || "",
    oldBatchName: candidate.batchName || purchase.batchName || meta.oldBatchName || "",
    newBatchName: purchase.lot?.lotNum || meta.newBatchName || "",
    quantity: Math.abs(Number(candidate.quantity || 0)),
    quantityText: candidate.quantityText || "",
    message: result.message || "",
    updatedAt: new Date().toISOString()
  };
  nextAttempt.key = salesRecoveryAttemptKey(nextAttempt);
  const existing = salesRecoveryPersistedUpdates(meta).filter((row) => salesRecoveryAttemptKey(row) !== nextAttempt.key);
  return persistSalesRecoveryMetadata(voucherNumber, {
    salesUpdates: [...existing, nextAttempt],
    lastSalesCheckAt: new Date().toISOString(),
    lastSalesCandidateCount: Math.max(Number(meta.lastSalesCandidateCount || 0), arrayOf(assistant.salesCandidates).length),
    lastSalesUpdateAt: nextAttempt.updatedAt
  });
}

async function updateSelectedHistoricalSalesCandidates() {
  const assistant = state.recoveryAssistant;
  const selectedIndexes = (assistant.salesCandidates || [])
    .map((candidate, index) => ({ candidate, index }))
    .filter(({ candidate }) => candidate.selected && !candidate.updated)
    .map(({ index }) => index);
  if (!selectedIndexes.length) {
    showToast("Select at least one sales voucher to update.");
    return;
  }
  const warnings = historicalSalesInventoryControls().filter((control) => control.over);
  if (warnings.length && !window.confirm(warnings.map(historicalSalesInventoryWarningText).join("\n\n"))) return;
  let updatedCount = 0;
  for (const index of selectedIndexes) {
    try {
      if (await updateHistoricalSalesCandidate(index, { silent: true, inventoryWarningAcknowledged: true })) updatedCount += 1;
    } catch (error) {
      showApiErrorToast(error, "Sales batch update failed.");
    }
  }
  if (updatedCount) {
    const voucherNumber = assistant.order?.voucherNumber || assistant.bill?.billNumber || assistant.bill?.voucherNumber || "";
    const meta = historicalPurchaseUpdateForOrder(salesRecoveryOrderByVoucher(voucherNumber)) || {};
    if (voucherNumber) {
      const nextMeta = {
        ...meta,
        lastSalesUpdateAt: new Date().toISOString()
      };
      applyHistoricalPurchaseMetadataToOrder(voucherNumber, { ...nextMeta, status: "historical-updated", queueStatus: "historical-updated" });
      state.tallyStatuses[voucherNumber] = "Existing purchase updated";
      await markStoredSathiOrderStatus(voucherNumber, "historical-updated", nextMeta).catch(() => { });
    }
  }
  renderRecoveryAssistant();
  showToast(`${updatedCount} sales voucher(s) updated.`);
}

async function refreshSalesRecovery() {
  await loadStoredSathiQueue({ silent: true }).catch(() => { });
  renderSalesRecovery();
  showToast("Sales update orders refreshed.");
}

function recoveredSalesOrders() {
  return state.orders
    .filter(belongsToActiveLicence)
    .filter((order) => historicalPurchaseQueueStatus(order))
    .filter((order) => historicalPurchaseUpdateForOrder(order)?.oldBatchName && historicalPurchaseUpdateForOrder(order)?.newBatchName);
}

function historicalPurchaseUpdateForOrder(order = {}) {
  return order.historicalPurchaseUpdate || order.historical_purchase_update || {};
}

function renderSalesRecovery() {
  const body = document.getElementById("salesRecoveryBody");
  if (!body) return;
  const orders = recoveredSalesOrders();
  const activeOrders = orders.filter((order) => !salesRecoveryOrderCompleted(order));
  const completedOrders = orders.filter(salesRecoveryOrderCompleted);
  const view = state.salesRecovery.view === "completed" ? "completed" : "active";
  const tabOrders = view === "completed" ? completedOrders : activeOrders;
  const visibleOrders = tabOrders.filter(salesRecoveryOrderMatchesFilters);
  setText("salesRecoveryScopeText", `${scopeLicenceType(activeLicenceScope()).toUpperCase()} | ${scopeLicenceCode(activeLicenceScope()) || "-"}`);
  setText("salesRecoveryCount", String(visibleOrders.length));
  setText("salesRecoveryActiveCount", String(activeOrders.length));
  setText("salesRecoveryCompletedCount", String(completedOrders.length));
  document.querySelectorAll("[data-sales-recovery-view]").forEach((button) => {
    button.classList.toggle("active", button.dataset.salesRecoveryView === view);
  });
  renderSalesRecoverySummary(orders);
  if (!visibleOrders.length) {
    const emptyText = tabOrders.length
      ? "No sales update orders match the selected filters."
      : view === "completed"
        ? "No completed sales updates yet."
        : "No pending sales update orders. Completed orders are in the Completed tab.";
    body.innerHTML = `<tr><td colspan="6" class="empty-cell">${escapeHtml(emptyText)}</td></tr>`;
    return;
  }

  body.innerHTML = visibleOrders.map((order) => salesRecoveryOrderRows(order)).join("");
}

function salesRecoveryOrderCompleted(order = {}) {
  const meta = historicalPurchaseUpdateForOrder(order);
  const voucher = order.voucherNumber || meta.orderVoucherNumber || "";
  const candidates = state.salesRecovery.candidatesByVoucher[voucher] || [];
  const persisted = salesRecoveryPersistedUpdates(meta);
  const failedCount = persisted.filter((row) => row.status === "failed").length;
  const targetQty = Math.abs(Number(meta.lastTargetSalesQty || 0));
  const updatedCount = Math.max(candidates.filter((row) => row.updated).length, persisted.filter((row) => row.status === "updated" || row.verified).length, targetQty > 0 ? 1 : 0);
  const pendingCount = candidates.filter((row) => !row.updated).length;
  return updatedCount > 0 && pendingCount === 0 && failedCount === 0;
}

function salesRecoveryOrderMatchesFilters(order = {}) {
  const meta = historicalPurchaseUpdateForOrder(order);
  const voucher = order.voucherNumber || meta.orderVoucherNumber || "";
  const candidates = state.salesRecovery.candidatesByVoucher[voucher] || [];
  const persisted = salesRecoveryPersistedUpdates(meta);
  const progress = salesRecoveryQuantityProgress(meta, candidates, persisted);
  const filters = state.salesRecovery.filters || {};
  if (!matchesSearchText(salesRecoverySearchText(order, meta, candidates, persisted), filters.search)) return false;
  if (!salesRecoveryMatchesStatusFilter(meta, candidates, persisted, filters.status)) return false;
  if (!salesRecoveryMatchesQtyFilter(progress, filters.qty)) return false;
  return true;
}

function salesRecoverySearchText(order = {}, meta = {}, candidates = [], persisted = []) {
  return [
    order.voucherNumber,
    order.voucherDate,
    order.sellerName,
    order.sellerCode,
    order.totalBillPrice,
    meta.orderVoucherNumber,
    meta.purchaseVoucherNumber,
    meta.purchasePartyLedgerName,
    meta.stockItemName,
    meta.oldBatchName,
    meta.newBatchName,
    meta.originalOwner,
    meta.packingSize,
    meta.activeLicenceCode,
    meta.licenceType,
    ...arrayOf(meta.stockItemNames),
    ...candidates.flatMap((row) => [
      row.voucherNumber,
      row.partyLedgerName,
      row.stockItemName,
      row.batchName,
      row.quantityText,
      row.rate,
      row.amount,
      row.updateStatus
    ]),
    ...persisted.flatMap((row) => [
      row.salesVoucherNumber,
      row.salesPartyLedgerName,
      row.stockItemName,
      row.oldBatchName,
      row.newBatchName,
      row.quantityText,
      row.status,
      row.message
    ])
  ].filter(Boolean).join(" ");
}

function salesRecoveryMatchesStatusFilter(meta = {}, candidates = [], persisted = [], filter = "all") {
  if (!filter || filter === "all") return true;
  const updated = Number(meta.lastTargetSalesQty || 0) > 0 || persisted.some((row) => row.status === "updated" || row.verified) || candidates.some((row) => row.updated);
  const failed = persisted.some((row) => row.status === "failed");
  const pending = candidates.some((row) => !row.updated);
  const checked = Boolean(meta.lastSalesCheckAt);
  if (filter === "pending") return pending;
  if (filter === "updated") return updated;
  if (filter === "retry") return failed;
  if (filter === "unchecked") return !checked && !updated && !failed && !pending;
  return true;
}

function salesRecoveryMatchesQtyFilter(progress = {}, filter = "all") {
  if (!filter || filter === "all") return true;
  if (filter === "pending") return Number(progress.pending || 0) > 0;
  if (filter === "complete") return Number(progress.total || 0) > 0 && Number(progress.pending || 0) <= 0 && Number(progress.excess || 0) <= 0;
  if (filter === "excess") return Number(progress.excess || 0) > 0;
  return true;
}

function clearSalesRecoveryFilters() {
  state.salesRecovery.filters = { search: "", status: "all", qty: "all" };
  const search = document.getElementById("salesRecoverySearchInput");
  const status = document.getElementById("salesRecoveryStatusFilter");
  const qty = document.getElementById("salesRecoveryQtyFilter");
  if (search) search.value = "";
  if (status) status.value = "all";
  if (qty) qty.value = "all";
  renderSalesRecovery();
}

function salesRecoveryOrderRows(order = {}) {
  const meta = historicalPurchaseUpdateForOrder(order);
  const voucher = order.voucherNumber || meta.orderVoucherNumber || "";
  const candidates = state.salesRecovery.candidatesByVoucher[voucher] || [];
  const loading = state.salesRecovery.loadingVoucher === voucher;
  const persisted = salesRecoveryPersistedUpdates(meta);
  const pendingCount = candidates.filter((row) => !row.updated).length;
  const updatedCount = Math.max(candidates.filter((row) => row.updated).length, persisted.filter((row) => row.status === "updated" || row.verified).length, Number(meta.lastTargetSalesQty || 0) > 0 ? 1 : 0);
  const failedCount = persisted.filter((row) => row.status === "failed").length;
  const status = salesRecoveryStatusText({ candidates, pendingCount, updatedCount, failedCount, meta });
  const progress = salesRecoveryQuantityProgress(meta, candidates, persisted);
  const isExpanded = state.salesRecovery.expandedVoucher === voucher;
  const hasDetails = Boolean(candidates.length || persisted.length || meta.oldBatchName);
  const detailRow = isExpanded && hasDetails
    ? `<tr class="order-detail-row sales-recovery-expanded"><td colspan="6">${salesRecoveryOrderRecoHtml(meta, candidates, persisted)}${salesRecoveryCandidateTable(voucher, candidates, persisted)}</td></tr>`
    : "";
  return `
    <tr class="${isExpanded ? "sales-recovery-open" : ""}">
      <td><strong>${escapeHtml(voucher || "-")}</strong><small>${escapeHtml(order.voucherDate || meta.purchaseDate || "")}</small></td>
      <td><strong>${escapeHtml(meta.purchaseVoucherNumber || "-")}</strong><small>${escapeHtml(meta.purchasePartyLedgerName || "")}</small></td>
      <td><strong>${escapeHtml(meta.stockItemName || "-")}</strong><small>Old: ${escapeHtml(meta.oldBatchName || "-")} → SATHI: ${escapeHtml(meta.newBatchName || "-")}</small></td>
      <td><strong>${escapeHtml(String(meta.licenceType || scopeLicenceType(activeLicenceScope())).toUpperCase())}</strong><small>${escapeHtml(meta.activeLicenceCode || scopeLicenceCode(activeLicenceScope()) || "-")}</small></td>
      <td>
        <span class="${salesRecoveryStatusClass({ pendingCount, updatedCount, failedCount, candidates, meta })}">${escapeHtml(status)}</span>
        ${salesRecoveryQuantityProgressHtml(progress)}
        <small>${escapeHtml(salesRecoveryLastActionText(meta))}</small>
      </td>
      <td>
        <button class="mini-button" data-sales-recovery-action="toggle-details" data-voucher-number="${escapeHtml(voucher)}" type="button" ${hasDetails ? "" : "disabled"}>${isExpanded ? "Hide Details" : "Details"}</button>
        <button class="mini-button" data-sales-recovery-action="find" data-voucher-number="${escapeHtml(voucher)}" type="button" ${loading ? "disabled" : ""}>${loading ? "Checking..." : "Find Sales"}</button>
        <button class="mini-button" data-sales-recovery-action="update-all" data-voucher-number="${escapeHtml(voucher)}" type="button" ${pendingCount ? "" : "disabled"}>Update Pending</button>
      </td>
    </tr>
    ${detailRow}`;
}

function salesRecoveryOrderRecoHtml(meta = {}, candidates = [], persisted = []) {
  const targetVerified = Number(meta.lastTargetSalesQty || 0) > 0;
  const updated = Math.max(persisted.filter((row) => row.status === "updated" || row.verified).length, targetVerified ? 1 : 0);
  const failed = persisted.filter((row) => row.status === "failed").length;
  const pending = candidates.filter((row) => !row.updated).length;
  const checked = Boolean(meta.lastSalesCheckAt);
  const level = updated ? "strong" : failed ? "weak" : "possible";
  const label = updated
    ? "Purchase and sales correction verified"
    : failed
      ? "Sales update retry needed"
      : pending
      ? "Sales entries found, update pending"
      : checked
        ? "Purchase updated but no old-batch sales found"
        : "Purchase updated, sales search pending";
  const nextAction = updated
    ? (targetVerified && !persisted.length ? `Target batch already has sales qty ${formatBags(meta.lastTargetSalesQty)}.` : "Ready for reconciliation.")
    : failed
      ? "Retry the failed sales row after checking Tally read-back."
      : pending
      ? "Use Update Pending or update rows one by one."
      : checked
        ? "If sales exist, check voucher type/date/item manually."
        : "Click Find Sales.";
  return `
    <section class="historical-reco-panel sales-reco-detail">
      <div>
        <span class="recovery-kicker">Reco report</span>
        <strong>${escapeHtml(label)}</strong>
        <small>${escapeHtml(nextAction)}</small>
      </div>
      <div class="historical-reco-counts">
        <span class="status-pill status-ok">Purchase updated</span>
        <span class="status-pill ${updated ? "status-ok" : pending ? "status-warn" : ""}">${updated} Sales updated</span>
        <span class="status-pill ${pending ? "status-warn" : ""}">${pending} Pending</span>
        ${failed ? `<span class="status-pill status-danger">${failed} Retry</span>` : ""}
      </div>
      <div class="historical-reco-card historical-reco-${escapeHtml(level)}">
        <strong>${escapeHtml(meta.purchaseVoucherNumber || "-")}</strong>
        <span>${escapeHtml(meta.stockItemName || "-")} | ${escapeHtml(meta.oldBatchName || "-")} → ${escapeHtml(meta.newBatchName || "-")}</span>
        <div class="historical-reco-chips">
          <small>Licence: ${escapeHtml(meta.activeLicenceCode || "-")}</small>
          <small>Type: ${escapeHtml(String(meta.licenceType || "-").toUpperCase())}</small>
          <small>Owner: ${escapeHtml(meta.originalOwner || "-")}</small>
          <small>Packing: ${escapeHtml(meta.packingSize || "-")}</small>
        </div>
      </div>
    </section>`;
}

function salesRecoveryCandidateTable(voucherNumber, candidates = [], persisted = []) {
  const persistedHtml = persisted.length ? `
    <div class="sales-recovery-subhead">Saved update history</div>
    ${persisted.map((row) => `
      <article class="recovery-row">
        <div><strong>${escapeHtml(row.salesVoucherNumber || "-")}</strong><small>${escapeHtml(formatTallyDate(row.salesDate) || row.salesDate || "-")}</small></div>
        <div><strong>${escapeHtml(row.salesPartyLedgerName || "-")}</strong><small>${escapeHtml(row.salesVoucherTypeName || "-")}</small></div>
        <div><strong>${escapeHtml(row.stockItemName || "-")}</strong><small>${escapeHtml(row.oldBatchName || "-")} → ${escapeHtml(row.newBatchName || "-")}</small></div>
        <div><strong>${escapeHtml(row.quantityText || String(row.quantity || ""))}</strong><small>${escapeHtml(row.message || "")}</small></div>
        <div><strong>${escapeHtml(row.status === "updated" ? "Verified updated" : "Needs retry")}</strong><small>${escapeHtml(formatDateTime(row.updatedAt) || "")}</small></div>
      </article>`).join("")}` : "";
  return `
    <div class="recovery-list">
      ${persistedHtml}
      ${candidates.length ? '<div class="sales-recovery-subhead">Pending old-batch sales found now</div>' : ""}
      ${candidates.map((row, index) => `
        <article class="recovery-row">
          <div><strong>${escapeHtml(row.voucherNumber || "-")}</strong><small>${escapeHtml(formatTallyDate(row.date) || row.date || "-")}</small></div>
          <div><strong>${escapeHtml(row.partyLedgerName || "-")}</strong><small>${escapeHtml(row.voucherTypeName || "-")}</small></div>
          <div><strong>${escapeHtml(row.stockItemName || "-")}</strong><small>Old batch: ${escapeHtml(row.batchName || "-")}</small></div>
          <div><strong>${escapeHtml(row.quantityText || "-")}</strong><small>Rate ${escapeHtml(row.rate || "-")} | Amount ${escapeHtml(row.amount || "-")}</small></div>
          <div><strong>${escapeHtml(row.updated ? "Verified updated" : (row.updateStatus || "Pending"))}</strong><small>${escapeHtml(row.updateMessage || "")}</small></div>
          <button class="${row.updated ? "secondary-button" : "primary-button"}" data-sales-recovery-action="update-one" data-voucher-number="${escapeHtml(voucherNumber)}" data-candidate-index="${index}" type="button" ${row.updated ? "disabled" : ""}>${row.updated ? "Updated" : "Update"}</button>
        </article>`).join("")}
    </div>`;
}

function renderSalesRecoverySummary(orders = []) {
  let pending = 0;
  let updated = 0;
  let review = 0;
  for (const order of orders) {
    const meta = historicalPurchaseUpdateForOrder(order);
    const voucher = order.voucherNumber || meta.orderVoucherNumber || "";
    const candidates = state.salesRecovery.candidatesByVoucher[voucher] || [];
    const persisted = salesRecoveryPersistedUpdates(meta);
    pending += candidates.filter((row) => !row.updated).length;
    updated += Math.max(candidates.filter((row) => row.updated).length, persisted.filter((row) => row.status === "updated" || row.verified).length, Number(meta.lastTargetSalesQty || 0) > 0 ? 1 : 0);
    review += persisted.filter((row) => row.status === "failed").length;
    if (!candidates.length && !persisted.length && meta.lastSalesCheckAt && Number(meta.lastTargetSalesQty || 0) <= 0) review += 1;
  }
  setText("salesRecoveryPurchaseUpdatedCount", String(orders.length));
  setText("salesRecoveryPendingCount", String(pending));
  setText("salesRecoveryUpdatedCount", String(updated));
  setText("salesRecoveryReviewCount", String(review));
}

function salesRecoveryPersistedUpdates(meta = {}) {
  return arrayOf(meta.salesUpdates);
}

function salesRecoveryStatusText({ candidates = [], pendingCount = 0, updatedCount = 0, failedCount = 0, meta = {} } = {}) {
  if (pendingCount) return `${updatedCount} updated / ${pendingCount} pending`;
  if (updatedCount) return `${updatedCount} verified updated`;
  if (Number(meta.lastTargetSalesQty || 0) > 0) return "target batch verified";
  if (failedCount) return `${failedCount} need retry`;
  if (meta.lastSalesCheckAt) return "No pending old-batch sales found";
  if (candidates.length) return "Checked";
  return "Not checked";
}

function salesRecoveryStatusClass({ pendingCount = 0, updatedCount = 0, failedCount = 0, candidates = [], meta = {} } = {}) {
  if (failedCount) return "status-pill status-danger";
  if (pendingCount) return "status-pill status-warn";
  if (updatedCount || Number(meta.lastTargetSalesQty || 0) > 0) return "status-pill status-ok";
  if (candidates.length) return "status-pill";
  return "status-pill status-warn";
}

function salesRecoveryLastActionText(meta = {}) {
  if (meta.lastSalesUpdateAt) return `Last update: ${formatDateTime(meta.lastSalesUpdateAt)}`;
  if (meta.lastSalesCheckAt) return `Last check: ${formatDateTime(meta.lastSalesCheckAt)}`;
  return "Find Sales pending";
}

function salesRecoveryTargetUpdatedQuantity(meta = {}, quantityMap = {}) {
  const names = arrayOf(meta.stockItemNames).length ? meta.stockItemNames : [meta.stockItemName].filter(Boolean);
  return names.reduce((max, name) => Math.max(max, historicalQuantityMapValue(quantityMap, name)), 0);
}

function salesRecoveryQuantityProgress(meta = {}, candidates = [], persisted = []) {
  const updatedRows = persisted.filter((row) => row.status === "updated" || row.verified);
  const fallbackUpdatedRows = updatedRows.length ? [] : candidates.filter((row) => row.updated);
  const pendingRows = candidates.filter((row) => !row.updated);
  const knockedOff = Math.max(salesRecoveryRowsQuantity([...updatedRows, ...fallbackUpdatedRows]), Math.abs(Number(meta.lastTargetSalesQty || 0)));
  const candidatePending = salesRecoveryRowsQuantity(pendingRows);
  const knownTotal = firstPositiveNumber([
    meta.totalQuantity,
    meta.totalQty,
    meta.inwardQty,
    meta.purchaseQuantity,
    meta.quantity
  ]);
  const total = knownTotal || knockedOff + candidatePending;
  const pending = candidatePending || Math.max(total - knockedOff, 0);
  const excess = Math.max(knockedOff + candidatePending - total, 0);
  return {
    total,
    knockedOff,
    pending,
    excess,
    packingSize: Number(meta.packingSize || 0)
  };
}

function salesRecoveryRowsQuantity(rows = []) {
  return rows.reduce((sum, row) => sum + Math.abs(Number(row.quantity || 0)), 0);
}

function firstPositiveNumber(values = []) {
  for (const value of values) {
    const number = Math.abs(Number(value || 0));
    if (Number.isFinite(number) && number > 0) return number;
  }
  return 0;
}

function salesRecoveryQuantityProgressHtml(progress = {}) {
  const hasProgress = progress.total > 0 || progress.knockedOff > 0 || progress.pending > 0;
  if (!hasProgress) return "";
  return `
    <div class="sales-recovery-progress">
      <span>Total <b>${escapeHtml(salesRecoveryQuantityLabel(progress.total, progress.packingSize))}</b></span>
      <span>Knockoff <b>${escapeHtml(salesRecoveryQuantityLabel(progress.knockedOff, progress.packingSize))}</b></span>
      <span class="${progress.pending > 0 ? "warn" : "ok"}">Pending <b>${escapeHtml(salesRecoveryQuantityLabel(progress.pending, progress.packingSize))}</b></span>
      ${progress.excess > 0 ? `<span class="danger">Excess <b>${escapeHtml(salesRecoveryQuantityLabel(progress.excess, progress.packingSize))}</b></span>` : ""}
    </div>`;
}

function salesRecoveryQuantityLabel(quantity, packingSize = 0) {
  const bags = Math.abs(Number(quantity || 0));
  const pack = Number(packingSize || 0);
  const bagLabel = `${formatBags(bags)} Nos`;
  if (!Number.isFinite(pack) || pack <= 0 || bags <= 0) return bagLabel;
  return `${bagLabel} / ${formatBags(bags * pack)} Kg`;
}

function salesRecoveryFailedAttemptMatchesMeta(row = {}, meta = {}) {
  if (row.status !== "failed" && row.verified !== false) return false;
  const rowItem = normalizeItemText(row.stockItemName || "");
  const metaItems = (arrayOf(meta.stockItemNames).length ? meta.stockItemNames : [meta.stockItemName])
    .map(normalizeItemText)
    .filter(Boolean);
  const itemMatches = !rowItem || !metaItems.length || metaItems.includes(rowItem);
  const oldBatchMatches = !row.oldBatchName || !meta.oldBatchName || normalizeText(row.oldBatchName) === normalizeText(meta.oldBatchName);
  const newBatchMatches = !row.newBatchName || !meta.newBatchName || normalizeText(row.newBatchName) === normalizeText(meta.newBatchName);
  return itemMatches && oldBatchMatches && newBatchMatches;
}

function handleSalesRecoveryViewClick(event) {
  const button = event.target.closest("[data-sales-recovery-view]");
  if (!button) return;
  state.salesRecovery.view = button.dataset.salesRecoveryView === "completed" ? "completed" : "active";
  state.salesRecovery.expandedVoucher = "";
  renderSalesRecovery();
}

async function handleSalesRecoveryClick(event) {
  const button = event.target.closest("[data-sales-recovery-action]");
  if (!button) return;
  const action = button.dataset.salesRecoveryAction;
  const voucherNumber = button.dataset.voucherNumber || "";
  if (action === "toggle-details") {
    state.salesRecovery.expandedVoucher = state.salesRecovery.expandedVoucher === voucherNumber ? "" : voucherNumber;
    renderSalesRecovery();
    return;
  }
  if (action === "find") return findSalesRecoveryCandidates(voucherNumber);
  if (action === "update-one") return updateSalesRecoveryCandidate(voucherNumber, Number(button.dataset.candidateIndex));
  if (action === "update-all") return updateAllSalesRecoveryCandidates(voucherNumber);
}

function salesRecoveryOrderByVoucher(voucherNumber) {
  return recoveredSalesOrders().find((order) => String(order.voucherNumber || "") === String(voucherNumber || ""));
}

async function findSalesRecoveryCandidates(voucherNumber) {
  const order = salesRecoveryOrderByVoucher(voucherNumber);
  const meta = historicalPurchaseUpdateForOrder(order);
  if (!order || !meta?.oldBatchName || !meta?.newBatchName) {
    showToast("Historical purchase metadata is missing for this order.");
    return;
  }
  state.salesRecovery.loadingVoucher = voucherNumber;
  state.salesRecovery.expandedVoucher = voucherNumber;
  renderSalesRecovery();
  try {
    const result = await api("/api/tally/batch-correction/candidates", {
      method: "POST",
      body: {
        companyName: selectedCompanyName(),
        mode: "sales",
        voucherTypeNames: arrayOf(meta.salesVoucherTypeNames).length ? meta.salesVoucherTypeNames : scopeSalesVoucherTypeNames(activeLicenceScope()),
        stockItemNames: arrayOf(meta.stockItemNames).length ? meta.stockItemNames : [meta.stockItemName].filter(Boolean),
        oldBatchName: meta.oldBatchName,
        targetBatchName: meta.newBatchName
      }
    });
    const persisted = salesRecoveryPersistedUpdates(meta);
    const targetUpdatedQty = salesRecoveryTargetUpdatedQuantity(meta, result.existingTargetQuantityByItem);
    const normalizedPersisted = targetUpdatedQty > 0
      ? persisted.map((row) => salesRecoveryFailedAttemptMatchesMeta(row, meta)
        ? {
            ...row,
            status: "updated",
            verified: true,
            message: `Already corrected in Tally. Target batch ${meta.newBatchName || "-"} has sales qty ${formatBags(targetUpdatedQty)}.`,
            updatedAt: new Date().toISOString()
          }
        : row)
      : persisted;
    state.salesRecovery.candidatesByVoucher[voucherNumber] = arrayOf(result.rows).map((row) => {
      const attempt = normalizedPersisted.find((entry) => salesRecoveryAttemptKey(entry) === salesRecoveryAttemptKey(row));
      return {
        ...row,
        recoveryMeta: meta,
        updateStatus: attempt?.status === "failed" ? "Needs retry" : "",
        updateMessage: attempt?.message || "",
        existingTargetSalesQty: historicalQuantityMapValue(result.existingTargetQuantityByItem, row.stockItemName)
      };
    });
    await persistSalesRecoveryMetadata(voucherNumber, {
      lastSalesCheckAt: new Date().toISOString(),
      lastSalesCandidateCount: state.salesRecovery.candidatesByVoucher[voucherNumber].length,
      lastTargetSalesQty: targetUpdatedQty,
      salesUpdates: normalizedPersisted
    }).catch(() => { });
    if (!state.salesRecovery.candidatesByVoucher[voucherNumber].length) {
      showToast(targetUpdatedQty > 0 ? "Sales already found on corrected SATHI batch." : "No old-batch sales entries found for this order.");
    }
  } catch (error) {
    showApiErrorToast(error, "Could not find sales entries for this order.");
  } finally {
    state.salesRecovery.loadingVoucher = "";
    renderSalesRecovery();
  }
}

async function updateSalesRecoveryCandidate(voucherNumber, index, options = {}) {
  state.salesRecovery.expandedVoucher = voucherNumber;
  const rows = state.salesRecovery.candidatesByVoucher[voucherNumber] || [];
  const candidate = rows[index];
  const meta = candidate?.recoveryMeta || historicalPurchaseUpdateForOrder(salesRecoveryOrderByVoucher(voucherNumber));
  if (!candidate || candidate.updated || !meta?.newBatchName) return false;
  const result = await api("/api/tally/batch-correction/update", {
    method: "POST",
    body: {
      companyName: selectedCompanyName(),
      change: {
        mode: "sales",
        masterId: candidate.masterId,
        expectedAlterId: candidate.alterId,
        voucherNumber: candidate.voucherNumber,
        stockItemName: candidate.stockItemName,
        oldBatchName: candidate.batchName || meta.oldBatchName,
        newBatchName: meta.newBatchName,
        originalOwner: meta.originalOwner || "",
        packingSize: meta.packingSize || "",
        sathiIsCotton: Boolean(meta.sathiIsCotton),
        sathiCompanyLicenceNo: meta.activeLicenceCode || scopeLicenceCode(activeLicenceScope())
      }
    }
  });
  candidate.updated = salesBatchUpdateAccepted(result);
  candidate.updateStatus = candidate.updated ? "updated" : "failed";
  candidate.updateMessage = result.message || "";
  await persistSalesRecoveryAttempt(voucherNumber, candidate, result).catch(() => { });
  if (!options.silent) showToast(result.message || (candidate.updated ? "Sales entry updated." : "Sales entry update not verified."));
  renderSalesRecovery();
  return candidate.updated;
}

async function updateAllSalesRecoveryCandidates(voucherNumber) {
  state.salesRecovery.expandedVoucher = voucherNumber;
  const rows = state.salesRecovery.candidatesByVoucher[voucherNumber] || [];
  const pendingIndexes = rows.map((row, index) => ({ row, index })).filter(({ row }) => !row.updated).map(({ index }) => index);
  if (!pendingIndexes.length) {
    showToast("No pending sales candidates found.");
    return;
  }
  let updated = 0;
  for (const index of pendingIndexes) {
    try {
      if (await updateSalesRecoveryCandidate(voucherNumber, index, { silent: true })) updated += 1;
    } catch (error) {
      showApiErrorToast(error, "Sales update failed.");
    }
  }
  renderSalesRecovery();
  showToast(`${updated} sales entr${updated === 1 ? "y" : "ies"} updated and verified.`);
}

async function persistSalesRecoveryAttempt(voucherNumber, candidate = {}, result = {}) {
  const order = salesRecoveryOrderByVoucher(voucherNumber);
  const meta = historicalPurchaseUpdateForOrder(order);
  if (!order || !meta) return null;
  const key = salesRecoveryAttemptKey(candidate);
  const existing = salesRecoveryPersistedUpdates(meta).filter((row) => salesRecoveryAttemptKey(row) !== key);
  const nextAttempt = {
    key,
    status: salesBatchUpdateAccepted(result) ? "updated" : "failed",
    verified: salesBatchUpdateAccepted(result),
    weakVerification: Boolean(result.weakVerification),
    salesVoucherNumber: candidate.voucherNumber || "",
    salesMasterId: candidate.masterId || "",
    salesAlterId: result.verification?.alterId || candidate.alterId || "",
    salesDate: candidate.date || "",
    salesPartyLedgerName: candidate.partyLedgerName || "",
    salesVoucherTypeName: candidate.voucherTypeName || "",
    stockItemName: candidate.stockItemName || "",
    oldBatchName: candidate.batchName || meta.oldBatchName || "",
    newBatchName: meta.newBatchName || "",
    quantity: Math.abs(Number(candidate.quantity || 0)),
    quantityText: candidate.quantityText || "",
    message: result.message || "",
    updatedAt: new Date().toISOString()
  };
  return persistSalesRecoveryMetadata(voucherNumber, {
    salesUpdates: [...existing, nextAttempt],
    lastSalesUpdateAt: nextAttempt.updatedAt
  });
}

async function persistSalesRecoveryMetadata(voucherNumber, patch = {}) {
  const order = salesRecoveryOrderByVoucher(voucherNumber);
  const meta = historicalPurchaseUpdateForOrder(order);
  if (!order || !meta) return null;
  const nextMeta = {
    ...meta,
    ...patch
  };
  const hasVerifiedSalesUpdate = salesRecoveryPersistedUpdates(nextMeta).some((row) => row.status === "updated" || row.verified);
  const nextStatus = hasVerifiedSalesUpdate ? "historical-updated" : "existing-purchase-updated-no-sales";
  applyHistoricalPurchaseMetadataToOrder(voucherNumber, { ...nextMeta, status: nextStatus, queueStatus: nextStatus });
  state.tallyStatuses[voucherNumber] = tallyStatusFromQueue({ queueStatus: nextStatus });
  return markStoredSathiOrderStatus(voucherNumber, nextStatus, nextMeta);
}

function salesRecoveryAttemptKey(row = {}) {
  if (row.key) return String(row.key || "").trim().toUpperCase();
  return [
    row.key,
    row.salesMasterId || row.masterId,
    row.salesVoucherNumber || row.voucherNumber,
    row.stockItemName,
    row.oldBatchName || row.batchName
  ].map((value) => String(value || "").trim().toUpperCase()).filter(Boolean).join("::");
}

function historicalQuantityMapValue(map = {}, stockItemName = "") {
  const wanted = normalizeItemText(stockItemName);
  const entry = Object.entries(map || {}).find(([name]) => normalizeItemText(name) === wanted);
  return Math.abs(Number(entry?.[1] || 0));
}

function historicalSalesInventoryControls() {
  const assistant = state.recoveryAssistant || {};
  const groups = new Map();
  for (const candidate of assistant.salesCandidates || []) {
    const purchase = candidate.sourcePurchase || {};
    const key = [purchase.masterId, purchase.stockItemName, purchase.lot?.lotNum].map(normalizeText).join("::");
    if (!groups.has(key)) {
      groups.set(key, {
        key,
        itemName: purchase.stockItemName || candidate.stockItemName || "Item",
        batchName: purchase.lot?.lotNum || "",
        inwardQty: Math.abs(Number(purchase.quantity || 0)),
        alreadyAllocatedQty: Math.abs(Number(candidate.existingTargetSalesQty || 0)),
        currentSalesQty: 0
      });
    }
    const control = groups.get(key);
    control.alreadyAllocatedQty = Math.max(control.alreadyAllocatedQty, Math.abs(Number(candidate.existingTargetSalesQty || 0)));
    if (candidate.updated || (candidate.selected && !candidate.updated)) {
      control.currentSalesQty += Math.abs(Number(candidate.quantity || 0));
    }
  }
  return [...groups.values()].map((control) => {
    const totalSalesQty = control.alreadyAllocatedQty + control.currentSalesQty;
    return {
      ...control,
      totalSalesQty,
      excessQty: Math.max(0, totalSalesQty - control.inwardQty),
      over: control.inwardQty > 0 && totalSalesQty > control.inwardQty + 0.000001
    };
  });
}

function historicalSalesInventoryControlForCandidate(candidate = {}) {
  const purchase = candidate.sourcePurchase || {};
  const key = [purchase.masterId, purchase.stockItemName, purchase.lot?.lotNum].map(normalizeText).join("::");
  return historicalSalesInventoryControls().find((control) => control.key === key) || null;
}

function historicalSalesInventoryWarningText(control = {}) {
  return `CRITICAL INVENTORY WARNING\n${control.itemName} | Batch ${control.batchName || "-"}\nInward: ${control.inwardQty}\nAlready allocated: ${control.alreadyAllocatedQty}\nSelected sales: ${control.currentSalesQty}\nTotal sales: ${control.totalSalesQty}\nExcess: ${control.excessQty}\n\nSales quantity exceeds inward quantity. Continue only after checking inventory.`;
}

function historicalSalesInventoryWarningsHtml() {
  const warnings = historicalSalesInventoryControls().filter((control) => control.over);
  if (!warnings.length) return "";
  return `<div class="historical-inventory-warnings">${warnings.map((control) => `
    <section class="historical-inventory-warning">
      <strong>Critical Inventory Warning</strong>
      <span>${escapeHtml(control.itemName)} · Batch ${escapeHtml(control.batchName || "-")}</span>
      <div><b>Inward</b><em>${escapeHtml(control.inwardQty)}</em></div>
      <div><b>Already allocated</b><em>${escapeHtml(control.alreadyAllocatedQty)}</em></div>
      <div><b>Selected sales</b><em>${escapeHtml(control.currentSalesQty)}</em></div>
      <div><b>Total sales</b><em>${escapeHtml(control.totalSalesQty)}</em></div>
      <div class="excess"><b>Excess quantity</b><em>${escapeHtml(control.excessQty)}</em></div>
      <small>ABS(Total Sales Qty) is greater than ABS(Inward Qty). Verify inventory before updating.</small>
    </section>`).join("")}</div>`;
}

function salesBuyerUdfValuesForCandidate(candidate = {}) {
  const ledger = findLedgerByName(candidate.partyName);
  const cottonItem = scopeLicenceType(activeLicenceScope()) === "cotton";
  if (!ledger) {
    return {
      buyerType: "FARMER",
      buyerLicence: "",
      buyerCottonLicence: ""
    };
  }
  const seedLicence = ledgerLicenceOptions(ledger, "seed")[0]?.licNo || cleanBuyerLicenseValue(ledger.license);
  const cottonLicence = ledgerLicenceOptions(ledger, "cotton")[0]?.licNo || cleanBuyerLicenseValue(ledger.cottonLicense);
  const dealerLike = Boolean(ledger.hasGstin || seedLicence || cottonLicence);
  if (!dealerLike) {
    return {
      buyerType: "FARMER",
      buyerLicence: "",
      buyerCottonLicence: ""
    };
  }
  return {
    buyerType: "DEALER",
    buyerLicence: seedLicence,
    buyerCottonLicence: cottonItem ? cottonLicence : ""
  };
}

function ledgerLicenceOptions(ledger = {}, kind = "seed") {
  const source = kind === "cotton"
    ? (ledger.cottonLicences || ledger.cottonLicense || [])
    : (ledger.seedLicences || ledger.license || []);
  const values = Array.isArray(source) ? source : [source];
  const seen = new Set();
  return values.map((option) => {
    const licNo = cleanBuyerLicenseValue(typeof option === "string" ? option : option.licNo);
    if (!licNo) return null;
    const key = licNo.toUpperCase();
    if (seen.has(key)) return null;
    seen.add(key);
    return {
      licNo,
      site: cleanBuyerSiteValue(typeof option === "string" ? "" : option.site || "")
    };
  }).filter(Boolean);
}

function findStockItemByName(name) {
  const key = normalizeText(name);
  if (!key) return null;
  return (state.stockItems || []).find((item) => (
    normalizeText(item.name) === key ||
    (item.aliases || []).some((alias) => normalizeText(alias) === key)
  )) || null;
}

function isCottonStock(name, stockItem = {}) {
  const text = normalizeText([
    name,
    stockItem.name,
    stockItem.parent,
    stockItem.stockGroup,
    stockItem.category,
    stockItem.stockCategory
  ].filter(Boolean).join(" "));
  return /\b(ctn|cotton|cottn)\b/.test(text);
}

function tallyStatusClass(status) {
  if (status === "Found in Tally" || status === "Verified in Tally" || status === "Pushed to Tally" || status === "Existing purchase updated") return "status-pill status-ok";
  if (status === "Pushing..." || status === "Checking...") return "status-pill status-busy";
  if (status === "Partial in Tally" || status === "Existing purchase updated but no sales found/updated" || status === "Check failed" || status === "Push warning") return "status-pill status-warn";
  return "status-pill";
}

function formatTallyStatus(status) {
  const labels = {
    "Found in Tally": t("foundInTally", "Found in Tally"),
    "Verified in Tally": t("verifiedInTally", "Verified in Tally"),
    "Partial in Tally": "Partial in Tally",
    "Pushed to Tally": t("pushedToTally", "Pushed to Tally"),
    "Existing purchase updated": "Existing purchase updated",
    "Existing purchase updated but no sales found/updated": "Existing purchase updated but no sales found/updated",
    "Pending for Tally": t("pendingForTally", "Pending for Tally"),
    "Checking...": t("checking", "Checking..."),
    "Pushing...": t("pushing", "Pushing..."),
    "Check failed": t("checkFailed", "Check failed"),
    "Push warning": t("pushWarning", "Push warning")
  };
  return labels[status] || status;
}

function resolvePushStatus(result) {
  if (result.imported && result.verification?.exists) return "Verified in Tally";
  if (result.imported && result.verification?.partial) return "Partial in Tally";
  if (result.imported) return "Pushed to Tally";
  if (result.partialExists) return "Partial in Tally";
  return "Push warning";
}

function normalizeLotBills(raw) {
  const data = raw?.response?.data || raw?.data || [];
  return Array.isArray(data) ? data : [];
}

function activeMappingBills() {
  const activeBills = state.lotBills.filter(belongsToActiveLicence);
  const wanted = String(state.activeMappingVoucherNumber || state.expandedOrder || "").trim();
  if (!wanted) return activeBills;
  const scoped = activeBills.filter((bill) => bill.billNumber === wanted || bill.voucherNumber === wanted);
  return scoped.length ? scoped : activeBills;
}

function renderLotDetails() {
  const activeBills = activeMappingBills();
  const bill = activeBills[0] || {};
  const rows = activeBills.flatMap((billEntry) => (
    (billEntry.lotData || []).map((lot) => ({ bill: billEntry, lot }))
  ));

  document.getElementById("lotBillNumber").textContent = bill.billNumber || "-";
  document.getElementById("lotBillDate").textContent = bill.billDate ? `${t("billDate", "Bill date")} ${bill.billDate}` : t("noLotLoaded", "No lot response loaded");
  document.getElementById("lotSellerName").textContent = bill.sellerName || "-";
  document.getElementById("lotSellerCode").textContent = bill.sellerCode || "-";
  document.getElementById("lotBuyerName").textContent = bill.buyerName || "-";
  document.getElementById("lotBuyerCode").textContent = bill.buyerCode || "-";
  document.getElementById("lotBillTotal").textContent = bill.totalBillPrice || "0";
  document.getElementById("lotLocation").textContent = [bill.villageName, bill.blockName, bill.districtName, bill.stateName]
    .filter(Boolean)
    .join(", ") || "-";
  syncPortalCreateForm();
  renderPartyMappingReview(activeBills);
  renderItemMappingReview(rows.map((entry) => entry.lot));

  const body = document.getElementById("lotRowsBody");
  if (!rows.length) {
    body.innerHTML = `<tr><td colspan="11" class="empty-cell">${escapeHtml(t("noLotLoaded", "No lot details loaded yet."))}</td></tr>`;
    return;
  }

  body.innerHTML = rows.map(({ bill, lot }, index) => `
    <tr class="lot-main-row" data-lot-index="${index}">
      <td>${escapeHtml(lot.lotNum || "")}</td>
      <td>${escapeHtml(lot.cropName || "")}</td>
      <td>${escapeHtml(lot.varietyName || "")}</td>
      <td>${escapeHtml(lot.certificationClass || "")}</td>
      <td>${escapeHtml(formatPacking(lot))}</td>
      <td class="amount">${escapeHtml(lot.totalBags ?? "")}</td>
      <td class="amount">${escapeHtml(lot.totalQty ?? "")}</td>
      <td class="amount">${escapeHtml(lot.unitPrice || "0")}</td>
      <td>${escapeHtml(lot.expiryDate || "")}</td>
      <td class="amount">${escapeHtml(lotGstPercent(lot))}</td>
      <td>${escapeHtml(lot.tax?.hsnCode ?? "")}</td>
    </tr>
    <tr class="lot-detail-row hidden" id="lotDetail-${index}">
      <td colspan="11">
        <div class="lot-detail-panel">
          <div><span>${escapeHtml(t("billNumber", "Bill"))}</span><strong>${escapeHtml(bill.billNumber || "")}</strong></div>
          <div><span>Seller Type</span><strong>${escapeHtml(bill.sellerUserType || "")}</strong></div>
          <div><span>Crop Code</span><strong>${escapeHtml(lot.cropCode || "")}</strong></div>
          <div><span>Variety Code</span><strong>${escapeHtml(lot.varietyCode || "")}</strong></div>
          <div><span>Season</span><strong>${escapeHtml(lot.season || "")}</strong></div>
          <div><span>Year</span><strong>${escapeHtml(lot.year || "")}</strong></div>
          <div><span>CGST</span><strong>${escapeHtml(lot.tax?.cgst ?? 0)}</strong></div>
          <div><span>SGST</span><strong>${escapeHtml(lot.tax?.sgst ?? 0)}</strong></div>
          <div><span>IGST</span><strong>${escapeHtml(lot.tax?.igst ?? 0)}</strong></div>
          <div><span>Interstate</span><strong>${lot.interStateMovement ? "Yes" : "No"}</strong></div>
        </div>
      </td>
    </tr>
  `).join("");

  document.querySelectorAll(".lot-main-row").forEach((row) => {
    row.addEventListener("click", () => {
      document.getElementById(`lotDetail-${row.dataset.lotIndex}`).classList.toggle("hidden");
    });
  });
}

async function loadPortalSalesEntries(options = {}) {
  const form = document.getElementById("configForm");
  const companyName = selectedCompanyName();
  const scope = activeLicenceScope();
  const voucherTypeNames = scopeSalesVoucherTypeNames(scope);
  const voucherTypeName = voucherTypeNames[0] || (scope?.fallback ? form?.tallySalesVoucherTypeName?.value : "") || "Sales";
  const fromDate = document.getElementById("portalDateFrom")?.value || "";
  const toDate = document.getElementById("portalDateTo")?.value || "";
  updatePortalSourceStrip();
  if (options.force) state.portalSalesWarning = "";

  if (scope && !scope.fallback && !voucherTypeNames.length) {
    state.portalSalesEntries = [];
    renderPortalSalesEntries("No sales voucher type is mapped for selected licence.");
    if (!options.silent) showToast("No sales voucher type mapped for selected licence.");
    return;
  }

  try {
    const result = await api("/api/tally/portal-sales", {
      method: "POST",
      body: { companyName, voucherTypeName, voucherTypeNames, fromDate, toDate, scope: activeScopePayload() }
    });
    state.portalSalesEntries = result.vouchers || [];
    state.portalSalesWarning = "";
    state.activePortalSaleEntry = null;
    renderPortalSalesEntries();
    if (!options.silent) showToast(`${state.portalSalesEntries.length} sales entries fetched from Tally.`);
  } catch (error) {
    const message = error.message || "Could not fetch Tally sales entries.";
    if (state.portalSalesEntries.length) {
      state.portalSalesWarning = `${message} Showing last fetched entries. Click Fetch Sales Entries again after Tally is ready.`;
      renderPortalSalesEntries();
      if (!options.silent) showToast("Could not refresh Tally sales entries. Showing last fetched entries.");
    } else {
      state.portalSalesWarning = "";
      renderPortalSalesEntries(message);
      if (!options.silent) showToast("Could not fetch Tally sales entries.");
    }
  }
}

function portalSalePartyName(entry = {}) {
  return String(entry.partyName || "").trim();
}

async function bulkUploadPortalSales() {
  const button = document.getElementById("portalBulkSendBtn");
  const pending = portalSalesRowsForDisplay()
    .map(({ entry }) => entry)
    .filter((entry) => !portalSaleSynced(entry));
  if (!pending.length) {
    showToast("No pending sales entries are available for bulk upload.");
    return;
  }

  let sent = 0;
  let skipped = 0;
  let failed = 0;
  if (button) button.disabled = true;
  try {
    for (const entry of pending) {
      state.activePortalSaleEntry = entry;
      const typeSummary = portalSaleTypeSummary(entry);
      const licence = portalBuyerLicenseDisplay(entry, typeSummary);
      const validation = portalBuyerValidation(entry, typeSummary, licence);
      if (validation.blocked || !(await ensurePortalSaleBuyerLicence(entry))) {
        skipped += 1;
        continue;
      }
      fillPortalFormFromSale(entry);
      const ok = await preparePortalCreateOrder({ send: true, openPreview: false });
      if (ok) sent += 1;
      else failed += 1;
    }
  } finally {
    state.activePortalSaleEntry = null;
    if (button) button.disabled = false;
    await loadPortalSalesEntries({ silent: true }).catch(() => renderPortalSalesEntries());
  }

  const parts = [`${sent} uploaded`];
  if (skipped) parts.push(`${skipped} need buyer details`);
  if (failed) parts.push(`${failed} failed`);
  showToast(`Bulk upload complete: ${parts.join(", ")}.`);
}

function renderPortalSalesEntries(errorMessage = "") {
  const body = document.getElementById("portalSalesBody");
  if (!body) return;

  if (errorMessage) {
    body.innerHTML = `<tr><td colspan="7" class="empty-cell">${escapeHtml(errorMessage)}</td></tr>`;
    return;
  }

  const rows = portalSalesRowsForDisplay();
  const warning = state.portalSalesWarning || "";

  if (!rows.length) {
    const showAll = Boolean(document.getElementById("portalShowAllSales")?.checked);
    const message = warning
      ? warning
      : state.portalSalesEntries.length && !showAll
      ? "No unsynced Tally sales entries found. Use See all to view synced vouchers."
      : t("portalQueueEmpty", "No Tally sales entries fetched yet.");
    body.innerHTML = `<tr><td colspan="7" class="empty-cell">${escapeHtml(message)}</td></tr>`;
    return;
  }

  body.innerHTML = `${warning ? `<tr><td colspan="7" class="empty-cell portal-warning-cell">${escapeHtml(warning)}</td></tr>` : ""}${rows.map(({ entry, index }) => {
    const expanded = state.expandedPortalSale === portalSaleKey(entry, index);
    const allItems = portalDisplayItems(entry, { includeSynced: true });
    const pendingItems = allItems.filter((item) => !portalItemSynced(item));
    const syncedItems = allItems.filter(portalItemSynced);
    const selectedItems = selectedPortalItems(entry);
    const displayItems = portalDisplayItems(entry);
    const firstLot = displayItems[0] || {};
    const trace = portalTraceForItem(entry, firstLot);
    const originalOwner = trace?.originalOwner || firstLot.originalOwner || entry.originalOwner || "";
    const synced = portalSaleSynced(entry);
    const partialSynced = portalSalePartialSynced(entry);
    const lotTraceStatus = synced
      ? "Fully uploaded"
      : partialSynced
        ? `${syncedItems.length} uploaded / ${pendingItems.length} pending`
      : entry.licenceScopeBlocked
        ? originalOwner || "Licence not assigned"
        : originalOwner || (firstLot.lotNum ? "Needs original owner" : "Needs lot details");
    const lotTraceClass = synced || originalOwner ? "status-pill status-ok" : "status-pill status-warn";
    const typeSummary = portalSaleTypeSummary(entry);
    const buyerLicense = portalBuyerLicenseDisplay(entry, typeSummary);
    const buyerValidation = portalBuyerValidation(entry, typeSummary, buyerLicense);
    const rowKey = portalSaleKey(entry, index);
    const buyerEditorOpen = state.buyerEditorKey === rowKey;
    const assignableRows = portalScopeAssignmentRows(entry);
    return `
      <tr class="portal-sale-row ${expanded ? "active-order" : ""}" data-portal-index="${index}">
        <td>
          <div class="queue-voucher-cell">
            <strong>${escapeHtml(entry.voucherNumber || entry.reference || "")}</strong>
            <small>${escapeHtml(formatTallyDate(entry.date))}</small>
            <small>${escapeHtml(entry.voucherTypeName || "")}</small>
          </div>
        </td>
        <td>
          <div class="queue-party-cell">
            <strong>${escapeHtml(portalSalePartyName(entry) || "-")}</strong>
            <small>${escapeHtml(displayItems.map((item) => item.stockItemName).filter(Boolean).join(", "))}</small>
            ${allItems.length ? `<small>${escapeHtml(`${pendingItems.length} pending / ${syncedItems.length} uploaded`)}</small>` : ""}
          </div>
        </td>
        <td class="amount"><strong>${escapeHtml(cleanTallyAmount(entry.amount))}</strong></td>
        <td>
          <div class="buyer-licence-cell">
            <span class="${buyerLicense.className}">${escapeHtml(buyerLicense.label)}</span>
            ${buyerLicense.editable ? `<button class="mini-button licence-edit-button" data-action="portal-buyer-open" data-portal-index="${index}" type="button">${escapeHtml(buyerLicense.actionLabel)}</button>` : ""}
            ${buyerValidation.message ? `<small class="buyer-warning">${escapeHtml(buyerValidation.message)}</small>` : ""}
            ${assignableRows.length ? `<button class="mini-button licence-edit-button" data-action="portal-assign-scope" data-portal-index="${index}" type="button">Assign current scope</button>` : ""}
          </div>
        </td>
        <td>
          <div class="portal-type-stack">
            <span>${escapeHtml(typeSummary.partyType)}</span>
            ${entry.partyNameLedgerFound === false ? "" : `<button class="mini-button licence-edit-button" data-action="portal-buyer-open" data-portal-index="${index}" type="button">Edit buyer</button>`}
          </div>
        </td>
        <td><span class="${lotTraceClass}">${escapeHtml(lotTraceStatus)}</span></td>
        <td>
          <div class="row-actions">
            <button class="mini-button primary-mini" data-action="portal-send" data-portal-index="${index}" type="button" ${synced || !selectedItems.length || buyerValidation.blocked ? "disabled" : ""} title="${escapeHtml(buyerValidation.message || "Push selected rows to SATHI")}">${synced ? "Synced" : selectedItems.length < pendingItems.length ? `Push ${selectedItems.length}` : "Push"}</button>
          </div>
        </td>
      </tr>
      ${buyerEditorOpen ? portalBuyerEditorRowHtml(entry, index, typeSummary, buyerLicense) : ""}
      <tr class="order-detail-row ${expanded ? "" : "hidden"}">
        <td colspan="7">${portalSaleDetailHtml(entry, index)}</td>
      </tr>
    `;
  }).join("")}`;

  document.querySelectorAll(".portal-sale-row").forEach((row) => {
    row.addEventListener("click", (event) => {
      if (event.target.closest("button")) return;
      const entry = state.portalSalesEntries[Number(row.dataset.portalIndex)];
      const key = portalSaleKey(entry, row.dataset.portalIndex);
      state.expandedPortalSale = state.expandedPortalSale === key ? "" : key;
      renderPortalSalesEntries();
    });
  });

  document.querySelectorAll("[data-action='portal-send']").forEach((button) => {
    button.addEventListener("click", async () => {
      if (button.disabled) return;
      const entry = state.portalSalesEntries[Number(button.dataset.portalIndex)];
      state.activePortalSaleEntry = entry;
      button.disabled = true;
      const previousText = button.textContent;
      button.textContent = "Sending...";
      const ready = await ensurePortalSaleBuyerLicence(entry);
      try {
        if (!ready) return;
        fillPortalFormFromSale(entry);
        await preparePortalCreateOrder({ send: true, openPreview: false });
      } finally {
        button.disabled = false;
        button.textContent = previousText;
      }
    });
  });

  document.querySelectorAll("[data-action='portal-row-select']").forEach((checkbox) => {
    checkbox.addEventListener("click", (event) => event.stopPropagation());
    checkbox.addEventListener("change", () => {
      const entry = state.portalSalesEntries[Number(checkbox.dataset.portalIndex)];
      if (!entry) return;
      const selectionKey = portalSelectionKey(entry);
      const pending = portalSalePendingItems(entry);
      const current = state.portalSelectedRows[selectionKey] || Object.fromEntries(pending.map((item) => [portalRowKey(item), true]));
      current[checkbox.dataset.rowKey || ""] = checkbox.checked;
      state.portalSelectedRows[selectionKey] = current;
      renderPortalSalesEntries();
    });
  });

  document.querySelectorAll("[data-action='portal-buyer-open']").forEach((button) => {
    button.addEventListener("click", () => {
      const entry = state.portalSalesEntries[Number(button.dataset.portalIndex)];
      if (!entry) return;
      state.buyerEditorKey = portalSaleKey(entry, Number(button.dataset.portalIndex));
      renderPortalSalesEntries();
    });
  });

  document.querySelectorAll("[data-action='portal-assign-scope']").forEach((button) => {
    button.addEventListener("click", async () => {
      const index = Number(button.dataset.portalIndex);
      const entry = state.portalSalesEntries[index];
      if (!entry) return;
      button.disabled = true;
      try {
        await assignCurrentScopeToPortalSale(entry);
      } finally {
        button.disabled = false;
      }
    });
  });

  document.querySelectorAll("[data-action='portal-buyer-cancel']").forEach((button) => {
    button.addEventListener("click", () => {
      state.buyerEditorKey = "";
      renderPortalSalesEntries();
    });
  });

  document.querySelectorAll("[data-action='portal-buyer-save']").forEach((button) => {
    button.addEventListener("click", async () => {
      const index = Number(button.dataset.portalIndex);
      const entry = state.portalSalesEntries[index];
      const editor = button.closest(".portal-buyer-editor-row");
      if (!entry || !editor) return;
      button.disabled = true;
      try {
        if (await savePortalBuyerEditor(entry, editor)) {
          state.buyerEditorKey = "";
          renderPortalSalesEntries();
        }
      } finally {
        button.disabled = false;
      }
    });
  });

  document.querySelectorAll(".buyer-editor-licence").forEach((input) => {
    const syncSite = () => {
      const editor = input.closest(".portal-buyer-editor");
      const siteInput = editor?.querySelector(".buyer-editor-site");
      const list = input.list;
      if (!siteInput || !list) return;
      const value = cleanBuyerLicenseValue(input.value);
      const option = [...list.options].find((item) => cleanBuyerLicenseValue(item.value).toUpperCase() === value.toUpperCase());
      if (option?.dataset?.site) siteInput.value = option.dataset.site;
    };
    input.addEventListener("input", syncSite);
    input.addEventListener("change", syncSite);
  });
  if (state.buyerEditorKey) {
    const focusEditor = () => document.querySelector(".portal-buyer-editor-row .buyer-editor-licence")?.focus({ preventScroll: true });
    window.requestAnimationFrame(focusEditor);
    window.setTimeout(focusEditor, 120);
  }
}

function portalBuyerEditorRowHtml(entry, index, typeSummary, buyerLicense) {
  const cottonSale = portalSaleNeedsCottonLicence(entry);
  const kind = cottonSale ? "Cotton" : "Seed";
  const options = ledgerLicenceOptions(entry.partyDetails || {}, cottonSale ? "cotton" : "seed");
  const listId = `buyer-licence-options-${index}`;
  const gstRegistered = portalSaleGstRegistered(entry);
  const selectedSite = options.find((option) => option.licNo.toUpperCase() === cleanBuyerLicenseValue(buyerLicense.value).toUpperCase())?.site || "";
  return `
    <tr class="portal-buyer-editor-row">
      <td colspan="7">
        <div class="portal-buyer-editor">
          <div class="buyer-editor-heading">
            <strong>Buyer details</strong>
            <span>${escapeHtml(portalSalePartyName(entry))}</span>
            ${gstRegistered ? '<b>GST registered party: Buyer Type must be DEALER and licence is compulsory.</b>' : ""}
          </div>
          <label>Buyer Type
            <select class="buyer-editor-type" ${gstRegistered ? "disabled" : ""}>
              <option value="DEALER" ${typeSummary.buyerRole === "DEALER" ? "selected" : ""}>DEALER</option>
              <option value="FARMER" ${typeSummary.buyerRole === "FARMER" ? "selected" : ""}>FARMER</option>
            </select>
          </label>
          <label>${kind} Licence No.
            <input class="buyer-editor-licence" list="${listId}" value="${escapeHtml(buyerLicense.value || "")}" placeholder="Enter or select ${kind.toLowerCase()} licence" autocomplete="off">
            <datalist id="${listId}">${options.map((option) => `<option value="${escapeHtml(option.licNo)}" label="${escapeHtml(option.site || option.licNo)}" data-site="${escapeHtml(option.site || "")}"></option>`).join("")}</datalist>
          </label>
          <label>Site / Identity
            <input class="buyer-editor-site" value="${escapeHtml(selectedSite)}" placeholder="Optional">
          </label>
          <div class="buyer-editor-actions">
            <button class="secondary-button" data-action="portal-buyer-cancel" type="button">Cancel</button>
            <button class="primary-button" data-action="portal-buyer-save" data-portal-index="${index}" type="button">Save in Tally</button>
          </div>
        </div>
      </td>
    </tr>`;
}

function portalSaleDetailHtml(entry, index = -1) {
  const items = portalDisplayItems(entry, { includeSynced: true });
  const firstItem = items[0] || {};
  const detailOriginalOwner = portalTraceForItem(entry, firstItem)?.originalOwner || firstItem.originalOwner || entry.originalOwner || "";
  const assignableRows = portalScopeAssignmentRows(entry);
  const selected = selectedPortalItems(entry);
  const selectedKeys = new Set(selected.map(portalRowKey));
  const rows = items.map((item) => {
    const rowKey = portalRowKey(item);
    const synced = portalItemSynced(item);
    return `
    <tr>
      <td>${synced ? '<span class="status-pill status-ok">Uploaded</span>' : `<input type="checkbox" data-action="portal-row-select" data-portal-index="${escapeHtml(index)}" data-row-key="${escapeHtml(rowKey)}" ${selectedKeys.has(rowKey) ? "checked" : ""}>`}</td>
      <td>${escapeHtml(item.stockItemName || "")}</td>
      <td>${escapeHtml(item.lotNum || "")}</td>
      <td>${escapeHtml(portalTraceForItem(entry, item)?.originalOwner || item.originalOwner || "Missing")}</td>
      <td class="amount">${escapeHtml(item.quantityText || item.quantity || "")}</td>
      <td>${escapeHtml(item.rate || "")}</td>
      <td class="amount">${escapeHtml(cleanTallyAmount(item.amount))}</td>
      <td>${escapeHtml(item.portalPushResult || item.portalOrderNo || "")}</td>
    </tr>
  `; }).join("");

  return `
    <div class="order-detail-card">
      <div class="order-workflow-strip">
        <span>${escapeHtml(items.length)} item${items.length === 1 ? "" : "s"}</span>
        <span>${escapeHtml(selected.length)} selected for push</span>
        <span>Buyer licence: ${escapeHtml(entry.buyerLicense || "Missing")}</span>
        <span>Original owner: ${escapeHtml(detailOriginalOwner || "Missing")}</span>
        ${entry.licenceScopeBlocked ? `<span>${escapeHtml(entry.licenceScopeIssue || "Batch licence pending")}</span>` : ""}
        ${assignableRows.length ? `<button class="mini-button licence-edit-button" data-action="portal-assign-scope" data-portal-index="${escapeHtml(index)}" type="button">Assign current scope</button>` : ""}
      </div>
      <div class="table-wrap compact-detail-table">
        <table>
          <thead><tr><th>Select</th><th>Item</th><th>Lot</th><th>Original Owner</th><th class="amount">Qty</th><th>Rate</th><th class="amount">Amount</th><th>Portal</th></tr></thead>
          <tbody>${rows || '<tr><td colspan="8" class="empty-cell">No item rows found in this voucher.</td></tr>'}</tbody>
        </table>
      </div>
    </div>
  `;
}

function portalDisplayItems(entry = {}, options = {}) {
  const inventory = Array.isArray(entry.inventory) ? entry.inventory : [];
  const rows = inventory.length ? inventory : (Array.isArray(entry.unassignedInventory) ? entry.unassignedInventory : []);
  if (options.includeSynced) return rows;
  const showAll = Boolean(document.getElementById("portalShowAllSales")?.checked);
  return showAll ? rows : rows.filter((item) => !portalItemSynced(item));
}

function portalScopeAssignmentRows(entry = {}) {
  return (Array.isArray(entry.unassignedInventory) ? entry.unassignedInventory : [])
    .filter((item) => (
      item?.stockItemName
      && item?.lotNum
      && !String(item.sathiCompanyLicenceNoS || "").trim()
      && !String(item.sathiIsCottonSValue || "").trim()
    ));
}

async function assignCurrentScopeToPortalSale(entry = {}) {
  const rows = portalScopeAssignmentRows(entry);
  if (!rows.length) {
    showToast("No missing batch licence UDFs found for this voucher.");
    return;
  }
  const scope = activeLicenceScope();
  const licenceCode = scopeLicenceCode(scope);
  const licenceType = scopeLicenceType(scope);
  if (!licenceCode) {
    showToast("Select active licence first.");
    return;
  }
  const preview = rows.slice(0, 5).map((item) => (
    `${item.stockItemName || "-"} | Batch ${item.lotNum || "-"} | Owner ${item.originalOwner || "-"} | Packing ${item.packingSize || "-"}`
  )).join("\n");
  const more = rows.length > 5 ? `\n...and ${rows.length - 5} more row(s)` : "";
  const accepted = window.confirm(
    `Assign current scope to missing sales batch UDFs?\n\n`
    + `Voucher: ${entry.voucherNumber || entry.reference || "-"}\n`
    + `Licence: ${licenceCode}\n`
    + `Type: ${String(licenceType || "seed").toUpperCase()}\n\n`
    + `${preview}${more}\n\n`
    + `Only batch UDFs will be updated: SATHICMPLicNoS and SATHIIsCottonS. Existing item, qty, party and amount will not be changed.`
  );
  if (!accepted) return;

  let updated = 0;
  for (const item of rows) {
    const trace = portalTraceForItem(entry, item) || {};
    const result = await api("/api/tally/batch-correction/update", {
      method: "POST",
      body: {
        companyName: selectedCompanyName(),
        change: {
          mode: "sales",
          masterId: entry.masterId,
          voucherNumber: entry.voucherNumber || entry.reference || "",
          stockItemName: item.stockItemName,
          oldBatchName: item.lotNum,
          newBatchName: item.salesBatchNo || item.lotNum,
          originalOwner: item.originalOwner || trace.originalOwner || "",
          packingSize: item.packingSize || trace.packingSize || "",
          ...activeBatchLicenceValues(),
          allowOverwriteSathiBatch: true
        }
      }
    });
    if (result.updated) updated += 1;
  }

  showToast(`${updated} batch row(s) assigned to current scope.`);
  await loadPortalSalesEntries({ silent: true });
}

function fillPortalFormFromSale(entry) {
  const firstLot = selectedPortalItems(entry)[0] || portalDisplayItems(entry)[0] || {};
  const form = document.getElementById("portalPushForm");
  const scope = activeLicenceScope();
  const fields = scope?.fields || {};
  const partyDetails = entry.partyDetails || {};
  if (!form) return;
  form.dataset.sourceVoucherNumber = entry.voucherNumber || entry.reference || "";
  form.dataset.sourceVoucherKey = entry.voucherKey || "";
  form.dataset.sourceRemoteId = entry.remoteId || "";
  form.dataset.sourceMasterId = entry.masterId || "";
  form.dataset.sourceReference = entry.reference || "";
  form.dataset.sourceVoucherDate = entry.date || "";
  form.dataset.sourceVoucherTypeName = entry.voucherTypeName || "";
  const typeSummary = portalSaleTypeSummary(entry);
  const buyerLicense = portalBuyerLicenseDisplay(entry, typeSummary);
  form.buyerCode.value = buyerLicense.value || "";
  form.ownerCode.value = fields.ownerCode || scope?.clientId || form.ownerCode.value || "";
  form.locationCode.value = fields.locationCode || fields.ownerCode || scope?.clientId || form.locationCode.value || "";
  form.stateCode.value = fields.stateCode || form.stateCode.value || "";
  form.blockCode.value = partyDetails.blockCode || form.blockCode.value || "";
  form.blockName.value = partyDetails.blockName || form.blockName.value || "";
  form.districtCode.value = partyDetails.districtCode || form.districtCode.value || "";
  form.districtName.value = partyDetails.districtName || form.districtName.value || "";
  form.villageCode.value = partyDetails.villageCode || form.villageCode.value || "";
  form.villageName.value = partyDetails.villageName || form.villageName.value || "";
  form.plotNo.value = partyDetails.plotNo || form.plotNo.value || "";
  form.lotNum.value = firstLot.lotNum || "";
  form.quantity.value = firstLot.quantity || "";
  form.dataset.totalQty = firstLot.quantityQtl || saleQuantityToQtl([firstLot.actualQtyText, firstLot.billedQtyText, firstLot.quantityText].filter(Boolean).join(" = "), firstLot.quantity) || "";
  form.packingSize.value = firstLot.packingSize || portalTraceForItem(entry, firstLot)?.packingSize || form.packingSize.value || "";
  form.originalOwner.value = entry.originalOwner || portalTraceForItem(entry, firstLot)?.originalOwner || firstLot.originalOwner || "";
  form.sellerRole.value = typeSummary.sellerRole;
  form.buyerRole.value = typeSummary.buyerRole;
  form.isRetailSell.value = typeSummary.isRetailSell;
  if (form.buyerRole.value === "FARMER") form.isRetailSell.value = "Yes";
  const partyTarget = document.getElementById("portalPartyLicenseValue");
  if (partyTarget) partyTarget.textContent = buyerLicense.label;
}

async function ensurePortalSaleBuyerLicence(entry = {}, settings = {}) {
  const typeSummary = portalSaleTypeSummary(entry);
  if (typeSummary.isRetailSell === "Yes" || typeSummary.buyerRole === "FARMER") {
    entry.voucherBuyerType = "FARMER";
    entry.buyerLicense = "";
    entry.buyerCottonLicense = "";
    return true;
  }

  const cottonSale = portalSaleNeedsCottonLicence(entry);
  const licenceOptions = cottonSale
    ? (entry.buyerCottonLicenseOptions || entry.partyDetails?.cottonLicences || [])
    : (entry.buyerLicenseOptions || entry.partyDetails?.seedLicences || []);
  const existingOptions = ledgerLicenceOptions({
    seedLicences: cottonSale ? [] : licenceOptions,
    cottonLicences: cottonSale ? licenceOptions : []
  }, cottonSale ? "cotton" : "seed");
  let selected = cleanBuyerLicenseValue(cottonSale
    ? (entry.buyerCottonLicense || entry.voucherBuyerCottonLicense)
    : (entry.buyerLicense || entry.voucherBuyerLicense));

  const selectedSite = existingOptions.find((option) => option.licNo.toUpperCase() === selected.toUpperCase())?.site || "";
  if (!selected) {
    const index = state.portalSalesEntries.indexOf(entry);
    state.buyerEditorKey = portalSaleKey(entry, Math.max(index, 0));
    renderPortalSalesEntries();
    showToast(portalSaleGstRegistered(entry)
      ? "GST registered party: select DEALER licence before Push."
      : "Buyer licence is required before sending this dealer sale.");
    return false;
  }

  entry.voucherBuyerType = "DEALER";
  if (cottonSale) {
    entry.buyerCottonLicense = selected;
    entry.voucherBuyerCottonLicense = selected;
  } else {
    entry.buyerLicense = selected;
    entry.voucherBuyerLicense = selected;
  }

  if (!entry.masterId) {
    return true;
  }

  try {
    const result = await api("/api/tally/sales-buyer-fields/update", {
      method: "POST",
      body: {
        companyName: selectedCompanyName(),
        change: {
          masterId: entry.masterId,
          voucherNumber: entry.voucherNumber || entry.reference || "",
          buyerType: "DEALER",
          buyerLicence: cottonSale ? (cleanBuyerLicenseValue(entry.buyerLicense || entry.voucherBuyerLicense) || "") : selected,
          buyerCottonLicence: cottonSale ? selected : (cleanBuyerLicenseValue(entry.buyerCottonLicense || entry.voucherBuyerCottonLicense) || "")
        }
      }
    });
    if (!result.updated) {
      showToast(result.message || "Buyer licence could not be updated in Tally.");
      return false;
    }
    await maybeSaveBuyerLicenceToLedger(entry, selected, selectedSite, cottonSale ? "cotton" : "seed", existingOptions);
    showToast("Buyer licence updated in Tally.");
    return true;
  } catch (error) {
    showApiErrorToast(error, "Buyer licence update failed.");
    return false;
  }
}

async function savePortalBuyerEditor(entry = {}, editor) {
  const gstRegistered = portalSaleGstRegistered(entry);
  const requestedType = String(editor.querySelector(".buyer-editor-type")?.value || "FARMER").toUpperCase();
  const buyerType = gstRegistered ? "DEALER" : requestedType;
  const cottonSale = portalSaleNeedsCottonLicence(entry);
  const kind = cottonSale ? "cotton" : "seed";
  const licence = cleanBuyerLicenseValue(editor.querySelector(".buyer-editor-licence")?.value || "");
  const existingOptions = ledgerLicenceOptions(entry.partyDetails || {}, kind);
  const selectedOption = existingOptions.find((option) => option.licNo.toUpperCase() === licence.toUpperCase());
  const site = cleanBuyerSiteValue(editor.querySelector(".buyer-editor-site")?.value || "") || selectedOption?.site || "";
  if (buyerType === "DEALER" && !licence) {
    showToast(gstRegistered
      ? "This is a GST registered party. DEALER buyer type and licence number are compulsory."
      : "Licence number is compulsory for DEALER sale.");
    editor.querySelector(".buyer-editor-licence")?.focus();
    return false;
  }

  const seedLicence = cottonSale ? cleanBuyerLicenseValue(entry.buyerLicense || entry.voucherBuyerLicense) : licence;
  const cottonLicence = cottonSale ? licence : cleanBuyerLicenseValue(entry.buyerCottonLicense || entry.voucherBuyerCottonLicense);
  if (entry.masterId) {
    const result = await api("/api/tally/sales-buyer-fields/update", {
      method: "POST",
      body: {
        companyName: selectedCompanyName(),
        change: {
          masterId: entry.masterId,
          voucherNumber: entry.voucherNumber || entry.reference || "",
          buyerType,
          buyerLicence: buyerType === "DEALER" ? seedLicence : "",
          buyerCottonLicence: buyerType === "DEALER" ? cottonLicence : ""
        }
      }
    });
    if (!result.updated) {
      showToast(result.message || "Buyer details could not be updated in Tally.");
      return false;
    }
  }

  entry.voucherBuyerType = buyerType;
  entry.buyerPartyType = buyerType;
  entry.buyerLicense = buyerType === "DEALER" ? seedLicence : "";
  entry.voucherBuyerLicense = entry.buyerLicense;
  entry.buyerCottonLicense = buyerType === "DEALER" ? cottonLicence : "";
  entry.voucherBuyerCottonLicense = entry.buyerCottonLicense;
  if (buyerType === "DEALER") {
    await maybeSaveBuyerLicenceToLedger(entry, licence, site, kind, existingOptions, { forceSave: true });
  }
  showToast("Buyer type and licence updated in Tally.");
  return true;
}

async function editPortalSaleBuyerFields(entry = {}) {
  const current = portalSaleTypeSummary(entry).buyerRole;
  const answer = String(window.prompt("Buyer type: FARMER or DEALER", current) || "").trim().toUpperCase();
  if (!answer) return false;
  if (!["FARMER", "DEALER"].includes(answer)) {
    showToast("Enter FARMER or DEALER.");
    return false;
  }
  const gstDealer = portalSaleDealerEvidence({
    ...entry,
    buyerLicense: "",
    voucherBuyerLicense: "",
    buyerCottonLicense: "",
    voucherBuyerCottonLicense: "",
    buyerLicenseOptions: [],
    buyerCottonLicenseOptions: []
  });
  const buyerType = gstDealer ? "DEALER" : answer;
  if (gstDealer && answer === "FARMER") showToast("GST party is treated as DEALER.");

  entry.voucherBuyerType = buyerType;
  if (buyerType === "DEALER") return ensurePortalSaleBuyerLicence(entry, { forcePrompt: true });

  entry.buyerLicense = "";
  entry.voucherBuyerLicense = "";
  entry.buyerCottonLicense = "";
  entry.voucherBuyerCottonLicense = "";
  if (!entry.masterId) return true;
  try {
    const result = await api("/api/tally/sales-buyer-fields/update", {
      method: "POST",
      body: {
        companyName: selectedCompanyName(),
        change: {
          masterId: entry.masterId,
          voucherNumber: entry.voucherNumber || entry.reference || "",
          buyerType: "FARMER",
          buyerLicence: "",
          buyerCottonLicence: ""
        }
      }
    });
    if (!result.updated) {
      showToast(result.message || "Buyer type could not be updated in Tally.");
      return false;
    }
    showToast("Buyer type updated in Tally.");
    return true;
  } catch (error) {
    showApiErrorToast(error, "Buyer type update failed.");
    return false;
  }
}

function promptForBuyerLicence(entry = {}, options = [], kind = "seed", currentValue = "") {
  const normalisedOptions = (Array.isArray(options) ? options : [options]).map((option) => ({
    licNo: cleanBuyerLicenseValue(typeof option === "string" ? option : option.licNo),
    site: String(typeof option === "string" ? "" : option.site || "").trim()
  })).filter((option) => option.licNo);
  const party = portalSalePartyName(entry) || "selected party";
  if (normalisedOptions.length) {
    const lines = normalisedOptions.map((option, index) => `${index + 1}. ${option.licNo}${option.site ? ` (${option.site})` : ""}`).join("\n");
    const defaultValue = currentValue || (normalisedOptions.length === 1 ? normalisedOptions[0].licNo : "");
    const answer = window.prompt(`Select or edit ${kind} licence for ${party}:\n${lines}\n\nEnter number or licence no.`, defaultValue);
    if (answer === null) return null;
    const choice = Number(String(answer || "").trim());
    if (choice >= 1 && choice <= normalisedOptions.length) return normalisedOptions[choice - 1];
    const licNo = cleanBuyerLicenseValue(answer);
    if (!licNo) return null;
    const site = String(window.prompt(`Enter site/name for ${licNo} (optional).`, "") || "").trim();
    return { licNo, site };
  }
  const licNo = cleanBuyerLicenseValue(window.prompt(`Enter ${kind} licence for ${party}.`, currentValue));
  if (!licNo) return null;
  const site = String(window.prompt(`Enter site/name for ${licNo} (optional).`, "") || "").trim();
  return { licNo, site };
}

async function maybeSaveBuyerLicenceToLedger(entry = {}, selected = "", site = "", kind = "seed", existingOptions = [], settings = {}) {
  const licNo = cleanBuyerLicenseValue(selected);
  const ledgerName = portalSalePartyName(entry);
  if (!licNo || !ledgerName) return;
  const alreadyExists = (existingOptions || []).some((option) => cleanBuyerLicenseValue(option.licNo).toUpperCase() === licNo.toUpperCase());
  if (alreadyExists) return;
  const save = settings.forceSave || window.confirm(`Save ${kind} licence ${licNo} in party ledger ${ledgerName} also?`);
  if (!save) return;
  try {
    const result = await api("/api/tally/ledger-licence/update", {
      method: "POST",
      body: {
        companyName: selectedCompanyName(),
        ledgerName,
        kind,
        licence: licNo,
        site,
        existingLicences: existingOptions
      }
    });
    if (result.updated && result.verified) {
      if (kind === "cotton") {
        entry.buyerCottonLicenseOptions = [...existingOptions, { licNo, site }];
        if (entry.partyDetails) entry.partyDetails.cottonLicences = entry.buyerCottonLicenseOptions;
      } else {
        entry.buyerLicenseOptions = [...existingOptions, { licNo, site }];
        if (entry.partyDetails) entry.partyDetails.seedLicences = entry.buyerLicenseOptions;
      }
    } else {
      showToast(result.message || "Licence saved in voucher, but party ledger licence list was not verified.");
    }
  } catch (error) {
    showApiErrorToast(error, "Party ledger licence update failed.");
  }
}

function portalSaleNeedsCottonLicence(entry = {}) {
  const declaredType = String(entry.activeLicenceType || entry.licenceType || "").trim().toLowerCase();
  if (declaredType === "cotton" || declaredType === "seed") return declaredType === "cotton";
  return (entry.inventory || []).some((item) => Boolean(item.sathiIsCottonS));
}

function portalSaleGstRegistered(entry = {}) {
  if (entry.partyNameLedgerFound === false) return false;
  const party = entry.partyDetails || {};
  return Boolean(
    cleanBuyerLicenseValue(entry.partyGstin) ||
    /regular/i.test(String(entry.partyGstRegistrationType || "")) ||
    party.hasGstin ||
    cleanBuyerLicenseValue(party.gstin) ||
    /regular/i.test(String(party.gstRegistrationType || ""))
  );
}

function portalBuyerValidation(entry = {}, typeSummary = portalSaleTypeSummary(entry), buyerLicense = portalBuyerLicenseDisplay(entry, typeSummary)) {
  if (entry.licenceScopeBlocked) {
    return { blocked: true, message: entry.licenceScopeIssue || "SATHI batch licence is not assigned" };
  }
  if (typeSummary.buyerRole === "FARMER") return { blocked: false, message: "" };
  if (buyerLicense.value) return { blocked: false, message: "" };
  return {
    blocked: true,
    message: portalSaleGstRegistered(entry)
      ? "GST registered: DEALER licence required"
      : "Dealer licence required"
  };
}

function portalSaleDealerEvidence(entry = {}) {
  if (entry.partyNameLedgerFound === false) return false;
  const party = entry.partyDetails || {};
  const seedOptions = entry.buyerLicenseOptions || party.seedLicences || [];
  const cottonOptions = entry.buyerCottonLicenseOptions || party.cottonLicences || [];
  return Boolean(
    portalSaleGstRegistered(entry) ||
    cleanBuyerLicenseValue(entry.buyerLicense || entry.voucherBuyerLicense) ||
    cleanBuyerLicenseValue(entry.buyerCottonLicense || entry.voucherBuyerCottonLicense) ||
    (Array.isArray(seedOptions) && seedOptions.length) ||
    (Array.isArray(cottonOptions) && cottonOptions.length)
  );
}

function portalSaleTypeSummary(entry = {}) {
  if (entry.partyNameLedgerFound === false) {
    return {
      partyType: "FARMER",
      sellerRole: normalizePortalRole(entry.sellerRole, "DEALER"),
      buyerRole: "FARMER",
      isRetailSell: "Yes",
      saleType: "Farmer sale"
    };
  }
  const voucherBuyerType = entry.voucherBuyerType || entry.sathiVchBuyerType || "";
  const dealerEvidence = portalSaleDealerEvidence(entry);
  const rawPartyType = voucherBuyerType || entry.buyerPartyType || entry.partyDetails?.partyType || entry.buyerRole;
  const partyType = dealerEvidence ? "DEALER" : normalizePortalRole(rawPartyType, "DEALER");
  const sellerRole = normalizePortalRole(entry.sellerRole, "DEALER");
  const buyerRole = partyType;
  const isRetailSell = buyerRole === "FARMER" ? "Yes" : "N";
  return {
    partyType,
    sellerRole,
    buyerRole,
    isRetailSell,
    saleType: isRetailSell === "Yes" || buyerRole === "FARMER" ? "Farmer sale" : "Dealer sale"
  };
}
function portalBuyerLicenseDisplay(entry = {}, typeSummary = portalSaleTypeSummary(entry)) {
  if (typeSummary.isRetailSell === "Yes" || typeSummary.buyerRole === "FARMER") {
    return {
      label: "Not required for farmer",
      value: "",
      className: "status-pill status-muted"
    };
  }
  const cottonSale = portalSaleNeedsCottonLicence(entry);
  const value = cleanBuyerLicenseValue(cottonSale
    ? (entry.buyerCottonLicense || entry.voucherBuyerCottonLicense)
    : (entry.buyerLicense || entry.voucherBuyerLicense));
  const options = cottonSale
    ? (entry.buyerCottonLicenseOptions || entry.partyDetails?.cottonLicences || [])
    : (entry.buyerLicenseOptions || entry.partyDetails?.seedLicences || []);
  const optionCount = Array.isArray(options) ? options.length : (cleanBuyerLicenseValue(options) ? 1 : 0);
  return {
    label: value || (optionCount > 1 ? "Select licence" : "Licence missing"),
    value,
    className: value ? "status-pill status-ok" : "status-pill status-warn",
    editable: true,
    actionLabel: value ? "Change" : (optionCount ? "Choose" : `Add ${cottonSale ? "cotton" : "seed"} licence`)
  };
}

function cleanBuyerLicenseValue(value) {
  const raw = String(value || "").trim();
  if (!raw || /<\s*\/?\s*UDF:/i.test(raw)) return "";
  const text = raw.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  return ["YES", "Y", "TRUE", "1", "NO", "N", "FALSE", "0", "LIC NO.", "LIC NO", "SITE", "-", "N/A", "NA"].includes(text.toUpperCase()) ? "" : text;
}

function cleanBuyerSiteValue(value) {
  const raw = String(value || "").trim();
  if (!raw || /<\s*\/?\s*UDF:/i.test(raw)) return "";
  const text = raw.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  return ["YES", "Y", "TRUE", "1", "NO", "N", "FALSE", "0", "LIC NO.", "LIC NO", "SITE", "-", "N/A", "NA"].includes(text.toUpperCase()) ? "" : text;
}

function normalizePortalRole(value, fallback) {
  const text = String(value || "").trim().toUpperCase();
  if (text === "FARMER") return "FARMER";
  if (text === "SPA") return "SPA";
  if (text === "DEALER") return "DEALER";
  return fallback;
}

function normalizeRetailSell(value) {
  const text = String(value || "").trim().toUpperCase();
  return ["YES", "Y", "TRUE", "1", "FARMER", "RETAIL", "FARMER SALE"].includes(text) ? "Yes" : "N";
}

function portalTraceForItem(entry, item = {}) {
  const traces = entry.traces || {};
  return traces[`${item.lotNum || ""}::${item.stockItemName || ""}`] || traces[`${item.lotNum || ""}::`] || null;
}

function portalSaleKey(entry, fallback) {
  return entry.voucherNumber || entry.reference || String(fallback);
}

function cleanTallyAmount(value) {
  return String(value || "").replace(/^-/, "").trim();
}

function formatTallyDate(value) {
  const text = String(value || "");
  if (/^\d{8}$/.test(text)) return `${text.slice(6, 8)}-${text.slice(4, 6)}-${text.slice(0, 4)}`;
  return text;
}

function sathiApplicabilityDate() {
  return document.getElementById("configForm")?.saathiApplicabilityDate?.value
    || activeLicenceScope()?.fields?.applicabilityDate
    || state.config?.saathi?.applicabilityDate
    || "";
}

function setDefaultReportPeriod() {
  const from = document.getElementById("reportDateFrom");
  const to = document.getElementById("reportDateTo");
  if (!from || !to || from.value || to.value) return;
  const today = new Date();
  const start = new Date(today);
  start.setDate(today.getDate() - 30);
  from.value = dateInputValue(start);
  to.value = dateInputValue(today);
}

function setDefaultFormDPeriod() {
  const from = document.getElementById("formDDateFrom");
  const to = document.getElementById("formDDateTo");
  if (!from || !to || from.value || to.value) return;
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), 1);
  from.value = dateInputValue(start);
  to.value = dateInputValue(today);
}

async function loadFormDReport() {
  const companyName = selectedCompanyName();
  const fromDate = document.getElementById("formDDateFrom")?.value || "";
  const toDate = document.getElementById("formDDateTo")?.value || "";
  const scope = activeScopePayload();
  renderFormDLoading();

  try {
    const result = await api("/api/reports/monthly-stock", {
      method: "POST",
      body: { companyName, fromDate, toDate, scope }
    });
    state.reports.monthlyStockRows = result.rows || [];
    renderFormDReport();
    showToast(`${result.count || 0} Form D row(s) loaded.`);
  } catch (error) {
    renderFormDError(error.message);
    showToast("Could not load Form D report.");
  }
}

function isAdvancedReport(active = state.reports.active) {
  return ["farmerDealer", "lotTrace", "licenceStock", "expiryRisk"].includes(active);
}

async function loadActiveReport() {
  const active = state.reports.active || "purchase";
  const companyName = selectedCompanyName();
  const fromDate = document.getElementById("reportDateFrom")?.value || "";
  const toDate = document.getElementById("reportDateTo")?.value || "";
  const advancedReport = isAdvancedReport(active);
  const tallyOnlyReport = ["rojmel", "batchExpiry"].includes(active);
  const scope = tallyOnlyReport ? null : activeScopePayload();
  const endpoint = active === "sales"
    ? "/api/reports/sales"
    : active === "grn"
      ? "/api/reports/grn-lots"
      : active === "rojmel"
        ? "/api/reports/rojmel"
        : active === "batchExpiry"
          ? "/api/reports/batch-expiry"
          : advancedReport
            ? "/api/reports/advanced-pack"
            : "/api/reports/purchase";

  setText("reportScopeText", tallyOnlyReport ? companyName || "Selected company" : scope?.clientId || "Not loaded");
  renderReportLoading(active);

  try {
    if (active === "grn") {
      await loadGrnLots({ silent: true });
    }
    const result = await api(endpoint, {
      method: "POST",
      body: { companyName, fromDate, toDate, scope }
    });
    if (active === "sales") state.reports.salesRows = result.rows || [];
    else if (active === "grn") state.reports.grnRows = result.rows || [];
    else if (active === "rojmel") {
      state.reports.rojmelRows = result.rows || [];
      state.reports.rojmelTotals = result.totals || {};
      state.reports.rojmelSections = result.sections || [];
      state.reports.rojmelCharts = result.charts || {};
      state.reports.rojmelSourceStats = result.sourceStats || {};
    }
    else if (active === "batchExpiry") {
      state.reports.batchExpiryRows = result.rows || [];
      state.reports.batchExpirySummary = result.summary || {};
      state.reports.batchExpiryGroups = result.groups || [];
      state.reports.batchExpiryBuckets = result.buckets || [];
    }
    else if (advancedReport) {
      state.reports.advancedPack = result.pack || null;
    }
    else state.reports.purchaseRows = result.rows || [];
    renderReports();
    showToast(`${result.count || 0} ${active} report row(s) loaded.`);
  } catch (error) {
    renderReportError(error.message);
    showToast("Could not load report.");
  }
}

function renderReports() {
  if (state.reports.active === "rojmel") state.reports.active = "purchase";
  const active = state.reports.active || "purchase";
  const copy = {
    purchase: ["Purchase Report", "SATHI inward purchases created or ready for Tally purchase entry."],
    sales: ["Sales Report", "Tally sales bills sent or ready to send to SATHI."],
    grn: ["GRN Report", "Receipt note lots available for SATHI purchase matching."],
    rojmel: ["Rojmel Report", "Cash and bank movement summary from Tally."],
    batchExpiry: ["Batch Expiry Report", "Product batch expiry, stock group summary and risk view."],
    farmerDealer: ["Farmer / Dealer Sale Register", "PartyName based farmer/dealer/cash register with row-level SATHI push status."],
    lotTrace: ["Lot Traceability Report", "Purchase source, SATHI batch, sales movement, balance and warnings in one trace."],
    licenceStock: ["Licence-wise Stock Report", "Seed/Cotton licence wise inward, sale, balance and mismatch control."],
    expiryRisk: ["Expiry Risk Dashboard", "Near-expiry balance stock with sale speed and risk suggestions."]
  }[active] || ["Reports", "Separate reporting area. Push Queue and Portal Push logic stays untouched."];
  setText("reportsPanelTitle", copy[0]);
  setText("reportsPanelText", copy[1]);
  document.querySelectorAll(".report-switch-button").forEach((button) => {
    button.classList.toggle("active", button.dataset.reportType === active);
  });
  setText("purchaseReportCount", state.reports.purchaseRows.length);
  setText("salesReportCount", state.reports.salesRows.length);
  setText("grnReportCount", state.reports.grnRows.length);
  setText("rojmelReportCount", state.reports.rojmelRows.filter((row) => row.type === "transaction").length);
  setText("batchExpiryReportCount", state.reports.batchExpiryRows.length);
  setText("farmerDealerReportCount", state.reports.advancedPack?.farmerDealerSales?.rows?.length || 0);
  setText("lotTraceReportCount", state.reports.advancedPack?.lotTrace?.rows?.length || 0);
  setText("licenceStockReportCount", state.reports.advancedPack?.licenceStock?.rows?.length || 0);
  setText("expiryRiskReportCount", state.reports.advancedPack?.expiryRisk?.rows?.length || 0);
  setText("reportScopeText", ["rojmel", "batchExpiry"].includes(active) ? selectedCompanyName() || "Selected company" : activeLicenceScope()?.clientId || "Not loaded");
  updateReportExportButtons(active);
  if (active === "sales") renderSalesReport();
  else if (active === "grn") renderGrnReport();
  else if (active === "rojmel") renderRojmelReport();
  else if (active === "batchExpiry") renderBatchExpiryReport();
  else if (isAdvancedReport(active)) renderAdvancedReport(active);
  else renderPurchaseReport();
}

function updateReportExportButtons(active = state.reports.active) {
  const canExport = ["rojmel", "batchExpiry"].includes(active);
  const hasData = active === "rojmel"
    ? Boolean((state.reports.rojmelRows || []).length || (state.reports.rojmelSections || []).length)
    : active === "batchExpiry"
      ? Boolean((state.reports.batchExpiryRows || []).length)
      : false;
  ["exportReportExcelBtn", "exportReportPdfBtn"].forEach((id) => {
    const button = document.getElementById(id);
    if (!button) return;
    button.classList.toggle("hidden", !canExport);
    button.disabled = canExport && !hasData;
    button.title = hasData ? "" : "Refresh report first";
  });
}

function renderReportLoading(active) {
  const head = document.getElementById("reportTableHead");
  const body = document.getElementById("reportTableBody");
  updateReportExportButtons(active);
  if (!head || !body) return;
  head.innerHTML = "";
  body.innerHTML = `<tr><td class="empty-cell">Loading ${escapeHtml(active)} report...</td></tr>`;
}

function renderReportError(message) {
  const head = document.getElementById("reportTableHead");
  const body = document.getElementById("reportTableBody");
  updateReportExportButtons(state.reports.active);
  if (!head || !body) return;
  head.innerHTML = "";
  body.innerHTML = `<tr><td class="empty-cell">${escapeHtml(message || "Report failed.")}</td></tr>`;
}

function renderPurchaseReport() {
  const head = document.getElementById("reportTableHead");
  const body = document.getElementById("reportTableBody");
  const rows = state.reports.purchaseRows || [];
  if (!head || !body) return;
  head.innerHTML = `
    <tr>
      <th>Bill</th>
      <th>Seller</th>
      <th>Lot / Item</th>
      <th class="amount">Qty</th>
      <th class="amount">Amount</th>
      <th>Status</th>
    </tr>`;
  if (!rows.length) {
    body.innerHTML = '<tr><td colspan="6" class="empty-cell">No purchase report rows loaded.</td></tr>';
    return;
  }
  body.innerHTML = rows.map((row, index) => {
    const key = reportRowKey("purchase", row, index);
    const expanded = state.reports.expandedKey === key;
    return `
    <tr class="report-main-row">
      <td><strong>${escapeHtml(row.billNumber || "-")}</strong><small>${escapeHtml(row.billDate || "")}</small></td>
      <td><strong>${escapeHtml(row.sellerName || "-")}</strong><small>${escapeHtml(row.sellerCode || "")}</small></td>
      <td><strong>${escapeHtml(row.lotNum || "-")}</strong><small>${escapeHtml(row.stockItemName || row.portalItemName || "")}</small></td>
      <td class="amount"><strong>${escapeHtml(row.totalQty ?? "")}</strong><small>${escapeHtml(row.totalBags ? `${row.totalBags} bag(s)` : "")}</small></td>
      <td class="amount"><strong>${escapeHtml(row.totalBillPrice || row.unitPrice || "")}</strong><small>${escapeHtml(row.unitPrice ? `Rate ${row.unitPrice}` : "")}</small></td>
      <td>
        <div class="row-actions">
          <span class="status-pill status-ok">${escapeHtml(row.sathiVchNo || row.sathiStatus || "Stored")}</span>
          <button class="mini-button" data-report-detail="${escapeHtml(key)}" type="button">${expanded ? "Hide" : "Details"}</button>
        </div>
      </td>
    </tr>
    <tr class="report-detail-row ${expanded ? "" : "hidden"}">
      <td colspan="6">${reportDetailGrid([
      ["Buyer licence", row.buyerCode],
      ["Portal item", row.portalItemName],
      ["Crop", row.cropName],
      ["Variety", row.varietyName],
      ["Class", row.certificationClass],
      ["Packing", [row.packingSize, row.packingUnit].filter(Boolean).join(" ")],
      ["Expiry", row.expiryDate],
      ["GST", reportGstText(row)],
      ["HSN", row.hsnCode],
      ["SATHI status", row.sathiStatus],
      ["SATHI voucher", row.sathiVchNo],
      ["Source", row.source],
      ["Updated", row.updatedAt]
    ])}</td>
    </tr>
  `;
  }).join("");
  bindReportDetailButtons();
}

function renderSalesReport() {
  const head = document.getElementById("reportTableHead");
  const body = document.getElementById("reportTableBody");
  const rows = state.reports.salesRows || [];
  if (!head || !body) return;
  head.innerHTML = `
    <tr>
      <th>Voucher</th>
      <th>Party</th>
      <th>Items / Lots</th>
      <th>Buyer licence</th>
      <th class="amount">Amount</th>
      <th>SATHI</th>
    </tr>`;
  if (!rows.length) {
    body.innerHTML = '<tr><td colspan="6" class="empty-cell">No sales report rows loaded.</td></tr>';
    return;
  }
  body.innerHTML = rows.map((row, index) => {
    const key = reportRowKey("sales", row, index);
    const expanded = state.reports.expandedKey === key;
    const lots = (row.inventory || []).map((item) => item.lotNum).filter(Boolean).join(", ");
    const items = (row.inventory || []).map((item) => item.stockItemName).filter(Boolean).join(", ");
    return `
      <tr class="report-main-row">
        <td><strong>${escapeHtml(row.voucherNumber || row.reference || "-")}</strong><small>${escapeHtml(formatTallyDate(row.date))}</small></td>
        <td><strong>${escapeHtml(row.partyLedgerName || "-")}</strong><small>${escapeHtml(row.voucherTypeName || "")}</small></td>
        <td><strong>${escapeHtml(lots || "-")}</strong><small>${escapeHtml(items)}</small></td>
        <td><span class="${row.buyerLicense ? "status-pill status-ok" : "status-pill status-warn"}">${escapeHtml(row.buyerLicense || "Missing")}</span></td>
        <td class="amount"><strong>${escapeHtml(cleanTallyAmount(row.amount))}</strong></td>
        <td>
          <div class="row-actions">
            <span class="${row.sathiVoucherNumber ? "status-pill status-ok" : "status-pill"}">${escapeHtml(row.sathiVoucherNumber || row.portalStatus || "Not pushed")}</span>
            <button class="mini-button" data-report-detail="${escapeHtml(key)}" type="button">${expanded ? "Hide" : "Details"}</button>
          </div>
        </td>
      </tr>
      <tr class="report-detail-row ${expanded ? "" : "hidden"}">
        <td colspan="6">${reportDetailGrid([
      ["Reference", row.reference],
      ["Original owner", row.originalOwner],
      ["Items count", (row.inventory || []).length],
      ["Source", row.source],
      ["Portal status", row.portalStatus],
      ["SATHI voucher", row.sathiVoucherNumber],
      ["Item details", salesInventorySummary(row.inventory)]
    ])}</td>
      </tr>
    `;
  }).join("");
  bindReportDetailButtons();
}

function renderGrnReport() {
  const head = document.getElementById("reportTableHead");
  const body = document.getElementById("reportTableBody");
  const rows = state.reports.grnRows || [];
  if (!head || !body) return;
  head.innerHTML = `
    <tr>
      <th>GRN Voucher</th>
      <th>Party</th>
      <th>Lot / Item</th>
      <th class="amount">GRN Bags</th>
      <th class="amount">Used</th>
      <th class="amount">Pending</th>
      <th>Packing</th>
      <th>Original Owner</th>
      <th>Status</th>
    </tr>`;
  if (!rows.length) {
    body.innerHTML = '<tr><td colspan="9" class="empty-cell">No GRN lot rows loaded. Refresh GRN cache from Tally first.</td></tr>';
    return;
  }
  body.innerHTML = rows.map((row, index) => {
    const key = reportRowKey("grn", row, index);
    const expanded = state.reports.expandedKey === key;
    const balance = grnBalanceForRow(row);
    return `
      <tr class="report-main-row">
        <td><strong>${escapeHtml(row.grnVoucherNumber || "-")}</strong><small>${escapeHtml(row.grnDate || "")}</small></td>
        <td><strong>${escapeHtml(row.partyName || "-")}</strong><small>${escapeHtml(row.grnVoucherType || "")}</small></td>
        <td><strong>${escapeHtml(row.lotNum || "-")}</strong><small>${escapeHtml(row.stockItemName || "")}</small></td>
        <td class="amount"><strong>${escapeHtml(formatBags(balance.grnBags))}</strong><small>${escapeHtml(row.quantityText || row.quantity || "")}</small></td>
        <td class="amount"><strong>${escapeHtml(formatBags(balance.usedBags))}</strong><small>bag knocked off</small></td>
        <td class="amount"><strong>${escapeHtml(formatBags(balance.pendingBags))}</strong><small>bag balance</small></td>
        <td><strong>${escapeHtml(row.packingSize || "-")}</strong><small>${escapeHtml(row.raw?.packingUnit || "")}</small></td>
        <td><span class="${row.originalOwner ? "status-pill status-ok" : "status-pill status-warn"}">${escapeHtml(row.originalOwner || "Will update after portal match")}</span></td>
        <td>
          <div class="row-actions">
            <span class="${grnBalanceStatusClass(balance)}">${escapeHtml(grnBalanceStatusText(balance))}</span>
            <button class="mini-button" data-report-detail="${escapeHtml(key)}" type="button">${expanded ? "Hide" : "Details"}</button>
          </div>
        </td>
      </tr>
      <tr class="report-detail-row ${expanded ? "" : "hidden"}">
        <td colspan="9">${reportDetailGrid([
      ["Licence", row.licenceCode],
      ["Packing", row.packingSize],
      ["GRN bags", `${formatBags(balance.grnBags)} bag`],
      ["Knocked off", `${formatBags(balance.usedBags)} bag`],
      ["Pending balance", `${formatBags(balance.pendingBags)} bag`],
      ["Cached at", row.cachedAt],
      ["Source", "Tally GRN / Receipt Note"],
      ["Purpose", "Used for lot match before SATHI purchase voucher push"]
    ])}</td>
      </tr>
    `;
  }).join("");
  bindReportDetailButtons();
}

function renderRojmelReport() {
  const head = document.getElementById("reportTableHead");
  const body = document.getElementById("reportTableBody");
  const rows = state.reports.rojmelRows || [];
  const totals = state.reports.rojmelTotals || {};
  const sections = state.reports.rojmelSections || [];
  const charts = state.reports.rojmelCharts || {};
  const stats = state.reports.rojmelSourceStats || {};
  const transactionRows = rows.filter((row) => row.type === "transaction");
  if (!head || !body) return;
  head.innerHTML = "";
  if (!rows.length && !sections.length) {
    body.innerHTML = '<tr><td class="empty-cell">No Rojmel rows loaded. Refresh report after connecting Tally.</td></tr>';
    return;
  }

  const today = charts.today || {};
  const voucherTypes = Array.isArray(charts.voucherTypes)
    ? charts.voucherTypes
    : Object.entries(charts.voucherTypes || {}).map(([name, amount]) => ({ name, receipt: amount, payment: 0 }));
  const maxToday = Math.max(Number(today.receipt || 0), Number(today.payment || 0), 1);
  const receiptTotal = Number(totals.receipt || 0);
  const paymentTotal = Number(totals.payment || 0);
  const netMovement = receiptTotal - paymentTotal;
  const netTone = netMovement >= 0 ? "positive" : "negative";
  const netTitle = netMovement >= 0 ? "Cash / Bank increased" : "Cash / Bank decreased";
  body.innerHTML = `
    <tr>
      <td>
        <div class="rojmel-report-shell">
          <section class="rojmel-story-card ${netTone}">
            <div>
              <span>Owner summary</span>
              <strong>${escapeHtml(netTitle)} by ${escapeHtml(formatReportAmount(Math.abs(netMovement)))}</strong>
              <small>${escapeHtml(transactionRows.length ? `${transactionRows.length} cash/bank transaction row(s) in this period.` : "No cash/bank movement found in this period.")}</small>
            </div>
            <div class="rojmel-story-flow">
              <b class="in">Money In ${escapeHtml(formatReportAmount(receiptTotal))}</b>
              <b class="out">Money Out ${escapeHtml(formatReportAmount(paymentTotal))}</b>
              <b class="${netTone}">Net ${escapeHtml(formatReportAmount(netMovement))}</b>
            </div>
          </section>
          <div class="rojmel-summary-strip">
            ${rojmelMetricCard("Opening Balance", formatReportBalance(totals.openingBalance), "Before selected period", "opening")}
            ${rojmelMetricCard("Money In", formatReportAmount(receiptTotal), `${transactionRows.filter((row) => row.entrySide === "receipt").length} money-in row(s)`, "receipt")}
            ${rojmelMetricCard("Money Out", formatReportAmount(paymentTotal), `${transactionRows.filter((row) => row.entrySide === "payment").length} money-out row(s)`, "payment")}
            ${rojmelMetricCard("Closing Balance", formatReportBalance(totals.closingBalance), `${stats.cashBankLedgers || 0} cash/bank ledger(s)`, "closing")}
          </div>
          <div class="rojmel-section-cards">
            ${sections.length ? sections.map(rojmelSectionCard).join("") : '<div class="rojmel-empty-note">Cash / bank ledger summary not available.</div>'}
          </div>
          <div class="rojmel-chart-panel">
            <div>
              <strong>Money movement in selected period</strong>
              <span>${escapeHtml(netMovement >= 0 ? "Inflow is higher than outflow." : "Outflow is higher than inflow.")}</span>
            </div>
            <div class="rojmel-bars">
              ${rojmelBar("Money In", today.receipt || receiptTotal || 0, maxToday, "receipt")}
              ${rojmelBar("Money Out", today.payment || paymentTotal || 0, maxToday, "payment")}
            </div>
            <div class="rojmel-voucher-chips">
              ${voucherTypes.slice(0, 8).map((item) => `<span>${escapeHtml(item.name || "Other")} ${escapeHtml(formatReportAmount((item.receipt || 0) + (item.payment || 0)))}</span>`).join("")}
            </div>
          </div>
          <div class="rojmel-transaction-panel">
            <div class="rojmel-transaction-title">
              <strong>Cash / Bank Transactions</strong>
              <span>${escapeHtml(transactionRows.length ? "All cash and bank ledger movements from Tally vouchers." : "No entries found for selected period. Balance summary is still shown above.")}</span>
            </div>
            <table class="rojmel-transaction-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Type</th>
                  <th>Voucher</th>
                  <th>Cash / Bank</th>
                  <th>Against</th>
                  <th class="amount">Money In</th>
                  <th class="amount">Money Out</th>
                </tr>
              </thead>
              <tbody>
                ${transactionRows.length ? transactionRows.map(rojmelTransactionRow).join("") : '<tr><td colspan="7" class="empty-cell">No cash/bank transactions in this period.</td></tr>'}
              </tbody>
              <tfoot>
                <tr>
                  <td colspan="5"><strong>Total</strong></td>
                  <td class="amount"><strong>${escapeHtml(formatReportAmount(receiptTotal))}</strong></td>
                  <td class="amount"><strong>${escapeHtml(formatReportAmount(paymentTotal))}</strong></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </td>
    </tr>`;
}

function rojmelMetricCard(label, value, hint, tone = "") {
  return `
    <article class="rojmel-metric-card ${escapeHtml(tone)}">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value || "-")}</strong>
      <small>${escapeHtml(hint || "")}</small>
    </article>`;
}

function rojmelSectionCard(section = {}) {
  const totals = section.totals || {};
  const ledgers = section.ledgers || [];
  return `
    <article class="rojmel-section-card">
      <div>
        <strong>${escapeHtml(section.title || section.name || "Section")}</strong>
        <span>${escapeHtml(`${ledgers.length} ledger(s)`)}</span>
      </div>
      <dl>
        <dt>Opening Balance</dt><dd>${escapeHtml(formatReportBalance(totals.openingBalance))}</dd>
        <dt>Money In</dt><dd class="money-in">${escapeHtml(formatReportAmount(totals.receipt))}</dd>
        <dt>Money Out</dt><dd class="money-out">${escapeHtml(formatReportAmount(totals.payment))}</dd>
        <dt>Closing Balance</dt><dd>${escapeHtml(formatReportBalance(totals.closingBalance))}</dd>
        <dt>Net Movement</dt><dd class="${Number(totals.receipt || 0) - Number(totals.payment || 0) >= 0 ? "money-in" : "money-out"}">${escapeHtml(formatReportAmount(Number(totals.receipt || 0) - Number(totals.payment || 0)))}</dd>
      </dl>
      <ul>
        ${ledgers.slice(0, 6).map((ledger) => `<li><span>${escapeHtml(ledger.ledgerName || ledger.ledger?.name || "-")}</span><b>${escapeHtml(formatReportBalance(ledger.balance ?? ledger.closingBalance))}</b></li>`).join("")}
      </ul>
    </article>`;
}

function rojmelBar(label, value, maxValue, type) {
  const amount = Number(value || 0);
  const width = Math.max(3, Math.min(100, (Math.abs(amount) / Math.max(maxValue || 1, 1)) * 100));
  return `
    <div class="rojmel-bar-line">
      <span>${escapeHtml(label)}</span>
      <i><b class="${escapeHtml(type)}" style="width:${width}%"></b></i>
      <strong>${escapeHtml(formatReportAmount(amount))}</strong>
    </div>`;
}

function rojmelTransactionRow(row = {}) {
  const isPayment = row.entrySide === "payment";
  return `
    <tr class="${isPayment ? "rojmel-payment-row" : "rojmel-receipt-row"}">
      <td>${escapeHtml(formatReportDate(row.date))}</td>
      <td><span class="rojmel-flow-badge ${isPayment ? "out" : "in"}">${isPayment ? "OUT" : "IN"}</span></td>
      <td><strong>${escapeHtml(row.voucherNumber || row.reference || "-")}</strong><small>${escapeHtml(row.voucherType || "")}</small></td>
      <td>${escapeHtml(row.cashBankLedger || row.ledgerName || "-")}</td>
      <td><strong>${escapeHtml(row.againstLedger || "-")}</strong><small>${escapeHtml(row.narration || "")}</small></td>
      <td class="amount">${escapeHtml(formatReportAmount(row.receipt))}</td>
      <td class="amount">${escapeHtml(formatReportAmount(row.payment))}</td>
    </tr>`;
}

function formatReportAmount(value) {
  const amount = Number(value || 0);
  if (!Number.isFinite(amount) || Math.abs(amount) < 0.0001) return "-";
  return amount.toLocaleString("en-IN", { maximumFractionDigits: 2 });
}

function formatReportBalance(value) {
  const amount = Number(value || 0);
  if (!Number.isFinite(amount) || Math.abs(amount) < 0.0001) return "-";
  const suffix = amount < 0 ? "Cr" : "Dr";
  return `${Math.abs(amount).toLocaleString("en-IN", { maximumFractionDigits: 2 })} ${suffix}`;
}

function formatReportDate(value) {
  if (!value) return "-";
  const date = new Date(`${value}T12:00:00`);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("en-IN");
}

function renderBatchExpiryReport() {
  const head = document.getElementById("reportTableHead");
  const body = document.getElementById("reportTableBody");
  const allRows = state.reports.batchExpiryRows || [];
  const rows = getFilteredSortedBatchExpiryRows(allRows);
  const summary = summarizeBatchExpiryRowsForUi(rows);
  const groups = summarizeBatchExpiryGroupsForUi(rows);
  const buckets = summarizeBatchExpiryBucketsForUi(rows);
  if (!head || !body) return;
  head.innerHTML = "";
  if (!allRows.length) {
    body.innerHTML = '<tr><td class="empty-cell">No batch expiry rows loaded. Refresh report after connecting Tally.</td></tr>';
    return;
  }

  body.innerHTML = `
    <tr>
      <td>
        <div class="batch-expiry-shell">
          <section class="batch-expiry-hero">
            <div>
              <span>Product Batch Expiry</span>
              <strong>Stock group wise risk dashboard</strong>
              <small>Seeds, pesticides, fertilizers and other batches from Tally movement.</small>
            </div>
            <div class="batch-expiry-kpis">
              ${batchExpiryKpi("Batches", summary.totalBatches)}
              ${batchExpiryKpi("Balance Qty", formatReportAmount(summary.totalBalanceQty))}
              ${batchExpiryKpi("Expiring 30 days", summary.expiringSoon)}
              ${batchExpiryKpi("Expired", summary.expired)}
            </div>
          </section>
          <section class="batch-expiry-visual-grid">
            <div class="batch-expiry-donut-card">
              <div class="batch-expiry-donut" style="${batchExpiryDonutStyle(groups)}">
                <span>${escapeHtml(String(summary.totalBatches || 0))}</span>
                <small>batches</small>
              </div>
              <div class="batch-expiry-legend">
                ${groups.map((group) => `<span><i style="background:${escapeHtml(group.color || "#0ea5e9")}"></i>${escapeHtml(group.group)} <b>${escapeHtml(String(group.count || 0))}</b></span>`).join("")}
              </div>
            </div>
            <div class="batch-expiry-buckets">
              ${buckets.map(batchExpiryBucketCard).join("")}
            </div>
          </section>
          <section class="batch-expiry-groups">
            ${groups.map(batchExpiryGroupCard).join("")}
          </section>
          ${batchExpiryFilterPanel(allRows, rows)}
          <section class="batch-expiry-table-card">
            <div class="batch-expiry-table-title">
              <strong>Batch Details</strong>
              <span>${escapeHtml(`${rows.length} of ${allRows.length} batch row(s)`)}</span>
            </div>
            <table class="batch-expiry-table">
              <thead>
                <tr>
                  ${batchExpirySortTh("Product", "item")}
                  ${batchExpirySortTh("Batch", "batch")}
                  ${batchExpirySortTh("Type", "type")}
                  ${batchExpirySortTh("Company", "company")}
                  ${batchExpirySortTh("Godown", "godown")}
                  ${batchExpirySortTh("Balance", "balance", "amount")}
                  ${batchExpirySortTh("Expiry", "expiry")}
                  ${batchExpirySortTh("Status", "status")}
                </tr>
              </thead>
              <tbody>${rows.length ? rows.map(batchExpiryRow).join("") : '<tr><td colspan="8" class="empty-cell">No batch rows match selected filters.</td></tr>'}</tbody>
            </table>
          </section>
        </div>
      </td>
    </tr>`;
  bindBatchExpiryControls();
}

function batchExpiryFilterPanel(allRows = [], rows = []) {
  const filters = state.reports.batchExpiryFilters || {};
  const optionSets = {
    type: batchExpiryUniqueOptions(allRows, (row) => row.category || "Others"),
    company: batchExpiryUniqueOptions(allRows, (row) => row.companyName || row.stockCategory || row.stockGroup || ""),
    godown: batchExpiryUniqueOptions(allRows, (row) => row.godownName || ""),
    item: batchExpiryUniqueOptions(allRows, (row) => row.stockItemName || ""),
    status: batchExpiryUniqueOptions(allRows, (row) => row.status || "")
  };
  return `
    <section class="batch-expiry-filter-panel">
      <div>
        <span>Filters</span>
        <strong>${escapeHtml(String(rows.length))}</strong>
        <small>matching batch row(s)</small>
      </div>
      ${batchExpiryFilterSelect("Stock type", "type", optionSets.type, filters.type)}
      ${batchExpiryFilterSelect("Company / category", "company", optionSets.company, filters.company)}
      ${batchExpiryFilterSelect("Godown", "godown", optionSets.godown, filters.godown)}
      ${batchExpiryFilterSelect("Stock item", "item", optionSets.item, filters.item)}
      ${batchExpiryFilterSelect("Status", "status", optionSets.status, filters.status)}
      <button class="mini-button batch-expiry-reset" data-batch-filter-reset type="button">Clear filters</button>
    </section>`;
}

function batchExpiryFilterSelect(label, key, options = [], value = "") {
  return `
    <label>
      <span>${escapeHtml(label)}</span>
      <select data-batch-filter="${escapeHtml(key)}">
        <option value="">All</option>
        ${options.map((option) => `<option value="${escapeHtml(option)}" ${option === value ? "selected" : ""}>${escapeHtml(option)}</option>`).join("")}
      </select>
    </label>`;
}

function batchExpiryUniqueOptions(rows = [], getter) {
  return uniqueValues(rows.map(getter).map((value) => String(value || "").trim()).filter(Boolean))
    .sort((a, b) => a.localeCompare(b));
}

function bindBatchExpiryControls() {
  document.querySelectorAll("[data-batch-filter]").forEach((input) => {
    input.addEventListener("change", (event) => {
      const key = event.target.dataset.batchFilter;
      state.reports.batchExpiryFilters = {
        ...(state.reports.batchExpiryFilters || {}),
        [key]: event.target.value || ""
      };
      renderBatchExpiryReport();
    });
  });
  document.querySelector("[data-batch-filter-reset]")?.addEventListener("click", () => {
    state.reports.batchExpiryFilters = { type: "", company: "", godown: "", item: "", status: "" };
    renderBatchExpiryReport();
  });
  document.querySelectorAll("[data-batch-sort]").forEach((button) => {
    button.addEventListener("click", () => {
      const key = button.dataset.batchSort;
      const current = state.reports.batchExpirySort || {};
      state.reports.batchExpirySort = {
        key,
        direction: current.key === key && current.direction === "asc" ? "desc" : "asc"
      };
      renderBatchExpiryReport();
    });
  });
}

function getFilteredSortedBatchExpiryRows(rows = []) {
  const filters = state.reports.batchExpiryFilters || {};
  const filtered = rows.filter((row) => {
    if (filters.type && row.category !== filters.type) return false;
    if (filters.company && (row.companyName || row.stockCategory || row.stockGroup || "") !== filters.company) return false;
    if (filters.godown && (row.godownName || "") !== filters.godown) return false;
    if (filters.item && (row.stockItemName || "") !== filters.item) return false;
    if (filters.status && (row.status || "") !== filters.status) return false;
    return true;
  });
  const sort = state.reports.batchExpirySort || { key: "expiry", direction: "asc" };
  const direction = sort.direction === "desc" ? -1 : 1;
  return [...filtered].sort((a, b) => direction * compareBatchExpiryRows(a, b, sort.key));
}

function compareBatchExpiryRows(a = {}, b = {}, key = "expiry") {
  if (["balance", "in", "out"].includes(key)) {
    const field = key === "in" ? "inQty" : key === "out" ? "outQty" : "balanceQty";
    return Number(a[field] || 0) - Number(b[field] || 0);
  }
  if (key === "expiry") return (a.daysToExpiry ?? 999999) - (b.daysToExpiry ?? 999999);
  const fields = {
    item: "stockItemName",
    batch: "batchName",
    type: "category",
    company: "companyName",
    godown: "godownName",
    status: "status"
  };
  const field = fields[key] || "stockItemName";
  return String(a[field] || "").localeCompare(String(b[field] || ""));
}

function batchExpirySortTh(label, key, className = "") {
  const sort = state.reports.batchExpirySort || {};
  const marker = sort.key === key ? (sort.direction === "desc" ? " v" : " ^") : "";
  return `<th class="${escapeHtml(className)}"><button class="batch-sort-button" data-batch-sort="${escapeHtml(key)}" type="button">${escapeHtml(label + marker)}</button></th>`;
}

function summarizeBatchExpiryRowsForUi(rows = []) {
  return rows.reduce((total, row) => ({
    totalBatches: total.totalBatches + 1,
    totalInQty: total.totalInQty + Number(row.inQty || 0),
    totalOutQty: total.totalOutQty + Number(row.outQty || 0),
    totalBalanceQty: total.totalBalanceQty + Number(row.balanceQty || 0),
    expired: total.expired + (row.bucketKey === "expired" ? 1 : 0),
    expiringSoon: total.expiringSoon + (row.bucketKey === "days30" ? 1 : 0)
  }), { totalBatches: 0, totalInQty: 0, totalOutQty: 0, totalBalanceQty: 0, expired: 0, expiringSoon: 0 });
}

function summarizeBatchExpiryGroupsForUi(rows = []) {
  const order = ["Seeds", "Pesticides", "Fertilizers", "Others"];
  const map = new Map();
  for (const row of rows) {
    const key = row.category || "Others";
    const current = map.get(key) || {
      group: key,
      color: row.categoryColor || "#0ea5e9",
      count: 0,
      balanceQty: 0,
      expired: 0,
      expiringSoon: 0
    };
    current.count += 1;
    current.balanceQty += Number(row.balanceQty || 0);
    current.expired += row.bucketKey === "expired" ? 1 : 0;
    current.expiringSoon += row.bucketKey === "days30" ? 1 : 0;
    map.set(key, current);
  }
  return [...map.values()].sort((a, b) => order.indexOf(a.group) - order.indexOf(b.group));
}

function summarizeBatchExpiryBucketsForUi(rows = []) {
  const definitions = [
    { key: "expired", label: "Expired", tone: "danger" },
    { key: "days30", label: "0-30 days", tone: "warn" },
    { key: "days90", label: "31-90 days", tone: "busy" },
    { key: "safe", label: "90+ days", tone: "ok" },
    { key: "noExpiry", label: "No expiry", tone: "muted" }
  ];
  return definitions.map((definition) => {
    const matches = rows.filter((row) => row.bucketKey === definition.key);
    return {
      ...definition,
      count: matches.length,
      balanceQty: matches.reduce((sum, row) => sum + Number(row.balanceQty || 0), 0)
    };
  });
}

function batchExpiryKpi(label, value) {
  return `
    <article>
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value ?? "-")}</strong>
    </article>`;
}

function batchExpiryDonutStyle(groups = []) {
  const total = groups.reduce((sum, group) => sum + Number(group.count || 0), 0) || 1;
  let cursor = 0;
  const stops = groups.map((group) => {
    const start = cursor;
    cursor += (Number(group.count || 0) / total) * 100;
    return `${group.color || "#0ea5e9"} ${start.toFixed(2)}% ${cursor.toFixed(2)}%`;
  });
  return `background: conic-gradient(${stops.join(", ") || "#e5edf5 0% 100%"});`;
}

function batchExpiryBucketCard(bucket = {}) {
  return `
    <article class="batch-expiry-bucket ${bucket.tone || ""}">
      <span>${escapeHtml(bucket.label || "-")}</span>
      <strong>${escapeHtml(String(bucket.count || 0))}</strong>
      <small>${escapeHtml(formatReportAmount(bucket.balanceQty || 0))} balance qty</small>
    </article>`;
}

function batchExpiryGroupCard(group = {}) {
  return `
    <article class="batch-expiry-group-card" style="--group-color:${escapeHtml(group.color || "#0ea5e9")}">
      <span>${escapeHtml(group.group || "-")}</span>
      <strong>${escapeHtml(String(group.count || 0))} batch(es)</strong>
      <small>${escapeHtml(formatReportAmount(group.balanceQty || 0))} balance | ${escapeHtml(String(group.expiringSoon || 0))} expiring soon</small>
    </article>`;
}

function batchExpiryRow(row = {}) {
  return `
    <tr>
      <td><strong>${escapeHtml(row.stockItemName || "-")}</strong><small>${escapeHtml(row.stockGroup || "")}</small></td>
      <td><strong>${escapeHtml(row.batchName || "-")}</strong><small>${escapeHtml(row.quantityText || "")}</small></td>
      <td><span class="batch-group-chip ${escapeHtml((row.categoryKey || "other").toLowerCase())}">${escapeHtml(row.category || "Others")}</span></td>
      <td><strong>${escapeHtml(row.companyName || row.stockCategory || "-")}</strong><small>${escapeHtml(row.stockCategory && row.stockCategory !== row.companyName ? row.stockCategory : "")}</small></td>
      <td>${escapeHtml(row.godownName || "-")}</td>
      <td class="amount"><strong>${escapeHtml(formatReportAmount(row.balanceQty))}</strong><small>In ${escapeHtml(formatReportAmount(row.inQty))} | Out ${escapeHtml(formatReportAmount(row.outQty))}</small></td>
      <td><strong>${escapeHtml(row.expiryDateText || row.expiryDate || "-")}</strong><small>${escapeHtml(batchExpiryDaysText(row.daysToExpiry))}</small></td>
      <td><span class="status-pill ${row.statusTone === "danger" ? "status-warn" : row.statusTone === "busy" ? "status-busy" : "status-ok"}">${escapeHtml(row.status || "OK")}</span></td>
    </tr>`;
}

function batchExpiryDaysText(value) {
  if (value === null || value === undefined || value === "") return "No expiry date";
  const days = Number(value);
  if (!Number.isFinite(days)) return "";
  if (days < 0) return `${Math.abs(days)} day(s) ago`;
  return `${days} day(s) left`;
}

function exportActiveReport(format) {
  const active = state.reports.active || "purchase";
  if (!["rojmel", "batchExpiry"].includes(active)) {
    showToast("Excel/PDF export is available for Rojmel and Batch Expiry reports.");
    return;
  }
  const report = active === "rojmel" ? buildRojmelExportReport() : buildBatchExpiryExportReport();
  if (!report.hasData) {
    showToast("Refresh report first, then export.");
    return;
  }
  const fileName = safeFileName(`${report.title}-${report.period || "report"}`);
  if (format === "excel") {
    downloadTextFile(`${fileName}.xls`, buildExcelHtml(report.title, report.html), "application/vnd.ms-excel;charset=utf-8");
    showToast("Excel export downloaded.");
    return;
  }
  openPrintableReport(report.title, report.html);
}

function buildRojmelExportReport() {
  const rows = state.reports.rojmelRows || [];
  const totals = state.reports.rojmelTotals || {};
  const sections = state.reports.rojmelSections || [];
  const transactionRows = rows.filter((row) => row.type === "transaction");
  const period = reportPeriodText();
  const summaryRows = [
    ["Company", selectedCompanyName() || "-"],
    ["Period", period],
    ["Opening Balance", formatReportBalance(totals.openingBalance)],
    ["Money In", formatReportAmount(totals.receipt)],
    ["Money Out", formatReportAmount(totals.payment)],
    ["Closing Balance", formatReportBalance(totals.closingBalance)]
  ];
  const sectionRows = sections.flatMap((section) => {
    const sectionTotals = section.totals || {};
    const ledgers = section.ledgers || [];
    const parent = [[
      section.title || section.name || "Section",
      "Total",
      formatReportBalance(sectionTotals.openingBalance),
      formatReportAmount(sectionTotals.receipt),
      formatReportAmount(sectionTotals.payment),
      formatReportBalance(sectionTotals.closingBalance)
    ]];
    return parent.concat(ledgers.map((ledger) => [
      section.title || section.name || "Section",
      ledger.ledgerName || ledger.ledger?.name || "-",
      formatReportBalance(ledger.openingBalance),
      formatReportAmount(ledger.receipt),
      formatReportAmount(ledger.payment),
      formatReportBalance(ledger.balance ?? ledger.closingBalance)
    ]));
  });
  const transactionTableRows = transactionRows.map((row) => [
    formatReportDate(row.date),
    row.entrySide === "payment" ? "Money Out" : "Money In",
    row.voucherType || "",
    row.voucherNumber || row.reference || "-",
    row.cashBankLedger || row.ledgerName || "-",
    row.againstLedger || "-",
    row.narration || "",
    formatReportAmount(row.receipt),
    formatReportAmount(row.payment)
  ]);
  const html = `
    ${exportTitleBlock("Rojmel Report", period)}
    ${exportTable(["Field", "Value"], summaryRows)}
    ${exportSectionTitle("Cash / Bank Summary")}
    ${exportTable(["Group", "Ledger", "Opening", "Money In", "Money Out", "Closing"], sectionRows.length ? sectionRows : [["-", "-", "-", "-", "-", "-"]])}
    ${exportSectionTitle("Cash / Bank Transactions")}
    ${exportTable(["Date", "Flow", "Voucher Type", "Voucher No.", "Cash / Bank", "Against", "Narration", "Money In", "Money Out"], transactionTableRows.length ? transactionTableRows : [["No transactions", "", "", "", "", "", "", "", ""]])}
  `;
  return { title: "Rojmel Report", period, html, hasData: Boolean(rows.length || sections.length) };
}

function buildBatchExpiryExportReport() {
  const allRows = state.reports.batchExpiryRows || [];
  const rows = getFilteredSortedBatchExpiryRows(allRows);
  const summary = summarizeBatchExpiryRowsForUi(rows);
  const groups = summarizeBatchExpiryGroupsForUi(rows);
  const buckets = summarizeBatchExpiryBucketsForUi(rows);
  const period = reportPeriodText();
  const summaryRows = [
    ["Company", selectedCompanyName() || "-"],
    ["Period", period],
    ["Filtered rows", `${rows.length} of ${allRows.length}`],
    ["Batches", summary.totalBatches],
    ["Balance Qty", formatReportAmount(summary.totalBalanceQty)],
    ["Expiring 30 days", summary.expiringSoon],
    ["Expired", summary.expired]
  ];
  const groupRows = groups.map((group) => [
    group.group || "-",
    group.count || 0,
    formatReportAmount(group.balanceQty),
    group.expired || 0,
    group.expiringSoon || 0
  ]);
  const bucketRows = buckets.map((bucket) => [
    bucket.label || "-",
    bucket.count || 0,
    formatReportAmount(bucket.balanceQty)
  ]);
  const detailRows = rows.map((row) => [
    row.stockItemName || "-",
    row.batchName || "-",
    row.category || "Others",
    row.companyName || row.stockCategory || "-",
    row.stockGroup || "-",
    row.godownName || "-",
    row.quantityText || "",
    formatReportAmount(row.inQty),
    formatReportAmount(row.outQty),
    formatReportAmount(row.balanceQty),
    row.expiryDateText || row.expiryDate || "-",
    batchExpiryDaysText(row.daysToExpiry),
    row.status || "OK"
  ]);
  const html = `
    ${exportTitleBlock("Batch Expiry Report", period)}
    ${exportTable(["Field", "Value"], summaryRows)}
    ${exportSectionTitle("Stock Type Summary")}
    ${exportTable(["Type", "Batches", "Balance Qty", "Expired", "Expiring Soon"], groupRows.length ? groupRows : [["-", "-", "-", "-", "-"]])}
    ${exportSectionTitle("Expiry Risk Summary")}
    ${exportTable(["Bucket", "Batches", "Balance Qty"], bucketRows.length ? bucketRows : [["-", "-", "-"]])}
    ${exportSectionTitle("Batch Details")}
    ${exportTable(["Product", "Batch", "Type", "Company", "Stock Group", "Godown", "Qty Text", "In", "Out", "Balance", "Expiry", "Days", "Status"], detailRows.length ? detailRows : [["No batch rows", "", "", "", "", "", "", "", "", "", "", "", ""]])}
  `;
  return { title: "Batch Expiry Report", period, html, hasData: Boolean(allRows.length) };
}

function exportTitleBlock(title, period) {
  return `
    <header class="export-title">
      <h1>${escapeHtml(title)}</h1>
      <p><strong>Company:</strong> ${escapeHtml(selectedCompanyName() || "-")} &nbsp; <strong>Period:</strong> ${escapeHtml(period || "-")}</p>
      <p><strong>Generated:</strong> ${escapeHtml(new Date().toLocaleString("en-IN"))}</p>
    </header>`;
}

function exportSectionTitle(title) {
  return `<h2>${escapeHtml(title)}</h2>`;
}

function exportTable(headers = [], rows = []) {
  return `
    <table>
      <thead><tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("")}</tr></thead>
      <tbody>
        ${rows.map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell ?? "")}</td>`).join("")}</tr>`).join("")}
      </tbody>
    </table>`;
}

function buildExcelHtml(title, bodyHtml) {
  return `\uFEFF<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(title)}</title>
  <style>
    body { font-family: Arial, sans-serif; color: #111827; }
    h1 { font-size: 20px; margin: 0 0 6px; }
    h2 { font-size: 15px; margin: 18px 0 8px; }
    p { margin: 3px 0; color: #475569; }
    table { border-collapse: collapse; width: 100%; margin-bottom: 12px; }
    th, td { border: 1px solid #cbd5e1; padding: 6px 8px; vertical-align: top; mso-number-format:"\\@"; }
    th { background: #eaf6ff; color: #0f3a5f; font-weight: 700; }
  </style>
</head>
<body>${bodyHtml}</body>
</html>`;
}

function openPrintableReport(title, bodyHtml) {
  const view = window.open("", "_blank", "width=1100,height=800");
  if (!view) {
    showToast("Popup blocked. Allow popup to export PDF.");
    return;
  }
  view.document.open();
  view.document.write(`<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(title)}</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 24px; font-family: Arial, sans-serif; color: #0f172a; }
    .export-title { border-bottom: 2px solid #0ea5e9; margin-bottom: 18px; padding-bottom: 10px; }
    h1 { font-size: 24px; margin: 0 0 6px; }
    h2 { font-size: 16px; margin: 20px 0 8px; color: #075985; }
    p { margin: 4px 0; color: #475569; }
    table { border-collapse: collapse; width: 100%; margin-bottom: 14px; page-break-inside: auto; }
    tr { page-break-inside: avoid; page-break-after: auto; }
    th, td { border: 1px solid #cbd5e1; padding: 7px 8px; font-size: 11px; vertical-align: top; }
    th { background: #eaf6ff; color: #0f3a5f; text-align: left; }
    @media print { body { margin: 12mm; } button { display: none; } }
  </style>
</head>
<body>
  ${bodyHtml}
  <script>
    window.onload = function () {
      window.focus();
      window.print();
    };
  <\/script>
</body>
</html>`);
  view.document.close();
  showToast("PDF print view opened.");
}

function downloadTextFile(fileName, content, mimeType) {
  const blob = new Blob([content], { type: mimeType || "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function reportPeriodText() {
  const fromDate = document.getElementById("reportDateFrom")?.value || "";
  const toDate = document.getElementById("reportDateTo")?.value || "";
  return [fromDate || "Start", toDate || "Today"].join(" to ");
}

function safeFileName(value) {
  return String(value || "report")
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 120) || "report";
}

function renderMonthlyStockReport() {
  const head = document.getElementById("reportTableHead");
  const body = document.getElementById("reportTableBody");
  const rows = state.reports.monthlyStockRows || [];
  if (!head || !body) return;
  updateMonthlyReportSummary(rows);
  head.innerHTML = `
    <tr>
      <th>Sr.</th>
      <th>Crop / Variety</th>
      <th>Class</th>
      <th>Lot Number</th>
      <th>Producer</th>
      <th class="amount">Opening</th>
      <th class="amount">Purchase</th>
      <th class="amount">Total</th>
      <th class="amount">Sale</th>
      <th class="amount">Export</th>
      <th class="amount">Outward</th>
      <th class="amount">Closing</th>
      <th>Remark</th>
    </tr>`;
  if (!rows.length) {
    body.innerHTML = '<tr><td colspan="13" class="empty-cell">No monthly stock report rows loaded.</td></tr>';
    return;
  }
  body.innerHTML = rows.map((row, index) => {
    const key = reportRowKey("monthlyStock", row, index);
    const expanded = state.reports.expandedKey === key;
    return `
      <tr class="report-main-row monthly-stock-row">
        <td><strong>${escapeHtml(row.srNo || index + 1)}</strong></td>
        <td><strong>${escapeHtml(row.cropName || row.stockItemName || "-")}</strong><small>${escapeHtml(row.varietyName || "")}</small></td>
        <td>${escapeHtml(row.seedType || "-")}</td>
        <td><strong>${escapeHtml(row.lotNum || "-")}</strong><small>${escapeHtml([row.packingSize, row.packingUnit].filter(Boolean).join(" "))}</small></td>
        <td><strong>${escapeHtml(row.producerCompany || "-")}</strong></td>
        <td class="amount">${formatReportStock(row.openingStock)}</td>
        <td class="amount">${formatReportStock(row.purchaseStock)}</td>
        <td class="amount">${formatReportStock(row.totalStock)}</td>
        <td class="amount">${formatReportStock(row.saleStock)}</td>
        <td class="amount">${formatReportStock(row.exportStock)}</td>
        <td class="amount">${formatReportStock(row.totalOutward)}</td>
        <td class="amount"><strong>${formatReportStock(row.closingStock)}</strong></td>
        <td>
          <div class="row-actions">
            <span class="${Number(row.closingStock) < 0 ? "status-pill status-warn" : "status-pill status-ok"}">${escapeHtml(row.remarks || "OK")}</span>
            <button class="mini-button" data-report-detail="${escapeHtml(key)}" type="button">${expanded ? "Hide" : "Details"}</button>
          </div>
        </td>
      </tr>
      <tr class="report-detail-row ${expanded ? "" : "hidden"}">
        <td colspan="13">${reportDetailGrid([
      ["Stock item", row.stockItemName],
      ["Packing", [row.packingSize, row.packingUnit].filter(Boolean).join(" ")],
      ["Purchase amount", row.purchaseAmount],
      ["Sale amount", row.saleAmount],
      ["Report unit", "Kg / Litre style stock quantity"],
      ["Key", row.key]
    ])}</td>
      </tr>
    `;
  }).join("");
  bindReportDetailButtons();
}

function renderFormDReport() {
  updateFormDContext();
  const head = document.getElementById("formDTableHead");
  const body = document.getElementById("formDTableBody");
  const rows = state.reports.monthlyStockRows || [];
  if (!head || !body) return;
  updateFormDSummary(rows);
  renderFormDChart(rows);
  head.innerHTML = `
    <tr>
      <th>Sr.</th>
      <th>Crop / Variety</th>
      <th>Class</th>
      <th>Lot Number</th>
      <th>Producer Company</th>
      <th class="amount">Opening</th>
      <th class="amount">Purchase</th>
      <th class="amount">Total</th>
      <th class="amount">Sale</th>
      <th class="amount">Export</th>
      <th class="amount">Sale + Export</th>
      <th class="amount">Closing</th>
      <th>Remark</th>
    </tr>`;
  if (!rows.length) {
    body.innerHTML = '<tr><td colspan="13" class="empty-cell">Generate Form D report.</td></tr>';
    return;
  }
  body.innerHTML = rows.map((row, index) => {
    const key = reportRowKey("formD", row, index);
    const expanded = state.reports.expandedKey === key;
    return `
      <tr class="report-main-row monthly-stock-row">
        <td><strong>${escapeHtml(row.srNo || index + 1)}</strong></td>
        <td><strong>${escapeHtml(row.cropName || row.stockItemName || "-")}</strong><small>${escapeHtml(row.varietyName || "")}</small></td>
        <td>${escapeHtml(row.seedType || "-")}</td>
        <td><strong>${escapeHtml(row.lotNum || "-")}</strong><small>${escapeHtml([row.packingSize, row.packingUnit].filter(Boolean).join(" "))}</small></td>
        <td><strong>${escapeHtml(row.producerCompany || "-")}</strong></td>
        <td class="amount">${formatReportStock(row.openingStock)}</td>
        <td class="amount">${formatReportStock(row.purchaseStock)}</td>
        <td class="amount">${formatReportStock(row.totalStock)}</td>
        <td class="amount">${formatReportStock(row.saleStock)}</td>
        <td class="amount">${formatReportStock(row.exportStock)}</td>
        <td class="amount">${formatReportStock(row.totalOutward)}</td>
        <td class="amount"><strong>${formatReportStock(row.closingStock)}</strong></td>
        <td>
          <div class="row-actions">
            <span class="${Number(row.closingStock) < 0 ? "status-pill status-warn" : "status-pill status-ok"}">${escapeHtml(row.remarks || "OK")}</span>
            <button class="mini-button" data-report-detail="${escapeHtml(key)}" type="button">${expanded ? "Hide" : "Details"}</button>
          </div>
        </td>
      </tr>
      <tr class="report-detail-row ${expanded ? "" : "hidden"}">
        <td colspan="13">${reportDetailGrid([
      ["Stock item", row.stockItemName],
      ["Packing", [row.packingSize, row.packingUnit].filter(Boolean).join(" ")],
      ["Purchase amount", row.purchaseAmount],
      ["Sale amount", row.saleAmount],
      ["Included stock", "Only SATHI-linked lot movement"],
      ["Report key", row.key]
    ])}</td>
      </tr>
    `;
  }).join("");
  bindReportDetailButtons();
}

function renderFormDLoading() {
  updateFormDContext();
  const head = document.getElementById("formDTableHead");
  const body = document.getElementById("formDTableBody");
  if (head) head.innerHTML = "";
  if (body) body.innerHTML = '<tr><td class="empty-cell">Loading Form D report...</td></tr>';
  const chart = document.getElementById("formDChart");
  if (chart) chart.innerHTML = '<div class="empty-state">Preparing stock movement graph...</div>';
}

function renderFormDError(message) {
  const head = document.getElementById("formDTableHead");
  const body = document.getElementById("formDTableBody");
  if (head) head.innerHTML = "";
  if (body) body.innerHTML = `<tr><td class="empty-cell">${escapeHtml(message || "Form D report failed.")}</td></tr>`;
}

function updateFormDContext() {
  const fromDate = document.getElementById("formDDateFrom")?.value || "";
  const toDate = document.getElementById("formDDateTo")?.value || "";
  setText("formDCompanyName", selectedCompanyName() || "-");
  setText("formDLicenceCode", activeLicenceScope()?.clientId || "Not loaded");
  setText("formDPeriodLabel", [fromDate || "Start", toDate || "Today"].join(" to "));
}

function updateFormDSummary(rows = []) {
  const totals = monthlyReportTotals(rows);
  setText("formDOpeningStock", formatReportStock(totals.opening));
  setText("formDPurchaseStock", formatReportStock(totals.purchase));
  setText("formDOutwardStock", formatReportStock(totals.outward));
  setText("formDClosingStock", formatReportStock(totals.closing));
}

function renderFormDChart(rows = []) {
  const chart = document.getElementById("formDChart");
  if (!chart) return;
  const totals = monthlyReportTotals(rows);
  const items = [
    ["Opening", totals.opening, "opening"],
    ["Purchase", totals.purchase, "purchase"],
    ["Sale + Export", totals.outward, "outward"],
    ["Closing", totals.closing, "closing"]
  ];
  const max = Math.max(...items.map(([, value]) => Math.abs(Number(value || 0))), 1);
  chart.innerHTML = rows.length ? `
    <div class="form-d-chart-bars">
      ${items.map(([label, value, tone]) => `
        <div class="form-d-bar-row">
          <span>${escapeHtml(label)}</span>
          <div class="form-d-bar-track"><i class="${escapeHtml(tone)}" style="width:${Math.max(4, Math.min(100, Math.abs(Number(value || 0)) / max * 100))}%"></i></div>
          <strong>${escapeHtml(formatReportStock(value))}</strong>
        </div>
      `).join("")}
    </div>
  ` : '<div class="empty-state">Generate report to see stock movement graph.</div>';
}

function monthlyReportTotals(rows = []) {
  return rows.reduce((summary, row) => ({
    opening: summary.opening + Number(row.openingStock || 0),
    purchase: summary.purchase + Number(row.purchaseStock || 0),
    outward: summary.outward + Number(row.totalOutward || 0),
    closing: summary.closing + Number(row.closingStock || 0)
  }), { opening: 0, purchase: 0, outward: 0, closing: 0 });
}

function updateMonthlyReportSummary(rows = []) {
  const totals = monthlyReportTotals(rows);
  setText("monthlyOpeningStock", formatReportStock(totals.opening));
  setText("monthlyPurchaseStock", formatReportStock(totals.purchase));
  setText("monthlyOutwardStock", formatReportStock(totals.outward));
  setText("monthlyClosingStock", formatReportStock(totals.closing));
}

function formatReportStock(value) {
  const number = Number(value || 0);
  if (!Number.isFinite(number)) return "0";
  return Number(number.toFixed(3)).toString();
}

function renderAdvancedReport(active = state.reports.active) {
  const head = document.getElementById("reportTableHead");
  const body = document.getElementById("reportTableBody");
  if (!head || !body) return;
  const data = advancedReportData(active);
  const rows = getFilteredAdvancedRows(active, data.rows || []);
  head.innerHTML = "";
  if (!state.reports.advancedPack) {
    body.innerHTML = '<tr><td class="empty-cell">Refresh report to load Advanced Reports Pack.</td></tr>';
    return;
  }
  body.innerHTML = `
    <tr>
      <td>
        <div class="advanced-report-shell">
          ${advancedReportHero(active, data.summary || {}, rows.length, data.rows?.length || 0)}
          ${advancedFilterPanel(active, data.rows || [], rows)}
          <section class="advanced-report-list">
            ${rows.length ? rows.map((row, index) => advancedReportRow(active, row, index)).join("") : '<div class="empty-state">No rows match selected filters.</div>'}
          </section>
        </div>
      </td>
    </tr>`;
  bindAdvancedReportControls();
  bindReportDetailButtons();
}

function advancedReportData(active = state.reports.active) {
  const pack = state.reports.advancedPack || {};
  if (active === "farmerDealer") return pack.farmerDealerSales || { rows: [], summary: {} };
  if (active === "licenceStock") return pack.licenceStock || { rows: [], summary: {} };
  if (active === "expiryRisk") return pack.expiryRisk || { rows: [], summary: {} };
  return pack.lotTrace || { rows: [], summary: {} };
}

function advancedReportHero(active, summary = {}, shown = 0, total = 0) {
  const cards = active === "farmerDealer" ? [
    ["Vouchers", summary.vouchers],
    ["Dealer", summary.dealer],
    ["Farmer/Cash", summary.farmer],
    ["Pending", summary.pending],
    ["Amount", formatReportAmount(summary.amount)]
  ] : active === "licenceStock" ? [
    ["Licences", summary.licences],
    ["Items", summary.items],
    ["Inward", formatReportStock(summary.inwardQty)],
    ["Sold", formatReportStock(summary.soldQty)],
    ["Balance", formatReportStock(summary.balanceQty)]
  ] : active === "expiryRisk" ? [
    ["Risk rows", summary.rows],
    ["Expired", summary.expired],
    ["0-30 days", summary.days30],
    ["31-90 days", summary.days90],
    ["Balance", formatReportStock(summary.balanceQty)]
  ] : [
    ["Lots", summary.lots],
    ["Inward", formatReportStock(summary.inwardQty)],
    ["Sold", formatReportStock(summary.soldQty)],
    ["Balance", formatReportStock(summary.balanceQty)],
    ["Review", summary.needsReview]
  ];
  return `
    <section class="advanced-report-hero">
      <div>
        <span>Advanced Reports Pack</span>
        <strong>${escapeHtml(advancedReportTitle(active))}</strong>
        <small>${escapeHtml(`${shown} of ${total} row(s) shown. Scope: ${activeLicenceScope()?.clientId || "-"}`)}</small>
      </div>
      <div class="advanced-report-kpis">
        ${cards.map(([label, value]) => `<article><span>${escapeHtml(label)}</span><strong>${escapeHtml(value ?? 0)}</strong></article>`).join("")}
      </div>
    </section>`;
}

function advancedReportTitle(active) {
  return {
    farmerDealer: "Farmer / Dealer Sale Register",
    lotTrace: "Lot Traceability Report",
    licenceStock: "Licence-wise Stock Report",
    expiryRisk: "Expiry Risk Dashboard"
  }[active] || "Advanced Report";
}

function advancedFilterPanel(active, allRows = [], rows = []) {
  const filters = state.reports.advancedFilters || {};
  const statusOptions = advancedUniqueOptions(allRows, (row) => row.status || row.riskText || (row.issues?.length ? "Needs review" : "OK"));
  const typeOptions = active === "farmerDealer"
    ? advancedUniqueOptions(allRows, (row) => row.buyerType)
    : active === "expiryRisk"
      ? advancedUniqueOptions(allRows, (row) => row.riskLevel || row.riskText)
      : advancedUniqueOptions(allRows, (row) => row.licenceType);
  return `
    <section class="advanced-report-filters">
      <label>
        <span>Search</span>
        <input data-advanced-filter="search" type="search" value="${escapeHtml(filters.search || "")}" placeholder="Order, party, item, batch, licence">
      </label>
      <label>
        <span>Status</span>
        <select data-advanced-filter="status">
          <option value="all">All status</option>
          ${statusOptions.map((option) => `<option value="${escapeHtml(option)}" ${filters.status === option ? "selected" : ""}>${escapeHtml(option)}</option>`).join("")}
        </select>
      </label>
      <label>
        <span>${active === "farmerDealer" ? "Buyer type" : active === "expiryRisk" ? "Risk" : "Licence type"}</span>
        <select data-advanced-filter="type">
          <option value="all">All</option>
          ${typeOptions.map((option) => `<option value="${escapeHtml(option)}" ${filters.type === option ? "selected" : ""}>${escapeHtml(option)}</option>`).join("")}
        </select>
      </label>
      <label>
        <span>Qty</span>
        <select data-advanced-filter="qty">
          <option value="all" ${filters.qty === "all" ? "selected" : ""}>All qty</option>
          <option value="balance" ${filters.qty === "balance" ? "selected" : ""}>Balance only</option>
          <option value="pending" ${filters.qty === "pending" ? "selected" : ""}>Pending/Review only</option>
        </select>
      </label>
      <button class="mini-button" data-advanced-filter-reset type="button">Clear filters</button>
      <strong>${escapeHtml(String(rows.length))}</strong>
    </section>`;
}

function advancedUniqueOptions(rows = [], getter) {
  return uniqueValues(rows.map(getter).map((value) => String(value || "").trim()).filter(Boolean)).sort((a, b) => a.localeCompare(b));
}

function getFilteredAdvancedRows(active, rows = []) {
  const filters = state.reports.advancedFilters || {};
  const search = String(filters.search || "").trim().toLowerCase();
  return rows.filter((row) => {
    const haystack = JSON.stringify(row || {}).toLowerCase();
    if (search && !haystack.includes(search)) return false;
    const statusText = row.status || row.riskText || (row.issues?.length ? "Needs review" : "OK");
    const typeText = active === "farmerDealer" ? row.buyerType : active === "expiryRisk" ? (row.riskLevel || row.riskText) : row.licenceType;
    if (filters.status && filters.status !== "all" && statusText !== filters.status) return false;
    if (filters.type && filters.type !== "all" && typeText !== filters.type) return false;
    if (filters.qty === "balance" && Number(row.balanceQty || 0) <= 0) return false;
    if (filters.qty === "pending" && !(row.pendingRows > 0 || row.issueCount > 0 || row.issues?.length || row.riskTone === "danger" || row.riskTone === "warn")) return false;
    return true;
  });
}

function advancedReportRow(active, row = {}, index = 0) {
  if (active === "farmerDealer") return advancedFarmerDealerRow(row, index);
  if (active === "licenceStock") return advancedLicenceStockRow(row, index);
  if (active === "expiryRisk") return advancedExpiryRiskRow(row, index);
  return advancedLotTraceRow(row, index);
}

function advancedLotTraceRow(row = {}, index = 0) {
  const key = reportRowKey("lotTrace", row, index);
  const expanded = state.reports.expandedKey === key;
  return `
    <article class="advanced-master-card ${row.issues?.length ? "needs-review" : ""}">
      <div class="advanced-master-grid">
        <div><span>Item / Batch</span><strong>${escapeHtml(row.stockItemName || "-")}</strong><small>${escapeHtml(`${row.batchName || "-"} → ${row.sathiBatchNo || "-"}`)}</small></div>
        <div><span>Licence</span><strong>${escapeHtml(row.licenceType || "-")}</strong><small>${escapeHtml(row.licenceNo || "Missing")}</small></div>
        <div><span>Movement</span><strong>${escapeHtml(`In ${formatReportStock(row.inwardQty)} | Sold ${formatReportStock(row.soldQty)}`)}</strong><small>${escapeHtml(`Balance ${formatReportStock(row.balanceQty)}`)}</small></div>
        <div><span>Owner / Packing</span><strong>${escapeHtml(row.originalOwner || "Missing")}</strong><small>${escapeHtml(row.packingSize ? `Packing ${row.packingSize}` : "Packing missing")}</small></div>
        <div><span>Status</span><strong>${escapeHtml(row.status || "-")}</strong><small>${escapeHtml((row.issues || [])[0] || "Trace clean")}</small></div>
        <div class="advanced-actions"><button class="mini-button" data-report-detail="${escapeHtml(key)}" type="button">${expanded ? "Hide" : "Details"}</button></div>
      </div>
      ${expanded ? advancedLotTraceDetail(row) : ""}
    </article>`;
}

function advancedLicenceStockRow(row = {}, index = 0) {
  const key = reportRowKey("licenceStock", row, index);
  const expanded = state.reports.expandedKey === key;
  return `
    <article class="advanced-master-card ${row.mismatchCount ? "needs-review" : ""}">
      <div class="advanced-master-grid">
        <div><span>Licence</span><strong>${escapeHtml(`${row.licenceType || "-"} | ${row.licenceNo || "Missing"}`)}</strong><small>${escapeHtml(`${row.batchCount || 0} batch(es), ${row.activeBatchCount || 0} active`)}</small></div>
        <div><span>Item</span><strong>${escapeHtml(row.stockItemName || "-")}</strong><small>${escapeHtml(row.status || "")}</small></div>
        <div><span>Inward</span><strong>${escapeHtml(formatReportStock(row.inwardQty))}</strong></div>
        <div><span>Sold</span><strong>${escapeHtml(formatReportStock(row.soldQty))}</strong></div>
        <div><span>Balance</span><strong>${escapeHtml(formatReportStock(row.balanceQty))}</strong><small>${escapeHtml(row.mismatchCount ? `${row.mismatchCount} warning(s)` : "OK")}</small></div>
        <div class="advanced-actions"><button class="mini-button" data-report-detail="${escapeHtml(key)}" type="button">${expanded ? "Hide" : "Details"}</button></div>
      </div>
      ${expanded ? advancedBatchCards(row.batches || []) : ""}
    </article>`;
}

function advancedExpiryRiskRow(row = {}, index = 0) {
  const key = reportRowKey("expiryRisk", row, index);
  const expanded = state.reports.expandedKey === key;
  return `
    <article class="advanced-master-card risk-${escapeHtml(row.riskTone || "ok")}">
      <div class="advanced-master-grid">
        <div><span>Risk</span><strong>${escapeHtml(row.riskText || row.status || "-")}</strong><small>${escapeHtml(batchExpiryDaysText(row.daysToExpiry))}</small></div>
        <div><span>Item / Batch</span><strong>${escapeHtml(row.stockItemName || "-")}</strong><small>${escapeHtml(row.batchName || "-")}</small></div>
        <div><span>Balance</span><strong>${escapeHtml(formatReportStock(row.balanceQty))}</strong><small>${escapeHtml(`Sold ${formatReportStock(row.soldQty)}`)}</small></div>
        <div><span>Expiry</span><strong>${escapeHtml(row.expiryDateText || row.expiryDate || "-")}</strong><small>${escapeHtml(row.expectedClearDays ? `Clear in ~${row.expectedClearDays} day(s)` : "No sale speed")}</small></div>
        <div><span>Licence</span><strong>${escapeHtml(row.licenceNo || "Missing")}</strong><small>${escapeHtml(row.licenceType || "")}</small></div>
        <div class="advanced-actions"><button class="mini-button" data-report-detail="${escapeHtml(key)}" type="button">${expanded ? "Hide" : "Details"}</button></div>
      </div>
      ${expanded ? advancedLotTraceDetail(row) : ""}
    </article>`;
}

function advancedFarmerDealerRow(row = {}, index = 0) {
  const key = reportRowKey("farmerDealer", row, index);
  const expanded = state.reports.expandedKey === key;
  return `
    <article class="advanced-master-card ${row.pendingRows ? "needs-review" : ""}">
      <div class="advanced-master-grid">
        <div><span>Voucher</span><strong>${escapeHtml(row.voucherNumber || "-")}</strong><small>${escapeHtml(row.dateText || row.date || "")}</small></div>
        <div><span>Party</span><strong>${escapeHtml(row.partyName || "-")}</strong><small>${escapeHtml(row.partyNameLedgerFound ? row.partyLedgerName || "" : "Ledger missing → farmer/cash")}</small></div>
        <div><span>Type</span><strong>${escapeHtml(row.buyerType || "-")}</strong><small>${escapeHtml(row.buyerLicense || "Buyer licence missing")}</small></div>
        <div><span>Items / Qty</span><strong>${escapeHtml(`${row.itemCount || 0} item(s)`)}</strong><small>${escapeHtml(formatReportStock(row.quantity))}</small></div>
        <div><span>Portal</span><strong>${escapeHtml(row.status || "-")}</strong><small>${escapeHtml(`${row.uploadedRows || 0} uploaded | ${row.pendingRows || 0} pending`)}</small></div>
        <div class="advanced-actions"><button class="mini-button" data-report-detail="${escapeHtml(key)}" type="button">${expanded ? "Hide" : "Details"}</button></div>
      </div>
      ${expanded ? advancedSalesItemCards(row.items || []) : ""}
    </article>`;
}

function advancedLotTraceDetail(row = {}) {
  return `
    <div class="advanced-detail-panel">
      ${reportDetailGrid([
        ["Godown", row.godownName],
        ["Expiry", row.expiryDateText || row.expiryDate],
        ["Inward amount", formatReportAmount(row.inwardAmount)],
        ["Sales amount", formatReportAmount(row.salesAmount)],
        ["Issues", (row.issues || []).join(" | ")]
      ])}
      <div class="advanced-detail-columns">
        <div><strong>Inward Source</strong>${advancedVoucherCards(row.purchaseVouchers || [])}</div>
        <div><strong>Sales Movement</strong>${advancedSalesItemCards(row.salesVouchers || [])}</div>
      </div>
    </div>`;
}

function advancedBatchCards(rows = []) {
  return `<div class="advanced-detail-panel"><div class="advanced-mini-card-grid">${rows.map((row) => `
    <article>
      <strong>${escapeHtml(row.batchName || "-")}</strong>
      <small>${escapeHtml(row.originalOwner || "Owner missing")}</small>
      <span>In ${escapeHtml(formatReportStock(row.inwardQty))} | Sold ${escapeHtml(formatReportStock(row.soldQty))} | Bal ${escapeHtml(formatReportStock(row.balanceQty))}</span>
      <em>${escapeHtml((row.issues || [])[0] || row.status || "OK")}</em>
    </article>`).join("") || '<div class="empty-state">No batch detail.</div>'}</div></div>`;
}

function advancedVoucherCards(rows = []) {
  return `<div class="advanced-mini-card-grid">${rows.map((row) => `
    <article>
      <strong>${escapeHtml(row.voucherNumber || "-")}</strong>
      <small>${escapeHtml(`${row.dateText || row.date || ""} ${row.partyLedgerName || ""}`)}</small>
      <span>${escapeHtml(row.voucherTypeName || "")} | Qty ${escapeHtml(formatReportStock(row.quantity))}</span>
    </article>`).join("") || '<div class="empty-state">No inward rows.</div>'}</div>`;
}

function advancedSalesItemCards(rows = []) {
  return `<div class="advanced-mini-card-grid">${rows.map((row) => `
    <article class="${row.portalPushed ? "ok" : "warn"}">
      <strong>${escapeHtml(row.voucherNumber || row.stockItemName || "-")}</strong>
      <small>${escapeHtml(`${row.dateText || row.date || ""} ${row.partyName || ""}`)}</small>
      <span>${escapeHtml(row.stockItemName || "-")} | ${escapeHtml(row.batchName || "-")} | Qty ${escapeHtml(formatReportStock(row.quantity))}</span>
      <em>${escapeHtml(row.portalPushed ? `Order ${row.portalOrderNo || "-"}` : "Portal pending")}</em>
    </article>`).join("") || '<div class="empty-state">No sales movement.</div>'}</div>`;
}

function bindAdvancedReportControls() {
  document.querySelectorAll("[data-advanced-filter]").forEach((input) => {
    const save = () => {
      const key = input.dataset.advancedFilter;
      const fallback = key === "search" ? "" : "all";
      state.reports.advancedFilters = { ...(state.reports.advancedFilters || {}), [key]: input.value || fallback };
      renderAdvancedReport(state.reports.active);
    };
    input.addEventListener("input", () => {
      if (input.tagName === "INPUT") save();
    });
    input.addEventListener("change", () => {
      save();
    });
  });
  document.querySelector("[data-advanced-filter-reset]")?.addEventListener("click", () => {
    state.reports.advancedFilters = { search: "", status: "all", type: "all", qty: "all" };
    renderAdvancedReport(state.reports.active);
  });
}

function bindReportDetailButtons() {
  document.querySelectorAll("[data-report-detail]").forEach((button) => {
    button.addEventListener("click", () => {
      const key = button.dataset.reportDetail || "";
      state.reports.expandedKey = state.reports.expandedKey === key ? "" : key;
      if (document.querySelector(".tab-panel.active")?.id === "formD") renderFormDReport();
      else renderReports();
    });
  });
}

function reportRowKey(type, row, index) {
  return `${type}:${row.key || row.billNumber || row.voucherNumber || row.reference || row.lotNum || index}`;
}

function reportDetailGrid(values) {
  return `<div class="report-detail-grid">${values.filter(([, value]) => value !== undefined && value !== null && value !== "").map(([label, value]) => `
    <div><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>
  `).join("")}</div>`;
}

function reportGstText(row) {
  return [`CGST ${row.cgst ?? 0}`, `SGST ${row.sgst ?? 0}`, `IGST ${row.igst ?? 0}`].join(" / ");
}

function salesInventorySummary(items = []) {
  return items.map((item) => (
    `${item.stockItemName || "Item"} | Lot ${item.lotNum || "-"} | Qty ${item.quantityText || item.quantity || "-"} | Pack ${item.packingSize || "-"}`
  )).join("; ");
}

function dateInputValue(date) {
  return date.toISOString().slice(0, 10);
}

function openReportAddon(addon) {
  const workspace = document.getElementById("reportAddonWorkspace");
  const title = document.getElementById("reportAddonTitle");
  const text = document.getElementById("reportAddonText");
  const actions = document.getElementById("reportAddonActions");
  const body = document.getElementById("reportAddonBody");
  if (!workspace || !title || !text || !actions || !body) return;

  state.reports.addon = addon;
  state.reports.addonRows = [];
  workspace.classList.remove("hidden");
  workspace.scrollIntoView({ behavior: "smooth", block: "start" });

  const copy = reportAddonCopy(addon);
  title.textContent = copy.title;
  text.textContent = copy.text;
  actions.innerHTML = reportAddonActionsHtml(addon);
  body.innerHTML = reportAddonBodyHtml(addon);
  bindReportAddonActions();
}

function reportAddonCopy(addon) {
  const copies = {
    lotTrace: {
      title: "Lot Trace",
      text: "Find original owner and inward bill trail from locally stored lot trace."
    },
    mismatch: {
      title: "Mismatch Check",
      text: "Show report rows that need attention from currently loaded Sales/Purchase reports."
    },
    returns: {
      title: "Return / Revert Assistant",
      text: "API-ready workspace for return stock and revert support flow."
    },
    stock: {
      title: "Available Lot Stock",
      text: "API-ready workspace for lot/crop/packing/class available stock view."
    },
    audit: {
      title: "Activity Report",
      text: "Support-ready Tally and portal operation history."
    }
  };
  return copies[addon] || { title: "Report Tool", text: "Select a report add-on." };
}

function reportAddonActionsHtml(addon) {
  if (addon === "lotTrace") {
    return `
      <input class="report-addon-input" id="lotTraceSearchInput" type="text" placeholder="Lot number">
      <button class="primary-button" id="runLotTraceToolBtn" type="button">Search</button>`;
  }
  if (addon === "mismatch") {
    return '<button class="primary-button" id="runMismatchToolBtn" type="button">Check Loaded Reports</button>';
  }
  if (addon === "audit") {
    return '<button class="primary-button" id="runAuditToolBtn" type="button">Load Audit</button>';
  }
  return '<span class="log-summary-chip">API integration next</span>';
}

function reportAddonBodyHtml(addon) {
  if (["returns", "stock"].includes(addon)) {
    return `
      <div class="report-placeholder">
        <strong>${escapeHtml(reportAddonCopy(addon).title)} is ready for separate integration.</strong>
        <p>This will use SATHI Swagger endpoints with active licence credentials, without changing current push/pull flows.</p>
      </div>`;
  }
  return '<div class="empty-state">Run this tool to view results.</div>';
}

function bindReportAddonActions() {
  document.getElementById("runLotTraceToolBtn")?.addEventListener("click", loadLotTraceTool);
  document.getElementById("runMismatchToolBtn")?.addEventListener("click", renderMismatchTool);
  document.getElementById("runAuditToolBtn")?.addEventListener("click", loadAuditTool);
}

function scopePayloadFromScope(scope = {}) {
  if (!scope) return null;
  return {
    companyName: selectedCompanyName(),
    clientId: scopeLicenceCode(scope),
    purchaseVoucherTypeName: scope.purchaseVoucherTypeName,
    entryType: scope.entryType || scope.fields?.entryType || document.getElementById("configForm")?.tallyEntryType?.value || "regular",
    salesVoucherTypeName: scopeSalesVoucherTypeName(scope),
    salesVoucherTypeNames: scopeSalesVoucherTypeNames(scope),
    fields: scope.fields || {}
  };
}

async function loadLotTraceTool() {
  const body = document.getElementById("reportAddonBody");
  const lotNum = document.getElementById("lotTraceSearchInput")?.value || "";
  if (!body) return;
  body.innerHTML = '<div class="empty-state">Searching lot trace...</div>';
  try {
    const result = await api("/api/reports/lot-trace", {
      method: "POST",
      body: {
        companyName: selectedCompanyName(),
        lotNum,
        fromDate: document.getElementById("reportDateFrom")?.value || "",
        toDate: document.getElementById("reportDateTo")?.value || "",
        scope: activeScopePayload()
      }
    });
    body.innerHTML = lotTraceToolHtml(result.rows || []);
  } catch (error) {
    body.innerHTML = `<div class="empty-state">${escapeHtml(error.message)}</div>`;
  }
}

function lotTraceToolHtml(rows) {
  if (!rows.length) return '<div class="empty-state">No lot trace found.</div>';
  return `
    <div class="report-mini-list">
      ${rows.map((row) => `
        <article class="report-mini-card">
          <strong>${escapeHtml(row.lotNum || "-")}</strong>
          <span>Original owner: ${escapeHtml(row.originalOwner || "Missing")}</span>
          <span>Item: ${escapeHtml(row.stockItemName || row.portalItemName || "-")}</span>
          <span>Inward bill: ${escapeHtml(row.inwardVoucherNumber || "-")} ${escapeHtml(row.inwardDate || "")}</span>
          <span>Supplier: ${escapeHtml(row.supplierName || "-")}</span>
          <span>Packing: ${escapeHtml(row.packingSize || "-")}</span>
        </article>
      `).join("")}
    </div>`;
}

function renderMismatchTool() {
  const body = document.getElementById("reportAddonBody");
  if (!body) return;
  const purchaseIssues = (state.reports.purchaseRows || []).filter((row) => (
    !row.stockItemName || !row.originalOwner || !row.packingSize
  )).map((row) => ({
    type: "Purchase",
    key: row.billNumber || row.lotNum,
    message: [
      !row.stockItemName ? "Missing Tally item" : "",
      !row.originalOwner ? "Missing original owner" : "",
      !row.packingSize ? "Missing packing size" : ""
    ].filter(Boolean).join(", ")
  }));
  const salesIssues = (state.reports.salesRows || []).filter((row) => (
    !row.buyerLicense || !row.originalOwner || !row.sathiVoucherNumber
  )).map((row) => ({
    type: "Sales",
    key: row.voucherNumber || row.reference,
    message: [
      !row.buyerLicense ? "Missing buyer licence" : "",
      !row.originalOwner ? "Missing original owner" : "",
      !row.sathiVoucherNumber ? "Not pushed to SATHI" : ""
    ].filter(Boolean).join(", ")
  }));
  const rows = [...purchaseIssues, ...salesIssues];
  body.innerHTML = rows.length ? `
    <div class="report-mini-list">
      ${rows.map((row) => `
        <article class="report-mini-card warning">
          <strong>${escapeHtml(row.type)} - ${escapeHtml(row.key || "-")}</strong>
          <span>${escapeHtml(row.message)}</span>
        </article>
      `).join("")}
    </div>` : '<div class="empty-state">No mismatch found in loaded reports.</div>';
}

async function loadAuditTool() {
  const body = document.getElementById("reportAddonBody");
  if (!body) return;
  body.innerHTML = '<div class="empty-state">Loading audit history...</div>';
  try {
    const result = await api("/api/reports/audit", {
      method: "POST",
      body: {
        companyName: selectedCompanyName(),
        fromDate: document.getElementById("reportDateFrom")?.value || "",
        toDate: document.getElementById("reportDateTo")?.value || "",
        scope: activeScopePayload()
      }
    });
    body.innerHTML = auditToolHtml(result.rows || []);
  } catch (error) {
    body.innerHTML = `<div class="empty-state">${escapeHtml(error.message)}</div>`;
  }
}

function auditToolHtml(rows) {
  if (!rows.length) return '<div class="empty-state">No audit rows found.</div>';
  return `
    <div class="report-mini-list">
      ${rows.map((row) => `
        <article class="report-mini-card">
          <strong>${escapeHtml(row.source)} - ${escapeHtml(row.action)}</strong>
          <span>${escapeHtml(row.status || "")} ${escapeHtml(row.voucherNumber || "")}</span>
          <span>${escapeHtml(row.message || "")}</span>
          <span>${escapeHtml(formatDateTime(row.createdAt || ""))}</span>
        </article>
      `).join("")}
    </div>`;
}

function renderPartyMappingReview(bills) {
  const target = document.getElementById("partyMappingReview");
  if (!target) return;
  const uniqueBills = [];
  const seen = new Set();
  for (const bill of bills || []) {
    const key = partyMappingKey(bill);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    uniqueBills.push(bill);
  }

  if (!uniqueBills.length) {
    target.innerHTML = "";
    return;
  }

  const cards = uniqueBills.map((bill, index) => {
    const resolved = resolvePartyLedgerForBill(bill);
    const needsMapping = !resolved.ledgerName;
    const portalName = portalPartyName(bill);
    const detailHtml = `
          <div class="mapping-step">
            <span>Portal party</span>
            <strong>${escapeHtml(portalName)}</strong>
            <small>${escapeHtml(bill.sellerCode || "-")}</small>
          </div>
          <div class="mapping-step mapping-step-control mapping-party-step">
            <label>Tally ledger</label>
            <input
              class="party-review-input${resolved.ledgerName ? " mapped" : ""}"
              data-party-key="${escapeHtml(partyMappingKey(bill))}"
              data-portal-party="${escapeHtml(portalName)}"
              data-party-code="${escapeHtml(bill.sellerCode || "")}"
              value="${escapeHtml(resolved.ledgerName)}"
              placeholder="Select Tally ledger"
              autocomplete="off"
            >
            <div class="party-search-dropdown hidden" role="listbox"></div>
            <small>${escapeHtml(needsMapping ? "Exact match not found. Select local Tally ledger." : "This ledger will be used for purchase entry.")}</small>
          </div>
    `;
    return `
      <article class="party-map-card ${needsMapping ? "needs-map" : "ready-map compact-map-card"}">
        <div class="mapping-card-head ${needsMapping ? "" : "compact-map-head"}">
          <span class="lot-map-number">${index + 1}</span>
          <div>
            <strong>${escapeHtml(portalName)}</strong>
            <small class="${needsMapping ? "" : "compact-map-route"}">${needsMapping
        ? escapeHtml(["Portal seller", bill.sellerCode].filter(Boolean).join(" | "))
        : `<b>Portal</b> ${escapeHtml(portalName)} <span>-></span> <b>Tally</b> ${escapeHtml(resolved.ledgerName)}`}</small>
          </div>
          <span class="${escapeHtml(resolved.className)}">${escapeHtml(resolved.label)}</span>
          ${needsMapping ? "" : `<button class="compact-map-toggle" type="button">Change</button>`}
        </div>
        <div class="party-map-body ${needsMapping ? "" : "compact-map-detail hidden"}">
          ${detailHtml}
        </div>
      </article>
    `;
  }).join("");

  target.innerHTML = `
    <div class="mapping-section-heading party-section-heading">
      <span class="mapping-section-icon">P</span>
      <div>
        <strong>Party Ledger Mapping</strong>
        <small>Map portal supplier name to the correct Tally ledger.</small>
      </div>
      <em>${uniqueBills.length} ${uniqueBills.length === 1 ? "party" : "parties"}</em>
    </div>
    ${cards}
  `;

  document.querySelectorAll(".party-review-input").forEach((input) => {
    input.addEventListener("focus", () => showPartyLedgerSearch(input));
    input.addEventListener("input", () => {
      input.classList.toggle("mapped", Boolean(input.value.trim()));
      showPartyLedgerSearch(input);
      renderMappingReviewStatus(uniqueMappingLots(state.lotBills.filter(belongsToActiveLicence).flatMap((bill) => bill.lotData || [])));
    });
    input.addEventListener("keydown", (event) => {
      if (event.key === "Escape") hidePartyLedgerSearch(input);
    });
    input.addEventListener("blur", () => {
      window.setTimeout(() => hidePartyLedgerSearch(input), 140);
    });
  });
  bindCompactMappingToggles();
  refreshMappingInteractivity({ focusFirst: false });
}

function bindCompactMappingToggles() {
  document.querySelectorAll(".compact-map-toggle").forEach((button) => {
    if (button.dataset.bound === "1") return;
    button.dataset.bound = "1";
    button.addEventListener("click", () => {
      const card = button.closest(".compact-map-card");
      const detail = card?.querySelector(".compact-map-detail");
      if (!detail) return;
      const isHidden = detail.classList.toggle("hidden");
      button.textContent = isHidden ? "Change" : "Hide";
      refreshMappingInteractivity({ focusFirst: !isHidden });
      if (!isHidden) {
        window.setTimeout(() => {
          const input = detail.querySelector(".party-review-input:not(:disabled):not([readonly]), .mapping-review-input:not(:disabled):not([readonly])");
          input?.focus({ preventScroll: true });
        }, 40);
      }
    });
  });
}

function showPartyLedgerSearch(input) {
  const dropdown = input.parentElement?.querySelector(".party-search-dropdown");
  if (!dropdown) return;
  const query = normalizeText(input.value);
  const matches = partyLedgerSearchMatches(query, 80);
  dropdown.innerHTML = matches.length ? matches.map((ledger) => partyLedgerSearchOptionHtml(ledger)).join("") : `
    <div class="stock-search-empty">No Tally ledger found</div>
  `;
  dropdown.classList.remove("hidden");
  ["pointerdown", "mousedown"].forEach((eventName) => {
    dropdown.addEventListener(eventName, (event) => event.preventDefault(), { once: true });
  });

  dropdown.querySelectorAll("[data-party-ledger]").forEach((button) => {
    let picked = false;
    const pickLedger = (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (picked) return;
      picked = true;
      input.value = button.dataset.partyLedger || "";
      input.classList.toggle("mapped", Boolean(input.value.trim()));
      hidePartyLedgerSearch(input);
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.focus({ preventScroll: true });
    };
    ["pointerdown", "mousedown", "click"].forEach((eventName) => {
      button.addEventListener(eventName, pickLedger);
    });
  });
}

function hidePartyLedgerSearch(input) {
  input.parentElement?.querySelector(".party-search-dropdown")?.classList.add("hidden");
}

function partyLedgerSearchMatches(query, limit = 80) {
  const ledgers = state.partyLedgers || [];
  const sorted = [...ledgers].sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));
  const filtered = query
    ? sorted.filter((ledger) => partyLedgerSearchText(ledger).includes(query))
    : sorted;
  return filtered.slice(0, limit);
}

function partyLedgerSearchText(ledger = {}) {
  return normalizeText([
    ledger.name,
    ledger.parent,
    ledger.license,
    ledger.cottonLicense,
    ...(ledger.aliases || [])
  ].filter(Boolean).join(" "));
}

function partyLedgerSearchOptionHtml(ledger = {}) {
  const meta = [
    ledger.parent || "",
    ledger.license ? `Lic: ${ledger.license}` : "",
    ledger.cottonLicense ? `Cotton: ${ledger.cottonLicense}` : ""
  ].filter(Boolean).join(" | ");
  return `
    <button class="stock-search-option" data-party-ledger="${escapeHtml(ledger.name || "")}" type="button" role="option">
      <span>${escapeHtml(ledger.name || "")}</span>
      <small>${escapeHtml(meta)}</small>
    </button>
  `;
}

function collectPartyMappingReviewValues() {
  return Object.fromEntries([...document.querySelectorAll(".party-review-input")].map((input) => [
    input.dataset.partyKey,
    {
      portalPartyName: input.dataset.portalParty || "",
      portalPartyCode: input.dataset.partyCode || "",
      tallyLedgerName: input.value.trim()
    }
  ]).filter(([key, value]) => key && value.tallyLedgerName));
}

function renderItemMappingReview(lots) {
  const list = document.getElementById("mappingReviewList");
  const note = document.getElementById("mappingReviewNote");
  const button = document.getElementById("saveItemMappingsBtn");
  if (!list || !note || !button) return;

  const uniqueLots = uniqueMappingLots(lots);
  if (!uniqueLots.length) {
    list.innerHTML = `
      <div class="mapping-section-heading item-section-heading">
        <span class="mapping-section-icon">I</span>
        <div>
          <strong>Item Mapping</strong>
          <small>Fetch lot details to review item reference.</small>
        </div>
      </div>
      <div class="empty-state">${escapeHtml(t("fetchLotForMapping", "Fetch lot details to review item mapping."))}</div>
    `;
    note.textContent = t("noLotLoaded", "No lot response loaded");
    button.disabled = true;
    return;
  }

  list.innerHTML = `
    <div class="mapping-section-heading item-section-heading">
      <span class="mapping-section-icon">I</span>
      <div>
        <strong>Item Mapping</strong>
        <small>Select the existing Tally item that must be used in the purchase entry.</small>
      </div>
      <em>${uniqueLots.length} ${uniqueLots.length === 1 ? "item" : "items"}</em>
    </div>
    ${uniqueLots.map(itemMappingReviewHtml).join("")}
  `;
  const mappedCount = uniqueLots.filter((lot) => resolveTallyItemForLot(lot)).length;
  const missingParties = activePartyMappingMissingCount();
  note.textContent = missingParties
    ? `${missingParties} party mapping required`
    : mappedCount
      ? `${uniqueLots.length} ${t("sathiItemsReady", "SATHI item(s) ready")} | ${mappedCount} ${t("mappedReferences", "mapped reference(s)")}`
      : `${uniqueLots.length} ${t("sathiItemsReady", "SATHI item(s) ready")}`;
  note.className = missingParties ? "mapping-count-chip warning" : "mapping-count-chip ready";
  button.disabled = false;

  document.querySelectorAll(".mapping-mode-select").forEach((select) => {
    select.addEventListener("change", () => {
      const input = document.querySelector(`.mapping-review-input[data-portal-key="${cssEscape(select.dataset.portalKey)}"]`);
      const lot = uniqueLots.find((item) => portalItemKey(item) === select.dataset.portalKey);
      if (!input || !lot) return;
      if (select.value === "create") {
        input.value = portalItemName(lot);
        input.disabled = true;
      } else {
        input.disabled = false;
        input.value = resolveExistingTallyItemForLot(lot);
      }
      const card = select.closest(".mapping-review-card");
      const unitReadout = card?.querySelector(".mapping-unit-readout");
      const unitEdit = card?.querySelector(".mapping-unit-edit");
      unitReadout?.classList.toggle("hidden", select.value === "create");
      unitEdit?.classList.toggle("hidden", select.value !== "create");
      renderMappingReviewStatus(uniqueLots);
    });
  });

  document.querySelectorAll(".mapping-review-input").forEach((input) => {
    input.addEventListener("focus", () => showStockItemSearch(input));
    input.addEventListener("input", () => {
      renderMappingReviewStatus(uniqueLots);
      showStockItemSearch(input);
    });
    input.addEventListener("keydown", (event) => {
      if (event.key === "Escape") hideStockItemSearch(input);
    });
    input.addEventListener("blur", () => {
      window.setTimeout(() => hideStockItemSearch(input), 140);
    });
  });
  bindCompactMappingToggles();
  refreshMappingInteractivity({ focusFirst: false });
}

function showStockItemSearch(input) {
  const dropdown = input.parentElement?.querySelector(".stock-search-dropdown");
  if (!dropdown) return;
  const query = normalizeText(input.value);
  const matches = stockItemSearchMatches(query, 80);
  dropdown.innerHTML = matches.length ? matches.map((item) => stockItemSearchOptionHtml(item)).join("") : `
    <div class="stock-search-empty">No Tally item found</div>
  `;
  dropdown.classList.remove("hidden");
  ["pointerdown", "mousedown"].forEach((eventName) => {
    dropdown.addEventListener(eventName, (event) => event.preventDefault(), { once: true });
  });

  dropdown.querySelectorAll("[data-stock-item]").forEach((button) => {
    let picked = false;
    const pickItem = (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (picked) return;
      picked = true;
      input.value = button.dataset.stockItem || "";
      input.classList.toggle("mapped", Boolean(input.value.trim()));
      hideStockItemSearch(input);
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.focus({ preventScroll: true });
    };
    ["pointerdown", "mousedown", "click"].forEach((eventName) => {
      button.addEventListener(eventName, pickItem);
    });
  });
}

function hideStockItemSearch(input) {
  input.parentElement?.querySelector(".stock-search-dropdown")?.classList.add("hidden");
}

function stockItemSearchMatches(query, limit = 80) {
  const items = (state.stockItems || []).filter((item) => isCountUnitName(item.baseUnits));
  const sorted = [...items].sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));
  const filtered = query
    ? sorted.filter((item) => stockItemSearchText(item).includes(query))
    : sorted;
  return filtered.slice(0, limit);
}

function stockItemSearchText(item = {}) {
  return normalizeText([
    item.name,
    ...(item.aliases || []),
    item.mappedTallyItemName,
    item.isSathiItem ? "sathi item" : "tally item"
  ].filter(Boolean).join(" "));
}

function stockItemSearchOptionHtml(item = {}) {
  const meta = [
    item.isSathiItem ? "SATHI enabled" : "Tally item",
    cleanUnit(item.baseUnits) || "",
    item.mappedTallyItemName ? `Mapped: ${item.mappedTallyItemName}` : ""
  ].filter(Boolean).join(" | ");
  return `
    <button class="stock-search-option" data-stock-item="${escapeHtml(item.name || "")}" type="button" role="option">
      <span>${escapeHtml(item.name || "")}</span>
      <small>${escapeHtml(meta)}</small>
    </button>
  `;
}

function isCountUnitName(unitName) {
  return /^(bag|bags|nos|no|pcs|pc|piece|pieces|nug|qty|packet|pkt)$/i.test(cleanUnit(unitName));
}

function renderMappingReviewStatus(lots) {
  const note = document.getElementById("mappingReviewNote");
  const values = collectMappingReviewValues();
  const mapped = lots.filter((lot) => values[portalItemKey(lot)]?.tallyItemName);
  const missingParties = activePartyMappingMissingCount();
  note.textContent = missingParties
    ? `${missingParties} party mapping required`
    : mapped.length
      ? `${lots.length} ${t("sathiItemsReady", "SATHI item(s) ready")} | ${mapped.length} ${t("mappedReferences", "mapped reference(s)")}`
      : `${lots.length} ${t("sathiItemsReady", "SATHI item(s) ready")}`;
  note.className = missingParties ? "mapping-count-chip warning" : "mapping-count-chip ready";
}

function activePartyMappingMissingCount() {
  return activeMappingBills().filter((bill) => !partyMappingValueFromScreenOrState(bill)).length;
}

function partyMappingValueFromScreenOrState(bill = {}) {
  const key = partyMappingKey(bill);
  const screenInput = key ? document.querySelector(`.party-review-input[data-party-key="${cssEscape(key)}"]`) : null;
  if (screenInput?.value.trim()) return screenInput.value.trim();
  return resolvePartyLedgerForBill(bill).ledgerName;
}

function uniqueMappingLots(lots) {
  const seen = new Set();
  const unique = [];
  for (const lot of lots || []) {
    const key = portalItemKey(lot);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    unique.push(lot);
  }
  return unique;
}

function collectMappingReviewValues() {
  return Object.fromEntries([...document.querySelectorAll(".mapping-review-input")].map((input) => [
    input.dataset.portalKey,
    enrichItemMappingWithUnits(input, {
      portalName: input.dataset.portalName,
      tallyItemName: input.value.trim(),
      createNew: document.querySelector(`.mapping-mode-select[data-portal-key="${cssEscape(input.dataset.portalKey)}"]`)?.value === "create"
    })
  ]).filter(([key]) => key));
}

async function saveLotMappingsAndContinue() {
  const selectedBills = activeMappingBills();
  const lots = uniqueMappingLots(selectedBills.flatMap((bill) => bill.lotData || []));
  if (!lots.length) {
    showToast("Fetch lot details first.");
    return;
  }

  const mappings = collectMappingReviewValues();
  const partyMappings = collectPartyMappingReviewValues();
  const missingItem = lots.find((lot) => !mappings[portalItemKey(lot)]?.tallyItemName);
  if (missingItem) {
    showToast(`Select existing Tally item for ${portalItemName(missingItem)}.`);
    document.getElementById("itemMappingPanel")?.scrollIntoView({ block: "start", behavior: "smooth" });
    return;
  }
  const invalidItem = lots.find((lot) => {
    const mapping = mappings[portalItemKey(lot)];
    const stockItem = findStockItemByName(mapping?.tallyItemName);
    return !stockItem || !isCountUnitName(stockItem.baseUnits);
  });
  if (invalidItem) {
    showToast(`Select a count-unit Tally item for ${portalItemName(invalidItem)}.`);
    return;
  }
  const missingParty = selectedBills.find((bill) => !partyMappingValueFromScreenOrState(bill));
  if (missingParty) {
    showToast(`Select Tally ledger for ${portalPartyName(missingParty)}.`);
    document.getElementById("partyMappingReview")?.scrollIntoView({ block: "start", behavior: "smooth" });
    return;
  }
  const result = await api("/api/item-mappings", {
    method: "POST",
    body: {
      companyName: selectedCompanyName(),
      mappings
    }
  });
  state.itemMappings = result.mappings || state.itemMappings;
  if (Object.keys(partyMappings).length) {
    const partyResult = await api("/api/party-mappings", {
      method: "POST",
      body: {
        companyName: selectedCompanyName(),
        mappings: partyMappings
      }
    });
    state.partyMappings = partyResult.mappings || state.partyMappings;
  }
  syncOrdersFromLotBills();
  updateVoucherOptions();
  renderOrders();
  renderLotDetails();
  switchTab("orders");
  showToast("SATHI item setup saved. Ready for Tally push.");
}

function openItemMappingReview(voucherNumber = "") {
  if (voucherNumber) state.activeMappingVoucherNumber = voucherNumber;
  if (!activeMappingBills().length) {
    showToast("Fetch lot details first, then review item mapping.");
    return;
  }

  renderLotDetails();
  switchTab("lots");
  window.requestAnimationFrame(() => {
    document.getElementById("itemMappingPanel")?.scrollIntoView({ block: "start", behavior: "smooth" });
  });
}

function syncOrdersFromLotBills() {
  const orders = state.lotBills.filter(belongsToActiveLicence).map((bill) => ({
    voucherNumber: bill.billNumber || bill.voucherNumber,
    voucherDate: bill.billDate,
    sellerCode: bill.sellerCode,
    sellerName: bill.sellerName,
    totalBillPrice: bill.totalBillPrice,
    buyerCode: bill.buyerCode,
    ownerCode: bill.ownerCode,
    locationCode: bill.locationCode
  })).filter((order) => order.voucherNumber);

  const merged = [...state.orders.filter(belongsToActiveLicence)];
  for (const order of orders) {
    const index = merged.findIndex((item) => item.voucherNumber === order.voucherNumber);
    if (index >= 0) merged[index] = { ...merged[index], ...order };
    else merged.unshift(order);
  }
  state.orders = merged;
}

function formatPacking(lot) {
  return [lot.packingSize, lot.packingUnit].filter(Boolean).join(" ");
}

function lotGstPercent(lot = {}) {
  const tax = lot.tax || {};
  const total = Number(tax.cgst || 0) + Number(tax.sgst || 0) + Number(tax.igst || 0);
  return Number.isFinite(total) && total > 0 ? `${total}%` : "0%";
}

function renderErrors() {
  const list = document.getElementById("errorList");
  document.getElementById("errorCount").textContent = state.errors.length;

  if (!state.errors.length) {
    list.innerHTML = '<div class="empty-state">No errors recorded.</div>';
    return;
  }

  list.innerHTML = state.errors.map((error) => `
    <article class="error-card">
      <strong>${escapeHtml(error.source)} - ${escapeHtml(error.message)}</strong>
      <small>${escapeHtml(formatDateTime(error.at))}</small>
      <code>${escapeHtml(JSON.stringify(error.context || {}, null, 2))}</code>
    </article>
  `).join("");
}

function renderArchive() {
  const list = document.getElementById("archiveList");
  if (!list) return;

  if (!state.archive.length) {
    list.innerHTML = '<div class="empty-state">No saved responses yet.</div>';
    document.getElementById("archiveDetail").textContent = "Select a saved response.";
    return;
  }

  list.innerHTML = state.archive.map((entry) => `
    <button class="archive-item" data-archive-id="${escapeHtml(entry.id)}" type="button">
      <span>${escapeHtml(entry.action)}</span>
      <strong>${escapeHtml(entry.voucherNumber || entry.message || "No voucher")}</strong>
      <small>${escapeHtml(formatDateTime(entry.savedAt))}</small>
    </button>
  `).join("");

  document.querySelectorAll(".archive-item").forEach((button) => {
    button.addEventListener("click", () => {
      const entry = state.archive.find((item) => item.id === button.dataset.archiveId);
      document.querySelectorAll(".archive-item").forEach((item) => item.classList.remove("active"));
      button.classList.add("active");
      document.getElementById("archiveDetail").textContent = JSON.stringify(entry, null, 2);
    });
  });
}

function renderTallyLogs() {
  const list = document.getElementById("tallyLogList");
  if (!list) return;

  if (!state.tallyLogs.length) {
    list.innerHTML = '<div class="empty-state">No Tally operations recorded yet.</div>';
    return;
  }

  list.innerHTML = state.tallyLogs.slice(0, 50).map((log) => `
    <article class="tally-log-card ${log.status?.includes("failed") ? "failed" : ""}">
      <div class="tally-log-head">
        <div>
          <span>${escapeHtml(log.action || "")}</span>
          <strong>${escapeHtml(log.voucherNumber || log.companyName || "Tally operation")}</strong>
        </div>
        <span class="${tallyLogStatusClass(log.status)}">${escapeHtml(log.status || "")}</span>
      </div>
      <p>${escapeHtml(log.message || "")}</p>
      <small>${escapeHtml(formatDateTime(log.at))}</small>
    </article>
  `).join("");
}

function renderCompanyUdfs() {
  const body = document.getElementById("companyUdfRows");
  if (!body) return;

  const form = document.getElementById("configForm");
  const selectedCompany = form?.tallyCompanyName?.value || state.config?.tally?.companyName || "";
  const active = activeLicenceScope();
  const fields = active?.fields || {};
  document.getElementById("udfCompanyName").textContent = selectedCompany || "No company selected";
  setText("udfLicenceName", scopeLicenceCode(active) || "Not loaded");
  setText("udfPurchaseVtype", active?.purchaseVoucherTypeName || "-");
  setText("udfSalesVtype", active ? scopeSalesVoucherTypeLabel(active) || "Sales not mapped" : "Sales not mapped");

  if (!active) {
    body.innerHTML = `<tr><td colspan="3" class="empty-cell">Connect Tally and select a licence.</td></tr>`;
    document.getElementById("companyUdfNote").textContent = "No licence scope loaded. Check purchase voucher type setup in Tally.";
    return;
  }

  const rows = [
    ["SATHI API base URL", fields.baseUrl],
    ["API key", maskVisibleSecret(fields.apiKey || "")],
    ["Client ID", fields.clientId || scopeLicenceCode(active)],
    ["Client secret", maskVisibleSecret(fields.clientSecret || "")],
    ["Owner licence", fields.ownerCode],
    ["Location licence", fields.locationCode],
    ["State code", fields.stateCode],
    ["Purchase ledger", fields.purchaseLedgerName || document.getElementById("configForm")?.tallyPurchaseLedgerName?.value || ""],
    ["Purchase godown", fields.godownName || document.getElementById("configForm")?.tallyGodownName?.value || ""],
    ["Purchase voucher type", active.purchaseVoucherTypeName],
    ["Sales voucher type", scopeSalesVoucherTypeLabel(active)]
  ];

  body.innerHTML = rows.map(([label, value]) => {
    const hasValue = Boolean(value);
    return `
      <tr>
        <td>${escapeHtml(label)}</td>
        <td class="udf-value">${escapeHtml(value || "-")}</td>
        <td><span class="${hasValue ? "status-pill status-ok" : "status-pill"}">${hasValue ? "Available" : "Missing"}</span></td>
      </tr>
    `;
  }).join("");

  const missing = rows.filter(([, value]) => !value).length;
  document.getElementById("companyUdfNote").textContent = missing
    ? `${missing} setup value(s) are missing for selected licence.`
    : "Selected licence setup is ready.";
}

function updateSathiSalesSyncFilePanel(scope) {
  const pathElement = document.getElementById("sathiSalesTxtPath");
  const statusElement = document.getElementById("sathiSalesTxtStatus");
  const rebuildButton = document.getElementById("rebuildSathiSalesTxtBtn");
  if (!pathElement || !statusElement) return;

  const filePath = scopeSathiTxtFileLoc(scope || {});
  pathElement.textContent = filePath || "Not configured";
  statusElement.textContent = filePath
    ? "Success sales will be written here for TDL update."
    : "Add SathiTxtFileLoc on mapped sales voucher type.";
  rebuildButton?.toggleAttribute("disabled", !filePath);
}

async function refreshSathiSalesSyncFileStatus() {
  const statusElement = document.getElementById("sathiSalesTxtStatus");
  if (!statusElement) return;
  try {
    const result = await api("/api/tally/sathi-sales-sync-file/status", {
      method: "POST",
      body: { scope: activeScopePayload() }
    });
    setText("sathiSalesTxtPath", result.filePath || "Not configured");
    setText("sathiSalesTxtStatus", result.message || "Status loaded.");
  } catch (error) {
    statusElement.textContent = error.message || "Could not check sales sync file.";
  }
}

async function rebuildSathiSalesSyncFile() {
  try {
    const result = await api("/api/tally/sathi-sales-sync-file/rebuild", {
      method: "POST",
      body: {
        companyName: selectedCompanyName(),
        scope: activeScopePayload()
      }
    });
    setText("sathiSalesTxtPath", result.filePath || "Not configured");
    setText("sathiSalesTxtStatus", result.message || "Sales sync file rebuilt.");
    showToast(result.message || "Sales sync file rebuilt from local DB.");
  } catch (error) {
    showToast(error.message || "Sales sync file rebuild failed.");
  }
}

function maskVisibleSecret(value) {
  const text = String(value || "");
  if (!text) return "";
  if (text.length <= 6) return "*".repeat(text.length);
  return `${text.slice(0, 2)}${"*".repeat(Math.min(text.length - 4, 18))}${text.slice(-2)}`;
}

function tallyLogStatusClass(status) {
  if (String(status || "").includes("failed")) return "status-pill status-warn";
  if (String(status || "").includes("not-found")) return "status-pill";
  return "status-pill status-ok";
}

function tallyResultHtml(result) {
  if (!result) {
    return `
      <div class="tally-result-panel muted-result">
        <strong>Tally result</strong>
        <p>No check or push log is recorded for this voucher yet.</p>
      </div>
    `;
  }

  const summary = result.importSummary ? `
    <div class="mini-summary-grid">
      <div><span>Created</span><strong>${escapeHtml(result.importSummary.created ?? 0)}</strong></div>
      <div><span>Altered</span><strong>${escapeHtml(result.importSummary.altered ?? 0)}</strong></div>
      <div><span>Errors</span><strong>${escapeHtml(result.importSummary.errors ?? 0)}</strong></div>
      <div><span>Verified</span><strong>${result.verification?.exists ? "Yes" : "No"}</strong></div>
    </div>
  ` : "";

  const masterSummary = result.masterResult ? `
    <div class="mini-summary-grid">
      <div><span>Stock master</span><strong>${result.masterResult.stockSummary?.errors ? "Error" : "Synced"}</strong></div>
      <div><span>Units</span><strong>${escapeHtml((result.masterResult.units || []).join(", ") || "-")}</strong></div>
      <div><span>Items</span><strong>${escapeHtml(result.masterResult.items?.length ?? 0)}</strong></div>
      <div><span>Voucher action</span><strong>${escapeHtml(result.log?.mapping?.voucherAction || "-")}</strong></div>
    </div>
  ` : "";

  const lineErrors = result.lineErrors?.length
    ? `<div class="line-error-box">${result.lineErrors.map((item) => `<div>${escapeHtml(item)}</div>`).join("")}</div>`
    : "";
  const aliasConflicts = result.masterResult?.aliasConflicts?.length
    ? `<div class="line-error-box">${result.masterResult.aliasConflicts.map((item) => `<div>${escapeHtml(item.message || `${item.alias} already exists in Tally.`)}</div>`).join("")}</div>`
    : "";
  const createNameConflicts = result.masterResult?.createNameConflicts?.length
    ? `<div class="line-error-box">${result.masterResult.createNameConflicts.map((item) => `<div>${escapeHtml(item.message || "Create new item conflicts with an existing Tally alias.")}</div>`).join("")}</div>`
    : "";
  const firstLineError = String(result.lineErrors?.[0] || "").trim();
  const resultMessage = String(result.message || "").trim();
  const messageHtml = resultMessage && normalizeText(resultMessage) !== normalizeText(firstLineError)
    ? `<p>${escapeHtml(resultMessage)}</p>`
    : "";

  return `
    <div class="tally-result-panel">
      <div class="tally-result-head">
        <div>
          <span>Tally result</span>
          <strong>${escapeHtml(result.status || result.action || "")}</strong>
        </div>
        <span class="${tallyStatusClass(result.status)}">${escapeHtml(result.status || "")}</span>
      </div>
      ${messageHtml}
      ${masterSummary}
      ${summary}
      ${lineErrors}
      ${createNameConflicts}
      ${aliasConflicts}
      <small>Technical request details are not stored in logs.</small>
    </div>
  `;
}

function latestTallyLogForVoucher(voucherNumber) {
  const log = state.tallyLogs.find((item) => item.voucherNumber === voucherNumber);
  if (!log) return null;

  return {
    action: log.action,
    status: displayTallyLogStatus(log.status),
    message: log.message,
    importSummary: log.importSummary,
    masterResult: log.masterResult,
    lineErrors: log.lineErrors || [],
    verification: log.verification,
    log
  };
}

function displayTallyLogStatus(status) {
  if (status === "pushed-and-verified") return "Verified in Tally";
  if (status === "verified") return "Verified in Tally";
  if (status === "partial" || status === "partial-existing" || status === "pushed-partial") return "Partial in Tally";
  if (status === "pushed-not-verified") return "Pushed to Tally";
  if (status === "found") return "Partial in Tally";
  if (status === "not-found") return "Pending for Tally";
  if (status === "skipped-existing") return "Verified in Tally";
  if (status === "failed") return "Push warning";
  return status || "";
}

function updateVoucherOptions() {
  const values = availableVoucherNumbers();
  const datalist = document.getElementById("availableVoucherNumbers");
  const select = document.getElementById("voucherNumberSelect");
  if (!datalist) return;

  datalist.innerHTML = values.map((value) => `<option value="${escapeHtml(value)}"></option>`).join("");
  if (select) {
    select.innerHTML = '<option value="">Select fetched voucher</option>' + values.map((value) => (
      `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`
    )).join("");
  }
}

function availableVoucherNumbers() {
  const values = [
    ...state.orders.filter(belongsToActiveLicence).map((order) => order.voucherNumber),
    ...state.lotBills.filter(belongsToActiveLicence).map((bill) => bill.billNumber || bill.voucherNumber)
  ].filter(Boolean);

  return [...new Set(values)];
}

function updateStockItemDatalist() {
  const datalist = document.getElementById("tallyStockItemsList");
  if (!datalist) return;
  datalist.innerHTML = state.stockItems.map((item) => (
    `<option value="${escapeHtml(item.name)}">${escapeHtml([
      item.isSathiItem ? "SATHI item" : "Tally item",
      item.mappedTallyItemName ? `Mapped: ${item.mappedTallyItemName}` : "",
      unitDisplayText(item.baseUnits, item.additionalUnits, item.conversion, item.denominator)
    ].filter(Boolean).join(" | "))}</option>`
  )).join("");
  const unitList = document.getElementById("tallyUnitsList");
  if (unitList) {
    const units = [...new Set([
      "Kgs", "Kg", "Gms", "Gm", "Nos", "Pcs", "Nug", "Qty",
      ...state.stockItems.flatMap((item) => [item.baseUnits, item.additionalUnits])
    ].map((unit) => String(unit || "").replace(/\u0004/g, "").trim()).filter((unit) => unit && !/not applicable/i.test(unit)))];
    unitList.innerHTML = units.map((unit) => `<option value="${escapeHtml(unit)}"></option>`).join("");
  }
}

function updateGodownDatalist() {
  const datalist = document.getElementById("tallyGodownList");
  if (!datalist) return;
  const names = [...new Set((state.godowns || []).map((godown) => godown.name).filter(Boolean))];
  datalist.innerHTML = names.map((name) => `<option value="${escapeHtml(name)}"></option>`).join("");
}

function selectedCompanyName() {
  return document.querySelector("[name=tallyCompanyName]")?.value || state.config?.tally?.companyName || "";
}

function portalItemKey(lot = {}) {
  return lot.varietyCode || lot.varietyName || lot.cropCode || lot.cropName || lot.lotNum || "";
}

function portalItemName(lot = {}) {
  return [
    cleanItemNamePart(lot.cropName),
    cleanItemNamePart(stripBracketText(lot.varietyName || lot.varietyCode)),
    formatPackingForItemName(lot)
  ].filter(Boolean).join(" ") || lot.lotNum || "SATHI Seed";
}

function portalSalesRowsForDisplay() {
  const showAll = Boolean(document.getElementById("portalShowAllSales")?.checked);
  return (state.portalSalesEntries || [])
    .map((entry, index) => ({ entry, index }))
    .filter(({ entry }) => showAll || portalSalePendingItems(entry).length > 0);
}

function portalSaleSynced(entry = {}) {
  const items = portalDisplayItems(entry, { includeSynced: true });
  if (items.length) return items.every(portalItemSynced);
  return Boolean(String(entry.sathiVchNo || "").trim() || String(entry.sathiStatus || "").trim());
}

function portalItemSynced(item = {}) {
  return Boolean(String(item.portalPushResult || item.sathiPortalPushResult || "").trim());
}

function portalSalePendingItems(entry = {}) {
  return portalDisplayItems(entry, { includeSynced: true }).filter((item) => !portalItemSynced(item));
}

function portalSalePartialSynced(entry = {}) {
  const items = portalDisplayItems(entry, { includeSynced: true });
  return items.some(portalItemSynced) && items.some((item) => !portalItemSynced(item));
}

function portalRowKey(item = {}) {
  return [
    item.stockItemName,
    item.lotNum,
    item.salesBatchNo,
    item.quantityText || item.quantity,
    item.amount
  ].map((value) => String(value || "").trim().toUpperCase()).join("::");
}

function portalSelectionKey(entry = {}) {
  return [
    entry.masterId,
    entry.voucherNumber || entry.reference,
    entry.date
  ].map((value) => String(value || "").trim().toUpperCase()).filter(Boolean).join("::");
}

function selectedPortalItems(entry = {}) {
  const pending = portalSalePendingItems(entry);
  const selection = state.portalSelectedRows[portalSelectionKey(entry)];
  if (!selection) return pending;
  return pending.filter((item) => selection[portalRowKey(item)] !== false);
}

function portalSelectedRowPayload(entry = {}) {
  return selectedPortalItems(entry).map((item) => ({
    stockItemName: item.stockItemName || "",
    batchName: item.lotNum || "",
    lotNum: item.lotNum || "",
    salesBatchNo: item.salesBatchNo || "",
    quantity: Math.abs(Number(item.quantity || 0)),
    quantityText: item.quantityText || "",
    amount: item.amount || "",
    rowKey: portalRowKey(item)
  }));
}

function isYesText(value) {
  return ["YES", "Y", "TRUE", "1"].includes(String(value || "").trim().toUpperCase());
}

function stripBracketText(value) {
  return String(value || "").replace(/\s*\([^)]*\)/g, "").replace(/\s*\[[^\]]*\]/g, "").replace(/\s+/g, " ").trim();
}

function cleanItemNamePart(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function formatPackingForItemName(lot = {}) {
  const packingSize = Number(lot.packingSize || 0);
  if (!Number.isFinite(packingSize) || packingSize <= 0) return "";
  if (packingSize < 1) return `${formatPreviewNumber(packingSize * 1000)} gm`;
  return `${formatPreviewNumber(packingSize)} kg`;
}

function saleQuantityToQtl(quantityText, fallbackQuantity = 0) {
  const text = String(quantityText || "");
  const kgMatch = [...text.matchAll(/(-?\d+(?:\.\d+)?)\s*(?:kg|kgs|kilogram|kilograms)\b/gi)].pop();
  if (kgMatch) return formatPreviewNumber(Number(kgMatch[1]) / 100);

  const gmMatch = [...text.matchAll(/(-?\d+(?:\.\d+)?)\s*(?:gm|gms|gram|grams|g)\b/gi)].pop();
  if (gmMatch) return formatPreviewNumber(Number(gmMatch[1]) / 100000);

  const qtlMatch = [...text.matchAll(/(-?\d+(?:\.\d+)?)\s*(?:qtl|qtls|quintal|quintals)\b/gi)].pop();
  if (qtlMatch) return formatPreviewNumber(Number(qtlMatch[1]));

  return "";
}

function resolveTallyItemForLot(lot = {}) {
  const key = portalItemKey(lot);
  const name = portalItemName(lot);
  const stored = state.itemMappings[key] || state.itemMappings[name];
  if (stored?.createNew) return "";
  if (stored?.tallyItemName) return stored.tallyItemName;
  if (typeof stored === "string") return stored;
  return resolveExistingTallyItemForLot(lot);
}

function resolveExistingTallyItemForLot(lot = {}) {
  const key = portalItemKey(lot);
  const name = portalItemName(lot);
  const normalizedNames = [key, name, lot.varietyName, lot.cropName]
    .filter(Boolean)
    .map(normalizeItemText);
  const exact = state.stockItems.find((item) => (
    [item.name, ...(item.aliases || [])].some((candidate) => normalizedNames.includes(normalizeItemText(candidate)))
  ));
  return exact?.name || "";
}

function unitDisplayText(baseUnit, additionalUnit, conversion, denominator) {
  const base = cleanUnit(baseUnit);
  const additional = cleanUnit(additionalUnit);
  const conv = String(conversion || "").trim();
  const denom = String(denominator || "").trim();
  if (additional && conv) return `${base || "-"} / ${additional} (${conv}${denom && denom !== "1" ? `:${denom}` : ""})`;
  return base || additional || "Unit not set";
}

function tallyQtyPreview(lot = {}, baseUnit, additionalUnit) {
  const unit = choosePreviewUnit(baseUnit, additionalUnit);
  const qty = calculatePreviewQty(lot, unit);
  const kgQty = physicalKgPreviewQty(lot);
  return `${formatPreviewNumber(qty)} ${unit || "unit"} inward | ${formatPreviewNumber(kgQty)} kg stock`;
}

function choosePreviewUnit(baseUnit, additionalUnit) {
  const base = cleanUnit(baseUnit);
  const additional = cleanUnit(additionalUnit);
  if (isKgUnitName(base)) return base;
  if (isKgUnitName(additional)) return additional;
  if (isGramUnitName(base)) return base;
  if (isGramUnitName(additional)) return additional;
  return base || additional || "Nos";
}

function calculatePreviewQty(lot = {}, unitName) {
  const physicalKg = physicalKgPreviewQty(lot);
  if (isGramUnitName(unitName)) return physicalKg * 1000;
  if (isKgUnitName(unitName)) return physicalKg;
  return Number(lot.totalBags || 1);
}

function physicalKgPreviewQty(lot = {}) {
  const packingKg = Number(lot.packingSize || 0) * Number(lot.totalBags || 0);
  if (Number.isFinite(packingKg) && packingKg > 0) return packingKg;
  const totalQty = Number(lot.totalQty || 0);
  if (Number.isFinite(totalQty) && totalQty > 0) return totalQty * 100;
  return Number(lot.totalBags || 1);
}

function enrichItemMappingWithUnits(input, mapping) {
  const key = input.dataset.portalKey;
  const packingConversion = input.dataset.packingSize || document.querySelector(`.mapping-conversion[data-portal-key="${cssEscape(key)}"]`)?.dataset.packingSize || "1";
  if (input.dataset.sathiStandard === "true") {
    const stockItem = findStockItemByName(mapping.tallyItemName);
    return {
      ...mapping,
      createNew: false,
      baseUnit: stockItem?.baseUnits || "",
      additionalUnit: stockItem?.additionalUnits || "",
      conversion: stockItem?.conversion || "",
      denominator: stockItem?.denominator || ""
    };
  }
  if (mapping.createNew) {
    return {
      ...mapping,
      baseUnit: document.querySelector(`.mapping-base-unit[data-portal-key="${cssEscape(key)}"]`)?.value.trim() || "Kgs",
      additionalUnit: document.querySelector(`.mapping-additional-unit[data-portal-key="${cssEscape(key)}"]`)?.value.trim() || "Nos",
      conversion: document.querySelector(`.mapping-conversion[data-portal-key="${cssEscape(key)}"]`)?.value.trim() || packingConversion,
      denominator: "1"
    };
  }

  const stockItem = findStockItemByName(mapping.tallyItemName);
  return {
    ...mapping,
    baseUnit: stockItem?.baseUnits || "",
    additionalUnit: stockItem?.additionalUnits || "",
    conversion: stockItem?.conversion || "",
    denominator: stockItem?.denominator || ""
  };
}

function mappingHasWeightUnit(mapping = {}) {
  if (mapping.createNew) return true;
  return isKgUnitName(mapping.baseUnit) || isKgUnitName(mapping.additionalUnit) || isGramUnitName(mapping.baseUnit) || isGramUnitName(mapping.additionalUnit);
}

function enrichSavedMappingForLot(lot = {}) {
  const itemName = resolveTallyItemForLot(lot);
  const stockItem = findStockItemByName(itemName);
  return {
    tallyItemName: itemName,
    createNew: false,
    baseUnit: stockItem?.baseUnits || "",
    additionalUnit: stockItem?.additionalUnits || "",
    conversion: stockItem?.conversion || "",
    denominator: stockItem?.denominator || ""
  };
}

function cleanUnit(unitName) {
  const unit = String(unitName || "").replace(/\u0004/g, "").trim();
  return /not applicable/i.test(unit) ? "" : unit;
}

function isKgUnitName(unitName) {
  return /^(kg|kgs|kilogram|kilograms)$/i.test(cleanUnit(unitName));
}

function isGramUnitName(unitName) {
  return /^(gm|gms|gram|grams|g)$/i.test(cleanUnit(unitName));
}

function formatPreviewNumber(value) {
  const parsed = Number(value || 0);
  if (!Number.isFinite(parsed)) return "0";
  return Number.isInteger(parsed) ? String(parsed) : String(Number(parsed.toFixed(6)));
}

function cssEscape(value) {
  if (window.CSS?.escape) return window.CSS.escape(value);
  return String(value || "").replace(/"/g, '\\"');
}

function buildBillItemMappings(bill = {}) {
  return Object.fromEntries((bill.lotData || []).map((lot) => {
    const key = portalItemKey(lot);
    const stored = state.itemMappings[key] || state.itemMappings[portalItemName(lot)] || {};
    const packingConversion = String(lot.packingSize || stored.conversion || "1").trim();
    return [key, {
      portalName: portalItemName(lot),
      tallyItemName: resolveTallyItemForLot(lot),
      createNew: false,
      baseUnit: "Nos",
      additionalUnit: "Kgs",
      conversion: !stored.conversion || stored.conversion === "1" ? packingConversion : stored.conversion,
      denominator: "1"
    }];
  }).filter(([key]) => key));
}

function expectedTallyRowsForBill(bill = {}) {
  return (bill?.lotData || [])
    .map((lot) => {
      const stockItemName = resolveTallyItemForLot(lot);
      const batchName = String(lot.lotNum || "").trim();
      if (!stockItemName || !batchName) return null;
      return {
        stockItemName,
        stockItemNames: [stockItemName, portalItemName(lot), lot.varietyName, lot.cropName].filter(Boolean),
        batchName,
        quantity: Number(lot.totalBags || lot.quantity || 0) || 0
      };
    })
    .filter(Boolean);
}

function findMissingItemMappings(bill = {}, mappings = {}) {
  return [];
}

function normalizeText(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizeItemText(value) {
  return normalizeText(value).replace(/\s+/g, "");
}

function updateCompanyOptions(companies, selected) {
  const select = document.getElementById("companySelect");
  const unique = [...new Set(companies.filter(Boolean))];
  select.innerHTML = '<option value="">No company selected</option>' + unique.map((name) => (
    `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`
  )).join("");
  select.value = selected || "";
  updateSidebarCompany(select.value, document.querySelector("[name=tallyUrl]")?.value);
}

function updateSidebarCompany(companyName, tallyUrl) {
  document.getElementById("sidebarCompanyName").textContent = companyName || "No company selected";
  document.getElementById("sidebarTallyUrl").textContent = tallyUrl || "http://127.0.0.1:9000";
  syncActivationRequestAutoFields();
  updateTopScopeBar();
}

function updateTopScopeBar() {
  const scope = activeLicenceScope();
  setText("topScopeCompany", selectedCompanyName() || "No company selected");
  const topSelect = document.getElementById("topLicenceScopeSelect");
  if (topSelect && scopeLicenceCode(scope)) topSelect.value = scopeLicenceCode(scope);
  const licenceType = scope ? scopeLicenceType(scope) : "";
  const licenceCode = scope ? scopeLicenceCode(scope) : "";
  setText("topScopeTitle", scope ? `${licenceType ? licenceType.toUpperCase() : "-"} | ${licenceCode || "-"}` : "-");
  setText("topScopeTitleMeta", scope ? `${scope.purchaseVoucherTypeName || "Purchase"} -> ${scopeSalesVoucherTypeLabel(scope) || "Sales not mapped"}` : "Select a SATHI licence scope.");
  const typeBadge = document.getElementById("topScopeLicenceType");
  if (typeBadge) {
    typeBadge.textContent = licenceType ? licenceType.toUpperCase() : "-";
    typeBadge.dataset.type = licenceType;
  }
  setText("topTallyLicence", currentTallySerialNumber() || "-");
  setText("topScopeVtypes", scope ? `${scope.purchaseVoucherTypeName || "Purchase"} -> ${scopeSalesVoucherTypeLabel(scope) || "Sales not mapped"}` : "-");
  syncActivationRequestAutoFields();
}

function currentTallySerialNumber() {
  return state.tallySerialNumber || state.license?.tallyLicenseNumber || state.license?.license?.tallyLicense || "";
}

function currentMachineId() {
  return state.machineId || "";
}

function currentSathiLicenceNumber() {
  const licenseText = licenseNumberText(state.license || {});
  if (licenseText && licenseText !== "-") return licenseText;
  return scopeLicenceCode(activeLicenceScope()) || state.config?.saathi?.clientId || "";
}

function currentSathiLicenceNumbers() {
  const license = state.license || {};
  const values = Array.isArray(license.licenseNumbers) && license.licenseNumbers.length
    ? license.licenseNumbers
    : currentSathiLicenceNumber().split(",");
  const scopeValues = state.licenceScopes.map(scopeLicenceCode);
  return [...new Set([...values, ...scopeValues].map((item) => String(item || "").trim()).filter(Boolean))];
}

function syncActivationRequestAutoFields() {
  setValue("activationCompanyName", document.getElementById("activationCompanyName")?.value || selectedCompanyName());
  renderActivationSathiLicenceOptions();
  setValue("activationTallySerialNumber", currentTallySerialNumber());
  setValue("activationMachineId", currentMachineId());
  refreshMachineIdFromTallySerial();
}

async function refreshMachineIdFromTallySerial() {
  const source = normalizeMachineIdSource(currentTallySerialNumber());
  if (!source) {
    state.machineId = "";
    state.machineIdSource = "";
    setValue("activationMachineId", "");
    return;
  }

  if (state.machineId && state.machineIdSource === source) {
    setValue("activationMachineId", state.machineId);
    return;
  }

  state.machineIdSource = source;
  setValue("activationMachineId", "Generating...");
  const result = await api("/api/license/machine-id", {
    method: "POST",
    body: { tallySerialNumber: source }
  }).catch(() => ({ machineId: "" }));
  if (state.machineIdSource !== source) return;
  state.machineId = result.machineId || "";
  setValue("activationMachineId", state.machineId);
}

function normalizeMachineIdSource(value) {
  return String(value || "").replace(/\s+/g, "").trim().toUpperCase();
}

function renderActivationSathiLicenceOptions() {
  const target = document.getElementById("activationSathiLicenceOptions");
  if (!target) return;

  const selected = new Set(getSelectedActivationLicences());
  const numbers = currentSathiLicenceNumbers();
  target.innerHTML = numbers.length
    ? numbers.map((number) => {
      const checked = selected.size ? selected.has(number) : number === currentSathiLicenceNumber();
      return `
        <label>
          <input type="checkbox" value="${escapeHtml(number)}" ${checked ? "checked" : ""}>
          ${escapeHtml(number)}
        </label>
      `;
    }).join("")
    : "<span>No SATHI licence loaded.</span>";

  target.querySelectorAll("input[type='checkbox']").forEach((input) => {
    input.addEventListener("change", syncSelectedActivationLicences);
  });
  syncSelectedActivationLicences();
}

function getSelectedActivationLicences() {
  return [...document.querySelectorAll("#activationSathiLicenceOptions input[type='checkbox']:checked")]
    .map((input) => input.value.trim())
    .filter(Boolean);
}

function syncSelectedActivationLicences() {
  setValue("activationSathiLicence", getSelectedActivationLicences().join(", "));
}

async function showActivationRequestForm() {
  if (!currentTallySerialNumber()) {
    setText("activationRequestMessage", "Checking Tally serial number...");
    await testTally({ silent: true, keepSelectedCompany: true }).catch(() => { });
  }
  syncActivationRequestAutoFields();
  await refreshMachineIdFromTallySerial();
  document.getElementById("licenseActivationView")?.classList.add("hidden");
  document.getElementById("activationRequestForm")?.classList.remove("hidden");
  if (!currentMachineId()) {
    setText("activationRequestMessage", "Connect Tally first so Machine ID can be generated.");
  }
  window.setTimeout(() => document.getElementById("activationCustomerName")?.focus(), 0);
}

function hideActivationRequestForm() {
  document.getElementById("activationRequestForm")?.classList.add("hidden");
  document.getElementById("licenseActivationView")?.classList.remove("hidden");
}

function compactError(message) {
  const text = String(message || "Error");
  return text.length <= 44 ? text : `${text.slice(0, 41)}...`;
}

function extractApiMessage(message) {
  const text = String(message || "Error");
  const jsonStart = text.indexOf("{");

  if (jsonStart >= 0) {
    try {
      const parsed = JSON.parse(text.slice(jsonStart));
      if (parsed.message) return parsed.message;
      if (parsed.error) return parsed.error;
    } catch {
      // Fall through to regex cleanup.
    }
  }

  const messageMatch = text.match(/"message"\s*:\s*"([^"]+)"/);
  if (messageMatch) return messageMatch[1];

  return text.replace(/^SATHI billing request failed:\s*/i, "").trim();
}

async function api(url, options = {}) {
  showGlobalLoadingBar();
  try {
    const response = await fetch(url, {
      method: options.method || "GET",
      headers: {
        "Content-Type": "application/json"
      },
      body: options.body ? JSON.stringify(options.body) : undefined
    });

    const data = await response.json();
    if (!response.ok || data.ok === false) {
      if (data.license) {
        state.license = data.license;
        renderLicenseState();
      }
      const error = new Error(data.error?.message || data.message || "Request failed");
      Object.assign(error, data);
      error.license = data.license || null;
      error.isLicenseError = Boolean(data.license);
      error.status = data.status || data.error?.status || "";
      throw error;
    }

    return data;
  } finally {
    hideGlobalLoadingBar();
  }
}

function showGlobalLoadingBar() {
  activeApiRequests += 1;
  document.getElementById("globalLoadingBar")?.classList.remove("hidden");
}

function hideGlobalLoadingBar() {
  activeApiRequests = Math.max(0, activeApiRequests - 1);
  if (activeApiRequests === 0) {
    document.getElementById("globalLoadingBar")?.classList.add("hidden");
  }
}

async function copyElementText(id) {
  const element = document.getElementById(id);
  const text = element?.value || element?.textContent || "";
  await copyText(text);
}

async function copyText(text) {
  if (!text) return;
  await navigator.clipboard.writeText(text);
  showToast("Copied.");
}

function parseJsonEditor(id) {
  const raw = document.getElementById(id).value.trim();
  if (!raw) return {};

  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new Error(`${id} has invalid JSON: ${error.message}`);
  }
}

function setStatus(id, text, className) {
  const element = document.getElementById(id);
  element.textContent = text;
  element.className = className || "";
}

function setValue(id, value) {
  document.getElementById(id).value = value || "";
}

function setFormValue(form, name, value) {
  if (value !== undefined && value !== null && value !== "" && form?.[name]) {
    form[name].value = value;
  }
}

function setText(id, value) {
  const element = document.getElementById(id);
  if (element) element.textContent = value || "";
}

function showToast(message) {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.classList.add("show");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => toast.classList.remove("show"), 3200);
}

function showTallyConnectionPopup(message) {
  const popup = document.getElementById("tallyConnectionPopup");
  if (!popup) return;
  setText("tallyConnectionPopupText", message || "Tally is not connected. Open Tally Prime, keep the target company loaded, then test again.");
  popup.classList.remove("hidden");
  window.setTimeout(() => document.getElementById("popupTestTallyBtn")?.focus(), 0);
}

function hideTallyConnectionPopup() {
  document.getElementById("tallyConnectionPopup")?.classList.add("hidden");
}

function isTallyNotConnectedError(error = {}) {
  const message = String(error.message || "");
  return error.status === "tally_not_connected" || /Tally is not reachable|Tally is not connected|Open Tally Prime/i.test(message);
}

function showApiErrorToast(error, fallback) {
  showToast(error?.isLicenseError || error?.status ? error.message : fallback);
}

function debounce(callback, wait) {
  let timer;
  return (...args) => {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => callback(...args), wait);
  };
}

function formatOrderDate(value) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function formatDateTime(value) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

async function loadLicenseStatus() {
  const result = await api("/api/license/status");
  state.license = result.license;
  renderLicenseState();
  if (state.license?.status === "tally_not_connected" || state.license?.tallyConnected === false) {
    showTallyConnectionPopup(state.license.message);
  } else {
    hideTallyConnectionPopup();
  }
}

function isLicenseActive() {
  return Boolean(state.license?.activated && !state.license?.expired && state.license?.status !== "tally_not_connected" && state.license?.tallyConnected !== false);
}

function isEducationalAllowed() {
  return false;
}
function renderActivationScopes() {
  const list = document.getElementById("activationScopeList");
  if (!list) return;

  if (!state.licenceScopes.length) {
    list.innerHTML = '<div class="empty-state">Connect Tally to load available SATHI licenses.</div>';
    return;
  }

  list.innerHTML = state.licenceScopes.map((scope) => {
    const fields = scope.fields || {};
    const isActive = scope.clientId && scope.clientId === state.activeScopeClientId;
    const licenceType = scopeLicenceType(scope);
    return `
      <article class="available-license-card ${isActive ? "active" : ""}">
        <div>
          <span>${escapeHtml(scope.purchaseVoucherTypeName || "Purchase scope")}</span>
          <strong><em class="licence-mini-type" data-type="${escapeHtml(licenceType)}">${escapeHtml(licenceType.toUpperCase())}</em>${escapeHtml(scope.clientId || fields.clientId || "No client ID")}</strong>
        </div>
        <small>${escapeHtml(scope.salesVoucherTypeName || "Sales not mapped")}</small>
        <button class="copy-button" data-copy-value="${escapeHtml(scope.clientId || fields.clientId || "")}" type="button">Copy</button>
      </article>
    `;
  }).join("");

  list.querySelectorAll("[data-copy-value]").forEach((button) => {
    button.addEventListener("click", async () => {
      const value = button.dataset.copyValue || "";
      if (!value) return;
      await navigator.clipboard.writeText(value);
      showToast("Copied.");
    });
  });
}
// function renderLicenseState(options = {}) {
//   const license = state.license || {};
//   const developerCode = "FSCP-260530-00";
//   const rightSystemPartnerCode = "FSCP-260525-007";
//   const partnerCode = String(license.partnerCode || "").trim();
//   const partnerName = String(license.partnerFirmName || license.license?.partnerFirmName || license.partnerName || license.license?.partnerName || "").trim();
//   const supportContacts = licenseSupportContactsText(license);
//   const tallyNotConnected = license.status === "tally_not_connected" || license.tallyConnected === false;
//   const tallyMismatch = license.status === "tally_mismatch";
//   const tallyEducational = license.status === "tally_educational";
//   const machineMismatch = license.status === "machine_mismatch";
//   const dateValidationError = ["clock_rollback", "suspicious_forward_jump", "internet_required_first", "internet_required_reverify"].includes(license.status);
//   const expired = license.expired || license.status === "expired";
//   const active = isLicenseActive();
//   const showLicenseBanner = !active && !tallyNotConnected && !license.suppressLicenseBanner;
//   const inactiveLabel = dateValidationError ? "Date validation failed" : machineMismatch ? "Machine ID mismatch" : tallyEducational ? "Tally educational" : tallyMismatch ? "Tally SNO mismatch" : expired ? "Expired" : "Not activated";
//   const inactiveMessage = license.message || (active ? "License is active." : "Import a valid license file.");

//   document.getElementById("licenseScreen")?.classList.toggle("hidden", !options.forceScreen);
//   document.getElementById("licenseBanner")?.classList.toggle("hidden", !showLicenseBanner);
//   document.getElementById("sidebarAssociationLabel")?.classList.toggle("hidden", !partnerName);
//   document.getElementById("sidebarPartnerName")?.classList.toggle("hidden", !partnerName);
//   setText("sidebarPartnerName", partnerName);
//   document.getElementById("sidebarSupportLine")?.classList.toggle("hidden", !supportContacts);
//   setText("sidebarSupportContacts", supportContacts);
//   const sidebarLicenseStatus = document.getElementById("licence-activated-span");
//   sidebarLicenseStatus?.classList.toggle("active", active);
//   sidebarLicenseStatus?.classList.toggle("expired", !active && (expired || tallyMismatch || tallyEducational || machineMismatch || dateValidationError) && !tallyNotConnected);

//   setText("licenseTallyNumber", license.tallyLicenseNumber || "-");
//   renderLicenseScopeChips(license);
//   setText("sidebarLicenseStatus", tallyNotConnected ? "Tally not connected" : active ? "Active" : inactiveLabel);
//   setText(
//     "sidebarLicenseMeta",
//     tallyNotConnected
//       ? license.message || "Open Tally Prime to verify license."
//       : active
//       ? license.expiresAt ? `Valid until ${license.expiresAt}` : "License is active."
//       : inactiveMessage
//   );
//   setText("licensePanelStatus", tallyNotConnected ? "Tally not connected" : active ? "Active" : inactiveLabel);
//   setText("licensePanelExpiry", license.expiresAt || "-");
//   setText("licensePanelNumbers", licenseNumberText(license));
//   setText("licensePanelTally", license.tallyLicenseNumber || "-");
//   setText("licensePanelClientId", license.saathiClientId || "-");
//   setText("licensePanelMessage", tallyNotConnected ? license.message || "Open Tally Prime to verify license." : inactiveMessage);
//   document.getElementById("licensePanelStatus")?.classList.toggle("success", active);
//   document.getElementById("licensePanelStatus")?.classList.toggle("danger", !active && !tallyNotConnected);

//   setText("licenseBannerTitle", dateValidationError ? "Date validation failed" : machineMismatch ? "Machine ID mismatch" : tallyEducational ? "Tally educational mode" : tallyMismatch ? "Tally SNO mismatch" : expired ? "License expired" : "License not activated");
//   setText(
//     "licenseBannerText",
//     dateValidationError
//       ? inactiveMessage
//       : machineMismatch
//       ? inactiveMessage
//       : tallyEducational
//       ? inactiveMessage
//       : tallyMismatch
//       ? inactiveMessage
//       : expired
//       ? "Import a renewed license file to continue."
//       : "SATHI API calls are blocked until license is active."
//   );

//   setText("licenseScreenTitle", tallyNotConnected ? "Tally not connected" : dateValidationError ? "Date validation failed" : machineMismatch ? "Machine ID mismatch" : tallyEducational ? "Tally educational mode" : tallyMismatch ? "Tally SNO mismatch" : expired ? "License expired" : active ? "License active" : "License not activated");
//   setText("licenseScreenText", license.message || "Import a valid license file to continue.");
//   syncActivationRequestAutoFields();
//   updateTopScopeBar();
// }

function renderLicenseState(options = {}) {
  const license = state.license || {};
  console.log('lic : ', license);

  const arinfotechCode = "FSCP-260530-009";
  const rightSystemCode = "FSCP-260525-007";
  const partnerCode = String(license.partnerId || "").trim();
  const showAssosiation = Boolean(partnerCode === rightSystemCode);
  const showDeveloper = Boolean(partnerCode === arinfotechCode || partnerCode === rightSystemCode);
  
  const partnerName = String(license.partnerFirmName || license.license?.partnerFirmName || license.partnerName || license.license?.partnerName || "").trim();
  const supportContacts = licenseSupportContactsText(license);
  const tallyNotConnected = license.status === "tally_not_connected" || license.tallyConnected === false;
  const tallyMismatch = license.status === "tally_mismatch";
  const tallyEducational = license.status === "tally_educational";
  const machineMismatch = license.status === "machine_mismatch";
  const dateValidationError = ["clock_rollback", "suspicious_forward_jump", "internet_required_first", "internet_required_reverify"].includes(license.status);
  const expired = license.expired || license.status === "expired";
  const active = isLicenseActive();
  const showLicenseBanner = !active && !tallyNotConnected && !license.suppressLicenseBanner;
  const inactiveLabel = dateValidationError ? "Date validation failed" : machineMismatch ? "Machine ID mismatch" : tallyEducational ? "Tally educational" : tallyMismatch ? "Tally SNO mismatch" : expired ? "Expired" : "Not activated";
  const inactiveMessage = license.message || (active ? "License is active." : "Import a valid license file.");
  
  document.getElementById("licenseScreen")?.classList.toggle("hidden", !options.forceScreen);
  document.getElementById("licenseBanner")?.classList.toggle("hidden", !showLicenseBanner);
  document.querySelectorAll(".dev").forEach(el => { el.classList.toggle("hidden", !showDeveloper); });
  document.querySelectorAll(".ass").forEach(el => { el.classList.toggle("hidden", !showAssosiation); });
  if (showAssosiation) {
    setText("sidebarPartnerName", partnerName);
    setText("sidebarSupportContacts", supportContacts);
  }
  const sidebarLicenseStatus = document.getElementById("licence-activated-span");
  sidebarLicenseStatus?.classList.toggle("active", active);
  sidebarLicenseStatus?.classList.toggle("expired", !active && (expired || tallyMismatch || tallyEducational || machineMismatch || dateValidationError) && !tallyNotConnected);

  setText("licenseTallyNumber", license.tallyLicenseNumber || "-");
  renderLicenseScopeChips(license);
  setText("sidebarLicenseStatus", tallyNotConnected ? "Tally not connected" : active ? "Active" : inactiveLabel);
  setText(
    "sidebarLicenseMeta",
    tallyNotConnected
      ? license.message || "Open Tally Prime to verify license."
      : active
        ? license.expiresAt ? `Valid until ${license.expiresAt}` : "License is active."
        : inactiveMessage
  );
  setText("licensePanelStatus", tallyNotConnected ? "Tally not connected" : active ? "Active" : inactiveLabel);
  setText("licensePanelExpiry", license.expiresAt || "-");
  setText("licensePanelNumbers", licenseNumberText(license));
  setText("licensePanelTally", license.tallyLicenseNumber || "-");
  setText("licensePanelClientId", license.saathiClientId || "-");
  setText("licensePanelMessage", tallyNotConnected ? license.message || "Open Tally Prime to verify license." : inactiveMessage);
  document.getElementById("licensePanelStatus")?.classList.toggle("success", active);
  document.getElementById("licensePanelStatus")?.classList.toggle("danger", !active && !tallyNotConnected);

  setText("licenseBannerTitle", dateValidationError ? "Date validation failed" : machineMismatch ? "Machine ID mismatch" : tallyEducational ? "Tally educational mode" : tallyMismatch ? "Tally SNO mismatch" : expired ? "License expired" : "License not activated");
  setText(
    "licenseBannerText",
    dateValidationError
      ? inactiveMessage
      : machineMismatch
        ? inactiveMessage
        : tallyEducational
          ? inactiveMessage
          : tallyMismatch
            ? inactiveMessage
            : expired
              ? "Import a renewed license file to continue."
              : "SATHI API calls are blocked until license is active."
  );

  setText("licenseScreenTitle", tallyNotConnected ? "Tally not connected" : dateValidationError ? "Date validation failed" : machineMismatch ? "Machine ID mismatch" : tallyEducational ? "Tally educational mode" : tallyMismatch ? "Tally SNO mismatch" : expired ? "License expired" : active ? "License active" : "License not activated");
  setText("licenseScreenText", license.message || "Import a valid license file to continue.");
  syncActivationRequestAutoFields();
  updateTopScopeBar();
}

function licenseSupportContactsText(license = {}) {
  const nested = license.license || {};
  const contacts = uniqueValues([
    ...normalizeSupportContacts(license.partnerSupportContacts),
    ...normalizeSupportContacts(nested.partnerSupportContacts),
    ...(Array.isArray(license.supportContacts) ? license.supportContacts : []),
    ...(Array.isArray(nested.supportContacts) ? nested.supportContacts : [])
  ].map((contact) => typeof contact === "string" ? contact.trim() : contact));
  const contactText = contacts.map(formatSupportContact).filter(Boolean).join(" | ");
  if (contactText) return contactText;

  return [
    license.supportContact || nested.supportContact,
    license.supportPhone || nested.supportPhone,
    license.supportEmail || nested.supportEmail
  ].filter(Boolean).map((value) => String(value).trim()).filter(Boolean).join(" | ");
}

function uniqueValues(values = []) {
  const seen = new Set();
  const unique = [];
  for (const value of values) {
    const key = typeof value === "string" ? value.trim() : JSON.stringify(value || {});
    if (!key || seen.has(key)) continue;
    seen.add(key);
    unique.push(value);
  }
  return unique;
}

function normalizeSupportContacts(value) {
  if (Array.isArray(value)) return value;
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function formatSupportContact(contact) {
  if (typeof contact === "string") return contact.trim();
  if (!contact || typeof contact !== "object") return "";
  return [
    contact.name,
    contact.phone || contact.mobile,
    contact.email
  ].filter(Boolean).map((value) => String(value).trim()).filter(Boolean).join(" - ");
}

function renderLicenseScopeChips(license = {}) {
  const target = document.getElementById("licenseScopeChips");
  if (!target) return;
  const numbers = Array.isArray(license.licenseNumbers) && license.licenseNumbers.length
    ? license.licenseNumbers
    : String(license.licenseNumber || license.saathiClientId || "").split(",");
  const cleanNumbers = numbers.map((item) => String(item || "").trim()).filter(Boolean);
  target.innerHTML = cleanNumbers.length
    ? cleanNumbers.map((item) => `<span>${escapeHtml(item)}</span>`).join("")
    : "<span>-</span>";
}

function licenseNumberText(license = {}) {
  const numbers = Array.isArray(license.licenseNumbers) ? license.licenseNumbers : [];
  return numbers.length ? numbers.join(", ") : license.licenseNumber || license.saathiClientId || "-";
}

async function activateLicenseFromFile(inputId = "licenseFileInput") {
  const file = document.getElementById(inputId)?.files?.[0] || document.getElementById("licenseFileInput")?.files?.[0];
  if (!file) {
    showToast("Select a license file first.");
    return;
  }

  try {
    const content = await file.text();
    const result = await api("/api/license/activate", {
      method: "POST",
      body: { content }
    });

    state.license = result.license;
    renderLicenseState();
    showToast("License imported.");
  } catch (error) {
    if (error.license) state.license = error.license;
    else if (error.status) {
      state.license = {
        ...(state.license || {}),
        activated: false,
        expired: false,
        status: error.status,
        message: error.message || "License activation failed."
      };
    }
    renderLicenseState();
    setText("licensePanelMessage", error.message || "License activation failed.");
    setText("licenseScreenText", error.message || "License activation failed.");
    showToast(error.message || "License activation failed.");
  }
}

async function sendActivationRequest(event) {
  event.preventDefault();
  syncActivationRequestAutoFields();
  await refreshMachineIdFromTallySerial();
  const form = event.currentTarget;
  const body = Object.fromEntries(new FormData(form).entries());
  const button = form.querySelector("button[type='submit']");
  if (!validateActivationRequest(body)) return;

  button.disabled = true;
  setText("activationRequestMessage", "Sending activation request...");
  try {
    const result = await api("/api/license/activation-request", {
      method: "POST",
      body
    });
    setText("activationRequestMessage", result.message || "Activation request sent.");
    showToast("Activation request sent.");
    form.reset();
    syncActivationRequestAutoFields();
    hideActivationRequestForm();
  } catch (error) {
    setText("activationRequestMessage", error.message || "Activation request failed.");
    showToast(error.message || "Activation request failed.");
  } finally {
    button.disabled = false;
  }
}

function validateActivationRequest(body = {}) {
  const requiredFields = [
    ["customerName", "Enter customer name."],
    ["companyName", "Enter company name."],
    ["email", "Enter customer email."],
    ["phone", "Enter phone number."],
    ["sathiLicence", "SATHI licence is not available."],
    ["partnerId", "Enter partner ID."]
  ];
  for (const [key, message] of requiredFields) {
    if (!String(body[key] || "").trim()) {
      setText("activationRequestMessage", message);
      showToast(message);
      return false;
    }
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(body.email || "").trim())) {
    setText("activationRequestMessage", "Enter a valid email address.");
    showToast("Enter a valid email address.");
    return false;
  }
  if (!/^[+\d][\d\s()+-]{6,}$/.test(String(body.phone || "").trim())) {
    setText("activationRequestMessage", "Enter a valid phone number.");
    showToast("Enter a valid phone number.");
    return false;
  }
  return true;
}

async function clearLicense() {
  const ok = window.confirm("Clear the activated license from this computer?");
  if (!ok) return;

  try {
    const result = await api("/api/license", { method: "DELETE" });
    state.license = result.license;
    renderLicenseState();
    showToast("License cleared.");
  } catch (error) {
    showToast(error.message || "License clear failed.");
  }
}

document.getElementById("activateLicenseBtn")?.addEventListener("click", () => activateLicenseFromFile("licenseFileInput"));
document.getElementById("openLicenseScreenBtn")?.addEventListener("click", () => switchTab("license"));
document.getElementById("closeLicenseScreenBtn")?.addEventListener("click", () => renderLicenseState());
