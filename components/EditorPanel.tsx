import type { CustomField, InvoiceDraft } from "@/lib/types";
import { CustomFieldsEditor } from "./CustomFieldsEditor";
import { Field } from "./Field";
import { LineItemsEditor } from "./LineItemsEditor";
import { PartyFields } from "./PartyFields";
import { Section } from "./Section";

interface EditorPanelProps {
  draft: InvoiceDraft;
  onChange: (patch: Partial<InvoiceDraft>) => void;
}

export function EditorPanel({ draft, onChange }: EditorPanelProps) {
  return (
    <div className="space-y-5">
      <Section title="Invoice details">
        <div className="grid grid-cols-1 gap-4 @xs:grid-cols-2 @md:grid-cols-3">
          <Field
            name="number"
            label="Invoice number"
            value={draft.number}
            placeholder="INV-0001"
            onChange={(number) => onChange({ number })}
          />
          <Field
            name="issueDate"
            label="Issue date"
            value={draft.issueDate}
            placeholder="DD-MM-YYYY"
            hint="Format DD-MM-YYYY"
            onChange={(issueDate) => onChange({ issueDate })}
          />
          <Field
            name="dueDate"
            label="Due date"
            value={draft.dueDate}
            placeholder="DD-MM-YYYY"
            hint="Format DD-MM-YYYY"
            onChange={(dueDate) => onChange({ dueDate })}
          />
        </div>
      </Section>

      <Section title="From" description="Your business, as it appears at the top of the invoice.">
        <PartyFields
          prefix="business"
          value={draft.business}
          onChange={(business) => onChange({ business })}
          namePlaceholder="Harbour & Pine Studio"
          emailPlaceholder="hello@harbourpine.example"
          addressPlaceholder={"14 Quay Lane\nPortbridge, PB1 2XY"}
        />
      </Section>

      <Section title="Bill to">
        <PartyFields
          prefix="customer"
          value={draft.customer}
          onChange={(customer) => onChange({ customer })}
          namePlaceholder="Northfield Bakery Ltd"
          emailPlaceholder="accounts@northfield.example"
          addressPlaceholder={"9 Mill Street\nNorthfield, NF4 8QA"}
        />
      </Section>

      <Section
        title="Line items"
        description="Quantity can be fractional. Unit price takes up to three decimals."
      >
        <LineItemsEditor items={draft.items} onChange={(items) => onChange({ items })} />
      </Section>

      <Section title="Discount and tax">
        <div className="grid grid-cols-1 gap-4 @xs:grid-cols-2">
          <Field
            name="discount"
            label="Discount"
            numeric
            prefix="$"
            value={draft.discount}
            placeholder="0.00"
            hint="A fixed amount in USD, taken off the subtotal."
            onChange={(discount) => onChange({ discount })}
          />
          <Field
            name="taxRate"
            label="Tax rate"
            numeric
            suffix="%"
            value={draft.taxRate}
            placeholder="0"
            hint="Applied after the discount."
            onChange={(taxRate) => onChange({ taxRate })}
          />
        </div>
      </Section>

      <Section
        title="Custom fields"
        description="Extra details for the invoice. Hidden fields stay out of the preview, print and email."
      >
        <CustomFieldsEditor
          fields={draft.customFields}
          onChange={(customFields: CustomField[]) => onChange({ customFields })}
        />
      </Section>

      <Section title="Notes">
        <Field
          name="notes"
          label="Notes for the customer"
          multiline
          rows={4}
          value={draft.notes}
          placeholder="Payment by bank transfer within 14 days. Thank you for your business."
          onChange={(notes) => onChange({ notes })}
        />
      </Section>
    </div>
  );
}
