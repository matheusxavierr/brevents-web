import type { Room } from "./api-types";

export function companyIdentity(name: string) {
  return name.normalize("NFKC").toLowerCase().trim().replace(/\s+/g, " ");
}

export function isOwnCompanyRoom(room: Room, registrationId: string, company: string) {
  return Boolean((registrationId && room.host_registration === registrationId)
    || (companyIdentity(company) && companyIdentity(company) === companyIdentity(room.company_name || "")));
}
