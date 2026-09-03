"use server";

import { revalidatePath } from "next/cache";
import { DuplicateCurrencyCodeError, createCurrency, deleteCurrency, updateCurrency } from "@saasclaude/db";
import { requirePlatformAccess } from "@/lib/auth/current-user";

const MANAGE_PLANS_PERMISSION = "core.platform.manage_plans";

export interface CurrencyFormState {
  error: string | null;
}

function readInput(formData: FormData) {
  return {
    code: String(formData.get("code") ?? "").trim().toUpperCase(),
    name: String(formData.get("name") ?? "").trim(),
    format: String(formData.get("format") ?? "").trim(),
    isActive: formData.get("isActive") === "on",
  };
}

export interface CurrencyDialogState {
  error: string | null;
  success: boolean;
}

/**
 * Non-redirecting create for the "Add currency" popup on the list page. Returns
 * success/error so the dialog can close + toast in-place instead of navigating.
 */
export async function createCurrencyDialogAction(formData: FormData): Promise<CurrencyDialogState> {
  try {
    await requirePlatformAccess(MANAGE_PLANS_PERMISSION);
  } catch {
    return { error: "You don't have permission to do that.", success: false };
  }

  const input = readInput(formData);
  if (!input.code || !input.name || !input.format) {
    return { error: "Code, name, and format are all required.", success: false };
  }

  try {
    await createCurrency(input);
  } catch (error) {
    if (error instanceof DuplicateCurrencyCodeError) {
      return { error: error.message, success: false };
    }
    console.error(error);
    return { error: "Something went wrong. Please try again.", success: false };
  }

  revalidatePath("/super-admin/currencies");
  return { error: null, success: true };
}

/**
 * Non-redirecting update for the "Edit currency" popup on the list page. Returns
 * success/error so the dialog can close + toast in-place instead of navigating.
 */
export async function updateCurrencyDialogAction(formData: FormData): Promise<CurrencyDialogState> {
  const id = String(formData.get("id") ?? "");
  try {
    await requirePlatformAccess(MANAGE_PLANS_PERMISSION);
  } catch {
    return { error: "You don't have permission to do that.", success: false };
  }

  const input = readInput(formData);
  if (!input.code || !input.name || !input.format) {
    return { error: "Code, name, and format are all required.", success: false };
  }

  try {
    await updateCurrency(id, input);
  } catch (error) {
    console.error(error);
    return { error: error instanceof Error ? error.message : "Something went wrong. Please try again.", success: false };
  }

  revalidatePath("/super-admin/currencies");
  return { error: null, success: true };
}

export async function deleteCurrencyAction(id: string): Promise<void> {
  await requirePlatformAccess(MANAGE_PLANS_PERMISSION);
  await deleteCurrency(id);
  revalidatePath("/super-admin/currencies");
}
