import React from "react";
import InvoiceTab from "../Sales/InvoiceTab";
export default function Purchases({ entity = "QM", setEntity, entities = [] }) {
  return <InvoiceTab tab="pur" entity={entity} setEntity={setEntity} entities={entities} />;
}