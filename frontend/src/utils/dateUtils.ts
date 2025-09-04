/**
 * Safely formats a date string or Date object to a localized date string
 * Returns a fallback string if the date is invalid or missing
 * 
 * @param dateValue - Date string, Date object or null/undefined
 * @param fallback - String to return if date is invalid (default: "—")
 * @returns Formatted date string or fallback value
 */
export const formatDate = (dateValue: string | Date | null | undefined, fallback: string = "—"): string => {
  if (!dateValue) {
    return fallback;
  }

  try {
    const date = typeof dateValue === 'string' ? new Date(dateValue) : dateValue;
    
    // Check if date is valid
    if (isNaN(date.getTime())) {
      return fallback;
    }
    
    return date.toLocaleDateString();
  } catch (error) {
    console.error('Error formatting date:', error);
    return fallback;
  }
};

/**
 * Safely formats a date string or Date object to a localized date and time string
 * Returns a fallback string if the date is invalid or missing
 * 
 * @param dateValue - Date string, Date object or null/undefined
 * @param fallback - String to return if date is invalid (default: "—")
 * @returns Formatted date and time string or fallback value
 */
export const formatDateTime = (dateValue: string | Date | null | undefined, fallback: string = "—"): string => {
  if (!dateValue) {
    return fallback;
  }

  try {
    const date = typeof dateValue === 'string' ? new Date(dateValue) : dateValue;
    
    // Check if date is valid
    if (isNaN(date.getTime())) {
      return fallback;
    }
    
    return date.toLocaleString();
  } catch (error) {
    console.error('Error formatting date and time:', error);
    return fallback;
  }
};
