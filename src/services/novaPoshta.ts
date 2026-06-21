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
 * Searches for cities via Netlify serverless function proxy.
 * Requires at least 2 characters search string.
 */
export async function fetchCities(search: string): Promise<NovaPoshtaCity[]> {
  if (!search || search.trim().length < 2) return [];

  try {
    const response = await fetch('/.netlify/functions/nova-poshta', {
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
    const response = await fetch('/.netlify/functions/nova-poshta', {
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

