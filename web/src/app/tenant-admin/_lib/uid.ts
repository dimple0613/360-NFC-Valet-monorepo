import { query } from "./db";

export async function maxCardUid(propertyId?: number | null): Promise<bigint> {
  const { rows } = await query<{ max_uid: string | null }>(
    propertyId
      ? `SELECT MAX(NULLIF(regexp_replace(uid, '[^0-9]', '', 'g'), '')::bigint) AS max_uid
         FROM nfc_cards WHERE property_id=$1`
      : `SELECT MAX(NULLIF(regexp_replace(uid, '[^0-9]', '', 'g'), '')::bigint) AS max_uid
         FROM nfc_cards`,
    propertyId ? [propertyId] : []
  );
  return rows[0].max_uid ? BigInt(rows[0].max_uid) : 0n;
}

export async function nextUidStart(propertyId?: number | null): Promise<bigint> {
  return (await maxCardUid(propertyId)) + 1n;
}
