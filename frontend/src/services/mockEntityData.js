// GENERATED from the entities' MA report workbooks (PL + TBYvM sheets) —
// local mock mode only. Per entity: its P&L template (same as the backend's
// pnl_templates.py), and its P&L accounts grouped by pnl tag.
export const MOCK_ENTITIES = {
 "QM": {
  "name": "Quandatics M Sdn Bhd",
  "template": {
   "gp": [
    "rev",
    "bsei",
    "cos",
    "other cos",
    "bse"
   ],
   "oi": [
    "oi",
    "mgmt inc",
    "rent inc",
    "div inc",
    "sponsor inc",
    "subsidy inc",
    "ppe gain",
    "fx gain"
   ],
   "opex": [
    "payroll",
    "bonus",
    "tr loss",
    "subsi loss",
    "ppe loss",
    "commission",
    "dir pay",
    "dir fee",
    "insurance",
    "travel",
    "oe",
    "prof",
    "fc",
    "ent",
    "fx loss",
    "depr",
    "sponsorship",
    "welfare",
    "rental",
    "bc",
    "it",
    "subscription",
    "advertising",
    "utilities",
    "recruitment",
    "maintenance",
    "marketing",
    "mgmt",
    "training"
   ],
   "tax": [
    "tax pl"
   ]
  },
  "accounts": {
   "rev": [
    [
     "500-0000",
     "SALES - IT PROVIDER"
    ],
    [
     "510-0000",
     "RETURN INWARDS"
    ],
    [
     "520-0000",
     "DISCOUNT ALLOWED"
    ]
   ],
   "bsei": [
    [
     "500-1000",
     "BUSINESS SUPPORT"
    ]
   ],
   "fx gain": [
    [
     "530-0000",
     "GAIN ON FOREIGN EXCHANGE"
    ]
   ],
   "oi": [
    [
     "533-0000",
     "DISCOUNT RECEIVED"
    ],
    [
     "540-2000",
     "CREDIT CARD REBATE"
    ],
    [
     "590-0000",
     "FIXED DEPOSIT INCOME"
    ],
    [
     "599-9999",
     "OTHERS INCOME"
    ]
   ],
   "mgmt inc": [
    [
     "540-0000",
     "MANAGEMENT FEE"
    ]
   ],
   "rent inc": [
    [
     "550-0000",
     "RENTAL INCOME"
    ]
   ],
   "div inc": [
    [
     "570-0000",
     "DIVIDEND INCOME"
    ]
   ],
   "sponsor inc": [
    [
     "580-0000",
     "SPONSORSHIP INCOME"
    ]
   ],
   "cos": [
    [
     "610-0000",
     "PURCHASES"
    ],
    [
     "611-0000",
     "DISCOUNT RECEIVED"
    ],
    [
     "612-0000",
     "PURCHASES RETURN"
    ],
    [
     "615-0000",
     "TRAINER FEE"
    ]
   ],
   "bse": [
    [
     "617-0001",
     "BUSINESS SUPPORT EXPENSE_QPH"
    ],
    [
     "617-0002",
     "BUSINESS SUPPORT EXPENSE_QTH"
    ],
    [
     "617-0003",
     "BUSINESS SUPPORT EXPENSE_QA"
    ],
    [
     "617-0004",
     "BUSINESS SUPPORT EXPENSE_QAW"
    ],
    [
     "617-0005",
     "BUSINESS SUPPORT EXPENSE_QSG"
    ],
    [
     "617-0006",
     "BUSINESS SUPPORT EXPENSE_SQT"
    ],
    [
     "617-0007",
     "BUSINESS SUPPORT EXPENSE_CITRUS"
    ],
    [
     "617-0008",
     "BUSINESS SUPPORT EXPENSE_DALTOS"
    ],
    [
     "617-0009",
     "BUSINESS SUPPORT EXPENSE_QAU"
    ],
    [
     "617-0013",
     "BUSINESS SUPPORT EXPENSE_QOMNITECH"
    ],
    [
     "617-0014",
     "BUSINESS SUPPORT EXPENSE_QSCI"
    ],
    [
     "617-0015",
     "BUSINESS SUPPORT EXPENSE_QARMOUR"
    ],
    [
     "617-0020",
     "BUSINESS SUPPORT EXPENSES_QSS"
    ]
   ],
   "other cos": [
    [
     "618-2000",
     "SC_RENTAL HALL"
    ],
    [
     "618-3000",
     "SC_SALARIES, WAGE AND ALLOWANCES"
    ]
   ],
   "tax pl": [
    [
     "800-0000",
     "TAXATION"
    ]
   ],
   "prof": [
    [
     "900-A100",
     "AUDIT FEES"
    ],
    [
     "900-P300",
     "PROFESSIONAL FEES"
    ],
    [
     "900-S400",
     "SECRETARIAL FEE"
    ],
    [
     "900-T600",
     "TAX AGENT FEE"
    ]
   ],
   "marketing": [
    [
     "900-A200",
     "ADVERTISING"
    ]
   ],
   "maintenance": [
    [
     "900-A310",
     "ASSESSMENT"
    ],
    [
     "900-M200",
     "MAINTENACE FEE & SINKING FUND"
    ]
   ],
   "bc": [
    [
     "900-B110",
     "BANK CHARGE - TRANSACTION CHARGE"
    ],
    [
     "900-B120",
     "BANK CHARGE - BANK GUARANTEE CHARGE"
    ],
    [
     "900-B130",
     "BANK CHARGE - COMMITMENT FEE"
    ]
   ],
   "bonus": [
    [
     "900-B200",
     "BONUS"
    ]
   ],
   "fc": [
    [
     "900-B410",
     "BANK INTREST - OVERDRAFT"
    ],
    [
     "900-B420",
     "BANK INTREST - TERM LOAN"
    ]
   ],
   "oe": [
    [
     "900-B500",
     "BAD DEBTS"
    ],
    [
     "900-C200",
     "CLEANING FEES"
    ],
    [
     "900-G100",
     "GENERAL EXPENSES"
    ],
    [
     "900-I600",
     "INTEREST EXPENSE"
    ],
    [
     "900-L200",
     "LICENSE FEES"
    ],
    [
     "900-P100",
     "PRINTING & STATIONERY"
    ],
    [
     "900-P400",
     "POSTAGE & COURIER CHARGES"
    ],
    [
     "900-P500",
     "PENALTY/LATE PYMT CHRG"
    ],
    [
     "900-P600",
     "PROCESSING FEES"
    ],
    [
     "900-P700",
     "PPE EXPENSE (Personal Protection Equipment)"
    ],
    [
     "900-R100",
     "REGISTRATION FEES"
    ],
    [
     "900-R200",
     "RENEWAL FEES"
    ],
    [
     "900-S500",
     "STAMP DUTY"
    ],
    [
     "900-S910",
     "STAMP FEE"
    ],
    [
     "900-T110",
     "TELEPHONE"
    ],
    [
     "900-T120",
     "WIFI MODERM"
    ],
    [
     "900-T200",
     "TRAINING FEES"
    ],
    [
     "900-U100",
     "UPKEEP OF OFFICE"
    ],
    [
     "900-U200",
     "UPKEEP OF COMPUTER"
    ],
    [
     "900-W100",
     "WITHHOLDING TAX"
    ]
   ],
   "commission": [
    [
     "900-C100",
     "COMMISSION"
    ]
   ],
   "depr": [
    [
     "900-D100",
     "DEPRECIATION OF FIXED ASSETS"
    ]
   ],
   "dir pay": [
    [
     "900-D210",
     "DIRECTOR SALARIES"
    ],
    [
     "900-D220",
     "DIRECTOR ALLOWANCE"
    ],
    [
     "900-E203",
     "EPF EMPLOYER - DIRECTOR"
    ],
    [
     "900-E403",
     "EIS EMPLOYER - DIRECTOR"
    ],
    [
     "900-S203",
     "SOCSO EMPLOYER - DIRECTOR"
    ]
   ],
   "dir fee": [
    [
     "900-D240",
     "DIRECTOR FEE"
    ]
   ],
   "ent": [
    [
     "900-E110",
     "INTERNAL ENTERTAINMENT"
    ],
    [
     "900-E120",
     "EXTERNAL ENTERTAINMENT"
    ]
   ],
   "payroll": [
    [
     "900-E202",
     "EPF EMPLOYER - STAFF"
    ],
    [
     "900-E402",
     "EIS EMPLOYER - STAFF"
    ],
    [
     "900-S110",
     "SALARIES"
    ],
    [
     "900-S120",
     "WAGE"
    ],
    [
     "900-S130",
     "ALLOWANCE"
    ],
    [
     "900-S202",
     "SOCSO EMPLOYER - STAFF"
    ]
   ],
   "utilities": [
    [
     "900-E510",
     "ELECTRICITY CHRG"
    ],
    [
     "900-E520",
     "WATER CHRG"
    ],
    [
     "900-E530",
     "CHILLER WATER CHRG"
    ]
   ],
   "insurance": [
    [
     "900-I100",
     "INSURANCE (LAPTOP)"
    ],
    [
     "900-I200",
     "INSURANCE (OTHERS)"
    ]
   ],
   "mgmt": [
    [
     "900-I300",
     "IT SUPPORT"
    ],
    [
     "900-M300",
     "MANAGEMENT FEE EXPENSES"
    ]
   ],
   "fx loss": [
    [
     "900-L001",
     "LOSS ON FOREIGN EXCHANGE"
    ]
   ],
   "welfare": [
    [
     "900-M100",
     "MEDICAL"
    ],
    [
     "900-S300",
     "STAFF WELFARE"
    ]
   ],
   "travel": [
    [
     "900-P210",
     "PETROL"
    ],
    [
     "900-P220",
     "PARKING"
    ],
    [
     "900-P230",
     "TOLL"
    ],
    [
     "900-T301",
     "AIR TICKET - L"
    ],
    [
     "900-T302",
     "HOTEL - L"
    ],
    [
     "900-T303",
     "TAXI CLAIM - L"
    ],
    [
     "900-T401",
     "AIR TICKET - O"
    ],
    [
     "900-T402",
     "HOTEL - O"
    ],
    [
     "900-T403",
     "TAXI CLAIM - O"
    ],
    [
     "900-T500",
     "TRAVELLING EXPENSES"
    ]
   ],
   "rental": [
    [
     "900-R500",
     "RENTAL OFFICE"
    ]
   ],
   "recruitment": [
    [
     "900-R700",
     "RECRUITMENT EXP"
    ]
   ],
   "subscription": [
    [
     "900-S700",
     "SUBSCRIPTION FEES"
    ]
   ]
  }
 },
 "QA": {
  "name": "Quandatics Academy Sdn Bhd",
  "template": {
   "gp": [
    "rev",
    "cos",
    "other cos",
    "payroll cos"
   ],
   "oi": [
    "oi",
    "fx gain"
   ],
   "opex": [
    "marketing",
    "event",
    "support",
    "bc",
    "fc",
    "dir pay",
    "payroll",
    "bonus",
    "welfare",
    "recruitment",
    "depr",
    "ent",
    "oe",
    "fx loss",
    "mgmt",
    "maintenance",
    "subscription",
    "travel",
    "rental",
    "prof",
    "utilities"
   ],
   "tax": [
    "tax pl"
   ]
  },
  "accounts": {
   "rev": [
    [
     "500-0000",
     "SALES"
    ],
    [
     "510-0000",
     "RETURN INWARDS"
    ]
   ],
   "fx gain": [
    [
     "530-0000",
     "GAIN ON FOREIGN EXCHANGE"
    ]
   ],
   "oi": [
    [
     "580-0000",
     "CREDIT CARD REBATE"
    ],
    [
     "590-0000",
     "RENTAL INCOME"
    ],
    [
     "599-9999",
     "OTHER INCOMES"
    ]
   ],
   "cos": [
    [
     "610-0000",
     "PURCHASES"
    ],
    [
     "616-0000",
     "TRAINER FEES"
    ]
   ],
   "other cos": [
    [
     "615-0001",
     "TC_CATERING/REFRESTMENT"
    ],
    [
     "615-0002",
     "TC_EXAM FEES"
    ],
    [
     "615-0003",
     "TC_PRINTING"
    ],
    [
     "615-0004",
     "TC_MEAL ALLOWANCE"
    ],
    [
     "615-0010",
     "TC_ACCOMODATION"
    ],
    [
     "615-0015",
     "TC-ACCOMODATION-LOCAL"
    ],
    [
     "615-0016",
     "TC-AIR TICKET-LOCAL"
    ],
    [
     "615-0022",
     "TC-MILEAGE TRAVELLED"
    ],
    [
     "615-0023",
     "TC-TRAINING ALLOWANCES"
    ],
    [
     "615-0024",
     "TC-COURIER/DELIVERY CHARGES"
    ],
    [
     "615-0027",
     "TC-TRANSPORTATION - LOCAL"
    ]
   ],
   "tax pl": [
    [
     "800-0000",
     "TAXATION"
    ]
   ],
   "prof": [
    [
     "900-A002",
     "AUDIT FEE"
    ],
    [
     "900-P004",
     "PROFESSIONAL FEE"
    ],
    [
     "900-S004",
     "SECRETARIAL FEE"
    ],
    [
     "900-T014",
     "TAX AGENT FEES"
    ]
   ],
   "bc": [
    [
     "900-B001",
     "BANK CHARGES/ PAYPAL FEE"
    ]
   ],
   "fc": [
    [
     "900-B003",
     "BANK INTEREST- LOAN"
    ]
   ],
   "utilities": [
    [
     "900-C004",
     "CHILLED WATER CHARGES"
    ],
    [
     "900-E006",
     "ELECTRICITY"
    ],
    [
     "900-W003",
     "WATER CHARGES"
    ]
   ],
   "depr": [
    [
     "900-D001",
     "DEPRECIATION OF FIXED ASSETS"
    ]
   ],
   "ent": [
    [
     "900-E001",
     "ENTERTAINMENT (EXTERNAL)"
    ]
   ],
   "oe": [
    [
     "900-G001",
     "GENERAL EXPENSES"
    ],
    [
     "900-M003",
     "MAINTENANCE FEE & SINKING FUND"
    ],
    [
     "900-M005",
     "MILEAGE TRAVELLED"
    ],
    [
     "900-P001",
     "PRINTING & STATIONERY"
    ],
    [
     "900-P003",
     "POSTAGE/COURIER FEE"
    ],
    [
     "900-P010",
     "TOLL"
    ],
    [
     "900-R002",
     "REGISTRATION FEE"
    ],
    [
     "900-R006",
     "RENEWAL FEE"
    ],
    [
     "900-S008",
     "STAMP DUTY"
    ],
    [
     "900-T013",
     "TELEPHONE CHRG"
    ],
    [
     "900-T017",
     "TRAVEL ALLOWANCE"
    ]
   ],
   "fx loss": [
    [
     "900-L001",
     "LOSS ON FOREIGN EXCHANGE"
    ]
   ],
   "mgmt": [
    [
     "900-M004",
     "MANAGEMENT FEE"
    ]
   ],
   "travel": [
    [
     "900-P011",
     "PARKING"
    ],
    [
     "900-T007",
     "TRAVELLING - LOCAL"
    ],
    [
     "900-T010",
     "TRAVELLING - OVERSEAS"
    ]
   ],
   "maintenance": [
    [
     "900-Q002",
     "QUIT RENT & ASSESSMENT"
    ]
   ],
   "welfare": [
    [
     "900-S002",
     "STAFF WELFARE & REFRESHMENT"
    ]
   ],
   "subscription": [
    [
     "900-S006",
     "SUBSCRIPTION FEES"
    ]
   ],
   "support": [
    [
     "900-S014",
     "SALES SUPPORT"
    ]
   ],
   "marketing": [
    [
     "900-T002",
     "TRAINING AND CONFERENCES"
    ]
   ]
  }
 },
 "QAW": {
  "name": "Q At Work Sdn Bhd",
  "template": {
   "gp": [
    "rev",
    "cos",
    "other cos",
    "payroll cos"
   ],
   "oi": [
    "oi",
    "fx gain"
   ],
   "opex": [
    "advertising",
    "bc",
    "dir pay",
    "payroll",
    "bonus",
    "welfare",
    "recruitment",
    "depr",
    "ent",
    "oe",
    "fx loss",
    "mgmt",
    "travel",
    "rental",
    "prof",
    "subscription",
    "insurance"
   ],
   "tax": [
    "tax pl"
   ]
  },
  "accounts": {
   "rev": [
    [
     "500-0000",
     "SALES"
    ],
    [
     "500-2000",
     "BUSINESS SUPPORT"
    ],
    [
     "510-0000",
     "RETURN INWARDS"
    ]
   ],
   "oi": [
    [
     "560-0000",
     "BUY OUT INCOME"
    ]
   ],
   "cos": [
    [
     "610-0000",
     "PURCHASES"
    ]
   ],
   "payroll cos": [
    [
     "613-1000",
     "COGS - SALARIES"
    ],
    [
     "613-2000",
     "COGS - ALLOWANCE"
    ],
    [
     "613-3000",
     "COGS - WAGES"
    ],
    [
     "613-4000",
     "COGS - OVERTIME"
    ]
   ],
   "bonus": [
    [
     "613-5000",
     "COGS - BONUS"
    ]
   ],
   "other cos": [
    [
     "614-0000",
     "COGS - TRAINER FEES"
    ],
    [
     "615-0000",
     "COGS - EXAM FEES"
    ],
    [
     "616-E001",
     "COGS - EPF EMPLOYER (STAFF)"
    ],
    [
     "616-E002",
     "COGS - EIS EMPLOYER (STAFF)"
    ],
    [
     "616-S001",
     "COGS - SOCSO EMPLOYER (STAFF)"
    ]
   ],
   "prof": [
    [
     "900-A001",
     "AUDIT FEE"
    ],
    [
     "900-S006",
     "SECRETARIAL FEE"
    ],
    [
     "900-T011",
     "TAX AGENT FEE"
    ]
   ],
   "bc": [
    [
     "900-B001",
     "BANK CHARGES"
    ]
   ],
   "depr": [
    [
     "900-D001",
     "DEPRECIATION OF FIXED ASSETS"
    ]
   ],
   "dir pay": [
    [
     "900-D003",
     "DIRECTOR SALARIES"
    ],
    [
     "900-D004",
     "DIRECTOR ALLOWANCE"
    ],
    [
     "900-E007",
     "EPF EMPLOYER - DIRECTOR"
    ],
    [
     "900-E009",
     "EIS EMPLOYER - DIRECTOR"
    ],
    [
     "900-S011",
     "SOCSO EMPLOYER - DIRECTOR"
    ]
   ],
   "ent": [
    [
     "900-E004",
     "INTERNAL ENTERTAINMENT"
    ],
    [
     "900-E005",
     "EXTERNAL ENTERTAINMENT"
    ]
   ],
   "oe": [
    [
     "900-G001",
     "GENERAL EXPENSES"
    ],
    [
     "900-P003",
     "POSTAGE/ COURIES"
    ],
    [
     "900-P004",
     "STAMPING FEE"
    ],
    [
     "900-P005",
     "PRINTING"
    ],
    [
     "900-T009",
     "TELECOMMUNICATION FEE"
    ],
    [
     "900-T013",
     "TRAINING FEES"
    ]
   ],
   "insurance": [
    [
     "900-I002",
     "INSURANCE EXPENSES"
    ]
   ],
   "fx loss": [
    [
     "900-L001",
     "LOSS ON FOREIGN EXCHANGE"
    ]
   ],
   "welfare": [
    [
     "900-M001",
     "MEDICAL FEE"
    ],
    [
     "900-S005",
     "STAFF WELFARE"
    ]
   ],
   "mgmt": [
    [
     "900-M002",
     "MANAGEMENT FEE"
    ]
   ],
   "travel": [
    [
     "900-P008",
     "PETROL"
    ],
    [
     "900-P009",
     "TOLL"
    ],
    [
     "900-P010",
     "PARKING"
    ],
    [
     "900-T003",
     "FLIGHT TICKET - LOCAL"
    ],
    [
     "900-T004",
     "ACCOMODATION - LOCAL"
    ],
    [
     "900-T005",
     "TRANSPORT - LOCAL"
    ],
    [
     "900-T006",
     "FLIGHT TICKET - OVERSEA"
    ],
    [
     "900-T007",
     "ACCOMODATION - OVERSEA"
    ],
    [
     "900-T008",
     "TRANSPORT - OVERSEA"
    ],
    [
     "900-T012",
     "TRAVELLING EXPENSES"
    ]
   ],
   "rental": [
    [
     "900-R001",
     "RENTAL EXPENSES"
    ]
   ],
   "subscription": [
    [
     "900-S009",
     "SUBSCRIPTION FEE"
    ]
   ],
   "tax pl": [
    [
     "950-0000",
     "TAXATION"
    ]
   ]
  }
 },
 "QArmour": {
  "name": "Q Armour Sdn Bhd",
  "template": {
   "gp": [
    "rev",
    "cos"
   ],
   "oi": [
    "oi",
    "fx gain"
   ],
   "opex": [
    "marketing",
    "bc",
    "dir pay",
    "welfare",
    "subscription",
    "payroll",
    "bonus",
    "comm",
    "depr",
    "ent",
    "oe",
    "fx loss",
    "mgmt",
    "travel",
    "rental",
    "prof",
    "utilities"
   ],
   "tax": [
    "tax pl"
   ]
  },
  "accounts": {
   "rev": [
    [
     "500-0000",
     "SALES"
    ]
   ],
   "fx gain": [
    [
     "530-0000",
     "GAIN ON FOREIGN EXCHANGE"
    ]
   ],
   "oi": [
    [
     "570-0000",
     "SPONSORSHIP"
    ]
   ],
   "cos": [
    [
     "610-0000",
     "PURCHASES"
    ],
    [
     "611-0000",
     "DISCOUNT RECEIVED"
    ]
   ],
   "marketing": [
    [
     "900-A001",
     "ADVERTISEMENT"
    ]
   ],
   "prof": [
    [
     "900-A002",
     "AUDIT FEE"
    ],
    [
     "900-S004",
     "SECRETARIAL FEES"
    ],
    [
     "900-T010",
     "TAX AGENT FEE"
    ]
   ],
   "bc": [
    [
     "900-B001",
     "BANK CHARGES"
    ]
   ],
   "bonus": [
    [
     "900-B002",
     "BONUS"
    ]
   ],
   "comm": [
    [
     "900-C001",
     "COMMISSION"
    ]
   ],
   "depr": [
    [
     "900-D001",
     "DEPRECIATION OF FIXED ASSETS"
    ]
   ],
   "dir pay": [
    [
     "900-D003",
     "DIRECTOR SALARIES"
    ],
    [
     "900-D004",
     "DIRECTOR ALLOWANCES"
    ],
    [
     "900-E005",
     "EPF EMPLOYER - DIRECTOR"
    ],
    [
     "900-E007",
     "EIS EMPLOYER - DIRECTOR"
    ],
    [
     "900-S015",
     "SOCSO EMPLOYER - DIRECTOR"
    ]
   ],
   "ent": [
    [
     "900-E002",
     "INTERNAL ENTERTAINMENT"
    ],
    [
     "900-E003",
     "EXTERNAL ENTERTAINMENT"
    ]
   ],
   "payroll": [
    [
     "900-E004",
     "EPF EMPLOYER - STAFF"
    ],
    [
     "900-E006",
     "EIS EMPLOYER - STAFF"
    ],
    [
     "900-S002",
     "SALARIES"
    ],
    [
     "900-S003",
     "ALLOWANCES"
    ],
    [
     "900-S013",
     "WAGE"
    ],
    [
     "900-S014",
     "SOCSO EMPLOYER - STAFF"
    ]
   ],
   "oe": [
    [
     "900-G001",
     "GENERAL EXPENSES"
    ],
    [
     "900-I002",
     "INSURANCE EXPENSES"
    ],
    [
     "900-P001",
     "PRINTING & STATIONERY"
    ],
    [
     "900-P002",
     "POSTAGES/COURIER FEES"
    ],
    [
     "900-S008",
     "STAMPING FEE"
    ],
    [
     "900-T009",
     "TELEPHONE CHARGES"
    ],
    [
     "900-T011",
     "TRAINING"
    ],
    [
     "900-U001",
     "UPKEEP OF LAPTOP"
    ]
   ],
   "mgmt": [
    [
     "900-I003",
     "IT SUPPORT"
    ],
    [
     "900-M001",
     "MANAGEMENT FEE"
    ]
   ],
   "fx loss": [
    [
     "900-L001",
     "LOSS ON FOREIGN EXCHANGE"
    ]
   ],
   "welfare": [
    [
     "900-M002",
     "MEDICAL FEE"
    ]
   ],
   "rental": [
    [
     "900-O001",
     "OFFICE RENTAL"
    ]
   ],
   "travel": [
    [
     "900-P005",
     "PARKING"
    ],
    [
     "900-P006",
     "TOLL"
    ],
    [
     "900-P007",
     "PETROL"
    ],
    [
     "900-P008",
     "TRANSPORTATION FEES"
    ],
    [
     "900-T002",
     "TRAVELLING - LOCAL"
    ],
    [
     "900-T003",
     "ACCOMMODATION - LOCAL"
    ],
    [
     "900-T004",
     "AIR TICKET - LOCAL"
    ],
    [
     "900-T007",
     "ACCOMODATION - OVERSEAS"
    ],
    [
     "900-T008",
     "AIR TICKET - OVERSEAS"
    ]
   ],
   "subscription": [
    [
     "900-S010",
     "SUBSCRIPTION FEE"
    ]
   ],
   "tax pl": [
    [
     "950-0000",
     "TAXATION"
    ]
   ]
  }
 },
 "QOmnitech": {
  "name": "Quandatics Omnitech Sdn Bhd",
  "template": {
   "gp": [
    "rev",
    "cos"
   ],
   "oi": [
    "oi",
    "fx gain"
   ],
   "opex": [
    "marketing",
    "bc",
    "dir pay",
    "welfare",
    "subscription",
    "payroll",
    "bonus",
    "comm",
    "depr",
    "ent",
    "oe",
    "fx loss",
    "mgmt",
    "travel",
    "rental",
    "prof",
    "utilities"
   ],
   "tax": [
    "tax pl"
   ]
  },
  "accounts": {
   "rev": [
    [
     "500-0000",
     "SALES"
    ],
    [
     "510-0000",
     "RETURN INWARDS"
    ],
    [
     "520-0000",
     "DISCOUNT ALLOWED"
    ]
   ],
   "oi": [
    [
     "570-0000",
     "SPONSORSHIP RECEIVED"
    ]
   ],
   "cos": [
    [
     "610-0000",
     "PURCHASES"
    ],
    [
     "612-0000",
     "PURCHASES RETURN"
    ]
   ],
   "prof": [
    [
     "900-A001",
     "AUDIT FEE"
    ],
    [
     "900-S006",
     "SECRETARIAL FEE"
    ],
    [
     "900-T011",
     "TAX AGENT FEE"
    ]
   ],
   "marketing": [
    [
     "900-A002",
     "ADVERTISEMENT"
    ],
    [
     "900-M003",
     "MARKETING & PROMOTION"
    ]
   ],
   "bc": [
    [
     "900-B001",
     "BANK CHARGES"
    ]
   ],
   "bonus": [
    [
     "900-B002",
     "BONUS"
    ]
   ],
   "depr": [
    [
     "900-D001",
     "DEPRECIATION OF FIXED ASSETS"
    ]
   ],
   "dir pay": [
    [
     "900-D003",
     "DIRECTOR SALARIES"
    ],
    [
     "900-E001",
     "EPF EMPLOYER - DIRECTOR"
    ],
    [
     "900-E002",
     "EIS EMPLOYER - DIRECTOR"
    ],
    [
     "900-S004",
     "SOCSO EMPLOYER - DIRECTOR"
    ]
   ],
   "ent": [
    [
     "900-E005",
     "EXTERNAL ENTERTAINMENT"
    ]
   ],
   "payroll": [
    [
     "900-E006",
     "EPF EMPLOYER - STAFF"
    ],
    [
     "900-E007",
     "EIS EMPLOYER - STAFF"
    ],
    [
     "900-S002",
     "SALARIES"
    ],
    [
     "900-S003",
     "ALLOWANCE"
    ],
    [
     "900-S007",
     "WAGES"
    ],
    [
     "900-S011",
     "SOCSO EMPLOYER - STAFF"
    ]
   ],
   "oe": [
    [
     "900-G001",
     "GENERAL EXPENSES"
    ],
    [
     "900-I002",
     "INSURANCE EXPENSES"
    ],
    [
     "900-P003",
     "POSTAGE/COURIES"
    ],
    [
     "900-P004",
     "STAMPING FEE"
    ],
    [
     "900-P005",
     "PRINTING"
    ],
    [
     "900-P006",
     "STATIONERY"
    ],
    [
     "900-R003",
     "REGISTRATION FEE"
    ],
    [
     "900-T009",
     "TELECOMMUNICATION FEE"
    ]
   ],
   "mgmt": [
    [
     "900-M002",
     "MANAGEMENT FEE"
    ]
   ],
   "travel": [
    [
     "900-P008",
     "PETROL"
    ],
    [
     "900-P009",
     "TOLL"
    ],
    [
     "900-P010",
     "PARKING"
    ],
    [
     "900-T005",
     "TRANSPORT - LOCAL"
    ],
    [
     "900-T012",
     "TRAVEL ALLOWANCES"
    ]
   ],
   "rental": [
    [
     "900-R001",
     "RENTAL EXPENSES"
    ]
   ],
   "welfare": [
    [
     "900-S005",
     "STAFF WELFARE"
    ]
   ],
   "subscription": [
    [
     "900-S009",
     "SUBSCRIPTION FEE"
    ]
   ],
   "tax pl": [
    [
     "950-0000",
     "TAXATION"
    ]
   ]
  }
 },
 "CC": {
  "name": "Citrus Cloud Sdn Bhd",
  "template": {
   "gp": [
    "rev",
    "cos"
   ],
   "oi": [
    "oi",
    "fx gain"
   ],
   "opex": [
    "advertising",
    "bc",
    "dir pay",
    "dir fee",
    "payroll",
    "welfare",
    "depr",
    "ent",
    "oe",
    "fx loss",
    "mgmt",
    "travel",
    "rental",
    "prof",
    "subscription"
   ],
   "tax": [
    "tax pl"
   ]
  },
  "accounts": {
   "rev": [
    [
     "500-0000",
     "SALES"
    ]
   ],
   "fx gain": [
    [
     "530-0000",
     "GAIN ON FOREIGN EXCHANGE"
    ]
   ],
   "cos": [
    [
     "610-0000",
     "PURCHASES"
    ]
   ],
   "prof": [
    [
     "900-A001",
     "AUDIT FEES"
    ],
    [
     "900-S001",
     "SECRETARIAL FEES"
    ],
    [
     "900-T001",
     "TAX AGENTS FEE"
    ]
   ],
   "bc": [
    [
     "900-B001",
     "BANK CHARGES"
    ]
   ],
   "dir pay": [
    [
     "900-D003",
     "DIRECTOR SALARIES"
    ]
   ],
   "dir fee": [
    [
     "900-D006",
     "DIRECTOR FEES"
    ]
   ],
   "ent": [
    [
     "900-E003",
     "EXTERNAL ENTERTAINMENT"
    ]
   ],
   "oe": [
    [
     "900-G001",
     "GENERAL EXPENSES"
    ],
    [
     "900-P001",
     "PRINTING & STATIONERY"
    ],
    [
     "900-P003",
     "POSTAGES/COURIER FEES"
    ],
    [
     "900-P004",
     "PENALTY"
    ],
    [
     "900-S012",
     "STAMPING FEE"
    ],
    [
     "900-T002",
     "TELEPHONE CHARGES"
    ],
    [
     "900-T011",
     "TRAINING"
    ],
    [
     "900-W001",
     "WITHHOLDING TAX"
    ]
   ],
   "fx loss": [
    [
     "900-L001",
     "LOSS ON FOREIGN EXCHANGE"
    ]
   ],
   "mgmt": [
    [
     "900-M001",
     "MANAGEMENT FEES"
    ]
   ],
   "rental": [
    [
     "900-O001",
     "OFFICE RENTAL"
    ]
   ],
   "payroll": [
    [
     "900-S002",
     "SALARIES"
    ],
    [
     "900-S003",
     "STAFF EPF - EMPLOYER"
    ],
    [
     "900-S004",
     "STAFF SOCSO - EMPLOYER"
    ],
    [
     "900-S005",
     "STAFF EIS - EMPLOYER"
    ],
    [
     "900-S014",
     "DIRECTOR EPF - EMPLOYER"
    ],
    [
     "900-S015",
     "DIRECTOR EIS - EMPLOYER"
    ],
    [
     "900-S016",
     "DIRECTOR SOCSO - EMPLOYER"
    ]
   ],
   "subscription": [
    [
     "900-S006",
     "SUBSCRIPTION FEE"
    ]
   ],
   "travel": [
    [
     "900-S008",
     "PETROL"
    ],
    [
     "900-S009",
     "TOLL"
    ],
    [
     "900-S010",
     "PARKING"
    ],
    [
     "900-T004",
     "TRAVELLING - LOCAL"
    ],
    [
     "900-T009",
     "ACCOMODATION - OVERSEAS"
    ],
    [
     "900-T010",
     "AIR TICKET - OVERSEAS"
    ]
   ],
   "welfare": [
    [
     "900-S013",
     "MEDICAL"
    ]
   ],
   "tax pl": [
    [
     "950-0000",
     "TAXATION"
    ]
   ]
  }
 },
 "Daltos": {
  "name": "Daltos Sdn Bhd",
  "template": {
   "gp": [
    "rev",
    "bsei",
    "cos",
    "other cos",
    "bse"
   ],
   "oi": [
    "oi",
    "mgmt inc",
    "rent inc",
    "div inc",
    "sponsor inc",
    "subsidy inc",
    "ppe gain",
    "fx gain"
   ],
   "opex": [
    "payroll",
    "bonus",
    "tr loss",
    "subsi loss",
    "ppe loss",
    "commission",
    "dir pay",
    "dir fee",
    "insurance",
    "travel",
    "oe",
    "prof",
    "fc",
    "ent",
    "fx loss",
    "depr",
    "sponsorship",
    "welfare",
    "rental",
    "bc",
    "it",
    "subscription",
    "advertising",
    "utilities",
    "recruitment",
    "maintenance",
    "marketing",
    "mgmt",
    "training"
   ],
   "tax": [
    "tax pl"
   ]
  },
  "accounts": {
   "rev": [
    [
     "500-0000",
     "SALES - IT PROVIDER"
    ],
    [
     "510-0000",
     "RETURN INWARDS"
    ],
    [
     "520-0000",
     "DISCOUNT ALLOWED"
    ]
   ],
   "bsei": [
    [
     "500-1000",
     "BUSINESS SUPPORT"
    ]
   ],
   "fx gain": [
    [
     "530-0000",
     "GAIN ON FOREIGN EXCHANGE"
    ]
   ],
   "oi": [
    [
     "533-0000",
     "DISCOUNT RECEIVED"
    ],
    [
     "540-2000",
     "CREDIT CARD REBATE"
    ],
    [
     "590-0000",
     "FIXED DEPOSIT INCOME"
    ],
    [
     "599-9999",
     "OTHERS INCOME"
    ]
   ],
   "mgmt inc": [
    [
     "540-0000",
     "MANAGEMENT FEE"
    ]
   ],
   "rent inc": [
    [
     "550-0000",
     "RENTAL INCOME"
    ]
   ],
   "div inc": [
    [
     "570-0000",
     "DIVIDEND INCOME"
    ]
   ],
   "sponsor inc": [
    [
     "580-0000",
     "SPONSORSHIP INCOME"
    ]
   ],
   "cos": [
    [
     "610-0000",
     "PURCHASES"
    ],
    [
     "611-0000",
     "DISCOUNT RECEIVED"
    ],
    [
     "612-0000",
     "PURCHASES RETURN"
    ],
    [
     "615-0000",
     "TRAINER FEE"
    ]
   ],
   "bse": [
    [
     "617-0001",
     "BUSINESS SUPPORT EXPENSE_QPH"
    ],
    [
     "617-0002",
     "BUSINESS SUPPORT EXPENSE_QTH"
    ],
    [
     "617-0003",
     "BUSINESS SUPPORT EXPENSE_QA"
    ],
    [
     "617-0004",
     "BUSINESS SUPPORT EXPENSE_QAW"
    ],
    [
     "617-0005",
     "BUSINESS SUPPORT EXPENSE_QSG"
    ],
    [
     "617-0006",
     "BUSINESS SUPPORT EXPENSE_SQT"
    ],
    [
     "617-0007",
     "BUSINESS SUPPORT EXPENSE_CITRUS"
    ],
    [
     "617-0008",
     "BUSINESS SUPPORT EXPENSE_DALTOS"
    ],
    [
     "617-0009",
     "BUSINESS SUPPORT EXPENSE_QAU"
    ],
    [
     "617-0013",
     "BUSINESS SUPPORT EXPENSE_QOMNITECH"
    ],
    [
     "617-0014",
     "BUSINESS SUPPORT EXPENSE_QSCI"
    ],
    [
     "617-0015",
     "BUSINESS SUPPORT EXPENSE_QARMOUR"
    ],
    [
     "617-0020",
     "BUSINESS SUPPORT EXPENSES_QSS"
    ]
   ],
   "other cos": [
    [
     "618-2000",
     "SC_RENTAL HALL"
    ],
    [
     "618-3000",
     "SC_SALARIES, WAGE AND ALLOWANCES"
    ]
   ],
   "tax pl": [
    [
     "800-0000",
     "TAXATION"
    ]
   ],
   "prof": [
    [
     "900-A100",
     "AUDIT FEES"
    ],
    [
     "900-P300",
     "PROFESSIONAL FEES"
    ],
    [
     "900-S400",
     "SECRETARIAL FEE"
    ],
    [
     "900-T600",
     "TAX AGENT FEE"
    ]
   ],
   "marketing": [
    [
     "900-A200",
     "ADVERTISING"
    ]
   ],
   "maintenance": [
    [
     "900-A310",
     "ASSESSMENT"
    ],
    [
     "900-M200",
     "MAINTENACE FEE & SINKING FUND"
    ]
   ],
   "bc": [
    [
     "900-B110",
     "BANK CHARGE - TRANSACTION CHARGE"
    ],
    [
     "900-B120",
     "BANK CHARGE - BANK GUARANTEE CHARGE"
    ],
    [
     "900-B130",
     "BANK CHARGE - COMMITMENT FEE"
    ]
   ],
   "bonus": [
    [
     "900-B200",
     "BONUS"
    ]
   ],
   "fc": [
    [
     "900-B410",
     "BANK INTREST - OVERDRAFT"
    ],
    [
     "900-B420",
     "BANK INTREST - TERM LOAN"
    ]
   ],
   "oe": [
    [
     "900-B500",
     "BAD DEBTS"
    ],
    [
     "900-C200",
     "CLEANING FEES"
    ],
    [
     "900-G100",
     "GENERAL EXPENSES"
    ],
    [
     "900-I600",
     "INTEREST EXPENSE"
    ],
    [
     "900-L200",
     "LICENSE FEES"
    ],
    [
     "900-P100",
     "PRINTING & STATIONERY"
    ],
    [
     "900-P400",
     "POSTAGE & COURIER CHARGES"
    ],
    [
     "900-P500",
     "PENALTY/LATE PYMT CHRG"
    ],
    [
     "900-P600",
     "PROCESSING FEES"
    ],
    [
     "900-P700",
     "PPE EXPENSE (Personal Protection Equipment)"
    ],
    [
     "900-R100",
     "REGISTRATION FEES"
    ],
    [
     "900-R200",
     "RENEWAL FEES"
    ],
    [
     "900-S500",
     "STAMP DUTY"
    ],
    [
     "900-S910",
     "STAMP FEE"
    ],
    [
     "900-T110",
     "TELEPHONE"
    ],
    [
     "900-T120",
     "WIFI MODERM"
    ],
    [
     "900-T200",
     "TRAINING FEES"
    ],
    [
     "900-U100",
     "UPKEEP OF OFFICE"
    ],
    [
     "900-U200",
     "UPKEEP OF COMPUTER"
    ],
    [
     "900-W100",
     "WITHHOLDING TAX"
    ]
   ],
   "commission": [
    [
     "900-C100",
     "COMMISSION"
    ]
   ],
   "depr": [
    [
     "900-D100",
     "DEPRECIATION OF FIXED ASSETS"
    ]
   ],
   "dir pay": [
    [
     "900-D210",
     "DIRECTOR SALARIES"
    ],
    [
     "900-D220",
     "DIRECTOR ALLOWANCE"
    ],
    [
     "900-E203",
     "EPF EMPLOYER - DIRECTOR"
    ],
    [
     "900-E403",
     "EIS EMPLOYER - DIRECTOR"
    ],
    [
     "900-S203",
     "SOCSO EMPLOYER - DIRECTOR"
    ]
   ],
   "dir fee": [
    [
     "900-D240",
     "DIRECTOR FEE"
    ]
   ],
   "ent": [
    [
     "900-E110",
     "INTERNAL ENTERTAINMENT"
    ],
    [
     "900-E120",
     "EXTERNAL ENTERTAINMENT"
    ]
   ],
   "payroll": [
    [
     "900-E202",
     "EPF EMPLOYER - STAFF"
    ],
    [
     "900-E402",
     "EIS EMPLOYER - STAFF"
    ],
    [
     "900-S110",
     "SALARIES"
    ],
    [
     "900-S120",
     "WAGE"
    ],
    [
     "900-S130",
     "ALLOWANCE"
    ],
    [
     "900-S202",
     "SOCSO EMPLOYER - STAFF"
    ]
   ],
   "utilities": [
    [
     "900-E510",
     "ELECTRICITY CHRG"
    ],
    [
     "900-E520",
     "WATER CHRG"
    ],
    [
     "900-E530",
     "CHILLER WATER CHRG"
    ]
   ],
   "insurance": [
    [
     "900-I100",
     "INSURANCE (LAPTOP)"
    ],
    [
     "900-I200",
     "INSURANCE (OTHERS)"
    ]
   ],
   "mgmt": [
    [
     "900-I300",
     "IT SUPPORT"
    ],
    [
     "900-M300",
     "MANAGEMENT FEE EXPENSES"
    ]
   ],
   "fx loss": [
    [
     "900-L001",
     "LOSS ON FOREIGN EXCHANGE"
    ]
   ],
   "welfare": [
    [
     "900-M100",
     "MEDICAL"
    ],
    [
     "900-S300",
     "STAFF WELFARE"
    ]
   ],
   "travel": [
    [
     "900-P210",
     "PETROL"
    ],
    [
     "900-P220",
     "PARKING"
    ],
    [
     "900-P230",
     "TOLL"
    ],
    [
     "900-T301",
     "AIR TICKET - L"
    ],
    [
     "900-T302",
     "HOTEL - L"
    ],
    [
     "900-T303",
     "TAXI CLAIM - L"
    ],
    [
     "900-T401",
     "AIR TICKET - O"
    ],
    [
     "900-T402",
     "HOTEL - O"
    ],
    [
     "900-T403",
     "TAXI CLAIM - O"
    ],
    [
     "900-T500",
     "TRAVELLING EXPENSES"
    ]
   ],
   "rental": [
    [
     "900-R500",
     "RENTAL OFFICE"
    ]
   ],
   "recruitment": [
    [
     "900-R700",
     "RECRUITMENT EXP"
    ]
   ],
   "subscription": [
    [
     "900-S700",
     "SUBSCRIPTION FEES"
    ]
   ]
  }
 }
};
export const MOCK_TAG_LABELS = {
 "rev": "Sales",
 "bsei": "Business Support Income",
 "cos": "Cost of Sales",
 "other cos": "Other COS",
 "bse": "Business Support Expense",
 "oi": "Miscellaneous Income",
 "mgmt inc": "Management Fee Income",
 "rent inc": "Rental Income",
 "div inc": "Dividend Income",
 "sponsor inc": "Sponsorship Income",
 "subsidy inc": "Subsidy Income",
 "ppe gain": "Gain on Disposal of PPE",
 "fx gain": "Gain on Foreign Exchange",
 "payroll": "Payroll",
 "bonus": "Bonus",
 "tr loss": "Trade Receivables Loss",
 "subsi loss": "Loss on Investment in Subsidiary",
 "ppe loss": "Loss on Disposal of PPE",
 "commission": "Commission",
 "dir pay": "Director Remuneration",
 "dir fee": "Director Fee",
 "insurance": "Insurance",
 "travel": "Travelling",
 "oe": "General Operating Expenses",
 "prof": "Professional Fees",
 "fc": "Finance Cost",
 "ent": "Entertainment",
 "fx loss": "Loss on Foreign Exchange",
 "depr": "Depreciation",
 "sponsorship": "Sponsorship Expense",
 "welfare": "Staff Welfare",
 "rental": "Rental Expense",
 "bc": "Bank Charges",
 "it": "IT Support",
 "subscription": "Subscription Fees",
 "advertising": "Advertising",
 "utilities": "Utilities",
 "recruitment": "Recruitment",
 "maintenance": "Maintenance",
 "marketing": "Marketing",
 "mgmt": "Management Fee Expense",
 "training": "Training",
 "tax pl": "Taxation",
 "payroll cos": "Payroll COS",
 "event": "Event Expenses",
 "support": "Sales Support",
 "comm": "Commission"
};
export const GP_INCOME_TAGS = ["rev", "bsei"];
