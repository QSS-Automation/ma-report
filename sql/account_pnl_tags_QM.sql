-- account_pnl_tags: QM only
-- Generated from each entity's MA report workbook (TBYvM sheet, Category column),
-- keeping only accounts whose tag is a line in that entity's PL sheet.
-- QM follows its MA report (3rd Rev): 500-1000 -> bsei, 615-0000 -> cos,
-- 900-T200 -> oe, adds 900-P700 (oe).
-- Each entity's existing P&L tags are replaced; its 'sst' rows are kept.
--
-- BEFORE RUNNING
--   a) Entity codes used below: 'QM' - they must match:
--        SELECT entity_code FROM ops_QM.ref_entities;
--      If one differs (e.g. QAR instead of QArmour), find-and-replace it in this file.
--   b) Backup (once):
--        CREATE TABLE ops_QM.account_pnl_tags_bak_20261001 AS SELECT * FROM ops_QM.account_pnl_tags;
--   c) Run the WHOLE file (Workbench: the lightning icon, not 'execute current statement').

SET SQL_SAFE_UPDATES = 0;
START TRANSACTION;

-- QM: 105 accounts  (QM_MA 2025 (3rd Rev).xlsx)
DELETE FROM ops_QM.account_pnl_tags WHERE entity = 'QM' AND pnl_tag <> 'sst';
INSERT INTO ops_QM.account_pnl_tags (entity, acc_no, pnl_tag, display_label) VALUES
  ('QM', '500-0000', 'rev', 'Sales'),
  ('QM', '500-1000', 'bsei', 'Business Support Income'),
  ('QM', '510-0000', 'rev', 'Sales'),
  ('QM', '520-0000', 'rev', 'Sales'),
  ('QM', '530-0000', 'fx gain', 'Gain on Foreign Exchange'),
  ('QM', '533-0000', 'oi', 'Miscellaneous Income'),
  ('QM', '540-0000', 'mgmt inc', 'Management Fee Income'),
  ('QM', '540-2000', 'oi', 'Miscellaneous Income'),
  ('QM', '550-0000', 'rent inc', 'Rental Income'),
  ('QM', '570-0000', 'div inc', 'Dividend Income'),
  ('QM', '580-0000', 'sponsor inc', 'Sponsorship Income'),
  ('QM', '590-0000', 'oi', 'Miscellaneous Income'),
  ('QM', '599-9999', 'oi', 'Miscellaneous Income'),
  ('QM', '610-0000', 'cos', 'Cost of Sales'),
  ('QM', '611-0000', 'cos', 'Cost of Sales'),
  ('QM', '612-0000', 'cos', 'Cost of Sales'),
  ('QM', '615-0000', 'cos', 'Cost of Sales'),
  ('QM', '617-0001', 'bse', 'Business Support Expense'),
  ('QM', '617-0002', 'bse', 'Business Support Expense'),
  ('QM', '617-0003', 'bse', 'Business Support Expense'),
  ('QM', '617-0004', 'bse', 'Business Support Expense'),
  ('QM', '617-0005', 'bse', 'Business Support Expense'),
  ('QM', '617-0006', 'bse', 'Business Support Expense'),
  ('QM', '617-0007', 'bse', 'Business Support Expense'),
  ('QM', '617-0008', 'bse', 'Business Support Expense'),
  ('QM', '617-0009', 'bse', 'Business Support Expense'),
  ('QM', '617-0013', 'bse', 'Business Support Expense'),
  ('QM', '617-0014', 'bse', 'Business Support Expense'),
  ('QM', '617-0015', 'bse', 'Business Support Expense'),
  ('QM', '617-0020', 'bse', 'Business Support Expense'),
  ('QM', '618-2000', 'other cos', 'Other COS'),
  ('QM', '618-3000', 'other cos', 'Other COS'),
  ('QM', '800-0000', 'tax pl', 'Taxation'),
  ('QM', '900-A100', 'prof', 'Professional Fees'),
  ('QM', '900-A200', 'marketing', 'Marketing'),
  ('QM', '900-A310', 'maintenance', 'Maintenance'),
  ('QM', '900-B110', 'bc', 'Bank Charges'),
  ('QM', '900-B120', 'bc', 'Bank Charges'),
  ('QM', '900-B130', 'bc', 'Bank Charges'),
  ('QM', '900-B200', 'bonus', 'Bonus'),
  ('QM', '900-B410', 'fc', 'Finance Cost'),
  ('QM', '900-B420', 'fc', 'Finance Cost'),
  ('QM', '900-B500', 'oe', 'General Operating Expenses'),
  ('QM', '900-C100', 'commission', 'Commission'),
  ('QM', '900-C200', 'oe', 'General Operating Expenses'),
  ('QM', '900-D100', 'depr', 'Depreciation'),
  ('QM', '900-D210', 'dir pay', 'Director Remuneration'),
  ('QM', '900-D220', 'dir pay', 'Director Remuneration'),
  ('QM', '900-D240', 'dir fee', 'Director Fee'),
  ('QM', '900-E110', 'ent', 'Entertainment'),
  ('QM', '900-E120', 'ent', 'Entertainment'),
  ('QM', '900-E202', 'payroll', 'Payroll'),
  ('QM', '900-E203', 'dir pay', 'Director Remuneration'),
  ('QM', '900-E402', 'payroll', 'Payroll'),
  ('QM', '900-E403', 'dir pay', 'Director Remuneration'),
  ('QM', '900-E510', 'utilities', 'Utilities'),
  ('QM', '900-E520', 'utilities', 'Utilities'),
  ('QM', '900-E530', 'utilities', 'Utilities'),
  ('QM', '900-G100', 'oe', 'General Operating Expenses'),
  ('QM', '900-I100', 'insurance', 'Insurance'),
  ('QM', '900-I200', 'insurance', 'Insurance'),
  ('QM', '900-I300', 'mgmt', 'Management Fee Expense'),
  ('QM', '900-I600', 'oe', 'General Operating Expenses'),
  ('QM', '900-L001', 'fx loss', 'Loss on Foreign Exchange'),
  ('QM', '900-L200', 'oe', 'General Operating Expenses'),
  ('QM', '900-M100', 'welfare', 'Staff Welfare'),
  ('QM', '900-M200', 'maintenance', 'Maintenance'),
  ('QM', '900-M300', 'mgmt', 'Management Fee Expense'),
  ('QM', '900-P100', 'oe', 'General Operating Expenses'),
  ('QM', '900-P210', 'travel', 'Travelling'),
  ('QM', '900-P220', 'travel', 'Travelling'),
  ('QM', '900-P230', 'travel', 'Travelling'),
  ('QM', '900-P300', 'prof', 'Professional Fees'),
  ('QM', '900-P400', 'oe', 'General Operating Expenses'),
  ('QM', '900-P500', 'oe', 'General Operating Expenses'),
  ('QM', '900-P600', 'oe', 'General Operating Expenses'),
  ('QM', '900-P700', 'oe', 'General Operating Expenses'),
  ('QM', '900-R100', 'oe', 'General Operating Expenses'),
  ('QM', '900-R200', 'oe', 'General Operating Expenses'),
  ('QM', '900-R500', 'rental', 'Rental Expense'),
  ('QM', '900-R700', 'recruitment', 'Recruitment'),
  ('QM', '900-S110', 'payroll', 'Payroll'),
  ('QM', '900-S120', 'payroll', 'Payroll'),
  ('QM', '900-S130', 'payroll', 'Payroll'),
  ('QM', '900-S202', 'payroll', 'Payroll'),
  ('QM', '900-S203', 'dir pay', 'Director Remuneration'),
  ('QM', '900-S300', 'welfare', 'Staff Welfare'),
  ('QM', '900-S400', 'prof', 'Professional Fees'),
  ('QM', '900-S500', 'oe', 'General Operating Expenses'),
  ('QM', '900-S700', 'subscription', 'Subscription Fees'),
  ('QM', '900-S910', 'oe', 'General Operating Expenses'),
  ('QM', '900-T110', 'oe', 'General Operating Expenses'),
  ('QM', '900-T120', 'oe', 'General Operating Expenses'),
  ('QM', '900-T200', 'oe', 'General Operating Expenses'),
  ('QM', '900-T301', 'travel', 'Travelling'),
  ('QM', '900-T302', 'travel', 'Travelling'),
  ('QM', '900-T303', 'travel', 'Travelling'),
  ('QM', '900-T401', 'travel', 'Travelling'),
  ('QM', '900-T402', 'travel', 'Travelling'),
  ('QM', '900-T403', 'travel', 'Travelling'),
  ('QM', '900-T500', 'travel', 'Travelling'),
  ('QM', '900-T600', 'prof', 'Professional Fees'),
  ('QM', '900-U100', 'oe', 'General Operating Expenses'),
  ('QM', '900-U200', 'oe', 'General Operating Expenses'),
  ('QM', '900-W100', 'oe', 'General Operating Expenses');

COMMIT;
SET SQL_SAFE_UPDATES = 1;

-- AFTER: check the counts (QM 105)
SELECT entity, COUNT(*) AS accounts FROM ops_QM.account_pnl_tags
WHERE entity IN ('QM') AND pnl_tag <> 'sst' GROUP BY entity;
