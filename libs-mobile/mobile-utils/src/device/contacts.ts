import * as Contacts from "expo-contacts";

export interface ContactItem {
  id: string;
  name: string;
  phoneNumbers: string[];
}

/**
 * Prompts user for native OS contact permission, then streams the entire
 * system address book directly into a parsed array.
 *
 * Perfect for POS features where vendors need to quickly onboard an
 * existing customer or supplier without manually typing phone digits.
 */
export const fetchContacts = async (): Promise<ContactItem[]> => {
  const { status } = await Contacts.requestPermissionsAsync();

  if (status !== "granted") {
    console.warn("[Contacts] Permission denied by the local OS layer.");
    return [];
  }

  // Optimize performance by explicitly filtering only the needed fields directly from OS SQLite.
  const { data } = await Contacts.getContactsAsync({
    fields: [Contacts.Fields.PhoneNumbers],
  });

  return data.map((contact) => ({
    id: contact.id || "",
    name: contact.name || "Unknown",
    phoneNumbers:
      contact.phoneNumbers?.map((p) => p.number || "").filter(Boolean) || [],
  }));
};
