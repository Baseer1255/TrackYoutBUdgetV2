import React, { useState } from 'react';
import { useExchangeRates } from '../hooks/useExchangeRates';
import { ArrowRightLeft, Loader2 } from 'lucide-react';

const COMMON_CURRENCIES = ['USD', 'EUR', 'GBP', 'INR', 'CAD', 'AUD', 'JPY'];

export default function CurrencyConverter({ defaultBase = 'USD' }) {
  const { rates, loading, error, convert } = useExchangeRates();
  
  const [amount, setAmount] = useState('100');
  const [fromCurrency, setFromCurrency] = useState(defaultBase);
  const [toCurrency, setToCurrency] = useState(defaultBase === 'USD' ? 'EUR' : 'USD');
  
  const handleSwap = () => {
    setFromCurrency(toCurrency);
    setToCurrency(fromCurrency);
  };

  const convertedAmount = convert(Number(amount) || 0, fromCurrency, toCurrency);

  return (
    <div className="bg-card rounded-xl border border-border shadow-sm p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <ArrowRightLeft className="w-4 h-4 text-primary" />
          Quick Converter
        </h3>
        {loading && <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />}
      </div>
      
      {error && !rates && (
        <p className="text-xs text-destructive">Failed to load live rates.</p>
      )}

      <div className="flex items-center gap-2">
        <div className="flex-1">
          <label className="text-[10px] uppercase font-bold text-muted-foreground mb-1 block">Amount</label>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full text-sm rounded-md border border-input bg-background px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary"
            min="0"
            step="0.01"
          />
        </div>
        
        <div className="flex-1">
          <label className="text-[10px] uppercase font-bold text-muted-foreground mb-1 block">From</label>
          <select
            value={fromCurrency}
            onChange={(e) => setFromCurrency(e.target.value)}
            className="w-full text-sm rounded-md border border-input bg-background px-1 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary"
          >
            {COMMON_CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        <button 
          onClick={handleSwap}
          className="mt-4 p-1.5 rounded-full hover:bg-secondary text-muted-foreground transition-colors"
          title="Swap currencies"
        >
          <ArrowRightLeft className="w-3.5 h-3.5" />
        </button>

        <div className="flex-1">
          <label className="text-[10px] uppercase font-bold text-muted-foreground mb-1 block">To</label>
          <select
            value={toCurrency}
            onChange={(e) => setToCurrency(e.target.value)}
            className="w-full text-sm rounded-md border border-input bg-background px-1 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary"
          >
            {COMMON_CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>
      
      <div className="mt-1 bg-secondary/40 rounded-lg p-2 text-center border border-border">
        {loading && !rates ? (
          <span className="text-sm text-muted-foreground">Loading...</span>
        ) : (
          <span className="text-sm font-semibold">
            {Number(amount) || 0} {fromCurrency} = <span className="text-primary">{convertedAmount.toFixed(2)} {toCurrency}</span>
          </span>
        )}
      </div>
    </div>
  );
}
