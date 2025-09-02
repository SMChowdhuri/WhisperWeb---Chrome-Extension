// Simple Supabase client implementation using fetch
// This avoids the module loading issues with the UMD bundle

export class SimpleSupabaseClient {
  constructor(url, key) {
    this.url = url.replace(/\/$/, ''); // Remove trailing slash
    this.key = key;
    this.headers = {
      'apikey': key,
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    };
  }

  from(table) {
    return new SupabaseQuery(this.url, this.headers, table);
  }
}

class SupabaseQuery {
  constructor(url, headers, table) {
    this.url = url;
    this.headers = headers;
    this.table = table;
    this.queryParams = {};
    this.selectFields = '*';
    this.orderBy = null;
    this.filters = [];
  }

  select(fields = '*') {
    this.selectFields = fields;
    return this;
  }

  eq(column, value) {
    // Don't double-encode - the URLSearchParams will handle encoding
    this.filters.push(`${column}=eq.${value}`);
    return this;
  }

  order(column, options = {}) {
    const direction = options.ascending === false ? 'desc' : 'asc';
    this.orderBy = `${column}.${direction}`;
    return this;
  }

  limit(count) {
    this.queryParams.limit = count;
    return this;
  }

  async insert(data) {
    try {
      const payload = Array.isArray(data) ? data : [data];
      console.log('Inserting data:', payload);
      
      const response = await fetch(`${this.url}/rest/v1/${this.table}`, {
        method: 'POST',
        headers: {
          ...this.headers,
          'Prefer': 'return=representation'
        },
        body: JSON.stringify(payload)
      });

      console.log('Insert response status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Insert response error:', errorText);
        throw new Error(`Insert failed: ${response.status} ${errorText}`);
      }

      const result = await response.json();
      console.log('Insert successful:', result);
      return { data: result, error: null };
    } catch (error) {
      console.error('Insert error:', error);
      return { data: null, error: { message: error.message } };
    }
  }

  async execute() {
    try {
      let url = `${this.url}/rest/v1/${this.table}`;
      const params = [];

      params.push(`select=${this.selectFields}`);

      this.filters.forEach(filter => {
        const [column, condition] = filter.split('=', 2);
        // condition is "eq.value" - encode the value part only
        const [operator, ...valueParts] = condition.split('.');
        const value = valueParts.join('.');
        params.push(`${column}=${operator}.${encodeURIComponent(value)}`);
      });

      if (this.orderBy) {
        params.push(`order=${this.orderBy}`);
      }

      if (this.queryParams.limit) {
        params.push(`limit=${this.queryParams.limit}`);
      }

      const finalUrl = `${url}?${params.join('&')}`;

      const response = await fetch(finalUrl, {
        method: 'GET',
        headers: this.headers
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Query failed: ${response.status} ${errorText}`);
      }

      const result = await response.json();
      return { data: result, error: null };
    } catch (error) {
      return { data: [], error: { message: error.message } };
    }
  }

  // Alias for execute to match Supabase API
  then(resolve, reject) {
    return this.execute().then(resolve, reject);
  }
}

export function createClient(url, key) {
  return new SimpleSupabaseClient(url, key);
}
