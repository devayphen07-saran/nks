import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";

const storeSchema = z.object({
  // Step 1: Basic info
  storeName: z
    .string()
    .min(1, "Store name is required")
    .min(3, "Store name must be at least 3 characters"),
  storeCode: z.string().optional(),
  storeCategoryCode: z.string().min(1, "Category is required"),
  storeLegalTypeCode: z.string().min(1, "Legal type is required"),
  registrationNumber: z.string().optional(),
  taxNumber: z.string().optional(),

  // Step 3: Address (India-specific)
  addressLine1: z.string().min(1, "Address is required"),
  addressLine2: z.string().optional(),
  stateFk: z.number().min(1, "State is required"),
  districtFk: z.number().min(1, "District is required"),
  pincode: z
    .string()
    .length(6, "Pincode must be 6 digits")
    .refine((v) => /^\d+$/.test(v), "Pincode must contain only digits"),
  city: z.string().min(1, "City is required"),
});

export type StoreFormValues = z.infer<typeof storeSchema>;

export const useStoreSetupForm = () => {
  return useForm<StoreFormValues>({
    resolver: zodResolver(storeSchema),
    defaultValues: {
      storeName: "",
      storeCode: "",
      storeCategoryCode: "",
      storeLegalTypeCode: "",
      registrationNumber: "",
      taxNumber: "",
      addressLine1: "",
      addressLine2: "",
      stateFk: 0,
      districtFk: 0,
      pincode: "",
      city: "",
    },
    mode: "onChange",
  });
};
