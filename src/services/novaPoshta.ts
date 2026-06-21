const API_URL = 'https://api.novaposhta.ua/v2.0/json/';
const API_KEY = import.meta.env.VITE_NOVAPOSHTA_API_KEY;

if (!API_KEY) {
  console.warn('VITE_NOVAPOSHTA_API_KEY is not defined in the environment variables. Nova Poshta autocomplete will not work.');
}

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
 * Searches for cities in the Nova Poshta database by matching name.
 * Requires at least 2 characters search string.
 */
export async function fetchCities(search: string): Promise<NovaPoshtaCity[]> {
  if (!search || search.trim().length < 2) return [];

  const payload = {
    apiKey: API_KEY,
    modelName: 'Address',
    calledMethod: 'getCities',
    methodProperties: {
      FindByString: search.trim(),
      Limit: '20'
    }
  };

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
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
 * Fetches departments/warehouses for a given city Ref from Nova Poshta database.
 */
export async function fetchWarehouses(cityRef: string, search: string = ''): Promise<NovaPoshtaWarehouse[]> {
  if (!cityRef) return [];

  const payload = {
    apiKey: API_KEY,
    modelName: 'Address',
    calledMethod: 'getWarehouses',
    methodProperties: {
      CityRef: cityRef,
      FindByString: search.trim(),
      Limit: '100'
    }
  };

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
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
