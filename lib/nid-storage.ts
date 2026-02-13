import { supabase, isSupabaseConfigured } from "./supabase";

/**
 * Get the public URL for an NID card image from Supabase Storage
 * @param nidNumber - The NID number (e.g., "123-456-789")
 * @returns Public URL to the image or null if not configured/found
 */
export function getNIDImageUrl(nidNumber: string): string | null {
  if (!isSupabaseConfigured()) {
    // Return mock image path if Supabase not configured
    return `/mock-nid/${nidNumber}.jpg`;
  }

  try {
    // Get public URL from Supabase Storage
    const { data } = supabase.storage
      .from("nid-images")
      .getPublicUrl(`${nidNumber}.jpg`);

    return data?.publicUrl || null;
  } catch (error) {
    console.error("Error getting NID image URL:", error);
    return null;
  }
}

/**
 * Upload an NID card image to Supabase Storage
 * @param nidNumber - The NID number (filename will be {nidNumber}.jpg)
 * @param file - The image file to upload
 * @returns Success status and URL
 */
export async function uploadNIDImage(
  nidNumber: string,
  file: File
): Promise<{ success: boolean; url?: string; error?: string }> {
  if (!isSupabaseConfigured()) {
    return { success: false, error: "Supabase not configured" };
  }

  try {
    const fileName = `${nidNumber}.jpg`;

    // Upload file to Supabase Storage
    const { data, error } = await supabase.storage
      .from("nid-images")
      .upload(fileName, file, {
        cacheControl: "3600",
        upsert: true, // Replace if exists
      });

    if (error) {
      console.error("Upload error:", error);
      return { success: false, error: error.message };
    }

    // Get the public URL
    const url = getNIDImageUrl(nidNumber);

    return { success: true, url: url || undefined };
  } catch (error) {
    console.error("Error uploading NID image:", error);
    return { success: false, error: String(error) };
  }
}

/**
 * Check if an NID image exists in Supabase Storage
 * @param nidNumber - The NID number to check
 * @returns True if image exists
 */
export async function nidImageExists(nidNumber: string): Promise<boolean> {
  if (!isSupabaseConfigured()) {
    return false;
  }

  try {
    const { data, error } = await supabase.storage
      .from("nid-images")
      .list("", {
        search: `${nidNumber}.jpg`,
      });

    if (error) {
      console.error("Error checking NID image:", error);
      return false;
    }

    return data && data.length > 0;
  } catch (error) {
    console.error("Error checking NID image existence:", error);
    return false;
  }
}
