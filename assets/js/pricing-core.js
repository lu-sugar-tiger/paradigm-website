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

  function floorDivide(numerator, denominator) {
    const quotient = numerator / denominator;
    return numerator < 0n && numerator % denominator ? quotient - 1n : quotient;
  }

  function endingPrice(anchorNumerator, anchorDenominator, floorNumerator, floorDenominator) {
    // Extending 9 + 10k includes -1 internally; displayed prices stay non-negative.
    const lower = 9n + 10n * floorDivide(anchorNumerator - 9n * anchorDenominator, 10n * anchorDenominator);
    let candidate = 2n * anchorNumerator >= (2n * lower + 10n) * anchorDenominator ? lower + 10n : lower;
    if (candidate * floorDenominator < floorNumerator) {
      candidate = 5n + 10n * (floorDivide(anchorNumerator - 5n * anchorDenominator, 10n * anchorDenominator) + 1n);
    }
    if (candidate < 0n || candidate > BigInt(Number.MAX_SAFE_INTEGER)) throw new RangeError("Converted price is out of range.");
    return Number(candidate);
  }

  function referenceFraction(twdPerUsd) {
    if (typeof twdPerUsd !== "number" || !Number.isFinite(twdPerUsd) || twdPerUsd <= 0) {
      throw new TypeError("Reference FX must be positive TWD per USD.");
    }
    return fraction(twdPerUsd);
  }

  function usdPrice(twd, twdPerUsd) {
    amount(twd);
    const [r, rd] = referenceFraction(twdPerUsd);
    if (twd === 0) return 0;
    const [p, pd] = fraction(twd);
    const floorNumerator = p * rd, floorDenominator = pd * r;
    return endingPrice(floorNumerator * 11n, floorDenominator * 10n, floorNumerator, floorDenominator);
  }

  function usdPriceWithSurcharge(baseTwd, surchargeTwd, twdPerUsd) {
    const baseUsd = usdPrice(baseTwd, twdPerUsd);
    const surchargeUsd = usdPrice(surchargeTwd, twdPerUsd);
    // A single priced group must retain its first-pass ending, including $5/$15.
    if (baseUsd === 0 || surchargeUsd === 0) return baseUsd + surchargeUsd;
    const [b, bd] = fraction(baseTwd), [s, sd] = fraction(surchargeTwd);
    const [r, rd] = referenceFraction(twdPerUsd);
    const floorNumerator = (b * sd + s * bd) * rd, floorDenominator = bd * sd * r;
    const sum = BigInt(baseUsd) + BigInt(surchargeUsd);
    return endingPrice(sum, 1n, floorNumerator, floorDenominator);
  }

  const numberFormat = new Intl.NumberFormat("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  function formatPrice(twd, currency = "TWD", reference, surchargeTwd = 0) {
    amount(twd);
    amount(surchargeTwd);
    if (currency === "TWD") return `NT$${numberFormat.format(amount(twd + surchargeTwd))}`;
    if (currency === "USD") return `$${numberFormat.format(usdPriceWithSurcharge(twd, surchargeTwd, reference?.twdPerUsd))}`;
    throw new TypeError(`Unsupported display currency: ${currency}`);
  }

  const api = Object.freeze({ effectiveTwdPrice, usdPrice, usdPriceWithSurcharge, formatPrice });
  global.PARADIGM_PRICING_CORE = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(globalThis);
