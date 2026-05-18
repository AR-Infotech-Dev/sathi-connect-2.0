const state = {
  config: null,
  orders: [],
  lotBills: [],
  tallyStatuses: {},
  tallyResults: {},
  tallyLogs: [],
  stockItems: [],
  itemMappings: {},
  portalSalesEntries: [],
  expandedPortalSale: "",
  expandedOrder: "",
  reports: {
    active: "purchase",
    expandedKey: "",
    addon: "",
    purchaseRows: [],
    salesRows: [],
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
  license: null
};

const titles = {
  dashboard: "Dashboard",
  orders: "SATHI to Tally",
  portalPush: "Tally to SATHI",
  reports: "Reports",
  lots: "Item Mapping",
  archive: "Archive",
  settings: "Settings",
  companyUdfs: "Tally Setup",
  license: "License",
  errors: "Issues"
};

const languageStorageKey = "sathiConnectLanguage";
const themeStorageKey = "sathiConnectTheme";
const licenceScopeStorageKey = "sathiConnectActiveLicence";
let currentLanguage = loadSavedLanguage();
let currentTheme = loadSavedTheme();
let apiProgressTimer = null;
let apiProgressShownAt = 0;
let activeApiRequests = 0;
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
  navLots: "Item Mapping",
  navArchive: "जुने Response",
  navSettings: "सेटिंग",
  navTallySetup: "Tally Setup",
  navIssues: "अडचणी",
  activeCompany: "चालू कंपनी",
  testTally: "Tally तपासा",
  developedBy: "Developed by",
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
  pushQueueTitle: "Create Tally Bills",
  pushQueueText: "SATHI lots ready for Tally purchase entry appear here.",
  clear: "Clear",
  reviewMapping: "Mapping तपासा",
  checkTallyStatus: "Tally status तपासा",
  bulkPush: "सर्व Push करा",
  fetchOrders: "Orders Fetch करा",
  thVoucher: "Voucher No.",
  thParty: "Party",
  thAmount: "Amount",
  thItemMapping: "Item Mapping",
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
  itemMappingText: "Matching Tally item एकदाच select करा. पुढच्या वेळी हे mapping automatic वापरले जाईल.",
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
  titleLots: "Item Mapping",
  titleArchive: "जुने Response",
  titleSettings: "सेटिंग",
  titleCompanyUdfs: "Tally Setup",
  titleErrors: "अडचणी",
  noDataLoaded: "Data load झालेला नाही",
  ready: "Ready",
  notChecked: "तपासलेले नाही",
  tallyStatusNotChecked: "Tally status तपासलेला नाही.",
  lastResponseEmpty: "या session मध्ये अजून request पाठवलेली नाही.",
  readyForMapping: "Mapping आणि Tally push साठी ready",
  noVouchers: "अजून voucher ready नाहीत.",
  lotMissing: "Lot missing",
  itemToMap: "item map करायचा आहे",
  itemsToMap: "items map करायचे आहेत",
  foundInTally: "Tally मध्ये आहे",
  verifiedInTally: "Tally मध्ये verified",
  pushedToTally: "Tally मध्ये push झाले",
  pendingForTally: "Tally साठी pending",
  checking: "तपासत आहे...",
  pushing: "Push करत आहे...",
  checkFailed: "Check failed",
  pushWarning: "Push warning",
  status: "Status",
  push: "Push",
  synced: "Synced",
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
  ["SATHI_TALLY_PURCHASE_LEDGER", "Purchase ledger"]
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
  bindActions();
  try {
    await loadConfig();
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
  renderReports();
  updateActionFields();
  await previewRequest().catch(() => { });
  applyLanguage();
  startBackgroundStartup();
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
      loadItemMappings()
    ]);
  } catch {
    // Individual startup calls already update their visible panels.
  }
}

function bindNavigation() {
  document.querySelectorAll(".nav-item").forEach((button) => {
    button.addEventListener("click", () => switchTab(button.dataset.tab));
  });

  document.querySelectorAll("[data-switch-tab]").forEach((button) => {
    button.addEventListener("click", () => switchTab(button.dataset.switchTab));
  });
}

function switchTab(tab) {
  document.querySelectorAll(".nav-item").forEach((item) => item.classList.toggle("active", item.dataset.tab === tab));
  document.querySelectorAll(".tab-panel").forEach((panel) => panel.classList.remove("active"));
  document.getElementById(tab).classList.add("active");
  updatePageTitle(tab);
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
  document.getElementById("portalPreviewBtn").addEventListener("click", () => preparePortalCreateOrder({ send: false }));
  document.getElementById("portalSendBtn").addEventListener("click", () => preparePortalCreateOrder({ send: true }));
  document.getElementById("portalRefreshSalesBtn").addEventListener("click", loadPortalSalesEntries);
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
  document.getElementById("saveItemMappingsBtn").addEventListener("click", saveLotMappingsAndContinue);
  document.getElementById("refreshTallyLogsBtn").addEventListener("click", loadTallyLogs);
  document.getElementById("clearTallyLogsBtn").addEventListener("click", clearTallyLogs);
  document.getElementById("fetchCompanyUdfsBtn").addEventListener("click", () => loadLicenceScopes({ silent: false }));
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
  document.getElementById("uiThemeSelect")?.addEventListener("change", (event) => {
    applyTheme(event.target.value);
  });
  document.getElementById("refreshReportsBtn")?.addEventListener("click", loadActiveReport);
  document.querySelectorAll(".report-switch-button").forEach((button) => {
    button.addEventListener("click", () => {
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
    await loadItemMappings();
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
  form.saathiTimeoutMs.value = saathi.timeoutMs;
  form.saathiRetryCount.value = saathi.retryCount;
  form.tallyUrl.value = tally.url;
  form.tallyCompanyName.value = tally.companyName;
  form.tallyTimeoutMs.value = tally.timeoutMs;
  form.tallyVoucherTypeName.value = tally.voucherTypeName;
  form.tallySalesVoucherTypeName.value = tally.salesVoucherTypeName;
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

  return {
    ...base,
    sourceVoucherNumber: form.dataset.sourceVoucherNumber || "",
    sourceVoucherDate: form.dataset.sourceVoucherDate || "",
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
    lotTypeStockDetails: [
      {
        certificationClass: value("certificationClass"),
        lotNum: value("lotNum"),
        packingSize: value("packingSize"),
        quantity: numberValue("quantity", 0)
      }
    ],
    buyerStateCode: value("stateCode") || base.buyerStateCode || base.stateCode
  };
}

async function preparePortalCreateOrder({ send = false } = {}) {
  const payload = portalCreateOrderPayload();
  setValue("createOrderJson", JSON.stringify(payload, null, 2));
  document.getElementById("apiAction").value = "createOrder";
  updateActionFields();
  switchTab("dashboard");
  document.querySelector(".advanced-workbench")?.setAttribute("open", "");
  await previewRequest();
  document.querySelector(".request-preview-panel")?.scrollIntoView({ behavior: "smooth", block: "start" });
  if (send) await sendWorkbenchRequest();
}

async function bootstrapTallyCompany() {
  const companyName = document.querySelector("[name=tallyCompanyName]")?.value || "";
  if (!companyName) {
    setText("tallyNote", "Select a Tally company once, then save configuration.");
    return;
  }

  try {
    await testTally({ silent: true, keepSelectedCompany: true });
    await Promise.allSettled([
      loadTallyStockItems({ silent: true }),
      loadItemMappings(),
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
  if (settings.saathiTimeoutMs) form.saathiTimeoutMs.value = settings.saathiTimeoutMs;
  if (settings.saathiRetryCount) form.saathiRetryCount.value = settings.saathiRetryCount;
  if (settings.tallyVoucherTypeName) form.tallyVoucherTypeName.value = settings.tallyVoucherTypeName;
  if (settings.tallySalesVoucherTypeName) form.tallySalesVoucherTypeName.value = settings.tallySalesVoucherTypeName;
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
    await ensureTallyConnectedForAction();
    await previewRequest();
    if (state.license && !isLicenseActive()) {
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
      await checkAllTallyStatuses();
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
      switchTab(mappingReady ? "orders" : "lots");
    }

    finishApiProgress(true, "SATHI request completed.");
    showToast("SATHI request completed.");
  } catch (error) {
    const cleanMessage = extractApiMessage(error.message);
    finishApiProgress(false, cleanMessage);
    setStatus("saathiStatus", compactError(cleanMessage), "danger");
    document.getElementById("saathiStatusHint").textContent = cleanMessage;
    document.getElementById("lastFetchNote").textContent = error.message;
    document.getElementById("lastResponse").textContent = error.message;
    await loadErrors();
    showApiErrorToast(error, "SATHI request failed. Error Desk updated.");
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
      loadItemMappings()
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
    await loadErrors();
    await loadTallyLogs();
    if (!options.silent) showToast(state.licenceScopes.length ? "Using saved SATHI licence configuration." : "Licence setup needs refresh.");
  }
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
    baseUrl: form.saathiBaseUrl?.value?.trim() || "",
    purchaseLedgerName: form.tallyPurchaseLedgerName?.value?.trim() || "",
    raw: {
      SATHI_API_KEY: form.saathiApiKey?.value?.trim() || "",
      SATHI_CLIENT_ID: clientId,
      SATHI_CLIENT_SECRET: form.saathiClientSecret?.value?.trim() || "",
      SATHI_OWNER_CODE: form.saathiOwnerCode?.value?.trim() || clientId,
      SATHI_LOCATION_CODE: form.saathiLocationCode?.value?.trim() || form.saathiOwnerCode?.value?.trim() || clientId,
      SATHI_STATE_CODE: form.saathiStateCode?.value?.trim() || "27",
      SATHI_BASE_URL: form.saathiBaseUrl?.value?.trim() || "",
      SATHI_TALLY_PURCHASE_LEDGER: form.tallyPurchaseLedgerName?.value?.trim() || ""
    }
  };
  return {
    clientId,
    purchaseVoucherTypeName: form.tallyVoucherTypeName?.value?.trim() || "Purchase",
    salesVoucherTypeName: form.tallySalesVoucherTypeName?.value?.trim() || "",
    salesVoucherTypeNames: form.tallySalesVoucherTypeName?.value?.trim() ? [form.tallySalesVoucherTypeName.value.trim()] : [],
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
    purchaseVoucherTypeName: tally.voucherTypeName || "Purchase",
    salesVoucherTypeName: tally.salesVoucherTypeName || "",
    salesVoucherTypeNames: tally.salesVoucherTypeName ? [tally.salesVoucherTypeName] : [],
    fields: {
      apiKey: saathi.apiKey || "",
      clientId,
      clientSecret: saathi.clientSecret || "",
      ownerCode: saathi.ownerCode || clientId,
      locationCode: saathi.locationCode || saathi.ownerCode || clientId,
      stateCode: saathi.stateCode || "",
      baseUrl: saathi.baseUrl || "",
      purchaseLedgerName: tally.purchaseLedgerName || "",
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
  applyActiveScopeToUi();
  if (previousClientId && active?.clientId && previousClientId !== active.clientId) {
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
    if (fields.purchaseLedgerName) form.tallyPurchaseLedgerName.value = fields.purchaseLedgerName;
  }
  setValue("createOrderJson", JSON.stringify(buildCreateOrderTemplate(state.config?.saathi || {}), null, 2));
  syncPortalCreateForm();
  updatePortalSourceStrip();
  updateTopScopeBar();
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

function scopeLicenceLabel(scope = {}) {
  const code = scopeLicenceCode(scope);
  const vtype = scope.purchaseVoucherTypeName || "";
  if (code && vtype) return `${code} (${vtype})`;
  return code || vtype || "Licence";
}

function activeScopePayload() {
  const scope = activeLicenceScope();
  if (!scope) return null;
  return {
    companyName: selectedCompanyName(),
    clientId: scopeLicenceCode(scope),
    purchaseVoucherTypeName: scope.purchaseVoucherTypeName,
    salesVoucherTypeName: scopeSalesVoucherTypeName(scope),
    salesVoucherTypeNames: scopeSalesVoucherTypeNames(scope),
    fields: scope.fields || {}
  };
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

async function loadItemMappings() {
  const companyName = selectedCompanyName();
  if (!companyName) {
    state.itemMappings = {};
    return;
  }

  const result = await api(`/api/item-mappings?companyName=${encodeURIComponent(companyName)}`);
  state.itemMappings = result.mappings || {};
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

function mergeStoredSathiQueue(queue = {}) {
  const fallbackLicence = activeLicenceScope()?.clientId || "";
  const storedOrders = (queue.orders || []).map((order) => ({
    ...order,
    buyerCode: order.buyerCode || order.licenceCode || fallbackLicence
  })).filter((order) => order.voucherNumber).filter(belongsToActiveLicence);
  const storedBills = (queue.lotBills || []).map((bill) => ({
    ...bill,
    buyerCode: bill.buyerCode || bill.licenceCode || fallbackLicence
  })).filter((bill) => bill.billNumber || bill.voucherNumber).filter(belongsToActiveLicence);

  state.orders = mergeByKey(state.orders, storedOrders, (order) => order.voucherNumber).filter(belongsToActiveLicence);
  state.lotBills = mergeByKey(state.lotBills, storedBills, (bill) => bill.billNumber || bill.voucherNumber).filter(belongsToActiveLicence);
}

function mergeByKey(existingRows = [], incomingRows = [], keyGetter) {
  const merged = new Map();
  for (const row of [...existingRows, ...incomingRows]) {
    const key = keyGetter(row);
    if (!key) continue;
    merged.set(key, { ...(merged.get(key) || {}), ...row });
  }
  return [...merged.values()];
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
  const body = document.getElementById("ordersBody");
  const visibleOrders = state.orders.filter(belongsToActiveLicence);
  document.getElementById("orderCount").textContent = visibleOrders.length;
  document.getElementById("orderStatusHint").textContent = visibleOrders.length
    ? t("readyForMapping", "Ready for mapping and Tally push")
    : t("noDataLoaded", "No data loaded");

  if (!visibleOrders.length) {
    body.innerHTML = `<tr><td colspan="6" class="empty-cell">${escapeHtml(t("noVouchers", "No vouchers ready yet."))}</td></tr>`;
    return;
  }

  body.innerHTML = visibleOrders.map((order, index) => {
    const bill = findBillForOrder(order);
    const tallyStatus = state.tallyStatuses[order.voucherNumber] || "Pending for Tally";
    const mappingStatus = bill ? mappingStatusForBill(bill) : { label: t("lotMissing", "Lot missing"), className: "status-pill status-warn" };
    const pushDisabled = !bill || tallyStatus === "Found in Tally" || tallyStatus === "Verified in Tally" || tallyStatus === "Pushed to Tally";
    const pushLabel = !bill ? t("push", "Push") : pushDisabled ? t("synced", "Synced") : t("push", "Push");
    const expanded = state.expandedOrder === order.voucherNumber;
    return `
    <tr class="order-main-row ${expanded ? "active-order" : ""}" data-order-index="${index}">
      <td>
        <div class="queue-voucher-cell">
          <div class="voucher-copy-row">
            <strong>${escapeHtml(order.voucherNumber || "")}</strong>
            <button class="voucher-copy-button" data-copy-voucher="${escapeHtml(order.voucherNumber || "")}" type="button" title="Copy voucher number">Copy</button>
          </div>
          <small>${escapeHtml(formatOrderDate(order.voucherDate))}</small>
          <small>${escapeHtml(`Vch type: ${activeLicenceScope()?.purchaseVoucherTypeName || document.getElementById("configForm")?.tallyVoucherTypeName?.value || "Purchase"}`)}</small>
        </div>
      </td>
      <td>
        <div class="queue-party-cell">
          <strong>${escapeHtml(order.sellerName || bill?.sellerName || "-")}</strong>
          <small>${escapeHtml(bill?.buyerName ? `${t("buyerPrefix", "Buyer")}: ${bill.buyerName}` : order.sellerCode || "")}</small>
        </div>
      </td>
      <td class="amount"><strong>${escapeHtml(order.totalBillPrice || bill?.totalBillPrice || "0")}</strong></td>
      <td><span class="${mappingStatus.className}">${escapeHtml(mappingStatus.label)}</span></td>
      <td><span class="${tallyStatusClass(tallyStatus)}">${escapeHtml(formatTallyStatus(tallyStatus))}</span></td>
      <td>
        <div class="row-actions">
          <button class="mini-button" data-action="check" data-order-index="${index}" type="button">${escapeHtml(t("status", "Status"))}</button>
          ${bill ? "" : `<button class="mini-button primary-mini" data-action="pull-lot" data-order-index="${index}" type="button">Pull Lot</button>`}
          <button class="mini-button primary-mini" data-action="push" data-order-index="${index}" type="button" ${pushDisabled ? "disabled" : ""}>${escapeHtml(pushLabel)}</button>
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
    button.addEventListener("click", () => switchTab("lots"));
  });
}

async function pullLotForOrder(order) {
  const voucherNumber = order?.voucherNumber || "";
  if (!voucherNumber) return;

  const payload = lotDetailsPayloadForOrder(order);
  document.getElementById("apiAction").value = "pullLot";
  setValue("quickOwnerCode", payload.ownerCode);
  setValue("quickStateCode", payload.stateCode);
  setValue("voucherNumber", payload.voucherNumber);
  setValue("locationCode", payload.locationCode);
  updateActionFields();
  switchTab("dashboard");
  document.querySelector(".advanced-workbench")?.setAttribute("open", "");
  document.querySelector(".advanced-workbench")?.scrollIntoView({ behavior: "smooth", block: "start" });
  setText("lastFetchNote", `Ready to pull lot details for ${voucherNumber}. Review and click Run Action.`);
  await previewRequest();
  document.getElementById("sendWorkbenchBtn")?.focus();
  showToast(`Pull lot request opened for ${voucherNumber}.`);
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
  const mappingStatus = mappingStatusForBill(bill);
  const lots = (bill.lotData || []).map((lot, index) => `
    <article class="lot-map-card readonly-lot-card">
      <div class="lot-map-number">${index + 1}</div>
      <div class="lot-map-main">
        <span>${escapeHtml(t("portalItem", "Portal item"))}</span>
        <strong>${escapeHtml(portalItemName(lot))}</strong>
        <small>${escapeHtml(lot.cropName || "")}</small>
      </div>
      <div class="lot-map-batch">
        <span>${escapeHtml(t("batch", "Batch / Lot"))}</span>
        <strong>${escapeHtml(lot.lotNum || "-")}</strong>
      </div>
      <div class="mapped-item-readonly">
        <span>${escapeHtml(t("tallyItem", "Tally item"))}</span>
        <strong>${escapeHtml(resolveTallyItemForLot(lot) || t("notMapped", "Not mapped"))}</strong>
      </div>
      <div class="lot-map-meta">
        <div><span>${escapeHtml(t("pack", "Pack"))}</span><strong>${escapeHtml(formatPacking(lot) || "-")}</strong></div>
        <div><span>${escapeHtml(t("bags", "Bags"))}</span><strong>${escapeHtml(lot.totalBags ?? "-")}</strong></div>
        <div><span>Qty</span><strong>${escapeHtml(lot.totalQty ?? "-")}</strong></div>
        <div><span>${escapeHtml(t("rate", "Rate"))}</span><strong>${escapeHtml(lot.unitPrice || "0")}</strong></div>
        <div><span>GST</span><strong>${escapeHtml(lotGstPercent(lot))}</strong></div>
        <div><span>${escapeHtml(t("expiry", "Expiry"))}</span><strong>${escapeHtml(lot.expiryDate || "-")}</strong></div>
      </div>
    </article>
  `).join("");

  return `
    <div class="order-detail-card">
      <div class="order-workflow-strip">
        <span>${escapeHtml((bill.lotData || []).length)} ${escapeHtml((bill.lotData || []).length === 1 ? t("item", "item") : t("items", "items"))}</span>
        <span>Voucher type: ${escapeHtml(activeLicenceScope()?.purchaseVoucherTypeName || document.getElementById("configForm")?.tallyVoucherTypeName?.value || "Purchase")}</span>
        <span>${escapeHtml(mappingStatus.label)}</span>
        <span>${escapeHtml(t("lotAsBatch", "Lot number will be used as Tally batch"))}</span>
      </div>
      <div class="order-detail-summary">
        <div><span>${escapeHtml(t("buyer", "Buyer"))}</span><strong>${escapeHtml(bill.buyerName || "")}</strong></div>
        <div><span>${escapeHtml(t("seller", "Seller"))}</span><strong>${escapeHtml(bill.sellerName || "")}</strong></div>
        <div><span>${escapeHtml(t("billDate", "Bill Date"))}</span><strong>${escapeHtml(bill.billDate || "")}</strong></div>
        <div><span>${escapeHtml(t("totalBill", "Total"))}</span><strong>${escapeHtml(bill.totalBillPrice || "0")}</strong></div>
      </div>
      <div class="detail-actions">
        <button class="secondary-button" data-action="review-mapping" type="button">${escapeHtml(t("reviewItemMapping", "Review item mapping"))}</button>
      </div>
      <div class="lot-map-list">${lots}</div>
      ${tallyResultHtml(tallyResult)}
    </div>
  `;
}

function mappingStatusForBill(bill) {
  const lots = uniqueMappingLots(bill?.lotData || []);
  if (!lots.length) return { label: t("lotMissing", "Lot missing"), className: "status-pill status-warn" };
  const missing = lots.filter((lot) => !resolveTallyItemForLot(lot));
  if (missing.length) {
    const label = missing.length === 1
      ? `${missing.length} ${t("itemToMap", "item to map")}`
      : `${missing.length} ${t("itemsToMap", "items to map")}`;
    return { label, className: "status-pill status-warn" };
  }
  return { label: t("ready", "Ready"), className: "status-pill status-ok" };
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
  const createNew = Boolean(stored?.createNew);
  const mapped = createNew ? portalName : resolveTallyItemForLot(lot);
  const missing = !mapped;

  return `
    <article class="mapping-review-card ${missing ? "needs-map" : "ready-map"}">
      <div class="lot-map-number">${index + 1}</div>
      <div class="mapping-source">
        <span>${escapeHtml(t("portalItem", "SATHI item"))}</span>
        <strong>${escapeHtml(portalName)}</strong>
        <small>${escapeHtml([lot.cropName, lot.lotNum].filter(Boolean).join(" | "))}</small>
      </div>
      <div class="mapping-batch">
        <span>${escapeHtml(t("batch", "Batch"))}</span>
        <strong>${escapeHtml(lot.lotNum || "-")}</strong>
      </div>
      <label class="mapping-mode-cell">
        ${escapeHtml(t("useAs", "Use as"))}
        <select class="mapping-mode-select" data-portal-key="${escapeHtml(key)}">
          <option value="existing" ${createNew ? "" : "selected"}>${escapeHtml(t("existingTallyItem", "Existing Tally item"))}</option>
          <option value="create" ${createNew ? "selected" : ""}>${escapeHtml(t("newTallyItem", "New Tally item"))}</option>
        </select>
      </label>
      <div class="item-map-cell">
        <label>${escapeHtml(t("tallyItemName", "Tally item name"))}</label>
        <input
          class="mapping-review-input${mapped ? " mapped" : ""}"
          list="tallyStockItemsList"
          data-portal-key="${escapeHtml(key)}"
          data-portal-name="${escapeHtml(portalName)}"
          value="${escapeHtml(mapped)}"
          placeholder="Select Tally item"
          ${createNew ? "disabled" : ""}
        >
        <small>${escapeHtml(createNew ? t("newItemWillCreate", "New item will be created in Tally.") : t("selectFromTallyList", "Select from Tally item list."))}</small>
      </div>
      <span class="${missing ? "mapping-state missing" : "mapping-state ok"}">${escapeHtml(missing ? t("mappingRequired", "Mapping required") : t("ready", "Ready"))}</span>
    </article>
  `;
}

function findBillForOrder(order) {
  return state.lotBills.filter(belongsToActiveLicence).find((bill) => bill.billNumber === order.voucherNumber || bill.voucherNumber === order.voucherNumber);
}

async function checkTallyStatus(order) {
  state.tallyStatuses[order.voucherNumber] = "Checking...";
  renderOrders();

  try {
    const result = await api("/api/tally/voucher-status", {
      method: "POST",
      body: { voucherNumber: order.voucherNumber }
    });
    state.tallyStatuses[order.voucherNumber] = result.exists ? "Found in Tally" : "Pending for Tally";
    state.tallyResults[order.voucherNumber] = {
      action: "voucher-status",
      status: result.exists ? "found" : "not-found",
      message: result.exists ? "Voucher/reference found in Tally export." : "Voucher/reference was not found in Tally export.",
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

async function pushOrderToTally(order) {
  const bill = findBillForOrder(order);
  if (!bill) {
    showToast("Lot details missing. Pull lot details before Tally push.");
    return;
  }

  const itemMappings = buildBillItemMappings(bill);
  const missingMappings = findMissingItemMappings(bill, itemMappings);
  if (missingMappings.length) {
    showToast(`Map Tally item for ${missingMappings[0]} before push.`);
    return;
  }

  state.tallyStatuses[order.voucherNumber] = "Pushing...";
  renderOrders();

  try {
    const result = await api("/api/tally/push-voucher", {
      method: "POST",
      body: { bill, itemMappings, scope: activeScopePayload() }
    });
    state.tallyStatuses[order.voucherNumber] = result.alreadyExists ? "Found in Tally" : resolvePushStatus(result);
    state.tallyResults[order.voucherNumber] = {
      action: "push-voucher",
      status: state.tallyStatuses[order.voucherNumber],
      message: result.message || "Tally push completed.",
      importSummary: result.summary,
      masterResult: result.masterResult,
      lineErrors: result.lineErrors || [],
      verification: result.verification,
      xmlPreview: result.xmlPreview,
      rawResponse: result.response,
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
  showToast(`Tally push completed for ${order.voucherNumber}.`);
}

async function pushAllPendingToTally() {
  for (const order of state.orders.filter(belongsToActiveLicence)) {
    const status = state.tallyStatuses[order.voucherNumber] || "Pending for Tally";
    if (!["Found in Tally", "Verified in Tally", "Pushed to Tally"].includes(status)) {
      await pushOrderToTally(order);
    }
  }
}

function tallyStatusClass(status) {
  if (status === "Found in Tally" || status === "Verified in Tally" || status === "Pushed to Tally") return "status-pill status-ok";
  if (status === "Pushing..." || status === "Checking...") return "status-pill status-busy";
  if (status === "Check failed" || status === "Push warning") return "status-pill status-warn";
  return "status-pill";
}

function formatTallyStatus(status) {
  const labels = {
    "Found in Tally": t("foundInTally", "Found in Tally"),
    "Verified in Tally": t("verifiedInTally", "Verified in Tally"),
    "Pushed to Tally": t("pushedToTally", "Pushed to Tally"),
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
  if (result.imported) return "Pushed to Tally";
  return "Push warning";
}

function normalizeLotBills(raw) {
  const data = raw?.response?.data || raw?.data || [];
  return Array.isArray(data) ? data : [];
}

function renderLotDetails() {
  const activeBills = state.lotBills.filter(belongsToActiveLicence);
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
    renderPortalSalesEntries();
    if (!options.silent) showToast(`${state.portalSalesEntries.length} sales entries fetched from Tally.`);
  } catch (error) {
    state.portalSalesEntries = [];
    renderPortalSalesEntries(error.message);
    if (!options.silent) showToast("Could not fetch Tally sales entries.");
  }
}

function renderPortalSalesEntries(errorMessage = "") {
  const body = document.getElementById("portalSalesBody");
  if (!body) return;

  if (errorMessage) {
    body.innerHTML = `<tr><td colspan="7" class="empty-cell">${escapeHtml(errorMessage)}</td></tr>`;
    return;
  }

  if (!state.portalSalesEntries.length) {
    body.innerHTML = `<tr><td colspan="7" class="empty-cell">${escapeHtml(t("portalQueueEmpty", "No Tally sales entries fetched yet."))}</td></tr>`;
    return;
  }

  body.innerHTML = state.portalSalesEntries.map((entry, index) => {
    const expanded = state.expandedPortalSale === portalSaleKey(entry, index);
    const firstLot = entry.inventory?.[0] || {};
    const trace = portalTraceForItem(entry, firstLot);
    const originalOwner = trace?.originalOwner || firstLot.originalOwner || entry.originalOwner || "";
    const lotTraceStatus = originalOwner || (firstLot.lotNum ? "Needs original owner" : "Needs lot details");
    const lotTraceClass = originalOwner ? "status-pill status-ok" : "status-pill status-warn";
    const typeSummary = portalSaleTypeSummary(entry);
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
            <strong>${escapeHtml(entry.partyLedgerName || "-")}</strong>
            <small>${escapeHtml((entry.inventory || []).map((item) => item.stockItemName).filter(Boolean).join(", "))}</small>
          </div>
        </td>
        <td class="amount"><strong>${escapeHtml(cleanTallyAmount(entry.amount))}</strong></td>
        <td><span class="${entry.buyerLicense ? "status-pill status-ok" : "status-pill status-warn"}">${escapeHtml(entry.buyerLicense || "Missing")}</span></td>
        <td>
          <div class="portal-type-stack">
            <span>${escapeHtml(typeSummary.partyType)}</span>
          </div>
        </td>
        <td><span class="${lotTraceClass}">${escapeHtml(lotTraceStatus)}</span></td>
        <td>
          <div class="row-actions">
            <button class="mini-button" data-action="portal-preview" data-portal-index="${index}" type="button">Preview</button>
            <button class="mini-button primary-mini" data-action="portal-send" data-portal-index="${index}" type="button">Push</button>
          </div>
        </td>
      </tr>
      <tr class="order-detail-row ${expanded ? "" : "hidden"}">
        <td colspan="7">${portalSaleDetailHtml(entry)}</td>
      </tr>
    `;
  }).join("");

  document.querySelectorAll(".portal-sale-row").forEach((row) => {
    row.addEventListener("click", (event) => {
      if (event.target.closest("button")) return;
      const entry = state.portalSalesEntries[Number(row.dataset.portalIndex)];
      const key = portalSaleKey(entry, row.dataset.portalIndex);
      state.expandedPortalSale = state.expandedPortalSale === key ? "" : key;
      renderPortalSalesEntries();
    });
  });

  document.querySelectorAll("[data-action='portal-preview'], [data-action='portal-send']").forEach((button) => {
    button.addEventListener("click", async () => {
      const entry = state.portalSalesEntries[Number(button.dataset.portalIndex)];
      fillPortalFormFromSale(entry);
      document.querySelector(".portal-manual-panel")?.setAttribute("open", "");
      await preparePortalCreateOrder({ send: button.dataset.action === "portal-send" });
    });
  });
}

function portalSaleDetailHtml(entry) {
  const rows = (entry.inventory || []).map((item) => `
    <tr>
      <td>${escapeHtml(item.stockItemName || "")}</td>
      <td>${escapeHtml(item.lotNum || "")}</td>
      <td>${escapeHtml(portalTraceForItem(entry, item)?.originalOwner || item.originalOwner || "Missing")}</td>
      <td class="amount">${escapeHtml(item.quantityText || item.quantity || "")}</td>
      <td>${escapeHtml(item.rate || "")}</td>
      <td class="amount">${escapeHtml(cleanTallyAmount(item.amount))}</td>
    </tr>
  `).join("");

  return `
    <div class="order-detail-card">
      <div class="order-workflow-strip">
        <span>${escapeHtml((entry.inventory || []).length)} item${(entry.inventory || []).length === 1 ? "" : "s"}</span>
        <span>Buyer licence: ${escapeHtml(entry.buyerLicense || "Missing")}</span>
        <span>Original owner: ${escapeHtml(entry.originalOwner || "Missing")}</span>
      </div>
      <div class="table-wrap compact-detail-table">
        <table>
          <thead><tr><th>Item</th><th>Lot</th><th>Original Owner</th><th class="amount">Qty</th><th>Rate</th><th class="amount">Amount</th></tr></thead>
          <tbody>${rows || '<tr><td colspan="6" class="empty-cell">No item rows found in this voucher.</td></tr>'}</tbody>
        </table>
      </div>
    </div>
  `;
}

function fillPortalFormFromSale(entry) {
  const firstLot = entry.inventory?.[0] || {};
  const form = document.getElementById("portalPushForm");
  const scope = activeLicenceScope();
  const fields = scope?.fields || {};
  const partyDetails = entry.partyDetails || {};
  if (!form) return;
  form.dataset.sourceVoucherNumber = entry.voucherNumber || entry.reference || "";
  form.dataset.sourceVoucherDate = entry.date || "";
  form.buyerCode.value = entry.buyerLicense || "";
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
  form.packingSize.value = firstLot.packingSize || portalTraceForItem(entry, firstLot)?.packingSize || form.packingSize.value || "";
  form.originalOwner.value = entry.originalOwner || portalTraceForItem(entry, firstLot)?.originalOwner || firstLot.originalOwner || "";
  const typeSummary = portalSaleTypeSummary(entry);
  form.sellerRole.value = typeSummary.sellerRole;
  form.buyerRole.value = typeSummary.buyerRole;
  form.isRetailSell.value = typeSummary.isRetailSell;
  if (form.buyerRole.value === "FARMER") form.isRetailSell.value = "Yes";
  const partyTarget = document.getElementById("portalPartyLicenseValue");
  if (partyTarget) partyTarget.textContent = entry.buyerLicense || "Missing";
}

function portalSaleTypeSummary(entry = {}) {
  const partyType = normalizePortalRole(entry.buyerPartyType || entry.partyDetails?.partyType || entry.buyerRole, "DEALER");
  const sellerRole = normalizePortalRole(entry.sellerRole, "DEALER");
  const buyerRole = partyType;
  const isRetailSell = normalizeRetailSell(entry.isRetailSell || entry.saleType);
  return {
    partyType,
    sellerRole,
    buyerRole,
    isRetailSell,
    saleType: isRetailSell === "Yes" || buyerRole === "FARMER" ? "Farmer sale" : "Dealer sale"
  };
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

async function loadActiveReport() {
  const active = state.reports.active || "purchase";
  const companyName = selectedCompanyName();
  const fromDate = document.getElementById("reportDateFrom")?.value || "";
  const toDate = document.getElementById("reportDateTo")?.value || "";
  const scope = activeScopePayload();
  const endpoint = active === "sales" ? "/api/reports/sales" : "/api/reports/purchase";

  setText("reportScopeText", scope?.clientId || "Not loaded");
  renderReportLoading(active);

  try {
    const result = await api(endpoint, {
      method: "POST",
      body: { companyName, fromDate, toDate, scope }
    });
    if (active === "sales") state.reports.salesRows = result.rows || [];
    else state.reports.purchaseRows = result.rows || [];
    renderReports();
    showToast(`${result.count || 0} ${active} report row(s) loaded.`);
  } catch (error) {
    renderReportError(error.message);
    showToast("Could not load report.");
  }
}

function renderReports() {
  const active = state.reports.active || "purchase";
  document.querySelectorAll(".report-switch-button").forEach((button) => {
    button.classList.toggle("active", button.dataset.reportType === active);
  });
  setText("purchaseReportCount", state.reports.purchaseRows.length);
  setText("salesReportCount", state.reports.salesRows.length);
  setText("reportScopeText", activeLicenceScope()?.clientId || "Not loaded");
  if (active === "sales") renderSalesReport();
  else renderPurchaseReport();
}

function renderReportLoading(active) {
  const head = document.getElementById("reportTableHead");
  const body = document.getElementById("reportTableBody");
  if (!head || !body) return;
  head.innerHTML = "";
  body.innerHTML = `<tr><td class="empty-cell">Loading ${escapeHtml(active)} report...</td></tr>`;
}

function renderReportError(message) {
  const head = document.getElementById("reportTableHead");
  const body = document.getElementById("reportTableBody");
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

function bindReportDetailButtons() {
  document.querySelectorAll("[data-report-detail]").forEach((button) => {
    button.addEventListener("click", () => {
      const key = button.dataset.reportDetail || "";
      state.reports.expandedKey = state.reports.expandedKey === key ? "" : key;
      renderReports();
    });
  });
}

function reportRowKey(type, row, index) {
  return `${type}:${row.billNumber || row.voucherNumber || row.reference || row.lotNum || index}`;
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
    pdf: {
      title: "Bill PDF Archive",
      text: "API-ready workspace for fetching and linking SATHI bill PDFs."
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
  if (["returns", "pdf", "stock"].includes(addon)) {
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

function renderItemMappingReview(lots) {
  const list = document.getElementById("mappingReviewList");
  const note = document.getElementById("mappingReviewNote");
  const button = document.getElementById("saveItemMappingsBtn");
  if (!list || !note || !button) return;

  const uniqueLots = uniqueMappingLots(lots);
  if (!uniqueLots.length) {
    list.innerHTML = `<div class="empty-state">${escapeHtml(t("fetchLotForMapping", "Fetch lot details to review item mapping."))}</div>`;
    note.textContent = t("noLotLoaded", "No lot response loaded");
    button.disabled = true;
    return;
  }

  const missing = uniqueLots.filter((lot) => !resolveTallyItemForLot(lot));
  list.innerHTML = uniqueLots.map(itemMappingReviewHtml).join("");
  note.textContent = missing.length ? `${missing.length} ${t("mappingRequired", "mapping required")}` : `${uniqueLots.length} ${t("mappingReady", "ready")}`;
  note.className = missing.length ? "mapping-count-chip warning" : "mapping-count-chip ready";
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
      renderMappingReviewStatus(uniqueLots);
    });
  });

  document.querySelectorAll(".mapping-review-input").forEach((input) => {
    input.addEventListener("input", () => {
      renderMappingReviewStatus(uniqueLots);
    });
  });
}

function renderMappingReviewStatus(lots) {
  const note = document.getElementById("mappingReviewNote");
  const values = collectMappingReviewValues();
  const pending = lots.filter((lot) => !values[portalItemKey(lot)]?.tallyItemName);
  note.textContent = pending.length ? `${pending.length} ${t("mappingRequired", "mapping required")}` : `${lots.length} ${t("mappingReady", "ready")}`;
  note.className = pending.length ? "mapping-count-chip warning" : "mapping-count-chip ready";
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
    {
      portalName: input.dataset.portalName,
      tallyItemName: input.value.trim(),
      createNew: document.querySelector(`.mapping-mode-select[data-portal-key="${cssEscape(input.dataset.portalKey)}"]`)?.value === "create"
    }
  ]).filter(([, value]) => value.tallyItemName));
}

async function saveLotMappingsAndContinue() {
  const lots = uniqueMappingLots(state.lotBills.filter(belongsToActiveLicence).flatMap((bill) => bill.lotData || []));
  if (!lots.length) {
    showToast("Fetch lot details first.");
    return;
  }

  const mappings = collectMappingReviewValues();
  const missing = lots.filter((lot) => !mappings[portalItemKey(lot)]?.tallyItemName).map(portalItemName);
  if (missing.length) {
    showToast(`Map Tally item for ${missing[0]} before push.`);
    renderItemMappingReview(lots);
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
  syncOrdersFromLotBills();
  updateVoucherOptions();
  renderOrders();
  renderLotDetails();
  switchTab("orders");
  showToast("Item mapping saved. Ready for Tally push.");
}

function openItemMappingReview() {
  if (!state.lotBills.filter(belongsToActiveLicence).length) {
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

  return `
    <div class="tally-result-panel">
      <div class="tally-result-head">
        <div>
          <span>Tally result</span>
          <strong>${escapeHtml(result.status || result.action || "")}</strong>
        </div>
        <span class="${tallyStatusClass(result.status)}">${escapeHtml(result.status || "")}</span>
      </div>
      <p>${escapeHtml(result.message || "")}</p>
      ${masterSummary}
      ${summary}
      ${lineErrors}
      ${createNameConflicts}
      ${aliasConflicts}
      <small>Technical XML is saved locally in Tally logs and hidden from this screen.</small>
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
    xmlPreview: log.xmlPreview,
    rawResponse: log.response,
    log
  };
}

function displayTallyLogStatus(status) {
  if (status === "pushed-and-verified") return "Verified in Tally";
  if (status === "pushed-not-verified") return "Pushed to Tally";
  if (status === "found") return "Found in Tally";
  if (status === "not-found") return "Pending for Tally";
  if (status === "skipped-existing") return "Found in Tally";
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
    `<option value="${escapeHtml(item.name)}">${escapeHtml(item.baseUnits || "")}</option>`
  )).join("");
}

function selectedCompanyName() {
  return document.querySelector("[name=tallyCompanyName]")?.value || state.config?.tally?.companyName || "";
}

function portalItemKey(lot = {}) {
  return lot.varietyCode || lot.varietyName || lot.cropCode || lot.cropName || lot.lotNum || "";
}

function portalItemName(lot = {}) {
  return lot.varietyName || lot.cropName || lot.lotNum || "SATHI Seed";
}

function resolveTallyItemForLot(lot = {}) {
  const key = portalItemKey(lot);
  const name = portalItemName(lot);
  const stored = state.itemMappings[key] || state.itemMappings[name];
  if (stored?.tallyItemName) return stored.tallyItemName;
  if (typeof stored === "string") return stored;
  return resolveExistingTallyItemForLot(lot);
}

function resolveExistingTallyItemForLot(lot = {}) {
  const key = portalItemKey(lot);
  const name = portalItemName(lot);
  const normalizedNames = [key, name, lot.varietyName, lot.cropName]
    .filter(Boolean)
    .map(normalizeText);
  const exact = state.stockItems.find((item) => (
    [item.name, ...(item.aliases || [])].some((candidate) => normalizedNames.includes(normalizeText(candidate)))
  ));
  return exact?.name || "";
}

function cssEscape(value) {
  if (window.CSS?.escape) return window.CSS.escape(value);
  return String(value || "").replace(/"/g, '\\"');
}

function buildBillItemMappings(bill = {}) {
  return Object.fromEntries((bill.lotData || []).map((lot) => {
    const key = portalItemKey(lot);
    const stored = state.itemMappings[key] || state.itemMappings[portalItemName(lot)] || {};
    return [key, {
      portalName: portalItemName(lot),
      tallyItemName: resolveTallyItemForLot(lot),
      createNew: Boolean(stored.createNew)
    }];
  }).filter(([key, value]) => key && value.tallyItemName));
}

function findMissingItemMappings(bill = {}, mappings = {}) {
  return (bill.lotData || [])
    .filter((lot) => !mappings[portalItemKey(lot)]?.tallyItemName)
    .map(portalItemName);
}

function normalizeText(value) {
  return String(value || "").trim().toLowerCase();
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
    return `
      <article class="available-license-card ${isActive ? "active" : ""}">
        <div>
          <span>${escapeHtml(scope.purchaseVoucherTypeName || "Purchase scope")}</span>
          <strong>${escapeHtml(scope.clientId || fields.clientId || "No client ID")}</strong>
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
function renderLicenseState(options = {}) {
  const license = state.license || {};
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
    ["sathiLicence", "SATHI licence is not available."]
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
