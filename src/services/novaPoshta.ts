export interface NovaPoshtaCity {
  Ref: string;
  Description: string;
}

export interface NovaPoshtaWarehouse {
  Ref: string;
  Description: string;
  Number: string;
}

interface NovaPoshtaResponse<T> {
  success: boolean;
  data: T[];
  errors: string[];
  warnings: string[];
}

/**
 * Helper to construct the API URL. 
 * If running on localhost, routes requests to the production Netlify functions.
 */
export const getFunctionUrl = (path: string): string => {
  if (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
    return `https://sweet.serh.one${path}`;
  }
  return path;
};

/**
 * Searches for cities via Netlify serverless function proxy.
 * Requires at least 2 characters search string.
 */
export async function fetchCities(search: string): Promise<NovaPoshtaCity[]> {
  if (!search || search.trim().length < 2) return [];

  try {
    const response = await fetch(getFunctionUrl('/.netlify/functions/nova-poshta'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'getCities',
        search: search.trim()
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result: NovaPoshtaResponse<NovaPoshtaCity> = await response.json();
    if (result.success) {
      return result.data;
    } else {
      console.error('Nova Poshta API error: ', result.errors);
      return [];
    }
  } catch (error) {
    console.error('Error fetching cities: ', error);
    return [];
  }
}

/**
 * Fetches departments/warehouses for a given city Ref via Netlify serverless function proxy.
 */
export async function fetchWarehouses(cityRef: string, search: string = ''): Promise<NovaPoshtaWarehouse[]> {
  if (!cityRef) return [];

  try {
    const response = await fetch(getFunctionUrl('/.netlify/functions/nova-poshta'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'getWarehouses',
        cityRef,
        search: search.trim()
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result: NovaPoshtaResponse<NovaPoshtaWarehouse> = await response.json();
    if (result.success) {
      return result.data;
    } else {
      console.error('Nova Poshta API error: ', result.errors);
      return [];
    }
  } catch (error) {
    console.error('Error fetching warehouses: ', error);
    return [];
  }
}

