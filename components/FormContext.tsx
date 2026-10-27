import { createContext, useContext } from "react";
import type { FieldErrors } from "@/lib/types";

interface FormContextValue {
  /** Errors that are currently allowed to show (touched, attempted or immediate). */
  errors: FieldErrors;
  touch: (key: string) => void;
}

export const FormContext = createContext<FormContextValue>({
  errors: {},
  touch: () => {},
});

export function useFormContext(): FormContextValue {
  return useContext(FormContext);
}
