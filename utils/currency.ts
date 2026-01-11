export const numberToWords = (amount: number, currency: string = 'USD'): string => {
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  const convertGroup = (n: number): string => {
    if (n === 0) return '';
    if (n < 20) return ones[n];
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 !== 0 ? '-' + ones[n % 10] : '');
    return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 !== 0 ? ' ' + convertGroup(n % 100) : '');
  };

  const convertWhole = (n: number): string => {
    if (n === 0) return 'Zero';
    let output = '';
    
    const billions = Math.floor(n / 1000000000);
    n %= 1000000000;
    if (billions > 0) output += convertGroup(billions) + ' Billion ';

    const millions = Math.floor(n / 1000000);
    n %= 1000000;
    if (millions > 0) output += convertGroup(millions) + ' Million ';

    const thousands = Math.floor(n / 1000);
    n %= 1000;
    if (thousands > 0) output += convertGroup(thousands) + ' Thousand ';

    const remainder = n;
    if (remainder > 0) output += convertGroup(remainder);

    return output.trim();
  };

  const roundedAmount = Math.round(amount * 100) / 100;
  const wholePart = Math.floor(roundedAmount);
  const decimalPart = Math.round((roundedAmount - wholePart) * 100);

  const wholeWords = convertWhole(wholePart).toUpperCase();
  // Simple logic to guess currency name, default to passed string if unknown
  let currencyName = currency;
  let centName = 'CENTS';
  
  if (currency.includes('USD') || currency === '$') currencyName = 'US DOLLARS';
  if (currency.includes('QAR')) { currencyName = 'QATAR RIYALS'; centName = 'DIRHAMS'; }
  if (currency.includes('EUR')) currencyName = 'EUROS';
  if (currency.includes('GBP')) { currencyName = 'POUNDS'; centName = 'PENCE'; }

  let result = `${currencyName} ${wholeWords}`;

  if (decimalPart > 0) {
    result += ` AND ${decimalPart}/100`; // Standard banking format
  } else {
    result += ` ONLY`;
  }

  return result;
};