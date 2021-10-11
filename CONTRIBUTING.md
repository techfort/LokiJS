First of all, thank you for contributing.

## Overview

We try our best to adhere to the [airbnb](https://github.com/airbnb/javascript/blob/master/README.md) javascript style guidelines.

If you spot non-compliant code in our codebase do not hesitate to flag it or even submit a pull request.
Running `npm run lint` can help.

We do not ask that you agree with our guidelines but if you want to contribute you will have to respect them.

## Pull-requests

LokiJS puts a strong emphasis on performance. Make sure to benchmark performance on your machine before and after you apply a change and ensure performance is unchanged (or unnoticeable), even better if it is improved.
Verify your changes are non-breaking by running `npm test`, and if you're adding a feature make sure to add a test somewhere in the relevant file in `spec/` (or a brand new file if the test cannot be included in existing files).

## A few things we recommend

Most of these are included in the airbnb style guide but we feel like highlighting them:

* use shortcuts in if conditions, and always follow with a statements in curly brackets. Do not do:
`if (something) return;` instead do `if (something) { return; }`
* Name callbacks. When possible, try to declare them as functions that can be cached to save memory. This also makes your code more readable. So, instead of

```javascript
result.filter(function () { /* ... */ });
```

try to do:

```javascript
function doFilter(obj) {
  // ...
}
result.filter(doFilter);
```

## A few things we will not accept

* comma first (commas at the starts of lines)
* avoid-semicolon-at-all-costs stupidity
* general hipster code
* coffeescript/TypeScript
