import { Handler } from '@netlify/functions';

const API_URL = 'https://api.novaposhta.ua/v2.0/json/';
const API_KEY = process.env.VITE_NOVAPOSHTA_API_KEY;

export const handler: Handler = async (event) => {
  // Handle preflight OPTIONS request for CORS (helpful for local cross-port dev)
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
      },
      body: '',
    };
  }

  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method Not Allowed' }),
    };
  }

  if (!API_KEY) {
    console.error('VITE_NOVAPOSHTA_API_KEY is not defined in the server environment!');
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Server environment misconfiguration: API key missing' }),
    };
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const { action, search, cityRef } = body;

    let payload = {};

    if (action === 'getCities') {
      payload = {
        apiKey: API_KEY,
        modelName: 'Address',
        calledMethod: 'getCities',
        methodProperties: {
          FindByString: search || '',
          Limit: '20',
        },
      };
    } else if (action === 'getWarehouses') {
      payload = {
        apiKey: API_KEY,
        modelName: 'Address',
        calledMethod: 'getWarehouses',
        methodProperties: {
          CityRef: cityRef || '',
          FindByString: search || '',
          Limit: '100',
        },
      };
    } else {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Invalid action parameter' }),
      };
    }

    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Nova Poshta API responded with status ${response.status}`);
    }

    const data = await response.json();

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify(data),
    };
  } catch (error) {
    console.error('Error proxying request to Nova Poshta API:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
    return {
      statusCode: 500,
      body: JSON.stringify({ error: errorMessage }),
    };
  }
};
