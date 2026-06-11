import React from "react";
import InvoiceTab from "./InvoiceTab";
export default function Sales({ entity = "QM", setEntity, entities = [] }) {
  return <InvoiceTab tab="sales" entity={entity} setEntity={setEntity} entities={entities} />;
}