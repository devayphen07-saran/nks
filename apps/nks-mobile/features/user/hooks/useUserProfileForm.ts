import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { UserProfile } from "@nks/shared-types";

const profileSchema = z.object({
  name: z.string().min(1, "Name is required").min(2, "Name is too short"),
  email: z
    .string()
    .email("Invalid email format")
    .optional()
    .or(z.string().length(0)),
  phoneNumber: z.string().optional(),
});

export type ProfileFormValues = z.infer<typeof profileSchema>;

export const useUserProfileForm = (initialData?: UserProfile) => {
  return useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: initialData?.name || "",
      email: initialData?.email || "",
      phoneNumber: initialData?.phoneNumber || "",
    },
    mode: "onChange",
  });
};
