import { useState, useEffect } from 'react';

// Free API, no key required for basic tier, updates once daily
const API_URL = 'https://open.er-api.com/v6/latest/USD';

const CACHE_KEY = 'exchange_rates_cache';
const CACHE_TTL = 1000 * 60 * 60 * 24; // 24 hours

export function useExchangeRates() {
  const [rates, setRates] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchRates = async () => {
      try {
        // Check cache first
        const cached = localStorage.getItem(CACHE_KEY);
        if (cached) {
          const { data, timestamp } = JSON.parse(cached);
          if (Date.now() - timestamp < CACHE_TTL) {
            setRates(data.rates);
            setLoading(false);
            return;
          }
        }

        // Fetch fresh if no cache or expired
        const res = await fetch(API_URL);
        if (!res.ok) throw new Error('Failed to fetch exchange rates');
        const data = await res.json();
        
        setRates(data.rates);
        localStorage.setItem(CACHE_KEY, JSON.stringify({
          data,
          timestamp: Date.now()
        }));
      } catch (err) {
        console.error('Exchange rate error:', err);
        setError(err.message);
        // Fallback to static common rates if API fails completely
        setRates({
          USD: 1,
          EUR: 0.91,
          GBP: 0.78,
          JPY: 150.1,
          CAD: 1.35,
          AUD: 1.53,
          INR: 83.2
        });
      } finally {
        setLoading(false);
      }
    };

    fetchRates();
  }, []);

  /**
   * Convert an amount from one currency to another
   */
  const convert = (amount, fromCurrency, toCurrency) => {
    if (!rates || !amount) return amount;
    if (fromCurrency === toCurrency) return amount;

    const fromRate = rates[fromCurrency] || 1;
    const toRate = rates[toCurrency] || 1;

    // Convert to USD base, then to target
    const inUSD = amount / fromRate;
    return inUSD * toRate;
  };

  return { rates, loading, error, convert };
}
