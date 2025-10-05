/**
 * Test JavaScript file for semantic query testing
 */

/**
 * Calculate the factorial of a number
 * @param {number} n - The number to calculate factorial for
 * @returns {number} The factorial result
 */
function factorial(n) {
  if (n <= 1) {
    return 1;
  }
  return n * factorial(n - 1);
}

/**
 * Find the maximum value in an array
 * @param {number[]} numbers - Array of numbers
 * @returns {number} The maximum value
 */
function findMax(numbers) {
  if (!numbers || numbers.length === 0) {
    throw new Error("Array cannot be empty");
  }

  let max = numbers[0];
  for (let i = 1; i < numbers.length; i++) {
    if (numbers[i] > max) {
      max = numbers[i];
    }
  }
  return max;
}

/**
 * Check if a string is a palindrome
 * @param {string} str - The string to check
 * @returns {boolean} True if palindrome, false otherwise
 */
function isPalindrome(str) {
  const cleaned = str.toLowerCase().replace(/[^a-z0-9]/g, "");
  return cleaned === cleaned.split("").reverse().join("");
}

/**
 * Binary search implementation
 * @param {number[]} arr - Sorted array to search in
 * @param {number} target - Target value to find
 * @returns {number} Index of target or -1 if not found
 */
function binarySearch(arr, target) {
  let left = 0;
  let right = arr.length - 1;

  while (left <= right) {
    const mid = Math.floor((left + right) / 2);

    if (arr[mid] === target) {
      return mid;
    } else if (arr[mid] < target) {
      left = mid + 1;
    } else {
      right = mid - 1;
    }
  }

  return -1;
}

module.exports = {
  factorial,
  findMax,
  isPalindrome,
  binarySearch,
};
