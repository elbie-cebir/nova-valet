import type { Queryable } from './types';

/** Business identity — shown in the footer, usable on invoices. */
export interface BusinessDetails {
  legalName: string;
  address: string;
  vatNumber: string;
  contactEmail: string;
  contactPhone: string;
}

export async function getBusinessDetails(
  db: Queryable,
): Promise<BusinessDetails | null> {
  const { rows } = await db.query<{
    legal_name: string;
    address: string;
    vat_number: string;
    contact_email: string;
    contact_phone: string;
  }>(
    `select legal_name, address, vat_number, contact_email, contact_phone
     from business_details where id = true`,
  );
  const r = rows[0];
  if (!r) return null;
  return {
    legalName: r.legal_name,
    address: r.address,
    vatNumber: r.vat_number,
    contactEmail: r.contact_email,
    contactPhone: r.contact_phone,
  };
}

export async function updateBusinessDetails(
  db: Queryable,
  v: BusinessDetails,
): Promise<void> {
  await db.query(
    `update business_details set
       legal_name=$1, address=$2, vat_number=$3, contact_email=$4, contact_phone=$5,
       updated_at=now()
     where id = true`,
    [v.legalName, v.address, v.vatNumber, v.contactEmail, v.contactPhone],
  );
}
