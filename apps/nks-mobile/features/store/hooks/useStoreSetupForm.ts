import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";

const storeSchema = z.object({
  storeName: z
    .string()
    .min(1, "Store name is required")
    .min(3, "Store name must be at least 3 characters"),
  storeCode: z.string().optional(),
  storeCategoryCode: z.string().min(1, "Category is required"),
  storeLegalTypeCode: z.string().min(1, "Legal type is required"),
  registrationNumber: z.string().optional(),
  taxNumber: z.string().optional(),
  addressLine1: z.string().min(1, "Address line 1 is required"),
  addressLine2: z.string().optional(),
  city: z.string().min(1, "City is required"),
  postalCode: z.string().min(1, "Postal code is required"),
  countryFk: z.number().min(1, "Country is required"),
  stateRegionProvinceText: z.string().optional(),
  stateRegionProvinceFk: z.number().optional(),
  districtText: z.string().optional(),
  districtFk: z.number().optional(),
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
      city: "",
      postalCode: "",
      countryFk: 0,
      stateRegionProvinceText: "",
      stateRegionProvinceFk: 0,
      districtText: "",
      districtFk: 0,
    },
    mode: "onChange",
  });
};
