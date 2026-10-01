(function (global) {
  function amount(value) {
    if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
      throw new TypeError("Prices must be finite, non-negative numeric TWD amounts.");
    }
    return value;
  }

  function effectiveTwdPrice(item) {
    return amount(item.salePrice ?? item.listPrice);
  }

  // Decimal fractions keep exact ties and floor comparisons independent of
  // binary floating-point rounding. No intermediate money value is rounded.
  function fraction(value) {
    const [mantissa, exponent = "0"] = String(value).toLowerCase().split("e");
    const [whole, decimal = ""] = mantissa.split(".");
    const scale = decimal.length - Number(exponent);
    const numerator = BigInt(whole + decimal);
    return scale < 0
      ? [numerator * 10n ** BigInt(-scale), 1n]
      : [numerator, 10n ** BigInt(scale)];
  }

  function usdPrice(twd, twdPerUsd) {
    amount(twd);
    if (typeof twdPerUsd !== "number" || !Number.isFinite(twdPerUsd) || twdPerUsd <= 0) {
      throw new TypeError("Reference FX must be positive TWD per USD.");
    }
    if (twd === 0) return 0;
    const [p, pd] = fraction(twd);
    const [r, rd] = fraction(twdPerUsd);
    const floorNumerator = p * rd, floorDenominator = pd * r;
    const anchorNumerator = floorNumerator * 11n, anchorDenominator = floorDenominator * 10n;
    let candidate = 9n;
    if (anchorNumerator >= 9n * anchorDenominator) {
      const lower = 9n + 10n * ((anchorNumerator - 9n * anchorDenominator) / (10n * anchorDenominator));
      candidate = 2n * anchorNumerator >= (2n * lower + 10n) * anchorDenominator ? lower + 10n : lower;
    }
    if (candidate * floorDenominator < floorNumerator) {
      candidate = anchorNumerator < 5n * anchorDenominator ? 5n
        : 5n + 10n * ((anchorNumerator - 5n * anchorDenominator) / (10n * anchorDenominator) + 1n);
    }
    if (candidate > BigInt(Number.MAX_SAFE_INTEGER)) throw new RangeError("Converted price is too large.");
    return Number(candidate);
  }

  const numberFormat = new Intl.NumberFormat("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  function formatPrice(twd, currency = "TWD", reference) {
    amount(twd);
    if (currency === "TWD") return `NT$${numberFormat.format(twd)}`;
    if (currency === "USD") return `$${numberFormat.format(usdPrice(twd, reference?.twdPerUsd))}`;
    throw new TypeError(`Unsupported display currency: ${currency}`);
  }

  const api = Object.freeze({ effectiveTwdPrice, usdPrice, formatPrice });
  global.PARADIGM_PRICING_CORE = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(globalThis);
