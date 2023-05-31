/**
 * General utils, including statistical functions
 */
export function isDeepProperty(field) {
  return field.indexOf(".") !== -1;
}

export function add(a, b) {
  return a + b;
}

export function sub(a, b) {
  return a - b;
}

export function average(array) {
  return array.reduce(add, 0) / array.length;
}

export function standardDeviation(values) {
  const avg = average(values);
  const squareDiffs = values.map(function (value) {
    const diff = value - avg;
    const sqrDiff = diff * diff;
    return sqrDiff;
  });

  const avgSquareDiff = average(squareDiffs);

  const stdDev = Math.sqrt(avgSquareDiff);
  return stdDev;
}
