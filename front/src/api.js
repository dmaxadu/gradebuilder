const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

export const saveGraph = async (nodes, edges, token) => {
  try {
    const response = await fetch(`${API_BASE_URL}/graph/save`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        nodes,
        edges,
        graph_name: 'My Grade',
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to save graph');
    }

    return await response.json();
  } catch (error) {
    console.error('Error saving graph:', error);
    throw error;
  }
};

export const loadGraph = async (token) => {
  try {
    const response = await fetch(`${API_BASE_URL}/graph/load`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      throw new Error('Failed to load graph');
    }

    return await response.json();
  } catch (error) {
    console.error('Error loading graph:', error);
    throw error;
  }
};

export const optimizeLayout = async (nodes, edges, token) => {
  try {
    const response = await fetch(`${API_BASE_URL}/layout/layered`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        nodes,
        edges,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to optimize layout');
    }

    return await response.json();
  } catch (error) {
    console.error('Error optimizing layout:', error);
    throw error;
  }
};
