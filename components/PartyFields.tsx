import { Field } from "./Field";
import type { Party } from "@/lib/types";

interface PartyFieldsProps {
  /** Error key prefix: "business" or "customer". */
  prefix: "business" | "customer";
  value: Party;
  onChange: (next: Party) => void;
  namePlaceholder: string;
  emailPlaceholder: string;
  addressPlaceholder: string;
}

export function PartyFields({
  prefix,
  value,
  onChange,
  namePlaceholder,
  emailPlaceholder,
  addressPlaceholder,
}: PartyFieldsProps) {
  return (
    <div className="grid grid-cols-1 gap-4 @xs:grid-cols-2">
      <Field
        name={`${prefix}.name`}
        label="Name"
        value={value.name}
        placeholder={namePlaceholder}
        autoComplete="off"
        onChange={(name) => onChange({ ...value, name })}
      />
      <Field
        name={`${prefix}.email`}
        label="Email"
        type="email"
        value={value.email}
        placeholder={emailPlaceholder}
        onChange={(email) => onChange({ ...value, email })}
      />
      <Field
        name={`${prefix}.address`}
        label="Address"
        multiline
        rows={3}
        value={value.address}
        placeholder={addressPlaceholder}
        className="@xs:col-span-2"
        onChange={(address) => onChange({ ...value, address })}
      />
    </div>
  );
}
